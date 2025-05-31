// src/components/charts/CountryForecast.tsx
import React, { useMemo } from "react";
import { TrendingUp, AlertTriangle, Info, Target } from "lucide-react";
import { IxTime } from "~/lib/ixtime";
import { useIxStats } from "~/context/ixstats-context";
import { ChartDataProcessor } from "~/lib/chart-data-processor";
import type { ChartDataPoint, ProcessingOptions } from "~/lib/chart-data-processor";
import { SyncedChart } from "./SyncedChart";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";

export interface CountryForecastProps {
  countryName: string;
  baseTime: number;
  basePopulation: number;
  baseGdpPerCapita: number;
  baseTotalGdp: number;
  populationGrowthRate: number;
  gdpGrowthRate: number;
  economicTier: string;
  populationTier: string;
  forecastYears?: number;
  isLoading?: boolean;
  className?: string;
}

export const CountryForecast: React.FC<CountryForecastProps> = ({
  countryName,
  baseTime,
  basePopulation,
  baseGdpPerCapita,
  baseTotalGdp,
  populationGrowthRate,
  gdpGrowthRate,
  economicTier,
  populationTier,
  forecastYears = 10,
  isLoading = false,
  className = "",
}) => {
  const { timeResolution } = useIxStats();

  // Generate forecast data
  const forecastData = useMemo(() => {
    if (forecastYears <= 0) return [];
    
    // Create a base data point representing current state
    const basePoint: ChartDataPoint = {
      timestamp: baseTime,
      formattedTime: IxTime.formatIxTime(baseTime),
      period: ChartDataProcessor.formatTimestamp(baseTime, timeResolution),
      gameYear: IxTime.getCurrentGameYear(baseTime),
      population: basePopulation / 1000000, // Convert to millions
      gdpPerCapita: baseGdpPerCapita,
      totalGdp: baseTotalGdp / 1000000000, // Convert to billions
      isHistorical: true,
      isForecast: false,
      isPresent: true,
      isEpoch: false,
    };
    
    // Set up forecast options
    const options: ProcessingOptions = {
      startTime: baseTime,
      endTime: IxTime.addYears(baseTime, forecastYears),
      referenceTime: baseTime,
      resolution: timeResolution,
      forecastYears,
      populationGrowthRate,
      gdpGrowthRate,
      normalizePopulation: true,
      normalizeTotalGdp: true,
      extrapolateFromLastPoint: true,
    };
    
    // Generate forecast points from the base point
    const forecastPoints = ChartDataProcessor.generateForecastData([basePoint], options);
    
    // Add the base point to the beginning
    return [basePoint, ...forecastPoints];
  }, [
    baseTime, basePopulation, baseGdpPerCapita, baseTotalGdp, 
    populationGrowthRate, gdpGrowthRate, forecastYears, timeResolution
  ]);

  // Calculate compound annual growth rates (CAGR)
  const forecastAnalysis = useMemo(() => {
    if (forecastData.length < 2) return null;
    
    const firstPoint = forecastData[0]!;
    const lastPoint = forecastData[forecastData.length - 1]!;
    const actualForecastYears = IxTime.getYearsBetween(firstPoint.timestamp, lastPoint.timestamp);
    
    if (actualForecastYears <= 0) return null;
    
    // Calculate CAGR values
    const popCAGR = Math.pow((lastPoint.population! * 1000000) / (firstPoint.population! * 1000000), 1 / actualForecastYears) - 1;
    const gdpPerCapitaCAGR = Math.pow(lastPoint.gdpPerCapita! / firstPoint.gdpPerCapita!, 1 / actualForecastYears) - 1;
    const totalGdpCAGR = Math.pow((lastPoint.totalGdp! * 1000000000) / (firstPoint.totalGdp! * 1000000000), 1 / actualForecastYears) - 1;
    
    return {
      populationCAGR: popCAGR * 100, // Convert to percentage
      gdpPerCapitaCAGR: gdpPerCapitaCAGR * 100,
      totalGdpCAGR: totalGdpCAGR * 100,
      finalPopulation: lastPoint.population,
      finalGdpPerCapita: lastPoint.gdpPerCapita,
      finalTotalGdp: lastPoint.totalGdp,
      finalYear: lastPoint.gameYear,
      actualForecastYears,
    };
  }, [forecastData]);

  // Format numbers for display
  const formatMetric = (value: number | undefined, type: 'population' | 'gdp' | 'total' | 'percentage'): string => {
    if (value === undefined || isNaN(value) || !isFinite(value)) return 'N/A';
    
    switch (type) {
      case 'population':
        return `${value.toFixed(1)}M`;
      case 'gdp':
        return `$${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
      case 'total':
        return `$${value.toFixed(1)}B`;
      case 'percentage':
        return `${value.toFixed(1)}%`;
      default:
        return value.toString();
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader>
          <div className="animate-pulse">
            <div className="h-6 bg-muted rounded w-2/3 mb-2"></div>
            <div className="h-4 bg-muted rounded w-4/5"></div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            {[1, 2, 3].map(i => (
              <div key={i} className="animate-pulse">
                <div className="h-24 bg-muted rounded"></div>
              </div>
            ))}
          </div>
          <div className="animate-pulse">
            <div className="h-80 bg-muted rounded"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Handle case with no forecast years
  if (forecastYears <= 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center">
            <TrendingUp className="h-5 w-5 mr-2 text-primary" />
            Economic Forecast
          </CardTitle>
          <CardDescription>
            No forecast period selected.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-40 flex items-center justify-center text-center">
            <div className="flex flex-col items-center max-w-md">
              <AlertTriangle className="h-12 w-12 text-amber-500 mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Forecast Available</h3>
              <p className="text-muted-foreground mb-4">
                Adjust the forecast period to see economic projections for {countryName}.
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
        <CardTitle className="flex items-center">
          <TrendingUp className="h-5 w-5 mr-2 text-primary" />
          {forecastYears}-Year Economic Forecast
        </CardTitle>
        <CardDescription>
          Projected economic indicators for {countryName} starting from {IxTime.formatIxTime(baseTime)}.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {forecastAnalysis && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6 text-center">
            <div className="p-3 bg-muted/50 rounded-lg">
              <p className="text-xs text-muted-foreground">Population CAGR</p>
              <p className="text-xl font-semibold text-green-600 dark:text-green-400">
                {formatMetric(forecastAnalysis.populationCAGR, 'percentage')}
              </p>
              <p className="text-xs text-muted-foreground">
                To {formatMetric(forecastAnalysis.finalPopulation, 'population')} by {forecastAnalysis.finalYear}
              </p>
            </div>
            <div className="p-3 bg-muted/50 rounded-lg">
              <p className="text-xs text-muted-foreground">GDP p.c. CAGR</p>
              <p className="text-xl font-semibold text-indigo-600 dark:text-indigo-400">
                {formatMetric(forecastAnalysis.gdpPerCapitaCAGR, 'percentage')}
              </p>
              <p className="text-xs text-muted-foreground">
                To {formatMetric(forecastAnalysis.finalGdpPerCapita, 'gdp')} by {forecastAnalysis.finalYear}
              </p>
            </div>
            <div className="p-3 bg-muted/50 rounded-lg">
              <p className="text-xs text-muted-foreground">Total GDP CAGR</p>
              <p className="text-xl font-semibold text-blue-600 dark:text-blue-400">
                {formatMetric(forecastAnalysis.totalGdpCAGR, 'percentage')}
              </p>
              <p className="text-xs text-muted-foreground">
                To {formatMetric(forecastAnalysis.finalTotalGdp, 'total')} by {forecastAnalysis.finalYear}
              </p>
            </div>
          </div>
        )}

        <div className="h-80">
          <SyncedChart
            data={forecastData}
            chartType="composed"
            chartSubType="overview"
            showForecast={true}
            showEpochLine={true}
            showPresentLine={false} // Base time is the present reference
            height="100%"
            width="100%"
          />
        </div>
      </CardContent>
      <CardFooter className="pt-4 flex flex-col sm:flex-row items-start sm:items-center justify-between">
        <div className="text-xs text-muted-foreground flex items-start mb-2 sm:mb-0">
          <Info className="h-3.5 w-3.5 mr-1.5 flex-shrink-0 mt-0.5" />
          <p>Projections based on annual growth rates: {(populationGrowthRate * 100).toFixed(1)}% population, {(gdpGrowthRate * 100).toFixed(1)}% GDP</p>
        </div>
        
        <div className="flex flex-wrap gap-1">
          <Badge variant="outline" className="text-xs">{economicTier}</Badge>
          <Badge variant="outline" className="text-xs">{populationTier}</Badge>
        </div>
      </CardFooter>
    </Card>
  );
};