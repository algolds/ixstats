// src/components/charts/CountryChart.tsx
import React, { useMemo, useState } from "react";
import { Globe, TrendingUp, AlertTriangle, Info } from "lucide-react";
import { SyncedChart } from "./SyncedChart";
import { useIxStats } from "~/context/ixstats-context";
import { ChartDataProcessor } from "~/lib/chart-data-processor";
import type { ChartDataPoint, HistoricalDataPoint, ProcessingOptions } from "~/lib/chart-data-processor";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "~/components/ui/card";
import { IxTime } from "~/lib/ixtime";

export type CountryChartView = 'overview' | 'population' | 'gdp' | 'density';

export interface CountryChartProps {
  countryName: string;
  historicalData: HistoricalDataPoint[];
  targetTime: number;
  chartView: CountryChartView;
  forecastYears?: number;
  populationGrowthRate: number;
  gdpGrowthRate: number;
  landArea?: number | null;
  isLoading?: boolean;
  isLoadingForecast?: boolean;
  controls?: boolean;
  onPointSelect?: (point: ChartDataPoint) => void;
  className?: string;
}

export const CountryChart: React.FC<CountryChartProps> = ({
  countryName,
  historicalData,
  targetTime,
  chartView = 'overview',
  forecastYears = 0,
  populationGrowthRate = 0.01,
  gdpGrowthRate = 0.025,
  landArea = null,
  isLoading = false,
  isLoadingForecast = false,
  controls = true,
  onPointSelect,
  className = "",
}) => {
  const { 
    timeResolution, 
    showForecast, 
    setShowForecast, 
    showDensity, 
    setShowDensity 
  } = useIxStats();
  
  // Calculate processing options
  const processingOptions: ProcessingOptions = useMemo(() => {
    const gameEpoch = IxTime.getInGameEpoch();
    const startTime = IxTime.addYears(targetTime, -10); // Default to 10 years before target
    
    return {
      startTime,
      endTime: targetTime,
      referenceTime: targetTime,
      resolution: timeResolution,
      fillGaps: true,
      normalizePopulation: true,
      normalizeTotalGdp: true,
      normalizeGdpDensity: true,
      includeForecast: showForecast && forecastYears > 0,
      forecastYears: forecastYears,
      populationGrowthRate,
      gdpGrowthRate,
      extrapolateFromLastPoint: true,
    };
  }, [targetTime, timeResolution, showForecast, forecastYears, populationGrowthRate, gdpGrowthRate]);

  // Process data for charts
  const chartData = useMemo(() => {
    if (!historicalData || historicalData.length === 0) {
      return [];
    }
    
    // Process historical data
    const processedHistorical = ChartDataProcessor.processHistoricalData(historicalData, processingOptions);
    
    // Generate forecast data if needed
    let processedForecast: ChartDataPoint[] = [];
    if (processingOptions.includeForecast && forecastYears > 0) {
      processedForecast = ChartDataProcessor.generateForecastData(processedHistorical, processingOptions);
    }
    
    // Combine historical and forecast data
    return ChartDataProcessor.combineHistoricalAndForecast(processedHistorical, processedForecast);
  }, [historicalData, processingOptions, forecastYears]);

  // Handle point click
  const handlePointClick = (point: ChartDataPoint) => {
    if (onPointSelect) {
      onPointSelect(point);
    }
  };

  // Configure chart based on view type
  const getChartConfig = () => {
    switch (chartView) {
      case 'population':
        return {
          chartType: 'area' as const,
          chartSubType: 'population',
          showDensity: showDensity && !!landArea,
          yAxisDataKey: showDensity ? "populationDensity" : "population",
          chartTitle: showDensity ? "Population Density Trends" : "Population Trends",
          chartDescription: showDensity 
            ? `Population density per km² for ${countryName}` 
            : `Population trends for ${countryName} in millions`,
        };
        
      case 'gdp':
        return {
          chartType: 'composed' as const,
          chartSubType: 'gdp',
          showDensity: false, // Always show GDP/capita and total GDP
          yAxisDataKey: "gdpPerCapita",
          secondaryYAxisDataKey: "totalGdp",
          chartTitle: "GDP Analysis",
          chartDescription: `GDP per capita and total GDP trends for ${countryName}`,
        };
        
      case 'density':
        if (!landArea) {
          return {
            chartType: 'line' as const,
            chartSubType: 'missing',
            showDensity: false,
            yAxisDataKey: "population",
            chartTitle: "Density Analysis Unavailable",
            chartDescription: "Land area data is required for density calculations",
            showError: true,
          };
        }
        
        return {
          chartType: 'composed' as const,
          chartSubType: 'density',
          showDensity: true,
          yAxisDataKey: "populationDensity",
          secondaryYAxisDataKey: "gdpDensity",
          chartTitle: "Density Analysis",
          chartDescription: `Population and GDP density metrics for ${countryName}`,
        };
        
      case 'overview':
      default:
        return {
          chartType: 'composed' as const,
          chartSubType: 'overview',
          showDensity: false,
          yAxisDataKey: "population",
          secondaryYAxisDataKey: "gdpPerCapita",
          chartTitle: "Economic Overview",
          chartDescription: `Combined population and GDP per capita trends for ${countryName}`,
        };
    }
  };
  
  const config = getChartConfig();

  // Show loading or error state
  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>{config.chartTitle}</CardTitle>
          <CardDescription>{config.chartDescription}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-80 flex items-center justify-center">
            <div className="animate-pulse text-center">
              <div className="h-80 w-full bg-muted rounded-md flex items-center justify-center">
                <p className="text-muted-foreground">Loading chart data...</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }
  
  if (config.showError) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>{config.chartTitle}</CardTitle>
          <CardDescription>{config.chartDescription}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-80 flex items-center justify-center text-center">
            <div className="flex flex-col items-center max-w-md">
              <AlertTriangle className="h-12 w-12 text-amber-500 mb-4" />
              <h3 className="text-lg font-semibold mb-2">Land Area Data Missing</h3>
              <p className="text-muted-foreground mb-4">
                This country doesn't have land area data, which is required for density calculations.
              </p>
              <Button onClick={() => onPointSelect?.({
                timestamp: targetTime,
                formattedTime: IxTime.formatIxTime(targetTime),
                period: ChartDataProcessor.formatTimestamp(targetTime, timeResolution),
                gameYear: IxTime.getCurrentGameYear(targetTime),
                isHistorical: true,
                isForecast: false,
                isPresent: true,
                isEpoch: false,
              })}>
                View Other Charts
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (chartData.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>{config.chartTitle}</CardTitle>
          <CardDescription>{config.chartDescription}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-80 flex items-center justify-center text-center">
            <div className="flex flex-col items-center max-w-md">
              <AlertTriangle className="h-12 w-12 text-amber-500 mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Data Available</h3>
              <p className="text-muted-foreground mb-4">
                No historical data is available for the selected time period.
              </p>
              <p className="text-sm text-muted-foreground">
                Try adjusting the time period or resolution.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>{config.chartTitle}</CardTitle>
        <CardDescription>{config.chartDescription}</CardDescription>
      </CardHeader>
      <CardContent>
        {controls && (
          <div className="flex justify-end mb-2 gap-2">
            {chartView === 'population' && landArea ? (
              <Button
                variant={showDensity ? "default" : "outline"}
                size="sm"
                onClick={() => setShowDensity(!showDensity)}
              >
                <Globe className="h-3.5 w-3.5 mr-1.5" />
                Density
              </Button>
            ) : null}
            
            <Button
              variant={showForecast ? "default" : "outline"}
              size="sm"
              onClick={() => setShowForecast(!showForecast)}
              disabled={forecastYears === 0}
            >
              <TrendingUp className="h-3.5 w-3.5 mr-1.5" />
              Forecast
            </Button>
          </div>
        )}
        
        <div className="h-80">
          <SyncedChart
            data={chartData}
            chartType={config.chartType}
            chartSubType={config.chartSubType}
            showDensity={config.showDensity}
            showForecast={showForecast && forecastYears > 0}
            height="100%"
            width="100%"
            yAxisDataKey={config.yAxisDataKey}
            secondaryYAxisDataKey={config.secondaryYAxisDataKey}
            onPointClick={handlePointClick}
          />
        </div>
        
        <div className="mt-4 text-xs text-muted-foreground flex items-start">
          <Info className="h-3.5 w-3.5 mr-1.5 mt-0.5 flex-shrink-0" />
          <p>
            Data aligned with IxTime system. Historical data from game epoch (Jan 1, 2028)
            {showForecast && forecastYears > 0 && (
              <> with {forecastYears}-year forecast using {(populationGrowthRate * 100).toFixed(1)}% population growth 
              and {(gdpGrowthRate * 100).toFixed(1)}% GDP growth</>
            )}.
          </p>
        </div>
      </CardContent>
    </Card>
  );
};