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

import * as fsPromises from "fs/promises";
import * as path from "path";
import {
  ALTHISTORY_API,
  getFullIiwikiApiUrl,
  pagesOf,
} from "~/lib/wiki-os/adapters/mediawiki/bridge/http-reader";
import { parseInfoboxWithTemplates, type UnifiedInfoboxData } from "./unified-parser";
import { withRetrySafe } from "~/lib/system/with-retry";
import { DEFAULT_USER_AGENT } from "~/lib/wiki-os/config";
import { withBasePath } from "~/lib/base-path";

type Site = "iiwiki" | "althistory";

interface EligibleCountryResult {
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

const WIKI_HEADERS = { "User-Agent": DEFAULT_USER_AGENT, "Api-User-Agent": DEFAULT_USER_AGENT };

const CACHE_DIR = path.join(process.cwd(), "data", "cache", "eligible-countries");

const ONE_HOUR_MS = 60 * 60 * 1000;
const TWENTY_FOUR_HOURS_MS = 24 * ONE_HOUR_MS;

const CATEGORIES = ["Countries", "Nations"];

const getSiteApiUrl = (site: Site): string =>
  site === "iiwiki" ? getFullIiwikiApiUrl() : ALTHISTORY_API;

/** Tier 2 cache. */
const memoryCache = new Map<Site, MemoryCacheEntry>();

/** Tier 1 cache. */
const getCacheFilePath = (site: Site): string => path.join(CACHE_DIR, `${site}.json`);

async function readCacheFile(site: Site): Promise<EligibleCountryResult[] | null> {
  try {
    const content = await fsPromises.readFile(getCacheFilePath(site), "utf-8");
    const parsed: FileCacheEntry = JSON.parse(content);
    return Array.isArray(parsed.countries) && parsed.countries.length > 0 ? parsed.countries : null;
  } catch {
    return null;
  }
}

async function writeCacheFile(site: Site, countries: EligibleCountryResult[]): Promise<void> {
  if (!countries || countries.length === 0) return;
  try {
    await fsPromises.mkdir(CACHE_DIR, { recursive: true });
    const entry: FileCacheEntry = { cachedAt: new Date().toISOString(), countries };
    await fsPromises.writeFile(getCacheFilePath(site), JSON.stringify(entry), "utf-8");
  } catch (err) {
    console.error(`[EligibleCountries] Failed to write cache file for ${site}:`, err);
  }
}

/** GET a MediaWiki API URL with retries; null when every attempt failed. */
async function fetchWikiJson<T>(
  url: string,
  retry: { baseDelayMs: number; timeoutMs: number }
): Promise<T | null> {
  const result = await withRetrySafe(
    async (signal) => {
      const response = await fetch(url, { headers: WIKI_HEADERS, signal });
      if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      return response.json() as Promise<T>;
    },
    { maxAttempts: 3, strategy: "linear", ...retry }
  );
  return result.success && result.value ? result.value : null;
}

async function fetchCategoryMembers(category: string, site: Site): Promise<string[]> {
  const apiBase = getSiteApiUrl(site);
  const titles: string[] = [];
  let cmcontinue: string | undefined;

  for (let page = 0; page < 20; page++) {
    const params = new URLSearchParams({
      action: "query",
      format: "json",
      list: "categorymembers",
      cmtitle: `Category:${category}`,
      cmlimit: "500",
      cmnamespace: "0",
    });
    if (cmcontinue) params.set("cmcontinue", cmcontinue);

    const data = await fetchWikiJson<{
      query?: { categorymembers?: Array<{ title: string }> };
      continue?: { cmcontinue?: string };
    }>(`${apiBase}?${params}`, { baseDelayMs: 2000, timeoutMs: 20000 });

    if (!data) {
      console.warn(
        `[EligibleCountries] Failed to fetch category members for ${category} on ${site}`
      );
      break;
    }

    for (const member of data.query?.categorymembers ?? []) {
      if (member.title) titles.push(member.title);
    }
    cmcontinue = data.continue?.cmcontinue;
    if (!cmcontinue) break;
  }

  return titles;
}

async function getAllPageTitles(site: Site): Promise<string[]> {
  const results = await Promise.allSettled(
    CATEGORIES.map((cat) => fetchCategoryMembers(cat, site))
  );
  const titles = results.flatMap((result) => (result.status === "fulfilled" ? result.value : []));
  return Array.from(new Set(titles));
}

type CompletenessDetails = Omit<
  EligibleCountryResult,
  "pageName" | "displayName" | "completeness"
> & {
  score: number;
};

const str = (value: unknown): string | undefined => (typeof value === "string" ? value : undefined);
const num = (value: unknown): number | undefined => (typeof value === "number" ? value : undefined);
const firstString = (...values: unknown[]): string | undefined =>
  values.find((v): v is string => typeof v === "string");
const firstNumber = (...values: unknown[]): number | undefined =>
  values.find((v): v is number => typeof v === "number");

function pickLeader(data: UnifiedInfoboxData): { leaderTitle?: string; leaderName?: string } {
  if (data.leader_title1 && data.leader_name1) {
    return { leaderTitle: data.leader_title1, leaderName: data.leader_name1 };
  }
  if (data.head_of_state) return { leaderTitle: "Head of State", leaderName: data.head_of_state };
  if (data.head_of_government) {
    return { leaderTitle: "Head of Government", leaderName: data.head_of_government };
  }
  return {};
}

function parseAreaKm2(data: UnifiedInfoboxData): number | undefined {
  if (typeof data.area_km2 === "number") return data.area_km2;
  if (typeof data.area_total !== "string") return undefined;
  return Number(data.area_total.replace(/[^0-9.]/g, "")) || undefined;
}

/** Scores an infobox against 10 required parameters (10 points each) and extracts display values. */
function calculateCompleteness(data: UnifiedInfoboxData): CompletenessDetails {
  const flag = data.image_flag || data.flag || data.flagUrl;
  const criteria = [
    flag,
    data.population || data.population_estimate || data.population_census,
    data.GDP_PPP || data.GDP_nominal || data.gdp || data.gdp_ppp,
    data.capital || data.largest_city,
    data.government_type,
    (data.leader_title1 && data.leader_name1) || data.head_of_state || data.head_of_government,
    data.official_languages || data.languages,
    data.currency || data.currency_code,
    data.area_km2 || data.area_total,
    data.demonym,
  ];
  const gdpNumber = firstNumber(data.gdp, data.gdp_ppp);

  return {
    score: (criteria.filter(Boolean).length / criteria.length) * 100,
    flagUrl: flag as string | undefined,
    population: firstNumber(data.population, data.population_estimate, data.population_census),
    gdp:
      firstString(data.GDP_PPP, data.GDP_nominal) ??
      (gdpNumber === undefined ? undefined : String(gdpNumber)),
    capital: data.capital || data.largest_city,
    governmentType: data.government_type as string | undefined,
    ...pickLeader(data),
    currency: str(data.currency),
    currencyCode: str(data.currency_code),
    languages: firstString(data.official_languages, data.languages),
    areaKm2: parseAreaKm2(data),
    demonym: str(data.demonym),
    lifeExpectancy: num(data.life_expectancy),
    literacyRate: num(data.literacy_rate),
    urbanization: num(data.urbanization),
    internetTld: str(data.internet_tld),
    callingCode: str(data.calling_code),
    anthem: str(data.national_anthem),
    motto: str(data.national_motto),
    coordinates: Array.isArray(data.coordinates) ? data.coordinates.join(", ") : undefined,
    largestCity: str(data.largest_city),
    officialName: str(data.official_name),
  };
}

interface MediaWikiQueryPage {
  title: string;
  missing?: boolean;
  revisions?: Array<{ slots?: { main?: { content?: string } }; content?: string; "*"?: string }>;
}

interface MediaWikiImageInfoPage {
  title?: string;
  missing?: boolean;
  imageinfo?: Array<{ url?: string; thumburl?: string }>;
}

interface MediaWikiPagesResponse<P> {
  query?: { pages?: P[] | Record<string, P> };
}

const BATCH_SIZE = 50;

async function fetchBatchArticles(
  titles: string[],
  site: Site
): Promise<Array<{ title: string; wikitext: string }>> {
  const apiBase = getSiteApiUrl(site);
  const articles: Array<{ title: string; wikitext: string }> = [];

  for (let i = 0; i < titles.length; i += BATCH_SIZE) {
    const params = new URLSearchParams({
      action: "query",
      format: "json",
      formatversion: "2",
      prop: "revisions",
      rvprop: "content",
      rvslots: "main",
      titles: titles.slice(i, i + BATCH_SIZE).join("|"),
    });

    const data = await fetchWikiJson<MediaWikiPagesResponse<MediaWikiQueryPage>>(
      `${apiBase}?${params}`,
      { baseDelayMs: 1500, timeoutMs: 15000 }
    );
    if (!data?.query) continue;

    for (const page of pagesOf(data.query.pages)) {
      if (page.missing || !page.title) continue;
      const rev = page.revisions?.[0];
      const wikitext = rev?.slots?.main?.content ?? rev?.content ?? rev?.["*"] ?? "";
      if (wikitext) articles.push({ title: page.title, wikitext });
    }
  }

  return articles;
}

const stripFilePrefix = (name: string): string => name.replace(/^(File|Image):/i, "").trim();
const normalizeFileKey = (name: string): string => name.toLowerCase().replace(/_/g, " ").trim();

/** Registers a resolved file URL under every key a flag lookup might use. */
function registerImageUrl(urlMap: Map<string, string>, page: MediaWikiImageInfoPage): void {
  const info = page.imageinfo?.[0];
  const directUrl = info?.url ?? info?.thumburl;
  if (page.missing || !directUrl) return;

  const urlFilename = directUrl.split("/").pop();
  if (urlFilename) urlMap.set(normalizeFileKey(decodeURIComponent(urlFilename)), directUrl);

  if (page.title) {
    urlMap.set(normalizeFileKey(stripFilePrefix(page.title)), directUrl);
    urlMap.set(stripFilePrefix(page.title), directUrl);
  }
}

async function resolveImageUrls(filenames: string[], site: Site): Promise<Map<string, string>> {
  const apiBase = getSiteApiUrl(site);
  const urlMap = new Map<string, string>();
  const uniqueFilenames = Array.from(new Set(filenames)).filter(Boolean);

  for (let i = 0; i < uniqueFilenames.length; i += BATCH_SIZE) {
    const titles = uniqueFilenames
      .slice(i, i + BATCH_SIZE)
      .map((f) => `File:${stripFilePrefix(f)}`);
    const params = new URLSearchParams({
      action: "query",
      format: "json",
      formatversion: "2",
      titles: titles.join("|"),
      prop: "imageinfo",
      iiprop: "url",
      iiurlwidth: "640",
    });

    try {
      const response = await fetch(`${apiBase}?${params}`, { headers: WIKI_HEADERS });
      if (!response.ok) continue;
      const data = (await response.json()) as MediaWikiPagesResponse<MediaWikiImageInfoPage>;
      for (const page of pagesOf(data.query?.pages)) registerImageUrl(urlMap, page);
    } catch {
      // Skip failed batch
    }
  }

  return urlMap;
}

/** Public flag URL for a resolved file; iiwiki images are served through the local proxy route. */
function toFlagUrl(directUrl: string, site: Site): string {
  const proxied =
    site === "iiwiki" && /https?:\/\/(?:www\.)?iiwiki\.com\/(images\/.+)$/i.exec(directUrl)?.[1];
  return proxied ? withBasePath(`/api/mediawiki/iiwiki/${proxied}`) : directUrl;
}

async function fetchEligibleCountriesRaw(site: Site): Promise<EligibleCountryResult[]> {
  console.log(`[EligibleCountries] Scanning ${site}...`);

  const pageTitles = await getAllPageTitles(site);
  if (pageTitles.length === 0) {
    console.warn(`[EligibleCountries] No pages found for ${site}`);
    return [];
  }

  console.log(`[EligibleCountries] Found ${pageTitles.length} pages to scan on ${site}`);

  const articles = await fetchBatchArticles(pageTitles, site);

  const candidates: { result: EligibleCountryResult; flagFilename: string }[] = [];
  for (const { title, wikitext } of articles) {
    const parsed = parseInfoboxWithTemplates(wikitext, title);
    if (!parsed) continue;

    const { score, ...details } = calculateCompleteness(parsed);
    if (score < 80) continue;

    candidates.push({
      result: {
        pageName: title,
        displayName: parsed.name || title,
        completeness: score,
        ...details,
        flagUrl: undefined,
      },
      flagFilename: stripFilePrefix(parsed.image_flag || parsed.flag || ""),
    });
  }

  const urlMap = await resolveImageUrls(
    candidates.map((c) => c.flagFilename).filter(Boolean),
    site
  );

  const finalResults = candidates.map(({ result, flagFilename }) => {
    const cleanName = stripFilePrefix(flagFilename);
    const directUrl =
      urlMap.get(normalizeFileKey(cleanName)) ||
      urlMap.get(cleanName.toLowerCase()) ||
      urlMap.get(cleanName) ||
      urlMap.get(flagFilename);
    if (flagFilename && directUrl) result.flagUrl = toFlagUrl(directUrl, site);
    return result;
  });

  finalResults.sort(() => Math.random() - 0.5);

  console.log(
    `[EligibleCountries] Found ${finalResults.length} eligible of ${pageTitles.length} pages on ${site}`
  );

  return finalResults;
}

/**
 * Get eligible countries for a wiki source with 3-tier caching.
 *
 * - < 1 hour old: serve from memory instantly
 * - 1-24 hours: serve stale from memory + trigger async background refresh
 * - > 24 hours or missing: serve from file cache instantly, then background refresh
 * - Concurrent requests share a single refreshPromise (dedup)
 */
export async function getEligibleCountries(site: Site): Promise<EligibleCountryResult[]> {
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
