/**
 * Query Performance Monitor
 * Standalone module for tracking database query performance metrics.
 * Separated from database-optimizations.ts to avoid circular dependencies with db.ts
 */

export interface QueryMetrics {
  queryKey: string;
  duration: number;
  success: boolean;
  cacheHit?: boolean;
  dataSize?: number;
  error?: string;
  timestamp: number;
}

/**
 * Performance monitoring for database queries
 */
export class QueryPerformanceMonitor {
  private metrics: QueryMetrics[] = [];
  private readonly MAX_METRICS = 1000;

  recordQuery(metrics: QueryMetrics): void {
    this.metrics.push(metrics);

    // Keep only recent metrics
    if (this.metrics.length > this.MAX_METRICS) {
      this.metrics = this.metrics.slice(-this.MAX_METRICS);
    }

    // Log slow queries (>100ms)
    if (metrics.duration > 100) {
      console.warn(`[SLOW QUERY] ${metrics.queryKey}: ${metrics.duration}ms`);
    }
  }

  getMetrics(): QueryMetrics[] {
    return [...this.metrics];
  }

  getAverageDuration(queryKey: string): number {
    const relevant = this.metrics.filter((m) => m.queryKey === queryKey && m.success);
    if (relevant.length === 0) return 0;

    return relevant.reduce((sum, m) => sum + m.duration, 0) / relevant.length;
  }

  getSlowQueries(threshold = 100): QueryMetrics[] {
    return this.metrics.filter((m) => m.duration > threshold && m.success);
  }

  clearMetrics(): void {
    this.metrics = [];
  }

  getStats(): {
    totalQueries: number;
    slowQueries: number;
    avgDuration: number;
    cacheHitRate: number;
  } {
    const total = this.metrics.length;
    if (total === 0) {
      return { totalQueries: 0, slowQueries: 0, avgDuration: 0, cacheHitRate: 0 };
    }

    const slow = this.metrics.filter((m) => m.duration > 100).length;
    const avgDuration = this.metrics.reduce((sum, m) => sum + m.duration, 0) / total;
    const cacheHits = this.metrics.filter((m) => m.cacheHit).length;

    return {
      totalQueries: total,
      slowQueries: slow,
      avgDuration,
      cacheHitRate: cacheHits / total,
    };
  }
}

// Singleton instance for global query monitoring
export const queryMonitor = new QueryPerformanceMonitor();
