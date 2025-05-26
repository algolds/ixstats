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
} from "lucide-react";
import { useTheme } from "~/context/theme-context";

export default function CountryDetailPage() {
  const params = useParams();
  const router = useRouter();
  const countryId = params.id as string;
  const { theme } = useTheme();

  const [timeOffset, setTimeOffset] = useState(0);
  const [forecastYears, setForecastYears] = useState(1);

  const { data: country, isLoading } = api.countries.getById.useQuery({
    id: countryId,
  });

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
      enabled: !!country && forecastYears > 0 && !!countryId, // ensure countryId is defined
    }
  );

  const formatNumber = (num: number | null | undefined): string => {
    if (num == null) return '$0.00';
    if (num >= 1e12) return `$${(num / 1e12).toFixed(2)}T`;
    if (num >= 1e9) return `$${(num / 1e9).toFixed(2)}B`;
    if (num >= 1e6) return `$${(num / 1e6).toFixed(2)}M`;
    if (num >= 1e3) return `$${(num / 1e3).toFixed(2)}K`;
    return `$${num.toFixed(2)}`;
  };

  const formatPopulation = (num: number | null | undefined): string => {
    if (num == null) return '0';
    if (num >= 1e9) return `${(num / 1e9).toFixed(2)}B`;
    if (num >= 1e6) return `${(num / 1e6).toFixed(2)}M`;
    if (num >= 1e3) return `${(num / 1e3).toFixed(2)}K`;
    return num.toFixed(0);
  };

  const chartData = useMemo(() => {
    if (!country?.historicalData) return [];
    return country.historicalData
      .slice()
      .sort((a, b) => new Date(a.ixTimeTimestamp).getTime() - new Date(b.ixTimeTimestamp).getTime())
      .map((point) => ({
        date: IxTime.formatIxTime(new Date(point.ixTimeTimestamp).getTime()),
        population: point.population / 1000000,
        gdpPerCapita: point.gdpPerCapita,
        totalGdp: point.totalGdp / 1000000000,
      }));
  }, [country]);

  const tooltipStyle = {
    backgroundColor: theme === 'dark' ? 'rgba(31, 41, 55, 0.9)' : 'rgba(255, 255, 255, 0.9)',
    color: theme === 'dark' ? '#f3f4f6' : '#1f2937',
    borderRadius: '0.375rem',
    borderColor: theme === 'dark' ? '#4b5563' : '#e5e7eb',
    borderWidth: '1px',
    padding: '0.5rem 0.75rem',
  };
  
  const tooltipLabelStyle = {
    color: theme === 'dark' ? '#d1d5db' : '#374151',
    marginBottom: '0.25rem',
    fontWeight: '600',
  };
  
  const tooltipItemStyle = {
     color: theme === 'dark' ? '#9ca3af' : '#4b5563',
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-indigo-600 mx-auto"></div>
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
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
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
            Economic statistics and historical trends
          </p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-8 border border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
            <Calendar className="h-5 w-5 mr-2" />
            Time Travel / Forecast Controls
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Current View (Offset from Present): {IxTime.formatIxTime(targetTime)}
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
                  className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer"
                />
                <button
                  onClick={() => setTimeOffset(0)}
                  className="p-2 text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 rounded-md border border-indigo-300 dark:border-indigo-700"
                >
                  <Play className="h-4 w-4" />
                </button>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {timeOffset.toFixed(1)} years from present
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Forecast Years Ahead: +{forecastYears.toFixed(1)}
              </label>
              <div className="flex items-center space-x-2">
                 <input
                  type="range"
                  min="0"
                  max="5"
                  step="0.1"
                  value={forecastYears}
                  onChange={(e) => setForecastYears(parseFloat(e.target.value))}
                  className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer"
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
              {/* Corrected forecastData access */}
              {forecastData && (
                <div className="mt-2 text-xs text-green-600 dark:text-green-400">
                  Forecasted Pop: {formatPopulation(forecastData.population)} <br/>
                  Forecasted GDP p.c.: {formatNumber(forecastData.gdpPerCapita)}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Current Stats at targetTime (assuming country object reflects this if timeOffset is used for display) */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
           <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center">
              <Users className="h-8 w-8 text-blue-500" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Population</p>
                <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                  {formatPopulation(country.currentPopulation)}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {country.populationTier}
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
              <Globe className="h-8 w-8 text-purple-500" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Total GDP</p>
                <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                  {formatNumber(country.currentTotalGdp)}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center">
              <BarChart3 className="h-8 w-8 text-orange-500" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Economic Tier</p>
                <p className="text-xl font-semibold text-gray-900 dark:text-white">
                  {country.economicTier}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Pop Growth: {((country.populationGrowthRate ?? 0) * 100).toFixed(1)}%
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Population Chart */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 border border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Population Over Time (Millions)
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700 opacity-50" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: theme === 'dark' ? '#9ca3af' : '#6b7280' }} angle={-45} textAnchor="end" height={70} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 10, fill: theme === 'dark' ? '#9ca3af' : '#6b7280' }} />
                <Tooltip
                  contentStyle={tooltipStyle}
                  labelStyle={tooltipLabelStyle}
                  itemStyle={tooltipItemStyle}
                  formatter={(value: number) => [`${value.toFixed(2)}M`, "Population"]}
                />
                <Area type="monotone" dataKey="population" stroke="#3B82F6" fill="#3B82F6" fillOpacity={0.3} name="Population (Millions)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* GDP per Capita Chart */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 border border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              GDP per Capita Over Time
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700 opacity-50" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: theme === 'dark' ? '#9ca3af' : '#6b7280' }} angle={-45} textAnchor="end" height={70} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 10, fill: theme === 'dark' ? '#9ca3af' : '#6b7280' }} />
                <Tooltip
                  contentStyle={tooltipStyle}
                  labelStyle={tooltipLabelStyle}
                  itemStyle={tooltipItemStyle}
                  formatter={(value: number) => [`$${value.toLocaleString()}`, "GDP per Capita"]}
                />
                <Line type="monotone" dataKey="gdpPerCapita" stroke="#10B981" strokeWidth={2} dot={{ fill: "#10B981", r: 3 }} name="GDP per Capita" />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Total GDP Chart */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 border border-gray-200 dark:border-gray-700 lg:col-span-2">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Total GDP Over Time (Billions)
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700 opacity-50" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: theme === 'dark' ? '#9ca3af' : '#6b7280' }} angle={-45} textAnchor="end" height={70} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 10, fill: theme === 'dark' ? '#9ca3af' : '#6b7280' }} />
                <Tooltip
                  contentStyle={tooltipStyle}
                  labelStyle={tooltipLabelStyle}
                  itemStyle={tooltipItemStyle}
                  formatter={(value: number) => [`$${value.toFixed(2)}B`, "Total GDP"]}
                />
                <Area type="monotone" dataKey="totalGdp" stroke="#8B5CF6" fill="#8B5CF6" fillOpacity={0.3} name="Total GDP (Billions)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}