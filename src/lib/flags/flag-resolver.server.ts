import "server-only";

import type {
  FlagResolver,
  FlagResolution,
  FlagResolverStats,
  FlagFallbackPolicy,
  FlagResolverOptions,
  PersistentFlagCacheAdapter,
} from "./contracts";
import { normalizeCountryName, normalizeFlagUrl, getFlagCandidateFileTitles } from "./normalization";
import { fetchMediaWikiImageBatch } from "~/lib/wiki/bridge";
import { getMediaWikiApiUrl } from "~/lib/wiki/config";
import { withBasePath } from "~/lib/base-path";

interface CacheEntry {
  resolution: FlagResolution;
  expiresAt: number;
}

const DEFAULT_POSITIVE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const DEFAULT_NEGATIVE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const PLACEHOLDER_PATH = "/images/flags/placeholder.svg";

export class ServerFlagResolver implements FlagResolver {
  private memoryCache = new Map<string, CacheEntry>();
  private inFlight = new Map<string, Promise<FlagResolution>>();
  private persistentCache?: PersistentFlagCacheAdapter;

  private statsCounters = {
    hits: 0,
    misses: 0,
    placeholders: 0,
  };

  constructor(persistentCache?: PersistentFlagCacheAdapter) {
    this.persistentCache = persistentCache;
  }

  public setPersistentCache(adapter: PersistentFlagCacheAdapter): void {
    this.persistentCache = adapter;
  }

  private getCacheKey(normalizedName: string, policy: FlagFallbackPolicy): string {
    return `${normalizedName}::${policy}`;
  }

  private getPlaceholderUrl(): string {
    return withBasePath(PLACEHOLDER_PATH);
  }

  public peek(countryName: string): FlagResolution | null {
    const normalized = normalizeCountryName(countryName);
    if (!normalized) return null;

    // Check with default policy
    const key = this.getCacheKey(normalized, "commons-only");
    const entry = this.memoryCache.get(key);
    if (entry && entry.expiresAt > Date.now()) {
      return entry.resolution;
    }
    return null;
  }

  public async resolve(
    countryName: string,
    options?: FlagResolverOptions
  ): Promise<FlagResolution> {
    const normalized = normalizeCountryName(countryName);
    const policy: FlagFallbackPolicy = options?.fallbackPolicy ?? "commons-only";
    const placeholderUrl = this.getPlaceholderUrl();

    if (!normalized) {
      return {
        countryName,
        normalizedName: "",
        flagUrl: placeholderUrl,
        source: "placeholder",
        cached: false,
        isPlaceholder: true,
      };
    }

    // 1. Provided URL
    const provided = normalizeFlagUrl(options?.providedUrl);
    if (provided && !provided.includes(PLACEHOLDER_PATH)) {
      return {
        countryName,
        normalizedName: normalized,
        flagUrl: provided,
        source: "provided",
        cached: false,
        isPlaceholder: false,
      };
    }

    const cacheKey = this.getCacheKey(normalized, policy);

    // 2. Memory cache check
    const cachedEntry = this.memoryCache.get(cacheKey);
    if (cachedEntry && cachedEntry.expiresAt > Date.now()) {
      this.statsCounters.hits++;
      return {
        ...cachedEntry.resolution,
        countryName, // Preserve caller's requested capitalization
        cached: true,
      };
    }

    // 3. In-flight coalescing
    const activePromise = this.inFlight.get(cacheKey);
    if (activePromise) {
      const res = await activePromise;
      return {
        ...res,
        countryName,
      };
    }

    // Execute resolution and cache
    const resolutionPromise = this.executeResolution(countryName, normalized, policy);
    this.inFlight.set(cacheKey, resolutionPromise);

    try {
      const resolution = await resolutionPromise;

      const ttl = resolution.isPlaceholder
        ? DEFAULT_NEGATIVE_TTL_MS
        : DEFAULT_POSITIVE_TTL_MS;

      this.memoryCache.set(cacheKey, {
        resolution,
        expiresAt: Date.now() + ttl,
      });

      if (!resolution.isPlaceholder && this.persistentCache) {
        // Fire-and-forget persistent write
        this.persistentCache.set(normalized, resolution.flagUrl, ttl).catch(() => {});
      }

      return resolution;
    } finally {
      this.inFlight.delete(cacheKey);
    }
  }

  private async executeResolution(
    countryName: string,
    normalized: string,
    policy: FlagFallbackPolicy
  ): Promise<FlagResolution> {
    this.statsCounters.misses++;
    const placeholderUrl = this.getPlaceholderUrl();

    // 1. Persistent cache check
    if (this.persistentCache) {
      try {
        const persistedUrl = await this.persistentCache.get(normalized);
        const validPersisted = normalizeFlagUrl(persistedUrl);
        if (validPersisted && !validPersisted.includes(PLACEHOLDER_PATH)) {
          return {
            countryName,
            normalizedName: normalized,
            flagUrl: validPersisted,
            source: "persistent-cache",
            cached: true,
            isPlaceholder: false,
          };
        }
      } catch {
        // Ignore persistent cache read error
      }
    }

    // 2. Query Wikimedia Commons
    const candidates = getFlagCandidateFileTitles(countryName);
    try {
      const commonsMap = await fetchMediaWikiImageBatch(candidates);

      for (const candidate of candidates) {
        const found = commonsMap.get(candidate) || commonsMap.get(`File:${candidate}`);
        if (found) {
          return {
            countryName,
            normalizedName: normalized,
            flagUrl: found,
            source: "commons",
            cached: false,
            isPlaceholder: false,
          };
        }
      }
    } catch {
      // Ignore Commons failure and proceed to next fallback
    }

    // 3. Query Fictional Wiki (if policy allows)
    if (policy === "fictional-wiki") {
      try {
        const iiwikiMap = await fetchMediaWikiImageBatch(
          candidates,
          getMediaWikiApiUrl("iiwiki")
        );

        for (const candidate of candidates) {
          const found = iiwikiMap.get(candidate) || iiwikiMap.get(`File:${candidate}`);
          if (found) {
            return {
              countryName,
              normalizedName: normalized,
              flagUrl: found,
              source: "fictional-wiki",
              cached: false,
              isPlaceholder: false,
            };
          }
        }
      } catch {
        // Ignore IIWiki failure
      }
    }

    // 4. Default to Base-Path Aware Placeholder
    this.statsCounters.placeholders++;
    return {
      countryName,
      normalizedName: normalized,
      flagUrl: placeholderUrl,
      source: "placeholder",
      cached: false,
      isPlaceholder: true,
    };
  }

  public async resolveBatch(
    countryNames: readonly string[],
    options?: { fallbackPolicy?: FlagFallbackPolicy }
  ): Promise<ReadonlyMap<string, FlagResolution>> {
    const results = new Map<string, FlagResolution>();
    if (!countryNames.length) return results;

    const promises = countryNames.map(async (name) => {
      const res = await this.resolve(name, options);
      return { name, res };
    });

    const settled = await Promise.all(promises);
    for (const { name, res } of settled) {
      results.set(name, res);
    }

    return results;
  }

  public prefetch(
    countryNames: readonly string[],
    options?: { fallbackPolicy?: FlagFallbackPolicy }
  ): void {
    if (!countryNames.length) return;
    // Background execution without throwing
    this.resolveBatch(countryNames, options).catch((err) => {
      console.warn("[ServerFlagResolver] Error in background prefetch:", err);
    });
  }

  public async clear(): Promise<void> {
    this.memoryCache.clear();
    this.inFlight.clear();
    this.statsCounters = {
      hits: 0,
      misses: 0,
      placeholders: 0,
    };
    if (this.persistentCache?.clear) {
      await this.persistentCache.clear();
    }
  }

  public stats(): FlagResolverStats {
    return {
      memoryCacheSize: this.memoryCache.size,
      inFlightRequests: this.inFlight.size,
      hits: this.statsCounters.hits,
      misses: this.statsCounters.misses,
      placeholders: this.statsCounters.placeholders,
    };
  }
}

export const serverFlagResolver = new ServerFlagResolver();
