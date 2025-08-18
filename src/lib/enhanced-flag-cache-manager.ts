// Enhanced Flag Cache Manager - Downloads and stores flags locally
// Replaces the previous flag-cache-manager.ts with actual local file storage

import fs from 'fs/promises';
import path from 'path';
import { IxnayWikiService } from './mediawiki-service';

export interface FlagCacheStats {
  totalCountries: number;
  cachedFlags: number;
  failedFlags: number;
  localFiles: number;
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
  localFlagsPath: string; // path to store local flag files
  enableLocalStorage: boolean; // whether to download and store files locally
}

const DEFAULT_CONFIG: FlagCacheConfig = {
  updateInterval: 24 * 60 * 60 * 1000, // 24 hours
  batchSize: 3, // Reduced for better reliability
  batchDelay: 1000, // 1 second
  retryAttempts: 2,
  retryDelay: 3000, // 3 seconds
  localFlagsPath: path.join(process.cwd(), 'public', 'flags'),
  enableLocalStorage: false,
};

interface LocalFlagMetadata {
  countryName: string;
  fileName: string;
  originalUrl: string;
  downloadedAt: number;
  fileSize: number;
}

interface FlagCacheMetadata {
  lastUpdateTime: number | null;
  flags: Record<string, LocalFlagMetadata>;
}

export class EnhancedFlagCacheManager {
  private config: FlagCacheConfig;
  private updateTimer: NodeJS.Timeout | null = null;
  private isUpdating = false;
  private updateProgress = { current: 0, total: 0, percentage: 0 };
  private lastUpdateTime: number | null = null;
  private nextUpdateTime: number | null = null;
  private countryList: string[] = [];
  private failedCountries = new Set<string>();
  private retryQueue: string[] = [];
  private wikiService: IxnayWikiService;
  private metadata: FlagCacheMetadata = { lastUpdateTime: null, flags: {} };

  constructor(config: Partial<FlagCacheConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.wikiService = new IxnayWikiService();
    this.loadMetadata();
    this.scheduleNextUpdate();
  }

  /**
   * Initialize the flag cache manager with a list of countries
   */
  async initialize(countryNames: string[]): Promise<void> {
    console.log(`[EnhancedFlagCache] Initializing with ${countryNames.length} countries`);
    this.countryList = [...new Set(countryNames)]; // Remove duplicates
    
    // Ensure the flags directory exists
    await this.ensureFlagsDirectory();
    
    // Check if we need to do an initial update
    if (!this.lastUpdateTime || this.shouldUpdate()) {
      console.log(`[EnhancedFlagCache] Initial update needed`);
      await this.updateAllFlags();
    } else {
      console.log(`[EnhancedFlagCache] No update needed, next update in ${this.getTimeUntilNextUpdate()}ms`);
    }
  }

  /**
   * Get local flag URL if available, otherwise return external URL
   */
  getFlagUrl(countryName: string): string | null {
    try {
      // First check if we have a local file
      const localUrl = this.getLocalFlagUrl(countryName);
      if (localUrl) {
        return localUrl;
      }

      // Fallback to cached external URL
      return this.wikiService.getCachedFlagUrl(countryName);
    } catch (error) {
      console.error(`[EnhancedFlagCache] Error getting flag for ${countryName}:`, error);
      return null;
    }
  }

  /**
   * Get local flag URL if the file exists locally
   */
  getLocalFlagUrl(countryName: string): string | null {
    const flagData = this.metadata.flags[countryName.toLowerCase()];
    if (flagData) {
      return `/flags/${flagData.fileName}`;
    }
    return null;
  }

  /**
   * Download and cache a flag locally
   */
  private async downloadAndCacheFlag(countryName: string, externalUrl: string): Promise<string | null> {
    if (!this.config.enableLocalStorage) {
      return externalUrl; // Just return the external URL if local storage is disabled
    }

    try {
      console.log(`[EnhancedFlagCache] Downloading flag for ${countryName} from ${externalUrl}`);

      // Determine file extension from URL
      const urlPath = new URL(externalUrl).pathname;
      const extension = path.extname(urlPath) || '.png';
      const safeCountryName = countryName.replace(/[^a-zA-Z0-9\-_]/g, '_');
      const fileName = `${safeCountryName}${extension}`;
      const localPath = path.join(this.config.localFlagsPath, fileName);

      // Download the file
      const response = await fetch(externalUrl);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const buffer = await response.arrayBuffer();
      await fs.writeFile(localPath, Buffer.from(buffer));

      // Update metadata
      const metadata: LocalFlagMetadata = {
        countryName,
        fileName,
        originalUrl: externalUrl,
        downloadedAt: Date.now(),
        fileSize: buffer.byteLength,
      };

      this.metadata.flags[countryName.toLowerCase()] = metadata;
      await this.saveMetadata();

      const localUrl = `/flags/${fileName}`;
      console.log(`[EnhancedFlagCache] Successfully cached flag locally: ${countryName} -> ${localUrl}`);
      return localUrl;

    } catch (error) {
      console.error(`[EnhancedFlagCache] Failed to download and cache flag for ${countryName}:`, error);
      return externalUrl; // Return external URL as fallback
    }
  }

  /**
   * Fetch flag from MediaWiki and download it locally if possible
   */
  async fetchAndCacheFlag(countryName: string): Promise<string | null> {
    try {
      console.log(`[EnhancedFlagCache] Fetching flag for: ${countryName}`);

      // First, get the external URL from MediaWiki
      const externalUrl = await this.wikiService.getFlagUrl(countryName);
      if (!externalUrl || typeof externalUrl !== 'string') {
        console.log(`[EnhancedFlagCache] No external URL found for ${countryName}`);
        return null;
      }

      // Try to download and cache it locally
      const localUrl = await this.downloadAndCacheFlag(countryName, externalUrl);
      return localUrl;

    } catch (error) {
      console.error(`[EnhancedFlagCache] Error fetching and caching flag for ${countryName}:`, error);
      return null;
    }
  }

  /**
   * Update all country flags
   */
  async updateAllFlags(): Promise<void> {
    if (this.isUpdating) {
      console.log(`[EnhancedFlagCache] Update already in progress, skipping`);
      return;
    }

    this.isUpdating = true;
    this.failedCountries.clear();
    this.retryQueue = [];
    this.updateProgress = { current: 0, total: this.countryList.length, percentage: 0 };

    console.log(`[EnhancedFlagCache] Starting flag update for ${this.countryList.length} countries`);

    try {
      await this.ensureFlagsDirectory();
      const startTime = Date.now();

      // Process countries in batches
      for (let i = 0; i < this.countryList.length; i += this.config.batchSize) {
        const batch = this.countryList.slice(i, i + this.config.batchSize);
        console.log(`[EnhancedFlagCache] Processing batch ${Math.floor(i / this.config.batchSize) + 1}/${Math.ceil(this.countryList.length / this.config.batchSize)}`);

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
        console.log(`[EnhancedFlagCache] Processing ${this.retryQueue.length} failed flags with retries`);
        await this.processRetryQueue();
      }

      const endTime = Date.now();
      this.lastUpdateTime = endTime;
      this.metadata.lastUpdateTime = endTime;
      await this.saveMetadata();
      this.scheduleNextUpdate();

      console.log(`[EnhancedFlagCache] Flag update completed in ${endTime - startTime}ms`);
      console.log(`[EnhancedFlagCache] Success: ${this.countryList.length - this.failedCountries.size}, Failed: ${this.failedCountries.size}`);
      console.log(`[EnhancedFlagCache] Local files: ${Object.keys(this.metadata.flags).length}`);

    } catch (error) {
      console.error(`[EnhancedFlagCache] Error during flag update:`, error);
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
        const flagUrl = await this.fetchAndCacheFlag(countryName);
        if (flagUrl) {
          console.log(`[EnhancedFlagCache] ✓ Cached flag for ${countryName}`);
        } else {
          console.log(`[EnhancedFlagCache] ✗ Failed to get flag for ${countryName}`);
          this.failedCountries.add(countryName);
          this.retryQueue.push(countryName);
        }
      } catch (error) {
        console.error(`[EnhancedFlagCache] Error getting flag for ${countryName}:`, error);
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

      console.log(`[EnhancedFlagCache] Retry attempt ${attempt}/${this.config.retryAttempts} for ${retryCountries.length} countries`);

      const currentBatch = [...retryCountries];
      retryCountries.length = 0; // Clear for next attempt

      for (const countryName of currentBatch) {
        try {
          await this.delay(this.config.retryDelay * attempt); // Exponential backoff
          const flagUrl = await this.fetchAndCacheFlag(countryName);
          
          if (flagUrl) {
            console.log(`[EnhancedFlagCache] ✓ Retry successful for ${countryName}`);
            this.failedCountries.delete(countryName);
          } else {
            console.log(`[EnhancedFlagCache] ✗ Retry failed for ${countryName}`);
            retryCountries.push(countryName);
          }
        } catch (error) {
          console.error(`[EnhancedFlagCache] Retry error for ${countryName}:`, error);
          retryCountries.push(countryName);
        }
      }
    }

    // Any remaining countries are permanently failed
    for (const countryName of retryCountries) {
      console.log(`[EnhancedFlagCache] ✗ Permanently failed to cache flag for ${countryName}`);
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
      localFiles: Object.keys(this.metadata.flags).length,
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

    // Always update if local cache is empty
    if (Object.keys(this.metadata.flags).length === 0) return true;
    
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
      console.log(`[EnhancedFlagCache] Scheduled update triggered`);
      this.updateAllFlags().catch(error => {
        console.error(`[EnhancedFlagCache] Scheduled update failed:`, error);
      });
    }, timeout);

    console.log(`[EnhancedFlagCache] Next update scheduled for ${new Date(this.nextUpdateTime).toISOString()}`);
  }

  /**
   * Ensure the flags directory exists
   */
  private async ensureFlagsDirectory(): Promise<void> {
    try {
      await fs.access(this.config.localFlagsPath);
    } catch (error) {
      console.log(`[EnhancedFlagCache] Creating flags directory: ${this.config.localFlagsPath}`);
      await fs.mkdir(this.config.localFlagsPath, { recursive: true });
    }
  }

  /**
   * Load metadata from file
   */
  private async loadMetadata(): Promise<void> {
    try {
      const metadataPath = path.join(this.config.localFlagsPath, 'metadata.json');
      const data = await fs.readFile(metadataPath, 'utf-8');
      this.metadata = JSON.parse(data);
      this.lastUpdateTime = this.metadata.lastUpdateTime;
      console.log(`[EnhancedFlagCache] Loaded metadata: ${Object.keys(this.metadata.flags).length} flags`);
    } catch (error) {
      console.log(`[EnhancedFlagCache] No existing metadata found, starting fresh`);
      this.metadata = { lastUpdateTime: null, flags: {} };
    }
  }

  /**
   * Save metadata to file
   */
  private async saveMetadata(): Promise<void> {
    try {
      await this.ensureFlagsDirectory();
      const metadataPath = path.join(this.config.localFlagsPath, 'metadata.json');
      await fs.writeFile(metadataPath, JSON.stringify(this.metadata, null, 2));
      console.log(`[EnhancedFlagCache] Saved metadata: ${Object.keys(this.metadata.flags).length} flags`);
    } catch (error) {
      console.error(`[EnhancedFlagCache] Failed to save metadata:`, error);
    }
  }

  /**
   * Clear local flag cache
   */
  async clearLocalCache(): Promise<void> {
    try {
      // Remove all flag files
      const files = await fs.readdir(this.config.localFlagsPath);
      for (const file of files) {
        if (file !== 'metadata.json') {
          await fs.unlink(path.join(this.config.localFlagsPath, file));
        }
      }
      
      // Clear metadata
      this.metadata = { lastUpdateTime: null, flags: {} };
      await this.saveMetadata();
      
      console.log(`[EnhancedFlagCache] Local cache cleared`);
    } catch (error) {
      console.error(`[EnhancedFlagCache] Failed to clear local cache:`, error);
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
export const enhancedFlagCacheManager = new EnhancedFlagCacheManager();