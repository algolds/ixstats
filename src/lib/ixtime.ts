// lib/ixtime.ts
// IxTime system - JavaScript/TypeScript implementation

export class IxTime {
  private static readonly EPOCH = new Date(2020, 9, 4, 0, 0, 0, 0).getTime(); // October 4, 2020 (Month is 0-indexed)
  private static readonly BASE_TIME_MULTIPLIER = 4.0; // 4x faster than real time
  
  private static timeOverride: number | null = null;
  private static multiplierOverride: number | null = null;

  /**
   * Set admin time override. The system will effectively "jump" to this IxTime.
   * Subsequent getCurrentIxTime calls will reflect this new base, progressing from it.
   */
  static setTimeOverride(ixTime: number): void {
    this.timeOverride = ixTime;
    // When an override is set, we might also want to "reset" the real-world reference point
    // for future calculations if the multiplier is also in effect.
    // For now, this simply sets a fixed IxTime.
  }

  static clearTimeOverride(): void {
    this.timeOverride = null;
  }

  static setMultiplierOverride(multiplier: number): void {
    this.multiplierOverride = multiplier;
  }

  static clearMultiplierOverride(): void {
    this.multiplierOverride = null;
  }

  static getTimeMultiplier(): number {
    return this.multiplierOverride !== null ? this.multiplierOverride : this.BASE_TIME_MULTIPLIER;
  }

  /**
   * Convert a real-world timestamp to its IxTime equivalent.
   * @param realWorldTimestamp - Real-world timestamp (milliseconds since UTC epoch)
   * @returns IxTime timestamp
   */
  static convertToIxTime(realWorldTimestamp: number): number {
    const multiplier = this.getTimeMultiplier();
    if (multiplier === 0) { // If paused, IxTime doesn't advance from the point it was paused
      return this.timeOverride ?? this.EPOCH + ((Date.now() - this.EPOCH) / this.BASE_TIME_MULTIPLIER); // Fallback to non-progressing time
    }
    const secondsSinceEpochReal = (realWorldTimestamp - this.EPOCH) / 1000;
    const ixSecondsSinceEpoch = secondsSinceEpochReal / multiplier;
    return this.EPOCH + (ixSecondsSinceEpoch * 1000);
  }

  static formatIxTime(ixTime: number, includeTime = false): string {
    const ixDate = new Date(ixTime);
    const months = [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December"
    ];
    const weekdays = [
      "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"
    ];

    const day = ixDate.getUTCDate();
    const month = months[ixDate.getUTCMonth()];
    const year = ixDate.getUTCFullYear();
    const weekday = weekdays[ixDate.getUTCDay()];

    if (includeTime) {
      const hours = ixDate.getUTCHours().toString().padStart(2, '0');
      const minutes = ixDate.getUTCMinutes().toString().padStart(2, '0');
      const seconds = ixDate.getUTCSeconds().toString().padStart(2, '0');
      return `${weekday}, ${month} ${day}, ${year} ${hours}:${minutes}:${seconds} (ILT)`;
    } else {
      return `${weekday}, ${month} ${day}, ${year} (ILT)`;
    }
  }

  static getCurrentIxTime(): number {
    if (this.timeOverride !== null) {
      // If there's an override, IxTime is fixed at that value,
      // unless a multiplier is also active, in which case it should advance from override.
      // This simplistic override returns the fixed value.
      // For advancing time from an override point, convertToIxTime logic needs adjustment
      // or this.timeOverride should store the *real time* when the override was set.
      return this.timeOverride;
    }
    return this.convertToIxTime(Date.now());
  }

  /**
   * Calculate years elapsed between two IxTime timestamps.
   * @param startIxTime - Starting IxTime timestamp
   * @param endIxTime - Ending IxTime timestamp (defaults to current IxTime)
   * @returns Years elapsed in IxTime
   */
  static getYearsElapsed(startIxTime: number, endIxTime?: number): number {
    const end = endIxTime || this.getCurrentIxTime();
    // Ensure both are IxTime timestamps before calculating difference
    const millisecondsPerYear = 365.25 * 24 * 60 * 60 * 1000;
    return (end - startIxTime) / millisecondsPerYear;
  }

  static addYears(ixTime: number, years: number): number {
    const date = new Date(ixTime);
    // Add fractional years by converting years to milliseconds
    const millisecondsPerYear = 365.25 * 24 * 60 * 60 * 1000;
    return date.getTime() + (years * millisecondsPerYear);
  }

  /**
   * Creates an IxTime timestamp from real-world date components.
   */
  static createIxTime(year: number, month: number, day: number, hour = 0, minute = 0, second = 0): number {
    // Month is 0-indexed in JavaScript Date constructor
    const realDate = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
    return this.convertToIxTime(realDate.getTime());
  }

  static isPaused(): boolean {
      return this.getTimeMultiplier() === 0;
  }

  static getStatus() {
      const currentRealTime = Date.now();
      const currentIxTime = this.getCurrentIxTime();
      return {
          currentRealTime: new Date(currentRealTime).toISOString(),
          currentIxTime: new Date(currentIxTime).toISOString(),
          formattedIxTime: this.formatIxTime(currentIxTime, true),
          multiplier: this.getTimeMultiplier(),
          isPaused: this.isPaused(),
          hasTimeOverride: this.timeOverride !== null,
          timeOverrideValue: this.timeOverride ? new Date(this.timeOverride).toISOString() : null,
          hasMultiplierOverride: this.multiplierOverride !== null,
          multiplierOverrideValue: this.multiplierOverride,
          epoch: new Date(this.EPOCH).toISOString(),
      };
  }
}