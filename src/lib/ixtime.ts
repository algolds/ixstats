// src/lib/ixtime.ts
// IxTime system - Fixed epoch data alignment with missing functions added

import { env } from "~/env";
import type { BotTimeResponse, BotEndpointStatusResponse } from "~/types/ixstats";

export class IxTime {
  // Real-world epoch: October 4, 2020
  private static readonly REAL_WORLD_EPOCH = new Date(2020, 9, 4, 0, 0, 0, 0).getTime();
  
  // In-game epoch: January 1, 2028 (this is when roster data represents)
  // This is the "in-game year zero" baseline
  private static readonly IN_GAME_EPOCH = new Date(2028, 0, 1, 0, 0, 0, 0).getTime();
  
  private static readonly BASE_TIME_MULTIPLIER = 4.0; // 4x faster than real time (before speed change)
  private static readonly POST_SPEED_CHANGE_MULTIPLIER = 2.0; // 2x faster after 7/27/25
  private static readonly SPEED_CHANGE_DATE = new Date('2025-07-27T00:00:00.000Z'); // Speed change on 7/27/25 midnight
  private static readonly BOT_API_URL = typeof window !== 'undefined' 
    ? env.NEXT_PUBLIC_IXTIME_BOT_URL 
    : env.IXTIME_BOT_URL;
  
  // Fallback values if bot is unavailable
  private static timeOverride: number | null = null;
  private static timeOverrideSetAt: number | null = null; // When the override was set (real time)
  private static multiplierOverride: number | null = null;
  private static lastKnownBotTime: number | null = null;
  private static lastSyncTime: number | null = null;
  private static botAvailable = true;

  /**
   * Get the natural/default time multiplier based on current real time
   */
  static getDefaultMultiplier(): number {
    // Speed change happened on 7/27/25 real time, so check against current real time
    const currentRealTime = new Date();
    return currentRealTime >= this.SPEED_CHANGE_DATE ? this.POST_SPEED_CHANGE_MULTIPLIER : this.BASE_TIME_MULTIPLIER;
  }

  /**
   * Get the in-game epoch timestamp (January 1, 2028)
   * This is when roster data represents - the baseline for all calculations
   */
  static getInGameEpoch(): number {
    return this.IN_GAME_EPOCH;
  }

  /**
   * Get the real-world epoch timestamp (October 4, 2020) 
   * This is when IxTime started running
   */
  static getRealWorldEpoch(): number {
    return this.REAL_WORLD_EPOCH;
  }

  /**
   * Convert a real-world timestamp to its IxTime equivalent
   */
  static convertToIxTime(realWorldTimestamp: number): number {
    const multiplier = this.getTimeMultiplier();
    if (multiplier === 0) {
      return this.timeOverride ?? this.getCurrentIxTimeInternal();
    }
    
    // Calculate how much real time has elapsed since the real-world epoch
    const realSecondsElapsed = (realWorldTimestamp - this.REAL_WORLD_EPOCH) / 1000;
    
    // Apply the time multiplier to get IxTime seconds elapsed
    const ixSecondsElapsed = realSecondsElapsed * multiplier;
    
    // Add to the real-world epoch to get current IxTime
    return this.REAL_WORLD_EPOCH + (ixSecondsElapsed * 1000);
  }

  /**
   * Get current IxTime - this is the "present moment" in the game world
   */
  static getCurrentIxTime(): number {
    // If there's a time override, calculate progressing time from that point
    if (this.timeOverride !== null && this.timeOverrideSetAt !== null) {
      const now = Date.now();
      const realTimeElapsedSinceOverride = now - this.timeOverrideSetAt;
      
      // Get current multiplier
      const currentMultiplier = this.multiplierOverride !== null ? this.multiplierOverride : this.getDefaultMultiplier();
      
      // If paused, return the static override time
      if (currentMultiplier === 0) {
        return this.timeOverride;
      }
      
      // Calculate progressing time from override point
      const ixTimeElapsed = realTimeElapsedSinceOverride * currentMultiplier;
      return this.timeOverride + ixTimeElapsed;
    }
    
    // Calculate time with current multiplier from epoch
    const now = Date.now();
    const realSecondsElapsed = (now - this.REAL_WORLD_EPOCH) / 1000;
    
    // Use multiplier override if set, otherwise use natural progression
    const currentMultiplier = this.multiplierOverride !== null ? this.multiplierOverride : this.getDefaultMultiplier();
    
    // Simple calculation: time flows at the current multiplier rate from epoch
    const ixSecondsElapsed = realSecondsElapsed * currentMultiplier;
    return this.REAL_WORLD_EPOCH + (ixSecondsElapsed * 1000);
  }

  private static getCurrentIxTimeInternal(): number {
    const now = Date.now();
    const realSecondsElapsed = (now - this.REAL_WORLD_EPOCH) / 1000;
    const ixSecondsElapsed = realSecondsElapsed * this.BASE_TIME_MULTIPLIER;
    return this.REAL_WORLD_EPOCH + (ixSecondsElapsed * 1000);
  }

  /**
   * Calculate years elapsed between two IxTime timestamps
   */
  static getYearsElapsed(startIxTime: number | Date, endIxTime?: number | Date): number {
    const startMs = startIxTime instanceof Date ? startIxTime.getTime() : startIxTime;
    const endMs = endIxTime instanceof Date ? endIxTime.getTime() : (endIxTime || this.getCurrentIxTime());
    
    const millisecondsPerYear = 365.25 * 24 * 60 * 60 * 1000;
    return (endMs - startMs) / millisecondsPerYear;
  }

  /**
   * FIXED: Added missing getYearsBetween function as alias for getYearsElapsed
   * Calculate years between two IxTime timestamps (absolute value)
   */
  static getYearsBetween(startIxTime: number | Date, endIxTime: number | Date): number {
    return Math.abs(this.getYearsElapsed(startIxTime, endIxTime));
  }

  /**
   * Calculate years elapsed since the in-game epoch (roster baseline)
   * This tells us how many years have passed since January 1, 2028
   */
  static getYearsSinceGameEpoch(ixTime?: number): number {
    const currentTime = ixTime || this.getCurrentIxTime();
    return this.getYearsElapsed(this.IN_GAME_EPOCH, currentTime);
  }

  /**
   * Get the current in-game year (starting from 2028)
   */
  static getCurrentGameYear(ixTime?: number): number {
    const yearsSinceEpoch = this.getYearsSinceGameEpoch(ixTime);
    return 2028 + Math.floor(yearsSinceEpoch);
  }

  /**
   * Add years to an IxTime timestamp
   */
  static addYears(ixTime: number | Date, years: number): number {
    const timeMs = ixTime instanceof Date ? ixTime.getTime() : ixTime;
    const millisecondsPerYear = 365.25 * 24 * 60 * 60 * 1000;
    return timeMs + (years * millisecondsPerYear);
  }

  /**
   * Add months to an IxTime timestamp
   */
  static addMonths(ixTime: number | Date, months: number): number {
    const timeMs = ixTime instanceof Date ? ixTime.getTime() : ixTime;
    const date = new Date(timeMs);
    date.setMonth(date.getMonth() + months);
    return date.getTime();
  }

  /**
   * Create an IxTime timestamp from in-game date components
   * Year should be relative to the game world (2028+)
   */
  static createGameTime(year: number, month: number, day: number, hour = 0, minute = 0, second = 0): number {
    // Create date in the game timeline
    return new Date(Date.UTC(year, month - 1, day, hour, minute, second)).getTime();
  }

  /**
   * Format IxTime timestamp as a readable date
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
   * Get a human-readable description of the time relative to game epoch
   */
  static getGameTimeDescription(ixTime?: number): string {
    const currentTime = ixTime || this.getCurrentIxTime();
    const yearsSinceEpoch = this.getYearsSinceGameEpoch(currentTime);
    const currentYear = this.getCurrentGameYear(currentTime);
    
    if (yearsSinceEpoch < 0) {
      return `${Math.abs(yearsSinceEpoch).toFixed(1)} years before game start`;
    } else if (yearsSinceEpoch < 1) {
      const monthsSince = yearsSinceEpoch * 12;
      return `${monthsSince.toFixed(1)} months since game start (${currentYear})`;
    } else {
      return `${yearsSinceEpoch.toFixed(1)} years since game start (${currentYear})`;
    }
  }
  
  private static async fetchFromBot(): Promise<BotTimeResponse | null> {
    try {
      const response = await fetch(`${this.BOT_API_URL}/ixtime`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(2000)
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

  static async fetchStatusFromBot(): Promise<BotEndpointStatusResponse | null> {
    try {
      const response = await fetch(`${this.BOT_API_URL}/ixtime/status`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(2000)
      });
      
      if (!response.ok) {
        throw new Error(`Bot API returned ${response.status}`);
      }
      
      const data: BotEndpointStatusResponse = await response.json();
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

  static async syncWithBot(): Promise<{ success: boolean; message: string; data?: BotTimeResponse }> {
    const botData = await this.fetchFromBot();
    
    if (botData) {
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

  // Legacy fallback methods
  static setTimeOverride(ixTime: number): void {
    this.timeOverride = ixTime;
    this.timeOverrideSetAt = Date.now(); // Record when override was set
  }

  static clearTimeOverride(): void {
    this.timeOverride = null;
    this.timeOverrideSetAt = null;
  }

  static setMultiplierOverride(multiplier: number): void {
    this.multiplierOverride = multiplier;
  }

  static clearMultiplierOverride(): void {
    this.multiplierOverride = null;
  }

  static getTimeMultiplier(): number {
    if (this.multiplierOverride !== null) {
      return this.multiplierOverride;
    }
    return this.getDefaultMultiplier();
  }

  static isPaused(): boolean {
    return this.getTimeMultiplier() === 0;
  }

  /**
   * Set time multiplier naturally (clear override if it matches natural progression)
   */
  static setNaturalMultiplier(multiplier: number): { isNatural: boolean; message: string } {
    const naturalMultiplier = this.getDefaultMultiplier();
    
    if (multiplier === naturalMultiplier) {
      // Clear override to use natural progression
      this.multiplierOverride = null;
      return {
        isNatural: true,
        message: `Set to natural ${multiplier}x speed for current era`
      };
    } else {
      // Set as override since it doesn't match natural progression
      this.multiplierOverride = multiplier;
      return {
        isNatural: false,
        message: `Set to ${multiplier}x speed (override)`
      };
    }
  }

  /**
   * Check if current multiplier is natural (not overridden)
   */
  static isMultiplierNatural(): boolean {
    return this.multiplierOverride === null;
  }

  static async getCurrentIxTimeFromBot(): Promise<number> {
    const botData = await this.fetchFromBot();
    return botData ? botData.ixTimeTimestamp : this.getCurrentIxTime();
  }

  static async getStatus() {
    let botStatusData = null;
    try {
      botStatusData = await this.fetchStatusFromBot();
    } catch (error) {
      console.warn('[IxTime] Failed to fetch bot status in getStatus:', error);
    }
    
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
      realWorldEpoch: new Date(this.REAL_WORLD_EPOCH).toISOString(),
      inGameEpoch: new Date(this.IN_GAME_EPOCH).toISOString(),
      yearsSinceGameStart: this.getYearsSinceGameEpoch(),
      currentGameYear: this.getCurrentGameYear(),
      gameTimeDescription: this.getGameTimeDescription(),
      
      // Bot sync status
      botAvailable: this.botAvailable,
      lastSyncTime: this.lastSyncTime ? new Date(this.lastSyncTime).toISOString() : null,
      lastKnownBotTime: this.lastKnownBotTime ? new Date(this.lastKnownBotTime).toISOString() : null,
      
      // Bot status (if available)
      botStatus: botStatusData ? {
        ixTimeTimestamp: botStatusData.ixTimeTimestamp,
        ixTimeFormatted: botStatusData.ixTimeFormatted,
        multiplier: botStatusData.multiplier,
        isPaused: botStatusData.isPaused,
        hasTimeOverride: botStatusData.hasTimeOverride,
        hasMultiplierOverride: botStatusData.hasMultiplierOverride,
        pausedAt: botStatusData.pausedAt,
        pauseTimestamp: botStatusData.pauseTimestamp,
        botReady: botStatusData.botStatus?.ready || false,
        botUser: botStatusData.botStatus?.user || null,
        guilds: botStatusData.botStatus?.guilds || 0,
        uptime: botStatusData.botStatus?.uptime || 0
      } : null
    };
  }

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
          message: `Bot is ${data.bot?.ready ? 'ready' : 'starting up'}${data.ixtime?.isPaused ? ' (PAUSED)' : ''}` 
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

  static dateToTimestamp(date: Date): number {
    return date.getTime();
  }

  static timestampToDate(timestamp: number): Date {
    return new Date(timestamp);
  }
}