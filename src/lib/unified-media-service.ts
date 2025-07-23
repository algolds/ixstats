// src/lib/unified-media-service.ts
// Unified Media Service - Single source of truth for all WikiMedia data

import { IxnayWikiService } from './mediawiki-service';

export interface CacheStats {
  totalRequests: number;
  cacheHits: number;
  cacheMisses: number;
  hitRate: number;
  cacheSize: number;
  lastUpdated: number;
}

export interface FlagData {
  url: string;
  localPath?: string;
  cached: boolean;
  timestamp: number;
  source: 'server-file' | 'memory-cache' | 'mediawiki-api' | 'mediawiki-cache' | 'direct-pattern' | 'placeholder';
}

export interface CountryInfobox {
  flag?: string;
  leader?: string;
  government?: string;
  population?: string;
  gdp?: string;
  [key: string]: any;
}

interface RequestState {
  promise: Promise<any>;
  timestamp: number;
}

interface CacheItem<T> {
  data: T;
  timestamp: number;
  source: string;
}

// Multi-level cache implementation
class UnifiedCache {
  private memoryCache = new Map<string, CacheItem<any>>();
  private pendingRequests = new Map<string, RequestState>();
  private maxSize = 1000;
  private ttl = 24 * 60 * 60 * 1000; // 24 hours

  async get<T>(key: string): Promise<T | null> {
    const item = this.memoryCache.get(key);
    if (item && this.isValidItem(item)) {
      return item.data;
    }
    return null;
  }

  set<T>(key: string, data: T, source: string): void {
    // LRU eviction
    if (this.memoryCache.size >= this.maxSize) {
      const firstKey = this.memoryCache.keys().next().value;
      if (firstKey) {
        this.memoryCache.delete(firstKey);
      }
    }

    this.memoryCache.set(key, {
      data,
      timestamp: Date.now(),
      source,
    });
  }

  async getOrFetch<T>(
    key: string,
    fetcher: () => Promise<T>,
    source: string
  ): Promise<T | null> {
    // Check cache first
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    // Check if request is already pending (deduplication)
    const pending = this.pendingRequests.get(key);
    if (pending) {
      return pending.promise;
    }

    // Make new request
    const promise = fetcher()
      .then((result) => {
        this.set(key, result, source);
        this.pendingRequests.delete(key);
        return result;
      })
      .catch((error) => {
        this.pendingRequests.delete(key);
        throw error;
      });

    this.pendingRequests.set(key, { promise, timestamp: Date.now() });
    return promise;
  }

  private isValidItem(item: CacheItem<any>): boolean {
    return Date.now() - item.timestamp < this.ttl;
  }

  clear(keyPattern?: string): void {
    if (keyPattern) {
      for (const key of this.memoryCache.keys()) {
        if (key.includes(keyPattern)) {
          this.memoryCache.delete(key);
        }
      }
    } else {
      this.memoryCache.clear();
    }
    this.pendingRequests.clear();
  }

  getStats(): CacheStats {
    const totalItems = this.memoryCache.size;
    const pendingItems = this.pendingRequests.size;
    
    return {
      totalRequests: totalItems + pendingItems,
      cacheHits: totalItems,
      cacheMisses: pendingItems,
      hitRate: totalItems > 0 ? totalItems / (totalItems + pendingItems) : 0,
      cacheSize: totalItems,
      lastUpdated: Date.now(),
    };
  }
}

export class UnifiedMediaService {
  private cache = new UnifiedCache();
  private wikiService: IxnayWikiService;
  private stats = {
    totalRequests: 0,
    flagRequests: 0,
    infoboxRequests: 0,
  };

  constructor() {
    this.wikiService = new IxnayWikiService();
  }

  // ============================================================================
  // PRIMARY FLAG API
  // ============================================================================

  async getFlagUrl(countryName: string): Promise<string | null> {
    this.stats.totalRequests++;
    this.stats.flagRequests++;

    const cacheKey = `flag:${countryName.toLowerCase()}`;
    
    return this.cache.getOrFetch(
      cacheKey,
      async () => {
        // Priority 1: Check MediaWiki cache first (most comprehensive)
        const mediaWikiCached = this.wikiService.getCachedFlagUrl(countryName);
        if (mediaWikiCached && !mediaWikiCached.includes('placeholder')) {
          console.log(`[UnifiedMedia] Using MediaWiki cache for ${countryName}:`, mediaWikiCached);
          return { 
            url: mediaWikiCached, 
            cached: true,
            timestamp: Date.now(),
            source: 'mediawiki-cache'
          } as FlagData;
        }

        // Priority 2: Check server-cached file
        const serverUrl = await this.checkServerCachedFlag(countryName);
        if (serverUrl) {
          return { 
            url: serverUrl, 
            cached: true,
            timestamp: Date.now(),
            source: 'server-file'
          } as FlagData;
        }

        // Priority 3: Fetch from MediaWiki API
        const wikiUrl = await this.wikiService.getFlagUrl(countryName);
        console.log(`[UnifiedMedia] MediaWiki API returned for ${countryName}:`, wikiUrl);
        if (wikiUrl && typeof wikiUrl === 'string' && !wikiUrl.includes('placeholder')) {
          console.log(`[UnifiedMedia] Using MediaWiki API URL for ${countryName}:`, wikiUrl);
          return { 
            url: wikiUrl, 
            cached: false,
            timestamp: Date.now(),
            source: 'mediawiki-api'
          } as FlagData;
        }

        // Priority 4: Try common flag patterns directly
        const commonPatterns = [
          `Flag3 ${countryName}.png`,
          `Flag of ${countryName}.svg`,
          `Flag_of_${countryName}.png`,
          `${countryName}_flag.svg`
        ];
        
        for (const pattern of commonPatterns) {
          try {
            const testUrl = `https://ixwiki.com/wiki/Special:Redirect/file/${encodeURIComponent(pattern)}`;
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);
            const response = await fetch(testUrl, { 
              method: 'HEAD', 
              signal: controller.signal 
            });
            clearTimeout(timeoutId);
            if (response.ok) {
              console.log(`[UnifiedMedia] Found flag via direct pattern: ${testUrl}`);
              return {
                url: testUrl,
                cached: false,
                timestamp: Date.now(),
                source: 'direct-pattern'
              } as FlagData;
            }
          } catch (error) {
            // Continue to next pattern
          }
        }

        // Priority 5: Return placeholder
        console.log(`[UnifiedMedia] Using placeholder for ${countryName}`);
        return { 
          url: '/placeholder-flag.svg', 
          cached: false,
          timestamp: Date.now(),
          source: 'placeholder'
        } as FlagData;
      },
      'flag-service'
    ).then(flagData => {
      const finalUrl = flagData?.url || null;
      console.log(`[UnifiedMedia] Final URL for ${countryName}:`, finalUrl, 'Source:', flagData?.source);
      return finalUrl;
    });
  }

  getCachedFlagUrl(countryName: string): string | null {
    // First check MediaWiki service cache (priority)
    const mediaWikiCached = this.wikiService.getCachedFlagUrl(countryName);
    if (mediaWikiCached && !mediaWikiCached.includes('placeholder')) {
      return mediaWikiCached;
    }

    // Then check our own cache
    const cacheKey = `flag:${countryName.toLowerCase()}`;
    const cached = this.cache.get<FlagData>(cacheKey);
    
    const cachedUrl = cached ? (cached as any).url : null;
    if (cachedUrl && !cachedUrl.includes('placeholder')) {
      return cachedUrl;
    }

    return null;
  }

  // ============================================================================
  // BATCH OPERATIONS
  // ============================================================================

  async preloadFlags(countryNames: string[]): Promise<void> {
    const batchSize = 5;
    const batches = [];
    
    for (let i = 0; i < countryNames.length; i += batchSize) {
      batches.push(countryNames.slice(i, i + batchSize));
    }

    for (const batch of batches) {
      await Promise.allSettled(
        batch.map(name => this.getFlagUrl(name))
      );
      
      // Small delay between batches to be respectful to MediaWiki
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  async batchGetFlags(countryNames: string[]): Promise<Record<string, string | null>> {
    const results: Record<string, string | null> = {};
    
    await Promise.allSettled(
      countryNames.map(async (name) => {
        try {
          results[name] = await this.getFlagUrl(name);
        } catch (error) {
          console.warn(`Failed to get flag for ${name}:`, error);
          results[name] = null;
        }
      })
    );

    return results;
  }

  // ============================================================================
  // COUNTRY INFOBOX API
  // ============================================================================

  async getCountryInfobox(countryName: string): Promise<CountryInfobox | null> {
    this.stats.totalRequests++;
    this.stats.infoboxRequests++;

    const cacheKey = `infobox:${countryName.toLowerCase()}`;
    
    return this.cache.getOrFetch(
      cacheKey,
      async (): Promise<CountryInfobox | null> => {
        const infobox = await this.wikiService.getCountryInfobox(countryName);
        return infobox;
      },
      'infobox-service'
    );
  }

  // ============================================================================
  // CACHE MANAGEMENT
  // ============================================================================

  getCacheStats(): CacheStats & { serviceStats: typeof this.stats } {
    return {
      ...this.cache.getStats(),
      serviceStats: { ...this.stats },
    };
  }

  clearCache(scope?: 'flags' | 'infoboxes' | 'all'): void {
    if (scope) {
      this.cache.clear(scope === 'flags' ? 'flag:' : 'infobox:');
    } else {
      this.cache.clear();
    }
    
    // Also clear underlying MediaWiki service cache
    this.wikiService.clearCache();
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  isPlaceholderFlag(url: string): boolean {
    return url.includes('placeholder') || url.includes('default') || url.endsWith('placeholder-flag.svg');
  }

  private async checkServerCachedFlag(countryName: string): Promise<string | null> {
    try {
      // Check if there's a server-cached version
      const response = await fetch(`/api/flags/${encodeURIComponent(countryName)}.webp`, { 
        method: 'HEAD',
        cache: 'no-cache' 
      });
      
      if (response.ok) {
        return `/api/flags/${encodeURIComponent(countryName)}.webp`;
      }
    } catch (error) {
      // Server cache not available, continue to MediaWiki
    }
    return null;
  }

  private generateDirectMediaWikiUrl(countryName: string): string {
    const safeCountryName = countryName
      .replace(/[^a-zA-Z0-9\-_\s]/g, '')
      .replace(/\s+/g, '_')
      .toLowerCase();
    
    return `https://ixwiki.com/wiki/Special:Redirect/file/Flag_of_${safeCountryName}.svg`;
  }
}

// Global singleton instance
export const unifiedMediaService = new UnifiedMediaService();

// Export for backward compatibility
export default unifiedMediaService;