// src/lib/mediawiki-service.ts
// Service for fetching country data from MediaWiki API

import { env } from "~/env";

interface CountryTemplateData {
  flag?: string;
  capital?: string;
  continent?: string;
  currency?: string;
  government?: string;
  leader?: string;
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
      };
    };
  };
}

class MediaWikiService {
  private baseUrl: string;
  private cache = new Map<string, CountryTemplateData>();
  private flagCache = new Map<string, string>();

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
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
      url.searchParams.set('origin', '*'); // CORS header

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
   * Get flag icon URL for a country
   */
  async getFlagUrl(countryName: string): Promise<string | null> {
    const cacheKey = countryName.toLowerCase();
    
    if (this.flagCache.has(cacheKey)) {
      return this.flagCache.get(cacheKey)!;
    }

    try {
      // First try to get country data which might have flag info
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
        `Flag ${countryName}.svg`
      ];

      for (const pattern of flagPatterns) {
        const flagUrl = await this.resolveFileUrl(pattern);
        if (flagUrl) {
          this.flagCache.set(cacheKey, flagUrl);
          return flagUrl;
        }
      }

      return null;
    } catch (error) {
      console.error(`[MediaWiki] Error fetching flag for ${countryName}:`, error);
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

      // TypeScript doesn't know about imageinfo, so we'll cast
      const imageInfo = (page as any).imageinfo;
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
   * Clear cache (useful for development)
   */
  clearCache(): void {
    this.cache.clear();
    this.flagCache.clear();
  }

  /**
   * Preload data for multiple countries
   */
  async preloadCountries(countryNames: string[]): Promise<void> {
    const promises = countryNames.map(name => 
      Promise.allSettled([
        this.getCountryData(name),
        this.getFlagUrl(name)
      ])
    );
    
    await Promise.all(promises);
  }
}

// Default instance for the Ixnay MediaWiki
const IXNAY_MEDIAWIKI_URL = env.NEXT_PUBLIC_MEDIAWIKI_URL;

export const ixnayWiki = new MediaWikiService(IXNAY_MEDIAWIKI_URL);

export { MediaWikiService };
export type { CountryTemplateData };