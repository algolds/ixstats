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
import { formatNumber } from "~/lib/theme-utils"; // Existing import

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

interface ChartDataPoint {
  period: string | number;
  [key: string]: any;
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
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);

  const formattedValues = useMemo(() => {
    const formatDisplayValue = (num: number | null | undefined, isCurrency: boolean, defaultPrecision: number, unit?: string): string => {
        if (num === null || num === undefined || isNaN(num)) {
            return unit ? (isCurrency ? "$N/A" : "N/A") + (unit ? ` ${unit}`: "") : (isCurrency ? "$N/A" : "N/A");
        }
        if (num === 0 && !unit) return isCurrency ? "$0" : "0";

        const tiers = [
            { limit: 1e15, name: "Quadrillion" },
            { limit: 1e12, name: "Trillion" },
            { limit: 1e9,  name: "Billion" },
            { limit: 1e6,  name: "Million" },
        ];

        let valToShow = num;
        let suffix = unit ? ` ${unit}` : ""; // Base unit like "per km²"
        
        if (!unit) { // Only apply large scale suffixes if no specific unit is already being handled (like per km^2)
            for (const tier of tiers) {
                if (Math.abs(num) >= tier.limit) {
                    valToShow = num / tier.limit;
                    suffix = ` ${tier.name}`;
                    break;
                }
            }
        }
        
        // Use the provided formatNumber for the scaled value's numerical part
        // Assuming formatNumber(value, isCurrencySymbolToBePrependedByFormatNumberItself, precision)
        // We prepend $ manually here if isCurrency is true, so pass false for symbol to formatNumber.
        let numStr = formatNumber(valToShow, false, defaultPrecision);
        return (isCurrency ? "$" : "") + numStr + suffix;
    };

    return {
        population: (() => {
            if (country.currentPopulation === null || country.currentPopulation === undefined || isNaN(country.currentPopulation)) return "N/A";
            if (Math.abs(country.currentPopulation) >= 1e6) {
                return formatNumber(country.currentPopulation / 1e6, false, 2) + " million";
            }
            return formatNumber(country.currentPopulation, false, 0);
        })(),
        gdpPerCapita: formatDisplayValue(country.currentGdpPerCapita, true, 0),
        gdp: formatDisplayValue(country.currentTotalGdp, true, 2),
        density: country.populationDensity
          ? formatNumber(country.populationDensity, false, 1) + " per km²" // Specific unit
          : "N/A",
        gdpDensity: formatDisplayValue(country.gdpDensity, true, 1, "per km²"), // Specific unit
    };
  }, [country]);

  useEffect(() => {
    if (!historicalData || historicalData.length === 0) {
      setChartData([]);
      return;
    }
    const processedHistoricalData = historicalData.map((dp: HistoricalDataPoint) => {
      let periodLabel: string;
      const date = new Date(dp.ixTimeTimestamp);
      if (timeResolution === 'quarterly') {
        const quarter = Math.floor(date.getUTCMonth() / 3) + 1;
        periodLabel = `Q${quarter} ${date.getUTCFullYear()}`;
      } else {
        periodLabel = date.getUTCFullYear().toString();
      }
      return {
        period: periodLabel,
        population: dp.population,
        totalGdp: dp.totalGdp,
        gdpPerCapita: dp.gdpPerCapita,
        populationDensity: dp.populationDensity,
        gdpDensity: dp.gdpDensity,
      };
    });
    
    if (timeResolution === 'annual') {
        const uniqueYearData = Array.from(new Map(processedHistoricalData.map(item => [item.period, item])).values());
        setChartData(uniqueYearData as ChartDataPoint[]);
    } else {
        setChartData(processedHistoricalData as ChartDataPoint[]);
    }

  }, [country, historicalData, targetTime, forecastYears, timeResolution]);


  const yAxisTickFormatter = (value: any, isCurrency: boolean) => {
    if (typeof value !== 'number' || isNaN(value)) return String(value); // Ensure it's a string for Recharts

    const tiers = [
        { limit: 1e15, suffix: "Q" }, // Quadrillion
        { limit: 1e12, suffix: "T" }, // Trillion
        { limit: 1e9,  suffix: "B" }, // Billion
        { limit: 1e6,  suffix: "M" }, // Million
        { limit: 1e3,  suffix: "k" }  // Thousand
    ];

    let val = value;
    let suffix = "";

    for (const tier of tiers) {
        if (Math.abs(value) >= tier.limit) {
            val = value / tier.limit;
            suffix = tier.suffix;
            break;
        }
    }
    
    let precision = 0;
    if (suffix && Math.abs(val) < 100 && val !== Math.floor(val)) { // Add precision for suffixed numbers like 1.2M, 12.3B
        precision = Math.abs(val) < 10 ? 1 : 1; 
    } else if (!suffix && val !== Math.floor(val) && Math.abs(val) < 1000) { // Precision for non-suffixed small numbers
        precision = 2;
    }


    // Assuming formatNumber(value, isCurrencySymbolToBePrependedByFormatNumberItself, precision)
    // We prepend $ manually, so pass false for symbol part to formatNumber.
    return (isCurrency ? "$" : "") + formatNumber(val, false, precision) + suffix;
  };

  // CustomTooltipContent remains the same as your existing one, ensuring it uses formatNumber
   const CustomTooltipContent = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-background p-2 border shadow-lg rounded-md">
          <p className="label font-semibold">{`Period: ${label}`}</p>
          {payload.map((entry: any) => (
            <p key={`tooltip-${entry.name}`} style={{ color: entry.color }}>
              {/* Apply more robust formatting here if needed, similar to yAxisTickFormatter or formatDisplayValue logic */}
              {`${entry.name}: ${yAxisTickFormatter(entry.value, (entry.name.includes("GDP") || entry.name.includes("$") || entry.name.toLowerCase().includes("density ($")))}`}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };


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

  const overviewPopulationKeys = [
    { key: 'population', name: 'Population', color: '#3b82f6' },
    ...(forecastYears > 0 ? [{ key: 'population_forecast', name: 'Forecast', color: '#93c5fd' }] : [])
  ];
  const overviewGdpKeys = [
    { key: 'totalGdp', name: 'GDP', color: '#10b981' },
    ...(forecastYears > 0 ? [{ key: 'totalGdp_forecast', name: 'Forecast', color: '#6ee7b7' }] : [])
  ];
  const populationTrendKeys = overviewPopulationKeys;
  const gdpTrendKeys = overviewGdpKeys;
  const gdpPerCapitaKeys = [
    { key: 'gdpPerCapita', name: 'GDP per Capita ($)', color: '#f59e0b' },
    ...(forecastYears > 0 ? [{ key: 'gdpPerCapita_forecast', name: 'Forecast ($)', color: '#fcd34d' }] : [])
  ];
  const densityMetricsKeys = [
    { key: 'populationDensity', name: 'Population Density (per km²)', color: '#6366f1' },
    { key: 'gdpDensity', name: 'GDP Density ($/km²)', color: '#ec4899' },
    ...(forecastYears > 0 ? [
      { key: 'populationDensity_forecast', name: 'Pop Density Forecast', color: '#a5b4fc' },
      { key: 'gdpDensity_forecast', name: 'GDP Density Forecast', color: '#f9a8d4' }
    ] : [])
  ];

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
              <div>
                <h4 className="text-lg font-semibold mb-2">Population Trend</h4>
                <p className="text-sm text-muted-foreground mb-2">Historical and projected population</p>
                <ResponsiveContainer width="100%" height={250}>
                  <RechartsLineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="period" />
                    <YAxis tickFormatter={(value) => yAxisTickFormatter(value, false)} />
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
                    <YAxis tickFormatter={(value) => yAxisTickFormatter(value, true)} />
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

          <TabsContent value="population">
             <div>
                <h4 className="text-lg font-semibold mb-2">Population Trend</h4>
                <p className="text-sm text-muted-foreground mb-2">Historical and projected population growth</p>
                <ResponsiveContainer width="100%" height={350}>
                  <RechartsLineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="period" />
                    <YAxis tickFormatter={(value) => yAxisTickFormatter(value, false)} />
                    <Tooltip content={<CustomTooltipContent />} />
                    <Legend />
                    {populationTrendKeys.map(item => (
                      <Line key={item.key} type="monotone" dataKey={item.key} name={item.name} stroke={item.color} dot={false} />
                    ))}
                  </RechartsLineChart>
                </ResponsiveContainer>
              </div>
          </TabsContent>

          <TabsContent value="gdp" className="space-y-4">
            <div>
              <h4 className="text-lg font-semibold mb-2">GDP Trend</h4>
              <p className="text-sm text-muted-foreground mb-2">Historical and projected GDP</p>
              <ResponsiveContainer width="100%" height={250}>
                <RechartsLineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="period" />
                  <YAxis tickFormatter={(value) => yAxisTickFormatter(value, true)} />
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
                  <YAxis tickFormatter={(value) => yAxisTickFormatter(value, true)} />
                  <Tooltip content={<CustomTooltipContent />} />
                  <Legend />
                  {gdpPerCapitaKeys.map(item => (
                    <Line key={item.key} type="monotone" dataKey={item.key} name={item.name} stroke={item.color} dot={false} />
                  ))}
                </RechartsLineChart>
              </ResponsiveContainer>
            </div>
          </TabsContent>

          <TabsContent value="density">
            <div>
              <h4 className="text-lg font-semibold mb-2">Density Metrics</h4>
              <p className="text-sm text-muted-foreground mb-2">Population density and GDP density per km²</p>
              <ResponsiveContainer width="100%" height={350}>
                <RechartsBarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="period" />
                  <YAxis yAxisId="left" orientation="left" stroke="#6366f1" tickFormatter={(value) => yAxisTickFormatter(value, false)} />
                  <YAxis yAxisId="right" orientation="right" stroke="#ec4899" tickFormatter={(value) => yAxisTickFormatter(value, true)} />
                  <Tooltip content={<CustomTooltipContent />} />
                  <Legend />
                  {densityMetricsKeys.map(item => (
                    <Bar 
                        key={item.key} 
                        dataKey={item.key} 
                        name={item.name} 
                        fill={item.color} 
                        yAxisId={item.key.toLowerCase().includes('population') ? "left" : "right"}
                    />
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