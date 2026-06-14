/**
 * Production Performance Optimizations
 * Memory management, query optimization, and production-ready configurations
 */

import { NextRequest, NextResponse } from "next/server";
import { memoryConfig, isDevMode, getMemoryStats } from "./dev-memory-config";
// Note: Using globalThis.performance (available in Node.js 16+ and browsers)
// instead of importing from perf_hooks which isn't bundleable for client-side

/**
 * Memory optimization utilities
 * Enhanced with dev-mode proactive cache clearing
 */
export class MemoryOptimizer {
  private static readonly MAX_MEMORY_USAGE = 1024 * 1024 * 1024; // 1GB
  private static readonly GC_THRESHOLD = isDevMode ? 0.7 : 0.8; // 70% in dev, 80% in prod
  private static readonly CACHE_CLEAR_THRESHOLD = memoryConfig.monitoring.cacheClearThreshold;
  private static lastCacheClear = 0;
  private static readonly MIN_CACHE_CLEAR_INTERVAL = 30000; // 30 seconds between cache clears

  /**
   * Monitor memory usage and trigger GC if needed
   * In development mode, proactively clears caches before hitting memory limits
   */
  static async monitorMemoryUsage(): Promise<void> {
    if (typeof process !== "undefined" && typeof process.memoryUsage === "function") {
      const stats = getMemoryStats();
      // eslint-disable-next-line unused-imports/no-unused-vars
      const { heapUsedMB, heapTotalMB, usagePercent, rssMB } = stats;

      // Dev mode: Proactive cache clearing at 70% threshold
      if (isDevMode && usagePercent > this.CACHE_CLEAR_THRESHOLD) {
        const now = Date.now();
        const timeSinceLastClear = now - this.lastCacheClear;

        if (timeSinceLastClear > this.MIN_CACHE_CLEAR_INTERVAL) {
          console.warn(
            `[MemoryOptimizer] Dev mode - Memory at ${(usagePercent * 100).toFixed(1)}% (${heapUsedMB.toFixed(0)}MB), clearing caches proactively...`
          );

          await this.clearAllCaches();
          this.lastCacheClear = now;

          // Log memory after cache clear
          const afterStats = getMemoryStats();
          console.log(
            `[MemoryOptimizer] After cache clear: ${afterStats.heapUsedMB.toFixed(0)}MB (${(afterStats.usagePercent * 100).toFixed(1)}%)`
          );
        }
      }

      // Standard GC trigger at higher threshold
      if (usagePercent > this.GC_THRESHOLD) {
        console.warn(
          `[MemoryOptimizer] High memory usage: ${heapUsedMB.toFixed(2)}MB (${(usagePercent * 100).toFixed(1)}%)`
        );

        if (global.gc) {
          global.gc();
          console.log("[MemoryOptimizer] Garbage collection triggered");
        }
      }

      // Additional logging in dev for memory tracking
      if (isDevMode && usagePercent > 0.5) {
        console.log(
          `[MemoryOptimizer] Memory: ${heapUsedMB.toFixed(0)}MB heap, ${rssMB.toFixed(0)}MB RSS (${(usagePercent * 100).toFixed(1)}%)`
        );
      }
    }
  }

  /**
   * Clear all application caches to free memory
   * This is called proactively in dev mode before hitting memory limits
   */
  static async clearAllCaches(): Promise<void> {
    try {
      // Clear advanced cache system
      const { globalCache } = await import("./advanced-cache-system");
      await globalCache.clear();
      console.log("[MemoryOptimizer] Cleared globalCache");

      // Clear intelligence cache
      const { intelligenceCache } = await import("./intelligence-cache");
      intelligenceCache.clear();
      console.log("[MemoryOptimizer] Cleared intelligenceCache");

      // Clear performance metrics to free accumulated number arrays
      PerformanceMonitor.clearMetrics();
      console.log("[MemoryOptimizer] Cleared PerformanceMonitor metrics");

      // Note: tRPC cache is a module-level Map, we can't easily clear it from here
      // but it has TTL-based auto-cleanup

      console.log("[MemoryOptimizer] All caches cleared");
    } catch (error) {
      console.error("[MemoryOptimizer] Error clearing caches:", error);
    }
  }

  /**
   * Get current memory status
   */
  static getMemoryStatus(): {
    heapUsedMB: number;
    heapTotalMB: number;
    usagePercent: number;
    rssMB: number;
    isHighUsage: boolean;
    isCritical: boolean;
  } {
    const stats = getMemoryStats();
    return {
      ...stats,
      isHighUsage: stats.usagePercent > this.CACHE_CLEAR_THRESHOLD,
      isCritical: stats.usagePercent > this.GC_THRESHOLD,
    };
  }

  /**
   * Optimize large objects by removing unnecessary properties
   */
  static optimizeObject<T extends Record<string, any>>(
    obj: T,
    keepKeys: (keyof T)[] = []
  ): Partial<T> {
    if (keepKeys.length === 0) {
      return obj;
    }

    const optimized: Partial<T> = {};
    for (const key of keepKeys) {
      if (key in obj) {
        optimized[key] = obj[key];
      }
    }
    return optimized;
  }

  /**
   * Clean up large arrays by limiting size
   */
  static limitArraySize<T>(arr: T[], maxSize = 1000): T[] {
    if (arr.length <= maxSize) return arr;
    return arr.slice(-maxSize);
  }
}

/**
 * Query optimization utilities
 */
export class QueryOptimizer {
  /**
   * Optimize Prisma includes for better performance
   */
  static optimizeIncludes(include: Record<string, any>): Record<string, any> {
    const optimized: Record<string, any> = {};

    for (const [key, value] of Object.entries(include)) {
      if (typeof value === "object" && value !== null) {
        // Use select instead of full include when possible
        if (value.select) {
          optimized[key] = { select: value.select };
        } else if (value.take) {
          optimized[key] = { take: value.take };
        } else {
          optimized[key] = value;
        }
      } else {
        optimized[key] = value;
      }
    }

    return optimized;
  }

  /**
   * Create optimized select clause for common patterns
   */
  static createSelectClause(fields: string[]): Record<string, boolean> {
    const select: Record<string, boolean> = {};
    fields.forEach((field) => {
      select[field] = true;
    });
    return select;
  }

  /**
   * Batch queries for better performance
   */
  static async batchQueries<T>(queries: (() => Promise<T>)[], batchSize = 10): Promise<T[]> {
    const results: T[] = [];

    for (let i = 0; i < queries.length; i += batchSize) {
      const batch = queries.slice(i, i + batchSize);
      const batchResults = await Promise.all(batch.map((query) => query()));
      results.push(...batchResults);

      // Allow event loop to process other tasks
      await new Promise((resolve) => setImmediate(resolve));
    }

    return results;
  }
}

/**
 * API response optimization
 */
export class ResponseOptimizer {
  /**
   * Compress and optimize API responses
   */
  static optimizeResponse(data: any): any {
    if (Array.isArray(data)) {
      // Limit array size for performance
      if (data.length > 1000) {
        console.warn("[ResponseOptimizer] Large array detected, limiting size");
        return data.slice(0, 1000);
      }
    }

    // Remove null/undefined values to reduce payload size
    return this.removeEmptyValues(data);
  }

  /**
   * Remove empty values from objects
   */
  private static removeEmptyValues(obj: any): any {
    if (Array.isArray(obj)) {
      return obj.map((item) => this.removeEmptyValues(item));
    }

    if (obj && typeof obj === "object") {
      const cleaned: any = {};
      for (const [key, value] of Object.entries(obj)) {
        if (value !== null && value !== undefined && value !== "") {
          cleaned[key] = this.removeEmptyValues(value);
        }
      }
      return cleaned;
    }

    return obj;
  }

  /**
   * Create optimized Next.js response
   */
  static createOptimizedResponse(
    data: any,
    options: {
      status?: number;
      headers?: Record<string, string>;
      compress?: boolean;
    } = {}
  ): NextResponse {
    const { status = 200, headers = {}, compress = true } = options;

    const optimizedData = this.optimizeResponse(data);

    const responseHeaders: Record<string, string> = {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=300, s-maxage=600", // 5min client, 10min CDN
      ...headers,
    };

    if (compress) {
      responseHeaders["Content-Encoding"] = "gzip";
    }

    return NextResponse.json(optimizedData, {
      status,
      headers: responseHeaders,
    });
  }
}

/**
 * Database connection optimization
 */
export class DatabaseOptimizer {
  private static pgStatStatementsAvailable: boolean | null = null;

  /**
   * Optimize database connection for production
   */
  static async optimizeConnection(): Promise<void> {
    try {
      // PostgreSQL connection optimizations are handled via connection string parameters
      // Example: ?connection_limit=10&pool_timeout=30
      console.log(
        "[DatabaseOptimizer] PostgreSQL connection optimization handled via connection parameters"
      );
    } catch (error) {
      console.error("[DatabaseOptimizer] Failed to optimize database:", error);
    }
  }

  /**
   * Analyze and optimize slow queries
   */
  static async analyzeSlowQueries(): Promise<void> {
    // Skip if we already know pg_stat_statements is not available
    if (this.pgStatStatementsAvailable === false) {
      return;
    }

    try {
      const { db } = await import("~/server/db");

      // PostgreSQL slow query analysis using pg_stat_statements
      // Requires pg_stat_statements extension to be enabled
      const stats = await db.$queryRaw`
        SELECT
          query,
          calls,
          total_exec_time,
          mean_exec_time
        FROM pg_stat_statements
        WHERE mean_exec_time > 10
        ORDER BY mean_exec_time DESC
        LIMIT 10
      `;

      this.pgStatStatementsAvailable = true;

      if ((stats as any[]).length > 0) {
        console.warn("[DatabaseOptimizer] Slow queries detected:", stats);
      }
    } catch {
      // Disable future checks if pg_stat_statements is not available
      if (this.pgStatStatementsAvailable === null) {
        this.pgStatStatementsAvailable = false;
        console.debug(
          "[DatabaseOptimizer] pg_stat_statements not available, disabling slow query analysis"
        );
      }
    }
  }
}

/**
 * Production middleware optimizations
 */
export class ProductionMiddleware {
  /**
   * Request performance monitoring
   */
  static monitorRequest(req: NextRequest): { startTime: number; path: string } {
    const startTime = performance.now();
    const path = req.nextUrl.pathname;

    // Log slow requests
    setTimeout(() => {
      const duration = performance.now() - startTime;
      if (duration > 1000) {
        // 1 second
        console.warn(`[ProductionMiddleware] Slow request: ${path} (${duration.toFixed(2)}ms)`);
      }
    }, 1000);

    return { startTime, path };
  }

  /**
   * Rate limiting headers
   */
  static addRateLimitHeaders(
    response: NextResponse,
    options: {
      limit?: number;
      remaining?: number;
      reset?: number;
    } = {}
  ): NextResponse {
    const { limit = 1000, remaining = 999, reset = Date.now() + 3600000 } = options;

    response.headers.set("X-RateLimit-Limit", limit.toString());
    response.headers.set("X-RateLimit-Remaining", remaining.toString());
    response.headers.set("X-RateLimit-Reset", reset.toString());

    return response;
  }

  /**
   * Security headers for production
   */
  static addSecurityHeaders(response: NextResponse, opts?: { pathname?: string }): NextResponse {
    response.headers.set("X-Content-Type-Options", "nosniff");

    // Skip X-Frame-Options for embeddable paths — frame-ancestors CSP supersedes it
    const pathname = opts?.pathname ?? "";
    const isEmbeddable =
      pathname.startsWith("/maps") ||
      pathname.startsWith("/wiki/") ||
      pathname.startsWith("/countries/");
    if (!isEmbeddable) {
      response.headers.set("X-Frame-Options", "DENY");
    }

    response.headers.set("X-XSS-Protection", "1; mode=block");
    response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");

    // CSP for production
    if (process.env.NODE_ENV === "production") {
      response.headers.set(
        "Content-Security-Policy",
        "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https:;"
      );
    }

    return response;
  }
}

/**
 * Performance monitoring and alerting
 */
export class PerformanceMonitor {
  private static metrics: Map<string, number[]> = new Map();
  private static readonly MAX_METRICS_PER_NAME = isDevMode ? 100 : 1000;
  private static readonly MAX_METRIC_NAMES = isDevMode ? 50 : 500;

  /**
   * Record performance metric
   * In dev mode: disabled to prevent memory accumulation
   */
  static recordMetric(name: string, value: number): void {
    // Skip recording in dev mode to save memory
    if (isDevMode) return;

    // Cap total number of metric names to prevent unbounded growth
    if (!this.metrics.has(name) && this.metrics.size >= this.MAX_METRIC_NAMES) {
      return;
    }

    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }

    const metrics = this.metrics.get(name)!;
    metrics.push(value);

    // Keep only recent metrics
    if (metrics.length > this.MAX_METRICS_PER_NAME) {
      metrics.splice(0, metrics.length - this.MAX_METRICS_PER_NAME);
    }

    // Alert on slow operations
    if (value > 1000) {
      console.warn(`[PerformanceMonitor] Slow operation: ${name} (${value}ms)`);
    }
  }

  /**
   * Clear all recorded metrics (called by MemoryOptimizer when memory is high)
   */
  static clearMetrics(): void {
    this.metrics.clear();
  }

  /**
   * Get performance statistics
   */
  static getStats(name: string): {
    count: number;
    average: number;
    min: number;
    max: number;
    p95: number;
  } | null {
    const metrics = this.metrics.get(name);
    if (!metrics || metrics.length === 0) return null;

    const sorted = [...metrics].sort((a, b) => a - b);
    const count = sorted.length;
    const sum = sorted.reduce((a, b) => a + b, 0);
    const average = sum / count;
    const min = sorted[0]!;
    const max = sorted[count - 1]!;
    const p95Index = Math.floor(count * 0.95);
    const p95 = sorted[p95Index] || max;

    return { count, average, min, max, p95 };
  }

  /**
   * Get all performance statistics
   */
  static getAllStats(): Record<string, any> {
    const stats: Record<string, any> = {};

    for (const [name] of this.metrics) {
      stats[name] = this.getStats(name);
    }

    return stats;
  }
}

/**
 * Production startup optimizations
 * Enhanced with dev-mode memory monitoring
 */
export class ProductionStartup {
  private static monitoringInterval: NodeJS.Timeout | null = null;
  private static queryAnalysisInterval: NodeJS.Timeout | null = null;

  /**
   * Initialize production optimizations
   * In dev mode: more frequent memory monitoring with proactive cache clearing
   * In prod mode: standard monitoring with GC triggers
   */
  static async initialize(): Promise<void> {
    const mode = isDevMode ? "development" : "production";
    console.log(`[ProductionStartup] Initializing ${mode} optimizations...`);

    try {
      // Optimize database connection
      await DatabaseOptimizer.optimizeConnection();

      // Initialize memory monitoring
      // Dev mode: check every 15 seconds for proactive cache clearing
      // Prod mode: check every 30 seconds
      const monitoringInterval = memoryConfig.monitoring.monitoringInterval;
      this.monitoringInterval = setInterval(() => {
        MemoryOptimizer.monitorMemoryUsage();
      }, monitoringInterval);

      // Analyze slow queries periodically (only in prod to save memory in dev)
      if (!isDevMode) {
        this.queryAnalysisInterval = setInterval(() => {
          DatabaseOptimizer.analyzeSlowQueries();
        }, 300000); // Every 5 minutes
      }

      // Log initial memory state
      const memStatus = MemoryOptimizer.getMemoryStatus();
      console.log(
        `[ProductionStartup] ${mode} optimizations initialized (Memory: ${memStatus.heapUsedMB.toFixed(0)}MB, monitoring every ${monitoringInterval / 1000}s)`
      );

      // Dev mode: log memory config
      if (isDevMode) {
        console.log(
          `[ProductionStartup] Dev cache limits: global=${memoryConfig.cache.maxEntries}, intelligence=${memoryConfig.intelligence.maxCacheSize}, trpc=${memoryConfig.trpc.maxCacheSize}`
        );
      }
    } catch (error) {
      console.error("[ProductionStartup] Failed to initialize:", error);
    }
  }

  /**
   * Stop all monitoring intervals (for cleanup)
   */
  static stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    if (this.queryAnalysisInterval) {
      clearInterval(this.queryAnalysisInterval);
      this.queryAnalysisInterval = null;
    }
    console.log("[ProductionStartup] Monitoring stopped");
  }

  /**
   * Warm up caches with critical data
   */
  static async warmupCaches(): Promise<void> {
    console.log("[ProductionStartup] Warming up caches...");

    try {
      // eslint-disable-next-line unused-imports/no-unused-vars
      const { globalCache } = await import("./advanced-cache-system");
      const { OptimizedCountryQueries } = await import("./database-optimizations");
      const { db } = await import("~/server/db");

      // Query top 20 countries by GDP to pre-load the most frequently accessed data
      const topCountries = await db.country.findMany({
        where: { currentTotalGdp: { gt: 0 } },
        orderBy: { currentTotalGdp: "desc" },
        take: 20,
        select: { id: true },
      });

      const ids = topCountries.map((c) => c.id);

      if (ids.length > 0) {
        const countries = await OptimizedCountryQueries.getCountriesByIds(ids, {
          select: { id: true, name: true, slug: true },
        });
        console.log(`[ProductionStartup] Cache warmed up with ${countries.length} countries`);
      } else {
        console.log("[ProductionStartup] Cache warm-up skipped (no countries with GDP found)");
      }
    } catch (error) {
      console.error("[ProductionStartup] Failed to warm up caches:", error);
    }
  }
}
