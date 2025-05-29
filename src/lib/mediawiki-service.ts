// src/lib/mediawiki-service.ts
// This replaces the old mediawiki-service.tsx file

import { env } from "~/env";

// Types for better type safety
export interface MediaWikiError {
  code: string;
  info: string;
  message?: string;
}

export interface MediaWikiParseResponse {
  parse?: {
    title: string;
    pageid: number;
    text?: { '*': string };
    wikitext?: { '*': string };
    categories?: Array<{ category: string; sortkey: string; hidden?: boolean }>;
    templates?: Array<{ title: string; exists?: boolean }>;
    images?: string[];
    externallinks?: string[];
    sections?: Array<{ 
      line: string; 
      level: number; 
      index: string; 
      anchor: string; 
    }>;
    properties?: Record<string, string>;
  };
  query?: {
    pages?: Array<{
      pageid?: number;
      title: string;
      missing?: boolean;
      imageinfo?: Array<{
        url: string;
        descriptionurl?: string;
        thumburl?: string;
      }>;
    }>;
  };
  error?: MediaWikiError;
}

export interface CountryInfobox {
  name: string;
  // Core identification
  conventional_long_name?: string;
  native_name?: string;
  common_name?: string;
  
  // Visual elements
  image_flag?: string;
  flag?: string;
  image_coat?: string;
  
  // Geographic data
  capital?: string;
  largest_city?: string;
  area_km2?: string;
  area?: string;
  continent?: string;
  
  // Population data
  population_estimate?: string;
  population_census?: string;
  population?: string;
  population_density_km2?: string;
  
  // Government data
  government_type?: string;
  government?: string;
  leader_title1?: string;
  leader_name1?: string;
  leader?: string;
  legislature?: string;
  
  // Economic data
  GDP_PPP?: string;
  GDP_PPP_per_capita?: string;
  GDP_nominal?: string;
  GDP_nominal_per_capita?: string;
  gdp?: string;
  currency?: string;
  currency_code?: string;
  
  // Cultural data
  official_languages?: string;
  languages?: string;
  ethnic_groups?: string;
  religion?: string;
  demonym?: string;
  
  // Technical data
  time_zone?: string;
  timezone?: string;
  drives_on?: string;
  drivingSide?: string;
  cctld?: string;
  internetTld?: string;
  calling_code?: string;
  callingCode?: string;
  
  // Additional fields
  [key: string]: string | undefined;
}

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
  lastFetch: number;
}

interface ApiStats {
  totalRequests: number;
  cacheHits: number;
  cacheMisses: number;
  errors: number;
  lastError?: string;
}

class ImprovedMediaWikiService {
  private cache = new Map<string, CacheEntry<any>>();
  private stats: ApiStats = {
    totalRequests: 0,
    cacheHits: 0,
    cacheMisses: 0,
    errors: 0
  };

  // Cache configuration
  private readonly CACHE_TTL = {
    infobox: 24 * 60 * 60 * 1000, // 24 hours for infobox data
    flag: 7 * 24 * 60 * 60 * 1000, // 7 days for flag URLs
    template: 24 * 60 * 60 * 1000, // 24 hours for template data
    page: 6 * 60 * 60 * 1000, // 6 hours for page content
  };

  private readonly MAX_RETRIES = 3;
  private readonly RETRY_DELAY = 1000; // 1 second

  constructor() {
    // Clean up expired cache entries every hour
    if (typeof window !== 'undefined') {
      setInterval(() => {
        this.cleanupCache();
      }, 60 * 60 * 1000);
    }
  }

  /**
   * Get country wiki URL
   */
  getCountryWikiUrl(countryName: string): string {
    const baseUrl = env.NEXT_PUBLIC_MEDIAWIKI_URL || "https://ixwiki.com";
    const pageName = this.sanitizePageName(countryName);
    return `${baseUrl}/wiki/${encodeURIComponent(pageName)}`;
  }

  /**
   * Get flag URL for a country
   */
  async getFlagUrl(countryName: string): Promise<string | null> {
    const cacheKey = `flag_${countryName.toLowerCase()}`;
    
    // Check cache first
    const cached = this.getFromCache<string | null>(cacheKey);
    if (cached !== null) {
      this.stats.cacheHits++;
      return cached;
    }

    this.stats.cacheMisses++;
    this.stats.totalRequests++;

    try {
      console.log(`[MediaWiki] Getting flag for: ${countryName}`);

      // Strategy 1: Try Country_data template
      let flagUrl = await this.getFlagFromCountryDataTemplate(countryName);
      if (flagUrl) {
        this.setCache(cacheKey, flagUrl, 'flag');
        return flagUrl;
      }

      // Strategy 2: Try infobox
      flagUrl = await this.getFlagFromInfobox(countryName);
      if (flagUrl) {
        this.setCache(cacheKey, flagUrl, 'flag');
        return flagUrl;
      }

      // Strategy 3: Common file patterns
      flagUrl = await this.getFlagFromCommonPatterns(countryName);
      if (flagUrl) {
        this.setCache(cacheKey, flagUrl, 'flag');
        return flagUrl;
      }

      // Cache null result to avoid repeated API calls
      this.setCache(cacheKey, null, 'flag');
      return null;

    } catch (error) {
      this.stats.errors++;
      this.stats.lastError = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[MediaWiki] Error getting flag for ${countryName}:`, error);
      return null;
    }
  }

  /**
   * Get country infobox data
   */
  async getCountryInfobox(countryName: string): Promise<CountryInfobox | null> {
    const cacheKey = `infobox_${countryName.toLowerCase()}`;
    
    // Check cache first
    const cached = this.getFromCache<CountryInfobox | null>(cacheKey);
    if (cached !== null) {
      this.stats.cacheHits++;
      return cached;
    }

    this.stats.cacheMisses++;
    this.stats.totalRequests++;

    try {
      console.log(`[MediaWiki] Getting infobox for: ${countryName}`);

      const response = await this.makeApiRequest({
        action: 'parse',
        page: this.sanitizePageName(countryName),
        prop: 'wikitext',
        section: '0', // Only get the first section which usually contains the infobox
      });

      if (!response.parse?.wikitext?.['*']) {
        console.log(`[MediaWiki] No wikitext found for: ${countryName}`);
        this.setCache(cacheKey, null, 'infobox');
        return null;
      }

      const infobox = this.parseInfoboxFromWikitext(response.parse.wikitext['*'], countryName);
      this.setCache(cacheKey, infobox, 'infobox');
      return infobox;

    } catch (error) {
      this.stats.errors++;
      this.stats.lastError = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[MediaWiki] Error getting infobox for ${countryName}:`, error);
      this.setCache(cacheKey, null, 'infobox');
      return null;
    }
  }

  /**
   * Preload flags for multiple countries
   */
  async preloadCountryFlags(countryNames: string[]): Promise<void> {
    console.log(`[MediaWiki] Preloading flags for ${countryNames.length} countries`);
    
    const batchSize = 5; // Process in small batches to avoid overwhelming the API
    const batches = [];
    
    for (let i = 0; i < countryNames.length; i += batchSize) {
      batches.push(countryNames.slice(i, i + batchSize));
    }

    let successful = 0;
    let failed = 0;

    for (const batch of batches) {
      const promises = batch.map(async (name) => {
        try {
          const url = await this.getFlagUrl(name);
          return { name, url, success: !!url };
        } catch (error) {
          console.warn(`[MediaWiki] Failed to preload flag for ${name}:`, error);
          return { name, url: null, success: false };
        }
      });

      const results = await Promise.all(promises);
      successful += results.filter(r => r.success).length;
      failed += results.filter(r => !r.success).length;

      // Small delay between batches
      if (batches.length > 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    console.log(`[MediaWiki] Preload complete: ${successful} successful, ${failed} failed`);
  }

  /**
   * Private Methods
   */

  private async getFlagFromCountryDataTemplate(countryName: string): Promise<string | null> {
    try {
      const templateName = `Template:Country_data_${this.sanitizePageName(countryName)}`;
      console.log(`[MediaWiki] Checking template: ${templateName}`);

      const response = await this.makeApiRequest({
        action: 'parse',
        page: templateName,
        prop: 'wikitext',
      });

      if (!response.parse?.wikitext?.['*']) {
        return null;
      }

      const wikitext = response.parse.wikitext['*'];
      
      // Extract flag alias or flag parameter
      const flagAliasMatch = wikitext.match(/\|\s*flag\s*alias\s*=\s*([^\n\|]+)/i);
      if (flagAliasMatch?.[1]) {
        const flagFile = flagAliasMatch[1].trim();
        if (flagFile && !this.containsTemplate(flagFile)) {
          return await this.getFileUrl(flagFile);
        }
      }

      const flagMatch = wikitext.match(/\|\s*flag\s*=\s*([^\n\|]+)/i);
      if (flagMatch?.[1]) {
        const flagFile = flagMatch[1].trim();
        if (flagFile && !this.containsTemplate(flagFile)) {
          return await this.getFileUrl(flagFile);
        }
      }

      return null;
    } catch (error) {
      console.warn(`[MediaWiki] Error getting flag from template for ${countryName}:`, error);
      return null;
    }
  }

  private async getFlagFromInfobox(countryName: string): Promise<string | null> {
    try {
      const infobox = await this.getCountryInfobox(countryName);
      if (!infobox) return null;

      // Check various flag fields
      const flagFields = ['image_flag', 'flag', 'flag_image'];
      for (const field of flagFields) {
        const flagValue = infobox[field];
        if (flagValue && !this.containsTemplate(flagValue)) {
          const url = await this.getFileUrl(flagValue);
          if (url) return url;
        }
      }

      return null;
    } catch (error) {
      console.warn(`[MediaWiki] Error getting flag from infobox for ${countryName}:`, error);
      return null;
    }
  }

  private async getFlagFromCommonPatterns(countryName: string): Promise<string | null> {
    const sanitizedName = this.sanitizePageName(countryName);
    const patterns = [
      `Flag3 ${countryName.toLowerCase()}.png`,
      `Flag_of_${sanitizedName}.svg`,
      `Flag_of_${sanitizedName}.png`,
      `${sanitizedName}_flag.svg`,
      `${sanitizedName}_flag.png`,
      `Flag_${sanitizedName}.svg`,
      `Flag_${sanitizedName}.png`,
      `Flag ${countryName}.svg`,
      `Flag ${countryName}.png`,
    ];

    for (const pattern of patterns) {
      try {
        const url = await this.getFileUrl(pattern);
        if (url) return url;
      } catch (error) {
        // Continue to next pattern
        continue;
      }
    }

    return null;
  }

  private async getFileUrl(fileName: string): Promise<string | null> {
    if (!fileName) return null;

    const cleanFileName = fileName.replace(/^File:/i, '').trim();
    if (!cleanFileName) return null;

    try {
      const response = await this.makeApiRequest({
        action: 'query',
        titles: `File:${cleanFileName}`,
        prop: 'imageinfo',
        iiprop: 'url',
      });

      const pages = response.query?.pages;
      if (!pages || pages.length === 0) return null;

      const page = pages[0];
      if (!page || page.missing) return null;

      return page.imageinfo?.[0]?.url || null;
    } catch (error) {
      console.warn(`[MediaWiki] Error getting file URL for ${cleanFileName}:`, error);
      return null;
    }
  }

  private parseInfoboxFromWikitext(wikitext: string, countryName: string): CountryInfobox {
    const infobox: CountryInfobox = { name: countryName };

    try {
      // Match infobox country template
      const infoboxRegex = /\{\{\s*(?:Infobox\s+country|Country\s+infobox)([\s\S]*?)\n\}\}/i;
      const match = wikitext.match(infoboxRegex);

      if (!match) {
        console.log(`[MediaWiki] No infobox found for: ${countryName}`);
        return infobox;
      }

      const infoboxContent = match[1];
      if (!infoboxContent) {
        console.log(`[MediaWiki] Empty infobox content for: ${countryName}`);
        return infobox;
      }
      
      const lines = infoboxContent.split('\n');

      let currentParam = '';
      let currentValue = '';
      let depth = 0;

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        // Count template depth
        depth += (trimmed.match(/\{\{/g) || []).length;
        depth -= (trimmed.match(/\}\}/g) || []).length;

        // Look for parameter lines
        const paramMatch = trimmed.match(/^\|\s*([^=]+?)\s*=\s*(.*)/);

        if (paramMatch && paramMatch[1] && depth === 0) {
          // Save previous parameter
          if (currentParam && currentValue.trim()) {
            this.setInfoboxValue(infobox, currentParam, currentValue);
          }

          currentParam = paramMatch[1].trim();
          currentValue = paramMatch[2] || '';
        } else if (currentParam && depth === 0) {
          // Continue multiline value
          currentValue += ' ' + trimmed;
        }
      }

      // Save last parameter
      if (currentParam && currentValue.trim()) {
        this.setInfoboxValue(infobox, currentParam, currentValue);
      }

      console.log(`[MediaWiki] Parsed ${Object.keys(infobox).length} infobox fields for: ${countryName}`);
      return infobox;

    } catch (error) {
      console.error(`[MediaWiki] Error parsing infobox for ${countryName}:`, error);
      return infobox;
    }
  }

  private setInfoboxValue(infobox: CountryInfobox, key: string, value: string): void {
    // Clean up the value
    let cleanValue = value
      .replace(/\[\[(?:[^\|\]]*\|)?([^\]]+)\]\]/g, '$1') // Remove wiki links
      .replace(/\{\{(?:nowrap|nobr)\|([^}]+)\}\}/gi, '$1') // Remove nowrap templates
      .replace(/<ref[^>]*>.*?<\/ref>/gi, '') // Remove references
      .replace(/<[^>]+>/g, '') // Remove HTML tags
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();

    if (!cleanValue || cleanValue === '–' || cleanValue === '-') return;

    // Store with original key
    infobox[key as keyof CountryInfobox] = cleanValue;

    // Create normalized key
    const normalizedKey = key.toLowerCase().replace(/[^a-z0-9]+/g, '_');
    if (normalizedKey !== key) {
      infobox[normalizedKey as keyof CountryInfobox] = cleanValue;
    }

    // Map common variations
    const fieldMappings: Record<string, keyof CountryInfobox> = {
      area_km2: 'area',
      population_estimate: 'population',
      government_type: 'government',
      leader_name1: 'leader',
      gdp_ppp: 'gdp',
      official_languages: 'languages',
      time_zone: 'timezone',
      calling_code: 'callingCode',
      cctld: 'internetTld',
      drives_on: 'drivingSide',
    };

    const mappedKey = fieldMappings[normalizedKey];
    if (mappedKey) {
      infobox[mappedKey] = cleanValue;
    }
  }

  private async makeApiRequest(params: Record<string, string>): Promise<MediaWikiParseResponse> {
    const url = new URL('/api/mediawiki', window.location.origin);
    
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.set(key, value);
    });

    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.MAX_RETRIES; attempt++) {
      try {
        const response = await fetch(url.toString(), {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
            'Cache-Control': 'no-cache',
          },
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(`HTTP ${response.status}: ${errorData.message || response.statusText}`);
        }

        const data = await response.json();

        if (data.error) {
          throw new Error(`MediaWiki API Error: ${data.error.code} - ${data.error.message || data.error.info}`);
        }

        return data;

      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        
        if (attempt < this.MAX_RETRIES) {
          console.warn(`[MediaWiki] Attempt ${attempt} failed, retrying in ${this.RETRY_DELAY}ms:`, lastError.message);
          await new Promise(resolve => setTimeout(resolve, this.RETRY_DELAY * attempt));
        }
      }
    }

    throw lastError || new Error('All retry attempts failed');
  }

  // Utility methods
  private sanitizePageName(pageName: string): string {
    return pageName
      .replace(/ /g, '_')
      .replace(/[^\w\-_.()]/g, '')
      .trim();
  }

  private containsTemplate(text: string): boolean {
    return text.includes('{{') || text.includes('{{{');
  }

  private getFromCache<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  private setCache<T>(key: string, data: T, type: keyof typeof this.CACHE_TTL): void {
    const ttl = this.CACHE_TTL[type];
    this.cache.set(key, {
      data,
      expiresAt: Date.now() + ttl,
      lastFetch: Date.now(),
    });
  }

  private cleanupCache(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      console.log(`[MediaWiki] Cleaned up ${cleaned} expired cache entries`);
    }  
  }

  // Public utility methods
  clearCache(): void {
    this.cache.clear();
    console.log('[MediaWiki] Cache cleared');
  }

  getCacheStats() {
    const flagEntries = Array.from(this.cache.entries()).filter(([key]) => key.startsWith('flag_'));
    const successfulFlags = flagEntries.filter(([, entry]) => entry.data !== null).length;
    const failedFlags = flagEntries.filter(([, entry]) => entry.data === null).length;

    return {
      ...this.stats,
      cacheSize: this.cache.size,
      cacheEfficiency: this.stats.totalRequests > 0 ? 
        Math.round((this.stats.cacheHits / this.stats.totalRequests) * 100) : 0,
      // Legacy properties for backward compatibility
      flags: flagEntries.length,
      preloadedFlags: successfulFlags,
      failedFlags: failedFlags,
    };
  }
}

// Export singleton instance
export const ixnayWiki = new ImprovedMediaWikiService();