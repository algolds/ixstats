// Country flag service using Wiki Commons API
import { searchWikiImages } from './wiki-search-service.client';

interface CountryFlag {
  country: string;
  flagUrl: string | null;
  source: 'wikimedia' | 'ixwiki' | 'cached';
  error?: string;
  timestamp?: number; // Added timestamp for cache invalidation
}

interface FlagSearchResult {
  name: string;
  path: string;
  url?: string;
  description?: string;
}

interface CountryFlagServiceOptions {
  enableIiwikiFallback?: boolean;
}

class CountryFlagService {
  private flagCache = new Map<string, CountryFlag>();
  private readonly CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours
  private readonly WIKIMEDIA_COMMONS_API = 'https://commons.wikimedia.org/w/api.php';
  private options: CountryFlagServiceOptions;

  constructor(options: CountryFlagServiceOptions = {}) {
    this.options = {
      enableIiwikiFallback: true, // Default to true for backward compatibility
      ...options
    };
  }

  /**
   * Get flag URL for a country, trying multiple sources
   */
  async getCountryFlag(countryName: string): Promise<CountryFlag> {
    const normalizedName = this.normalizeCountryName(countryName);
    
    // Check cache first
    const cached = this.flagCache.get(normalizedName);
    if (cached && this.isCacheValid(cached)) {
      return cached;
    }

    try {
      let result: CountryFlag = {
        country: countryName,
        flagUrl: null,
        source: 'cached'
      };

      // Method 1: Try Wikimedia Commons first (best quality flags)
      try {
        const commonsFlag = await this.searchWikimediaCommons(countryName);
        if (commonsFlag) {
          result = {
            country: countryName,
            flagUrl: commonsFlag,
            source: 'wikimedia',
            timestamp: Date.now() // Add timestamp
          };
          this.flagCache.set(normalizedName, result);
          return result;
        }
      } catch (error) {
        console.warn(`[CountryFlag] Commons search failed for ${countryName}:`, error);
      }

      

      // Method 3: Try IIWiki search as fallback (only if enabled)
      if (this.options.enableIiwikiFallback) {
        try {
          const iiwikiFlags = await searchWikiImages(`flag ${countryName}`, 'iiwiki');
          if (iiwikiFlags.length > 0 && iiwikiFlags[0]?.url) {
            result = {
              country: countryName,
              flagUrl: iiwikiFlags[0].url,
              source: 'ixwiki',
              timestamp: Date.now() // Add timestamp
            };
            this.flagCache.set(normalizedName, result);
            return result;
          }
        } catch (error) {
          console.warn(`[CountryFlag] IIWiki search failed for ${countryName}:`, error);
        }
      }

      // No flag found
      result = {
        country: countryName,
        flagUrl: null,
        source: 'cached',
        error: `No flag found for ${countryName}`,
        timestamp: Date.now() // Add timestamp
      };
      
      this.flagCache.set(normalizedName, result);
      return result;

    } catch (error) {
      const errorResult: CountryFlag = {
        country: countryName,
        flagUrl: null,
        source: 'cached',
        error: `Error fetching flag: ${error instanceof Error ? error.message : String(error)}`,
        timestamp: Date.now() // Add timestamp
      };
      
      this.flagCache.set(normalizedName, errorResult);
      return errorResult;
    }
  }

  /**
   * Search Wikimedia Commons for country flags
   */
  private async searchWikimediaCommons(countryName: string): Promise<string | null> {
    try {
      // Common flag filename patterns on Wikimedia Commons
      const flagPatterns = [
        `Flag of ${countryName}.svg`,
        `Flag of ${countryName}.png`,
        `Flag_of_${countryName.replace(/\s+/g, '_')}.svg`,
        `Flag_of_${countryName.replace(/\s+/g, '_')}.png`,
        `${countryName} flag.svg`,
        `${countryName} flag.png`,
        `${countryName.replace(/\s+/g, '')}-flag.svg`,
        `${countryName.replace(/\s+/g, '')}-flag.png`
      ];

      // Try direct file access first
      for (const pattern of flagPatterns) {
        try {
          const fileUrl = await this.getWikimediaFileUrl(pattern);
          if (fileUrl) {
            console.log(`[CountryFlag] Found Commons flag: ${pattern} -> ${fileUrl}`);
            return fileUrl;
          }
        } catch (error) {
          // Continue to next pattern
        }
      }

      // Try search API as fallback
      const searchQuery = `flag ${countryName}`;
      const searchResults = await this.searchWikimediaFiles(searchQuery);
      
      // Find best match from search results
      const bestMatch = this.findBestFlagMatch(searchResults, countryName);
      if (bestMatch?.url) {
        return bestMatch.url;
      }

      return null;
    } catch (error) {
      console.error(`[CountryFlag] Wikimedia Commons search error for ${countryName}:`, error);
      return null;
    }
  }

  /**
   * Get direct file URL from Wikimedia Commons
   */
  private async getWikimediaFileUrl(filename: string): Promise<string | null> {
    try {
      const params = new URLSearchParams({
        action: 'query',
        format: 'json',
        titles: `File:${filename}`,
        prop: 'imageinfo',
        iiprop: 'url',
        iilimit: '1',
        origin: '*',
        iiurlwidth: '2800'
      });

      const response = await fetch(`${this.WIKIMEDIA_COMMONS_API}?${params.toString()}`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
        mode: 'cors',
        cache: 'default'
      }).catch((fetchError) => {
        console.warn(`[CountryFlag] Network error for ${filename}:`, fetchError);
        return null;
      });

      if (!response || !response.ok) {
        return null;
      }

      const data = await response.json().catch(() => null);
      if (!data) {
        return null;
      }

      const pages = data.query?.pages;

      if (!pages || typeof pages !== 'object') {
        return null;
      }

      const pageIds = Object.keys(pages);
      if (pageIds.length === 0) {
        return null;
      }

      const firstPageId = pageIds[0];
      if (firstPageId === undefined) {
        return null;
      }
      const page = pages[firstPageId];
      if (!page || page.missing || !Array.isArray(page.imageinfo) || !page.imageinfo[0]?.url) {
        return null;
      }

      return page.imageinfo[0].url;
    } catch (error) {
      console.warn(`[CountryFlag] Error getting Wikimedia file URL for ${filename}:`, error);
      return null;
    }
  }

  /**
   * Search for files on Wikimedia Commons
   */
  private async searchWikimediaFiles(query: string): Promise<FlagSearchResult[]> {
    try {
      const params = new URLSearchParams({
        action: 'query',
        format: 'json',
        list: 'search',
        srsearch: query,
        srnamespace: '6', // File namespace
        srlimit: '20',
        srprop: 'snippet',
        origin: '*'
      });

      const response = await fetch(`${this.WIKIMEDIA_COMMONS_API}?${params.toString()}`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
        mode: 'cors',
        cache: 'default'
      }).catch((fetchError) => {
        console.warn(`[CountryFlag] Network error during search:`, fetchError);
        return null;
      });

      if (!response || !response.ok) {
        return [];
      }

      const data = await response.json().catch(() => null);
      if (!data) {
        return [];
      }

      const searchResults = data.query?.search || [];

      const results: FlagSearchResult[] = [];

      for (const result of searchResults) {
        if (result.title?.startsWith('File:') &&
            /\.(svg|png|jpg|jpeg)$/i.test(result.title)) {

          const filename = result.title.replace('File:', '');
          const fileUrl = await this.getWikimediaFileUrl(filename);

          if (fileUrl) {
            results.push({
              name: result.title,
              path: fileUrl,
              url: fileUrl,
              description: result.snippet || ''
            });
          }
        }
      }

      return results;
    } catch (error) {
      console.warn(`[CountryFlag] Wikimedia search error:`, error);
      return [];
    }
  }

  /**
   * Find the best flag match from search results
   */
  private findBestFlagMatch(results: FlagSearchResult[], countryName: string): FlagSearchResult | null {
    if (results.length === 0) return null;

    const normalizedCountry = countryName.toLowerCase().replace(/\s+/g, '');
    
    // Score results based on relevance
    const scoredResults = results.map(result => {
      let score = 0;
      const filename = result.name.toLowerCase();
      
      // Prefer SVG over other formats
      if (filename.endsWith('.svg')) score += 10;
      
      // Prefer files with "flag" in the name
      if (filename.includes('flag')) score += 20;
      
      // Prefer exact country name matches
      if (filename.includes(normalizedCountry)) score += 30;
      
      // Prefer "flag of [country]" pattern
      if (filename.includes(`flag_of_${normalizedCountry}`) || 
          filename.includes(`flag of ${normalizedCountry}`)) {
        score += 50;
      }
      
      // Penalize if it looks like a historical or variant flag
      if (filename.includes('historical') || 
          filename.includes('variant') || 
          filename.includes('old') ||
          filename.includes('former')) {
        score -= 20;
      }
      
      return { ...result, score };
    });

    // Sort by score and return the best match
    scoredResults.sort((a, b) => b.score - a.score);
    
    return scoredResults[0] || null;
  }

  /**
   * Normalize country name for consistent caching
   */
  private normalizeCountryName(name: string): string {
    return name.toLowerCase().trim().replace(/\s+/g, '_');
  }

  /**
   * Check if cached result is still valid
   */
  private isCacheValid(cached: CountryFlag): boolean {
    if (!cached.timestamp) {
      return false; // If no timestamp, consider it invalid (or re-fetch)
    }
    return (Date.now() - cached.timestamp) < this.CACHE_TTL;
  }

  /**
   * Batch fetch flags for multiple countries
   */
  async batchGetCountryFlags(countryNames: string[]): Promise<Map<string, CountryFlag>> {
    const results = new Map<string, CountryFlag>();
    
    // Process in batches to avoid overwhelming the APIs
    const BATCH_SIZE = 5;
    
    for (let i = 0; i < countryNames.length; i += BATCH_SIZE) {
      const batch = countryNames.slice(i, i + BATCH_SIZE);
      
      const promises = batch.map(async (countryName) => {
        const flag = await this.getCountryFlag(countryName);
        return [countryName, flag] as [string, CountryFlag];
      });
      
      const batchResults = await Promise.allSettled(promises);
      
      batchResults.forEach((result) => {
        if (result.status === 'fulfilled') {
          const [countryName, flag] = result.value;
          results.set(countryName, flag);
        }
      });
      
      // Small delay between batches to be respectful to APIs
      if (i + BATCH_SIZE < countryNames.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    return results;
  }

  /**
   * Clear the flag cache
   */
  clearCache(): void {
    this.flagCache.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    const total = this.flagCache.size;
    const successful = Array.from(this.flagCache.values()).filter(flag => flag.flagUrl !== null).length;
    const failed = total - successful;
    
    return {
      total,
      successful,
      failed,
      hitRate: total > 0 ? (successful / total) * 100 : 0
    };
  }
}

// Export singleton instances
export const countryFlagService = new CountryFlagService(); // Default with IIWiki fallback
export const countryFlagServiceCommonsOnly = new CountryFlagService({ enableIiwikiFallback: false }); // Commons only
export type { CountryFlag, FlagSearchResult, CountryFlagServiceOptions };