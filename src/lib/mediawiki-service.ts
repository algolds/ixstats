// src/lib/mediawiki-service.ts
// Enhanced service for fetching country data from MediaWiki API

import { env } from "~/env";

interface CountryTemplateData {
  flag?: string;
  capital?: string;
  continent?: string;
  currency?: string;
  government?: string;
  leader?: string;
}

interface CountryInfoboxData {
  name?: string;
  flag?: string;
  coat_of_arms?: string;
  capital?: string;
  largest_city?: string;
  official_languages?: string;
  government?: string;
  leader_title1?: string;
  leader_name1?: string;
  leader_title2?: string;
  leader_name2?: string;
  area_total?: string;
  area_land?: string;
  area_water?: string;
  population_estimate?: string;
  population_census?: string;
  population_density?: string;
  gdp_nominal?: string;
  gdp_nominal_per_capita?: string;
  currency?: string;
  time_zone?: string;
  calling_code?: string;
  iso_code?: string;
  internet_tld?: string;
  established?: string;
  independence?: string;
  [key: string]: string | undefined;
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
          url: string;
          width: number;
          height: number;
        }>;
      };
    };
  };
}

class MediaWikiService {
  private baseUrl: string;
  private cache = new Map<string, CountryTemplateData>();
  private flagCache = new Map<string, string>();
  private infoboxCache = new Map<string, CountryInfoboxData>();
  private wikiUrlCache = new Map<string, string>();
  
  // Pre-cache popular flags on service initialization
  private preloadedFlags = new Set<string>();

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  }

  /**
   * Fetch country infobox data from MediaWiki
   */
  async getCountryInfobox(countryName: string): Promise<CountryInfoboxData | null> {
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
      const infoboxData = this.parseCountryInfobox(wikitext);
      
      if (infoboxData) {
        this.infoboxCache.set(cacheKey, infoboxData);
      }
      
      return infoboxData;
    } catch (error) {
      console.error(`[MediaWiki] Error fetching infobox for ${countryName}:`, error);
      return null;
    }
  }

  /**
   * Get the wiki URL for a country
   */
  getWikiUrl(countryName: string): string {
    const cacheKey = countryName.toLowerCase();
    
    if (this.wikiUrlCache.has(cacheKey)) {
      return this.wikiUrlCache.get(cacheKey)!;
    }

    const encodedName = encodeURIComponent(countryName.replace(/ /g, '_'));
    const wikiUrl = `${this.baseUrl}index.php/${encodedName}`;
    
    this.wikiUrlCache.set(cacheKey, wikiUrl);
    return wikiUrl;
  }

  /**
   * Parse MediaWiki infobox syntax to extract country data
   */
  private parseCountryInfobox(wikitext: string): CountryInfoboxData | null {
    // Find the infobox country template (case insensitive)
    const infoboxRegex = /\{\{\s*[Ii]nfobox\s+[Cc]ountry\s*([\s\S]*?)\n\}\}/;
    const match = infoboxRegex.exec(wikitext);
    
    if (!match) {
      console.warn('[MediaWiki] No Infobox country found in wikitext');
      return null;
    }

    const infoboxText = match[1];
    if (!infoboxText) return null;

    const data: CountryInfoboxData = {};
    
    // Split by parameters, handling nested templates and links
    const lines = infoboxText.split('\n').map(line => line.trim()).filter(line => line);
    
    for (const line of lines) {
      if (!line.startsWith('|')) continue;
      
      const equalIndex = line.indexOf('=');
      if (equalIndex === -1) continue;
      
      const key = line.slice(1, equalIndex).trim().toLowerCase();
      let value = line.slice(equalIndex + 1).trim();
      
      // Clean up the value
      value = this.cleanInfoboxValue(value);
      
      if (value) {
        data[key] = value;
      }
    }

    return Object.keys(data).length > 0 ? data : null;
  }

  /**
   * Clean up infobox values by removing wiki markup
   */
  private cleanInfoboxValue(value: string): string {
    return value
      // Remove ref tags
      .replace(/<ref[^>]*>[\s\S]*?<\/ref>/gi, '')
      .replace(/<ref[^>]*\/>/gi, '')
      // Remove comments
      .replace(/<!--[\s\S]*?-->/g, '')
      // Convert wiki links [[link|text]] to text, [[link]] to link
      .replace(/\[\[([^|\]]+)\|([^\]]+)\]\]/g, '$2')
      .replace(/\[\[([^\]]+)\]\]/g, '$1')
      // Remove external links
      .replace(/\[http[^\s\]]+ ([^\]]+)\]/g, '$1')
      // Remove templates (basic cleanup)
      .replace(/\{\{[^}]+\}\}/g, '')
      // Remove bold/italic markup
      .replace(/'{2,5}/g, '')
      // Clean up extra spaces
      .replace(/\s+/g, ' ')
      .trim();
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
      const templatePageTitle = `Template:Country data/${countryName}`;
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
        return null;
      }

      const wikitext = page.revisions[0]['*'];
      const parsedData = this.parseCountryTemplate(wikitext);
      
      this.cache.set(cacheKey, parsedData);
      return parsedData;
    } catch (error) {
      console.error(`[MediaWiki] Error fetching country data for ${countryName}:`, error);
      return null;
    }
  }

  /**
   * Get flag icon URL for a country with better caching
   */
  async getFlagUrl(countryName: string): Promise<string | null> {
    const cacheKey = countryName.toLowerCase();
    
    if (this.flagCache.has(cacheKey)) {
      return this.flagCache.get(cacheKey)!;
    }

    try {
      // Try to get flag from infobox first
      const infobox = await this.getCountryInfobox(countryName);
      if (infobox?.flag) {
        const flagUrl = await this.resolveFileUrl(infobox.flag);
        if (flagUrl) {
          this.flagCache.set(cacheKey, flagUrl);
          return flagUrl;
        }
      }

      // Then try country data template
      const countryData = await this.getCountryData(countryName);
      if (countryData?.flag) {
        const flagUrl = await this.resolveFileUrl(countryData.flag);
        if (flagUrl) {
          this.flagCache.set(cacheKey, flagUrl);
          return flagUrl;
        }
      }

      // Fallback: try common flag file naming patterns
      const flagPatterns = [
        `Flag of ${countryName}.png`,
        `Flag of ${countryName}.svg`,
        `${countryName} flag.png`,
        `${countryName} flag.svg`,
        `Flag ${countryName}.png`,
        `Flag ${countryName}.svg`,
        `${countryName}.png`,
        `${countryName}.svg`
      ];

      for (const pattern of flagPatterns) {
        const flagUrl = await this.resolveFileUrl(pattern);
        if (flagUrl) {
          this.flagCache.set(cacheKey, flagUrl);
          return flagUrl;
        }
      }

      // Cache null result to avoid repeated failed requests
      this.flagCache.set(cacheKey, '');
      return null;
    } catch (error) {
      console.error(`[MediaWiki] Error fetching flag for ${countryName}:`, error);
      this.flagCache.set(cacheKey, '');
      return null;
    }
  }

  /**
   * Resolve a file name to its full URL
   */
  private async resolveFileUrl(fileName: string): Promise<string | null> {
    try {
      // Clean up the filename
      const cleanFileName = fileName.replace(/^File:/, '').trim();
      
      const url = new URL(`${this.baseUrl}api.php`);
      
      url.searchParams.set('action', 'query');
      url.searchParams.set('format', 'json');
      url.searchParams.set('titles', `File:${cleanFileName}`);
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
    
    // Remove comments and normalize whitespace
    const cleanText = wikitext
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    // Extract template parameters
    const paramRegex = /\|\s*([^=|]+)\s*=\s*([^|]*)/g;
    let match;
    
    while ((match = paramRegex.exec(cleanText)) !== null) {
      const key = match[1]!.trim().toLowerCase();
      const value = match[2]!.trim();
      
      switch (key) {
        case 'flag':
        case 'flag_image':
        case 'flag-image':
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

    return data;
  }

  /**
   * Preload flags for multiple countries (bulk caching)
   */
  async preloadFlags(countryNames: string[]): Promise<void> {
    // Filter out already loaded flags
    const toLoad = countryNames.filter(name => 
      !this.preloadedFlags.has(name.toLowerCase()) && 
      !this.flagCache.has(name.toLowerCase())
    );
    
    if (toLoad.length === 0) return;

    console.log(`[MediaWiki] Preloading flags for ${toLoad.length} countries...`);
    
    // Load flags in batches to avoid overwhelming the server
    const batchSize = 5;
    for (let i = 0; i < toLoad.length; i += batchSize) {
      const batch = toLoad.slice(i, i + batchSize);
      
      const promises = batch.map(async (name) => {
        try {
          await this.getFlagUrl(name);
          this.preloadedFlags.add(name.toLowerCase());
        } catch (error) {
          console.warn(`[MediaWiki] Failed to preload flag for ${name}`);
        }
      });
      
      await Promise.allSettled(promises);
      
      // Small delay between batches
      if (i + batchSize < toLoad.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    console.log(`[MediaWiki] Preloading complete`);
  }

  /**
   * Clear cache (useful for development)
   */
  clearCache(): void {
    this.cache.clear();
    this.flagCache.clear();
    this.infoboxCache.clear();
    this.wikiUrlCache.clear();
    this.preloadedFlags.clear();
  }

  /**
   * Preload data for multiple countries
   */
  async preloadCountries(countryNames: string[]): Promise<void> {
    console.log(`[MediaWiki] Preloading data for ${countryNames.length} countries...`);
    
    // First preload flags (most important for UI)
    await this.preloadFlags(countryNames);
    
    // Then preload other data in background
    const promises = countryNames.map(name => 
      Promise.allSettled([
        this.getCountryData(name),
        this.getCountryInfobox(name)
      ])
    );
    
    await Promise.all(promises);
    console.log(`[MediaWiki] Full preloading complete`);
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return {
      flags: this.flagCache.size,
      templates: this.cache.size,
      infoboxes: this.infoboxCache.size,
      wikiUrls: this.wikiUrlCache.size,
      preloadedFlags: this.preloadedFlags.size
    };
  }
}

// Default instance for the Ixnay MediaWiki
const IXNAY_MEDIAWIKI_URL = process.env.NEXT_PUBLIC_MEDIAWIKI_URL ?? '';

export const ixnayWiki = new MediaWikiService(IXNAY_MEDIAWIKI_URL);

export { MediaWikiService };
export type { CountryTemplateData, CountryInfoboxData };