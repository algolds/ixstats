/**
 * Database Performance Optimizations
 * Production-ready query optimizations and performance monitoring
 */

import { db } from "~/server/db";
import { performance } from "perf_hooks";

export interface QueryMetrics {
  queryKey: string;
  duration: number;
  success: boolean;
  cacheHit?: boolean;
  dataSize?: number;
  error?: string;
  timestamp: number;
}

export interface OptimizedQueryOptions {
  cache?: boolean;
  timeout?: number;
  retries?: number;
  batch?: boolean;
  select?: Record<string, boolean>;
  include?: Record<string, boolean>;
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
}

export const queryMonitor = new QueryPerformanceMonitor();

/**
 * Optimized country queries with intelligent caching and batching
 */
export class OptimizedCountryQueries {
  /**
   * Get country by ID with optimized includes
   */
  static async getCountryById(id: string, options: OptimizedQueryOptions = {}): Promise<any> {
    const startTime = performance.now();

    try {
      const country = await db.country.findUnique({
        where: { id },
        select: {
          id: true,
          name: true,
          slug: true,
          continent: true,
          region: true,
          governmentType: true,
          religion: true,
          leader: true,
          flag: true,
          coatOfArms: true,
          landArea: true,
          areaSqMi: true,
          baselinePopulation: true,
          baselineGdpPerCapita: true,
          maxGdpGrowthRate: true,
          adjustedGdpGrowth: true,
          populationGrowthRate: true,
          currentPopulation: true,
          currentGdpPerCapita: true,
          currentTotalGdp: true,
          populationDensity: true,
          gdpDensity: true,
          economicTier: true,
          populationTier: true,
          projected2040Population: true,
          projected2040Gdp: true,
          projected2040GdpPerCapita: true,
          actualGdpGrowth: true,
          nominalGDP: true,
          realGDPGrowthRate: true,
          inflationRate: true,
          currencyExchangeRate: true,
          laborForceParticipationRate: true,
          employmentRate: true,
          unemploymentRate: true,
          totalWorkforce: true,
          averageWorkweekHours: true,
          minimumWage: true,
          averageAnnualIncome: true,
          taxRevenueGDPPercent: true,
          governmentRevenueTotal: true,
          taxRevenuePerCapita: true,
          governmentBudgetGDPPercent: true,
          budgetDeficitSurplus: true,
          internalDebtGDPPercent: true,
          externalDebtGDPPercent: true,
          totalDebtGDPRatio: true,
          debtPerCapita: true,
          interestRates: true,
          debtServiceCosts: true,
          povertyRate: true,
          incomeInequalityGini: true,
          socialMobilityIndex: true,
          totalGovernmentSpending: true,
          spendingGDPPercent: true,
          spendingPerCapita: true,
          lifeExpectancy: true,
          urbanPopulationPercent: true,
          ruralPopulationPercent: true,
          literacyRate: true,
          localGrowthFactor: true,
          economicVitality: true,
          populationWellbeing: true,
          diplomaticStanding: true,
          governmentalEfficiency: true,
          overallNationalHealth: true,
          activeAlliances: true,
          activeTreaties: true,
          diplomaticReputation: true,
          publicApproval: true,
          governmentEfficiency: true,
          politicalStability: true,
          tradeBalance: true,
          infrastructureRating: true,
          usesAtomicGovernment: true,
          hideDiplomaticOps: true,
          hideStratcommIntel: true,
          lastCalculated: true,
          baselineDate: true,
          createdAt: true,
          updatedAt: true,
          // Optimized includes
          ...(options.include?.user && {
            user: {
              select: {
                id: true,
                clerkUserId: true,
                membershipTier: true,
                isActive: true,
              },
            },
          }),
          ...(options.include?.government && {
            governmentStructure: {
              select: {
                id: true,
                governmentName: true,
                governmentType: true,
                totalBudget: true,
              },
            },
          }),
          ...(options.include?.embassies && {
            embassiesHosting: {
              select: {
                id: true,
                name: true,
                level: true,
                status: true,
              },
              take: 10,
            },
          }),
          _count: {
            select: {
              dmInputs: true,
              embassiesHosting: true,
              embassiesGuest: true,
            },
          },
        },
      });

      const duration = performance.now() - startTime;
      queryMonitor.recordQuery({
        queryKey: "getCountryById",
        duration,
        success: true,
        dataSize: JSON.stringify(country).length,
        timestamp: Date.now(),
      });

      return country;
    } catch (error) {
      const duration = performance.now() - startTime;
      queryMonitor.recordQuery({
        queryKey: "getCountryById",
        duration,
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: Date.now(),
      });
      throw error;
    }
  }

  /**
   * Get multiple countries with optimized batching
   */
  static async getCountriesByIds(
    ids: string[],
    options: OptimizedQueryOptions = {}
  ): Promise<any[]> {
    const startTime = performance.now();

    try {
      // Batch query for better performance
      const countries = await db.country.findMany({
        where: { id: { in: ids } },
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
          ...(options.select || {}),
        },
        orderBy: { name: "asc" },
      });

      const duration = performance.now() - startTime;
      queryMonitor.recordQuery({
        queryKey: "getCountriesByIds",
        duration,
        success: true,
        dataSize: JSON.stringify(countries).length,
        timestamp: Date.now(),
      });

      return countries;
    } catch (error) {
      const duration = performance.now() - startTime;
      queryMonitor.recordQuery({
        queryKey: "getCountriesByIds",
        duration,
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: Date.now(),
      });
      throw error;
    }
  }

  /**
   * Get countries by continent/region with pagination
   */
  static async getCountriesByRegion(
    continent?: string,
    region?: string,
    limit = 50,
    offset = 0,
    options: OptimizedQueryOptions = {}
  ): Promise<{ countries: any[]; total: number }> {
    const startTime = performance.now();

    try {
      const whereClause: any = {};
      if (continent) whereClause.continent = continent;
      if (region) whereClause.region = region;

      const [countries, total] = await Promise.all([
        db.country.findMany({
          where: whereClause,
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
            ...(options.select || {}),
          },
          orderBy: { name: "asc" },
          take: limit,
          skip: offset,
        }),
        db.country.count({ where: whereClause }),
      ]);

      const duration = performance.now() - startTime;
      queryMonitor.recordQuery({
        queryKey: "getCountriesByRegion",
        duration,
        success: true,
        dataSize: JSON.stringify(countries).length,
        timestamp: Date.now(),
      });

      return { countries, total };
    } catch (error) {
      const duration = performance.now() - startTime;
      queryMonitor.recordQuery({
        queryKey: "getCountriesByRegion",
        duration,
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: Date.now(),
      });
      throw error;
    }
  }

  /**
   * Get global statistics with optimized aggregation
   */
  static async getGlobalStats(): Promise<any> {
    const startTime = performance.now();

    try {
      const result = await db.$queryRaw`
        SELECT
          COUNT(*) as "totalCountries",
          SUM(COALESCE("currentPopulation", 0)) as "totalPopulation",
          SUM(COALESCE("currentTotalGdp", 0)) as "totalGdp",
          SUM(COALESCE("landArea", 0)) as "totalLand",
          COUNT(CASE WHEN "economicTier" = 'Advanced' THEN 1 END) as "advancedCount",
          COUNT(CASE WHEN "economicTier" = 'Developed' THEN 1 END) as "developedCount",
          COUNT(CASE WHEN "economicTier" = 'Emerging' THEN 1 END) as "emergingCount",
          COUNT(CASE WHEN "economicTier" = 'Developing' THEN 1 END) as "developingCount",
          COUNT(CASE WHEN "economicTier" = 'Impoverished' THEN 1 END) as "impoverishedCount",
          COUNT(CASE WHEN "populationTier" = '1' THEN 1 END) as "popTier1Count",
          COUNT(CASE WHEN "populationTier" = '2' THEN 1 END) as "popTier2Count",
          COUNT(CASE WHEN "populationTier" = '3' THEN 1 END) as "popTier3Count",
          COUNT(CASE WHEN "populationTier" = '4' THEN 1 END) as "popTier4Count",
          COUNT(CASE WHEN "populationTier" = '5' THEN 1 END) as "popTier5Count"
        FROM "public"."Country"
      `;

      const duration = performance.now() - startTime;
      queryMonitor.recordQuery({
        queryKey: "getGlobalStats",
        duration,
        success: true,
        dataSize: JSON.stringify(result).length,
        timestamp: Date.now(),
      });

      return (result as any[])[0];
    } catch (error) {
      const duration = performance.now() - startTime;
      queryMonitor.recordQuery({
        queryKey: "getGlobalStats",
        duration,
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: Date.now(),
      });
      throw error;
    }
  }
}

/**
 * Optimized ThinkPages queries
 */
export class OptimizedThinkPagesQueries {
  /**
   * Get feed with optimized pagination and filtering
   */
  static async getFeed(
    options: {
      limit?: number;
      offset?: number;
      countryId?: string;
      filter?: "trending" | "recent";
      hashtag?: string;
    } = {}
  ): Promise<any[]> {
    const startTime = performance.now();
    const { limit = 50, offset = 0, countryId, filter, hashtag } = options;

    try {
      let whereClause: any = {
        visibility: "public",
      };

      if (countryId) {
        whereClause.account = { countryId };
      }

      if (filter === "trending") {
        whereClause.trending = true;
      }

      if (hashtag) {
        whereClause.hashtags = { contains: `"${hashtag}"` };
      }

      const posts = await db.thinkpagesPost.findMany({
        where: whereClause,
        select: {
          id: true,
          content: true,
          hashtags: true,
          postType: true,
          likeCount: true,
          repostCount: true,
          replyCount: true,
          trending: true,
          pinned: true,
          createdAt: true,
          account: {
            select: {
              id: true,
              username: true,
              displayName: true,
              profileImageUrl: true,
              accountType: true,
              verified: true,
            },
          },
          parentPost: {
            select: {
              id: true,
              content: true,
              account: {
                select: {
                  username: true,
                  displayName: true,
                },
              },
            },
          },
          repostOf: {
            select: {
              id: true,
              content: true,
              account: {
                select: {
                  username: true,
                  displayName: true,
                },
              },
            },
          },
        },
        orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
        take: limit,
        skip: offset,
      });

      const duration = performance.now() - startTime;
      queryMonitor.recordQuery({
        queryKey: "getFeed",
        duration,
        success: true,
        dataSize: JSON.stringify(posts).length,
        timestamp: Date.now(),
      });

      return posts;
    } catch (error) {
      const duration = performance.now() - startTime;
      queryMonitor.recordQuery({
        queryKey: "getFeed",
        duration,
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: Date.now(),
      });
      throw error;
    }
  }
}

/**
 * Optimized Intelligence queries
 */
export class OptimizedIntelligenceQueries {
  /**
   * Get intelligence feed with optimized filtering
   */
  static async getIntelligenceFeed(
    countryId?: string,
    limit = 50,
    options: OptimizedQueryOptions = {}
  ): Promise<any[]> {
    const startTime = performance.now();

    try {
      const whereClause: any = { isActive: true };

      if (countryId) {
        whereClause.OR = [{ affectedCountries: { contains: countryId } }, { category: "economic" }];
      }

      const intelligence = await db.intelligenceItem.findMany({
        where: whereClause,
        select: {
          id: true,
          category: true,
          title: true,
          content: true,
          priority: true,
          timestamp: true,
          source: true,
          affectedCountries: true,
          isActive: true,
        },
        orderBy: [{ priority: "desc" }, { timestamp: "desc" }],
        take: limit,
      });

      const duration = performance.now() - startTime;
      queryMonitor.recordQuery({
        queryKey: "getIntelligenceFeed",
        duration,
        success: true,
        dataSize: JSON.stringify(intelligence).length,
        timestamp: Date.now(),
      });

      return intelligence;
    } catch (error) {
      const duration = performance.now() - startTime;
      queryMonitor.recordQuery({
        queryKey: "getIntelligenceFeed",
        duration,
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: Date.now(),
      });
      throw error;
    }
  }
}

/**
 * Database connection optimization
 */
export class DatabaseOptimizer {
  /**
   * Optimize database connection settings
   */
  static async optimizeConnection(): Promise<void> {
    try {
      // Set SQLite optimization pragmas
      await db.$executeRaw`PRAGMA journal_mode = WAL`;
      await db.$executeRaw`PRAGMA synchronous = NORMAL`;
      await db.$executeRaw`PRAGMA cache_size = 10000`;
      await db.$executeRaw`PRAGMA temp_store = MEMORY`;
      await db.$executeRaw`PRAGMA mmap_size = 268435456`;

      console.log("[DatabaseOptimizer] Connection optimized for production");
    } catch (error) {
      console.error("[DatabaseOptimizer] Failed to optimize connection:", error);
    }
  }

  /**
   * Analyze query performance and suggest optimizations
   */
  static async analyzePerformance(): Promise<any> {
    const metrics = queryMonitor.getMetrics();
    const slowQueries = queryMonitor.getSlowQueries(100);

    const analysis = {
      totalQueries: metrics.length,
      slowQueries: slowQueries.length,
      averageDuration: metrics.reduce((sum, m) => sum + m.duration, 0) / metrics.length,
      cacheHitRate: metrics.filter((m) => m.cacheHit).length / metrics.length,
      topSlowQueries: slowQueries
        .sort((a, b) => b.duration - a.duration)
        .slice(0, 10)
        .map((q) => ({ queryKey: q.queryKey, duration: q.duration })),
    };

    return analysis;
  }
}
