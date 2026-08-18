/**
 * src/lib/cache/index.ts — Master barrel export for Caching & Rate Limiting.
 */

export * from "./cache";
export * from "./rate-limiter";
export * from "./advanced-cache-system";
export {
  type CacheService,
  type CacheType,
  type ValidationStatus,
  type CacheMetadata,
  type CacheOptions as ExternalCacheOptions,
  type CacheEntry as ExternalCacheEntry,
  generateCacheKey,
  generateContentHash,
  CACHE_TTL,
  REVALIDATION_INTERVAL,
  ExternalApiCacheService,
  externalApiCache,
} from "./external-api-cache";
export * from "./trpc-cache";
