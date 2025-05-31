// src/app/countries/[id]/page.tsx
"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { 
  ArrowLeft, 
  Info, 
  ChevronRight, 
  Clock, 
  BarChart3, 
  Globe, 
  MapPin, 
  Users, 
  TrendingUp,
  Landmark,
  AlertTriangle,
  Loader
} from "lucide-react";
import { api } from "~/trpc/react";
import { CountryInfobox } from "../_components/CountryInfobox";
import { IxTime } from "~/lib/ixtime";
import { getTierStyle } from "~/lib/theme-utils";

// Define chart data point type to fix TypeScript errors
interface ChartDataPoint {
  date: string;
  population: number;
  gdpPerCapita: number;
  totalGdp: number;
  populationDensity: number;
  gdpDensity: number;
  economicEfficiency: number;
  areaUtilization: number;
}

export default function CountryDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const countryId = params.id;
  
  // Current time state for time-based queries
  const [currentIxTime, setCurrentIxTime] = useState<number>(IxTime.getCurrentIxTime());
  
  // Fetch the country data
  const { data: country, isLoading: isLoadingCountry, error: countryError } = 
    api.countries.getById.useQuery({ id: countryId });
  
  // Initialize timeContext with a fallback
  const [timeContext, setTimeContext] = useState({
    currentIxTime: IxTime.getCurrentIxTime(),
    formattedCurrentTime: IxTime.formatIxTime(IxTime.getCurrentIxTime()),
    gameEpoch: IxTime.getInGameEpoch(),
    formattedGameEpoch: IxTime.formatIxTime(IxTime.getInGameEpoch()),
    yearsSinceGameStart: (IxTime.getCurrentIxTime() - IxTime.getInGameEpoch()) / (365 * 24 * 60 * 60 * 1000), // Calculate years since start
    currentGameYear: IxTime.getCurrentGameYear(),
    gameTimeDescription: `Year ${IxTime.getCurrentGameYear()}`,
    timeMultiplier: IxTime.getTimeMultiplier()
  });

  // Initialize chart data with proper types
  const [chartData, setChartData] = useState<{
    historicalData: ChartDataPoint[];
    forecastData: ChartDataPoint[];
  }>({
    historicalData: [],
    forecastData: []
  });
  
  // Format numbers for display
  const formatNumber = (num: number, isCurrency = false): string => {
    if (isCurrency) {
      if (Math.abs(num) >= 1e12) return `$${(num / 1e12).toFixed(2)}T`;
      if (Math.abs(num) >= 1e9) return `$${(num / 1e9).toFixed(2)}B`;
      if (Math.abs(num) >= 1e6) return `$${(num / 1e6).toFixed(2)}M`;
      if (Math.abs(num) >= 1e3) return `$${(num / 1e3).toFixed(2)}K`;
      return `$${num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    } else {
      if (Math.abs(num) >= 1e9) return `${(num / 1e9).toFixed(2)}B`;
      if (Math.abs(num) >= 1e6) return `${(num / 1e6).toFixed(2)}M`;
      if (Math.abs(num) >= 1e3) return `${(num / 1e3).toFixed(2)}K`;
      return num.toLocaleString();
    }
  };

  // Prepare chart data from historical data points if available
  useEffect(() => {
    if (country?.historicalData?.length) {
      // Convert to chart format
      const historicalChartData: ChartDataPoint[] = country.historicalData
        .map(point => ({
          date: new Date(point.ixTimeTimestamp).toISOString(),
          population: point.population,
          gdpPerCapita: point.gdpPerCapita,
          totalGdp: point.totalGdp,
          populationDensity: point.populationDensity || 0,
          gdpDensity: point.gdpDensity || 0,
          economicEfficiency: point.gdpPerCapita / (point.populationDensity || 1),
          areaUtilization: (point.gdpDensity || 0) / 1000
        }))
        .sort((a: ChartDataPoint, b: ChartDataPoint) => new Date(a.date).getTime() - new Date(b.date).getTime());
      
      setChartData(prev => ({
        ...prev,
        historicalData: historicalChartData
      }));
    }
  }, [country?.historicalData]);

  // Calculate forecast data based on current stats (simplified)
  useEffect(() => {
    if (country) {
      const forecastPoints: ChartDataPoint[] = [];
      const currentTime = new Date(country.lastCalculated).getTime();
      const currentStats = {
        population: country.currentPopulation,
        gdpPerCapita: country.currentGdpPerCapita,
        totalGdp: country.currentTotalGdp,
        populationDensity: country.populationDensity || 0,
        gdpDensity: country.gdpDensity || 0
      };
      
      // Add current point
      forecastPoints.push({
        date: new Date(currentTime).toISOString(),
        ...currentStats,
        economicEfficiency: currentStats.gdpPerCapita / (currentStats.populationDensity || 1),
        areaUtilization: (currentStats.gdpDensity || 0) / 1000
      });
      
      // Simple projections for 10 years (just for visualization, not accurate)
      for (let i = 1; i <= 10; i++) {
        const yearMs = 365 * 24 * 60 * 60 * 1000;
        const timePoint = currentTime + (i * yearMs);
        const growthFactor = 1 + (country.adjustedGdpGrowth || 0.03);
        const popGrowthFactor = 1 + (country.populationGrowthRate || 0.01);
        
        const projectedPopulation = currentStats.population * Math.pow(popGrowthFactor, i);
        const projectedGdpPerCapita = currentStats.gdpPerCapita * Math.pow(growthFactor, i);
        const projectedTotalGdp = projectedPopulation * projectedGdpPerCapita;
        const projectedPopDensity = country.landArea ? projectedPopulation / country.landArea : 0;
        const projectedGdpDensity = country.landArea ? projectedTotalGdp / country.landArea : 0;
        
        forecastPoints.push({
          date: new Date(timePoint).toISOString(),
          population: projectedPopulation,
          gdpPerCapita: projectedGdpPerCapita,
          totalGdp: projectedTotalGdp,
          populationDensity: projectedPopDensity,
          gdpDensity: projectedGdpDensity,
          economicEfficiency: projectedGdpPerCapita / (projectedPopDensity || 1),
          areaUtilization: (projectedGdpDensity || 0) / 1000
        });
      }
      
      setChartData(prev => ({
        ...prev,
        forecastData: forecastPoints
      }));
    }
  }, [country]);

  // Get economic tier styling
  const tierStyle = useMemo(() => {
    if (!country) return getTierStyle("Developing");
    return getTierStyle(country.economicTier);
  }, [country?.economicTier]);

  if (isLoadingCountry) {
    return (
      <div className="min-h-screen bg-[var(--color-bg-primary)] flex items-center justify-center">
        <div className="text-center">
          <Loader className="h-12 w-12 animate-spin text-[var(--color-brand-primary)] mx-auto mb-4" />
          <h3 className="text-xl font-medium text-[var(--color-text-primary)]">
            Loading country data...
          </h3>
        </div>
      </div>
    );
  }

  if (countryError || !country) {
    return (
      <div className="min-h-screen bg-[var(--color-bg-primary)] flex items-center justify-center">
        <div className="text-center p-6 bg-[var(--color-error)]20 border border-[var(--color-error)]40 rounded-lg max-w-md">
          <div className="text-[var(--color-error)] text-6xl mb-4">
            <AlertTriangle className="h-16 w-16 mx-auto" />
          </div>
          <h3 className="text-xl font-medium text-[var(--color-text-primary)] mb-2">
            Error Loading Country
          </h3>
          <p className="text-sm text-[var(--color-text-muted)] mb-4">
            {countryError?.message || "Country not found or could not be loaded."}
          </p>
          <div className="flex gap-4 justify-center">
            <button
              onClick={() => router.push('/countries')}
              className="btn-secondary"
            >
              Back to Countries
            </button>
            <button
              onClick={() => router.refresh()}
              className="btn-primary"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--color-bg-primary)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Breadcrumb Navigation */}
        <nav className="mb-6">
          <ol className="flex items-center space-x-2 text-sm">
            <li>
              <Link 
                href="/countries" 
                className="text-[var(--color-text-muted)] hover:text-[var(--color-brand-primary)] transition-colors flex items-center"
              >
                <ArrowLeft className="h-3.5 w-3.5 mr-1" />
                Countries
              </Link>
            </li>
            <li className="flex items-center">
              <ChevronRight className="h-4 w-4 text-[var(--color-text-muted)]" />
              <span className="ml-2 font-medium text-[var(--color-text-primary)]">
                {country.name}
              </span>
            </li>
          </ol>
        </nav>

        {/* Country Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center">
              <h1 className="text-4xl font-bold text-[var(--color-text-primary)]">
                {country.name}
              </h1>
              <span className={`tier-badge ml-4 ${tierStyle.className}`}>
                {country.economicTier}
              </span>
            </div>
            <p className="mt-2 text-lg text-[var(--color-text-muted)]">
              {country.continent}{country.continent && country.region && ","} {country.region} • {country.populationTier} Population
            </p>
          </div>
          
          <div className="flex flex-wrap items-center gap-3">
            <div className="stat-block">
              <Users className="stat-icon" />
              <div>
                <span className="stat-label">Population</span>
                <span className="stat-value">{formatNumber(country.currentPopulation)}</span>
              </div>
            </div>
            
            <div className="stat-block">
              <TrendingUp className="stat-icon" />
              <div>
                <span className="stat-label">GDP per Capita</span>
                <span className="stat-value">{formatNumber(country.currentGdpPerCapita, true)}</span>
              </div>
            </div>
            
            <div className="stat-block">
              <Landmark className="stat-icon" />
              <div>
                <span className="stat-label">Total GDP</span>
                <span className="stat-value">{formatNumber(country.currentTotalGdp, true)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Stats and Geography */}
          <div className="lg:col-span-1 space-y-8">
            {/* Country Information */}
            <CountryInfobox countryName={country.name} />
            
            {/* Detailed Stats Card */}
            <div className="card">
              <div className="card-header">
                <h2 className="card-title">
                  <BarChart3 className="card-icon" />
                  Economic Statistics
                </h2>
              </div>
              <div className="card-body space-y-4">
                <div className="stat-row">
                  <span className="stat-label">Current Population:</span>
                  <span className="stat-value">{formatNumber(country.currentPopulation)}</span>
                </div>
                <div className="stat-row">
                  <span className="stat-label">Population Growth:</span>
                  <span className="stat-value">{(country.populationGrowthRate * 100).toFixed(2)}%</span>
                </div>
                <div className="stat-row">
                  <span className="stat-label">GDP per Capita:</span>
                  <span className="stat-value">{formatNumber(country.currentGdpPerCapita, true)}</span>
                </div>
                <div className="stat-row">
                  <span className="stat-label">GDP Growth Rate:</span>
                  <span className="stat-value">{(country.adjustedGdpGrowth * 100).toFixed(2)}%</span>
                </div>
                <div className="stat-row">
                  <span className="stat-label">Total GDP:</span>
                  <span className="stat-value">{formatNumber(country.currentTotalGdp, true)}</span>
                </div>
                {country.landArea && (
                  <>
                    <div className="stat-row">
                      <span className="stat-label">Land Area:</span>
                      <span className="stat-value">{formatNumber(country.landArea, false)} km²</span>
                    </div>
                    <div className="stat-row">
                      <span className="stat-label">Population Density:</span>
                      <span className="stat-value">{country.populationDensity?.toFixed(1)} /km²</span>
                    </div>
                    <div className="stat-row">
                      <span className="stat-label">GDP Density:</span>
                      <span className="stat-value">{formatNumber(country.gdpDensity || 0, true)}/km²</span>
                    </div>
                  </>
                )}
              </div>
              <div className="card-footer">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-[var(--color-text-muted)]">
                    Last updated: {new Date(country.lastCalculated).toLocaleString()}
                  </span>
                  <Clock className="h-4 w-4 text-[var(--color-text-muted)]" />
                </div>
              </div>
            </div>
            
            {/* Geography Card */}
            {country.landArea && (
              <div className="card">
                <div className="card-header">
                  <h2 className="card-title">
                    <MapPin className="card-icon" />
                    Geographic Information
                  </h2>
                </div>
                <div className="card-body space-y-4">
                  <div className="stat-row">
                    <span className="stat-label">Continent:</span>
                    <span className="stat-value">{country.continent || 'N/A'}</span>
                  </div>
                  <div className="stat-row">
                    <span className="stat-label">Region:</span>
                    <span className="stat-value">{country.region || 'N/A'}</span>
                  </div>
                  <div className="stat-row">
                    <span className="stat-label">Land Area:</span>
                    <span className="stat-value">{formatNumber(country.landArea, false)} km²</span>
                  </div>
                  {country.areaSqMi && (
                    <div className="stat-row">
                      <span className="stat-label">Area (sq mi):</span>
                      <span className="stat-value">{formatNumber(country.areaSqMi, false)}</span>
                    </div>
                  )}
                  <div className="stat-row">
                    <span className="stat-label">Population Density:</span>
                    <span className="stat-value">{country.populationDensity?.toFixed(1)} people/km²</span>
                  </div>
                  <div className="stat-row">
                    <span className="stat-label">GDP Density:</span>
                    <span className="stat-value">{formatNumber(country.gdpDensity || 0, true)}/km²</span>
                  </div>
                </div>
              </div>
            )}
            
            {/* Political Information */}
            <div className="card">
              <div className="card-header">
                <h2 className="card-title">
                  <Globe className="card-icon" />
                  Political Information
                </h2>
              </div>
              <div className="card-body space-y-4">
                <div className="stat-row">
                  <span className="stat-label">Government:</span>
                  <span className="stat-value">{country.governmentType || 'N/A'}</span>
                </div>
                <div className="stat-row">
                  <span className="stat-label">Leader:</span>
                  <span className="stat-value">{country.leader || 'N/A'}</span>
                </div>
                <div className="stat-row">
                  <span className="stat-label">Religion:</span>
                  <span className="stat-value">{country.religion || 'N/A'}</span>
                </div>
                <div className="stat-row">
                  <span className="stat-label">Economic Tier:</span>
                  <span className={`stat-value font-medium ${tierStyle.color}`}>{country.economicTier}</span>
                </div>
                <div className="stat-row">
                  <span className="stat-label">Population Tier:</span>
                  <span className="stat-value">{country.populationTier}</span>
                </div>
              </div>
            </div>
          </div>
          
          {/* Right Column - Charts and Time-based Data */}
          <div className="lg:col-span-2 space-y-8">
            {/* Time Context */}
            <div className="card">
              <div className="card-header">
                <h2 className="card-title">
                  <Clock className="card-icon" />
                  Time Context
                </h2>
              </div>
              <div className="card-body">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div>
                    <div className="text-2xl font-bold text-[var(--color-brand-primary)]">
                      {timeContext.gameTimeDescription}
                    </div>
                    <p className="text-sm text-[var(--color-text-muted)]">
                      {timeContext.yearsSinceGameStart.toFixed(1)} years since game start
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="stat-block-small">
                      <span className="stat-label-small">Current In-Game Time</span>
                      <span className="stat-value-small">{timeContext.formattedCurrentTime}</span>
                    </div>
                    <div className="stat-block-small">
                      <span className="stat-label-small">Game Epoch</span>
                      <span className="stat-value-small">{timeContext.formattedGameEpoch}</span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="card-footer">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-[var(--color-text-muted)]">
                    Time Multiplier: {timeContext.timeMultiplier}x
                  </span>
                  <Info className="h-4 w-4 text-[var(--color-text-muted)]" />
                </div>
              </div>
            </div>
            
            {/* Historical Data Chart */}
            <div className="card">
              <div className="card-header">
                <h2 className="card-title">
                  <BarChart3 className="card-icon" />
                  Historical Performance
                </h2>
              </div>
              <div className="card-body">
                {chartData.historicalData.length > 0 ? (
                  <div className="h-80">
                    {/* Render chart component here with chartData.historicalData */}
                    <div className="text-center text-[var(--color-text-muted)] h-full flex items-center justify-center">
                      <div>
                        <BarChart3 className="h-16 w-16 mx-auto mb-4 opacity-30" />
                        <p>Historical chart data available ({chartData.historicalData.length} points)</p>
                        <p className="text-sm mt-2">Chart visualization component would go here</p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-16 text-[var(--color-text-muted)]">
                    <BarChart3 className="h-16 w-16 mx-auto mb-4 opacity-30" />
                    <p>No historical data available for this country</p>
                    <p className="text-sm mt-2">Data will be collected as time progresses</p>
                  </div>
                )}
              </div>
            </div>
            
            {/* Forecast Chart */}
            <div className="card">
              <div className="card-header">
                <h2 className="card-title">
                  <TrendingUp className="card-icon" />
                  10-Year Forecast
                </h2>
              </div>
              <div className="card-body">
                {chartData.forecastData.length > 0 ? (
                  <div className="h-80">
                    {/* Render forecast chart component here with chartData.forecastData */}
                    <div className="text-center text-[var(--color-text-muted)] h-full flex items-center justify-center">
                      <div>
                        <TrendingUp className="h-16 w-16 mx-auto mb-4 opacity-30" />
                        <p>Forecast data available ({chartData.forecastData.length} points)</p>
                        <p className="text-sm mt-2">Chart visualization component would go here</p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-16 text-[var(--color-text-muted)]">
                    <TrendingUp className="h-16 w-16 mx-auto mb-4 opacity-30" />
                    <p>No forecast data available</p>
                  </div>
                )}
              </div>
              <div className="card-footer">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-[var(--color-text-muted)]">
                    Based on current growth rates: {(country.adjustedGdpGrowth * 100).toFixed(2)}% GDP, {(country.populationGrowthRate * 100).toFixed(2)}% Population
                  </span>
                  <Info className="h-4 w-4 text-[var(--color-text-muted)]" />
                </div>
              </div>
            </div>
            
            {/* DM Inputs/Events */}
            {country.dmInputs && country.dmInputs.length > 0 && (
              <div className="card">
                <div className="card-header">
                  <h2 className="card-title">
                    <Info className="card-icon" />
                    Active Economic Events
                  </h2>
                </div>
                <div className="card-body">
                  <div className="space-y-4">
                    {country.dmInputs.map((input) => (
                      <div 
                        key={input.id} 
                        className="flex items-start p-3 border border-[var(--color-border-primary)] rounded-lg bg-[var(--color-bg-tertiary)]"
                      >
                        <div className="flex-1">
                          <div className="flex items-center">
                            <span className="font-medium text-[var(--color-text-primary)]">
                              {input.inputType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                            </span>
                            <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-[var(--color-success)]20 text-[var(--color-success)]">
                              Active
                            </span>
                          </div>
                          <p className="text-sm text-[var(--color-text-muted)] mt-1">
                            {input.description || `${input.value > 0 ? '+' : ''}${(input.value * 100).toFixed(2)}% adjustment`}
                          </p>
                          <div className="mt-2 flex items-center text-xs text-[var(--color-text-muted)]">
                            <Clock className="h-3 w-3 mr-1" />
                            <span>
                              Started: {new Date(input.ixTimeTimestamp).toLocaleDateString()}
                              {input.duration && ` • Duration: ${input.duration} days`}
                            </span>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className={`text-lg font-semibold ${input.value >= 0 ? 'text-[var(--color-success)]' : 'text-[var(--color-error)]'}`}>
                            {input.value >= 0 ? '+' : ''}{(input.value * 100).toFixed(2)}%
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="card-footer">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-[var(--color-text-muted)]">
                      {country.dmInputs.length} active event{country.dmInputs.length !== 1 ? 's' : ''}
                    </span>
                    <Info className="h-4 w-4 text-[var(--color-text-muted)]" />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
