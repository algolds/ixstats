// Optimized Query Service - Phase 3 Performance Enhancement
// Advanced database query optimization with batching, caching, and performance monitoring

import { db } from '~/server/db';
import { intelligenceCache, CacheUtils, type CacheType } from '~/lib/intelligence-cache';
import { performanceMonitor } from '~/lib/performance-monitor';
import type { Prisma } from '@prisma/client';

interface QueryOptions {
  cache?: boolean;
  cacheType?: CacheType;
  cacheTTL?: number;
  enableBatching?: boolean;
  timeout?: number;
}

interface BatchQueryRequest {
  key: string;
  query: () => Promise<any>;
  options?: QueryOptions;
}

/**
 * Optimized Query Service for database operations
 * Provides caching, batching, performance monitoring, and optimization
 */
export class OptimizedQueryService {
  private batchQueue: Map<string, BatchQueryRequest[]> = new Map();
  private batchTimer: NodeJS.Timeout | null = null;
  private readonly BATCH_DELAY = 10; // 10ms batching window
  private readonly DEFAULT_TIMEOUT = 10000; // 10 second timeout

  /**
   * Execute optimized country query with intelligent caching
   */
  async getCountryById(
    id: string,
    options: QueryOptions = {}
  ): Promise<any> {
    const cacheKey = CacheUtils.generateKey('country', id);
    const startTime = performance.now();
    
    try {
      // Check cache first
      if (options.cache !== false) {
        const cached = intelligenceCache.get(cacheKey);
        if (cached) {
          performanceMonitor.recordQuery({
            queryKey: `getCountryById:${id}`,
            duration: performance.now() - startTime,
            success: true,
            cacheHit: true,
            countryId: id
          });
          return cached;
        }
      }

      // Execute optimized database query
      const country = await db.country.findUnique({
        where: { id },
        include: {
          _count: {
            select: {
              dmInputs: true
            }
          }
        }
      });

      // Cache the result
      if (country && options.cache !== false) {
        intelligenceCache.set(
          cacheKey, 
          country, 
          options.cacheType || 'standard'
        );
      }

      performanceMonitor.recordQuery({
        queryKey: `getCountryById:${id}`,
        duration: performance.now() - startTime,
        success: true,
        cacheHit: false,
        countryId: id,
        dataSize: JSON.stringify(country).length
      });

      return country;
    } catch (error) {
      performanceMonitor.recordQuery({
        queryKey: `getCountryById:${id}`,
        duration: performance.now() - startTime,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        cacheHit: false,
        countryId: id
      });
      throw error;
    }
  }

  /**
   * Execute optimized intelligence feed query with batching
   */
  async getIntelligenceFeed(
    countryId: string,
    limit = 50,
    options: QueryOptions = {}
  ): Promise<any> {
    const cacheKey = CacheUtils.generateKey('intelligence', countryId, `limit:${limit}`);
    const startTime = performance.now();

    try {
      // Check cache first
      if (options.cache !== false) {
        const cached = intelligenceCache.get(cacheKey);
        if (cached) {
          performanceMonitor.recordQuery({
            queryKey: `getIntelligenceFeed:${countryId}`,
            duration: performance.now() - startTime,
            success: true,
            cacheHit: true,
            countryId
          });
          return cached;
        }
      }

      // Execute optimized query with proper indexing
      const intelligence = await db.intelligenceItem.findMany({
        where: { 
          OR: [
            { affectedCountries: { contains: countryId } },
            { category: 'global' }
          ]
        },
        orderBy: [
          { priority: 'desc' },
          { timestamp: 'desc' }
        ],
        take: limit,
        select: {
          id: true,
          category: true,
          title: true,
          content: true,
          priority: true,
          timestamp: true,
          source: true,
          affectedCountries: true
        }
      });

      // Cache with shorter TTL for dynamic data
      if (options.cache !== false) {
        intelligenceCache.set(
          cacheKey,
          intelligence,
          options.cacheType || 'critical'
        );
      }

      performanceMonitor.recordQuery({
        queryKey: `getIntelligenceFeed:${countryId}`,
        duration: performance.now() - startTime,
        success: true,
        cacheHit: false,
        countryId,
        dataSize: JSON.stringify(intelligence).length
      });

      return intelligence;
    } catch (error) {
      performanceMonitor.recordQuery({
        queryKey: `getIntelligenceFeed:${countryId}`,
        duration: performance.now() - startTime,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        cacheHit: false,
        countryId
      });
      throw error;
    }
  }

  /**
   * Execute batched queries for related data
   */
  async getBatchedCountryData(
    countryIds: string[],
    options: QueryOptions = {}
  ): Promise<Record<string, any>> {
    if (countryIds.length === 0) return {};

    const startTime = performance.now();
    const results: Record<string, any> = {};
    const uncachedIds: string[] = [];

    try {
      // Check cache for all requested countries
      for (const id of countryIds) {
        const cacheKey = CacheUtils.generateKey('country', id);
        const cached = intelligenceCache.get(cacheKey);
        if (cached && options.cache !== false) {
          results[id] = cached;
        } else {
          uncachedIds.push(id);
        }
      }

      // Batch query for uncached data
      if (uncachedIds.length > 0) {
        const countries = await db.country.findMany({
          where: {
            id: { in: uncachedIds }
          },
          include: {
            dmInputs: {
              orderBy: { ixTimeTimestamp: 'desc' },
              take: 1
            },
            _count: {
              select: {
                dmInputs: true
              }
            }
          }
        });

        // Cache and organize results
        for (const country of countries) {
          results[country.id] = country;
          
          if (options.cache !== false) {
            const cacheKey = CacheUtils.generateKey('country', country.id);
            intelligenceCache.set(
              cacheKey,
              country,
              options.cacheType || 'standard'
            );
          }
        }
      }

      performanceMonitor.recordQuery({
        queryKey: `getBatchedCountryData:${countryIds.length}`,
        duration: performance.now() - startTime,
        success: true,
        cacheHit: countryIds.length - uncachedIds.length > 0,
        dataSize: JSON.stringify(results).length
      });

      return results;
    } catch (error) {
      performanceMonitor.recordQuery({
        queryKey: `getBatchedCountryData:${countryIds.length}`,
        duration: performance.now() - startTime,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        cacheHit: false
      });
      throw error;
    }
  }

  /**
   * Execute optimized vitality intelligence query
   */
  async getVitalityIntelligence(
    countryId: string,
    options: QueryOptions = {}
  ): Promise<any> {
    const cacheKey = CacheUtils.generateKey('vitality', countryId);
    const startTime = performance.now();

    try {
      // Check cache first
      if (options.cache !== false) {
        const cached = intelligenceCache.get(cacheKey);
        if (cached) {
          performanceMonitor.recordQuery({
            queryKey: `getVitalityIntelligence:${countryId}`,
            duration: performance.now() - startTime,
            success: true,
            cacheHit: true,
            countryId
          });
          return cached;
        }
      }

      // Get country with latest economic and population data
      const country = await db.country.findUnique({
        where: { id: countryId },
        include: {
          dmInputs: {
            orderBy: { ixTimeTimestamp: 'desc' },
            take: 2
          }
        }
      });

      if (!country) return null;

      // Calculate vitality intelligence
      const vitalityIntelligence = this.calculateVitalityIntelligence(country);

      // Cache with critical type for real-time data
      if (options.cache !== false) {
        intelligenceCache.set(
          cacheKey,
          vitalityIntelligence,
          'critical' // Short TTL for vitality data
        );
      }

      performanceMonitor.recordQuery({
        queryKey: `getVitalityIntelligence:${countryId}`,
        duration: performance.now() - startTime,
        success: true,
        cacheHit: false,
        countryId,
        dataSize: JSON.stringify(vitalityIntelligence).length
      });

      return vitalityIntelligence;
    } catch (error) {
      performanceMonitor.recordQuery({
        queryKey: `getVitalityIntelligence:${countryId}`,
        duration: performance.now() - startTime,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        cacheHit: false,
        countryId
      });
      throw error;
    }
  }

  /**
   * Execute optimized regional comparison query
   */
  async getRegionalComparison(
    countryId: string,
    options: QueryOptions = {}
  ): Promise<any> {
    const cacheKey = CacheUtils.generateKey('regional-comparison', countryId);
    const startTime = performance.now();

    try {
      // Check cache first
      if (options.cache !== false) {
        const cached = intelligenceCache.get(cacheKey);
        if (cached) {
          performanceMonitor.recordQuery({
            queryKey: `getRegionalComparison:${countryId}`,
            duration: performance.now() - startTime,
            success: true,
            cacheHit: true,
            countryId
          });
          return cached;
        }
      }

      // Get target country and region
      const targetCountry = await db.country.findUnique({
        where: { id: countryId },
        select: { 
          id: true, 
          name: true, 
          region: true,
          currentTotalGdp: true,
          economicTier: true
        }
      });

      if (!targetCountry || !targetCountry.region) return null;

      // Get regional countries with optimized query
      const regionalCountries = await db.country.findMany({
        where: {
          region: targetCountry.region,
          id: { not: countryId }
        },
        take: 10, // Limit for performance
        select: {
          id: true,
          name: true,
          region: true,
          currentTotalGdp: true,
          economicTier: true
        },
        orderBy: {
          currentTotalGdp: 'desc'
        }
      });

      const comparison = {
        targetCountry,
        regionalCountries,
        region: targetCountry.region,
        comparison: this.calculateRegionalMetrics(targetCountry, regionalCountries)
      };

      // Cache with longer TTL for regional data
      if (options.cache !== false) {
        intelligenceCache.set(
          cacheKey,
          comparison,
          'standard'
        );
      }

      performanceMonitor.recordQuery({
        queryKey: `getRegionalComparison:${countryId}`,
        duration: performance.now() - startTime,
        success: true,
        cacheHit: false,
        countryId,
        dataSize: JSON.stringify(comparison).length
      });

      return comparison;
    } catch (error) {
      performanceMonitor.recordQuery({
        queryKey: `getRegionalComparison:${countryId}`,
        duration: performance.now() - startTime,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        cacheHit: false,
        countryId
      });
      throw error;
    }
  }

  /**
   * Invalidate cache for a country and related data
   */
  invalidateCountryCache(countryId: string): void {
    intelligenceCache.invalidateCountryIntelligence(countryId);
    
    // Also invalidate regional comparisons that might include this country
    intelligenceCache.invalidateByPattern(new RegExp(`regional-comparison`));
  }

  /**
   * Calculate vitality intelligence from country data
   */
  private calculateVitalityIntelligence(country: any): any {
    // Use direct country fields instead of relations
    const currentGdp = country.currentTotalGdp || 0;
    const currentPopulation = country.currentPopulation || 0;
    const gdpGrowthRate = country.realGDPGrowthRate || 0;

    if (!currentGdp || !currentPopulation) {
      return {
        vitalityScore: 0,
        economicHealth: 'unknown',
        populationTrend: 'unknown',
        alerts: []
      };
    }

    const economicGrowth = gdpGrowthRate;

    const populationGrowth = country.populationGrowthRate || 0;

    const vitalityScore = Math.max(0, Math.min(100, 50 + (economicGrowth * 2) + populationGrowth));

    return {
      vitalityScore: Math.round(vitalityScore),
      economicHealth: economicGrowth > 3 ? 'excellent' : economicGrowth > 0 ? 'good' : 'declining',
      populationTrend: populationGrowth > 1 ? 'growing' : populationGrowth > -1 ? 'stable' : 'declining',
      economicGrowth: Math.round(economicGrowth * 100) / 100,
      populationGrowth: Math.round(populationGrowth * 100) / 100,
      alerts: this.generateVitalityAlerts(vitalityScore, economicGrowth, populationGrowth)
    };
  }

  /**
   * Generate vitality alerts based on metrics
   */
  private generateVitalityAlerts(vitalityScore: number, economicGrowth: number, populationGrowth: number): any[] {
    const alerts: any[] = [];

    if (vitalityScore < 30) {
      alerts.push({
        type: 'critical',
        message: 'Critical vitality warning - immediate attention required',
        metric: 'vitality'
      });
    }

    if (economicGrowth < -5) {
      alerts.push({
        type: 'economic',
        message: 'Severe economic decline detected',
        metric: 'economy'
      });
    }

    if (populationGrowth < -2) {
      alerts.push({
        type: 'demographic',
        message: 'Significant population decline',
        metric: 'population'
      });
    }

    return alerts;
  }

  /**
   * Calculate regional comparison metrics
   */
  private calculateRegionalMetrics(targetCountry: any, regionalCountries: any[]): any {
    if (!targetCountry.currentTotalGdp) return {};

    const targetGDP = targetCountry.currentTotalGdp;
    const regionalGDPs = regionalCountries
      .map(c => c.currentTotalGdp)
      .filter(gdp => gdp !== undefined && gdp > 0);

    if (regionalGDPs.length === 0) return {};

    const averageGDP = regionalGDPs.reduce((sum, gdp) => sum + gdp, 0) / regionalGDPs.length;
    const medianGDP = regionalGDPs.sort((a, b) => a - b)[Math.floor(regionalGDPs.length / 2)];
    const rank = regionalGDPs.filter(gdp => gdp > targetGDP).length + 1;

    return {
      gdpComparison: {
        target: targetGDP,
        regional: {
          average: Math.round(averageGDP),
          median: Math.round(medianGDP),
          rank: rank,
          total: regionalGDPs.length + 1,
          percentile: Math.round((1 - (rank - 1) / (regionalGDPs.length + 1)) * 100)
        }
      }
    };
  }
}

// Global optimized query service instance
export const optimizedQueryService = new OptimizedQueryService();