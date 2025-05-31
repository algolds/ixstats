// src/app/countries/_components/charts/ChartDisplay.tsx
import { useState } from "react";
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Legend,
} from "recharts";
import { IxTime } from "~/lib/ixtime";
import { AlertTriangle, Globe, TrendingUp } from "lucide-react";
import { Button } from "~/components/ui/button";
import type { ChartType } from "../detail";

// Chart data types
interface ChartPoint {
  period: string;
  date: string;
  ixTimeTimestamp: number;
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

interface CountryData {
  landArea?: number | null;
}

interface ChartDisplayProps {
  chartView: ChartType;
  combinedData: ChartPoint[];
  country: CountryData;
  timeResolution: 'quarterly' | 'annual';
  theme: string;
  showForecast: boolean;
  showDensity: boolean;
  onToggleForecast: () => void;
  onToggleDensity: () => void;
}

export function ChartDisplay({
  chartView,
  combinedData,
  country,
  timeResolution,
  theme,
  showForecast,
  showDensity,
  onToggleForecast,
  onToggleDensity
}: ChartDisplayProps) {
  // Chart styling
  const axisColor = theme === 'dark' ? '#4A5568' : '#CBD5E0';
  const textColor = theme === 'dark' ? '#E2E8F0' : '#374151';
  
  // Common x-axis configuration
  const xAxisConfig = {
    dataKey: "ixTimeTimestamp",
    type: "number" as const,
    domain: ['dataMin', 'dataMax'] as [any, any],
    tickFormatter: (timestamp: number) => {
      if (!timestamp || isNaN(timestamp)) return '';
      try {
        if (timeResolution === 'annual') {
          return IxTime.getCurrentGameYear(timestamp).toString();
        } else {
          const gameYear = IxTime.getCurrentGameYear(timestamp);
          const dateObj = new Date(timestamp);
          const quarter = Math.floor(dateObj.getUTCMonth() / 3) + 1;
          return `${gameYear.toString().slice(-2)}-Q${quarter}`;
        }
      } catch (error) {
        console.warn('Error formatting timestamp:', timestamp, error);
        return '';
      }
    },
    tick: { fontSize: 10, fill: textColor },
    stroke: axisColor,
    angle: -30,
    textAnchor: "end" as const,
    height: 40,
    interval: 'preserveStartEnd' as const
  };
  
  // Custom tooltip
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
      const displayLabel = dataPoint.period || IxTime.formatIxTime(dataPoint.ixTimeTimestamp || label, false);
      return (
        <div style={tooltipStyle} className="shadow-lg">
          <p className="font-medium mb-2">{displayLabel}</p>
          {payload.map((entry: any, index: number) => (
            <div key={`item-${index}`} className="flex justify-between items-center text-xs mb-1">
              <span style={{ color: entry.color }} className="mr-2">{entry.name}:</span>
              <span className="font-semibold">
                {formatTooltipValue(entry.name, entry.value)}
              </span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  function formatTooltipValue(name: string, value: number): string {
    if (name.toLowerCase().includes('gdp') && name.toLowerCase().includes('capita')) {
      return `$${Number(value).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
    }
    if (name.toLowerCase().includes('gdp') && (name.toLowerCase().includes('billion') || name.toLowerCase().includes('total'))) {
      return `$${Number(value).toFixed(1)}B`;
    }
    if (name.toLowerCase().includes('population') && name.toLowerCase().includes('(m)')) {
      return `${Number(value).toFixed(1)}M`;
    }
    return Number(value).toLocaleString(undefined, { maximumFractionDigits: 2 });
  }

  // Chart control options
  const chartControls = () => (
    <div className="flex justify-end mb-2 gap-2">
      {chartView === 'population' || chartView === 'density' ? (
        <Button
          variant={showDensity ? "default" : "outline"}
          size="sm"
          onClick={onToggleDensity}
          disabled={!country.landArea}
        >
          <Globe className="h-3.5 w-3.5 mr-1.5" />
          Density
        </Button>
      ) : null}
      
      <Button
        variant={showForecast ? "default" : "outline"}
        size="sm"
        onClick={onToggleForecast}
      >
        <TrendingUp className="h-3.5 w-3.5 mr-1.5" />
        Forecast
      </Button>
    </div>
  );

  // Render appropriate chart based on chartView
  switch (chartView) {
    case 'population':
      return (
        <>
          {chartControls()}
          <ResponsiveContainer width="100%" height="93%">
            <AreaChart data={combinedData} margin={{ top: 5, right: 5, left: 0, bottom: 40 }}>
              <defs>
                <linearGradient id="popGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--chart-1))" stopOpacity={0.7}/>
                  <stop offset="95%" stopColor="hsl(var(--chart-1))" stopOpacity={0.1}/>
                </linearGradient>
                <linearGradient id="forePopGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--chart-1))" stopOpacity={0.4}/>
                  <stop offset="95%" stopColor="hsl(var(--chart-1))" stopOpacity={0.05}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={axisColor} opacity={0.2} />
              <XAxis {...xAxisConfig} />
              <YAxis 
                tick={{ fontSize: 10, fill: textColor }} 
                stroke={axisColor} 
                label={{ 
                  value: showDensity ? 'Population Density (/km²)' : 'Population (Millions)', 
                  angle: -90, 
                  position: 'insideLeft', 
                  fill: textColor, 
                  fontSize: 11 
                }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{fontSize: "12px"}}/>
              
              {!showDensity ? (
                <>
                  <Area 
                    type="monotone" 
                    dataKey="historicalPopulation" 
                    name="Population (M)" 
                    stroke="hsl(var(--chart-1))" 
                    fill="url(#popGrad)" 
                    dot={false}
                  />
                  {showForecast && (
                    <Area 
                      type="monotone" 
                      dataKey="forecastPopulation" 
                      name="Forecast Pop. (M)" 
                      stroke="hsl(var(--chart-1))" 
                      strokeDasharray="3 3" 
                      fill="url(#forePopGrad)" 
                      fillOpacity={0.5} 
                      dot={false}
                    />
                  )}
                </>
              ) : (
                <>
                  <Area 
                    type="monotone" 
                    dataKey="historicalPopulationDensity" 
                    name="Pop. Density" 
                    stroke="hsl(var(--chart-4))" 
                    fill="url(#popGrad)" 
                    dot={false}
                  />
                  {showForecast && (
                    <Area 
                      type="monotone" 
                      dataKey="forecastPopulationDensity" 
                      name="Forecast Density" 
                      stroke="hsl(var(--chart-4))" 
                      strokeDasharray="3 3" 
                      fill="url(#forePopGrad)" 
                      fillOpacity={0.5} 
                      dot={false}
                    />
                  )}
                </>
              )}
            </AreaChart>
          </ResponsiveContainer>
        </>
      );
      
    case 'gdp':
      return (
        <>
          {chartControls()}
          <ResponsiveContainer width="100%" height="93%">
            <ComposedChart data={combinedData} margin={{ top: 5, right: 5, left: 0, bottom: 40 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={axisColor} opacity={0.2} />
              <XAxis {...xAxisConfig} />
              <YAxis 
                yAxisId="left" 
                orientation="left" 
                stroke={axisColor} 
                tick={{ fontSize: 10, fill: textColor }} 
                label={{ 
                  value: 'GDP per Capita ($)', 
                  angle: -90, 
                  position: 'insideLeft', 
                  fill: textColor, 
                  fontSize: 11, 
                  dy: 40 
                }} 
                tickFormatter={(val) => `$${(val/1000).toFixed(0)}k`} 
              />
              <YAxis 
                yAxisId="right" 
                orientation="right" 
                stroke={axisColor} 
                tick={{ fontSize: 10, fill: textColor }} 
                label={{ 
                  value: 'Total GDP (B$)', 
                  angle: 90, 
                  position: 'insideRight', 
                  fill: textColor, 
                  fontSize: 11, 
                  dy: -40 
                }} 
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{fontSize: "12px"}}/>
              <Line 
                yAxisId="left" 
                type="monotone" 
                dataKey="historicalGdpPerCapita" 
                name="GDP p.c." 
                stroke="hsl(var(--chart-2))" 
                strokeWidth={2} 
                dot={false}
              />
              {showForecast && (
                <Line 
                  yAxisId="left" 
                  type="monotone" 
                  dataKey="forecastGdpPerCapita" 
                  name="Forecast GDP p.c." 
                  stroke="hsl(var(--chart-2))" 
                  strokeDasharray="3 3" 
                  strokeWidth={2} 
                  dot={false}
                />
              )}
              <Bar 
                yAxisId="right" 
                dataKey="historicalTotalGdp" 
                name="Total GDP (B$)" 
                fill="hsl(var(--chart-3))" 
                opacity={0.7} 
                barSize={timeResolution === 'annual' ? 20 : 10} 
              />
              {showForecast && (
                <Bar 
                  yAxisId="right" 
                  dataKey="forecastTotalGdp" 
                  name="Forecast Total GDP (B$)" 
                  fill="hsl(var(--chart-3))" 
                  opacity={0.4} 
                  barSize={timeResolution === 'annual' ? 20 : 10} 
                />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        </>
      );
      
    case 'density':
      if (!country.landArea) {
        return (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            <AlertTriangle className="mr-2 h-5 w-5"/>
            Land area data unavailable for density charts.
          </div>
        );
      }
      return (
        <>
          {chartControls()}
          <ResponsiveContainer width="100%" height="93%">
            <ComposedChart data={combinedData} margin={{ top: 5, right: 5, left: 0, bottom: 40 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={axisColor} opacity={0.2} />
              <XAxis {...xAxisConfig} />
              <YAxis 
                yAxisId="left" 
                orientation="left" 
                stroke={axisColor} 
                tick={{ fontSize: 10, fill: textColor }} 
                label={{ 
                  value: 'Pop. Density (/km²)', 
                  angle: -90, 
                  position: 'insideLeft', 
                  fill: textColor, 
                  fontSize: 11, 
                  dy: 50 
                }}
              />
              <YAxis 
                yAxisId="right" 
                orientation="right" 
                stroke={axisColor} 
                tick={{ fontSize: 10, fill: textColor }} 
                label={{ 
                  value: 'GDP Density (M$/km²)', 
                  angle: 90, 
                  position: 'insideRight', 
                  fill: textColor, 
                  fontSize: 11, 
                  dy: -50 
                }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{fontSize: "12px"}}/>
              <Bar 
                yAxisId="left" 
                dataKey="historicalPopulationDensity" 
                name="Pop. Density" 
                fill="hsl(var(--chart-4))" 
                barSize={timeResolution === 'annual' ? 20 : 10} 
              />
              {showForecast && (
                <Bar 
                  yAxisId="left" 
                  dataKey="forecastPopulationDensity" 
                  name="Forecast Pop. Density" 
                  fill="hsl(var(--chart-4))" 
                  opacity={0.6} 
                  barSize={timeResolution === 'annual' ? 20 : 10} 
                />
              )}
              <Line 
                yAxisId="right" 
                type="monotone" 
                dataKey="historicalGdpDensity" 
                name="GDP Density (M$/km²)" 
                stroke="hsl(var(--chart-5))" 
                strokeWidth={2} 
                dot={false}
              />
              {showForecast && (
                <Line 
                  yAxisId="right" 
                  type="monotone" 
                  dataKey="forecastGdpDensity" 
                  name="Forecast GDP Density (M$/km²)" 
                  stroke="hsl(var(--chart-5))" 
                  strokeDasharray="3 3" 
                  strokeWidth={2} 
                  dot={false}
                />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        </>
      );
      
    case 'overview':
    default:
      return (
        <>
          {chartControls()}
          <ResponsiveContainer width="100%" height="93%">
            <ComposedChart data={combinedData} margin={{ top: 5, right: 5, left: 0, bottom: 40 }}>
              <defs>
                <linearGradient id="histPopGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--chart-1))" stopOpacity={0.7}/>
                  <stop offset="95%" stopColor="hsl(var(--chart-1))" stopOpacity={0.1}/>
                </linearGradient>
                <linearGradient id="forePopGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--chart-1))" stopOpacity={0.4}/>
                  <stop offset="95%" stopColor="hsl(var(--chart-1))" stopOpacity={0.05}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={axisColor} opacity={0.2} />
              <XAxis {...xAxisConfig} />
              <YAxis 
                yAxisId="left" 
                orientation="left" 
                stroke={axisColor} 
                tick={{ fontSize: 10, fill: textColor }} 
                label={{ 
                  value: 'Population (M)', 
                  angle: -90, 
                  position: 'insideLeft', 
                  fill: textColor, 
                  fontSize: 11, 
                  dy: 40 
                }}
              />
              <YAxis 
                yAxisId="right" 
                orientation="right" 
                stroke={axisColor} 
                tick={{ fontSize: 10, fill: textColor }} 
                label={{ 
                  value: 'GDP p.c. ($)', 
                  angle: 90, 
                  position: 'insideRight', 
                  fill: textColor, 
                  fontSize: 11, 
                  dy: -40 
                }} 
                tickFormatter={(val) => `$${(val/1000).toFixed(0)}k`} 
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{fontSize: "12px"}} />
              <Area 
                yAxisId="left" 
                type="monotone" 
                dataKey="historicalPopulation" 
                name="Population (M)" 
                stroke="hsl(var(--chart-1))" 
                fill="url(#histPopGrad)" 
                dot={false} 
              />
              {showForecast && (
                <Area 
                  yAxisId="left" 
                  type="monotone" 
                  dataKey="forecastPopulation" 
                  name="Forecast Pop. (M)" 
                  stroke="hsl(var(--chart-1))" 
                  strokeDasharray="3 3" 
                  fill="url(#forePopGrad)" 
                  dot={false} 
                />
              )}
              <Line 
                yAxisId="right" 
                type="monotone" 
                dataKey="historicalGdpPerCapita" 
                name="GDP p.c." 
                stroke="hsl(var(--chart-2))" 
                strokeWidth={2} 
                dot={false}
              />
              {showForecast && (
                <Line 
                  yAxisId="right" 
                  type="monotone" 
                  dataKey="forecastGdpPerCapita" 
                  name="Forecast GDP p.c." 
                  stroke="hsl(var(--chart-2))" 
                  strokeDasharray="3 3" 
                  strokeWidth={2} 
                  dot={false}
                />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        </>
      );
  }
}

// Helper function for tooltip value formatting
function formatNumber(
  num: number | undefined | null,
  isCurrency = false,
  precision = 0,
  compact = false
): string {
  if (num === undefined || num === null || isNaN(num)) return isCurrency ? '$0' : '0';
  
  if (compact) {
    const absNum = Math.abs(num);
    if (absNum >= 1e12) return `${isCurrency ? '$' : ''}${(num / 1e12).toFixed(1)}T`;
    if (absNum >= 1e9) return `${isCurrency ? '$' : ''}${(num / 1e9).toFixed(1)}B`;
    if (absNum >= 1e6) return `${isCurrency ? '$' : ''}${(num / 1e6).toFixed(1)}M`;
    if (absNum >= 1e3) return `${isCurrency ? '$' : ''}${(num / 1e3).toFixed(0)}K`;
  }
  
  return `${isCurrency ? '$' : ''}${num.toLocaleString(undefined, {
    minimumFractionDigits: precision,
    maximumFractionDigits: precision
  })}`;
}
