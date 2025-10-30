/**
 * Optimized Countries Router
 * Production-ready with caching, performance monitoring, and optimized queries
 */

import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { OptimizedCountryQueries, queryMonitor } from "~/lib/database-optimizations";
import { CacheDecorators, CacheUtils, globalCache } from "~/lib/advanced-cache-system";
import {
  ResponseOptimizer,
  MemoryOptimizer,
  PerformanceMonitor,
} from "~/lib/production-optimizations";

export const optimizedCountriesRouter = createTRPCRouter({
  /**
   * Get all countries with optimized pagination and caching
   */
  getAll: publicProcedure
    .input(
      z
        .object({
          limit: z.number().min(1).max(100).default(50),
          offset: z.number().min(0).default(0),
          continent: z.string().optional(),
          region: z.string().optional(),
          economicTier: z.string().optional(),
          populationTier: z.string().optional(),
        })
        .optional()
    )
    .query(async ({ input = {} }) => {
      const startTime = performance.now();

      try {
        const { limit = 50, offset = 0, continent, region, economicTier, populationTier } = input;

        // Generate cache key
        const cacheKey = CacheUtils.generateKey(
          "countries",
          "all",
          JSON.stringify({ limit, offset, continent, region, economicTier, populationTier })
        );

        // Try cache first
        const cached = await globalCache.get(cacheKey);
        if (cached) {
          PerformanceMonitor.recordMetric(
            "countries.getAll.cache_hit",
            performance.now() - startTime
          );
          return cached;
        }

        // Build optimized query
        const whereClause: any = {};
        if (continent) whereClause.continent = continent;
        if (region) whereClause.region = region;
        if (economicTier) whereClause.economicTier = economicTier;
        if (populationTier) whereClause.populationTier = populationTier;

        // Get countries with optimized select clause
        const countries = await OptimizedCountryQueries.getCountriesByRegion(
          continent,
          region,
          limit,
          offset,
          {
            select: {
              id: true,
              name: true,
              slug: true,
              continent: true,
              region: true,
              economicTier: true,
              populationTier: true,
              currentPopulation: true,
              currentTotalGdp: true,
              flag: true,
              governmentType: true,
              leader: true,
            },
          }
        );

        // Optimize response data
        const optimizedCountries = countries.countries.map((country: any) =>
          MemoryOptimizer.optimizeObject(country, [
            "id",
            "name",
            "slug",
            "continent",
            "region",
            "economicTier",
            "populationTier",
            "currentPopulation",
            "currentTotalGdp",
            "flag",
            "governmentType",
            "leader",
          ])
        );

        const result = {
          countries: optimizedCountries,
          total: countries.total,
          pagination: {
            limit,
            offset,
            hasMore: offset + limit < countries.total,
          },
        };

        // Cache for 5 minutes
        await globalCache.set(cacheKey, result, {
          ttl: 300,
          tier: "standard",
        });

        PerformanceMonitor.recordMetric("countries.getAll.database", performance.now() - startTime);
        return result;
      } catch (error) {
        PerformanceMonitor.recordMetric("countries.getAll.error", performance.now() - startTime);
        console.error("[OptimizedCountries] getAll error:", error);
        throw new Error("Failed to fetch countries");
      }
    }),

  /**
   * Get single country with optimized includes
   */
  getById: publicProcedure
    .input(
      z.object({
        id: z.string(),
        include: z
          .object({
            user: z.boolean().default(false),
            government: z.boolean().default(false),
            embassies: z.boolean().default(false),
            intelligence: z.boolean().default(false),
            economics: z.boolean().default(false),
          })
          .optional(),
      })
    )
    .query(async ({ input }) => {
      const startTime = performance.now();

      try {
        const { id, include = {} } = input;

        // Use optimized country query with caching
        const country = await CacheDecorators.cacheCountryData(
          id,
          "full",
          () => OptimizedCountryQueries.getCountryById(id, { include }),
          600 // 10 minutes cache
        );

        if (!country) {
          throw new Error("Country not found");
        }

        PerformanceMonitor.recordMetric("countries.getById", performance.now() - startTime);
        return ResponseOptimizer.optimizeResponse(country);
      } catch (error) {
        PerformanceMonitor.recordMetric("countries.getById.error", performance.now() - startTime);
        console.error("[OptimizedCountries] getById error:", error);
        throw error;
      }
    }),

  /**
   * Get multiple countries by IDs with batching
   */
  getMultiple: publicProcedure
    .input(
      z.object({
        ids: z.array(z.string()).min(1).max(50),
        fields: z.array(z.string()).optional(),
      })
    )
    .query(async ({ input }) => {
      const startTime = performance.now();

      try {
        const { ids, fields = [] } = input;

        // Use batch cache decorator
        const countries = await CacheUtils.batchCache(
          ids,
          async (missingIds) => {
            const results = await OptimizedCountryQueries.getCountriesByIds(missingIds, {
              select:
                fields.length > 0 ? Object.fromEntries(fields.map((f) => [f, true])) : undefined,
            });

            // Convert to key-value map
            return Object.fromEntries(results.map((country) => [country.id, country]));
          },
          { ttl: 300, tier: "standard" }
        );

        PerformanceMonitor.recordMetric("countries.getMultiple", performance.now() - startTime);
        return ResponseOptimizer.optimizeResponse(Object.values(countries));
      } catch (error) {
        PerformanceMonitor.recordMetric(
          "countries.getMultiple.error",
          performance.now() - startTime
        );
        console.error("[OptimizedCountries] getMultiple error:", error);
        throw error;
      }
    }),

  /**
   * Get global statistics with optimized aggregation
   */
  getGlobalStats: publicProcedure
    .input(
      z
        .object({
          timestamp: z.number().optional(),
        })
        .optional()
    )
    .query(async ({ input }) => {
      const startTime = performance.now();

      try {
        const { timestamp } = input || {};

        // Cache global stats for 10 minutes
        const cacheKey = CacheUtils.generateKey("globalStats", timestamp?.toString() || "current");

        const stats = await CacheUtils.cache(
          () => cacheKey,
          () => OptimizedCountryQueries.getGlobalStats(),
          { ttl: 600, tier: "standard" }
        );

        PerformanceMonitor.recordMetric("countries.getGlobalStats", performance.now() - startTime);
        return ResponseOptimizer.optimizeResponse(stats);
      } catch (error) {
        PerformanceMonitor.recordMetric(
          "countries.getGlobalStats.error",
          performance.now() - startTime
        );
        console.error("[OptimizedCountries] getGlobalStats error:", error);
        throw error;
      }
    }),

  /**
   * Search countries with optimized full-text search
   */
  search: publicProcedure
    .input(
      z.object({
        query: z.string().min(1).max(100),
        limit: z.number().min(1).max(50).default(20),
      })
    )
    .query(async ({ input }) => {
      const startTime = performance.now();

      try {
        const { query, limit } = input;

        // Cache search results for 2 minutes
        const cacheKey = CacheUtils.generateKey("countries", "search", query, limit.toString());

        const results = await CacheUtils.cache(
          () => cacheKey,
          async () => {
            // Simple search implementation - can be enhanced with full-text search
            const countries = await OptimizedCountryQueries.getCountriesByRegion(
              undefined,
              undefined,
              limit,
              0,
              {
                select: {
                  id: true,
                  name: true,
                  slug: true,
                  continent: true,
                  region: true,
                  flag: true,
                },
              }
            );

            // Filter by search query
            const filtered = countries.countries.filter(
              (country) =>
                country.name.toLowerCase().includes(query.toLowerCase()) ||
                country.continent.toLowerCase().includes(query.toLowerCase()) ||
                country.region.toLowerCase().includes(query.toLowerCase())
            );

            return filtered.slice(0, limit);
          },
          { ttl: 120, tier: "background" }
        );

        PerformanceMonitor.recordMetric("countries.search", performance.now() - startTime);
        return ResponseOptimizer.optimizeResponse(results);
      } catch (error) {
        PerformanceMonitor.recordMetric("countries.search.error", performance.now() - startTime);
        console.error("[OptimizedCountries] search error:", error);
        throw error;
      }
    }),

  /**
   * Get performance metrics for this router
   */
  getPerformanceMetrics: publicProcedure.query(async () => {
    const metrics = queryMonitor.getMetrics();
    const performanceStats = PerformanceMonitor.getAllStats();

    return {
      queryMetrics: {
        totalQueries: metrics.length,
        averageDuration: metrics.reduce((sum, m) => sum + m.duration, 0) / metrics.length,
        slowQueries: metrics.filter((m) => m.duration > 100).length,
        cacheHitRate: metrics.filter((m) => m.cacheHit).length / metrics.length,
      },
      performanceStats,
      cacheStats: globalCache.getStats(),
    };
  }),
});
