/**
 * Development Memory Configuration
 * 
 * Centralized configuration for memory-sensitive settings that differ between
 * development and production environments. This helps prevent OOM crashes
 * on memory-constrained development servers.
 * 
 * Server Context:
 * - Total RAM: 7.2GB
 * - Dev heap limit: 4GB (via NODE_OPTIONS)
 * - Target dev usage: ~2.5GB (stable)
 */

const isDev = process.env.NODE_ENV === "development";

/**
 * Memory configuration that scales based on environment
 */
export const memoryConfig = {
  /**
   * In-memory cache settings (advanced-cache-system.ts)
   */
  cache: {
    /** Maximum cache entries: 200 in dev, 10,000 in prod */
    maxEntries: isDev ? 200 : 10000,
    /** Default TTL: 30s in dev, 5 minutes in prod */
    defaultTTL: isDev ? 30000 : 300000,
    /** Cleanup interval: 15s in dev, 60s in prod */
    cleanupInterval: isDev ? 15000 : 60000,
  },

  /**
   * tRPC cache settings (trpc-cache.ts)
   */
  trpc: {
    /** Maximum cache entries: 100 in dev, 1,000 in prod */
    maxCacheSize: isDev ? 100 : 1000,
    /** Cache TTL in seconds: 15s in dev, 60s in prod */
    defaultTTLSeconds: isDev ? 15 : 60,
  },

  /**
   * Intelligence cache settings (intelligence-cache.ts)
   */
  intelligence: {
    /** Maximum cache entries: 100 in dev, 1,000 in prod */
    maxCacheSize: isDev ? 100 : 1000,
    /** Cleanup interval: 15s in dev, 60s in prod */
    cleanupInterval: isDev ? 15000 : 60000,
  },

  /**
   * Query result limits for unbounded queries
   */
  query: {
    /** Default limit for list queries: 50 in dev, 100 in prod */
    defaultLimit: isDev ? 50 : 100,
    /** Maximum allowed limit: 100 in dev, 500 in prod */
    maxLimit: isDev ? 100 : 500,
  },

  /**
   * Memory monitoring thresholds
   */
  monitoring: {
    /** Percentage at which to trigger cache clearing (dev only): 65% */
    cacheClearThreshold: 0.65,
    /** Percentage at which to warn: 75% */
    warningThreshold: 0.75,
    /** Monitoring interval in ms: 15s in dev, 30s in prod */
    monitoringInterval: isDev ? 15000 : 30000,
  },

  /**
   * Database connection settings (configured via DATABASE_URL params)
   * These are reference values - actual config is in .env files
   */
  database: {
    /** Connection pool size: 5 in dev, 20 in prod */
    connectionLimit: isDev ? 5 : 20,
    /** Pool timeout in seconds */
    poolTimeout: 30,
    /** Connect timeout in seconds */
    connectTimeout: 10,
  },
} as const;

/**
 * Helper to check if running in development mode
 */
export const isDevMode = isDev;

/**
 * Configured max heap size in MB (from NODE_OPTIONS --max-old-space-size).
 * Used to calculate meaningful usage percentages instead of comparing against
 * Node's dynamic heapTotal which starts small (~58MB) and grows over time.
 */
const MAX_HEAP_MB = (() => {
  if (typeof process === "undefined") return 4096;
  const nodeOpts = process.env.NODE_OPTIONS || "";
  const match = nodeOpts.match(/--max-old-space-size=(\d+)/);
  return match ? parseInt(match[1], 10) : 4096;
})();

/**
 * Get human-readable memory usage stats.
 * usagePercent is calculated against the configured max heap (--max-old-space-size),
 * not Node's dynamic heapTotal, so thresholds work correctly from startup.
 */
export function getMemoryStats(): {
  heapUsedMB: number;
  heapTotalMB: number;
  usagePercent: number;
  rssMB: number;
} {
  if (typeof process === "undefined" || !process.memoryUsage) {
    return { heapUsedMB: 0, heapTotalMB: 0, usagePercent: 0, rssMB: 0 };
  }

  const memUsage = process.memoryUsage();
  const heapUsedMB = memUsage.heapUsed / 1024 / 1024;
  const heapTotalMB = memUsage.heapTotal / 1024 / 1024;
  // Calculate percentage against configured max heap, not dynamic heapTotal
  const usagePercent = heapUsedMB / MAX_HEAP_MB;
  const rssMB = memUsage.rss / 1024 / 1024;

  return { heapUsedMB, heapTotalMB, usagePercent, rssMB };
}

/**
 * Log current memory configuration (useful for debugging)
 */
export function logMemoryConfig(): void {
  console.log(`[MemoryConfig] Environment: ${isDev ? "development" : "production"}`);
  console.log(`[MemoryConfig] Cache max entries: ${memoryConfig.cache.maxEntries}`);
  console.log(`[MemoryConfig] tRPC cache size: ${memoryConfig.trpc.maxCacheSize}`);
  console.log(`[MemoryConfig] Intelligence cache size: ${memoryConfig.intelligence.maxCacheSize}`);
  console.log(`[MemoryConfig] Query default limit: ${memoryConfig.query.defaultLimit}`);
  
  const stats = getMemoryStats();
  console.log(`[MemoryConfig] Current heap: ${stats.heapUsedMB.toFixed(1)}MB / ${stats.heapTotalMB.toFixed(1)}MB (${(stats.usagePercent * 100).toFixed(1)}%)`);
}
