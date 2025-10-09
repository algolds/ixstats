// Unified Flag Service - Dynamic multi-wiki flag caching system

interface FlagCache {
  [countryName: string]: CachedFlag | null;
}

interface CachedFlag {
  url: string;
  source: WikiSource;
  cachedAt: number;
  lastAccessed: number;
  fileName?: string;
  originalUrl?: string;
}

interface LocalFlagMetadata {
  fileName: string;
  originalUrl: string;
  downloadedAt: number;
  fileSize: number;
  source: WikiSource;
}

interface WikiSource {
  name: string;
  baseUrl: string;
  priority: number;
}

interface FlagServiceStats {
  totalCountries: number;
  cachedFlags: number;
  localFiles: number;
  failedFlags: number;
  lastUpdateTime: number | null;
  isUpdating: boolean;
  hitRate: number;
  sourceStats: Record<string, { found: number; failed: number; cached: number }>;
}

class UnifiedFlagService {
  private memoryCache: FlagCache = {};
  private localMetadata: Record<string, LocalFlagMetadata> = {};
  private failedCountries = new Set<string>();
  private isUpdating = false;
  private lastUpdateTime: number | null = null;
  private readonly PLACEHOLDER_FLAG = '/placeholder-flag.svg';
  private readonly FLAGS_BASE_URL = '/flags';
  private requestQueue = new Map<string, Promise<string | null>>();
  private stats = {
    totalRequests: 0,
    cacheHits: 0,
    cacheMisses: 0,
  };

  // Rate limiting - VERY AGGRESSIVE to stop spam
  private requestsSinceLastReset = 0;
  private lastRateLimitReset = Date.now();
  private readonly MAX_REQUESTS_PER_MINUTE = 5; // VERY LOW LIMIT
  private readonly RATE_LIMIT_WINDOW = 60000; // 1 minute in ms
  private apiErrorCount = 0;
  private lastApiError: number | null = null;
  private globalFetchDisabled = false; // Kill switch for all fetching

  // Debouncing for save operations
  private saveDebounceTimer: NodeJS.Timeout | null = null;
  private pendingSave = false;
  private readonly SAVE_DEBOUNCE_DELAY = 5000; // 5 seconds

  // Wiki sources - ONLY Wikimedia Commons for real country flags
  // Fictional wikis should only be used for fictional nations
  private readonly wikiSources: WikiSource[] = [
    { name: 'WikiCommons', baseUrl: 'https://commons.wikimedia.org', priority: 1 },
  ];

  private sourceStats: Record<string, { found: number; failed: number; cached: number }> = {};

  // Cache TTL settings - PERMANENT caching to prevent API spam
  private readonly CACHE_TTL = {
    memory: Infinity,     // Never expire cached flags in memory
    localStorage: Infinity, // Never expire cached flags in localStorage
    failed: 24 * 60 * 60 * 1000,      // 24 hours for failed attempts
  };

  constructor() {
    // Initialize source statistics
    this.wikiSources.forEach(source => {
      this.sourceStats[source.name] = { found: 0, failed: 0, cached: 0 };
    });

    // Auto-initialize in both browser and server environment
    this.loadLocalMetadata().catch(error => {
      console.warn('[UnifiedFlagService] Failed to load metadata:', error);
    });
  }


  /**
   * Get flag URL - intelligent multi-wiki caching with fallback
   */
  async getFlagUrl(countryName: string): Promise<string | null> {
    if (!countryName) return null;

    this.stats.totalRequests++;
    const cacheKey = countryName.toLowerCase();

    // 1. Check local file first (fastest) - for fictional nations
    const localUrl = this.getLocalFlagUrl(countryName);
    if (localUrl) {
      this.stats.cacheHits++;
      this.updateAccessTime(cacheKey);
      return localUrl;
    }

    // 2. Check memory cache - NO TTL validation, cache is permanent
    const cachedFlag = this.memoryCache[cacheKey];
    if (cachedFlag && cachedFlag.url) {
      this.stats.cacheHits++;
      this.updateAccessTime(cacheKey);
      if (cachedFlag.source?.name && this.sourceStats[cachedFlag.source.name]) {
        this.sourceStats[cachedFlag.source.name]!.cached++;
      }
      return cachedFlag.url;
    }

    // 3. Check if already failed (null cached) - return placeholder immediately
    if (cachedFlag === null || this.failedCountries.has(countryName)) {
      // Silent fail - no logging
      return this.PLACEHOLDER_FLAG;
    }

    // 4. Check if request already in progress
    if (this.requestQueue.has(cacheKey)) {
      return await this.requestQueue.get(cacheKey)!;
    }

    // 5. ONLY fetch if truly never attempted before - no logging
    this.stats.cacheMisses++;
    const fetchPromise = this.fetchFlagFromMultipleWikis(countryName);
    this.requestQueue.set(cacheKey, fetchPromise);

    try {
      const result = await fetchPromise;
      this.requestQueue.delete(cacheKey);

      // If fetch failed, cache null to prevent retries
      if (!result) {
        this.memoryCache[cacheKey] = null;
        this.failedCountries.add(countryName);
        this.saveLocalMetadata(); // Save the failure
        return this.PLACEHOLDER_FLAG;
      }

      return result;
    } catch (error) {
      this.requestQueue.delete(cacheKey);
      console.error(`[UnifiedFlagService] Error fetching flag for ${countryName}:`, error);
      // Cache the failure
      this.memoryCache[cacheKey] = null;
      this.failedCountries.add(countryName);
      this.saveLocalMetadata(); // Save the failure
      return this.PLACEHOLDER_FLAG;
    }
  }

  /**
   * Get cached flag URL (synchronous - only returns if already cached)
   */
  getCachedFlagUrl(countryName: string): string | null {
    if (!countryName) return null;

    // Check local file first
    const localUrl = this.getLocalFlagUrl(countryName);
    if (localUrl) return localUrl;

    // Check memory cache - NO TTL validation, cache is permanent
    const cacheKey = countryName.toLowerCase();
    const cachedFlag = this.memoryCache[cacheKey];

    if (cachedFlag && cachedFlag.url) {
      this.updateAccessTime(cacheKey);
      return cachedFlag.url;
    }

    return null;
  }

  /**
   * Get local flag URL if file exists
   */
  getLocalFlagUrl(countryName: string): string | null {
    const cacheKey = countryName.toLowerCase();
    const metadata = this.localMetadata[cacheKey];
    if (metadata) {
      return `${this.FLAGS_BASE_URL}/${metadata.fileName}`;
    }
    return null;
  }

  /**
   * Check if flag is cached locally
   */
  hasLocalFlag(countryName: string): boolean {
    const cacheKey = countryName.toLowerCase();
    return !!this.localMetadata[cacheKey];
  }

  /**
   * Batch get flags for multiple countries
   */
  async batchGetFlags(countryNames: string[]): Promise<Record<string, string | null>> {
    const results: Record<string, string | null> = {};

    // First, check all cached flags synchronously
    const uncachedCountries: string[] = [];
    for (const countryName of countryNames) {
      const cachedUrl = this.getCachedFlagUrl(countryName);
      if (cachedUrl) {
        results[countryName] = cachedUrl;
      } else {
        uncachedCountries.push(countryName);
      }
    }

    // Only fetch uncached countries
    if (uncachedCountries.length === 0) {
      return results;
    }

    // Silent operation - no logging

    // Process in TINY batches of 1 to avoid ANY spam
    const batchSize = 1;
    for (let i = 0; i < uncachedCountries.length; i += batchSize) {
      // Check if we should stop due to rate limiting or global disable
      if (this.shouldThrottle() || this.globalFetchDisabled) {
        // Return placeholder for ALL remaining countries immediately
        for (let j = i; j < uncachedCountries.length; j++) {
          results[uncachedCountries[j]!] = null;
          this.failedCountries.add(uncachedCountries[j]!);
        }
        this.globalFetchDisabled = true; // Ensure fetching is disabled
        break;
      }

      const batch = uncachedCountries.slice(i, i + batchSize);
      const batchPromises = batch.map(async (countryName) => {
        const flagUrl = await this.getFlagUrl(countryName);
        return { countryName, flagUrl };
      });

      const batchResults = await Promise.allSettled(batchPromises);
      batchResults.forEach((result, index) => {
        const countryName = batch[index];
        if (result.status === 'fulfilled') {
          results[result.value.countryName] = result.value.flagUrl;
        } else {
          results[countryName!] = null;
        }
      });

      // MUCH longer delay between batches to avoid ANY server load
      if (i + batchSize < uncachedCountries.length) {
        await this.delay(2000); // 2 seconds between each flag fetch
      }
    }

    return results;
  }

  /**
   * Check if we should throttle requests due to rate limiting
   */
  private shouldThrottle(): boolean {
    const now = Date.now();

    // Reset counter if window has passed
    if (now - this.lastRateLimitReset > this.RATE_LIMIT_WINDOW) {
      this.requestsSinceLastReset = 0;
      this.lastRateLimitReset = now;
    }

    // Check if we've hit the rate limit
    if (this.requestsSinceLastReset >= this.MAX_REQUESTS_PER_MINUTE) {
      console.warn('[UnifiedFlagService] Rate limit reached, throttling requests');
      return true;
    }

    // If we've had recent API errors, back off
    if (this.apiErrorCount > 5 && this.lastApiError && (now - this.lastApiError) < 30000) {
      console.warn('[UnifiedFlagService] Too many recent API errors, backing off');
      return true;
    }

    return false;
  }

  /**
   * Fetch flag from multiple wiki sources with intelligent fallback
   */
  private async fetchFlagFromMultipleWikis(countryName: string): Promise<string | null> {
    const cacheKey = countryName.toLowerCase();

    // GLOBAL KILL SWITCH - stop all fetching if we hit too many errors
    if (this.globalFetchDisabled) {
      console.log(`[UnifiedFlagService] Fetching disabled globally - returning null`);
      this.failedCountries.add(countryName);
      return null;
    }

    // Check if we've already failed for this country recently
    if (this.failedCountries.has(countryName)) {
      return null; // Silent fail - no logging to reduce spam
    }

    // Check rate limiting
    if (this.shouldThrottle()) {
      console.warn(`[UnifiedFlagService] Rate limited - disabling all fetching`);
      this.globalFetchDisabled = true; // DISABLE ALL FUTURE FETCHING
      this.failedCountries.add(countryName);
      return null;
    }

    // FOR REAL COUNTRIES - ONLY TRY WIKIMEDIA COMMONS
    // Removed verbose logging to reduce console spam
    this.requestsSinceLastReset++;

    try {
      const flagUrl = await this.fetchFromWikiCommons(countryName);

      if (flagUrl) {
        // Reset error counter on success
        this.apiErrorCount = 0;
        // Cache the successful result
        const cachedFlag: CachedFlag = {
          url: flagUrl,
          source: { name: 'WikiCommons', baseUrl: 'https://commons.wikimedia.org', priority: 1 },
          cachedAt: Date.now(),
          lastAccessed: Date.now(),
        };

        this.memoryCache[cacheKey] = cachedFlag;
        // Silent success - no logging

        // Schedule save (debounced to prevent spam)
        this.saveLocalMetadata();

        return flagUrl;
      }
    } catch (error) {
      // Track API errors
      this.apiErrorCount++;
      this.lastApiError = Date.now();
      console.warn(`[UnifiedFlagService] Error fetching from Wikimedia Commons for ${countryName}:`, error);
    }
    
    // Cache null result to avoid repeated failures (with shorter TTL)
    this.memoryCache[cacheKey] = null;
    this.failedCountries.add(countryName);
    return null;
  }

  /**
   * Fetch flag from MediaWiki-based wikis (IxWiki, IiWiki, AlthistoryWiki)
   */
  private async fetchFromMediaWiki(countryName: string, source: WikiSource): Promise<string | null> {
    try {
      // Get page content from wiki
      const apiUrl = `${source.baseUrl}/api.php?action=query&format=json&formatversion=2&origin=*&titles=${encodeURIComponent(countryName)}&prop=revisions&rvprop=content&rvslots=main&rvsection=0`;
      
      const response = await fetch(apiUrl, {
        signal: AbortSignal.timeout(8000),
      });

      if (!response.ok) return null;

      const data = await response.json();
      const pages = data.query?.pages || [];
      
      if (pages.length > 0 && pages[0].revisions?.[0]?.slots?.main?.content) {
        const content = pages[0].revisions[0].slots.main.content;
        
        // Extract flag filename from infobox (supports multiple patterns)
        const flagPatterns = [
          /\|\s*(?:flag|image_flag)\s*=\s*([^\|\}\n]+)/i,
          /\|\s*(?:flag_image|national_flag)\s*=\s*([^\|\}\n]+)/i,
          /{{flag\|([^}]+)}}/i,
        ];
        
        for (const pattern of flagPatterns) {
          const flagMatch = content.match(pattern);
          if (flagMatch) {
            let flagFilename = flagMatch[1].trim()
              .replace(/^\[\[File:/, '')
              .replace(/\]\]$/, '')
              .replace(/^\[\[/, '')
              .replace(/\]\]$/, '')
              .replace(/^File:/, '');
            
            if (flagFilename && !flagFilename.includes('{{') && !flagFilename.includes('|')) {
              // Get actual image URL
              const fileInfoUrl = `${source.baseUrl}/api.php?action=query&format=json&formatversion=2&origin=*&titles=File:${encodeURIComponent(flagFilename)}&prop=imageinfo&iiprop=url`;
              const fileResponse = await fetch(fileInfoUrl, {
                signal: AbortSignal.timeout(8000),
              });
              
              if (fileResponse.ok) {
                const fileData = await fileResponse.json();
                if (fileData.query?.pages?.[0]?.imageinfo?.[0]?.url) {
                  return fileData.query.pages[0].imageinfo[0].url;
                }
              }
            }
          }
        }
      }
      
      return null;
    } catch (error) {
      console.warn(`[UnifiedFlagService] MediaWiki fetch error for ${countryName} from ${source.name}:`, error);
      return null;
    }
  }

  /**
   * Fetch flag from Wikimedia Commons
   */
  private async fetchFromWikiCommons(countryName: string): Promise<string | null> {
    try {
      // Handle special country name mappings
      const countryMappings: Record<string, string> = {
        'korea, dem. people\'s rep.': 'North Korea',
        'korea, rep.': 'South Korea',
        'czech republic': 'the Czech Republic',
        'bahamas, the': 'the Bahamas',
        'gambia, the': 'the Gambia',
        'congo, dem. rep.': 'the Democratic Republic of the Congo',
        'congo, rep.': 'the Republic of the Congo',
        'egypt, arab rep.': 'Egypt',
        'iran, islamic rep.': 'Iran',
        'venezuela, rb': 'Venezuela',
        'yemen, rep.': 'Yemen',
        'syria': 'Syria',
        'lao pdr': 'Laos',
        'vietnam': 'Vietnam',
        'bolivia': 'Bolivia',
        'russia': 'Russia',
        'moldova': 'Moldova',
        'tanzania': 'Tanzania',
        'united states': 'the United States',
        'united kingdom': 'the United Kingdom',
        'netherlands': 'the Netherlands',
        'philippines': 'the Philippines',
        'maldives': 'the Maldives',
        'solomon islands': 'the Solomon Islands',
        'marshall islands': 'the Marshall Islands',
        'central african republic': 'the Central African Republic',
        'dominican republic': 'the Dominican Republic',
        'united arab emirates': 'the United Arab Emirates',
      };

      // Check if we need to use a mapped name
      const searchName = countryMappings[countryName.toLowerCase()] || countryName;

      // Try different flag filename patterns for Commons
      const flagPatterns = [
        `Flag of ${searchName}.svg`,
        `Flag of ${searchName}.png`,
        `Flag_of_${searchName.replace(/ /g, '_')}.svg`,
        `${searchName} flag.svg`,
        `${searchName.replace(/ /g, '_')}_flag.svg`,
      ];

      for (const filename of flagPatterns) {
        try {
          const fileInfoUrl = `https://commons.wikimedia.org/w/api.php?action=query&format=json&formatversion=2&origin=*&titles=File:${encodeURIComponent(filename)}&prop=imageinfo&iiprop=url`;

          const response = await fetch(fileInfoUrl, {
            signal: AbortSignal.timeout(5000),
          });

          if (response.ok) {
            const data = await response.json();
            if (data.query?.pages?.[0]?.imageinfo?.[0]?.url) {
              // Silent success - no logging to reduce spam
              return data.query.pages[0].imageinfo[0].url;
            }
          }
        } catch (error) {
          continue; // Try next pattern
        }
      }

      // Silent fail - no logging
      return null;
    } catch (error) {
      // Silent error - no logging
      return null;
    }
  }

  /**
   * Check if cached flag is still valid based on TTL
   * With permanent caching, this always returns true for valid cached flags
   */
  private isCacheValid(cachedFlag: CachedFlag): boolean {
    if (!cachedFlag) return false;
    // Always valid with permanent caching
    return true;
  }

  /**
   * Update the last accessed time for a cached flag
   */
  private updateAccessTime(cacheKey: string): void {
    const cachedFlag = this.memoryCache[cacheKey];
    if (cachedFlag) {
      cachedFlag.lastAccessed = Date.now();
    }
  }

  /**
   * Clean up expired cache entries
   * With permanent caching, this only removes failed attempts after TTL
   */
  private cleanupExpiredCache(): void {
    // With permanent caching, we don't clean up successful entries
    // Only clear the failed countries set periodically
    const now = Date.now();
    if (this.lastApiError && (now - this.lastApiError) > this.CACHE_TTL.failed) {
      this.failedCountries.clear();
      this.apiErrorCount = 0;
      console.log('[UnifiedFlagService] Cleared failed countries list for retry');
    }
  }

  /**
   * Prefetch flags in the background (non-blocking)
   */
  prefetchFlags(countryNames: string[]): void {
    if (this.isUpdating) return;

    // Non-blocking background prefetch
    this.backgroundPrefetch(countryNames).catch(error => {
      console.warn('[UnifiedFlagService] Background prefetch failed:', error);
    });
  }

  /**
   * Background prefetch implementation with multi-wiki support
   */
  private async backgroundPrefetch(countryNames: string[]): Promise<void> {
    this.isUpdating = true;
    console.log(`[UnifiedFlagService] Starting background prefetch for ${countryNames.length} countries`);

    try {
      // Clean up expired cache first
      this.cleanupExpiredCache();
      
      // Prioritize countries that aren't cached yet or have expired cache
      const uncachedCountries = countryNames.filter(name => {
        const cacheKey = name.toLowerCase();
        const cachedFlag = this.memoryCache[cacheKey];
        return !this.hasLocalFlag(name) && (!cachedFlag || !this.isCacheValid(cachedFlag));
      });

      console.log(`[UnifiedFlagService] Prefetching ${uncachedCountries.length} uncached flags from multiple wikis`);

      // Process in small batches to avoid overwhelming APIs
      const batchSize = 3; // Smaller batches since we're hitting multiple APIs
      for (let i = 0; i < uncachedCountries.length; i += batchSize) {
        const batch = uncachedCountries.slice(i, i + batchSize);
        
        await Promise.allSettled(
          batch.map(countryName => this.fetchFlagFromMultipleWikis(countryName))
        );

        // Delay between batches
        if (i + batchSize < uncachedCountries.length) {
          await this.delay(1000); // Longer delay for multi-wiki requests
        }
      }

      this.lastUpdateTime = Date.now();
      this.saveLocalMetadata(); // Debounced save
      
      const successfulFlags = Object.values(this.memoryCache).filter(f => f && f.url).length;
      console.log(`[UnifiedFlagService] Background prefetch completed. Cached flags: ${successfulFlags}`);
      console.log('[UnifiedFlagService] Source stats:', this.sourceStats);
    } finally {
      this.isUpdating = false;
    }
  }

  // Note: Legacy single-source fetch methods have been replaced by
  // fetchFlagFromMultipleWikis() which supports IxWiki, IiWiki, AlthistoryWiki, and WikiCommons

  /**
   * Get service statistics with multi-wiki source breakdown
   */
  getStats(): FlagServiceStats {
    const hitRate = this.stats.totalRequests > 0 
      ? Math.round((this.stats.cacheHits / this.stats.totalRequests) * 100) 
      : 0;

    const validCachedFlags = Object.values(this.memoryCache).filter(cachedFlag => 
      cachedFlag && cachedFlag.url && this.isCacheValid(cachedFlag)
    ).length;

    return {
      totalCountries: this.stats.totalRequests,
      cachedFlags: validCachedFlags,
      localFiles: Object.keys(this.localMetadata).length,
      failedFlags: this.failedCountries.size,
      lastUpdateTime: this.lastUpdateTime,
      isUpdating: this.isUpdating,
      hitRate,
      sourceStats: { ...this.sourceStats }, // Copy to avoid mutations
    };
  }

  /**
   * Clear all caches and reset statistics
   */
  async clearCache(): Promise<void> {
    this.memoryCache = {};
    this.failedCountries.clear();
    this.requestQueue.clear();
    this.stats = { totalRequests: 0, cacheHits: 0, cacheMisses: 0 };
    this.localMetadata = {};
    
    // Reset source statistics
    this.wikiSources.forEach(source => {
      this.sourceStats[source.name] = { found: 0, failed: 0, cached: 0 };
    });
    
    console.log('[UnifiedFlagService] All caches and statistics cleared');
  }

  /**
   * Check if URL is a placeholder
   */
  isPlaceholderFlag(url: string): boolean {
    return url === this.PLACEHOLDER_FLAG || url.includes('placeholder');
  }

  // Utility methods
  private async loadLocalMetadata(): Promise<void> {
    // In browser environment, try localStorage first
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('flag-service-metadata');
        if (stored) {
          const parsed = JSON.parse(stored);
          this.localMetadata = parsed.flags || {};
          this.lastUpdateTime = parsed.lastUpdateTime || null;
          
          // Load memory cache from localStorage (no TTL validation - permanent cache)
          if (parsed.memoryCache) {
            Object.entries(parsed.memoryCache).forEach(([key, cachedFlag]: [string, any]) => {
              // Load both successful flags AND failures (null)
              this.memoryCache[key] = cachedFlag;
              if (cachedFlag === null) {
                // Also mark as failed
                this.failedCountries.add(key);
              }
            });
          }

          // Load failed countries set
          if (parsed.failedCountries) {
            parsed.failedCountries.forEach((country: string) => {
              this.failedCountries.add(country);
            });
          }
          
          // Load source statistics
          if (parsed.sourceStats) {
            Object.assign(this.sourceStats, parsed.sourceStats);
          }
          
          const cacheCount = Object.keys(this.memoryCache).length;
          const localCount = Object.keys(this.localMetadata).length;
          console.log(`[UnifiedFlagService] Loaded from localStorage: ${localCount} local flags, ${cacheCount} cached flags`);
        }
      } catch (error) {
        console.log('[UnifiedFlagService] No existing localStorage metadata found');
      }
    }

    // Always try to load server metadata file (both client and server)
    try {
      let metadataPath;
      if (typeof window !== 'undefined') {
        // Client-side: fetch from public URL
        metadataPath = '/flags/metadata.json';
        const metadataResponse = await fetch(metadataPath);
        if (metadataResponse.ok) {
          const serverMetadata = await metadataResponse.json();
          if (serverMetadata.flags) {
            // Merge server metadata with any existing local metadata
            Object.assign(this.localMetadata, serverMetadata.flags);
            console.log(`[UnifiedFlagService] Loaded server metadata: ${Object.keys(serverMetadata.flags).length} server flags`);
          }
        }
      } else {
        // Server-side: read file directly
        const fs = await import('fs/promises');
        const path = await import('path');
        metadataPath = path.join(process.cwd(), 'public', 'flags', 'metadata.json');
        
        try {
          const metadataContent = await fs.readFile(metadataPath, 'utf-8');
          const serverMetadata = JSON.parse(metadataContent);
          if (serverMetadata.flags) {
            this.localMetadata = serverMetadata.flags;
            console.log(`[UnifiedFlagService] Loaded server metadata: ${Object.keys(serverMetadata.flags).length} flags`);
          }
        } catch (fsError) {
          console.log('[UnifiedFlagService] Server metadata file not found, starting fresh');
        }
      }
    } catch (error) {
      console.warn('[UnifiedFlagService] Failed to load server metadata:', error);
    }
  }

  private async saveLocalMetadata(): Promise<void> {
    // Debounce save operations to prevent spam
    if (this.saveDebounceTimer) {
      clearTimeout(this.saveDebounceTimer);
    }

    this.pendingSave = true;

    // Save to localStorage immediately (cheap operation)
    if (typeof window !== 'undefined') {
      try {
        const metadata = {
          lastUpdateTime: this.lastUpdateTime,
          flags: this.localMetadata,
          memoryCache: this.memoryCache,
          sourceStats: this.sourceStats,
          failedCountries: Array.from(this.failedCountries), // Save failed attempts too
          version: '2.1',
        };
        localStorage.setItem('flag-service-metadata', JSON.stringify(metadata));
      } catch (error) {
        console.warn('[UnifiedFlagService] Failed to save to localStorage:', error);
      }
    }

    // Debounce server save (expensive operation)
    this.saveDebounceTimer = setTimeout(async () => {
      if (!this.pendingSave) return;

      this.pendingSave = false;

      if (typeof window !== 'undefined') {
        try {
          await fetch('/api/flags/save-metadata', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              flags: this.localMetadata,
              lastUpdateTime: this.lastUpdateTime
            })
          });
          console.log('[UnifiedFlagService] Metadata batch saved to server');
        } catch (serverError) {
          console.warn('[UnifiedFlagService] Failed to save metadata to server:', serverError);
        }
      }
    }, this.SAVE_DEBOUNCE_DELAY);
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Download flag image to local storage
   */
  private async downloadFlagToLocal(countryName: string, flagUrl: string, source: WikiSource): Promise<void> {
    try {
      const cacheKey = countryName.toLowerCase();
      
      // Skip if already downloaded
      if (this.localMetadata[cacheKey]) {
        return;
      }
      
      // Extract file extension from URL
      const urlParts = flagUrl.split('.');
      const extension = urlParts[urlParts.length - 1]?.toLowerCase() || 'png';
      const safeExtension = ['png', 'jpg', 'jpeg', 'svg', 'gif'].includes(extension) ? extension : 'png';
      
      // Generate safe filename
      const safeCountryName = countryName.replace(/[^a-zA-Z0-9\s-]/g, '').replace(/\s+/g, '_').toLowerCase();
      const fileName = `${safeCountryName}.${safeExtension}`;
      
      // Download the image via our API endpoint
      const downloadResponse = await fetch('/api/flags/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          countryName,
          flagUrl,
          fileName,
          source: source.name
        })
      });
      
      if (downloadResponse.ok) {
        const result = await downloadResponse.json();
        if (result.success) {
          // Update local metadata
          this.localMetadata[cacheKey] = {
            fileName: result.fileName,
            originalUrl: flagUrl,
            downloadedAt: Date.now(),
            fileSize: result.fileSize || 0,
            source: source
          };
          
          console.log(`[UnifiedFlagService] Downloaded flag for ${countryName} to ${result.fileName}`);

          // Schedule metadata save (debounced)
          this.saveLocalMetadata();
        }
      }
    } catch (error) {
      console.warn(`[UnifiedFlagService] Failed to download flag for ${countryName}:`, error);
    }
  }

  /**
   * Get download progress for admin interface
   */
  getDownloadProgress(): { completed: number; total: number; inProgress: boolean } {
    const stats = this.getStats();
    return {
      completed: stats.localFiles,
      total: stats.cachedFlags,
      inProgress: this.isUpdating
    };
  }
}

// Export singleton instance
export const unifiedFlagService = new UnifiedFlagService();
export default unifiedFlagService;

// Compatibility exports for existing code
export const simpleFlagService = unifiedFlagService;
export const improvedFlagService = unifiedFlagService;
export const enhancedFlagCacheManager = unifiedFlagService;