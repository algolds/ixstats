/**
 * DashboardRefactored Component
 *
 * Refactored modular dashboard with:
 * - Card-based architecture (MyCountry, ECI, SDI, Global Stats, Activity Feed)
 * - Centralized state management via useDashboardState hook
 * - Responsive grid layout via DashboardLayout components
 * - Cookie-persisted card expansion states
 * - Command palette integration
 */

"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { useUser } from "@clerk/nextjs";
import { api } from "~/trpc/react";
import { createAbsoluteUrl } from "~/lib/url-utils";

// Dashboard Components
import { MyCountryCard } from "./MyCountryCard";
import { ECICard } from "./ECICard";
import { SDICard } from "./SDICard";
import { GlobalStatsCard } from "./GlobalStatsCard";
import { ActivityFeedCard } from "./ActivityFeedCard";
import { DashboardLayout, DashboardRow, DashboardSeparator } from "./DashboardLayout";
import { DashboardErrorBoundary } from "~/components/shared/feedback/DashboardErrorBoundary";

// Custom Hooks
import { useDashboardState } from "./hooks/useDashboardState";

// UI Components
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "~/components/ui/command";
import { TextAnimate } from "~/components/magicui/text-animate";
import { ActivityPopover } from "~/components/ui/activity-modal";
import { InteractiveGridPattern } from "~/components/magicui/interactive-grid-pattern";

// Icons
import {
  Crown, Building2, Globe, Shield, Settings, TrendingUp,
  Users, DollarSign, Command, Activity,
  BarChart3, AlertTriangle,
  Target, Star,
  Gauge, Eye, Brain
} from "lucide-react";

// Utils
import { formatCurrency, formatPopulation } from "~/lib/chart-utils";
import { groupCountriesByPower, type CountryPowerData } from "~/lib/power-classification";
import { cn } from "~/lib/utils";

// Types
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
  adjustedGdpGrowth: number;
  populationGrowthRate: number;
  continent?: string | null;
  region?: string | null;
  governmentType?: string | null;
  religion?: string | null;
  leader?: string | null;
}


export default function DashboardRefactored() {
  const { user } = useUser();

  // Centralized dashboard state management
  const dashboardState = useDashboardState();

  // Header visibility
  const [headerVisible] = useState(false);

  // Unified activity rings data (same source as other dashboard variants)
  let activityRingsData: { economicVitality: number; populationWellbeing: number; diplomaticStanding: number; governmentalEfficiency: number } | undefined;

  // Command palette keyboard shortcuts
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        dashboardState.setCommandOpen(!dashboardState.commandOpen);
      }
      if (e.key === "Escape") {
        dashboardState.setCommandOpen(false);
        dashboardState.setFocusedCard(null);
        dashboardState.setExpandedCards(new Set());
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, [dashboardState]);

  // Header animation and scroll handling (disabled)
  // useEffect(() => {
  //   const handleScroll = () => {
  //     if (window.scrollY > 100) {
  //       setHeaderVisible(false);
  //       setHasAnimated(true);
  //     }
  //   };

  //   window.addEventListener('scroll', handleScroll);
  //   return () => window.removeEventListener('scroll', handleScroll);
  // }, [hasAnimated]);

  // Data fetching (single userProfile used throughout)
  const { data: userProfile } = api.users.getProfile.useQuery(
    undefined,
    { enabled: !!user?.id }
  );

  // Use centralized activity rings source
  const { data: activityRingsDataQuery } = api.countries.getActivityRingsData.useQuery(
    { countryId: userProfile?.countryId || '' },
    { enabled: !!userProfile?.countryId }
  );
  activityRingsData = activityRingsDataQuery;



  const { data: globalStatsData, error: statsError } = api.countries.getGlobalStats.useQuery(undefined, {
    retry: 1,
    retryDelay: 1000
  });

  const { data: countryDataRaw } = api.countries.getByIdAtTime.useQuery(
    { id: userProfile?.countryId || '' },
    { enabled: !!userProfile?.countryId, retry: 1, retryDelay: 1000 }
  );

  // Type assertion to access calculated fields
  const countryData = countryDataRaw as any;

  // SDI data for Global Intelligence section
  const { data: activeCrises } = api.sdi.getActiveCrises.useQuery(
    undefined,
    { enabled: !!user?.id && !!userProfile?.countryId }
  );

  const { data: intelligenceFeed } = api.sdi.getIntelligenceFeed.useQuery(
    { limit: 10 },
    { enabled: !!user?.id && !!userProfile?.countryId }
  );

  const { data: economicIndicators } = api.sdi.getEconomicIndicators.useQuery(
    undefined,
    { enabled: !!user?.id && !!userProfile?.countryId }
  );
const { data: allData, error: countriesError, isLoading: countriesLoading } = api.countries.getAll.useQuery(undefined, {
  retry: 1,
  retryDelay: 1000
});
// Process data
const processedCountries: ProcessedCountryData[] = useMemo(() => {
  const countriesRaw = allData?.countries ?? [];
  return countriesRaw.map((countryRaw) => {
    // Type assertion to access calculated fields
    const country = countryRaw as any;
    return {
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
      adjustedGdpGrowth: country.adjustedGdpGrowth ?? 0,
      populationGrowthRate: country.populationGrowthRate ?? 0,
      continent: country.continent ?? null,
      region: country.region ?? null,
      governmentType: country.governmentType ?? null,
      religion: country.religion ?? null,
      leader: country.leader ?? null,
    };
  });
}, [allData]);

  const powerGrouped = useMemo(() => 
    groupCountriesByPower(processedCountries as CountryPowerData[]), 
    [processedCountries]
  );

  const adaptedGlobalStats = useMemo(() => {
    if (!globalStatsData) return undefined;
    return {
      totalPopulation: (globalStatsData as any).totalPopulation as number,
      totalGdp: (globalStatsData as any).totalGdp as number,
      averageGdpPerCapita: (globalStatsData as any).averageGdpPerCapita as number,
      countryCount: (globalStatsData as any).totalCountries as number,
      economicTierDistribution: (globalStatsData as any).economicTierDistribution as Record<string, number>,
      populationTierDistribution: (globalStatsData as any).populationTierDistribution as Record<string, number>,
      averagePopulationDensity: ((globalStatsData as any).averagePopulationDensity as number) || 0,
      averageGdpDensity: ((globalStatsData as any).averageGdpDensity as number) || 0,
      globalGrowthRate: (globalStatsData as any).globalGrowthRate as number,
      timestamp: (globalStatsData as any).ixTimeTimestamp as number,
      ixTimeTimestamp: (globalStatsData as any).ixTimeTimestamp as number,
    };
  }, [globalStatsData]);

  // Dynamic command palette items based on user profile and available features
  const commandItems = useMemo(() => {
    const baseItems = [
      { 
        group: "Navigation",
        items: [
          { title: "Go to Countries", icon: <Globe className="h-4 w-4" />, action: () => window.location.href = createAbsoluteUrl("/countries/new") },
          { title: "View Analytics", icon: <BarChart3 className="h-4 w-4" />, action: () => window.location.href = createAbsoluteUrl("/analytics") },
          { title: "Open Settings", icon: <Settings className="h-4 w-4" />, action: () => window.location.href = createAbsoluteUrl("/settings") },
        ]
      },
      {
        group: "Quick Actions",
        items: [
          { title: "Refresh Data", icon: <Activity className="h-4 w-4" />, action: () => window.location.reload() },
          { title: "Export Statistics", icon: <TrendingUp className="h-4 w-4" />, action: () => console.log("Export statistics") },
        ]
      }
    ];

    // Only show dashboard sections if user has configured their country profile
    if (userProfile?.countryId) {
      baseItems.splice(1, 0, {
        group: "Dashboard Sections",
        items: [
          { title: "Go to MyCountry", icon: <Crown className="h-4 w-4" />, action: () => window.location.href = createAbsoluteUrl("/mycountry") },
          { title: "Open ECI Suite", icon: <Gauge className="h-4 w-4" />, action: () => window.location.href = createAbsoluteUrl("/eci") },
          { title: "Access SDI Intelligence", icon: <Eye className="h-4 w-4" />, action: () => window.location.href = createAbsoluteUrl("/sdi") },
        ]
      });
    } else {
      // Show setup-related commands for users without country profiles
      baseItems.splice(1, 0, {
        group: "Setup Required",
        items: [
          { title: "Complete Setup", icon: <Target className="h-4 w-4" />, action: () => window.location.href = createAbsoluteUrl("/setup") },
          { title: "Configure Profile", icon: <Settings className="h-4 w-4" />, action: () => window.location.href = createAbsoluteUrl("/profile") },
        ]
      });
    }

    return baseItems;
  }, [userProfile?.countryId]);

  // Error handling
  if (countriesError || statsError) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="glass-modal max-w-md w-full text-center p-8 rounded-xl">
          <AlertTriangle className="h-16 w-16 mx-auto mb-4 text-destructive" />
          <h2 className="text-2xl font-bold mb-4">Dashboard Unavailable</h2>
          <p className="text-muted-foreground mb-6">
            {countriesError?.message || statsError?.message || 'Unable to load dashboard data'}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-3 bg-primary hover:bg-primary/90 text-primary-foreground font-medium rounded-lg transition-all duration-200"
          >
            Retry Loading
          </button>
        </div>
      </div>
    );
  }

  return (
    <React.Fragment>
      <div className="relative min-h-screen bg-background">
      {/* Interactive Grid Background - Enhanced Saturation */}
      <InteractiveGridPattern
  width={40}
  height={40}
  squares={[50, 40]}
  className="opacity-40 dark:opacity-30"
  squaresClassName="fill-slate-200/25 dark:fill-slate-800/25 stroke-slate-300/40 dark:stroke-slate-500/40 [&:nth-child(4n+1):hover]:fill-yellow-500/60 [&:nth-child(4n+1):hover]:stroke-yellow-500/80 dark:[&:nth-child(4n+1):hover]:fill-yellow-400/70 dark:[&:nth-child(4n+1):hover]:stroke-yellow-400/90 [&:nth-child(4n+2):hover]:fill-blue-500/60 [&:nth-child(4n+2):hover]:stroke-blue-500/80 dark:[&:nth-child(4n+2):hover]:fill-blue-400/70 dark:[&:nth-child(4n+2):hover]:stroke-blue-400/90 [&:nth-child(4n+3):hover]:fill-indigo-500/60 [&:nth-child(4n+3):hover]:stroke-indigo-500/80 dark:[&:nth-child(4n+3):hover]:fill-indigo-400/70 dark:[&:nth-child(4n+3):hover]:stroke-indigo-400/90 [&:nth-child(4n+4):hover]:fill-red-500/60 [&:nth-child(4n+4):hover]:stroke-red-500/80 dark:[&:nth-child(4n+4):hover]:fill-red-400/70 dark:[&:nth-child(4n+4):hover]:stroke-red-400/90 transition-all duration-300 hover:scale-[1.02]" 
/>
      {/* Header Section */}
      <div className="relative z-50 container mx-auto px-4 py-8">
        {/* Welcome Header */}
        <AnimatePresence>
          {headerVisible && (
            <motion.div 
              className="mb-8 text-center"
              exit={{ opacity: 0, y: -20, height: 0 }}
              transition={{ duration: 0.6, ease: "easeInOut" }}
            >
              <TextAnimate
                animation="scaleUp"
                by="text"
                delay={0.2}
                duration={0.8}
                className="text-3xl md:text-4xl font-bold text-foreground mb-4"
              >
               MyDashboard
              </TextAnimate>
              
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1.2, duration: 0.6 }}
                className="flex items-center justify-center gap-4"
              >
                <div className="glass-hierarchy-interactive px-4 py-2 rounded-lg cursor-pointer hover:scale-[1.02] transition-transform"
                     onClick={() => dashboardState.setCommandOpen(true)}>
                  <div className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
                    <Command className="h-4 w-4" />
                    <span className="text-sm">Press ⌘K to open command palette</span>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Persistent Command Palette Button */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="fixed top-4 right-4 z-40"
        >
          <div className="glass-hierarchy-interactive px-3 py-2 rounded-lg cursor-pointer hover:scale-[1.02] transition-transform"
               onClick={() => dashboardState.setCommandOpen(true)}>
            <div className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
              <Command className="h-4 w-4" />
              <span className="text-xs">⌘K</span>
            </div>
          </div>
        </motion.div>

        {/* Setup Required Banner */}
        {userProfile && !userProfile.countryId && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-hierarchy-parent p-6 rounded-xl mb-4 text-center border border-yellow-400/30"
          >
            <div className="flex items-center justify-center gap-3 mb-4">
              <Star className="h-6 w-6 text-yellow-400" />
              <h3 className="text-xl font-semibold">Complete Your Command Setup</h3>
            </div>
            <p className="text-muted-foreground mb-4">
              Configure your country profile to unlock MyCountry®, ECI, and SDI intelligence modules.
            </p>
            <Link
              href={createAbsoluteUrl("/setup")}
              className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-white font-medium rounded-lg transition-all duration-200"
            >
              <Target className="h-4 w-4" />
              Initialize MyDashboard
            </Link>
          </motion.div>
        )}

        {/* Dynamic Bento Grid Layout */}
        <DashboardLayout>
          {/* Live Activity Marquee - Prominent placement at top */}
          <DashboardErrorBoundary
            title="Activity Feed Error"
            description="Unable to load activity feed. This won't affect other dashboard features."
            showHomeButton={false}
          >
            <ActivityFeedCard
              countries={processedCountries}
              userCountry={countryData ? {
                id: countryData.id,
                name: countryData.name,
                currentPopulation: countryData.currentPopulation,
                currentGdpPerCapita: countryData.currentGdpPerCapita,
                currentTotalGdp: countryData.currentTotalGdp || (countryData.currentPopulation * countryData.currentGdpPerCapita),
                economicTier: countryData.economicTier,
                populationTier: countryData.populationTier || 'Medium',
                adjustedGdpGrowth: countryData.adjustedGdpGrowth || 0,
                populationGrowthRate: countryData.populationGrowthRate || 0
              } : undefined}
              isLoading={countriesLoading}
            />
          </DashboardErrorBoundary>

          {/* Top Section Grid - MyCountry (8 span) + Global Intelligence (4 span) */}
          <DashboardRow>
            {/* MyCountry Section - 8 columns (12 when global is slid away) */}
            <DashboardErrorBoundary
              title="MyCountry Section Error"
              description="Unable to load your country data. Please try refreshing the page."
              showHomeButton={false}
            >
              <MyCountryCard
              countryData={countryData ? {
                id: countryData.id,
                name: countryData.name,
                currentPopulation: countryData.currentPopulation,
                currentGdpPerCapita: countryData.currentGdpPerCapita,
                currentTotalGdp: countryData.currentTotalGdp || (countryData.currentPopulation * countryData.currentGdpPerCapita),
                economicTier: countryData.economicTier,
                populationTier: countryData.populationTier || 'Medium',
                adjustedGdpGrowth: countryData.adjustedGdpGrowth || 0,
                populationGrowthRate: countryData.populationGrowthRate || 0,
                populationDensity: countryData.populationDensity,
                continent: countryData.continent,
                region: countryData.region,
                governmentType: countryData.governmentType,
                religion: countryData.religion,
                leader: countryData.leader
              } : undefined}
              activityRingsData={activityRingsData}
              expandedCards={dashboardState.expandedCards}
              setExpandedCards={dashboardState.setExpandedCards}
              setActivityPopoverOpen={dashboardState.setActivityPopoverOpen}
              isRippleActive={dashboardState.isRippleActive}
              isGlobalCardSlid={dashboardState.isGlobalCardSlid}
              className={cn(
                dashboardState.isGlobalCardSlid ? "lg:col-span-12" : "lg:col-span-8"
              )}
              />
            </DashboardErrorBoundary>

            {/* Global Intelligence Section - 4 columns (hidden when slid away) */}
            <DashboardErrorBoundary
              title="Global Stats Error"
              description="Unable to load global statistics. Other dashboard features remain available."
              showHomeButton={false}
            >
              <GlobalStatsCard
              processedCountries={processedCountries}
              globalStats={adaptedGlobalStats}
              powerGrouped={powerGrouped}
              activeCrises={activeCrises}
              intelligenceFeed={intelligenceFeed}
              economicIndicators={economicIndicators}
              isGlobalCardHovered={dashboardState.isGlobalCardHovered}
              setIsGlobalCardHovered={dashboardState.setIsGlobalCardHovered}
              isGlobalCollapsing={dashboardState.isGlobalCollapsing}
              isGlobalCardSlid={dashboardState.isGlobalCardSlid}
              collapseGlobalCard={dashboardState.collapseGlobalCard}
              />
            </DashboardErrorBoundary>
          </DashboardRow>

          {/* Section Separator */}
          <DashboardSeparator title="MyCountry® Premium Suite" />

          {/* Middle Section Grid - ECI (6 span) + SDI (6 span) */}
          <DashboardRow>
            <DashboardErrorBoundary
              title="ECI Suite Error"
              description="Unable to load Economic Command Intelligence suite."
              showHomeButton={false}
            >
              <ECICard
              countryData={countryData ? {
                id: countryData.id,
                name: countryData.name,
                currentPopulation: countryData.currentPopulation,
                currentGdpPerCapita: countryData.currentGdpPerCapita,
                currentTotalGdp: countryData.currentTotalGdp || (countryData.currentPopulation * countryData.currentGdpPerCapita),
                economicTier: countryData.economicTier,
                populationTier: countryData.populationTier || 'Medium',
                populationDensity: countryData.populationDensity,
                landArea: countryData.landArea
              } : undefined}
              userProfile={userProfile}
              userId={user?.id}
              isEciExpanded={dashboardState.isEciExpanded}
              toggleEciExpansion={dashboardState.toggleEciExpansion}
              focusedCard={dashboardState.focusedCard}
              setFocusedCard={dashboardState.setFocusedCard}
              />
            </DashboardErrorBoundary>

            <DashboardErrorBoundary
              title="SDI Suite Error"
              description="Unable to load Strategic Defense Intelligence suite."
              showHomeButton={false}
            >
              <SDICard
              userProfile={userProfile}
              isSdiExpanded={dashboardState.isSdiExpanded}
              toggleSdiExpansion={dashboardState.toggleSdiExpansion}
              focusedCard={dashboardState.focusedCard}
              setFocusedCard={dashboardState.setFocusedCard}
              />
            </DashboardErrorBoundary>
          </DashboardRow>

          {/* Section Separator */}
          <DashboardSeparator title="Additional Modules" />
        </DashboardLayout>

        {/* OLD CONTENT REMOVED - Replaced with modular dashboard cards above */}

        {/* Activity Popovers */}
        {countryData && (
          <>
            <ActivityPopover
              open={dashboardState.activityPopoverOpen === 0}
              anchorEl={null}
              onClose={() => dashboardState.setActivityPopoverOpen(null)}
              countryData={{
                name: countryData.name,
                currentGdpPerCapita: countryData.currentGdpPerCapita,
                currentTotalGdp: countryData.currentTotalGdp,
                currentPopulation: countryData.currentPopulation,
                populationGrowthRate: countryData.populationGrowthRate || 0,
                adjustedGdpGrowth: countryData.adjustedGdpGrowth || 0,
                economicTier: countryData.economicTier,
                populationTier: countryData.populationTier || "Unknown",
                populationDensity: countryData.populationDensity || 0
              }}
              selectedRing={0}
            />

            <ActivityPopover
              open={dashboardState.activityPopoverOpen === 1}
              anchorEl={null}
              onClose={() => dashboardState.setActivityPopoverOpen(null)}
              countryData={{
                name: countryData.name,
                currentGdpPerCapita: countryData.currentGdpPerCapita,
                currentTotalGdp: countryData.currentTotalGdp,
                currentPopulation: countryData.currentPopulation,
                populationGrowthRate: countryData.populationGrowthRate || 0,
                adjustedGdpGrowth: countryData.adjustedGdpGrowth || 0,
                economicTier: countryData.economicTier,
                populationTier: countryData.populationTier || "Unknown",
                populationDensity: countryData.populationDensity || 0
              }}
              selectedRing={1}
            />

            <ActivityPopover
              open={dashboardState.activityPopoverOpen === 2}
              anchorEl={null}
              onClose={() => dashboardState.setActivityPopoverOpen(null)}
              countryData={{
                name: countryData.name,
                currentGdpPerCapita: countryData.currentGdpPerCapita,
                currentTotalGdp: countryData.currentTotalGdp,
                currentPopulation: countryData.currentPopulation,
                populationGrowthRate: countryData.populationGrowthRate || 0,
                adjustedGdpGrowth: countryData.adjustedGdpGrowth || 0,
                economicTier: countryData.economicTier,
                populationTier: countryData.populationTier || "Unknown",
                populationDensity: countryData.populationDensity || 0
              }}
              selectedRing={2}
            />

            <ActivityPopover
              open={dashboardState.activityPopoverOpen === 3}
              anchorEl={null}
              onClose={() => dashboardState.setActivityPopoverOpen(null)}
              countryData={{
                name: countryData.name,
                currentGdpPerCapita: countryData.currentGdpPerCapita,
                currentTotalGdp: countryData.currentTotalGdp,
                currentPopulation: countryData.currentPopulation,
                populationGrowthRate: countryData.populationGrowthRate || 0,
                adjustedGdpGrowth: countryData.adjustedGdpGrowth || 0,
                economicTier: countryData.economicTier,
                populationTier: countryData.populationTier || "Unknown",
                populationDensity: countryData.populationDensity || 0
              }}
              selectedRing={3}
            />
          </>
        )}

        {/* Command Palette */}
        <CommandDialog open={dashboardState.commandOpen} onOpenChange={dashboardState.setCommandOpen}>
          <CommandInput placeholder="Search commands and navigation..." />
          <CommandList>
            <CommandEmpty>No results found.</CommandEmpty>
            
            {commandItems.map((group, groupIndex) => (
              <CommandGroup key={groupIndex} heading={group.group}>
                {group.items.map((item, itemIndex) => (
                  <CommandItem
                    key={itemIndex}
                    onSelect={() => {
                      item.action();
                      dashboardState.setCommandOpen(false);
                    }}
                  >
                    {item.icon}
                    <span>{item.title}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </CommandList>
        </CommandDialog>
      </div>
      </div>
    </React.Fragment>
  );
}
