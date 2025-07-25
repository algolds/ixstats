// src/app/dashboard/_components/Dashboard.tsx
"use client";

import React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { useUser } from "@clerk/nextjs";
import { api } from "~/trpc/react";
import { createUrl } from "~/lib/url-utils";

// Local interface for processed country data
interface ProcessedCountryData {
  id: string;
  name: string;
  currentPopulation: number;
  currentGdpPerCapita: number;
  currentTotalGdp: number;
  economicTier: string;
  populationTier: string;
  landArea: number | null;
  populationDensity: number | null;
  gdpDensity: number | null;
}
import { CountryIntelligenceSection } from "~/app/countries/_components/CountryIntelligenceSection";
import { CountryExecutiveSection } from "~/app/countries/_components/CountryExecutiveSection";
import { AnimatedFlagsBackground } from "~/components/ui/animated-flags-background";
import { GlassCard } from "~/components/ui/enhanced-card";
import { CollapsibleCard } from "~/components/ui/collapsible-card";
import { HealthRing } from "~/components/ui/health-ring";
import { AnimatedNumber } from "~/components/ui/animated-number";
import { ActivityPopover } from "~/components/ui/activity-modal";
import { SimpleFlag } from "~/components/SimpleFlag";
import { formatCurrency, formatPopulation } from "~/lib/chart-utils";
import { groupCountriesByPower, type CountryPowerData } from "~/lib/power-classification";
import { Popover, PopoverTrigger, PopoverContent } from "~/components/ui/popover";
import { Crown, Building2, Globe, Shield } from "lucide-react";
// Define a type for globalStats
interface GlobalStats {
  totalPopulation: number;
  totalGdp: number;
  averageGdpPerCapita: number;
  totalCountries: number;
  economicTierDistribution: Record<string, number>;
  populationTierDistribution: Record<string, number>;
  averagePopulationDensity: number;
  averageGdpDensity: number;
  globalGrowthRate: number;
  ixTimeTimestamp: number;
}

// Add a type guard

export default function Dashboard() {
  const { user } = useUser();
  const [activityPopoverOpen, setActivityPopoverOpen] = React.useState<number | null>(null);

  // Check if user has completed setup (non-blocking)
  const { data: userProfile, isLoading: profileLoading } = api.users.getProfile.useQuery(
    { userId: user?.id || '' },
    { enabled: !!user?.id }
  );

  // 1) Fetch paginated country list (with error handling)
  const {
    data: allData,
    isLoading: countriesLoading,
    error: countriesError
  } = api.countries.getAll.useQuery(undefined, {
    retry: 1,
    retryDelay: 1000
  });

  // 2) Fetch global stats (with error handling)
  const {
    data: globalStatsData,
    isLoading: statsLoading,
    error: statsError
  } = api.countries.getGlobalStats.useQuery(undefined, {
    retry: 1,
    retryDelay: 1000
  });

  // 3) Fetch user's country data (with error handling)
  const {
    data: countryData,
    isLoading: countryLoading,
    error: countryError
  } = api.countries.getByIdWithEconomicData.useQuery(
    { id: userProfile?.countryId || '' },
    { 
      enabled: !!userProfile?.countryId,
      retry: 1,
      retryDelay: 1000
    }
  );

  // 4) Always treat listData.countries as an array
  const countriesRaw = allData?.countries ?? [];

  // 5) Map raw to your ProcessedCountryData
  const processedCountries: ProcessedCountryData[] = countriesRaw.map((country) => ({
    id: country.id,
    name: country.name,
    currentPopulation: country.currentPopulation ?? 0,
    currentGdpPerCapita: country.currentGdpPerCapita ?? 0,
    currentTotalGdp: country.currentTotalGdp ?? 0,
    economicTier: country.economicTier ?? "Unknown",
    populationTier: country.populationTier ?? "Unknown",
    landArea: country.landArea ?? null,
    populationDensity: country.populationDensity ?? null,
    gdpDensity: country.gdpDensity ?? null,
  }));

  // 6) Calculate power classifications
  const powerGrouped = groupCountriesByPower(processedCountries as CountryPowerData[]);


  // Allow dashboard to load even while checking setup status

  // No longer needed: handleActivityRingClick, handleActivityOverviewClick

  // FIXED: Properly adapt global stats to match the interface and ensure number consistency
  const adaptedGlobalStats = globalStatsData ? {
        totalPopulation: (globalStatsData as any).totalPopulation as number,
        totalGdp: (globalStatsData as any).totalGdp as number,
        averageGdpPerCapita: (globalStatsData as any).averageGdpPerCapita as number,
        countryCount: (globalStatsData as any).totalCountries as number, // Map totalCountries to countryCount
        economicTierDistribution: (globalStatsData as any).economicTierDistribution as Record<string, number>,
        populationTierDistribution: (globalStatsData as any).populationTierDistribution as Record<string, number>,
        averagePopulationDensity: ((globalStatsData as any).averagePopulationDensity as number) || 0, // Convert null to 0
        averageGdpDensity: ((globalStatsData as any).averageGdpDensity as number) || 0, // Convert null to 0
        globalGrowthRate: (globalStatsData as any).globalGrowthRate as number,
        timestamp: (globalStatsData as any).ixTimeTimestamp as number, // Use the actual timestamp from API
        ixTimeTimestamp: (globalStatsData as any).ixTimeTimestamp as number,
      } : undefined;

  // Show any critical errors
  if (countriesError || statsError) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <GlassCard variant="glass" className="text-center p-8">
            <h2 className="text-2xl font-bold mb-4 text-destructive">Error Loading Dashboard</h2>
            <p className="text-muted-foreground mb-6">
              {countriesError?.message || statsError?.message || 'Unknown error occurred'}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-3 bg-primary hover:bg-primary/90 text-primary-foreground font-medium rounded-lg transition-all duration-200"
            >
              Reload Page
            </button>
          </GlassCard>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* Setup Required Banner (non-blocking) */}
        {userProfile && !userProfile.countryId && (
          <GlassCard variant="glass" className="text-center p-8 mb-6">
            <h2 className="text-2xl font-bold mb-4">Complete Your Setup</h2>
            <p className="text-muted-foreground mb-6">
              Set up your country profile to access MyCountry®, ECI, and SDI modules.
            </p>
            <Link
              href={createUrl("/setup")}
              className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-medium rounded-lg transition-all duration-200"
            >
              ⭐ Complete Setup
            </Link>
          </GlassCard>
        )}

        {/* Loading states for various data */}
        {profileLoading && (
          <GlassCard variant="glass" className="text-center p-8 mb-6">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            <p className="mt-4 text-muted-foreground">Loading profile...</p>
          </GlassCard>
        )}

        {(countriesLoading || statsLoading) && (
          <GlassCard variant="glass" className="text-center p-8 mb-6">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            <p className="mt-4 text-muted-foreground">Loading dashboard data...</p>
          </GlassCard>
        )}

        {/* Main Dashboard Grid - User's Country Modules (only when data is loaded) */}
        {userProfile?.countryId && !countriesLoading && !statsLoading && allData && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* MyCountry® Overview - spans more columns, optimized spacing */}
            <div className="lg:col-span-8">
              <CollapsibleCard
                title="MyCountry® Overview"
                icon={<Crown className="h-5 w-5 text-yellow-500" />}
                variant="glass"
                actions={
                  <Link
                    href={createUrl("/mycountry")}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-yellow-600 dark:bg-yellow-600 hover:bg-yellow-700 dark:hover:bg-yellow-700 text-white font-medium rounded-lg transition-all duration-200"
                  >
                    → Open
                  </Link>
                }
                defaultOpen={true}
                className="relative overflow-hidden"
              >
                {/* Country Flag Background */}
                {countryData && (
                  <div className="absolute inset-0 pointer-events-none overflow-hidden">
                    {/* Large background flag with glassmorphic effect */}
                    <div className="absolute -top-12 -right-12 w-72 h-48 opacity-15 transform rotate-12">
                      <div className="relative w-full h-full group">
                        {/* Shimmer effect */}
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent 
                                      transform -skew-x-12 translate-x-full group-hover:translate-x-[-200%] 
                                      transition-transform duration-3000 ease-in-out animate-pulse" />
                        
                        {/* Glassmorphic container with real flag */}
                        <div className="w-full h-full backdrop-blur-[2px] bg-gradient-to-br from-white/20 via-white/10 to-white/5 
                                      rounded-2xl border border-white/30 shadow-2xl overflow-hidden">
                          <div className="w-full h-full bg-gradient-to-br from-white/10 to-transparent">
                            {/* Real flag image with Framer Motion ripple animation */}
                            <motion.div 
                              className="w-full h-full"
                              animate={{
                                x: [0, 1, -0.5, 0.5, 0],
                                skewX: [0, 0.5, -0.3, 0.2, 0],
                                filter: [
                                  "brightness(1)",
                                  "brightness(1.05)",
                                  "brightness(0.98)",
                                  "brightness(1.02)",
                                  "brightness(1)"
                                ]
                              }}
                              transition={{
                                duration: 8,
                                ease: "easeInOut",
                                repeat: Infinity,
                                repeatType: "reverse"
                              }}
                            >
                              <SimpleFlag 
                                countryName={countryData.name}
                                className="w-full h-full object-cover opacity-60"
                                showPlaceholder={true}
                              />
                            </motion.div>
                          </div>
                        </div>
                        
                        {/* Additional glow effect */}
                        <div className="absolute inset-0 bg-gradient-to-br from-blue-400/20 via-purple-400/10 to-yellow-400/20 
                                      rounded-2xl animate-pulse" style={{ animationDuration: '4s' }} />
                      </div>
                    </div>
                    
                    {/* Subtle pattern overlay for texture */}
                    <div className="absolute inset-0 opacity-10 bg-gradient-to-br from-transparent via-white/5 to-transparent" />
                  </div>
                )}
                <div className="space-y-6 relative z-10">
                  <p className="text-muted-foreground">
                    Manage your country's economy, demographics, and policies.
                  </p>
                  
                  {/* Compact Activity Rings */}
                  <div className="grid grid-cols-3 gap-4">
                    <div className="flex flex-col items-center space-y-2">
                      <HealthRing
                        value={countryData ? Math.min(100, (countryData.currentGdpPerCapita / 50000) * 100) : 0}
                        size={80}
                        color="var(--color-success)"
                        label="Economic"
                        tooltip="Click to view detailed economic metrics"
                        isClickable={true}
                        onClick={() => setActivityPopoverOpen(0)}
                      />
                      <div className="text-center">
                        <div className="text-sm font-medium">
                          {countryData ? formatCurrency(countryData.currentGdpPerCapita) : 'N/A'}
                        </div>
                        <div className="text-xs text-muted-foreground">GDP per Capita</div>
                      </div>
                    </div>
                    
                    <div className="flex flex-col items-center space-y-2">
                      <HealthRing
                        value={countryData ? Math.min(100, Math.max(0, ((countryData.populationGrowthRate || 0) * 100 + 2) * 25)) : 0}
                        size={80}
                        color="var(--color-brand-primary)"
                        label="Growth"
                        tooltip="Click to view population dynamics"
                        isClickable={true}
                        onClick={() => setActivityPopoverOpen(1)}
                      />
                      <div className="text-center">
                        <div className="text-sm font-medium">
                          {countryData ? formatPopulation(countryData.currentPopulation) : 'N/A'}
                        </div>
                        <div className="text-xs text-muted-foreground">Population</div>
                      </div>
                    </div>
                    
                    <div className="flex flex-col items-center space-y-2">
                      <HealthRing
                        value={countryData ? (countryData.economicTier === "Extravagant" ? 100 : 
                                           countryData.economicTier === "Very Strong" ? 85 :
                                           countryData.economicTier === "Strong" ? 70 :
                                           countryData.economicTier === "Healthy" ? 55 :
                                           countryData.economicTier === "Developed" ? 40 :
                                           countryData.economicTier === "Developing" ? 25 : 10) : 0}
                        size={80}
                        color="var(--color-purple)"
                        label="Development"
                        tooltip="Click to view development index details"
                        isClickable={true}
                        onClick={() => setActivityPopoverOpen(2)}
                      />
                      <div className="text-center">
                        <div className="text-sm font-medium">{countryData?.economicTier || 'Unknown'}</div>
                        <div className="text-xs text-muted-foreground">Economic Tier</div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Key Metrics Grid */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <div 
                      className="p-4 text-center border rounded-lg bg-background hover:bg-accent/50 transition-all duration-300 hover:scale-105 cursor-pointer"
                      title={`Total GDP: ${formatCurrency(countryData?.currentTotalGdp || 0)} - Click for economic overview`}
                      onClick={() => setActivityPopoverOpen(null)}
                    >
                      <div className="text-xl font-bold text-green-600 dark:text-green-400">
                        <AnimatedNumber value={((countryData?.currentTotalGdp || 0) / 1e12)} decimals={1} />T
                      </div>
                      <div className="text-xs text-muted-foreground">Total GDP</div>
                    </div>
                    <div 
                      className="p-4 text-center border rounded-lg bg-background hover:bg-accent/50 transition-all duration-300 hover:scale-105 cursor-pointer"
                      title={`Growth Rate: ${((countryData?.adjustedGdpGrowth || 0) * 100).toFixed(2)}% annually - Economic expansion rate`}
                      onClick={() => setActivityPopoverOpen(null)}
                    >
                      <div className="text-xl font-bold text-blue-600 dark:text-blue-400">
                        <AnimatedNumber value={((countryData?.adjustedGdpGrowth || 0) * 100)} decimals={1} />%
                      </div>
                      <div className="text-xs text-muted-foreground">Growth Rate</div>
                    </div>
                    <div 
                      className="p-4 text-center border rounded-lg bg-background hover:bg-accent/50 transition-all duration-300 hover:scale-105 cursor-pointer"
                      title={`Population Density: ${(countryData?.populationDensity || 0).toFixed(1)} people per km² - Urban concentration metric`}
                      onClick={() => setActivityPopoverOpen(null)}
                    >
                      <div className="text-xl font-bold text-purple-600 dark:text-purple-400">
                        <AnimatedNumber value={countryData?.populationDensity || 0} decimals={0} />
                      </div>
                      <div className="text-xs text-muted-foreground">Pop/km²</div>
                    </div>
                    <div 
                      className="p-4 text-center border rounded-lg bg-background hover:bg-accent/50 transition-all duration-300 hover:scale-105 cursor-pointer"
                      title="Country Status: Active and operational - All systems functioning"
                      onClick={() => setActivityPopoverOpen(null)}
                    >
                      <div className="text-xl font-bold text-green-600 dark:text-green-400">Active</div>
                      <div className="text-xs text-muted-foreground">Status</div>
                    </div>
                  </div>
                </div>
              </CollapsibleCard>
            </div>

            {/* Global Countries Overview */}
            <div className="lg:col-span-4">
              <CollapsibleCard
                title="Global Overview"
                icon={<Globe className="h-5 w-5 text-blue-600 dark:text-blue-400" />}
                variant="economic"
                actions={
                  <Link
                    href={createUrl("/countries")}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-all duration-200"
                  >
                    → Browse
                  </Link>
                }
                defaultOpen={true}
                className="relative overflow-hidden"
              >
                {/* Animated Flags Background */}
                <AnimatedFlagsBackground 
                  countries={processedCountries.map(c => ({ id: c.id, name: c.name }))}
                  maxFlags={6}
                  className="opacity-50"
                />
                <div className="space-y-4 relative z-10">
                  {/* Power Classification */}
                  <div className="space-y-2">
                    <div className="text-sm font-medium text-foreground mb-2">Power Classification</div>
                    <div className="space-y-2">
                      <Popover>
                        <PopoverTrigger>
                          <div className="flex items-center justify-between p-3 rounded-lg border bg-background hover:bg-accent/50 transition-all duration-300 hover:scale-105 cursor-pointer">
                            <div className="flex items-center gap-2">
                              <span className="text-sm">👑</span>
                              <span className="text-xs font-medium">Superpowers</span>
                            </div>
                            <span className="text-sm font-bold">
                              {powerGrouped.superpower.length}
                            </span>
                          </div>
                        </PopoverTrigger>
                        <PopoverContent side="right" className="w-80 p-4">
                          <div className="space-y-3">
                            <div className="flex items-center gap-2">
                              <span className="text-lg">👑</span>
                              <div>
                                <div className="font-semibold text-foreground">Superpowers</div>
                                <div className="text-xs text-muted-foreground">{powerGrouped.superpower.length} countries</div>
                              </div>
                            </div>
                            <div className="text-sm text-muted-foreground">
                              Countries with exceptional economic and military influence. These nations have global reach and significant impact on world affairs.
                            </div>
                            {powerGrouped.superpower.length > 0 && (
                              <div className="space-y-1">
                                <div className="text-xs font-medium text-gray-600 dark:text-muted-foreground">Examples:</div>
                                <div className="flex flex-wrap gap-1">
                                  {powerGrouped.superpower.slice(0, 3).map((country) => (
                                    <span key={country.id} className="px-2 py-1 bg-yellow-500/20 dark:bg-yellow-500/20 text-yellow-800 dark:text-yellow-200 text-xs rounded">
                                      {country.name}
                                    </span>
                                  ))}
                                  {powerGrouped.superpower.length > 3 && (
                                    <span className="px-2 py-1 bg-yellow-500/10 text-yellow-300 text-xs rounded">
                                      +{powerGrouped.superpower.length - 3} more
                                    </span>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        </PopoverContent>
                      </Popover>
                      
                      <Popover>
                        <PopoverTrigger>
                          <div className="flex items-center justify-between p-3 rounded-lg border bg-background hover:bg-accent/50 transition-all duration-300 hover:scale-105 cursor-pointer">
                            <div className="flex items-center gap-2">
                              <span className="text-sm">⭐</span>
                              <span className="text-xs font-medium">Major Powers</span>
                            </div>
                            <span className="text-sm font-bold">
                              {powerGrouped.major.length}
                            </span>
                          </div>
                        </PopoverTrigger>
                        <PopoverContent side="right" className="w-80 p-4">
                          <div className="space-y-3">
                            <div className="flex items-center gap-2">
                              <span className="text-lg">⭐</span>
                              <div>
                                <div className="font-semibold text-foreground">Major Powers</div>
                                <div className="text-xs text-muted-foreground">{powerGrouped.major.length} countries</div>
                              </div>
                            </div>
                            <div className="text-sm text-muted-foreground">
                              Influential countries with significant regional impact. These nations have substantial economies and military capabilities.
                            </div>
                            {powerGrouped.major.length > 0 && (
                              <div className="space-y-1">
                                <div className="text-xs font-medium text-gray-600 dark:text-muted-foreground">Examples:</div>
                                <div className="flex flex-wrap gap-1">
                                  {powerGrouped.major.slice(0, 3).map((country) => (
                                    <span key={country.id} className="px-2 py-1 bg-blue-500/20 dark:bg-blue-500/20 text-blue-800 dark:text-blue-200 text-xs rounded">
                                      {country.name}
                                    </span>
                                  ))}
                                  {powerGrouped.major.length > 3 && (
                                    <span className="px-2 py-1 bg-blue-500/10 text-blue-300 text-xs rounded">
                                      +{powerGrouped.major.length - 3} more
                                    </span>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        </PopoverContent>
                      </Popover>
                      
                      <Popover>
                        <PopoverTrigger>
                          <div className="flex items-center justify-between p-3 rounded-lg border bg-background hover:bg-accent/50 transition-all duration-300 hover:scale-105 cursor-pointer">
                            <div className="flex items-center gap-2">
                              <span className="text-sm">🌟</span>
                              <span className="text-xs font-medium">Regional Powers</span>
                            </div>
                            <span className="text-sm font-bold">
                              {powerGrouped.regional.length}
                            </span>
                          </div>
                        </PopoverTrigger>
                        <PopoverContent side="right" className="w-80 p-4">
                          <div className="space-y-3">
                            <div className="flex items-center gap-2">
                              <span className="text-lg">🌟</span>
                              <div>
                                <div className="font-semibold text-foreground">Regional Powers</div>
                                <div className="text-xs text-muted-foreground">{powerGrouped.regional.length} countries</div>
                              </div>
                            </div>
                            <div className="text-sm text-muted-foreground">
                              Countries with substantial local influence and growing economies. These nations play important roles in their regions.
                            </div>
                            {powerGrouped.regional.length > 0 && (
                              <div className="space-y-1">
                                <div className="text-xs font-medium text-gray-600 dark:text-muted-foreground">Examples:</div>
                                <div className="flex flex-wrap gap-1">
                                  {powerGrouped.regional.slice(0, 3).map((country) => (
                                    <span key={country.id} className="px-2 py-1 bg-green-500/20 dark:bg-green-500/20 text-green-800 dark:text-green-200 text-xs rounded">
                                      {country.name}
                                    </span>
                                  ))}
                                  {powerGrouped.regional.length > 3 && (
                                    <span className="px-2 py-1 bg-green-500/10 text-green-300 text-xs rounded">
                                      +{powerGrouped.regional.length - 3} more
                                    </span>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>
                  
                  {/* Global Stats */}
                  <div className="grid grid-cols-1 gap-2 pt-3 border-t border-border">
                    <div className="flex justify-between text-sm">
                      <span>Total Countries</span>
                      <span className="font-semibold">{adaptedGlobalStats?.countryCount || 0}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Global GDP</span>
                      <span className="font-semibold">
                        ${((adaptedGlobalStats?.totalGdp || 0) / 1e12).toFixed(1)}T
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Avg GDP/Capita</span>
                      <span className="font-semibold">
                        ${(adaptedGlobalStats?.averageGdpPerCapita || 0).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
              </CollapsibleCard>
            </div>

            {/* ECI Module - Improved Layout */}
            <div className="lg:col-span-6">
              <CollapsibleCard
                title="Executive Command Interface"
                icon={<Building2 className="h-5 w-5 text-indigo-500" />}
                variant="diplomatic"
                actions={
                  <Link
                    href={createUrl("/eci")}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg transition-all duration-200"
                  >
                    → Open ECI
                  </Link>
                }
                defaultOpen={true}
              >
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    High-level executive tools for strategic governance and policy management.
                  </p>
                  <div className="border border-border/20 rounded-lg p-3">
                    <CountryExecutiveSection countryId={userProfile.countryId} userId={user?.id} />
                  </div>
                </div>
              </CollapsibleCard>
            </div>

            {/* SDI Module - Improved Layout */}
            <div className="lg:col-span-6">
              <CollapsibleCard
                title="Sovereign Digital Interface"
                icon={<Shield className="h-5 w-5 text-red-500" />}
                variant="military"
                actions={
                  <Link
                    href={createUrl("/sdi")}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition-all duration-200"
                  >
                    → Open SDI
                  </Link>
                }
                defaultOpen={true}
              >
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Intelligence operations, diplomatic management, and security oversight.
                  </p>
                  <div className="border border-border/20 rounded-lg p-3">
                    <CountryIntelligenceSection countryId={userProfile.countryId} />
                  </div>
                </div>
              </CollapsibleCard>
            </div>
          </div>
        )}
      </div>

      {/* Activity Popover */}
      <ActivityPopover
        open={activityPopoverOpen !== null}
        anchorEl={null}
        onClose={() => setActivityPopoverOpen(null)}
        countryData={countryData ? {
          ...countryData,
          populationDensity: countryData.populationDensity ?? undefined,
          lastCalculated: typeof countryData.lastCalculated === 'object' 
            ? countryData.lastCalculated.getTime() 
            : countryData.lastCalculated
        } : null}
        selectedRing={activityPopoverOpen ?? undefined}
      />
    </div>
  );
}