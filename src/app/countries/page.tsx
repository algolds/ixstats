// src/app/countries/page.tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { api } from "~/trpc/react";
import { Search, Globe, TrendingUp, Users, ArrowRight } from "lucide-react";

export default function CountriesPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const { data: countries, isLoading } = api.countries.getAll.useQuery();

  const filteredCountries = countries?.filter((country) =>
    country.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatNumber = (num: number) => {
    if (num >= 1e12) return `$${(num / 1e12).toFixed(2)}T`;
    if (num >= 1e9) return `$${(num / 1e9).toFixed(2)}B`;
    if (num >= 1e6) return `$${(num / 1e6).toFixed(2)}M`;
    if (num >= 1e3) return `$${(num / 1e3).toFixed(2)}K`;
    return `$${num.toFixed(2)}`;
  };

  const formatPopulation = (num: number) => {
    if (num >= 1e9) return `${(num / 1e9).toFixed(2)}B`;
    if (num >= 1e6) return `${(num / 1e6).toFixed(2)}M`;
    if (num >= 1e3) return `${(num / 1e3).toFixed(2)}K`;
    return num.toFixed(0);
  };

  const getTierColor = (tier: string) => {
    switch (tier) {
      case "Advanced": return "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200";
      case "Developed": return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
      case "Emerging": return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
      default: return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200";
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading countries...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Countries</h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Detailed economic statistics for all Ixnay nations
          </p>
        </div>

        {/* Search */}
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
            <input
              type="text"
              placeholder="Search countries..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>
        </div>

        {/* Countries Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredCountries?.map((country) => (
            <Link
              key={country.id}
              href={`/countries/${country.id}`}
              className="bg-white dark:bg-gray-800 rounded-lg shadow-md hover:shadow-lg transition-shadow border border-gray-200 dark:border-gray-700 group"
            >
              <div className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400">
                    {country.name}
                  </h3>
                  <ArrowRight className="h-4 w-4 text-gray-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors" />
                </div>

                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-500 dark:text-gray-400 flex items-center">
                      <Users className="h-4 w-4 mr-1" />
                      Population
                    </span>
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      {formatPopulation(country.currentPopulation)}
                    </span>
                  </div>

                  <div className="flex justify-between">
                    <span className="text-sm text-gray-500 dark:text-gray-400 flex items-center">
                      <TrendingUp className="h-4 w-4 mr-1" />
                      GDP per Capita
                    </span>
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      {formatNumber(country.currentGdpPerCapita)}
                    </span>
                  </div>

                  <div className="flex justify-between">
                    <span className="text-sm text-gray-500 dark:text-gray-400 flex items-center">
                      <Globe className="h-4 w-4 mr-1" />
                      Total GDP
                    </span>
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      {formatNumber(country.currentTotalGdp)}
                    </span>
                  </div>

                  <div className="flex justify-between items-center pt-2">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getTierColor(
                        country.economicTier
                      )}`}
                    >
                      {country.economicTier}
                    </span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {country.populationTier}
                    </span>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>

        {filteredCountries?.length === 0 && (
          <div className="text-center py-12">
            <Globe className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">No countries found</h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Try adjusting your search terms.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

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

export default function CountryDetailPage() {
  const params = useParams();
  const router = useRouter();
  const countryId = params.id as string;

  const [timeOffset, setTimeOffset] = useState(0); // Years offset from current time
  const [forecastYears, setForecastYears] = useState(1); // Years to forecast ahead

  const { data: country, isLoading } = api.countries.getById.useQuery({
    id: countryId,
  });

  const currentIxTime = IxTime.getCurrentIxTime();
  const targetTime = useMemo(() => {
    return IxTime.addYears(currentIxTime, timeOffset);
  }, [currentIxTime, timeOffset]);

  // Calculate forecasted stats
  const { data: forecastData } = api.countries.updateStats.useMutation(
    {
      countryId,
      targetTime: IxTime.addYears(targetTime, forecastYears),
    },
    {
      enabled: !!country && forecastYears > 0,
    }
  );

  const formatNumber = (num: number) => {
    if (num >= 1e12) return `$${(num / 1e12).toFixed(2)}T`;
    if (num >= 1e9) return `$${(num / 1e9).toFixed(2)}B`;
    if (num >= 1e6) return `$${(num / 1e6).toFixed(2)}M`;
    if (num >= 1e3) return `$${(num / 1e3).toFixed(2)}K`;
    return `$${num.toFixed(2)}`;
  };

  const formatPopulation = (num: number) => {
    if (num >= 1e9) return `${(num / 1e9).toFixed(2)}B`;
    if (num >= 1e6) return `${(num / 1e6).toFixed(2)}M`;
    if (num >= 1e3) return `${(num / 1e3).toFixed(2)}K`;
    return num.toFixed(0);
  };

  // Prepare chart data
  const chartData = useMemo(() => {
    if (!country?.historicalData) return [];

    return country.historicalData
      .slice()
      .reverse()
      .map((point) => ({
        date: IxTime.formatIxTime(point.ixTimeTimestamp.getTime()),
        population: point.population / 1000000, // Convert to millions
        gdpPerCapita: point.gdpPerCapita,
        totalGdp: point.totalGdp / 1000000000, // Convert to billions
      }));
  }, [country]);

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
        {/* Header */}
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

        {/* Time Travel Controls */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-8 border border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
            <Calendar className="h-5 w-5 mr-2" />
            Time Travel Controls
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Current View: {IxTime.formatIxTime(targetTime)}
              </label>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setTimeOffset(timeOffset - 1)}
                  className="p-2 text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300"
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
                  className="flex-1"
                />
                <button
                  onClick={() => setTimeOffset(0)}
                  className="p-2 text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300"
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
                Forecast Years Ahead
              </label>
              <div className="flex items-center space-x-2">
                <input
                  type="range"
                  min="0"
                  max="5"
                  step="0.1"
                  value={forecastYears}
                  onChange={(e) => setForecastYears(parseFloat(e.target.value))}
                  className="flex-1"
                />
                <FastForward className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                +{forecastYears.toFixed(1)} years
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Forecast Date
              </label>
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                {IxTime.formatIxTime(IxTime.addYears(targetTime, forecastYears))}
              </p>
            </div>
          </div>
        </div>

        {/* Current Stats */}
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
                  {((country.adjustedGdpGrowth) * 100).toFixed(1)}% growth
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
                  Pop Growth: {(country.populationGrowthRate * 100).toFixed(1)}%
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
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 12 }}
                  angle={-45}
                  textAnchor="end"
                  height={80}
                />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip
                  labelFormatter={(value) => `Date: ${value}`}
                  formatter={(value: any) => [`${value.toFixed(2)}M`, "Population"]}
                />
                <Area
                  type="monotone"
                  dataKey="population"
                  stroke="#3B82F6"
                  fill="#3B82F6"
                  fillOpacity={0.3}
                />
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
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 12 }}
                  angle={-45}
                  textAnchor="end"
                  height={80}
                />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip
                  labelFormatter={(value) => `Date: ${value}`}
                  formatter={(value: any) => [`$${value.toLocaleString()}`, "GDP per Capita"]}
                />
                <Line
                  type="monotone"
                  dataKey="gdpPerCapita"
                  stroke="#10B981"
                  strokeWidth={2}
                  dot={{ fill: "#10B981", r: 4 }}
                />
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
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 12 }}
                  angle={-45}
                  textAnchor="end"
                  height={80}
                />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip
                  labelFormatter={(value) => `Date: ${value}`}
                  formatter={(value: any) => [`$${value.toFixed(2)}B`, "Total GDP"]}
                />
                <Area
                  type="monotone"
                  dataKey="totalGdp"
                  stroke="#8B5CF6"
                  fill="#8B5CF6"
                  fillOpacity={0.3}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}