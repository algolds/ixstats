// src/app/countries/[id]/page.tsx
"use client";

import { useState, useMemo, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "~/trpc/react";
import { IxTime } from "~/lib/ixtime";
import { CountryInfobox } from "../_components/CountryInfobox";
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
  Legend,
  ScatterChart,
  Scatter,
  BarChart,
  Bar,
  ComposedChart,
  RadialBarChart,
  RadialBar,
  PieChart,
  Pie,
  Cell
} from "recharts";
import {
  ArrowLeft,
  Calendar,
  TrendingUp,
  Users,
  Globe,
  BarChart3,
  Rewind,
  FastForward,
  Play,
  Map,
  Scaling,
  DollarSign,
  Activity,
  Target,
  Zap,
  Compass,
  Layers,
  Info,
  Clock,
  AlertCircle,
  RefreshCw
} from "lucide-react";
import { useTheme } from "~/context/theme-context";

interface ComparisonDataPoint {
  name: string;
  population: number;
  gdpPerCapita: number;
  landArea: number | null;
  populationDensity: number | null;
  gdpDensity: number | null;
  totalGdp: number;
  isCurrentCountry: boolean;
  economicTier: string;
  populationTier: string;
}

export default function CountryDetailPage() {
  const params = useParams();
  const router = useRouter();
  const countryId = params.id as string;
  const { theme } = useTheme();

  // Time control state
  const [timeOffset, setTimeOffset] = useState(0);
  const [forecastYears, setForecastYears] = useState(1);
  const [selectedMetric, setSelectedMetric] = useState<'density' | 'efficiency' | 'growth' | 'comparison'>('density');
  const [infoboxExpanded, setInfoboxExpanded] = useState(false);
  const [isTimeTravel, setIsTimeTravel] = useState(false);

  // Get time context
  const { data: timeContext } = api.countries.getTimeContext.useQuery();

  // Calculate target time based on controls
  const targetTime = useMemo(() => {
    if (!timeContext) return Date.now();
    
    let baseTime = timeContext.currentIxTime;
    
    // Apply time offset (negative goes to past, positive to future)
    if (timeOffset !== 0) {
      baseTime = IxTime.addYears(baseTime, timeOffset);
      setIsTimeTravel(timeOffset !== 0);
    } else {
      setIsTimeTravel(false);
    }
    
    return baseTime;
  }, [timeContext?.currentIxTime, timeOffset]);

  const forecastTime = useMemo(() => {
    return IxTime.addYears(targetTime, forecastYears);
  }, [targetTime, forecastYears]);

  // Get country data for the selected time
  const { data: country, isLoading, error, refetch } = api.countries.getByIdAtTime.useQuery({
    id: countryId,
    ixTime: targetTime,
  }, {
    enabled: !!countryId && !!timeContext,
    refetchOnWindowFocus: false,
  });

  // Get forecast data
  const { data: forecastData } = api.countries.getForecast.useQuery({
    countryId,
    startTime: targetTime,
    endTime: forecastTime,
    steps: 10,
  }, {
    enabled: !!countryId && forecastYears > 0 && !!timeContext,
  });

  // Get historical data around current time for charts
  const { data: historicalChartData } = api.countries.getHistoricalAtTime.useQuery({
    countryId,
    ixTime: targetTime,
    windowYears: 10, // 10 years of data around the current time
  }, {
    enabled: !!countryId && !!timeContext,
  });

  // Get all countries for comparison (at current time only)
  const { data: allCountries } = api.countries.getAll.useQuery();

  // Refresh data when time changes significantly
  useEffect(() => {
    if (Math.abs(timeOffset) > 0.1) { // If time offset is significant
      refetch();
    }
  }, [timeOffset, refetch]);

  const formatNumber = (num: number | null | undefined, isCurrency = true, precision = 2): string => {
    if (num == null) return isCurrency ? '$0.00' : '0';
    const prefix = isCurrency ? '$' : '';
    if (Math.abs(num) >= 1e12) return `${prefix}${(num / 1e12).toFixed(precision)}T`;
    if (Math.abs(num) >= 1e9) return `${prefix}${(num / 1e9).toFixed(precision)}B`;
    if (Math.abs(num) >= 1e6) return `${prefix}${(num / 1e6).toFixed(precision)}M`;
    if (Math.abs(num) >= 1e3) return `${prefix}${(num / 1e3).toFixed(precision)}K`;
    return `${prefix}${num.toFixed(isCurrency ? precision : 0)}`;
  };

  const formatArea = (area: number | null | undefined): string => {
    if (!area) return 'N/A';
    return `${formatNumber(area, false, 0)} km²`;
  };

  // Use historical data for charts when available, otherwise use current data
  const chartData = useMemo(() => {
    if (historicalChartData && historicalChartData.length > 0) {
      return historicalChartData
        .sort((a, b) => a.ixTimeTimestamp - b.ixTimeTimestamp)
        .map((point) => ({
          date: IxTime.formatIxTime(point.ixTimeTimestamp),
          population: point.population / 1000000, // In millions
          gdpPerCapita: point.gdpPerCapita,
          totalGdp: point.totalGdp / 1000000000, // In billions
          populationDensity: point.populationDensity || 0,
          gdpDensity: point.gdpDensity ? point.gdpDensity / 1000000 : 0, // In millions per km²
          economicEfficiency: point.gdpPerCapita / (point.populationDensity || 1),
          areaUtilization: point.totalGdp / ((country?.landArea || 1) * 1000000),
        }));
    }

    // Fallback to single point from current data
    if (country) {
      return [{
        date: IxTime.formatIxTime(targetTime),
        population: country.currentPopulation / 1000000,
        gdpPerCapita: country.currentGdpPerCapita,
        totalGdp: country.currentTotalGdp / 1000000000,
        populationDensity: country.populationDensity || 0,
        gdpDensity: country.gdpDensity ? country.gdpDensity / 1000000 : 0,
        economicEfficiency: country.currentGdpPerCapita / (country.populationDensity || 1),
        areaUtilization: country.currentTotalGdp / ((country.landArea || 1) * 1000000),
      }];
    }

    return [];
  }, [historicalChartData, country, targetTime]);

  // Comparative data for scatter plots (only use current time data for comparison)
  const comparisonData = useMemo((): ComparisonDataPoint[] => {
    if (!allCountries || !country) return [];
    return allCountries
      .filter(c => c.landArea && c.currentPopulation && c.currentGdpPerCapita)
      .map(c => ({
        name: c.name,
        population: c.currentPopulation / 1000000,
        gdpPerCapita: c.currentGdpPerCapita,
        landArea: c.landArea,
        populationDensity: c.populationDensity || 0,
        gdpDensity: c.gdpDensity || 0,
        totalGdp: c.currentTotalGdp / 1000000000,
        isCurrentCountry: c.id === country.id,
        economicTier: c.economicTier,
        populationTier: c.populationTier
      }));
  }, [allCountries, country]);

  // Economic efficiency metrics
  const efficiencyMetrics = useMemo(() => {
    if (!country?.landArea) return null;
    
    const landAreaSqMi = country.landArea / 2.58999;
    const populationPerSqMi = country.currentPopulation / landAreaSqMi;
    const gdpPerSqMi = country.currentTotalGdp / landAreaSqMi;
    
    return {
      economicDensity: country.currentTotalGdp / country.landArea,
      populationEfficiency: country.currentGdpPerCapita / (country.populationDensity || 1),
      landProductivity: country.currentTotalGdp / country.landArea / 1000000,
      spatialGdpRatio: country.currentGdpPerCapita / Math.sqrt(country.landArea),
      populationPerSqMi,
      gdpPerSqMi,
      compactness: Math.sqrt(country.landArea) / (country.currentPopulation / 1000000),
    };
  }, [country]);

  const axisAndGridColor = theme === 'dark' ? '#4A5568' : '#CBD5E0';
  const textColor = theme === 'dark' ? '#E2E8F0' : '#2D3748';

  const tooltipStyle = {
    backgroundColor: theme === 'dark' ? 'rgba(31, 41, 55, 0.9)' : 'rgba(255, 255, 255, 0.9)',
    color: textColor,
    borderRadius: '0.375rem',
    borderColor: axisAndGridColor,
    borderWidth: '1px',
    padding: '0.5rem 0.75rem',
  };

  const TIER_COLORS: Record<string, string> = {
    'Advanced': '#8B5CF6',
    'Developed': '#3B82F6', 
    'Emerging': '#10B981',
    'Developing': '#F59E0B'
  };

  const getScatterPointColor = (dataPoint: ComparisonDataPoint): string => {
    if (dataPoint.isCurrentCountry) return "#EF4444";
    return TIER_COLORS[dataPoint.economicTier] || "#6B7280";
  };

  const handleInfoboxToggle = (expanded: boolean) => {
    setInfoboxExpanded(expanded);
  };

  const handleTimeReset = () => {
    setTimeOffset(0);
    setForecastYears(1);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-indigo-600 dark:border-indigo-500 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">
            {isTimeTravel ? 'Calculating time travel data...' : 'Loading country data...'}
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="mx-auto h-12 w-12 text-red-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">Error loading country</h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{error.message}</p>
          <button
            onClick={() => refetch()}
            className="mt-4 inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!country) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <Globe className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">Country not found</h3>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <button
            onClick={() => router.back()}
            className="inline-flex items-center text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 mb-4"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back to Countries
          </button>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                {country.name}
                {isTimeTravel && (
                  <span className="ml-3 px-3 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 text-lg rounded-full">
                    Time Travel Mode
                  </span>
                )}
              </h1>
              <p className="mt-2 text-gray-600 dark:text-gray-400">
                Economic statistics and geographic analysis
                {country.gameTimeDescription && (
                  <span className="ml-2 text-sm font-medium text-indigo-600 dark:text-indigo-400">
                    • {country.gameTimeDescription}
                  </span>
                )}
              </p>
            </div>
            {isTimeTravel && (
              <button
                onClick={handleTimeReset}
                className="inline-flex items-center px-4 py-2 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700"
              >
                <Clock className="h-4 w-4 mr-2" />
                Return to Present
              </button>
            )}
          </div>
        </div>

        {/* Main Content Layout */}
        <div className={`grid gap-8 transition-all duration-300 ${
          infoboxExpanded 
            ? 'lg:grid-cols-12' 
            : 'lg:grid-cols-3'
        }`}>
          {/* Main Content Area */}
          <div className={`${
            infoboxExpanded 
              ? 'lg:col-span-8' 
              : 'lg:col-span-2'
          } space-y-8`}>
            {/* Enhanced Time Travel Controls */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-8 border border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
                <Calendar className="h-5 w-5 mr-2" />
                Time Travel / Forecast Controls
                {isTimeTravel && (
                  <span className="ml-3 px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 text-xs rounded-full">
                    ACTIVE
                  </span>
                )}
              </h2>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Current View: {IxTime.formatIxTime(targetTime)}
                  </label>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => setTimeOffset(Math.max(timeOffset - 1, -10))}
                      className="p-2 text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 rounded-md border border-indigo-300 dark:border-indigo-700"
                    >
                      <Rewind className="h-4 w-4" />
                    </button>
                    <input
                      type="range"
                      min="-10"
                      max="10"
                      step="0.1"
                      value={timeOffset}
                      onChange={(e) => setTimeOffset(parseFloat(e.target.value))}
                      className="flex-1 h-2 bg-gray-200 dark:bg-gray-600 rounded-lg appearance-none cursor-pointer"
                    />
                    <button
                      onClick={() => setTimeOffset(0)}
                      className="p-2 text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 rounded-md border border-indigo-300 dark:border-indigo-700"
                      title="Return to present"
                    >
                      <Play className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => setTimeOffset(Math.min(timeOffset + 1, 10))}
                      className="p-2 text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 rounded-md border border-indigo-300 dark:border-indigo-700"
                    >
                      <FastForward className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="mt-1 text-xs text-gray-500 dark:text-gray-400 text-center">
                    {timeOffset === 0 ? "Present Time" : 
                     timeOffset < 0 ? `${Math.abs(timeOffset).toFixed(1)} years ago` : 
                     `${timeOffset.toFixed(1)} years from now`}
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Forecast: +{forecastYears.toFixed(1)} years
                  </label>
                  <div className="flex items-center space-x-2">
                    <input
                      type="range"
                      min="0"
                      max="10"
                      step="0.1"
                      value={forecastYears}
                      onChange={(e) => setForecastYears(parseFloat(e.target.value))}
                      className="flex-1 h-2 bg-gray-200 dark:bg-gray-600 rounded-lg appearance-none cursor-pointer"
                    />
                    <FastForward className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Forecasted Date
                  </label>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {IxTime.formatIxTime(forecastTime)}
                  </p>
                  {forecastData && forecastData.dataPoints.length > 0 && (
                    <div className="mt-2 text-xs text-green-600 dark:text-green-400">
                      Pop: {formatNumber(forecastData.dataPoints[forecastData.dataPoints.length - 1]?.population * 1000000, false)} <br/>
                      GDP p.c.: {formatNumber(forecastData.dataPoints[forecastData.dataPoints.length - 1]?.gdpPerCapita)}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Enhanced Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700">
                <div className="flex items-center">
                  <Users className="h-8 w-8 text-blue-500" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Population</p>
                    <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                      {formatNumber(country.currentPopulation, false)}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {country.populationTier} ({((country.populationGrowthRate ?? 0) * 100).toFixed(1)}% growth)
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700">
                <div className="flex items-center">
                  <TrendingUp className="h-8 w-8 text-green-500" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400">GDP per Capita</p>
                    <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                      {formatNumber(country.currentGdpPerCapita)}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {((country.adjustedGdpGrowth ?? 0) * 100).toFixed(1)}% growth
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700">
                <div className="flex items-center">
                  <Map className="h-8 w-8 text-yellow-500" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Land Area</p>
                    <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                      {formatArea(country.landArea)}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {country.landArea ? `${formatNumber(country.landArea / 2.58999, false, 0)} sq mi` : 'N/A'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700">
                <div className="flex items-center">
                  <Scaling className="h-8 w-8 text-purple-500" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Pop. Density</p>
                    <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                      {country.populationDensity ? `${country.populationDensity.toFixed(1)}/km²` : 'N/A'}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {efficiencyMetrics ? `${efficiencyMetrics.populationPerSqMi.toFixed(1)}/sq mi` : 'N/A'}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Enhanced Efficiency Metrics */}
            {efficiencyMetrics && (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-8 border border-gray-200 dark:border-gray-700">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
                  <Target className="h-5 w-5 mr-2" />
                  Economic & Geographic Efficiency Metrics
                  {isTimeTravel && (
                    <span className="ml-2 text-xs text-blue-600 dark:text-blue-400">
                      (at {IxTime.formatIxTime(targetTime)})
                    </span>
                  )}
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  <div className="text-center">
                    <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                      {formatNumber(efficiencyMetrics.landProductivity, true, 1)}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">GDP per km² (Millions)</div>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-bold text-green-600 dark:text-green-400">
                      {formatNumber(efficiencyMetrics.populationEfficiency, true, 0)}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">GDP per Capita per Density</div>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-bold text-purple-600 dark:text-purple-400">
                      {formatNumber(efficiencyMetrics.spatialGdpRatio, true, 0)}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">Spatial GDP Efficiency</div>
                  </div>
                </div>
              </div>
            )}

            {/* Chart Type Selector */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 mb-8 border border-gray-200 dark:border-gray-700">
              <div className="flex flex-wrap gap-2">
                {[
                  { key: 'density', label: 'Density Analysis', icon: Scaling },
                  { key: 'efficiency', label: 'Economic Efficiency', icon: Target },
                  { key: 'growth', label: 'Growth Trends', icon: TrendingUp },
                  { key: 'comparison', label: 'Global Comparison', icon: Globe }
                ].map(({ key, label, icon: Icon }) => (
                  <button
                    key={key}
                    onClick={() => setSelectedMetric(key as any)}
                    className={`flex items-center px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                      selectedMetric === key
                        ? 'bg-indigo-600 text-white'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                    }`}
                  >
                    <Icon className="h-4 w-4 mr-2" />
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Enhanced Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {selectedMetric === 'density' && (
                <>
                  <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 border border-gray-200 dark:border-gray-700">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                      Population & GDP Density Over Time
                      {isTimeTravel && <span className="text-sm text-blue-600 dark:text-blue-400 ml-2">(Historical View)</span>}
                    </h3>
                    <ResponsiveContainer width="100%" height={300}>
                      <ComposedChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke={axisAndGridColor} opacity={0.5} />
                        <XAxis dataKey="date" tick={{ fontSize: 10, fill: textColor }} angle={-45} textAnchor="end" height={70} stroke={axisAndGridColor} />
                        <YAxis yAxisId="density" tick={{ fontSize: 10, fill: textColor }} stroke={axisAndGridColor} />
                        <YAxis yAxisId="gdpDensity" orientation="right" tick={{ fontSize: 10, fill: textColor }} stroke={axisAndGridColor} />
                        <Tooltip contentStyle={tooltipStyle} />
                        <Legend />
                        <Bar yAxisId="density" dataKey="populationDensity" fill="#3B82F6" name="Pop. Density (/km²)" />
                        <Line yAxisId="gdpDensity" type="monotone" dataKey="gdpDensity" stroke="#10B981" strokeWidth={3} name="GDP Density (M$/km²)" />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 border border-gray-200 dark:border-gray-700">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                      Area Utilization Efficiency
                    </h3>
                    <ResponsiveContainer width="100%" height={300}>
                      <AreaChart data={chartData}>
                        <defs>
                          <linearGradient id="areaUtilization" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.8}/>
                            <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0.1}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke={axisAndGridColor} opacity={0.5} />
                        <XAxis dataKey="date" tick={{ fontSize: 10, fill: textColor }} stroke={axisAndGridColor} />
                        <YAxis tick={{ fontSize: 10, fill: textColor }} stroke={axisAndGridColor} />
                        <Tooltip contentStyle={tooltipStyle} />
                        <Area type="monotone" dataKey="areaUtilization" stroke="#8B5CF6" fillOpacity={1} fill="url(#areaUtilization)" name="GDP per km² (M$)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </>
              )}

              {selectedMetric === 'efficiency' && (
                <>
                  <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 border border-gray-200 dark:border-gray-700">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                      Economic Efficiency Over Time
                    </h3>
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke={axisAndGridColor} opacity={0.5} />
                        <XAxis dataKey="date" tick={{ fontSize: 10, fill: textColor }} stroke={axisAndGridColor} />
                        <YAxis tick={{ fontSize: 10, fill: textColor }} stroke={axisAndGridColor} />
                        <Tooltip contentStyle={tooltipStyle} />
                        <Legend />
                        <Line type="monotone" dataKey="economicEfficiency" stroke="#F59E0B" strokeWidth={3} name="Economic Efficiency" />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 border border-gray-200 dark:border-gray-700">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                      GDP vs Population Distribution
                    </h3>
                    <ResponsiveContainer width="100%" height={300}>
                      <ScatterChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke={axisAndGridColor} opacity={0.5} />
                        <XAxis dataKey="population" tick={{ fontSize: 10, fill: textColor }} stroke={axisAndGridColor} name="Population (M)" />
                        <YAxis dataKey="gdpPerCapita" tick={{ fontSize: 10, fill: textColor }} stroke={axisAndGridColor} name="GDP per Capita" />
                        <Tooltip contentStyle={tooltipStyle} />
                        <Scatter dataKey="gdpPerCapita" fill="#8B5CF6" />
                      </ScatterChart>
                    </ResponsiveContainer>
                  </div>
                </>
              )}

              {selectedMetric === 'growth' && (
                <>
                  <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 border border-gray-200 dark:border-gray-700">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                      Population Growth Over Time
                    </h3>
                    <ResponsiveContainer width="100%" height={300}>
                      <AreaChart data={chartData}>
                        <defs>
                          <linearGradient id="populationGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.8}/>
                            <stop offset="95%" stopColor="#3B82F6" stopOpacity={0.1}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke={axisAndGridColor} opacity={0.5} />
                        <XAxis dataKey="date" tick={{ fontSize: 10, fill: textColor }} stroke={axisAndGridColor} />
                        <YAxis tick={{ fontSize: 10, fill: textColor }} stroke={axisAndGridColor} />
                        <Tooltip contentStyle={tooltipStyle} />
                        <Area type="monotone" dataKey="population" stroke="#3B82F6" fillOpacity={1} fill="url(#populationGradient)" name="Population (M)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 border border-gray-200 dark:border-gray-700">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                      Total GDP Growth Over Time
                    </h3>
                    <ResponsiveContainer width="100%" height={300}>
                      <AreaChart data={chartData}>
                        <defs>
                          <linearGradient id="gdpGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#10B981" stopOpacity={0.8}/>
                            <stop offset="95%" stopColor="#10B981" stopOpacity={0.1}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke={axisAndGridColor} opacity={0.5} />
                        <XAxis dataKey="date" tick={{ fontSize: 10, fill: textColor }} stroke={axisAndGridColor} />
                        <YAxis tick={{ fontSize: 10, fill: textColor }} stroke={axisAndGridColor} />
                        <Tooltip contentStyle={tooltipStyle} />
                        <Area type="monotone" dataKey="totalGdp" stroke="#10B981" fillOpacity={1} fill="url(#gdpGradient)" name="Total GDP (B$)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </>
              )}

              {selectedMetric === 'comparison' && comparisonData.length > 0 && (
                <>
                  <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 border border-gray-200 dark:border-gray-700">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                      Global Population vs GDP per Capita
                      <span className="text-sm text-gray-500 dark:text-gray-400 ml-2">(All countries at present time)</span>
                    </h3>
                    <ResponsiveContainer width="100%" height={300}>
                      <ScatterChart data={comparisonData}>
                        <CartesianGrid strokeDasharray="3 3" stroke={axisAndGridColor} opacity={0.5} />
                        <XAxis dataKey="population" tick={{ fontSize: 10, fill: textColor }} stroke={axisAndGridColor} name="Population (M)" />
                        <YAxis dataKey="gdpPerCapita" tick={{ fontSize: 10, fill: textColor }} stroke={axisAndGridColor} name="GDP per Capita" />
                        <Tooltip 
                          contentStyle={tooltipStyle}
                          content={({ active, payload }) => {
                            if (active && payload && payload[0]) {
                              const data = payload[0].payload as ComparisonDataPoint;
                              return (
                                <div style={tooltipStyle}>
                                  <p className="font-semibold">{data.name}</p>
                                  <p>Population: {data.population.toFixed(1)}M</p>
                                  <p>GDP per Capita: {formatNumber(data.gdpPerCapita)}</p>
                                  <p>Economic Tier: {data.economicTier}</p>
                                  {data.isCurrentCountry && <p className="text-red-500 font-semibold">← This Country</p>}
                                </div>
                              );
                            }
                            return null;
                          }}
                        />
                        {comparisonData.map((entry, index) => (
                          <Scatter 
                            key={`scatter-${index}`}
                            data={[entry]}
                            fill={getScatterPointColor(entry)}
                          />
                        ))}
                      </ScatterChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 border border-gray-200 dark:border-gray-700">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                      Land Area vs Economic Output
                    </h3>
                    <ResponsiveContainer width="100%" height={300}>
                      <ScatterChart data={comparisonData}>
                        <CartesianGrid strokeDasharray="3 3" stroke={axisAndGridColor} opacity={0.5} />
                        <XAxis dataKey="landArea" tick={{ fontSize: 10, fill: textColor }} stroke={axisAndGridColor} name="Land Area (km²)" scale="log" domain={['dataMin', 'dataMax']} />
                        <YAxis dataKey="totalGdp" tick={{ fontSize: 10, fill: textColor }} stroke={axisAndGridColor} name="Total GDP (B$)" scale="log" domain={['dataMin', 'dataMax']} />
                        <Tooltip 
                          contentStyle={tooltipStyle}
                          content={({ active, payload }) => {
                            if (active && payload && payload[0]) {
                              const data = payload[0].payload as ComparisonDataPoint;
                              return (
                                <div style={tooltipStyle}>
                                  <p className="font-semibold">{data.name}</p>
                                  <p>Land Area: {formatArea(data.landArea)}</p>
                                  <p>Total GDP: {formatNumber(data.totalGdp * 1000000000)}</p>
                                  <p>GDP Density: {formatNumber(data.gdpDensity, true, 0)}/km²</p>
                                  {data.isCurrentCountry && <p className="text-red-500 font-semibold">← This Country</p>}
                                </div>
                              );
                            }
                            return null;
                          }}
                        />
                        {comparisonData.map((entry, index) => (
                          <Scatter 
                            key={`scatter-area-${index}`}
                            data={[entry]}
                            fill={getScatterPointColor(entry)}
                          />
                        ))}
                      </ScatterChart>
                    </ResponsiveContainer>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Sidebar - Country Infobox */}
          <div className={`${
            infoboxExpanded 
              ? 'lg:col-span-4' 
              : 'lg:col-span-1'
          } transition-all duration-300`}>
            <div className="sticky top-8">
              <CountryInfobox 
                countryName={country.name}
                onToggle={handleInfoboxToggle}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}