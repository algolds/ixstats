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
    pages?: Array<{
      pageid?: number;
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
    }>;
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
  // Additional common fields
  continent?: string;
  area?: string;
  population?: string;
  government?: string;
  leader?: string;
  gdp?: string;
  languages?: string;
  timezone?: string;
  callingCode?: string;
  internetTld?: string;
  drivingSide?: string;
  [key: string]: string | undefined;
}

interface FlagCacheEntry {
  url: string | null;
  lastUpdated: number;
  error?: boolean;
}

interface CacheStats {
  flags: number;
  preloadedFlags: number;
  failedFlags: number;
  infoboxes: number;
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
    url.searchParams.set('formatversion', '2');
    url.searchParams.set('origin', '*'); // Enable CORS
    
    // Add custom parameters
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.set(key, value);
    });

    console.log(`[MediaWiki] Making request to: ${url.toString()}`);

    try {
      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'IxStats/1.0 (https://ixnay.com/; contact@ixnay.com)',
          'Access-Control-Allow-Origin': '*',
        },
        mode: 'cors',
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
      console.log(`[MediaWiki] Getting flag for: ${countryName}`);

      // Method 1: Try Template:Country_data_[Country_name] (PRIMARY METHOD)
      const flagFromTemplate = await this.getFlagFromCountryDataTemplate(countryName);
      if (flagFromTemplate) {
        console.log(`[MediaWiki] Found flag from template: ${flagFromTemplate}`);
        this.flagCache.set(cacheKey, { url: flagFromTemplate, lastUpdated: Date.now() });
        return flagFromTemplate;
      }

      // Method 2: Try to get flag from the country page infobox
      const flagFromInfobox = await this.getFlagFromInfobox(countryName);
      if (flagFromInfobox) {
        console.log(`[MediaWiki] Found flag from infobox: ${flagFromInfobox}`);
        this.flagCache.set(cacheKey, { url: flagFromInfobox, lastUpdated: Date.now() });
        return flagFromInfobox;
      }

      // Method 3: Try common flag file naming patterns
      const commonPatterns = [
        `Flag3 ${countryName.toLowerCase()}.png`, // Based on your example
        `Flag_of_${countryName.replace(/ /g, '_')}.svg`,
        `Flag_of_${countryName.replace(/ /g, '_')}.png`,
        `${countryName.replace(/ /g, '_')}_flag.svg`,
        `${countryName.replace(/ /g, '_')}_flag.png`,
        `Flag_${countryName.replace(/ /g, '_')}.svg`,
        `Flag_${countryName.replace(/ /g, '_')}.png`,
      ];

      for (const pattern of commonPatterns) {
        console.log(`[MediaWiki] Trying pattern: ${pattern}`);
        const url = await this.getFileUrl(pattern);
        if (url) {
          console.log(`[MediaWiki] Found flag with pattern: ${pattern} -> ${url}`);
          this.flagCache.set(cacheKey, { url, lastUpdated: Date.now() });
          return url;
        }
      }

      // No flag found
      console.warn(`[MediaWiki] No flag found for: ${countryName}`);
      this.flagCache.set(cacheKey, { url: null, lastUpdated: Date.now(), error: true });
      return null;
    } catch (error) {
      console.error(`[MediaWiki] Error getting flag for ${countryName}:`, error);
      this.flagCache.set(cacheKey, { url: null, lastUpdated: Date.now(), error: true });
      return null;
    }
  }

  private async getFlagFromCountryDataTemplate(countryName: string): Promise<string | null> {
    try {
      const templateName = `Template:Country_data_${countryName.replace(/ /g, '_')}`;
      console.log(`[MediaWiki] Fetching template: ${templateName}`);
      
      const data = await this.makeApiRequest({
        action: 'query',
        titles: templateName,
        prop: 'revisions',
        rvprop: 'content',
        rvslots: 'main'
      });

      console.log(`[MediaWiki] Template response:`, JSON.stringify(data, null, 2));

      const pages = data.query?.pages;
      if (!pages || pages.length === 0) {
        console.log(`[MediaWiki] No pages returned for template: ${templateName}`);
        return null;
      }

      const page = pages[0];
      if (!page || page.missing) {
        console.log(`[MediaWiki] Template page missing: ${templateName}`);
        return null;
      }

      const content = page.revisions?.[0]?.slots?.main?.['*'] || page.revisions?.[0]?.['*'];
      if (!content) {
        console.log(`[MediaWiki] No content in template: ${templateName}`);
        return null;
      }

      console.log(`[MediaWiki] Template content:`, content);

      // Look for flag alias parameter - more flexible regex
      const flagAliasMatch = content.match(/\|\s*flag\s*alias\s*=\s*([^\n\|]+)/i);
      if (flagAliasMatch?.[1]) {
        const flagFile = flagAliasMatch[1].trim();
        console.log(`[MediaWiki] Found flag alias: ${flagFile}`);
        if (flagFile && !flagFile.includes('{{') && !flagFile.includes('{{{')) {
          return await this.getFileUrl(flagFile);
        }
      }

      // Also try just "flag" parameter as fallback
      const flagMatch = content.match(/\|\s*flag\s*=\s*([^\n\|]+)/i);
      if (flagMatch?.[1]) {
        const flagFile = flagMatch[1].trim();
        console.log(`[MediaWiki] Found flag parameter: ${flagFile}`);
        if (flagFile && !flagFile.includes('{{') && !flagFile.includes('{{{')) {
          return await this.getFileUrl(flagFile);
        }
      }

      console.log(`[MediaWiki] No flag found in template content`);
      return null;
    } catch (error) {
      console.error('[MediaWiki] Error getting flag from template:', error);
      return null;
    }
  }

  private async getFlagFromInfobox(countryName: string): Promise<string | null> {
    try {
      console.log(`[MediaWiki] Getting flag from infobox for: ${countryName}`);
      
      const data = await this.makeApiRequest({
        action: 'query',
        titles: countryName,
        prop: 'revisions',
        rvprop: 'content',
        rvslots: 'main'
      });

      const pages = data.query?.pages;
      if (!pages || pages.length === 0) return null;

      const page = pages[0];
      if (!page || page.missing) return null;

      const content = page.revisions?.[0]?.slots?.main?.['*'] || page.revisions?.[0]?.['*'];
      if (!content) return null;

      // Look for image_flag parameter in infobox - more flexible regex
      const flagMatch = content.match(/\|\s*image_flag\s*=\s*([^\|\n]+)/i);
      if (flagMatch?.[1]) {
        const flagFile = flagMatch[1].trim();
        console.log(`[MediaWiki] Found image_flag in infobox: ${flagFile}`);
        if (flagFile && !flagFile.includes('{{') && !flagFile.includes('{{{')) {
          return await this.getFileUrl(flagFile);
        }
      }

      return null;
    } catch (error) {
      console.error('[MediaWiki] Error getting flag from infobox:', error);
      return null;
    }
  }

  private async getFileUrl(fileName: string): Promise<string | null> {
    if (!fileName) return null;
    
    // Clean the filename
    let cleanFileName = fileName.replace(/^File:/i, '').trim();
    if (!cleanFileName) return null;

    try {
      console.log(`[MediaWiki] Getting file URL for: ${cleanFileName}`);
      
      const data = await this.makeApiRequest({
        action: 'query',
        titles: `File:${cleanFileName}`,
        prop: 'imageinfo',
        iiprop: 'url'
      });

      const pages = data.query?.pages;
      if (!pages || pages.length === 0) return null;

      const page = pages[0];
      if (!page || page.missing) {
        console.log(`[MediaWiki] File not found: File:${cleanFileName}`);
        return null;
      }

      const url = page.imageinfo?.[0]?.url;
      if (url) {
        console.log(`[MediaWiki] Found file URL: ${url}`);
      }
      
      return url || null;
    } catch (error) {
      console.error(`[MediaWiki] Error getting file URL for ${cleanFileName}:`, error);
      return null;
    }
  }

  async getCountryInfobox(countryName: string): Promise<CountryInfobox | null> {
    const cacheKey = countryName.toLowerCase();
    
    if (this.infoboxCache.has(cacheKey)) {
      return this.infoboxCache.get(cacheKey) || null;
    }

    try {
      console.log(`[MediaWiki] Getting infobox for: ${countryName}`);
      
      const data = await this.makeApiRequest({
        action: 'query',
        titles: countryName,
        prop: 'revisions',
        rvprop: 'content',
        rvslots: 'main'
      });

      const pages = data.query?.pages;
      if (!pages || pages.length === 0) {
        this.infoboxCache.set(cacheKey, null);
        return null;
      }

      const page = pages[0];
      if (!page || page.missing) {
        console.log(`[MediaWiki] Country page not found: ${countryName}`);
        this.infoboxCache.set(cacheKey, null);
        return null;
      }

      const content = page.revisions?.[0]?.slots?.main?.['*'] || page.revisions?.[0]?.['*'];
      if (!content) {
        console.log(`[MediaWiki] No content found for: ${countryName}`);
        this.infoboxCache.set(cacheKey, null);
        return null;
      }

      console.log(`[MediaWiki] Parsing infobox content for: ${countryName}`);
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

    try {
      // Find the infobox country template - improved regex to handle nested braces
      const infoboxRegex = /\{\{\s*Infobox\s+country([\s\S]*?)\}\}(?!\})/i;
      const infoboxMatch = wikitext.match(infoboxRegex);
      
      if (!infoboxMatch) {
        console.log(`[MediaWiki] No infobox found for: ${countryName}`);
        return infobox;
      }

      const infoboxContent = infoboxMatch[0];
      console.log(`[MediaWiki] Found infobox content length: ${infoboxContent.length}`);

      // Parse parameters - improved regex to handle complex values
      const lines = infoboxContent.split('\n');
      let currentParam = '';
      let currentValue = '';
      let inParam = false;

      for (const line of lines) {
        const trimmed = line.trim();
        
        // Skip template declaration and closing
        if (trimmed.startsWith('{{') || trimmed === '}}') continue;
        
        // Check if this line starts a new parameter
        const paramMatch = trimmed.match(/^\|\s*([^=]+?)\s*=\s*(.*)/);
        
        if (paramMatch) {
          // Save previous parameter if we have one
          if (inParam && currentParam && currentValue.trim()) {
            this.setInfoboxValue(infobox, currentParam, currentValue);
          }
          
          // Start new parameter
          currentParam = paramMatch[1].trim();
          currentValue = paramMatch[2] || '';
          inParam = true;
        } else if (inParam && trimmed && !trimmed.startsWith('|')) {
          // Continue current parameter value
          currentValue += ' ' + trimmed;
        }
      }
      
      // Don't forget the last parameter
      if (inParam && currentParam && currentValue.trim()) {
        this.setInfoboxValue(infobox, currentParam, currentValue);
      }

      console.log(`[MediaWiki] Parsed ${Object.keys(infobox).length} infobox fields for: ${countryName}`);
      
    } catch (error) {
      console.error(`[MediaWiki] Error parsing infobox for ${countryName}:`, error);
    }

    return infobox;
  }

  private setInfoboxValue(infobox: CountryInfobox, key: string, value: string): void {
    // Clean up the value
    let cleanValue = value
      // Remove wiki links but keep the display text
      .replace(/\[\[(?:[^\|\]]*\|)?([^\]]+)\]\]/g, '$1')
      // Remove simple templates like {{nowrap|text}}
      .replace(/\{\{(?:nowrap|nobr)\|([^}]+)\}\}/gi, '$1')
      // Remove references
      .replace(/<ref[^>]*>.*?<\/ref>/gi, '')
      // Remove HTML tags
      .replace(/<[^>]+>/g, '')
      // Clean up whitespace
      .replace(/\s+/g, ' ')
      .trim();

    if (!cleanValue) return;

    // Store with normalized key
    const normalizedKey = key.toLowerCase().replace(/[^a-z0-9]+/g, '_');
    infobox[normalizedKey] = cleanValue;
    
    // Also store with original key for compatibility
    infobox[key] = cleanValue;

    // Add common field mappings
    const fieldMappings: Record<string, string> = {
      'area_km2': 'area',
      'population_estimate': 'population',
      'government_type': 'government',
      'leader_name1': 'leader',
      'GDP_PPP': 'gdp',
      'official_languages': 'languages',
      'time_zone': 'timezone',
      'calling_code': 'callingCode',
      'cctld': 'internetTld',
      'drives_on': 'drivingSide'
    };

    const mappedKey = fieldMappings[normalizedKey];
    if (mappedKey) {
      infobox[mappedKey] = cleanValue;
    }
  }

  async preloadCountryFlags(countryNames: string[]): Promise<void> {
    console.log(`[MediaWiki] Preloading flags for ${countryNames.length} countries`);
    
    const promises = countryNames.map(async (name) => {
      try {
        const url = await this.getFlagUrl(name);
        return { name, url, success: !!url };
      } catch (error) {
        console.warn(`[MediaWiki] Failed to preload flag for ${name}:`, error);
        return { name, url: null, success: false };
      }
    });

    const results = await Promise.all(promises);
    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    
    console.log(`[MediaWiki] Preload complete: ${successful} successful, ${failed} failed`);
  }

  clearCache(): void {
    this.flagCache.clear();
    this.infoboxCache.clear();
    console.log('[MediaWiki] Cache cleared');
  }

  getCacheStats(): CacheStats {
    const flagEntries = Array.from(this.flagCache.values());
    const successfulFlags = flagEntries.filter(entry => entry.url !== null).length;
    const failedFlags = flagEntries.filter(entry => entry.error).length;

    return {
      flags: this.flagCache.size,
      preloadedFlags: successfulFlags,
      failedFlags: failedFlags,
      infoboxes: this.infoboxCache.size
    };
  }
}

// Create and export the service instance
const IXNAY_MEDIAWIKI_URL = env.NEXT_PUBLIC_MEDIAWIKI_URL || 'https://ixwiki.com';
export const ixnayWiki = new MediaWikiService(IXNAY_MEDIAWIKI_URL);

// Export types
export type { MediaWikiApiResponse };