// src/app/countries/[id]/page.tsx
"use client";

import { useState, useEffect, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  ChevronRight,
  Globe,
  AlertTriangle,
  Loader,
  RefreshCw,
  Clock,
  Info
} from "lucide-react";
import { api } from "~/trpc/react";
import { IxTime } from "~/lib/ixtime";
import { CountryInfobox } from "../_components/CountryInfobox";
import {
  TimeControl,
  CountryAtGlance,
  TenYearForecast,
  ChartTypeSelector,
  type ChartType
} from "../_components/detail";

export default function CountryDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const countryId = params.id;

  // Component state
  const [currentIxTime, setCurrentIxTime] = useState<number>(IxTime.getCurrentIxTime());
  const [forecastYears, setForecastYears] = useState<number>(0);
  const [selectedChart, setSelectedChart] = useState<ChartType>('density');
  const [infoboxExpanded, setInfoboxExpanded] = useState(false);
  
  // Time context state
  const [timeContext, setTimeContext] = useState({
    currentIxTime: IxTime.getCurrentIxTime(),
    formattedCurrentTime: IxTime.formatIxTime(IxTime.getCurrentIxTime()),
    gameEpoch: IxTime.getInGameEpoch(),
    formattedGameEpoch: IxTime.formatIxTime(IxTime.getInGameEpoch()),
    yearsSinceGameStart: (IxTime.getCurrentIxTime() - IxTime.getInGameEpoch()) / (365 * 24 * 60 * 60 * 1000),
    currentGameYear: IxTime.getCurrentGameYear(),
    gameTimeDescription: `Year ${IxTime.getCurrentGameYear()}`,
    timeMultiplier: IxTime.getTimeMultiplier()
  });

  // Fetch country data at the selected time
  const { data: country, isLoading: isLoadingCountry, error: countryError, refetch } = 
    api.countries.getByIdAtTime.useQuery({
      id: countryId,
      timestamp: currentIxTime
    }, {
      enabled: !!countryId,
      refetchOnWindowFocus: false
    });

  // Fetch historical data for charts
  const { data: historicalData, isLoading: isLoadingHistorical } = 
    api.countries.getHistoricalAtTime.useQuery({
      id: countryId,
      startTime: IxTime.addYears(currentIxTime, -10),
      endTime: currentIxTime
    }, {
      enabled: !!countryId && !!country,
      refetchOnWindowFocus: false
    });

  // Fetch forecast data
  const { data: forecastData, isLoading: isLoadingForecast } = 
    api.countries.getForecast.useQuery({
      id: countryId,
      startTime: currentIxTime,
      endTime: IxTime.addYears(currentIxTime, forecastYears)
    }, {
      enabled: !!countryId && forecastYears > 0,
      refetchOnWindowFocus: false
    });

  // Update time context when currentIxTime changes
  useEffect(() => {
    setTimeContext({
      currentIxTime,
      formattedCurrentTime: IxTime.formatIxTime(currentIxTime),
      gameEpoch: IxTime.getInGameEpoch(),
      formattedGameEpoch: IxTime.formatIxTime(IxTime.getInGameEpoch()),
      yearsSinceGameStart: (currentIxTime - IxTime.getInGameEpoch()) / (365 * 24 * 60 * 60 * 1000),
      currentGameYear: IxTime.getCurrentGameYear(currentIxTime), // CHANGED
      gameTimeDescription: `Year ${IxTime.getCurrentGameYear(currentIxTime)}`, // CHANGED
      timeMultiplier: IxTime.getTimeMultiplier()
    });
  }, [currentIxTime]);

  // Transform data to match component props
  const transformedHistoricalData = useMemo(() => {
    return historicalData?.map(point => ({
      ixTimeTimestamp: point.ixTimeTimestamp,
      population: point.population,
      gdpPerCapita: point.gdpPerCapita,
      totalGdp: point.totalGdp,
      populationDensity: point.populationDensity === null ? undefined : point.populationDensity,
      gdpDensity: point.gdpDensity === null ? undefined : point.gdpDensity
    })) || [];
  }, [historicalData]);

  const transformedCountry = useMemo(() => {
    if (!country?.calculatedStats) return null; // Use calculatedStats from getByIdAtTime
    const stats = country.calculatedStats;
    return {
      id: country.id,
      name: country.name,
      currentPopulation: stats.currentPopulation,
      currentGdpPerCapita: stats.currentGdpPerCapita,
      currentTotalGdp: stats.currentTotalGdp,
      populationGrowthRate: stats.populationGrowthRate,
      adjustedGdpGrowth: stats.adjustedGdpGrowth,
      economicTier: stats.economicTier,
      populationTier: stats.populationTier,
      landArea: stats.landArea === null ? undefined : stats.landArea,
      populationDensity: stats.populationDensity,
      gdpDensity: stats.gdpDensity,
      lastCalculated: stats.lastCalculated // This will be a number (timestamp)
    };
  }, [country]);

  const transformedForecastData = useMemo(() => {
    return forecastData?.dataPoints?.map(point => ({
      year: IxTime.getCurrentGameYear(point.ixTime), // Use getCurrentGameYear
      population: point.population,
      gdpPerCapita: point.gdpPerCapita,
      totalGdp: point.totalGdp,
      populationDensity: point.populationDensity === null ? undefined : point.populationDensity,
      gdpDensity: point.gdpDensity === null ? undefined : point.gdpDensity
    })) || [];
  }, [forecastData]);

  // Determine what data is available for charts
  const availableData = useMemo(() => ({
    hasLandArea: !!(transformedCountry?.landArea),
    hasHistoricalData: !!(transformedHistoricalData?.length),
    hasComparison: true, // Assuming comparison data is always available
    hasDensityData: !!(transformedCountry?.populationDensity && transformedCountry?.gdpDensity)
  }), [transformedCountry, transformedHistoricalData]);

  // Event handlers
  const handleTimeChange = (newIxTime: number) => {
    setCurrentIxTime(newIxTime);
  };

  const handleForecastChange = (years: number) => {
    setForecastYears(years);
  };

  const handleChartChange = (chartType: ChartType) => {
    setSelectedChart(chartType);
  };

  const handleInfoboxToggle = (expanded: boolean) => {
    setInfoboxExpanded(expanded);
  };

  const handleRefresh = () => {
    refetch();
  };

  const isTimeTravel = currentIxTime !== IxTime.getCurrentIxTime();
  const isLoading = isLoadingCountry || isLoadingHistorical;

  if (isLoading && !transformedCountry) { // Show loading only if no data yet
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <Loader className="h-12 w-12 animate-spin text-indigo-600 dark:text-indigo-500 mx-auto mb-4" />
          <h3 className="text-xl font-medium text-gray-900 dark:text-white">
            {isTimeTravel ? 'Calculating time travel data...' : 'Loading country data...'}
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
            This may take a few moments
          </p>
        </div>
      </div>
    );
  }

  if (countryError || !country || !transformedCountry) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center p-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/40 rounded-lg max-w-md">
          <AlertTriangle className="h-16 w-16 mx-auto text-red-500 dark:text-red-400 mb-4" />
          <h3 className="text-xl font-medium text-gray-900 dark:text-white mb-2">
            Error Loading Country
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            {countryError?.message || "Country not found or could not be loaded."}
          </p>
          <div className="flex gap-4 justify-center">
            <button
              onClick={() => router.push('/countries')}
              className="px-4 py-2 bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700 flex items-center"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Countries
            </button>
            <button
              onClick={handleRefresh}
              className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 flex items-center"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Breadcrumb Navigation */}
        <nav className="mb-6">
          <ol className="flex items-center space-x-2 text-sm">
            <li>
              <Link 
                href="/countries" 
                className="text-gray-500 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors flex items-center"
              >
                <ArrowLeft className="h-3.5 w-3.5 mr-1" />
                Countries
              </Link>
            </li>
            <li className="flex items-center">
              <ChevronRight className="h-4 w-4 text-gray-500 dark:text-gray-400" />
              <span className="ml-2 font-medium text-gray-900 dark:text-white">
                {country.name}
              </span>
            </li>
          </ol>
        </nav>

        {/* Page Header */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center">
              <h1 className="text-4xl font-bold text-gray-900 dark:text-white">
                {country.name}
              </h1>
              {isTimeTravel && (
                <span className="ml-4 px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 text-sm rounded-full border border-blue-200 dark:border-blue-800/40">
                  <Clock className="h-4 w-4 inline mr-1" />
                  Time Travel Active
                </span>
              )}
            </div>
            <p className="mt-2 text-lg text-gray-600 dark:text-gray-400">
              Economic Analysis & Forecasting Dashboard
            </p>
            <div className="mt-1 flex items-center text-sm text-gray-500 dark:text-gray-400">
              <Info className="h-4 w-4 mr-1" />
              <span>
                Viewing: {timeContext.formattedCurrentTime} • 
                {timeContext.gameTimeDescription} • 
                {isTimeTravel ? 'Historical/Future View' : 'Real-time Data'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleRefresh}
              disabled={isLoading}
              className="p-2 rounded-md bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
              title="Refresh data"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
            
            {isTimeTravel && (
              <button
                onClick={() => setCurrentIxTime(IxTime.getCurrentIxTime())}
                className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 flex items-center"
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
          : 'lg:grid-cols-4'
        }`}>
          {/* Main Content Area */}
          <div className={`${
            infoboxExpanded 
              ? 'lg:col-span-8' 
              : 'lg:col-span-3'
          } space-y-8`}>
            
            {/* Time Control Component */}
            <TimeControl
              onTimeChange={handleTimeChange}
              onForecastChange={handleForecastChange}
              currentTime={timeContext.currentIxTime}
              gameEpoch={timeContext.gameEpoch}
              isLoading={isLoading}
            />

            {/* Country at a Glance */}
            <CountryAtGlance
              country={{
                ...transformedCountry,
                populationDensity: transformedCountry.populationDensity ?? undefined,
                gdpDensity: transformedCountry.gdpDensity ?? undefined
              }}
              historicalData={transformedHistoricalData}
              targetTime={currentIxTime}
              forecastYears={forecastYears}
              isLoading={isLoadingHistorical}
            />

            {/* Chart Type Selector */}
            <ChartTypeSelector
              selectedChart={selectedChart}
              onChartChange={handleChartChange}
              availableData={availableData}
              isCompact={false}
            />

            {/* Additional Charts Section Based on Selected Chart Type */}
            <div className="space-y-8">
              {selectedChart === 'density' && (
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 border border-gray-200 dark:border-gray-700">
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
                    <Globe className="h-5 w-5 mr-2" />
                    Density Analysis
                  </h2>
                  {availableData.hasLandArea ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                        <span className="block text-sm text-gray-500 dark:text-gray-400 mb-1">Population Density</span>
                        <span className="text-xl font-bold text-gray-900 dark:text-white">
                          {transformedCountry.populationDensity ? `${transformedCountry.populationDensity.toFixed(1)} /km²` : 'N/A'}
                        </span>
                      </div>
                      <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                        <span className="block text-sm text-gray-500 dark:text-gray-400 mb-1">GDP Density</span>
                        <span className="text-xl font-bold text-gray-900 dark:text-white">
                          {transformedCountry.gdpDensity ? `$${(transformedCountry.gdpDensity / 1000000).toFixed(1)}M /km²` : 'N/A'}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <AlertTriangle className="h-12 w-12 text-yellow-500 dark:text-yellow-400 mx-auto mb-4" />
                      <p className="text-gray-600 dark:text-gray-400">
                        Land area data required for density analysis
                      </p>
                    </div>
                  )}
                </div>
              )}

              {selectedChart === 'efficiency' && (
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 border border-gray-200 dark:border-gray-700">
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
                    <Globe className="h-5 w-5 mr-2" />
                    Economic Efficiency Analysis
                  </h2>
                  {availableData.hasLandArea ? (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="text-center p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                        <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                          {transformedCountry.landArea && transformedCountry.landArea > 0 ? 
                            ((transformedCountry.currentTotalGdp / transformedCountry.landArea) / 1000000).toFixed(1) : 
                            'N/A'
                          }
                        </div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">GDP per km² (M$)</div>
                      </div>
                      <div className="text-center p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                        <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                          {transformedCountry.populationDensity && transformedCountry.populationDensity > 0 ? 
                            (transformedCountry.currentGdpPerCapita / transformedCountry.populationDensity).toFixed(0) : 
                            'N/A'
                          }
                        </div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">Efficiency Ratio</div>
                      </div>
                      <div className="text-center p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                        <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
                          {transformedCountry.landArea && transformedCountry.landArea > 0 ? 
                            Math.sqrt(transformedCountry.currentTotalGdp / transformedCountry.landArea / 1000000).toFixed(1) : 
                            'N/A'
                          }
                        </div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">Spatial Index</div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <AlertTriangle className="h-12 w-12 text-yellow-500 dark:text-yellow-400 mx-auto mb-4" />
                      <p className="text-gray-600 dark:text-gray-400">
                        Land area data required for efficiency analysis
                      </p>
                    </div>
                  )}
                </div>
              )}

              {selectedChart === 'growth' && (
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 border border-gray-200 dark:border-gray-700">
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
                    <Globe className="h-5 w-5 mr-2" />
                    Growth Trends Analysis
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                      <span className="block text-sm text-gray-500 dark:text-gray-400 mb-1">Population Growth Rate</span>
                      <span className="text-xl font-bold text-green-600 dark:text-green-400">
                        {(transformedCountry.populationGrowthRate * 100).toFixed(2)}%
                      </span>
                    </div>
                    <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                      <span className="block text-sm text-gray-500 dark:text-gray-400 mb-1">GDP Growth Rate</span>
                      <span className="text-xl font-bold text-blue-600 dark:text-blue-400">
                        {(transformedCountry.adjustedGdpGrowth * 100).toFixed(2)}%
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {selectedChart === 'comparison' && (
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 border border-gray-200 dark:border-gray-700">
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
                    <Globe className="h-5 w-5 mr-2" />
                    Global Comparison
                  </h2>
                  <div className="text-center py-8">
                    <Info className="h-12 w-12 text-blue-600 dark:text-blue-400 mx-auto mb-4" />
                    <p className="text-gray-600 dark:text-gray-400">
                      Global comparison charts will be rendered here based on all countries data
                    </p>
                  </div>
                </div>
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
              
              {/* Quick Stats Panel */}
              <div className="mt-6 bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 border border-gray-200 dark:border-gray-700">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
                  Quick Stats
                </h3>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-xs text-gray-500 dark:text-gray-400">Economic Tier</span>
                    <span className="text-xs font-medium text-gray-900 dark:text-white">
                      {transformedCountry.economicTier}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-xs text-gray-500 dark:text-gray-400">Population Tier</span>
                    <span className="text-xs font-medium text-gray-900 dark:text-white">
                      {transformedCountry.populationTier}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-xs text-gray-500 dark:text-gray-400">Last Updated</span>
                    <span className="text-xs font-medium text-gray-900 dark:text-white">
                      {new Date(transformedCountry.lastCalculated).toLocaleDateString()}
                    </span>
                  </div>
                  {transformedCountry.landArea && (
                    <div className="flex justify-between">
                      <span className="text-xs text-gray-500 dark:text-gray-400">Land Area</span>
                      <span className="text-xs font-medium text-gray-900 dark:text-white">
                        {(transformedCountry.landArea / 1000).toFixed(0)}K km²
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Time Context Panel */}
              <div className="mt-6 bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 border border-gray-200 dark:border-gray-700">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center">
                  <Clock className="h-4 w-4 mr-1" />
                  Time Context
                </h3>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-gray-500 dark:text-gray-400">Current View</span>
                    <span className="text-gray-900 dark:text-white font-medium">
                      {timeContext.gameTimeDescription}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500 dark:text-gray-400">Time Multiplier</span>
                    <span className="text-gray-900 dark:text-white font-medium">
                      {timeContext.timeMultiplier}x
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500 dark:text-gray-400">Years Since Start</span>
                    <span className="text-gray-900 dark:text-white font-medium">
                      {timeContext.yearsSinceGameStart.toFixed(1)}
                    </span>
                  </div>
                  {forecastYears > 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-500 dark:text-gray-400">Forecast Period</span>
                      <span className="text-green-600 dark:text-green-400 font-medium">
                        +{forecastYears.toFixed(1)} years
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}