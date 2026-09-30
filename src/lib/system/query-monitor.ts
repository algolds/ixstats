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
  // Fixed-size ring buffer: recording is O(1) with no per-query array reallocation
  private readonly buffer: QueryMetrics[] = [];
  private readonly capacity: number;
  private readonly slowThresholdMs: number;
  private head = 0; // next write position
  private count = 0;

  constructor(capacity = 1000, slowThresholdMs = 100) {
    this.capacity = capacity;
    this.slowThresholdMs = slowThresholdMs;
  }

  recordQuery(metrics: QueryMetrics): void {
    this.buffer[this.head] = metrics;
    this.head = (this.head + 1) % this.capacity;
    this.count = Math.min(this.count + 1, this.capacity);

    if (metrics.duration > this.slowThresholdMs) {
      console.warn(`[SLOW QUERY] ${metrics.queryKey}: ${metrics.duration}ms`);
    }
  }

  /** Recorded entries, oldest to newest. */
  private snapshot(): QueryMetrics[] {
    const start = (this.head - this.count + this.capacity) % this.capacity;
    const out: QueryMetrics[] = [];
    for (let i = 0; i < this.count; i++) {
      const entry = this.buffer[(start + i) % this.capacity];
      if (entry) out.push(entry);
    }
    return out;
  }

  getMetrics(): QueryMetrics[] {
    return this.snapshot();
  }

  getAverageDuration(queryKey: string): number {
    const relevant = this.snapshot().filter((m) => m.queryKey === queryKey && m.success);
    if (relevant.length === 0) return 0;

    return relevant.reduce((sum, m) => sum + m.duration, 0) / relevant.length;
  }

  getSlowQueries(threshold = 100): QueryMetrics[] {
    return this.snapshot().filter((m) => m.duration > threshold && m.success);
  }

  clearMetrics(): void {
    this.buffer.length = 0;
    this.head = 0;
    this.count = 0;
  }

  getStats(): {
    totalQueries: number;
    slowQueries: number;
    avgDuration: number;
    cacheHitRate: number;
  } {
    const metrics = this.snapshot();
    const total = metrics.length;
    if (total === 0) {
      return { totalQueries: 0, slowQueries: 0, avgDuration: 0, cacheHitRate: 0 };
    }

    const slow = metrics.filter((m) => m.duration > this.slowThresholdMs).length;
    const avgDuration = metrics.reduce((sum, m) => sum + m.duration, 0) / total;
    const cacheHits = metrics.filter((m) => m.cacheHit).length;

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
