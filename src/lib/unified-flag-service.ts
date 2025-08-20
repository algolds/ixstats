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

  // Wiki sources in priority order (highest priority first)
  private readonly wikiSources: WikiSource[] = [
    { name: 'IxWiki', baseUrl: 'https://ixwiki.com', priority: 1 },
    { name: 'IiWiki', baseUrl: 'https://iiwiki.com/mediawiki', priority: 2 },
    { name: 'AlthistoryWiki', baseUrl: 'https://althistory.fandom.com', priority: 3 },
    // Removed WikiCommons due to CORS issues
  ];

  private sourceStats: Record<string, { found: number; failed: number; cached: number }> = {};

  // Cache TTL settings
  private readonly CACHE_TTL = {
    memory: 24 * 60 * 60 * 1000,     // 24 hours in memory
    localStorage: 7 * 24 * 60 * 60 * 1000, // 7 days in localStorage
    failed: 2 * 60 * 60 * 1000,      // 2 hours for failed attempts
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

    // 1. Check local file first (fastest)
    const localUrl = this.getLocalFlagUrl(countryName);
    if (localUrl) {
      this.stats.cacheHits++;
      this.updateAccessTime(cacheKey);
      return localUrl;
    }

    // 2. Check memory cache with TTL validation
    const cachedFlag = this.memoryCache[cacheKey];
    if (cachedFlag && this.isCacheValid(cachedFlag)) {
      this.stats.cacheHits++;
      this.updateAccessTime(cacheKey);
      if (cachedFlag.source?.name && this.sourceStats[cachedFlag.source.name]) {
        this.sourceStats[cachedFlag.source.name]!.cached++;
      }
      return cachedFlag.url;
    }
    if (this.requestQueue.has(cacheKey)) {
      return await this.requestQueue.get(cacheKey)!;
    }

    // 4. Fetch from multiple wiki sources with fallback
    this.stats.cacheMisses++;
    const fetchPromise = this.fetchFlagFromMultipleWikis(countryName);
    this.requestQueue.set(cacheKey, fetchPromise);

    try {
      const result = await fetchPromise;
      this.requestQueue.delete(cacheKey);
      return result;
    } catch (error) {
      this.requestQueue.delete(cacheKey);
      console.error(`[UnifiedFlagService] Error fetching flag for ${countryName}:`, error);
      return null;
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

    // Check memory cache with TTL validation
    const cacheKey = countryName.toLowerCase();
    const cachedFlag = this.memoryCache[cacheKey];
    
    if (cachedFlag && this.isCacheValid(cachedFlag)) {
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
    
    // Process in parallel batches of 10
    const batchSize = 10;
    for (let i = 0; i < countryNames.length; i += batchSize) {
      const batch = countryNames.slice(i, i + batchSize);
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

      // Small delay between batches to avoid overwhelming the server
      if (i + batchSize < countryNames.length) {
        await this.delay(100);
      }
    }

    return results;
  }

  /**
   * Fetch flag from multiple wiki sources with intelligent fallback
   */
  private async fetchFlagFromMultipleWikis(countryName: string): Promise<string | null> {
    const cacheKey = countryName.toLowerCase();
    
    // Try each wiki source in priority order
    for (const source of this.wikiSources) {
      try {
        console.log(`[UnifiedFlagService] Trying ${source.name} for ${countryName}`);
        
        let flagUrl: string | null = null;
        
        if (source.name === 'WikiCommons') {
          flagUrl = await this.fetchFromWikiCommons(countryName);
        } else {
          flagUrl = await this.fetchFromMediaWiki(countryName, source);
        }
        
        if (flagUrl) {
          // Cache the successful result
          const cachedFlag: CachedFlag = {
            url: flagUrl,
            source: source,
            cachedAt: Date.now(),
            lastAccessed: Date.now(),
          };
          
          this.memoryCache[cacheKey] = cachedFlag;
          if (source.name && this.sourceStats[source.name]) {
            this.sourceStats[source.name]!.found++;
          }
          
          // Try to download and store the flag file locally (non-blocking)
          this.downloadFlagToLocal(countryName, flagUrl, source).catch(error => {
            console.warn(`[UnifiedFlagService] Failed to download flag for ${countryName}:`, error);
          });
          
          console.log(`[UnifiedFlagService] Found flag for ${countryName} from ${source.name}: ${flagUrl}`);
          return flagUrl;
        } else {
          if (source.name && this.sourceStats[source.name]) {
            this.sourceStats[source.name]!.failed++;
          }
        }
      } catch (error) {
        console.warn(`[UnifiedFlagService] Error fetching from ${source.name} for ${countryName}:`, error);
        if (source.name && this.sourceStats[source.name]) {
          this.sourceStats[source.name]!.failed++;
        }
      }
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
      // Try different flag filename patterns for Commons
      const flagPatterns = [
        `Flag of ${countryName}.svg`,
        `Flag of ${countryName}.png`,
        `${countryName} flag.svg`,
        `${countryName} flag.png`,
        `Flag_of_${countryName}.svg`,
        `Flag_of_${countryName}.png`,
      ];
      
      for (const filename of flagPatterns) {
        try {
          const fileInfoUrl = `https://commons.wikimedia.org/api.php?action=query&format=json&formatversion=2&origin=*&titles=File:${encodeURIComponent(filename)}&prop=imageinfo&iiprop=url`;
          
          const response = await fetch(fileInfoUrl, {
            signal: AbortSignal.timeout(8000),
          });
          
          if (response.ok) {
            const data = await response.json();
            if (data.query?.pages?.[0]?.imageinfo?.[0]?.url) {
              return data.query.pages[0].imageinfo[0].url;
            }
          }
        } catch (error) {
          continue; // Try next pattern
        }
      }
      
      return null;
    } catch (error) {
      console.warn(`[UnifiedFlagService] WikiCommons fetch error for ${countryName}:`, error);
      return null;
    }
  }

  /**
   * Check if cached flag is still valid based on TTL
   */
  private isCacheValid(cachedFlag: CachedFlag): boolean {
    if (!cachedFlag) return false;
    const now = Date.now();
    const age = now - cachedFlag.cachedAt;
    return age < this.CACHE_TTL.memory;
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
   */
  private cleanupExpiredCache(): void {
    const now = Date.now();
    const expiredKeys: string[] = [];
    
    Object.entries(this.memoryCache).forEach(([key, cachedFlag]) => {
      if (cachedFlag && (now - cachedFlag.cachedAt) > this.CACHE_TTL.memory) {
        expiredKeys.push(key);
      }
    });
    
    expiredKeys.forEach(key => {
      delete this.memoryCache[key];
    });
    
    if (expiredKeys.length > 0) {
      console.log(`[UnifiedFlagService] Cleaned up ${expiredKeys.length} expired cache entries`);
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
      await this.saveLocalMetadata();
      
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
          
          // Load memory cache from localStorage (with TTL validation)
          if (parsed.memoryCache) {
            const now = Date.now();
            Object.entries(parsed.memoryCache).forEach(([key, cachedFlag]: [string, any]) => {
              if (cachedFlag && cachedFlag.url && cachedFlag.cachedAt) {
                const age = now - cachedFlag.cachedAt;
                if (age < this.CACHE_TTL.localStorage) {
                  this.memoryCache[key] = cachedFlag;
                }
              }
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
    // Save to localStorage in browser
    if (typeof window !== 'undefined') {
      try {
        const metadata = {
          lastUpdateTime: this.lastUpdateTime,
          flags: this.localMetadata,
          memoryCache: this.memoryCache,
          sourceStats: this.sourceStats,
          version: '2.0', // Version for future compatibility
        };
        localStorage.setItem('flag-service-metadata', JSON.stringify(metadata));
        
        // Also save to server if possible
        try {
          await fetch('/api/flags/save-metadata', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              flags: this.localMetadata,
              lastUpdateTime: this.lastUpdateTime
            })
          });
          console.log('[UnifiedFlagService] Metadata saved to server');
        } catch (serverError) {
          // Server save failed, but localStorage succeeded
          console.warn('[UnifiedFlagService] Failed to save metadata to server, but localStorage succeeded');
        }
      } catch (error) {
        console.warn('[UnifiedFlagService] Failed to save metadata to localStorage:', error);
      }
    }
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
          
          // Save metadata after successful download
          await this.saveLocalMetadata();
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