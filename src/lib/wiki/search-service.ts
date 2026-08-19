/**
 * wiki-search-service.ts — Lightweight search service for IxWiki, IIWiki, and AltHistory.
 *
 * ponytail: Streamlined single-purpose search client supporting server and browser execution.
 * Heavy parsing and DB queries are delegated to unified-wiki-parser.ts and wiki-bridge.ts.
 */

import { BASE_PATH } from "~/lib/base-path";
import { DEFAULT_USER_AGENT } from "./config";

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

/**
 * Check if a fetch response is a Cloudflare challenge page instead of valid JSON.
 */
async function assertNotCloudflareChallenge(response: Response, site: string): Promise<void> {
  const contentType = response.headers.get("content-type") || "";
  if (!response.ok && contentType.includes("text/html")) {
    const body = await response.text();
    if (
      body.includes("Just a moment") ||
      body.includes("cf_chl_opt") ||
      body.includes("challenge-platform")
    ) {
      throw new Error(
        `CLOUDFLARE_BLOCKED: ${site} is currently blocking automated requests via Cloudflare protection.`
      );
    }
  }
}

/**
 * Helper function to get the base URL for API requests
 */
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

  // In server-side context (Node.js), we need absolute URLs
  if (
    typeof window === "undefined" ||
    (typeof global !== "undefined" && (global as any).__TEST_IS_SERVER)
  ) {
    const origin =
      process.env.NEXT_PUBLIC_APP_URL ||
      process.env.APP_URL ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined) ||
      `http://localhost:${process.env.PORT ?? "3000"}`;
    return ensureBasePath(origin);
  }
  // Client-side: include base path so fetch works when deployed under a sub-path
  return normalizedBasePath || "";
}

/**
 * Function to get wiki configs with proper URLs
 */
function getWikiConfigs(): Record<string, WikiConfig> {
  const baseUrl = getApiBaseUrl();
  return {
    ixwiki: {
      baseUrl: `${baseUrl}/api/mediawiki/ixwiki`,
      apiEndpoint: "/api.php",
      searchNamespace: [0, 6],
    },
    iiwiki: {
      baseUrl: "https://iiwiki.com",
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

function createWikiUrl(title: string, cfg: WikiConfig, _site: string): string {
  return `${cfg.baseUrl}/index.php?title=${encodeURIComponent(title.replace(/ /g, "_"))}`;
}

async function searchWithCategoryFilter(
  query: string,
  categoryFilter: string,
  cfg: WikiConfig,
  site: string
): Promise<SearchResult[]> {
  const cmparams = new URLSearchParams({
    action: "query",
    format: "json",
    list: "categorymembers",
    cmtitle: categoryFilter,
    cmlimit: "50",
  });
  const cmresp = await fetch(`${cfg.baseUrl}${cfg.apiEndpoint}?${cmparams.toString()}`, {
    headers: { "User-Agent": DEFAULT_USER_AGENT, "Api-User-Agent": DEFAULT_USER_AGENT },
  });
  if (!cmresp.ok) throw new Error(`HTTP ${cmresp.status}`);
  const cmdata = await cmresp.json();
  const members: { title: string }[] = cmdata?.query?.categorymembers || [];
  const titles = members.map((m) => m.title);

  const sp = new URLSearchParams({
    action: "query",
    format: "json",
    list: "search",
    srsearch: query,
    srwhat: "text",
    srlimit: "50",
  });
  const sresp = await fetch(`${cfg.baseUrl}${cfg.apiEndpoint}?${sp.toString()}`, {
    headers: { "User-Agent": DEFAULT_USER_AGENT, "Api-User-Agent": DEFAULT_USER_AGENT },
  });
  if (!sresp.ok) throw new Error(`HTTP ${sresp.status}`);
  const sdata = await sresp.json();
  const results: { title: string; snippet?: string; ns?: number }[] = sdata?.query?.search || [];

  return results
    .filter((r) => titles.some((t) => t.toLowerCase() === r.title.toLowerCase()))
    .map((r) => ({
      title: r.title,
      snippet: r.snippet || "",
      url: createWikiUrl(r.title, cfg, site),
      namespace: r.ns ?? 0,
    }));
}

/**
 * Search for pages on a specific wiki
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

  try {
    if (categoryFilter) {
      return await searchWithCategoryFilter(query, categoryFilter, config, site);
    }

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
          "User-Agent": DEFAULT_USER_AGENT,
          "Api-User-Agent": DEFAULT_USER_AGENT,
        },
      }
    );

    if (!response.ok) {
      await assertNotCloudflareChallenge(response, site);
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();

    if (data.error) {
      throw new Error(`Wiki API Error: ${data.error.info || data.error.code}`);
    }

    const results = data.query?.search || [];

    return results.map((result: any) => ({
      title: result.title,
      snippet: result.snippet || "",
      url: createWikiUrl(result.title, config, site),
      namespace: result.ns,
    }));
  } catch (error) {
    console.error(`Wiki search failed for ${site}:`, error);
    throw new Error(
      `Failed to search ${site}: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}
