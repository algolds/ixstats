/**
 * EligibleCountryService — Discovers eligible countries from IIWiki and AltHistory Wiki.
 *
 * Scans "Countries" and "Nations" categories, parses infoboxes, and scores
 * completeness based on 10 required parameters.
 *
 * 3-tier caching:
 *   Tier 1: Persistent file cache (data/cache/eligible-countries/{source}.json)
 *   Tier 2: In-memory service cache with stale-while-revalidate
 *   Tier 3: tRPC cachedStaticProcedure (handled separately, 1hr TTL)
 *
 * SERVER-ONLY module — do not import in client components.
 */

import * as fs from "fs";
import * as fsPromises from "fs/promises";
import * as path from "path";
import { getFullIiwikiApiUrl } from "~/lib/wiki-os/adapters/mediawiki/bridge/http-reader";
import { parseInfoboxWithTemplates, type UnifiedInfoboxData } from "./unified-parser";
import { withRetrySafe } from "~/lib/system/with-retry";
import { DEFAULT_USER_AGENT } from "~/lib/wiki-os/config";
import { withBasePath } from "~/lib/base-path";

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

export interface EligibleCountryResult {
  pageName: string;
  displayName: string;
  completeness: number;
  flagUrl?: string;
  population?: number;
  gdp?: string;
  capital?: string;
  governmentType?: string;
  leaderTitle?: string;
  leaderName?: string;
  currency?: string;
  currencyCode?: string;
  languages?: string;
  areaKm2?: number;
  demonym?: string;
  lifeExpectancy?: number;
  literacyRate?: number;
  urbanization?: number;
  internetTld?: string;
  callingCode?: string;
  anthem?: string;
  motto?: string;
  coordinates?: string;
  largestCity?: string;
  officialName?: string;
}

interface FileCacheEntry {
  cachedAt: string;
  countries: EligibleCountryResult[];
}

interface MemoryCacheEntry {
  data: EligibleCountryResult[];
  cachedAt: Date;
  refreshPromise: Promise<EligibleCountryResult[]> | null;
}

// ──────────────────────────────────────────────
// Constants
// ──────────────────────────────────────────────

const ALTHISTORY_API = "https://althistory.fandom.com/api.php";
const USER_AGENT = DEFAULT_USER_AGENT;

const CACHE_DIR = path.join(process.cwd(), "data", "cache", "eligible-countries");

const ONE_HOUR_MS = 60 * 60 * 1000;
const TWENTY_FOUR_HOURS_MS = 24 * ONE_HOUR_MS;

function getSiteApiUrl(site: "iiwiki" | "althistory"): string {
  if (site === "iiwiki") {
    return getFullIiwikiApiUrl();
  }
  return ALTHISTORY_API;
}

const SITE_CATEGORIES: Record<"iiwiki" | "althistory", string[]> = {
  iiwiki: ["Countries", "Nations"],
  althistory: ["Countries", "Nations"],
};

// ──────────────────────────────────────────────
// In-memory cache (Tier 2)
// ──────────────────────────────────────────────

const memoryCache = new Map<"iiwiki" | "althistory", MemoryCacheEntry>();

if (process.env.NODE_ENV === "development") {
  memoryCache.clear(); // HMR service cache bust trigger
}

// ──────────────────────────────────────────────
// File cache helpers (Tier 1)
// ──────────────────────────────────────────────

function getCacheFilePath(site: "iiwiki" | "althistory"): string {
  return path.join(CACHE_DIR, `${site}.json`);
}

async function ensureCacheDir(): Promise<void> {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
}

async function readCacheFile(
  site: "iiwiki" | "althistory"
): Promise<EligibleCountryResult[] | null> {
  try {
    const filePath = getCacheFilePath(site);
    const content = await fsPromises.readFile(filePath, "utf-8");
    const parsed: FileCacheEntry = JSON.parse(content);
    if (!Array.isArray(parsed.countries) || parsed.countries.length === 0) {
      return null;
    }
    return parsed.countries;
  } catch {
    return null;
  }
}

async function writeCacheFile(
  site: "iiwiki" | "althistory",
  countries: EligibleCountryResult[]
): Promise<void> {
  if (!countries || countries.length === 0) {
    return;
  }
  try {
    await ensureCacheDir();
    const filePath = getCacheFilePath(site);
    const entry: FileCacheEntry = {
      cachedAt: new Date().toISOString(),
      countries,
    };
    await fsPromises.writeFile(filePath, JSON.stringify(entry), "utf-8");
  } catch (err) {
    console.error(`[EligibleCountries] Failed to write cache file for ${site}:`, err);
  }
}

// ──────────────────────────────────────────────
// Category member fetching with pagination
// ──────────────────────────────────────────────

async function fetchCategoryMembers(
  category: string,
  site: "iiwiki" | "althistory"
): Promise<string[]> {
  const apiBase = getSiteApiUrl(site);
  const allTitles: string[] = [];
  let cmcontinue: string | undefined;
  let iterations = 0;
  const maxIterations = 20;

  do {
    const params = new URLSearchParams({
      action: "query",
      format: "json",
      list: "categorymembers",
      cmtitle: `Category:${category}`,
      cmlimit: "500",
      cmnamespace: "0",
    });

    if (cmcontinue) {
      params.set("cmcontinue", cmcontinue);
    }

    const url = `${apiBase}?${params.toString()}`;

    const result = await withRetrySafe(
      async (signal) => {
        const response = await fetch(url, {
          headers: {
            "User-Agent": USER_AGENT,
            "Api-User-Agent": USER_AGENT,
          },
          signal,
        });
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        return response.json() as Promise<{
          query?: { categorymembers?: Array<{ title: string }> };
          continue?: { cmcontinue?: string };
        }>;
      },
      {
        maxAttempts: 3,
        strategy: "linear",
        baseDelayMs: 2000,
        timeoutMs: 20000,
      }
    );

    if (!result.success || !result.value) {
      console.warn(
        `[EligibleCountries] Failed to fetch category members for ${category} on ${site}`
      );
      break;
    }

    const data = result.value;
    const members = data.query?.categorymembers ?? [];
    for (const member of members) {
      if (member.title) {
        allTitles.push(member.title);
      }
    }

    cmcontinue = data.continue?.cmcontinue;
    iterations++;
  } while (cmcontinue && iterations < maxIterations);

  return allTitles;
}

async function getAllPageTitles(site: "iiwiki" | "althistory"): Promise<string[]> {
  const categories = SITE_CATEGORIES[site];
  const titleSets = await Promise.allSettled(
    categories.map((cat) => fetchCategoryMembers(cat, site))
  );

  const allTitles = new Set<string>();
  for (const result of titleSets) {
    if (result.status === "fulfilled") {
      for (const title of result.value) {
        allTitles.add(title);
      }
    }
  }

  return Array.from(allTitles);
}

// ──────────────────────────────────────────────
// Completeness calculation
// ──────────────────────────────────────────────

type CompletenessDetails = Omit<EligibleCountryResult, "pageName" | "displayName" | "completeness"> & {
  score: number;
};

function calculateCompleteness(data: UnifiedInfoboxData): CompletenessDetails {
  const hasFlag = !!(data.image_flag || data.flag || data.flagUrl);
  const hasPopulation = !!(data.population || data.population_estimate || data.population_census);
  const hasGdp = !!(data.GDP_PPP || data.GDP_nominal || data.gdp || data.gdp_ppp);
  const hasCapital = !!(data.capital || data.largest_city);
  const hasGovernmentType = !!data.government_type;
  const hasLeaders = !!(
    (data.leader_title1 && data.leader_name1) ||
    data.head_of_state ||
    data.head_of_government
  );
  const hasLanguage = !!(data.official_languages || data.languages);
  const hasCurrency = !!(data.currency || data.currency_code);
  const hasArea = !!(data.area_km2 || data.area_total);
  const hasDemonym = !!data.demonym;

  const count = [
    hasFlag,
    hasPopulation,
    hasGdp,
    hasCapital,
    hasGovernmentType,
    hasLeaders,
    hasLanguage,
    hasCurrency,
    hasArea,
    hasDemonym,
  ].filter(Boolean).length;
  const score = (count / 10) * 100;

  // Extract representative values
  const population =
    typeof data.population === "number"
      ? data.population
      : typeof data.population_estimate === "number"
        ? data.population_estimate
        : typeof data.population_census === "number"
          ? data.population_census
          : undefined;

  const gdp =
    typeof data.GDP_PPP === "string"
      ? data.GDP_PPP
      : typeof data.GDP_nominal === "string"
        ? data.GDP_nominal
        : typeof data.gdp === "number"
          ? String(data.gdp)
          : typeof data.gdp_ppp === "number"
            ? String(data.gdp_ppp)
            : undefined;

  let leaderTitle: string | undefined;
  let leaderName: string | undefined;
  if (data.leader_title1 && data.leader_name1) {
    leaderTitle = data.leader_title1;
    leaderName = data.leader_name1;
  } else if (data.head_of_state) {
    leaderTitle = "Head of State";
    leaderName = data.head_of_state;
  } else if (data.head_of_government) {
    leaderTitle = "Head of Government";
    leaderName = data.head_of_government;
  }

  const areaKm2 =
    typeof data.area_km2 === "number"
      ? data.area_km2
      : typeof data.area_total === "string"
        ? Number(data.area_total.replace(/[^0-9.]/g, "")) || undefined
        : undefined;

  return {
    score,
    flagUrl: (data.image_flag || data.flag || data.flagUrl) as string | undefined,
    population,
    gdp,
    capital: data.capital || data.largest_city,
    governmentType: data.government_type as string | undefined,
    leaderTitle,
    leaderName,
    currency: typeof data.currency === "string" ? data.currency : undefined,
    currencyCode: typeof data.currency_code === "string" ? data.currency_code : undefined,
    languages:
      typeof data.official_languages === "string"
        ? data.official_languages
        : typeof data.languages === "string"
          ? data.languages
          : undefined,
    areaKm2,
    demonym: typeof data.demonym === "string" ? data.demonym : undefined,
    lifeExpectancy: typeof data.life_expectancy === "number" ? data.life_expectancy : undefined,
    literacyRate: typeof data.literacy_rate === "number" ? data.literacy_rate : undefined,
    urbanization: typeof data.urbanization === "number" ? data.urbanization : undefined,
    internetTld: typeof data.internet_tld === "string" ? data.internet_tld : undefined,
    callingCode: typeof data.calling_code === "string" ? data.calling_code : undefined,
    anthem: typeof data.national_anthem === "string" ? data.national_anthem : undefined,
    motto: typeof data.national_motto === "string" ? data.national_motto : undefined,
    coordinates: Array.isArray(data.coordinates) ? data.coordinates.join(", ") : undefined,
    largestCity: typeof data.largest_city === "string" ? data.largest_city : undefined,
    officialName: typeof data.official_name === "string" ? data.official_name : undefined,
  };
}

// ──────────────────────────────────────────────
// Batch Wikitext and Image Fetching
// ──────────────────────────────────────────────

interface MediaWikiQueryPage {
  pageid?: number;
  ns?: number;
  title: string;
  missing?: boolean;
  revisions?: Array<{ slots?: { main?: { content?: string } }; content?: string; "*"?: string }>;
}

interface MediaWikiQueryResponse {
  batchcomplete?: boolean;
  query?: { pages?: MediaWikiQueryPage[] | Record<string, MediaWikiQueryPage> };
}

interface MediaWikiImageInfoPage {
  title?: string;
  missing?: boolean;
  imageinfo?: Array<{ url?: string; thumburl?: string }>;
}

interface MediaWikiImageInfoResponse {
  batchcomplete?: boolean;
  query?: { pages?: MediaWikiImageInfoPage[] | Record<string, MediaWikiImageInfoPage> };
}

async function fetchBatchArticles(
  titles: string[],
  site: "iiwiki" | "althistory"
): Promise<Array<{ title: string; wikitext: string }>> {
  const apiBase = getSiteApiUrl(site);
  const articles: Array<{ title: string; wikitext: string }> = [];
  const WIKITEXT_CHUNK_SIZE = 50;

  for (let i = 0; i < titles.length; i += WIKITEXT_CHUNK_SIZE) {
    const chunk = titles.slice(i, i + WIKITEXT_CHUNK_SIZE);
    const params = new URLSearchParams({
      action: "query",
      format: "json",
      formatversion: "2",
      prop: "revisions",
      rvprop: "content",
      rvslots: "main",
      titles: chunk.join("|"),
    });

    const result = await withRetrySafe(
      async (signal) => {
        const response = await fetch(`${apiBase}?${params.toString()}`, {
          headers: {
            "User-Agent": USER_AGENT,
            "Api-User-Agent": USER_AGENT,
          },
          signal,
        });
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        return response.json() as Promise<MediaWikiQueryResponse>;
      },
      {
        maxAttempts: 3,
        strategy: "linear",
        baseDelayMs: 1500,
        timeoutMs: 15000,
      }
    );

    if (!result.success || !result.value?.query) continue;

    const rawPages = result.value.query.pages;
    const pagesList: MediaWikiQueryPage[] = Array.isArray(rawPages)
      ? rawPages
      : rawPages
        ? Object.values(rawPages)
        : [];

    for (const page of pagesList) {
      if (page.missing || !page.title) continue;
      const rev = page.revisions?.[0];
      const wikitext = rev?.slots?.main?.content ?? rev?.content ?? rev?.["*"] ?? "";
      if (wikitext) {
        articles.push({ title: page.title, wikitext });
      }
    }
  }

  return articles;
}

// ──────────────────────────────────────────────
// Resolve image URLs via MediaWiki API
// ──────────────────────────────────────────────

async function resolveImageUrls(
  filenames: string[],
  site: "iiwiki" | "althistory"
): Promise<Map<string, string>> {
  const apiBase = getSiteApiUrl(site);
  const urlMap = new Map<string, string>();

  const uniqueFilenames = Array.from(new Set(filenames)).filter(Boolean);
  if (uniqueFilenames.length === 0) return urlMap;

  const batchSize = 50;
  for (let i = 0; i < uniqueFilenames.length; i += batchSize) {
    const batch = uniqueFilenames.slice(i, i + batchSize);
    const titles = batch.map((f) => `File:${f.replace(/^(File|Image):/i, "").trim()}`);
    const titlesParam = titles.join("|");

    const params = new URLSearchParams({
      action: "query",
      format: "json",
      formatversion: "2",
      titles: titlesParam,
      prop: "imageinfo",
      iiprop: "url",
      iiurlwidth: "640",
    });

    try {
      const response = await fetch(`${apiBase}?${params.toString()}`, {
        headers: {
          "User-Agent": USER_AGENT,
          "Api-User-Agent": USER_AGENT,
        },
      });

      if (!response.ok) continue;

      const data = (await response.json()) as MediaWikiImageInfoResponse;
      const rawPages = data.query?.pages;
      const pages: MediaWikiImageInfoPage[] = Array.isArray(rawPages)
        ? rawPages
        : rawPages
          ? Object.values(rawPages)
          : [];

      for (const page of pages) {
        if (page.missing || !page.imageinfo?.[0]) continue;
        const directUrl = page.imageinfo[0].url ?? page.imageinfo[0].thumburl;
        if (directUrl) {
          const urlFilename = directUrl.split("/").pop() ?? "";
          if (urlFilename) {
            const normalizedUrlFile = decodeURIComponent(urlFilename)
              .toLowerCase()
              .replace(/_/g, " ")
              .trim();
            urlMap.set(normalizedUrlFile, directUrl);
          }

          if (page.title) {
            const cleanTitle = page.title
              .replace(/^(File|Image):/i, "")
              .toLowerCase()
              .replace(/_/g, " ")
              .trim();
            urlMap.set(cleanTitle, directUrl);
            urlMap.set(page.title.replace(/^(File|Image):/i, "").trim(), directUrl);
          }
        }
      }
    } catch {
      // Skip failed batch
    }
  }

  return urlMap;
}

// ──────────────────────────────────────────────
// Fetch and process all pages for a site
// ──────────────────────────────────────────────

async function fetchEligibleCountriesRaw(
  site: "iiwiki" | "althistory"
): Promise<EligibleCountryResult[]> {
  console.log(`[EligibleCountries] Scanning ${site}...`);

  const pageTitles = await getAllPageTitles(site);
  if (pageTitles.length === 0) {
    console.warn(`[EligibleCountries] No pages found for ${site}`);
    return [];
  }

  console.log(`[EligibleCountries] Found ${pageTitles.length} pages to scan on ${site}`);

  // 1. Batch fetch wikitext for all pages in chunks of 50
  const articles = await fetchBatchArticles(pageTitles, site);

  // 2. Parse infoboxes in-memory
  const allResults: { result: EligibleCountryResult; flagFilename: string }[] = [];

  for (const { title, wikitext } of articles) {
    const parsed = parseInfoboxWithTemplates(wikitext, title);
    if (!parsed) continue;

    const completeness = calculateCompleteness(parsed);
    if (completeness.score < 80) continue;

    const flagFilename = (parsed.image_flag || parsed.flag || "")
      .replace(/^(File|Image):/i, "")
      .trim();

    const { score, ...details } = completeness;
    allResults.push({
      result: {
        pageName: title,
        displayName: parsed.name || title,
        completeness: score,
        ...details,
        flagUrl: undefined,
      },
      flagFilename,
    });
  }

  // 3. Batch resolve image URLs via MediaWiki API
  const flagFilenames = allResults.map((r) => r.flagFilename).filter(Boolean);
  const urlMap = await resolveImageUrls(flagFilenames, site);

  // 4. Map direct image URLs without Special:FilePath guessing
  const finalResults: EligibleCountryResult[] = allResults.map(({ result, flagFilename }) => {
    if (flagFilename) {
      const cleanName = flagFilename.replace(/^(File|Image):/i, "").trim();
      const lookupKey = cleanName.toLowerCase().replace(/_/g, " ").trim();
      const directUrl =
        urlMap.get(lookupKey) ||
        urlMap.get(cleanName.toLowerCase()) ||
        urlMap.get(cleanName) ||
        urlMap.get(flagFilename);

      if (directUrl) {
        if (site === "iiwiki") {
          const match = directUrl.match(/https?:\/\/(?:www\.)?iiwiki\.com\/(images\/.+)$/i);
          if (match && match[1]) {
            result.flagUrl = withBasePath(`/api/mediawiki/iiwiki/${match[1]}`);
          } else {
            result.flagUrl = directUrl;
          }
        } else {
          result.flagUrl = directUrl;
        }
      }
    }
    return result;
  });

  finalResults.sort(() => Math.random() - 0.5);

  console.log(
    `[EligibleCountries] Found ${finalResults.length} eligible of ${pageTitles.length} pages on ${site}`
  );

  return finalResults;
}

// ──────────────────────────────────────────────
// Public API
// ──────────────────────────────────────────────

/**
 * Get eligible countries for a wiki source with 3-tier caching.
 *
 * - < 1 hour old: serve from memory instantly
 * - 1-24 hours: serve stale from memory + trigger async background refresh
 * - > 24 hours or missing: serve from file cache instantly, then background refresh
 * - Concurrent requests share a single refreshPromise (dedup)
 */
export async function getEligibleCountries(
  site: "iiwiki" | "althistory"
): Promise<EligibleCountryResult[]> {
  const now = new Date();
  const cached = memoryCache.get(site);

  if (cached) {
    const age = now.getTime() - cached.cachedAt.getTime();

    if (age < ONE_HOUR_MS) {
      return cached.data;
    }

    if (age < TWENTY_FOUR_HOURS_MS && cached.refreshPromise) {
      return cached.data;
    }

    if (age < TWENTY_FOUR_HOURS_MS) {
      const refreshPromise = fetchEligibleCountriesRaw(site)
        .then(async (data) => {
          await writeCacheFile(site, data);
          memoryCache.set(site, { data, cachedAt: new Date(), refreshPromise: null });
          return data;
        })
        .catch(async () => {
          memoryCache.set(site, { data: cached.data, cachedAt: new Date(), refreshPromise: null });
          return cached.data;
        });

      memoryCache.set(site, { ...cached, refreshPromise });
      return cached.data;
    }
  }

  const fileCached = await readCacheFile(site);
  if (fileCached && fileCached.length > 0) {
    const refreshPromise = fetchEligibleCountriesRaw(site)
      .then(async (data) => {
        if (data && data.length > 0) {
          await writeCacheFile(site, data);
          memoryCache.set(site, { data, cachedAt: new Date(), refreshPromise: null });
        }
        return data;
      })
      .catch(async () => {
        memoryCache.set(site, { data: fileCached, cachedAt: new Date(), refreshPromise: null });
        return fileCached;
      });

    memoryCache.set(site, { data: fileCached, cachedAt: new Date(), refreshPromise });
    return fileCached;
  }

  const data = await fetchEligibleCountriesRaw(site);
  if (data && data.length > 0) {
    await writeCacheFile(site, data);
  }
  memoryCache.set(site, { data, cachedAt: new Date(), refreshPromise: null });
  return data;
}
