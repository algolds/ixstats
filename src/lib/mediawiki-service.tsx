// src/lib/mediawiki-service.tsx
import { env } from "~/env";
import React, { type ComponentType } from 'react';
import { Info as InfoIconLucide, MapPin as MapPinIcon, Users as UsersIcon, Building as BuildingIcon, DollarSign as DollarSignIcon, Languages as LanguagesIcon, Clock as ClockIcon, Phone as PhoneIcon, Wifi as WifiIcon, Navigation as NavigationIcon, Globe as GlobeIcon } from "lucide-react";

// Interfaces
interface CountryTemplateData {
  flag?: string;
  capital?: string;
  continent?: string;
  currency?: string;
  government?: string;
  leader?: string;
}

export interface CountryInfobox {
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
  [key: string]: string | undefined;
}

interface MediaWikiApiResponse {
  parse?: {
    title: string;
    pageid: number;
    wikitext: { '*': string; };
  };
  query?: {
    pages?: {
      [key: string]: {
        pageid: number;
        title: string;
        missing?: boolean;
        revisions?: Array<{
          contentformat: string;
          contentmodel: string;
          '*': string;
        }>;
        imageinfo?: Array<{
          url?: string;
          descriptionurl?: string;
          thumburl?: string;
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

interface InfoboxFieldDefinition {
  key: keyof CountryInfobox | string; 
  label: string;
  icon: ComponentType<{ className?: string }>;
  priority: number;
  formatter?: (value: string) => string;
}

interface InfoboxField { 
  key: string;
  label: string;
  value: string;
  icon: ComponentType<{ className?: string }>;
  priority: number;
}

const PlaceholderIcon: ComponentType<{ className?: string }> = ({ className }) => (
  <span className={className} style={{ fontStyle: 'italic', fontSize: '0.8em' }}>(i)</span>
);

const InfoIconToUse = InfoIconLucide || PlaceholderIcon;


class MediaWikiService {
  private baseUrl: string;
  private cache = new Map<string, CountryTemplateData>();
  private flagCache = new Map<string, FlagCacheEntry>();
  private infoboxCache = new Map<string, CountryInfobox | null>();
  private preloadPromises = new Map<string, Promise<string | null>>();
  private readonly CACHE_EXPIRY = 24 * 60 * 60 * 1000;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
    if (typeof window !== 'undefined') {
      this.initializeFlagPreloading();
    }
  }

  // Public method to get country wiki URL
  getCountryWikiUrl(countryName: string): string {
    // Encode the country name for URL safety
    const encodedName = encodeURIComponent(countryName.replace(/ /g, '_'));
    return `${this.baseUrl}wiki/${encodedName}`;
  }

  private async makeApiRequest(params: Record<string, string>, debug = false): Promise<MediaWikiApiResponse> {
    const url = new URL(`${this.baseUrl}api.php`);
    url.searchParams.set('format', 'json');
    url.searchParams.set('origin', '*');
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.set(key, value);
    });

    if (debug) console.log(`[MediaWiki] API Request: ${url.toString()}`);

    try {
      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        mode: 'cors',
      });

      const responseText = await response.text();

      if (!response.ok) {
        console.error(`[MediaWiki] HTTP Error: ${response.status} for ${url.toString()}. Response: ${responseText.substring(0, 200)}...`);
        throw new Error(`HTTP ${response.status}: ${response.statusText}. Response: ${responseText.substring(0,100)}...`);
      }
      
      const contentType = response.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        try {
          const data: MediaWikiApiResponse = JSON.parse(responseText);
          if (data.error) { throw new Error(`API Error: ${data.error.code} - ${data.error.info}`); }
          return data;
        } catch (jsonError) {
          console.error(`[MediaWiki] Failed to parse JSON response for ${url.toString()}. Status: ${response.status}. Response text:`, responseText.substring(0, 500) + "...");
          throw new Error(`MediaWiki API response was not valid JSON. URL: ${url.toString()}`);
        }
      } else {
        console.warn(`[MediaWiki] API response for ${url.toString()} was not JSON (Content-Type: ${contentType}). Response text:`, responseText.substring(0, 500) + "...");
        if (params.action === 'query' && params.titles) {
             return { query: { pages: { "-1": { pageid: -1, title: params.titles, missing: true } } } } as MediaWikiApiResponse;
        }
        throw new Error(`MediaWiki API returned non-JSON content. URL: ${url.toString()}`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`[MediaWiki] Request or parsing failed for ${url.toString()}:`, errorMessage);
      throw error;
    }
  }

  private initializeFlagPreloading(): void {
    if (typeof localStorage === 'undefined') return;
    const cachedCountries = this.getCachedCountryList();
    if (cachedCountries.length > 0) {
      this.preloadCountryFlags(cachedCountries);
    }
  }

  private getCachedCountryList(): string[] {
    try {
      if (typeof localStorage === 'undefined') return [];
      const cached = localStorage.getItem('ixstats_countries');
      return cached ? JSON.parse(cached) : [];
    } catch { return []; }
  }

  private updateCachedCountryList(countries: string[]): void {
    try {
      if (typeof localStorage === 'undefined') return;
      localStorage.setItem('ixstats_countries', JSON.stringify(countries));
    } catch { /* Ignore */ }
  }

  async preloadCountryFlags(countryNames: string[]): Promise<void> {
    this.updateCachedCountryList(countryNames);
    const BATCH_SIZE = 5;
    for (let i = 0; i < countryNames.length; i += BATCH_SIZE) {
      const batch = countryNames.slice(i, i + BATCH_SIZE);
      const promises: Promise<void>[] = batch.map(name => 
        this.preloadFlag(name).catch(e => {
          console.warn(`[MediaWiki] Error preloading flag for ${name} in batch:`, e instanceof Error ? e.message : String(e));
        })
      );
      await Promise.allSettled(promises);
      if (i + BATCH_SIZE < countryNames.length) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
  }

  private async preloadFlag(countryName: string): Promise<void> {
    const cacheKey = countryName.toLowerCase();
    const cached = this.flagCache.get(cacheKey);
    if (cached?.preloaded && !cached.error && (Date.now() - cached.lastUpdated < this.CACHE_EXPIRY)) return;

    try {
      const flagUrl = await this.getFlagUrl(countryName);
      if (flagUrl && typeof window !== 'undefined') {
        const img = new Image();
        await new Promise<void>((resolve, reject) => {
            img.onload = () => { this.flagCache.set(cacheKey, { url: flagUrl, preloaded: true, lastUpdated: Date.now(), error: false }); resolve(); };
            img.onerror = () => { this.flagCache.set(cacheKey, { url: flagUrl, preloaded: false, lastUpdated: Date.now(), error: true }); reject(new Error('Image load error')); };
            img.src = flagUrl;
        });
      } else if (!flagUrl) { this.flagCache.set(cacheKey, { url: '', preloaded: false, lastUpdated: Date.now(), error: true }); }
    } catch (error) {
      this.flagCache.set(cacheKey, { url: '', preloaded: false, lastUpdated: Date.now(), error: true });
    }
  }

  async getFlagUrl(countryName: string): Promise<string | null> {
    if (!countryName || typeof countryName !== 'string') return null;
    const cacheKey = countryName.toLowerCase();
    const cached = this.flagCache.get(cacheKey);
    if (cached && (Date.now() - cached.lastUpdated < this.CACHE_EXPIRY)) return cached.error ? null : cached.url;
    
    const existingPromise = this.preloadPromises.get(cacheKey);
    if (existingPromise) return existingPromise;

    const promise = this.fetchFlagUrl(countryName).finally(() => { this.preloadPromises.delete(cacheKey); });
    this.preloadPromises.set(cacheKey, promise);
    return promise;
  }
  
  private updateFlagCache(cacheKey: string, url: string, isError: boolean): string | null {
    this.flagCache.set(cacheKey, { url, preloaded: false, lastUpdated: Date.now(), error: isError });
    return isError ? null : url;
  }

  private async fetchFlagUrl(countryName: string): Promise<string | null> {
    const cacheKey = countryName.toLowerCase();
    console.log(`[MediaWiki] fetchFlagUrl: Starting search for ${countryName}`);
    try {
      const commonFlagTemplates = [`{{flag|${countryName}}}`, `{{flagicon|${countryName}}}`];
      for (const templateText of commonFlagTemplates) {
        const flagUrlFromExpansion = await this.resolveFlagTemplateExpansion(templateText, countryName);
        if (flagUrlFromExpansion) return this.updateFlagCache(cacheKey, flagUrlFromExpansion, false);
      }
      
      const flagUrlFromDataTpl = await this.getFlagFromCountryDataTemplate(countryName);
      if (flagUrlFromDataTpl) return this.updateFlagCache(cacheKey, flagUrlFromDataTpl, false);

      const flagUrlFromPage = await this.getFlagFromCountryPage(countryName);
      if (flagUrlFromPage) return this.updateFlagCache(cacheKey, flagUrlFromPage, false);
      
      console.warn(`[MediaWiki] fetchFlagUrl: No flag found for ${countryName}.`);
      return this.updateFlagCache(cacheKey, '', true);
    } catch (error) {
      return this.updateFlagCache(cacheKey, '', true);
    }
  }
  
  private async resolveFlagTemplateExpansion(templateText: string, debugName: string): Promise<string | null> {
    try {
      const expandedData = await this.makeApiRequest({ action: 'expandtemplates', text: templateText, prop: 'wikitext' });
      if (expandedData.expandtemplates?.wikitext) {
        const expandedText = expandedData.expandtemplates.wikitext;
        const fileMatch = expandedText.match(/\[\[File:([^|\]]+)/i);
        if (fileMatch?.[1]) return this.resolveFileUrl(fileMatch[1].trim());
        if (expandedText.match(/\.(svg|png|jpg|jpeg|gif|webp)$/i) && !expandedText.includes("[[") && !expandedText.includes("{{")) {
            return this.resolveFileUrl(expandedText.trim());
        }
      }
    } catch (error) { /* Logged in makeApiRequest */ }
    return null;
  }

  private async getFlagFromCountryDataTemplate(countryName: string): Promise<string | null> {
    const templatePatterns = [ `Template:Country data ${countryName}`, `Template:Country_data_${countryName}` ];
    for (const templateTitle of templatePatterns) {
      try {
        const data = await this.makeApiRequest({ action: 'query', titles: templateTitle, prop: 'revisions', rvprop: 'content', rvslots: 'main'});
        const page = data.query?.pages ? Object.values(data.query.pages)[0] : undefined;
        if (page && !page.missing && page.revisions?.[0]?.['*']) {
          const wikitext = page.revisions[0]['*'];
          const flagAliasMatch = wikitext.match(/\|\s*(?:flag alias|flag image|image_flag)\s*=\s*([^|\n}]+)/i);
          if (flagAliasMatch?.[1]) return this.resolveFileUrl(flagAliasMatch[1].trim());
        }
      } catch (error) { /* Continue */ }
    }
    return null;
  }

  private async getFlagFromCountryPage(countryName: string): Promise<string | null> {
     try {
        const data = await this.makeApiRequest({ action: 'query', titles: countryName, prop: 'revisions', rvprop: 'content', rvslots: 'main'});
        const page = data.query?.pages ? Object.values(data.query.pages)[0] : undefined;
        if (page && !page.missing && page.revisions?.[0]?.['*']) {
            const wikitext = page.revisions[0]['*'];
            const infoboxFlagMatch = wikitext.match(/\|\s*(flag|image_flag)\s*=\s*([^|\n}]+)/i);
            if (infoboxFlagMatch?.[1]) return this.resolveFileUrl(infoboxFlagMatch[1].trim());
            const fileLinkMatch = wikitext.match(/\[\[File:([^|\]]*flag[^|\]]*\.(?:svg|png|jpg|jpeg|gif|webp))/i);
            if (fileLinkMatch?.[1]) return this.resolveFileUrl(fileLinkMatch[1].trim());
        }
        return null;
    } catch (error) { return null; }
  }

  private async resolveFileUrl(fileNameInput: string | undefined | null): Promise<string | null> {
    if (typeof fileNameInput !== 'string' || !fileNameInput.trim()) return null;
    const fileName = fileNameInput.replace(/^File:/i, '').trim();
    if (!fileName) return null;
    try {
      const data = await this.makeApiRequest({ action: 'query', titles: `File:${fileName}`, prop: 'imageinfo', iiprop: 'url' });
      const page = data.query?.pages ? Object.values(data.query.pages)[0] : undefined;
      if (page && !page.missing && page.imageinfo?.[0]?.url) return page.imageinfo[0].url;
      return null;
    } catch (error) { return null; }
  }
  
  async getCountryInfobox(countryName: string): Promise<CountryInfobox | null> {
    const cacheKey = countryName.toLowerCase();
    if (this.infoboxCache.has(cacheKey)) {
      return this.infoboxCache.get(cacheKey) || null;
    }
     try {
        const data = await this.makeApiRequest({
          action: 'query', titles: countryName, prop: 'revisions', rvprop: 'content', rvslots: 'main'
        });
        const pagesMap = data.query?.pages;
        if (!pagesMap) { this.infoboxCache.set(cacheKey, null); return null; }
        const page = Object.values(pagesMap)[0];
        if (!page || page.missing || !page.revisions || page.revisions.length === 0) {
          this.infoboxCache.set(cacheKey, null); return null;
        }
        const revision = page.revisions[0];
        if (!revision || typeof revision['*'] !== 'string') {
          this.infoboxCache.set(cacheKey, null); return null;
        }
        const wikitext = revision['*'];
        const infoboxData = this.parseCountryInfobox(wikitext, countryName);
        this.infoboxCache.set(cacheKey, infoboxData);
        return infoboxData;
     } catch (e) {
        console.error(`[MediaWiki] Error fetching infobox for ${countryName}:`, e);
        this.infoboxCache.set(cacheKey, null);
        return null;
     }
  }

  private getFieldMappings(): InfoboxFieldDefinition[] {
    return [
      { key: 'capital', label: 'Capital', icon: BuildingIcon, priority: 1 },
      { key: 'continent', label: 'Continent', icon: GlobeIcon, priority: 2 },
      { key: 'area', label: 'Area', icon: MapPinIcon, priority: 3, formatter: (v) => v.replace(/\{\{.*\|(.*?)}}/g, "$1").replace(/\[\[.*?\|(.*?)\]\]/g, '$1') },
      { key: 'population_estimate', label: 'Population', icon: UsersIcon, priority: 4, formatter: (v) => v.replace(/\[\[.*?\|(.*?)\]\]/g, '$1') },
      { key: 'currency', label: 'Currency', icon: DollarSignIcon, priority: 5 },
      { key: 'government_type', label: 'Government', icon: BuildingIcon, priority: 6 },
      { key: 'leader_name1', label: 'Leader', icon: UsersIcon, priority: 7 },
      { key: 'gdp_nominal', label: 'GDP (Nominal)', icon: DollarSignIcon, priority: 8 },
      { key: 'official_languages', label: 'Languages', icon: LanguagesIcon, priority: 9 },
      { key: 'time_zone', label: 'Timezone', icon: ClockIcon, priority: 10 },
      { key: 'calling_code', label: 'Calling Code', icon: PhoneIcon, priority: 11 },
      { key: 'cctld', label: 'Internet TLD', icon: WifiIcon, priority: 12 },
      { key: 'drives_on', label: 'Driving Side', icon: NavigationIcon, priority: 13 },
    ];
  }

  public formatInfoboxFields(infoboxData: CountryInfobox | null): InfoboxField[] {
    if (!infoboxData) return [];
    const fields: InfoboxField[] = [];
    const fieldMappings = this.getFieldMappings(); 

    for (const mapping of fieldMappings) {
        const rawValue = infoboxData[mapping.key as keyof CountryInfobox];
        if (typeof rawValue === 'string') {
            const trimmedValue = rawValue.trim();
            if (trimmedValue) {
                const formattedValue = mapping.formatter ? mapping.formatter(trimmedValue) : trimmedValue;
                fields.push({
                    key: mapping.key as string,
                    label: mapping.label,
                    value: formattedValue,
                    icon: mapping.icon || InfoIconToUse,
                    priority: mapping.priority
                });
            }
        }
    }
    const standardKeys = new Set(fieldMappings.map(m => m.key));
    for (const [key, value] of Object.entries(infoboxData)) {
        if (!standardKeys.has(key) && key !== 'name' && typeof value === 'string') {
            const trimmedValue = value.trim();
            if (trimmedValue) {
                const label = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                fields.push({ key, label, value: trimmedValue, icon: InfoIconToUse, priority: 20 });
            }
        }
    }
    return fields.sort((a, b) => a.priority - b.priority);
  }

  private parseCountryInfobox(wikitext: string, countryName: string): CountryInfobox {
    const infoboxResult: CountryInfobox = { name: countryName };
    if (typeof wikitext !== 'string' || !wikitext) return infoboxResult;

    const infoboxPatterns = [
        /\{\{\s*Infobox country\s*\|([\s\S]*?)\s*\}\}/i, // Made the end less greedy
        /\{\{\s*Infobox nation\s*\|([\s\S]*?)\s*\}\}/i,
    ];
    let infoboxContent: string | undefined;

    for (const pattern of infoboxPatterns) {
        const match = wikitext.match(pattern);
        if (match && match[1]) { infoboxContent = match[1]; break; }
    }
    if (!infoboxContent) return infoboxResult;
    return this.parseInfoboxContent(infoboxContent, countryName);
  }

  private parseInfoboxContent(infoboxContent: string, countryName: string): CountryInfobox {
    const infobox: CountryInfobox = { name: countryName };
    const paramRegex = /\|\s*([^=\s|]+)\s*=\s*([\s\S]*?)(?=\n\s*\||\n\s*\}\})/g;
    let match;
    while ((match = paramRegex.exec(infoboxContent)) !== null) {
        if (typeof match[1] !== 'string' || typeof match[2] !== 'string') continue;
        const key = match[1].trim().toLowerCase().replace(/\s+/g, '_');
        let value = match[2].trim();
        
        value = value.replace(/\[\[(?:[^|\]]+\|)?([^\]]+)\]\]/g, '$1')
                     .replace(/\{\{(?:[^|}]+\|)?([^}]+)\}\}/g, '$1')
                     .replace(/<ref[^>]*>.*?<\/ref>/gi, '').replace(/<[^>]+>/g, '')
                     .replace(/'''''|'''|''/g, '').replace(/<br\s*\/?>/gi, ', ')
                     .replace(/\s{2,}/g, ' ').trim();
        if (value) {
            const keyMap: Record<string, keyof CountryInfobox> = {
                'official_name': 'name', 'conventional_long_name': 'name', 'common_name': 'name',
                'capital_city': 'capital', 'capital_and_largest_city': 'capital',
                'region': 'continent',
                'area_km2': 'area', 'area_total_km2': 'area', 'total_area': 'area',
                'population_estimate': 'population', 'population_total': 'population', 'population_census': 'population',
                'government_type': 'government', 'political_system': 'government',
                'leader_name1': 'leader', 'leader_title1': 'leader',
                'gdp_nominal': 'gdp', 'gdp_ppp': 'gdp', 'gdp_total': 'gdp',
                'official_languages': 'languages', 'national_languages': 'languages',
                'time_zone': 'timezone', 'utc_offset': 'timezone',
                'calling_code': 'callingCode', 'phone_code': 'callingCode',
                'cctld': 'internetTld', 'iso_code': 'internetTld', 
                'drives_on': 'drivingSide'
            };
            const mappedKey = keyMap[key] || key as keyof CountryInfobox;
            if (infobox[mappedKey] === undefined || (mappedKey === 'name' && infobox.name === countryName)) {
                 infobox[mappedKey] = value;
            } else if (!Object.prototype.hasOwnProperty.call(keyMap, key) && value.length < 250) {
                infobox[key] = value;
            }
        }
    }
    return infobox;
  }

  private parseCountryTemplate(wikitext: string): CountryTemplateData {
    const data: CountryTemplateData = {};
    if (!wikitext || typeof wikitext !== 'string') return data;
    // Corrected regex for HTML comments
    const cleanText = wikitext.replace(/<!--[\s\S]*?-->/g, '').replace(/\s+/g, ' ').trim();
    const paramRegex = /\|\s*([^=|]+)\s*=\s*([^|]*)/g; // This regex seems fine for simple key=value
    let match;
    while ((match = paramRegex.exec(cleanText)) !== null) {
      if (!match[1] || !match[2]) continue;
      const key = match[1].trim().toLowerCase();
      const value = match[2].trim();
      if (value) { 
        // Simplified assignment for brevity, expand as needed
        if (key.includes('flag')) data.flag = value;
        if (key === 'capital') data.capital = value;
        // ... etc.
      }
    }
    return data;
  }
  
  async getCountryData(countryName: string): Promise<CountryTemplateData | null> {
    const cacheKey = countryName.toLowerCase();
    
    // Check cache first
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey) || null;
    }
    
    try {
      // Try to get the country data template
      const templateTitle = `Template:Country data ${countryName}`;
      const data = await this.makeApiRequest({
        action: 'query',
        titles: templateTitle,
        prop: 'revisions',
        rvprop: 'content',
        rvslots: 'main'
      });
      
      const page = data.query?.pages ? Object.values(data.query.pages)[0] : undefined;
      if (page && !page.missing && page.revisions?.[0]?.['*']) {
        const wikitext = page.revisions[0]['*'];
        const templateData = this.parseCountryTemplate(wikitext);
        
        // Cache the result
        this.cache.set(cacheKey, templateData);
        return templateData;
      }
      
      return null;
    } catch (error) {
      console.warn(`[MediaWiki] Failed to get country data for ${countryName}:`, error);
      return null;
    }
  }

  async testTemplateAccess(): Promise<void> { 
    console.log("[MediaWiki] Testing template access...");
    try {
      // Test with a common template
      const testCountry = "United States";
      const data = await this.makeApiRequest({
        action: 'query',
        titles: `Template:Country data ${testCountry}`,
        prop: 'revisions',
        rvprop: 'content',
        rvslots: 'main'
      }, true);
      
      console.log("[MediaWiki] Template access test successful", data);
    } catch (error) {
      console.error("[MediaWiki] Template access test failed:", error);
    }
  }

  clearCache(): void { 
    this.cache.clear();
    this.flagCache.clear();
    this.infoboxCache.clear();
    this.preloadPromises.clear();
    console.log("[MediaWiki] All caches cleared."); 
  }
  
  getCacheStats() { 
    const preloadedFlags = Array.from(this.flagCache.values()).filter(entry => entry.preloaded).length;
    const failedFlags = Array.from(this.flagCache.values()).filter(entry => entry.error).length;
    
    return { 
      countryData: this.cache.size, 
      flags: this.flagCache.size, 
      infoboxes: this.infoboxCache.size, 
      preloadedFlags,
      failedFlags 
    }; 
  }
}

const IXNAY_MEDIAWIKI_URL = env.NEXT_PUBLIC_MEDIAWIKI_URL ?? 'https://ixwiki.com/';
export const ixnayWiki = new MediaWikiService(IXNAY_MEDIAWIKI_URL);

if (typeof window !== 'undefined') {
  (window as any).ixnayWikiService = ixnayWiki;
  (window as any).testMediaWikiAccess = async (country?: string) => {
    console.log('[MediaWiki] Testing MediaWiki access...');
    
    if (country) {
      console.log(`[MediaWiki] Testing flag access for ${country}...`);
      try {
        const flagUrl = await ixnayWiki.getFlagUrl(country);
        console.log(`[MediaWiki] Flag URL for ${country}:`, flagUrl);
        
        const infobox = await ixnayWiki.getCountryInfobox(country);
        console.log(`[MediaWiki] Infobox data for ${country}:`, infobox);
        
        return { flagUrl, infobox };
      } catch (error) {
        console.error('[MediaWiki] Test failed:', error);
        return null;
      }
    } else {
      await ixnayWiki.testTemplateAccess();
    }
  };
}

export type { CountryTemplateData };