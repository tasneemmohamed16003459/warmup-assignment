const fs = require("fs");

// ============================================================
// Function 1: getShiftDuration(startTime, endTime)
// startTime: (typeof string) formatted as hh:mm:ss am or hh:mm:ss pm
// endTime: (typeof string) formatted as hh:mm:ss am or hh:mm:ss pm
// Returns: string formatted as hh:mm:ss
// ============================================================
function getShiftDuration(startTime, endTime) {
    // Helper function to convert time string to seconds since midnight
    function timeToSeconds(timeStr) {
        const [time, period] = timeStr.split(' ');
        let [hours, minutes, seconds] = time.split(':').map(Number);
        
        // Convert to 24-hour format
        if (period === 'pm' && hours !== 12) hours += 12;
        if (period === 'am' && hours === 12) hours = 0;
        
        return hours * 3600 + minutes * 60 + seconds;
    }
    
    let startSeconds = timeToSeconds(startTime);
    let endSeconds = timeToSeconds(endTime);
    
    // Handle overnight shifts
    if (endSeconds < startSeconds) {
        endSeconds += 24 * 3600;
    }
    
    let diffSeconds = endSeconds - startSeconds;
    
    // Format as hh:mm:ss (with leading zeros for hours)
    const hours = Math.floor(diffSeconds / 3600);
    diffSeconds %= 3600;
    const minutes = Math.floor(diffSeconds / 60);
    const seconds = diffSeconds % 60;
    
    return `${String(hours).padStart(1, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

// ============================================================
// Function 2: getIdleTime(startTime, endTime)
// startTime: (typeof string) formatted as hh:mm:ss am or hh:mm:ss pm
// endTime: (typeof string) formatted as hh:mm:ss am or hh:mm:ss pm
// Returns: string formatted as hh:mm:ss
// ============================================================
function getIdleTime(startTime, endTime) {
    function timeToSeconds(timeStr) {
        const [time, period] = timeStr.split(' ');
        let [hours, minutes, seconds] = time.split(':').map(Number);
        
        if (period === 'pm' && hours !== 12) hours += 12;
        if (period === 'am' && hours === 12) hours = 0;
        
        return hours * 3600 + minutes * 60 + seconds;
    }
    
    const DELIVERY_START = 8 * 3600; // 8:00:00 AM in seconds
    const DELIVERY_END = 22 * 3600;   // 10:00:00 PM in seconds
    
    let startSeconds = timeToSeconds(startTime);
    let endSeconds = timeToSeconds(endTime);
    
    // Handle overnight shifts
    if (endSeconds < startSeconds) {
        endSeconds += 24 * 3600;
    }
    
    let idleSeconds = 0;
    let currentTime = startSeconds;
    
    while (currentTime < endSeconds) {
        const timeInDay = currentTime % (24 * 3600);
        
        if (timeInDay < DELIVERY_START) {
            // Before delivery hours - all idle
            const nextBoundary = Math.min(
                endSeconds,
                Math.floor(currentTime / (24 * 3600)) * (24 * 3600) + DELIVERY_START
            );
            idleSeconds += nextBoundary - currentTime;
            currentTime = nextBoundary;
        } else if (timeInDay >= DELIVERY_END) {
            // After delivery hours - all idle
            const nextDay = Math.ceil(currentTime / (24 * 3600)) * (24 * 3600);
            const nextBoundary = Math.min(endSeconds, nextDay);
            idleSeconds += nextBoundary - currentTime;
            currentTime = nextBoundary;
        } else {
            // During delivery hours - move to next boundary (end of delivery hours or end of shift)
            const nextBoundary = Math.min(
                endSeconds,
                Math.floor(currentTime / (24 * 3600)) * (24 * 3600) + DELIVERY_END
            );
            currentTime = nextBoundary;
        }
    }
    
    // Format as hh:mm:ss (with leading zeros for hours)
    const hours = Math.floor(idleSeconds / 3600);
    idleSeconds %= 3600;
    const minutes = Math.floor(idleSeconds / 60);
    const seconds = idleSeconds % 60;
    
    return `${String(hours).padStart(1, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

// ============================================================
// Function 3: getActiveTime(shiftDuration, idleTime)
// shiftDuration: (typeof string) formatted as h:mm:ss
// idleTime: (typeof string) formatted as h:mm:ss
// Returns: string formatted as h:mm:ss
// ============================================================
function getActiveTime(shiftDuration, idleTime) {
    function timeToSeconds(timeStr) {
        const [hours, minutes, seconds] = timeStr.split(':').map(Number);
        return hours * 3600 + minutes * 60 + seconds;
    }
    
    const shiftSeconds = timeToSeconds(shiftDuration);
    const idleSeconds = timeToSeconds(idleTime);
    
    const activeSeconds = Math.max(0, shiftSeconds - idleSeconds);
    
    const hours = Math.floor(activeSeconds / 3600);
    const remainingSeconds = activeSeconds % 3600;
    const minutes = Math.floor(remainingSeconds / 60);
    const seconds = remainingSeconds % 60;
    
    // Format as h:mm:ss (no leading zeros for hours)
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

// ============================================================
// Function 4: metQuota(date, activeTime)
// date: (typeof string) formatted as yyyy-mm-dd
// activeTime: (typeof string) formatted as h:mm:ss
// Returns: boolean
// ============================================================
function metQuota(date, activeTime) {
    function timeToSeconds(timeStr) {
        const [hours, minutes, seconds] = timeStr.split(':').map(Number);
        return hours * 3600 + minutes * 60 + seconds;
    }
    
    const activeSeconds = timeToSeconds(activeTime);
    
    // Check if date is within Eid period (April 10-30, 2025)
    const [year, month, day] = date.split('-').map(Number);
    const isEidPeriod = year === 2025 && month === 4 && day >= 10 && day <= 30;
    
    const NORMAL_QUOTA = 8 * 3600 + 24 * 60; // 8 hours 24 minutes in seconds
    const EID_QUOTA = 6 * 3600; // 6 hours in seconds
    
    const requiredSeconds = isEidPeriod ? EID_QUOTA : NORMAL_QUOTA;
    
    return activeSeconds >= requiredSeconds;
}

// ============================================================
// Function 5: addShiftRecord(textFile, shiftObj)
// textFile: (typeof string) path to shifts text file
// shiftObj: (typeof object) has driverID, driverName, date, startTime, endTime
// Returns: object with 10 properties or empty object {}
// ============================================================
function addShiftRecord(textFile, shiftObj) {
    try {
        // Read the file
        let fileContent = fs.readFileSync(textFile, 'utf8');
        const lines = fileContent.trim().split('\n').filter(line => line.trim() !== '');
        
        // Parse existing records
        const records = [];
        for (let i = 1; i < lines.length; i++) { // Skip header
            if (lines[i].trim() === '') continue;
            const [driverID, driverName, date, startTime, endTime, shiftDuration, idleTime, activeTime, metQuota, hasBonus] = lines[i].split(',');
            records.push({
                driverID, driverName, date, startTime, endTime,
                shiftDuration, idleTime, activeTime,
                metQuota: metQuota === 'true',
                hasBonus: hasBonus === 'true'
            });
        }
        
        // Check for duplicate (same driverID and date)
        const isDuplicate = records.some(record => 
            record.driverID === shiftObj.driverID && record.date === shiftObj.date
        );
        
        if (isDuplicate) {
            return {};
        }
        
        // Calculate derived values
        const shiftDuration = getShiftDuration(shiftObj.startTime, shiftObj.endTime);
        const idleTime = getIdleTime(shiftObj.startTime, shiftObj.endTime);
        const activeTime = getActiveTime(shiftDuration, idleTime);
        const metQuotaValue = metQuota(shiftObj.date, activeTime);
        const hasBonus = false; // Default value
        
        const newRecord = {
            driverID: shiftObj.driverID,
            driverName: shiftObj.driverName,
            date: shiftObj.date,
            startTime: shiftObj.startTime,
            endTime: shiftObj.endTime,
            shiftDuration,
            idleTime,
            activeTime,
            metQuota: metQuotaValue,
            hasBonus
        };
        
        // Find where to insert the new record
        let insertIndex = records.length;
        
        // Find last occurrence of this driverID to insert after it
        for (let i = records.length - 1; i >= 0; i--) {
            if (records[i].driverID === shiftObj.driverID) {
                insertIndex = i + 1;
                break;
            }
        }
        
        // Insert the new record
        records.splice(insertIndex, 0, newRecord);
        
        // Write back to file with header
        const header = "DriverID,DriverName,Date,StartTime,EndTime,ShiftDuration,IdleTime,ActiveTime,MetQuota,HasBonus";
        const outputLines = records.map(record => 
            `${record.driverID},${record.driverName},${record.date},${record.startTime},${record.endTime},${record.shiftDuration},${record.idleTime},${record.activeTime},${record.metQuota},${record.hasBonus}`
        );
        
        fs.writeFileSync(textFile, [header, ...outputLines].join('\n') + '\n');
        
        return newRecord;
        
    } catch (error) {
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
        // Read the file
        let fileContent = fs.readFileSync(textFile, 'utf8');
        const lines = fileContent.split('\n');
        
        if (lines.length === 0) return;
        
        // Process each line
        const updatedLines = [];
        
        for (let i = 0; i < lines.length; i++) {
            let line = lines[i].trim();
            if (line === '') {
                updatedLines.push('');
                continue;
            }
            
            const parts = line.split(',');
            
            // Check if this is the record we want to update (skip header row)
            if (i > 0 && parts[0] === driverID && parts[2] === date) {
                // Update hasBonus (last field)
                parts[9] = newValue.toString();
                updatedLines.push(parts.join(','));
            } else {
                updatedLines.push(lines[i]); // Keep original line (with original formatting)
            }
        }
        
        // Write back to file
        fs.writeFileSync(textFile, updatedLines.join('\n'));
        
    } catch (error) {
        // Silently fail as per function specification
    }
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
        // Normalize month to two digits
        const monthStr = month.padStart(2, '0');
        
        // Read the file
        let fileContent = fs.readFileSync(textFile, 'utf8');
        const lines = fileContent.trim().split('\n').filter(line => line.trim() !== '');
        
        let driverExists = false;
        let bonusCount = 0;
        
        // Skip header (index 0)
        for (let i = 1; i < lines.length; i++) {
            const parts = lines[i].split(',');
            if (parts[0] === driverID) {
                driverExists = true;
                const recordDate = parts[2];
                const recordMonth = recordDate.substring(5, 7); // Extract MM from yyyy-mm-dd
                
                if (recordMonth === monthStr && parts[9] === 'true') {
                    bonusCount++;
                }
            }
        }
        
        return driverExists ? bonusCount : -1;
        
    } catch (error) {
        return -1;
    }
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
        // Format month to two digits
        const monthStr = String(month).padStart(2, '0');
        
        // Read the file
        let fileContent = fs.readFileSync(textFile, 'utf8');
        const lines = fileContent.trim().split('\n').filter(line => line.trim() !== '');
        
        let totalSeconds = 0;
        
        // Skip header (index 0)
        for (let i = 1; i < lines.length; i++) {
            const parts = lines[i].split(',');
            if (parts[0] === driverID) {
                const recordDate = parts[2];
                const recordMonth = recordDate.substring(5, 7);
                
                if (recordMonth === monthStr) {
                    const activeTime = parts[7]; // activeTime field
                    const [hours, minutes, seconds] = activeTime.split(':').map(Number);
                    totalSeconds += hours * 3600 + minutes * 60 + seconds;
                }
            }
        }
        
        // Format as hhh:mm:ss (3 digits for hours)
        const hours = Math.floor(totalSeconds / 3600);
        totalSeconds %= 3600;
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        
        return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
        
    } catch (error) {
        return "000:00:00";
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
        // Format month to two digits
        const monthStr = String(month).padStart(2, '0');
        
        // Read rate file to get day off
        let rateContent = fs.readFileSync(rateFile, 'utf8');
        const rateLines = rateContent.trim().split('\n').filter(line => line.trim() !== '');
        
        let dayOff = null;
        let driverFound = false;
        
        for (const line of rateLines) {
            const [id, dOff] = line.split(',');
            if (id === driverID) {
                dayOff = dOff;
                driverFound = true;
                break;
            }
        }
        
        if (!driverFound) {
            return "000:00:00";
        }
        
        // Read shifts file
        let shiftContent = fs.readFileSync(textFile, 'utf8');
        const shiftLines = shiftContent.trim().split('\n').filter(line => line.trim() !== '');
        
        // Get all working days (excluding day off)
        const workingDates = [];
        
        // Skip header (index 0)
        for (let i = 1; i < shiftLines.length; i++) {
            const parts = shiftLines[i].split(',');
            if (parts[0] === driverID) {
                const recordDate = parts[2];
                const recordMonth = recordDate.substring(5, 7);
                
                if (recordMonth === monthStr) {
                    // Check if this date is not the day off
                    const dateObj = new Date(recordDate);
                    const dayOfWeek = dateObj.toLocaleDateString('en-US', { weekday: 'long' });
                    
                    if (dayOfWeek !== dayOff) {
                        workingDates.push(recordDate);
                    }
                }
            }
        }
        
        // Calculate required hours
        let requiredSeconds = 0;
        
        for (const date of workingDates) {
            const [year, mon, day] = date.split('-').map(Number);
            const isEidPeriod = year === 2025 && mon === 4 && day >= 10 && day <= 30;
            
            if (isEidPeriod) {
                requiredSeconds += 6 * 3600; // 6 hours
            } else {
                requiredSeconds += 8 * 3600 + 24 * 60; // 8 hours 24 minutes
            }
        }
        
        // Subtract 2 hours per bonus
        requiredSeconds -= bonusCount * 2 * 3600;
        requiredSeconds = Math.max(0, requiredSeconds); // Can't be negative
        
        // Format as hhh:mm:ss (3 digits for hours)
        const hours = Math.floor(requiredSeconds / 3600);
        requiredSeconds %= 3600;
        const minutes = Math.floor(requiredSeconds / 60);
        const seconds = requiredSeconds % 60;
        
        return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
        
    } catch (error) {
        return "000:00:00";
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
        // Read rate file to get driver info
        let rateContent = fs.readFileSync(rateFile, 'utf8');
        const rateLines = rateContent.trim().split('\n').filter(line => line.trim() !== '');
        
        let basePay = 0;
        let tier = 0;
        
        for (const line of rateLines) {
            const [id, , pay, t] = line.split(',');
            if (id === driverID) {
                basePay = parseInt(pay);
                tier = parseInt(t);
                break;
            }
        }
        
        if (basePay === 0 || tier === 0) {
            return 0;
        }
        
        // Allowed missing hours per tier
        const allowedMissingHours = {
            1: 50,
            2: 20,
            3: 10,
            4: 3
        };
        
        const allowed = allowedMissingHours[tier] || 0;
        
        // Parse hours to seconds
        function parseHoursToSeconds(hoursStr) {
            const [h, m, s] = hoursStr.split(':').map(Number);
            return h * 3600 + m * 60 + s;
        }
        
        const actualSeconds = parseHoursToSeconds(actualHours);
        const requiredSeconds = parseHoursToSeconds(requiredHours);
        
        // If actual >= required, no deduction
        if (actualSeconds >= requiredSeconds) {
            return basePay;
        }
        
        // Calculate missing seconds
        let missingSeconds = requiredSeconds - actualSeconds;
        
        // Convert allowed missing hours to seconds
        const allowedSeconds = allowed * 3600;
        
        // Apply allowance
        if (missingSeconds > allowedSeconds) {
            missingSeconds -= allowedSeconds;
        } else {
            return basePay; // All missing hours covered by allowance
        }
        
        // Convert to full hours only (floor)
        const billableMissingHours = Math.floor(missingSeconds / 3600);
        
        // Calculate deduction rate
        const deductionRatePerHour = Math.floor(basePay / 185);
        
        // Calculate deduction and net pay
        const salaryDeduction = billableMissingHours * deductionRatePerHour;
        const netPay = basePay - salaryDeduction;
        
        return netPay;
        
    } catch (error) {
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
