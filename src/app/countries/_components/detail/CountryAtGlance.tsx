// src/app/countries/_components/detail/CountryAtGlance.tsx
"use client";

import { useMemo, useState } from "react"; // Added useState for internal control if needed, though props are better
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
  ReferenceLine,
  Label
} from "recharts";
import {
  BarChart3,
  TrendingUp,
  Users,
  Globe,
  Activity,
  Calendar,
  Info,
  DollarSign,
  AlertTriangle,
  Loader2
} from "lucide-react";
import { useTheme } from "~/context/theme-context"; // For chart colors
import { IxTime } from "~/lib/ixtime"; // For time formatting
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription
} from "~/components/ui/card";
import { Skeleton } from "~/components/ui/skeleton";
import { Badge } from "~/components/ui/badge";
import { cn } from "~/lib/utils"; // Your utility for class names
import { Button } from "~/components/ui/button";

// ... (Keep existing interfaces: CountryData, HistoricalDataPoint, ChartPoint, CountryAtGlanceProps) ...
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
  populationGrowth?: number;
  gdpGrowth?: number;
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

type ChartViewType = 'overview' | 'population' | 'gdp' | 'density';
type TimeResolutionType = 'quarterly' | 'annual';

interface CountryAtGlanceProps {
  country: CountryData;
  historicalData?: HistoricalDataPoint[];
  targetTime: number; 
  forecastYears: number; 
  isLoading?: boolean;
  isLoadingForecast?: boolean; 
  chartView?: ChartViewType; 
  timeResolution?: TimeResolutionType; 
  showForecastInHistorical?: boolean;
  onTimeResolutionChange: (resolution: TimeResolutionType) => void; 
  onChartViewChange: (view: ChartViewType) => void; 
}


// MODIFIED formatNumber function
const formatNumber = (
    num: number | null | undefined,
    isCurrency = false,
    precisionForNonCompactOrSmallNum = 2, // Default precision for non-compact, or for compact numbers < 1K
    compact = false
  ): string => {
    if (num == null || isNaN(num)) {
      if (isCurrency) return compact ? '$0' : '$0.00';
      return '0';
    }

    if (compact) {
      const absNum = Math.abs(num);
      let valToShow: number;
      let suffix = '';
      let fixedPrecision: number;

      if (absNum >= 1e12) { // Trillions (always > 10B)
        valToShow = num / 1e12;
        suffix = 'T';
        fixedPrecision = 2; // Consistent 2 decimal places for Trillions
      } else if (absNum >= 10e9) { // 10 Billion to < 1 Trillion
        valToShow = num / 1e9;
        suffix = 'B';
        fixedPrecision = 2; // 2 decimal places for numbers >= 10 Billion
      } else if (absNum >= 1e9) { // 1 Billion to < 10 Billion
        valToShow = num / 1e9;
        suffix = 'B';
        fixedPrecision = 1; // 1 decimal place for billions < 10B
      } else if (absNum >= 1e6) { // Millions
        valToShow = num / 1e6;
        suffix = 'M';
        fixedPrecision = 1; // 1 decimal place for millions
      } else if (absNum >= 1e3) { // Thousands
        valToShow = num / 1e3;
        suffix = 'K';
        fixedPrecision = 0; // 0 decimal places for thousands
      } else { // Numbers less than 1000
        fixedPrecision = isCurrency ? precisionForNonCompactOrSmallNum : 0;
        return `${isCurrency ? '$' : ''}${num.toLocaleString(undefined, {
          minimumFractionDigits: fixedPrecision,
          maximumFractionDigits: fixedPrecision,
        })}`;
      }
      return `${isCurrency ? '$' : ''}${valToShow.toFixed(fixedPrecision)}${suffix}`;
    }

    // Non-compact formatting
    return `${isCurrency ? '$' : ''}${num.toLocaleString(undefined, {
      minimumFractionDigits: (isCurrency && num !== 0) ? precisionForNonCompactOrSmallNum : (num === 0 ? 0 : precisionForNonCompactOrSmallNum),
      maximumFractionDigits: precisionForNonCompactOrSmallNum,
    })}`;
};


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

  // ... (Keep useMemo for historicalChartData, forecastChartData, combinedChartData) ...
  const historicalChartData = useMemo(() => {
    if (!historicalData || historicalData.length === 0) return [];

    const targetDateObj = new Date(targetTime);
    const windowYears = 5;
    let windowStartTimeMs: number;

    if (timeResolution === 'quarterly') {
      const windowStartDate = new Date(targetDateObj);
      windowStartDate.setFullYear(targetDateObj.getFullYear() - windowYears);
      windowStartTimeMs = windowStartDate.getTime();
    } else { // annual
      const windowStartDate = new Date(targetDateObj);
      windowStartDate.setFullYear(targetDateObj.getFullYear() - windowYears);
      windowStartTimeMs = windowStartDate.getTime();
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

  const axisColor = theme === 'dark' ? '#4A5568' : '#CBD5E0';
  const textColor = theme === 'dark' ? '#E2E8F0' : '#374151';
  const tooltipStyle = {
    backgroundColor: theme === 'dark' ? 'hsl(var(--popover))' : 'hsl(var(--popover))',
    color: theme === 'dark' ? 'hsl(var(--popover-foreground))' : 'hsl(var(--popover-foreground))',
    border: `1px solid ${theme === 'dark' ? 'hsl(var(--border))' : 'hsl(var(--border))'}`,
    borderRadius: '0.375rem',
    padding: '0.75rem',
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const dataPoint = payload[0].payload;
      const displayLabel = dataPoint.period || IxTime.formatIxTime(label, false);
      return (
        <div style={tooltipStyle} className="shadow-lg">
          <p className="font-medium mb-2">{displayLabel}</p>
          {payload.map((entry: any, index: number) => (
            <div key={`item-${index}`} className="flex justify-between items-center text-xs mb-1">
              <span style={{ color: entry.color }} className="mr-2">{entry.name}:</span>
              <span className="font-semibold">
                {entry.name.toLowerCase().includes('gdp') && entry.name.toLowerCase().includes('capita')
                  ? `$${Number(entry.value).toLocaleString(undefined, { maximumFractionDigits: 0 })}`
                  : entry.name.toLowerCase().includes('gdp') && (entry.name.toLowerCase().includes('billion') || entry.name.toLowerCase().includes('total'))
                    ? `$${Number(entry.value).toFixed(1)}B`
                    : entry.name.toLowerCase().includes('population') && entry.name.toLowerCase().includes('(m)')
                      ? `${Number(entry.value).toFixed(1)}M`
                      : Number(entry.value).toLocaleString(undefined, { maximumFractionDigits: 2 })}
              </span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };
  // ... (Keep renderChart, isLoading block, chartOptions) ...

  const renderChart = () => {
    const xAxisProps = {
        dataKey:"ixTimeTimestamp",
        type: "number" as const,
        domain: ['dataMin', 'dataMax'] as [any, any],
        tickFormatter: (timestamp: number) => {
          const dateObj = new Date(timestamp);
          if (timeResolution === 'annual') {
            return dateObj.getUTCFullYear().toString();
          } else {
            const quarter = Math.floor(dateObj.getUTCMonth() / 3) + 1;
            return `${dateObj.getUTCFullYear().toString().slice(-2)}-Q${quarter}`;
          }
        },
        tick:{ fontSize: 10, fill: textColor },
        stroke:axisColor,
        angle:-30,
        textAnchor:"end" as const,
        height:40,
        interval: 'preserveStartEnd' as const
    };
    const commonProps = {
        data: combinedChartData,
        margin: { top: 5, right: 5, left: 0, bottom: 40 }
    };

    switch (chartView) {
      case 'overview':
        return (
          <ComposedChart {...commonProps}>
            <defs>
              <linearGradient id="histPopGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="hsl(var(--chart-1))" stopOpacity={0.7}/><stop offset="95%" stopColor="hsl(var(--chart-1))" stopOpacity={0.1}/></linearGradient>
              <linearGradient id="forePopGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="hsl(var(--chart-1))" stopOpacity={0.4}/><stop offset="95%" stopColor="hsl(var(--chart-1))" stopOpacity={0.05}/></linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={axisColor} opacity={0.2} />
            <XAxis {...xAxisProps} />
            <YAxis yAxisId="left" orientation="left" stroke={axisColor} tick={{ fontSize: 10, fill: textColor }} label={{ value: 'Population (M)', angle: -90, position: 'insideLeft', fill: textColor, fontSize: 11, dy: 40 }}/>
            <YAxis yAxisId="right" orientation="right" stroke={axisColor} tick={{ fontSize: 10, fill: textColor }} label={{ value: 'GDP p.c. ($)', angle: 90, position: 'insideRight', fill: textColor, fontSize: 11, dy: -40 }} tickFormatter={(val) => `$${(val/1000).toFixed(0)}k`} />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{fontSize: "12px"}} />
            <Area yAxisId="left" type="monotone" dataKey="historicalPopulation" name="Population (M)" stroke="hsl(var(--chart-1))" fill="url(#histPopGrad)" dot={false} />
            <Area yAxisId="left" type="monotone" dataKey="forecastPopulation" name="Forecast Pop. (M)" stroke="hsl(var(--chart-1))" strokeDasharray="3 3" fill="url(#forePopGrad)" dot={false} />
            <Line yAxisId="right" type="monotone" dataKey="historicalGdpPerCapita" name="GDP p.c." stroke="hsl(var(--chart-2))" strokeWidth={2} dot={false}/>
            <Line yAxisId="right" type="monotone" dataKey="forecastGdpPerCapita" name="Forecast GDP p.c." stroke="hsl(var(--chart-2))" strokeDasharray="3 3" strokeWidth={2} dot={false}/>
          </ComposedChart>
        );
      case 'population':
        return (
          <AreaChart {...commonProps}>
            <defs><linearGradient id="popGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="hsl(var(--chart-1))" stopOpacity={0.7}/><stop offset="95%" stopColor="hsl(var(--chart-1))" stopOpacity={0.1}/></linearGradient></defs>
            <CartesianGrid strokeDasharray="3 3" stroke={axisColor} opacity={0.2} />
            <XAxis {...xAxisProps} />
            <YAxis tick={{ fontSize: 10, fill: textColor }} stroke={axisColor} label={{ value: 'Population (Millions)', angle: -90, position: 'insideLeft', fill: textColor, fontSize: 11 }}/>
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{fontSize: "12px"}}/>
            <Area type="monotone" dataKey="historicalPopulation" name="Population (M)" stroke="hsl(var(--chart-1))" fill="url(#popGrad)" dot={false}/>
            <Area type="monotone" dataKey="forecastPopulation" name="Forecast Pop. (M)" stroke="hsl(var(--chart-1))" strokeDasharray="3 3" fill="url(#popGrad)" fillOpacity={0.5} dot={false}/>
          </AreaChart>
        );
      case 'gdp':
        return (
          <ComposedChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" stroke={axisColor} opacity={0.2} />
            <XAxis {...xAxisProps} />
            <YAxis yAxisId="left" orientation="left" stroke={axisColor} tick={{ fontSize: 10, fill: textColor }} label={{ value: 'GDP per Capita ($)', angle: -90, position: 'insideLeft', fill: textColor, fontSize: 11, dy: 40 }} tickFormatter={(val) => `$${(val/1000).toFixed(0)}k`} />
            <YAxis yAxisId="right" orientation="right" stroke={axisColor} tick={{ fontSize: 10, fill: textColor }} label={{ value: 'Total GDP (B$)', angle: 90, position: 'insideRight', fill: textColor, fontSize: 11, dy: -40 }} />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{fontSize: "12px"}}/>
            <Line yAxisId="left" type="monotone" dataKey="historicalGdpPerCapita" name="GDP p.c." stroke="hsl(var(--chart-2))" strokeWidth={2} dot={false}/>
            <Line yAxisId="left" type="monotone" dataKey="forecastGdpPerCapita" name="Forecast GDP p.c." stroke="hsl(var(--chart-2))" strokeDasharray="3 3" strokeWidth={2} dot={false}/>
            <Bar yAxisId="right" dataKey="historicalTotalGdp" name="Total GDP (B$)" fill="hsl(var(--chart-3))" opacity={0.7} barSize={timeResolution === 'annual' ? 20 : 10} />
            <Bar yAxisId="right" dataKey="forecastTotalGdp" name="Forecast Total GDP (B$)" fill="hsl(var(--chart-3))" opacity={0.4} barSize={timeResolution === 'annual' ? 20 : 10} />
          </ComposedChart>
        );
      case 'density':
          if (!country.landArea) return <div className="flex h-full items-center justify-center text-muted-foreground"><AlertTriangle className="mr-2 h-5 w-5"/>Land area data unavailable for density charts.</div>;
        return (
          <ComposedChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" stroke={axisColor} opacity={0.2} />
            <XAxis {...xAxisProps} />
            <YAxis yAxisId="left" orientation="left" stroke={axisColor} tick={{ fontSize: 10, fill: textColor }} label={{ value: 'Pop. Density (/km²)', angle: -90, position: 'insideLeft', fill: textColor, fontSize: 11, dy: 50 }}/>
            <YAxis yAxisId="right" orientation="right" stroke={axisColor} tick={{ fontSize: 10, fill: textColor }} label={{ value: 'GDP Density (M$/km²)', angle: 90, position: 'insideRight', fill: textColor, fontSize: 11, dy: -50 }}/>
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{fontSize: "12px"}}/>
            <Bar yAxisId="left" dataKey="historicalPopulationDensity" name="Pop. Density" fill="hsl(var(--chart-4))" barSize={timeResolution === 'annual' ? 20 : 10} />
            <Bar yAxisId="left" dataKey="forecastPopulationDensity" name="Forecast Pop. Density" fill="hsl(var(--chart-4))" opacity={0.6} barSize={timeResolution === 'annual' ? 20 : 10} />
            <Line yAxisId="right" type="monotone" dataKey="historicalGdpDensity" name="GDP Density (M$/km²)" stroke="hsl(var(--chart-5))" strokeWidth={2} dot={false}/>
            <Line yAxisId="right" type="monotone" dataKey="forecastGdpDensity" name="Forecast GDP Density (M$/km²)" stroke="hsl(var(--chart-5))" strokeDasharray="3 3" strokeWidth={2} dot={false}/>
          </ComposedChart>
        );
      default: return <div className="flex h-full items-center justify-center text-muted-foreground"><Info className="mr-2 h-5 w-5"/>Select a chart view.</div>;
    }
  };

  if (isLoading && !historicalData?.length) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-7 w-3/4 mb-2" />
          <Skeleton className="h-4 w-1/2" />
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2 mb-4">
            <Skeleton className="h-9 w-24 rounded-md" />
            <Skeleton className="h-9 w-24 rounded-md" />
            <Skeleton className="h-9 w-24 rounded-md" />
          </div>
          <Skeleton className="h-80 w-full rounded-lg" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4">
            {Array.from({length: 4}).map((_,i) => <Skeleton key={i} className="h-16 w-full rounded-md"/>)}
          </div>
        </CardContent>
      </Card>
    );
  }
    const chartOptions = [
    { key: 'overview', label: 'Overview', icon: Activity },
    { key: 'population', label: 'Population', icon: Users },
    { key: 'gdp', label: 'GDP', icon: DollarSign },
    { key: 'density', label: 'Density', icon: Globe }
  ] as const;

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
                <Button variant={timeResolution === 'quarterly' ? "secondary" : "ghost"} size="sm" onClick={() => onTimeResolutionChange('quarterly')}>Quarterly</Button>
                <Button variant={timeResolution === 'annual' ? "secondary" : "ghost"} size="sm" onClick={() => onTimeResolutionChange('annual')}>Annual</Button>
            </div>
        </div>
        <CardDescription>
          Historical trends and {forecastYears > 0 ? `${forecastYears}-year forecast ` : ""}
          ending {IxTime.formatIxTime(targetTime, false)}. Current Resolution: {timeResolution}.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-2 mb-6">
            {chartOptions.map(({ key, label, icon: Icon }) => (
              <Button key={key} variant={chartView === key ? "default" : "outline"} size="sm" onClick={() => onChartViewChange(key)} className="flex items-center">
                <Icon className="h-4 w-4 mr-1.5" />{label}
              </Button>
            ))}
        </div>

        <div className="h-80 mb-4">
          {(isLoading || (showForecastInHistorical && isLoadingForecast)) && combinedChartData.length === 0 ? (
              <div className="h-full flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="ml-2 text-muted-foreground">Loading chart data...</p>
              </div>
          ) : combinedChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              {renderChart()}
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-center">
              <BarChart3 className="h-12 w-12 text-muted-foreground opacity-50 mb-2" />
              <p className="text-muted-foreground">
                No historical data available for the selected period or resolution.
              </p>
            </div>
          )}
        </div>

        {/* MODIFIED Stats Display Section */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 border-t">
          {[
            {
              label: "Population",
              value: formatNumber(country.currentPopulation, false, 0, true), // Use compact, precision 0 for non-currency K or <1K
              growth: country.populationGrowthRate
            },
            {
              label: "GDP p.c.",
              value: formatNumber(country.currentGdpPerCapita, true, 0, false), // Not compact, precision 0 for whole dollars
              growth: country.adjustedGdpGrowth
            },
            {
              label: "Total GDP",
              value: formatNumber(country.currentTotalGdp, true, 2, true), // Use compact, precision 2 for currency K or <1K
            },
            {label: "Economic Tier", value: country.economicTier, isBadge: true},
          ].map(stat => (
            <div key={stat.label} className="text-center sm:text-left">
              <div className="text-xs text-muted-foreground">{stat.label}</div>
              {stat.isBadge ? (
                <Badge variant="secondary" className="mt-1">{stat.value}</Badge>
              ) : (
                <div className="text-lg font-semibold text-foreground">{stat.value}</div>
              )}
              {stat.growth !== undefined && (
                <div className={cn("text-xs", stat.growth >=0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400')}>
                  {(stat.growth * 100).toFixed(1)}% growth
                </div>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}