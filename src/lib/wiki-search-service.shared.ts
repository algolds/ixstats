export interface WikiConfig {
  baseUrl: string;
  apiEndpoint: string;
  searchNamespace?: number[];
}

export interface SearchResult {
  title: string;
  snippet: string;
  url: string;
  namespace?: number;
}

// Helper function to get the base URL for API requests
export function getApiBaseUrl(): string {
  // In server-side context (Node.js), we need absolute URLs
  if (typeof window === 'undefined') {
    // Server-side: use environment variable or default to localhost
    return process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  }
  // Client-side: use relative URLs
  return '';
}

// Function to get wiki configs with proper URLs
export function getWikiConfigs(): Record<string, WikiConfig> {
  if (typeof window === 'undefined') {
    // Server-side: use direct URLs
    return {
      ixwiki: {
        baseUrl: 'https://ixwiki.com/api.php',
        apiEndpoint: '',
        searchNamespace: [0, 6],
      },
      iiwiki: {
        baseUrl: 'https://iiwiki.com/mediawiki/api.php',
        apiEndpoint: '',
        searchNamespace: [0, 6],
      },
      althistory: {
        baseUrl: 'https://althistory.fandom.com/api.php',
        apiEndpoint: '',
        searchNamespace: [0, 6],
      },
    };
  }

  // Client-side: use proxy URLs
  const baseUrl = getApiBaseUrl(); // This will be '' on the client
  return {
    ixwiki: {
      baseUrl: `${baseUrl}/api/ixwiki-proxy/api.php`,
      apiEndpoint: "", 
      searchNamespace: [0, 6], // Main and Media namespaces
    },
    iiwiki: {
      baseUrl: `${baseUrl}/api/iiwiki-proxy/mediawiki/api.php`,
      apiEndpoint: "", 
      searchNamespace: [0, 6], // Main and Media namespaces
    },
    althistory: {
      baseUrl: `${baseUrl}/api/althistory-wiki-proxy/api.php`,
      apiEndpoint: "",
      searchNamespace: [0, 6], // Main and Media namespaces
    }
  };
}

/**
 * Create appropriate wiki URL for the site
 */
export function createWikiUrl(title: string, _config: WikiConfig, site: 'ixwiki' | 'iiwiki' | 'althistory'): string {
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
 * Get full image URL from wiki filename
 */
export async function getImageUrl(filename: string, site: 'ixwiki' | 'iiwiki' | 'althistory'): Promise<string | null> {
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
      iilimit: '1'
    });

    const response = await fetch(`${config.baseUrl}${config.apiEndpoint}?${params.toString()}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36',
        'Referer': 'https://iiwiki.com/',
      },
    });

    if (!response.ok) return null;

    const data = await response.json();
    const pages = data.query?.pages;
    
    if (!pages || typeof pages !== 'object') return null;
    
    const pageIds = Object.keys(pages);
    if (pageIds.length === 0) return null;
    
    const page = pages[pageIds[0]!];
    if (!page || page.missing || !page.imageinfo?.[0]?.url) return null;
    
    return page.imageinfo[0].url;
  } catch (error) {
    console.error(`Failed to get image URL for ${filename} on ${site}:`, error);
    return null;
  }
}