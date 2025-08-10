// Performance Monitor - Phase 3 Performance Enhancement
// Comprehensive query and application performance monitoring

import { IxTime } from '~/lib/ixtime';

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

interface PerformanceSnapshot {
  timestamp: number;
  queries: {
    totalQueries: number;
    averageDuration: number;
    errorRate: number;
    cacheHitRate: number;
    slowQueries: QueryMetrics[];
  };
  memory: {
    heapUsed: number;
    heapTotal: number;
    external: number;
  };
  render: {
    averageRenderTime: number;
    slowComponents: ComponentMetric[];
  };
  websocket: {
    activeConnections: number;
    messagesPerSecond: number;
    averageLatency: number;
  };
}

interface ComponentMetric {
  name: string;
  renderTime: number;
  renderCount: number;
  reRenderRate: number;
  timestamp: number;
}

interface PerformanceAlert {
  type: 'query' | 'memory' | 'render' | 'websocket';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  timestamp: number;
  data: any;
}

interface PerformanceThresholds {
  queryTimeWarning: number;
  queryTimeCritical: number;
  errorRateWarning: number;
  errorRateCritical: number;
  memoryWarning: number;
  memoryCritical: number;
  renderTimeWarning: number;
  renderTimeCritical: number;
}

/**
 * Advanced Performance Monitoring System
 * Tracks queries, renders, memory usage, and provides optimization insights
 */
export class PerformanceMonitor {
  private metrics: QueryMetrics[] = [];
  private componentMetrics: ComponentMetric[] = [];
  private performanceSnapshots: PerformanceSnapshot[] = [];
  private alerts: PerformanceAlert[] = [];
  private isEnabled = true;

  private thresholds: PerformanceThresholds = {
    queryTimeWarning: 1000, // 1 second
    queryTimeCritical: 3000, // 3 seconds
    errorRateWarning: 0.05, // 5%
    errorRateCritical: 0.15, // 15%
    memoryWarning: 100 * 1024 * 1024, // 100MB
    memoryCritical: 250 * 1024 * 1024, // 250MB
    renderTimeWarning: 16, // 16ms (60fps)
    renderTimeCritical: 33 // 33ms (30fps)
  };

  private snapshotInterval?: NodeJS.Timeout;
  private cleanupInterval?: NodeJS.Timeout;

  constructor(enabled = true) {
    this.isEnabled = enabled;
    if (enabled) {
      this.startPerformanceMonitoring();
    }
  }

  /**
   * Record a query performance metric
   */
  recordQuery(metrics: Omit<QueryMetrics, 'timestamp'>): void {
    if (!this.isEnabled) return;

    const queryMetric: QueryMetrics = {
      ...metrics,
      timestamp: Date.now()
    };

    this.metrics.push(queryMetric);
    this.checkQueryThresholds(queryMetric);

    // Keep only last 1000 metrics to prevent memory issues
    if (this.metrics.length > 1000) {
      this.metrics = this.metrics.slice(-500);
    }
  }

  /**
   * Record component render performance
   */
  recordComponentRender(
    componentName: string,
    renderTime: number,
    renderCount = 1
  ): void {
    if (!this.isEnabled) return;

    const existing = this.componentMetrics.find(m => m.name === componentName);
    const now = Date.now();

    if (existing) {
      existing.renderTime = (existing.renderTime + renderTime) / 2; // Moving average
      existing.renderCount += renderCount;
      existing.reRenderRate = existing.renderCount / ((now - existing.timestamp) / 1000 / 60); // renders per minute
      existing.timestamp = now;
    } else {
      this.componentMetrics.push({
        name: componentName,
        renderTime,
        renderCount,
        reRenderRate: renderCount,
        timestamp: now
      });
    }

    this.checkRenderThresholds(componentName, renderTime);

    // Keep only last 50 components
    if (this.componentMetrics.length > 50) {
      this.componentMetrics = this.componentMetrics.slice(-25);
    }
  }

  /**
   * Get current performance statistics
   */
  getPerformanceStats(): {
    queries: any;
    memory: any;
    renders: any;
    alerts: PerformanceAlert[];
  } {
    const recentMetrics = this.metrics.filter(m => Date.now() - m.timestamp < 300000); // Last 5 minutes

    const queries = {
      totalQueries: recentMetrics.length,
      averageDuration: recentMetrics.length > 0 
        ? recentMetrics.reduce((sum, m) => sum + m.duration, 0) / recentMetrics.length
        : 0,
      errorRate: recentMetrics.length > 0
        ? recentMetrics.filter(m => !m.success).length / recentMetrics.length
        : 0,
      cacheHitRate: recentMetrics.length > 0
        ? recentMetrics.filter(m => m.cacheHit).length / recentMetrics.length
        : 0,
      slowQueries: recentMetrics
        .filter(m => m.duration > this.thresholds.queryTimeWarning)
        .sort((a, b) => b.duration - a.duration)
        .slice(0, 10)
    };

    const memory = this.getMemoryUsage();
    
    const renders = {
      components: this.componentMetrics.length,
      averageRenderTime: this.componentMetrics.length > 0
        ? this.componentMetrics.reduce((sum, m) => sum + m.renderTime, 0) / this.componentMetrics.length
        : 0,
      slowComponents: this.componentMetrics
        .filter(m => m.renderTime > this.thresholds.renderTimeWarning)
        .sort((a, b) => b.renderTime - a.renderTime)
        .slice(0, 10)
    };

    return {
      queries,
      memory,
      renders,
      alerts: this.alerts.slice(-20) // Last 20 alerts
    };
  }

  /**
   * Get performance optimization suggestions
   */
  getOptimizationSuggestions(): string[] {
    const suggestions: string[] = [];
    const stats = this.getPerformanceStats();

    // Query optimization suggestions
    if (stats.queries.cacheHitRate < 0.7) {
      suggestions.push('Consider implementing more aggressive caching - current cache hit rate is low');
    }

    if (stats.queries.errorRate > this.thresholds.errorRateWarning) {
      suggestions.push('High error rate detected - review query error handling and retry logic');
    }

    if (stats.queries.averageDuration > this.thresholds.queryTimeWarning) {
      suggestions.push('Average query time is high - consider query batching or optimization');
    }

    // Memory optimization suggestions
    if (stats.memory.heapUsed > this.thresholds.memoryWarning) {
      suggestions.push('High memory usage detected - review component memoization and data structures');
    }

    // Render optimization suggestions
    if (stats.renders.averageRenderTime > this.thresholds.renderTimeWarning) {
      suggestions.push('Slow component renders detected - implement React.memo and optimize render logic');
    }

    const frequentReRenders = this.componentMetrics.filter(m => m.reRenderRate > 10);
    if (frequentReRenders.length > 0) {
      suggestions.push(`Components with high re-render rates: ${frequentReRenders.map(m => m.name).join(', ')}`);
    }

    return suggestions;
  }

  /**
   * Create a performance snapshot
   */
  private createSnapshot(): PerformanceSnapshot {
    const stats = this.getPerformanceStats();
    const memory = this.getMemoryUsage();
    
    return {
      timestamp: Date.now(),
      queries: stats.queries,
      memory,
      render: stats.renders,
      websocket: {
        activeConnections: 0, // Would integrate with WebSocket monitor
        messagesPerSecond: 0,
        averageLatency: 0
      }
    };
  }

  /**
   * Check query performance against thresholds
   */
  private checkQueryThresholds(metric: QueryMetrics): void {
    if (metric.duration > this.thresholds.queryTimeCritical) {
      this.createAlert('query', 'critical', 
        `Extremely slow query detected: ${metric.queryKey} (${metric.duration}ms)`, metric);
    } else if (metric.duration > this.thresholds.queryTimeWarning) {
      this.createAlert('query', 'medium',
        `Slow query detected: ${metric.queryKey} (${metric.duration}ms)`, metric);
    }

    if (!metric.success) {
      this.createAlert('query', 'high',
        `Query failed: ${metric.queryKey} - ${metric.error}`, metric);
    }
  }

  /**
   * Check render performance against thresholds
   */
  private checkRenderThresholds(componentName: string, renderTime: number): void {
    if (renderTime > this.thresholds.renderTimeCritical) {
      this.createAlert('render', 'critical',
        `Extremely slow render: ${componentName} (${renderTime}ms)`, { componentName, renderTime });
    } else if (renderTime > this.thresholds.renderTimeWarning) {
      this.createAlert('render', 'medium',
        `Slow render: ${componentName} (${renderTime}ms)`, { componentName, renderTime });
    }
  }

  /**
   * Create a performance alert
   */
  private createAlert(
    type: PerformanceAlert['type'],
    severity: PerformanceAlert['severity'],
    message: string,
    data: any
  ): void {
    this.alerts.push({
      type,
      severity,
      message,
      timestamp: Date.now(),
      data
    });

    // Keep only last 100 alerts
    if (this.alerts.length > 100) {
      this.alerts = this.alerts.slice(-50);
    }

    // In a real implementation, you might want to send critical alerts to an external service
    if (severity === 'critical') {
      console.warn(`[Performance Critical Alert] ${message}`, data);
    }
  }

  /**
   * Get memory usage information
   */
  private getMemoryUsage(): { heapUsed: number; heapTotal: number; external: number } {
    if (typeof process !== 'undefined' && process.memoryUsage) {
      const mem = process.memoryUsage();
      return {
        heapUsed: mem.heapUsed,
        heapTotal: mem.heapTotal,
        external: mem.external
      };
    }

    // Browser fallback (limited information available)
    return {
      heapUsed: 0,
      heapTotal: 0,
      external: 0
    };
  }

  /**
   * Start performance monitoring intervals
   */
  private startPerformanceMonitoring(): void {
    // Take snapshot every minute
    this.snapshotInterval = setInterval(() => {
      const snapshot = this.createSnapshot();
      this.performanceSnapshots.push(snapshot);
      
      // Keep only last 60 snapshots (1 hour)
      if (this.performanceSnapshots.length > 60) {
        this.performanceSnapshots = this.performanceSnapshots.slice(-30);
      }
    }, 60000);

    // Cleanup old metrics every 5 minutes
    this.cleanupInterval = setInterval(() => {
      const fiveMinutesAgo = Date.now() - 300000;
      this.metrics = this.metrics.filter(m => m.timestamp > fiveMinutesAgo);
      this.alerts = this.alerts.filter(a => a.timestamp > fiveMinutesAgo);
    }, 300000);
  }

  /**
   * Stop performance monitoring and cleanup
   */
  destroy(): void {
    if (this.snapshotInterval) {
      clearInterval(this.snapshotInterval);
    }
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    
    this.metrics = [];
    this.componentMetrics = [];
    this.performanceSnapshots = [];
    this.alerts = [];
  }

  /**
   * Export performance data for analysis
   */
  exportPerformanceData(): {
    metrics: QueryMetrics[];
    components: ComponentMetric[];
    snapshots: PerformanceSnapshot[];
    alerts: PerformanceAlert[];
  } {
    return {
      metrics: [...this.metrics],
      components: [...this.componentMetrics],
      snapshots: [...this.performanceSnapshots],
      alerts: [...this.alerts]
    };
  }
}

// Global performance monitor instance
export const performanceMonitor = new PerformanceMonitor(
  process.env.NODE_ENV !== 'production' // Enable only in development by default
);

/**
 * React performance tracking utilities
 */
export const PerformanceUtils = {
  /**
   * Higher-order component for tracking render performance
   */
  withPerformanceTracking: <P extends object>(
    WrappedComponent: React.ComponentType<P>,
    componentName?: string
  ) => {
    const TrackedComponent: React.FC<P> = (props) => {
      const name = componentName || WrappedComponent.displayName || WrappedComponent.name || 'Component';
      const startTime = performance.now();
      
      React.useEffect(() => {
        const endTime = performance.now();
        performanceMonitor.recordComponentRender(name, endTime - startTime);
      });

      return <WrappedComponent {...props} />;
    };

    TrackedComponent.displayName = `withPerformanceTracking(${
      WrappedComponent.displayName || WrappedComponent.name || 'Component'
    })`;

    return TrackedComponent;
  },

  /**
   * Hook for tracking custom performance metrics
   */
  usePerformanceMetric: (metricName: string) => {
    const startTime = React.useRef<number>();
    
    const startMeasurement = React.useCallback(() => {
      startTime.current = performance.now();
    }, []);
    
    const endMeasurement = React.useCallback(() => {
      if (startTime.current) {
        const duration = performance.now() - startTime.current;
        performanceMonitor.recordComponentRender(metricName, duration);
        startTime.current = undefined;
      }
    }, [metricName]);
    
    return { startMeasurement, endMeasurement };
  }
};

// Performance monitoring for tRPC queries
export const createPerformanceTRPCMiddleware = () => {
  return {
    query: async (ctx: any) => {
      const startTime = performance.now();
      const queryKey = ctx.path;
      
      try {
        const result = await ctx.next();
        const duration = performance.now() - startTime;
        
        performanceMonitor.recordQuery({
          queryKey,
          duration,
          success: true,
          cacheHit: false, // Would need to be determined by your cache implementation
          dataSize: JSON.stringify(result).length,
          userId: ctx.meta?.userId,
          countryId: ctx.meta?.countryId
        });
        
        return result;
      } catch (error) {
        const duration = performance.now() - startTime;
        
        performanceMonitor.recordQuery({
          queryKey,
          duration,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          cacheHit: false,
          userId: ctx.meta?.userId,
          countryId: ctx.meta?.countryId
        });
        
        throw error;
      }
    }
  };
};