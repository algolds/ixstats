/**
 * Wiki Cache Service
 *
 * Implements 3-layer caching strategy for MediaWiki API data:
 * 1. Redis Cache (Primary - Fast, Volatile) - 24h TTL for content, 30d for flags
 * 2. Database Cache (Secondary - Persistent) - Long-term storage
 * 3. Client LRU Cache (Tertiary - Session) - Handled by IxnayWikiService
 *
 * This dramatically reduces MediaWiki API calls from 8+ per page to near-zero.
 */

import { db } from "~/server/db";
import { IxnayWikiService, type CountryInfoboxWithDynamicProps } from "~/lib/mediawiki-service";
import { env } from "~/env";

// Redis types
type RedisClient = any; // ioredis types

interface WikiCacheEntry<T> {
  data: T;
  metadata: {
    lastFetched: number;
    wikitextLength?: number;
    apiCallCount?: number;
    source: "redis" | "database" | "api";
  };
}

interface WikiSection {
  id: string;
  title: string;
  sourcePage?: string;
  sourceUrl?: string;
  content: string;
  classification: "PUBLIC" | "RESTRICTED" | "CONFIDENTIAL";
  importance: "critical" | "high" | "medium" | "low";
  lastModified: string;
  wordCount: number;
  images?: string[];
  links?: string[];
  linkCount?: number;
  lastFetched?: number;
  wikitextLength?: number;
  apiCallCount?: number;
}

interface WikiCountryProfile {
  countryName: string;
  infobox: CountryInfoboxWithDynamicProps | null;
  sections: WikiSection[];
  flagUrl: string | null;
  lastUpdated: number;
  confidence: number;
}

// Cache TTLs (in milliseconds)
const CACHE_TTL = {
  infobox: 24 * 60 * 60 * 1000, // 24 hours
  page: 24 * 60 * 60 * 1000, // 24 hours
  flag: 30 * 24 * 60 * 60 * 1000, // 30 days
  template: 24 * 60 * 60 * 1000, // 24 hours
  section: 24 * 60 * 60 * 1000, // 24 hours
} as const;

// Redis key prefixes
const REDIS_PREFIX = {
  infobox: "wiki:infobox:",
  page: "wiki:page:",
  flag: "wiki:flag:",
  template: "wiki:template:",
  section: "wiki:section:",
} as const;

export class WikiCacheService {
  private wikiService: IxnayWikiService;
  private redisClient: RedisClient | null = null;
  private redisEnabled: boolean;
  private redisInitializing: boolean = false;

  constructor() {
    this.wikiService = new IxnayWikiService();
    this.redisEnabled = env.REDIS_ENABLED === "true" && !!env.REDIS_URL;

    if (this.redisEnabled) {
      void this.initRedis();
    }
  }

  /**
   * Initialize Redis client (async, non-blocking)
   */
  private async initRedis(): Promise<void> {
    if (this.redisInitializing || this.redisClient) return;

    this.redisInitializing = true;

    try {
      const Redis = (await import("ioredis")).default;
      this.redisClient = new Redis(env.REDIS_URL!);

      this.redisClient.on("error", (error: Error) => {
        console.error("[WikiCache] Redis error:", error);
        console.log("[WikiCache] Falling back to database-only caching");
        this.redisClient = null;
      });

      this.redisClient.on("connect", () => {
        console.log("[WikiCache] Connected to Redis for wiki caching");
      });
    } catch (error) {
      console.error("[WikiCache] Failed to initialize Redis:", error);
      console.log("[WikiCache] Using database-only caching");
      this.redisClient = null;
    } finally {
      this.redisInitializing = false;
    }
  }

  /**
   * Get country infobox with 3-layer caching
   */
  async getCountryInfobox(
    countryName: string
  ): Promise<WikiCacheEntry<CountryInfoboxWithDynamicProps | null>> {
    const cacheKey = `infobox:${countryName.toLowerCase()}`;
    const redisKey = REDIS_PREFIX.infobox + countryName.toLowerCase();

    try {
      // Layer 1: Try Redis cache
      if (this.redisClient) {
        try {
          const cached = await this.redisClient.get(redisKey);
          if (cached) {
            const parsed = JSON.parse(cached);
            console.log(`[WikiCache] Redis hit for infobox: ${countryName}`);

            // Update hit count in database asynchronously
            void this.incrementHitCount(cacheKey);

            return {
              data: parsed.data,
              metadata: {
                ...parsed.metadata,
                source: "redis",
              },
            };
          }
        } catch (redisError) {
          console.warn(`[WikiCache] Redis error for ${countryName}:`, redisError);
        }
      }

      // Layer 2: Try Database cache
      const dbCache = await db.wikiCache.findUnique({
        where: { key: cacheKey },
      });

      if (dbCache && new Date(dbCache.expiresAt) > new Date()) {
        console.log(`[WikiCache] Database hit for infobox: ${countryName}`);

        const data = JSON.parse(dbCache.data);
        const metadata = dbCache.metadata ? JSON.parse(dbCache.metadata) : {};

        // Update hit count
        void this.incrementHitCount(cacheKey);

        // Populate Redis cache asynchronously
        if (this.redisClient) {
          const ttlSeconds = Math.floor(
            (new Date(dbCache.expiresAt).getTime() - Date.now()) / 1000
          );
          if (ttlSeconds > 0) {
            void this.redisClient
              .setex(redisKey, ttlSeconds, JSON.stringify({ data, metadata }))
              .catch((err: Error) => console.warn("[WikiCache] Redis setex error:", err));
          }
        }

        return {
          data,
          metadata: {
            ...metadata,
            source: "database",
          },
        };
      }

      // Layer 3: Fetch from MediaWiki API
      console.log(`[WikiCache] Cache miss for infobox: ${countryName}, fetching from API`);
      const infobox = await this.wikiService.getCountryInfobox(countryName);

      const now = Date.now();
      const metadata = {
        lastFetched: now,
        apiCallCount: 1,
        source: "api" as const,
      };

      const entry: WikiCacheEntry<CountryInfoboxWithDynamicProps | null> = {
        data: infobox,
        metadata,
      };

      // Cache in both layers
      await this.cacheEntry(cacheKey, "infobox", entry, countryName, CACHE_TTL.infobox);

      return entry;
    } catch (error) {
      console.error(`[WikiCache] Error getting infobox for ${countryName}:`, error);

      // Return from API as fallback
      const infobox = await this.wikiService.getCountryInfobox(countryName);
      return {
        data: infobox,
        metadata: {
          lastFetched: Date.now(),
          source: "api",
        },
      };
    }
  }

  /**
   * Get page wikitext with 3-layer caching
   */
  async getPageWikitext(pageName: string): Promise<WikiCacheEntry<string | null>> {
    const cacheKey = `page:${pageName.toLowerCase()}`;
    const redisKey = REDIS_PREFIX.page + pageName.toLowerCase();

    try {
      // Layer 1: Try Redis cache
      if (this.redisClient) {
        try {
          const cached = await this.redisClient.get(redisKey);
          if (cached) {
            const parsed = JSON.parse(cached);
            console.log(`[WikiCache] Redis hit for page: ${pageName}`);

            void this.incrementHitCount(cacheKey);

            return {
              data: parsed.data,
              metadata: {
                ...parsed.metadata,
                source: "redis",
              },
            };
          }
        } catch (redisError) {
          console.warn(`[WikiCache] Redis error for ${pageName}:`, redisError);
        }
      }

      // Layer 2: Try Database cache
      const dbCache = await db.wikiCache.findUnique({
        where: { key: cacheKey },
      });

      if (dbCache && new Date(dbCache.expiresAt) > new Date()) {
        console.log(`[WikiCache] Database hit for page: ${pageName}`);

        const data = JSON.parse(dbCache.data);
        const metadata = dbCache.metadata ? JSON.parse(dbCache.metadata) : {};

        void this.incrementHitCount(cacheKey);

        // Populate Redis cache asynchronously
        if (this.redisClient) {
          const ttlSeconds = Math.floor(
            (new Date(dbCache.expiresAt).getTime() - Date.now()) / 1000
          );
          if (ttlSeconds > 0) {
            void this.redisClient
              .setex(redisKey, ttlSeconds, JSON.stringify({ data, metadata }))
              .catch((err: Error) => console.warn("[WikiCache] Redis setex error:", err));
          }
        }

        return {
          data,
          metadata: {
            ...metadata,
            source: "database",
          },
        };
      }

      // Layer 3: Fetch from MediaWiki API
      console.log(`[WikiCache] Cache miss for page: ${pageName}, fetching from API`);
      const wikitext = await this.wikiService.getPageWikitext(pageName);

      const content = typeof wikitext === "string" ? wikitext : null;
      const now = Date.now();
      const metadata = {
        lastFetched: now,
        wikitextLength: content?.length || 0,
        apiCallCount: 1,
        source: "api" as const,
      };

      const entry: WikiCacheEntry<string | null> = {
        data: content,
        metadata,
      };

      // Cache in both layers
      await this.cacheEntry(cacheKey, "page", entry, pageName, CACHE_TTL.page);

      return entry;
    } catch (error) {
      console.error(`[WikiCache] Error getting page ${pageName}:`, error);

      // Return from API as fallback
      const wikitext = await this.wikiService.getPageWikitext(pageName);
      const content = typeof wikitext === "string" ? wikitext : null;

      return {
        data: content,
        metadata: {
          lastFetched: Date.now(),
          source: "api",
        },
      };
    }
  }

  /**
   * Get flag URL with 3-layer caching (longer TTL for flags)
   */
  async getFlagUrl(countryName: string): Promise<WikiCacheEntry<string | null>> {
    const cacheKey = `flag:${countryName.toLowerCase()}`;
    const redisKey = REDIS_PREFIX.flag + countryName.toLowerCase();

    try {
      // Layer 1: Try Redis cache
      if (this.redisClient) {
        try {
          const cached = await this.redisClient.get(redisKey);
          if (cached) {
            const parsed = JSON.parse(cached);
            console.log(`[WikiCache] Redis hit for flag: ${countryName}`);

            void this.incrementHitCount(cacheKey);

            return {
              data: parsed.data,
              metadata: {
                ...parsed.metadata,
                source: "redis",
              },
            };
          }
        } catch (redisError) {
          console.warn(`[WikiCache] Redis error for ${countryName}:`, redisError);
        }
      }

      // Layer 2: Try Database cache
      const dbCache = await db.wikiCache.findUnique({
        where: { key: cacheKey },
      });

      if (dbCache && new Date(dbCache.expiresAt) > new Date()) {
        console.log(`[WikiCache] Database hit for flag: ${countryName}`);

        const data = JSON.parse(dbCache.data);
        const metadata = dbCache.metadata ? JSON.parse(dbCache.metadata) : {};

        void this.incrementHitCount(cacheKey);

        // Populate Redis cache asynchronously
        if (this.redisClient) {
          const ttlSeconds = Math.floor(
            (new Date(dbCache.expiresAt).getTime() - Date.now()) / 1000
          );
          if (ttlSeconds > 0) {
            void this.redisClient
              .setex(redisKey, ttlSeconds, JSON.stringify({ data, metadata }))
              .catch((err: Error) => console.warn("[WikiCache] Redis setex error:", err));
          }
        }

        return {
          data,
          metadata: {
            ...metadata,
            source: "database",
          },
        };
      }

      // Layer 3: Fetch from MediaWiki API
      console.log(`[WikiCache] Cache miss for flag: ${countryName}, fetching from API`);
      const flagUrl = await this.wikiService.getFlagUrl(countryName);

      const url = typeof flagUrl === "string" ? flagUrl : null;
      const now = Date.now();
      const metadata = {
        lastFetched: now,
        apiCallCount: 1,
        source: "api" as const,
      };

      const entry: WikiCacheEntry<string | null> = {
        data: url,
        metadata,
      };

      // Cache in both layers (with longer TTL for flags)
      await this.cacheEntry(cacheKey, "flag", entry, countryName, CACHE_TTL.flag);

      return entry;
    } catch (error) {
      console.error(`[WikiCache] Error getting flag for ${countryName}:`, error);

      // Return from API as fallback
      const flagUrl = await this.wikiService.getFlagUrl(countryName);
      const url = typeof flagUrl === "string" ? flagUrl : null;

      return {
        data: url,
        metadata: {
          lastFetched: Date.now(),
          source: "api",
        },
      };
    }
  }

  /**
   * Get full country profile (batched call for efficiency)
   */
  async getCountryProfile(
    countryName: string,
    pageVariants: string[]
  ): Promise<WikiCountryProfile> {
    console.log(`[WikiCache] Getting full country profile for: ${countryName}`);

    // Fetch infobox and flag in parallel
    const [infoboxEntry, flagEntry] = await Promise.all([
      this.getCountryInfobox(countryName),
      this.getFlagUrl(countryName),
    ]);

    // Fetch all page variants in parallel
    const sectionPromises = pageVariants.map(async (pageName) => {
      const entry = await this.getPageWikitext(pageName);
      return {
        pageName,
        content: entry.data,
        metadata: entry.metadata,
      };
    });

    const sectionResults = await Promise.all(sectionPromises);

    // Transform sections (simplified - full transformation logic would match WikiIntelligenceTab)
    const sections: WikiSection[] = sectionResults
      .filter((result) => result.content && result.content.length > 100)
      .map((result, index) => {
        const content = result.content || "";
        const cleanId = result.pageName
          ? result.pageName.toLowerCase().replace(/\s+/g, "-")
          : `section-${index}`;
        const linkMatches = Array.from(content.matchAll(/\[\[([^\]|]+)/g))
          .map((match) => match[1])
          .filter((link) => !link.startsWith("File:") && !link.startsWith("Category:"));

        return {
          id: cleanId || `section-${index}`,
          title: result.pageName,
          sourcePage: result.pageName,
          sourceUrl: `https://ixwiki.com/wiki/${encodeURIComponent(result.pageName)}`,
          content,
          classification: "PUBLIC" as const,
          importance: "medium" as const,
          lastModified: new Date().toISOString(),
          wordCount: content ? content.split(/\s+/).filter(Boolean).length : 0,
          images: Array.from(content.matchAll(/\[\[File:([^\]|]+)/g)).map((match) => match[1]),
          links: linkMatches,
          linkCount: linkMatches.length,
          lastFetched: result.metadata?.lastFetched,
          wikitextLength: result.metadata?.wikitextLength,
          apiCallCount: result.metadata?.apiCallCount,
        };
      });

    return {
      countryName,
      infobox: infoboxEntry.data,
      sections,
      flagUrl: flagEntry.data,
      lastUpdated: Date.now(),
      confidence: infoboxEntry.data ? 85 : 45,
    };
  }

  /**
   * Cache an entry in both Redis and Database
   */
  private async cacheEntry<T>(
    key: string,
    type: string,
    entry: WikiCacheEntry<T>,
    countryName: string,
    ttl: number
  ): Promise<void> {
    const expiresAt = new Date(Date.now() + ttl);

    try {
      // Store in database
      await db.wikiCache.upsert({
        where: { key },
        create: {
          key,
          type,
          data: JSON.stringify(entry.data),
          countryName,
          metadata: JSON.stringify(entry.metadata),
          expiresAt,
          hitCount: 0,
        },
        update: {
          data: JSON.stringify(entry.data),
          metadata: JSON.stringify(entry.metadata),
          expiresAt,
          updatedAt: new Date(),
        },
      });

      // Store in Redis with TTL
      if (this.redisClient) {
        const redisKey = this.getRedisKey(type, key);
        const ttlSeconds = Math.floor(ttl / 1000);

        await this.redisClient
          .setex(
            redisKey,
            ttlSeconds,
            JSON.stringify({ data: entry.data, metadata: entry.metadata })
          )
          .catch((err: Error) => console.warn("[WikiCache] Redis setex error:", err));
      }
    } catch (error) {
      console.error(`[WikiCache] Error caching entry ${key}:`, error);
    }
  }

  /**
   * Increment hit count for a cache entry
   */
  private async incrementHitCount(key: string): Promise<void> {
    try {
      await db.wikiCache
        .update({
          where: { key },
          data: {
            hitCount: {
              increment: 1,
            },
          },
        })
        .catch(() => {
          // Ignore errors (entry might not exist)
        });
    } catch (error) {
      // Silent fail - hit count is not critical
    }
  }

  /**
   * Get Redis key with appropriate prefix
   */
  private getRedisKey(type: string, key: string): string {
    switch (type) {
      case "infobox":
        return key.replace("infobox:", REDIS_PREFIX.infobox);
      case "page":
        return key.replace("page:", REDIS_PREFIX.page);
      case "flag":
        return key.replace("flag:", REDIS_PREFIX.flag);
      case "template":
        return key.replace("template:", REDIS_PREFIX.template);
      case "section":
        return key.replace("section:", REDIS_PREFIX.section);
      default:
        return `wiki:${key}`;
    }
  }

  /**
   * Clear cache for a specific country
   */
  async clearCountryCache(countryName: string): Promise<void> {
    console.log(`[WikiCache] Clearing cache for country: ${countryName}`);

    try {
      // Delete from database
      await db.wikiCache.deleteMany({
        where: {
          countryName: countryName,
        },
      });

      // Delete from Redis
      if (this.redisClient) {
        const patterns = [
          REDIS_PREFIX.infobox + countryName.toLowerCase(),
          REDIS_PREFIX.flag + countryName.toLowerCase(),
          REDIS_PREFIX.page + `*${countryName.toLowerCase()}*`,
        ];

        for (const pattern of patterns) {
          try {
            const keys = await this.redisClient.keys(pattern);
            if (keys.length > 0) {
              await this.redisClient.del(...keys);
            }
          } catch (redisError) {
            console.warn(`[WikiCache] Redis delete error for ${pattern}:`, redisError);
          }
        }
      }

      // Also clear from IxnayWikiService LRU cache
      this.wikiService.clearCountryCache(countryName);

      console.log(`[WikiCache] Successfully cleared cache for: ${countryName}`);
    } catch (error) {
      console.error(`[WikiCache] Error clearing cache for ${countryName}:`, error);
    }
  }

  /**
   * Warm cache for multiple countries (batch operation)
   */
  async warmCache(countryNames: string[]): Promise<{ success: number; failed: number }> {
    console.log(`[WikiCache] Warming cache for ${countryNames.length} countries`);

    let success = 0;
    let failed = 0;

    // Process in batches to avoid overwhelming the API
    const BATCH_SIZE = 5;

    for (let i = 0; i < countryNames.length; i += BATCH_SIZE) {
      const batch = countryNames.slice(i, i + BATCH_SIZE);

      const results = await Promise.allSettled(
        batch.map(async (countryName) => {
          await this.getCountryInfobox(countryName);
          await this.getFlagUrl(countryName);
          return countryName;
        })
      );

      results.forEach((result) => {
        if (result.status === "fulfilled") {
          success++;
        } else {
          failed++;
          console.error(`[WikiCache] Failed to warm cache:`, result.reason);
        }
      });

      // Small delay between batches
      if (i + BATCH_SIZE < countryNames.length) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    }

    console.log(`[WikiCache] Cache warming complete: ${success} success, ${failed} failed`);

    return { success, failed };
  }

  /**
   * Get cache statistics
   */
  async getCacheStats(): Promise<{
    totalEntries: number;
    entriesByType: Record<string, number>;
    mostPopular: Array<{ key: string; hitCount: number; type: string }>;
    expiredEntries: number;
  }> {
    try {
      const [totalEntries, entriesByType, mostPopular, expiredEntries] = await Promise.all([
        db.wikiCache.count(),
        db.wikiCache.groupBy({
          by: ["type"],
          _count: true,
        }),
        db.wikiCache.findMany({
          orderBy: { hitCount: "desc" },
          take: 10,
          select: {
            key: true,
            hitCount: true,
            type: true,
          },
        }),
        db.wikiCache.count({
          where: {
            expiresAt: {
              lt: new Date(),
            },
          },
        }),
      ]);

      const typeStats = entriesByType.reduce(
        (acc, item) => {
          acc[item.type] = item._count;
          return acc;
        },
        {} as Record<string, number>
      );

      return {
        totalEntries,
        entriesByType: typeStats,
        mostPopular,
        expiredEntries,
      };
    } catch (error) {
      console.error("[WikiCache] Error getting cache stats:", error);
      return {
        totalEntries: 0,
        entriesByType: {},
        mostPopular: [],
        expiredEntries: 0,
      };
    }
  }

  /**
   * Refresh stale entries (entries close to expiration)
   */
  async refreshStaleEntries(thresholdHours: number = 2): Promise<number> {
    const threshold = new Date(Date.now() + thresholdHours * 60 * 60 * 1000);

    try {
      const staleEntries = await db.wikiCache.findMany({
        where: {
          expiresAt: {
            lt: threshold,
            gt: new Date(), // Not yet expired
          },
          hitCount: {
            gte: 5, // Only refresh popular entries
          },
        },
        take: 50, // Limit to prevent overwhelming the system
      });

      console.log(`[WikiCache] Refreshing ${staleEntries.length} stale entries`);

      let refreshed = 0;

      for (const entry of staleEntries) {
        try {
          if (entry.type === "infobox" && entry.countryName) {
            await this.getCountryInfobox(entry.countryName);
            refreshed++;
          } else if (entry.type === "flag" && entry.countryName) {
            await this.getFlagUrl(entry.countryName);
            refreshed++;
          }
        } catch (error) {
          console.error(`[WikiCache] Error refreshing ${entry.key}:`, error);
        }
      }

      return refreshed;
    } catch (error) {
      console.error("[WikiCache] Error refreshing stale entries:", error);
      return 0;
    }
  }

  /**
   * Clean up expired entries
   */
  async cleanupExpiredEntries(): Promise<number> {
    try {
      const result = await db.wikiCache.deleteMany({
        where: {
          expiresAt: {
            lt: new Date(),
          },
        },
      });

      console.log(`[WikiCache] Cleaned up ${result.count} expired entries`);
      return result.count;
    } catch (error) {
      console.error("[WikiCache] Error cleaning up expired entries:", error);
      return 0;
    }
  }

  /**
   * Close Redis connection
   */
  async close(): Promise<void> {
    if (this.redisClient) {
      await this.redisClient.quit();
    }
  }
}

// Export singleton instance
export const wikiCacheService = new WikiCacheService();

// Export types
export type { WikiCacheEntry, WikiSection, WikiCountryProfile };
