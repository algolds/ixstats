// src/lib/external-api-cache.ts
/**
 * Universal External API Cache Service
 *
 * Provides intelligent caching for all external API calls (MediaWiki, Unsplash, flag services, etc.)
 * with automatic revalidation, content hashing, and cache invalidation strategies.
 *
 * Features:
 * - Persistent database storage (SQLite/PostgreSQL)
 * - Content hash validation (detects changes without full comparison)
 * - Automatic expiration and revalidation
 * - Stale-while-revalidate pattern
 * - Cache statistics and hit tracking
 * - Background revalidation jobs
 */

import { db } from "~/server/db";
import { createHash } from "crypto";

export type CacheService =
  | "mediawiki"
  | "unsplash"
  | "flagcdn"
  | "restcountries"
  | "wikimedia"
  | "custom";

export type CacheType =
  | "infobox"
  | "flag"
  | "page"
  | "template"
  | "section"
  | "image"
  | "country-data"
  | "wikitext"
  | "html"
  | "json";

export type ValidationStatus = "valid" | "stale" | "needs_revalidation" | "failed";

export interface CacheOptions {
  service: CacheService;
  type: CacheType;
  identifier: string;
  countryName?: string;
  ttl?: number; // Time to live in milliseconds (default: 7 days)
  revalidationInterval?: number; // How often to check for updates (default: 7 days)
}

export interface CacheMetadata {
  lastFetched: string;
  contentHash?: string;
  apiCallCount?: number;
  source?: string;
  revalidationAttempts?: number;
  lastRevalidationAt?: string;
  wikitextLength?: number;
  imageUrl?: string;
  originalUrl?: string;
  [key: string]: any;
}

export interface CacheEntry<T = any> {
  id: string;
  key: string;
  service: string;
  type: string;
  identifier: string;
  data: T;
  countryName: string | null;
  metadata: CacheMetadata;
  contentHash: string | null;
  hitCount: number;
  lastValidatedAt: Date;
  validationStatus: ValidationStatus;
  createdAt: Date;
  updatedAt: Date;
  expiresAt: Date;
}

/**
 * Generate a unique cache key
 */
export function generateCacheKey(
  service: CacheService,
  type: CacheType,
  identifier: string
): string {
  return `${service}:${type}:${identifier.toLowerCase().replace(/\s+/g, "_")}`;
}

/**
 * Generate a content hash for validation
 */
export function generateContentHash(content: any): string {
  const normalized = typeof content === 'string'
    ? content
    : JSON.stringify(content, Object.keys(content).sort());

  return createHash('sha256').update(normalized).digest('hex');
}

/**
 * Default cache TTL configurations (in milliseconds)
 */
export const CACHE_TTL = {
  // MediaWiki content (mostly static)
  INFOBOX: 7 * 24 * 60 * 60 * 1000,      // 7 days
  WIKITEXT: 7 * 24 * 60 * 60 * 1000,     // 7 days
  TEMPLATE: 14 * 24 * 60 * 60 * 1000,    // 14 days (templates change rarely)
  FLAG: 30 * 24 * 60 * 60 * 1000,        // 30 days (flags change very rarely)

  // Image services
  IMAGE: 30 * 24 * 60 * 60 * 1000,       // 30 days (images are immutable)

  // Country data APIs
  COUNTRY_DATA: 30 * 24 * 60 * 60 * 1000, // 30 days (country metadata changes rarely)

  // Default fallback
  DEFAULT: 7 * 24 * 60 * 60 * 1000,       // 7 days
} as const;

/**
 * Revalidation intervals (how often to check if content changed)
 */
export const REVALIDATION_INTERVAL = {
  INFOBOX: 7 * 24 * 60 * 60 * 1000,      // Check weekly
  WIKITEXT: 7 * 24 * 60 * 60 * 1000,     // Check weekly
  TEMPLATE: 14 * 24 * 60 * 60 * 1000,    // Check bi-weekly
  FLAG: 30 * 24 * 60 * 60 * 1000,        // Check monthly
  IMAGE: 90 * 24 * 60 * 60 * 1000,       // Check quarterly (images rarely change)
  DEFAULT: 7 * 24 * 60 * 60 * 1000,      // Check weekly
} as const;

/**
 * Universal External API Cache Service
 */
export class ExternalApiCacheService {
  /**
   * Get a cached entry if it exists and is valid
   */
  async get<T = any>(options: CacheOptions): Promise<CacheEntry<T> | null> {
    const key = generateCacheKey(options.service, options.type, options.identifier);

    try {
      const cached = await db.externalApiCache.findUnique({
        where: { key },
      });

      if (!cached) {
        return null;
      }

      // Check if cache is expired
      const now = new Date();
      if (cached.expiresAt < now) {
        console.log(`[ExternalApiCache] Cache expired for key: ${key}`);
        return null;
      }

      // Increment hit count
      await db.externalApiCache.update({
        where: { id: cached.id },
        data: { hitCount: cached.hitCount + 1 },
      });

      // Parse the data and metadata
      const data = JSON.parse(cached.data) as T;
      const metadata = cached.metadata
        ? JSON.parse(cached.metadata) as CacheMetadata
        : { lastFetched: cached.createdAt.toISOString() };

      return {
        ...cached,
        data,
        metadata,
        validationStatus: cached.validationStatus as ValidationStatus,
      };
    } catch (error) {
      console.error(`[ExternalApiCache] Error retrieving cache for key ${key}:`, error);
      return null;
    }
  }

  /**
   * Set a cache entry
   */
  async set<T = any>(
    options: CacheOptions,
    data: T,
    metadata?: Partial<CacheMetadata>
  ): Promise<void> {
    const key = generateCacheKey(options.service, options.type, options.identifier);
    const contentHash = generateContentHash(data);

    const ttl = options.ttl ?? CACHE_TTL.DEFAULT;
    const expiresAt = new Date(Date.now() + ttl);

    const fullMetadata: CacheMetadata = {
      lastFetched: new Date().toISOString(),
      contentHash,
      apiCallCount: 1,
      ...metadata,
    };

    try {
      await db.externalApiCache.upsert({
        where: { key },
        create: {
          key,
          service: options.service,
          type: options.type,
          identifier: options.identifier,
          data: JSON.stringify(data),
          countryName: options.countryName ?? null,
          metadata: JSON.stringify(fullMetadata),
          contentHash,
          expiresAt,
          lastValidatedAt: new Date(),
          validationStatus: "valid",
        },
        update: {
          data: JSON.stringify(data),
          metadata: JSON.stringify(fullMetadata),
          contentHash,
          expiresAt,
          lastValidatedAt: new Date(),
          validationStatus: "valid",
          updatedAt: new Date(),
        },
      });

      console.log(`[ExternalApiCache] Cached ${options.service}:${options.type}:${options.identifier} (expires: ${expiresAt.toISOString()})`);
    } catch (error) {
      console.error(`[ExternalApiCache] Error setting cache for key ${key}:`, error);
    }
  }

  /**
   * Check if a cache entry needs revalidation
   */
  async needsRevalidation(options: CacheOptions): Promise<boolean> {
    const key = generateCacheKey(options.service, options.type, options.identifier);

    try {
      const cached = await db.externalApiCache.findUnique({
        where: { key },
        select: { lastValidatedAt: true, validationStatus: true },
      });

      if (!cached) {
        return true; // No cache, needs fetch
      }

      // Check if marked as stale or failed
      if (cached.validationStatus === "stale" || cached.validationStatus === "needs_revalidation") {
        return true;
      }

      // Check revalidation interval
      const revalidationInterval = options.revalidationInterval ?? REVALIDATION_INTERVAL.DEFAULT;
      const nextRevalidation = new Date(cached.lastValidatedAt.getTime() + revalidationInterval);

      return new Date() > nextRevalidation;
    } catch (error) {
      console.error(`[ExternalApiCache] Error checking revalidation for key ${key}:`, error);
      return true; // On error, revalidate
    }
  }

  /**
   * Validate cached content against fresh data
   * Returns true if content is still valid, false if it changed
   */
  async validateContent<T = any>(
    options: CacheOptions,
    freshData: T
  ): Promise<boolean> {
    const key = generateCacheKey(options.service, options.type, options.identifier);
    const freshHash = generateContentHash(freshData);

    try {
      const cached = await db.externalApiCache.findUnique({
        where: { key },
        select: { contentHash: true, metadata: true },
      });

      if (!cached?.contentHash) {
        return false; // No cache to validate
      }

      const isValid = cached.contentHash === freshHash;

      // Update validation status
      await db.externalApiCache.update({
        where: { key },
        data: {
          lastValidatedAt: new Date(),
          validationStatus: isValid ? "valid" : "stale",
          metadata: cached.metadata
            ? JSON.stringify({
                ...JSON.parse(cached.metadata),
                lastRevalidationAt: new Date().toISOString(),
                revalidationAttempts: (JSON.parse(cached.metadata).revalidationAttempts ?? 0) + 1,
              })
            : undefined,
        },
      });

      console.log(`[ExternalApiCache] Validation for ${key}: ${isValid ? "VALID" : "STALE"}`);
      return isValid;
    } catch (error) {
      console.error(`[ExternalApiCache] Error validating content for key ${key}:`, error);
      return false;
    }
  }

  /**
   * Delete a cache entry
   */
  async delete(options: CacheOptions): Promise<void> {
    const key = generateCacheKey(options.service, options.type, options.identifier);

    try {
      await db.externalApiCache.delete({
        where: { key },
      });
      console.log(`[ExternalApiCache] Deleted cache for key: ${key}`);
    } catch (error) {
      console.error(`[ExternalApiCache] Error deleting cache for key ${key}:`, error);
    }
  }

  /**
   * Clear all cache entries for a specific service
   */
  async clearService(service: CacheService): Promise<number> {
    try {
      const result = await db.externalApiCache.deleteMany({
        where: { service },
      });
      console.log(`[ExternalApiCache] Cleared ${result.count} cache entries for service: ${service}`);
      return result.count;
    } catch (error) {
      console.error(`[ExternalApiCache] Error clearing cache for service ${service}:`, error);
      return 0;
    }
  }

  /**
   * Clear all cache entries for a specific country
   */
  async clearCountry(countryName: string): Promise<number> {
    try {
      const result = await db.externalApiCache.deleteMany({
        where: { countryName },
      });
      console.log(`[ExternalApiCache] Cleared ${result.count} cache entries for country: ${countryName}`);
      return result.count;
    } catch (error) {
      console.error(`[ExternalApiCache] Error clearing cache for country ${countryName}:`, error);
      return 0;
    }
  }

  /**
   * Clean up expired cache entries
   */
  async cleanupExpired(): Promise<number> {
    try {
      const result = await db.externalApiCache.deleteMany({
        where: {
          expiresAt: {
            lt: new Date(),
          },
        },
      });
      console.log(`[ExternalApiCache] Cleaned up ${result.count} expired cache entries`);
      return result.count;
    } catch (error) {
      console.error(`[ExternalApiCache] Error cleaning up expired entries:`, error);
      return 0;
    }
  }

  /**
   * Get cache statistics
   */
  async getStats(service?: CacheService) {
    try {
      const where = service ? { service } : {};

      const [total, validCount, staleCount, avgHitCount, topHits] = await Promise.all([
        db.externalApiCache.count({ where }),
        db.externalApiCache.count({ where: { ...where, validationStatus: "valid" } }),
        db.externalApiCache.count({ where: { ...where, validationStatus: "stale" } }),
        db.externalApiCache.aggregate({
          where,
          _avg: { hitCount: true },
        }),
        db.externalApiCache.findMany({
          where,
          select: { key: true, hitCount: true, service: true, type: true },
          orderBy: { hitCount: 'desc' },
          take: 10,
        }),
      ]);

      return {
        total,
        valid: validCount,
        stale: staleCount,
        averageHitCount: avgHitCount._avg.hitCount ?? 0,
        topHits,
      };
    } catch (error) {
      console.error(`[ExternalApiCache] Error getting stats:`, error);
      return null;
    }
  }
}

// Singleton instance
export const externalApiCache = new ExternalApiCacheService();
