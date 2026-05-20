/**
 * Server-side flag cache — resolves Wikimedia Commons flag URLs once,
 * caches them persistently to disk, and serves them to all clients.
 *
 * Eliminates 429 rate-limit errors from browsers hitting Commons directly.
 */

import * as fs from "fs";
import * as fsPromises from "fs/promises";
import * as path from "path";

const CACHE_DIR = path.join(process.cwd(), "data", "cache", "flag-urls");
const CACHE_FILE = path.join(CACHE_DIR, "commons-flags.json");

const WIKIMEDIA_API = "https://commons.wikimedia.org/w/api.php";

interface FlagCacheEntry {
  url: string | null;
  resolvedAt: number;
}

interface FlagCacheData {
  version: number;
  resolvedAt: string;
  flags: Record<string, FlagCacheEntry>;
}

const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

let memoryCache: Record<string, FlagCacheEntry> | null = null;
let loadPromise: Promise<Record<string, FlagCacheEntry>> | null = null;

async function ensureCacheDir(): Promise<void> {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
}

async function loadCache(): Promise<Record<string, FlagCacheEntry>> {
  if (memoryCache) return memoryCache;
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    try {
      const raw = await fsPromises.readFile(CACHE_FILE, "utf-8");
      const parsed: FlagCacheData = JSON.parse(raw);
      const age = Date.now() - new Date(parsed.resolvedAt).getTime();
      memoryCache = parsed.flags ?? {};
      return memoryCache;
    } catch {
      memoryCache = {};
      return memoryCache;
    }
  })();

  return loadPromise;
}

async function saveCache(flags: Record<string, FlagCacheEntry>): Promise<void> {
  await ensureCacheDir();
  const data: FlagCacheData = {
    version: 1,
    resolvedAt: new Date().toISOString(),
    flags,
  };
  await fsPromises.writeFile(CACHE_FILE, JSON.stringify(data, null, 2), "utf-8");
}

const COMMONS_PATTERNS = (name: string): string[] => {
  const u = name.replace(/\s+/g, "_");
  const l = name.toLowerCase().replace(/\s+/g, "_");
  return [
    `Flag of ${name}.svg`,
    `Flag of ${name}.png`,
    `Flag_of_${u}.svg`,
    `Flag_of_${u}.png`,
    `${u}_flag.svg`,
    `${u}_flag.png`,
    `${name.replace(/\s+/g, "")}-flag.svg`,
    `${name.replace(/\s+/g, "")}-flag.png`,
  ];
};

const COUNTRY_MAPPINGS: Record<string, string> = {
  "korea, dem. people's rep.": "North Korea",
  "korea, rep.": "South Korea",
  "czech republic": "Czech Republic",
  "bahamas, the": "The Bahamas",
  "gambia, the": "The Gambia",
  "congo, dem. rep.": "Democratic Republic of the Congo",
  "congo, rep.": "Republic of the Congo",
  "egypt, arab rep.": "Egypt",
  "iran, islamic rep.": "Iran",
  "venezuela, rb": "Venezuela",
  "yemen, rep.": "Yemen",
  "lao pdr": "Laos",
  "united states": "United States",
  "united kingdom": "United Kingdom",
  netherlands: "Netherlands",
  philippines: "Philippines",
  maldives: "Maldives",
  "solomon islands": "Solomon Islands",
  "marshall islands": "Marshall Islands",
  "central african republic": "Central African Republic",
  "dominican republic": "Dominican Republic",
  "united arab emirates": "United Arab Emirates",
};

async function resolveFlagFromCommons(countryName: string): Promise<string | null> {
  const mapped = COUNTRY_MAPPINGS[countryName.toLowerCase()] || countryName;
  const patterns = COMMONS_PATTERNS(mapped);
  const titlesParam = patterns.map((p) => `File:${p}`).join("|");

  const url = `${WIKIMEDIA_API}?action=query&format=json&formatversion=2&origin=*&titles=${encodeURIComponent(titlesParam)}&prop=imageinfo&iiprop=url&iiurlwidth=1280`;

  const resp = await fetch(url, {
    signal: AbortSignal.timeout(10000),
    headers: {
      "User-Agent": "IxStats/1.0 (https://ixwiki.com/projects/ixstats; for Wikimedia Commons API access for flag images used in nation-building game)",
    },
  });
  if (!resp.ok) return null;

  const data = await resp.json();
  const pages = data.query?.pages ?? [];
  for (const page of pages) {
    if (page.imageinfo?.[0]?.url && !page.missing) {
      return page.imageinfo[0].url;
    }
  }
  return null;
}

/**
 * Resolve flags for a list of country names.
 * Uses persistent disk cache + in-memory cache.
 * Only hits Wikimedia Commons for uncached entries.
 */
export async function resolveFlags(
  countryNames: string[]
): Promise<Record<string, string | null>> {
  const cache = await loadCache();
  const results: Record<string, string | null> = {};
  const toResolve: string[] = [];

  for (const name of countryNames) {
    const key = name.toLowerCase().trim();
    const entry = cache[key];
    if (entry && Date.now() - entry.resolvedAt < CACHE_TTL_MS) {
      results[name] = entry.url;
    } else {
      toResolve.push(name);
    }
  }

  if (toResolve.length === 0) return results;

  // Resolve in batches to avoid overwhelming Wikimedia Commons
  const BATCH = 10;
  for (let i = 0; i < toResolve.length; i += BATCH) {
    const batch = toResolve.slice(i, i + BATCH);
    const resolved = await Promise.allSettled(
      batch.map(async (name) => {
        const url = await resolveFlagFromCommons(name);
        return { name, url };
      })
    );

    for (const r of resolved) {
      if (r.status === "fulfilled") {
        const key = r.value.name.toLowerCase().trim();
        cache[key] = { url: r.value.url, resolvedAt: Date.now() };
        results[r.value.name] = r.value.url;
      }
    }

    if (i + BATCH < toResolve.length) {
      await new Promise((res) => setTimeout(res, 200));
    }
  }

  // Add aliases for COUNTRY_MAPPINGS so standard names also resolve
  for (const [nonStandard, standard] of Object.entries(COUNTRY_MAPPINGS)) {
    const sourceKey = nonStandard.toLowerCase().trim();
    const targetKey = standard.toLowerCase().trim();
    if (cache[sourceKey] !== undefined && cache[targetKey] === undefined) {
      cache[targetKey] = { url: cache[sourceKey].url, resolvedAt: Date.now() };
      results[standard] = cache[sourceKey].url;
    }
  }

  await saveCache(cache);
  return results;
}

const ALL_COUNTRIES = Object.keys(COUNTRY_MAPPINGS).concat([
  "United States",
  "United Kingdom",
  "Canada",
  "Australia",
  "Germany",
  "France",
  "Japan",
  "China",
  "India",
  "Brazil",
  "Russia",
  "South Africa",
  "Mexico",
  "Italy",
  "Spain",
  "South Korea",
  "Indonesia",
  "Turkey",
  "Saudi Arabia",
  "Argentina",
  "Nigeria",
  "Egypt",
  "Thailand",
  "Poland",
  "Sweden",
  "Norway",
  "Denmark",
  "Finland",
  "Netherlands",
  "Belgium",
  "Switzerland",
  "Austria",
  "Portugal",
  "Greece",
  "Ireland",
  "New Zealand",
  "Singapore",
  "Malaysia",
  "Philippines",
  "Vietnam",
  "Colombia",
  "Chile",
  "Peru",
  "Venezuela",
  "Ukraine",
  "Israel",
  "UAE",
  "Qatar",
  "Kuwait",
  "Pakistan",
  "Bangladesh",
  "Morocco",
  "Kenya",
  "Ethiopia",
  "Ghana",
  "Tanzania",
  "Algeria",
  "Tunisia",
  "Iraq",
  "Jordan",
  "Lebanon",
  "Oman",
  "Bahrain",
  "Iran",
  "Afghanistan",
  "Kazakhstan",
  "Uzbekistan",
  "Mongolia",
  "Nepal",
  "Sri Lanka",
  "Myanmar",
  "Cambodia",
  "Laos",
  "Brunei",
  "Timor-Leste",
  "Papua New Guinea",
  "Fiji",
  "Jamaica",
  "Cuba",
  "Haiti",
  "Dominican Republic",
  "Costa Rica",
  "Panama",
  "Guatemala",
  "Honduras",
  "El Salvador",
  "Nicaragua",
  "Ecuador",
  "Bolivia",
  "Paraguay",
  "Uruguay",
  "Guyana",
  "Suriname",
  "Iceland",
  "Luxembourg",
  "Malta",
  "Cyprus",
  "Estonia",
  "Latvia",
  "Lithuania",
  "Czech Republic",
  "Slovakia",
  "Hungary",
  "Romania",
  "Bulgaria",
  "Serbia",
  "Croatia",
  "Slovenia",
  "Bosnia and Herzegovina",
  "Montenegro",
  "North Macedonia",
  "Albania",
  "Moldova",
  "Belarus",
  "Georgia",
  "Armenia",
  "Azerbaijan",
]);

/**
 * Clear both memory and disk cache for flag URLs.
 */
export async function clearFlagCache(): Promise<void> {
  memoryCache = null;
  loadPromise = null;
  try {
    await fsPromises.rm(CACHE_FILE, { force: true });
  } catch {
    // ignore
  }
}

// Warm up the flag cache on server startup (module load).
// This ensures flags are cached before the first browser request.
if (typeof window === "undefined") {
  resolveFlags(ALL_COUNTRIES).catch(() => {});
}

/**
 * Get all cached flags (for bulk serving).
 * If cache is empty, triggers background resolution.
 */
export async function getAllCachedFlags(): Promise<Record<string, string | null>> {
  const cache = await loadCache();
  
  // If cache is empty, trigger background resolution
  if (Object.keys(cache).length === 0) {
    resolveFlags(ALL_COUNTRIES).catch(() => {});
  }
  
  const result: Record<string, string | null> = {};
  for (const [key, entry] of Object.entries(cache)) {
    result[key] = entry.url;
  }

  // Add aliases for COUNTRY_MAPPINGS so standard names also resolve
  for (const [nonStandard, standard] of Object.entries(COUNTRY_MAPPINGS)) {
    const sourceKey = nonStandard.toLowerCase().trim();
    const targetKey = standard.toLowerCase().trim();
    if (result[sourceKey] && !result[targetKey]) {
      result[targetKey] = result[sourceKey];
    }
  }

  return result;
}
