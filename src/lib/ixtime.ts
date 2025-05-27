// lib/ixtime.ts
// IxTime system - JavaScript/TypeScript implementation with Discord Bot sync

interface BotTimeResponse {
  realTime: string;
  ixTimeTimestamp: number;
  ixTimeFormatted: string;
  multiplier: number;
  isPaused: boolean;
  hasTimeOverride: boolean;
  hasMultiplierOverride: boolean;
  epoch: string;
}

interface BotStatusResponse extends BotTimeResponse {
  ixTimeFormattedShort: string;
  baseMultiplier: number;
  timeOverrideValue: number | null;
  multiplierOverrideValue: number | null;
  epochTimestamp: number;
  botStatus: {
    ready: boolean;
    readyAt: string | null;
    uptime: number | null;
    user: {
      id: string;
      username: string;
      tag: string;
    } | null;
  };
}

export class IxTime {
  private static readonly EPOCH = new Date(2020, 9, 4, 0, 0, 0, 0).getTime(); // October 4, 2020 (Month is 0-indexed)
  private static readonly BASE_TIME_MULTIPLIER = 4.0; // 4x faster than real time
  private static readonly BOT_API_URL = process.env.IXTIME_BOT_URL || 'http://localhost:3001';
  
  // Fallback values if bot is unavailable
  private static timeOverride: number | null = null;
  private static multiplierOverride: number | null = null;
  private static lastKnownBotTime: number | null = null;
  private static lastSyncTime: number | null = null;
  private static botAvailable: boolean = true;

  /**
   * Fetch current time from Discord bot (authoritative source)
   */
  private static async fetchFromBot(): Promise<BotTimeResponse | null> {
    try {
      const response = await fetch(`${this.BOT_API_URL}/ixtime`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(2000) // 2 second timeout
      });
      
      if (!response.ok) {
        throw new Error(`Bot API returned ${response.status}`);
      }
      
      const data: BotTimeResponse = await response.json();
      this.lastKnownBotTime = data.ixTimeTimestamp;
      this.lastSyncTime = Date.now();
      this.botAvailable = true;
      
      return data;
    } catch (error) {
      console.warn(`[IxTime] Failed to fetch from bot: ${error instanceof Error ? error.message : 'Unknown error'}`);
      this.botAvailable = false;
      return null;
    }
  }

  /**
   * Get detailed status from Discord bot
   */
  static async fetchStatusFromBot(): Promise<BotStatusResponse | null> {
    try {
      const response = await fetch(`${this.BOT_API_URL}/ixtime/status`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(2000)
      });
      
      if (!response.ok) {
        throw new Error(`Bot API returned ${response.status}`);
      }
      
      const data: BotStatusResponse = await response.json();
      this.lastKnownBotTime = data.ixTimeTimestamp;
      this.lastSyncTime = Date.now();
      this.botAvailable = true;
      
      return data;
    } catch (error) {
      console.warn(`[IxTime] Failed to fetch status from bot: ${error instanceof Error ? error.message : 'Unknown error'}`);
      this.botAvailable = false;
      return null;
    }
  }

  /**
   * Manually sync time with Discord bot
   */
  static async syncWithBot(): Promise<{ success: boolean; message: string; data?: BotTimeResponse }> {
    const botData = await this.fetchFromBot();
    
    if (botData) {
      // Clear any local overrides since bot is authoritative
      this.timeOverride = null;
      this.multiplierOverride = null;
      
      return {
        success: true,
        message: 'Successfully synced with Discord bot',
        data: botData
      };
    } else {
      return {
        success: false,
        message: 'Failed to sync with Discord bot - using fallback time'
      };
    }
  }

  /**
   * Send time override command to Discord bot
   */
  static async setBotTimeOverride(ixTime: number, multiplier?: number): Promise<{ success: boolean; message: string }> {
    try {
      const response = await fetch(`${this.BOT_API_URL}/ixtime/override`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ixTimeMs: ixTime, multiplier }),
        signal: AbortSignal.timeout(5000)
      });
      
      if (!response.ok) {
        throw new Error(`Bot API returned ${response.status}`);
      }
      
      const result = await response.json();
      return { success: true, message: result.message };
    } catch (error) {
      return { 
        success: false, 
        message: `Failed to set bot time override: ${error instanceof Error ? error.message : 'Unknown error'}` 
      };
    }
  }

  /**
   * Clear all overrides on Discord bot
   */
  static async clearBotOverrides(): Promise<{ success: boolean; message: string }> {
    try {
      const response = await fetch(`${this.BOT_API_URL}/ixtime/clear`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(5000)
      });
      
      if (!response.ok) {
        throw new Error(`Bot API returned ${response.status}`);
      }
      
      const result = await response.json();
      return { success: true, message: result.message };
    } catch (error) {
      return { 
        success: false, 
        message: `Failed to clear bot overrides: ${error instanceof Error ? error.message : 'Unknown error'}` 
      };
    }
  }

  /**
   * Pause time on Discord bot
   */
  static async pauseBotTime(): Promise<{ success: boolean; message: string }> {
    try {
      const response = await fetch(`${this.BOT_API_URL}/ixtime/pause`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(5000)
      });
      
      if (!response.ok) {
        throw new Error(`Bot API returned ${response.status}`);
      }
      
      const result = await response.json();
      return { success: true, message: result.message };
    } catch (error) {
      return { 
        success: false, 
        message: `Failed to pause bot time: ${error instanceof Error ? error.message : 'Unknown error'}` 
      };
    }
  }

  /**
   * Resume time on Discord bot
   */
  static async resumeBotTime(): Promise<{ success: boolean; message: string }> {
    try {
      const response = await fetch(`${this.BOT_API_URL}/ixtime/resume`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(5000)
      });
      
      if (!response.ok) {
        throw new Error(`Bot API returned ${response.status}`);
      }
      
      const result = await response.json();
      return { success: true, message: result.message };
    } catch (error) {
      return { 
        success: false, 
        message: `Failed to resume bot time: ${error instanceof Error ? error.message : 'Unknown error'}` 
      };
    }
  }

  // === Legacy fallback methods (kept for compatibility) ===

  /**
   * Set admin time override (fallback - prefer bot methods)
   */
  static setTimeOverride(ixTime: number): void {
    this.timeOverride = ixTime;
    console.warn('[IxTime] Using local time override - consider using setBotTimeOverride instead');
  }

  static clearTimeOverride(): void {
    this.timeOverride = null;
  }

  static setMultiplierOverride(multiplier: number): void {
    this.multiplierOverride = multiplier;
    console.warn('[IxTime] Using local multiplier override - consider using bot methods instead');
  }

  static clearMultiplierOverride(): void {
    this.multiplierOverride = null;
  }

  static getTimeMultiplier(): number {
    return this.multiplierOverride !== null ? this.multiplierOverride : this.BASE_TIME_MULTIPLIER;
  }

  // === Local fallback time calculation ===

  /**
   * Convert a real-world timestamp to its IxTime equivalent (fallback method)
   */
  static convertToIxTime(realWorldTimestamp: number): number {
    const multiplier = this.getTimeMultiplier();
    if (multiplier === 0) {
      return this.timeOverride ?? this.EPOCH + ((Date.now() - this.EPOCH) / this.BASE_TIME_MULTIPLIER);
    }
    const secondsSinceEpochReal = (realWorldTimestamp - this.EPOCH) / 1000;
    const ixSecondsSinceEpoch = secondsSinceEpochReal * multiplier;
    return this.EPOCH + (ixSecondsSinceEpoch * 1000);
  }

  // === Main public methods ===

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

  /**
   * Get current IxTime - tries bot first, falls back to local calculation
   */
  static getCurrentIxTime(): number {
    // For server-side operations, we'll use the sync version since we can't await
    // For client-side, this should be called via the async method
    if (this.timeOverride !== null) {
      return this.timeOverride;
    }
    
    // If we have recent bot data, extrapolate from it
    if (this.lastKnownBotTime && this.lastSyncTime) {
      const timeSinceSync = Date.now() - this.lastSyncTime;
      if (timeSinceSync < 30000) { // Use bot data if less than 30 seconds old
        return this.lastKnownBotTime + timeSinceSync * this.getTimeMultiplier();
      }
    }
    
    // Fall back to local calculation
    return this.convertToIxTime(Date.now());
  }

  /**
   * Get current IxTime asynchronously from bot (preferred method)
   */
  static async getCurrentIxTimeFromBot(): Promise<number> {
    const botData = await this.fetchFromBot();
    return botData ? botData.ixTimeTimestamp : this.getCurrentIxTime();
  }

  /**
   * Calculate years elapsed between two IxTime timestamps.
   */
  static getYearsElapsed(startIxTime: number, endIxTime?: number): number {
    const end = endIxTime || this.getCurrentIxTime();
    const millisecondsPerYear = 365.25 * 24 * 60 * 60 * 1000;
    return (end - startIxTime) / millisecondsPerYear;
  }

  static addYears(ixTime: number, years: number): number {
    const date = new Date(ixTime);
    const millisecondsPerYear = 365.25 * 24 * 60 * 60 * 1000;
    return date.getTime() + (years * millisecondsPerYear);
  }

  /**
   * Creates an IxTime timestamp from real-world date components.
   */
  static createIxTime(year: number, month: number, day: number, hour = 0, minute = 0, second = 0): number {
    const realDate = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
    return this.convertToIxTime(realDate.getTime());
  }

  static isPaused(): boolean {
    return this.getTimeMultiplier() === 0;
  }

  /**
   * Get comprehensive status including bot connectivity
   */
  static async getStatus() {
    const botStatus = await this.fetchStatusFromBot();
    const currentRealTime = Date.now();
    const currentIxTime = this.getCurrentIxTime();
    
    return {
      // Local status
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
      
      // Bot sync status
      botAvailable: this.botAvailable,
      lastSyncTime: this.lastSyncTime ? new Date(this.lastSyncTime).toISOString() : null,
      lastKnownBotTime: this.lastKnownBotTime ? new Date(this.lastKnownBotTime).toISOString() : null,
      
      // Bot status (if available)
      botStatus: botStatus ? {
        ixTimeTimestamp: botStatus.ixTimeTimestamp,
        ixTimeFormatted: botStatus.ixTimeFormatted,
        multiplier: botStatus.multiplier,
        isPaused: botStatus.isPaused,
        hasTimeOverride: botStatus.hasTimeOverride,
        hasMultiplierOverride: botStatus.hasMultiplierOverride,
        botReady: botStatus.botStatus.ready,
        botUser: botStatus.botStatus.user
      } : null
    };
  }

  /**
   * Health check for bot connectivity
   */
  static async checkBotHealth(): Promise<{ available: boolean; message: string }> {
    try {
      const response = await fetch(`${this.BOT_API_URL}/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(3000)
      });
      
      if (response.ok) {
        const data = await response.json();
        this.botAvailable = true;
        return { 
          available: true, 
          message: `Bot is ${data.botReady ? 'ready' : 'starting up'}` 
        };
      } else {
        this.botAvailable = false;
        return { 
          available: false, 
          message: `Bot API returned ${response.status}` 
        };
      }
    } catch (error) {
      this.botAvailable = false;
      return { 
        available: false, 
        message: `Bot unreachable: ${error instanceof Error ? error.message : 'Unknown error'}` 
      };
    }
  }
}