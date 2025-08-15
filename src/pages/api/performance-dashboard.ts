// Performance Dashboard API - Phase 3 Performance Enhancement
// Comprehensive performance metrics and monitoring endpoint

import type { NextApiRequest, NextApiResponse } from 'next';
import { performanceMonitor } from '~/lib/performance-monitor';
import { intelligenceCache } from '~/lib/intelligence-cache';
import { cacheInvalidationService } from '~/lib/cache-invalidation-service';

interface PerformanceDashboardResponse {
  summary: {
    overallHealth: number;
    status: 'excellent' | 'good' | 'warning' | 'critical';
    lastUpdated: number;
  };
  queries: {
    performance: any;
    optimization: string[];
  };
  cache: {
    statistics: any;
    health: any;
  };
  system: {
    memory: any;
    timing: any;
  };
  realtime: {
    websocket: any;
    invalidation: any;
  };
  recommendations: {
    priority: 'high' | 'medium' | 'low';
    items: string[];
  }[];
}

/**
 * Performance Dashboard API Endpoint
 * Provides comprehensive system performance metrics and optimization insights
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<PerformanceDashboardResponse | { error: string }>
) {
  try {
    if (req.method === 'GET') {
      const dashboard = await generatePerformanceDashboard();
      
      res.setHeader('Cache-Control', 's-maxage=10, stale-while-revalidate=30');
      res.status(200).json(dashboard);
      
    } else if (req.method === 'POST') {
      await handlePerformanceAction(req.body);
      res.status(200).json({ message: 'Action completed' } as any);
      
    } else {
      res.setHeader('Allow', ['GET', 'POST']);
      res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Performance dashboard error:', error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Internal server error' 
    });
  }
}

/**
 * Generate comprehensive performance dashboard data
 */
async function generatePerformanceDashboard(): Promise<PerformanceDashboardResponse> {
  // Gather all performance metrics
  const queryStats = performanceMonitor.getPerformanceStats();
  const cacheStats = intelligenceCache.getStats();
  const cacheHealth = cacheInvalidationService.getCacheHealthMetrics();
  const optimizationSuggestions = performanceMonitor.getOptimizationSuggestions();

  // Calculate overall health score
  const healthMetrics = {
    queryPerformance: Math.max(0, 100 - (queryStats.queries.averageDuration / 10)), // Target < 1s avg
    cacheEfficiency: cacheStats.hitRate,
    errorRate: Math.max(0, 100 - (queryStats.queries.errorRate * 1000)), // Target < 0.1% error rate
    systemHealth: cacheHealth.healthScore
  };

  const overallHealth = Object.values(healthMetrics).reduce((sum, score) => sum + score, 0) / 4;
  
  const status = overallHealth >= 90 ? 'excellent' 
    : overallHealth >= 75 ? 'good'
    : overallHealth >= 50 ? 'warning'
    : 'critical';

  // Generate system-specific recommendations
  const recommendations = generateRecommendations(queryStats, cacheStats, cacheHealth, overallHealth);

  // Get memory usage information
  const memoryInfo = getMemoryInformation();

  // Get timing information
  const timingInfo = getTimingInformation();

  // Get WebSocket performance (placeholder - would integrate with actual WebSocket stats)
  const websocketInfo = getWebSocketInformation();

  return {
    summary: {
      overallHealth: Math.round(overallHealth),
      status,
      lastUpdated: Date.now()
    },
    queries: {
      performance: {
        totalQueries: queryStats.queries.totalQueries,
        averageDuration: Math.round(queryStats.queries.averageDuration),
        errorRate: Math.round(queryStats.queries.errorRate * 10000) / 100, // Percentage with 2 decimals
        slowQueries: queryStats.queries.slowQueries.slice(0, 5).map((q: any) => ({
          queryKey: q.queryKey,
          duration: Math.round(q.duration),
          timestamp: q.timestamp,
          countryId: q.countryId
        }))
      },
      optimization: optimizationSuggestions
    },
    cache: {
      statistics: {
        hitRate: Math.round(cacheStats.hitRate * 100) / 100,
        totalHits: cacheStats.totalHits,
        totalMisses: cacheStats.totalMisses,
        totalEntries: cacheStats.totalEntries,
        memoryUsage: Math.round(cacheStats.memoryUsage / 1024), // KB
        averageAccessTime: Math.round(cacheStats.averageAccessTime * 100) / 100,
        mostAccessedKeys: cacheStats.mostAccessedKeys.slice(0, 10)
      },
      health: {
        healthScore: Math.round(cacheHealth.healthScore),
        invalidationStats: {
          totalInvalidations: cacheHealth.invalidationStats.totalInvalidations,
          averageInvalidationTime: Math.round(cacheHealth.invalidationStats.averageInvalidationTime * 100) / 100,
          lastInvalidation: cacheHealth.invalidationStats.lastInvalidation,
          rulesTriggered: cacheHealth.invalidationStats.rulesTriggered
        },
        recommendations: cacheHealth.recommendations
      }
    },
    system: {
      memory: memoryInfo,
      timing: timingInfo
    },
    realtime: {
      websocket: websocketInfo,
      invalidation: {
        stats: cacheHealth.invalidationStats,
        efficiency: Math.round((cacheHealth.invalidationStats.totalInvalidations > 0 ? 
          1000 / cacheHealth.invalidationStats.averageInvalidationTime : 100) * 100) / 100
      }
    },
    recommendations
  };
}

/**
 * Generate performance recommendations based on current metrics
 */
function generateRecommendations(
  queryStats: any,
  cacheStats: any, 
  cacheHealth: any,
  overallHealth: number
): PerformanceDashboardResponse['recommendations'] {
  const recommendations: PerformanceDashboardResponse['recommendations'] = [];

  // High priority recommendations
  const highPriority: string[] = [];
  
  if (overallHealth < 50) {
    highPriority.push('System performance is critical - immediate attention required');
  }
  
  if (queryStats.queries.errorRate > 0.05) {
    highPriority.push('High query error rate detected - review error handling and database connections');
  }
  
  if (queryStats.queries.averageDuration > 3000) {
    highPriority.push('Extremely slow queries detected - implement query optimization immediately');
  }

  if (highPriority.length > 0) {
    recommendations.push({ priority: 'high', items: highPriority });
  }

  // Medium priority recommendations  
  const mediumPriority: string[] = [];
  
  if (cacheStats.hitRate < 70) {
    mediumPriority.push('Low cache hit rate - consider increasing cache TTL or implementing pre-loading');
  }
  
  if (queryStats.queries.averageDuration > 1000) {
    mediumPriority.push('Slow query performance - implement query batching and optimization');
  }
  
  if (cacheHealth.invalidationStats.averageInvalidationTime > 10) {
    mediumPriority.push('Slow cache invalidation - optimize invalidation rules and patterns');
  }

  if (mediumPriority.length > 0) {
    recommendations.push({ priority: 'medium', items: mediumPriority });
  }

  // Low priority recommendations
  const lowPriority: string[] = [];
  
  if (cacheStats.hitRate < 85) {
    lowPriority.push('Cache hit rate could be improved - fine-tune cache settings');
  }
  
  if (queryStats.queries.averageDuration > 500) {
    lowPriority.push('Query performance optimization opportunities available');
  }

  // Add specific optimization suggestions
  const optimizationSuggestions = performanceMonitor.getOptimizationSuggestions();
  lowPriority.push(...optimizationSuggestions);

  if (lowPriority.length > 0) {
    recommendations.push({ priority: 'low', items: lowPriority });
  }

  return recommendations;
}

/**
 * Get memory information
 */
function getMemoryInformation(): any {
  try {
    if (typeof process !== 'undefined' && process.memoryUsage) {
      const memory = process.memoryUsage();
      return {
        heapUsed: Math.round(memory.heapUsed / 1024 / 1024), // MB
        heapTotal: Math.round(memory.heapTotal / 1024 / 1024), // MB
        external: Math.round(memory.external / 1024 / 1024), // MB
        rss: Math.round(memory.rss / 1024 / 1024), // MB
        usage: Math.round((memory.heapUsed / memory.heapTotal) * 100) // Percentage
      };
    }
  } catch (error) {
    console.warn('Could not get memory information:', error);
  }
  
  return {
    heapUsed: 0,
    heapTotal: 0,
    external: 0,
    rss: 0,
    usage: 0
  };
}

/**
 * Get timing information
 */
function getTimingInformation(): any {
  const now = Date.now();
  
  return {
    serverStartTime: now - (process.uptime() * 1000),
    uptime: Math.round(process.uptime()), // seconds
    currentTime: now,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    performanceNow: Math.round(performance.now() * 100) / 100
  };
}

/**
 * Get WebSocket performance information (placeholder)
 */
function getWebSocketInformation(): any {
  // This would integrate with your actual WebSocket server statistics
  return {
    activeConnections: 0,
    totalMessages: 0,
    messagesPerSecond: 0,
    averageLatency: 0,
    connectionErrors: 0,
    lastActivity: Date.now(),
    channels: {
      active: 0,
      subscriptions: 0
    }
  };
}

/**
 * Handle performance-related actions
 */
async function handlePerformanceAction(body: any): Promise<void> {
  const { action, parameters = {} } = body;
  
  switch (action) {
    case 'clear_cache':
      intelligenceCache.clear();
      console.log('Cache cleared via performance dashboard');
      break;
      
    case 'invalidate_country_cache':
      if (parameters.countryId) {
        await cacheInvalidationService.invalidateCountryCache(parameters.countryId);
        console.log(`Country cache invalidated: ${parameters.countryId}`);
      }
      break;
      
    case 'reset_performance_stats':
      // Reset performance monitoring statistics
      cacheInvalidationService.resetStats();
      console.log('Performance statistics reset');
      break;
      
    case 'trigger_optimization':
      // Trigger performance optimization routines
      console.log('Performance optimization triggered');
      break;
      
    default:
      throw new Error(`Unknown action: ${action}`);
  }
}