// src/lib/mediawiki-service.ts
// Enhanced service for fetching country data from MediaWiki API with pre-caching

import { env } from "~/env";

interface CountryTemplateData {
  flag?: string;
  capital?: string;
  continent?: string;
  currency?: string;
  government?: string;
  leader?: string;
}

interface CountryInfobox {
  name: string;
  capital?: string;
  continent?: string;
  area?: string;
  population?: string;
  currency?: string;
  government?: string;
  leader?: string;
  gdp?: string;
  languages?: string;
  timezone?: string;
  callingCode?: string;
  internetTld?: string;
  drivingSide?: string;
  [key: string]: string | undefined; // For any additional fields
}

interface MediaWikiApiResponse {
  parse?: {
    title: string;
    pageid: number;
    wikitext: {
      '*': string;
    };
  };
  query?: {
    pages: {
      [key: string]: {
        pageid: number;
        title: string;
        revisions?: Array<{
          contentformat: string;
          contentmodel: string;
          '*': string;
        }>;
        imageinfo?: Array<{
          url?: string;
        }>;
      };
    };
  };
}

interface FlagCacheEntry {
  url: string;
  preloaded: boolean;
  lastUpdated: number;
  error?: boolean;
}

class MediaWikiService {
  private baseUrl: string;
  private cache = new Map<string, CountryTemplateData>();
  private flagCache = new Map<string, FlagCacheEntry>();
  private infoboxCache = new Map<string, CountryInfobox>();
  private preloadPromises = new Map<string, Promise<string | null>>();
  
  // Cache expiration time (24 hours)
  private readonly CACHE_EXPIRY = 24 * 60 * 60 * 1000;
  
  constructor(baseUrl: string) {
    this.baseUrl = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
    
    // Initialize flag pre-loading if in browser
    if (typeof window !== 'undefined') {
      this.initializeFlagPreloading();
    }
  }

  /**
   * Initialize flag pre-loading system
   */
  private initializeFlagPreloading(): void {
    // Check if we have cached country list
    const cachedCountries = this.getCachedCountryList();
    if (cachedCountries.length > 0) {
      // Pre-load flags for cached countries
      this.preloadCountryFlags(cachedCountries);
    }
  }

  /**
   * Get cached country list from localStorage
   */
  private getCachedCountryList(): string[] {
    try {
      const cached = localStorage.getItem('ixstats_countries');
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  }

  /**
   * Update cached country list
   */
  private updateCachedCountryList(countries: string[]): void {
    try {
      localStorage.setItem('ixstats_countries', JSON.stringify(countries));
    } catch {
      // Ignore localStorage errors
    }
  }

  /**
   * Pre-load flags for multiple countries
   */
  async preloadCountryFlags(countryNames: string[]): Promise<void> {
    // Update cached country list
    this.updateCachedCountryList(countryNames);
    
    // Pre-load flags in batches to avoid overwhelming the server
    const BATCH_SIZE = 5;
    for (let i = 0; i < countryNames.length; i += BATCH_SIZE) {
      const batch = countryNames.slice(i, i + BATCH_SIZE);
      const promises = batch.map(name => this.preloadFlag(name));
      
      try {
        await Promise.allSettled(promises);
        // Small delay between batches
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        console.warn(`[MediaWiki] Batch preload error:`, error);
      }
    }
  }

  /**
   * Pre-load a single flag
   */
  private async preloadFlag(countryName: string): Promise<void> {
    const cacheKey = countryName.toLowerCase();
    const cached = this.flagCache.get(cacheKey);
    
    // Skip if already preloaded and not expired
    if (cached?.preloaded && (Date.now() - cached.lastUpdated < this.CACHE_EXPIRY)) {
      return;
    }

    try {
      const flagUrl = await this.getFlagUrl(countryName);
      if (flagUrl) {
        // Pre-load the image
        const img = new Image();
        await new Promise<void>((resolve, reject) => {
          img.onload = () => {
            this.flagCache.set(cacheKey, {
              url: flagUrl,
              preloaded: true,
              lastUpdated: Date.now(),
              error: false
            });
            resolve();
          };
          img.onerror = () => {
            this.flagCache.set(cacheKey, {
              url: flagUrl,
              preloaded: false,
              lastUpdated: Date.now(),
              error: true
            });
            reject(new Error('Failed to load image'));
          };
          img.src = flagUrl;
        });
      }
    } catch (error) {
      console.warn(`[MediaWiki] Failed to preload flag for ${countryName}:`, error);
    }
  }

  /**
   * Get flag URL with caching and pre-loading
   */
  async getFlagUrl(countryName: string): Promise<string | null> {
    const cacheKey = countryName.toLowerCase();
    
    // Check if we have a cached entry
    const cached = this.flagCache.get(cacheKey);
    if (cached && (Date.now() - cached.lastUpdated < this.CACHE_EXPIRY)) {
      return cached.error ? null : cached.url;
    }

    // Check if we already have a promise for this country
    const existingPromise = this.preloadPromises.get(cacheKey);
    if (existingPromise) {
      return existingPromise;
    }

    // Create new promise
    const promise = this.fetchFlagUrl(countryName);
    this.preloadPromises.set(cacheKey, promise);
    
    try {
      const result = await promise;
      this.preloadPromises.delete(cacheKey);
      return result;
    } catch (error) {
      this.preloadPromises.delete(cacheKey);
      throw error;
    }
  }

  /**
   * Internal method to fetch flag URL
   */
  private async fetchFlagUrl(countryName: string): Promise<string | null> {
    const cacheKey = countryName.toLowerCase();
    
    try {
      // First try to get country data which might have flag info
      const countryData = await this.getCountryData(countryName);
      
      if (countryData?.flag) {
        const flagUrl = await this.resolveFileUrl(countryData.flag);
        if (flagUrl) {
          this.flagCache.set(cacheKey, {
            url: flagUrl,
            preloaded: false,
            lastUpdated: Date.now(),
            error: false
          });
          return flagUrl;
        }
      }

      // Fallback: try common flag file naming patterns
      const flagPatterns = [
        `Flag of ${countryName}.png`,
        `Flag of ${countryName}.svg`,
        `Flag of ${countryName}.jpg`,
        `${countryName} flag.png`,
        `${countryName} flag.svg`,
        `Flag ${countryName}.png`,
        `Flag ${countryName}.svg`,
        `${countryName}flag.png`, // No space
        `${countryName}Flag.png`, // Capital F
      ];

      for (const pattern of flagPatterns) {
        const flagUrl = await this.resolveFileUrl(pattern);
        if (flagUrl) {
          this.flagCache.set(cacheKey, {
            url: flagUrl,
            preloaded: false,
            lastUpdated: Date.now(),
            error: false
          });
          return flagUrl;
        }
      }

      // No flag found - cache the negative result
      this.flagCache.set(cacheKey, {
        url: '',
        preloaded: false,
        lastUpdated: Date.now(),
        error: true
      });

      return null;
    } catch (error) {
      console.error(`[MediaWiki] Error fetching flag for ${countryName}:`, error);
      this.flagCache.set(cacheKey, {
        url: '',
        preloaded: false,
        lastUpdated: Date.now(),
        error: true
      });
      return null;
    }
  }

  /**
   * Get country infobox data
   */
  async getCountryInfobox(countryName: string): Promise<CountryInfobox | null> {
    const cacheKey = countryName.toLowerCase();
    
    if (this.infoboxCache.has(cacheKey)) {
      return this.infoboxCache.get(cacheKey)!;
    }

    try {
      const url = new URL(`${this.baseUrl}api.php`);
      
      url.searchParams.set('action', 'query');
      url.searchParams.set('format', 'json');
      url.searchParams.set('titles', countryName);
      url.searchParams.set('prop', 'revisions');
      url.searchParams.set('rvprop', 'content');
      url.searchParams.set('rvslots', 'main');
      url.searchParams.set('origin', '*');

      const response = await fetch(url.toString());
      
      if (!response.ok) {
        console.warn(`[MediaWiki] Failed to fetch ${countryName}: ${response.status}`);
        return null;
      }

      const data: MediaWikiApiResponse = await response.json();
      
      if (!data.query?.pages) {
        return null;
      }

      const pages = Object.values(data.query.pages);
      const page = pages[0];
      
      if (!page || page.pageid === -1 || !page.revisions?.[0]) {
        console.warn(`[MediaWiki] Page not found: ${countryName}`);
        return null;
      }

      const wikitext = page.revisions[0]['*'];
      const infobox = this.parseCountryInfobox(wikitext, countryName);
      
      this.infoboxCache.set(cacheKey, infobox);
      return infobox;
    } catch (error) {
      console.error(`[MediaWiki] Error fetching infobox for ${countryName}:`, error);
      return null;
    }
  }

  /**
   * Parse country infobox from wikitext
   */
  private parseCountryInfobox(wikitext: string, countryName: string): CountryInfobox {
    const infobox: CountryInfobox = { name: countryName };
    
    // Ensure wikitext is defined and is a string
    if (!wikitext || typeof wikitext !== 'string') {
      console.warn(`[MediaWiki] Invalid wikitext for ${countryName}`);
      return infobox;
    }
    
    // Find the Infobox country template (case insensitive, flexible spacing)
    const infoboxMatch = wikitext.match(/\{\{\s*Infobox\s+country\s*\|([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}\}/i);
    
    if (!infoboxMatch || !infoboxMatch[1]) {
      // Try alternative infobox patterns
      const altPatterns = [
        /\{\{\s*Infobox\s+nation\s*\|([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}\}/i,
        /\{\{\s*Country\s+infobox\s*\|([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}\}/i,
        /\{\{\s*Infobox\s*\|([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}\}/i
      ];
      
      let foundMatch = false;
      for (const pattern of altPatterns) {
        const match = wikitext.match(pattern);
        if (match && match[1]) {
          const parsedInfobox = this.parseInfoboxContent(match[1], countryName);
          this.infoboxCache.set(countryName.toLowerCase(), parsedInfobox);
          return parsedInfobox;
        }
      }
      
      console.warn(`[MediaWiki] No infobox found for ${countryName}`);
      return infobox;
    }

    return this.parseInfoboxContent(infoboxMatch[1], countryName);
  }

  /**
   * Parse infobox content into structured data
   */
  private parseInfoboxContent(infoboxContent: string, countryName: string): CountryInfobox {
    const infobox: CountryInfobox = { name: countryName };
    
    // Parse the infobox parameters
    const paramRegex = /\|\s*([^=|]+)\s*=\s*([^|]*)/g;
    let match;
    
    while ((match = paramRegex.exec(infoboxContent)) !== null) {
      if (!match[1] || !match[2]) continue;
      
      const key = match[1].trim().toLowerCase().replace(/\s+/g, '_');
      const value = match[2].trim()
        .replace(/\[\[([^|\]]+)(\|[^\]]+)?\]\]/g, '$1') // Remove wiki links but keep text
        .replace(/<ref[^>]*>.*?<\/ref>/gi, '') // Remove references
        .replace(/\{\{[^}]*\}\}/g, '') // Remove templates
        .replace(/\s+/g, ' ')
        .trim();
      
      if (value && value.length > 0) {
        // Map common infobox fields
        switch (key) {
          case 'official_name':
          case 'conventional_long_name':
          case 'common_name':
            if (!infobox.name || infobox.name === countryName) {
              infobox.name = value;
            }
            break;
          case 'capital':
          case 'capital_city':
          case 'capital_and_largest_city':
            infobox.capital = value;
            break;
          case 'continent':
          case 'region':
            infobox.continent = value;
            break;
          case 'area_km2':
          case 'area_total_km2':
          case 'area':
          case 'total_area':
            infobox.area = value;
            break;
          case 'population_estimate':
          case 'population_total':
          case 'population':
          case 'population_census':
            infobox.population = value;
            break;
          case 'currency':
            infobox.currency = value;
            break;
          case 'government_type':
          case 'government':
          case 'political_system':
            infobox.government = value;
            break;
          case 'leader_title1':
          case 'leader_name1':
          case 'head_of_state':
          case 'president':
          case 'prime_minister':
            if (key.includes('name') || key.includes('head') || key.includes('president') || key.includes('minister')) {
              infobox.leader = value;
            }
            break;
          case 'gdp_nominal':
          case 'gdp_ppp':
          case 'gdp':
          case 'gdp_total':
            infobox.gdp = value;
            break;
          case 'official_languages':
          case 'languages':
          case 'national_languages':
            infobox.languages = value;
            break;
          case 'timezone':
          case 'utc_offset':
          case 'time_zone':
            infobox.timezone = value;
            break;
          case 'calling_code':
          case 'phone_code':
            infobox.callingCode = value;
            break;
          case 'internet_tld':
          case 'cctld':
          case 'iso_code':
            infobox.internetTld = value;
            break;
          case 'drives_on':
          case 'driving_side':
            infobox.drivingSide = value;
            break;
          default:
            // Store any other fields that might be useful
            if (value.length < 200 && value.length > 0) { // Avoid very long values and empty strings
              infobox[key] = value;
            }
        }
      }
    }

    return infobox;
  }

  /**
   * Get country wiki page URL
   */
  getCountryWikiUrl(countryName: string): string {
    const encodedName = encodeURIComponent(countryName.replace(/ /g, '_'));
    return `${this.baseUrl}wiki/${encodedName}`;
  }

  /**
   * Fetch country template data from MediaWiki
   */
  async getCountryData(countryName: string): Promise<CountryTemplateData | null> {
    const cacheKey = countryName.toLowerCase();
    
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }

    try {
      // Fixed: Correct template path format for ixwiki.com
      const templatePageTitle = `Template:Country_data_${countryName}`;
      const url = new URL(`${this.baseUrl}api.php`);
      
      url.searchParams.set('action', 'query');
      url.searchParams.set('format', 'json');
      url.searchParams.set('titles', templatePageTitle);
      url.searchParams.set('prop', 'revisions');
      url.searchParams.set('rvprop', 'content');
      url.searchParams.set('rvslots', 'main');
      url.searchParams.set('origin', '*');

      const response = await fetch(url.toString());
      
      if (!response.ok) {
        console.warn(`[MediaWiki] Failed to fetch ${templatePageTitle}: ${response.status}`);
        return null;
      }

      const data: MediaWikiApiResponse = await response.json();
      
      if (!data.query?.pages) {
        return null;
      }

      const pages = Object.values(data.query.pages);
      const page = pages[0];
      
      if (!page || page.pageid === -1 || !page.revisions?.[0]) {
        console.warn(`[MediaWiki] Template not found: ${templatePageTitle}`);
        // Try alternative template naming patterns
        const alternatives = [
          `Template:Country data ${countryName}`, // With space
          `Template:Countrydata_${countryName}`,   // No underscore between Country and data
          `Template:Flag_${countryName}`,          // Direct flag template
        ];
        
        for (const altTemplate of alternatives) {
          const altResult = await this.tryAlternativeTemplate(altTemplate);
          if (altResult) {
            this.cache.set(cacheKey, altResult);
            return altResult;
          }
        }
        
        return null;
      }

      const wikitext = page.revisions[0]['*'];
      if (!wikitext) {
        console.warn(`[MediaWiki] Empty wikitext for ${templatePageTitle}`);
        return null;
      }
      
      const parsedData = this.parseCountryTemplate(wikitext);
      
      this.cache.set(cacheKey, parsedData);
      return parsedData;
    } catch (error) {
      console.error(`[MediaWiki] Error fetching country data for ${countryName}:`, error);
      return null;
    }
  }

  /**
   * Try alternative template patterns
   */
  private async tryAlternativeTemplate(templateTitle: string): Promise<CountryTemplateData | null> {
    try {
      const url = new URL(`${this.baseUrl}api.php`);
      
      url.searchParams.set('action', 'query');
      url.searchParams.set('format', 'json');
      url.searchParams.set('titles', templateTitle);
      url.searchParams.set('prop', 'revisions');
      url.searchParams.set('rvprop', 'content');
      url.searchParams.set('rvslots', 'main');
      url.searchParams.set('origin', '*');

      const response = await fetch(url.toString());
      
      if (!response.ok) {
        return null;
      }

      const data: MediaWikiApiResponse = await response.json();
      
      if (!data.query?.pages) {
        return null;
      }

      const pages = Object.values(data.query.pages);
      const page = pages[0];
      
      if (!page || page.pageid === -1 || !page.revisions?.[0]) {
        return null;
      }

      const wikitext = page.revisions[0]['*'];
      if (!wikitext) {
        return null;
      }
      
      return this.parseCountryTemplate(wikitext);
    } catch (error) {
      console.warn(`[MediaWiki] Failed to fetch alternative template ${templateTitle}:`, error);
      return null;
    }
  }

  /**
   * Resolve a file name to its full URL
   */
  private async resolveFileUrl(fileName: string): Promise<string | null> {
    try {
      const url = new URL(`${this.baseUrl}api.php`);
      
      url.searchParams.set('action', 'query');
      url.searchParams.set('format', 'json');
      url.searchParams.set('titles', `File:${fileName}`);
      url.searchParams.set('prop', 'imageinfo');
      url.searchParams.set('iiprop', 'url');
      url.searchParams.set('origin', '*');

      const response = await fetch(url.toString());
      
      if (!response.ok) {
        return null;
      }

      const data: MediaWikiApiResponse = await response.json();
      
      if (!data.query?.pages) {
        return null;
      }

      const pages = Object.values(data.query.pages);
      const page = pages[0];
      
      if (!page || page.pageid === -1) {
        return null;
      }

      const imageInfo = page.imageinfo;
      if (imageInfo && imageInfo[0]?.url) {
        return imageInfo[0].url;
      }

      return null;
    } catch (error) {
      console.error(`[MediaWiki] Error resolving file URL for ${fileName}:`, error);
      return null;
    }
  }

  /**
   * Parse MediaWiki template syntax to extract data
   */
  private parseCountryTemplate(wikitext: string): CountryTemplateData {
    const data: CountryTemplateData = {};
    
    if (!wikitext || typeof wikitext !== 'string') {
      return data;
    }
    
    // Remove comments and normalize whitespace
    const cleanText = wikitext
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    // Extract template parameters
    const paramRegex = /\|\s*([^=|]+)\s*=\s*([^|]*)/g;
    let match;
    
    while ((match = paramRegex.exec(cleanText)) !== null) {
      if (!match[1] || !match[2]) continue;
      
      const key = match[1].trim().toLowerCase();
      const value = match[2].trim();
      
      if (value && value.length > 0) {
        switch (key) {
          case 'flag':
          case 'flag_image':
          case 'flag-image':
          case 'flagimage':
            data.flag = value;
            break;
          case 'capital':
            data.capital = value;
            break;
          case 'continent':
            data.continent = value;
            break;
          case 'currency':
            data.currency = value;
            break;
          case 'government':
          case 'gov_type':
            data.government = value;
            break;
          case 'leader':
          case 'head_of_state':
            data.leader = value;
            break;
        }
      }
    }

    return data;
  }

  /**
   * Clear all caches
   */
  clearCache(): void {
    this.cache.clear();
    this.flagCache.clear();
    this.infoboxCache.clear();
    this.preloadPromises.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return {
      countryData: this.cache.size,
      flags: this.flagCache.size,
      infoboxes: this.infoboxCache.size,
      preloadedFlags: Array.from(this.flagCache.values()).filter(f => f.preloaded).length,
      failedFlags: Array.from(this.flagCache.values()).filter(f => f.error).length,
    };
  }
}

// Default instance for the Ixnay MediaWiki
const IXNAY_MEDIAWIKI_URL = process.env.NEXT_PUBLIC_MEDIAWIKI_URL ?? 'https://ixwiki.com/';

export const ixnayWiki = new MediaWikiService(IXNAY_MEDIAWIKI_URL);

export { MediaWikiService };
export type { CountryTemplateData, CountryInfobox };