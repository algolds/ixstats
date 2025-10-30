// Cache Invalidation Service - Phase 3 Performance Enhancement
// Intelligent cache invalidation integrated with WebSocket real-time updates

import { intelligenceCache } from "~/lib/intelligence-cache";
import { optimizedQueryService } from "~/server/services/optimized-query-service";
import type { IntelligenceUpdate } from "~/lib/websocket/types";

// Use any type to avoid importing socket.io during build
type IntelligenceWebSocketServer = any;

interface InvalidationRule {
  pattern: RegExp | string;
  trigger: "intelligence" | "economic" | "population" | "country" | "global";
  scope: "country" | "regional" | "global";
  delay?: number; // Delay in ms before invalidation
}

interface InvalidationEvent {
  type: "intelligence" | "economic" | "population" | "country" | "global";
  countryId?: string;
  region?: string;
  data?: any;
  timestamp: number;
}

interface CacheInvalidationStats {
  totalInvalidations: number;
  invalidationsByType: Record<string, number>;
  averageInvalidationTime: number;
  lastInvalidation: number;
  rulesTriggered: number;
}

/**
 * Advanced Cache Invalidation Service
 * Provides intelligent cache invalidation based on real-time data updates
 */
export class CacheInvalidationService {
  private rules: InvalidationRule[] = [];
  private stats: CacheInvalidationStats = {
    totalInvalidations: 0,
    invalidationsByType: {},
    averageInvalidationTime: 0,
    lastInvalidation: 0,
    rulesTriggered: 0,
  };
  private invalidationTimes: number[] = [];
  private webSocketServer?: IntelligenceWebSocketServer;

  constructor() {
    this.initializeDefaultRules();
  }

  /**
   * Set WebSocket server for integration
   */
  setWebSocketServer(server: IntelligenceWebSocketServer): void {
    this.webSocketServer = server;
  }

  /**
   * Process intelligence update and trigger cache invalidation
   */
  async processIntelligenceUpdate(update: IntelligenceUpdate): Promise<void> {
    const event: InvalidationEvent = {
      type: "intelligence",
      countryId: update.countryId,
      data: update,
      timestamp: Date.now(),
    };

    await this.processInvalidationEvent(event);
  }

  /**
   * Process economic data update
   */
  async processEconomicUpdate(countryId: string, economicData: any): Promise<void> {
    const event: InvalidationEvent = {
      type: "economic",
      countryId,
      data: economicData,
      timestamp: Date.now(),
    };

    await this.processInvalidationEvent(event);
  }

  /**
   * Process population data update
   */
  async processPopulationUpdate(countryId: string, populationData: any): Promise<void> {
    const event: InvalidationEvent = {
      type: "population",
      countryId,
      data: populationData,
      timestamp: Date.now(),
    };

    await this.processInvalidationEvent(event);
  }

  /**
   * Process country data update
   */
  async processCountryUpdate(countryId: string, countryData: any): Promise<void> {
    const event: InvalidationEvent = {
      type: "country",
      countryId,
      data: countryData,
      timestamp: Date.now(),
    };

    await this.processInvalidationEvent(event);
  }

  /**
   * Process global system update
   */
  async processGlobalUpdate(updateData: any): Promise<void> {
    const event: InvalidationEvent = {
      type: "global",
      data: updateData,
      timestamp: Date.now(),
    };

    await this.processInvalidationEvent(event);
  }

  /**
   * Add custom invalidation rule
   */
  addInvalidationRule(rule: InvalidationRule): void {
    this.rules.push(rule);
  }

  /**
   * Remove invalidation rule by pattern
   */
  removeInvalidationRule(pattern: string | RegExp): boolean {
    const initialLength = this.rules.length;
    this.rules = this.rules.filter(
      (rule) =>
        rule.pattern !== pattern &&
        (typeof pattern === "string"
          ? rule.pattern.toString() !== pattern
          : rule.pattern !== pattern)
    );
    return this.rules.length < initialLength;
  }

  /**
   * Get invalidation statistics
   */
  getStats(): CacheInvalidationStats {
    const avgTime =
      this.invalidationTimes.length > 0
        ? this.invalidationTimes.reduce((sum, time) => sum + time, 0) /
          this.invalidationTimes.length
        : 0;

    return {
      ...this.stats,
      averageInvalidationTime: avgTime,
    };
  }

  /**
   * Manually invalidate cache by pattern
   */
  async invalidateByPattern(pattern: string | RegExp): Promise<number> {
    const startTime = performance.now();
    const regex = typeof pattern === "string" ? new RegExp(pattern) : pattern;

    const deletedCount = intelligenceCache.invalidateByPattern(regex);

    this.recordInvalidation("manual", performance.now() - startTime);

    return deletedCount;
  }

  /**
   * Manually invalidate all country-related cache
   */
  async invalidateCountryCache(countryId: string): Promise<number> {
    const startTime = performance.now();

    // Invalidate in intelligence cache
    const deletedCount = intelligenceCache.invalidateCountryIntelligence(countryId);

    // Invalidate in optimized query service
    optimizedQueryService.invalidateCountryCache(countryId);

    this.recordInvalidation("country", performance.now() - startTime);

    return deletedCount;
  }

  /**
   * Process invalidation event through rules engine
   */
  private async processInvalidationEvent(event: InvalidationEvent): Promise<void> {
    const startTime = performance.now();
    let totalInvalidations = 0;

    for (const rule of this.rules) {
      if (this.shouldTriggerRule(rule, event)) {
        const invalidated = await this.executeInvalidationRule(rule, event);
        totalInvalidations += invalidated;
        this.stats.rulesTriggered++;
      }
    }

    if (totalInvalidations > 0) {
      this.recordInvalidation(event.type, performance.now() - startTime);

      // Notify WebSocket clients of cache invalidation if applicable
      if (this.webSocketServer && event.countryId) {
        this.webSocketServer.broadcastIntelligenceUpdate({
          id: `cache-inv-${Date.now()}`,
          type: "cache-invalidation",
          title: "Cache Invalidated",
          countryId: event.countryId,
          category: "system",
          priority: "low",
          severity: "info",
          isGlobal: false,
          timestamp: event.timestamp,
          data: { invalidatedEntries: totalInvalidations },
        });
      }
    }
  }

  /**
   * Check if a rule should be triggered by an event
   */
  private shouldTriggerRule(rule: InvalidationRule, event: InvalidationEvent): boolean {
    if (rule.trigger !== event.type) {
      return false;
    }

    // Additional scope-based filtering could be added here
    if (rule.scope === "country" && !event.countryId) {
      return false;
    }

    return true;
  }

  /**
   * Execute an invalidation rule
   */
  private async executeInvalidationRule(
    rule: InvalidationRule,
    event: InvalidationEvent
  ): Promise<number> {
    // Apply delay if specified
    if (rule.delay && rule.delay > 0) {
      await new Promise((resolve) => setTimeout(resolve, rule.delay));
    }

    let deletedCount = 0;

    if (typeof rule.pattern === "string") {
      // String pattern - invalidate specific keys
      if (event.countryId) {
        const key = rule.pattern.replace("{countryId}", event.countryId);
        if (intelligenceCache.has(key)) {
          intelligenceCache.invalidateByPattern(new RegExp(key));
          deletedCount = 1;
        }
      }
    } else {
      // RegExp pattern - use pattern matching
      deletedCount = intelligenceCache.invalidateByPattern(rule.pattern);
    }

    // Handle scope-based invalidation
    switch (rule.scope) {
      case "country":
        if (event.countryId) {
          deletedCount += intelligenceCache.invalidateCountryIntelligence(event.countryId);
        }
        break;

      case "regional":
        if (event.countryId) {
          // Invalidate regional comparisons
          deletedCount += intelligenceCache.invalidateByPattern(/regional-comparison/);
        }
        break;

      case "global":
        // Invalidate global intelligence cache
        deletedCount += intelligenceCache.invalidateByType("standard");
        break;
    }

    return deletedCount;
  }

  /**
   * Initialize default invalidation rules
   */
  private initializeDefaultRules(): void {
    // Intelligence update rules
    this.addInvalidationRule({
      pattern: /^intelligence:/,
      trigger: "intelligence",
      scope: "country",
    });

    // Economic data update rules
    this.addInvalidationRule({
      pattern: /^(country|vitality|regional-comparison):/,
      trigger: "economic",
      scope: "regional",
      delay: 1000, // 1 second delay to batch related updates
    });

    // Population data update rules
    this.addInvalidationRule({
      pattern: /^(country|vitality):/,
      trigger: "population",
      scope: "country",
      delay: 1000,
    });

    // Country data update rules
    this.addInvalidationRule({
      pattern: /^country:/,
      trigger: "country",
      scope: "country",
    });

    // Global update rules
    this.addInvalidationRule({
      pattern: /.*/,
      trigger: "global",
      scope: "global",
      delay: 5000, // 5 second delay for global updates
    });

    // Critical intelligence rules (immediate invalidation)
    this.addInvalidationRule({
      pattern: /^(intelligence|vitality):/,
      trigger: "intelligence",
      scope: "country",
      delay: 0, // No delay for critical updates
    });
  }

  /**
   * Record invalidation statistics
   */
  private recordInvalidation(type: string, duration: number): void {
    this.stats.totalInvalidations++;
    this.stats.invalidationsByType[type] = (this.stats.invalidationsByType[type] || 0) + 1;
    this.stats.lastInvalidation = Date.now();

    this.invalidationTimes.push(duration);

    // Keep only last 100 timing measurements
    if (this.invalidationTimes.length > 100) {
      this.invalidationTimes = this.invalidationTimes.slice(-50);
    }
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = {
      totalInvalidations: 0,
      invalidationsByType: {},
      averageInvalidationTime: 0,
      lastInvalidation: 0,
      rulesTriggered: 0,
    };
    this.invalidationTimes = [];
  }

  /**
   * Get cache health metrics
   */
  getCacheHealthMetrics(): {
    cacheStats: any;
    invalidationStats: CacheInvalidationStats;
    healthScore: number;
    recommendations: string[];
  } {
    const cacheStats = intelligenceCache.getStats();
    const invalidationStats = this.getStats();

    // Calculate health score based on hit rate and invalidation efficiency
    let healthScore = 0;
    healthScore += cacheStats.hitRate * 0.6; // 60% weight on hit rate
    healthScore += Math.min(
      100,
      (1000 / Math.max(1, invalidationStats.averageInvalidationTime)) * 10
    ); // 40% weight on invalidation speed

    const recommendations: string[] = [];

    if (cacheStats.hitRate < 50) {
      recommendations.push("Low cache hit rate - consider adjusting cache TTL settings");
    }

    if (invalidationStats.averageInvalidationTime > 10) {
      recommendations.push("High invalidation time - optimize invalidation rules");
    }

    if (invalidationStats.totalInvalidations > cacheStats.totalHits) {
      recommendations.push("High invalidation rate - review invalidation triggers");
    }

    return {
      cacheStats,
      invalidationStats,
      healthScore,
      recommendations,
    };
  }
}

// Global cache invalidation service instance - lazy initialization to avoid build-time instantiation
let _cacheInvalidationServiceInstance: CacheInvalidationService | undefined;

export function getCacheInvalidationService(): CacheInvalidationService {
  if (!_cacheInvalidationServiceInstance) {
    _cacheInvalidationServiceInstance = new CacheInvalidationService();
  }
  return _cacheInvalidationServiceInstance;
}

// Backward compatibility - export as const but lazy load
export const cacheInvalidationService = new Proxy({} as CacheInvalidationService, {
  get(target, prop) {
    return getCacheInvalidationService()[prop as keyof CacheInvalidationService];
  },
});

/**
 * Integration utilities for connecting with existing systems
 */
export const CacheInvalidationUtils = {
  /**
   * Integration with WebSocket broadcast service
   */
  integrateWithWebSocket: (webSocketServer: IntelligenceWebSocketServer): void => {
    cacheInvalidationService.setWebSocketServer(webSocketServer);

    // Set up automatic invalidation on WebSocket broadcasts
    const originalBroadcast = webSocketServer.broadcastIntelligenceUpdate;
    webSocketServer.broadcastIntelligenceUpdate = function (update: IntelligenceUpdate) {
      // Trigger cache invalidation
      cacheInvalidationService.processIntelligenceUpdate(update).catch(console.error);

      // Call original broadcast method
      return originalBroadcast.call(this, update);
    };
  },

  /**
   * Integration with database change detection
   */
  setupDatabaseTriggers: (): void => {
    // This would set up database triggers or event listeners
    // Implementation depends on your database system (PostgreSQL triggers, etc.)
    console.log("Setting up database change triggers for cache invalidation");
  },

  /**
   * Create invalidation rule for specific data patterns
   */
  createDataPatternRule: (
    dataType: string,
    pattern: string,
    scope: "country" | "regional" | "global" = "country"
  ): void => {
    cacheInvalidationService.addInvalidationRule({
      pattern: new RegExp(pattern),
      trigger: dataType as "intelligence" | "economic" | "population" | "country" | "global",
      scope,
      delay: dataType === "intelligence" ? 0 : 1000,
    });
  },
};
