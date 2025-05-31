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
  populationDensity?: number | null; // Allow null
  gdpDensity?: number | null;       // Allow null
  
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
          : point.ixTimeTimestamp // Ensures this is a number
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
    // At this point, ixTimeTimestamp in filteredData elements is guaranteed to be a number.
    const groupedData = this.groupDataByPeriod(filteredData as Array<HistoricalDataPoint & { ixTimeTimestamp: number }>, resolution);
    
    // Convert grouped data to ChartDataPoints
    const chartData: ChartDataPoint[] = Object.entries(groupedData).map(([period, pointsInGroup]) => {
      // Calculate average timestamp for the group
      const timestamp = pointsInGroup.reduce((sum, p) => sum + p.ixTimeTimestamp, 0) / pointsInGroup.length;
      const formattedTime = IxTime.formatIxTime(timestamp);
      const gameYear = IxTime.getCurrentGameYear(timestamp);
      const isEpoch = Math.abs(timestamp - gameEpoch) < 86400000; // Within 1 day of epoch
      const isPresent = Math.abs(timestamp - referenceTime) < 86400000; // Within 1 day of reference time
      
      // Calculate average values (with normalization if requested)
      const population = normalizePopulation 
        ? (this.safeAverage(pointsInGroup, 'population') ?? 0) / 1000000 // Convert to millions
        : this.safeAverage(pointsInGroup, 'population') ?? 0;
        
      const gdpPerCapita = this.safeAverage(pointsInGroup, 'gdpPerCapita') ?? 0;
      const totalGdpValue = this.safeAverage(pointsInGroup, 'totalGdp');
      const totalGdp = normalizeTotalGdp && totalGdpValue != null
        ? totalGdpValue / 1000000000 // Convert to billions
        : totalGdpValue ?? 0;
        
      const populationDensity = this.safeAverage(pointsInGroup, 'populationDensity'); // Can be undefined or null
      const gdpDensityValue = this.safeAverage(pointsInGroup, 'gdpDensity'); // Can be undefined or null
      const gdpDensity = normalizeGdpDensity && gdpDensityValue != null
        ? gdpDensityValue / 1000000 // Convert to millions
        : gdpDensityValue;


      return {
        timestamp,
        formattedTime,
        period,
        gameYear,
        population,
        gdpPerCapita,
        totalGdp,
        populationDensity: populationDensity === undefined ? null : populationDensity, // Ensure null for consistency
        gdpDensity: gdpDensity === undefined ? null : gdpDensity,                   // Ensure null for consistency
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
      const populationDensity = basePoint.populationDensity != null ? basePoint.populationDensity * populationGrowthFactor : null;
      const gdpDensity = basePoint.gdpDensity != null ? basePoint.gdpDensity * gdpGrowthFactor : null;
      
      forecastPoints.push({
        timestamp,
        formattedTime,
        period,
        gameYear,
        population,
        gdpPerCapita,
        totalGdp,
        populationDensity, // Can be null
        gdpDensity,       // Can be null
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
    data: Array<HistoricalDataPoint & { ixTimeTimestamp: number }>, // Ensure ixTimeTimestamp is number here
    resolution: TimeResolutionType
  ): Record<string, Array<HistoricalDataPoint & { ixTimeTimestamp: number }>> {
    const groupedData: Record<string, Array<HistoricalDataPoint & { ixTimeTimestamp: number }>> = {};
    
    data.forEach(point => {
      const timestamp = point.ixTimeTimestamp; // This is a number
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
    timestamp: number, // Expect number
    resolution: TimeResolutionType
  ): string {
    const date = new Date(timestamp); // No longer need instanceof Date check
    
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
    points: Array<HistoricalDataPoint & { ixTimeTimestamp?: number }>, // ixTimeTimestamp may not be used here
    property: keyof HistoricalDataPoint
  ): number | null { // Return null if no valid points
    const validPoints = points.filter(p => 
      p[property] !== undefined && 
      p[property] !== null && 
      isFinite(Number(p[property]))
    );
    
    if (validPoints.length === 0) return null; // MODIFIED: Return null
    
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
    const result: ChartDataPoint[] = [...data]; // data is ChartDataPoint[]
    const timeStep = resolution === 'quarterly' ? 3 * 30 * 24 * 60 * 60 * 1000 : 365.25 * 24 * 60 * 60 * 1000;
    
    // Sort by timestamp
    result.sort((a, b) => a.timestamp - b.timestamp);
    
    // Check for gaps
    const filledResult: ChartDataPoint[] = [];
    // `result[0]` is safe if data.length >=2, which is checked.
    // TypeScript might still complain if it doesn't trace the length check perfectly.
    if (result[0]) { // Explicit check to satisfy TS, though logically guaranteed
        filledResult.push(result[0]);
    }
    
    for (let i = 1; i < result.length; i++) {
      const current = result[i]; // Safe
      const previous = filledResult[filledResult.length -1]; // Use last element from filledResult for correct interpolation base

      if (!current || !previous) continue; // Should not happen due to logic flow
      
      // Check if there's a gap
      const timeDiff = current.timestamp - previous.timestamp;
      if (timeDiff > timeStep * 1.5) { // Consider 1.5 as a threshold to define a gap
        // Calculate how many periods should be in between
        const periodsToAdd = Math.max(0, Math.floor(timeDiff / timeStep) - 1);
        
        for (let j = 1; j <= periodsToAdd; j++) {
          const interpolationFactor = j / (periodsToAdd + 1);
          const interpolatedTimestamp = previous.timestamp + (timeDiff * interpolationFactor); // timeDiff is current - previous
          
          // Generate interpolated data point
          const interpolatedPoint: ChartDataPoint = {
            timestamp: interpolatedTimestamp,
            formattedTime: IxTime.formatIxTime(interpolatedTimestamp),
            period: this.generatePeriodKey(interpolatedTimestamp, resolution),
            gameYear: IxTime.getCurrentGameYear(interpolatedTimestamp),
            isHistorical: true, // Interpolated points are considered historical estimates
            isForecast: false,
            isPresent: false,
            isEpoch: Math.abs(interpolatedTimestamp - IxTime.getInGameEpoch()) < 86400000,
          };
          
          // Linearly interpolate numeric values
          const numericProperties: (keyof ChartDataPoint)[] = [
            'population', 'gdpPerCapita', 'totalGdp', 
            'populationDensity', 'gdpDensity'
          ];
          
          numericProperties.forEach(prop => {
            // MODIFIED: Safer access and type check for interpolation
            const prevVal = previous[prop];
            const currVal = current[prop];

            if (prevVal != null && currVal != null && typeof prevVal === 'number' && typeof currVal === 'number' && isFinite(prevVal) && isFinite(currVal)) {
              (interpolatedPoint as any)[prop] = prevVal + (currVal - prevVal) * interpolationFactor;
            } else if (prevVal != null && typeof prevVal === 'number' && isFinite(prevVal)) { // If current is null, carry over previous
                (interpolatedPoint as any)[prop] = prevVal;
            } else {
                (interpolatedPoint as any)[prop] = null; // Default to null if interpolation not possible
            }
          });
          
          filledResult.push(interpolatedPoint);
        }
      }
      if (current) { // Explicit check
        filledResult.push(current);
      }
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