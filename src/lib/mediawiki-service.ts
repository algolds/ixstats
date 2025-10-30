// Enhanced ixwiki.com API integration with complete template parsing
import { MEDIAWIKI_CONFIG, buildApiUrl, getMediaWikiApiUrl, getWikiUserAgent, type WikiSource } from '~/lib/mediawiki-config';

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
  isoCode?: string | null;
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
export type CountryInfoboxWithDynamicProps = CountryInfobox & Record<string, string | undefined | Record<string, string>>;

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

// --- GLOBAL CONCURRENCY LIMITER AND NOT FOUND TRACKING ---
const MAX_CONCURRENT_REQUESTS = 6; // Increased from 4 to 6 to handle infobox loading better
let currentRequests = 0;
const requestQueue: Array<() => void> = [];
const NOT_FOUND_SET = new Set<string>(); // Tracks not found keys for session
const ERROR_TTL = 5 * 60 * 1000; // 5 minutes for error/null cache entries

function normalizeKey(key: string): string {
  return key ? key.toLowerCase().trim() : '';
}

function runNextRequest() {
  if (currentRequests < MAX_CONCURRENT_REQUESTS && requestQueue.length > 0) {
    const next = requestQueue.shift();
    if (next) {
      console.log(`[MediaWiki] Executing queued request. Current: ${currentRequests}, Queue: ${requestQueue.length}`);
      next();
    }
  }
}

async function throttledRequest<T>(fn: () => Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const exec = () => {
      currentRequests++;
      console.log(`[MediaWiki] Starting request. Current: ${currentRequests}, Queue: ${requestQueue.length}`);
      
      fn().then(
        (res) => {
          currentRequests--;
          console.log(`[MediaWiki] Request completed. Current: ${currentRequests}, Queue: ${requestQueue.length}`);
          runNextRequest();
          resolve(res);
        },
        (err) => {
          currentRequests--;
          console.log(`[MediaWiki] Request failed. Current: ${currentRequests}, Queue: ${requestQueue.length}`);
          runNextRequest();
          reject(err);
        }
      );
    };
    
    if (currentRequests < MAX_CONCURRENT_REQUESTS) {
      exec();
    } else {
      console.log(`[MediaWiki] Queuing request. Current: ${currentRequests}, Queue: ${requestQueue.length}`);
      requestQueue.push(exec);
    }
  });
}
// --- END GLOBAL CONCURRENCY LIMITER ---

class LRUCache<K, V> extends Map<K, V> {
  maxSize: number;
  constructor(maxSize: number) {
    super();
    this.maxSize = maxSize;
  }
  get(key: K): V | undefined {
    if (!super.has(key)) return undefined;
    const value = super.get(key)!;
    super.delete(key);
    super.set(key, value);
    return value;
  }
  set(key: K, value: V): this {
    if (super.has(key)) super.delete(key);
    super.set(key, value);
    if (super.size > this.maxSize) {
      const firstKey = super.keys().next().value;
      if (firstKey !== undefined) {
        super.delete(firstKey);
      }
    }
    return this;
  }
}

export class IxnayWikiService {
  private readonly wikiSource: WikiSource;

  private get API_BASE_URL(): string {
    return getMediaWikiApiUrl(this.wikiSource);
  }

  private get USER_AGENT(): string {
    return getWikiUserAgent(this.wikiSource);
  }

  private readonly FLAG_CACHE = new LRUCache<string, CacheEntry<string | null>>(MEDIAWIKI_CONFIG.cache.maxSize);
  private readonly INFOBOX_CACHE = new LRUCache<string, CacheEntry<CountryInfoboxWithDynamicProps | null>>(MEDIAWIKI_CONFIG.cache.maxSize);
  private readonly TEMPLATE_CACHE = new LRUCache<string, CacheEntry<string | null>>(MEDIAWIKI_CONFIG.cache.maxSize);
  private readonly FILE_CACHE = new LRUCache<string, CacheEntry<string | null>>(MEDIAWIKI_CONFIG.cache.maxSize);
  private readonly WIKITEXT_CACHE = new LRUCache<string, CacheEntry<string | null>>(MEDIAWIKI_CONFIG.cache.maxSize);
  private readonly RENDERED_HTML_CACHE = new LRUCache<string, CacheEntry<string | null>>(MEDIAWIKI_CONFIG.cache.maxSize);

  // Request deduplication
  private readonly REQUEST_QUEUE = new Map<string, Promise<any>>();
  private isPreloading = false;
  private cleanupInterval: NodeJS.Timeout | null = null;

  // Cache TTLs
  private readonly FLAG_TTL = MEDIAWIKI_CONFIG.cache.flagTtl;
  private readonly INFOBOX_TTL = MEDIAWIKI_CONFIG.cache.infoboxTtl;
  private readonly TEMPLATE_TTL = MEDIAWIKI_CONFIG.cache.templateTtl;
  private readonly FILE_TTL = MEDIAWIKI_CONFIG.cache.flagTtl;
  private readonly WIKITEXT_TTL = MEDIAWIKI_CONFIG.cache.infoboxTtl;
  private readonly RENDERED_HTML_TTL = MEDIAWIKI_CONFIG.cache.infoboxTtl;

  constructor(wikiSource: WikiSource = 'ixwiki') {
    this.wikiSource = wikiSource;
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
    const normKey = normalizeKey(key);
    if (NOT_FOUND_SET.has(normKey)) return null;
    const entry = cache.get(normKey);
    if (this.isCacheValid(entry)) {
      return entry!.data;
    }
    if (entry) {
      cache.delete(normKey);
    }
    return null;
  }
  
  /**
   * Set cache value with TTL and size enforcement
   */
  private setCacheValue<T>(cache: Map<string, CacheEntry<T>>, key: string, value: T, ttl: number): void {
    const normKey = normalizeKey(key);
    // Use error TTL for null/error values
    const useTtl = value === null ? ERROR_TTL : ttl;
    cache.set(normKey, {
      data: value,
      timestamp: Date.now(),
      ttl: useTtl
    });
    if (value === null) NOT_FOUND_SET.add(normKey);
  }

  /**
   * Deduplicate requests to prevent multiple concurrent requests for the same resource
   */
  private async getOrCreateRequest<T>(key: string, requestFn: () => Promise<T>): Promise<T> {
    const normKey = normalizeKey(key);
    if (NOT_FOUND_SET.has(normKey)) {
      console.log(`[MediaWiki] Skipping request for known not-found key: ${normKey}`);
      return null as T;
    }
    
    const existingRequest = this.REQUEST_QUEUE.get(normKey);
    if (existingRequest) {
      console.log(`[MediaWiki] Deduplicating request for: ${normKey}`);
      try {
        return await existingRequest as T;
      } catch (error) {
        console.log(`[MediaWiki] Deduplicated request failed for: ${normKey}, will retry`);
        this.REQUEST_QUEUE.delete(normKey);
        // Fall through to create new request
      }
    }
    
    console.log(`[MediaWiki] Creating new request for: ${normKey}`);
    const request = throttledRequest(requestFn).finally(() => {
      this.REQUEST_QUEUE.delete(normKey);
      console.log(`[MediaWiki] Request completed and removed from queue: ${normKey}`);
    });
    
    this.REQUEST_QUEUE.set(normKey, request);
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
  async getPageWikitext(pageName: string): Promise<string | { error: string }> {
    const normName = normalizeKey(pageName);
    const cached = this.getCacheValue(this.WIKITEXT_CACHE, normName);
    if (cached !== null) {
      return cached;
    }
    return this.getOrCreateRequest(`wikitext_${normName}`, async () => {
      try {
        return await throttledRequest(async () => {
          const params = new URLSearchParams({
            action: 'query',
            prop: 'revisions',
            rvprop: 'content',
            titles: pageName,
            rvsection: '0',
            format: 'json',
            formatversion: '2'
          });
          const baseUrl = getMediaWikiApiUrl();
          const apiUrl = `${baseUrl}?${params.toString()}`;
          console.log(`[MediaWiki] Fetching wikitext for: ${pageName}`);
          
          // Create an AbortController for timeout
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), MEDIAWIKI_CONFIG.timeout);
          
          const response = await fetch(apiUrl, {
            headers: {
              'Accept': 'application/json',
              'User-Agent': this.USER_AGENT,
            },
            cache: 'no-store',
            signal: controller.signal
          });
          
          clearTimeout(timeoutId);
          
          if (!response.ok) {
            console.error(`[MediaWiki] HTTP Error for ${pageName}: ${response.status} ${response.statusText}`);
            // Don't cache HTTP errors immediately - let them retry
            return { error: `[MediaWiki] HTTP Error: ${response.status} ${response.statusText}` };
          }
          const data = await response.json();
          if (data.error) {
            console.error(`[MediaWiki] API Error for ${pageName}:`, data.error);
            // Don't cache API errors immediately - let them retry
            return { error: `[MediaWiki] API Error: ${JSON.stringify(data.error)}` };
          }
          const pages = data.query?.pages;
          if (!pages || !Array.isArray(pages) || pages.length === 0) {
            console.warn(`[MediaWiki] No pages found for ${pageName}`);
            this.setCacheValue(this.WIKITEXT_CACHE, normName, null, ERROR_TTL);
            NOT_FOUND_SET.add(normName);
            return { error: `[MediaWiki] No pages found for ${pageName}` };
          }
          const page = pages[0];
          if (!page || page.missing) {
            console.warn(`[MediaWiki] Page ${pageName} not found or missing`);
            this.setCacheValue(this.WIKITEXT_CACHE, normName, null, ERROR_TTL);
            NOT_FOUND_SET.add(normName);
            return { error: `[MediaWiki] Page ${pageName} not found or missing` };
          }
          const revisions = page.revisions;
          if (!revisions || !Array.isArray(revisions) || revisions.length === 0) {
            console.warn(`[MediaWiki] No revisions found for ${pageName}`);
            this.setCacheValue(this.WIKITEXT_CACHE, normName, null, ERROR_TTL);
            NOT_FOUND_SET.add(normName);
            return { error: `[MediaWiki] No revisions found for ${pageName}` };
          }
          const revision = revisions[0];
          const wikitext = revision?.content;
          if (!wikitext) {
            console.warn(`[MediaWiki] No content found in revision for ${pageName}`);
            this.setCacheValue(this.WIKITEXT_CACHE, normName, null, ERROR_TTL);
            NOT_FOUND_SET.add(normName);
            return { error: `[MediaWiki] No content found in revision for ${pageName}` };
          }
          console.log(`[MediaWiki] Successfully fetched wikitext for ${pageName} (${wikitext.length} chars)`);
          this.setCacheValue(this.WIKITEXT_CACHE, normName, wikitext, this.WIKITEXT_TTL);
          return wikitext;
        });
      } catch (error) {
        console.error(`[MediaWiki] Exception getting wikitext for ${pageName}:`, error);
        // Don't cache exceptions immediately - let them retry
        if (error instanceof Error) {
          if (error.name === 'AbortError') {
            return { error: `[MediaWiki] Request timeout for ${pageName}` };
          }
          return { error: `[MediaWiki] Exception: ${error.message}` };
        }
        return { error: `[MediaWiki] Exception: ${error}` };
      }
    });
  }

  /**
   * Parse raw wikitext to HTML using MediaWiki parser via Next.js API route to avoid CORS issues
   */
  async parseWikitextToHtml(wikitext: string, title?: string): Promise<string | null> {
    const cacheKey = `rendered_${title ?? 'unknown'}_${wikitext.substring(0, 100)}`;
    const cached = this.getCacheValue(this.RENDERED_HTML_CACHE, cacheKey);
    if (cached !== null) {
      return cached;
    }

    try {
      console.log(`[MediaWiki] Parsing wikitext to HTML (${wikitext.length} chars)`);
      
      const requestData: Record<string, string> = {
        action: 'parse',
        text: wikitext,
        format: 'json',
        formatversion: '2',
        prop: 'text',
        contentmodel: 'wikitext'
      };

      if (title) {
        requestData.title = title;
      }

      // Determine if we should use GET or POST based on wikitext length
      const isLongContent = wikitext.length > 1500;
      
      let response;
      
      if (isLongContent) {
        // Use POST for long content to avoid URI too long errors
        console.log(`[MediaWiki] Using POST for long wikitext (${wikitext.length} chars)`);

        const basePath = process.env.NEXT_PUBLIC_BASE_PATH || process.env.BASE_PATH || '';
        response = await fetch(`${basePath}/api/mediawiki`, {
          method: 'POST',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'User-Agent': this.USER_AGENT,
          },
          body: JSON.stringify(requestData),
          cache: 'no-store'
        });
      } else {
        // Use GET for short content
        const params = new URLSearchParams();
        Object.keys(requestData).forEach(key => {
          const value = requestData[key];
          if (value !== undefined) {
            params.set(key, value);
          }
        });

        const baseUrl = getMediaWikiApiUrl();
        const apiUrl = `${baseUrl}?${params.toString()}`;
        console.log(`[MediaWiki] Using GET for short wikitext`);

        response = await fetch(apiUrl, {
          headers: {
            'Accept': 'application/json',
            'User-Agent': this.USER_AGENT,
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
              return this.regexFallbackParsing(content ?? templateWikitext);
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
      const paramMatch = /^\|\s*([^=]+?)\s*=\s*(.*)$/.exec(trimmedLine);
      
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
          currentValue = paramMatch[2] ?? '';
          inMultilineParam = true;
          
          // Check if this parameter value spans multiple lines by looking for unbalanced structures
          const openBraces = (currentValue.match(/\{\{/g) ?? []).length;
          const closeBraces = (currentValue.match(/\}\}/g) ?? []).length;
          const openBrackets = (currentValue.match(/\[\[/g) ?? []).length;
          const closeBrackets = (currentValue.match(/\]\]/g) ?? []).length;
          
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
        const openBraces2 = (currentValue.match(/\{\{/g) ?? []).length;
        const closeBraces2 = (currentValue.match(/\}\}/g) ?? []).length;
        const openBrackets2 = (currentValue.match(/\[\[/g) ?? []).length;
        const closeBrackets2 = (currentValue.match(/\]\]/g) ?? []).length;
        
        if (openBraces2 === closeBraces2 && openBrackets2 === closeBrackets2) {
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
    const cached = this.getCacheValue(this.INFOBOX_CACHE, countryName);
    if (cached !== null) {
      console.log(`[MediaWiki] Infobox cache hit for: ${countryName}`);
      return cached;
    }

    return this.getOrCreateRequest(`infobox_${countryName}`, async () => {
      try {
        console.log(`[MediaWiki] Getting complete infobox for: ${countryName}`);
        
        // Step 1: Get raw wikitext for the page
        const wikitext = await this.getPageWikitext(countryName);
        if (!wikitext || typeof wikitext === 'object') {
          console.warn(`[MediaWiki] No wikitext found for ${countryName}:`, wikitext);
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
          renderedHtml: renderedHtml ?? undefined,
        };

        // Step 6: Map template parameters to infobox properties (including dynamic ones)
        this.mapTemplateDataToInfobox(templateData, infobox);

        // Step 7: Process any special template values (like {{Switcher}}, templates, and wikilinks)
        await this.processSpecialTemplates(infobox);

        console.log(`[MediaWiki] Successfully created complete infobox for ${countryName}`);
        console.log(`[MediaWiki] Infobox has ${Object.keys(infobox).length} total properties`);
        
        // Debug: Check for any remaining unprocessed templates or wikilinks
        const hasUnprocessedTemplates = Object.entries(infobox).some(([key, value]) => 
          typeof value === 'string' && value.includes('{{') && 
          key !== 'rawWikitext' && key !== 'renderedHtml'
        );
        const hasUnprocessedWikilinks = Object.entries(infobox).some(([key, value]) => 
          typeof value === 'string' && value.includes('[[') && 
          key !== 'rawWikitext' && key !== 'renderedHtml'
        );
        
        if (hasUnprocessedTemplates) {
          console.warn(`[MediaWiki] ${countryName} still has unprocessed templates in some fields`);
        }
        if (hasUnprocessedWikilinks) {
          console.warn(`[MediaWiki] ${countryName} still has unprocessed wikilinks in some fields`);
        }
        
        if (!hasUnprocessedTemplates && !hasUnprocessedWikilinks) {
          console.log(`[MediaWiki] ✓ ${countryName} - All templates and wikilinks processed successfully`);
        }
        
        this.setCacheValue(this.INFOBOX_CACHE, countryName, infobox, this.INFOBOX_TTL);
        return infobox;

      } catch (error) {
        console.error(`[MediaWiki] Error getting complete infobox for ${countryName}:`, error);
        // Don't cache errors for infobox - let it retry
        // this.setCacheValue(this.INFOBOX_CACHE, countryName, null, this.INFOBOX_TTL);
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
        let processedValue = value;
        
        // Apply basic cleaning to all values (including wikilink processing)
        // But don't process templates here as they'll be handled in processSpecialTemplates
        if (value.includes('[[') && !value.includes('{{')) {
          processedValue = this.cleanParameterValue(value);
          console.log(`[MediaWiki] Pre-processed wikilinks in ${key}: "${value.substring(0, 50)}..." -> "${processedValue.substring(0, 50)}..."`);
        }
        
        (infobox as Record<string, string>)[key] = processedValue;
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
        if (value && (value.includes('{{') || value.includes('[['))) {
          console.log(`[MediaWiki] Processing templates/wikilinks in parameter: ${key}`);
          
          // Enhanced template processing
          let processedValue = value;
          
          // Handle Switcher templates specifically
          if (value.includes('{{Switcher') || value.includes('{{switcher')) {
            processedValue = this.enhancedSwitcherProcessing(value);
          }
          
          // Always apply common template processing and wikilink processing
          if (value.includes('{{') || value.includes('[[')) {
            // First pass: handle templates
            if (processedValue.includes('{{')) {
              processedValue = this.processCommonTemplates(processedValue);
            }
            
            // Second pass: clean any remaining templates
            if (processedValue.includes('{{')) {
              processedValue = this.cleanRemainingTemplates(processedValue);
            }
            
            // Third pass: apply the main cleaning (which handles wikilinks)
            processedValue = this.cleanParameterValue(processedValue);
          }
          
          if (processedValue && processedValue !== value) {
            // Update the parsed data
            infobox.parsedTemplateData[key] = processedValue;
            
            // Update the infobox property
            (infobox as Record<string, string>)[key] = processedValue;
            
            console.log(`[MediaWiki] Enhanced processing of ${key}:`);
            console.log(`  Original: ${value.substring(0, 100)}${value.length > 100 ? '...' : ''}`);
            console.log(`  Processed: ${processedValue.substring(0, 100)}${processedValue.length > 100 ? '...' : ''}`);
          }
        }
      }
      
      // Also process any direct infobox properties that might have templates/wikilinks
      console.log(`[MediaWiki] Processing direct infobox properties for templates/wikilinks`);
      
      for (const [key, value] of Object.entries(infobox)) {
        if (key !== 'parsedTemplateData' && key !== 'rawWikitext' && key !== 'renderedHtml' && 
            typeof value === 'string' && (value.includes('{{') || value.includes('[['))) {
          
          console.log(`[MediaWiki] Processing direct property: ${key}`);
          const processedValue = this.cleanParameterValue(value);
          
          if (processedValue && processedValue !== value) {
            (infobox as Record<string, string>)[key] = processedValue;
            console.log(`[MediaWiki] Updated direct property ${key}:`);
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
      const switcherMatch = /\{\{\s*Switcher\s*\|([\s\S]*)\}\}/i.exec(switcherTemplate);
      if (!switcherMatch?.[1]) {
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
          if (fileMatch?.[1]) {
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
      const fallback = this.cleanParameterValue(parts[0] ?? switcherTemplate);
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
        const textContent = rendered
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
      return this.extractTemplateContentManually(templateValue) ?? templateValue;
      
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
        if (match?.[1]) {
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
   * Get flag URL for a country using the new flag cache manager
   */
  async getFlagUrl(countryName: string): Promise<string | { error: string }> {
    console.log(`[MediaWiki] getFlagUrl called for: ${countryName}`);
    const normName = normalizeKey(countryName);
    const cached = this.getCacheValue(this.FLAG_CACHE, normName);
    if (cached !== null) {
      console.log(`[MediaWiki] Flag cache hit for: ${countryName}`);
      return cached;
    }
    
    console.log(`[MediaWiki] No cache hit for flag: ${countryName}, making request`);
    return this.getOrCreateRequest(`flag_${normName}`, async () => {
      let lastError: Error | null = null;
      
      try {
        console.log(`[MediaWiki] Starting flag request for: ${countryName}`);
        
        // Method 1: Try Country_data template first
        try {
          const countryDataTemplateName = `Template:Country_data_${countryName}`;
          console.log(`[MediaWiki] Trying Country_data template: ${countryDataTemplateName}`);
          const templateContent = await this.getTemplate(countryDataTemplateName);
          
          if (templateContent && typeof templateContent === 'string') {
            console.log(`[MediaWiki] Got Country_data template for: ${countryName}`);
            const flagFileName = this.extractFlagFromCountryDataTemplate(templateContent);
            if (flagFileName) {
              console.log(`[MediaWiki] Found flag filename: ${flagFileName} for ${countryName}`);
              const flagUrl = await this.getFileUrl(flagFileName);
              console.log(`[MediaWiki] getFileUrl returned for ${countryName}:`, flagUrl);
              if (typeof flagUrl === 'string') {
                console.log(`[MediaWiki] Successfully got flag URL: ${flagUrl} for ${countryName}`);
                this.setCacheValue(this.FLAG_CACHE, normName, flagUrl, this.FLAG_TTL);
                console.log(`[MediaWiki] FINAL RETURN: ${countryName} -> ${flagUrl}`);
                return flagUrl;
              } else {
                console.warn(`[MediaWiki] getFileUrl failed for ${countryName}:`, flagUrl);
              }
            }
          }
        } catch (error) {
          lastError = error instanceof Error ? error : new Error(String(error));
          console.warn(`[MediaWiki] Country_data template method failed for ${countryName}:`, error);
        }
        
        // Method 2: Try direct page infobox
        try {
          console.log(`[MediaWiki] Trying direct page infobox for: ${countryName}`);
          const infobox = await this.getCountryInfobox(countryName);
          if (infobox) {
            console.log(`[MediaWiki] Got infobox for: ${countryName}`);
            const flagFields = [infobox.image_flag, infobox.flag, infobox.flag_caption];
            for (const flagFile of flagFields) {
              if (flagFile?.trim()) {
                let cleanFlagFile = flagFile.trim();
                if (cleanFlagFile.startsWith('File:')) {
                  cleanFlagFile = cleanFlagFile.substring(5);
                }
                console.log(`[MediaWiki] Trying flag file: ${cleanFlagFile} for ${countryName}`);
                const flagUrl = await this.getFileUrl(cleanFlagFile);
                if (typeof flagUrl === 'string') {
                  console.log(`[MediaWiki] Successfully got flag URL from infobox: ${flagUrl} for ${countryName}`);
                  this.setCacheValue(this.FLAG_CACHE, normName, flagUrl, this.FLAG_TTL);
                  return flagUrl;
                }
              }
            }
          }
        } catch (error) {
          lastError = error instanceof Error ? error : new Error(String(error));
          console.warn(`[MediaWiki] Infobox method failed for ${countryName}:`, error);
        }
        
        // Method 3: Try common flag patterns with enhanced patterns
        try {
          console.log(`[MediaWiki] Trying common flag patterns for: ${countryName}`);
          const normalizedName = countryName.replace(/\s+/g, '_');
          const commonFlagPatterns = [
            `Flag3 ${countryName}.png`,  // Most common pattern
            `Flag_of_${countryName}.svg`,
            `Flag_of_${countryName}.png`,
            `Flag_of_${normalizedName}.svg`,
            `Flag_of_${normalizedName}.png`,
            `${countryName}_flag.svg`,
            `${countryName}_flag.png`,
            `Flag_${countryName}.svg`,
            `Flag_${countryName}.png`,
            `Flag ${countryName}.svg`,
            `Flag ${countryName}.png`,
            `${normalizedName}_flag.svg`,
            `${normalizedName}_flag.png`,
          ];
          
          for (const flagPattern of commonFlagPatterns) {
            console.log(`[MediaWiki] Trying flag pattern: ${flagPattern} for ${countryName}`);
            const flagUrl = await this.getFileUrl(flagPattern);
            if (typeof flagUrl === 'string') {
              console.log(`[MediaWiki] Successfully got flag URL from pattern: ${flagUrl} for ${countryName}`);
              this.setCacheValue(this.FLAG_CACHE, normName, flagUrl, this.FLAG_TTL);
              return flagUrl;
            }
          }
        } catch (error) {
          lastError = error instanceof Error ? error : new Error(String(error));
          console.warn(`[MediaWiki] Pattern matching method failed for ${countryName}:`, error);
        }
        
        console.log(`[MediaWiki] No flag found for: ${countryName} after trying all methods`);
        if (lastError) {
          console.warn(`[MediaWiki] Last error for ${countryName}:`, lastError.message);
        }
        
        // Cache as null instead of placeholder to allow other systems to try
        this.setCacheValue(this.FLAG_CACHE, normName, null, ERROR_TTL);
        NOT_FOUND_SET.add(normName);
        return { error: `No flag found for ${countryName}` };
      } catch (error) {
        console.error(`[MediaWiki] Critical exception in getFlagUrl for ${countryName}:`, error);
        // Cache as null and return error to allow other systems to handle fallback
        this.setCacheValue(this.FLAG_CACHE, normName, null, ERROR_TTL);
        NOT_FOUND_SET.add(normName);
        return { error: `Critical exception for ${countryName}: ${error instanceof Error ? error.message : String(error)}` };
      }
    });
  }

  /**
   * Get cached flag URL for a country (synchronous, no network requests)
   */
  getCachedFlagUrl(countryName: string): string | null {
    const normName = normalizeKey(countryName);
    const cached = this.getCacheValue(this.FLAG_CACHE, normName);
    return cached;
  }

  /**
   * Extract flag filename from Country_data template content with improved patterns
   */
  private extractFlagFromCountryDataTemplate(templateContent: string): string | null {
    try {
      console.log(`[MediaWiki] Extracting flag from Country_data template (${templateContent.length} chars)`);
      if (process.env.NODE_ENV !== 'production') {
        console.log(`[MediaWiki] Template content preview: ${templateContent.substring(0, 500)}...`);
      }
      
      // Look for flag alias parameter in various formats
      const aliasPatterns = [
        /\|\s*flag\s*alias\s*=\s*([^|\n\r]+)/i,
        /\|\s*flag-alias\s*=\s*([^|\n\r]+)/i,
        /\|\s*flag\s*=\s*([^|\n\r]+)/i,
        /\|\s*alias\s*=\s*([^|\n\r]+)/i,
        /\|\s*alias-flag\s*=\s*([^|\n\r]+)/i,
      ];
      
      for (const pattern of aliasPatterns) {
        const match = templateContent.match(pattern);
        if (match?.[1]) {
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
          const fileMatch = /([^|\s\[\]]+(?:Flag[^|\s\[\]]*\.(?:svg|png|jpg|jpeg|gif)))/i.exec(trimmedLine);
          if (fileMatch?.[1]) {
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
      
      // Additional fallback: look for any line with flag-related content
      for (const line of lines) {
        const trimmedLine = line.trim();
        if (trimmedLine.includes('flag') && 
            (trimmedLine.includes('.svg') || trimmedLine.includes('.png'))) {
          
          // Try to extract just the filename
          const fileMatch = /([^|\s\[\]]+\.(?:svg|png|jpg|jpeg|gif))/i.exec(trimmedLine);
          if (fileMatch?.[1]) {
            let flagFileName = fileMatch[1].trim();
            
            // Remove File: prefix if present
            if (flagFileName.toLowerCase().startsWith('file:')) {
              flagFileName = flagFileName.substring(5).trim();
            }
            
            console.log(`[MediaWiki] Found flag filename by fallback matching: ${flagFileName}`);
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
  async getTemplate(templateName: string): Promise<string | { error: string }> {
    const normName = normalizeKey(templateName);
    const cached = this.getCacheValue(this.TEMPLATE_CACHE, normName);
    if (cached !== null) {
      return cached;
    }
    return this.getOrCreateRequest(`template_${normName}`, async () => {
      try {
        return await throttledRequest(async () => {
          const params = new URLSearchParams({
            action: 'query',
            prop: 'revisions',
            rvprop: 'content',
            titles: templateName,
            format: 'json',
            formatversion: '2',
            redirects: '1', // Always follow redirects
          });
          const templateUrl = `${this.API_BASE_URL}?${params.toString()}`;
          const response = await fetch(templateUrl, {
            headers: {
              'Accept': 'application/json',
              'User-Agent': this.USER_AGENT,
            },
            cache: 'no-store'
          });
          if (!response.ok) {
            const errMsg = `[MediaWiki] HTTP Error getting template ${templateName}: ${response.status} ${response.statusText}`;
            this.setCacheValue(this.TEMPLATE_CACHE, normName, null, ERROR_TTL);
            NOT_FOUND_SET.add(normalizeKey(templateName));
            return { error: errMsg };
          }
          const data = await response.json();
          if (data.error) {
            this.setCacheValue(this.TEMPLATE_CACHE, normName, null, ERROR_TTL);
            NOT_FOUND_SET.add(normalizeKey(templateName));
            return { error: `[MediaWiki] API Error: ${JSON.stringify(data.error)}` };
          }
          const pages = data.query?.pages;
          if (!pages || !Array.isArray(pages) || pages.length === 0) {
            this.setCacheValue(this.TEMPLATE_CACHE, normName, null, ERROR_TTL);
            NOT_FOUND_SET.add(normalizeKey(templateName));
            return { error: `[MediaWiki] No pages found for ${templateName}` };
          }
          const page = pages[0];
          if (!page.revisions || !Array.isArray(page.revisions) || page.revisions.length === 0) {
            this.setCacheValue(this.TEMPLATE_CACHE, normName, null, ERROR_TTL);
            NOT_FOUND_SET.add(normalizeKey(templateName));
            return { error: `[MediaWiki] No revisions found for ${templateName}` };
          }
          const content = page.revisions[0].content;
          this.setCacheValue(this.TEMPLATE_CACHE, normName, content, this.TEMPLATE_TTL);
          return content;
        });
      } catch (error) {
        this.setCacheValue(this.TEMPLATE_CACHE, normName, null, ERROR_TTL);
        NOT_FOUND_SET.add(normalizeKey(templateName));
        return { error: `[MediaWiki] Exception getting template ${templateName}: ${error}` };
      }
    });
  }

  /**
   * Get the URL for a file with improved caching
   */
  async getFileUrl(fileName: string): Promise<string | { error: string }> {
    if (!fileName) {
      return { error: '[MediaWiki] No filename provided' };
    }

    const cleanFileName = fileName.trim();
    const normalizedKey = normalizeKey(cleanFileName);
    
    if (NOT_FOUND_SET.has(normalizedKey)) {
      return { error: `[MediaWiki] File not found (cached): ${cleanFileName}` };
    }

    return this.getOrCreateRequest(`file:${normalizedKey}`, async () => {
      try {
        const params = new URLSearchParams({
          action: 'query',
          format: 'json',
          titles: `File:${cleanFileName}`,
          prop: 'imageinfo',
          iiprop: 'url',
          iilimit: '1'
        });

        const response = await throttledRequest(() => 
          fetch(`${this.API_BASE_URL}?${params.toString()}`)
        );

        if (!response.ok) {
          this.setCacheValue(this.FILE_CACHE, cleanFileName, null, ERROR_TTL);
          NOT_FOUND_SET.add(normalizedKey);
          return { error: `[MediaWiki] HTTP ${response.status} getting file ${cleanFileName}` };
        }

        const data = await response.json() as {
          error?: unknown;
          query?: {
            pages?: Record<string, {
              imageinfo?: Array<{ url: string }>;
              missing?: boolean;
              pageid?: number;
            }>;
          };
        };

        if (data.error) {
          console.error(`[MediaWiki] API Error for file ${cleanFileName}:`, data.error);
          this.setCacheValue(this.FILE_CACHE, cleanFileName, null, ERROR_TTL);
          NOT_FOUND_SET.add(normalizedKey);
          return { error: `[MediaWiki] API Error: ${JSON.stringify(data.error)}` };
        }

        const pages = data.query?.pages;
        if (!pages || typeof pages !== 'object') {
          console.warn(`[MediaWiki] No pages object for file ${cleanFileName}`);
          this.setCacheValue(this.FILE_CACHE, cleanFileName, null, ERROR_TTL);
          NOT_FOUND_SET.add(normalizedKey);
          return { error: `[MediaWiki] No pages found for file ${cleanFileName}` };
        }

        // MediaWiki API returns pages as an object with page IDs as keys
        const pageIds = Object.keys(pages);
        if (pageIds.length === 0) {
          console.warn(`[MediaWiki] No page IDs for file ${cleanFileName}`);
          this.setCacheValue(this.FILE_CACHE, cleanFileName, null, ERROR_TTL);
          NOT_FOUND_SET.add(normalizedKey);
          return { error: `[MediaWiki] No pages found for file ${cleanFileName}` };
        }

        const page = pages[pageIds[0]!];
        if (!page) {
          console.warn(`[MediaWiki] No page data for file ${cleanFileName}`);
          this.setCacheValue(this.FILE_CACHE, cleanFileName, null, ERROR_TTL);
          NOT_FOUND_SET.add(normalizedKey);
          return { error: `[MediaWiki] No page found for file ${cleanFileName}` };
        }

        // Check if the page is missing (file doesn't exist)
        if (page.missing) {
          console.log(`[MediaWiki] File ${cleanFileName} is missing from MediaWiki`);
          this.setCacheValue(this.FILE_CACHE, cleanFileName, null, ERROR_TTL);
          NOT_FOUND_SET.add(normalizedKey);
          return { error: `[MediaWiki] File ${cleanFileName} does not exist` };
        }

        if (!page.imageinfo || !Array.isArray(page.imageinfo) || page.imageinfo.length === 0) {
          console.warn(`[MediaWiki] No imageinfo for file ${cleanFileName}`);
          this.setCacheValue(this.FILE_CACHE, cleanFileName, null, ERROR_TTL);
          NOT_FOUND_SET.add(normalizedKey);
          return { error: `[MediaWiki] No imageinfo found for file ${cleanFileName}` };
        }

        const url = page.imageinfo[0]?.url;
        if (!url) {
          console.warn(`[MediaWiki] No URL in imageinfo for file ${cleanFileName}`);
          this.setCacheValue(this.FILE_CACHE, cleanFileName, null, ERROR_TTL);
          NOT_FOUND_SET.add(normalizedKey);
          return { error: `[MediaWiki] No URL found in imageinfo for file ${cleanFileName}` };
        }

        console.log(`[MediaWiki] Successfully got file URL for ${cleanFileName}: ${url}`);
        console.log(`[MediaWiki] File URL test - can we access it?`, url);
        this.setCacheValue(this.FILE_CACHE, cleanFileName, url, this.FILE_TTL);
        return url;
      } catch (error) {
        this.setCacheValue(this.FILE_CACHE, cleanFileName, null, ERROR_TTL);
        NOT_FOUND_SET.add(normalizedKey);
        return { error: `[MediaWiki] Exception getting file ${cleanFileName}: ${error instanceof Error ? error.message : String(error)}` };
      }
    });
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
   * Preload flags for multiple countries with improved batching and rate limiting
   */
  async preloadCountryFlags(countryNames: string[]): Promise<void> {
    if (countryNames.length === 0) return;
    if (this.isPreloading) {
      return;
    }

    this.isPreloading = true;
    
    try {
      
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
      const BATCH_SIZE = 3; // Reduced batch size for better rate limiting
      const BATCH_DELAY = 3000; // 3 second delay between batches
      
      for (let i = 0; i < uncachedCountries.length; i += BATCH_SIZE) {
        const batch = uncachedCountries.slice(i, i + BATCH_SIZE);
        console.log(`[MediaWiki] Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(uncachedCountries.length / BATCH_SIZE)}: ${batch.join(', ')}`);
        
        const batchPromises = batch.map(async (countryName, index) => {
          // Stagger requests within the batch
          if (index > 0) {
            await this.delay(1000 * index); // 1 second between each request in batch
          }
          
          try {
            const flagUrl = await this.getFlagUrl(countryName);
            if (typeof flagUrl === 'string') {
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
   * Helper function to escape HTML characters and create safe wiki links
   */
  private createWikiLink(target: string, display: string): string {
    const normalizedTarget = target.replace(/ /g, '_').replace(/^_+|_+$/g, '');
    const wikiUrl = `https://ixwiki.com/wiki/${encodeURIComponent(normalizedTarget)}`;
    const safeDisplay = display.replace(/[&<>"']/g, (char: string) => {
      const escapeMap: Record<string, string> = {
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
      };
              return escapeMap[char] ?? char;
    });
    return `<a href="${wikiUrl}" target="_blank" rel="noopener noreferrer" style="color: #429284; text-decoration: none;">${safeDisplay}</a>`;
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
    
    // Handle common MediaWiki templates before general wiki syntax
    cleaned = this.processCommonTemplates(cleaned);
    
    // Handle wiki links - convert to proper HTML links with the specified color
    // Convert [[Page|Display Text]] to HTML link
    cleaned = cleaned.replace(/\[\[([^\|\]]+)\|([^\]]+)\]\]/g, (_match: string, page: string, display: string) => {
      return this.createWikiLink(page.trim(), display.trim());
    });
    
    // Convert [[Page]] to HTML link using page name as display text
    cleaned = cleaned.replace(/\[\[([^\]]+)\]\]/g, (_match: string, page: string) => {
      const cleanPage = page.trim();
      return this.createWikiLink(cleanPage, cleanPage);
    });
    
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
    
    // Final cleanup of any remaining simple templates
    cleaned = this.cleanRemainingTemplates(cleaned);
    
    return cleaned;
  }

  /**
   * Process common MediaWiki templates to extract readable text
   */
  private processCommonTemplates(text: string): string {
    let processed = text;
    let iterations = 0;
    const maxIterations = 3; // Prevent infinite loops
    
    // Process templates iteratively to handle nested templates
    while (processed.includes('{{') && iterations < maxIterations) {
      const beforeProcessing = processed;
      iterations++;
      
      // Handle {{wp|target|display}} and {{wp|target}} templates (Wikipedia links)
      // Convert to ixwiki.com links with proper formatting
      processed = processed.replace(/\{\{wp\|([^|}]+)\|([^}]+)\}\}/g, (_match: string, target: string, display: string) => {
        return this.createWikiLink(target.trim(), display.trim());
      });
      
      processed = processed.replace(/\{\{wp\|([^}]+)\}\}/g, (_match: string, target: string) => {
        const cleanTarget = target.trim();
        return this.createWikiLink(cleanTarget, cleanTarget);
      });
      
      // Handle similar link templates
      processed = processed.replace(/\{\{link\|([^|}]+)\|([^}]+)\}\}/g, (_match: string, target: string, display: string) => {
        return this.createWikiLink(target.trim(), display.trim());
      });
      
      processed = processed.replace(/\{\{link\|([^}]+)\}\}/g, (_match: string, target: string) => {
        const cleanTarget = target.trim();
        return this.createWikiLink(cleanTarget, cleanTarget);
      });
      
      // Handle {{lang|code|text}} templates (language templates)
      processed = processed.replace(/\{\{lang\|[^|]+\|([^}]+)\}\}/g, '$1'); // {{lang|en|English}} -> English
      
      // Handle {{nowrap|text}} templates
      processed = processed.replace(/\{\{nowrap\|([^}]+)\}\}/g, '$1'); // {{nowrap|text}} -> text
      
      // Handle {{small|text}} templates
      processed = processed.replace(/\{\{small\|([^}]+)\}\}/g, '$1'); // {{small|text}} -> text
      
      // Handle {{big|text}} templates
      processed = processed.replace(/\{\{big\|([^}]+)\}\}/g, '$1'); // {{big|text}} -> text
      
      // Handle {{abbr|abbreviation|full form}} templates
      processed = processed.replace(/\{\{abbr\|([^|]+)\|([^}]+)\}\}/g, '$1'); // {{abbr|US|United States}} -> US
      
      // Handle {{convert|number|unit|...}} templates by extracting just the number and first unit
      processed = processed.replace(/\{\{convert\|([^|]+)\|([^|]+)[\|][^}]*\}\}/g, (_match: string, num: string, unit: string) => `${num.trim()} ${unit.trim()}`);
      processed = processed.replace(/\{\{convert\|([^|]+)\|([^}]+)\}\}/g, (_match: string, num: string, unit: string) => `${num.trim()} ${unit.trim()}`);
      
      // Handle {{currency|amount|code}} templates
      processed = processed.replace(/\{\{currency\|([^|]+)\|([^}]+)\}\}/g, (_match: string, amount: string, code: string) => `${amount.trim()} ${code.trim()}`);
      
      // Handle {{coord|...}} templates by removing them (too complex to parse meaningfully)
      processed = processed.replace(/\{\{coord\|[^}]+\}\}/g, '');
      
      // Handle {{age|...}} templates by removing them (time-sensitive)
      processed = processed.replace(/\{\{age\|[^}]+\}\}/g, '');
      
      // Handle {{date|...}} templates by extracting the date
      processed = processed.replace(/\{\{date\|([^|}]+)[\|][^}]*\}\}/g, (_match: string, date: string) => date.trim());
      processed = processed.replace(/\{\{date\|([^}]+)\}\}/g, (_match: string, date: string) => date.trim());
      
      // Handle {{flag|country}} templates - convert to links
      processed = processed.replace(/\{\{flag\|([^}]+)\}\}/g, (_match: string, country: string) => {
        const cleanCountry = country.trim();
        return this.createWikiLink(cleanCountry, cleanCountry);
      });
      
      // Handle {{flagicon|country}} templates by removing them (just icons)
      processed = processed.replace(/\{\{flagicon\|[^}]+\}\}/g, '');
      
      // Handle {{color|color|text}} templates
      processed = processed.replace(/\{\{color\|[^|]+\|([^}]+)\}\}/g, (_match: string, text: string) => text.trim());
      
      // Handle simple formatting templates
      processed = processed.replace(/\{\{b\|([^}]+)\}\}/g, '$1'); // {{b|text}} -> text (bold)
      processed = processed.replace(/\{\{i\|([^}]+)\}\}/g, '$1'); // {{i|text}} -> text (italic)
      processed = processed.replace(/\{\{u\|([^}]+)\}\}/g, '$1'); // {{u|text}} -> text (underline)
      
      // Handle {{nbsp}} (non-breaking space)
      processed = processed.replace(/\{\{nbsp\}\}/g, ' ');
      
      // Handle {{•}} (bullet point)
      processed = processed.replace(/\{\{•\}\}/g, '•');
      
      // Handle {{and}} and similar joining templates
      processed = processed.replace(/\{\{and\}\}/g, ' and ');
      processed = processed.replace(/\{\{or\}\}/g, ' or ');
      processed = processed.replace(/\{\{comma\}\}/g, ', ');
      
      // Handle line break templates
      processed = processed.replace(/\{\{br\}\}/g, ' ');
      processed = processed.replace(/\{\{break\}\}/g, ' ');
      
      // Handle mathematical/scientific notation templates
      processed = processed.replace(/\{\{sup\|([^}]+)\}\}/g, '^$1'); // {{sup|2}} -> ^2
      processed = processed.replace(/\{\{sub\|([^}]+)\}\}/g, '_$1'); // {{sub|2}} -> _2
      
      // If no change in this iteration, break to avoid infinite loop
      if (beforeProcessing === processed) {
        break;
      }
    }
    
    if (text !== processed) {
      console.log(`[MediaWiki] Common template processing successful (${iterations} iterations):`);
      console.log(`  Input:  "${text.substring(0, 150)}${text.length > 150 ? '...' : ''}"`);
      console.log(`  Output: "${processed.substring(0, 150)}${processed.length > 150 ? '...' : ''}"`);
    }
    
    return processed;
  }

  /**
   * Clean any remaining simple templates that weren't handled by specific processors
   */
  private cleanRemainingTemplates(text: string): string {
    let cleaned = text;
    
    // For any remaining simple templates with just one parameter, extract the parameter
    // Pattern: {{template|content}} -> content
    cleaned = cleaned.replace(/\{\{[^|{}]+\|([^}]+)\}\}/g, '$1');
    
    // For templates with no parameters, remove them entirely
    // Pattern: {{template}} -> (empty)
    cleaned = cleaned.replace(/\{\{[^|}]+\}\}/g, '');
    
    // For complex templates that still remain, try to extract any meaningful text
    const complexTemplateRegex = /\{\{([^}]+)\}\}/;
    const complexTemplateMatch = complexTemplateRegex.exec(cleaned);
    if (complexTemplateMatch?.[1]) {
      const templateContent = complexTemplateMatch[1];
      // Try to find text that looks like readable content (not parameter names)
      const readableText = templateContent.split('|').find(part => {
        const trimmed = part.trim();
        return trimmed.length > 3 && 
               !trimmed.includes('=') && 
               /^[A-Za-z]/.test(trimmed) &&
               !complexTemplateRegex.exec(trimmed); // Not just parameter names
      });
      
      if (readableText) {
        cleaned = cleaned.replace(complexTemplateMatch[0], readableText.trim());
      } else {
        // Remove the template entirely if no readable content found
        cleaned = cleaned.replace(complexTemplateMatch[0], '');
      }
    }
    
    return cleaned.trim();
  }
}

// Export singleton instance for backward compatibility
export const ixnayWiki = new IxnayWikiService();
