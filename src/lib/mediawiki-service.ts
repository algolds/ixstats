// src/lib/mediawiki-service.ts
// Direct ixwiki.com API integration

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

class IxnayWikiService {
  private readonly API_BASE_URL = 'https://ixwiki.com/api.php';
  private readonly FLAG_CACHE = new Map<string, string | null>();
  private readonly INFOBOX_CACHE = new Map<string, CountryInfobox | null>();
  
  /**
   * Get flag URL for a country by querying the Country_data template
   */
  async getFlagUrl(countryName: string): Promise<string | null> {
    // Check cache first
    if (this.FLAG_CACHE.has(countryName)) {
      return this.FLAG_CACHE.get(countryName) ?? null;
    }
    
    try {
      console.log(`[MediaWiki] Getting flag for: ${countryName}`);
      
      // Strategy 1: Try Country_data template
      let flagUrl = await this.getFlagFromCountryDataTemplate(countryName);
      if (flagUrl) {
        this.FLAG_CACHE.set(countryName, flagUrl);
        return flagUrl;
      }
      
      // Strategy 2: Try common flag patterns
      flagUrl = await this.getFlagFromCommonPatterns(countryName);
      if (flagUrl) {
        this.FLAG_CACHE.set(countryName, flagUrl);
        return flagUrl;
      }
      
      // Nothing found
      console.warn(`[MediaWiki] No flag found for ${countryName}`);
      this.FLAG_CACHE.set(countryName, null);
      return null;
      
    } catch (error) {
      console.error(`[MediaWiki] Error getting flag for ${countryName}:`, error);
      this.FLAG_CACHE.set(countryName, null);
      return null;
    }
  }
  
  /**
   * Get flag from Country_data template
   */
  private async getFlagFromCountryDataTemplate(countryName: string): Promise<string | null> {
    try {
      const templateUrl = `${this.API_BASE_URL}?action=parse&page=Template:Country_data_${this.sanitizePageName(countryName)}&format=json&origin=*&prop=wikitext`;
      console.log(`[MediaWiki] Fetching template: ${templateUrl}`);
      
      const response = await fetch(templateUrl);
      const data = await response.json();
      
      if (data.error || !data.parse?.wikitext?.['*']) {
        console.warn(`[MediaWiki] No template found for ${countryName}`);
        return null;
      }
      
      const wikitext = data.parse.wikitext['*'];
      
      // Extract flag alias or flag parameter
      let flagFile = null;
      
      // Try flag alias first (preferred)
      const flagAliasMatch = wikitext.match(/\|\s*flag\s*alias\s*=\s*([^\n\|]+)/i);
      if (flagAliasMatch && flagAliasMatch[1]) {
        flagFile = flagAliasMatch[1].trim();
        console.log(`[MediaWiki] Found flag alias: ${flagFile}`);
      }
      
      // If no flag alias, try regular flag parameter
      if (!flagFile) {
        const flagMatch = wikitext.match(/\|\s*flag\s*=\s*([^\n\|]+)/i);
        if (flagMatch && flagMatch[1]) {
          flagFile = flagMatch[1].trim();
          console.log(`[MediaWiki] Found flag parameter: ${flagFile}`);
        }
      }
      
      if (!flagFile) {
        console.warn(`[MediaWiki] No flag found in template for ${countryName}`);
        return null;
      }
      
      // Get the actual flag URL
      return await this.getFileUrl(flagFile);
      
    } catch (error) {
      console.error(`[MediaWiki] Error getting flag from template for ${countryName}:`, error);
      return null;
    }
  }
  
  /**
   * Try common flag filename patterns
   */
  private async getFlagFromCommonPatterns(countryName: string): Promise<string | null> {
    const sanitizedName = this.sanitizePageName(countryName);
    const patterns = [
      `Flag of ${countryName}.svg`,
      `Flag of ${countryName}.png`,
      `Flag of ${sanitizedName}.svg`,
      `Flag of ${sanitizedName}.png`,
      `${sanitizedName}_flag.svg`,
      `${sanitizedName}_flag.png`,
      `Flag_${sanitizedName}.svg`,
      `Flag_${sanitizedName}.png`,
      `Flag ${countryName}.svg`,
      `Flag ${countryName}.png`,
      `Flag3 ${countryName.toLowerCase()}.png`,
    ];
    
    for (const pattern of patterns) {
      try {
        const url = await this.getFileUrl(pattern);
        if (url) {
          console.log(`[MediaWiki] Found flag with pattern: ${pattern}`);
          return url;
        }
      } catch (error) {
        // Continue to next pattern
        continue;
      }
    }
    
    return null;
  }
  
  /**
   * Get the URL for a file
   */
  private async getFileUrl(fileName: string): Promise<string | null> {
    if (!fileName) return null;
    
    // Clean up the file name
    const cleanFileName = fileName.replace(/^File:/i, '').trim();
    if (!cleanFileName) return null;
    
    try {
      const fileUrl = `${this.API_BASE_URL}?action=query&titles=File:${encodeURIComponent(cleanFileName)}&prop=imageinfo&iiprop=url&format=json&origin=*`;
      console.log(`[MediaWiki] Fetching file info: ${fileUrl}`);
      
      const response = await fetch(fileUrl);
      const data = await response.json();
      
      // Extract file URL from response
      const pages = data.query?.pages;
      if (!pages) return null;
      
      // Find the first page (there should only be one)
      const pageIds = Object.keys(pages);
      const pageId = pageIds[0];
      if (!pageId) return null;
      
      const page = pages[pageId];
      if (!page || page.missing) return null;
      
      const url = page.imageinfo?.[0]?.url || null;
      console.log(`[MediaWiki] Found image URL: ${url}`);
      return url;
      
    } catch (error) {
      console.error(`[MediaWiki] Error getting file URL for ${fileName}:`, error);
      return null;
    }
  }
  
  /**
   * Get country infobox data from the country's main page
   */
  async getCountryInfobox(countryName: string): Promise<CountryInfobox | null> {
    // Check cache first
    if (this.INFOBOX_CACHE.has(countryName)) {
      return this.INFOBOX_CACHE.get(countryName) ?? null;
    }
    
    try {
      console.log(`[MediaWiki] Getting infobox for: ${countryName}`);
      
      // Get the country page wikitext
      const pageUrl = `${this.API_BASE_URL}?action=parse&page=${encodeURIComponent(this.sanitizePageName(countryName))}&format=json&origin=*&prop=wikitext`;
      console.log(`[MediaWiki] Fetching page: ${pageUrl}`);
      
      const response = await fetch(pageUrl);
      const data = await response.json();
      
      if (data.error || !data.parse?.wikitext?.['*']) {
        console.warn(`[MediaWiki] No page found or no content for ${countryName}`);
        this.INFOBOX_CACHE.set(countryName, null);
        return null;
      }
      
      const wikitext = data.parse.wikitext['*'];
      
      // Extract infobox data
      const infobox = this.parseInfoboxFromWikitext(wikitext, countryName);
      this.INFOBOX_CACHE.set(countryName, infobox);
      return infobox;
      
    } catch (error) {
      console.error(`[MediaWiki] Error getting infobox for ${countryName}:`, error);
      this.INFOBOX_CACHE.set(countryName, null);
      return null;
    }
  }
  
  /**
   * Parse infobox data from wikitext
   */
  private parseInfoboxFromWikitext(wikitext: string, countryName: string): CountryInfobox {
    const infobox: CountryInfobox = { name: countryName };
    
    try {
      // Match infobox country template
      const infoboxRegex = /\{\{\s*(?:Infobox\s+country|Country\s+infobox)([\s\S]*?)\n\}\}/i;
      const match = wikitext.match(infoboxRegex);
      
      if (!match || !match[1]) {
        console.warn(`[MediaWiki] No infobox found for ${countryName}`);
        return infobox;
      }
      
      const infoboxContent = match[1];
      
      // Parse the parameters
      const lines = infoboxContent.split('\n');
      let currentParam = '';
      let currentValue = '';
      let depth = 0;
      
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        
        // Count template depth to handle nested templates
        depth += (trimmed.match(/\{\{/g) || []).length;
        depth -= (trimmed.match(/\}\}/g) || []).length;
        
        // Look for parameter lines at the correct nesting level
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
      
      console.log(`[MediaWiki] Parsed ${Object.keys(infobox).length - 1} infobox fields for: ${countryName}`);
      return infobox;
      
    } catch (error) {
      console.error(`[MediaWiki] Error parsing infobox for ${countryName}:`, error);
      return infobox;
    }
  }
  
  /**
   * Set infobox value with appropriate cleaning
   */
  private setInfoboxValue(infobox: CountryInfobox, key: string, value: string): void {
    // Clean up the value
    let cleanValue = this.cleanWikitext(value);
    
    if (!cleanValue || cleanValue === '–' || cleanValue === '-') return;
    
    // Store with original key
    infobox[key] = cleanValue;
    
    // Create normalized key
    const normalizedKey = key.toLowerCase().replace(/[^a-z0-9]+/g, '_');
    if (normalizedKey !== key) {
      infobox[normalizedKey] = cleanValue;
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
  
  /**
   * Clean wikitext formatting
   */
  private cleanWikitext(text: string): string {
    return text
      .replace(/\[\[(?:[^\|\]]*\|)?([^\]]+)\]\]/g, '$1') // Remove wiki links
      .replace(/\{\{(?:nowrap|nobr)\|([^}]+)\}\}/gi, '$1') // Remove nowrap templates
      .replace(/<ref[^>]*>.*?<\/ref>/gi, '') // Remove references
      .replace(/<[^>]+>/g, '') // Remove HTML tags
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();
  }
  
  /**
   * Get country wiki URL
   */
  getCountryWikiUrl(countryName: string): string {
    return `https://ixwiki.com/wiki/${encodeURIComponent(this.sanitizePageName(countryName))}`;
  }
  
  /**
   * Sanitize page name for MediaWiki
   */
  private sanitizePageName(pageName: string): string {
    return pageName
      .replace(/ /g, '_')
      .replace(/[^\w\-_.()]/g, '')
      .trim();
  }
  
  /**
   * Preload flags for multiple countries
   */
  async preloadCountryFlags(countryNames: string[]): Promise<void> {
    console.log(`[MediaWiki] Preloading flags for ${countryNames.length} countries`);
    
    const batchSize = 5; // Process in small batches
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
   * Get cache statistics
   */
  getCacheStats() {
    return {
      flags: this.FLAG_CACHE.size,
      preloadedFlags: Array.from(this.FLAG_CACHE.values()).filter(Boolean).length,
      failedFlags: Array.from(this.FLAG_CACHE.values()).filter(v => v === null).length,
      totalRequests: this.FLAG_CACHE.size + this.INFOBOX_CACHE.size,
      cacheHits: this.FLAG_CACHE.size + this.INFOBOX_CACHE.size,
      cacheMisses: 0,
      errors: 0,
    };
  }
  
  /**
   * Clear cache
   */
  clearCache(): void {
    this.FLAG_CACHE.clear();
    this.INFOBOX_CACHE.clear();
    console.log('[MediaWiki] Cache cleared');
  }
}

// Export singleton instance
export const ixnayWiki = new IxnayWikiService();