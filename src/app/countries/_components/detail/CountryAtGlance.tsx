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
import { formatNumber } from "~/lib/theme-utils";

// Import necessary Recharts components
import {
  LineChart as RechartsLineChart, // Alias to avoid naming conflict if you create a wrapper
  BarChart as RechartsBarChart,   // Alias
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
  historicalData: HistoricalDataPoint[]; // Use a more specific type if available, e.g., from CountryDetailData['historicalData']
  targetTime: number;
  forecastYears: number;
  isLoading: boolean;
  isLoadingForecast: boolean; // This prop is kept, but forecast logic is simplified below
  chartView: 'overview' | 'population' | 'gdp' | 'density';
  timeResolution: 'quarterly' | 'annual';
  onTimeResolutionChange: (resolution: 'quarterly' | 'annual') => void;
  onChartViewChange: (view: 'overview' | 'population' | 'gdp' | 'density') => void;
}

// A generic type for chart data points, assuming 'period' is the x-axis key
interface ChartDataPoint {
  period: string | number; // Or Date
  [key: string]: any; // For other dynamic data keys
}

export function CountryAtGlance({
  country,
  historicalData, //
  targetTime,
  forecastYears,
  isLoading,
  isLoadingForecast, // Kept for consistency, though forecast display is simplified
  chartView,
  timeResolution,
  onTimeResolutionChange,
  onChartViewChange,
}: CountryAtGlanceProps) {
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]); //
  // const [normalizeValues, setNormalizeValues] = useState(true); // This state was unused, can be re-added if normalization logic is implemented

  const formattedValues = useMemo(() => ({
    population: formatNumber(country.currentPopulation / 1000000, false, 2) + " million", //
    gdpPerCapita: formatNumber(country.currentGdpPerCapita, true, 0), //
    gdp: formatNumber(country.currentTotalGdp / 1000000000, true, 2) + " billion", //
    density: country.populationDensity
      ? formatNumber(country.populationDensity, false, 1) + " per km²" //
      : "N/A",
    gdpDensity: country.gdpDensity
      ? formatNumber(country.gdpDensity / 1000000, true, 1) + "M per km²" //
      : "N/A",
  }), [country]);

  useEffect(() => {
    if (!historicalData || historicalData.length === 0) { //
      setChartData([]);
      return;
    }

    // FIX for Error 1: Process historicalData array correctly
    // Assuming historicalData items have properties like ixTimeTimestamp, population, totalGdp, gdpPerCapita etc.
    // And that 'period' will be derived (e.g., from ixTimeTimestamp or a year field)
    const processedHistoricalData = historicalData.map((dp: HistoricalDataPoint) => {
      // Transform dataPoint to the structure expected by the chart
      // Keep data numeric for charting; formatting should be done in tooltips or axis ticks
      return {
        // Assuming dp.ixTimeTimestamp can be used or converted to a 'period' for the XAxis
        // For simplicity, using the raw timestamp or a year. Adjust as needed.
        period: new Date(dp.ixTimeTimestamp).getFullYear().toString(), // Example: using year as period
        population: dp.population,
        totalGdp: dp.totalGdp,
        gdpPerCapita: dp.gdpPerCapita,
        populationDensity: dp.populationDensity,
        gdpDensity: dp.gdpDensity,
        // Add other fields from dp as necessary
      };
    });

    // Forecast data processing was not implemented and caused errors.
    // For a clean template, this part is simplified.
    // If you have forecast data, you'll need to process and combine it here.
    // const combinedData = processAndCombineForecast(processedHistoricalData, country.forecastDataPoints, forecastYears, timeResolution, normalizeValues);
    
    setChartData(processedHistoricalData as ChartDataPoint[]);
  }, [country, historicalData, targetTime, forecastYears, timeResolution /*, normalizeValues */]); //

  if (isLoading) { //
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Country Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <Skeleton className="h-20" /> {/* */}
            <Skeleton className="h-20" /> {/* */}
            <Skeleton className="h-20" /> {/* */}
            <Skeleton className="h-20" /> {/* */}
          </div>
          <Skeleton className="h-[350px] w-full" /> {/* */}
        </CardContent>
      </Card>
    );
  }

  // Original dataKeys structures from your provided code
  const overviewPopulationKeys = [
    { key: 'population', name: 'Population (M)', color: '#3b82f6' }, //
    ...(forecastYears > 0 ? [{ key: 'population_forecast', name: 'Forecast (M)', color: '#93c5fd' }] : []) // Assuming forecast data would have distinct keys
  ];
  const overviewGdpKeys = [
    { key: 'totalGdp', name: 'GDP ($B)', color: '#10b981' }, //
    ...(forecastYears > 0 ? [{ key: 'totalGdp_forecast', name: 'Forecast ($B)', color: '#6ee7b7' }] : [])
  ];
  const populationTrendKeys = overviewPopulationKeys; // Same as overview for now
  const gdpTrendKeys = overviewGdpKeys; // Same as overview for now
  const gdpPerCapitaKeys = [
    { key: 'gdpPerCapita', name: 'GDP per Capita ($)', color: '#f59e0b' }, //
    ...(forecastYears > 0 ? [{ key: 'gdpPerCapita_forecast', name: 'Forecast ($)', color: '#fcd34d' }] : [])
  ];
  const densityMetricsKeys = [
    { key: 'populationDensity', name: 'Population Density (per km²)', color: '#6366f1' }, //
    { key: 'gdpDensity', name: 'GDP Density ($M/km²)', color: '#ec4899' }, //
    ...(forecastYears > 0 ? [
      { key: 'populationDensity_forecast', name: 'Pop Density Forecast', color: '#a5b4fc' }, //
      { key: 'gdpDensity_forecast', name: 'GDP Density Forecast', color: '#f9a8d4' } //
    ] : [])
  ];
  
  // Custom Tooltip Formatter Example (optional, for better display in charts)
  const CustomTooltipContent = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-background p-2 border shadow-lg rounded-md">
          <p className="label font-semibold">{`Period: ${label}`}</p>
          {payload.map((entry: any) => (
            <p key={`tooltip-${entry.name}`} style={{ color: entry.color }}>
              {`${entry.name}: ${formatNumber(entry.value, (entry.name.includes("GDP") || entry.name.includes("$")), entry.name.includes("Density") ? 1 : 2)}`}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };


  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <CardTitle>Country Overview</CardTitle> {/* */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Label htmlFor="resolution" className="text-sm">Resolution</Label> {/* */}
              <Select
                value={timeResolution}
                onValueChange={(value) => onTimeResolutionChange(value as 'quarterly' | 'annual')}
              >
                <SelectTrigger id="resolution" className="w-32"> {/* */}
                  <SelectValue placeholder="Select resolution" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="annual">Annual</SelectItem> {/* */}
                  <SelectItem value="quarterly">Quarterly</SelectItem> {/* */}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {/* Stat cards remain the same */}
          <div className="bg-muted/50 p-4 rounded-lg">
            <div className="text-sm text-muted-foreground">Population</div> {/* */}
            <div className="text-2xl font-bold mt-1">{formattedValues.population}</div> {/* */}
          </div>
          <div className="bg-muted/50 p-4 rounded-lg">
            <div className="text-sm text-muted-foreground">GDP per Capita</div> {/* */}
            <div className="text-2xl font-bold mt-1">{formattedValues.gdpPerCapita}</div> {/* */}
          </div>
          <div className="bg-muted/50 p-4 rounded-lg">
            <div className="text-sm text-muted-foreground">Total GDP</div> {/* */}
            <div className="text-2xl font-bold mt-1">{formattedValues.gdp}</div> {/* */}
          </div>
          <div className="bg-muted/50 p-4 rounded-lg">
            <div className="text-sm text-muted-foreground">Population Density</div> {/* */}
            <div className="text-2xl font-bold mt-1">{formattedValues.density}</div> {/* */}
          </div>
        </div>

        <Tabs defaultValue={chartView} value={chartView} onValueChange={(value) => onChartViewChange(value as any)}> {/* */}
          <TabsList className="mb-4"> {/* */}
            <TabsTrigger value="overview">Overview</TabsTrigger> {/* */}
            <TabsTrigger value="population">Population</TabsTrigger> {/* */}
            <TabsTrigger value="gdp">GDP</TabsTrigger> {/* */}
            <TabsTrigger value="density">Density</TabsTrigger> {/* */}
          </TabsList>

          {/* FIX for Errors 2-7: Recharts components usage */}
          <TabsContent value="overview" className="space-y-4"> {/* */}
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <h4 className="text-lg font-semibold mb-2">Population Trend</h4> {/* Replaced title prop */}
                <p className="text-sm text-muted-foreground mb-2">Historical and projected population</p> {/* Replaced description prop */}
                <ResponsiveContainer width="100%" height={250}>
                  <RechartsLineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="period" />
                    <YAxis />
                    <Tooltip content={<CustomTooltipContent />} />
                    <Legend />
                    {overviewPopulationKeys.map(item => (
                      <Line key={item.key} type="monotone" dataKey={item.key} name={item.name} stroke={item.color} dot={false} />
                    ))}
                  </RechartsLineChart>
                </ResponsiveContainer>
              </div>
              <div>
                <h4 className="text-lg font-semibold mb-2">GDP Trend</h4>
                <p className="text-sm text-muted-foreground mb-2">Historical and projected GDP</p>
                <ResponsiveContainer width="100%" height={250}>
                  <RechartsLineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="period" />
                    <YAxis />
                    <Tooltip content={<CustomTooltipContent />} />
                    <Legend />
                    {overviewGdpKeys.map(item => (
                      <Line key={item.key} type="monotone" dataKey={item.key} name={item.name} stroke={item.color} dot={false} />
                    ))}
                  </RechartsLineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="population"> {/* */}
             <div>
                <h4 className="text-lg font-semibold mb-2">Population Trend</h4>
                <p className="text-sm text-muted-foreground mb-2">Historical and projected population growth</p>
                <ResponsiveContainer width="100%" height={350}>
                  <RechartsLineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="period" />
                    <YAxis />
                    <Tooltip content={<CustomTooltipContent />} />
                    <Legend />
                    {populationTrendKeys.map(item => (
                      <Line key={item.key} type="monotone" dataKey={item.key} name={item.name} stroke={item.color} dot={false} />
                    ))}
                  </RechartsLineChart>
                </ResponsiveContainer>
              </div>
          </TabsContent>

          <TabsContent value="gdp" className="space-y-4"> {/* */}
            <div>
              <h4 className="text-lg font-semibold mb-2">GDP Trend</h4>
              <p className="text-sm text-muted-foreground mb-2">Historical and projected GDP</p>
              <ResponsiveContainer width="100%" height={250}>
                <RechartsLineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="period" />
                  <YAxis />
                  <Tooltip content={<CustomTooltipContent />} />
                  <Legend />
                  {gdpTrendKeys.map(item => (
                    <Line key={item.key} type="monotone" dataKey={item.key} name={item.name} stroke={item.color} dot={false} />
                  ))}
                </RechartsLineChart>
              </ResponsiveContainer>
            </div>
            <div>
              <h4 className="text-lg font-semibold mb-2">GDP per Capita</h4>
              <p className="text-sm text-muted-foreground mb-2">Historical and projected GDP per capita</p>
              <ResponsiveContainer width="100%" height={250}>
                <RechartsLineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="period" />
                  <YAxis />
                  <Tooltip content={<CustomTooltipContent />} />
                  <Legend />
                  {gdpPerCapitaKeys.map(item => (
                    <Line key={item.key} type="monotone" dataKey={item.key} name={item.name} stroke={item.color} dot={false} />
                  ))}
                </RechartsLineChart>
              </ResponsiveContainer>
            </div>
          </TabsContent>

          <TabsContent value="density"> {/* */}
            <div>
              <h4 className="text-lg font-semibold mb-2">Density Metrics</h4>
              <p className="text-sm text-muted-foreground mb-2">Population density and GDP density per km²</p>
              <ResponsiveContainer width="100%" height={350}>
                <RechartsBarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="period" />
                  <YAxis />
                  <Tooltip content={<CustomTooltipContent />} />
                  <Legend />
                  {densityMetricsKeys.map(item => (
                    <Bar key={item.key} dataKey={item.key} name={item.name} fill={item.color} />
                  ))}
                </RechartsBarChart>
              </ResponsiveContainer>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

// The following functions were not implemented in the original code.
// You would need to define their logic if you intend to use forecast data
// or more complex data transformations.

// function processForecastData(country: CountryDetailData, args: any) {
//   // Implementation needed
//   // throw new Error("Function not implemented.");
//   return []; // Placeholder
// }

// function combineHistoricalAndForecast(historical: any[], forecast: any[]) {
//  // Implementation needed
//   // throw new Error("Function not implemented.");
//   return historical.concat(forecast); // Placeholder
// }

// Example type for historical data points (adjust based on your actual data structure)
// export interface HistoricalDataPoint { // Should be defined in `~/app/countries/[id]/page` or a types file
//   ixTimeTimestamp: number;
//   year?: number; // Or 'period' directly
//   population?: number | null;
//   gdpPerCapita?: number | null;
//   totalGdp?: number | null;
//   populationDensity?: number | null;
//   gdpDensity?: number | null;
//   // Add any other relevant fields
// }