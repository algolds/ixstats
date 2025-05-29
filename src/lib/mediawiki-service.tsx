// src/lib/mediawiki-service.tsx
import { env } from "~/env";

// Interfaces
interface MediaWikiApiResponse {
  parse?: {
    title: string;
    pageid: number;
    wikitext?: { '*': string };
    text?: { '*': string };
  };
  query?: {
    pages?: {
      [key: string]: {
        pageid: number;
        title: string;
        missing?: boolean;
        revisions?: Array<{
          slots?: {
            main?: {
              '*': string;
              contentmodel: string;
              contentformat: string;
            };
          };
          '*'?: string; // Legacy format
        }>;
        imageinfo?: Array<{
          url: string;
          descriptionurl?: string;
          thumburl?: string;
        }>;
      };
    };
  };
  error?: {
    code: string;
    info: string;
  };
}

export interface CountryInfobox {
  name: string;
  conventional_long_name?: string;
  native_name?: string;
  image_flag?: string;
  image_coat?: string;
  capital?: string;
  largest_city?: string;
  official_languages?: string;
  national_languages?: string;
  regional_languages?: string;
  ethnic_groups?: string;
  religion?: string;
  demonym?: string;
  government_type?: string;
  leader_title1?: string;
  leader_name1?: string;
  leader_title2?: string;
  leader_name2?: string;
  legislature?: string;
  area_km2?: string;
  population_estimate?: string;
  population_census?: string;
  population_density_km2?: string;
  GDP_PPP?: string;
  GDP_PPP_per_capita?: string;
  GDP_nominal?: string;
  GDP_nominal_per_capita?: string;
  Gini?: string;
  HDI?: string;
  currency?: string;
  currency_code?: string;
  time_zone?: string;
  drives_on?: string;
  cctld?: string;
  calling_code?: string;
  [key: string]: string | undefined;
}

interface FlagCacheEntry {
  url: string | null;
  lastUpdated: number;
  error?: boolean;
}

class MediaWikiService {
  private baseUrl: string;
  private flagCache = new Map<string, FlagCacheEntry>();
  private infoboxCache = new Map<string, CountryInfobox | null>();
  private readonly CACHE_EXPIRY = 24 * 60 * 60 * 1000; // 24 hours

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  }

  // Public method to get country wiki URL
  getCountryWikiUrl(countryName: string): string {
    const pageName = countryName.replace(/ /g, '_');
    return `${this.baseUrl}wiki/${encodeURIComponent(pageName)}`;
  }

  private async makeApiRequest(params: Record<string, string>): Promise<MediaWikiApiResponse> {
    const url = new URL(`${this.baseUrl}api.php`);
    
    // Add default parameters
    url.searchParams.set('format', 'json');
    url.searchParams.set('origin', '*'); // Enable CORS
    
    // Add custom parameters
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.set(key, value);
    });

    try {
      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'IxStats/1.0 (https://ixnay.com/; contact@ixnay.com)'
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json() as MediaWikiApiResponse;
      
      if (data.error) {
        throw new Error(`MediaWiki API Error: ${data.error.code} - ${data.error.info}`);
      }

      return data;
    } catch (error) {
      console.error('[MediaWiki] API request failed:', error);
      throw error;
    }
  }

  async getFlagUrl(countryName: string): Promise<string | null> {
    const cacheKey = countryName.toLowerCase();
    const cached = this.flagCache.get(cacheKey);
    
    if (cached && (Date.now() - cached.lastUpdated < this.CACHE_EXPIRY)) {
      return cached.url;
    }

    try {
      // Method 1: Try to get flag from the country page infobox
      const flagFromInfobox = await this.getFlagFromInfobox(countryName);
      if (flagFromInfobox) {
        this.flagCache.set(cacheKey, { url: flagFromInfobox, lastUpdated: Date.now() });
        return flagFromInfobox;
      }

      // Method 2: Try common flag file naming patterns
      const commonPatterns = [
        `Flag_of_${countryName.replace(/ /g, '_')}.svg`,
        `Flag_of_${countryName.replace(/ /g, '_')}.png`,
        `${countryName.replace(/ /g, '_')}_flag.svg`,
        `${countryName.replace(/ /g, '_')}_flag.png`,
        `Flag_${countryName.replace(/ /g, '_')}.svg`,
        `Flag_${countryName.replace(/ /g, '_')}.png`,
      ];

      for (const pattern of commonPatterns) {
        const url = await this.getFileUrl(pattern);
        if (url) {
          this.flagCache.set(cacheKey, { url, lastUpdated: Date.now() });
          return url;
        }
      }

      // Method 3: Try Template:Country data
      const flagFromTemplate = await this.getFlagFromCountryDataTemplate(countryName);
      if (flagFromTemplate) {
        this.flagCache.set(cacheKey, { url: flagFromTemplate, lastUpdated: Date.now() });
        return flagFromTemplate;
      }

      // No flag found
      this.flagCache.set(cacheKey, { url: null, lastUpdated: Date.now(), error: true });
      return null;
    } catch (error) {
      console.error(`[MediaWiki] Error getting flag for ${countryName}:`, error);
      this.flagCache.set(cacheKey, { url: null, lastUpdated: Date.now(), error: true });
      return null;
    }
  }

  private async getFlagFromInfobox(countryName: string): Promise<string | null> {
    try {
      const data = await this.makeApiRequest({
        action: 'query',
        titles: countryName,
        prop: 'revisions',
        rvprop: 'content',
        rvslots: 'main',
        formatversion: '2'
      });

      const page = data.query?.pages?.[0];
      if (!page || page.missing) return null;

      const content = page.revisions?.[0]?.slots?.main?.['*'] || page.revisions?.[0]?.['*'];
      if (!content) return null;

      // Look for image_flag parameter in infobox
      const flagMatch = content.match(/\|\s*image_flag\s*=\s*([^\|\n]+)/i);
      if (flagMatch?.[1]) {
        const flagFile = flagMatch[1].trim();
        if (flagFile && !flagFile.includes('{{')) {
          return await this.getFileUrl(flagFile);
        }
      }

      return null;
    } catch (error) {
      console.error('[MediaWiki] Error getting flag from infobox:', error);
      return null;
    }
  }

  private async getFlagFromCountryDataTemplate(countryName: string): Promise<string | null> {
    try {
      const templateName = `Template:Country_data_${countryName.replace(/ /g, '_')}`;
      const data = await this.makeApiRequest({
        action: 'query',
        titles: templateName,
        prop: 'revisions',
        rvprop: 'content',
        rvslots: 'main',
        formatversion: '2'
      });

      const page = data.query?.pages?.[0];
      if (!page || page.missing) return null;

      const content = page.revisions?.[0]?.slots?.main?.['*'] || page.revisions?.[0]?.['*'];
      if (!content) return null;

      // Look for flag alias or flag parameters
      const flagMatch = content.match(/\|\s*(?:flag alias|flag|image)\s*=\s*([^\|\n]+)/i);
      if (flagMatch?.[1]) {
        const flagFile = flagMatch[1].trim();
        return await this.getFileUrl(flagFile);
      }

      return null;
    } catch (error) {
      console.error('[MediaWiki] Error getting flag from template:', error);
      return null;
    }
  }

  private async getFileUrl(fileName: string): Promise<string | null> {
    if (!fileName) return null;
    
    // Clean the filename
    let cleanFileName = fileName.replace(/^File:/i, '').trim();
    if (!cleanFileName) return null;

    try {
      const data = await this.makeApiRequest({
        action: 'query',
        titles: `File:${cleanFileName}`,
        prop: 'imageinfo',
        iiprop: 'url',
        formatversion: '2'
      });

      const page = data.query?.pages?.[0];
      if (!page || page.missing) return null;

      return page.imageinfo?.[0]?.url || null;
    } catch (error) {
      return null;
    }
  }

  async getCountryInfobox(countryName: string): Promise<CountryInfobox | null> {
    const cacheKey = countryName.toLowerCase();
    
    if (this.infoboxCache.has(cacheKey)) {
      return this.infoboxCache.get(cacheKey) || null;
    }

    try {
      const data = await this.makeApiRequest({
        action: 'query',
        titles: countryName,
        prop: 'revisions',
        rvprop: 'content',
        rvslots: 'main',
        formatversion: '2'
      });

      const page = data.query?.pages?.[0];
      if (!page || page.missing) {
        this.infoboxCache.set(cacheKey, null);
        return null;
      }

      const content = page.revisions?.[0]?.slots?.main?.['*'] || page.revisions?.[0]?.['*'];
      if (!content) {
        this.infoboxCache.set(cacheKey, null);
        return null;
      }

      const infobox = this.parseInfobox(content, countryName);
      this.infoboxCache.set(cacheKey, infobox);
      return infobox;
    } catch (error) {
      console.error(`[MediaWiki] Error getting infobox for ${countryName}:`, error);
      this.infoboxCache.set(cacheKey, null);
      return null;
    }
  }

  private parseInfobox(wikitext: string, countryName: string): CountryInfobox {
    const infobox: CountryInfobox = { name: countryName };

    // Find the infobox country template
    const infoboxMatch = wikitext.match(/\{\{\s*Infobox country([^}]|\}(?!\}))*\}\}/i);
    if (!infoboxMatch) return infobox;

    const infoboxContent = infoboxMatch[0];
    
    // Parse parameters
    const paramRegex = /\|\s*([^=\s]+)\s*=\s*([^\|]*?)(?=\s*\||\s*\}\})/g;
    let match;

    while ((match = paramRegex.exec(infoboxContent)) !== null) {
      const key = match[1].trim();
      let value = match[2].trim();

      // Clean up the value
      value = value
        // Remove wiki links but keep the display text
        .replace(/\[\[(?:[^\|]*\|)?([^\]]+)\]\]/g, '$1')
        // Remove templates
        .replace(/\{\{[^}]+\}\}/g, '')
        // Remove references
        .replace(/<ref[^>]*>.*?<\/ref>/g, '')
        // Remove HTML tags
        .replace(/<[^>]+>/g, '')
        // Clean up whitespace
        .replace(/\s+/g, ' ')
        .trim();

      if (value) {
        // Store with normalized key
        const normalizedKey = key.toLowerCase().replace(/\s+/g, '_');
        infobox[normalizedKey] = value;
        
        // Also store with original key for compatibility
        infobox[key] = value;
      }
    }

    return infobox;
  }

  async preloadCountryFlags(countryNames: string[]): Promise<void> {
    const promises = countryNames.map(name => 
      this.getFlagUrl(name).catch(error => {
        console.warn(`[MediaWiki] Failed to preload flag for ${name}:`, error);
        return null;
      })
    );

    await Promise.all(promises);
  }

  clearCache(): void {
    this.flagCache.clear();
    this.infoboxCache.clear();
  }

  getCacheStats() {
    const flagStats = {
      total: this.flagCache.size,
      successful: Array.from(this.flagCache.values()).filter(entry => entry.url !== null).length,
      failed: Array.from(this.flagCache.values()).filter(entry => entry.error).length,
    };

    return {
      flags: flagStats,
      infoboxes: this.infoboxCache.size,
      cacheEfficiency: flagStats.total > 0 
        ? Math.round((flagStats.successful / flagStats.total) * 100) 
        : 0
    };
  }
}

// Create and export the service instance
const IXNAY_MEDIAWIKI_URL = env.NEXT_PUBLIC_MEDIAWIKI_URL || 'https://ixwiki.com';
export const ixnayWiki = new MediaWikiService(IXNAY_MEDIAWIKI_URL);

// Export types
export type { MediaWikiApiResponse };