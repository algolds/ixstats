/**
 * Historical Data Collection Service
 *
 * Automated service for collecting time-series snapshots of country metrics.
 * Runs on a scheduled basis (every 3 real hours = 6 IxTime hours) to capture:
 * - Economic indicators (GDP, growth, trade)
 * - Population metrics (total, density, growth)
 * - Diplomatic status (relationships, embassies, network power)
 * - Government effectiveness (components, synergies, efficiency)
 * - Vitality scores (all 4 rings + overall health)
 *
 * Data is stored in HistoricalDataPoint, DiplomaticRelationshipHistory,
 * ComponentEffectivenessHistory, and VitalityHistory tables.
 *
 * @module HistoricalDataCollectionService
 */

import { db } from "~/server/db";
import { IxTime } from "~/lib/ixtime";
import schedule from "node-schedule";

interface CollectionConfig {
  enabled: boolean;
  intervalHours: number; // Real hours between collections
  retentionDays: number; // How many days of history to keep
  batchSize: number; // Number of countries to process per batch
}

export class HistoricalDataCollectionService {
  private config: CollectionConfig;
  private job: schedule.Job | null = null;
  private isRunning = false;

  constructor(config?: Partial<CollectionConfig>) {
    this.config = {
      enabled: config?.enabled ?? true,
      intervalHours: config?.intervalHours ?? 3, // Every 3 hours by default
      retentionDays: config?.retentionDays ?? 365, // Keep 1 year
      batchSize: config?.batchSize ?? 50,
    };
  }

  /**
   * Start the scheduled collection service
   */
  start(): void {
    if (!this.config.enabled) {
      console.log("[HistoricalData] Collection service disabled");
      return;
    }

    if (this.job) {
      console.warn("[HistoricalData] Service already running");
      return;
    }

    // Schedule job to run every N hours
    const cronExpression = `0 */${this.config.intervalHours} * * *`;
    console.log(
      `[HistoricalData] Starting collection service (every ${this.config.intervalHours} hours)`
    );

    this.job = schedule.scheduleJob(cronExpression, async () => {
      await this.collect();
    });

    // Run initial collection on startup
    void this.collect();
  }

  /**
   * Stop the scheduled collection service
   */
  stop(): void {
    if (this.job) {
      this.job.cancel();
      this.job = null;
      console.log("[HistoricalData] Collection service stopped");
    }
  }

  /**
   * Main collection method - collects all historical data
   */
  async collect(): Promise<void> {
    if (this.isRunning) {
      console.log("[HistoricalData] Collection already in progress, skipping");
      return;
    }

    this.isRunning = true;
    const startTime = Date.now();
    const ixTimeNow = IxTime.getCurrentIxTime();
    const timestamp = new Date(ixTimeNow); // IxTime returns a timestamp number

    console.log(
      `[HistoricalData] Starting collection at ${timestamp.toISOString()}`
    );

    try {
      // Get all countries
      const countries = await db.country.findMany({
        select: {
          id: true,
          name: true,
          currentPopulation: true,
          currentGdpPerCapita: true,
          currentTotalGdp: true,
          populationGrowthRate: true,
          adjustedGdpGrowth: true,
          landArea: true,
          populationDensity: true,
          gdpDensity: true,
          economicVitality: true,
          populationWellbeing: true,
          diplomaticStanding: true,
          governmentalEfficiency: true,
          overallNationalHealth: true,
        },
      });

      console.log(`[HistoricalData] Collecting data for ${countries.length} countries`);

      // Process in batches to avoid memory issues
      for (let i = 0; i < countries.length; i += this.config.batchSize) {
        const batch = countries.slice(i, i + this.config.batchSize);
        await this.collectBatch(batch, timestamp);
      }

      // Clean up old data
      await this.cleanupOldData();

      const duration = Date.now() - startTime;
      console.log(
        `[HistoricalData] Collection completed in ${duration}ms (${countries.length} countries)`
      );
    } catch (error) {
      console.error("[HistoricalData] Collection failed:", error);
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Collect historical data for a batch of countries
   */
  private async collectBatch(
    countries: Array<{
      id: string;
      name: string;
      currentPopulation: number;
      currentGdpPerCapita: number;
      currentTotalGdp: number;
      populationGrowthRate: number;
      adjustedGdpGrowth: number;
      landArea: number | null;
      populationDensity: number | null;
      gdpDensity: number | null;
      economicVitality: number;
      populationWellbeing: number;
      diplomaticStanding: number;
      governmentalEfficiency: number;
      overallNationalHealth: number;
    }>,
    timestamp: Date
  ): Promise<void> {
    // Prepare bulk insert data
    const historicalDataPoints = countries.map((country) => ({
      countryId: country.id,
      ixTimeTimestamp: timestamp,
      population: country.currentPopulation,
      gdpPerCapita: country.currentGdpPerCapita,
      totalGdp: country.currentTotalGdp,
      populationGrowthRate: country.populationGrowthRate,
      gdpGrowthRate: country.adjustedGdpGrowth,
      landArea: country.landArea,
      populationDensity: country.populationDensity,
      gdpDensity: country.gdpDensity,
    }));

    const vitalityHistory = countries.map((country) => ({
      countryId: country.id,
      economicVitality: country.economicVitality,
      populationWellbeing: country.populationWellbeing,
      diplomaticStanding: country.diplomaticStanding,
      governmentalEfficiency: country.governmentalEfficiency,
      overallHealth: country.overallNationalHealth,
      timestamp,
    }));

    // Bulk insert using createMany
    await Promise.all([
      db.historicalDataPoint.createMany({
        data: historicalDataPoints,
        skipDuplicates: true,
      }),
      db.vitalityHistory.createMany({
        data: vitalityHistory,
        skipDuplicates: true,
      }),
    ]);

    // Collect component effectiveness history for each country
    await this.collectComponentHistory(countries.map((c) => c.id), timestamp);

    // Collect diplomatic relationship history for each country
    await this.collectDiplomaticHistory(countries.map((c) => c.id), timestamp);
  }

  /**
   * Collect component effectiveness snapshots
   */
  private async collectComponentHistory(
    countryIds: string[],
    timestamp: Date
  ): Promise<void> {
    const components = await db.governmentComponent.findMany({
      where: {
        countryId: { in: countryIds },
      },
      select: {
        id: true,
        countryId: true,
        componentType: true,
        effectivenessScore: true,
      },
    });

    if (components.length === 0) return;

    const componentHistory = components.map((comp) => ({
      countryId: comp.countryId,
      componentId: comp.id,
      componentType: comp.componentType,
      effectivenessScore: comp.effectivenessScore,
      timestamp,
    }));

    await db.componentEffectivenessHistory.createMany({
      data: componentHistory,
      skipDuplicates: true,
    });
  }

  /**
   * Collect diplomatic relationship snapshots
   */
  private async collectDiplomaticHistory(
    countryIds: string[],
    timestamp: Date
  ): Promise<void> {
    const relationships = await db.diplomaticRelation.findMany({
      where: {
        OR: [
          { country1: { in: countryIds } },
          { country2: { in: countryIds } },
        ],
      },
      select: {
        country1: true,
        country2: true,
        strength: true,
        relationship: true,
        treaties: true,
        tradeVolume: true,
        culturalExchange: true,
      },
    });

    if (relationships.length === 0) return;

    const relationshipHistory = relationships.map((rel) => ({
      country1Id: rel.country1,
      country2Id: rel.country2,
      strength: rel.strength,
      relationship: rel.relationship,
      treaties: rel.treaties ? JSON.stringify(rel.treaties) : null,
      tradeVolume: rel.tradeVolume || 0,
      culturalExchange: rel.culturalExchange || "Medium",
      timestamp,
    }));

    await db.diplomaticRelationshipHistory.createMany({
      data: relationshipHistory,
      skipDuplicates: true,
    });
  }

  /**
   * Clean up historical data older than retention period
   */
  private async cleanupOldData(): Promise<void> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.config.retentionDays);

    console.log(
      `[HistoricalData] Cleaning up data older than ${this.config.retentionDays} days`
    );

    await Promise.all([
      db.historicalDataPoint.deleteMany({
        where: { ixTimeTimestamp: { lt: cutoffDate } },
      }),
      db.vitalityHistory.deleteMany({
        where: { timestamp: { lt: cutoffDate } },
      }),
      db.componentEffectivenessHistory.deleteMany({
        where: { timestamp: { lt: cutoffDate } },
      }),
      db.diplomaticRelationshipHistory.deleteMany({
        where: { timestamp: { lt: cutoffDate } },
      }),
    ]);
  }

  /**
   * Manually trigger a collection (for testing or admin use)
   */
  async collectNow(): Promise<void> {
    console.log("[HistoricalData] Manual collection triggered");
    await this.collect();
  }

  /**
   * Get service status
   */
  getStatus(): {
    enabled: boolean;
    running: boolean;
    nextRun: Date | null;
    config: CollectionConfig;
  } {
    return {
      enabled: this.config.enabled,
      running: this.isRunning,
      nextRun: this.job?.nextInvocation() || null,
      config: this.config,
    };
  }
}

// Singleton instance
let historicalDataService: HistoricalDataCollectionService | null = null;

/**
 * Get the singleton instance of the historical data collection service
 */
export function getHistoricalDataService(): HistoricalDataCollectionService {
  if (!historicalDataService) {
    historicalDataService = new HistoricalDataCollectionService({
      enabled: process.env.NODE_ENV === "production", // Only run in production
      intervalHours: 3,
      retentionDays: 365,
      batchSize: 50,
    });
  }
  return historicalDataService;
}

/**
 * Initialize and start the historical data collection service
 */
export function initializeHistoricalDataService(): void {
  const service = getHistoricalDataService();
  service.start();
  console.log("[HistoricalData] Service initialized");
}
