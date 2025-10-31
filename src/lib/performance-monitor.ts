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
export const perfMonitor = new PerformanceMonitor();

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
