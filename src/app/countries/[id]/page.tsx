// src/app/countries/[id]/page.tsx
"use client";

import { useState, useEffect, useMemo, Suspense } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  ChevronRight,
  Globe,
  AlertTriangle,
  Loader2,
  RefreshCw,
  Clock,
  Info,
  Settings2,
  Flag,
  ExternalLink
} from "lucide-react";
import { api } from "~/trpc/react";
import { IxTime } from "~/lib/ixtime";
import { ixnayWiki } from "~/lib/mediawiki-service";

import { Button } from "~/components/ui/button";
import { Skeleton } from "~/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "~/components/ui/breadcrumb";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription
} from "~/components/ui/card";

import { CountryInfobox } from "../_components/CountryInfobox";
import { CountryAtGlance } from "../_components/detail/CountryAtGlance";
import { IxStatsCharts, type ChartType, type TimeRange } from "../_components/charts/IxStatsCharts";
import {
  TimeControl,
  ChartTypeSelector,
  TenYearForecast,
} from "../_components/detail";
import type { ForecastDataPoint as TenYearForecastDataPoint } from "../_components/detail/TenYearForecast";
import { Badge } from "~/components/ui/badge";

// Define a more specific type for the data used in this page
export interface CountryDetailData {
  id: string;
  name: string;
  continent: string | null;
  region: string | null;
  governmentType?: string | null;
  religion?: string | null;
  leader?: string | null;
  areaSqMi?: number | null;
  baselinePopulation: number;
  baselineGdpPerCapita: number;
  maxGdpGrowthRate: number;
  adjustedGdpGrowth: number;
  populationGrowthRate: number;
  landArea: number | null;
  currentPopulation: number;
  currentGdpPerCapita: number;
  currentTotalGdp: number;
  populationDensity: number | null;
  gdpDensity: number | null;
  lastCalculated: number; // Timestamp
  baselineDate: number; // Timestamp
  economicTier: string;
  populationTier: string;
  localGrowthFactor: number;
  historicalData?: Array<{
    ixTimeTimestamp: number;
    population: number;
    gdpPerCapita: number;
    totalGdp: number;
    populationDensity?: number | null;
    gdpDensity?: number | null;
  }>;
  dmInputs?: Array<{
    id: string;
    ixTimeTimestamp: number;
    inputType: string;
    value: number;
    description?: string | null;
    duration?: number | null;
  }>;
  forecastDataPoints?: Array<TenYearForecastDataPoint>;
}

function CountryDetailPageContent() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const countryId = params.id;

  const [currentIxTime, setCurrentIxTime] = useState<number>(() => IxTime.getCurrentIxTime());
  const [forecastYears, setForecastYears] = useState<number>(0);
  const [selectedChartType, setSelectedChartType] = useState<ChartType>('overview');
  const [selectedTimeRange, setSelectedTimeRange] = useState<TimeRange>('10Y');
  const [customStartTime, setCustomStartTime] = useState<number>();
  const [customEndTime, setCustomEndTime] = useState<number>();
  const [showForecast, setShowForecast] = useState<boolean>(false);
  const [infoboxExpanded, setInfoboxExpanded] = useState(false);
  
  // Flag state management
  const [flagUrl, setFlagUrl] = useState<string | null>(null);
  const [flagLoading, setFlagLoading] = useState<boolean>(true);
  const [flagError, setFlagError] = useState<boolean>(false);

  // Historical data time range
  const historicalTimeRange = useMemo(() => {
    const yearsBack = 15;
    const startTime = IxTime.addYears(currentIxTime, -yearsBack);
    return { startTime, endTime: currentIxTime, yearsBack };
  }, [currentIxTime]);

  const { data: countryDataResult, isLoading: isLoadingCountry, error: countryError, refetch } =
    api.countries.getByIdAtTime.useQuery({
      id: countryId,
      timestamp: currentIxTime
    }, {
      enabled: !!countryId,
      refetchOnWindowFocus: false,
      staleTime: 1 * 60 * 1000,
    });

  const { data: historicalDataRaw, isLoading: isLoadingHistorical, error: historicalError } =
    api.countries.getHistoricalAtTime.useQuery({
      id: countryId,
      startTime: historicalTimeRange.startTime,
      endTime: historicalTimeRange.endTime,
      limit: 500
    }, {
      enabled: !!countryId && !!countryDataResult,
      refetchOnWindowFocus: false,
      staleTime: 2 * 60 * 1000,
    });

  const { data: forecastDataFromApi, isLoading: isLoadingForecast } =
    api.countries.getForecast.useQuery({
      id: countryId,
      startTime: currentIxTime,
      points: forecastYears > 0 ? (forecastYears * 4) + 1 : 0,
      endTime: IxTime.addYears(currentIxTime, forecastYears)
    }, {
      enabled: !!countryId && forecastYears > 0,
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000,
    });

  // Load flag when country data is available
  useEffect(() => {
    let isMounted = true;
    
    const loadFlag = async () => {
      if (!countryDataResult?.name) {
        if (isMounted) {
          setFlagLoading(false);
          setFlagError(true);
        }
        return;
      }

      if (isMounted) {
        setFlagLoading(true);
        setFlagError(false);
      }

      try {
        const url = await ixnayWiki.getFlagUrl(countryDataResult.name);
        if (isMounted) {
          setFlagUrl(url);
          setFlagLoading(false);
        }
      } catch (error) {
        console.warn(`Failed to load flag for ${countryDataResult.name}:`, error);
        if (isMounted) {
          setFlagUrl(null);
          setFlagError(true);
          setFlagLoading(false);
        }
      }
    };

    void loadFlag();
    return () => {
      isMounted = false;
    };
  }, [countryDataResult?.name]);

  const timeContext = useMemo(() => ({
    currentIxTime,
    formattedCurrentTime: IxTime.formatIxTime(currentIxTime, true),
    gameEpoch: IxTime.getInGameEpoch(),
    formattedGameEpoch: IxTime.formatIxTime(IxTime.getInGameEpoch(), true),
    yearsSinceGameStart: IxTime.getYearsSinceGameEpoch(currentIxTime),
    currentGameYear: IxTime.getCurrentGameYear(currentIxTime),
    gameTimeDescription: `Year ${IxTime.getCurrentGameYear(currentIxTime)}`,
    timeMultiplier: IxTime.getTimeMultiplier()
  }), [currentIxTime]);

  const transformedCountry: CountryDetailData | null = useMemo(() => {
    if (!countryDataResult) return null;
    const stats = countryDataResult.calculatedStats;
    if (!stats) return null;

    const lastCalculatedTimestamp = typeof stats.lastCalculated === 'number'
      ? stats.lastCalculated
      : stats.lastCalculated.getTime();

    const transformed = {
      id: countryDataResult.id,
      name: countryDataResult.name,
      continent: countryDataResult.continent ?? null,
      region: countryDataResult.region ?? null,
      governmentType: countryDataResult.governmentType ?? null,
      religion: countryDataResult.religion ?? null,
      leader: countryDataResult.leader ?? null,
      areaSqMi: countryDataResult.areaSqMi ?? null,
      baselinePopulation: countryDataResult.baselinePopulation,
      baselineGdpPerCapita: countryDataResult.baselineGdpPerCapita,
      maxGdpGrowthRate: countryDataResult.maxGdpGrowthRate,
      adjustedGdpGrowth: countryDataResult.adjustedGdpGrowth,
      populationGrowthRate: countryDataResult.populationGrowthRate,
      landArea: countryDataResult.landArea ?? null,
      currentPopulation: stats.currentPopulation,
      currentGdpPerCapita: stats.currentGdpPerCapita,
      currentTotalGdp: stats.currentTotalGdp,
      populationDensity: stats.populationDensity ?? null,
      gdpDensity: stats.gdpDensity ?? null,
      lastCalculated: lastCalculatedTimestamp,
      baselineDate: typeof countryDataResult.baselineDate === 'number'
        ? countryDataResult.baselineDate
        : new Date(countryDataResult.baselineDate).getTime(),
      economicTier: stats.economicTier,
      populationTier: stats.populationTier,
      localGrowthFactor: countryDataResult.localGrowthFactor,
      historicalData: historicalDataRaw?.map(p => ({
        ...p,
        ixTimeTimestamp: typeof p.ixTimeTimestamp === 'number' ? p.ixTimeTimestamp : new Date(p.ixTimeTimestamp).getTime()
      })) || [],
      dmInputs: countryDataResult.dmInputs?.map(d => ({
        ...d,
        ixTimeTimestamp: typeof d.ixTimeTimestamp === 'number' ? d.ixTimeTimestamp : new Date(d.ixTimeTimestamp).getTime()
      })) || [],
      forecastDataPoints: forecastDataFromApi?.dataPoints?.map(p => ({
        ...p,
        year: p.gameYear
      })) || [],
    };

    return transformed;
  }, [countryDataResult, historicalDataRaw, forecastDataFromApi]);

  // Process historical data for charts
  const processedHistoricalData = useMemo(() => {
    if (!historicalDataRaw || historicalDataRaw.length === 0) {
      return [];
    }

    return historicalDataRaw
      .map((point, index) => {
        try {
          const timestamp = typeof point.ixTimeTimestamp === 'number'
            ? point.ixTimeTimestamp
            : new Date(point.ixTimeTimestamp).getTime();

          const population = Number(point.population);
          const gdpPerCapita = Number(point.gdpPerCapita);
          const totalGdp = Number(point.totalGdp);

          if (!isFinite(timestamp) || !isFinite(population) || !isFinite(gdpPerCapita) || !isFinite(totalGdp)) {
            return null;
          }

          if (population <= 0 || gdpPerCapita <= 0 || totalGdp <= 0) {
            return null;
          }

          return {
            ...point,
            ixTimeTimestamp: timestamp,
            formattedDate: IxTime.formatIxTime(timestamp),
            gameYear: IxTime.getCurrentGameYear(timestamp),
            population,
            gdpPerCapita,
            totalGdp,
            populationDensity: point.populationDensity ? Number(point.populationDensity) : null,
            gdpDensity: point.gdpDensity ? Number(point.gdpDensity) : null,
            populationGrowthRate: point.populationGrowthRate || 0,
            gdpGrowthRate: point.gdpGrowthRate || 0,
            landArea: point.landArea || null,
          };
        } catch (error) {
          console.error(`Error processing data point at index ${index}:`, error, point);
          return null;
        }
      })
      .filter((point): point is Exclude<typeof point, null> => point !== null)
      .sort((a, b) => a.ixTimeTimestamp - b.ixTimeTimestamp);
  }, [historicalDataRaw]);

  // Process forecast data for charts
  const processedForecastData = useMemo(() => {
    if (!forecastDataFromApi?.dataPoints) return [];
    
    return forecastDataFromApi.dataPoints.map(point => ({
      ixTimeTimestamp: point.ixTime,
      formattedDate: IxTime.formatIxTime(point.ixTime),
      gameYear: point.gameYear,
      population: point.population,
      gdpPerCapita: point.gdpPerCapita,
      totalGdp: point.totalGdp,
      populationDensity: point.populationDensity,
      gdpDensity: point.gdpDensity,
      populationGrowthRate: 0, // Could be calculated if needed
      gdpGrowthRate: 0, // Could be calculated if needed
      landArea: transformedCountry?.landArea || null,
    }));
  }, [forecastDataFromApi, transformedCountry]);

  // Chart data for the new chart system
  const chartData = useMemo(() => {
    if (!transformedCountry) return null;
    
    return {
      id: transformedCountry.id,
      name: transformedCountry.name,
      currentIxTime,
      gameEpoch: timeContext.gameEpoch,
      historicalData: processedHistoricalData,
      forecastData: processedForecastData,
    };
  }, [transformedCountry, currentIxTime, timeContext.gameEpoch, processedHistoricalData, processedForecastData]);

  const availableDataForCharts = useMemo(() => ({
    hasLandArea: !!(transformedCountry?.landArea),
    hasHistoricalData: processedHistoricalData.length > 0,
    hasComparison: false,
    hasDensityData: !!(transformedCountry?.populationDensity && transformedCountry?.gdpDensity)
  }), [transformedCountry, processedHistoricalData]);

  const handleTimeChange = (newIxTime: number) => {
    setCurrentIxTime(newIxTime);
  };

  const handleForecastChange = (years: number) => {
    setForecastYears(years);
  };

  const handleChartChange = (chartType: ChartType) => {
    setSelectedChartType(chartType);
  };

  const handleTimeRangeChange = (range: TimeRange) => {
    setSelectedTimeRange(range);
  };

  const handleCustomTimeChange = (startTime: number, endTime: number) => {
    setCustomStartTime(startTime);
    setCustomEndTime(endTime);
  };

  const handleInfoboxToggle = (expanded: boolean) => {
    setInfoboxExpanded(expanded);
  };

  const handleRefresh = () => {
    void refetch();
  };

  const isTimeTravel = Math.abs(currentIxTime - IxTime.getCurrentIxTime()) > 60000; // 1 minute tolerance
  const isLoadingPage = isLoadingCountry && !transformedCountry;

  // Get wiki URL for country
  const getWikiUrl = () => {
    if (!transformedCountry?.name) return '#';
    return `https://ixwiki.com/${encodeURIComponent(transformedCountry.name.replace(/ /g, '_'))}`;
  };

  // Enhanced loading state
  if (isLoadingPage) {
    return (
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        <Skeleton className="h-10 w-1/2 mb-6" />
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-8">
          <div><Skeleton className="h-12 w-3/4 mb-2" /><Skeleton className="h-6 w-1/2" /></div>
          <Skeleton className="h-10 w-32 rounded-md" />
        </div>
        <div className="grid gap-8 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-8">
            <Skeleton className="h-32 w-full rounded-lg" />
            <Skeleton className="h-96 w-full rounded-lg" />
            <Skeleton className="h-24 w-full rounded-lg" />
          </div>
          <div className="lg:col-span-1">
            <Skeleton className="h-[500px] w-full rounded-lg" />
          </div>
        </div>
      </div>
    );
  }

  // Enhanced error handling
  if (countryError || !countryDataResult || !transformedCountry) {
    return (
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Alert variant="destructive" className="max-w-lg mx-auto">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Error Loading Country Data</AlertTitle>
          <AlertDescription>
            {countryError?.message || "Country not found or an error occurred."}
            {historicalError && (
              <div className="mt-2 text-sm">
                Historical data error: {historicalError.message}
              </div>
            )}
            <div className="mt-4 flex gap-2">
              <Button onClick={() => router.push('/countries')} variant="outline">
                <ArrowLeft className="h-4 w-4 mr-2" /> Back to Countries
              </Button>
              <Button onClick={handleRefresh}>
                <RefreshCw className="h-4 w-4 mr-2" /> Try Again
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Breadcrumb className="mb-6">
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link href="/countries" className="flex items-center">
                  <ArrowLeft className="h-3.5 w-3.5 mr-1.5" />Countries
                </Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>{transformedCountry.name}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-4">
              {/* Enhanced Flag Display */}
              <div className="flex-shrink-0">
                {flagLoading ? (
                  <Skeleton className="h-12 w-16 rounded-md border" />
                ) : flagUrl ? (
                  <img
                    src={flagUrl}
                    alt={`Flag of ${transformedCountry.name}`}
                    className="h-12 w-16 object-cover rounded-md border border-border shadow-sm"
                    onError={() => setFlagError(true)}
                  />
                ) : (
                  <div className="h-12 w-16 bg-muted rounded-md border border-border flex items-center justify-center">
                    <Flag className="h-6 w-6 text-muted-foreground" />
                  </div>
                )}
              </div>
              
              <div>
                <h1 className="text-3xl md:text-4xl font-bold text-foreground">{transformedCountry.name}</h1>
                <div className="flex items-center gap-3 mt-2">
                  <p className="text-base md:text-lg text-muted-foreground">
                    {transformedCountry.continent && transformedCountry.region
                      ? `${transformedCountry.region}, ${transformedCountry.continent}`
                      : transformedCountry.continent || 'Country Dashboard'
                    }
                  </p>
                  {/* Wiki Link */}
                  <Button variant="outline" size="sm" asChild>
                    <a href={getWikiUrl()} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                      Wiki
                    </a>
                  </Button>
                </div>
              </div>
              
              {isTimeTravel && (
                <Badge variant="outline" className="bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-700">
                  <Clock className="h-3.5 w-3.5 mr-1.5" />Time Travel Active
                </Badge>
              )}
            </div>
            
            <div className="mt-1 flex items-center text-xs text-muted-foreground">
              <Info className="h-3.5 w-3.5 mr-1.5" />
              <span>Viewing: {IxTime.formatIxTime(currentIxTime, true)} ({timeContext.gameTimeDescription})</span>
              {processedHistoricalData.length > 0 && (
                <span className="ml-3">
                  • {processedHistoricalData.length} data points ({historicalTimeRange.yearsBack} years)
                </span>
              )}
              {isLoadingHistorical && (
                <span className="ml-3 text-blue-600">• Loading historical data...</span>
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-2 mt-4 lg:mt-0">
            <Button
              variant="outline"
              size="icon"
              onClick={handleRefresh}
              disabled={isLoadingCountry || isLoadingHistorical || isLoadingForecast}
              title="Refresh data"
            >
              <RefreshCw className={`h-4 w-4 ${(isLoadingCountry || isLoadingHistorical || isLoadingForecast) ? 'animate-spin' : ''}`} />
            </Button>
            {isTimeTravel && (
              <Button onClick={() => setCurrentIxTime(IxTime.getCurrentIxTime())} size="sm">
                <Clock className="h-4 w-4 mr-2" />Return to Present
              </Button>
            )}
          </div>
        </div>

        <div className={`grid gap-6 lg:gap-8 transition-all duration-300 ${infoboxExpanded ? 'lg:grid-cols-[1fr_320px]' : 'lg:grid-cols-[1fr_400px]'}`}>
          <div className="space-y-6 lg:space-y-8">
            {/* Time Control */}
            <TimeControl
              onTimeChange={handleTimeChange}
              onForecastChange={handleForecastChange}
              currentTime={currentIxTime}
              gameEpoch={timeContext.gameEpoch}
              isLoading={isLoadingCountry || isLoadingHistorical || isLoadingForecast}
            />

            {/* Country At-a-Glance */}
            <CountryAtGlance
              country={transformedCountry}
              currentIxTime={currentIxTime}
              isLoading={isLoadingCountry}
            />

            {/* Enhanced Chart System */}
            {chartData && (
              <IxStatsCharts
                data={chartData}
                selectedChartType={selectedChartType}
                onChartTypeChangeAction={handleChartChange}
                selectedTimeRange={selectedTimeRange}
                onTimeRangeChangeAction={handleTimeRangeChange}
                customStartTime={customStartTime}
                customEndTime={customEndTime}
                onCustomTimeChangeAction={handleCustomTimeChange}
                isLoading={isLoadingHistorical}
                showForecast={showForecast}
                onForecastToggleAction={setShowForecast}
              />
            )}
          </div>
          
          <aside className="lg:sticky lg:top-20 self-start">
            <CountryInfobox
              countryName={transformedCountry.name}
              onToggle={handleInfoboxToggle}
              initialExpanded={infoboxExpanded}
            />
          </aside>
        </div>
      </div>
    </div>
  );
}

export default function CountryDetailPageWrapper() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    }>
      <CountryDetailPageContent />
    </Suspense>
  );
}