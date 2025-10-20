// Wiki search service supporting both ixwiki.com and iiwiki.com
import type { CountryInfoboxWithDynamicProps } from "./mediawiki-service";
import { unifiedFlagService } from "./unified-flag-service";
import { BASE_PATH } from "./base-path";

export interface WikiConfig {
  baseUrl: string;
  apiEndpoint: string;
  searchNamespace?: number[];
}

// Helper function to get the base URL for API requests
function getApiBaseUrl(): string {
  const normalizedBasePath = BASE_PATH
    ? (BASE_PATH.startsWith("/") ? BASE_PATH : `/${BASE_PATH}`)
    : "";

  const ensureBasePath = (origin: string): string => {
    const trimmedOrigin = origin.endsWith("/")
      ? origin.slice(0, -1)
      : origin;
    if (!normalizedBasePath) {
      return trimmedOrigin;
    }
    return trimmedOrigin.endsWith(normalizedBasePath)
      ? trimmedOrigin
      : `${trimmedOrigin}${normalizedBasePath}`;
  };

  // In server-side context (Node.js), we need absolute URLs
  if (typeof window === 'undefined') {
    const origin =
      process.env.NEXT_PUBLIC_APP_URL ||
      process.env.APP_URL ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined) ||
      `http://localhost:${process.env.PORT ?? "3000"}`;
    return ensureBasePath(origin);
  }
  // Client-side: include base path so fetch works when deployed under a sub-path
  return normalizedBasePath || '';
}

// Function to get wiki configs with proper URLs
function getWikiConfigs(): Record<string, WikiConfig> {
  const baseUrl = getApiBaseUrl();
  return {
    ixwiki: {
      baseUrl: `${baseUrl}/api/ixwiki-proxy`,
      apiEndpoint: "/wiki/api.php",
      searchNamespace: [0, 6], // Main and Media namespaces
    },
    iiwiki: {
      baseUrl: `${baseUrl}/api/iiwiki-proxy`,
      apiEndpoint: "/wiki/api.php",
      searchNamespace: [0, 6], // Main and Media namespaces
    },
    althistory: {
      baseUrl: `${baseUrl}/api/althistory-wiki-proxy`,
      apiEndpoint: "/api.php",
      searchNamespace: [0, 6], // Main and Media namespaces
    }
  };
}

export interface SearchResult {
  title: string;
  snippet: string;
  url: string;
  namespace?: number;
}

interface ParsedCountryData {
  name: string;
  population?: number;
  gdpPerCapita?: number;
  gdp?: number;
  capital?: string;
  area?: number;
  government?: string;
  currency?: string;
  languages?: string;
  flag?: string;
  coatOfArms?: string;
  flagUrl?: string;
  coatOfArmsUrl?: string;
  infobox: CountryInfoboxWithDynamicProps;
}

/**
 * Search for countries on a specific wiki
 */
export async function searchWiki(
  query: string, 
  site: 'ixwiki' | 'iiwiki' | 'althistory', 
  categoryFilter?: string
): Promise<SearchResult[]> {
  const wikiConfigs = getWikiConfigs();
  const config = wikiConfigs[site];
  if (!config) {
    throw new Error(`Unsupported wiki site: ${site}`);
  }

  try {
    // Use comprehensive category search for both sites when category filter is provided
    if (categoryFilter) {
      console.log(`[WikiSearch] Using comprehensive category search for ${site} with category: ${categoryFilter}`);
      return await searchWithCategoryFilter(query, categoryFilter, config, site);
    }

    // Fallback to regular search when no category filter
    const searchParams = new URLSearchParams({
      action: 'query',
      format: 'json',
      list: 'search',
      srsearch: query,
      srprop: 'snippet',
    });

    const response = await fetch(`${config.baseUrl}${config.apiEndpoint}?${searchParams.toString()}`, {
      headers: {
        'User-Agent': 'IxStats-Builder',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    
    if (data.error) {
      throw new Error(`Wiki API Error: ${data.error.info || data.error.code}`);
    }

    const results = data.query?.search || [];
    
    return results.map((result: any) => {
      return {
        title: result.title,
        snippet: result.snippet || '',
        url: createWikiUrl(result.title, config, site),
        namespace: result.ns,
      };
    });

  } catch (error) {
    console.error(`Wiki search failed for ${site}:`, error);
    throw new Error(`Failed to search ${site}: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// --- Intelligent ranking and fallback helpers ---
function normalizeForMatch(value: string): string {
  return value
    .toLowerCase()
    .replace(/^file:/i, '')
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenize(value: string): string[] {
  return normalizeForMatch(value)
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

function scoreImageRelevance(candidate: string, rawQuery: string): number {
  const title = normalizeForMatch(candidate);
  const query = normalizeForMatch(rawQuery);

  if (!title || !query) return 0;

  // Exact and prefix boosts
  let score = 0;
  if (title === query) score += 10;
  if (title.startsWith(query)) score += 6;
  if (title.includes(query)) score += 4;

  // Token-based scoring
  const tTokens = tokenize(title);
  const qTokens = tokenize(query);

  // All query tokens present boost
  const allPresent = qTokens.every(qt => tTokens.some(tt => tt === qt || tt.startsWith(qt) || qt.startsWith(tt)));
  if (allPresent) score += 5;

  // Partial token matches
  for (const qt of qTokens) {
    for (const tt of tTokens) {
      if (tt === qt) score += 2;
      else if (tt.startsWith(qt) || qt.startsWith(tt)) score += 1.5;
      else {
        const sim = calculateSimilarity(tt, qt);
        if (sim >= 0.8) score += 1.25;
        else if (sim >= 0.65) score += 0.6;
      }
    }
  }

  // Shorter names slight preference
  score += Math.max(0, 2 - Math.log2(Math.max(1, candidate.length / 12)));

  return score;
}

async function searchFilesFulltext(
  query: string,
  site: 'ixwiki' | 'iiwiki' | 'althistory',
  limit: number,
  config: WikiConfig
): Promise<Array<{ name: string; path: string; url?: string; description?: string }>> {
  try {
    const params = new URLSearchParams({
      action: 'query',
      format: 'json',
      list: 'search',
      srsearch: query,
      srlimit: String(Math.min(limit * 2, 50)),
      srnamespace: '6', // File namespace
      srwhat: 'text',
      srprop: 'snippet|titlesnippet',
    });

    const url = `${config.baseUrl}${config.apiEndpoint}?${params.toString()}`;
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'IxStats-Builder/1.0',
      },
    });

    if (!response.ok) return [];
    const data = await response.json();
    const results: Array<{ title: string }> = (data.query?.search || [])
      .map((r: { title: string }) => ({ title: r.title }))
      .filter((r: { title: string }) => /^File:/i.test(r.title));

    const files: Array<{ name: string; path: string; url?: string; description?: string }> = [];
    for (const r of results) {
      const name = r.title.replace(/^File:/i, '');
      // try to resolve URL quickly via imageinfo
      const url = await getImageUrl(name, site);
      if (url) {
        files.push({ name: r.title, path: url, url, description: name });
      }
      if (files.length >= limit) break;
    }
    // Rank these as well
    return files
      .map((img) => ({ img, score: scoreImageRelevance(img.description || img.name, query) }))
      .sort((a, b) => b.score - a.score)
      .map((r) => r.img);
  } catch (e) {
    return [];
  }
}

/**
 * Search wiki with comprehensive category filtering
 * This function works for both IxWiki and IIWiki by getting all category members first
 */
async function searchWithCategoryFilter(
  query: string,
  categoryFilter: string,
  config: WikiConfig,
  site: 'ixwiki' | 'iiwiki' | 'althistory'
): Promise<SearchResult[]> {
  try {
    console.log(`[WikiSearch] Getting all members from Category:${categoryFilter} on ${site}`);
    
    // Get ALL pages in the category using pagination (including subcategories for iiwiki)
    const allCategoryMembers = await getAllCategoryMembersWithSubcategories(categoryFilter, config, site);
    
    if (allCategoryMembers.length === 0) {
      console.log(`[WikiSearch] No members found in Category:${categoryFilter}`);
      return [];
    }

    console.log(`[WikiSearch] Found ${allCategoryMembers.length} total members in Category:${categoryFilter}`);

    // Create a comprehensive search that matches various patterns
    const searchTerms = query.toLowerCase().trim();
    const queryWords = searchTerms.split(/\s+/).filter(word => word.length > 0);
    
    const filteredMembers = allCategoryMembers.filter((member: any) => {
      const title = member.title.toLowerCase();
      
      // Exact match
      if (title === searchTerms) return true;
      
      // Contains the full search term
      if (title.includes(searchTerms)) return true;
      
      // All words are present (allows for different order)
      if (queryWords.length > 1 && queryWords.every(word => title.includes(word))) return true;
      
      // Partial word matches for compound names (minimum 3 characters)
      if (queryWords.some(word => word.length >= 3 && title.includes(word))) return true;
      
      // Handle common abbreviations and variations
      const titleWords = title.split(/[\s\-_,()\.]+/).filter((w: string) => w.length > 0);
      if (queryWords.some(queryWord => 
        titleWords.some((titleWord: string) => {
          // Direct match or prefix match for words 3+ characters
          if (queryWord.length >= 3) {
            return titleWord.startsWith(queryWord) || queryWord.startsWith(titleWord);
          }
          // Exact match for short words (like "US", "UK")
          return titleWord === queryWord;
        })
      )) return true;
      
      // Handle initials/acronyms (e.g., "USA" matches "United States of America")
      if (searchTerms.length >= 2 && searchTerms.length <= 5 && /^[a-z]+$/.test(searchTerms)) {
        const titleInitials = titleWords
          .filter((word: string) => word.length > 0)
          .map((word: string) => word[0])
          .join('');
        if (titleInitials.includes(searchTerms) || searchTerms.includes(titleInitials)) {
          return true;
        }
      }
      
      // Fuzzy matching for typos (Levenshtein-like for single character differences)
      if (queryWords.some(queryWord => {
        if (queryWord.length >= 4) {
          return titleWords.some((titleWord: string) => {
            if (Math.abs(titleWord.length - queryWord.length) <= 1) {
              return calculateSimilarity(titleWord, queryWord) >= 0.8;
            }
            return false;
          });
        }
        return false;
      })) return true;
      
      return false;
    });

    console.log(`[WikiSearch] Filtered to ${filteredMembers.length} matching countries`);

    // If we still have too many results, do a more targeted search
    if (filteredMembers.length > 50) {
      console.log(`[WikiSearch] Too many results (${filteredMembers.length}), doing targeted search`);
      
      const searchResults = await performTargetedSearch(
        query, 
        allCategoryMembers.map(m => m.title), 
        config
      );
      
      if (searchResults.length > 0) {
        return searchResults.map(result => ({
          ...result,
          url: createWikiUrl(result.title, config, site)
        }));
      }
    }

    // Sort results by relevance
    const sortedResults = filteredMembers.sort((a: any, b: any) => {
      const aTitle = a.title.toLowerCase();
      const bTitle = b.title.toLowerCase();
      
      // Exact matches first
      if (aTitle === searchTerms && bTitle !== searchTerms) return -1;
      if (bTitle === searchTerms && aTitle !== searchTerms) return 1;
      
      // Starts with search term
      if (aTitle.startsWith(searchTerms) && !bTitle.startsWith(searchTerms)) return -1;
      if (bTitle.startsWith(searchTerms) && !aTitle.startsWith(searchTerms)) return 1;
      
      // Shorter titles (more likely to be exact matches)
      return aTitle.length - bTitle.length;
    });

    // Convert to search result format
    return sortedResults.slice(0, 30).map((member: any) => {
      let snippet = `Country in Category:${categoryFilter}`;
      if (member.fromSubcategory) {
        snippet = `Country in Category:${member.fromSubcategory} (subcategory of ${categoryFilter})`;
      }
      
      return {
        title: member.title,
        snippet,
        url: createWikiUrl(member.title, config, site),
        namespace: member.ns || 0,
      };
    });

  } catch (error) {
    console.error(`Wiki category search failed for ${site}:`, error);
    throw error;
  }
}

/**
 * Get all category members using pagination
 */
async function getAllCategoryMembers(categoryFilter: string, config: WikiConfig): Promise<any[]> {
  const allMembers: any[] = [];
  let cmcontinue: string | undefined;
  let iterations = 0;
  const maxIterations = 20; // Prevent infinite loops
  
  do {
    const params = new URLSearchParams({
      action: 'query',
      format: 'json',
      list: 'categorymembers',
      cmtitle: `Category:${categoryFilter}`,
      cmlimit: '500',
      cmnamespace: '0', // Main namespace
    });

    if (cmcontinue) {
      params.set('cmcontinue', cmcontinue);
    }

    const response = await fetch(`${config.baseUrl}${config.apiEndpoint}?${params.toString()}`, {
      headers: {
        'User-Agent': 'IxStats-Builder',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    const members = data.query?.categorymembers || [];
    allMembers.push(...members);
    
    cmcontinue = data.continue?.cmcontinue;
    iterations++;
    
    console.log(`[WikiSearch] Retrieved ${members.length} members (total: ${allMembers.length}, continue: ${!!cmcontinue})`);
    
  } while (cmcontinue && iterations < maxIterations);
  
  return allMembers;
}

/**
 * Get subcategories of a category
 */
async function getCategorySubcategories(categoryFilter: string, config: WikiConfig): Promise<string[]> {
  const subcategories: string[] = [];
  let cmcontinue: string | undefined;
  let iterations = 0;
  const maxIterations = 10;
  
  do {
    const params = new URLSearchParams({
      action: 'query',
      format: 'json',
      list: 'categorymembers',
      cmtitle: `Category:${categoryFilter}`,
      cmlimit: '500',
      cmnamespace: '14', // Category namespace
      cmtype: 'subcat'
    });
    
    if (cmcontinue) {
      params.set('cmcontinue', cmcontinue);
    }

    const response = await fetch(`${config.baseUrl}${config.apiEndpoint}?${params.toString()}`, {
      headers: {
        'User-Agent': 'IxStats-Builder',
      },
    });

    if (!response.ok) {
      console.warn(`Failed to get subcategories for ${categoryFilter}: ${response.status}`);
      break;
    }

    const data = await response.json();
    const members = data.query?.categorymembers || [];
    
    // Extract category names (remove "Category:" prefix)
    const categoryNames = members
      .map((member: any) => member.title?.replace(/^Category:/, ''))
      .filter((name: string) => name && name !== categoryFilter); // Avoid circular references
    
    subcategories.push(...categoryNames);
    
    cmcontinue = data.continue?.cmcontinue;
    iterations++;
    
    console.log(`[WikiSearch] Found ${categoryNames.length} subcategories in ${categoryFilter} (total: ${subcategories.length})`);
    
  } while (cmcontinue && iterations < maxIterations);
  
  return subcategories;
}

/**
 * Get all category members including from subcategories (for iiwiki only)
 */
async function getAllCategoryMembersWithSubcategories(categoryFilter: string, config: WikiConfig, site: 'ixwiki' | 'iiwiki' | 'althistory'): Promise<any[]> {
  // Only search subcategories for iiwiki
  if (site !== 'iiwiki') {
    return getAllCategoryMembers(categoryFilter, config);
  }
  
  console.log(`[WikiSearch] Searching ${categoryFilter} and its subcategories on ${site}`);
  
  // Get direct members of the main category
  const directMembers = await getAllCategoryMembers(categoryFilter, config);
  
  // Get subcategories
  const subcategories = await getCategorySubcategories(categoryFilter, config);
  console.log(`[WikiSearch] Found ${subcategories.length} subcategories:`, subcategories.slice(0, 5));
  
  // Get members from each subcategory (limit to prevent overwhelming requests)
  const maxSubcategories = 15;
  const subcategoriesToSearch = subcategories.slice(0, maxSubcategories);
  
  const subcategoryMembers: any[] = [];
  
  for (const subcategory of subcategoriesToSearch) {
    try {
      console.log(`[WikiSearch] Searching subcategory: ${subcategory}`);
      const members = await getAllCategoryMembers(subcategory, config);
      
      // Mark these as coming from a subcategory for potential different handling
      const markedMembers = members.map(member => ({
        ...member,
        fromSubcategory: subcategory
      }));
      
      subcategoryMembers.push(...markedMembers);
      
      // Small delay to be respectful to the API
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (error) {
      console.warn(`[WikiSearch] Failed to get members from subcategory ${subcategory}:`, error);
    }
  }
  
  console.log(`[WikiSearch] Total members: ${directMembers.length} direct + ${subcategoryMembers.length} from subcategories`);
  
  return [...directMembers, ...subcategoryMembers];
}

/**
 * Perform targeted search within a set of known titles
 */
async function performTargetedSearch(
  query: string,
  candidateTitles: string[],
  config: WikiConfig
): Promise<any[]> {
  try {
    const params = new URLSearchParams({
      action: 'query',
      format: 'json',
      list: 'search',
      srsearch: query,
      srprop: 'snippet',
      srlimit: '50',
    });

    const response = await fetch(`${config.baseUrl}${config.apiEndpoint}?${params.toString()}`, {
      headers: {
        'User-Agent': 'IxStats-Builder',
      },
    });

    if (!response.ok) {
      return [];
    }

    const data = await response.json();
    const searchResults = data.query?.search || [];
    
    // Filter to only include our candidate titles
    const candidateSet = new Set(candidateTitles.map(t => t.toLowerCase()));
    
    return searchResults.filter((result: any) => 
      candidateSet.has(result.title.toLowerCase())
    );
    
  } catch (error) {
    console.error('Targeted search failed:', error);
    return [];
  }
}

/**
 * Create appropriate wiki URL for the site
 */
function createWikiUrl(title: string, _config: WikiConfig, site: 'ixwiki' | 'iiwiki' | 'althistory'): string {
  // Generate actual external wiki URLs, not API proxy URLs
  const siteUrls: Record<string, string> = {
    ixwiki: 'https://ixwiki.com',
    iiwiki: 'https://iiwiki.com',
    althistory: 'https://althistory.fandom.com'
  };
  
  const baseUrl = siteUrls[site];
  const wikiPath = '/wiki';
  const titleParam = `/${encodeURIComponent(title.replace(/ /g, '_'))}`;
  
  return `${baseUrl}${wikiPath}${titleParam}`;
}

/**
 * Calculate string similarity for fuzzy matching
 * Returns a value between 0 and 1, where 1 is identical
 */
function calculateSimilarity(str1: string, str2: string): number {
  if (str1 === str2) return 1;
  if (str1.length === 0 || str2.length === 0) return 0;
  
  // Simple similarity based on common characters in order
  let matches = 0;
  const minLength = Math.min(str1.length, str2.length);
  
  for (let i = 0; i < minLength; i++) {
    if (str1[i] === str2[i]) {
      matches++;
    }
  }
  
  // Account for length difference
  const lengthPenalty = Math.abs(str1.length - str2.length) / Math.max(str1.length, str2.length);
  const similarity = (matches / Math.max(str1.length, str2.length)) * (1 - lengthPenalty);
  
  return similarity;
}

/**
 * Parse country infobox from a wiki page
 */
export async function parseCountryInfobox(
  pageName: string, 
  site: 'ixwiki' | 'iiwiki' | 'althistory'
): Promise<ParsedCountryData | null> {
  const wikiConfigs = getWikiConfigs();
  const config = wikiConfigs[site];
  if (!config) {
    throw new Error(`Unsupported wiki site: ${site}`);
  }

  try {
    // Get page wikitext
    const wikitext = await getPageWikitext(pageName, config);
    if (!wikitext) {
      return null;
    }

    // Extract and parse infobox
    const infoboxTemplate = extractInfoboxTemplate(wikitext);
    if (!infoboxTemplate) {
      return null;
    }

    const templateData = parseInfoboxParameters(infoboxTemplate, site);
    const infobox = createInfoboxObject(pageName, templateData, infoboxTemplate, site);
    
    // Extract key economic data
    const parsedData = await extractEconomicData(infobox, site);
    
    return {
      name: pageName,
      ...parsedData,
      infobox,
    };

  } catch (error) {
    console.error(`Failed to parse infobox for ${pageName} on ${site}:`, error);
    throw new Error(`Failed to parse country data: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Get raw wikitext for a page
 */
async function getPageWikitext(pageName: string, config: WikiConfig): Promise<string | null> {
  const params = new URLSearchParams({
    action: 'query',
    prop: 'revisions',
    rvprop: 'content',
    titles: pageName,
    rvsection: '0',
    format: 'json',
    formatversion: '2'
  });

  const response = await fetch(`${config.baseUrl}${config.apiEndpoint}?${params.toString()}`, {
    headers: {
      'User-Agent': 'IxStats-Builder',
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  const data = await response.json();
  
  if (data.error) {
    throw new Error(`Wiki API Error: ${data.error.info || data.error.code}`);
  }

  const pages = data.query?.pages;
  if (!pages || !Array.isArray(pages) || pages.length === 0) {
    return null;
  }

  const page = pages[0];
  if (!page || page.missing) {
    return null;
  }

  const revisions = page.revisions;
  if (!revisions || !Array.isArray(revisions) || revisions.length === 0) {
    return null;
  }

  return revisions[0]?.content || null;
}

/**
 * Extract Infobox country template from wikitext
 */
function extractInfoboxTemplate(wikitext: string): string | null {
  try {
    // Find where the infobox starts
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
        break;
      }
    }

    if (!startMatch || startIndex === -1) {
      return null;
    }

    // Find the complete template by counting braces
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
          templateEnd = i + 2;
          break;
        }
        i += 2;
      } else {
        i++;
      }
    }

    return wikitext.substring(startIndex, templateEnd);

  } catch (error) {
    console.error('Error extracting infobox template:', error);
    return null;
  }
}

/**
 * Parse infobox template parameters
 */
function parseInfoboxParameters(templateWikitext: string, site: 'ixwiki' | 'iiwiki' | 'althistory' = 'ixwiki'): Record<string, string> {
  const parameters: Record<string, string> = {};
  
  try {
    // Extract content between {{Infobox country and }}
    const content = extractTemplateContent(templateWikitext);
    if (!content) {
      return parameters;
    }
    
    // Find parameter boundaries
    const parameterBoundaries = findParameterBoundaries(content);
    
    // Extract parameter values
    const parsedParams = extractParameterValues(content, parameterBoundaries);
    
    // Clean and process each parameter with comprehensive wikitext processing
    for (const [key, value] of Object.entries(parsedParams)) {
      if (key && value !== undefined) {
        let processedValue = value.trim();
        
        // Always process wikitext for proper template and markup handling
        processedValue = processWikitext(processedValue, site);
        
        parameters[key] = processedValue;
      }
    }
    
    return parameters;

  } catch (error) {
    console.error('Error parsing infobox parameters:', error);
    return parameters;
  }
}

/**
 * Extract template content between {{ and }}
 */
function extractTemplateContent(templateWikitext: string): string | null {
  const trimmed = templateWikitext.trim();
  
  // Find start after "{{Infobox country"
  const startPatterns = [
    /^\{\{\s*Infobox\s+country\s*/i,
    /^\{\{\s*Infobox_country\s*/i,
    /^\{\{\s*infobox\s*country\s*/i
  ];
  
  let contentStart = 0;
  
  for (const pattern of startPatterns) {
    const match = trimmed.match(pattern);
    if (match) {
      contentStart = match[0].length;
      break;
    }
  }
  
  if (contentStart === 0) {
    return null;
  }
  
  // Find matching closing }} by counting braces
  let braceDepth = 1;
  let contentEnd = trimmed.length;
  let i = contentStart;
  
  while (i < trimmed.length - 1) {
    const char = trimmed[i];
    const nextChar = trimmed[i + 1];
    
    if (char === '{' && nextChar === '{') {
      braceDepth++;
      i += 2;
    } else if (char === '}' && nextChar === '}') {
      braceDepth--;
      if (braceDepth === 0) {
        contentEnd = i;
        break;
      }
      i += 2;
    } else {
      i++;
    }
  }
  
  return trimmed.substring(contentStart, contentEnd);
}

/**
 * Find parameter boundaries in template content
 */
function findParameterBoundaries(content: string): Array<{name: string, start: number, nameEnd: number}> {
  const boundaries: Array<{name: string, start: number, nameEnd: number}> = [];
  
  const parameterPattern = /\|\s*([^=\|\{\[\n]+?)\s*=/g;
  let match;
  
  while ((match = parameterPattern.exec(content)) !== null) {
    const paramName = match[1]?.trim();
    if (paramName && paramName.length > 0) {
      boundaries.push({
        name: paramName,
        start: match.index,
        nameEnd: match.index + match[0].length
      });
    }
  }
  
  return boundaries;
}

/**
 * Extract parameter values using boundaries
 */
function extractParameterValues(
  content: string, 
  boundaries: Array<{name: string, start: number, nameEnd: number}>
): Record<string, string> {
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
    
    // Remove trailing | if it exists
    if (rawValue.endsWith('|')) {
      rawValue = rawValue.slice(0, -1).trim();
    }
    
    parameters[current.name] = rawValue;
  }
  
  return parameters;
}

/**
 * Process wikitext with comprehensive template and markup handling
 */
function processWikitext(value: string, site: 'ixwiki' | 'iiwiki' | 'althistory' = 'ixwiki'): string {
  if (!value) return '';
  
  let processed = value.trim();
  
  // Remove HTML comments first
  processed = processed.replace(/<!--[\s\S]*?-->/g, '');
  
  // Process templates iteratively to handle nested templates
  let iterations = 0;
  const maxIterations = 3;
  
  while (processed.includes('{{') && iterations < maxIterations) {
    const beforeProcessing = processed;
    iterations++;
    
    // Handle {{wp|target|display}} and {{wp|target}} templates (convert to proper links)
    processed = processed.replace(/\{\{wp\|([^|}]+)\|([^}]+)\}\}/g, (_match: string, target: string, display: string) => {
      return createWikiLink(target.trim(), display.trim(), site);
    });
    
    processed = processed.replace(/\{\{wp\|([^}]+)\}\}/g, (_match: string, target: string) => {
      const cleanTarget = target.trim();
      return createWikiLink(cleanTarget, cleanTarget, site);
    });
    
    // Handle similar link templates
    processed = processed.replace(/\{\{link\|([^|}]+)\|([^}]+)\}\}/g, (_match: string, target: string, display: string) => {
      return createWikiLink(target.trim(), display.trim(), site);
    });
    
    processed = processed.replace(/\{\{link\|([^}]+)\}\}/g, (_match: string, target: string) => {
      const cleanTarget = target.trim();
      return createWikiLink(cleanTarget, cleanTarget, site);
    });
    
    // Handle {{lang|code|text}} templates (language templates)
    processed = processed.replace(/\{\{lang\|[^|]+\|([^}]+)\}\}/g, '$1');
    
    // Handle formatting templates
    processed = processed.replace(/\{\{nowrap\|([^}]+)\}\}/g, '$1');
    processed = processed.replace(/\{\{small\|([^}]+)\}\}/g, '$1');
    processed = processed.replace(/\{\{big\|([^}]+)\}\}/g, '$1');
    processed = processed.replace(/\{\{b\|([^}]+)\}\}/g, '<strong>$1</strong>');
    processed = processed.replace(/\{\{i\|([^}]+)\}\}/g, '<em>$1</em>');
    
    // Handle {{abbr|abbreviation|full form}} templates
    processed = processed.replace(/\{\{abbr\|([^|]+)\|([^}]+)\}\}/g, '<abbr title="$2">$1</abbr>');
    
    // Handle {{convert|number|unit|...}} templates
    processed = processed.replace(/\{\{convert\|([^|]+)\|([^|]+)[\|][^}]*\}\}/g, (_match: string, num: string, unit: string) => `${num.trim()} ${unit.trim()}`);
    processed = processed.replace(/\{\{convert\|([^|]+)\|([^}]+)\}\}/g, (_match: string, num: string, unit: string) => `${num.trim()} ${unit.trim()}`);
    
    // Handle {{currency|amount|code}} templates
    processed = processed.replace(/\{\{currency\|([^|]+)\|([^}]+)\}\}/g, (_match: string, amount: string, code: string) => `${amount.trim()} ${code.trim()}`);
    
    // Handle {{flag|country}} templates - convert to links
    processed = processed.replace(/\{\{flag\|([^}]+)\}\}/g, (_match: string, country: string) => {
      const cleanCountry = country.trim();
      return createWikiLink(cleanCountry, `🏴 ${cleanCountry}`, site);
    });
    
    // Handle {{flagicon|country}} templates by converting to emoji
    processed = processed.replace(/\{\{flagicon\|[^}]+\}\}/g, '🏴');
    
    // Handle {{color|color|text}} templates
    processed = processed.replace(/\{\{color\|([^|]+)\|([^}]+)\}\}/g, (_match: string, color: string, text: string) => {
      return `<span style="color: ${color.trim()}">${text.trim()}</span>`;
    });
    
    // Handle utility templates
    processed = processed.replace(/\{\{nbsp\}\}/g, ' ');
    processed = processed.replace(/\{\{•\}\}/g, '•');
    processed = processed.replace(/\{\{and\}\}/g, ' and ');
    processed = processed.replace(/\{\{or\}\}/g, ' or ');
    processed = processed.replace(/\{\{comma\}\}/g, ', ');
    processed = processed.replace(/\{\{br\}\}/g, '<br>');
    processed = processed.replace(/\{\{break\}\}/g, '<br>');
    
    // Handle mathematical notation
    processed = processed.replace(/\{\{sup\|([^}]+)\}\}/g, '<sup>$1</sup>');
    processed = processed.replace(/\{\{sub\|([^}]+)\}\}/g, '<sub>$1</sub>');
    
    // Handle date templates
    processed = processed.replace(/\{\{date\|([^|}]+)[\|][^}]*\}\}/g, '$1');
    processed = processed.replace(/\{\{date\|([^}]+)\}\}/g, '$1');
    
    // Remove complex templates that we can't easily parse
    processed = processed.replace(/\{\{coord\|[^}]+\}\}/g, '');
    processed = processed.replace(/\{\{age\|[^}]+\}\}/g, '');
    
    // If no change in this iteration, break to avoid infinite loop
    if (beforeProcessing === processed) {
      break;
    }
  }
  
  // Clean remaining simple templates
  processed = cleanRemainingTemplates(processed);
  
  // Handle wiki links - convert to proper HTML links
  processed = processed.replace(/\[\[([^\|\]]+)\|([^\]]+)\]\]/g, (_match: string, page: string, display: string) => {
    return createWikiLink(page.trim(), display.trim(), site);
  });
  
  processed = processed.replace(/\[\[([^\]]+)\]\]/g, (_match: string, page: string) => {
    const cleanPage = page.trim();
    return createWikiLink(cleanPage, cleanPage, site);
  });
  
  // Handle file links specially - extract just the filename
  processed = processed.replace(/\[\[File:([^\|\]]+)(?:\|[^\]]+)?\]\]/g, '$1');
  
  // Handle wiki formatting
  processed = processed
    .replace(/'''([^']+)'''/g, '<strong>$1</strong>') // Bold
    .replace(/''([^']+)''/g, '<em>$1</em>')           // Italic
    .replace(/<br\s*\/?>/gi, '<br>')                  // Normalize line breaks
    .replace(/\s+/g, ' ')                             // Multiple spaces
    .trim();
  
  return processed;
}

/**
 * Create a proper wiki link with correct site URL
 */
function createWikiLink(target: string, display: string, site: 'ixwiki' | 'iiwiki' | 'althistory' = 'ixwiki'): string {
  const normalizedTarget = target.replace(/ /g, '_').replace(/^_+|_+$/g, '');
  
  // Use the same URL generation logic as createWikiUrl
  const siteUrls = {
    ixwiki: 'https://ixwiki.com',
    iiwiki: 'https://iiwiki.com',
    althistory: 'https://althistory.fandom.com'
  };
  
  const baseUrl = siteUrls[site];
  const wikiPath = '/wiki';
  const titleParam = `/${encodeURIComponent(normalizedTarget)}`;
  const wikiUrl = `${baseUrl}${wikiPath}${titleParam}`;
  
  const safeDisplay = display.replace(/[&<>"']/g, (char: string) => {
    const escapeMap: Record<string, string> = {
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    };
    return escapeMap[char] ?? char;
  });
  return `<a href="${wikiUrl}" target="_blank" rel="noopener noreferrer" style="color: #429284; text-decoration: none;">${safeDisplay}</a>`;
}

/**
 * Clean any remaining simple templates that weren't handled by specific processors
 */
function cleanRemainingTemplates(text: string): string {
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
             !complexTemplateRegex.exec(trimmed);
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

/**
 * Create infobox object from template data
 */
function createInfoboxObject(
  pageName: string, 
  templateData: Record<string, string>, 
  rawWikitext: string,
  site: 'ixwiki' | 'iiwiki' | 'althistory' = 'ixwiki'
): CountryInfoboxWithDynamicProps {
  const infobox: CountryInfoboxWithDynamicProps = {
    name: pageName,
    rawWikitext,
    parsedTemplateData: templateData,
  };
  
  // Map template parameters to infobox properties with proper wikitext processing
  for (const [key, value] of Object.entries(templateData)) {
    if (key && value && value.trim()) {
      (infobox as Record<string, string>)[key] = processWikitext(value, site);
    }
  }
  
  return infobox;
}

/**
 * Extract economic data from infobox
 */
async function extractEconomicData(infobox: CountryInfoboxWithDynamicProps, site: 'ixwiki' | 'iiwiki' | 'althistory'): Promise<Partial<ParsedCountryData>> {
  const data: Partial<ParsedCountryData> = {};
  
  // Extract population
  const populationFields = [
    infobox.population_estimate,
    infobox.population_census,
    infobox.population
  ];
  
  for (const field of populationFields) {
    if (field) {
      const num = parseNumber(field);
      if (num > 0) {
        data.population = num;
        break;
      }
    }
  }
  
  // Extract GDP per capita
  const gdpPerCapitaFields = [
    infobox.GDP_PPP_per_capita,
    infobox.GDP_nominal_per_capita,
    infobox.gdp_ppp_per_capita,
    infobox.gdp_nominal_per_capita
  ];
  
  for (const field of gdpPerCapitaFields) {
    if (field) {
      const num = parseNumber(field);
      if (num > 0) {
        data.gdpPerCapita = num;
        break;
      }
    }
  }
  
  // Extract total GDP
  const gdpFields = [
    infobox.GDP_PPP,
    infobox.GDP_nominal,
    infobox.gdp_ppp,
    infobox.gdp_nominal,
    infobox.gdp
  ];
  
  for (const field of gdpFields) {
    if (field) {
      const num = parseNumber(field);
      if (num > 0) {
        data.gdp = num;
        break;
      }
    }
  }
  
  // Extract area
  const areaFields = [
    infobox.area_km2,
    infobox.area,
    infobox.area_total
  ];
  
  for (const field of areaFields) {
    if (field) {
      const num = parseNumber(field);
      if (num > 0) {
        data.area = num;
        break;
      }
    }
  }
  
  // Extract text fields
  data.capital = infobox.capital || infobox.capital_city;
  data.government = infobox.government_type || infobox.government;
  data.currency = infobox.currency || infobox.currency_code;
  data.languages = infobox.official_languages || infobox.official_language || infobox.languages;
  
  // Extract flag and coat of arms filenames
  const flagValue = infobox.image_flag || infobox.flag;
  const coaValue = infobox.image_coat || infobox.coat_of_arms || infobox.coa || infobox.coat_arms;
  
  data.flag = extractImageFile(typeof flagValue === 'string' ? flagValue : undefined);
  data.coatOfArms = extractImageFile(typeof coaValue === 'string' ? coaValue : undefined);
  
  // Resolve image URLs using unified flag service for flags, fallback to original method for coat of arms
  if (data.flag) {
    try {
      // Use unified flag service for cache-first flag retrieval using the infobox name
      const countryName = infobox.name || '';
      const flagUrl = await unifiedFlagService.getFlagUrl(countryName);
      data.flagUrl = flagUrl || undefined;
    } catch (error) {
      console.warn(`Failed to get flag from unified service for ${infobox.name}, falling back to direct image URL`, error);
      // Fallback to direct image URL resolution
      data.flagUrl = await getImageUrl(data.flag, site) || undefined;
    }
  }
  
  if (data.coatOfArms) {
    data.coatOfArmsUrl = await getImageUrl(data.coatOfArms, site) || undefined;
  }
  
  return data;
}

/**
 * Extract image filename from various infobox formats
 */
function extractImageFile(value?: string): string | undefined {
  if (!value || typeof value !== 'string') return undefined;

  let cleaned = value.trim();
  let filename: string | undefined;

  // Try to extract filename from various formats
  // Remove File: prefix if present
  if (cleaned.toLowerCase().startsWith('file:')) {
    filename = cleaned.substring(5).trim();
  } else {
    // Extract from [[File:filename|...]] format
    const fileMatch = cleaned.match(/\[\[File:([^\|\]]+)(?:\|[^\]]+)?\]\]/i);
    if (fileMatch) {
      filename = fileMatch[1]?.trim();
    } else {
      // If it contains HTML links, try to extract filename
      const htmlMatch = cleaned.match(/href=["'][^"']*\/([^/"']+\.(png|jpg|jpeg|gif|svg|webp))["']/i);
      if (htmlMatch) {
        filename = htmlMatch[1];
      } else {
        // Assume it's a direct filename if no other pattern matches
        filename = cleaned;
      }
    }
  }

  // Now, strictly validate the extracted filename against common image extensions
  if (filename && /\.(png|jpg|jpeg|gif|svg|webp)$/i.test(filename)) {
    return filename;
  }

  return undefined;
}

/**
 * Get full image URL from wiki filename
 */
async function getImageUrl(filename: string, site: 'ixwiki' | 'iiwiki' | 'althistory'): Promise<string | null> {
  if (!filename) return null;
  
  const wikiConfigs = getWikiConfigs();
  const config = wikiConfigs[site];
  if (!config) return null;
  
  try {
    const params = new URLSearchParams({
      action: 'query',
      format: 'json',
      titles: `File:${filename}`,
      prop: 'imageinfo',
      iiprop: 'url',
      iilimit: '1',
    });

    const url = `${config.baseUrl}${config.apiEndpoint}?${params.toString()}`;
    console.log(`[WikiImageSearch] Getting image URL from: ${url}`);

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'IxStats-Builder/1.0 (https://ixwiki.com/wiki/IxStats; stats@ixwiki.com) MediaWiki-API/1.0',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Cache-Control': 'no-cache',
        'Referer': site === 'ixwiki' ? 'https://ixwiki.com/' : 'https://iiwiki.com/',
        'Connection': 'keep-alive',
      },
    });

    if (!response.ok) {
      if (response.status === 403) {
        console.warn(`[WikiSearch] 403 Forbidden when getting image URL for ${filename} from ${site}`);
      } else {
        console.warn(`[WikiSearch] Failed to get image URL: ${response.status} ${response.statusText}`);
      }
      return null;
    }

    const data = await response.json();
    console.log(`[WikiImageSearch] Image info response for ${filename}:`, JSON.stringify(data).substring(0, 300));
    
    const pages = data.query?.pages;
    
    if (!pages || typeof pages !== 'object') {
      console.warn(`[WikiImageSearch] No pages data for ${filename}`);
      return null;
    }
    
    const pageIds = Object.keys(pages);
    if (pageIds.length === 0) {
      console.warn(`[WikiImageSearch] No page IDs for ${filename}`);
      return null;
    }
    
    const page = pages[pageIds[0]!];
    if (!page || page.missing) {
      console.warn(`[WikiImageSearch] Page missing for ${filename}`);
      return null;
    }
    
    if (!page.imageinfo?.[0]?.url) {
      console.warn(`[WikiImageSearch] No image URL in response for ${filename}`);
      return null;
    }
    
    const imageUrl = page.imageinfo[0].url;
    console.log(`[WikiImageSearch] Found image URL for ${filename}: ${imageUrl}`);
    return imageUrl;
  } catch (error) {
    console.error(`[WikiImageSearch] Failed to get image URL for ${filename} on ${site}:`, error);
    return null;
  }
}

/**
 * Search for images only in the File namespace
 */
export async function searchWikiImages(
  query: string,
  site: 'ixwiki' | 'iiwiki' | 'althistory'
): Promise<Array<{ name: string; path: string; url?: string; description?: string; }>> {
  const result = await searchWikiImagesWithPagination(query, site, undefined, 20);
  return result.images;
}

export async function searchWikiImagesWithPagination(
  query: string,
  site: 'ixwiki' | 'iiwiki' | 'althistory',
  cursor?: string,
  limit: number = 30
): Promise<{ 
  images: Array<{ name: string; path: string; url?: string; description?: string; }>; 
  nextCursor?: string;
  hasMore: boolean;
}> {
  const wikiConfigs = getWikiConfigs();
  const config = wikiConfigs[site];
  if (!config) {
    throw new Error(`Unsupported wiki site: ${site}`);
  }

  try {
    console.log(`[WikiImageSearch] Searching ${site} for images matching: "${query}"`);
    
    // Define valid image extensions
    const validExtensions = ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp'];
    
    // Normalize query for prefix search
    // - Replace spaces with underscores (MediaWiki stores titles with underscores)
    // - Strip any leading "File:" prefix if user included it
    // - Capitalize first character to match MediaWiki's first-letter normalization
    const normalizedInput = query
      .trim()
      .replace(/^File:/i, '')
      .replace(/\s+/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_+|_+$/g, '');

    const prefixQuery = normalizedInput.length > 0
      ? normalizedInput.charAt(0).toUpperCase() + normalizedInput.slice(1)
      : '';
    
    console.log(`[WikiImageSearch] Using prefix: "${prefixQuery}"`);
    
    // Use allimages with aiprefix to find files starting with the query
    const searchParams = new URLSearchParams({
      action: 'query',
      format: 'json',
      list: 'allimages',
      aiprefix: prefixQuery, // Search for files starting with this prefix
      aiprop: 'url|timestamp|size|mime',
      ailimit: '50', // Get up to 50 results
      aisort: 'name',
    });

    // Add continuation if provided
    if (cursor) {
      searchParams.set('aicontinue', cursor);
    }

    const url = `${config.baseUrl}${config.apiEndpoint}?${searchParams.toString()}`;
    console.log(`[WikiImageSearch] Prefix search URL: ${url}`);

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'IxStats-Builder/1.0 (https://ixwiki.com/wiki/IxStats; stats@ixwiki.com) MediaWiki-API/1.0',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
        'Referer': site === 'ixwiki' ? 'https://ixwiki.com/' : 'https://iiwiki.com/',
        'Origin': site === 'ixwiki' ? 'https://ixwiki.com' : 'https://iiwiki.com',
        'DNT': '1',
        'Connection': 'keep-alive',
        'Sec-Fetch-Dest': 'empty',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Site': 'same-origin',
      },
    });

    console.log(`[WikiImageSearch] Response status: ${response.status}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[WikiImageSearch] Error response: ${errorText.substring(0, 200)}`);
      
      // Cloudflare protection or other blocking
      if (response.status === 403 || response.status === 503 || errorText.includes('cloudflare')) {
        console.warn(`[WikiSearch] ${site} blocked request (possibly Cloudflare). Returning empty results.`);
        return { images: [], hasMore: false };
      }
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const contentType = response.headers.get('content-type');
    
    // Check if we got HTML instead of JSON (Cloudflare challenge page)
    if (contentType?.includes('text/html')) {
      console.warn(`[WikiSearch] ${site} returned HTML (Cloudflare challenge). Returning empty results.`);
      return { images: [], hasMore: false };
    }

    const data = await response.json();
    
    if (data.error) {
      console.error(`[WikiImageSearch] API error:`, data.error);
      throw new Error(`Wiki API Error: ${data.error.info || data.error.code}`);
    }

    const allImages = data.query?.allimages || [];
    const continuationToken = data.continue?.aicontinue;
    
    console.log(`[WikiImageSearch] Found ${allImages.length} images with prefix "${prefixQuery}", continuation: ${continuationToken || 'none'}`);
    
    // Filter for valid image extensions and convert to our format
    const imageResults = [] as Array<{ name: string; path: string; url?: string; description?: string }>;
    
    for (const image of allImages) {
      const imageName = image.name || '';
      const imageNameLower = imageName.toLowerCase();
      
      // Check if file has valid image extension (png, jpg, jpeg, gif, svg, webp)
      const hasValidExtension = validExtensions.some(ext => 
        imageNameLower.endsWith(`.${ext}`)
      );
      
      if (!hasValidExtension) {
        console.log(`[WikiImageSearch] Skipping ${imageName} - not a valid image extension`);
        continue;
      }
      
      if (image.url) {
        imageResults.push({
          name: `File:${imageName}`,
          path: image.url,
          url: image.url,
          description: imageName,
        });
        
        console.log(`[WikiImageSearch] Added: File:${imageName} -> ${image.url}`);
      }
      
      if (imageResults.length >= limit) {
        break;
      }
    }
    
    // Rank results with case-insensitive, context-aware scoring
    const ranked = imageResults
      .map((img) => ({ img, score: scoreImageRelevance(img.description || img.name, query) }))
      .sort((a, b) => b.score - a.score)
      .map((r) => r.img);

    // Deduplicate by name, preserve order
    const uniqueByName = new Map<string, { name: string; path: string; url?: string; description?: string }>();
    for (const r of ranked) {
      if (!uniqueByName.has(r.name)) uniqueByName.set(r.name, r);
      if (uniqueByName.size >= limit) break;
    }

    let finalResults = Array.from(uniqueByName.values());

    // Fallback: if not enough, do fulltext search in File namespace and merge
    if (finalResults.length < limit) {
      const needed = limit - finalResults.length;
      try {
        const fallback = await searchFilesFulltext(query, site, needed, config);
        for (const fb of fallback) {
          if (!uniqueByName.has(fb.name)) {
            uniqueByName.set(fb.name, fb);
            finalResults.push(fb);
            if (finalResults.length >= limit) break;
          }
        }
      } catch (fallbackErr) {
        console.warn('[WikiImageSearch] Fallback fulltext search failed:', fallbackErr);
      }
    }

    // Determine if there are more results (based on prefix continuation)
    const hasMore = finalResults.length >= limit && !!continuationToken;

    console.log(`[WikiImageSearch] Returning ${finalResults.length} image results (ranked), hasMore: ${hasMore}, nextCursor: ${continuationToken || 'none'}`);

    return {
      images: finalResults,
      nextCursor: continuationToken,
      hasMore,
    };

  } catch (error) {
    console.error(`[WikiImageSearch] Search failed for ${site}:`, error);
    if (error instanceof Error && (error.message.includes('403') || error.message.includes('Forbidden'))) {
      console.warn(`[WikiSearch] Returning empty results for ${site} due to access restrictions`);
      return { images: [], hasMore: false };
    }
    throw new Error(`Failed to search ${site} images: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Parse number from string, handling common formats
 */
function parseNumber(str: string | Record<string, string>): number {
  if (!str) return 0;
  
  // Handle object case
  if (typeof str !== 'string') {
    return 0;
  }
  
  // Remove common formatting
  let cleaned = str
    .replace(/[,\s]/g, '')
    .replace(/\$|€|£|¥|₹/g, '')
    .replace(/\([^)]*\)/g, '')
    .trim();
  
  // Handle scientific notation and multipliers
  const multipliers = {
    'trillion': 1e12,
    'billion': 1e9,
    'million': 1e6,
    'thousand': 1e3,
    'k': 1e3,
    'm': 1e6,
    'b': 1e9,
    't': 1e12
  };
  
  for (const [suffix, multiplier] of Object.entries(multipliers)) {
    if (cleaned.toLowerCase().includes(suffix)) {
      const numPart = cleaned.toLowerCase().replace(suffix, '').trim();
      const num = parseFloat(numPart);
      if (!isNaN(num)) {
        return num * multiplier;
      }
    }
  }
  
  // Try direct parsing
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}
