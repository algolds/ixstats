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
import { getArticleWikitext, type WikiSource } from "./wiki-bridge";
import { parseInfoboxWithTemplates, type UnifiedInfoboxData } from "./unified-wiki-parser";
import { withRetrySafe } from "./with-retry";
// eslint-disable-next-line unused-imports/no-unused-imports
import { withBasePath } from "./base-path";

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

const IIWIKI_API = "https://iiwiki.com/api.php";
const ALTHISTORY_API = "https://althistory.fandom.com/api.php";
const USER_AGENT = "IxStats-Builder";

const CACHE_DIR = path.join(process.cwd(), "data", "cache", "eligible-countries");

const ONE_HOUR_MS = 60 * 60 * 1000;
const TWENTY_FOUR_HOURS_MS = 24 * ONE_HOUR_MS;

const BATCH_SIZE = 10;

const SITE_API_URLS: Record<"iiwiki" | "althistory", string> = {
  iiwiki: IIWIKI_API,
  althistory: ALTHISTORY_API,
};

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
    return parsed.countries;
  } catch {
    return null;
  }
}

async function writeCacheFile(
  site: "iiwiki" | "althistory",
  countries: EligibleCountryResult[]
): Promise<void> {
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
  const apiBase = SITE_API_URLS[site];
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

function calculateCompleteness(data: UnifiedInfoboxData): {
  score: number;
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
} {
  let count = 0;

  // 1. Flag
  const hasFlag = !!(data.image_flag || data.flag || data.flagUrl);

  // 2. Population
  const hasPopulation = !!(data.population || data.population_estimate || data.population_census);

  // 3. GDP
  const hasGdp = !!(data.GDP_PPP || data.GDP_nominal || data.gdp || data.gdp_ppp);

  // 4. Capital
  const hasCapital = !!(data.capital || data.largest_city);

  // 5. Government type
  const hasGovernmentType = !!data.government_type;

  // 6. Leaders
  const hasLeaders = !!(
    (data.leader_title1 && data.leader_name1) ||
    data.head_of_state ||
    data.head_of_government
  );

  // 7. Language
  const hasLanguage = !!(data.official_languages || data.languages);

  // 8. Currency
  const hasCurrency = !!(data.currency || data.currency_code);

  // 9. Area
  const hasArea = !!(data.area_km2 || data.area_total);

  // 10. Demonym
  const hasDemonym = !!data.demonym;

  if (hasFlag) count++;
  if (hasPopulation) count++;
  if (hasGdp) count++;
  if (hasCapital) count++;
  if (hasGovernmentType) count++;
  if (hasLeaders) count++;
  if (hasLanguage) count++;
  if (hasCurrency) count++;
  if (hasArea) count++;
  if (hasDemonym) count++;

  const score = (count / 10) * 100;

  // Extract representative values
  let population: number | undefined;
  if (typeof data.population === "number") population = data.population;
  else if (typeof data.population_estimate === "number") population = data.population_estimate;
  else if (typeof data.population_census === "number") population = data.population_census;

  let gdp: string | undefined;
  if (typeof data.GDP_PPP === "string") gdp = data.GDP_PPP;
  else if (typeof data.GDP_nominal === "string") gdp = data.GDP_nominal;
  else if (typeof data.gdp === "number") gdp = String(data.gdp);
  else if (typeof data.gdp_ppp === "number") gdp = String(data.gdp_ppp);

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

  let areaKm2: number | undefined;
  if (typeof data.area_km2 === "number") areaKm2 = data.area_km2;
  else if (typeof data.area_total === "number") areaKm2 = data.area_total;

  let lifeExpectancy: number | undefined;
  if (typeof data.life_expectancy === "number") lifeExpectancy = data.life_expectancy;

  let literacyRate: number | undefined;
  if (typeof data.literacy_rate === "number") literacyRate = data.literacy_rate;

  let urbanization: number | undefined;
  if (typeof data.urbanization === "number") urbanization = data.urbanization;

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
    lifeExpectancy,
    literacyRate,
    urbanization,
    internetTld: typeof data.internet_tld === "string" ? data.internet_tld : undefined,
    callingCode: typeof data.calling_code === "string" ? data.calling_code : undefined,
    anthem: typeof data.national_anthem === "string" ? data.national_anthem : undefined,
    motto: typeof data.national_motto === "string" ? data.national_motto : undefined,
    coordinates: typeof data.coordinates === "string" ? data.coordinates : undefined,
    largestCity: typeof data.largest_city === "string" ? data.largest_city : undefined,
    officialName: typeof data.official_name === "string" ? data.official_name : undefined,
  };
}

// ──────────────────────────────────────────────
// Resolve image URLs via MediaWiki API (avoids CORS issues with Special:FilePath)
// ──────────────────────────────────────────────

async function resolveImageUrls(
  filenames: string[],
  site: "iiwiki" | "althistory"
): Promise<Map<string, string>> {
  const apiBase = SITE_API_URLS[site];
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

      const data = (await response.json()) as {
        query?: { pages?: Record<string, { title?: string; imageinfo?: Array<{ url: string }> }> };
      };

      const pages = data.query?.pages ?? {};
      for (const page of Object.values(pages)) {
        const directUrl = page?.imageinfo?.[0]?.url;
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
// Process a single page
// ──────────────────────────────────────────────

async function processPage(
  pageName: string,
  site: "iiwiki" | "althistory"
): Promise<{ result: EligibleCountryResult; flagFilename: string } | null> {
  try {
    const wikiSource: WikiSource = site;
    const article = await getArticleWikitext(pageName, wikiSource);
    if (!article || !article.wikitext) return null;

    const parsed = parseInfoboxWithTemplates(article.wikitext, pageName);
    if (!parsed) return null;

    const completeness = calculateCompleteness(parsed);
    if (completeness.score < 80) return null;

    const flagFilename = (parsed.image_flag || parsed.flag || "")
      .replace(/^(File|Image):/i, "")
      .trim();

    return {
      result: {
        pageName,
        displayName: parsed.name || pageName,
        completeness: completeness.score,
        flagUrl: undefined,
        population: completeness.population,
        gdp: completeness.gdp,
        capital: completeness.capital,
        governmentType: completeness.governmentType,
        leaderTitle: completeness.leaderTitle,
        leaderName: completeness.leaderName,
        currency: completeness.currency,
        currencyCode: completeness.currencyCode,
        languages: completeness.languages,
        areaKm2: completeness.areaKm2,
        demonym: completeness.demonym,
        lifeExpectancy: completeness.lifeExpectancy,
        literacyRate: completeness.literacyRate,
        urbanization: completeness.urbanization,
        internetTld: completeness.internetTld,
        callingCode: completeness.callingCode,
        anthem: completeness.anthem,
        motto: completeness.motto,
        coordinates: completeness.coordinates,
        largestCity: completeness.largestCity,
        officialName: completeness.officialName,
      },
      flagFilename,
    };
  } catch {
    return null;
  }
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

  const allResults: { result: EligibleCountryResult; flagFilename: string }[] = [];

  for (let i = 0; i < pageTitles.length; i += BATCH_SIZE) {
    const batch = pageTitles.slice(i, i + BATCH_SIZE);
    const results = await Promise.allSettled(batch.map((title) => processPage(title, site)));

    for (const result of results) {
      if (result.status === "fulfilled" && result.value) {
        allResults.push(result.value);
      }
    }
  }

  // Resolve all flag URLs in batch via MediaWiki API
  const flagFilenames = allResults.map((r) => r.flagFilename).filter(Boolean);
  const urlMap = await resolveImageUrls(flagFilenames, site);

  const finalResults: EligibleCountryResult[] = allResults.map(({ result, flagFilename }) => {
    if (flagFilename) {
      if (site === "iiwiki") {
        result.flagUrl = `/api/mediawiki/iiwiki/wiki/Special:FilePath/${encodeURIComponent(flagFilename)}`;
      } else {
        const lookupKey = flagFilename.toLowerCase().replace(/_/g, " ").trim();
        result.flagUrl =
          urlMap.get(lookupKey) ||
          `/api/mediawiki/althistory/wiki/Special:FilePath/${encodeURIComponent(flagFilename)}`;
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
  if (fileCached) {
    const refreshPromise = fetchEligibleCountriesRaw(site)
      .then(async (data) => {
        await writeCacheFile(site, data);
        memoryCache.set(site, { data, cachedAt: new Date(), refreshPromise: null });
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
  await writeCacheFile(site, data);
  memoryCache.set(site, { data, cachedAt: new Date(), refreshPromise: null });
  return data;
}
