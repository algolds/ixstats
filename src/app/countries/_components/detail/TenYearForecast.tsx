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
// Exporting this for use in parent components if needed
export interface ForecastDataPoint {
  ixTime: number;       // Timestamp for the point
  formattedTime: string; // Human-readable time
  gameYear: number;       // In-game year
  year: number;          // FIXED: Added year field for compatibility
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
  forecastYears?: number; // FIXED: Added forecastYears prop with default
}

export function TenYearForecast({
  country,
  forecastData: apiForecastData, // Rename to avoid conflict
  baseTime,
  isLoading = false,
  forecastYears = 10 // FIXED: Default value provided
}: TenYearForecastProps) {
  const { theme } = useTheme(); // For chart styling

  const generatedForecastData = useMemo(() => {
    if (apiForecastData && apiForecastData.length > 0) {
      return apiForecastData.map(p => ({
        ...p,
        year: p.gameYear || p.year, // Ensure year field exists
        population: p.population / 1000000,
        totalGdp: p.totalGdp / 1000000000,
        gdpDensity: p.gdpDensity ? p.gdpDensity / 1000000 : undefined,
      }));
    }

    const data = [];
    const baseYear = IxTime.getCurrentGameYear(baseTime);

    // Use the forecastYears prop for the loop
    for (let yearOffset = 0; yearOffset <= forecastYears; yearOffset++) {
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
        year: currentYearInForecast,
        population: projectedPopulation / 1000000,
        gdpPerCapita: projectedGdpPerCapita,
        totalGdp: projectedTotalGdp / 1000000000,
        populationDensity: country.landArea ? (projectedPopulation / country.landArea) : undefined,
        gdpDensity: country.landArea ? (projectedTotalGdp / (country.landArea * 1000000)) : undefined,
        economicTier: country.economicTier,
        populationTier: country.populationTier,
      });
    }
    return data;
  }, [country, baseTime, apiForecastData, forecastYears]); // Added forecastYears to dependency array


  const forecastAnalysis = useMemo(() => {
    if (generatedForecastData.length < 2) return null;

    const firstYearData = generatedForecastData[0]!;
    const lastYearData = generatedForecastData[generatedForecastData.length - 1]!;
    
    // Use the actual duration from the data, which depends on `forecastYears` prop
    const forecastDuration = lastYearData.year - firstYearData.year;

    if (forecastDuration <= 0) return null;

    const firstPop = firstYearData.population * 1000000;
    const lastPop = lastYearData.population * 1000000;
    const firstGdpPc = firstYearData.gdpPerCapita;
    const lastGdpPc = lastYearData.gdpPerCapita;
    const firstTotalGdp = firstYearData.totalGdp * 1000000000;
    const lastTotalGdp = lastYearData.totalGdp * 1000000000;

    // FIXED: Added safety checks for division by zero
    const populationCAGR = firstPop > 0 ? (Math.pow(lastPop / firstPop, 1 / forecastDuration) - 1) * 100 : 0;
    const gdpPerCapitaCAGR = firstGdpPc > 0 ? (Math.pow(lastGdpPc / firstGdpPc, 1 / forecastDuration) - 1) * 100 : 0;
    const totalGdpCAGR = firstTotalGdp > 0 ? (Math.pow(lastTotalGdp / firstTotalGdp, 1 / forecastDuration) - 1) * 100 : 0;

    return {
      populationCAGR,
      gdpPerCapitaCAGR,
      totalGdpCAGR,
      projectedPopulationFinal: lastYearData.population,
      projectedGdpPerCapitaFinal: lastYearData.gdpPerCapita,
      projectedTotalGdpFinal: lastYearData.totalGdp,
      finalYear: lastYearData.year,
    };
  }, [generatedForecastData]);

  // FIXED: Enhanced formatNumber utility with better edge case handling
  const formatNumberLocal = (num: number | undefined | null, type: 'population' | 'gdpPercapita' | 'totalGdp' | 'cagr' | 'year' | 'direct') => {
    if (num === undefined || num === null || isNaN(num) || !isFinite(num)) return 'N/A';

    switch (type) {
        case 'population': // Expects millions
            return `${num.toFixed(1)}M`;
        case 'gdpPercapita': // Expects direct value
            // FIXED: Handle very large numbers properly
            if (num >= 1000000) {
              return `$${(num / 1000000).toFixed(1)}M`;
            } else if (num >= 1000) {
              return `$${(num / 1000).toFixed(0)}K`;
            }
            return `$${num.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
        case 'totalGdp': // Expects billions
            return `$${num.toFixed(1)}B`;
        case 'cagr':
            return `${num.toFixed(1)}%`;
        case 'year':
            return num.toString();
        case 'direct':
             return num.toLocaleString(undefined, { maximumFractionDigits: 1 });
        default:
            return num.toLocaleString();
    }
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
                {entry.name.includes('Population') ? formatNumberLocal(entry.value, 'population') :
                  entry.name.includes('GDP p.c.') ? formatNumberLocal(entry.value, 'gdpPercapita') :
                  entry.name.includes('Total GDP') ? formatNumberLocal(entry.value, 'totalGdp') :
                  formatNumberLocal(entry.value, 'direct')}
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
          {/* Use the forecastYears prop here */}
          {forecastYears > 0 ? `${forecastYears}-Year` : 'Detailed'} Economic Forecast
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
                {formatNumberLocal(forecastAnalysis.populationCAGR, 'cagr')}
              </p>
              <p className="text-xs text-muted-foreground">
                To {formatNumberLocal(forecastAnalysis.projectedPopulationFinal, 'population')} by {forecastAnalysis.finalYear}
              </p>
            </div>
            <div className="p-3 bg-muted/50 rounded-lg">
              <p className="text-xs text-muted-foreground">GDP p.c. CAGR</p>
              <p className="text-xl font-semibold text-indigo-600 dark:text-indigo-400">
                {formatNumberLocal(forecastAnalysis.gdpPerCapitaCAGR, 'cagr')}
              </p>
              <p className="text-xs text-muted-foreground">
                To {formatNumberLocal(forecastAnalysis.projectedGdpPerCapitaFinal, 'gdpPercapita')} by {forecastAnalysis.finalYear}
              </p>
            </div>
            <div className="p-3 bg-muted/50 rounded-lg">
              <p className="text-xs text-muted-foreground">Total GDP CAGR</p>
              <p className="text-xl font-semibold text-blue-600 dark:text-blue-400">
                {formatNumberLocal(forecastAnalysis.totalGdpCAGR, 'cagr')}
              </p>
              <p className="text-xs text-muted-foreground">
                To {formatNumberLocal(forecastAnalysis.projectedTotalGdpFinal, 'totalGdp')} by {forecastAnalysis.finalYear}
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
                <YAxis yAxisId="left" orientation="left" stroke={axisColor} tick={{ fontSize: 10, fill: textColor }} tickFormatter={(val) => `${val.toFixed(0)}M`} />
                <YAxis yAxisId="right" orientation="right" stroke={axisColor} tick={{ fontSize: 10, fill: textColor }} tickFormatter={(val) => `$${(val/1000).toFixed(0)}k`} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{fontSize: "12px"}} />
                <Area yAxisId="left" type="monotone" dataKey="population" name="Population (M)" stroke="hsl(var(--chart-1))" fill="hsl(var(--chart-1))" fillOpacity={0.3} dot={false}/>
                <Line yAxisId="right" type="monotone" dataKey="gdpPerCapita" name="GDP p.c. ($)" stroke="hsl(var(--chart-2))" strokeWidth={2} dot={false}/>
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