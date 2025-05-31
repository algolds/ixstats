// src/context/chart-context.tsx
import React, { createContext, useContext, useState, useEffect, useMemo } from "react";
import { IxTime } from "~/lib/ixtime";
import { ChartDataProcessor, ProcessingOptions, ChartDataPoint } from "~/lib/chart-data-processor";
import type { TimeResolutionType } from "~/context/ixstats-context";
import type { HistoricalDataPoint } from "~/types/ixstats";

interface ChartContextType {
  // Chart data state
  chartData: ChartDataPoint[];
  isLoading: boolean;
  error: string | null;
  
  // Time control
  currentTime: number;
  setCurrentTime: (time: number) => void;
  
  // Chart configuration
  chartType: ChartType;
  setChartType: (type: ChartType) => void;
  timeResolution: TimeResolutionType;
  setTimeResolution: (resolution: TimeResolutionType) => void;
  
  // Data loading
  loadHistoricalData: (countryId: string, options?: Partial<ProcessingOptions>) => Promise<void>;
  
  // Forecast control
  showForecast: boolean;
  setShowForecast: (show: boolean) => void;
  forecastYears: number;
  setForecastYears: (years: number) => void;
  
  // Chart specific settings
  normalizeValues: boolean;
  setNormalizeValues: (normalize: boolean) => void;
}

export type ChartType = 'overview' | 'population' | 'gdp' | 'gdpPerCapita' | 'density';

const ChartContext = createContext<ChartContextType | undefined>(undefined);

export function ChartProvider({ children }: { children: React.ReactNode }) {
  // Chart state
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [historicalData, setHistoricalData] = useState<HistoricalDataPoint[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Time control
  const [currentTime, setCurrentTime] = useState(IxTime.getCurrentIxTime());
  
  // Chart configuration
  const [chartType, setChartType] = useState<ChartType>('overview');
  const [timeResolution, setTimeResolution] = useState<TimeResolutionType>('annual');
  
  // Forecast settings
  const [showForecast, setShowForecast] = useState(false);
  const [forecastYears, setForecastYears] = useState(5);
  
  // Display settings
  const [normalizeValues, setNormalizeValues] = useState(true);
  
  // Load historical data for a country
  const loadHistoricalData = async (countryId: string, options?: Partial<ProcessingOptions>) => {
    setIsLoading(true);
    setError(null);
    
    try {
      // This would be replaced with your actual API call
      const response = await fetch(`/api/countries/${countryId}/historical`);
      
      if (!response.ok) {
        throw new Error('Failed to load historical data');
      }
      
      const data: HistoricalDataPoint[] = await response.json();
      setHistoricalData(data);
      
      // Process the data with chart processor
      const processingOptions: ProcessingOptions = {
        resolution: timeResolution,
        normalizePopulation: normalizeValues,
        normalizeTotalGdp: normalizeValues,
        normalizeGdpDensity: normalizeValues,
        ...options
      };
      
      const processedData = ChartDataProcessor.processHistoricalData(data, processingOptions);
      
      if (showForecast) {
        const forecastData = ChartDataProcessor.generateForecastData(processedData, {
          ...processingOptions,
          forecastYears
        });
        
        const combinedData = ChartDataProcessor.combineHistoricalAndForecast(
          processedData, 
          forecastData
        );
        
        setChartData(combinedData);
      } else {
        setChartData(processedData);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
    } finally {
      setIsLoading(false);
    }
  };
  
  // Recalculate chart data when key dependencies change
  useEffect(() => {
    if (historicalData.length > 0) {
      const processingOptions: ProcessingOptions = {
        resolution: timeResolution,
        normalizePopulation: normalizeValues,
        normalizeTotalGdp: normalizeValues,
        normalizeGdpDensity: normalizeValues,
        referenceTime: currentTime
      };
      
      const processedData = ChartDataProcessor.processHistoricalData(
        historicalData, 
        processingOptions
      );
      
      if (showForecast) {
        const forecastData = ChartDataProcessor.generateForecastData(
          processedData, 
          {
            ...processingOptions,
            forecastYears
          }
        );
        
        const combinedData = ChartDataProcessor.combineHistoricalAndForecast(
          processedData, 
          forecastData
        );
        
        setChartData(combinedData);
      } else {
        setChartData(processedData);
      }
    }
  }, [timeResolution, normalizeValues, showForecast, forecastYears, currentTime, historicalData]);
  
  const value = {
    chartData,
    isLoading,
    error,
    currentTime,
    setCurrentTime,
    chartType,
    setChartType,
    timeResolution,
    setTimeResolution,
    loadHistoricalData,
    showForecast,
    setShowForecast,
    forecastYears,
    setForecastYears,
    normalizeValues,
    setNormalizeValues
  };
  
  return (
    <ChartContext.Provider value={value}>
      {children}
    </ChartContext.Provider>
  );
}

export const useChartContext = () => {
  const context = useContext(ChartContext);
  if (context === undefined) {
    throw new Error('useChartContext must be used within a ChartProvider');
  }
  return context;
};
