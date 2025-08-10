// Intelligent Cache System - Phase 3 Performance Enhancement
// Advanced caching with TTL, invalidation, and performance optimization

import { IxTime } from '~/lib/ixtime';

export type CacheType = 'critical' | 'standard' | 'historical' | 'static';

interface CacheEntry {
  data: any;
  timestamp: number;
  ttl: number;
  accessCount: number;
  lastAccessed: number;
  type: CacheType;
  key: string;
}

interface CacheStats {
  hitRate: number;
  totalHits: number;
  totalMisses: number;
  totalEntries: number;
  memoryUsage: number;
  averageAccessTime: number;
  mostAccessedKeys: string[];
}

interface CacheConfig {
  maxSize: number;
  cleanupInterval: number;
  enableStats: boolean;
  enableCompression: boolean;
}

/**
 * Advanced Intelligence Cache System
 * Provides intelligent caching with dynamic TTL, automatic cleanup, and performance monitoring
 */
export class IntelligenceCache {
  private cache = new Map<string, CacheEntry>();
  private stats = {
    hits: 0,
    misses: 0,
    accessTimes: [] as number[],
    startTime: Date.now()
  };
  
  private config: CacheConfig = {
    maxSize: 1000,
    cleanupInterval: 60000, // 1 minute
    enableStats: true,
    enableCompression: false
  };

  private cleanupTimer?: NodeJS.Timeout;

  constructor(config?: Partial<CacheConfig>) {
    this.config = { ...this.config, ...config };
    this.startCleanupTimer();
  }

  /**
   * Set cache entry with intelligent TTL based on data type
   */
  set(key: string, data: any, type: CacheType = 'standard'): void {
    const ttl = this.getTTLForType(type);
    const now = Date.now();
    
    // Remove oldest entries if cache is full
    if (this.cache.size >= this.config.maxSize) {
      this.evictLeastRecentlyUsed();
    }

    const entry: CacheEntry = {
      data: this.config.enableCompression ? this.compress(data) : data,
      timestamp: now,
      ttl,
      accessCount: 0,
      lastAccessed: now,
      type,
      key
    };

    this.cache.set(key, entry);
  }

  /**
   * Get cache entry with automatic expiration checking
   */
  get(key: string): any | null {
    const startTime = performance.now();
    const entry = this.cache.get(key);
    
    if (!entry) {
      this.recordMiss();
      return null;
    }

    const now = Date.now();
    
    // Check if entry has expired
    if (now - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      this.recordMiss();
      return null;
    }

    // Update access statistics
    entry.accessCount++;
    entry.lastAccessed = now;
    
    this.recordHit(startTime);
    
    return this.config.enableCompression ? this.decompress(entry.data) : entry.data;
  }

  /**
   * Check if cache has a valid entry for the key
   */
  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;
    
    const now = Date.now();
    if (now - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return false;
    }
    
    return true;
  }

  /**
   * Invalidate all cache entries for a specific country
   */
  invalidateCountryIntelligence(countryId: string): number {
    let deletedCount = 0;
    const keysToDelete: string[] = [];
    
    for (const [key] of this.cache) {
      if (key.includes(countryId) || key.includes(`country:${countryId}`)) {
        keysToDelete.push(key);
      }
    }
    
    keysToDelete.forEach(key => {
      this.cache.delete(key);
      deletedCount++;
    });
    
    return deletedCount;
  }

  /**
   * Invalidate cache entries by pattern
   */
  invalidateByPattern(pattern: RegExp): number {
    let deletedCount = 0;
    const keysToDelete: string[] = [];
    
    for (const [key] of this.cache) {
      if (pattern.test(key)) {
        keysToDelete.push(key);
      }
    }
    
    keysToDelete.forEach(key => {
      this.cache.delete(key);
      deletedCount++;
    });
    
    return deletedCount;
  }

  /**
   * Invalidate cache entries by type
   */
  invalidateByType(type: CacheType): number {
    let deletedCount = 0;
    const keysToDelete: string[] = [];
    
    for (const [key, entry] of this.cache) {
      if (entry.type === type) {
        keysToDelete.push(key);
      }
    }
    
    keysToDelete.forEach(key => {
      this.cache.delete(key);
      deletedCount++;
    });
    
    return deletedCount;
  }

  /**
   * Update cache entry if it exists
   */
  update(key: string, data: any): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;
    
    entry.data = this.config.enableCompression ? this.compress(data) : data;
    entry.timestamp = Date.now();
    entry.accessCount++;
    entry.lastAccessed = Date.now();
    
    return true;
  }

  /**
   * Get comprehensive cache statistics
   */
  getStats(): CacheStats {
    const totalRequests = this.stats.hits + this.stats.misses;
    const hitRate = totalRequests > 0 ? (this.stats.hits / totalRequests) * 100 : 0;
    
    const sortedEntries = Array.from(this.cache.values())
      .sort((a, b) => b.accessCount - a.accessCount);
    
    const averageAccessTime = this.stats.accessTimes.length > 0
      ? this.stats.accessTimes.reduce((sum, time) => sum + time, 0) / this.stats.accessTimes.length
      : 0;

    return {
      hitRate,
      totalHits: this.stats.hits,
      totalMisses: this.stats.misses,
      totalEntries: this.cache.size,
      memoryUsage: this.estimateMemoryUsage(),
      averageAccessTime,
      mostAccessedKeys: sortedEntries.slice(0, 10).map(entry => entry.key)
    };
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear();
    this.resetStats();
  }

  /**
   * Get cache entries that are about to expire
   */
  getExpiringEntries(withinMs: number = 30000): CacheEntry[] {
    const now = Date.now();
    const expiring: CacheEntry[] = [];
    
    for (const entry of this.cache.values()) {
      const timeUntilExpiry = entry.ttl - (now - entry.timestamp);
      if (timeUntilExpiry <= withinMs && timeUntilExpiry > 0) {
        expiring.push(entry);
      }
    }
    
    return expiring;
  }

  /**
   * Preload cache with intelligence data
   */
  async preload(countryIds: string[]): Promise<void> {
    const preloadPromises = countryIds.map(async (countryId) => {
      // This would integrate with your API to preload common data patterns
      // Implementation depends on your specific API structure
      const cacheKeys = [
        `country:${countryId}`,
        `intelligence:${countryId}`,
        `vitality:${countryId}`
      ];
      
      // Mark as preloaded with longer TTL
      cacheKeys.forEach(key => {
        if (!this.has(key)) {
          this.set(key, null, 'standard'); // Placeholder for preloading
        }
      });
    });
    
    await Promise.all(preloadPromises);
  }

  /**
   * Destroy cache and cleanup resources
   */
  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
    this.clear();
  }

  /**
   * Get TTL based on cache type
   */
  private getTTLForType(type: CacheType): number {
    const baseTime = 1000; // 1 second
    
    switch (type) {
      case 'critical':
        return baseTime * 10; // 10 seconds
      case 'standard':
        return baseTime * 30; // 30 seconds  
      case 'historical':
        return baseTime * 300; // 5 minutes
      case 'static':
        return baseTime * 3600; // 1 hour
      default:
        return baseTime * 30;
    }
  }

  /**
   * Evict least recently used entries when cache is full
   */
  private evictLeastRecentlyUsed(): void {
    let oldestEntry: CacheEntry | null = null;
    let oldestKey = '';
    
    for (const [key, entry] of this.cache) {
      if (!oldestEntry || entry.lastAccessed < oldestEntry.lastAccessed) {
        oldestEntry = entry;
        oldestKey = key;
      }
    }
    
    if (oldestKey) {
      this.cache.delete(oldestKey);
    }
  }

  /**
   * Start automatic cleanup timer
   */
  private startCleanupTimer(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, this.config.cleanupInterval);
  }

  /**
   * Remove expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];
    
    for (const [key, entry] of this.cache) {
      if (now - entry.timestamp > entry.ttl) {
        keysToDelete.push(key);
      }
    }
    
    keysToDelete.forEach(key => this.cache.delete(key));
  }

  /**
   * Record cache hit
   */
  private recordHit(startTime: number): void {
    if (this.config.enableStats) {
      this.stats.hits++;
      this.stats.accessTimes.push(performance.now() - startTime);
      
      // Keep access times array manageable
      if (this.stats.accessTimes.length > 1000) {
        this.stats.accessTimes = this.stats.accessTimes.slice(-500);
      }
    }
  }

  /**
   * Record cache miss
   */
  private recordMiss(): void {
    if (this.config.enableStats) {
      this.stats.misses++;
    }
  }

  /**
   * Reset statistics
   */
  private resetStats(): void {
    this.stats = {
      hits: 0,
      misses: 0,
      accessTimes: [],
      startTime: Date.now()
    };
  }

  /**
   * Estimate memory usage (simplified)
   */
  private estimateMemoryUsage(): number {
    let totalSize = 0;
    for (const entry of this.cache.values()) {
      // Rough estimation - in a real implementation you'd use more accurate measurement
      totalSize += JSON.stringify(entry.data).length * 2; // UTF-16 encoding
    }
    return totalSize;
  }

  /**
   * Simple compression (placeholder - use actual compression library in production)
   */
  private compress(data: any): any {
    // In production, use a compression library like lz-string
    return data;
  }

  /**
   * Simple decompression (placeholder)
   */
  private decompress(data: any): any {
    // In production, decompress using the same library
    return data;
  }
}

// Global cache instance
export const intelligenceCache = new IntelligenceCache({
  maxSize: 2000,
  enableStats: true,
  enableCompression: false
});

/**
 * Cache utilities for common intelligence patterns
 */
export const CacheUtils = {
  /**
   * Generate consistent cache keys
   */
  generateKey: (type: string, id: string, suffix?: string): string => {
    return suffix ? `${type}:${id}:${suffix}` : `${type}:${id}`;
  },

  /**
   * Cache with automatic invalidation on WebSocket updates
   */
  setWithInvalidation: (key: string, data: any, type: CacheType, countryId?: string): void => {
    intelligenceCache.set(key, data, type);
    
    // Set up automatic invalidation for real-time data
    if (countryId && (type === 'critical' || type === 'standard')) {
      // This would integrate with your WebSocket system to invalidate when updates arrive
      // Implementation depends on your WebSocket infrastructure
    }
  },

  /**
   * Batch cache operations
   */
  setBatch: (entries: Array<{ key: string; data: any; type: CacheType }>): void => {
    entries.forEach(({ key, data, type }) => {
      intelligenceCache.set(key, data, type);
    });
  },

  /**
   * Get with fallback and automatic caching
   */
  getWithFallback: async <T>(
    key: string,
    fallbackFn: () => Promise<T>,
    type: CacheType = 'standard'
  ): Promise<T> => {
    const cached = intelligenceCache.get(key);
    if (cached !== null) {
      return cached;
    }
    
    const fresh = await fallbackFn();
    intelligenceCache.set(key, fresh, type);
    return fresh;
  }
};