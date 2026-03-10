const fs = require("fs");

// HELPER FUNCTIONS

function toSeconds(timeStr) {
    let [time, period] = timeStr.split(' ');
    let [h, m, s] = time.split(':').map(Number);
    if (period === 'pm' && h !== 12) h += 12;
    if (period === 'am' && h === 12) h = 0;
    return h * 3600 + m * 60 + s; }

function durationToSec(d) {
    let [h, m, s] = d.split(':').map(Number);
    return h * 3600 + m * 60 + s; }

function formatTime(seconds, format = 'hh') {
    let hours = Math.floor(seconds / 3600);
    let mins = Math.floor((seconds % 3600) / 60);
    let secs = seconds % 60;
    
    let hoursStr;
    if (format === 'h') {
        hoursStr = String(hours); // no leading zeros
    } else if (format === 'hhh') {
        hoursStr = String(hours).padStart(3, '0'); // 3 digits with leading zeros
    } else {
        hoursStr = String(hours).padStart(2, '0'); // 2 digits with leading zeros
    }
    
    return `${hoursStr}:${String(mins).padStart(2,'0')}:${String(secs).padStart(2,'0')}`;
}

function isEid(date) {
    return date >= '2025-04-10' && date <= '2025-04-30'; }

function getDayOfWeek(date) {
    let d = new Date(date);
    return ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][d.getDay()];
}

// ============================================================
// Function 1: getShiftDuration(startTime, endTime)
// startTime: (typeof string) formatted as hh:mm:ss am or hh:mm:ss pm
// endTime: (typeof string) formatted as hh:mm:ss am or hh:mm:ss pm
// Returns: string formatted as h:mm:ss
// ============================================================
function getShiftDuration(startTime, endTime) {
    let s = toSeconds(startTime);
    let e = toSeconds(endTime);
    if (e < s) e += 24*3600;
    return formatTime(e - s, 'h'); }

// ============================================================
// Function 2: getIdleTime(startTime, endTime)
// startTime: (typeof string) formatted as hh:mm:ss am or hh:mm:ss pm
// endTime: (typeof string) formatted as hh:mm:ss am or hh:mm:ss pm
// Returns: string formatted as h:mm:ss
// ============================================================
function getIdleTime(startTime, endTime) {
  let s = toSeconds(startTime);
    let e = toSeconds(endTime);
    if (e < s) e += 24*3600;
    
    let idle = 0;
    let current = s;
    
    while (current < e) {
        let hour = (current % 86400) / 3600;
        if (hour < 8 || hour >= 22) {
            idle++;
        }
        current++;
    }
    
    return formatTime(idle, 'h');
}

// ============================================================
// Function 3: getActiveTime(shiftDuration, idleTime)
// shiftDuration: (typeof string) formatted as h:mm:ss
// idleTime: (typeof string) formatted as h:mm:ss
// Returns: string formatted as h:mm:ss
// ============================================================
function getActiveTime(shiftDuration, idleTime) {
    let active = Math.max(0, durationToSec(shiftDuration) - durationToSec(idleTime));
    return formatTime(active, 'h');
}

// ============================================================
// Function 4: metQuota(date, activeTime)
// date: (typeof string) formatted as yyyy-mm-dd
// activeTime: (typeof string) formatted as h:mm:ss
// Returns: boolean
// ============================================================
function metQuota(date, activeTime) {
   let quota = isEid(date) ? 6*3600 : 8*3600 + 24*60;
    return durationToSec(activeTime) >= quota;
}

// ============================================================
// Function 5: addShiftRecord(textFile, shiftObj)
// textFile: (typeof string) path to shifts text file
// shiftObj: (typeof object) has driverID, driverName, date, startTime, endTime
// Returns: object with 10 properties or empty object {}
// ============================================================
function addShiftRecord(textFile, shiftObj) {
    try {
        let content = fs.readFileSync(textFile, 'utf8');
        let lines = content.split('\n').filter(line => line.trim() !== '');
        
        for (let i = 1; i < lines.length; i++) {
            let parts = lines[i].split(',');
            if (parts[0] === shiftObj.driverID && parts[2] === shiftObj.date) {
                return {};
            }
        }

        let shiftDur = getShiftDuration(shiftObj.startTime, shiftObj.endTime);
        let idle = getIdleTime(shiftObj.startTime, shiftObj.endTime);
        let active = getActiveTime(shiftDur, idle);
        let quota = metQuota(shiftObj.date, active);
        
        let insertIdx = lines.length;
        for (let i = lines.length - 1; i > 0; i--) {
            let parts = lines[i].split(',');
            if (parts[0] === shiftObj.driverID) {
                insertIdx = i + 1;
                break;
            }
        }
        
        let newRecord = [
            shiftObj.driverID,
            shiftObj.driverName,
            shiftObj.date,
            shiftObj.startTime,
            shiftObj.endTime,
            shiftDur,
            idle,
            active,
            quota ? 'true' : 'false',
            'false'
        ];
        
        let newLine = newRecord.join(',');
        lines.splice(insertIdx, 0, newLine);
        fs.writeFileSync(textFile, lines.join('\n') + '\n');
        
        return {
            driverID: shiftObj.driverID,
            driverName: shiftObj.driverName,
            date: shiftObj.date,
            startTime: shiftObj.startTime,
            endTime: shiftObj.endTime,
            shiftDuration: shiftDur,
            idleTime: idle,
            activeTime: active,
            metQuota: quota,
            hasBonus: false
        };
    } catch (e) {
        return {};
    }
}

// ============================================================
// Function 6: setBonus(textFile, driverID, date, newValue)
// textFile: (typeof string) path to shifts text file
// driverID: (typeof string)
// date: (typeof string) formatted as yyyy-mm-dd
// newValue: (typeof boolean)
// Returns: nothing (void)
// ============================================================
function setBonus(textFile, driverID, date, newValue) {
    try {
        let content = fs.readFileSync(textFile, 'utf8');
        let lines = content.split('\n');
        
        for (let i = 1; i < lines.length; i++) {
            if (!lines[i].trim()) continue;
            let parts = lines[i].split(',');
            if (parts[0] === driverID && parts[2] === date) {
                parts[9] = newValue.toString();
                lines[i] = parts.join(',');
                break; }
        }
        
        fs.writeFileSync(textFile, lines.join('\n'));
    } catch (e) {}
}

// ============================================================
// Function 7: countBonusPerMonth(textFile, driverID, month)
// textFile: (typeof string) path to shifts text file
// driverID: (typeof string)
// month: (typeof string) formatted as mm or m
// Returns: number (-1 if driverID not found)
// ============================================================
function countBonusPerMonth(textFile, driverID, month) {
     try {
        let m = month.padStart(2, '0');
        let content = fs.readFileSync(textFile, 'utf8');
        let lines = content.split('\n').filter(line => line.trim() !== '');
        
        let exists = false;
        let count = 0;
        
        for (let i = 1; i < lines.length; i++) {
            let parts = lines[i].split(',');
            if (parts[0] === driverID) {
                exists = true;
                let recordMonth = parts[2].substring(5, 7);
                if (recordMonth === m && parts[9] === 'true') {
                    count++;
                }
            }
        }
        
        return exists ? count : -1;
    } catch (e) {
        return -1; }
}

// ============================================================
// Function 8: getTotalActiveHoursPerMonth(textFile, driverID, month)
// textFile: (typeof string) path to shifts text file
// driverID: (typeof string)
// month: (typeof number)
// Returns: string formatted as hhh:mm:ss
// ============================================================
function getTotalActiveHoursPerMonth(textFile, driverID, month) {
   try {
        let m = String(month).padStart(2, '0');
        let content = fs.readFileSync(textFile, 'utf8');
        let lines = content.split('\n').filter(line => line.trim() !== '');
        
        let total = 0;
        
        for (let i = 1; i < lines.length; i++) {
            let parts = lines[i].split(',');
            if (parts[0] === driverID) {
                let recordMonth = parts[2].substring(5, 7);
                if (recordMonth === m) {
                    total += durationToSec(parts[7]);
                }
            }
        }
       
        let hours = Math.floor(total / 3600);
        let mins = Math.floor((total % 3600) / 60);
        let secs = total % 60;
        
        return `${hours}:${String(mins).padStart(2,'0')}:${String(secs).padStart(2,'0')}`;
    } catch (e) {
        return "0:00:00";
    }
}

// ============================================================
// Function 9: getRequiredHoursPerMonth(textFile, rateFile, bonusCount, driverID, month)
// textFile: (typeof string) path to shifts text file
// rateFile: (typeof string) path to driver rates text file
// bonusCount: (typeof number) total bonuses for given driver per month
// driverID: (typeof string)
// month: (typeof number)
// Returns: string formatted as hhh:mm:ss
// ============================================================
function getRequiredHoursPerMonth(textFile, rateFile, bonusCount, driverID, month) {
    try {
        let m = String(month).padStart(2, '0');
        
        let rateContent = fs.readFileSync(rateFile, 'utf8');
        let rateLines = rateContent.split('\n').filter(line => line.trim() !== '');
        
        let dayOff = null;
        for (let i = 0; i < rateLines.length; i++) {
            let parts = rateLines[i].split(',');
            if (parts[0] === driverID) {
                dayOff = parts[1];
                break;
            }
        }
        
        if (!dayOff) return "0:00:00";
        
        let shiftContent = fs.readFileSync(textFile, 'utf8');
        let shiftLines = shiftContent.split('\n').filter(line => line.trim() !== '');
        
        let totalSeconds = 0;
        
        for (let i = 1; i < shiftLines.length; i++) {
            let parts = shiftLines[i].split(',');
            if (parts[0] === driverID) {
                let recordMonth = parts[2].substring(5, 7);
                if (recordMonth === m) {
                    let date = parts[2];
                    if (getDayOfWeek(date) !== dayOff) {
                        totalSeconds += isEid(date) ? 6 * 3600 : 8 * 3600 + 24 * 60;
                    }
                }
            }
        }
        
        totalSeconds = Math.max(0, totalSeconds - (bonusCount * 2 * 3600));
        
        let hours = Math.floor(totalSeconds / 3600);
        let mins = Math.floor((totalSeconds % 3600) / 60);
        let secs = totalSeconds % 60;
        
        return `${hours}:${String(mins).padStart(2,'0')}:${String(secs).padStart(2,'0')}`;
    } catch (e) {
        return "0:00:00";
    }
}

// ============================================================
// Function 10: getNetPay(driverID, actualHours, requiredHours, rateFile)
// driverID: (typeof string)
// actualHours: (typeof string) formatted as hhh:mm:ss
// requiredHours: (typeof string) formatted as hhh:mm:ss
// rateFile: (typeof string) path to driver rates text file
// Returns: integer (net pay)
// ============================================================
function getNetPay(driverID, actualHours, requiredHours, rateFile) {
   try {
        let rateContent = fs.readFileSync(rateFile, 'utf8');
        let rateLines = rateContent.split('\n').filter(line => line.trim() !== '');
        
        let basePay = 0;
        let tier = 0;
        
        for (let i = 0; i < rateLines.length; i++) {
            let parts = rateLines[i].split(',');
            if (parts[0] === driverID) {
                basePay = parseInt(parts[2], 10);
                tier = parseInt(parts[3], 10);
                break;
            }
        }
        
        if (basePay === 0) return 0;
        
        let allowedMissing = 0;
        if (tier === 1) allowedMissing = 50;
        else if (tier === 2) allowedMissing = 20;
        else if (tier === 3) allowedMissing = 10;
        else if (tier === 4) allowedMissing = 3;
        
        let actualSec = durationToSec(actualHours);
        let requiredSec = durationToSec(requiredHours);
        
        if (actualSec >= requiredSec) return basePay;
        
        let missingSec = requiredSec - actualSec;
        let allowedSec = allowedMissing * 3600;
        
        if (missingSec <= allowedSec) return basePay;
        
        let billableSec = missingSec - allowedSec;
        let billableHours = Math.floor(billableSec / 3600);
        let ratePerHour = Math.floor(basePay / 185);
        
        return basePay - (billableHours * ratePerHour);
    } catch (e) {
        return 0;
    }
}

module.exports = {
    getShiftDuration,
    getIdleTime,
    getActiveTime,
    metQuota,
    addShiftRecord,
    setBonus,
    countBonusPerMonth,
    getTotalActiveHoursPerMonth,
    getRequiredHoursPerMonth,
    getNetPay
};
