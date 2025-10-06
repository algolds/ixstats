import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

puppeteer.use(StealthPlugin());
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
    browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
    const page = await browser.newPage();
    
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

    await page.goto(apiUrl, { waitUntil: 'networkidle2' });

    const content = await page.content();
    // The response is likely wrapped in HTML, so we need to extract the JSON
    const jsonRegex = /<pre.*?>([\s\S]*)<\/pre>/;
    const match = content.match(jsonRegex);

    if (match && match[1]) {
      const data = JSON.parse(match[1]);
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
    } else {
        // If no <pre> tag, maybe it's a direct JSON response
        const bodyText = await page.evaluate(() =>  {
            return document.querySelector('body')?.innerText;
        });
        try {
            const data = JSON.parse(bodyText || '');
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
        } catch (e) {
            console.error("iiwiki response body:", bodyText);
            throw new Error('Failed to parse JSON from iiwiki response');
        }
    }

  } catch (error) {
    console.error(`Puppeteer search failed for ${site}:`, error);
    throw new Error(`Failed to search ${site} with Puppeteer: ${error instanceof Error ? error.message : 'Unknown error'}`);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}
