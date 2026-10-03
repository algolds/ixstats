/**
 * src/lib/cache/index.ts — Master barrel export for Caching & Rate Limiting.
 */

import { clearTrpcMemoryCache } from "./trpc-cache";

export * from "./cache";
export * from "./rate-limiter";
export * from "./advanced-cache-system";
export {
  type CacheType,
  externalApiCache,
} from "./external-api-cache";
export * from "./trpc-cache";

/**
 * Clear all internal in-memory caches across subsystems.
 */
export function clearAllCaches(): void {
  clearTrpcMemoryCache();
}
