// Intelligence Broadcasting Service
// Orchestrates real-time intelligence updates and notifications

import "server-only";
import { IxTime } from "./ixtime";
import { db } from "~/server/db";
import type { IntelligenceUpdate } from "./websocket/types";
import type { Country } from "@prisma/client";
import { standardize } from "./interface-standardizer";

// Use any type to avoid importing socket.io during build
type IntelligenceWebSocketServer = any;

interface IntelligenceBroadcastServiceOptions {
  websocketServer?: IntelligenceWebSocketServer;
  broadcastInterval?: number;
  alertThresholds?: {
    economicChange: number;
    populationChange: number;
    vitalityDrop: number;
  };
}

export class IntelligenceBroadcastService {
  private websocketServer: IntelligenceWebSocketServer | null = null;
  private broadcastInterval: number;
  private alertThresholds: {
    economicChange: number;
    populationChange: number;
    vitalityDrop: number;
  };
  private isRunning = false;
  private intervalId: NodeJS.Timeout | null = null;
  private lastProcessedTime = 0;

  constructor(options: IntelligenceBroadcastServiceOptions = {}) {
    this.broadcastInterval = options.broadcastInterval ?? 30000; // 30 seconds
    this.alertThresholds = options.alertThresholds ?? {
      economicChange: 5.0, // 5% GDP change triggers alert
      populationChange: 2.0, // 2% population change triggers alert
      vitalityDrop: 10.0, // 10 point vitality drop triggers alert
    };

    if (options.websocketServer) {
      this.setWebSocketServer(options.websocketServer);
    }
  }

  /**
   * Set the WebSocket server instance
   */
  public setWebSocketServer(server: IntelligenceWebSocketServer): void {
    this.websocketServer = server;
  }

  /**
   * Start the intelligence broadcasting service
   */
  public start(): void {
    if (this.isRunning) {
      console.warn("Intelligence Broadcasting Service is already running");
      return;
    }

    console.log("Starting Intelligence Broadcasting Service...");
    this.isRunning = true;
    this.lastProcessedTime = Date.now();

    // Start periodic broadcasting
    this.intervalId = setInterval(() => {
      this.processBroadcasts().catch((error) => {
        console.error("Error in intelligence broadcasting:", error);
      });
    }, this.broadcastInterval);

    // Initial broadcast
    this.processBroadcasts().catch((error) => {
      console.error("Error in initial intelligence broadcast:", error);
    });
  }

  /**
   * Stop the intelligence broadcasting service
   */
  public stop(): void {
    if (!this.isRunning) return;

    console.log("Stopping Intelligence Broadcasting Service...");
    this.isRunning = false;

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  /**
   * Main broadcasting process
   */
  private async processBroadcasts(): Promise<void> {
    if (!this.websocketServer) {
      console.warn("No WebSocket server configured for intelligence broadcasting");
      return;
    }

    try {
      const currentTime = Date.now();
      const timeDiff = currentTime - this.lastProcessedTime;

      // Process country updates
      await this.processCountryUpdates(timeDiff);

      // Process new intelligence items
      await this.processNewIntelligenceItems(timeDiff);

      // Process system events
      await this.processSystemEvents();

      this.lastProcessedTime = currentTime;
    } catch (error) {
      console.error("Error in processBroadcasts:", error);
    }
  }

  /**
   * Process country-specific updates and broadcast changes
   */
  private async processCountryUpdates(timeDiff: number): Promise<void> {
    try {
      // Find countries updated since last broadcast
      const updatedCountries = await db.country.findMany({
        where: {
          lastCalculated: {
            gte: new Date(this.lastProcessedTime),
          },
        },
        include: {
          historicalData: {
            orderBy: { ixTimeTimestamp: "desc" },
            take: 2,
          },
        },
      });

      for (const country of updatedCountries) {
        await this.processCountryUpdate(country, timeDiff);
      }
    } catch (error) {
      console.error("Error processing country updates:", error);
    }
  }

  /**
   * Process individual country update and broadcast relevant changes
   */
  private async processCountryUpdate(
    country: Country & {
      historicalData: { gdpPerCapita?: number; population?: number; [key: string]: unknown }[];
    },
    _timeDiff: number
  ): Promise<void> {
    if (!this.websocketServer) return;

    const currentData = country.historicalData[0];
    const previousData = country.historicalData[1];

    // Broadcast vitality score changes
    // Note: vitality fields don't exist in current schema, using default values
    this.websocketServer.broadcastVitalityUpdate(country.id, {
      economic: 0,
      population: 0,
      diplomatic: 0,
      governance: 0,
      lastUpdated: country.lastCalculated,
      ixTime: IxTime.getCurrentIxTime(),
    });

    // Check for significant changes and create alerts
    if (currentData && previousData) {
      await this.checkForSignificantChanges(country, currentData, previousData);
    }

    // Broadcast general country update
    const update: IntelligenceUpdate = {
      id: `country_update_${country.id}_${Date.now()}`,
      type: "economic_change",
      title: `${country.name} Economic Update`,
      description: `Economic data updated for ${country.name}`,
      countryId: country.id,
      category: "economic",
      priority: "medium",
      severity: "info",
      data: {
        countryName: country.name,
        economicTier: country.economicTier,
        populationTier: country.populationTier,
        lastCalculated: country.lastCalculated,
        vitality: {
          economic: 0,
          population: 0,
          diplomatic: 0,
          governance: 0,
        },
      },
      isGlobal: false,
      timestamp: Date.now(),
    };

    this.websocketServer.broadcastIntelligenceUpdate(update);
  }

  /**
   * Check for significant economic/population changes and create alerts
   */
  private async checkForSignificantChanges(
    country: Country,
    currentData: { gdpPerCapita?: number; population?: number; [key: string]: unknown },
    previousData: { gdpPerCapita?: number; population?: number; [key: string]: unknown }
  ): Promise<void> {
    if (!this.websocketServer) return;

    const alerts: IntelligenceUpdate[] = [];

    // Check GDP change
    if (currentData.gdpPerCapita != null && previousData.gdpPerCapita != null) {
      const gdpChange =
        ((currentData.gdpPerCapita - previousData.gdpPerCapita) / previousData.gdpPerCapita) * 100;

      if (Math.abs(gdpChange) >= this.alertThresholds.economicChange) {
        alerts.push({
          id: `gdp_alert_${country.id}_${Date.now()}`,
          type: "alert",
          title: `Significant Economic Change in ${country.name}`,
          description: `GDP per capita has ${gdpChange > 0 ? "increased" : "decreased"} by ${Math.abs(gdpChange).toFixed(1)}%`,
          countryId: country.id,
          category: "economic",
          priority: Math.abs(gdpChange) >= 10 ? "critical" : "high",
          severity: gdpChange < -10 ? "critical" : gdpChange < 0 ? "warning" : "info",
          data: {
            gdpChange,
            currentGdp: currentData.gdpPerCapita ?? 0,
            previousGdp: previousData.gdpPerCapita ?? 0,
            countryName: country.name,
          },
          isGlobal: Math.abs(gdpChange) >= 15, // Global alert for very large changes
          timestamp: Date.now(),
        });
      }
    }

    // Check population change
    if (currentData.population != null && previousData.population != null) {
      const popChange =
        ((currentData.population - previousData.population) / previousData.population) * 100;

      if (Math.abs(popChange) >= this.alertThresholds.populationChange) {
        alerts.push({
          id: `pop_alert_${country.id}_${Date.now()}`,
          type: "alert",
          title: `Population Change in ${country.name}`,
          description: `Population has ${popChange > 0 ? "increased" : "decreased"} by ${Math.abs(popChange).toFixed(1)}%`,
          countryId: country.id,
          category: "population",
          priority: Math.abs(popChange) >= 5 ? "high" : "medium",
          severity: popChange < -5 ? "warning" : "info",
          data: {
            populationChange: popChange,
            currentPopulation: currentData.population ?? 0,
            previousPopulation: previousData.population ?? 0,
            countryName: country.name,
          },
          isGlobal: Math.abs(popChange) >= 8,
          timestamp: Date.now(),
        });
      }
    }

    // Check vitality drops
    // Note: vitality fields don't exist in current schema, skipping vitality alerts
    // const vitalityFields = [
    //   { field: 'economicVitality', name: 'Economic Vitality' },
    //   { field: 'populationWellbeing', name: 'Population Wellbeing' },
    //   { field: 'diplomaticStanding', name: 'Diplomatic Standing' },
    //   { field: 'governmentalEfficiency', name: 'Governmental Efficiency' }
    // ];

    // Skip vitality processing until fields are added to schema

    // Broadcast all alerts
    for (const alert of alerts) {
      this.websocketServer.broadcastIntelligenceUpdate(alert);
    }
  }

  /**
   * Process new intelligence items and broadcast them
   */
  private async processNewIntelligenceItems(_timeDiff: number): Promise<void> {
    if (!this.websocketServer) return;

    try {
      // Find new intelligence items since last broadcast
      const newItems = await db.intelligenceItem.findMany({
        where: {
          isActive: true,
          timestamp: {
            gte: new Date(this.lastProcessedTime),
          },
        },
        orderBy: { timestamp: "desc" },
      });

      // Broadcast each new intelligence item
      for (const item of newItems) {
        // Bulk standardize intelligence item before broadcasting
        const standardizedItem = standardize.intelligence(item);
        this.websocketServer.broadcastNewIntelligenceItem(standardizedItem);
      }
    } catch (error) {
      console.error("Error processing new intelligence items:", error);
    }
  }

  /**
   * Process system-wide events and notifications
   */
  private async processSystemEvents(): Promise<void> {
    if (!this.websocketServer) return;

    try {
      // Check IxTime synchronization
      const currentIxTime = IxTime.getCurrentIxTime();
      const systemUpdate: IntelligenceUpdate = {
        id: `system_ixtime_${Date.now()}`,
        type: "system_update",
        title: "IxTime Synchronization",
        description: `Current IxTime: ${currentIxTime}`,
        category: "system",
        priority: "low",
        severity: "info",
        data: {
          ixTime: currentIxTime,
          multiplier: 2, // 2x speed
          realTime: Date.now(),
        },
        isGlobal: true,
        timestamp: Date.now(),
        expiresAt: Date.now() + 60000, // Expire in 1 minute
      };

      this.websocketServer.broadcastIntelligenceUpdate(systemUpdate);
    } catch (error) {
      console.error("Error processing system events:", error);
    }
  }

  /**
   * Get historical average for a vitality field
   */
  private async getHistoricalAverage(countryId: string, field: string): Promise<number | null> {
    try {
      // Get historical data points for the last 30 days (IxTime)
      const thirtyDaysAgo = IxTime.getCurrentIxTime() - 30 * 24 * 60 * 60 * 1000;

      const historicalData = await db.historicalDataPoint.findMany({
        where: {
          countryId,
          ixTimeTimestamp: { gte: new Date(thirtyDaysAgo) },
        },
        select: { [field]: true },
        orderBy: { ixTimeTimestamp: "desc" },
        take: 30,
      });

      if (historicalData.length === 0) return null;

      const values = historicalData
        .map((data) => (data as Record<string, unknown>)[field] as number | null | undefined)
        .filter((val): val is number => val != null);

      if (values.length === 0) return null;

      return values.reduce((sum, val) => sum + val, 0) / values.length;
    } catch (error) {
      console.error("Error calculating historical average:", error);
      return null;
    }
  }

  /**
   * Manually trigger intelligence broadcast for testing
   */
  public async triggerBroadcast(countryId?: string): Promise<void> {
    if (!this.websocketServer) {
      throw new Error("No WebSocket server configured");
    }

    const testUpdate: IntelligenceUpdate = {
      id: `manual_test_${Date.now()}`,
      type: "system_update",
      title: "Manual Intelligence Test",
      description: "This is a manual test broadcast",
      countryId,
      category: "system",
      priority: "low",
      severity: "info",
      data: {
        test: true,
        timestamp: Date.now(),
        ixTime: IxTime.getCurrentIxTime(),
      },
      isGlobal: !countryId,
      timestamp: Date.now(),
    };

    this.websocketServer.broadcastIntelligenceUpdate(testUpdate);
    console.log("Manual intelligence broadcast triggered");
  }

  /**
   * Get service statistics
   */
  public getStats(): {
    isRunning: boolean;
    broadcastInterval: number;
    lastProcessedTime: number;
    alertThresholds: { economicChange: number; populationChange: number; vitalityDrop: number };
    hasWebSocketServer: boolean;
    uptime: number;
  } {
    return {
      isRunning: this.isRunning,
      broadcastInterval: this.broadcastInterval,
      lastProcessedTime: this.lastProcessedTime,
      alertThresholds: this.alertThresholds,
      hasWebSocketServer: !!this.websocketServer,
      uptime: this.isRunning ? Date.now() - this.lastProcessedTime : 0,
    };
  }
}

export default IntelligenceBroadcastService;
