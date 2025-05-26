// lib/ixtime.ts
// IxTime system - JavaScript/TypeScript implementation

export class IxTime {
    private static readonly EPOCH = new Date(2020, 9, 4, 0, 0, 0, 0).getTime(); // October 4, 2020
    private static readonly TIME_MULTIPLIER = 4.0; // 4x faster than real time
  
    /**
     * Convert real time to IxTime
     * @param inputTime - Date object or timestamp
     * @returns IxTime timestamp
     */
    static convertToIxTime(inputTime: Date | number): number {
      const timestamp = inputTime instanceof Date ? inputTime.getTime() : inputTime;
      const secondsSinceEpoch = (timestamp - this.EPOCH) / 1000;
      const ixSeconds = secondsSinceEpoch / this.TIME_MULTIPLIER;
      return this.EPOCH + (ixSeconds * 1000);
    }
  
    /**
     * Format IxTime for display
     * @param ixTime - IxTime timestamp
     * @param includeTime - Whether to include time component
     * @returns Formatted IxTime string
     */
    static formatIxTime(ixTime: number, includeTime = false): string {
      const ixDate = new Date(ixTime);
      const months = [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
      ];
      const weekdays = [
        "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"
      ];
  
      if (includeTime) {
        return `${weekdays[ixDate.getUTCDay()]}, ${months[ixDate.getUTCMonth()]} ${ixDate.getUTCDate()}, ${ixDate.getUTCFullYear()} ${ixDate.getUTCHours().toString().padStart(2, '0')}:${ixDate.getUTCMinutes().toString().padStart(2, '0')}:${ixDate.getUTCSeconds().toString().padStart(2, '0')} (ILT)`;
      } else {
        return `${weekdays[ixDate.getUTCDay()]}, ${months[ixDate.getUTCMonth()]} ${ixDate.getUTCDate()}, ${ixDate.getUTCFullYear()} (ILT)`;
      }
    }
  
    /**
     * Get current IxTime
     * @returns Current IxTime timestamp
     */
    static getCurrentIxTime(): number {
      return this.convertToIxTime(Date.now());
    }
  
    /**
     * Calculate years elapsed in IxTime since a given date
     * @param startDate - Starting date
     * @param endDate - Ending date (defaults to current IxTime)
     * @returns Years elapsed in IxTime
     */
    static getYearsElapsed(startDate: number, endDate?: number): number {
      const end = endDate || this.getCurrentIxTime();
      const startIx = this.convertToIxTime(startDate);
      const endIx = this.convertToIxTime(end);
      
      const millisecondsPerYear = 365.25 * 24 * 60 * 60 * 1000;
      return (endIx - startIx) / millisecondsPerYear;
    }
  
    /**
     * Add years to an IxTime date
     * @param ixTime - Base IxTime
     * @param years - Years to add
     * @returns New IxTime timestamp
     */
    static addYears(ixTime: number, years: number): number {
      const date = new Date(ixTime);
      date.setUTCFullYear(date.getUTCFullYear() + years);
      return date.getTime();
    }
  
    /**
     * Get the IxTime equivalent of real-world date
     * @param year - Year
     * @param month - Month (1-12)
     * @param day - Day
     * @param hour - Hour (optional)
     * @param minute - Minute (optional)
     * @param second - Second (optional)
     * @returns IxTime timestamp
     */
    static createIxTime(year: number, month: number, day: number, hour = 0, minute = 0, second = 0): number {
      const realDate = new Date(year, month - 1, day, hour, minute, second);
      return this.convertToIxTime(realDate);
    }
  }