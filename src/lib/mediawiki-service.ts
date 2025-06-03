// Enhanced ixwiki.com API integration with complete template parsing
import { MEDIAWIKI_CONFIG, buildApiUrl } from '~/lib/mediawiki-config';

// Main interface that allows additional dynamic string properties
export interface CountryInfobox {
  name: string;
  // Raw template data
  rawWikitext?: string;
  parsedTemplateData?: Record<string, string>;
  
  // Fully rendered HTML from MediaWiki parser
  renderedHtml?: string;
  
  // Core identification
  conventional_long_name?: string;
  native_name?: string;
  common_name?: string;
  official_name?: string;
  
  // Visual elements
  image_flag?: string;
  flag?: string;
  image_coat?: string;
  coat_of_arms?: string;
  locator_map?: string;
  image_map?: string;
  
  // Geographic data
  capital?: string;
  capital_city?: string;
  largest_city?: string;
  area_km2?: string;
  area?: string;
  area_total?: string;
  area_rank?: string;
  continent?: string;
  
  // Government data
  government_type?: string;
  government?: string;
  leader_title1?: string;
  leader_name1?: string;
  leader_title2?: string;
  leader_name2?: string;
  head_of_state?: string;
  deputy_leader?: string;
  leader?: string;
  legislature?: string;
  upper_house?: string;
  lower_house?: string;
  sovereignty_type?: string;
  
  // Economic data
  GDP_PPP?: string;
  GDP_PPP_per_capita?: string;
  GDP_nominal?: string;
  GDP_nominal_per_capita?: string;
  gdp?: string;
  gdp_ppp?: string;
  gdp_nominal?: string;
  currency?: string;
  currency_code?: string;
  
  // Cultural data
  official_languages?: string;
  official_language?: string;
  national_language?: string;
  regional_languages?: string;
  recognized_languages?: string;
  languages?: string;
  ethnic_groups?: string;
  religion?: string;
  state_religion?: string;
  demonym?: string;
  national_anthem?: string;
  royal_anthem?: string;
  patron_saint?: string;
  
  // Historical data
  established_event1?: string;
  established_date1?: string;
  established_event2?: string;
  established_date2?: string;
  established_event3?: string;
  established_date3?: string;
  established_event4?: string;
  established_date4?: string;
  established_event5?: string;
  established_date5?: string;
  established_event6?: string;
  established_date6?: string;
  established?: string;
  independence_date?: string;
  independence?: string;
  
  // Technical data
  time_zone?: string;
  timezone?: string;
  drives_on?: string;
  drivingSide?: string;
  driving_side?: string;
  cctld?: string;
  internetTld?: string;
  calling_code?: string;
  callingCode?: string;
  electricity?: string;
  
  // Miscellaneous
  motto?: string;
  national_motto?: string;
  englishmotto?: string;
}

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

class IxnayWikiService {
  private readonly API_BASE_URL = `${MEDIAWIKI_CONFIG.baseUrl}${MEDIAWIKI_CONFIG.apiEndpoint}`;
  private readonly FLAG_CACHE = new Map<string, CacheEntry<string | null>>();
  private readonly INFOBOX_CACHE = new Map<string, CacheEntry<CountryInfobox | null>>();
  private readonly TEMPLATE_CACHE = new Map<string, CacheEntry<string | null>>();
  private readonly FILE_CACHE = new Map<string, CacheEntry<string | null>>();
  private readonly WIKITEXT_CACHE = new Map<string, CacheEntry<string | null>>();
  private readonly RENDERED_HTML_CACHE = new Map<string, CacheEntry<string | null>>();
  
  // Cache TTLs (in milliseconds)
  private readonly FLAG_TTL = MEDIAWIKI_CONFIG.cache.flagTtl;
  private readonly INFOBOX_TTL = MEDIAWIKI_CONFIG.cache.infoboxTtl;
  private readonly TEMPLATE_TTL = MEDIAWIKI_CONFIG.cache.templateTtl;
  private readonly FILE_TTL = MEDIAWIKI_CONFIG.cache.flagTtl;
  private readonly WIKITEXT_TTL = MEDIAWIKI_CONFIG.cache.infoboxTtl;
  private readonly RENDERED_HTML_TTL = MEDIAWIKI_CONFIG.cache.infoboxTtl;
  
  /**
   * Check if cache entry is valid
   */
  private isCacheValid<T>(entry: CacheEntry<T> | undefined): boolean {
    if (!entry) return false;
    return Date.now() - entry.timestamp < entry.ttl;
  }
  
  /**
   * Get from cache or return null if expired/missing
   */
  private getCacheValue<T>(cache: Map<string, CacheEntry<T>>, key: string): T | null {
    const entry = cache.get(key);
    if (this.isCacheValid(entry)) {
      return entry!.data;
    }
    if (entry) {
      cache.delete(key);
    }
    return null;
  }
  
  /**
   * Set cache value with TTL
   */
  private setCacheValue<T>(cache: Map<string, CacheEntry<T>>, key: string, value: T, ttl: number): void {
    cache.set(key, {
      data: value,
      timestamp: Date.now(),
      ttl
    });
  }

  /**
   * Get raw wikitext for a page using MediaWiki API (query revisions method)
   */
  async getPageWikitext(pageName: string): Promise<string | null> {
    const cacheKey = `wikitext_${pageName.toLowerCase()}`;
    const cached = this.getCacheValue(this.WIKITEXT_CACHE, cacheKey);
    if (cached !== null) {
      return cached;
    }

    try {
      console.log(`[MediaWiki] Getting raw wikitext for: ${pageName}`);
      
      const params = {
        action: 'query',
        prop: 'revisions',
        rvprop: 'content',
        titles: encodeURIComponent(pageName),
        rvsection: '0', // Get only section 0 (intro section with infobox)
        format: 'json',
        formatversion: '2',
        origin: '*'
      };

      const apiUrl = buildApiUrl(MEDIAWIKI_CONFIG.baseUrl, params);
      console.log(`[MediaWiki] Fetching wikitext via query revisions: ${apiUrl}`);

      const response = await fetch(apiUrl, {
        headers: {
          'User-Agent': MEDIAWIKI_CONFIG.userAgent,
          'Accept': 'application/json',
        },
        cache: 'no-store'
      });

      if (!response.ok) {
        console.error(`[MediaWiki] HTTP Error: ${response.status} ${response.statusText}`);
        this.setCacheValue(this.WIKITEXT_CACHE, cacheKey, null, this.WIKITEXT_TTL);
        return null;
      }

      const data = await response.json();

      if (data.error) {
        console.warn(`[MediaWiki] API Error for ${pageName}:`, data.error);
        this.setCacheValue(this.WIKITEXT_CACHE, cacheKey, null, this.WIKITEXT_TTL);
        return null;
      }

      // Navigate the response structure: query.pages[pageId].revisions[0].content
      const pages = data.query?.pages;
      if (!pages || !Array.isArray(pages) || pages.length === 0) {
        console.warn(`[MediaWiki] No pages found for ${pageName}`);
        this.setCacheValue(this.WIKITEXT_CACHE, cacheKey, null, this.WIKITEXT_TTL);
        return null;
      }

      const page = pages[0];
      if (!page || page.missing) {
        console.warn(`[MediaWiki] Page ${pageName} not found or missing`);
        this.setCacheValue(this.WIKITEXT_CACHE, cacheKey, null, this.WIKITEXT_TTL);
        return null;
      }

      const revisions = page.revisions;
      if (!revisions || !Array.isArray(revisions) || revisions.length === 0) {
        console.warn(`[MediaWiki] No revisions found for ${pageName}`);
        this.setCacheValue(this.WIKITEXT_CACHE, cacheKey, null, this.WIKITEXT_TTL);
        return null;
      }

      const revision = revisions[0];
      const wikitext = revision?.content;
      
      if (!wikitext) {
        console.warn(`[MediaWiki] No content found in revision for ${pageName}`);
        this.setCacheValue(this.WIKITEXT_CACHE, cacheKey, null, this.WIKITEXT_TTL);
        return null;
      }

      console.log(`[MediaWiki] Got wikitext for ${pageName}: ${wikitext.length} characters (section 0 only)`);
      
      this.setCacheValue(this.WIKITEXT_CACHE, cacheKey, wikitext, this.WIKITEXT_TTL);
      return wikitext;

    } catch (error) {
      console.error(`[MediaWiki] Error getting wikitext for ${pageName}:`, error);
      this.setCacheValue(this.WIKITEXT_CACHE, cacheKey, null, this.WIKITEXT_TTL);
      return null;
    }
  }

  /**
   * Parse raw wikitext to HTML using MediaWiki parser
   */
  async parseWikitextToHtml(wikitext: string, title?: string): Promise<string | null> {
    const cacheKey = `rendered_${title || 'unknown'}_${wikitext.substring(0, 100)}`;
    const cached = this.getCacheValue(this.RENDERED_HTML_CACHE, cacheKey);
    if (cached !== null) {
      return cached;
    }

    try {
      console.log(`[MediaWiki] Parsing wikitext to HTML (${wikitext.length} chars)`);
      
      const params: Record<string, string> = {
        action: 'parse',
        text: wikitext,
        format: 'json',
        formatversion: '2',
        prop: 'text',
        contentmodel: 'wikitext',
        origin: '*'
      };

      if (title) {
        params.title = title;
      }

      const apiUrl = buildApiUrl(MEDIAWIKI_CONFIG.baseUrl, params);

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'User-Agent': MEDIAWIKI_CONFIG.userAgent,
          'Accept': 'application/json',
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams(params),
        cache: 'no-store'
      });

      if (!response.ok) {
        console.error(`[MediaWiki] Parse API HTTP Error: ${response.status} ${response.statusText}`);
        this.setCacheValue(this.RENDERED_HTML_CACHE, cacheKey, null, this.RENDERED_HTML_TTL);
        return null;
      }

      const data = await response.json();

      if (data.error || !data.parse?.text?.['*']) {
        console.warn(`[MediaWiki] Parse API error:`, data.error);
        this.setCacheValue(this.RENDERED_HTML_CACHE, cacheKey, null, this.RENDERED_HTML_TTL);
        return null;
      }

      const html = data.parse.text['*'];
      console.log(`[MediaWiki] Parsed wikitext to HTML: ${html.length} characters`);
      
      this.setCacheValue(this.RENDERED_HTML_CACHE, cacheKey, html, this.RENDERED_HTML_TTL);
      return html;

    } catch (error) {
      console.error(`[MediaWiki] Error parsing wikitext to HTML:`, error);
      this.setCacheValue(this.RENDERED_HTML_CACHE, cacheKey, null, this.RENDERED_HTML_TTL);
      return null;
    }
  }

  /**
   * Extract Infobox country template from wikitext
   */
  extractInfoboxTemplate(wikitext: string): string | null {
    try {
      console.log(`[MediaWiki] Extracting infobox template from wikitext (${wikitext.length} chars)`);
      
      // Enhanced patterns to match various infobox country template formats
      const infoboxPatterns = [
        /\{\{\s*Infobox\s+country\s*([\s\S]*?)\n\}\}/i,
        /\{\{\s*Infobox_country\s*([\s\S]*?)\n\}\}/i,
        /\{\{\s*Country\s+infobox\s*([\s\S]*?)\n\}\}/i,
        /\{\{\s*Country_infobox\s*([\s\S]*?)\n\}\}/i,
      ];

      for (const pattern of infoboxPatterns) {
        const match = wikitext.match(pattern);
        if (match && match[1]) {
          const templateContent = `{{Infobox country${match[1]}\n}}`;
          console.log(`[MediaWiki] Found infobox template: ${templateContent.length} characters`);
          return templateContent;
        }
      }

      console.warn(`[MediaWiki] No infobox country template found in wikitext`);
      return null;

    } catch (error) {
      console.error(`[MediaWiki] Error extracting infobox template:`, error);
      return null;
    }
  }

  /**
   * Parse infobox template parameters with comprehensive handling of nested templates
   */
  async parseInfoboxParameters(templateWikitext: string): Promise<Record<string, string>> {
    const parameters: Record<string, string> = {};
    
    try {
      console.log(`[MediaWiki] Parsing infobox parameters from template (${templateWikitext.length} chars)`);
      
      // Extract just the content between {{Infobox country and }}
      const content = this.extractTemplateContent(templateWikitext);
      if (!content) {
        console.error('[MediaWiki] Could not extract template content');
        return parameters;
      }
      
      console.log(`[MediaWiki] Extracted content: ${content.length} characters`);
      
      // Use regex to find all parameter patterns, handling nested templates
      const parameterRegex = /\|\s*([^=\|]+?)\s*=\s*((?:[^|]|\|(?![^=]*=))*?)(?=\s*\|\s*[^=\|]+?\s*=|\s*$)/gs;
      
      let match;
      let paramCount = 0;
      
      while ((match = parameterRegex.exec(content)) !== null) {
        const paramName = match[1]?.trim();
        const paramValue = match[2]?.trim();
        
        if (paramName && paramValue !== undefined) {
          paramCount++;
          let cleanValue = this.cleanParameterValue(paramValue);
          
          parameters[paramName] = cleanValue;
          console.log(`[MediaWiki] Parameter ${paramCount}: ${paramName} = ${cleanValue.substring(0, 80)}${cleanValue.length > 80 ? '...' : ''}`);
        }
      }
      
      // Fallback: if regex didn't capture enough, try manual splitting
      if (paramCount < 10) {
        console.log(`[MediaWiki] Regex only found ${paramCount} parameters, trying manual parsing`);
        const manualParams = this.manualParameterExtraction(content);
        
        for (const [key, value] of Object.entries(manualParams)) {
          if (!parameters[key]) {
            parameters[key] = value;
            console.log(`[MediaWiki] Manual parameter: ${key} = ${value.substring(0, 80)}${value.length > 80 ? '...' : ''}`);
          }
        }
      }

      console.log(`[MediaWiki] Successfully parsed ${Object.keys(parameters).length} total parameters`);
      
      // Log all parameter names for debugging
      console.log(`[MediaWiki] All parameters: ${Object.keys(parameters).join(', ')}`);
      
      return parameters;

    } catch (error) {
      console.error(`[MediaWiki] Error parsing infobox parameters:`, error);
      return parameters;
    }
  }

  /**
   * Extract the content between {{Infobox country and }}
   */
  private extractTemplateContent(templateWikitext: string): string | null {
    const trimmed = templateWikitext.trim();
    
    // Find the start after "{{Infobox country"
    const startMatch = trimmed.match(/^\{\{\s*Infobox\s+country\s*/i);
    if (!startMatch) {
      return null;
    }
    
    const contentStart = startMatch[0].length;
    
    // Find the matching closing }} by counting braces
    let braceDepth = 1; // We already have the opening {{
    let contentEnd = trimmed.length;
    
    for (let i = contentStart; i < trimmed.length - 1; i++) {
      if (trimmed[i] === '{' && trimmed[i + 1] === '{') {
        braceDepth++;
        i++; // Skip next char
      } else if (trimmed[i] === '}' && trimmed[i + 1] === '}') {
        braceDepth--;
        if (braceDepth === 0) {
          contentEnd = i;
          break;
        }
        i++; // Skip next char
      }
    }
    
    return trimmed.substring(contentStart, contentEnd);
  }

  /**
   * Manual parameter extraction for complex cases
   */
  private manualParameterExtraction(content: string): Record<string, string> {
    const parameters: Record<string, string> = {};
    
    // Split by | but only at the top level
    const lines = content.split('\n');
    let currentParam = '';
    let currentValue = '';
    let inParameter = false;
    
    for (const line of lines) {
      const trimmedLine = line.trim();
      if (!trimmedLine) continue;
      
      // Look for parameter start
      const paramMatch = trimmedLine.match(/^\|\s*([^=]+?)\s*=\s*(.*)$/);
      if (paramMatch) {
        // Save previous parameter
        if (inParameter && currentParam && currentValue.trim()) {
          parameters[currentParam] = this.cleanParameterValue(currentValue.trim());
        }
        
        // Start new parameter
        currentParam = paramMatch[1]?.trim();
        currentValue = paramMatch[2] || '';
        inParameter = true;
      } else if (inParameter) {
        // Continue current parameter value
        currentValue += (currentValue ? ' ' : '') + trimmedLine;
      }
    }
    
    // Save last parameter
    if (inParameter && currentParam && currentValue.trim()) {
      parameters[currentParam] = this.cleanParameterValue(currentValue.trim());
    }
    
    return parameters;
  }

  /**
   * Get country infobox data with complete template parsing
   */
  async getCountryInfobox(countryName: string): Promise<CountryInfobox | null> {
    // Check cache first
    const cached = this.getCacheValue(this.INFOBOX_CACHE, countryName);
    if (cached !== null) {
      return cached;
    }

    try {
      console.log(`[MediaWiki] Getting complete infobox for: ${countryName}`);
      
      // Step 1: Get raw wikitext for the page
      const wikitext = await this.getPageWikitext(countryName);
      if (!wikitext) {
        console.warn(`[MediaWiki] No wikitext found for ${countryName}`);
        this.setCacheValue(this.INFOBOX_CACHE, countryName, null, this.INFOBOX_TTL);
        return null;
      }

      // Step 2: Extract the infobox template
      const infoboxTemplate = this.extractInfoboxTemplate(wikitext);
      if (!infoboxTemplate) {
        console.warn(`[MediaWiki] No infobox template found for ${countryName}`);
        this.setCacheValue(this.INFOBOX_CACHE, countryName, null, this.INFOBOX_TTL);
        return null;
      }

      // Step 3: Parse template parameters
      const templateData = await this.parseInfoboxParameters(infoboxTemplate);

      // Step 4: Render the complete template to HTML
      const renderedHtml = await this.parseWikitextToHtml(infoboxTemplate, countryName);

      // Step 5: Create the infobox object
      const infobox: CountryInfobox = {
        name: countryName,
        rawWikitext: infoboxTemplate,
        parsedTemplateData: templateData,
        renderedHtml: renderedHtml || undefined,
      };

      // Step 6: Map template parameters to infobox properties
      this.mapTemplateDataToInfobox(templateData, infobox);

      // Step 7: Process any special template values (like {{Switcher}})
      await this.processSpecialTemplates(infobox);

      console.log(`[MediaWiki] Successfully created complete infobox for ${countryName}`);
      console.log(`[MediaWiki] Infobox has ${Object.keys(infobox).length} total properties`);
      
      this.setCacheValue(this.INFOBOX_CACHE, countryName, infobox, this.INFOBOX_TTL);
      return infobox;

    } catch (error) {
      console.error(`[MediaWiki] Error getting complete infobox for ${countryName}:`, error);
      this.setCacheValue(this.INFOBOX_CACHE, countryName, null, this.INFOBOX_TTL);
      return null;
    }
  }

  /**
   * Map template data to infobox properties with comprehensive field support
   */
  private mapTemplateDataToInfobox(templateData: Record<string, string>, infobox: CountryInfobox): void {
    // Direct mapping of template parameters to infobox properties
    const fieldMappings: Record<string, keyof CountryInfobox> = {
      // Core identification
      'conventional_long_name': 'conventional_long_name',
      'native_name': 'native_name',
      'common_name': 'common_name',
      
      // Visual elements
      'image_flag': 'image_flag',
      'flag': 'flag',
      'image_coat': 'image_coat',
      'locator_map': 'locator_map',
      'image_map': 'image_map',
      
      // Geographic
      'capital': 'capital',
      'largest_city': 'largest_city',
      'area': 'area',
      'area_km2': 'area_km2',
      'area_rank': 'area_rank',
      
      // Government
      'government_type': 'government_type',
      'government': 'government',
      'leader_title1': 'leader_title1',
      'leader_name1': 'leader_name1',
      'leader_title2': 'leader_title2',
      'leader_name2': 'leader_name2',
      'legislature': 'legislature',
      'upper_house': 'upper_house',
      'lower_house': 'lower_house',
      'sovereignty_type': 'sovereignty_type',
      
      // Cultural
      'official_languages': 'official_languages',
      'ethnic_groups': 'ethnic_groups',
      'religion': 'religion',
      'demonym': 'demonym',
      'national_anthem': 'national_anthem',
      
      // Historical - all establishment events
      'established_event1': 'established_event1',
      'established_date1': 'established_date1',
      'established_event2': 'established_event2',
      'established_date2': 'established_date2',
      'established_event3': 'established_event3',
      'established_date3': 'established_date3',
      'established_event4': 'established_event4',
      'established_date4': 'established_date4',
      'established_event5': 'established_event5',
      'established_date5': 'established_date5',
      'established_event6': 'established_event6',
      'established_date6': 'established_date6',
      
      // Economic
      'currency': 'currency',
      'currency_code': 'currency_code',
      'GDP_nominal': 'GDP_nominal',
      'GDP_nominal_per_capita': 'GDP_nominal_per_capita',
      
      // Technical
      'time_zone': 'time_zone',
      'drives_on': 'drives_on',
      'cctld': 'cctld',
      'calling_code': 'calling_code',
      
      // Mottos and symbols
      'national_motto': 'national_motto',
      'englishmotto': 'englishmotto',
    };

    // Apply direct mappings
    for (const [templateKey, infoboxKey] of Object.entries(fieldMappings)) {
      if (templateData[templateKey]) {
        (infobox as any)[infoboxKey] = templateData[templateKey];
      }
    }

    console.log(`[MediaWiki] Mapped ${Object.keys(templateData).length} template parameters to infobox`);
  }

  /**
   * Process special templates like {{Switcher}} within parameter values
   */
  private async processSpecialTemplates(infobox: CountryInfobox): Promise<void> {
    if (!infobox.parsedTemplateData) return;

    try {
      console.log(`[MediaWiki] Processing special templates in infobox parameters`);
      
      for (const [key, value] of Object.entries(infobox.parsedTemplateData)) {
        if (value && value.includes('{{')) {
          // This parameter contains templates - try to parse them
          const processedValue = await this.processParameterTemplates(value, key);
          if (processedValue && processedValue !== value) {
            // Update the parsed data
            infobox.parsedTemplateData[key] = processedValue;
            
            // Only update the infobox property if it's a known property
            if (key in infobox) {
              (infobox as any)[key] = processedValue;
            }
            
            console.log(`[MediaWiki] Processed template in ${key}: ${value.substring(0, 50)}... -> ${processedValue.substring(0, 50)}...`);
          }
        }
      }
      
    } catch (error) {
      console.error(`[MediaWiki] Error processing special templates:`, error);
    }
  }

  /**
   * Process templates within a parameter value
   */
  private async processParameterTemplates(parameterValue: string, parameterName: string): Promise<string> {
    try {
      // Handle {{Switcher}} templates specifically for image_map and similar parameters
      if (parameterValue.includes('{{Switcher') || parameterValue.includes('{{switcher')) {
        return this.processSwitcherTemplate(parameterValue);
      }

      // For other templates, try to parse them via MediaWiki API
      const rendered = await this.parseWikitextToHtml(parameterValue);
      if (rendered) {
        // Extract plain text from rendered HTML for simple cases
        const textContent = rendered.replace(/<[^>]+>/g, '').trim();
        if (textContent && textContent.length < parameterValue.length * 2) {
          return textContent;
        }
      }

      return parameterValue;

    } catch (error) {
      console.error(`[MediaWiki] Error processing parameter templates for ${parameterName}:`, error);
      return parameterValue;
    }
  }

  /**
   * Process {{Switcher}} template to extract the primary value
   */
  private processSwitcherTemplate(switcherTemplate: string): string {
    try {
      console.log(`[MediaWiki] Processing Switcher template: ${switcherTemplate.substring(0, 100)}...`);
      
      // Extract content from {{Switcher | content }}
      const match = switcherTemplate.match(/\{\{\s*Switcher\s*\|([\s\S]*?)\}\}/i);
      if (!match || !match[1]) {
        return switcherTemplate;
      }

      const content = match[1];
      
      // Split by | but respect nested brackets and templates
      const parts: string[] = [];
      let currentPart = '';
      let templateDepth = 0;
      let bracketDepth = 0;
      
      for (let i = 0; i < content.length; i++) {
        const char = content[i];
        const nextChar = content[i + 1];
        
        if (char === '{' && nextChar === '{') {
          templateDepth++;
          currentPart += char;
        } else if (char === '}' && nextChar === '}') {
          templateDepth--;
          currentPart += char;
        } else if (char === '[' && nextChar === '[') {
          bracketDepth++;
          currentPart += char;
        } else if (char === ']' && nextChar === ']') {
          bracketDepth--;
          currentPart += char;
        } else if (char === '|' && templateDepth === 0 && bracketDepth === 0) {
          if (currentPart.trim()) {
            parts.push(currentPart.trim());
          }
          currentPart = '';
        } else {
          currentPart += char;
        }
      }
      
      if (currentPart.trim()) {
        parts.push(currentPart.trim());
      }

      if (parts.length === 0) {
        return switcherTemplate;
      }

      // Look for file references first (common in image_map parameters)
      for (const part of parts) {
        if (part.includes('File:') || /\.(png|jpg|jpeg|gif|svg|webp)/i.test(part)) {
          // Extract just the filename from [[File:name.png|300px]] format
          const fileMatch = part.match(/\[\[File:([^\|\]]+)/i) || part.match(/([^\/\s\[\]]+\.(?:png|jpg|jpeg|gif|svg|webp))/i);
          if (fileMatch && fileMatch[1]) {
            const fileName = fileMatch[1].trim();
            console.log(`[MediaWiki] Extracted file from Switcher: ${fileName}`);
            return fileName;
          }
        }
      }

      // If no files found, return the first meaningful text content (cleaned)
      for (const part of parts) {
        const cleaned = this.cleanParameterValue(part);
        if (cleaned && cleaned.length > 3 && !cleaned.startsWith('[[File:') && !cleaned.includes('.png')) {
          console.log(`[MediaWiki] Extracted text from Switcher: ${cleaned.substring(0, 50)}...`);
          return cleaned;
        }
      }

      // Fallback to first part, cleaned
      const fallback = this.cleanParameterValue(parts[0] || switcherTemplate);
      return fallback;

    } catch (error) {
      console.error(`[MediaWiki] Error processing Switcher template:`, error);
      return switcherTemplate;
    }
  }

  /**
   * Get flag URL for a country (enhanced version)
   */
  async getFlagUrl(countryName: string): Promise<string | null> {
    const cached = this.getCacheValue(this.FLAG_CACHE, countryName);
    if (cached !== null) {
      return cached;
    }

    try {
      console.log(`[MediaWiki] Getting flag for: ${countryName}`);
      
      // Try to get flag from country infobox first
      const infobox = await this.getCountryInfobox(countryName);
      if (infobox?.image_flag || infobox?.flag) {
        const flagFile = infobox.image_flag || infobox.flag;
        if (flagFile) {
          const flagUrl = await this.getFileUrl(flagFile);
          if (flagUrl) {
            this.setCacheValue(this.FLAG_CACHE, countryName, flagUrl, this.FLAG_TTL);
            return flagUrl;
          }
        }
      }

      // Fallback to country data template
      const flagUrl = await this.getFlagFromCountryDataTemplate(countryName);
      this.setCacheValue(this.FLAG_CACHE, countryName, flagUrl, this.FLAG_TTL);
      return flagUrl;

    } catch (error) {
      console.error(`[MediaWiki] Error getting flag for ${countryName}:`, error);
      this.setCacheValue(this.FLAG_CACHE, countryName, null, this.FLAG_TTL);
      return null;
    }
  }

  /**
   * Get flag from Country_data template
   */
  private async getFlagFromCountryDataTemplate(countryName: string): Promise<string | null> {
    const templateName = `Template:Country_data_${this.sanitizePageName(countryName)}`;
    
    try {
      const templateContent = await this.getTemplate(templateName);
      if (!templateContent) {
        return null;
      }
      
      // Extract flag alias or flag parameter
      const flagAliasMatch = templateContent.match(/\|\s*flag\s*alias\s*=\s*([^\n\|]+)/i);
      if (flagAliasMatch && flagAliasMatch[1]) {
        return await this.getFileUrl(flagAliasMatch[1].trim());
      }
      
      const flagMatch = templateContent.match(/\|\s*flag\s*=\s*([^\n\|]+)/i);
      if (flagMatch && flagMatch[1]) {
        return await this.getFileUrl(flagMatch[1].trim());
      }
      
      return null;
      
    } catch (error) {
      console.error(`[MediaWiki] Error getting flag from template for ${countryName}:`, error);
      return null;
    }
  }

  /**
   * Get template content with caching
   */
  private async getTemplate(templateName: string): Promise<string | null> {
    const cached = this.getCacheValue(this.TEMPLATE_CACHE, templateName);
    if (cached !== null) {
      return cached;
    }
    
    try {
      const params = {
        action: 'parse',
        page: encodeURIComponent(templateName),
        format: 'json',
        origin: '*',
        prop: 'wikitext'
      };
      
      const templateUrl = buildApiUrl(MEDIAWIKI_CONFIG.baseUrl, params);
      
      const response = await fetch(templateUrl, {
        headers: {
          'User-Agent': MEDIAWIKI_CONFIG.userAgent
        }
      });
      
      const data = await response.json();
      
      if (data.error || !data.parse?.wikitext?.['*']) {
        this.setCacheValue(this.TEMPLATE_CACHE, templateName, null, this.TEMPLATE_TTL);
        return null;
      }
      
      const content = data.parse.wikitext['*'];
      this.setCacheValue(this.TEMPLATE_CACHE, templateName, content, this.TEMPLATE_TTL);
      return content;
      
    } catch (error) {
      console.error(`[MediaWiki] Error fetching template ${templateName}:`, error);
      this.setCacheValue(this.TEMPLATE_CACHE, templateName, null, this.TEMPLATE_TTL);
      return null;
    }
  }

  /**
   * Get the URL for a file with improved caching
   */
  async getFileUrl(fileName: string): Promise<string | null> {
    if (!fileName) return null;
    
    const cleanFileName = fileName.replace(/^File:/i, '').trim();
    if (!cleanFileName) return null;
    
    const cached = this.getCacheValue(this.FILE_CACHE, cleanFileName);
    if (cached !== null) {
      return cached;
    }
    
    try {
      const params = {
        action: 'query',
        titles: `File:${encodeURIComponent(cleanFileName)}`,
        prop: 'imageinfo',
        iiprop: 'url',
        format: 'json',
        origin: '*'
      };
      
      const fileUrl = buildApiUrl(MEDIAWIKI_CONFIG.baseUrl, params);
      
      const response = await fetch(fileUrl, {
        headers: {
          'User-Agent': MEDIAWIKI_CONFIG.userAgent
        }
      });
      
      const data = await response.json();
      
      const pages = data.query?.pages;
      if (!pages) {
        this.setCacheValue(this.FILE_CACHE, cleanFileName, null, this.FILE_TTL);
        return null;
      }
      
      const pageIds = Object.keys(pages);
      const pageId = pageIds[0];
      if (!pageId) {
        this.setCacheValue(this.FILE_CACHE, cleanFileName, null, this.FILE_TTL);
        return null;
      }
      
      const page = pages[pageId];
      if (!page || page.missing) {
        this.setCacheValue(this.FILE_CACHE, cleanFileName, null, this.FILE_TTL);
        return null;
      }
      
      const url = page.imageinfo?.[0]?.url || null;
      this.setCacheValue(this.FILE_CACHE, cleanFileName, url, this.FILE_TTL);
      return url;
      
    } catch (error) {
      console.error(`[MediaWiki] Error getting file URL for ${fileName}:`, error);
      this.setCacheValue(this.FILE_CACHE, cleanFileName, null, this.FILE_TTL);
      return null;
    }
  }

  /**
   * Get country wiki URL
   */
  getCountryWikiUrl(countryName: string): string {
    return `${MEDIAWIKI_CONFIG.baseUrl}/wiki/${encodeURIComponent(this.sanitizePageName(countryName))}`;
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
   * Clear all caches
   */
  clearCache(): void {
    this.FLAG_CACHE.clear();
    this.INFOBOX_CACHE.clear();
    this.TEMPLATE_CACHE.clear();
    this.FILE_CACHE.clear();
    this.WIKITEXT_CACHE.clear();
    this.RENDERED_HTML_CACHE.clear();
    console.log('[MediaWiki] All caches cleared');
  }

  /**
   * Clear cache for a specific country
   */
  clearCountryCache(countryName: string): void {
    if (!countryName) return;
    
    const lowerName = countryName.toLowerCase();
    
    this.FLAG_CACHE.delete(countryName);
    this.INFOBOX_CACHE.delete(countryName);
    
    // Clear related caches
    for (const [key] of this.WIKITEXT_CACHE.entries()) {
      if (key.toLowerCase().includes(lowerName)) {
        this.WIKITEXT_CACHE.delete(key);
      }
    }
    
    for (const [key] of this.RENDERED_HTML_CACHE.entries()) {
      if (key.toLowerCase().includes(lowerName)) {
        this.RENDERED_HTML_CACHE.delete(key);
      }
    }
    
    for (const [key] of this.TEMPLATE_CACHE.entries()) {
      if (key.toLowerCase().includes(lowerName)) {
        this.TEMPLATE_CACHE.delete(key);
      }
    }
    
    for (const [key] of this.FILE_CACHE.entries()) {
      if (key.toLowerCase().includes(lowerName)) {
        this.FILE_CACHE.delete(key);
      }
    }
    
    console.log(`[MediaWiki] Cache cleared for country: ${countryName}`);
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    const now = Date.now();
    
    const validFlags = Array.from(this.FLAG_CACHE.values()).filter(entry => 
      now - entry.timestamp < entry.ttl
    );
    const validInfoboxes = Array.from(this.INFOBOX_CACHE.values()).filter(entry => 
      now - entry.timestamp < entry.ttl
    );
    
    return {
      flags: validFlags.length,
      infoboxes: validInfoboxes.length,
      templates: this.TEMPLATE_CACHE.size,
      files: this.FILE_CACHE.size,
      wikitext: this.WIKITEXT_CACHE.size,
      renderedHtml: this.RENDERED_HTML_CACHE.size,
      totalCaches: 6,
    };
  }

  /**
   * Enhanced parameter value cleaning with comprehensive wiki syntax handling
   */
  private cleanParameterValue(value: string): string {
    if (!value) return '';
    
    let cleaned = value.trim();
    
    // Remove HTML comments first
    cleaned = cleaned.replace(/<!--[\s\S]*?-->/g, '');
    
    // Handle special templates like {{Switcher}}
    if (cleaned.includes('{{Switcher')) {
      cleaned = this.processSwitcherTemplate(cleaned);
    }
    
    // Handle wiki links more carefully
    // Convert [[Page|Display Text]] to just "Display Text"  
    cleaned = cleaned.replace(/\[\[([^\|\]]+)\|([^\]]+)\]\]/g, '$2');
    // Convert [[Page]] to just "Page"
    cleaned = cleaned.replace(/\[\[([^\]]+)\]\]/g, '$1');
    
    // Handle file links specially - extract just the filename
    cleaned = cleaned.replace(/\[\[File:([^\|\]]+)(?:\|[^\]]+)?\]\]/g, '$1');
    
    // Remove wiki formatting
    cleaned = cleaned
      .replace(/'''([^']+)'''/g, '$1') // Bold
      .replace(/''([^']+)''/g, '$1')   // Italic
      .replace(/<br\s*\/?>/gi, ' ')    // Line breaks
      .replace(/<small>(.*?)<\/small>/gi, '$1') // Small text
      .replace(/<[^>]+>/g, '')         // Other HTML tags
      .replace(/\s+/g, ' ')            // Multiple spaces
      .trim();
    
    // If it's still a complex template that we couldn't process, return a clean version
    if (cleaned.includes('{{') && cleaned.includes('}}')) {
      // Try to extract meaningful content from unprocessed templates
      const templateContent = cleaned.match(/\{\{[^}]*\}\}/g);
      if (templateContent) {
        // Remove the template syntax and just keep the content
        cleaned = cleaned.replace(/\{\{[^}]*\}\}/g, '').trim();
        if (!cleaned) {
          // If nothing left, try to extract text from the template
          const textMatch = value.match(/([A-Za-z][A-Za-z\s]{5,})/);
          if (textMatch && textMatch[1]) {
            cleaned = textMatch[1].trim();
          }
        }
      }
    }
    
    return cleaned;
  }
}

// Export singleton instance
export const ixnayWiki = new IxnayWikiService();