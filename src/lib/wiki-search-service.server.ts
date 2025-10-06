import type { SearchResult, WikiConfig } from './wiki-search-service';
import { getWikiConfigs, createWikiUrl } from './wiki-search-service.shared';

/**
 * Search for countries on a specific wiki using Puppeteer to bypass Cloudflare
 */
export async function searchWikiWithPuppeteer(
  query: string, 
  site: 'iiwiki', 
  categoryFilter?: string
): Promise<SearchResult[]> {
  const wikiConfigs = getWikiConfigs();
  const config = wikiConfigs[site];
  if (!config) {
    throw new Error(`Unsupported wiki site: ${site}`);
  }

  let browser;
  try {
    // Use puppeteer directly without stealth plugin to avoid bundling issues
    const puppeteer = await import('puppeteer');
    
    browser = await puppeteer.default.launch({ 
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-blink-features=AutomationControlled',
        '--disable-features=IsolateOrigins,site-per-process',
        '--disable-web-security',
        '--disable-gpu',
        '--window-size=1920,1080',
        '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      ]
    });
    
    const page = await browser.newPage();
    
    // Set viewport
    await page.setViewport({ width: 1920, height: 1080 });
    
    // Set a realistic user agent
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    // Set additional headers to appear more like a real browser
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
      'Accept-Encoding': 'gzip, deflate, br',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Sec-Fetch-User': '?1',
      'Cache-Control': 'max-age=0'
    });
    
    // Override the webdriver property to hide automation
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', {
        get: () => false,
      });
    });
    
    // Override navigator properties to appear more like a real browser
    await page.evaluateOnNewDocument(() => {
      // Pass the Permissions Test
      const originalQuery = window.navigator.permissions.query;
      window.navigator.permissions.query = (parameters: any) =>
        parameters.name === 'notifications'
          ? Promise.resolve({ state: 'denied' } as PermissionStatus)
          : originalQuery(parameters);

      // Pass the Plugins Length Test
      Object.defineProperty(navigator, 'plugins', {
        get: () => [1, 2, 3, 4, 5],
      });

      // Pass the Languages Test
      Object.defineProperty(navigator, 'languages', {
        get: () => ['en-US', 'en'],
      });

      // Pass the Chrome Test
      (window as any).chrome = {
        runtime: {},
      };
    });
    
    let searchParams = new URLSearchParams({
      action: 'query',
      format: 'json',
      list: 'search',
      srsearch: query,
      srprop: 'snippet',
      srlimit: '30',
      srnamespace: config.searchNamespace?.join('|') || '0',
    });

    const apiUrl = `${config.baseUrl}${config.apiEndpoint}?${searchParams.toString()}`;
    console.log(`[WikiSearchPuppeteer] Fetching from URL: ${apiUrl}`);

    // Navigate to the API URL
    const response = await page.goto(apiUrl, { 
      waitUntil: 'networkidle2',
      timeout: 30000
    });

    if (!response) {
      throw new Error('Failed to load page - no response received');
    }

    // Check if we got blocked by Cloudflare
    const title = await page.title();
    console.log(`[WikiSearchPuppeteer] Page title: ${title}`);
    
    if (title.toLowerCase().includes('cloudflare') || title.toLowerCase().includes('just a moment')) {
      console.error('[WikiSearchPuppeteer] Cloudflare challenge detected');
      
      // Wait a bit for Cloudflare to potentially complete
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      // Check title again
      const newTitle = await page.title();
      console.log(`[WikiSearchPuppeteer] Page title after wait: ${newTitle}`);
    }

    // Try to get JSON directly from the response
    const contentType = response.headers()['content-type'];
    console.log(`[WikiSearchPuppeteer] Content-Type: ${contentType}`);

    // Get the page content
    const content = await page.content();
    console.log(`[WikiSearchPuppeteer] Response length: ${content.length}`);
    console.log(`[WikiSearchPuppeteer] First 500 chars:`, content.substring(0, 500));

    // Try multiple parsing strategies
    let data = null;

    // Strategy 1: Try to parse from <pre> tag (common for API responses)
    const jsonRegex = /<pre.*?>([\s\S]*?)<\/pre>/;
    const match = content.match(jsonRegex);

    if (match && match[1]) {
      console.log('[WikiSearchPuppeteer] Found JSON in <pre> tag');
      try {
        data = JSON.parse(match[1]);
      } catch (e) {
        console.error('[WikiSearchPuppeteer] Failed to parse JSON from <pre> tag:', e);
      }
    }

    // Strategy 2: Try to get body text and parse as JSON
    if (!data) {
      console.log('[WikiSearchPuppeteer] Trying to extract body text');
      const bodyText = await page.evaluate(() => {
        return document.querySelector('body')?.innerText || document.body?.textContent || '';
      });
      
      if (bodyText) {
        console.log(`[WikiSearchPuppeteer] Body text length: ${bodyText.length}`);
        console.log(`[WikiSearchPuppeteer] Body text preview:`, bodyText.substring(0, 300));
        
        try {
          data = JSON.parse(bodyText.trim());
          console.log('[WikiSearchPuppeteer] Successfully parsed JSON from body text');
        } catch (e) {
          console.error('[WikiSearchPuppeteer] Failed to parse JSON from body text:', e);
        }
      }
    }

    // Strategy 3: Check if this is a Cloudflare block page
    if (!data) {
      const hasCloudflare = content.toLowerCase().includes('cloudflare');
      const hasChallenge = content.toLowerCase().includes('challenge');
      
      if (hasCloudflare || hasChallenge) {
        throw new Error('Cloudflare protection is blocking the request. The wiki API cannot be accessed at this time.');
      }
      
      throw new Error('Failed to parse JSON from iiwiki response. The page may be showing an error or challenge page.');
    }

    // Process the parsed data
    if (data.error) {
      throw new Error(`Wiki API Error: ${data.error.info || data.error.code}`);
    }

    const results = data.query?.search || [];
    return results.map((result: any) => ({
      title: result.title,
      snippet: result.snippet || '',
      url: createWikiUrl(result.title, config, site),
      namespace: result.ns,
    }));

  } catch (error) {
    console.error(`Puppeteer search failed for ${site}:`, error);
    throw new Error(`Failed to search ${site} with Puppeteer: ${error instanceof Error ? error.message : 'Unknown error'}`);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}
