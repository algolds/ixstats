// Wiki search service supporting both ixwiki.com and iiwiki.com
// Client-side version: uses direct browser fetch (bypasses Cloudflare for iiwiki)
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
    ? BASE_PATH.startsWith("/")
      ? BASE_PATH
      : `/${BASE_PATH}`
    : "";

  const ensureBasePath = (origin: string): string => {
    const trimmedOrigin = origin.endsWith("/") ? origin.slice(0, -1) : origin;
    if (!normalizedBasePath) {
      return trimmedOrigin;
    }
    return trimmedOrigin.endsWith(normalizedBasePath)
      ? trimmedOrigin
      : `${trimmedOrigin}${normalizedBasePath}`;
  };

  // Client-side: include base path so fetch works when deployed under a sub-path
  return normalizedBasePath || "";
}

// Function to get wiki configs with proper URLs
function getWikiConfigs(): Record<string, WikiConfig> {
  const baseUrl = getApiBaseUrl();
  return {
    ixwiki: {
      baseUrl: `${baseUrl}/api/mediawiki/ixwiki`,
      apiEndpoint: "/api.php",
      searchNamespace: [0, 6],
    },
    iiwiki: {
      // Route through server-side proxy — required for whitelisted User-Agent
      baseUrl: `${baseUrl}/api/mediawiki/iiwiki`,
      apiEndpoint: "/api.php",
      searchNamespace: [0, 6],
    },
    althistory: {
      baseUrl: `${baseUrl}/api/mediawiki/althistory`,
      apiEndpoint: "/api.php",
      searchNamespace: [0, 6],
    },
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
  site: "ixwiki" | "iiwiki" | "althistory",
  categoryFilter?: string
): Promise<SearchResult[]> {
  const wikiConfigs = getWikiConfigs();
  const config = wikiConfigs[site];
  if (!config) {
    throw new Error(`Unsupported wiki site: ${site}`);
  }

  function createWikiUrl(title: string, cfg: WikiConfig, _site: string): string {
    return `${cfg.baseUrl}/index.php?title=${encodeURIComponent(title.replace(/ /g, "_"))}`;
  }

  async function searchWithCategoryFilter(
    q: string,
    catFilter: string,
    cfg: WikiConfig,
    _site: string
  ): Promise<SearchResult[]> {
    const cmparams = new URLSearchParams({
      action: "query",
      format: "json",
      list: "categorymembers",
      cmtitle: catFilter,
      cmlimit: "50",
    });
    const cmresp = await fetch(`${cfg.baseUrl}${cfg.apiEndpoint}?${cmparams.toString()}`, {
      headers: { "User-Agent": "IxStats-Builder" },
    });
    if (!cmresp.ok) throw new Error(`HTTP ${cmresp.status}`);
    const cmdata = await cmresp.json();
    const members: { title: string }[] = cmdata?.query?.categorymembers || [];
    const titles = members.map((m) => m.title);
    const sp = new URLSearchParams({
      action: "query",
      format: "json",
      list: "search",
      srsearch: q,
      srwhat: "text",
      srlimit: "50",
    });
    const sresp = await fetch(`${cfg.baseUrl}${cfg.apiEndpoint}?${sp.toString()}`, {
      headers: { "User-Agent": "IxStats-Builder" },
    });
    if (!sresp.ok) throw new Error(`HTTP ${sresp.status}`);
    const sdata = await sresp.json();
    const results: { title: string; snippet: string }[] = sdata?.query?.search || [];
    return results
      .filter((r) => titles.some((t) => t.toLowerCase() === r.title.toLowerCase()))
      .map((r) => ({
        title: r.title,
        snippet: r.snippet || "",
        url: createWikiUrl(r.title, cfg, _site),
        namespace: 0,
      }));
  }

  try {
    // Use comprehensive category search for both sites when category filter is provided
    if (categoryFilter) {
      console.log(
        `[WikiSearch] Using comprehensive category search for ${site} with category: ${categoryFilter}`
      );
      return await searchWithCategoryFilter(query, categoryFilter, config, site);
    }

    // Fallback to regular search when no category filter
    const searchParams = new URLSearchParams({
      action: "query",
      format: "json",
      list: "search",
      srsearch: query,
      srprop: "snippet",
    });

    const response = await fetch(
      `${config.baseUrl}${config.apiEndpoint}?${searchParams.toString()}`,
      {
        headers: {
          "User-Agent": "IxStats-Builder",
        },
      }
    );

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
        snippet: result.snippet || "",
        url: createWikiUrl(result.title, config, site),
        namespace: result.ns,
      };
    });
  } catch (error) {
    console.error(`Wiki search failed for ${site}:`, error);
    throw new Error(
      `Failed to search ${site}: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}
