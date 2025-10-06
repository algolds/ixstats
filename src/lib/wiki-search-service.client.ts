import type { WikiConfig } from './wiki-search-service.shared';
import { getWikiConfigs, getImageUrl } from './wiki-search-service.shared';

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
 * Search for images only in the File namespace
 */
export async function searchWikiImages(
  query: string,
  site: 'ixwiki' | 'iiwiki' | 'althistory'
): Promise<Array<{ name: string; path: string; url?: string; description?: string; }>> {
  const wikiConfigs = getWikiConfigs();
  const config = wikiConfigs[site];
  if (!config) {
    throw new Error(`Unsupported wiki site: ${site}`);
  }

  try {
    // Search only in File namespace (namespace 6)
    const searchParams = new URLSearchParams({
      action: 'query',
      format: 'json',
      list: 'search',
      srsearch: query,
      srprop: 'snippet',
      srlimit: '20',
      srnamespace: '6', // File namespace only
    });

    const response = await fetch(`${config.baseUrl}${config.apiEndpoint}?${searchParams.toString()}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36',
        'Referer': 'https://iiwiki.com/',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    
    if (data.error) {
      throw new Error(`Wiki API Error: ${data.error.info || data.error.code}`);
    }

    const searchResults = data.query?.search || [];
    
    // Filter for actual image files and get their URLs
    const imageResults = [];
    
    for (const result of searchResults) {
      // Check if it's an actual image file
      if (result.title && result.title.startsWith('File:') && 
          /\.(png|jpg|jpeg|gif|svg|webp)$/i.test(result.title)) {
        
        // Get the image URL
        const filename = result.title.replace('File:', '');
        const imageUrl = await getImageUrl(filename, site);
        
        if (imageUrl) {
          imageResults.push({
            name: result.title,
            path: imageUrl,
            url: imageUrl,
            description: result.snippet || '',
          });
        }
      }
    }
    
    return imageResults;

  } catch (error) {
    console.error(`Wiki image search failed for ${site}:`, error);
    throw new Error(`Failed to search ${site} images: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}