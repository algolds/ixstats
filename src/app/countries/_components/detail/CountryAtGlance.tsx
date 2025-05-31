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
  SelectValue 
} from "~/components/ui/select";
import { Label } from "~/components/ui/label";
import { formatNumber } from "~/lib/format";
import { IxTime } from "~/lib/ixtime";
import { IxChartDataProcessor } from "~/lib/chart-data-processor-ixtime";
import { ChartDataFormatter } from "~/lib/chart-data-formatter";
import { LineChart } from "../charts/line-chart";
import { BarChart } from "../charts/bar-chart";
import type { CountryDetailData } from "~/app/countries/[id]/page";

interface CountryAtGlanceProps {
  country: CountryDetailData;
  historicalData: CountryDetailData['historicalData'];
  targetTime: number;
  forecastYears: number;
  isLoading: boolean;
  isLoadingForecast: boolean;
  chartView: 'overview' | 'population' | 'gdp' | 'density';
  timeResolution: 'quarterly' | 'annual';
  onTimeResolutionChange: (resolution: 'quarterly' | 'annual') => void;
  onChartViewChange: (view: 'overview' | 'population' | 'gdp' | 'density') => void;
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
  onChartViewChange
}: CountryAtGlanceProps) {
  const [chartData, setChartData] = useState<any[]>([]);
  const [normalizeValues, setNormalizeValues] = useState(true);
  
  // Format numerical values for display
  const formattedValues = useMemo(() => ({
    population: formatNumber(country.currentPopulation / 1000000, false, 2) + " million",
    gdpPerCapita: formatNumber(country.currentGdpPerCapita, true, 0),
    gdp: formatNumber(country.currentTotalGdp / 1000000000, true, 2) + " billion",
    density: country.populationDensity 
      ? formatNumber(country.populationDensity, false, 1) + " per km²" 
      : "N/A",
    gdpDensity: country.gdpDensity 
      ? formatNumber(country.gdpDensity / 1000000, true, 1) + "M per km²" 
      : "N/A",
  }), [country]);
  
  // Process data for charts
  useEffect(() => {
    if (!historicalData || historicalData.length === 0) return;
    
    // Process historical data
    const historicalChartData = IxChartDataProcessor.processHistoricalData(country, {
      normalizePopulation: normalizeValues,
      normalizeTotalGdp: normalizeValues,
      normalizeGdpDensity: normalizeValues,
      timeResolution,
      startTime: IxTime.addYears(targetTime, -10),
      endTime: targetTime
    });
    
    // Process forecast data if available
    let combinedData = historicalChartData;
    
    if (forecastYears > 0 && country.forecastDataPoints && country.forecastDataPoints.length > 0) {
      const forecastChartData = IxChartDataProcessor.processForecastData(country, {
        normalizePopulation: normalizeValues,
        normalizeTotalGdp: normalizeValues,
        normalizeGdpDensity: normalizeValues,
        timeResolution
      });
      
      combinedData = IxChartDataProcessor.combineHistoricalAndForecast(
        historicalChartData,
        forecastChartData
      );
    }
    
    // Format the data for display
    const formattedData = ChartDataFormatter.formatChartData(combinedData, {
      useCompactNumbers: true,
      currencySymbol: '$',
      labelFormat: 'short'
    });
    
    setChartData(formattedData);
  }, [country, historicalData, targetTime, forecastYears, timeResolution, normalizeValues]);
  
  if (isLoading) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Country Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <Skeleton className="h-20" />
            <Skeleton className="h-20" />
            <Skeleton className="h-20" />
            <Skeleton className="h-20" />
          </div>
          <Skeleton className="h-[350px] w-full" />
        </CardContent>
      </Card>
    );
  }
  
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
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-muted/50 p-4 rounded-lg">
            <div className="text-sm text-muted-foreground">Population</div>
            <div className="text-2xl font-bold mt-1">{formattedValues.population}</div>
          </div>
          <div className="bg-muted/50 p-4 rounded-lg">
            <div className="text-sm text-muted-foreground">GDP per Capita</div>
            <div className="text-2xl font-bold mt-1">{formattedValues.gdpPerCapita}</div>
          </div>
          <div className="bg-muted/50 p-4 rounded-lg">
            <div className="text-sm text-muted-foreground">Total GDP</div>
            <div className="text-2xl font-bold mt-1">{formattedValues.gdp}</div>
          </div>
          <div className="bg-muted/50 p-4 rounded-lg">
            <div className="text-sm text-muted-foreground">Population Density</div>
            <div className="text-2xl font-bold mt-1">{formattedValues.density}</div>
          </div>
        </div>
        
        <Tabs defaultValue={chartView} value={chartView} onValueChange={(value) => onChartViewChange(value as any)}>
          <TabsList className="mb-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="population">Population</TabsTrigger>
            <TabsTrigger value="gdp">GDP</TabsTrigger>
            <TabsTrigger value="density">Density</TabsTrigger>
          </TabsList>
          
          <TabsContent value="overview" className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <LineChart
                data={chartData}
                title="Population Trend"
                description="Historical and projected population"
                dataKeys={[
                  { key: 'population', name: 'Population (M)', color: '#3b82f6' },
                  ...(forecastYears > 0 ? [{ key: 'population', name: 'Forecast (M)', color: '#93c5fd' }] : [])
                ]}
                xAxisDataKey="period"
                height={250}
                />
              
              <LineChart
                data={chartData}
                title="GDP Trend"
                description="Historical and projected GDP"
                dataKeys={[
                  { key: 'totalGdp', name: 'GDP ($B)', color: '#10b981' },
                  ...(forecastYears > 0 ? [{ key: 'totalGdp', name: 'Forecast ($B)', color: '#6ee7b7' }] : [])
                ]}
                xAxisDataKey="period"
                height={250}
              />
            </div>
          </TabsContent>
          <TabsContent value="population">
            <LineChart
              data={chartData}
              title="Population Trend"
              description="Historical and projected population growth"
              dataKeys={[
                { key: 'population', name: 'Population (M)', color: '#3b82f6' },
                ...(forecastYears > 0 ? [{ key: 'population', name: 'Forecast (M)', color: '#93c5fd' }] : [])
              ]}
              xAxisDataKey="period"
              height={350}
            />
          </TabsContent>
          
          <TabsContent value="gdp" className="space-y-4">
            <LineChart
              data={chartData}
              title="GDP Trend"
              description="Historical and projected GDP"
              dataKeys={[
                { key: 'totalGdp', name: 'Total GDP ($B)', color: '#10b981' },
                ...(forecastYears > 0 ? [{ key: 'totalGdp', name: 'Forecast ($B)', color: '#6ee7b7' }] : [])
              ]}
              xAxisDataKey="period"
              height={250}
            />
            
            <LineChart
              data={chartData}
              title="GDP per Capita"
              description="Historical and projected GDP per capita"
              dataKeys={[
                { key: 'gdpPerCapita', name: 'GDP per Capita ($)', color: '#f59e0b' },
                ...(forecastYears > 0 ? [{ key: 'gdpPerCapita', name: 'Forecast ($)', color: '#fcd34d' }] : [])
              ]}
              xAxisDataKey="period"
              height={250}
            />
          </TabsContent>
          
          <TabsContent value="density">
            <BarChart
              data={chartData}
              title="Density Metrics"
              description="Population density and GDP density per km²"
              dataKeys={[
                { key: 'populationDensity', name: 'Population Density (per km²)', color: '#6366f1', type: 'historical' as const },
                { key: 'gdpDensity', name: 'GDP Density ($M/km²)', color: '#ec4899', type: 'historical' as const },
                ...(forecastYears > 0 ? [
                  { key: 'populationDensity', name: 'Pop Density Forecast', color: '#a5b4fc', type: 'forecast' as const },
                  { key: 'gdpDensity', name: 'GDP Density Forecast', color: '#f9a8d4', type: 'forecast' as const }
                ] : [])
              ]}
              xAxisDataKey="period"
              height={350}
              currentTime={targetTime}
            />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
