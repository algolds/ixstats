// src/components/charts/chart-dashboard.tsx
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import { Skeleton } from "~/components/ui/skeleton";
import { AlertCircle, Info } from "lucide-react";

import { TimeControlBar } from "./time-control-bar";
import { ChartTypeSelector } from "./chart-type-selector";
import { ChartOptionsPanel } from "./chart-options-panel";
import { LineChart } from "./line-chart";
import { BarChart } from "./bar-chart";

import { useChartContext, type ChartType } from "~/context/chart-context";
import { ChartDataFormatter } from "~/lib/chart-data-formatter";
import { IxTime } from "~/lib/ixtime";

interface ChartDashboardProps {
  countryId: string;
  countryName: string;
  initialChartType?: ChartType;
}

export function ChartDashboard({
  countryId,
  countryName,
  initialChartType = 'overview'
}: ChartDashboardProps) {
  const { 
    chartData, 
    isLoading, 
    error, 
    loadHistoricalData,
    chartType,
    setChartType,
    currentTime
  } = useChartContext();
  
  // Local state for formatted data
  const [formattedData, setFormattedData] = useState<any[]>([]);
  
  // Set initial chart type
  useEffect(() => {
    setChartType(initialChartType);
  }, [initialChartType, setChartType]);
  
  // Load data when component mounts
  useEffect(() => {
    loadHistoricalData(countryId);
  }, [countryId, loadHistoricalData]);
  
  // Format data when chartData changes
  useEffect(() => {
    if (chartData.length > 0) {
      const formatted = ChartDataFormatter.formatChartData(chartData, {
        useCompactNumbers: true,
        currencySymbol: '$',
        labelFormat: 'short'
      });
      setFormattedData(formatted);
    }
  }, [chartData]);
  
  // Determine time range
  const minTime = chartData.length > 0 
    ? Math.min(...chartData.map(d => d.timestamp)) 
    : IxTime.getInGameEpoch() - (5 * 365 * 24 * 60 * 60 * 1000);
    
  const maxTime = chartData.length > 0 
    ? Math.max(...chartData.map(d => d.timestamp)) 
    : IxTime.addYears(IxTime.getCurrentIxTime(), 5);
  
  // Helper to get chart title
  const getChartTitle = (type: ChartType): string => {
    switch (type) {
      case 'overview': return `${countryName} - Economic Overview`;
      case 'population': return `${countryName} - Population Trends`;
      case 'gdp': return `${countryName} - GDP Trends`;
      case 'gdpPerCapita': return `${countryName} - GDP per Capita`;
      case 'density': return `${countryName} - Population & GDP Density`;
      default: return countryName;
    }
  };
  
  // Generate description based on current time
  const getTimeDescription = (): string => {
    const yearsSinceEpoch = IxTime.getYearsSinceGameEpoch(currentTime);
    if (yearsSinceEpoch < 0) {
      return `Historical data (${Math.abs(yearsSinceEpoch).toFixed(1)} years before game start)`;
    } else {
      return `Data as of ${IxTime.formatIxTime(currentTime, false)}`;
    }
  };
  
  // Render loading state
  if (isLoading && chartData.length === 0) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Loading Data...</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Skeleton className="h-[350px] w-full rounded-lg" />
            <Skeleton className="h-10 w-full rounded-md" />
          </div>
        </CardContent>
      </Card>
    );
  }
  
  // Render error state
  if (error && chartData.length === 0) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Error loading chart data</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }
  
  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <ChartTypeSelector />
        
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">
            {getTimeDescription()}
          </span>
          <Info className="h-4 w-4 text-muted-foreground" />
        </div>
      </div>
      
      <Card className="w-full">
        <CardHeader>
          <CardTitle>{getChartTitle(chartType)}</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="chart" className="space-y-4">
            <TabsList>
              <TabsTrigger value="chart">Chart</TabsTrigger>
              <TabsTrigger value="settings">Settings</TabsTrigger>
            </TabsList>
            
            <TabsContent value="chart" className="space-y-4">
              {chartType === 'population' && (
                <BarChart
                  data={formattedData}
                  title="Population"
                  description="Population in millions"
                  dataKeys={[
                    { key: 'population', name: 'Population (M)', color: '#3b82f6' }
                  ]}
                  xAxisDataKey="period"
                />
              )}
              
              {chartType === 'gdp' && (
                <LineChart
                  data={formattedData}
                  title="GDP"
                  description="Total GDP in billions USD"
                  dataKeys={[
                    { key: 'totalGdp', name: 'Total GDP ($B)', color: '#10b981' }
                  ]}
                  xAxisDataKey="period"
                />
              )}
              
              {chartType === 'gdpPerCapita' && (
                <LineChart
                  data={formattedData}
                  title="GDP per Capita"
                  description="GDP per capita in USD"
                  dataKeys={[
                    { key: 'gdpPerCapita', name: 'GDP per Capita ($)', color: '#f59e0b' }
                  ]}
                  xAxisDataKey="period"
                />
              )}
              
              {chartType === 'density' && (
                <BarChart
                  data={formattedData}
                  title="Density Metrics"
                  description="Population density (people/km²) and GDP density ($/km²)"
                  dataKeys={[
                    { key: 'populationDensity', name: 'Population Density', color: '#6366f1' },
                    { key: 'gdpDensity', name: 'GDP Density ($M/km²)', color: '#ec4899' }
                  ]}
                  xAxisDataKey="period"
                />
              )}
              
              {chartType === 'overview' && (
                <div className="grid md:grid-cols-2 gap-4">
                  <LineChart
                    data={formattedData}
                    title="Population & GDP"
                    description="Population (M) and GDP ($B)"
                    dataKeys={[
                      { key: 'population', name: 'Population (M)', color: '#3b82f6' },
                      { key: 'totalGdp', name: 'GDP ($B)', color: '#10b981' }
                    ]}
                    xAxisDataKey="period"
                    height={250}
                  />
                  
                  <LineChart
                    data={formattedData}
                    title="GDP per Capita"
                    description="GDP per capita in USD"
                    dataKeys={[
                      { key: 'gdpPerCapita', name: 'GDP per Capita ($)', color: '#f59e0b' }
                    ]}
                    xAxisDataKey="period"
                    height={250}
                  />
                </div>
              )}
              
              <TimeControlBar
                minTime={minTime}
                maxTime={maxTime}
              />
            </TabsContent>
            
            <TabsContent value="settings">
              <ChartOptionsPanel />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
