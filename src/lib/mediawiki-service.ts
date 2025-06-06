// Enhanced ixwiki.com API integration with complete template parsing
import { MEDIAWIKI_CONFIG, buildApiUrl } from '~/lib/mediawiki-config';

// Main interface that allows additional dynamic string properties
export interface CountryInfobox {
  name: string;
  // Raw template data - excluded from index signature
  rawWikitext?: string;
  parsedTemplateData?: Record<string, string>;
  
  // Fully rendered HTML from MediaWiki parser - excluded from index signature  
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
  flag_caption?: string;
  alt_map?: string;
  image_map2?: string;
  alt_map2?: string;
  map_caption?: string;
  map_caption2?: string;
  
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
  leader_title3?: string;
  leader_name3?: string;
  leader_title4?: string;
  leader_name4?: string;
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
  
  // Population data (excluded from structured display since pulled from ixstats)
  population_estimate?: string;
  population_census?: string;
  population?: string;
  population_density_km2?: string;
  population_density?: string;
  
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
  
  // Historical data - comprehensive establishment events
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
  established_event7?: string;
  established_date7?: string;
  established_event8?: string;
  established_date8?: string;
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

// Allow additional dynamic string properties via intersection type
export type CountryInfoboxWithDynamicProps = CountryInfobox & {
  [key: string]: string | undefined | Record<string, string>;
};

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

class IxnayWikiService {
  private readonly API_BASE_URL = `${MEDIAWIKI_CONFIG.baseUrl}${MEDIAWIKI_CONFIG.apiEndpoint}`;
  private readonly FLAG_CACHE = new Map<string, CacheEntry<string | null>>();
  private readonly INFOBOX_CACHE = new Map<string, CacheEntry<CountryInfoboxWithDynamicProps | null>>();
  private readonly TEMPLATE_CACHE = new Map<string, CacheEntry<string | null>>();
  private readonly FILE_CACHE = new Map<string, CacheEntry<string | null>>();
  private readonly WIKITEXT_CACHE = new Map<string, CacheEntry<string | null>>();
  private readonly RENDERED_HTML_CACHE = new Map<string, CacheEntry<string | null>>();
  
  // Request queue to prevent rate limiting
  private readonly REQUEST_QUEUE = new Map<string, Promise<any>>();
  private isPreloading = false;
  private cleanupInterval: NodeJS.Timeout | null = null;
  
  // Cache TTLs (in milliseconds)
  private readonly FLAG_TTL = MEDIAWIKI_CONFIG.cache.flagTtl;
  private readonly INFOBOX_TTL = MEDIAWIKI_CONFIG.cache.infoboxTtl;
  private readonly TEMPLATE_TTL = MEDIAWIKI_CONFIG.cache.templateTtl;
  private readonly FILE_TTL = MEDIAWIKI_CONFIG.cache.flagTtl;
  private readonly WIKITEXT_TTL = MEDIAWIKI_CONFIG.cache.infoboxTtl;
  private readonly RENDERED_HTML_TTL = MEDIAWIKI_CONFIG.cache.infoboxTtl;
  
  constructor() {
    // Start cache cleanup interval
    this.startCacheCleanup();
  }
  
  /**
   * Start periodic cache cleanup
   */
  private startCacheCleanup(): void {
    if (this.cleanupInterval) return;
    
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredEntries();
    }, 10 * 60 * 1000); // Clean every 10 minutes
  }

  /**
   * Clean up expired cache entries and enforce size limits
   */
  private cleanupExpiredEntries(): void {
    const now = Date.now();
    const maxSize = MEDIAWIKI_CONFIG.cache.maxSize;
    
    // Helper function to clean up a specific cache
    const cleanupCache = <T>(cache: Map<string, CacheEntry<T>>, name: string) => {
      const beforeSize = cache.size;
      
      // Remove expired entries
      for (const [key, entry] of cache.entries()) {
        if (now - entry.timestamp >= entry.ttl) {
          cache.delete(key);
        }
      }
      
      // Enforce size limit by removing oldest entries
      if (cache.size > maxSize) {
        const entries = Array.from(cache.entries())
          .sort(([,a], [,b]) => a.timestamp - b.timestamp);
        
        const toRemove = cache.size - maxSize;
        for (let i = 0; i < toRemove; i++) {
          const entry = entries[i];
          if (entry) {
            cache.delete(entry[0]);
          }
        }
      }
      
      const afterSize = cache.size;
      if (beforeSize !== afterSize && process.env.NODE_ENV !== 'production') {
        console.log(`[MediaWiki] ${name} cache cleanup: ${beforeSize} -> ${afterSize}`);
      }
    };
    
    // Clean up each cache
    cleanupCache(this.FLAG_CACHE, 'FLAG');
    cleanupCache(this.INFOBOX_CACHE, 'INFOBOX');
    cleanupCache(this.TEMPLATE_CACHE, 'TEMPLATE');
    cleanupCache(this.FILE_CACHE, 'FILE');
    cleanupCache(this.WIKITEXT_CACHE, 'WIKITEXT');
    cleanupCache(this.RENDERED_HTML_CACHE, 'RENDERED_HTML');
  }

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
   * Set cache value with TTL and size enforcement
   */
  private setCacheValue<T>(cache: Map<string, CacheEntry<T>>, key: string, value: T, ttl: number): void {
    // Enforce cache size limit
    if (cache.size >= MEDIAWIKI_CONFIG.cache.maxSize) {
      // Remove oldest entry
      const oldestKey = cache.keys().next().value;
      if (oldestKey) {
        cache.delete(oldestKey);
      }
    }
    
    cache.set(key, {
      data: value,
      timestamp: Date.now(),
      ttl
    });
  }

  /**
   * Deduplicate requests to prevent multiple concurrent requests for the same resource
   */
  private async getOrCreateRequest<T>(key: string, requestFn: () => Promise<T>): Promise<T> {
    const existingRequest = this.REQUEST_QUEUE.get(key);
    if (existingRequest) {
      console.log(`[MediaWiki] Deduplicating request for: ${key}`);
      return existingRequest;
    }

    const request = requestFn().finally(() => {
      this.REQUEST_QUEUE.delete(key);
    });

    this.REQUEST_QUEUE.set(key, request);
    return request;
  }

  /**
   * Delay function for rate limiting
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get raw wikitext for a page using MediaWiki API via Next.js API route to avoid CORS issues
   */
  async getPageWikitext(pageName: string): Promise<string | null> {
    const cacheKey = `wikitext_${pageName.toLowerCase()}`;
    const cached = this.getCacheValue(this.WIKITEXT_CACHE, cacheKey);
    if (cached !== null) {
      return cached;
    }

    try {
      console.log(`[MediaWiki] Getting raw wikitext for: ${pageName}`);
      
      const params = new URLSearchParams({
        action: 'query',
        prop: 'revisions',
        rvprop: 'content',
        titles: pageName,
        rvsection: '0', // Get only section 0 (intro section with infobox)
        format: 'json',
        formatversion: '2'
      });

      const apiUrl = `/api/mediawiki?${params.toString()}`;
      console.log(`[MediaWiki] Fetching wikitext via Next.js API route`);

      const response = await fetch(apiUrl, {
        headers: {
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
   * Parse raw wikitext to HTML using MediaWiki parser via Next.js API route to avoid CORS issues
   */
  async parseWikitextToHtml(wikitext: string, title?: string): Promise<string | null> {
    const cacheKey = `rendered_${title || 'unknown'}_${wikitext.substring(0, 100)}`;
    const cached = this.getCacheValue(this.RENDERED_HTML_CACHE, cacheKey);
    if (cached !== null) {
      return cached;
    }

    try {
      console.log(`[MediaWiki] Parsing wikitext to HTML (${wikitext.length} chars)`);
      
      const requestData = {
        action: 'parse',
        text: wikitext,
        format: 'json',
        formatversion: '2',
        prop: 'text',
        contentmodel: 'wikitext'
      };

      if (title) {
        (requestData as any).title = title;
      }

      // Determine if we should use GET or POST based on wikitext length
      const isLongContent = wikitext.length > 1500;
      
      let response;
      
      if (isLongContent) {
        // Use POST for long content to avoid URI too long errors
        console.log(`[MediaWiki] Using POST for long wikitext (${wikitext.length} chars)`);
        
        response = await fetch('/api/mediawiki', {
          method: 'POST',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestData),
          cache: 'no-store'
        });
      } else {
        // Use GET for short content
        const params = new URLSearchParams();
        Object.keys(requestData).forEach(key => {
          params.set(key, (requestData as any)[key]);
        });

        const apiUrl = `/api/mediawiki?${params.toString()}`;
        console.log(`[MediaWiki] Using GET for short wikitext`);

        response = await fetch(apiUrl, {
          headers: {
            'Accept': 'application/json',
          },
          cache: 'no-store'
        });
      }

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
   * Extract Infobox country template from wikitext with enhanced pattern matching and robust brace counting
   */
  extractInfoboxTemplate(wikitext: string): string | null {
    try {
      console.log(`[MediaWiki] Extracting infobox template from wikitext (${wikitext.length} chars)`);
      
      // First, find where the infobox starts
      const infoboxStartPatterns = [
        /\{\{\s*Infobox\s+country/i,
        /\{\{\s*Infobox_country/i,
        /\{\{\s*Country\s+infobox/i,
        /\{\{\s*Country_infobox/i,
      ];

      let startMatch = null;
      let startIndex = -1;
      
      for (const pattern of infoboxStartPatterns) {
        const match = wikitext.match(pattern);
        if (match) {
          startMatch = match;
          startIndex = wikitext.indexOf(match[0]);
          console.log(`[MediaWiki] Found infobox start pattern at index ${startIndex}: ${match[0]}`);
          break;
        }
      }

      if (!startMatch || startIndex === -1) {
        console.warn(`[MediaWiki] No infobox country template found in wikitext`);
        return null;
      }

      // Now find the complete template by counting braces
      let braceDepth = 0;
      let templateEnd = wikitext.length;
      let i = startIndex;
      
      while (i < wikitext.length - 1) {
        const char = wikitext[i];
        const nextChar = wikitext[i + 1];
        
        if (char === '{' && nextChar === '{') {
          braceDepth++;
          i += 2;
        } else if (char === '}' && nextChar === '}') {
          braceDepth--;
          if (braceDepth === 0) {
            templateEnd = i + 2; // Include the closing }}
            break;
          }
          i += 2;
        } else {
          i++;
        }
      }

      const templateContent = wikitext.substring(startIndex, templateEnd);
      console.log(`[MediaWiki] Extracted complete infobox template: ${templateContent.length} characters`);
      
      // Log some stats about the extracted template
      const paramCount = (templateContent.match(/\|\s*[^=\|\n]+\s*=/g) || []).length;
      console.log(`[MediaWiki] Template appears to contain approximately ${paramCount} parameters`);
      
      return templateContent;

    } catch (error) {
      console.error(`[MediaWiki] Error extracting infobox template:`, error);
      return null;
    }
  }

  /**
   * Enhanced parser for infobox template parameters using two-phase approach
   */
  async parseInfoboxParameters(templateWikitext: string): Promise<Record<string, string>> {
    const parameters: Record<string, string> = {};
    
    try {
      console.log(`[MediaWiki] Two-phase parsing of infobox parameters from template (${templateWikitext.length} chars)`);
      
      // Extract just the content between {{Infobox country and }}
      const content = this.extractTemplateContent(templateWikitext);
      if (!content) {
        console.error('[MediaWiki] Could not extract template content');
        return parameters;
      }
      
      console.log(`[MediaWiki] Extracted content: ${content.length} characters`);
      
      // Phase 1: Find all parameter boundaries
      const parameterBoundaries = this.findParameterBoundaries(content);
      console.log(`[MediaWiki] Phase 1: Found ${parameterBoundaries.length} parameter boundaries`);
      
      // Phase 2: Extract parameter values using boundaries
      const parsedParams = this.extractParameterValues(content, parameterBoundaries);
      console.log(`[MediaWiki] Phase 2: Extracted ${Object.keys(parsedParams).length} parameters`);
      
      // Clean and process each parameter
      for (const [key, value] of Object.entries(parsedParams)) {
        if (key && value !== undefined) {
          // Don't clean parameter values that contain templates yet - we'll process them later
          let processedValue = value.trim();
          
          // Only do basic cleaning for non-template values
          if (!processedValue.includes('{{')) {
            processedValue = this.cleanParameterValue(processedValue);
          }
          
          parameters[key] = processedValue;
          console.log(`[MediaWiki] Parameter: ${key} = ${processedValue.substring(0, 100)}${processedValue.length > 100 ? '...' : ''}`);
        }
      }
      
      console.log(`[MediaWiki] Successfully parsed ${Object.keys(parameters).length} total parameters`);
      console.log(`[MediaWiki] All parameters: ${Object.keys(parameters).join(', ')}`);
      
      return parameters;

    } catch (error) {
      console.error(`[MediaWiki] Error in two-phase parsing:`, error);
      // Fallback to regex-based parsing
      const content = this.extractTemplateContent(templateWikitext);
      return this.regexFallbackParsing(content || templateWikitext);
    }
  }

  /**
   * Phase 1: Find all parameter boundaries in the template content
   */
  private findParameterBoundaries(content: string): Array<{name: string, start: number, nameEnd: number}> {
    const boundaries: Array<{name: string, start: number, nameEnd: number}> = [];
    
    // Use regex to find all potential parameter starts: |param_name =
    const parameterPattern = /\|\s*([^=\|\{\[\n]+?)\s*=/g;
    let match;
    
    while ((match = parameterPattern.exec(content)) !== null) {
      const paramName = match[1]?.trim();
      if (paramName && paramName.length > 0) {
        const start = match.index;
        const nameEnd = match.index + match[0].length;
        
        boundaries.push({
          name: paramName,
          start: start,
          nameEnd: nameEnd
        });
        console.log(`[MediaWiki] Found parameter boundary: ${paramName} at position ${start}`);
      }
    }
    
    return boundaries;
  }

  /**
   * Phase 2: Extract parameter values using the boundaries
   */
  private extractParameterValues(content: string, boundaries: Array<{name: string, start: number, nameEnd: number}>): Record<string, string> {
    const parameters: Record<string, string> = {};
    
    for (let i = 0; i < boundaries.length; i++) {
      const current = boundaries[i];
      const next = boundaries[i + 1];
      
      if (!current) continue;
      
      const valueStart = current.nameEnd;
      const valueEnd = next ? next.start : content.length;
      
      let rawValue = content.substring(valueStart, valueEnd);
      
      // Clean up the raw value
      rawValue = rawValue.trim();
      
      // Remove trailing | if it exists (from next parameter)
      if (rawValue.endsWith('|')) {
        rawValue = rawValue.slice(0, -1).trim();
      }
      
      parameters[current.name] = rawValue;
      console.log(`[MediaWiki] Extracted ${current.name}: ${rawValue.substring(0, 150)}${rawValue.length > 150 ? '...' : ''}`);
    }
    
    return parameters;
  }

  /**
   * Regex-based fallback parsing for when the two-phase approach fails
   */
  private regexFallbackParsing(content: string): Record<string, string> {
    const parameters: Record<string, string> = {};
    
    console.log(`[MediaWiki] Using regex fallback parsing`);
    
    // Split content into lines first, then process line by line
    const lines = content.split('\n');
    let currentParam = '';
    let currentValue = '';
    let inMultilineParam = false;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!line) continue;
      
      const trimmedLine = line.trim();
      
      // Check if this line starts a new parameter
      const paramMatch = trimmedLine.match(/^\|\s*([^=]+?)\s*=\s*(.*)$/);
      
      if (paramMatch) {
        // Save previous parameter if we have one
        if (inMultilineParam && currentParam) {
          parameters[currentParam] = currentValue.trim();
          console.log(`[MediaWiki] Regex fallback - ${currentParam}: ${currentValue.substring(0, 100)}${currentValue.length > 100 ? '...' : ''}`);
        }
        
        // Start new parameter
        const paramName = paramMatch[1]?.trim();
        if (paramName) {
          currentParam = paramName;
          currentValue = paramMatch[2] || '';
          inMultilineParam = true;
          
          // Check if this parameter value spans multiple lines by looking for unbalanced structures
          const openBraces = (currentValue.match(/\{\{/g) || []).length;
          const closeBraces = (currentValue.match(/\}\}/g) || []).length;
          const openBrackets = (currentValue.match(/\[\[/g) || []).length;
          const closeBrackets = (currentValue.match(/\]\]/g) || []).length;
          
          if (openBraces === closeBraces && openBrackets === closeBrackets && !currentValue.includes('{{')) {
            // This parameter is complete on one line
            parameters[currentParam] = this.cleanParameterValue(currentValue);
            console.log(`[MediaWiki] Regex fallback - ${currentParam}: ${currentValue.substring(0, 100)}${currentValue.length > 100 ? '...' : ''}`);
            inMultilineParam = false;
          }
        }
      } else if (inMultilineParam) {
        // Continue the current parameter value
        currentValue += '\n' + trimmedLine;
        
        // Check if we've balanced the structures
        const openBraces = (currentValue.match(/\{\{/g) || []).length;
        const closeBraces = (currentValue.match(/\}\}/g) || []).length;
        const openBrackets = (currentValue.match(/\[\[/g) || []).length;
        const closeBrackets = (currentValue.match(/\]\]/g) || []).length;
        
        if (openBraces === closeBraces && openBrackets === closeBrackets) {
          // This parameter is now complete
          parameters[currentParam] = currentValue.trim();
          console.log(`[MediaWiki] Regex fallback - ${currentParam}: ${currentValue.substring(0, 100)}${currentValue.length > 100 ? '...' : ''}`);
          inMultilineParam = false;
        }
      }
    }
    
    // Save the last parameter if we have one
    if (inMultilineParam && currentParam) {
      parameters[currentParam] = currentValue.trim();
      console.log(`[MediaWiki] Regex fallback - ${currentParam}: ${currentValue.substring(0, 100)}${currentValue.length > 100 ? '...' : ''}`);
    }
    
    return parameters;
  }

  /**
   * Extract the content between {{Infobox country and }} with improved robustness
   */
  private extractTemplateContent(templateWikitext: string): string | null {
    const trimmed = templateWikitext.trim();
    
    // Find the start after "{{Infobox country" with more flexible matching
    const startPatterns = [
      /^\{\{\s*Infobox\s+country\s*/i,
      /^\{\{\s*Infobox_country\s*/i,
      /^\{\{\s*infobox\s*country\s*/i
    ];
    
    let startMatch = null;
    let contentStart = 0;
    
    for (const pattern of startPatterns) {
      startMatch = trimmed.match(pattern);
      if (startMatch) {
        contentStart = startMatch[0].length;
        break;
      }
    }
    
    if (!startMatch) {
      console.error('[MediaWiki] Could not find infobox start pattern');
      return null;
    }
    
    console.log(`[MediaWiki] Found infobox start at position ${contentStart}`);
    
    // Find the matching closing }} by counting braces more carefully
    let braceDepth = 1; // We already have the opening {{
    let contentEnd = trimmed.length;
    let i = contentStart;
    
    while (i < trimmed.length - 1) {
      const char = trimmed[i];
      const nextChar = trimmed[i + 1];
      
      if (char === '{' && nextChar === '{') {
        braceDepth++;
        console.log(`[MediaWiki] Found {{ at position ${i}, depth now ${braceDepth}`);
        i += 2; // Skip both chars
      } else if (char === '}' && nextChar === '}') {
        braceDepth--;
        console.log(`[MediaWiki] Found }} at position ${i}, depth now ${braceDepth}`);
        if (braceDepth === 0) {
          contentEnd = i;
          break;
        }
        i += 2; // Skip both chars
      } else {
        i++;
      }
    }
    
    const extractedContent = trimmed.substring(contentStart, contentEnd);
    console.log(`[MediaWiki] Extracted template content: ${extractedContent.length} characters (from ${contentStart} to ${contentEnd})`);
    
    // Validate that we have a reasonable amount of content
    if (extractedContent.length < 100) {
      console.warn(`[MediaWiki] Extracted content seems too short (${extractedContent.length} chars), might be incomplete`);
      console.log(`[MediaWiki] Content preview: ${extractedContent.substring(0, 200)}`);
    }
    
    return extractedContent;
  }

  /**
   * Get country infobox data with complete template parsing
   */
  async getCountryInfobox(countryName: string): Promise<CountryInfoboxWithDynamicProps | null> {
    // Check cache first
    const cached = this.getCacheValue(this.INFOBOX_CACHE, countryName) as CountryInfoboxWithDynamicProps | null;
    if (cached !== null) {
      console.log(`[MediaWiki] Infobox cache hit for: ${countryName}`);
      return cached;
    }

    return this.getOrCreateRequest(`infobox_${countryName}`, async () => {
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

      // Step 3: Parse template parameters with enhanced logic
      const templateData = await this.parseInfoboxParameters(infoboxTemplate);

      // Step 4: Skip HTML rendering for now to avoid API errors
      // const renderedHtml = await this.parseWikitextToHtml(infoboxTemplate, countryName);
      const renderedHtml = null;

      // Step 5: Create the infobox object
      const infobox: CountryInfoboxWithDynamicProps = {
        name: countryName,
        rawWikitext: infoboxTemplate,
        parsedTemplateData: templateData,
        renderedHtml: renderedHtml || undefined,
      };

      // Step 6: Map template parameters to infobox properties (including dynamic ones)
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
    });
  }

  /**
   * Map template data to infobox properties with comprehensive field support
   */
  private mapTemplateDataToInfobox(templateData: Record<string, string>, infobox: CountryInfoboxWithDynamicProps): void {
    // Map ALL template parameters to the infobox object (not just predefined ones)
    for (const [key, value] of Object.entries(templateData)) {
      if (key && value && value.trim()) {
        (infobox as any)[key] = value;
      }
    }

    console.log(`[MediaWiki] Mapped ALL ${Object.keys(templateData).length} template parameters to infobox`);
  }

  /**
   * Enhanced template processing that handles all nested templates
   */
  async processSpecialTemplates(infobox: CountryInfoboxWithDynamicProps): Promise<void> {
    if (!infobox.parsedTemplateData) return;

    try {
      console.log(`[MediaWiki] Enhanced processing of special templates in infobox parameters`);
      
      for (const [key, value] of Object.entries(infobox.parsedTemplateData)) {
        if (value && value.includes('{{')) {
          console.log(`[MediaWiki] Processing templates in parameter: ${key}`);
          
          // Enhanced template processing
          let processedValue = value;
          
          // Handle Switcher templates specifically
          if (value.includes('{{Switcher') || value.includes('{{switcher')) {
            processedValue = this.enhancedSwitcherProcessing(value);
          }
          // Handle other common templates - disabled to avoid API errors
          // else if (value.includes('{{')) {
          //   processedValue = await this.processGenericTemplates(value);
          // }
          
          if (processedValue && processedValue !== value) {
            // Update the parsed data
            infobox.parsedTemplateData[key] = processedValue;
            
            // Update the infobox property
            (infobox as any)[key] = processedValue;
            
            console.log(`[MediaWiki] Enhanced processing of ${key}:`);
            console.log(`  Original: ${value.substring(0, 100)}${value.length > 100 ? '...' : ''}`);
            console.log(`  Processed: ${processedValue.substring(0, 100)}${processedValue.length > 100 ? '...' : ''}`);
          }
        }
      }
      
    } catch (error) {
      console.error(`[MediaWiki] Error in enhanced template processing:`, error);
    }
  }

  /**
   * Enhanced Switcher template processing with better parsing
   */
  private enhancedSwitcherProcessing(switcherTemplate: string): string {
    try {
      console.log(`[MediaWiki] Enhanced Switcher processing: ${switcherTemplate.substring(0, 200)}...`);
      
      // More robust extraction of Switcher content
      const switcherMatch = switcherTemplate.match(/\{\{\s*Switcher\s*\|([\s\S]*)\}\}/i);
      if (!switcherMatch || !switcherMatch[1]) {
        console.log('[MediaWiki] No Switcher match found');
        return switcherTemplate;
      }

      const content = switcherMatch[1];
      console.log(`[MediaWiki] Switcher content: ${content.substring(0, 200)}...`);
      
      // Enhanced splitting that respects nested structures
      const parts = this.splitSwitcherContent(content);
      console.log(`[MediaWiki] Switcher split into ${parts.length} parts`);
      
      if (parts.length === 0) {
        return switcherTemplate;
      }

      // Log each part for debugging
      parts.forEach((part, index) => {
        console.log(`[MediaWiki] Switcher part ${index}: ${part.substring(0, 100)}${part.length > 100 ? '...' : ''}`);
      });

      // Strategy 1: Look for file references (for image_map type parameters)
      for (const part of parts) {
        const cleanPart = part.trim();
        
        // Check for File: references in various formats
        const filePatterns = [
          /\[\[File:([^\|\]]+)/i,
          /File:([^\|\]\s]+)/i,
          /([^\/\s\[\]]+\.(?:png|jpg|jpeg|gif|svg|webp))/i
        ];
        
        for (const pattern of filePatterns) {
          const fileMatch = cleanPart.match(pattern);
          if (fileMatch && fileMatch[1]) {
            const fileName = fileMatch[1].trim();
            console.log(`[MediaWiki] Found file in Switcher: ${fileName}`);
            return fileName;
          }
        }
      }

      // Strategy 2: Look for meaningful text content (non-file)
      for (const part of parts) {
        const cleaned = this.cleanParameterValue(part);
        if (cleaned && 
            cleaned.length > 5 && 
            !cleaned.toLowerCase().includes('file:') && 
            !cleaned.includes('.png') && 
            !cleaned.includes('.jpg') &&
            !cleaned.includes('.svg')) {
          console.log(`[MediaWiki] Found text content in Switcher: ${cleaned.substring(0, 100)}...`);
          return cleaned;
        }
      }

      // Strategy 3: Return first non-empty part, cleaned
      for (const part of parts) {
        const cleaned = this.cleanParameterValue(part);
        if (cleaned && cleaned.length > 1) {
          console.log(`[MediaWiki] Fallback Switcher result: ${cleaned.substring(0, 100)}...`);
          return cleaned;
        }
      }

      // Final fallback
      const fallback = this.cleanParameterValue(parts[0] || switcherTemplate);
      console.log(`[MediaWiki] Final Switcher fallback: ${fallback.substring(0, 100)}...`);
      return fallback;

    } catch (error) {
      console.error(`[MediaWiki] Error in enhanced Switcher processing:`, error);
      return switcherTemplate;
    }
  }

  /**
   * Split Switcher content while respecting nested structures
   */
  private splitSwitcherContent(content: string): string[] {
    const parts: string[] = [];
    let currentPart = '';
    let braceDepth = 0;
    let bracketDepth = 0;
    
    for (let i = 0; i < content.length; i++) {
      const char = content[i];
      const nextChar = i + 1 < content.length ? content[i + 1] : '';
      
      if (char === '{' && nextChar === '{') {
        braceDepth++;
        currentPart += char + nextChar;
        i++; // Skip next char
      } else if (char === '}' && nextChar === '}') {
        braceDepth--;
        currentPart += char + nextChar;
        i++; // Skip next char
      } else if (char === '[' && nextChar === '[') {
        bracketDepth++;
        currentPart += char + nextChar;
        i++; // Skip next char
      } else if (char === ']' && nextChar === ']') {
        bracketDepth--;
        currentPart += char + nextChar;
        i++; // Skip next char
      } else if (char === '|' && braceDepth === 0 && bracketDepth === 0) {
        // This is a separator at the top level
        if (currentPart.trim()) {
          parts.push(currentPart.trim());
        }
        currentPart = '';
      } else {
        currentPart += char;
      }
    }
    
    // Add the last part
    if (currentPart.trim()) {
      parts.push(currentPart.trim());
    }
    
    return parts;
  }

  /**
   * Process generic templates by trying to render them or extract meaningful content
   */
  private async processGenericTemplates(templateValue: string): Promise<string> {
    try {
      // Try to render the template via MediaWiki API
      const rendered = await this.parseWikitextToHtml(templateValue);
      if (rendered) {
        // Extract text content from HTML, preserving structure
        let textContent = rendered
          .replace(/<br\s*\/?>/gi, ' ')
          .replace(/<\/p><p>/gi, ' ')
          .replace(/<[^>]+>/g, '')
          .replace(/\s+/g, ' ')
          .trim();
        
        // If the rendered content is reasonable, use it
        if (textContent && textContent.length > 0 && textContent.length < templateValue.length * 3) {
          return textContent;
        }
      }
      
      // If rendering failed, try to extract meaningful content manually
      return this.extractTemplateContentManually(templateValue) || templateValue;
      
    } catch (error) {
      console.error(`[MediaWiki] Error processing generic template:`, error);
      return templateValue;
    }
  }

  /**
   * Manually extract content from templates when API parsing fails
   */
  private extractTemplateContentManually(templateValue: string): string | null {
    try {
      // Try to extract meaningful text from common template patterns
      const patterns = [
        // Extract text from {{template|text}} patterns
        /\{\{[^}]+\|([^}]+)\}\}/,
        // Extract text from {{template|param=text}} patterns
        /\{\{[^}]+\|[^=]+=([^}|]+)[\|}]/,
        // Extract any standalone text outside templates
        /([A-Za-z][A-Za-z\s]{10,})/
      ];

      for (const pattern of patterns) {
        const match = templateValue.match(pattern);
        if (match && match[1]) {
          const extracted = match[1].trim();
          if (extracted.length > 5) {
            return this.cleanParameterValue(extracted);
          }
        }
      }

      return null;
    } catch (error) {
      console.error('[MediaWiki] Error in manual template extraction:', error);
      return null;
    }
  }

  /**
   * Get flag URL for a country by extracting from Country_data template
   */
  async getFlagUrl(countryName: string): Promise<string | null> {
    const cached = this.getCacheValue(this.FLAG_CACHE, countryName);
    if (cached !== null) {
      console.log(`[MediaWiki] Flag cache hit for: ${countryName}`);
      return cached;
    }

    return this.getOrCreateRequest(`flag_${countryName}`, async () => {
      try {
        console.log(`[MediaWiki] Getting flag for: ${countryName}`);
        
        // First try to get flag from Country_data template (most reliable)
        const countryDataTemplateName = `Template:Country_data_${countryName}`;
        const templateContent = await this.getTemplate(countryDataTemplateName);
        
        if (templateContent) {
          console.log(`[MediaWiki] Found Country_data template for ${countryName}`);
          const flagFileName = this.extractFlagFromCountryDataTemplate(templateContent);
          
          if (flagFileName) {
            console.log(`[MediaWiki] Extracted flag filename from Country_data template: ${flagFileName}`);
            const flagUrl = await this.getFileUrl(flagFileName);
            if (flagUrl) {
              console.log(`[MediaWiki] Successfully got flag URL from Country_data template: ${flagUrl}`);
              this.setCacheValue(this.FLAG_CACHE, countryName, flagUrl, this.FLAG_TTL);
              return flagUrl;
            }
          }
        } else {
          console.log(`[MediaWiki] No Country_data template found for ${countryName}`);
        }
        
        // Fallback: Get flag from country infobox
        const infobox = await this.getCountryInfobox(countryName);
        if (infobox) {
          console.log(`[MediaWiki] Falling back to infobox for ${countryName}`);
          // Try multiple flag-related fields from the infobox
          const flagFields = [
            infobox.image_flag,
            infobox.flag,
            infobox.flag_caption, // Sometimes flag info is in caption
          ];
          
          for (const flagFile of flagFields) {
            if (flagFile && flagFile.trim()) {
              console.log(`[MediaWiki] Trying flag field: ${flagFile}`);
              
              // Clean the flag file name - remove File: prefix if present
              let cleanFlagFile = flagFile.trim();
              if (cleanFlagFile.startsWith('File:')) {
                cleanFlagFile = cleanFlagFile.substring(5);
              }
              
              const flagUrl = await this.getFileUrl(cleanFlagFile);
              if (flagUrl) {
                console.log(`[MediaWiki] Successfully got flag URL from infobox: ${flagUrl}`);
                this.setCacheValue(this.FLAG_CACHE, countryName, flagUrl, this.FLAG_TTL);
                return flagUrl;
              } else {
                console.log(`[MediaWiki] Failed to get URL for flag file: ${cleanFlagFile}`);
              }
            }
          }
          
          console.log(`[MediaWiki] No valid flag file found in infobox for ${countryName}`);
          console.log(`[MediaWiki] Available infobox fields:`, Object.keys(infobox).join(', '));
        } else {
          console.log(`[MediaWiki] No infobox found for ${countryName}`);
        }

        // No flag found
        this.setCacheValue(this.FLAG_CACHE, countryName, null, this.FLAG_TTL);
        return null;

      } catch (error) {
        console.error(`[MediaWiki] Error getting flag for ${countryName}:`, error);
        this.setCacheValue(this.FLAG_CACHE, countryName, null, this.FLAG_TTL);
        return null;
      }
    });
  }



  /**
   * Extract flag filename from Country_data template content
   */
  private extractFlagFromCountryDataTemplate(templateContent: string): string | null {
    try {
      console.log(`[MediaWiki] Extracting flag from Country_data template (${templateContent.length} chars)`);
      if (process.env.NODE_ENV !== 'production') {
        console.log(`[MediaWiki] Template content preview: ${templateContent.substring(0, 500)}...`);
      }
      
      // Look for file alias line patterns in Country_data templates
      // Common patterns:
      // | alias = Flag of X.svg
      // | alias-flag = Flag of X.svg  
      // | flag alias = Flag of X.svg
      const aliasPatterns = [
        /\|\s*alias\s*=\s*([^|\n\r]+)/i,
        /\|\s*alias-flag\s*=\s*([^|\n\r]+)/i,
        /\|\s*flag\s*alias\s*=\s*([^|\n\r]+)/i,
        /\|\s*flag-alias\s*=\s*([^|\n\r]+)/i,
        /\|\s*flag\s*=\s*([^|\n\r]+)/i,
      ];
      
      for (const pattern of aliasPatterns) {
        const match = templateContent.match(pattern);
        if (match && match[1]) {
          let flagFileName = match[1].trim();
          
          // Clean up the flag filename
          flagFileName = this.cleanParameterValue(flagFileName);
          
          // Remove File: prefix if present
          if (flagFileName.toLowerCase().startsWith('file:')) {
            flagFileName = flagFileName.substring(5).trim();
          }
          
          // Validate it looks like a file
          if (flagFileName && (
            flagFileName.toLowerCase().endsWith('.svg') ||
            flagFileName.toLowerCase().endsWith('.png') ||
            flagFileName.toLowerCase().endsWith('.jpg') ||
            flagFileName.toLowerCase().endsWith('.jpeg') ||
            flagFileName.toLowerCase().endsWith('.gif')
          )) {
            console.log(`[MediaWiki] Found flag filename in Country_data template: ${flagFileName}`);
            return flagFileName;
          }
        }
      }
      
      // If no alias found, look for any line that might contain a flag filename
      const lines = templateContent.split('\n');
      for (const line of lines) {
        const trimmedLine = line.trim();
        if (trimmedLine.includes('Flag') && 
            (trimmedLine.includes('.svg') || trimmedLine.includes('.png'))) {
          
          // Extract filename from the line
          const fileMatch = trimmedLine.match(/([^|\s\[\]]+(?:Flag[^|\s\[\]]*\.(?:svg|png|jpg|jpeg|gif)))/i);
          if (fileMatch && fileMatch[1]) {
            let flagFileName = fileMatch[1].trim();
            
            // Remove File: prefix if present
            if (flagFileName.toLowerCase().startsWith('file:')) {
              flagFileName = flagFileName.substring(5).trim();
            }
            
            console.log(`[MediaWiki] Found flag filename by pattern matching: ${flagFileName}`);
            return flagFileName;
          }
        }
      }
      
      console.log(`[MediaWiki] No flag filename found in Country_data template`);
      return null;
      
    } catch (error) {
      console.error(`[MediaWiki] Error extracting flag from Country_data template:`, error);
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
      console.log(`[MediaWiki] Fetching template: ${templateName}`);
      
      const params = new URLSearchParams({
        action: 'query',
        prop: 'revisions',
        rvprop: 'content',
        titles: templateName,
        format: 'json',
        formatversion: '2'
      });
      
      const templateUrl = `/api/mediawiki?${params.toString()}`;
      
      const response = await fetch(templateUrl, {
        headers: {
          'Accept': 'application/json'
        },
        cache: 'no-store'
      });
      
      if (!response.ok) {
        console.error(`[MediaWiki] HTTP Error fetching template ${templateName}: ${response.status}`);
        this.setCacheValue(this.TEMPLATE_CACHE, templateName, null, this.TEMPLATE_TTL);
        return null;
      }
      
      const data = await response.json();
      
      if (data.error) {
        console.warn(`[MediaWiki] API Error fetching template ${templateName}:`, data.error);
        this.setCacheValue(this.TEMPLATE_CACHE, templateName, null, this.TEMPLATE_TTL);
        return null;
      }
      
      // Navigate the response structure: query.pages[pageId].revisions[0].content
      const pages = data.query?.pages;
      if (!pages || !Array.isArray(pages) || pages.length === 0) {
        console.warn(`[MediaWiki] No pages found for template ${templateName}`);
        this.setCacheValue(this.TEMPLATE_CACHE, templateName, null, this.TEMPLATE_TTL);
        return null;
      }

      const page = pages[0];
      if (!page || page.missing) {
        console.warn(`[MediaWiki] Template ${templateName} not found or missing`);
        this.setCacheValue(this.TEMPLATE_CACHE, templateName, null, this.TEMPLATE_TTL);
        return null;
      }

      const revisions = page.revisions;
      if (!revisions || !Array.isArray(revisions) || revisions.length === 0) {
        console.warn(`[MediaWiki] No revisions found for template ${templateName}`);
        this.setCacheValue(this.TEMPLATE_CACHE, templateName, null, this.TEMPLATE_TTL);
        return null;
      }

      const revision = revisions[0];
      const content = revision?.content;
      
      if (!content) {
        console.warn(`[MediaWiki] No content found in revision for template ${templateName}`);
        this.setCacheValue(this.TEMPLATE_CACHE, templateName, null, this.TEMPLATE_TTL);
        return null;
      }

      console.log(`[MediaWiki] Successfully fetched template ${templateName}: ${content.length} characters`);
      
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
      console.log(`[MediaWiki] Getting file URL for: ${cleanFileName}`);
      
      const params = new URLSearchParams({
        action: 'query',
        titles: `File:${cleanFileName}`,
        prop: 'imageinfo',
        iiprop: 'url',
        format: 'json',
        formatversion: '2'
      });
      
      const fileUrl = `/api/mediawiki?${params.toString()}`;
      
      const response = await fetch(fileUrl, {
        headers: {
          'Accept': 'application/json'
        },
        cache: 'no-store'
      });
      
      if (!response.ok) {
        console.error(`[MediaWiki] HTTP Error getting file ${cleanFileName}: ${response.status} ${response.statusText}`);
        this.setCacheValue(this.FILE_CACHE, cleanFileName, null, this.FILE_TTL);
        return null;
      }
      
      const data = await response.json();
      console.log(`[MediaWiki] File API response for ${cleanFileName}:`, JSON.stringify(data, null, 2));
      
      if (data.error) {
        console.warn(`[MediaWiki] API Error getting file ${cleanFileName}:`, data.error);
        this.setCacheValue(this.FILE_CACHE, cleanFileName, null, this.FILE_TTL);
        return null;
      }
      
      // Handle formatversion=2 response structure
      const pages = data.query?.pages;
      if (!pages || !Array.isArray(pages) || pages.length === 0) {
        console.warn(`[MediaWiki] No pages found for file ${cleanFileName}`);
        this.setCacheValue(this.FILE_CACHE, cleanFileName, null, this.FILE_TTL);
        return null;
      }
      
      const page = pages[0];
      if (!page) {
        console.warn(`[MediaWiki] No page data for file ${cleanFileName}`);
        this.setCacheValue(this.FILE_CACHE, cleanFileName, null, this.FILE_TTL);
        return null;
      }
      
      // Check if file has imageinfo (works for both local and Commons files)
      const imageinfo = page.imageinfo;
      if (!imageinfo || !Array.isArray(imageinfo) || imageinfo.length === 0) {
        if (page.missing) {
          console.warn(`[MediaWiki] File ${cleanFileName} is missing and has no imageinfo`);
        } else {
          console.warn(`[MediaWiki] No imageinfo found for file ${cleanFileName}`);
        }
        this.setCacheValue(this.FILE_CACHE, cleanFileName, null, this.FILE_TTL);
        return null;
      }
      
      // Log file repository info for debugging
      if (process.env.NODE_ENV !== 'production') {
        const repository = page.imagerepository || 'local';
        const status = page.missing ? 'missing locally' : 'available locally';
        console.log(`[MediaWiki] File ${cleanFileName} - Repository: ${repository}, Status: ${status}`);
      }
      
      const url = imageinfo[0]?.url;
      if (!url) {
        console.warn(`[MediaWiki] No URL found in imageinfo for file ${cleanFileName}`);
        this.setCacheValue(this.FILE_CACHE, cleanFileName, null, this.FILE_TTL);
        return null;
      }
      
      console.log(`[MediaWiki] Successfully got file URL for ${cleanFileName}: ${url}`);
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
   * Preload flags for multiple countries with intelligent batching and rate limiting
   */
  async preloadCountryFlags(countryNames: string[]): Promise<void> {
    if (countryNames.length === 0) return;
    if (this.isPreloading) {
      console.log(`[MediaWiki] Preloading already in progress, skipping`);
      return;
    }

    this.isPreloading = true;
    
    try {
      console.log(`[MediaWiki] Starting intelligent preload for ${countryNames.length} countries`);
      
      // Filter out countries that are already cached and valid
      const uncachedCountries = countryNames.filter(countryName => {
        const cached = this.getCacheValue(this.FLAG_CACHE, countryName);
        return cached === null; // Only load if not cached or cache is expired
      });
      
      console.log(`[MediaWiki] ${uncachedCountries.length} countries need flag loading (${countryNames.length - uncachedCountries.length} already cached)`);
      
      if (uncachedCountries.length === 0) {
        console.log(`[MediaWiki] All flags already cached!`);
        return;
      }

      // Process in smaller batches to avoid rate limiting
      const BATCH_SIZE = 5; // Conservative batch size
      const BATCH_DELAY = 2000; // 2 second delay between batches
      
      for (let i = 0; i < uncachedCountries.length; i += BATCH_SIZE) {
        const batch = uncachedCountries.slice(i, i + BATCH_SIZE);
        console.log(`[MediaWiki] Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(uncachedCountries.length / BATCH_SIZE)}: ${batch.join(', ')}`);
        
        const batchPromises = batch.map(async (countryName, index) => {
          // Stagger requests within the batch
          if (index > 0) {
            await this.delay(500 * index); // 500ms between each request in batch
          }
          
          try {
            const flagUrl = await this.getFlagUrl(countryName);
            if (flagUrl) {
              console.log(`[MediaWiki] ✓ Preloaded flag for ${countryName}`);
            } else {
              console.log(`[MediaWiki] ✗ No flag found for ${countryName}`);
            }
            return { countryName, success: true, flagUrl };
          } catch (error) {
            console.error(`[MediaWiki] ✗ Failed to preload flag for ${countryName}:`, error);
            return { countryName, success: false, error };
          }
        });

        await Promise.allSettled(batchPromises);
        
        // Delay between batches (except for the last batch)
        if (i + BATCH_SIZE < uncachedCountries.length) {
          console.log(`[MediaWiki] Waiting ${BATCH_DELAY}ms before next batch...`);
          await this.delay(BATCH_DELAY);
        }
      }
      
      console.log(`[MediaWiki] ✓ Completed intelligent flag preloading for ${countryNames.length} countries`);
      
    } finally {
      this.isPreloading = false;
    }
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
    
    const failedFlags = Array.from(this.FLAG_CACHE.values()).filter(entry => 
      entry.data === null
    );
    
    const totalValid = validFlags.length + validInfoboxes.length;
    const totalCaches = this.FLAG_CACHE.size + this.INFOBOX_CACHE.size + 
                       this.TEMPLATE_CACHE.size + this.FILE_CACHE.size + 
                       this.WIKITEXT_CACHE.size + this.RENDERED_HTML_CACHE.size;
    
    return {
      flags: validFlags.length,
      preloadedFlags: validFlags.length, // Same as flags for now
      failedFlags: failedFlags.length,
      infoboxes: validInfoboxes.length,
      templates: this.TEMPLATE_CACHE.size,
      files: this.FILE_CACHE.size,
      wikitext: this.WIKITEXT_CACHE.size,
      renderedHtml: this.RENDERED_HTML_CACHE.size,
      totalCaches: 6,
      cacheEfficiency: totalCaches > 0 ? (totalValid / totalCaches) * 100 : 0,
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
      cleaned = this.enhancedSwitcherProcessing(cleaned);
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