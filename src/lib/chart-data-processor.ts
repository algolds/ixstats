// src/lib/chart-data-processor.ts
import { IxTime } from "~/lib/ixtime";
import type { TimeResolutionType } from "~/context/ixstats-context";

export interface ChartDataPoint {
  timestamp: number;        // IxTime timestamp
  formattedTime: string;    // Human-readable time
  period: string;           // e.g., "2028-Q1" or "2028"
  gameYear: number;         // In-game year
  
  // Data fields (all optional since a point might only have some values)
  population?: number;
  gdpPerCapita?: number;
  totalGdp?: number;
  populationDensity?: number;
  gdpDensity?: number;
  
  // Boolean flags for data source
  isHistorical?: boolean;
  isForecast?: boolean;
  isPresent?: boolean;
  isEpoch?: boolean;
  
  // For chart display mapping
  [key: string]: any;
}

export interface HistoricalDataPoint {
  ixTimeTimestamp: number | Date;
  population: number;
  gdpPerCapita: number;
  totalGdp: number;
  populationDensity?: number | null;
  gdpDensity?: number | null;
  [key: string]: any;
}

export interface ProcessingOptions {
  // Time range
  startTime?: number;        // Start timestamp
  endTime?: number;          // End timestamp
  referenceTime?: number;    // Present time (defaults to current IxTime)
  
  // Data processing
  resolution?: TimeResolutionType;  // Time resolution (quarterly, annual)
  fillGaps?: boolean;               // Whether to fill gaps in data
  normalizePopulation?: boolean;    // Convert population to millions
  normalizeTotalGdp?: boolean;      // Convert total GDP to billions
  normalizeGdpDensity?: boolean;    // Convert GDP density to millions
  
  // Forecast options
  includeForecast?: boolean;           // Whether to include forecast data
  forecastYears?: number;              // Number of years to forecast
  populationGrowthRate?: number;       // Annual population growth rate
  gdpGrowthRate?: number;              // Annual GDP growth rate
  extrapolateFromLastPoint?: boolean;  // Whether to extrapolate from last historical point
}

export class ChartDataProcessor {
  /**
   * Process historical data into a format suitable for charts
   */
  static processHistoricalData(
    data: HistoricalDataPoint[],
    options: ProcessingOptions = {}
  ): ChartDataPoint[] {
    const {
      startTime,
      endTime = IxTime.getCurrentIxTime(),
      referenceTime = IxTime.getCurrentIxTime(),
      resolution = 'annual',
      fillGaps = true,
      normalizePopulation = true,
      normalizeTotalGdp = true,
      normalizeGdpDensity = true,
    } = options;

    const gameEpoch = IxTime.getInGameEpoch();
    
    // Handle empty data case
    if (!data || data.length === 0) {
      return [];
    }
    
    // Sort data by timestamp and filter by time range
    const sortedData = [...data]
      .map(point => ({
        ...point,
        ixTimeTimestamp: point.ixTimeTimestamp instanceof Date 
          ? point.ixTimeTimestamp.getTime() 
          : point.ixTimeTimestamp
      }))
      .sort((a, b) => a.ixTimeTimestamp - b.ixTimeTimestamp);
    
    // Apply time range filter if specified
    const filteredData = startTime 
      ? sortedData.filter(point => point.ixTimeTimestamp >= startTime && point.ixTimeTimestamp <= endTime)
      : sortedData.filter(point => point.ixTimeTimestamp <= endTime);
    
    if (filteredData.length === 0) {
      return [];
    }
    
    // Group data points by time period based on resolution
    const groupedData = this.groupDataByPeriod(filteredData, resolution);
    
    // Convert grouped data to ChartDataPoints
    const chartData: ChartDataPoint[] = Object.entries(groupedData).map(([period, points]) => {
      // Calculate average values for the period
      const timestamp = points.reduce((sum, p) => sum + p.ixTimeTimestamp, 0) / points.length;
      const formattedTime = IxTime.formatIxTime(timestamp);
      const gameYear = IxTime.getCurrentGameYear(timestamp);
      const isEpoch = Math.abs(timestamp - gameEpoch) < 86400000; // Within 1 day of epoch
      const isPresent = Math.abs(timestamp - referenceTime) < 86400000; // Within 1 day of reference time
      
      // Calculate average values (with normalization if requested)
      const population = normalizePopulation 
        ? this.safeAverage(points, 'population') / 1000000 // Convert to millions
        : this.safeAverage(points, 'population');
        
      const gdpPerCapita = this.safeAverage(points, 'gdpPerCapita');
      
      const totalGdp = normalizeTotalGdp
        ? this.safeAverage(points, 'totalGdp') / 1000000000 // Convert to billions
        : this.safeAverage(points, 'totalGdp');
        
      const populationDensity = this.safeAverage(points, 'populationDensity');
      
      const gdpDensity = normalizeGdpDensity
        ? this.safeAverage(points, 'gdpDensity') / 1000000 // Convert to millions
        : this.safeAverage(points, 'gdpDensity');

      return {
        timestamp,
        formattedTime,
        period,
        gameYear,
        population,
        gdpPerCapita,
        totalGdp,
        populationDensity,
        gdpDensity,
        isHistorical: true,
        isForecast: false,
        isPresent,
        isEpoch,
      };
    });
    
    // Fill gaps if requested
    if (fillGaps && chartData.length > 1) {
      return this.fillTimeGaps(chartData, { resolution });
    }
    
    return chartData.sort((a, b) => a.timestamp - b.timestamp);
  }

  /**
   * Generate forecast data points based on historical data
   */
  static generateForecastData(
    historicalData: ChartDataPoint[],
    options: ProcessingOptions = {}
  ): ChartDataPoint[] {
    const {
      referenceTime = IxTime.getCurrentIxTime(),
      forecastYears = 5,
      resolution = 'annual',
      populationGrowthRate = 0.01, // Default 1% annual growth
      gdpGrowthRate = 0.025, // Default 2.5% annual growth
      extrapolateFromLastPoint = true,
    } = options;
    
    if (historicalData.length === 0 || forecastYears <= 0) {
      return [];
    }
    
    // Use the latest historical point as the base for forecasting
    const basePoint = extrapolateFromLastPoint 
      ? historicalData[historicalData.length - 1]
      : historicalData.find(p => Math.abs(p.timestamp - referenceTime) < 86400000) || historicalData[historicalData.length - 1];
    
    if (!basePoint) return [];
    
    const forecastPoints: ChartDataPoint[] = [];
    const stepsPerYear = resolution === 'quarterly' ? 4 : 1;
    const totalSteps = forecastYears * stepsPerYear;
    
    // Generate forecast points
    for (let i = 1; i <= totalSteps; i++) {
      const yearOffset = i / stepsPerYear;
      const timestamp = IxTime.addYears(basePoint.timestamp, yearOffset);
      const formattedTime = IxTime.formatIxTime(timestamp);
      const gameYear = IxTime.getCurrentGameYear(timestamp);
      
      // Generate period key
      const period = this.generatePeriodKey(timestamp, resolution);
      
      // Apply growth rates
      const populationGrowthFactor = Math.pow(1 + populationGrowthRate, yearOffset);
      const gdpGrowthFactor = Math.pow(1 + gdpGrowthRate, yearOffset);
      
      // Calculate forecast values
      const population = basePoint.population ? basePoint.population * populationGrowthFactor : undefined;
      const gdpPerCapita = basePoint.gdpPerCapita ? basePoint.gdpPerCapita * gdpGrowthFactor : undefined;
      const totalGdp = population && gdpPerCapita ? population * gdpPerCapita / 1000 : undefined; // Adjust for units
      
      // Calculate density metrics if base point has them
      const populationDensity = basePoint.populationDensity ? basePoint.populationDensity * populationGrowthFactor : undefined;
      const gdpDensity = basePoint.gdpDensity ? basePoint.gdpDensity * gdpGrowthFactor : undefined;
      
      forecastPoints.push({
        timestamp,
        formattedTime,
        period,
        gameYear,
        population,
        gdpPerCapita,
        totalGdp,
        populationDensity,
        gdpDensity,
        isHistorical: false,
        isForecast: true,
        isPresent: false,
        isEpoch: false,
      });
    }
    
    return forecastPoints;
  }

  /**
   * Combine historical and forecast data
   */
  static combineHistoricalAndForecast(
    historicalData: ChartDataPoint[],
    forecastData: ChartDataPoint[]
  ): ChartDataPoint[] {
    // Create a map of periods to prevent duplicates
    const dataMap = new Map<string, ChartDataPoint>();
    
    // Add historical data
    historicalData.forEach(point => {
      dataMap.set(point.period, {
        ...point,
        historicalPopulation: point.population,
        historicalGdpPerCapita: point.gdpPerCapita,
        historicalTotalGdp: point.totalGdp,
        historicalPopulationDensity: point.populationDensity,
        historicalGdpDensity: point.gdpDensity,
      });
    });
    
    // Add forecast data
    forecastData.forEach(point => {
      const existing = dataMap.get(point.period);
      if (existing) {
        dataMap.set(point.period, {
          ...existing,
          forecastPopulation: point.population,
          forecastGdpPerCapita: point.gdpPerCapita,
          forecastTotalGdp: point.totalGdp,
          forecastPopulationDensity: point.populationDensity,
          forecastGdpDensity: point.gdpDensity,
          isForecast: true,
        });
      } else {
        dataMap.set(point.period, {
          ...point,
          forecastPopulation: point.population,
          forecastGdpPerCapita: point.gdpPerCapita,
          forecastTotalGdp: point.totalGdp,
          forecastPopulationDensity: point.populationDensity,
          forecastGdpDensity: point.gdpDensity,
        });
      }
    });
    
    return Array.from(dataMap.values()).sort((a, b) => a.timestamp - b.timestamp);
  }

  /**
   * Group data points by time period
   */
  private static groupDataByPeriod(
    data: HistoricalDataPoint[],
    resolution: TimeResolutionType
  ): Record<string, HistoricalDataPoint[]> {
    const groupedData: Record<string, HistoricalDataPoint[]> = {};
    
    data.forEach(point => {
      const timestamp = point.ixTimeTimestamp;
      const period = this.generatePeriodKey(timestamp, resolution);
      
      if (!groupedData[period]) {
        groupedData[period] = [];
      }
      
      groupedData[period].push(point);
    });
    
    return groupedData;
  }

  /**
   * Generate a period key from a timestamp based on resolution
   */
  private static generatePeriodKey(
    timestamp: number | Date,
    resolution: TimeResolutionType
  ): string {
    const time = timestamp instanceof Date ? timestamp.getTime() : timestamp;
    const date = new Date(time);
    
    if (resolution === 'quarterly') {
      const year = date.getUTCFullYear();
      const quarter = Math.floor(date.getUTCMonth() / 3) + 1;
      return `${year}-Q${quarter}`;
    } else {
      return date.getUTCFullYear().toString();
    }
  }

  /**
   * Safely calculate average of a property across data points
   */
  private static safeAverage(
    points: HistoricalDataPoint[],
    property: string
  ): number | undefined {
    const validPoints = points.filter(p => 
      p[property] !== undefined && 
      p[property] !== null && 
      isFinite(p[property])
    );
    
    if (validPoints.length === 0) return undefined;
    
    const sum = validPoints.reduce((acc, p) => acc + Number(p[property]), 0);
    return sum / validPoints.length;
  }

  /**
   * Fill gaps in time series data
   */
  private static fillTimeGaps(
    data: ChartDataPoint[],
    options: { resolution: TimeResolutionType }
  ): ChartDataPoint[] {
    if (data.length < 2) return data;
    
    const { resolution } = options;
    const result: ChartDataPoint[] = [...data];
    const timeStep = resolution === 'quarterly' ? 3 * 30 * 24 * 60 * 60 * 1000 : 365.25 * 24 * 60 * 60 * 1000;
    
    // Sort by timestamp
    result.sort((a, b) => a.timestamp - b.timestamp);
    
    // Check for gaps
    const filledResult: ChartDataPoint[] = [];
    filledResult.push(result[0]);
    
    for (let i = 1; i < result.length; i++) {
      const current = result[i];
      const previous = result[i - 1];
      
      // Check if there's a gap
      const timeDiff = current.timestamp - previous.timestamp;
      if (timeDiff > timeStep * 1.5) {
        // Calculate how many periods should be in between
        const periodsToAdd = Math.floor(timeDiff / timeStep) - 1;
        
        for (let j = 1; j <= periodsToAdd; j++) {
          const interpolationFactor = j / (periodsToAdd + 1);
          const interpolatedTimestamp = previous.timestamp + (timeDiff * interpolationFactor);
          
          // Generate interpolated data point
          const interpolatedPoint: ChartDataPoint = {
            timestamp: interpolatedTimestamp,
            formattedTime: IxTime.formatIxTime(interpolatedTimestamp),
            period: this.generatePeriodKey(interpolatedTimestamp, resolution),
            gameYear: IxTime.getCurrentGameYear(interpolatedTimestamp),
            isHistorical: true,
            isForecast: false,
            isPresent: false,
            isEpoch: Math.abs(interpolatedTimestamp - IxTime.getInGameEpoch()) < 86400000,
          };
          
          // Linearly interpolate numeric values
          const numericProperties = [
            'population', 'gdpPerCapita', 'totalGdp', 
            'populationDensity', 'gdpDensity'
          ];
          
          numericProperties.forEach(prop => {
            if (previous[prop] !== undefined && current[prop] !== undefined) {
              interpolatedPoint[prop] = previous[prop] + 
                (current[prop] - previous[prop]) * interpolationFactor;
            }
          });
          
          filledResult.push(interpolatedPoint);
        }
      }
      
      filledResult.push(current);
    }
    
    return filledResult;
  }

  /**
   * Get special reference timestamps (epoch, current time)
   */
  static getReferenceTimestamps(
    startTime: number,
    endTime: number
  ): { epoch: number | null; present: number | null } {
    const gameEpoch = IxTime.getInGameEpoch();
    const currentTime = IxTime.getCurrentIxTime();
    
    return {
      epoch: (gameEpoch >= startTime && gameEpoch <= endTime) ? gameEpoch : null,
      present: (currentTime >= startTime && currentTime <= endTime) ? currentTime : null,
    };
  }

  /**
   * Format a timestamp for display based on resolution
   */
  static formatTimestamp(
    timestamp: number,
    resolution: TimeResolutionType
  ): string {
    const gameYear = IxTime.getCurrentGameYear(timestamp);
    
    if (resolution === 'quarterly') {
      const date = new Date(timestamp);
      const quarter = Math.floor(date.getUTCMonth() / 3) + 1;
      return `${gameYear}-Q${quarter}`;
    } else {
      return gameYear.toString();
    }
  }
}