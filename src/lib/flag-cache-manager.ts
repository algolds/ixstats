// src/lib/flag-cache-manager.ts
// Flag Cache Manager for pre-fetching country flags from MediaWiki templates

import { IxnayWikiService } from './mediawiki-service';

export interface FlagCacheStats {
  totalCountries: number;
  cachedFlags: number;
  failedFlags: number;
  lastUpdateTime: number | null;
  nextUpdateTime: number | null;
  isUpdating: boolean;
  updateProgress: {
    current: number;
    total: number;
    percentage: number;
  };
}

export interface FlagCacheConfig {
  updateInterval: number; // milliseconds (default: 24 hours)
  batchSize: number; // number of flags to process in parallel
  batchDelay: number; // delay between batches in milliseconds
  retryAttempts: number; // number of retries for failed flags
  retryDelay: number; // delay between retries in milliseconds
}

const DEFAULT_CONFIG: FlagCacheConfig = {
  updateInterval: 24 * 60 * 60 * 1000, // 24 hours
  batchSize: 3, // Reduced for better reliability
  batchDelay: 1000, // 1 second
  retryAttempts: 2,
  retryDelay: 3000, // 3 seconds
};

export class FlagCacheManager {
  private config: FlagCacheConfig;
  private updateTimer: NodeJS.Timeout | null = null;
  private isUpdating = false;
  private updateProgress = { current: 0, total: 0, percentage: 0 };
  private lastUpdateTime: number | null = null;
  private nextUpdateTime: number | null = null;
  private countryList: string[] = [];
  private failedCountries: Set<string> = new Set();
  private retryQueue: string[] = [];
  private wikiService: IxnayWikiService;

  constructor(config: Partial<FlagCacheConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.wikiService = new IxnayWikiService();
    this.loadLastUpdateTime();
    this.scheduleNextUpdate();
  }

  /**
   * Initialize the flag cache manager with a list of countries
   */
  async initialize(countryNames: string[]): Promise<void> {
    console.log(`[FlagCacheManager] Initializing with ${countryNames.length} countries`);
    this.countryList = [...new Set(countryNames)]; // Remove duplicates
    
    // Check if we need to do an initial update
    if (!this.lastUpdateTime || this.shouldUpdate()) {
      console.log(`[FlagCacheManager] Initial update needed`);
      await this.updateAllFlags();
    } else {
      console.log(`[FlagCacheManager] No update needed, next update in ${this.getTimeUntilNextUpdate()}ms`);
    }
  }

  /**
   * Get flag URL for a specific country
   */
  async getFlagUrl(countryName: string): Promise<string | null> {
    try {
      // First check if we have it cached
      const cachedUrl = this.wikiService.getCachedFlagUrl(countryName);
      if (cachedUrl) {
        return cachedUrl;
      }

      // If not cached, fetch it
      const flagUrl = await this.fetchFlagFromTemplate(countryName);
      return flagUrl;
    } catch (error) {
      console.error(`[FlagCacheManager] Error getting flag for ${countryName}:`, error);
      return null;
    }
  }

  /**
   * Fetch flag URL from MediaWiki template, with debug log support
   */
  private async fetchFlagFromTemplate(countryName: string, debugLog?: string[]): Promise<string | null> {
    try {
      debugLog?.push(`[FlagCacheManager] Fetching flag for: ${countryName}`);
      console.log(`[FlagCacheManager] Fetching flag for: ${countryName}`);
      
      // Try all combinations of underscores and spaces for 'Country_data' and country name
      const baseNames = [
        `Country_data_${countryName}`,
        `Country_data ${countryName}`,
        `Country data ${countryName}`,
        `Country data_${countryName}`,
        `Country_data/${countryName}`,
        `Country data/${countryName}`,
        `Country/${countryName}`,
        `${countryName}_data`,
        `${countryName} data`,
      ];
      const templateNames = baseNames.map(name => `Template:${name}`);

      for (const templateName of templateNames) {
        try {
          debugLog?.push(`[FlagCacheManager] Trying template: ${templateName}`);
          console.log(`[FlagCacheManager] Trying template: ${templateName}`);
          const templateContent = await this.wikiService.getTemplate(templateName);
          debugLog?.push(`[FlagCacheManager] Raw templateContent for ${templateName}: ${typeof templateContent} ${typeof templateContent === 'string' ? templateContent.substring(0, 200) : JSON.stringify(templateContent)}`);
          if (templateContent && typeof templateContent === 'string') {
            debugLog?.push(`[FlagCacheManager] Got template content for ${countryName} from ${templateName}`);
            console.log(`[FlagCacheManager] Got template content for ${countryName} from ${templateName}`);
            // Extract flag alias from template
            const flagAlias = this.extractFlagAlias(templateContent);
            if (flagAlias) {
              debugLog?.push(`[FlagCacheManager] Found flag alias: ${flagAlias} for ${countryName}`);
              console.log(`[FlagCacheManager] Found flag alias: ${flagAlias} for ${countryName}`);
              // Use the flag alias directly, regardless of extension
              const flagUrl = await this.wikiService.getFileUrl(flagAlias);
              debugLog?.push(`[FlagCacheManager] File URL fetch result for ${flagAlias}: ${typeof flagUrl} ${typeof flagUrl === 'string' ? flagUrl : JSON.stringify(flagUrl)}`);
              if (typeof flagUrl === 'string') {
                debugLog?.push(`[FlagCacheManager] Successfully got flag URL: ${flagUrl} for ${countryName}`);
                console.log(`[FlagCacheManager] Successfully got flag URL: ${flagUrl} for ${countryName}`);
                return flagUrl;
              } else {
                debugLog?.push(`[FlagCacheManager] Failed to get file URL for ${flagAlias}`);
                console.log(`[FlagCacheManager] Failed to get file URL for ${flagAlias}`);
                // If the file does not exist, do NOT try to pattern match, just return null
                return null;
              }
            } else {
              debugLog?.push(`[FlagCacheManager] No flag alias found in template for ${countryName} (template: ${templateName})`);
              console.log(`[FlagCacheManager] No flag alias found in template for ${countryName} (template: ${templateName})`);
            }
          } else {
            debugLog?.push(`[FlagCacheManager] Template not found or error: ${templateName}`);
            console.log(`[FlagCacheManager] Template not found or error: ${templateName}`);
          }
        } catch (error) {
          debugLog?.push(`[FlagCacheManager] Error fetching or parsing template ${templateName}: ${error}`);
          console.log(`[FlagCacheManager] Error fetching or parsing template ${templateName}:`, error);
        }
      }

      // Only try common flag patterns as fallback if no flag alias was found in any template
      debugLog?.push(`[FlagCacheManager] Trying common flag patterns for ${countryName}`);
      console.log(`[FlagCacheManager] Trying common flag patterns for ${countryName}`);
      const commonFlagPatterns = [
        `Flag_of_${countryName}.svg`,
        `Flag_of_${countryName}.png`,
        `${countryName}_flag.svg`,
        `${countryName}_flag.png`,
        `Flag_${countryName}.svg`,
        `Flag_${countryName}.png`,
        `${countryName.replace(/\s+/g, '_')}_flag.svg`,
        `${countryName.replace(/\s+/g, '_')}_flag.png`,
      ];

      for (const flagPattern of commonFlagPatterns) {
        try {
          const flagUrl = await this.wikiService.getFileUrl(flagPattern);
          debugLog?.push(`[FlagCacheManager] Pattern file URL fetch for ${flagPattern}: ${typeof flagUrl} ${typeof flagUrl === 'string' ? flagUrl : JSON.stringify(flagUrl)}`);
          if (typeof flagUrl === 'string') {
            debugLog?.push(`[FlagCacheManager] Found flag via pattern: ${flagUrl} for ${countryName}`);
            console.log(`[FlagCacheManager] Found flag via pattern: ${flagUrl} for ${countryName}`);
            return flagUrl;
          }
        } catch (error) {
          debugLog?.push(`[FlagCacheManager] Error fetching flag pattern ${flagPattern}: ${error}`);
          // Continue to next pattern
        }
      }

      debugLog?.push(`[FlagCacheManager] No flag found for ${countryName}`);
      console.log(`[FlagCacheManager] No flag found for ${countryName}`);
      return null;

    } catch (error) {
      debugLog?.push(`[FlagCacheManager] Error fetching flag from template for ${countryName}: ${error}`);
      console.error(`[FlagCacheManager] Error fetching flag from template for ${countryName}:`, error);
      return null;
    }
  }

  /**
   * Extract flag alias from template content
   */
  private extractFlagAlias(templateContent: string): string | null {
    try {
      console.log(`[FlagCacheManager] Extracting flag alias from template (${templateContent.length} chars)`);
      
      // Look for flag alias parameter in various formats
      const aliasPatterns = [
        /\|\s*flag\s*alias\s*=\s*([^|\n\r]+)/i,
        /\|\s*flag-alias\s*=\s*([^|\n\r]+)/i,
        /\|\s*flag\s*=\s*([^|\n\r]+)/i,
        /\|\s*alias\s*=\s*([^|\n\r]+)/i,
        /\|\s*alias-flag\s*=\s*([^|\n\r]+)/i,
      ];
      
      for (const pattern of aliasPatterns) {
        const match = templateContent.match(pattern);
        if (match && match[1]) {
          let flagAlias = match[1].trim();
          
          // Clean up the flag alias
          flagAlias = this.cleanParameterValue(flagAlias);
          
          // Remove File: prefix if present
          if (flagAlias.toLowerCase().startsWith('file:')) {
            flagAlias = flagAlias.substring(5).trim();
          }
          
          // Validate it looks like a file
          if (flagAlias && (
            flagAlias.toLowerCase().endsWith('.svg') ||
            flagAlias.toLowerCase().endsWith('.png') ||
            flagAlias.toLowerCase().endsWith('.jpg') ||
            flagAlias.toLowerCase().endsWith('.jpeg') ||
            flagAlias.toLowerCase().endsWith('.gif')
          )) {
            console.log(`[FlagCacheManager] Found flag alias: ${flagAlias}`);
            return flagAlias;
          }
        }
      }
      
      // Fallback: look for any line that might contain a flag filename
      const lines = templateContent.split('\n');
      for (const line of lines) {
        const trimmedLine = line.trim();
        if (trimmedLine.includes('Flag') && 
            (trimmedLine.includes('.svg') || trimmedLine.includes('.png'))) {
          
          // Extract filename from the line
          const fileMatch = trimmedLine.match(/([^|\s\[\]]+(?:Flag[^|\s\[\]]*\.(?:svg|png|jpg|jpeg|gif)))/i);
          if (fileMatch && fileMatch[1]) {
            let flagAlias = fileMatch[1].trim();
            
            // Remove File: prefix if present
            if (flagAlias.toLowerCase().startsWith('file:')) {
              flagAlias = flagAlias.substring(5).trim();
            }
            
            console.log(`[FlagCacheManager] Found flag alias by pattern matching: ${flagAlias}`);
            return flagAlias;
          }
        }
      }
      
      console.log(`[FlagCacheManager] No flag alias found in template`);
      return null;
      
    } catch (error) {
      console.error(`[FlagCacheManager] Error extracting flag alias:`, error);
      return null;
    }
  }

  /**
   * Clean parameter value
   */
  private cleanParameterValue(value: string): string {
    return value
      .replace(/^\s*\[\[/, '') // Remove opening [[
      .replace(/\]\]\s*$/, '') // Remove closing ]]
      .replace(/^\s*File:/i, '') // Remove File: prefix
      .replace(/^\s*Image:/i, '') // Remove Image: prefix
      .trim();
  }

  /**
   * Update all country flags
   */
  async updateAllFlags(): Promise<void> {
    if (this.isUpdating) {
      console.log(`[FlagCacheManager] Update already in progress, skipping`);
      return;
    }

    this.isUpdating = true;
    this.failedCountries.clear();
    this.retryQueue = [];
    this.updateProgress = { current: 0, total: this.countryList.length, percentage: 0 };

    console.log(`[FlagCacheManager] Starting flag update for ${this.countryList.length} countries`);

    try {
      const startTime = Date.now();

      // Process countries in batches
      for (let i = 0; i < this.countryList.length; i += this.config.batchSize) {
        const batch = this.countryList.slice(i, i + this.config.batchSize);
        console.log(`[FlagCacheManager] Processing batch ${Math.floor(i / this.config.batchSize) + 1}/${Math.ceil(this.countryList.length / this.config.batchSize)}`);

        await this.processBatch(batch);
        this.updateProgress.current = Math.min(i + this.config.batchSize, this.countryList.length);
        this.updateProgress.percentage = Math.round((this.updateProgress.current / this.updateProgress.total) * 100);

        // Delay between batches
        if (i + this.config.batchSize < this.countryList.length) {
          await this.delay(this.config.batchDelay);
        }
      }

      // Process retry queue
      if (this.retryQueue.length > 0) {
        console.log(`[FlagCacheManager] Processing ${this.retryQueue.length} failed flags with retries`);
        await this.processRetryQueue();
      }

      const endTime = Date.now();
      this.lastUpdateTime = endTime;
      this.saveLastUpdateTime();
      this.scheduleNextUpdate();

      console.log(`[FlagCacheManager] Flag update completed in ${endTime - startTime}ms`);
      console.log(`[FlagCacheManager] Success: ${this.countryList.length - this.failedCountries.size}, Failed: ${this.failedCountries.size}`);

    } catch (error) {
      console.error(`[FlagCacheManager] Error during flag update:`, error);
    } finally {
      this.isUpdating = false;
      this.updateProgress = { current: 0, total: 0, percentage: 0 };
    }
  }

  /**
   * Process a batch of countries
   */
  private async processBatch(countries: string[]): Promise<void> {
    const promises = countries.map(async (countryName) => {
      try {
        const flagUrl = await this.getFlagUrl(countryName);
        if (flagUrl) {
          console.log(`[FlagCacheManager] ✓ Cached flag for ${countryName}`);
        } else {
          console.log(`[FlagCacheManager] ✗ Failed to get flag for ${countryName}`);
          this.failedCountries.add(countryName);
          this.retryQueue.push(countryName);
        }
      } catch (error) {
        console.error(`[FlagCacheManager] Error getting flag for ${countryName}:`, error);
        this.failedCountries.add(countryName);
        this.retryQueue.push(countryName);
      }
    });

    await Promise.allSettled(promises);
  }

  /**
   * Process retry queue with exponential backoff
   */
  private async processRetryQueue(): Promise<void> {
    const retryCountries = [...this.retryQueue];
    this.retryQueue = [];

    for (let attempt = 1; attempt <= this.config.retryAttempts; attempt++) {
      if (retryCountries.length === 0) break;

      console.log(`[FlagCacheManager] Retry attempt ${attempt}/${this.config.retryAttempts} for ${retryCountries.length} countries`);

      const currentBatch = [...retryCountries];
      retryCountries.length = 0; // Clear for next attempt

      for (const countryName of currentBatch) {
        try {
          await this.delay(this.config.retryDelay * attempt); // Exponential backoff
          const flagUrl = await this.getFlagUrl(countryName);
          
          if (flagUrl) {
            console.log(`[FlagCacheManager] ✓ Retry successful for ${countryName}`);
            this.failedCountries.delete(countryName);
          } else {
            console.log(`[FlagCacheManager] ✗ Retry failed for ${countryName}`);
            retryCountries.push(countryName);
          }
        } catch (error) {
          console.error(`[FlagCacheManager] Retry error for ${countryName}:`, error);
          retryCountries.push(countryName);
        }
      }
    }

    // Any remaining countries are permanently failed
    for (const countryName of retryCountries) {
      console.log(`[FlagCacheManager] ✗ Permanently failed to cache flag for ${countryName}`);
    }
  }

  /**
   * Get current cache statistics
   */
  getStats(): FlagCacheStats {
    const serviceStats = this.wikiService.getCacheStats();
    
    return {
      totalCountries: this.countryList.length,
      cachedFlags: serviceStats.flags,
      failedFlags: this.failedCountries.size,
      lastUpdateTime: this.lastUpdateTime,
      nextUpdateTime: this.nextUpdateTime,
      isUpdating: this.isUpdating,
      updateProgress: { ...this.updateProgress },
    };
  }

  /**
   * Check if an update is needed
   */
  shouldUpdate(): boolean {
    // Don't update if there are no countries
    if (this.countryList.length === 0) return false;
    
    // Always update if no last update time
    if (!this.lastUpdateTime) return true;

    // Always update if cache is empty (no flags cached)
    const serviceStats = this.wikiService.getCacheStats();
    if (serviceStats.flags === 0) return true;
    
    // Check if enough time has passed since last update
    return Date.now() - this.lastUpdateTime >= this.config.updateInterval;
  }

  /**
   * Get time until next update
   */
  getTimeUntilNextUpdate(): number {
    if (!this.nextUpdateTime) return 0;
    return Math.max(0, this.nextUpdateTime - Date.now());
  }

  /**
   * Schedule the next automatic update
   */
  private scheduleNextUpdate(): void {
    if (this.updateTimer) {
      clearTimeout(this.updateTimer);
    }

    this.nextUpdateTime = Date.now() + this.config.updateInterval;
    
    // Use a maximum timeout of 24 hours to avoid Node.js timeout overflow
    const maxTimeout = 24 * 60 * 60 * 1000; // 24 hours
    const timeout = Math.min(this.config.updateInterval, maxTimeout);
    
    this.updateTimer = setTimeout(() => {
      console.log(`[FlagCacheManager] Scheduled update triggered`);
      this.updateAllFlags().catch(error => {
        console.error(`[FlagCacheManager] Scheduled update failed:`, error);
      });
    }, timeout);

    console.log(`[FlagCacheManager] Next update scheduled for ${new Date(this.nextUpdateTime).toISOString()}`);
  }

  /**
   * Load last update time from memory (server-side) or localStorage (client-side)
   */
  private loadLastUpdateTime(): void {
    // For server-side, we'll use a simple in-memory approach
    // For client-side, use localStorage
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('flagCacheLastUpdate');
        this.lastUpdateTime = stored ? parseInt(stored, 10) : null;
      } catch (error) {
        console.warn(`[FlagCacheManager] Could not load last update time:`, error);
        this.lastUpdateTime = null;
      }
    } else {
      // Server-side: always start fresh
      this.lastUpdateTime = null;
    }
  }

  /**
   * Save last update time to localStorage (client-side only)
   */
  private saveLastUpdateTime(): void {
    if (typeof window !== 'undefined' && this.lastUpdateTime) {
      try {
        localStorage.setItem('flagCacheLastUpdate', this.lastUpdateTime.toString());
      } catch (error) {
        console.warn(`[FlagCacheManager] Could not save last update time:`, error);
      }
    }
  }

  /**
   * Utility function for delays
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    if (this.updateTimer) {
      clearTimeout(this.updateTimer);
      this.updateTimer = null;
    }
  }
}

// Export singleton instance
export const flagCacheManager = new FlagCacheManager(); 