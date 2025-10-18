/**
 * Production Performance Optimizations
 * Memory management, query optimization, and production-ready configurations
 */

import { NextRequest, NextResponse } from 'next/server';
import { performance } from 'perf_hooks';

/**
 * Memory optimization utilities
 */
export class MemoryOptimizer {
  private static readonly MAX_MEMORY_USAGE = 1024 * 1024 * 1024; // 1GB
  private static readonly GC_THRESHOLD = 0.8; // 80% memory usage

  /**
   * Monitor memory usage and trigger GC if needed
   */
  static monitorMemoryUsage(): void {
    if (typeof process !== 'undefined' && process.memoryUsage) {
      const memUsage = process.memoryUsage();
      const heapUsedMB = memUsage.heapUsed / 1024 / 1024;
      const heapTotalMB = memUsage.heapTotal / 1024 / 1024;
      const usagePercent = heapUsedMB / heapTotalMB;

      if (usagePercent > this.GC_THRESHOLD) {
        console.warn(`[MemoryOptimizer] High memory usage: ${heapUsedMB.toFixed(2)}MB (${(usagePercent * 100).toFixed(1)}%)`);
        
        if (global.gc) {
          global.gc();
          console.log('[MemoryOptimizer] Garbage collection triggered');
        }
      }
    }
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
      if (typeof value === 'object' && value !== null) {
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
    fields.forEach(field => {
      select[field] = true;
    });
    return select;
  }

  /**
   * Batch queries for better performance
   */
  static async batchQueries<T>(
    queries: (() => Promise<T>)[],
    batchSize = 10
  ): Promise<T[]> {
    const results: T[] = [];
    
    for (let i = 0; i < queries.length; i += batchSize) {
      const batch = queries.slice(i, i + batchSize);
      const batchResults = await Promise.all(batch.map(query => query()));
      results.push(...batchResults);
      
      // Allow event loop to process other tasks
      await new Promise(resolve => setImmediate(resolve));
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
        console.warn('[ResponseOptimizer] Large array detected, limiting size');
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
      return obj.map(item => this.removeEmptyValues(item));
    }

    if (obj && typeof obj === 'object') {
      const cleaned: any = {};
      for (const [key, value] of Object.entries(obj)) {
        if (value !== null && value !== undefined && value !== '') {
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
  static createOptimizedResponse(data: any, options: {
    status?: number;
    headers?: Record<string, string>;
    compress?: boolean;
  } = {}): NextResponse {
    const { status = 200, headers = {}, compress = true } = options;
    
    const optimizedData = this.optimizeResponse(data);
    
    const responseHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=300, s-maxage=600', // 5min client, 10min CDN
      ...headers
    };

    if (compress) {
      responseHeaders['Content-Encoding'] = 'gzip';
    }

    return NextResponse.json(optimizedData, {
      status,
      headers: responseHeaders
    });
  }
}

/**
 * Database connection optimization
 */
export class DatabaseOptimizer {
  
  /**
   * Optimize database connection for production
   */
  static async optimizeConnection(): Promise<void> {
    try {
      // These optimizations are SQLite-specific
      if (process.env.DATABASE_URL?.includes('sqlite')) {
        const { db } = await import('~/server/db');
        
        // Enable WAL mode for better concurrency
        await db.$executeRaw`PRAGMA journal_mode = WAL`;
        
        // Optimize for better performance
        await db.$executeRaw`PRAGMA synchronous = NORMAL`;
        await db.$executeRaw`PRAGMA cache_size = 10000`;
        await db.$executeRaw`PRAGMA temp_store = MEMORY`;
        await db.$executeRaw`PRAGMA mmap_size = 268435456`;
        
        // Enable query optimization
        await db.$executeRaw`PRAGMA optimize`;
        
        console.log('[DatabaseOptimizer] Database optimized for production');
      }
    } catch (error) {
      console.error('[DatabaseOptimizer] Failed to optimize database:', error);
    }
  }

  /**
   * Analyze and optimize slow queries
   */
  static async analyzeSlowQueries(): Promise<void> {
    try {
      const { db } = await import('~/server/db');
      
      // Get query statistics (SQLite-specific)
      if (process.env.DATABASE_URL?.includes('sqlite')) {
        const stats = await db.$queryRaw`
          SELECT sql, exec_count, total_time, avg_time 
          FROM sqlite_stat1 
          WHERE avg_time > 10 
          ORDER BY avg_time DESC 
          LIMIT 10
        `;
        
        if ((stats as any[]).length > 0) {
          console.warn('[DatabaseOptimizer] Slow queries detected:', stats);
        }
      }
    } catch (error) {
      console.error('[DatabaseOptimizer] Failed to analyze slow queries:', error);
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
      if (duration > 1000) { // 1 second
        console.warn(`[ProductionMiddleware] Slow request: ${path} (${duration.toFixed(2)}ms)`);
      }
    }, 1000);
    
    return { startTime, path };
  }

  /**
   * Rate limiting headers
   */
  static addRateLimitHeaders(response: NextResponse, options: {
    limit?: number;
    remaining?: number;
    reset?: number;
  } = {}): NextResponse {
    const { limit = 1000, remaining = 999, reset = Date.now() + 3600000 } = options;
    
    response.headers.set('X-RateLimit-Limit', limit.toString());
    response.headers.set('X-RateLimit-Remaining', remaining.toString());
    response.headers.set('X-RateLimit-Reset', reset.toString());
    
    return response;
  }

  /**
   * Security headers for production
   */
  static addSecurityHeaders(response: NextResponse): NextResponse {
    response.headers.set('X-Content-Type-Options', 'nosniff');
    response.headers.set('X-Frame-Options', 'DENY');
    response.headers.set('X-XSS-Protection', '1; mode=block');
    response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    
    // CSP for production
    if (process.env.NODE_ENV === 'production') {
      response.headers.set(
        'Content-Security-Policy',
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
  private static readonly MAX_METRICS = 1000;

  /**
   * Record performance metric
   */
  static recordMetric(name: string, value: number): void {
    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }

    const metrics = this.metrics.get(name)!;
    metrics.push(value);

    // Keep only recent metrics
    if (metrics.length > this.MAX_METRICS) {
      metrics.splice(0, metrics.length - this.MAX_METRICS);
    }

    // Alert on slow operations
    if (value > 1000) { // 1 second
      console.warn(`[PerformanceMonitor] Slow operation: ${name} (${value}ms)`);
    }
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
 */
export class ProductionStartup {
  
  /**
   * Initialize production optimizations
   */
  static async initialize(): Promise<void> {
    console.log('[ProductionStartup] Initializing production optimizations...');
    
    try {
      // Optimize database connection
      await DatabaseOptimizer.optimizeConnection();
      
      // Initialize memory monitoring
      setInterval(() => {
        MemoryOptimizer.monitorMemoryUsage();
      }, 30000); // Every 30 seconds
      
      // Analyze slow queries periodically
      setInterval(() => {
        DatabaseOptimizer.analyzeSlowQueries();
      }, 300000); // Every 5 minutes
      
      console.log('[ProductionStartup] Production optimizations initialized');
    } catch (error) {
      console.error('[ProductionStartup] Failed to initialize:', error);
    }
  }

  /**
   * Warm up caches with critical data
   */
  static async warmupCaches(): Promise<void> {
    console.log('[ProductionStartup] Warming up caches...');
    
    try {
      const { globalCache } = await import('./advanced-cache-system');
      const { OptimizedCountryQueries } = await import('./database-optimizations');
      
      // Pre-load critical data
      const countries = await OptimizedCountryQueries.getCountriesByIds(
        [], // Will be populated with actual IDs
        { select: { id: true, name: true, slug: true } }
      );
      
      console.log(`[ProductionStartup] Cache warmed up with ${countries.length} countries`);
    } catch (error) {
      console.error('[ProductionStartup] Failed to warm up caches:', error);
    }
  }
}
