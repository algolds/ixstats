"use client";

import { useMemo, useState } from "react";
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ComposedChart,
  ReferenceLine,
  Brush,
  ScatterChart,
  Scatter,
} from "recharts";
import {
  TrendingUp,
  Users,
  DollarSign,
  Globe,
  Activity,
  BarChart3,
  Calendar,
  Settings2,
  Eye,
  EyeOff,
} from "lucide-react";
import { IxTime } from "~/lib/ixtime";
import { useTheme } from "~/context/theme-context";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Separator } from "~/components/ui/separator";
import { Checkbox } from "~/components/ui/checkbox";
import { IxTimeCalendar } from "./IxTimeCalendar";

// Chart data interfaces
interface ChartDataPoint {
  ixTimeTimestamp: number;
  formattedDate: string;
  gameYear: number;
  population: number;
  gdpPerCapita: number;
  totalGdp: number;
  populationGrowthRate?: number;
  gdpGrowthRate?: number;
  populationDensity?: number | null;
  gdpDensity?: number | null;
  landArea?: number | null;
}

interface CountryChartData {
  id: string;
  name: string;
  currentIxTime: number;
  gameEpoch: number;
  historicalData: ChartDataPoint[];
  forecastData?: ChartDataPoint[];
}

export type ChartType = 
  | 'overview' 
  | 'population' 
  | 'gdp' 
  | 'growth' 
  | 'density' 
  | 'efficiency';

export type TimeRange = '1Y' | '5Y' | '10Y' | '15Y' | 'ALL' | 'CUSTOM';

interface IxStatsChartsProps {
  data: CountryChartData;
  selectedChartType: ChartType;
  /** Client-side callback for chart type changes */
  onChartTypeChangeAction: (type: ChartType) => void;
  selectedTimeRange: TimeRange;
  /** Client-side callback for time range changes */
  onTimeRangeChangeAction: (range: TimeRange) => void;
  customStartTime?: number;
  customEndTime?: number;
  /** Client-side callback for custom time range changes */
  onCustomTimeChangeAction?: (startTime: number, endTime: number) => void;
  isLoading?: boolean;
  showForecast?: boolean;
  /** Client-side callback for forecast toggle */
  onForecastToggleAction?: (show: boolean) => void;
}

export function IxStatsCharts({
  data,
  selectedChartType,
  onChartTypeChangeAction,
  selectedTimeRange,
  onTimeRangeChangeAction,
  customStartTime,
  customEndTime,
  onCustomTimeChangeAction,
  isLoading = false,
  showForecast = false,
  onForecastToggleAction,
}: IxStatsChartsProps) {
  const { theme } = useTheme();
  const [visibleSeries, setVisibleSeries] = useState<Record<string, boolean>>({
    population: true,
    gdpPerCapita: true,
    totalGdp: true,
    populationDensity: true,
    gdpDensity: true,
    populationGrowth: false,
    gdpGrowth: false,
  });

  // Calculate time range bounds
  const timeRangeBounds = useMemo(() => {
    const currentTime = data.currentIxTime;
    let startTime: number;
    let endTime: number = currentTime;

    switch (selectedTimeRange) {
      case '1Y':
        startTime = IxTime.addYears(currentTime, -1);
        break;
      case '5Y':
        startTime = IxTime.addYears(currentTime, -5);
        break;
      case '10Y':
        startTime = IxTime.addYears(currentTime, -10);
        break;
      case '15Y':
        startTime = IxTime.addYears(currentTime, -15);
        break;
      case 'CUSTOM':
        startTime = customStartTime || IxTime.addYears(currentTime, -10);
        endTime = customEndTime || currentTime;
        break;
      case 'ALL':
      default:
        startTime = data.gameEpoch;
        break;
    }

    return { startTime, endTime };
  }, [selectedTimeRange, data.currentIxTime, data.gameEpoch, customStartTime, customEndTime]);

  // Filter and process chart data
  const processedData = useMemo(() => {
    const historical = data.historicalData.filter(
      point => point.ixTimeTimestamp >= timeRangeBounds.startTime && 
               point.ixTimeTimestamp <= timeRangeBounds.endTime
    );

    const forecast = showForecast && data.forecastData 
      ? data.forecastData.filter(point => point.ixTimeTimestamp > timeRangeBounds.endTime)
      : [];

    // Combine historical and forecast data
    const combined = [...historical, ...forecast].map((point, index) => ({
      ...point,
      // Scale values for better visualization
      populationM: point.population / 1000000,
      totalGdpB: point.totalGdp / 1000000000,
      gdpPerCapitaK: point.gdpPerCapita / 1000,
      // Mark forecast points
      isForecast: point.ixTimeTimestamp > data.currentIxTime,
      // Create unique key for chart
      uniqueKey: `${point.gameYear}-${point.ixTimeTimestamp}-${index}`,
    }));

    return combined.sort((a, b) => a.ixTimeTimestamp - b.ixTimeTimestamp);
  }, [data.historicalData, data.forecastData, timeRangeBounds, showForecast, data.currentIxTime]);

  // Chart styling
  const chartTheme = useMemo(() => {
    const isDark = theme === 'dark';
    return {
      grid: isDark ? '#374151' : '#e5e7eb',
      text: isDark ? '#9ca3af' : '#6b7280',
      axis: isDark ? '#6b7280' : '#9ca3af',
      tooltip: {
        backgroundColor: isDark ? '#1f2937' : '#ffffff',
        border: `1px solid ${isDark ? '#374151' : '#e5e7eb'}`,
        color: isDark ? '#f9fafb' : '#111827',
      },
    };
  }, [theme]);

  // Custom tooltip component
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;

    const data = payload[0]?.payload;
    if (!data) return null;

    return (
      <div 
        className="p-3 rounded-lg border shadow-lg backdrop-blur-sm"
        style={chartTheme.tooltip}
      >
        <div className="space-y-2">
          <div className="font-medium">
            {IxTime.formatIxTime(data.ixTimeTimestamp)}
          </div>
          <div className="text-sm text-muted-foreground">
            Game Year {data.gameYear}
            {data.isForecast && <Badge variant="outline" className="ml-2 text-xs">Forecast</Badge>}
          </div>
          <Separator />
          {payload.map((entry: any) => (
            <div key={entry.dataKey} className="flex justify-between items-center gap-4">
              <span style={{ color: entry.color }} className="text-sm">
                {entry.name}:
              </span>
              <span className="font-medium text-sm">{entry.value}</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // Chart type configurations
  const getChartConfig = (type: ChartType) => {
    const configs = {
      overview: {
        title: "Population & Economic Overview",
        icon: Activity,
        description: "Combined view of population and economic indicators",
        yAxisLeft: "Population (M)",
        yAxisRight: "GDP per Capita ($K)",
        series: [
          { key: "populationM", name: "Population", color: "#8b5cf6", yAxisId: "left", type: "area" },
          { key: "gdpPerCapitaK", name: "GDP per Capita", color: "#06b6d4", yAxisId: "right", type: "line" },
        ]
      },
      population: {
        title: "Population Analysis",
        icon: Users,
        description: "Population trends and demographic analysis",
        yAxisLeft: "Population (M)",
        yAxisRight: "Growth Rate (%)",
        series: [
          { key: "populationM", name: "Population", color: "#8b5cf6", yAxisId: "left", type: "area" },
          { key: "populationGrowthRate", name: "Growth Rate", color: "#f97316", yAxisId: "right", type: "line" },
        ]
      },
      gdp: {
        title: "Economic Performance",
        icon: DollarSign,
        description: "GDP and economic growth analysis",
        yAxisLeft: "GDP per Capita ($K)",
        yAxisRight: "Total GDP ($B)",
        series: [
          { key: "gdpPerCapitaK", name: "GDP per Capita", color: "#06b6d4", yAxisId: "left", type: "line" },
          { key: "totalGdpB", name: "Total GDP", color: "#84cc16", yAxisId: "right", type: "area" },
        ]
      },
      growth: {
        title: "Growth Rate Analysis",
        icon: TrendingUp,
        description: "Population and economic growth rates over time",
        yAxisLeft: "Growth Rate (%)",
        yAxisRight: "",
        series: [
          { key: "populationGrowthRate", name: "Population Growth", color: "#8b5cf6", yAxisId: "left", type: "line" },
          { key: "gdpGrowthRate", name: "GDP Growth", color: "#06b6d4", yAxisId: "left", type: "line" },
        ]
      },
      density: {
        title: "Density Analysis",
        icon: Globe,
        description: "Population and economic density metrics",
        yAxisLeft: "Population Density",
        yAxisRight: "GDP Density",
        series: [
          { key: "populationDensity", name: "Pop. Density", color: "#8b5cf6", yAxisId: "left", type: "line" },
          { key: "gdpDensity", name: "GDP Density", color: "#06b6d4", yAxisId: "right", type: "line" },
        ]
      },
      efficiency: {
        title: "Economic Efficiency",
        icon: BarChart3,
        description: "Economic output efficiency and productivity",
        yAxisLeft: "GDP per Capita ($K)",
        yAxisRight: "GDP Density",
        series: [
          { key: "gdpPerCapitaK", name: "GDP per Capita", color: "#06b6d4", yAxisId: "left", type: "bar" },
          { key: "gdpDensity", name: "GDP Density", color: "#84cc16", yAxisId: "right", type: "line" },
        ]
      },
    };

    return configs[type] || configs.overview;
  };

  const currentConfig = getChartConfig(selectedChartType);

  const handleSeriesToggle = (seriesKey: string) => {
    setVisibleSeries(prev => ({
      ...prev,
      [seriesKey]: !prev[seriesKey]
    }));
  };

  const handleCustomTimeStart = (ixTime: number) => {
    if (onCustomTimeChangeAction && customEndTime) {
      onCustomTimeChangeAction(ixTime, customEndTime);
    }
  };

  const handleCustomTimeEnd = (ixTime: number) => {
    if (onCustomTimeChangeAction && customStartTime) {
      onCustomTimeChangeAction(customStartTime, ixTime);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <div className="animate-pulse space-y-2">
            <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/3"></div>
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-96 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <currentConfig.icon className="h-5 w-5 text-primary" />
              {currentConfig.title}
            </CardTitle>
            <CardDescription>{currentConfig.description}</CardDescription>
          </div>
          
          <div className="flex items-center gap-2">
            {onForecastToggleAction && data.forecastData && (
              <Button
                variant={showForecast ? "default" : "outline"}
                size="sm"
                onClick={() => onForecastToggleAction(!showForecast)}
              >
                {showForecast ? <Eye className="h-4 w-4 mr-2" /> : <EyeOff className="h-4 w-4 mr-2" />}
                Forecast
              </Button>
            )}
          </div>
        </div>

        {/* Chart Controls */}
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
          {/* Chart Type Selector */}
          <select 
            value={selectedChartType} 
            onChange={(e) => onChartTypeChangeAction(e.target.value as ChartType)}
            className="w-48 flex items-center justify-between gap-2 rounded-md border bg-transparent px-3 py-2 text-sm"
          >
            <option value="overview">Overview</option>
            <option value="population">Population</option>
            <option value="gdp">GDP Analysis</option>
            <option value="growth">Growth Rates</option>
            <option value="density">Density</option>
            <option value="efficiency">Efficiency</option>
          </select>

          {/* Time Range Selector */}
          <select
            value={selectedTimeRange}
            onChange={(e) => onTimeRangeChangeAction(e.target.value as TimeRange)}
            className="w-32 flex items-center justify-between gap-2 rounded-md border bg-transparent px-3 py-2 text-sm"
          >
            <option value="1Y">1 Year</option>
            <option value="5Y">5 Years</option>
            <option value="10Y">10 Years</option>
            <option value="15Y">15 Years</option>
            <option value="ALL">All Time</option>
            <option value="CUSTOM">Custom</option>
          </select>

          {/* Custom Time Range Controls */}
          {selectedTimeRange === 'CUSTOM' && onCustomTimeChangeAction && (
            <div className="flex items-center gap-2">
              <IxTimeCalendar
                selectedIxTime={customStartTime || IxTime.addYears(data.currentIxTime, -10)}
                onIxTimeChangeAction={handleCustomTimeStart}
                maxIxTime={customEndTime || data.currentIxTime}
                gameEpoch={data.gameEpoch}
              />
              <span className="text-sm text-muted-foreground">to</span>
              <IxTimeCalendar
                selectedIxTime={customEndTime || data.currentIxTime}
                onIxTimeChangeAction={handleCustomTimeEnd}
                minIxTime={customStartTime || data.gameEpoch}
                maxIxTime={data.currentIxTime}
                gameEpoch={data.gameEpoch}
              />
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent>
        <div className="space-y-4">
          {/* Series Visibility Controls */}
          <div className="flex flex-wrap gap-2">
            {currentConfig.series.map((series: any) => (
              <div key={series.key} className="flex items-center space-x-2" title={`Toggle ${series.name} visibility`}>
                <Checkbox
                  id={series.key}
                  checked={visibleSeries[series.key] ?? true}
                  onCheckedChange={() => handleSeriesToggle(series.key)}
                />
                <label
                  htmlFor={series.key}
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  style={{ color: series.color }}
                >
                  {series.name}
                </label>
              </div>
            ))}
          </div>

          {/* Chart */}
          <div className="h-96 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={processedData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} opacity={0.5} />
                <XAxis 
                  dataKey="uniqueKey"
                  tick={{ fontSize: 12, fill: chartTheme.text }}
                  stroke={chartTheme.axis}
                  tickFormatter={(value) => {
                    // Extract gameYear from uniqueKey (format: gameYear-timestamp-index)
                    const gameYear = value.split('-')[0];
                    return gameYear;
                  }}
                />
                
                {currentConfig.yAxisLeft && (
                  <YAxis 
                    yAxisId="left" 
                    orientation="left" 
                    tick={{ fontSize: 12, fill: chartTheme.text }}
                    stroke={chartTheme.axis}
                    label={{ value: currentConfig.yAxisLeft, angle: -90, position: 'insideLeft' }}
                  />
                )}
                
                {currentConfig.yAxisRight && (
                  <YAxis 
                    yAxisId="right" 
                    orientation="right" 
                    tick={{ fontSize: 12, fill: chartTheme.text }}
                    stroke={chartTheme.axis}
                    label={{ value: currentConfig.yAxisRight, angle: 90, position: 'insideRight' }}
                  />
                )}

                <Tooltip content={<CustomTooltip />} />
                <Legend />

                {/* Reference line for current time */}
                {(() => {
                  const currentGameYear = IxTime.getCurrentGameYear(data.currentIxTime);
                  const referencePoint = processedData.find(point => 
                    Math.abs(point.gameYear - currentGameYear) < 0.1
                  );
                  if (referencePoint) {
                    return (
                      <ReferenceLine 
                        x={referencePoint.uniqueKey} 
                        stroke="#ef4444" 
                        strokeDasharray="2 2"
                        label="Present"
                        yAxisId="left"
                      />
                    );
                  }
                  return null;
                })()}

              {/* Render series based on configuration */}
{currentConfig.series.map(series => {
  if (!visibleSeries[series.key]) return null;

  // Extract key for direct assignment
  const { key, ...commonProps } = {
    key: series.key,
    dataKey: series.key,
    name: series.name,
    stroke: series.color,
    yAxisId: series.yAxisId,
  };

  switch (series.type) {
    case 'area':
      return (
        <Area
          key={key}
          {...commonProps}
          fill={series.color}
          fillOpacity={0.3}
          strokeWidth={2}
        />
      );
    case 'bar':
      return (
        <Bar
          key={key}
          {...commonProps}
          fill={series.color}
          fillOpacity={0.8}
        />
      );
    case 'line':
    default:
      return (
        <Line
          key={key}
          {...commonProps}
          strokeWidth={2}
          dot={false}
          connectNulls={false}
        />
      );
  }
})}


                {/* Brush for time navigation */}
                <Brush 
                  dataKey="uniqueKey" 
                  height={30} 
                  stroke={chartTheme.axis}
                  fill={chartTheme.grid}
                  opacity={0.5}
                  tickFormatter={(value) => {
                    // Extract gameYear from uniqueKey (format: gameYear-timestamp-index)
                    const gameYear = value.split('-')[0];
                    return gameYear;
                  }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          {/* Chart Statistics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 border-t">
            <div className="text-center">
              <p className="text-sm text-muted-foreground">Data Points</p>
              <p className="text-lg font-semibold">{processedData.length}</p>
            </div>
            <div className="text-center">
              <p className="text-sm text-muted-foreground">Time Span</p>
              <p className="text-lg font-semibold">
                {IxTime.getYearsElapsed(timeRangeBounds.startTime, timeRangeBounds.endTime).toFixed(1)}y
              </p>
            </div>
            <div className="text-center">
              <p className="text-sm text-muted-foreground">Start Year</p>
              <p className="text-lg font-semibold">
                {IxTime.getCurrentGameYear(timeRangeBounds.startTime)}
              </p>
            </div>
            <div className="text-center">
              <p className="text-sm text-muted-foreground">End Year</p>
              <p className="text-lg font-semibold">
                {IxTime.getCurrentGameYear(timeRangeBounds.endTime)}
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
