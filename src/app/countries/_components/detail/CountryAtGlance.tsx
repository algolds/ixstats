// src/app/countries/_components/detail/CountryAtGlance.tsx
import { useState, useMemo, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Skeleton } from "~/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Label } from "~/components/ui/label";
import { IxTime } from "~/lib/ixtime";
import type { CountryDetailData } from "~/app/countries/[id]/page";

// Import necessary Recharts components
import {
  LineChart as RechartsLineChart,
  BarChart as RechartsBarChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Line,
  Bar,
} from "recharts";
import type { HistoricalDataPoint } from "~/types/ixstats";

interface CountryAtGlanceProps {
  country: CountryDetailData;
  historicalData: HistoricalDataPoint[];
  targetTime: number;
  forecastYears: number;
  isLoading: boolean;
  isLoadingForecast: boolean;
  chartView: 'overview' | 'population' | 'gdp' | 'density';
  timeResolution: 'quarterly' | 'annual';
  onTimeResolutionChange: (resolution: 'quarterly' | 'annual') => void;
  onChartViewChange: (view: 'overview' | 'population' | 'gdp' | 'density') => void;
}

interface ProcessedChartData {
  period: string;
  year: number;
  timestamp: number;
  // Raw values
  population: number;
  gdpPerCapita: number;
  totalGdp: number;
  populationDensity: number;
  gdpDensity: number;
  // Chart-friendly scaled values
  populationMillion: number;
  totalGdpBillion: number;
  populationDensityPerKm2: number;
  gdpDensityMillionPerKm2: number;
}

export function CountryAtGlance({
  country,
  historicalData,
  targetTime,
  forecastYears,
  isLoading,
  isLoadingForecast,
  chartView,
  timeResolution,
  onTimeResolutionChange,
  onChartViewChange,
}: CountryAtGlanceProps) {
  const [chartData, setChartData] = useState<ProcessedChartData[]>([]);

  

  // Enhanced chart data processing
  useEffect(() => {
    console.log("Processing historical data:", historicalData?.length || 0, "points");
    
    if (!historicalData || historicalData.length === 0) {
      console.log("No historical data available");
      setChartData([]);
      return;
    }

    try {
      // Convert and validate historical data
      const validData = historicalData
        .map((point) => {
          const timestamp = typeof point.ixTimeTimestamp === 'number' 
            ? point.ixTimeTimestamp 
            : point.ixTimeTimestamp.getTime();
          
          // Validate that we have valid numbers
          const population = Number(point.population) || 0;
          const gdpPerCapita = Number(point.gdpPerCapita) || 0;
          const totalGdp = Number(point.totalGdp) || 0;
          const populationDensity = Number(point.populationDensity) || 0;
          const gdpDensity = Number(point.gdpDensity) || 0;

          // Skip invalid data points
          if (!isFinite(timestamp) || population <= 0 || gdpPerCapita <= 0) {
            return null;
          }

          const date = new Date(timestamp);
          const year = date.getUTCFullYear();
          
          let periodLabel: string;
          if (timeResolution === 'quarterly') {
            const quarter = Math.floor(date.getUTCMonth() / 3) + 1;
            periodLabel = `Q${quarter} ${year}`;
          } else {
            periodLabel = year.toString();
          }

          return {
            period: periodLabel,
            year,
            timestamp,
            // Raw values for tooltips
            population,
            gdpPerCapita,
            totalGdp,
            populationDensity,
            gdpDensity,
            // Scaled values for charts
            populationMillion: population / 1000000,
            totalGdpBillion: totalGdp / 1000000000,
            populationDensityPerKm2: populationDensity,
            gdpDensityMillionPerKm2: gdpDensity / 1000000,
          };
        })
        .filter((point): point is ProcessedChartData => point !== null)
        .sort((a, b) => a.timestamp - b.timestamp);

      console.log("Valid data points:", validData.length);

      // For annual resolution, keep only the latest data point per year
      if (timeResolution === 'annual') {
        const yearMap = new Map<number, ProcessedChartData>();
        validData.forEach(point => {
          const existing = yearMap.get(point.year);
          if (!existing || point.timestamp > existing.timestamp) {
            yearMap.set(point.year, point);
          }
        });
        const annualData = Array.from(yearMap.values()).sort((a, b) => a.year - b.year);
        console.log("Annual data points:", annualData.length);
        setChartData(annualData);
      } else {
        console.log("Quarterly data points:", validData.length);
        setChartData(validData);
      }
    } catch (error) {
      console.error("Error processing historical data:", error);
      setChartData([]);
    }
  }, [historicalData, timeResolution]);

  // Enhanced tooltip with proper formatting
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || payload.length === 0) return null;

    return (
      <div className="bg-background border border-border rounded-lg p-3 shadow-lg">
        <p className="font-semibold mb-2 text-sm">{`Period: ${label}`}</p>
        {payload.map((entry: any) => {
          let formattedValue = '';
          const rawValue = entry.value;

          // Format based on the data key
          switch (entry.dataKey) {
            case 'populationMillion':
              formattedValue = (rawValue * 1000);
              break;
            case 'totalGdpBillion':
              formattedValue = (rawValue * 1000);
              break;
            case 'gdpPerCapita':
              formattedValue = (rawValue);
              break;
            case 'populationDensityPerKm2':
              formattedValue = `${rawValue.toFixed(1)} per km²`;
              break;
            case 'gdpDensityMillionPerKm2':
              formattedValue = `$${rawValue.toFixed(1)}M per km²`;
              break;
            default:
              formattedValue = rawValue.toLocaleString();
          }

          return (
            <div key={entry.dataKey} className="flex justify-between items-center text-xs gap-2" style={{ color: entry.color }}>
              <span>{entry.name}:</span>
              <span className="font-semibold">{formattedValue}</span>
            </div>
          );
        })}
      </div>
    );
  };

  // Loading state
  if (isLoading) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Country Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-20" />
            ))}
          </div>
          <Skeleton className="h-[350px] w-full" />
        </CardContent>
      </Card>
    );
  }

  // Chart configuration
  const hasData = chartData.length > 0;

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <CardTitle>Country Overview</CardTitle>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Label htmlFor="resolution" className="text-sm">Resolution</Label>
              <Select
                value={timeResolution}
                onValueChange={(value) => onTimeResolutionChange(value as 'quarterly' | 'annual')}
              >
                <SelectTrigger id="resolution" className="w-32">
                  <SelectValue placeholder="Select resolution" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="annual">Annual</SelectItem>
                  <SelectItem value="quarterly">Quarterly</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Statistics Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-muted/50 p-4 rounded-lg">
            <div className="text-sm text-muted-foreground">Population</div>
            <div className="text-2xl font-bold mt-1">{population}</div>
          </div>
          <div className="bg-muted/50 p-4 rounded-lg">
            <div className="text-sm text-muted-foreground">GDP per Capita</div>
            <div className="text-2xl font-bold mt-1">{gdpPerCapita}</div>
          </div>
          <div className="bg-muted/50 p-4 rounded-lg">
            <div className="text-sm text-muted-foreground">Total GDP</div>
            <div className="text-2xl font-bold mt-1">{gdp}</div>
          </div>
          <div className="bg-muted/50 p-4 rounded-lg">
            <div className="text-sm text-muted-foreground">Population Density</div>
            <div className="text-2xl font-bold mt-1">{density}</div>
          </div>
        </div>

        {/* Data Status */}
        {!hasData && (
          <div className="flex items-center justify-center py-8 text-muted-foreground bg-muted/20 rounded-lg mb-6">
            <div className="text-center">
              <p className="font-medium">No historical data available</p>
              <p className="text-sm mt-1">Historical trends will appear when data is loaded</p>
            </div>
          </div>
        )}

        {/* Chart Section */}
        <Tabs defaultValue={chartView} value={chartView} onValueChange={(value) => onChartViewChange(value as any)}>
          <TabsList className="mb-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="population">Population</TabsTrigger>
            <TabsTrigger value="gdp">GDP</TabsTrigger>
            <TabsTrigger value="density">Density</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <h4 className="text-lg font-semibold mb-2">Population Trend</h4>
                <p className="text-sm text-muted-foreground mb-2">Historical population growth over time</p>
                <ResponsiveContainer width="100%" height={250}>
                  <RechartsLineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                    <XAxis 
                      dataKey="period" 
                      tick={{ fontSize: 10 }}
                      interval={'preserveStartEnd'}
                    />
                    <YAxis 
                      tick={{ fontSize: 10 }}
                      tickFormatter={(value) => `${value.toFixed(1)}M`}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend />
                    <Line 
                      type="monotone" 
                      dataKey="populationMillion" 
                      name="Population (Millions)" 
                      stroke="#3b82f6" 
                      strokeWidth={2} 
                      dot={{ r: 3 }}
                      connectNulls={false}
                    />
                  </RechartsLineChart>
                </ResponsiveContainer>
              </div>
              <div>
                <h4 className="text-lg font-semibold mb-2">GDP Trend</h4>
                <p className="text-sm text-muted-foreground mb-2">Historical economic growth over time</p>
                <ResponsiveContainer width="100%" height={250}>
                  <RechartsLineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                    <XAxis 
                      dataKey="period" 
                      tick={{ fontSize: 10 }}
                      interval={'preserveStartEnd'}
                    />
                    <YAxis 
                      tick={{ fontSize: 10 }}
                      tickFormatter={(value) => `$${value.toFixed(1)}B`}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend />
                    <Line 
                      type="monotone" 
                      dataKey="totalGdpBillion" 
                      name="Total GDP (Billions)" 
                      stroke="#10b981" 
                      strokeWidth={2} 
                      dot={{ r: 3 }}
                      connectNulls={false}
                    />
                  </RechartsLineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="population">
            <div>
              <h4 className="text-lg font-semibold mb-2">Population Trend</h4>
              <p className="text-sm text-muted-foreground mb-2">Historical population growth and development</p>
              <ResponsiveContainer width="100%" height={350}>
                <RechartsLineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis 
                    dataKey="period" 
                    tick={{ fontSize: 10 }}
                    interval={'preserveStartEnd'}
                  />
                  <YAxis 
                    tick={{ fontSize: 10 }}
                    tickFormatter={(value) => `${value.toFixed(1)}M`}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey="populationMillion" 
                    name="Population (Millions)" 
                    stroke="#3b82f6" 
                    strokeWidth={2} 
                    dot={{ r: 3 }}
                    connectNulls={false}
                  />
                </RechartsLineChart>
              </ResponsiveContainer>
            </div>
          </TabsContent>

          <TabsContent value="gdp" className="space-y-4">
            <div>
              <h4 className="text-lg font-semibold mb-2">Economic Indicators</h4>
              <p className="text-sm text-muted-foreground mb-2">Historical GDP trends and per capita development</p>
              <ResponsiveContainer width="100%" height={350}>
                <RechartsLineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis 
                    dataKey="period" 
                    tick={{ fontSize: 10 }}
                    interval={'preserveStartEnd'}
                  />
                  <YAxis 
                    yAxisId="left" 
                    orientation="left" 
                    tick={{ fontSize: 10 }}
                    tickFormatter={(value) => `$${value.toFixed(1)}B`}
                  />
                  <YAxis 
                    yAxisId="right" 
                    orientation="right" 
                    tick={{ fontSize: 10 }}
                    tickFormatter={(value) => `$${(value/1000).toFixed(0)}K`}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  <Line 
                    yAxisId="left"
                    type="monotone" 
                    dataKey="totalGdpBillion" 
                    name="Total GDP (Billions)" 
                    stroke="#10b981" 
                    strokeWidth={2} 
                    dot={{ r: 3 }}
                    connectNulls={false}
                  />
                  <Line 
                    yAxisId="right"
                    type="monotone" 
                    dataKey="gdpPerCapita" 
                    name="GDP per Capita" 
                    stroke="#f59e0b" 
                    strokeWidth={2} 
                    dot={{ r: 3 }}
                    connectNulls={false}
                  />
                </RechartsLineChart>
              </ResponsiveContainer>
            </div>
          </TabsContent>

          <TabsContent value="density">
            <div>
              <h4 className="text-lg font-semibold mb-2">Density Metrics</h4>
              <p className="text-sm text-muted-foreground mb-2">Population and economic density per km²</p>
              <ResponsiveContainer width="100%" height={350}>
                <RechartsBarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis 
                    dataKey="period" 
                    tick={{ fontSize: 10 }}
                    interval={'preserveStartEnd'}
                  />
                  <YAxis 
                    yAxisId="left" 
                    orientation="left" 
                    tick={{ fontSize: 10 }}
                    tickFormatter={(value) => value.toFixed(0)}
                  />
                  <YAxis 
                    yAxisId="right" 
                    orientation="right" 
                    tick={{ fontSize: 10 }}
                    tickFormatter={(value) => `$${value.toFixed(1)}M`}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  <Bar 
                    yAxisId="left"
                    dataKey="populationDensityPerKm2" 
                    name="Population Density (per km²)" 
                    fill="#6366f1" 
                    opacity={0.8}
                  />
                  <Bar 
                    yAxisId="right"
                    dataKey="gdpDensityMillionPerKm2" 
                    name="GDP Density (M$/km²)" 
                    fill="#ec4899" 
                    opacity={0.8}
                  />
                </RechartsBarChart>
              </ResponsiveContainer>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}