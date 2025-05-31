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
  Legend
} from "recharts";
import {
  BarChart3,
  TrendingUp,
  Users,
  Globe,
  Activity,
  Calendar,
  Info
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
}

type TimeResolution = 'quarterly' | 'annual';
type ChartView = 'overview' | 'population' | 'gdp' | 'density';

export function CountryAtGlance({
  country,
  historicalData = [],
  targetTime,
  forecastYears,
  isLoading = false
}: CountryAtGlanceProps) {
  const { theme } = useTheme();
  const [timeResolution, setTimeResolution] = useState<TimeResolution>('annual');
  const [chartView, setChartView] = useState<ChartView>('overview');
  const [showForecast, setShowForecast] = useState(true);

  // Format chart data based on time resolution
  const chartData = useMemo(() => {
    if (!historicalData.length) return [];

    // Group data by time resolution
    const groupedData = historicalData.reduce<Record<string, HistoricalDataPoint[]>>((acc, point) => {
      const date = new Date(point.ixTimeTimestamp);
      let key: string;
      
      if (timeResolution === 'quarterly') {
        const quarter = Math.floor(date.getMonth() / 3) + 1;
        key = `${date.getFullYear()}-Q${quarter}`;
      } else {
        key = date.getFullYear().toString();
      }

      if (!acc[key]) {
        acc[key] = [];
      }
      acc[key]?.push(point);
      return acc;
    }, {});

    // Average the data for each time period
    return Object.entries(groupedData)
      .map(([period, points]) => {
        const avgPoint = points.reduce((sum, point) => ({
          population: sum.population + point.population / points.length,
          gdpPerCapita: sum.gdpPerCapita + point.gdpPerCapita / points.length,
          totalGdp: sum.totalGdp + point.totalGdp / points.length,
          populationDensity: sum.populationDensity + (point.populationDensity ?? 0) / points.length,
          gdpDensity: sum.gdpDensity + (point.gdpDensity ?? 0) / points.length,
        }), {
          population: 0,
          gdpPerCapita: 0,
          totalGdp: 0,
          populationDensity: 0,
          gdpDensity: 0
        });

        return {
          period,
          date: period,
          population: avgPoint.population / 1000000, // Convert to millions
          gdpPerCapita: avgPoint.gdpPerCapita,
          totalGdp: avgPoint.totalGdp / 1000000000, // Convert to billions
          populationDensity: avgPoint.populationDensity,
          gdpDensity: avgPoint.gdpDensity / 1000000, // Convert to millions per km²
          populationGrowth: points.length > 1 && points[0] && points[0].population !== 0 ?
            ((avgPoint.population - points[0].population) / points[0].population) * 100 : 0,
          gdpGrowth: points.length > 1 && points[0] && points[0].gdpPerCapita !== 0 ?
            ((avgPoint.gdpPerCapita - points[0].gdpPerCapita) / points[0].gdpPerCapita) * 100 : 0,
        };
      })
      .sort((a, b) => a.period.localeCompare(b.period));
  }, [historicalData, timeResolution]);

  // Generate forecast data if enabled
  const forecastData = useMemo(() => {
    if (!showForecast || forecastYears === 0) return [];
    
    // Use current country stats as the base for forecast if chartData is empty
    const basePointForForecast = chartData.length > 0 
      ? chartData[chartData.length - 1]
      : { // Construct a base point from current country data if historical is empty
          date: IxTime.getCurrentGameYear(targetTime).toString(), // Use game year of targetTime
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
          ? `${currentRealYear + Math.floor((i-1)/4)}-Q${((i-1) % 4) + 1}` // Adjust quarter calculation
          : (currentRealYear + i).toString(),
        date: `Forecast +${i}yr`, // Keep as relative for tooltip/display
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
  }, [country, chartData, forecastYears, showForecast, timeResolution, targetTime]);


  const combinedData = [...chartData, ...forecastData];

  const formatNumber = (num: number, isCurrency = false): string => {
    if (isCurrency) {
      if (Math.abs(num) >= 1e3) return `$${(num / 1e3).toFixed(1)}K`;
      return `$${num.toFixed(0)}`;
    }
    if (Math.abs(num) >= 1) return `${num.toFixed(1)}M`;
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

  // Function for strokeDasharray
  const getStrokeDashArray = (dataPoint: any): string => {
    return dataPoint?.isForecast ? "5 5" : "0";
  };

  const renderChart = () => {
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
              label={{ value: 'Population (M)', angle: -90, position: 'insideLeft' }}
            />
            <YAxis 
              yAxisId="gdp"
              orientation="right"
              tick={{ fontSize: 12, fill: textColor }} 
              stroke={axisColor}
              label={{ value: 'GDP per Capita ($)', angle: 90, position: 'insideRight' }}
            />
            <Tooltip contentStyle={tooltipStyle} />
            <Legend />
            <Area
              yAxisId="population"
              type="monotone"
              dataKey="population"
              stroke="#3B82F6"
              fillOpacity={1}
              fill="url(#populationGradient)"
              name="Population (M)"
              strokeDasharray="0"
            />
            <Line
              yAxisId="gdp"
              type="monotone"
              dataKey="gdpPerCapita"
              stroke="#10B981"
              strokeWidth={3}
              name="GDP per Capita ($)"
              strokeDasharray="0"
            />
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
            <YAxis tick={{ fontSize: 12, fill: textColor }} stroke={axisColor} />
            <Tooltip contentStyle={tooltipStyle} />
            <Area
              type="monotone"
              dataKey="population"
              stroke="#3B82F6"
              fillOpacity={1}
              fill="url(#popGradient)"
              name="Population (Millions)"
            />
          </AreaChart>
        );

      case 'gdp':
        return (
          <LineChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" stroke={axisColor} opacity={0.5} />
            <XAxis dataKey="date" tick={{ fontSize: 12, fill: textColor }} stroke={axisColor} />
            <YAxis tick={{ fontSize: 12, fill: textColor }} stroke={axisColor} />
            <Tooltip contentStyle={tooltipStyle} />
            <Legend />
            <Line
              type="monotone"
              dataKey="gdpPerCapita"
              stroke="#10B981"
              strokeWidth={3}
              name="GDP per Capita ($)"
            />
            <Line
              type="monotone"
              dataKey="totalGdp"
              stroke="#F59E0B"
              strokeWidth={2}
              name="Total GDP (B$)"
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
            />
            <YAxis 
              yAxisId="gdpDensity"
              orientation="right"
              tick={{ fontSize: 12, fill: textColor }} 
              stroke={axisColor}
            />
            <Tooltip contentStyle={tooltipStyle} />
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
              strokeWidth={3}
              name="GDP Density (M$/km²)"
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

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 border border-gray-200 dark:border-gray-700">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white flex items-center mb-4 sm:mb-0">
          <BarChart3 className="h-5 w-5 mr-2" />
          {country.name} at a Glance
        </h2>
        
        <div className="flex flex-wrap gap-2">
          {/* Time Resolution Toggle */}
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
          
          {/* Show Forecast Toggle */}
          <button
            onClick={() => setShowForecast(!showForecast)}
            className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
              showForecast
                ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 border border-green-300 dark:border-green-700'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            Forecast
          </button>
        </div>
      </div>

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
            {renderChart()}
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

      {/* Info */}
      <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg">
        <div className="flex items-start">
          <Info className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5 mr-2 flex-shrink-0" />
          <div className="text-sm text-gray-600 dark:text-gray-400">
            Interactive chart showing {timeResolution} data for {country.name}. 
            {showForecast && forecastYears > 0 && ` Forecast extends ${forecastYears} years based on current growth rates.`}
            {combinedData.length === 0 && " No historical data available - data will accumulate over time."}
          </div>
        </div>
      </div>
    </div>
  );
}