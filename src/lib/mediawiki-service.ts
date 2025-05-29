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
  expandtemplates?: {
    wikitext?: string;
  };
  error?: {
    code: string;
    info: string;
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
   * Make API request with proper error handling and CORS
   */
  private async makeApiRequest(params: Record<string, string>, debug = false): Promise<MediaWikiApiResponse> {
    const url = new URL(`${this.baseUrl}api.php`);
    
    // Set default parameters
    url.searchParams.set('format', 'json');
    url.searchParams.set('origin', '*'); // Important for CORS
    
    // Add custom parameters
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.set(key, value);
    });

    if (debug) console.log(`[MediaWiki] API Request: ${url.toString()}`);

    try {
      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        mode: 'cors',
      });

      if (!response.ok) {
        console.error(`[MediaWiki] HTTP Error: ${response.status} ${response.statusText}`);
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data: MediaWikiApiResponse = await response.json();
      
      // Enhanced debugging - only log full response when debugging
      if (debug) {
        console.log(`[MediaWiki] API Response:`, JSON.stringify(data, null, 2));
      }
      
      if (data.error) {
        console.error(`[MediaWiki] API Error:`, data.error);
        throw new Error(`API Error: ${data.error.code} - ${data.error.info}`);
      }

      if (debug) console.log(`[MediaWiki] API Response received successfully`);
      return data;
    } catch (error) {
      console.error(`[MediaWiki] Request failed:`, error);
      throw error;
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
      console.log(`[MediaWiki] Fetching flag for: ${countryName}`);
      
      // First try to get flag from Template:Country data [CountryName]
      let flagUrl = await this.getFlagFromCountryDataTemplate(countryName);
      if (flagUrl) {
        this.flagCache.set(cacheKey, {
          url: flagUrl,
          preloaded: false,
          lastUpdated: Date.now(),
          error: false
        });
        return flagUrl;
      }

      // Fallback: Get flag info from the main country page itself
      console.log(`[MediaWiki] Template approach failed, trying main country page: ${countryName}`);
      flagUrl = await this.getFlagFromCountryPage(countryName);
      if (flagUrl) {
        this.flagCache.set(cacheKey, {
          url: flagUrl,
          preloaded: false,
          lastUpdated: Date.now(),
          error: false
        });
        return flagUrl;
      }

      // No flag found - cache the negative result
      console.warn(`[MediaWiki] No flag found for ${countryName}`);
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
   * Get flag from the main country page by looking for flag references
   */
  private async getFlagFromCountryPage(countryName: string): Promise<string | null> {
    try {
      console.log(`[MediaWiki] Looking for flag in main country page: ${countryName}`);
      
      const data = await this.makeApiRequest({
        action: 'query',
        titles: countryName,
        prop: 'revisions',
        rvprop: 'content',
        rvslots: 'main'
      });
      
      if (!data.query?.pages) {
        console.log(`[MediaWiki] No pages in response for main page: ${countryName}`);
        return null;
      }

      const pages = Object.values(data.query.pages);
      const page = pages[0];
      
      if (!page || page.pageid === -1 || !page.revisions?.[0]) {
        console.log(`[MediaWiki] Main page not found: ${countryName}`);
        return null;
      }

      const wikitext = page.revisions[0]['*'];
      if (!wikitext) {
        console.log(`[MediaWiki] Empty content for main page: ${countryName}`);
        return null;
      }

      console.log(`[MediaWiki] Main page content preview: ${wikitext.substring(0, 500)}...`);
      
      // Look for {{flag|CountryName}} in the page content
      const flagMatch = wikitext.match(/\{\{\s*flag\s*\|\s*([^}]*)\s*\}\}/i);
      if (flagMatch) {
        console.log(`[MediaWiki] Found {{flag|...}} in main page: ${flagMatch[0]}`);
        return await this.resolveFlagTemplate(countryName);
      }

      // Look for File: references that might be flags
      const fileMatches = wikitext.match(/\[\[\s*File:([^|\]]*flag[^|\]]*)/gi);
      if (fileMatches) {
        for (const match of fileMatches) {
          const fileNameMatch = match.match(/File:([^|\]]+)/i);
          if (fileNameMatch) {
            const fileName = fileNameMatch[1];
            console.log(`[MediaWiki] Found potential flag file in main page: ${fileName}`);
            const flagUrl = await this.resolveFileUrl(fileName);
            if (flagUrl) {
              return flagUrl;
            }
          }
        }
      }

      // Look in the infobox for flag parameter
      const infoboxMatch = wikitext.match(/\{\{\s*Infobox[^}]*flag\s*=\s*([^|\n}]+)/i);
      if (infoboxMatch) {
        const flagFile = infoboxMatch[1].trim();
        console.log(`[MediaWiki] Found flag in infobox: ${flagFile}`);
        return await this.resolveFileUrl(flagFile);
      }

      return null;
    } catch (error) {
      console.error(`[MediaWiki] Error getting flag from main country page:`, error);
      return null;
    }
  }

  /**
   * Get flag from Template:Country data [CountryName] by finding {{flag|CountryName}} usage
   */
  private async getFlagFromCountryDataTemplate(countryName: string): Promise<string | null> {
    try {
      console.log(`[MediaWiki] Looking for flag in Template:Country data ${countryName}`);
      
      // Try different template naming patterns
      const templatePatterns = [
        `Template:Country data ${countryName}`,
        `Template:Country_data_${countryName}`,
        `Template:Countrydata_${countryName}`,
        `Template:Flag_${countryName}`,
      ];

      for (const templateTitle of templatePatterns) {
        console.log(`[MediaWiki] Trying template: ${templateTitle}`);
        
        try {
          const data = await this.makeApiRequest({
            action: 'query',
            titles: templateTitle,
            prop: 'revisions',
            rvprop: 'content',
            rvslots: 'main'
          });
          
          if (!data.query?.pages) {
            console.log(`[MediaWiki] No pages in response for: ${templateTitle}`);
            continue;
          }

          const pages = Object.values(data.query.pages);
          const page = pages[0];
          
          if (!page || page.pageid === -1 || !page.revisions?.[0]) {
            console.log(`[MediaWiki] Template not found: ${templateTitle}`);
            continue;
          }

          const wikitext = page.revisions[0]['*'];
          if (!wikitext) {
            console.log(`[MediaWiki] Empty wikitext for ${templateTitle}`);
            continue;
          }

          console.log(`[MediaWiki] Template content: ${wikitext.substring(0, 300)}...`);
          
          // Look for {{flag|CountryName}} pattern and extract the flag image
          const flagMatch = wikitext.match(/\{\{\s*flag\s*\|\s*([^}]+)\s*\}\}/i);
          if (flagMatch) {
            console.log(`[MediaWiki] Found {{flag|...}} template: ${flagMatch[0]}`);
            
            // Now we need to resolve what the flag template actually produces
            return await this.resolveFlagTemplate(countryName);
          }

          // Look for direct flag file references
          const flagFileMatch = wikitext.match(/flag\s*=\s*([^|\n}]+)/i);
          if (flagFileMatch) {
            const flagFile = flagFileMatch[1].trim();
            console.log(`[MediaWiki] Found flag file reference: ${flagFile}`);
            return await this.resolveFileUrl(flagFile);
          }

          // Look for any file references that might be flags
          const fileMatch = wikitext.match(/\[\[File:([^|\]]*flag[^|\]]*)/i);
          if (fileMatch) {
            const flagFile = fileMatch[1];
            console.log(`[MediaWiki] Found file reference with 'flag' in name: ${flagFile}`);
            return await this.resolveFileUrl(flagFile);
          }
        } catch (error) {
          console.warn(`[MediaWiki] Error checking template ${templateTitle}:`, error);
          continue;
        }
      }

      return null;
    } catch (error) {
      console.error(`[MediaWiki] Error getting flag from country data template:`, error);
      return null;
    }
  }

  /**
   * Resolve {{flag|CountryName}} template to actual flag image URL
   */
  private async resolveFlagTemplate(countryName: string): Promise<string | null> {
    try {
      // Try common flag file naming patterns based on the country name
      const flagPatterns = [
        `Flag of ${countryName}.svg`,
        `Flag of ${countryName}.png`,
        `${countryName} flag.svg`,
        `${countryName} flag.png`,
        `Flag ${countryName}.svg`,
        `Flag ${countryName}.png`,
        `${countryName}flag.svg`,
        `${countryName}Flag.svg`,
        `${countryName}.svg`,  // Sometimes just the country name
        `${countryName}.png`,
      ];

      console.log(`[MediaWiki] Trying flag patterns for {{flag|${countryName}}}:`, flagPatterns);

      for (const pattern of flagPatterns) {
        const flagUrl = await this.resolveFileUrl(pattern);
        if (flagUrl) {
          console.log(`[MediaWiki] Flag resolved: {{flag|${countryName}}} -> ${pattern} -> ${flagUrl}`);
          return flagUrl;
        }
      }

      // Also try expanding the template directly via API
      try {
        const expandedData = await this.makeApiRequest({
          action: 'expandtemplates',
          text: `{{flag|${countryName}}}`,
          prop: 'wikitext'
        });

        if (expandedData.expandtemplates?.wikitext) {
          const expandedText = expandedData.expandtemplates.wikitext;
          console.log(`[MediaWiki] Expanded {{flag|${countryName}}} to: ${expandedText}`);
          
          // Look for file references in the expanded text
          const fileMatch = expandedText.match(/\[\[File:([^|\]]+)/i);
          if (fileMatch) {
            const fileName = fileMatch[1];
            console.log(`[MediaWiki] Found file in expanded template: ${fileName}`);
            return await this.resolveFileUrl(fileName);
          }
        }
      } catch (expandError) {
        console.warn(`[MediaWiki] Template expansion failed:`, expandError);
      }

      return null;
    } catch (error) {
      console.error(`[MediaWiki] Error resolving flag template:`, error);
      return null;
    }
  }

  /**
   * Get country infobox data from the main country page
   */
  async getCountryInfobox(countryName: string): Promise<CountryInfobox | null> {
    const cacheKey = countryName.toLowerCase();
    
    if (this.infoboxCache.has(cacheKey)) {
      return this.infoboxCache.get(cacheKey)!;
    }

    try {
      console.log(`[MediaWiki] Fetching infobox from main page: ${countryName}`);

      // Get the main country page content
      const data = await this.makeApiRequest({
        action: 'query',
        titles: countryName,
        prop: 'revisions',
        rvprop: 'content',
        rvslots: 'main'
      });
      
      if (!data.query?.pages) {
        console.warn(`[MediaWiki] No pages in response for: ${countryName}`);
        return null;
      }

      const pages = Object.values(data.query.pages);
      const page = pages[0];
      
      if (!page || page.pageid === -1 || !page.revisions?.[0]) {
        console.warn(`[MediaWiki] Page not found: ${countryName}`);
        return null;
      }

      const wikitext = page.revisions[0]['*'];
      
      if (!wikitext) {
        console.warn(`[MediaWiki] Empty content for: ${countryName}`);
        return null;
      }

      console.log(`[MediaWiki] Page content preview: ${wikitext.substring(0, 500)}...`);
      
      const infobox = this.parseCountryInfobox(wikitext, countryName);
      
      console.log(`[MediaWiki] Infobox parsed for ${countryName}:`, Object.keys(infobox));
      
      this.infoboxCache.set(cacheKey, infobox);
      return infobox;
    } catch (error) {
      console.error(`[MediaWiki] Error fetching infobox for ${countryName}:`, error);
      return null;
    }
  }

  /**
   * Parse country infobox from wikitext (usually at the beginning of the page)
   */
  private parseCountryInfobox(wikitext: string, countryName: string): CountryInfobox {
    const infobox: CountryInfobox = { name: countryName };
    
    // Ensure wikitext is defined and is a string
    if (!wikitext || typeof wikitext !== 'string') {
      console.warn(`[MediaWiki] Invalid wikitext for ${countryName}`);
      return infobox;
    }
    
    console.log(`[MediaWiki] Looking for infobox in: ${wikitext.substring(0, 1000)}...`);
    
    // Find the Infobox country template (case insensitive, flexible spacing)
    // The infobox is usually at the beginning of the page
    const infoboxPatterns = [
      /\{\{\s*Infobox\s+country\s*\|([\s\S]*?)\n\}\}/i,
      /\{\{\s*Infobox\s+nation\s*\|([\s\S]*?)\n\}\}/i,
      /\{\{\s*Country\s+infobox\s*\|([\s\S]*?)\n\}\}/i,
      /\{\{\s*Infobox\s*\|([\s\S]*?)\n\}\}/i
    ];
    
    let infoboxMatch = null;
    let matchedPattern = '';
    
    for (const pattern of infoboxPatterns) {
      infoboxMatch = wikitext.match(pattern);
      if (infoboxMatch && infoboxMatch[1]) {
        matchedPattern = pattern.toString();
        console.log(`[MediaWiki] Found infobox with pattern: ${matchedPattern}`);
        break;
      }
    }
    
    if (!infoboxMatch || !infoboxMatch[1]) {
      console.warn(`[MediaWiki] No infobox found for ${countryName}`);
      return infobox;
    }

    console.log(`[MediaWiki] Infobox content: ${infoboxMatch[1].substring(0, 500)}...`);
    
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
   * Fetch country template data from MediaWiki (simplified - mainly for debugging)
   */
  async getCountryData(countryName: string): Promise<CountryTemplateData | null> {
    const cacheKey = countryName.toLowerCase();
    
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }

    try {
      console.log(`[MediaWiki] Fetching country data template for: ${countryName}`);

      // Try the main Template:Country data pattern
      const templateTitle = `Template:Country data ${countryName}`;
      
      const data = await this.makeApiRequest({
        action: 'query',
        titles: templateTitle,
        prop: 'revisions',
        rvprop: 'content',
        rvslots: 'main'
      });
      
      if (!data.query?.pages) {
        console.log(`[MediaWiki] No pages in response for: ${templateTitle}`);
        return null;
      }

      const pages = Object.values(data.query.pages);
      const page = pages[0];
      
      if (!page || page.pageid === -1 || !page.revisions?.[0]) {
        console.log(`[MediaWiki] Template not found: ${templateTitle}`);
        return null;
      }

      const wikitext = page.revisions[0]['*'];
      if (!wikitext) {
        console.log(`[MediaWiki] Empty wikitext for ${templateTitle}`);
        return null;
      }
      
      console.log(`[MediaWiki] Found template: ${templateTitle}`);
      const parsedData = this.parseCountryTemplate(wikitext);
      
      this.cache.set(cacheKey, parsedData);
      return parsedData;
    } catch (error) {
      console.error(`[MediaWiki] Error fetching country data for ${countryName}:`, error);
      return null;
    }
  }

  /**
   * Resolve a file name to its full URL
   */
  private async resolveFileUrl(fileName: string): Promise<string | null> {
    try {
      console.log(`[MediaWiki] Resolving file URL for: ${fileName}`);

      const data = await this.makeApiRequest({
        action: 'query',
        titles: `File:${fileName}`,
        prop: 'imageinfo',
        iiprop: 'url'
      });
      
      if (!data.query?.pages) {
        console.log(`[MediaWiki] No pages found for file: ${fileName}`);
        return null;
      }

      const pages = Object.values(data.query.pages);
      const page = pages[0];
      
      if (!page || page.pageid === -1) {
        console.log(`[MediaWiki] File not found: ${fileName}`);
        return null;
      }

      const imageInfo = page.imageinfo;
      if (imageInfo && imageInfo[0]?.url) {
        console.log(`[MediaWiki] File resolved: ${fileName} -> ${imageInfo[0].url}`);
        return imageInfo[0].url;
      }

      console.log(`[MediaWiki] No imageinfo for file: ${fileName}`);
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
    
    console.log(`[MediaWiki] Parsing template wikitext: ${wikitext.substring(0, 200)}...`);
    
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
        console.log(`[MediaWiki] Template param: ${key} = ${value}`);
        
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

    console.log(`[MediaWiki] Parsed country data:`, data);
    return data;
  }

  /**
   * Test method to check if we can access any templates at all
   */
  async testTemplateAccess(): Promise<void> {
    console.log(`[MediaWiki] Testing template access...`);
    
    // Try some commonly existing templates
    const testTemplates = [
      'Template:Flag',
      'Template:Flagicon', 
      'Template:Main',
      'Template:See also',
      'Template:Infobox',
      'Template:Cite web'
    ];

    for (const template of testTemplates) {
      try {
        console.log(`[MediaWiki] Testing template: ${template}`);
        
        const data = await this.makeApiRequest({
          action: 'query',
          titles: template,
          prop: 'revisions',
          rvprop: 'content',
          rvslots: 'main'
        }, true); // Enable debug logging for tests
        
        if (data.query?.pages) {
          const pages = Object.values(data.query.pages);
          const page = pages[0];
          
          if (page && page.pageid !== -1) {
            console.log(`[MediaWiki] ✓ Template exists: ${template} (ID: ${page.pageid})`);
            if (page.revisions?.[0]) {
              const content = page.revisions[0]['*'];
              console.log(`[MediaWiki] Template content length: ${content ? content.length : 0}`);
              if (content) {
                console.log(`[MediaWiki] Template preview: ${content.substring(0, 200)}...`);
                return; // Found a working template, exit test
              }
            }
          } else {
            console.log(`[MediaWiki] ✗ Template not found: ${template}`);
          }
        }
      } catch (error) {
        console.log(`[MediaWiki] ✗ Error testing template ${template}:`, error);
      }
    }
    
    console.log(`[MediaWiki] Template access test completed - no working templates found`);
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

// Make test method available globally for debugging
if (typeof window !== 'undefined') {
  (window as any).testMediaWiki = async () => {
    console.log('Testing MediaWiki API access...');
    await ixnayWiki.testTemplateAccess();
    
    // Also test a specific country page
    console.log('Testing country page access...');
    try {
      const infobox = await ixnayWiki.getCountryInfobox('Tierrador');
      console.log('Tierrador infobox result:', infobox);
    } catch (error) {
      console.error('Error testing Tierrador page:', error);
    }
  };
}

export { MediaWikiService };
export type { CountryTemplateData, CountryInfobox };