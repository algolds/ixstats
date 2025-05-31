// src/lib/chart-data-processor-ixtime.ts
import { IxTime } from "~/lib/ixtime";
import type { CountryDetailData } from "~/app/countries/[id]/page";

export interface IxChartDataPoint {
  timestamp: number;
  period: string;
  gameYear: number;
  formattedTime: string;
  
  // Data points
  population?: number;
  gdpPerCapita?: number;
  totalGdp?: number;
  populationDensity?: number | null;
  gdpDensity?: number | null;
  
  // Source flags
  isHistorical: boolean;
  isForecast: boolean;
  isPresent: boolean;
  isEpoch: boolean;
}

export interface IxChartProcessingOptions {
  normalizePopulation?: boolean;
  normalizeTotalGdp?: boolean;
  normalizeGdpDensity?: boolean;
  startTime?: number;
  endTime?: number;
  timeResolution: 'quarterly' | 'annual';
  forecastYears?: number;
}

export class IxChartDataProcessor {
  /**
   * Process historical data into chart data points
   */
  static processHistoricalData(
    countryData: CountryDetailData,
    options: IxChartProcessingOptions
  ): IxChartDataPoint[] {
    if (!countryData.historicalData || countryData.historicalData.length === 0) {
      return [];
    }
    
    const {
      normalizePopulation = true,
      normalizeTotalGdp = true,
      normalizeGdpDensity = true,
      startTime,
      endTime = IxTime.getCurrentIxTime(),
      timeResolution = 'annual'
    } = options;
    
    const currentTime = IxTime.getCurrentIxTime();
    const epochTime = IxTime.getInGameEpoch();
    
    // Process historical data points
    const historicalPoints = countryData.historicalData
      .filter(point => !startTime || point.ixTimeTimestamp >= startTime)
      .filter(point => point.ixTimeTimestamp <= endTime)
      .map(point => {
        const gameYear = IxTime.getCurrentGameYear(point.ixTimeTimestamp);
        const period = this.generatePeriodKey(point.ixTimeTimestamp, timeResolution);
        
        return {
          timestamp: point.ixTimeTimestamp,
          period,
          gameYear,
          formattedTime: IxTime.formatIxTime(point.ixTimeTimestamp),
          
          population: normalizePopulation ? point.population / 1000000 : point.population,
          gdpPerCapita: point.gdpPerCapita,
          totalGdp: normalizeTotalGdp ? point.totalGdp / 1000000000 : point.totalGdp,
          populationDensity: point.populationDensity,
          gdpDensity: normalizeGdpDensity && point.gdpDensity ? point.gdpDensity / 1000000 : point.gdpDensity,
          
          isHistorical: true,
          isForecast: false,
          isPresent: Math.abs(point.ixTimeTimestamp - currentTime) < 86400000,
          isEpoch: Math.abs(point.ixTimeTimestamp - epochTime) < 86400000
        } as IxChartDataPoint;
      });
    
    // Group by period and aggregate
    const groupedData = this.groupAndAggregate(historicalPoints, timeResolution);
    
    return groupedData;
  }
  
  /**
   * Process forecast data into chart data points
   */
  static processForecastData(
    countryData: CountryDetailData,
    options: IxChartProcessingOptions
  ): IxChartDataPoint[] {
    if (!countryData.forecastDataPoints || countryData.forecastDataPoints.length === 0) {
      return [];
    }
    
    const {
      normalizePopulation = true,
      normalizeTotalGdp = true,
      normalizeGdpDensity = true,
      timeResolution = 'annual'
    } = options;
    
    const currentTime = IxTime.getCurrentIxTime();
    const epochTime = IxTime.getInGameEpoch();
    
    // Process forecast data points
    const forecastPoints = countryData.forecastDataPoints.map(point => {
      const period = point.year.toString();
      
      return {
        timestamp: point.ixTime,
        period,
        gameYear: point.year,
        formattedTime: IxTime.formatIxTime(point.ixTime),
        
        population: normalizePopulation ? point.population / 1000000 : point.population,
        gdpPerCapita: point.gdpPerCapita,
        totalGdp: normalizeTotalGdp ? point.totalGdp / 1000000000 : point.totalGdp,
        populationDensity: point.populationDensity,
        gdpDensity: normalizeGdpDensity && point.gdpDensity ? point.gdpDensity / 1000000 : point.gdpDensity,
        
        isHistorical: false,
        isForecast: true,
        isPresent: Math.abs(point.ixTime - currentTime) < 86400000,
        isEpoch: Math.abs(point.ixTime - epochTime) < 86400000
      } as IxChartDataPoint;
    });
    
    // Group by period if quarterly resolution is selected
    if (timeResolution === 'quarterly') {
      return this.groupAndAggregate(forecastPoints, timeResolution);
    }
    
    return forecastPoints;
  }
  
  /**
   * Combine historical and forecast data
   */
  static combineHistoricalAndForecast(
    historicalData: IxChartDataPoint[],
    forecastData: IxChartDataPoint[]
  ): IxChartDataPoint[] {
    // Create a map to deduplicate by period
    const dataMap = new Map<string, IxChartDataPoint>();
    
    // Add historical data first
    historicalData.forEach(point => {
      dataMap.set(point.period, point);
    });
    
    // Add forecast data, overriding historical if same period
    forecastData.forEach(point => {
      dataMap.set(point.period, {
        ...point,
        isHistorical: false,
        isForecast: true
      });
    });
    
    // Convert back to array and sort by timestamp
    return Array.from(dataMap.values())
      .sort((a, b) => a.timestamp - b.timestamp);
  }
  
  /**
   * Generate a period key from a timestamp
   */
  private static generatePeriodKey(timestamp: number, resolution: 'quarterly' | 'annual'): string {
    const date = new Date(timestamp);
    const year = date.getUTCFullYear();
    
    if (resolution === 'quarterly') {
      const quarter = Math.floor(date.getUTCMonth() / 3) + 1;
      return `${year}-Q${quarter}`;
    }
    
    return year.toString();
  }
  
  /**
   * Group data points by period and aggregate values
   */
  private static groupAndAggregate(
    dataPoints: IxChartDataPoint[], 
    resolution: 'quarterly' | 'annual'
  ): IxChartDataPoint[] {
    // Group by period
    const groupedByPeriod = new Map<string, IxChartDataPoint[]>();
    
    dataPoints.forEach(point => {
      const period = resolution === 'quarterly' 
        ? this.generatePeriodKey(point.timestamp, 'quarterly')
        : point.gameYear.toString();
      
      if (!groupedByPeriod.has(period)) {
        groupedByPeriod.set(period, []);
      }
      
      groupedByPeriod.get(period)!.push(point);
    });
    
    // Aggregate data in each group
    const aggregatedData: IxChartDataPoint[] = [];
    
    groupedByPeriod.forEach((points, period) => {
      if (points.length === 0) return;
      
      // Use the median timestamp as the representative timestamp
      points.sort((a, b) => a.timestamp - b.timestamp);
      const medianPoint = points[Math.floor(points.length / 2)];
      
      // Calculate averages for numeric values
      const aggregated: IxChartDataPoint = {
        timestamp: medianPoint.timestamp,
        period,
        gameYear: medianPoint.gameYear,
        formattedTime: medianPoint.formattedTime,
        
        population: this.calculateAverage(points, 'population'),
        gdpPerCapita: this.calculateAverage(points, 'gdpPerCapita'),
        totalGdp: this.calculateAverage(points, 'totalGdp'),
        populationDensity: this.calculateAverage(points, 'populationDensity'),
        gdpDensity: this.calculateAverage(points, 'gdpDensity'),
        
        isHistorical: points.some(p => p.isHistorical),
        isForecast: points.some(p => p.isForecast),
        isPresent: points.some(p => p.isPresent),
        isEpoch: points.some(p => p.isEpoch)
      };
      
      aggregatedData.push(aggregated);
    });
    
    // Sort by timestamp
    return aggregatedData.sort((a, b) => a.timestamp - b.timestamp);
  }
  
  /**
   * Calculate the average of a numeric property across data points
   */
  private static calculateAverage(
    points: IxChartDataPoint[], 
    property: keyof IxChartDataPoint
  ): number | undefined | null {
    const validPoints = points.filter(p => 
      p[property] !== undefined && 
      p[property] !== null && 
      typeof p[property] === 'number'
    );
    
    if (validPoints.length === 0) return undefined;
    
    // Sum all valid values
    const sum = validPoints.reduce((acc, point) => {
      const value = point[property] as number;
      return acc + value;
    }, 0);
    
    // Return the average
    return sum / validPoints.length;
  }
}
