// src/app/countries/[id]/page.tsx
"use client";

import { useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "~/trpc/react";
import { IxTime } from "~/lib/ixtime";
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
  Layers
} from "lucide-react";
import { useTheme } from "~/context/theme-context";

// Define proper types for comparison data
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

  const [timeOffset, setTimeOffset] = useState(0);
  const [forecastYears, setForecastYears] = useState(1);
  const [selectedMetric, setSelectedMetric] = useState<'density' | 'efficiency' | 'growth' | 'comparison'>('density');

  const { data: country, isLoading } = api.countries.getById.useQuery({
    id: countryId,
  });

  const { data: allCountries } = api.countries.getAll.useQuery();

  const currentIxTime = IxTime.getCurrentIxTime();
  const targetTime = useMemo(() => {
    return IxTime.addYears(currentIxTime, timeOffset);
  }, [currentIxTime, timeOffset]);

  const { data: forecastData } = api.countries.getForecast.useQuery(
    {
      countryId,
      targetTime: IxTime.addYears(targetTime, forecastYears),
    },
    {
      enabled: !!country && forecastYears > 0 && !!countryId,
    }
  );

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

  const chartData = useMemo(() => {
    if (!country?.historicalData) return [];
    return country.historicalData
      .slice()
      .sort((a, b) => new Date(a.ixTimeTimestamp).getTime() - new Date(b.ixTimeTimestamp).getTime())
      .map((point) => ({
        date: IxTime.formatIxTime(new Date(point.ixTimeTimestamp).getTime()),
        population: point.population / 1000000, // In millions
        gdpPerCapita: point.gdpPerCapita,
        totalGdp: point.totalGdp / 1000000000, // In billions
        populationDensity: point.populationDensity,
        gdpDensity: point.gdpDensity ? point.gdpDensity / 1000000 : 0, // In millions per km²
        economicEfficiency: point.gdpPerCapita / (point.populationDensity || 1), // GDP per capita per density unit
        areaUtilization: point.totalGdp / ((country.landArea || 1) * 1000000), // GDP per km² in millions
      }));
  }, [country]);

  // Comparative data for scatter plots
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
      economicDensity: country.currentTotalGdp / country.landArea, // GDP per km²
      populationEfficiency: country.currentGdpPerCapita / (country.populationDensity || 1),
      landProductivity: country.currentTotalGdp / country.landArea / 1000000, // GDP in millions per km²
      spatialGdpRatio: country.currentGdpPerCapita / Math.sqrt(country.landArea), // Spatial GDP efficiency
      populationPerSqMi,
      gdpPerSqMi,
      compactness: Math.sqrt(country.landArea) / (country.currentPopulation / 1000000), // Inverse measure of how "concentrated" the country is
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

  // Helper function to get color for scatter plot points
  const getScatterPointColor = (dataPoint: ComparisonDataPoint): string => {
    if (dataPoint.isCurrentCountry) return "#EF4444"; // Red for current country
    return TIER_COLORS[dataPoint.economicTier] || "#6B7280"; // Tier color or gray fallback
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-indigo-600 dark:border-indigo-500 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading country data...</p>
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
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{country.name}</h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Economic statistics and geographic analysis
          </p>
        </div>

        {/* Time Travel Controls */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-8 border border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
            <Calendar className="h-5 w-5 mr-2" />
            Time Travel / Forecast Controls
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Current View: {IxTime.formatIxTime(targetTime)}
              </label>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setTimeOffset(timeOffset - 1)}
                  className="p-2 text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 rounded-md border border-indigo-300 dark:border-indigo-700"
                >
                  <Rewind className="h-4 w-4" />
                </button>
                <input
                  type="range"
                  min="-10"
                  max="0"
                  step="0.1"
                  value={timeOffset}
                  onChange={(e) => setTimeOffset(parseFloat(e.target.value))}
                  className="flex-1 h-2 bg-gray-200 dark:bg-gray-600 rounded-lg appearance-none cursor-pointer"
                />
                <button
                  onClick={() => setTimeOffset(0)}
                  className="p-2 text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 rounded-md border border-indigo-300 dark:border-indigo-700"
                >
                  <Play className="h-4 w-4" />
                </button>
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
                  max="5"
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
                {IxTime.formatIxTime(IxTime.addYears(targetTime, forecastYears))}
              </p>
              {forecastData && (
                <div className="mt-2 text-xs text-green-600 dark:text-green-400">
                  Pop: {formatNumber(forecastData.population, false)} <br/>
                  GDP p.c.: {formatNumber(forecastData.gdpPerCapita)}
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
    </div>
  );
}