// src/app/countries/_components/detail/TenYearForecast.tsx
"use client";

import { useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  ComposedChart,
  Bar,
  Legend,
  ReferenceLine
} from "recharts";
import {
  TrendingUp,
  Target,
  AlertTriangle,
  Info,
  DollarSign,
  Users,
  Activity,
  Loader2
} from "lucide-react";
import { useTheme } from "~/context/theme-context";
import { IxTime } from "~/lib/ixtime";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter
} from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Skeleton } from "~/components/ui/skeleton";

// Define the structure of country data this component expects
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
  landArea?: number | null; // Optional, for density calculations
}

// Define the structure for individual forecast data points
interface ForecastDataPoint {
  ixTime: number;        // Timestamp for the point
  formattedTime: string; // Human-readable time
  gameYear: number;      // In-game year
  population: number;
  gdpPerCapita: number;
  totalGdp: number;
  populationDensity?: number | null;
  gdpDensity?: number | null;
  economicTier: string;
  populationTier: string;
}

interface TenYearForecastProps {
  country: CountryData;
  forecastData?: ForecastDataPoint[]; // Data from API if available
  baseTime: number; // The IxTime from which the forecast starts
  isLoading?: boolean;
}

export function TenYearForecast({
  country,
  forecastData: apiForecastData, // Rename to avoid conflict
  baseTime,
  isLoading = false
}: TenYearForecastProps) {
  const { theme } = useTheme(); // For chart styling

  // Generate 10-year forecast data if API data is not provided or as a fallback
  const generatedForecastData = useMemo(() => {
    // If API data is available and not empty, prefer that
    if (apiForecastData && apiForecastData.length > 0) {
      return apiForecastData.map(p => ({
        ...p,
        year: p.gameYear, // For XAxis dataKey
        population: p.population / 1000000, // Convert to Millions
        totalGdp: p.totalGdp / 1000000000, // Convert to Billions
        gdpDensity: p.gdpDensity ? p.gdpDensity / 1000000 : undefined, // Convert to Millions
      }));
    }

    // Fallback: Generate forecast based on current country stats if no API data
    const data = [];
    const baseYear = IxTime.getCurrentGameYear(baseTime);

    for (let yearOffset = 0; yearOffset <= 10; yearOffset++) {
      const currentYearInForecast = baseYear + yearOffset;
      const currentForecastTimestamp = IxTime.addYears(baseTime, yearOffset);

      const populationGrowthFactor = Math.pow(1 + country.populationGrowthRate, yearOffset);
      const gdpGrowthFactor = Math.pow(1 + country.adjustedGdpGrowth, yearOffset);

      const projectedPopulation = country.currentPopulation * populationGrowthFactor;
      const projectedGdpPerCapita = country.currentGdpPerCapita * gdpGrowthFactor;
      const projectedTotalGdp = projectedPopulation * projectedGdpPerCapita;

      data.push({
        ixTime: currentForecastTimestamp,
        formattedTime: IxTime.formatIxTime(currentForecastTimestamp),
        gameYear: currentYearInForecast,
        year: currentYearInForecast, // For XAxis dataKey
        population: projectedPopulation / 1000000, // Convert to Millions
        gdpPerCapita: projectedGdpPerCapita,
        totalGdp: projectedTotalGdp / 1000000000, // Convert to Billions
        populationDensity: country.landArea ? (projectedPopulation / country.landArea) : undefined,
        gdpDensity: country.landArea ? (projectedTotalGdp / country.landArea / 1000000) : undefined, // Convert to Millions
        economicTier: country.economicTier, // This would ideally be recalculated based on projected GDP p.c.
        populationTier: country.populationTier, // This would ideally be recalculated
      });
    }
    return data;
  }, [country, baseTime, apiForecastData]);


  const forecastAnalysis = useMemo(() => {
    if (generatedForecastData.length < 2) return null;

    const firstYearData = generatedForecastData[0]!;
    const lastYearData = generatedForecastData[generatedForecastData.length - 1]!;
    const forecastDuration = lastYearData.year - firstYearData.year;

    if (forecastDuration <= 0) return null;

    // Use original scale for CAGR calculation if possible, then convert for display
    const firstPop = firstYearData.population * 1000000;
    const lastPop = lastYearData.population * 1000000;
    const firstGdpPc = firstYearData.gdpPerCapita;
    const lastGdpPc = lastYearData.gdpPerCapita;
    const firstTotalGdp = firstYearData.totalGdp * 1000000000;
    const lastTotalGdp = lastYearData.totalGdp * 1000000000;


    const populationCAGR = firstPop > 0 ? (Math.pow(lastPop / firstPop, 1 / forecastDuration) - 1) * 100 : 0;
    const gdpPerCapitaCAGR = firstGdpPc > 0 ? (Math.pow(lastGdpPc / firstGdpPc, 1 / forecastDuration) - 1) * 100 : 0;
    const totalGdpCAGR = firstTotalGdp > 0 ? (Math.pow(lastTotalGdp / firstTotalGdp, 1 / forecastDuration) - 1) * 100 : 0;

    return {
      populationCAGR,
      gdpPerCapitaCAGR,
      totalGdpCAGR,
      projectedPopulationFinal: lastYearData.population, // Already in Millions
      projectedGdpPerCapitaFinal: lastYearData.gdpPerCapita,
      projectedTotalGdpFinal: lastYearData.totalGdp, // Already in Billions
      finalYear: lastYearData.year,
    };
  }, [generatedForecastData]);

  const formatNumber = (num: number, isCurrency = false, precision = 1): string => {
    const prefix = isCurrency ? '$' : '';
    if (num === undefined || num === null || isNaN(num)) return isCurrency ? `${prefix}N/A` : 'N/A';

    if (isCurrency) {
        if (Math.abs(num) >= 1000000) return `${prefix}${(num / 1000000).toFixed(precision)}T`; // Trillions if original was Quadrillions
        if (Math.abs(num) >= 1000) return `${prefix}${(num / 1000).toFixed(precision)}B`; // Billions if original was Trillions
        return `${prefix}${num.toFixed(precision)}M`; // Millions if original was Billions, or direct if small
    }
    // For population (already in millions) or density
    if (Math.abs(num) >= 1000) return `${(num / 1000).toFixed(precision)}B`; // Billions
    return `${num.toFixed(precision)}M`; // Millions
  };

  const axisColor = theme === 'dark' ? 'hsl(var(--muted-foreground))' : 'hsl(var(--muted-foreground))';
  const textColor = theme === 'dark' ? 'hsl(var(--foreground))' : 'hsl(var(--foreground))';
  const gridColor = theme === 'dark' ? 'hsl(var(--border))' : 'hsl(var(--border))';
  const tooltipStyle = {
    backgroundColor: `hsl(var(--popover))`,
    color: `hsl(var(--popover-foreground))`,
    border: `1px solid hsl(var(--border))`,
    borderRadius: `var(--radius)`,
    padding: '0.5rem 0.75rem',
    fontSize: '0.75rem', // text-xs
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div style={tooltipStyle} className="shadow-lg">
          <p className="font-medium mb-1">Year: {label}</p>
          {payload.map((entry: any) => (
            <div key={entry.name} className="flex justify-between items-center text-xs">
              <span style={{ color: entry.color }} className="mr-2">{entry.name}:</span>
              <span className="font-semibold">
                {entry.name.includes('Population') ? `${Number(entry.value).toFixed(1)}M` :
                 entry.name.includes('GDP p.c.') ? `$${Number(entry.value).toLocaleString(undefined, {maximumFractionDigits: 0})}` :
                 entry.name.includes('Total GDP') ? `$${Number(entry.value).toFixed(1)}B` :
                 Number(entry.value).toLocaleString(undefined, {maximumFractionDigits: 1})}
              </span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };


  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-7 w-3/5 mb-2" />
          <Skeleton className="h-4 w-4/5" />
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Skeleton className="h-20 w-full rounded-lg" />
            <Skeleton className="h-20 w-full rounded-lg" />
            <Skeleton className="h-20 w-full rounded-lg" />
          </div>
          <Skeleton className="h-80 w-full rounded-lg" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <TrendingUp className="h-5 w-5 mr-2 text-primary" />
          {forecastYears > 0 ? `${forecastYears}-Year` : '10-Year'} Economic Forecast
        </CardTitle>
        <CardDescription>
          Projected economic indicators for {country.name} starting from {IxTime.getCurrentGameYear(baseTime)}.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {forecastAnalysis && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6 text-center">
            <div className="p-3 bg-muted/50 rounded-lg">
              <p className="text-xs text-muted-foreground">Population CAGR</p>
              <p className="text-xl font-semibold text-green-600 dark:text-green-400">
                {forecastAnalysis.populationCAGR.toFixed(1)}%
              </p>
              <p className="text-xs text-muted-foreground">
                To {formatNumber(forecastAnalysis.projectedPopulationFinal, false, 1)} by {forecastAnalysis.finalYear}
              </p>
            </div>
            <div className="p-3 bg-muted/50 rounded-lg">
              <p className="text-xs text-muted-foreground">GDP p.c. CAGR</p>
              <p className="text-xl font-semibold text-indigo-600 dark:text-indigo-400">
                {forecastAnalysis.gdpPerCapitaCAGR.toFixed(1)}%
              </p>
               <p className="text-xs text-muted-foreground">
                To {formatNumber(forecastAnalysis.projectedGdpPerCapitaFinal, true, 0)} by {forecastAnalysis.finalYear}
              </p>
            </div>
            <div className="p-3 bg-muted/50 rounded-lg">
              <p className="text-xs text-muted-foreground">Total GDP CAGR</p>
              <p className="text-xl font-semibold text-blue-600 dark:text-blue-400">
                {forecastAnalysis.totalGdpCAGR.toFixed(1)}%
              </p>
              <p className="text-xs text-muted-foreground">
                To {formatNumber(forecastAnalysis.projectedTotalGdpFinal * 1000, true, 1)} by {forecastAnalysis.finalYear}
              </p>
            </div>
          </div>
        )}

        <div className="h-80">
          {generatedForecastData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={generatedForecastData} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} opacity={0.5} />
                <XAxis dataKey="year" tick={{ fontSize: 10, fill: textColor }} stroke={axisColor} />
                <YAxis yAxisId="left" orientation="left" stroke={axisColor} tick={{ fontSize: 10, fill: textColor }} tickFormatter={(val) => `${val}M`} />
                <YAxis yAxisId="right" orientation="right" stroke={axisColor} tick={{ fontSize: 10, fill: textColor }} tickFormatter={(val) => `$${(val/1000).toFixed(0)}k`} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{fontSize: "12px"}} />
                <Area yAxisId="left" type="monotone" dataKey="population" name="Population (M)" stroke="hsl(var(--chart-1))" fill="hsl(var(--chart-1))" fillOpacity={0.3} dot={false}/>
                <Line yAxisId="right" type="monotone" dataKey="gdpPerCapita" name="GDP p.c. ($)" stroke="hsl(var(--chart-2))" strokeWidth={2} dot={false}/>
                {/* You can add Total GDP as a Bar if needed */}
                {/* <Bar yAxisId="right" dataKey="totalGdp" name="Total GDP (B$)" fill="hsl(var(--chart-3))" barSize={10} /> */}
              </ComposedChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-full items-center justify-center text-muted-foreground">
                <Loader2 className="h-6 w-6 animate-spin mr-2"/> Loading forecast data...
            </div>
          )}
        </div>
      </CardContent>
      <CardFooter className="text-xs text-muted-foreground pt-4">
        <Info className="h-3.5 w-3.5 mr-1.5 flex-shrink-0" />
        Projections are based on current growth rates and do not account for unforeseen events or policy changes.
      </CardFooter>
    </Card>
  );
}
