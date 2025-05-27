// src/app/countries/[id]/page.tsx
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

 const formatNumber = (num: number | null | undefined, isCurrency = true, precision = 2): string => {
    if (num == null) return isCurrency ? '$0.00' : '0';
    const prefix = isCurrency ? '$' : '';
    if (Math.abs(num) >= 1e12) return `${prefix}${(num / 1e12).toFixed(precision)}T`;
    if (Math.abs(num) >= 1e9) return `${prefix}${(num / 1e9).toFixed(precision)}B`;
    if (Math.abs(num) >= 1e6) return `${prefix}${(num / 1e6).toFixed(precision)}M`;
    if (Math.abs(num) >= 1e3) return `${prefix}${(num / 1e3).toFixed(precision)}K`;
    return `${prefix}${num.toFixed(isCurrency ? precision : 0)}`;
};


  const chartData = useMemo(() => {
    if (!country?.historicalData) return [];
    return country.historicalData
      .slice()
      // Ensure chronological order for charts
      .sort((a, b) => new Date(a.ixTimeTimestamp).getTime() - new Date(b.ixTimeTimestamp).getTime())
      .map((point) => ({
        date: IxTime.formatIxTime(new Date(point.ixTimeTimestamp).getTime()), // Keep simple date for X-axis
        population: point.population / 1000000, // In millions
        gdpPerCapita: point.gdpPerCapita,
        totalGdp: point.totalGdp / 1000000000, // In billions
        populationDensity: point.populationDensity,
        gdpDensity: point.gdpDensity,
      }));
  }, [country]);

  const axisAndGridColor = theme === 'dark' ? '#4A5568' : '#CBD5E0'; // gray-600 for dark, gray-400 for light
  const textColor = theme === 'dark' ? '#E2E8F0' : '#2D3748'; // gray-200 for dark, gray-800 for light

  const tooltipStyle = {
    backgroundColor: theme === 'dark' ? 'rgba(31, 41, 55, 0.9)' : 'rgba(255, 255, 255, 0.9)', // gray-800 with opacity or white
    color: textColor,
    borderRadius: '0.375rem', // rounded-md
    borderColor: axisAndGridColor,
    borderWidth: '1px',
    padding: '0.5rem 0.75rem',
  };
  
  const tooltipLabelStyle = {
    color: textColor, // Adjusted for better contrast
    marginBottom: '0.25rem',
    fontWeight: '600',
  };
  
  const tooltipItemStyle = {
     color: theme === 'dark' ? '#A0AEC0' : '#4A5568', // gray-400 for dark, gray-600 for light
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
                  className="flex-1 h-2 bg-gray-200 dark:bg-gray-600 rounded-lg appearance-none cursor-pointer"
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

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
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
              <DollarSign className="h-8 w-8 text-purple-500" />
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
                <Map className="h-8 w-8 text-yellow-500" />
                <div className="ml-4">
                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Land Area</p>
                    <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                        {country.landArea ? formatNumber(country.landArea, false, 0) + ' km²' : 'N/A'}
                    </p>
                </div>
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center">
                <Scaling className="h-8 w-8 text-teal-500" />
                <div className="ml-4">
                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Population Density</p>
                    <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                        {country.populationDensity ? country.populationDensity.toFixed(2) + ' /km²' : 'N/A'}
                    </p>
                </div>
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center">
                <BarChart3 className="h-8 w-8 text-orange-500" />
                <div className="ml-4">
                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400">GDP Density</p>
                    <p className="text-xl font-semibold text-gray-900 dark:text-white">
                        {country.gdpDensity ? formatNumber(country.gdpDensity) + ' /km²' : 'N/A'}
                    </p>
                     <p className="text-xs text-gray-500 dark:text-gray-400">
                        Tier: {country.economicTier}
                    </p>
                </div>
            </div>
          </div>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {[
            { title: "Population Over Time (Millions)", dataKey: "population", color: "#3B82F6", unit: "M" },
            { title: "GDP per Capita Over Time", dataKey: "gdpPerCapita", color: "#10B981", unit: "$" },
            { title: "Total GDP Over Time (Billions)", dataKey: "totalGdp", color: "#8B5CF6", unit: "B", colSpan: "lg:col-span-2" },
            { title: "Population Density Over Time (/km²)", dataKey: "populationDensity", color: "#06B6D4", unit: "/km²" },
            { title: "GDP Density Over Time ($/km²)", dataKey: "gdpDensity", color: "#F59E0B", unit: "$/km²" },
          ].map(chart => (
            <div key={chart.title} className={`bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 border border-gray-200 dark:border-gray-700 ${chart.colSpan || ''}`}>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                {chart.title}
              </h3>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id={`color${chart.dataKey}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={chart.color} stopOpacity={0.8}/>
                      <stop offset="95%" stopColor={chart.color} stopOpacity={0.1}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={axisAndGridColor} opacity={0.5} />
                  <XAxis 
                    dataKey="date" 
                    tick={{ fontSize: 10, fill: textColor }} 
                    angle={-45} 
                    textAnchor="end" 
                    height={70} 
                    stroke={axisAndGridColor}
                    interval="preserveStartEnd" 
                  />
                  <YAxis 
                    tick={{ fontSize: 10, fill: textColor }} 
                    stroke={axisAndGridColor}
                    tickFormatter={(value) => chart.unit === "M" || chart.unit === "B" ? `${value}` : formatNumber(value, chart.unit === "$")} 
                  />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    labelStyle={tooltipLabelStyle}
                    itemStyle={tooltipItemStyle}
                    formatter={(value: number, name: string) => {
                        const formattedName = name.replace(" (Millions)", "M").replace(" (Billions)", "B");
                        if (chart.unit === "$") return [formatNumber(value), formattedName];
                        if (chart.unit === "M" || chart.unit === "B") return [`${value.toFixed(2)}${chart.unit}`, formattedName];
                        return [`${value.toFixed(2)}${chart.unit || ''}`, formattedName];
                    }}
                  />
                  <Legend wrapperStyle={{ color: textColor, paddingTop: '10px' }} />
                  <Area 
                    type="monotone" 
                    dataKey={chart.dataKey} 
                    stroke={chart.color}
                    fillOpacity={1} 
                    fill={`url(#color${chart.dataKey})`}
                    name={`${chart.title.split(" Over Time")[0]}${chart.unit ? ` (${chart.unit})` : ''}`}
                    strokeWidth={2}
                    dot={{ fill: chart.color, r: 2, strokeWidth: 0 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}