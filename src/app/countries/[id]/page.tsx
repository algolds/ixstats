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
} from "lucide-react";
import { api } from "~/trpc/react";
import { IxTime } from "~/lib/ixtime";

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
import {
  TimeControl,
  CountryAtGlance,
  ChartTypeSelector,
  type ChartType,
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
  const [infoboxExpanded, setInfoboxExpanded] = useState(false);
  // FIXED: Add time resolution state
  const [timeResolution, setTimeResolution] = useState<'quarterly' | 'annual'>('annual');

  const { data: countryDataResult, isLoading: isLoadingCountry, error: countryError, refetch } =
    api.countries.getByIdAtTime.useQuery({
      id: countryId,
      timestamp: currentIxTime
    }, {
      enabled: !!countryId,
      refetchOnWindowFocus: false,
      staleTime: 1 * 60 * 1000, // 1 minute for more frequent updates if needed
    });

  const { data: historicalDataRaw, isLoading: isLoadingHistorical } =
    api.countries.getHistoricalAtTime.useQuery({
      id: countryId,
      startTime: IxTime.addYears(currentIxTime, -10),
      endTime: currentIxTime,
      limit: 100
    }, {
      enabled: !!countryId && !!countryDataResult,
      refetchOnWindowFocus: false,
      staleTime: 15 * 60 * 1000,
    });

  const { data: forecastDataFromApi, isLoading: isLoadingForecast } =
    api.countries.getForecast.useQuery({
      id: countryId,
      startTime: currentIxTime,
      points: forecastYears > 0 ? (forecastYears * (selectedChartType === 'overview' ? 2 : 4)) +1 : 0,
      endTime: IxTime.addYears(currentIxTime, forecastYears)
    }, {
      enabled: !!countryId && forecastYears > 0,
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000,
    });

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

    // Ensure lastCalculated is a number (timestamp)
    const lastCalculatedTimestamp = typeof stats.lastCalculated === 'number'
      ? stats.lastCalculated
      : stats.lastCalculated.getTime();

    return {
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
        year: p.gameYear // Add 'year' field for TenYearForecast compatibility
      })) || [],
    };
  }, [countryDataResult, historicalDataRaw, forecastDataFromApi]);

  const availableDataForCharts = useMemo(() => ({
    hasLandArea: !!(transformedCountry?.landArea),
    hasHistoricalData: !!(transformedCountry?.historicalData?.length),
    hasComparison: false, // Placeholder - implement if comparison data is fetched
    hasDensityData: !!(transformedCountry?.populationDensity && transformedCountry?.gdpDensity)
  }), [transformedCountry]);

  const handleTimeChange = (newIxTime: number) => {
    setCurrentIxTime(newIxTime);
  };
  const handleForecastChange = (years: number) => {
    setForecastYears(years);
  };
  const handleChartChange = (chartType: ChartType) => {
    setSelectedChartType(chartType);
  };
  const handleInfoboxToggle = (expanded: boolean) => {
    setInfoboxExpanded(expanded);
  };
  const handleRefresh = () => {
    void refetch();
  };

  // FIXED: Implement time resolution change handler
  const handleTimeResolutionChange = (resolution: 'quarterly' | 'annual') => {
    setTimeResolution(resolution);
  };

  const isTimeTravel = currentIxTime !== IxTime.getCurrentIxTime();
  const isLoadingPage = isLoadingCountry && !transformedCountry;

  if (isLoadingPage) {
    return (
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        <Skeleton className="h-10 w-1/2 mb-6" />
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-8">
          <div><Skeleton className="h-12 w-3/4 mb-2" /><Skeleton className="h-6 w-1/2" /></div>
          <Skeleton className="h-10 w-32 rounded-md" />
        </div>
        <div className="grid gap-8 lg:grid-cols-3">
            <div className="lg:col-span-2 space-y-8"><Skeleton className="h-32 w-full rounded-lg" /><Skeleton className="h-96 w-full rounded-lg" /><Skeleton className="h-24 w-full rounded-lg" /></div>
            <div className="lg:col-span-1"><Skeleton className="h-[500px] w-full rounded-lg" /></div>
        </div>
      </div>
    );
  }

  if (countryError || !countryDataResult || !transformedCountry) {
    return (
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Alert variant="destructive" className="max-w-lg mx-auto">
          <AlertTriangle className="h-4 w-4" /><AlertTitle>Error Loading Country Data</AlertTitle>
          <AlertDescription>{countryError?.message || "Country not found or an error occurred."}
            <div className="mt-4 flex gap-2">
                <Button onClick={() => router.push('/countries')} variant="outline"><ArrowLeft className="h-4 w-4 mr-2" /> Back to Countries</Button>
                <Button onClick={handleRefresh}><RefreshCw className="h-4 w-4 mr-2" /> Try Again</Button>
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
            <BreadcrumbItem><BreadcrumbLink asChild><Link href="/countries" className="flex items-center"><ArrowLeft className="h-3.5 w-3.5 mr-1.5" />Countries</Link></BreadcrumbLink></BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem><BreadcrumbPage>{transformedCountry.name}</BreadcrumbPage></BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-3">
                <h1 className="text-3xl md:text-4xl font-bold text-foreground">{transformedCountry.name}</h1>
                {isTimeTravel && (<Badge variant="outline" className="bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-700"><Clock className="h-3.5 w-3.5 mr-1.5" />Time Travel Active</Badge>)}
            </div>
            <p className="mt-2 text-base md:text-lg text-muted-foreground">Economic Analysis & Forecasting Dashboard</p>
             <div className="mt-1 flex items-center text-xs text-muted-foreground"><Info className="h-3.5 w-3.5 mr-1.5" /><span>Viewing: {timeContext.formattedCurrentTime} ({timeContext.gameTimeDescription})</span></div>
          </div>
          <div className="flex items-center gap-2 mt-4 lg:mt-0">
            <Button variant="outline" size="icon" onClick={handleRefresh} disabled={isLoadingCountry || isLoadingHistorical || isLoadingForecast} title="Refresh data"><RefreshCw className={`h-4 w-4 ${(isLoadingCountry || isLoadingHistorical || isLoadingForecast) ? 'animate-spin' : ''}`} /></Button>
            {isTimeTravel && (<Button onClick={() => setCurrentIxTime(IxTime.getCurrentIxTime())} size="sm"><Clock className="h-4 w-4 mr-2" />Return to Present</Button>)}
          </div>
        </div>

        <div className={`grid gap-6 lg:gap-8 transition-all duration-300 ${infoboxExpanded ? 'lg:grid-cols-[1fr_320px]' : 'lg:grid-cols-[1fr_400px]'}`}>
          <div className="space-y-6 lg:space-y-8">
            <TimeControl 
              onTimeChange={handleTimeChange} 
              onForecastChange={handleForecastChange} 
              currentTime={currentIxTime} 
              gameEpoch={timeContext.gameEpoch} 
              isLoading={isLoadingCountry || isLoadingHistorical || isLoadingForecast}
            />
            
            {/* FIXED: CountryAtGlance now receives proper timeResolution state and handler */}
            <CountryAtGlance
              country={transformedCountry}
              historicalData={transformedCountry.historicalData}
              targetTime={currentIxTime}
              forecastYears={forecastYears}
              isLoading={isLoadingHistorical || isLoadingCountry}
              isLoadingForecast={isLoadingForecast}
              chartView={selectedChartType as 'overview' | 'population' | 'gdp' | 'density'}
              timeResolution={timeResolution}
              onTimeResolutionChange={handleTimeResolutionChange}
              onChartViewChange={handleChartChange as any}
            />

            <ChartTypeSelector 
              selectedChart={selectedChartType} 
              onChartChange={handleChartChange} 
              availableData={availableDataForCharts}
            />
            
            {forecastYears > 0 && transformedCountry.forecastDataPoints && (
              <TenYearForecast
                country={transformedCountry}
                forecastData={transformedCountry.forecastDataPoints}
                baseTime={currentIxTime}
                isLoading={isLoadingForecast}
                forecastYears={forecastYears}
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
    <Suspense fallback={<div className="min-h-screen bg-background flex items-center justify-center"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>}>
      <CountryDetailPageContent />
    </Suspense>
  );
}