// Wiki search service supporting both ixwiki.com and iiwiki.com
import type { CountryInfoboxWithDynamicProps } from "./mediawiki-service";

interface WikiConfig {
  baseUrl: string;
  apiEndpoint: string;
  searchNamespace?: number[];
}

const wikiConfigs: Record<string, WikiConfig> = {
  ixwiki: {
    baseUrl: "https://ixwiki.com",
    apiEndpoint: "/api.php",
    searchNamespace: [0], // Main namespace
  },
  iiwiki: {
    baseUrl: "https://iiwiki.com",
    apiEndpoint: "/mediawiki/api.php", 
    searchNamespace: [0], // Main namespace
  }
};

interface SearchResult {
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
  infobox: CountryInfoboxWithDynamicProps;
}

/**
 * Search for countries on a specific wiki
 */
export async function searchWiki(
  query: string, 
  site: 'ixwiki' | 'iiwiki', 
  categoryFilter?: string
): Promise<SearchResult[]> {
  const config = wikiConfigs[site];
  if (!config) {
    throw new Error(`Unsupported wiki site: ${site}`);
  }

  try {
    // For IIWiki, use a different approach since incategory doesn't work
    if (site === 'iiwiki' && categoryFilter) {
      return await searchIIWikiWithCategory(query, categoryFilter, config);
    }

    let searchParams = new URLSearchParams({
      action: 'query',
      format: 'json',
      list: 'search',
      srsearch: query,
      srprop: 'snippet',
      srlimit: '20',
      srnamespace: config.searchNamespace?.join('|') || '0',
    });

    // Add category filter for IxWiki
    if (categoryFilter && site === 'ixwiki') {
      searchParams.set('srsearch', `${query} incategory:"${categoryFilter}"`);
    }

    const response = await fetch(`${config.baseUrl}${config.apiEndpoint}?${searchParams.toString()}`, {
      headers: {
        'User-Agent': 'IxStats-Builder/1.0 (https://ixstats.com) MediaWiki-Search',
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
      const wikiPath = site === 'iiwiki' ? '/mediawiki/index.php' : '/wiki';
      const titleParam = site === 'iiwiki' ? `?title=${encodeURIComponent(result.title)}` : `/${encodeURIComponent(result.title.replace(/ /g, '_'))}`;
      
      return {
        title: result.title,
        snippet: result.snippet || '',
        url: `${config.baseUrl}${wikiPath}${titleParam}`,
        namespace: result.ns,
      };
    });

  } catch (error) {
    console.error(`Wiki search failed for ${site}:`, error);
    throw new Error(`Failed to search ${site}: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Search IIWiki with category filtering using a different approach
 * Since IIWiki doesn't support incategory: syntax, we'll get category members and then filter
 */
async function searchIIWikiWithCategory(
  query: string,
  categoryFilter: string,
  config: WikiConfig
): Promise<SearchResult[]> {
  try {
    // First, get all pages in the category
    const categoryParams = new URLSearchParams({
      action: 'query',
      format: 'json',
      list: 'categorymembers',
      cmtitle: `Category:${categoryFilter}`,
      cmlimit: '500', // Get more members to search through
      cmnamespace: '0', // Main namespace only
    });

    const categoryResponse = await fetch(`${config.baseUrl}${config.apiEndpoint}?${categoryParams.toString()}`, {
      headers: {
        'User-Agent': 'IxStats-Builder/1.0 (https://ixstats.com) MediaWiki-Search',
      },
    });

    if (!categoryResponse.ok) {
      throw new Error(`HTTP ${categoryResponse.status}: ${categoryResponse.statusText}`);
    }

    const categoryData = await categoryResponse.json();
    const categoryMembers = categoryData.query?.categorymembers || [];

    if (categoryMembers.length === 0) {
      return [];
    }

    // Filter category members by the search query
    const filteredMembers = categoryMembers.filter((member: any) => 
      member.title.toLowerCase().includes(query.toLowerCase())
    );

    // If we have a lot of matches, do a regular search within the category
    if (filteredMembers.length > 20) {
      // Fall back to regular search but mention it's filtered
      const searchParams = new URLSearchParams({
        action: 'query',
        format: 'json',
        list: 'search',
        srsearch: query,
        srprop: 'snippet',
        srlimit: '20',
        srnamespace: '0',
      });

      const searchResponse = await fetch(`${config.baseUrl}${config.apiEndpoint}?${searchParams.toString()}`, {
        headers: {
          'User-Agent': 'IxStats-Builder/1.0 (https://ixstats.com) MediaWiki-Search',
        },
      });

      if (searchResponse.ok) {
        const searchData = await searchResponse.json();
        const searchResults = searchData.query?.search || [];
        
        // Filter search results to only include category members
        const categoryTitles = new Set(categoryMembers.map((m: any) => m.title));
        const filteredSearchResults = searchResults.filter((result: any) => 
          categoryTitles.has(result.title)
        );

        return filteredSearchResults.map((result: any) => {
          const wikiPath = '/mediawiki/index.php';
          const titleParam = `?title=${encodeURIComponent(result.title)}`;
          
          return {
            title: result.title,
            snippet: result.snippet || `Country in Category:${categoryFilter}`,
            url: `${config.baseUrl}${wikiPath}${titleParam}`,
            namespace: result.ns,
          };
        });
      }
    }

    // Convert to search result format for direct matches
    const wikiPath = '/mediawiki/index.php';
    
    return filteredMembers.slice(0, 20).map((member: any) => ({
      title: member.title,
      snippet: `Country in Category:${categoryFilter}`,
      url: `${config.baseUrl}${wikiPath}?title=${encodeURIComponent(member.title)}`,
      namespace: member.ns,
    }));

  } catch (error) {
    console.error('IIWiki category search failed:', error);
    throw error;
  }
}

/**
 * Parse country infobox from a wiki page
 */
export async function parseCountryInfobox(
  pageName: string, 
  site: 'ixwiki' | 'iiwiki'
): Promise<ParsedCountryData | null> {
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

    const templateData = parseInfoboxParameters(infoboxTemplate);
    const infobox = createInfoboxObject(pageName, templateData, infoboxTemplate);
    
    // Extract key economic data
    const parsedData = extractEconomicData(infobox);
    
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
      'User-Agent': 'IxStats-Builder/1.0 (https://ixstats.com) MediaWiki-Parser',
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
function parseInfoboxParameters(templateWikitext: string): Record<string, string> {
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
    
    // Clean and process each parameter
    for (const [key, value] of Object.entries(parsedParams)) {
      if (key && value !== undefined) {
        let processedValue = value.trim();
        
        // Basic cleaning for non-template values
        if (!processedValue.includes('{{')) {
          processedValue = cleanParameterValue(processedValue);
        }
        
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
 * Clean parameter value by removing wiki markup
 */
function cleanParameterValue(value: string): string {
  if (!value) return '';
  
  let cleaned = value.trim();
  
  // Remove HTML comments
  cleaned = cleaned.replace(/<!--[\s\S]*?-->/g, '');
  
  // Handle wiki links - convert [[Page|Display]] to Display
  cleaned = cleaned.replace(/\[\[([^\|\]]+)\|([^\]]+)\]\]/g, '$2');
  cleaned = cleaned.replace(/\[\[([^\]]+)\]\]/g, '$1');
  
  // Remove file links
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
  
  return cleaned;
}

/**
 * Create infobox object from template data
 */
function createInfoboxObject(
  pageName: string, 
  templateData: Record<string, string>, 
  rawWikitext: string
): CountryInfoboxWithDynamicProps {
  const infobox: CountryInfoboxWithDynamicProps = {
    name: pageName,
    rawWikitext,
    parsedTemplateData: templateData,
  };
  
  // Map template parameters to infobox properties
  for (const [key, value] of Object.entries(templateData)) {
    if (key && value && value.trim()) {
      (infobox as Record<string, string>)[key] = cleanParameterValue(value);
    }
  }
  
  return infobox;
}

/**
 * Extract economic data from infobox
 */
function extractEconomicData(infobox: CountryInfoboxWithDynamicProps): Partial<ParsedCountryData> {
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
  
  return data;
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