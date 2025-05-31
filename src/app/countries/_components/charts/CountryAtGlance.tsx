// src/app/countries/_components/detail/CountryAtGlance.tsx
"use client";

import { useMemo, useState } from "react";
import { Skeleton } from "~/components/ui/skeleton";
import { Card, CardHeader, CardContent } from "~/components/ui/card";
import { BarChart3, Loader2 } from "lucide-react";
import { useTheme } from "~/context/theme-context";
import { IxTime } from "~/lib/ixtime";
import type { ChartType } from "../detail";
import { CountryDashboard } from "../charts/CountryDashboard";
import { ChartDisplay } from "../charts/ChartDisplay";
import { CountryStats } from "../charts/CountryStats";

// Keep existing types
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

type TimeResolutionType = 'quarterly' | 'annual';

// Keep the same props interface for backward compatibility
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
  const [showForecastButtonState, setShowForecastButtonState] = useState(true); // Renamed to avoid conflict with prop
  const [showDensityButtonState, setShowDensityButtonState] = useState(false); // Renamed

  const historicalChartData = useMemo(() => {
    if (!historicalData || historicalData.length === 0) return [];

    // Sort by timestamp to ensure correct order before processing
    const sortedHistoricalData = [...historicalData]
      .filter(point => point.ixTimeTimestamp && isFinite(point.ixTimeTimestamp)) // Ensure valid timestamps
      .sort((a, b) => a.ixTimeTimestamp - b.ixTimeTimestamp);

    if (!sortedHistoricalData.length) return [];

    const timestampGroups: Record<string, {
      points: HistoricalDataPoint[],
      timestampSum: number,
      count: number
    }> = {};

    sortedHistoricalData.forEach(point => {
      const date = new Date(point.ixTimeTimestamp);
      let periodKey: string;

      if (timeResolution === 'quarterly') {
        const quarter = Math.floor(date.getUTCMonth() / 3) + 1;
        periodKey = `${date.getUTCFullYear()}-Q${quarter}`;
      } else { // annual
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
      // Use the timestamp of the first point in the group for the period,
      // or an average. First point is simpler for period start.
      const representativeTimestamp = points.length > 0 && points[0] ? points[0].ixTimeTimestamp : (groupData.timestampSum / groupData.count);


      const sum = points.reduce((acc, p) => ({
        population: acc.population + (p.population || 0),
        gdpPerCapita: acc.gdpPerCapita + (p.gdpPerCapita || 0),
        totalGdp: acc.totalGdp + (p.totalGdp || 0),
        populationDensity: acc.populationDensity + (p.populationDensity || 0),
        gdpDensity: acc.gdpDensity + (p.gdpDensity || 0),
      }), { population: 0, gdpPerCapita: 0, totalGdp: 0, populationDensity: 0, gdpDensity: 0 });

      const count = points.length || 1;

      return {
        period,
        date: period,
        ixTimeTimestamp: representativeTimestamp,
        population: sum.population / count / 1000000, // Millions
        gdpPerCapita: sum.gdpPerCapita / count,
        totalGdp: sum.totalGdp / count / 1000000000, // Billions
        populationDensity: sum.populationDensity / count,
        gdpDensity: (sum.gdpDensity / count) / 1000000, // Millions
        isForecast: false,
      };
    }).sort((a, b) => a.ixTimeTimestamp - b.ixTimeTimestamp);
  }, [historicalData, timeResolution]);

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

    if (!basePointForForecast || !isFinite(basePointForForecast.ixTimeTimestamp)) return [];

    const forecastPoints = [];
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
      const projectedTotalGdp = projectedPopulation * projectedGdpPerCapita / 1000; // From M * $ to B$
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
    
    // Ensure the base point for forecast is included correctly for continuity
    const baseForecastPoint = {...basePointForForecast, isForecast: true};
    
    // Avoid duplicate first point if historical data provides it
    if (historicalChartData.length > 0 && forecastPoints.length > 0 &&
        historicalChartData[historicalChartData.length-1]?.period === baseForecastPoint.period) {
        return forecastPoints; // The forecast points already start from the next period
    }

    return [baseForecastPoint, ...forecastPoints].filter(p => p.ixTimeTimestamp >= targetTime);

  }, [country, historicalChartData, forecastYears, showForecastInHistorical, timeResolution, targetTime]);

  const combinedChartData = useMemo(() => {
    const dataMap = new Map();

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
        // If forecast point aligns with an existing historical point, merge primarily taking forecast values
        dataMap.set(p.period, {
          ...existing, // keep historical values if not overridden by forecast
          forecastPopulation: p.population,
          forecastGdpPerCapita: p.gdpPerCapita,
          forecastTotalGdp: p.totalGdp,
          forecastPopulationDensity: p.populationDensity,
          forecastGdpDensity: p.gdpDensity,
           // ensure ixTimeTimestamp is consistent if merging, prefer forecast's if it's the exact same period
          ixTimeTimestamp: p.ixTimeTimestamp || existing.ixTimeTimestamp,
        });
      } else {
        dataMap.set(p.period, {
          ...p,
          forecastPopulation: p.population,
          forecastGdpPerCapita: p.gdpPerCapita,
          forecastTotalGdp: p.totalGdp,
          forecastPopulationDensity: p.populationDensity,
          forecastGdpDensity: p.gdpDensity,
        });
      }
    });

    return Array.from(dataMap.values())
        .filter(p => p.ixTimeTimestamp && isFinite(p.ixTimeTimestamp))
        .sort((a, b) => a.ixTimeTimestamp - b.ixTimeTimestamp);
  }, [historicalChartData, forecastChartData]);

  if (isLoading && combinedChartData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-7 w-3/4 mb-2" />
          <Skeleton className="h-4 w-1/2" />
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2 mb-4">
            {/* Removed time resolution buttons from skeleton, as they are in ChartDisplay now */}
          </div>
          <Skeleton className="h-80 w-full rounded-lg" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-md" />)}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-4 sm:p-6">
        {chartView === 'overview' ? (
          <CountryDashboard
            country={country}
            onNavigate={onChartViewChange}
          />
        ) : null}

        <div className="h-80 mb-4">
          {(isLoading || (showForecastInHistorical && isLoadingForecast && forecastYears > 0)) && combinedChartData.length === 0 ? (
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
              showForecast={showForecastButtonState && forecastYears > 0}
              showDensity={showDensityButtonState}
              onToggleForecast={() => setShowForecastButtonState(!showForecastButtonState)}
              onToggleDensity={() => setShowDensityButtonState(!showDensityButtonState)}
            />
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center">
              <BarChart3 className="h-12 w-12 text-muted-foreground opacity-50 mb-2" />
              <p className="text-muted-foreground">
                No historical data available for the selected period.
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Try adjusting the time controls or check back later.
              </p>
            </div>
          )}
        </div>
        <CountryStats country={country} />
      </CardContent>
    </Card>
  );
}