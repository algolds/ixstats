// src/app/countries/_components/charts/CountryAtGlance.tsx
"use client";

import { useMemo, useState } from "react";
import { Activity, AlertTriangle, BarChart3, Loader2 } from "lucide-react";
import { useTheme } from "~/context/theme-context";
import { IxTime } from "~/lib/ixtime";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import type { ChartType } from "../detail";
import { CountryDashboard } from "./CountryDashboard";
import { ChartDisplay } from "./ChartDisplay";
import { CountryStats } from "./CountryStats";

// Types remain mostly the same as original component
interface CountryData {
  id: string;
  name: string;
  currentPopulation: number;
  currentGdpPerCapita: number;
  currentTotalGdp: number;
  populationGrowthRate: number;
  adjustedGdpGrowth: number;
  economicTier: string;
  populationTier: string;
  landArea?: number | null;
  populationDensity?: number | null;
  gdpDensity?: number | null;
  governmentType?: string | null;
  leader?: string | null;
  religion?: string | null;
}

interface HistoricalDataPoint {
  ixTimeTimestamp: number;
  population: number;
  gdpPerCapita: number;
  totalGdp: number;
  populationDensity?: number | null;
  gdpDensity?: number | null;
}

interface ChartPoint {
  period: string;
  date: string;
  ixTimeTimestamp: number;
  population?: number;
  gdpPerCapita?: number;
  totalGdp?: number;
  populationDensity?: number | null;
  gdpDensity?: number | null;
  isForecast?: boolean;
  historicalPopulation?: number;
  forecastPopulation?: number;
  historicalGdpPerCapita?: number;
  forecastGdpPerCapita?: number;
  historicalTotalGdp?: number;
  forecastTotalGdp?: number;
  historicalPopulationDensity?: number;
  forecastPopulationDensity?: number;
  historicalGdpDensity?: number;
  forecastGdpDensity?: number;
}

type TimeResolutionType = 'quarterly' | 'annual';

interface CountryAtGlanceProps {
  country: CountryData;
  historicalData?: HistoricalDataPoint[];
  targetTime: number;
  forecastYears: number;
  isLoading?: boolean;
  isLoadingForecast?: boolean;
  chartView?: ChartType;
  timeResolution?: TimeResolutionType;
  showForecastInHistorical?: boolean;
  onTimeResolutionChange: (resolution: TimeResolutionType) => void;
  onChartViewChange: (view: ChartType) => void;
}

export function CountryAtGlance({
  country,
  historicalData = [],
  targetTime,
  forecastYears,
  isLoading = false,
  isLoadingForecast = false,
  chartView = 'overview',
  timeResolution = 'annual',
  showForecastInHistorical = true,
  onTimeResolutionChange,
  onChartViewChange,
}: CountryAtGlanceProps) {
  const { theme } = useTheme();
  const [showForecast, setShowForecast] = useState(true);
  const [showDensity, setShowDensity] = useState(false);

  // Improved historical data processing
  const historicalChartData = useMemo(() => {
    if (!historicalData || historicalData.length === 0) return [];

    // Calculate a longer time window for better time series display
    const timeWindowYears = timeResolution === 'quarterly' ? 2 : 10;
    const windowStartTime = IxTime.addYears(targetTime, -timeWindowYears);

    // Filter and validate data
    const validData = historicalData
      .filter(point => {
        return (
          point.ixTimeTimestamp >= windowStartTime && 
          point.ixTimeTimestamp <= targetTime &&
          isFinite(point.population) &&
          isFinite(point.gdpPerCapita) &&
          isFinite(point.totalGdp)
        );
      })
      .sort((a, b) => a.ixTimeTimestamp - b.ixTimeTimestamp);

    if (!validData.length) return [];

    // Group data by time period for aggregation
    const groupedData = new Map<string, {
      points: HistoricalDataPoint[];
      avgTimestamp: number;
      periodKey: string;
    }>();

    validData.forEach(point => {
      const date = new Date(point.ixTimeTimestamp);
      let periodKey: string;
      
      if (timeResolution === 'quarterly') {
        const quarter = Math.floor(date.getUTCMonth() / 3) + 1;
        const year = date.getUTCFullYear();
        periodKey = `${year}-Q${quarter}`;
      } else {
        periodKey = date.getUTCFullYear().toString();
      }
      
      if (!groupedData.has(periodKey)) {
        groupedData.set(periodKey, {
          points: [],
          avgTimestamp: 0,
          periodKey
        });
      }
      
      groupedData.get(periodKey)!.points.push(point);
    });

    // Convert grouped data to chart points with proper averaging
    return Array.from(groupedData.entries()).map(([periodKey, group]) => {
      const points = group.points;
      const count = points.length;
      
      if (count === 0) return null;
      
      // Calculate averages
      const avgTimestamp = points.reduce((sum, p) => sum + p.ixTimeTimestamp, 0) / count;
      const avgPopulation = points.reduce((sum, p) => sum + p.population, 0) / count;
      const avgGdpPerCapita = points.reduce((sum, p) => sum + p.gdpPerCapita, 0) / count;
      const avgTotalGdp = points.reduce((sum, p) => sum + p.totalGdp, 0) / count;
      
      // Handle optional density data
      const densityPoints = points.filter(p => 
        p.populationDensity != null && isFinite(p.populationDensity) &&
        p.gdpDensity != null && isFinite(p.gdpDensity)
      );
      
      const avgPopDensity = densityPoints.length > 0 
        ? densityPoints.reduce((sum, p) => sum + (p.populationDensity || 0), 0) / densityPoints.length
        : undefined;
        
      const avgGdpDensity = densityPoints.length > 0 
        ? densityPoints.reduce((sum, p) => sum + (p.gdpDensity || 0), 0) / densityPoints.length
        : undefined;

      return {
        period: periodKey,
        date: periodKey,
        ixTimeTimestamp: avgTimestamp,
        population: avgPopulation / 1000000, // Convert to millions
        gdpPerCapita: avgGdpPerCapita,
        totalGdp: avgTotalGdp / 1000000000, // Convert to billions
        populationDensity: avgPopDensity,
        gdpDensity: avgGdpDensity ? avgGdpDensity / 1000000 : undefined, // Convert to millions
        isForecast: false,
      };
    })
    .filter((point): point is NonNullable<typeof point> => point !== null)
    .sort((a, b) => a.ixTimeTimestamp - b.ixTimeTimestamp);

  }, [historicalData, targetTime, timeResolution]);

  // Improved forecast data generation
  const forecastChartData = useMemo(() => {
    if (!showForecastInHistorical || forecastYears === 0) return [];

    // Get the base point for forecasting
    let basePoint: ChartPoint;
    
    if (historicalChartData.length > 0) {
      // Use the last historical point
      basePoint = historicalChartData[historicalChartData.length - 1]!;
    } else {
      // Create base point from current country data
      const currentYear = IxTime.getCurrentGameYear(targetTime);
      const periodKey = timeResolution === 'quarterly' 
        ? `${currentYear}-Q${Math.floor(new Date(targetTime).getUTCMonth() / 3) + 1}`
        : currentYear.toString();
        
      basePoint = {
        period: periodKey,
        date: periodKey,
        population: country.currentPopulation / 1000000,
        gdpPerCapita: country.currentGdpPerCapita,
        totalGdp: country.currentTotalGdp / 1000000000,
        populationDensity: country.populationDensity,
        gdpDensity: country.gdpDensity ? country.gdpDensity / 1000000 : undefined,
        ixTimeTimestamp: targetTime,
        isForecast: false,
      };
    }

    const forecastPoints: ChartPoint[] = [];
    const numSteps = forecastYears * (timeResolution === 'quarterly' ? 4 : 1);

    // Generate forecast points
    for (let i = 1; i <= numSteps; i++) {
      const yearOffset = timeResolution === 'quarterly' ? i / 4 : i;
      const forecastTime = IxTime.addYears(basePoint.ixTimeTimestamp, yearOffset);
      const forecastDate = new Date(forecastTime);
      const forecastYear = IxTime.getCurrentGameYear(forecastTime);
      
      let periodKey: string;
      if (timeResolution === 'quarterly') {
        const quarter = Math.floor(forecastDate.getUTCMonth() / 3) + 1;
        periodKey = `${forecastYear}-Q${quarter}`;
      } else {
        periodKey = forecastYear.toString();
      }

      // Apply growth factors with safety checks
      const popGrowthFactor = Math.pow(1 + (country.populationGrowthRate || 0), yearOffset);
      const gdpGrowthFactor = Math.pow(1 + (isFinite(country.adjustedGdpGrowth) ? country.adjustedGdpGrowth : 0), yearOffset);

      // Ensure finite calculations
      const projectedPopulation = (basePoint.population || 0) * (isFinite(popGrowthFactor) ? popGrowthFactor : 1);
      const projectedGdpPerCapita = (basePoint.gdpPerCapita || 0) * (isFinite(gdpGrowthFactor) ? gdpGrowthFactor : 1);
      const projectedTotalGdp = projectedPopulation * projectedGdpPerCapita / 1000; // Adjust for units
      
      const projectedPopDensity = basePoint.populationDensity 
        ? basePoint.populationDensity * (isFinite(popGrowthFactor) ? popGrowthFactor : 1)
        : undefined;
        
      const projectedGdpDensity = basePoint.gdpDensity 
        ? basePoint.gdpDensity * (isFinite(gdpGrowthFactor) ? gdpGrowthFactor : 1)
        : undefined;

      forecastPoints.push({
        period: periodKey,
        date: periodKey,
        ixTimeTimestamp: forecastTime,
        population: isFinite(projectedPopulation) ? projectedPopulation : basePoint.population || 0,
        gdpPerCapita: isFinite(projectedGdpPerCapita) ? projectedGdpPerCapita : basePoint.gdpPerCapita || 0,
        totalGdp: isFinite(projectedTotalGdp) ? projectedTotalGdp : basePoint.totalGdp || 0,
        populationDensity: projectedPopDensity,
        gdpDensity: projectedGdpDensity,
        isForecast: true,
      });
    }
    
    // Include transition point for continuity
    return [{ ...basePoint, isForecast: true }, ...forecastPoints];
  }, [country, historicalChartData, forecastYears, showForecastInHistorical, timeResolution, targetTime]);

  // Combine historical and forecast data
  const combinedChartData = useMemo(() => {
    const dataMap = new Map<string, ChartPoint>();

    // Add historical data
    historicalChartData.forEach(point => {
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
    forecastChartData.forEach(point => {
      const existing = dataMap.get(point.period);
      if (existing) {
        dataMap.set(point.period, {
          ...existing,
          forecastPopulation: point.population,
          forecastGdpPerCapita: point.gdpPerCapita,
          forecastTotalGdp: point.totalGdp,
          forecastPopulationDensity: point.populationDensity,
          forecastGdpDensity: point.gdpDensity,
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
    
    return Array.from(dataMap.values()).sort((a, b) => a.ixTimeTimestamp - b.ixTimeTimestamp);
  }, [historicalChartData, forecastChartData]);

  // Chart type options
  const chartOptions = [
    { key: 'overview' as ChartType, label: 'Overview', icon: Activity },
    { key: 'population' as ChartType, label: 'Population', icon: Activity },
    { key: 'gdp' as ChartType, label: 'GDP', icon: Activity },
    { key: 'density' as ChartType, label: 'Density', icon: Activity }
  ];

  if (isLoading && !historicalData?.length) {
    return (
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <CardTitle className="flex items-center">
              <Activity className="h-5 w-5 mr-2 text-primary" />
              Loading Data...
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-80 flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="ml-2 text-muted-foreground">Loading chart data...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <CardTitle className="flex items-center">
            <Activity className="h-5 w-5 mr-2 text-primary" />
            Economic Snapshot & Trends
          </CardTitle>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Resolution:</span>
            <Button 
              variant={timeResolution === 'quarterly' ? "secondary" : "ghost"} 
              size="sm" 
              onClick={() => onTimeResolutionChange('quarterly')}
            >
              Quarterly
            </Button>
            <Button 
              variant={timeResolution === 'annual' ? "secondary" : "ghost"} 
              size="sm" 
              onClick={() => onTimeResolutionChange('annual')}
            >
              Annual
            </Button>
          </div>
        </div>
        <CardDescription>
          Historical trends and {forecastYears > 0 ? `${forecastYears}-year forecast ` : ""}
          ending {IxTime.formatIxTime(targetTime, false)}. Current Resolution: {timeResolution}.
        </CardDescription>
      </CardHeader>

      <CardContent>
        {chartView === 'overview' ? (
          <CountryDashboard country={country} onNavigate={onChartViewChange} />
        ) : (
          <div className="flex flex-wrap gap-2 mb-6">
            {chartOptions.map(({ key, label, icon: Icon }) => (
              <Button 
                key={key} 
                variant={chartView === key ? "default" : "outline"} 
                size="sm" 
                onClick={() => onChartViewChange(key)} 
                className="flex items-center"
              >
                <Icon className="h-4 w-4 mr-1.5" />{label}
              </Button>
            ))}
          </div>
        )}

        <div className="h-80 mb-4">
          {(isLoading || (showForecastInHistorical && isLoadingForecast)) && combinedChartData.length === 0 ? (
            <div className="h-full flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="ml-2 text-muted-foreground">Loading chart data...</p>
            </div>
          ) : combinedChartData.length > 0 ? (
            <ChartDisplay 
              chartView={chartView}
              combinedData={combinedChartData}
              country={country}
              timeResolution={timeResolution}
              theme={theme}
              showForecast={showForecast}
              showDensity={showDensity}
              onToggleForecast={() => setShowForecast(!showForecast)}
              onToggleDensity={() => setShowDensity(!showDensity)}
            />
          ) : (
            <div className="h-full flex items-center justify-center text-center">
              <div className="flex flex-col items-center">
                <BarChart3 className="h-12 w-12 text-muted-foreground opacity-50 mb-2" />
                <p className="text-muted-foreground">
                  No historical data available for the selected period.
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  Try adjusting the time period or resolution.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Country Stats Component */}
        <CountryStats country={country} />
      </CardContent>
    </Card>
  );
}