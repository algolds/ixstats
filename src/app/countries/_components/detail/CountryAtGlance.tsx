// src/app/countries/_components/detail/CountryAtGlance.tsx
"use client";

import { useState, useMemo } from "react";
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
  Target,
  AlertTriangle,
  Zap
} from "lucide-react";
import { useTheme } from "~/context/theme-context";
import { IxTime } from "~/lib/ixtime";

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
  landArea?: number;
  populationDensity?: number;
  gdpDensity?: number;
}

interface HistoricalDataPoint {
  ixTimeTimestamp: number;
  population: number;
  gdpPerCapita: number;
  totalGdp: number;
  populationDensity?: number;
  gdpDensity?: number;
}

interface CountryAtGlanceProps {
  country: CountryData;
  historicalData?: HistoricalDataPoint[];
  targetTime: number;
  forecastYears: number;
  isLoading?: boolean;
  isLoadingForecast?: boolean;
}

type TimeResolution = 'quarterly' | 'annual';
type ChartView = 'overview' | 'population' | 'gdp' | 'density';
type ViewMode = 'historical' | 'forecast';
type ScenarioType = 'optimistic' | 'baseline' | 'pessimistic';
type ForecastView = 'combined' | 'population' | 'gdp' | 'density' | 'scenarios';

export function CountryAtGlance({
  country,
  historicalData = [],
  targetTime,
  forecastYears,
  isLoading = false,
  isLoadingForecast = false
}: CountryAtGlanceProps) {
  const { theme } = useTheme();
  
  // Common state
  const [timeResolution, setTimeResolution] = useState<TimeResolution>('annual');
  
  // View mode toggle between historical and forecast
  const [viewMode, setViewMode] = useState<ViewMode>('historical');
  
  // Historical view state
  const [chartView, setChartView] = useState<ChartView>('overview');
  const [showForecast, setShowForecast] = useState(true);
  
  // Forecast view state
  const [forecastView, setForecastView] = useState<ForecastView>('combined');
  const [showScenarios, setShowScenarios] = useState(false);
  const [selectedScenario, setSelectedScenario] = useState<ScenarioType>('baseline');

  // Format chart data with enhanced rolling averages
  const rollingAverageData = useMemo(() => {
    if (!historicalData.length) return [];

    // Sort by timestamp
    const sortedData = [...historicalData].sort((a, b) => 
      a.ixTimeTimestamp - b.ixTimeTimestamp
    );
    
    // Define rolling window size based on resolution
    const windowSize = timeResolution === 'quarterly' ? 4 : 12; // 4 quarters or 12 months
    
    // Create timestamp groups to ensure consistent intervals
    const timestampGroups: Record<string, HistoricalDataPoint[]> = {};
    
    // Group data points by their period (quarter or year)
    sortedData.forEach(point => {
      const date = new Date(point.ixTimeTimestamp);
      let periodKey: string;
      
      if (timeResolution === 'quarterly') {
        const quarter = Math.floor(date.getMonth() / 3) + 1;
        periodKey = `${date.getFullYear()}-Q${quarter}`;
      } else {
        periodKey = date.getFullYear().toString();
      }
      
      if (!timestampGroups[periodKey]) {
        timestampGroups[periodKey] = [];
      }
      
      timestampGroups[periodKey].push(point);
    });
    
    // Average the data within each period
    const periodAverages = Object.entries(timestampGroups).map(([period, points]) => {
      // Calculate average for this period
      const avgPoint = points.reduce((sum, point) => ({
        ixTimeTimestamp: sum.ixTimeTimestamp + point.ixTimeTimestamp / points.length,
        population: sum.population + point.population / points.length,
        gdpPerCapita: sum.gdpPerCapita + point.gdpPerCapita / points.length,
        totalGdp: sum.totalGdp + point.totalGdp / points.length,
        populationDensity: sum.populationDensity + (point.populationDensity ?? 0) / points.length,
        gdpDensity: sum.gdpDensity + (point.gdpDensity ?? 0) / points.length,
      }), {
        ixTimeTimestamp: 0,
        population: 0,
        gdpPerCapita: 0,
        totalGdp: 0,
        populationDensity: 0,
        gdpDensity: 0
      });
      
      return {
        period,
        ixTimeTimestamp: avgPoint.ixTimeTimestamp,
        formattedDate: period,
        population: avgPoint.population,
        gdpPerCapita: avgPoint.gdpPerCapita,
        totalGdp: avgPoint.totalGdp,
        populationDensity: avgPoint.populationDensity,
        gdpDensity: avgPoint.gdpDensity,
      };
    }).sort((a, b) => a.ixTimeTimestamp - b.ixTimeTimestamp);
    
    // Apply rolling window averaging across periods
    const rollingData = [];
    
    // Only proceed if we have periods to work with
    if (periodAverages.length > 0) {
      // Use as many periods as we have, up to the window size
      const effectiveWindowSize = Math.min(windowSize, periodAverages.length);
      
      for (let i = 0; i < periodAverages.length; i++) {
        // Calculate the start index for the rolling window
        const startIdx = Math.max(0, i - effectiveWindowSize + 1);
        // Get the window of periods to average
        const window = periodAverages.slice(startIdx, i + 1);
        
        // Current period for labeling
        const currentPeriod = periodAverages[i];
        
        // Calculate rolling average across the window
        const rollingAvg = window.reduce((sum, period, idx, array) => {
          // Weight more recent periods higher for smoother trends
          const weight = (idx + 1) / ((array.length * (array.length + 1)) / 2);
          
          return {
            population: sum.population + period.population * weight,
            gdpPerCapita: sum.gdpPerCapita + period.gdpPerCapita * weight,
            totalGdp: sum.totalGdp + period.totalGdp * weight,
            populationDensity: sum.populationDensity + period.populationDensity * weight,
            gdpDensity: sum.gdpDensity + period.gdpDensity * weight,
          };
        }, {
          population: 0,
          gdpPerCapita: 0,
          totalGdp: 0,
          populationDensity: 0,
          gdpDensity: 0,
        });
        
        // Calculate growth rates if we have previous data
        let populationGrowth = 0;
        let gdpGrowth = 0;
        
        if (i > 0) {
          const prevPeriod = periodAverages[i-1];
          populationGrowth = ((currentPeriod.population - prevPeriod.population) / prevPeriod.population) * 100;
          gdpGrowth = ((currentPeriod.gdpPerCapita - prevPeriod.gdpPerCapita) / prevPeriod.gdpPerCapita) * 100;
        }
        
        rollingData.push({
          period: currentPeriod.period,
          date: currentPeriod.formattedDate,
          ixTimeTimestamp: currentPeriod.ixTimeTimestamp,
          population: rollingAvg.population / 1000000, // Convert to millions
          gdpPerCapita: rollingAvg.gdpPerCapita,
          totalGdp: rollingAvg.totalGdp / 1000000000, // Convert to billions
          populationDensity: rollingAvg.populationDensity,
          gdpDensity: rollingAvg.gdpDensity / 1000000, // Convert to millions per km²
          populationGrowth,
          gdpGrowth,
          isRollingAverage: true
        });
      }
    }

    return rollingData;
  }, [historicalData, timeResolution]);

  // Generate forecast data
  const forecastData = useMemo(() => {
    if (!showForecast || forecastYears === 0) return [];
    
    // Use current country stats as the base for forecast if rollingAverageData is empty
    const basePointForForecast = rollingAverageData.length > 0 
      ? rollingAverageData[rollingAverageData.length - 1]
      : { // Construct a base point from current country data if historical is empty
          date: IxTime.getCurrentGameYear(targetTime).toString(),
          population: country.currentPopulation / 1000000,
          gdpPerCapita: country.currentGdpPerCapita,
          totalGdp: country.currentTotalGdp / 1000000000,
          populationDensity: country.populationDensity || 0,
          gdpDensity: (country.gdpDensity || 0) / 1000000,
        };
    
    if (!basePointForForecast) return [];
    
    const forecastPoints = [];
    const currentRealYear = new Date(targetTime).getFullYear(); // Real year of the targetTime for forecast x-axis

    for (let i = 1; i <= forecastYears; i++) {
      const yearFromBase = timeResolution === 'quarterly' ? i / 4 : i;
      const populationGrowthFactor = Math.pow(1 + country.populationGrowthRate, yearFromBase);
      const gdpGrowthFactor = Math.pow(1 + country.adjustedGdpGrowth, yearFromBase);

      const projectedPopulation = basePointForForecast.population * populationGrowthFactor;
      const projectedGdpPerCapita = basePointForForecast.gdpPerCapita * gdpGrowthFactor;

      forecastPoints.push({
        period: timeResolution === 'quarterly' 
          ? `${currentRealYear + Math.floor((i-1)/4)}-Q${((i-1) % 4) + 1}`
          : (currentRealYear + i).toString(),
        date: `${currentRealYear + i}`,
        population: projectedPopulation,
        gdpPerCapita: projectedGdpPerCapita,
        totalGdp: projectedPopulation * projectedGdpPerCapita / 1000, 
        populationDensity: basePointForForecast.populationDensity * populationGrowthFactor,
        gdpDensity: basePointForForecast.gdpDensity * gdpGrowthFactor,
        populationGrowth: country.populationGrowthRate * 100,
        gdpGrowth: country.adjustedGdpGrowth * 100,
        isForecast: true,
      });
    }

    return forecastPoints;
  }, [country, rollingAverageData, forecastYears, showForecast, timeResolution, targetTime]);

  // Generate 10-year forecast data with scenarios
  const fullForecastData = useMemo(() => {
    const baseData = [];
    const baseYear = new Date(targetTime).getFullYear();
    
    // Scenario multipliers
    const scenarios = {
      optimistic: { population: 1.2, gdp: 1.5 },
      baseline: { population: 1.0, gdp: 1.0 },
      pessimistic: { population: 0.8, gdp: 0.6 }
    };

    // Ensure we forecast at least 10 years for the forecast view
    const yearsToForecast = Math.max(10, forecastYears);

    for (let year = 0; year <= yearsToForecast; year++) {
      const yearData: any = {
        year: baseYear + year,
        yearOffset: year,
        date: `${baseYear + year}`,
      };

      // Generate for each scenario
      Object.entries(scenarios).forEach(([scenarioName, multipliers]) => {
        const popGrowthRate = country.populationGrowthRate * multipliers.population;
        const gdpGrowthRate = country.adjustedGdpGrowth * multipliers.gdp;
        
        const populationGrowthFactor = Math.pow(1 + popGrowthRate, year);
        const gdpGrowthFactor = Math.pow(1 + gdpGrowthRate, year);
        
        const projectedPopulation = country.currentPopulation * populationGrowthFactor;
        const projectedGdpPerCapita = country.currentGdpPerCapita * gdpGrowthFactor;
        const projectedTotalGdp = projectedPopulation * projectedGdpPerCapita;
        
        const suffix = scenarioName === 'baseline' ? '' : `_${scenarioName}`;
        
        yearData[`population${suffix}`] = projectedPopulation / 1000000; // Millions
        yearData[`gdpPerCapita${suffix}`] = projectedGdpPerCapita;
        yearData[`totalGdp${suffix}`] = projectedTotalGdp / 1000000000; // Billions
        
        if (country.landArea) {
          yearData[`populationDensity${suffix}`] = projectedPopulation / country.landArea;
          yearData[`gdpDensity${suffix}`] = projectedTotalGdp / country.landArea / 1000000; // Millions per km²
        }
        
        // Growth rates for the year
        yearData[`populationGrowthRate${suffix}`] = popGrowthRate * 100;
        yearData[`gdpGrowthRate${suffix}`] = gdpGrowthRate * 100;
      });

      baseData.push(yearData);
    }

    return baseData;
  }, [country, targetTime, forecastYears]);

  // Analysis metrics for forecast
  const forecastAnalysis = useMemo(() => {
    if (fullForecastData.length < 2) return null;

    const firstYear = fullForecastData[0];
    const lastYear = fullForecastData[10]; // 10-year forecast
    
    const populationCAGR = Math.pow(lastYear.population / firstYear.population, 1/10) - 1;
    const gdpPerCapitaCAGR = Math.pow(lastYear.gdpPerCapita / firstYear.gdpPerCapita, 1/10) - 1;
    const totalGdpCAGR = Math.pow(lastYear.totalGdp / firstYear.totalGdp, 1/10) - 1;
    
    return {
      populationCAGR: populationCAGR * 100,
      gdpPerCapitaCAGR: gdpPerCapitaCAGR * 100,
      totalGdpCAGR: totalGdpCAGR * 100,
      projectedPopulation10Y: lastYear.population,
      projectedGdpPerCapita10Y: lastYear.gdpPerCapita,
      projectedTotalGdp10Y: lastYear.totalGdp,
      populationChange: ((lastYear.population - firstYear.population) / firstYear.population) * 100,
      gdpPerCapitaChange: ((lastYear.gdpPerCapita - firstYear.gdpPerCapita) / firstYear.gdpPerCapita) * 100,
    };
  }, [fullForecastData]);

  const combinedData = [...rollingAverageData, ...forecastData];

  const formatNumber = (num: number, isCurrency = false, precision = 1): string => {
    if (isCurrency) {
      if (Math.abs(num) >= 1e3) return `$${(num / 1e3).toFixed(precision)}K`;
      return `$${num.toFixed(precision)}`;
    }
    if (Math.abs(num) >= 1000) return `${(num / 1000).toFixed(precision)}B`;
    if (Math.abs(num) >= 1) return `${num.toFixed(precision)}M`;
    return `${(num * 1000).toFixed(0)}K`;
  };

  const axisColor = theme === 'dark' ? '#4A5568' : '#CBD5E0';
  const textColor = theme === 'dark' ? '#E2E8F0' : '#2D3748';
  const tooltipStyle = {
    backgroundColor: theme === 'dark' ? 'rgba(31, 41, 55, 0.95)' : 'rgba(255, 255, 255, 0.95)',
    color: textColor,
    border: `1px solid ${axisColor}`,
    borderRadius: '8px',
    padding: '12px',
  };

  // Custom tooltip formatter
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const dataPoint = payload[0].payload;
      
      return (
        <div className="p-3 bg-white dark:bg-gray-800 shadow-lg border border-gray-200 dark:border-gray-700 rounded-lg">
          <p className="font-medium text-gray-900 dark:text-white mb-2">{label}</p>
          
          {payload.map((entry: any, index: number) => (
            <div key={`item-${index}`} className="flex justify-between items-center mb-1">
              <span className="text-sm mr-4" style={{ color: entry.color }}>
                {entry.name}:
              </span>
              <span className="text-sm font-medium text-gray-900 dark:text-white">
                {entry.name.includes('GDP') && entry.name.includes('per Capita') 
                  ? `$${entry.value.toLocaleString()}`
                  : entry.name.includes('GDP') && entry.name.includes('Billion') 
                    ? `$${entry.value.toFixed(1)}B`
                    : entry.value.toLocaleString(undefined, { 
                        maximumFractionDigits: 2 
                      })}
              </span>
            </div>
          ))}
          
          {dataPoint.isForecast && (
            <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700 text-xs text-blue-600 dark:text-blue-400">
              Forecast data
            </div>
          )}
          
          {dataPoint.isRollingAverage && (
            <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700 text-xs text-gray-500 dark:text-gray-400">
              Rolling average ({timeResolution === 'quarterly' ? '4 quarters' : '12 months'})
            </div>
          )}
        </div>
      );
    }
  
    return null;
  };

  // Render historical chart based on view
  const renderHistoricalChart = () => {
    const commonProps = {
      data: combinedData,
      margin: { top: 5, right: 30, left: 20, bottom: 5 }
    };

    switch (chartView) {
      case 'overview':
        return (
          <ComposedChart {...commonProps}>
            <defs>
              <linearGradient id="populationGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.8}/>
                <stop offset="95%" stopColor="#3B82F6" stopOpacity={0.1}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={axisColor} opacity={0.5} />
            <XAxis 
              dataKey="date" 
              tick={{ fontSize: 12, fill: textColor }} 
              stroke={axisColor}
              angle={-45}
              textAnchor="end"
              height={60}
            />
            <YAxis 
              yAxisId="population"
              tick={{ fontSize: 12, fill: textColor }} 
              stroke={axisColor}
              label={{ value: 'Population (M)', angle: -90, position: 'insideLeft', fill: textColor, fontSize: 12 }}
            />
            <YAxis 
              yAxisId="gdp"
              orientation="right"
              tick={{ fontSize: 12, fill: textColor }} 
              stroke={axisColor}
              label={{ value: 'GDP per Capita ($)', angle: 90, position: 'insideRight', fill: textColor, fontSize: 12 }}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend />
            <Area
              yAxisId="population"
              type="monotone"
              dataKey="population"
              stroke="#3B82F6"
              fillOpacity={1}
              fill="url(#populationGradient)"
              name="Population (M)"
              strokeDasharray={(d) => d.isForecast ? "5 5" : "0"}
            />
            <Line
              yAxisId="gdp"
              type="monotone"
              dataKey="gdpPerCapita"
              stroke="#10B981"
              strokeWidth={2}
              name="GDP per Capita ($)"
              strokeDasharray={(d) => d.isForecast ? "5 5" : "0"}
            />
            {targetTime !== IxTime.getCurrentIxTime() && (
              <ReferenceLine 
                x={IxTime.getCurrentGameYear(IxTime.getCurrentIxTime()).toString()} 
                stroke="#EF4444" 
                strokeDasharray="5 5"
                yAxisId="population"
              >
                <Label 
                  value="Present" 
                  position="top" 
                  fill="#EF4444"
                  fontSize={11}
                />
              </ReferenceLine>
            )}
          </ComposedChart>
        );

      case 'population':
        return (
          <AreaChart {...commonProps}>
            <defs>
              <linearGradient id="popGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.8}/>
                <stop offset="95%" stopColor="#3B82F6" stopOpacity={0.1}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={axisColor} opacity={0.5} />
            <XAxis dataKey="date" tick={{ fontSize: 12, fill: textColor }} stroke={axisColor} />
            <YAxis 
              tick={{ fontSize: 12, fill: textColor }} 
              stroke={axisColor}
              label={{ value: 'Population (M)', angle: -90, position: 'insideLeft', fill: textColor, fontSize: 12 }}
            />
            <Tooltip content={<CustomTooltip />} />
            <Area
              type="monotone"
              dataKey="population"
              stroke="#3B82F6"
              fillOpacity={1}
              fill="url(#popGradient)"
              name="Population (Millions)"
              strokeDasharray={(d) => d.isForecast ? "5 5" : "0"}
            />
          </AreaChart>
        );

      case 'gdp':
        return (
          <LineChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" stroke={axisColor} opacity={0.5} />
            <XAxis dataKey="date" tick={{ fontSize: 12, fill: textColor }} stroke={axisColor} />
            <YAxis 
              yAxisId="per-capita"
              tick={{ fontSize: 12, fill: textColor }} 
              stroke={axisColor}
              label={{ value: 'Per Capita ($)', angle: -90, position: 'insideLeft', fill: textColor, fontSize: 12 }}
            />
            <YAxis 
              yAxisId="total"
              orientation="right"
              tick={{ fontSize: 12, fill: textColor }} 
              stroke={axisColor}
              label={{ value: 'Total (B$)', angle: 90, position: 'insideRight', fill: textColor, fontSize: 12 }}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend />
            <Line
              yAxisId="per-capita"
              type="monotone"
              dataKey="gdpPerCapita"
              stroke="#10B981"
              strokeWidth={2}
              name="GDP per Capita ($)"
              strokeDasharray={(d) => d.isForecast ? "5 5" : "0"}
            />
            <Line
              yAxisId="total"
              type="monotone"
              dataKey="totalGdp"
              stroke="#F59E0B"
              strokeWidth={2}
              name="Total GDP (B$)"
              strokeDasharray={(d) => d.isForecast ? "5 5" : "0"}
            />
          </LineChart>
        );

      case 'density':
        return (
          <ComposedChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" stroke={axisColor} opacity={0.5} />
            <XAxis dataKey="date" tick={{ fontSize: 12, fill: textColor }} stroke={axisColor} />
            <YAxis 
              yAxisId="popDensity"
              tick={{ fontSize: 12, fill: textColor }} 
              stroke={axisColor}
              label={{ value: 'Pop. (/km²)', angle: -90, position: 'insideLeft', fill: textColor, fontSize: 12 }}
            />
            <YAxis 
              yAxisId="gdpDensity"
              orientation="right"
              tick={{ fontSize: 12, fill: textColor }} 
              stroke={axisColor}
              label={{ value: 'GDP (M$/km²)', angle: 90, position: 'insideRight', fill: textColor, fontSize: 12 }}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend />
            <Bar
              yAxisId="popDensity"
              dataKey="populationDensity"
              fill="#8B5CF6"
              name="Pop. Density (/km²)"
            />
            <Line
              yAxisId="gdpDensity"
              type="monotone"
              dataKey="gdpDensity"
              stroke="#EF4444"
              strokeWidth={2}
              name="GDP Density (M$/km²)"
              strokeDasharray={(d) => d.isForecast ? "5 5" : "0"}
            />
          </ComposedChart>
        );

      default:
        // Return an empty LineChart as fallback to ensure we never return null
        return (
          <LineChart data={[]}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis />
            <Tooltip />
          </LineChart>
        );
    }
  };

  // Render forecast charts
  const renderForecastChart = () => {
    const commonProps = {
      data: fullForecastData,
      margin: { top: 5, right: 30, left: 20, bottom: 5 }
    };

    switch (forecastView) {
      case 'combined':
        return (
          <ComposedChart {...commonProps}>
            <defs>
              <linearGradient id="forecastPopGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.8}/>
                <stop offset="95%" stopColor="#3B82F6" stopOpacity={0.1}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={axisColor} opacity={0.5} />
            <XAxis 
              dataKey="date" 
              tick={{ fontSize: 12, fill: textColor }} 
              stroke={axisColor}
            />
            <YAxis 
              yAxisId="population"
              tick={{ fontSize: 12, fill: textColor }} 
              stroke={axisColor}
              label={{ value: 'Population (M)', angle: -90, position: 'insideLeft', fill: textColor, fontSize: 12 }}
            />
            <YAxis 
              yAxisId="gdp"
              orientation="right"
              tick={{ fontSize: 12, fill: textColor }} 
              stroke={axisColor}
              label={{ value: 'GDP per Capita ($)', angle: 90, position: 'insideRight', fill: textColor, fontSize: 12 }}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend />
            <Area
              yAxisId="population"
              type="monotone"
              dataKey="population"
              stroke="#3B82F6"
              fillOpacity={1}
              fill="url(#forecastPopGradient)"
              name="Population (M)"
            />
            <Line
              yAxisId="gdp"
              type="monotone"
              dataKey="gdpPerCapita"
              stroke="#10B981"
              strokeWidth={3}
              name="GDP per Capita ($)"
            />
            <ReferenceLine 
              yAxisId="population"
              x={new Date().getFullYear().toString()} 
              stroke="#EF4444" 
              strokeDasharray="5 5" 
              label={{ value: "Current", position: "top", fill: "#EF4444", fontSize: 11 }}
            />
          </ComposedChart>
        );

      case 'scenarios':
        return (
          <LineChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" stroke={axisColor} opacity={0.5} />
            <XAxis dataKey="date" tick={{ fontSize: 12, fill: textColor }} stroke={axisColor} />
            <YAxis 
              yAxisId="gdpPerCapita" 
              tick={{ fontSize: 12, fill: textColor }} 
              stroke={axisColor}
              label={{ value: 'GDP per Capita ($)', angle: -90, position: 'insideLeft', fill: textColor, fontSize: 12 }}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend />
            <Line
              yAxisId="gdpPerCapita"
              type="monotone"
              dataKey="gdpPerCapita_optimistic"
              stroke="#10B981"
              strokeWidth={2}
              name="Optimistic Scenario"
              strokeDasharray="5 5"
            />
            <Line
              yAxisId="gdpPerCapita"
              type="monotone"
              dataKey="gdpPerCapita"
              stroke="#3B82F6"
              strokeWidth={3}
              name="Baseline Scenario"
            />
            <Line
              yAxisId="gdpPerCapita"
              type="monotone"
              dataKey="gdpPerCapita_pessimistic"
              stroke="#EF4444"
              strokeWidth={2}
              name="Pessimistic Scenario"
              strokeDasharray="5 5"
            />
            <ReferenceLine 
              yAxisId="gdpPerCapita"
              x={new Date().getFullYear().toString()} 
              stroke="#6B7280" 
              strokeDasharray="5 5"
              label={{ value: "Current", position: "top", fill: "#6B7280", fontSize: 11 }}
            />
          </LineChart>
        );

      case 'population':
        return (
          <AreaChart {...commonProps}>
            <defs>
              <linearGradient id="popForecastGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.8}/>
                <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0.1}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={axisColor} opacity={0.5} />
            <XAxis dataKey="date" tick={{ fontSize: 12, fill: textColor }} stroke={axisColor} />
            <YAxis 
              yAxisId="population"
              tick={{ fontSize: 12, fill: textColor }} 
              stroke={axisColor}
              label={{ value: 'Population (M)', angle: -90, position: 'insideLeft', fill: textColor, fontSize: 12 }}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend />
            <Area
              yAxisId="population"
              type="monotone"
              dataKey="population"
              stroke="#8B5CF6"
              fillOpacity={1}
              fill="url(#popForecastGradient)"
              name="Population (Millions)"
            />
            <ReferenceLine 
              yAxisId="population"
              x={new Date().getFullYear().toString()} 
              stroke="#EF4444" 
              strokeDasharray="5 5"
              label={{ value: "Current", position: "top", fill: "#EF4444", fontSize: 11 }}
            />
          </AreaChart>
        );

      case 'gdp':
        return (
          <ComposedChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" stroke={axisColor} opacity={0.5} />
            <XAxis dataKey="date" tick={{ fontSize: 12, fill: textColor }} stroke={axisColor} />
            <YAxis 
              yAxisId="perCapita"
              tick={{ fontSize: 12, fill: textColor }} 
              stroke={axisColor}
              label={{ value: 'Per Capita ($)', angle: -90, position: 'insideLeft', fill: textColor, fontSize: 12 }}
            />
            <YAxis 
              yAxisId="total"
              orientation="right"
              tick={{ fontSize: 12, fill: textColor }} 
              stroke={axisColor}
              label={{ value: 'Total (B$)', angle: 90, position: 'insideRight', fill: textColor, fontSize: 12 }}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend />
            <Line
              yAxisId="perCapita"
              type="monotone"
              dataKey="gdpPerCapita"
              stroke="#10B981"
              strokeWidth={3}
              name="GDP per Capita ($)"
            />
            <Bar
              yAxisId="total"
              dataKey="totalGdp"
              fill="#F59E0B"
              opacity={0.6}
              name="Total GDP (B$)"
            />
            <ReferenceLine 
              yAxisId="perCapita"
              x={new Date().getFullYear().toString()} 
              stroke="#EF4444" 
              strokeDasharray="5 5"
              label={{ value: "Current", position: "top", fill: "#EF4444", fontSize: 11 }}
            />
          </ComposedChart>
        );

      case 'density':
        if (!country.landArea) {
          return (
            <div className="h-full flex items-center justify-center">
              <div className="text-center">
                <AlertTriangle className="h-12 w-12 text-yellow-500 dark:text-yellow-400 mx-auto mb-2" />
                <p className="text-sm text-gray-600 dark:text-gray-400">Land area data required for density analysis</p>
              </div>
            </div>
          );
        }
        
        return (
          <ComposedChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" stroke={axisColor} opacity={0.5} />
            <XAxis dataKey="date" tick={{ fontSize: 12, fill: textColor }} stroke={axisColor} />
            <YAxis 
              yAxisId="popDensity"
              tick={{ fontSize: 12, fill: textColor }} 
              stroke={axisColor}
              label={{ value: 'Pop. (/km²)', angle: -90, position: 'insideLeft', fill: textColor, fontSize: 12 }}
            />
            <YAxis 
              yAxisId="gdpDensity"
              orientation="right"
              tick={{ fontSize: 12, fill: textColor }} 
              stroke={axisColor}
              label={{ value: 'GDP (M$/km²)', angle: 90, position: 'insideRight', fill: textColor, fontSize: 12 }}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend />
            <Bar
              yAxisId="popDensity"
              dataKey="populationDensity"
              fill="#8B5CF6"
              opacity={0.7}
              name="Pop. Density (/km²)"
            />
            <Line
              yAxisId="gdpDensity"
              type="monotone"
              dataKey="gdpDensity"
              stroke="#EF4444"
              strokeWidth={3}
              name="GDP Density (M$/km²)"
            />
            <ReferenceLine 
              yAxisId="popDensity"
              x={new Date().getFullYear().toString()} 
              stroke="#6B7280" 
              strokeDasharray="5 5"
              label={{ value: "Current", position: "top", fill: "#6B7280", fontSize: 11 }}
            />
          </ComposedChart>
        );

      default:
        // Return an empty LineChart as fallback
        return (
          <LineChart data={[]}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis />
            <Tooltip />
          </LineChart>
        );
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 border border-gray-200 dark:border-gray-700">
      {/* Header with view toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white flex items-center mb-4 sm:mb-0">
          <BarChart3 className="h-5 w-5 mr-2" />
          {country.name} {viewMode === 'historical' ? 'at a Glance' : 'Economic Forecast'}
        </h2>
        
        <div className="flex flex-wrap gap-2">
          {/* View Mode Toggle */}
          <div className="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
            <button
              onClick={() => setViewMode('historical')}
              className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                viewMode === 'historical' 
                  ? 'bg-indigo-600 text-white'
                  : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              Historical
            </button>
            <button
              onClick={() => setViewMode('forecast')}
              className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                viewMode === 'forecast' 
                  ? 'bg-indigo-600 text-white'
                  : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              Forecast
            </button>
          </div>
          
          {/* Time Resolution Toggle (only in historical view) */}
          {viewMode === 'historical' && (
            <div className="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
              {(['quarterly', 'annual'] as TimeResolution[]).map((resolution) => (
                <button
                  key={resolution}
                  onClick={() => setTimeResolution(resolution)}
                  className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                    timeResolution === resolution
                      ? 'bg-indigo-600 text-white'
                      : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  {resolution === 'quarterly' ? 'Quarterly' : 'Annual'}
                </button>
              ))}
            </div>
          )}
          
          {/* Additional Controls Based on View */}
          {viewMode === 'historical' ? (
            <button
              onClick={() => setShowForecast(!showForecast)}
              className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                showForecast
                  ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 border border-green-300 dark:border-green-700'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              Show Forecast
            </button>
          ) : (
            <button
              onClick={() => setShowScenarios(!showScenarios)}
              className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                showScenarios
                  ? 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200 border border-yellow-300 dark:border-yellow-700'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              Scenarios
            </button>
          )}
        </div>
      </div>

      {/* HISTORICAL VIEW */}
      {viewMode === 'historical' && (
        <>
          {/* Chart View Selector */}
          <div className="flex flex-wrap gap-2 mb-6">
            {[
              { key: 'overview', label: 'Overview', icon: Activity },
              { key: 'population', label: 'Population', icon: Users },
              { key: 'gdp', label: 'GDP Metrics', icon: TrendingUp },
              { key: 'density', label: 'Density', icon: Globe }
            ].map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setChartView(key as ChartView)}
                className={`flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  chartView === key
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                <Icon className="h-4 w-4 mr-1" />
                {label}
              </button>
            ))}
          </div>

          {/* Chart */}
          <div className="h-80 mb-4">
            {isLoading ? (
              <div className="h-full flex items-center justify-center">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 dark:border-indigo-500 mx-auto mb-2"></div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Loading chart data...</p>
                </div>
              </div>
            ) : combinedData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                {renderHistoricalChart()}
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center">
                <div className="text-center">
                  <BarChart3 className="h-12 w-12 text-gray-400 opacity-50 mx-auto mb-2" />
                  <p className="text-sm text-gray-600 dark:text-gray-400">No historical data available</p>
                </div>
              </div>
            )}
          </div>

          {/* Current Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <div className="text-center">
              <div className="text-lg font-semibold text-gray-900 dark:text-white">
                {formatNumber(country.currentPopulation / 1000000)}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Population</div>
              <div className="text-xs text-green-600 dark:text-green-400">
                {(country.populationGrowthRate * 100).toFixed(1)}% growth
              </div>
            </div>
            
            <div className="text-center">
              <div className="text-lg font-semibold text-gray-900 dark:text-white">
                {formatNumber(country.currentGdpPerCapita, true)}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">GDP per Capita</div>
              <div className="text-xs text-green-600 dark:text-green-400">
                {(country.adjustedGdpGrowth * 100).toFixed(1)}% growth
              </div>
            </div>
            
            <div className="text-center">
              <div className="text-lg font-semibold text-gray-900 dark:text-white">
                {country.economicTier}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Economic Tier</div>
            </div>
            
            <div className="text-center">
              <div className="text-lg font-semibold text-gray-900 dark:text-white">
                {country.populationTier}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Population Tier</div>
            </div>
          </div>
        </>
      )}

      {/* FORECAST VIEW */}
      {viewMode === 'forecast' && (
        <>
          {/* Forecast Metrics Summary */}
          {forecastAnalysis && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="bg-gray-100 dark:bg-gray-700 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                  {forecastAnalysis.populationCAGR.toFixed(1)}%
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Population CAGR</div>
                <div className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                  {formatNumber(forecastAnalysis.projectedPopulation10Y)} in {new Date(targetTime).getFullYear() + 10}
                </div>
              </div>
              
              <div className="bg-gray-100 dark:bg-gray-700 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
                  {forecastAnalysis.gdpPerCapitaCAGR.toFixed(1)}%
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">GDP per Capita CAGR</div>
                <div className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                  {formatNumber(forecastAnalysis.projectedGdpPerCapita10Y, true)} in {new Date(targetTime).getFullYear() + 10}
                </div>
              </div>
              
              <div className="bg-gray-100 dark:bg-gray-700 rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                  {forecastAnalysis.totalGdpCAGR.toFixed(1)}%
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Total GDP CAGR</div>
                <div className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                  {formatNumber(forecastAnalysis.projectedTotalGdp10Y * 1000)} in {new Date(targetTime).getFullYear() + 10}
                </div>
              </div>
            </div>
          )}

          {/* Chart View Selector */}
          <div className="flex flex-wrap gap-2 mb-6">
            {[
              { key: 'combined', label: 'Overview', icon: Activity },
              { key: 'population', label: 'Population', icon: Users },
              { key: 'gdp', label: 'GDP', icon: DollarSign },
              { key: 'density', label: 'Density', icon: BarChart3 },
              ...(showScenarios ? [{ key: 'scenarios', label: 'Scenarios', icon: Target }] : [])
            ].map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setForecastView(key as ForecastView)}
                className={`flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  forecastView === key
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                <Icon className="h-4 w-4 mr-1" />
                {label}
              </button>
            ))}
          </div>

          {/* Chart */}
          <div className="h-80 mb-4">
            {isLoadingForecast ? (
              <div className="h-full flex items-center justify-center">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 dark:border-indigo-500 mx-auto mb-2"></div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Generating forecast...</p>
                </div>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                {renderForecastChart()}
              </ResponsiveContainer>
            )}
          </div>

          {/* Forecast Assumptions */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-2 flex items-center">
                <Zap className="h-4 w-4 mr-2" />
                Growth Assumptions
              </h3>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Population Growth:</span>
                  <span className="text-gray-900 dark:text-white">{(country.populationGrowthRate * 100).toFixed(2)}% annually</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">GDP Growth:</span>
                  <span className="text-gray-900 dark:text-white">{(country.adjustedGdpGrowth * 100).toFixed(2)}% annually</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Economic Tier:</span>
                  <span className="text-gray-900 dark:text-white">{country.economicTier}</span>
                </div>
              </div>
            </div>
            
            <div className="bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-2 flex items-center">
                <AlertTriangle className="h-4 w-4 mr-2" />
                Important Notes
              </h3>
              <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                <p>• Projections based on current growth rates</p>
                <p>• Does not account for economic cycles</p>
                <p>• External factors may significantly alter outcomes</p>
                <p>• For planning purposes only</p>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Info */}
      <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg">
        <div className="flex items-start">
          <Info className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5 mr-2 flex-shrink-0" />
          <div className="text-sm text-gray-600 dark:text-gray-400">
            {viewMode === 'historical' ? (
              <>
                Interactive chart showing {timeResolution === 'quarterly' ? '4 quarters' : '12 months'} rolling average data for {country.name}. 
                {showForecast && forecastYears > 0 && ` Forecast extends ${forecastYears} years based on current growth rates.`}
                {combinedData.length === 0 && " No historical data available - data will accumulate over time."}
              </>
            ) : (
              <>
                10-year economic forecast for {country.name} based on current growth trends.
                {showScenarios && " Scenarios explore potential outcomes under different conditions."}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
