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
import { formatNumber } from "~/lib/format";

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

  // Data processing - kept from original component with minor adjustments
  const historicalChartData = useMemo(() => {
    if (!historicalData || historicalData.length === 0) return [];

    let windowStartTimeMs: number;

    if (timeResolution === 'quarterly') {
      windowStartTimeMs = IxTime.addYears(targetTime, -0.25);
    } else {
      windowStartTimeMs = IxTime.addYears(targetTime, -1);
    }

    const filteredRawData = historicalData
      .filter(point => point.ixTimeTimestamp >= windowStartTimeMs && point.ixTimeTimestamp <= targetTime)
      .sort((a, b) => a.ixTimeTimestamp - b.ixTimeTimestamp);

    if (!filteredRawData.length) return [];

    const timestampGroups: Record<string, { points: HistoricalDataPoint[], timestampSum: number, count: number }> = {};
    filteredRawData.forEach(point => {
      const date = new Date(point.ixTimeTimestamp);
      let periodKey: string;
      if (timeResolution === 'quarterly') {
        const quarter = Math.floor(date.getUTCMonth() / 3) + 1;
        periodKey = `${date.getUTCFullYear()}-Q${quarter}`;
      } else {
        periodKey = date.getUTCFullYear().toString();
      }
      if (!timestampGroups[periodKey]) {
        timestampGroups[periodKey] = { points: [], timestampSum: 0, count: 0 };
      }
      timestampGroups[periodKey]?.points.push(point);
      timestampGroups[periodKey]!.timestampSum += point.ixTimeTimestamp;
      timestampGroups[periodKey]!.count++;
    });

    return Object.entries(timestampGroups).map(([period, groupData]) => {
      const points = groupData.points;
      const avgTimestamp = points.length > 0 ? groupData.timestampSum / points.length : 0;
      const sum = points.reduce((acc, p) => ({
        population: acc.population + p.population,
        gdpPerCapita: acc.gdpPerCapita + p.gdpPerCapita,
        totalGdp: acc.totalGdp + p.totalGdp,
        populationDensity: acc.populationDensity + (p.populationDensity || 0),
        gdpDensity: acc.gdpDensity + (p.gdpDensity || 0),
      }), { population: 0, gdpPerCapita: 0, totalGdp: 0, populationDensity: 0, gdpDensity: 0 });

      const count = points.length || 1;
      return {
        period,
        date: period,
        ixTimeTimestamp: avgTimestamp,
        population: sum.population / count / 1000000, // Millions
        gdpPerCapita: sum.gdpPerCapita / count,
        totalGdp: sum.totalGdp / count / 1000000000, // Billions
        populationDensity: sum.populationDensity / count,
        gdpDensity: (sum.gdpDensity / count) / 1000000, // Millions
        isForecast: false,
      };
    }).sort((a, b) => a.ixTimeTimestamp - b.ixTimeTimestamp);

  }, [historicalData, targetTime, timeResolution]);

  const forecastChartData = useMemo(() => {
    if (!showForecastInHistorical || forecastYears === 0) return [];

    const basePointForForecast = historicalChartData.length > 0
      ? historicalChartData[historicalChartData.length - 1]
      : {
          period: IxTime.formatIxTime(targetTime, false).split(',')[1]?.trim() || new Date(targetTime).getFullYear().toString(),
          date: IxTime.formatIxTime(targetTime, false).split(',')[1]?.trim() || new Date(targetTime).getFullYear().toString(),
          population: country.currentPopulation / 1000000,
          gdpPerCapita: country.currentGdpPerCapita,
          totalGdp: country.currentTotalGdp / 1000000000,
          populationDensity: country.populationDensity ?? 0,
          gdpDensity: (country.gdpDensity ?? 0) / 1000000,
          ixTimeTimestamp: targetTime,
        };
    
    if (!basePointForForecast) return [];

    const forecastPoints: ChartPoint[] = [];
    const forecastStartTime = basePointForForecast.ixTimeTimestamp;
    const numForecastSteps = forecastYears * (timeResolution === 'quarterly' ? 4 : 1);

    for (let i = 1; i <= numForecastSteps; i++) {
      const yearOffset = timeResolution === 'quarterly' ? i / 4 : i;
      const currentForecastTime = IxTime.addYears(forecastStartTime, yearOffset); 
      const dateObj = new Date(currentForecastTime);
      let periodKey: string;
      if (timeResolution === 'quarterly') {
        const quarter = Math.floor(dateObj.getUTCMonth() / 3) + 1;
        periodKey = `${dateObj.getUTCFullYear()}-Q${quarter}`;
      } else {
        periodKey = dateObj.getUTCFullYear().toString();
      }

      const populationGrowthFactor = Math.pow(1 + country.populationGrowthRate, yearOffset);
      const gdpGrowthFactor = Math.pow(1 + country.adjustedGdpGrowth, yearOffset);

      const projectedPopulation = (basePointForForecast.population ?? 0) * populationGrowthFactor;
      const projectedGdpPerCapita = (basePointForForecast.gdpPerCapita ?? 0) * gdpGrowthFactor;
      const projectedTotalGdp = projectedPopulation * projectedGdpPerCapita / 1000; 
      const projectedPopDensity = (basePointForForecast.populationDensity ?? 0) * populationGrowthFactor;
      const projectedGdpDensity = (basePointForForecast.gdpDensity ?? 0) * gdpGrowthFactor;

      forecastPoints.push({
        period: periodKey,
        date: periodKey,
        ixTimeTimestamp: currentForecastTime,
        population: projectedPopulation,
        gdpPerCapita: projectedGdpPerCapita,
        totalGdp: projectedTotalGdp,
        populationDensity: projectedPopDensity,
        gdpDensity: projectedGdpDensity,
        isForecast: true,
      });
    }
    if (historicalChartData.length > 0 && forecastPoints.length > 0) {
        return [{...historicalChartData[historicalChartData.length - 1]!, isForecast: true}, ...forecastPoints];
    }
    if (forecastPoints.length > 0) {
        return [{...basePointForForecast, isForecast: true}, ...forecastPoints];
    }
    return [];
  }, [country, historicalChartData, forecastYears, showForecastInHistorical, timeResolution, targetTime]);

  const combinedChartData = useMemo(() => {
    const dataMap = new Map<string, ChartPoint>();

    historicalChartData.forEach(p => {
        dataMap.set(p.period, {
            ...p,
            historicalPopulation: p.population,
            historicalGdpPerCapita: p.gdpPerCapita,
            historicalTotalGdp: p.totalGdp,
            historicalPopulationDensity: p.populationDensity,
            historicalGdpDensity: p.gdpDensity,
        });
    });

    forecastChartData.forEach(p => {
        const existing = dataMap.get(p.period);
        if (existing) {
            dataMap.set(p.period, {
                ...existing,
                forecastPopulation: p.population,
                forecastGdpPerCapita: p.gdpPerCapita ?? undefined,
                forecastTotalGdp: p.totalGdp ?? undefined,
                forecastPopulationDensity: p.populationDensity ?? undefined,
                forecastGdpDensity: p.gdpDensity ?? undefined,
            });
        } else {
            dataMap.set(p.period, {
                ...p,
                forecastPopulation: p.population,
                forecastGdpPerCapita: p.gdpPerCapita ?? undefined,
                forecastTotalGdp: p.totalGdp ?? undefined,
                forecastPopulationDensity: p.populationDensity ?? undefined,
                forecastGdpDensity: p.gdpDensity ?? undefined,
            });
        }
    });
    return Array.from(dataMap.values()).sort((a,b) => a.ixTimeTimestamp - b.ixTimeTimestamp);
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
              <BarChart3 className="h-12 w-12 text-muted-foreground opacity-50 mb-2" />
              <p className="text-muted-foreground">
                No historical data available for the selected period or resolution.
              </p>
            </div>
          )}
        </div>

        {/* Country Stats Component */}
        <CountryStats country={country} />
      </CardContent>
    </Card>
  );
}
