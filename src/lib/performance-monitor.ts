/**
 * Performance Monitoring Utilities
 * Lightweight performance tracking for maps and API calls
 */

interface PerformanceMetric {
  name: string;
  duration: number;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

interface QueryMetrics {
  queryKey: string;
  duration: number;
  timestamp: number;
  success: boolean;
  error?: string;
  cacheHit: boolean;
  dataSize?: number;
  userId?: string;
  countryId?: string;
}

class PerformanceMonitor {
  private metrics: PerformanceMetric[] = [];
  private maxMetrics = 100; // Keep last 100 metrics
  private timers = new Map<string, number>();

  /**
   * Start timing an operation
   */
  start(name: string): void {
    this.timers.set(name, Date.now());
  }

  /**
   * End timing and record metric
   */
  end(name: string, metadata?: Record<string, unknown>): number {
    const startTime = this.timers.get(name);
    if (!startTime) {
      console.warn(`[PerformanceMonitor] No start time for: ${name}`);
      return 0;
    }

    const duration = Date.now() - startTime;
    this.timers.delete(name);

    this.recordMetric({
      name,
      duration,
      timestamp: Date.now(),
      metadata,
    });

    return duration;
  }

  /**
   * Record a metric directly
   */
  recordMetric(metric: PerformanceMetric): void {
    this.metrics.push(metric);

    // Keep only last N metrics
    if (this.metrics.length > this.maxMetrics) {
      this.metrics.shift();
    }

    // Log slow operations in development
    if (process.env.NODE_ENV === "development" && metric.duration > 1000) {
      console.warn(`[Slow Operation] ${metric.name}: ${metric.duration}ms`, metric.metadata);
    }
  }

  /**
   * Record a query performance metric
   */
  recordQuery(metrics: Omit<QueryMetrics, "timestamp">): void {
    const queryMetric: QueryMetrics = {
      ...metrics,
      timestamp: Date.now(),
    };

    // Store as a PerformanceMetric for compatibility with existing tracking
    this.recordMetric({
      name: `query:${queryMetric.queryKey}`,
      duration: queryMetric.duration,
      timestamp: queryMetric.timestamp,
      metadata: {
        success: queryMetric.success,
        error: queryMetric.error,
        cacheHit: queryMetric.cacheHit,
        dataSize: queryMetric.dataSize,
        userId: queryMetric.userId,
        countryId: queryMetric.countryId,
      },
    });

    // Log query errors in development
    if (process.env.NODE_ENV === "development" && !queryMetric.success) {
      console.warn(`[Query Error] ${queryMetric.queryKey}: ${queryMetric.error}`);
    }
  }

  /**
   * Get statistics for a specific metric name
   */
  getStats(name?: string): {
    count: number;
    avg: number;
    min: number;
    max: number;
    p95: number;
  } {
    const filtered = name
      ? this.metrics.filter((m) => m.name === name)
      : this.metrics;

    if (filtered.length === 0) {
      return { count: 0, avg: 0, min: 0, max: 0, p95: 0 };
    }

    const durations = filtered.map((m) => m.duration).sort((a, b) => a - b);
    const sum = durations.reduce((acc, d) => acc + d, 0);
    const p95Index = Math.floor(durations.length * 0.95);

    return {
      count: durations.length,
      avg: sum / durations.length,
      min: durations[0]!,
      max: durations[durations.length - 1]!,
      p95: durations[p95Index] ?? durations[durations.length - 1]!,
    };
  }

  /**
   * Get all unique metric names
   */
  getMetricNames(): string[] {
    return Array.from(new Set(this.metrics.map((m) => m.name)));
  }

  getPerformanceStats(): {
    queries: {
      totalQueries: number;
      averageDuration: number;
      errorRate: number;
      cacheHitRate: number;
      slowQueries: Array<{
        name: string;
        duration: number;
        timestamp: number;
        metadata?: Record<string, unknown> | undefined;
      }>;
    };
    metrics: {
      totalRecorded: number;
      slowestMetric: PerformanceMetric | null;
    };
  } {
    const queryPrefixes = ["query:", "trpc:"];
    const queryMetrics = this.metrics.filter((metric) =>
      queryPrefixes.some((prefix) => metric.name.startsWith(prefix))
    );

    const totalQueries = queryMetrics.length;
    const totalDuration = queryMetrics.reduce((sum, metric) => sum + metric.duration, 0);
    const averageDuration = totalQueries > 0 ? totalDuration / totalQueries : 0;

    const errorCount = queryMetrics.filter((metric) => metric.metadata?.success === false).length;
    const errorRate = totalQueries > 0 ? errorCount / totalQueries : 0;

    const cacheHits = queryMetrics.filter((metric) => metric.metadata?.cacheHit === true).length;
    const cacheHitRate = totalQueries > 0 ? (cacheHits / totalQueries) * 100 : 100;

    const slowQueries = queryMetrics
      .filter((metric) => metric.duration >= 2000)
      .sort((a, b) => b.duration - a.duration)
      .map((metric) => {
        const cleanName = queryPrefixes.reduce(
          (name, prefix) => (name.startsWith(prefix) ? name.slice(prefix.length) : name),
          metric.name
        );

        return {
          name: cleanName,
          duration: metric.duration,
          timestamp: metric.timestamp,
          metadata: metric.metadata,
        };
      });

    const slowestMetric = this.metrics.length
      ? [...this.metrics].sort((a, b) => b.duration - a.duration)[0]!
      : null;

    return {
      queries: {
        totalQueries,
        averageDuration,
        errorRate,
        cacheHitRate,
        slowQueries,
      },
      metrics: {
        totalRecorded: this.metrics.length,
        slowestMetric,
      },
    };
  }

  getOptimizationSuggestions(): string[] {
    const suggestions: string[] = [];
    const stats = this.getPerformanceStats();

    if (stats.queries.averageDuration > 2000) {
      suggestions.push("Investigate and optimize slow queries exceeding 2s average duration");
    } else if (stats.queries.averageDuration > 1000) {
      suggestions.push("Consider batching or caching to reduce average query latency");
    }

    if (stats.queries.errorRate > 0.02) {
      suggestions.push("High query error rate detected - review recent failures and retry logic");
    }

    if (stats.queries.cacheHitRate < 60) {
      suggestions.push("Improve cache hit rate by revisiting cache keys and TTL configuration");
    }

    const notableSlowQueries = stats.queries.slowQueries.slice(0, 3);
    notableSlowQueries.forEach((query) => {
      suggestions.push(`Review slow query: ${query.name} (${query.duration}ms)`);
    });

    if (stats.metrics.totalRecorded >= this.maxMetrics) {
      suggestions.push("Performance log buffer is full - export or increase capacity");
    }

    return suggestions;
  }

  /**
   * Clear all metrics
   */
  clear(): void {
    this.metrics = [];
    this.timers.clear();
  }

  /**
   * Export metrics for analysis
   */
  export(): PerformanceMetric[] {
    return [...this.metrics];
  }
}

// Singleton instance
const perfMonitorInstance = new PerformanceMonitor();

// Export both names for compatibility
export const perfMonitor = perfMonitorInstance;
export const performanceMonitor = perfMonitorInstance;

// Default export for convenience
export default perfMonitorInstance;

/**
 * Helper: Monitor a tile request
 */
export function monitorTileRequest(layer: string, z: number, x: number, y: number): {
  end: (cacheStatus: string) => void;
} {
  const name = `tile:${layer}:${z}`;
  perfMonitor.start(name);

  return {
    end: (cacheStatus: string) => {
      perfMonitor.end(name, { layer, z, x, y, cacheStatus });
    },
  };
}

/**
 * Helper: Monitor a tRPC query
 */
export function monitorTRPCQuery(path: string, input?: unknown): {
  end: () => void;
} {
  const name = `trpc:${path}`;
  perfMonitor.start(name);

  return {
    end: () => {
      perfMonitor.end(name, { path, input });
    },
  };
}

/**
 * Helper: Monitor map operations
 */
export function monitorMapOperation(operation: string): {
  end: () => void;
} {
  const name = `map:${operation}`;
  perfMonitor.start(name);

  return {
    end: () => {
      perfMonitor.end(name);
    },
  };
}

/**
 * Get performance summary for logging/debugging
 */
export function getPerformanceSummary(): Record<string, ReturnType<typeof perfMonitor.getStats>> {
  const names = perfMonitor.getMetricNames();
  const summary: Record<string, ReturnType<typeof perfMonitor.getStats>> = {};

  for (const name of names) {
    summary[name] = perfMonitor.getStats(name);
  }

  return summary;
}

/**
 * Log performance summary to console (development only)
 */
export function logPerformanceSummary(): void {
  if (process.env.NODE_ENV !== "development") return;

  const summary = getPerformanceSummary();
  console.log("=== Performance Summary ===");
  console.table(summary);
}
