// Intelligence Broadcasting Service
// Orchestrates real-time intelligence updates and notifications

import { IxTime } from './ixtime';
import { db } from '~/server/db';
import type { IntelligenceWebSocketServer } from './websocket/intelligence-websocket-server';
import type { IntelligenceUpdate } from './websocket/types';
import type { Country } from '@prisma/client';

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
    this.broadcastInterval = options.broadcastInterval || 30000; // 30 seconds
    this.alertThresholds = options.alertThresholds || {
      economicChange: 5.0,    // 5% GDP change triggers alert
      populationChange: 2.0,  // 2% population change triggers alert
      vitalityDrop: 10.0      // 10 point vitality drop triggers alert
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
      console.warn('Intelligence Broadcasting Service is already running');
      return;
    }

    console.log('Starting Intelligence Broadcasting Service...');
    this.isRunning = true;
    this.lastProcessedTime = Date.now();
    
    // Start periodic broadcasting
    this.intervalId = setInterval(() => {
      this.processBroadcasts().catch(error => {
        console.error('Error in intelligence broadcasting:', error);
      });
    }, this.broadcastInterval);

    // Initial broadcast
    this.processBroadcasts().catch(error => {
      console.error('Error in initial intelligence broadcast:', error);
    });
  }

  /**
   * Stop the intelligence broadcasting service
   */
  public stop(): void {
    if (!this.isRunning) return;

    console.log('Stopping Intelligence Broadcasting Service...');
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
      console.warn('No WebSocket server configured for intelligence broadcasting');
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
      console.error('Error in processBroadcasts:', error);
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
            gte: this.lastProcessedTime 
          }
        },
        include: {
          historicalData: {
            orderBy: { ixTimeTimestamp: 'desc' },
            take: 2
          }
        }
      });

      for (const country of updatedCountries) {
        await this.processCountryUpdate(country, timeDiff);
      }

    } catch (error) {
      console.error('Error processing country updates:', error);
    }
  }

  /**
   * Process individual country update and broadcast relevant changes
   */
  private async processCountryUpdate(
    country: Country & { historicalData: any[] }, 
    timeDiff: number
  ): Promise<void> {
    if (!this.websocketServer) return;

    const currentData = country.historicalData[0];
    const previousData = country.historicalData[1];

    // Broadcast vitality score changes
    this.websocketServer.broadcastVitalityUpdate(country.id, {
      economic: country.economicVitality,
      population: country.populationWellbeing,
      diplomatic: country.diplomaticStanding,
      governance: country.governmentalEfficiency,
      lastUpdated: country.lastCalculated,
      ixTime: IxTime.getCurrentIxTime()
    });

    // Check for significant changes and create alerts
    if (currentData && previousData) {
      await this.checkForSignificantChanges(country, currentData, previousData);
    }

    // Broadcast general country update
    const update: IntelligenceUpdate = {
      id: `country_update_${country.id}_${Date.now()}`,
      type: 'economic_change',
      title: `${country.name} Economic Update`,
      description: `Economic data updated for ${country.name}`,
      countryId: country.id,
      category: 'economic',
      priority: 'medium',
      severity: 'info',
      data: {
        countryName: country.name,
        economicTier: country.economicTier,
        populationTier: country.populationTier,
        lastCalculated: country.lastCalculated,
        vitality: {
          economic: country.economicVitality,
          population: country.populationWellbeing,
          diplomatic: country.diplomaticStanding,
          governance: country.governmentalEfficiency
        }
      },
      isGlobal: false,
      timestamp: Date.now()
    };

    this.websocketServer.broadcastIntelligenceUpdate(update);
  }

  /**
   * Check for significant economic/population changes and create alerts
   */
  private async checkForSignificantChanges(
    country: Country,
    currentData: any,
    previousData: any
  ): Promise<void> {
    if (!this.websocketServer) return;

    const alerts: IntelligenceUpdate[] = [];

    // Check GDP change
    if (currentData.gdpPerCapita && previousData.gdpPerCapita) {
      const gdpChange = ((currentData.gdpPerCapita - previousData.gdpPerCapita) / previousData.gdpPerCapita) * 100;
      
      if (Math.abs(gdpChange) >= this.alertThresholds.economicChange) {
        alerts.push({
          id: `gdp_alert_${country.id}_${Date.now()}`,
          type: 'alert',
          title: `Significant Economic Change in ${country.name}`,
          description: `GDP per capita has ${gdpChange > 0 ? 'increased' : 'decreased'} by ${Math.abs(gdpChange).toFixed(1)}%`,
          countryId: country.id,
          category: 'economic',
          priority: Math.abs(gdpChange) >= 10 ? 'critical' : 'high',
          severity: gdpChange < -10 ? 'critical' : gdpChange < 0 ? 'warning' : 'info',
          data: {
            gdpChange,
            currentGdp: currentData.gdpPerCapita,
            previousGdp: previousData.gdpPerCapita,
            countryName: country.name
          },
          isGlobal: Math.abs(gdpChange) >= 15, // Global alert for very large changes
          timestamp: Date.now()
        });
      }
    }

    // Check population change
    if (currentData.population && previousData.population) {
      const popChange = ((currentData.population - previousData.population) / previousData.population) * 100;
      
      if (Math.abs(popChange) >= this.alertThresholds.populationChange) {
        alerts.push({
          id: `pop_alert_${country.id}_${Date.now()}`,
          type: 'alert',
          title: `Population Change in ${country.name}`,
          description: `Population has ${popChange > 0 ? 'increased' : 'decreased'} by ${Math.abs(popChange).toFixed(1)}%`,
          countryId: country.id,
          category: 'population',
          priority: Math.abs(popChange) >= 5 ? 'high' : 'medium',
          severity: popChange < -5 ? 'warning' : 'info',
          data: {
            populationChange: popChange,
            currentPopulation: currentData.population,
            previousPopulation: previousData.population,
            countryName: country.name
          },
          isGlobal: Math.abs(popChange) >= 8,
          timestamp: Date.now()
        });
      }
    }

    // Check vitality drops
    const vitalityFields = [
      { field: 'economicVitality', name: 'Economic Vitality' },
      { field: 'populationWellbeing', name: 'Population Wellbeing' },
      { field: 'diplomaticStanding', name: 'Diplomatic Standing' },
      { field: 'governmentalEfficiency', name: 'Governmental Efficiency' }
    ];

    for (const { field, name } of vitalityFields) {
      const currentValue = (country as any)[field] || 0;
      const historicalAvg = await this.getHistoricalAverage(country.id, field);
      
      if (historicalAvg && (historicalAvg - currentValue) >= this.alertThresholds.vitalityDrop) {
        alerts.push({
          id: `vitality_alert_${field}_${country.id}_${Date.now()}`,
          type: 'alert',
          title: `${name} Decline in ${country.name}`,
          description: `${name} has dropped ${(historicalAvg - currentValue).toFixed(1)} points from historical average`,
          countryId: country.id,
          category: field.includes('economic') ? 'economic' : field.includes('diplomatic') ? 'diplomatic' : 'governance',
          priority: (historicalAvg - currentValue) >= 20 ? 'critical' : 'high',
          severity: (historicalAvg - currentValue) >= 25 ? 'critical' : 'warning',
          data: {
            currentValue,
            historicalAverage: historicalAvg,
            decline: historicalAvg - currentValue,
            vitalityType: field,
            countryName: country.name
          },
          isGlobal: (historicalAvg - currentValue) >= 30,
          timestamp: Date.now()
        });
      }
    }

    // Broadcast all alerts
    for (const alert of alerts) {
      this.websocketServer.broadcastIntelligenceUpdate(alert);
    }
  }

  /**
   * Process new intelligence items and broadcast them
   */
  private async processNewIntelligenceItems(timeDiff: number): Promise<void> {
    if (!this.websocketServer) return;

    try {
      // Find new intelligence items since last broadcast
      const newItems = await db.intelligenceItem.findMany({
        where: {
          isActive: true,
          timestamp: { 
            gte: this.lastProcessedTime 
          }
        },
        orderBy: { timestamp: 'desc' }
      });

      // Broadcast each new intelligence item
      for (const item of newItems) {
        this.websocketServer.broadcastNewIntelligenceItem({
          id: item.id,
          title: item.title,
          description: item.content,
          category: item.category,
          priority: item.priority,
          severity: item.severity || 'info',
          countryId: item.countryId,
          source: item.source,
          timestamp: item.timestamp,
          affectedCountries: item.affectedCountries,
          confidence: item.confidence
        });
      }

    } catch (error) {
      console.error('Error processing new intelligence items:', error);
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
        type: 'system_update',
        title: 'IxTime Synchronization',
        description: `Current IxTime: ${currentIxTime}`,
        category: 'system',
        priority: 'low',
        severity: 'info',
        data: {
          ixTime: currentIxTime,
          multiplier: 2, // 2x speed
          realTime: Date.now()
        },
        isGlobal: true,
        timestamp: Date.now(),
        expiresAt: Date.now() + 60000 // Expire in 1 minute
      };

      this.websocketServer.broadcastIntelligenceUpdate(systemUpdate);

    } catch (error) {
      console.error('Error processing system events:', error);
    }
  }

  /**
   * Get historical average for a vitality field
   */
  private async getHistoricalAverage(countryId: string, field: string): Promise<number | null> {
    try {
      // Get historical data points for the last 30 days (IxTime)
      const thirtyDaysAgo = IxTime.getCurrentIxTime() - (30 * 24 * 60 * 60 * 1000);
      
      const historicalData = await db.historicalDataPoint.findMany({
        where: {
          countryId,
          ixTimeTimestamp: { gte: thirtyDaysAgo }
        },
        select: { [field]: true },
        orderBy: { ixTimeTimestamp: 'desc' },
        take: 30
      });

      if (historicalData.length === 0) return null;

      const values = historicalData
        .map(data => (data as any)[field])
        .filter(val => val !== null && val !== undefined);

      if (values.length === 0) return null;

      return values.reduce((sum, val) => sum + val, 0) / values.length;

    } catch (error) {
      console.error('Error calculating historical average:', error);
      return null;
    }
  }

  /**
   * Manually trigger intelligence broadcast for testing
   */
  public async triggerBroadcast(countryId?: string): Promise<void> {
    if (!this.websocketServer) {
      throw new Error('No WebSocket server configured');
    }

    const testUpdate: IntelligenceUpdate = {
      id: `manual_test_${Date.now()}`,
      type: 'system_update',
      title: 'Manual Intelligence Test',
      description: 'This is a manual test broadcast',
      countryId,
      category: 'system',
      priority: 'low',
      severity: 'info',
      data: {
        test: true,
        timestamp: Date.now(),
        ixTime: IxTime.getCurrentIxTime()
      },
      isGlobal: !countryId,
      timestamp: Date.now()
    };

    this.websocketServer.broadcastIntelligenceUpdate(testUpdate);
    console.log('Manual intelligence broadcast triggered');
  }

  /**
   * Get service statistics
   */
  public getStats(): any {
    return {
      isRunning: this.isRunning,
      broadcastInterval: this.broadcastInterval,
      lastProcessedTime: this.lastProcessedTime,
      alertThresholds: this.alertThresholds,
      hasWebSocketServer: !!this.websocketServer,
      uptime: this.isRunning ? Date.now() - this.lastProcessedTime : 0
    };
  }
}

export default IntelligenceBroadcastService;