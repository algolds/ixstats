"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { useUser } from "@clerk/nextjs";
import { api } from "~/trpc/react";
import { createUrl } from "~/lib/url-utils";

// UI Components
import { TextAnimate } from "~/components/magicui/text-animate";
import { Badge } from "~/components/ui/badge";
import { ActivityPopover } from "~/components/ui/activity-modal";
import { AppleRippleEffect } from "~/components/ui/apple-ripple-effect";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "~/components/ui/dropdown-menu";

// Dashboard Components
import { LiveActivityMarquee } from "./LiveActivityMarquee";
import { MyCountryCard } from "./MyCountryCard";
import { GlobalIntelligenceCard } from "./GlobalIntelligenceCard";
import { ECICard } from "./ECICard";
import { SDICard } from "./SDICard";
import { TrendingTopicsCard } from "./TrendingTopicsCard";
import { ThinkPagesHubCard } from "./ThinkPagesHubCard";
import { ThinkPagesStatusCard } from "./ThinkPagesStatusCard";
import { StrategicOperationsSuite } from "./StrategicOperationsSuite";
import { DiplomaticOperationsCard } from "./DiplomaticOperationsCard";
import { StrategicCommunicationsCard } from "./StrategicCommunicationsCard";

// Icons
import { 
  Crown, AlertTriangle, Star, Target, Command, ChevronLeft, ChevronRight, Settings, Eye, EyeOff
} from "lucide-react";

// Utils
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

const DashboardRefactoredModular = React.memo(function DashboardRefactoredModular() {
  const { user } = useUser();
  const [commandOpen, setCommandOpen] = useState(false);
  const [activityPopoverOpen, setActivityPopoverOpen] = useState<number | null>(null);
  const [headerVisible] = useState(false);
  const [focusedCard, setFocusedCard] = useState<string | null>(null);
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
  
  // Individual expansion states for each card
  const [isEciExpanded, setIsEciExpanded] = useState(false);
  const [isSdiExpanded, setIsSdiExpanded] = useState(false);
  const [isGlobalCardSlid, setIsGlobalCardSlid] = useState(false);
  const [isGlobalCardHovered, setIsGlobalCardHovered] = useState(false);
  const [isGlobalCollapsing, setIsGlobalCollapsing] = useState(false);
  const [isRippleActive, setIsRippleActive] = useState(false);
  
  // Sidebar collapse states
  const [isLeftSidebarCollapsed, setIsLeftSidebarCollapsed] = useState(false);
  const [isRightSidebarCollapsed, setIsRightSidebarCollapsed] = useState(false);

  // Load expanded cards from cookie on mount
  useEffect(() => {
    const savedExpanded = document.cookie
      .split('; ')
      .find(row => row.startsWith('dashboardExpanded='))
      ?.split('=')[1];
    
    if (savedExpanded) {
      try {
        const expanded = JSON.parse(decodeURIComponent(savedExpanded));
        setExpandedCards(new Set(expanded));
      } catch (e) {
        console.warn('Failed to parse saved expanded cards:', e);
      }
    }
  }, []);

  // Save expanded cards to cookie whenever it changes (debounced for performance)
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      const expandedArray = Array.from(expandedCards);
      const expires = new Date();
      expires.setFullYear(expires.getFullYear() + 1); // 1 year expiry
      document.cookie = `dashboardExpanded=${encodeURIComponent(JSON.stringify(expandedArray))}; expires=${expires.toUTCString()}; path=/`;
    }, 500); // 500ms debounce
    
    return () => clearTimeout(timeoutId);
  }, [expandedCards]);

  // Helper functions to toggle individual card expansions
  const toggleEciExpansion = () => {
    setIsEciExpanded(prev => !prev);
  };

  const toggleSdiExpansion = () => {
    setIsSdiExpanded(prev => !prev);
  };

  // Apple-style fast collapse animation - everything happens in parallel
  const collapseGlobalCard = () => {
    // Start all animations simultaneously for snappy Apple-like feel
    setIsRippleActive(true);
    setIsGlobalCollapsing(true);
    
    // Quick parallel execution - completed in 400ms total
    setTimeout(() => {
      setIsGlobalCardSlid(true);
    }, 200); // Start slide immediately after collapse begins
    
    // Fast cleanup for responsive feel
    setTimeout(() => {
      setIsRippleActive(false);
      setIsGlobalCollapsing(false);
    }, 400); // Complete everything in 400ms total
  };

  // Command palette keyboard shortcut
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setCommandOpen((open) => !open);
      }
      if (e.key === "Escape") {
        setCommandOpen(false);
        setFocusedCard(null);
        setExpandedCards(new Set());
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  // Data fetching
  const { data: userProfile } = api.users.getProfile.useQuery(
    { userId: user?.id || 'placeholder-disabled' },
    { enabled: !!user?.id }
  );

  const { data: globalStatsData, error: statsError } = api.countries.getGlobalStats.useQuery(undefined, {
    retry: 1,
    retryDelay: 1000
  });

  const { data: countryData } = api.countries.getByIdAtTime.useQuery(
    { id: userProfile?.countryId || '' },
    { enabled: !!userProfile?.countryId, retry: 1, retryDelay: 1000 }
  );

  // Get activity rings data using the centralized API (same as MyCountry page)
  const { data: activityRingsData } = api.countries.getActivityRingsData.useQuery(
    { countryId: userProfile?.countryId || '' },
    { enabled: !!userProfile?.countryId, retry: 1, retryDelay: 1000 }
  );

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
    return countriesRaw.map((country) => ({
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
    }));
  }, [allData]);

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
        {/* Simplified Static Background Grid - Better Performance */}
        <div className="absolute inset-0 opacity-20 dark:opacity-15">
          <div 
            className="w-full h-full"
            style={{
              backgroundImage: `
                linear-gradient(rgba(148, 163, 184, 0.1) 1px, transparent 1px),
                linear-gradient(90deg, rgba(148, 163, 184, 0.1) 1px, transparent 1px)
              `,
              backgroundSize: '40px 40px'
            }}
          />
        </div>
        
        {/* Header Section */}
        <div className="relative z-50 w-full px-2 py-4">
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
                       onClick={() => setCommandOpen(true)}>
                    <div className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
                      <Command className="h-4 w-4" />
                      <span className="text-sm">Press ⌘K to open command palette</span>
                    </div>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Persistent Command Palette and Settings */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="fixed top-4 left-4 z-50 flex gap-2"
          >
            <div className="glass-hierarchy-interactive px-3 py-2 rounded-lg cursor-pointer hover:scale-[1.02] transition-transform"
                 onClick={() => setCommandOpen(true)}>
              <div className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
                <Command className="h-4 w-4" />
                <span className="text-xs">⌘K</span>
              </div>
            </div>
            
            {/* Settings Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger className="glass-hierarchy-interactive px-3 py-2 rounded-lg cursor-pointer hover:scale-[1.02] transition-transform">
                <div className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
                  <Settings className="h-4 w-4" />
                </div>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56">
                <DropdownMenuItem 
                  onClick={() => setIsLeftSidebarCollapsed(false)}
                  disabled={!isLeftSidebarCollapsed}
                  className="flex items-center gap-2"
                >
                  <Eye className="h-4 w-4" />
                  Show Global Intelligence
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => setIsRightSidebarCollapsed(false)}
                  disabled={!isRightSidebarCollapsed}
                  className="flex items-center gap-2"
                >
                  <Eye className="h-4 w-4" />
                  Show ThinkPages Hub
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => {
                    setIsLeftSidebarCollapsed(false);
                    setIsRightSidebarCollapsed(false);
                  }}
                  disabled={!isLeftSidebarCollapsed && !isRightSidebarCollapsed}
                  className="flex items-center gap-2"
                >
                  <Eye className="h-4 w-4" />
                  Show All Sidebars
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
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
                Configure your country profile to unlock MyCountry® and other intelligence modules.
              </p>
              <Link
                href={createUrl("/setup")}
                className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-white font-medium rounded-lg transition-all duration-200"
              >
                <Target className="h-4 w-4" />
                Initialize MyDashboard
              </Link>
            </motion.div>
          )}

          {/* New 3-Column Layout */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className={cn(
              "grid grid-cols-1 gap-4 md:gap-6 lg:gap-12 max-w-none mx-2 transition-all duration-500 ease-in-out",
              isLeftSidebarCollapsed && isRightSidebarCollapsed 
                ? "lg:grid-cols-1" 
                : isLeftSidebarCollapsed || isRightSidebarCollapsed 
                  ? "lg:grid-cols-4" 
                  : "lg:grid-cols-5"
            )}
          >
            {/* Left Sidebar */}
            <AnimatePresence>
              {!isLeftSidebarCollapsed && (
                <motion.div 
                  className="lg:col-span-1 sticky top-8 self-start hidden lg:block"
                  initial={{ opacity: 1 }}
                  exit={{ 
                    opacity: 0,
                    transition: { duration: 0.2 }
                  }}
                  transition={{ duration: 0.2 }}
                >
                  
                  <GlobalIntelligenceCard
                    adaptedGlobalStats={adaptedGlobalStats}
                    sdiData={{
                      activeCrises,
                      intelligenceFeed,
                      economicIndicators
                    }}
                    setIsGlobalCardHovered={setIsGlobalCardHovered}
                    collapseGlobalCard={() => setIsLeftSidebarCollapsed(true)}
                    isGlobalCollapsing={isGlobalCollapsing}
                    isGlobalCardSlid={isGlobalCardSlid}
                    className="h-full"
                  />
                </motion.div>
              )}
            </AnimatePresence>

            {/* Main Content */}
            <div className={cn(
              "space-y-12 transition-all duration-500 ease-in-out",
              isLeftSidebarCollapsed && isRightSidebarCollapsed 
                ? "lg:col-span-1" 
                : isLeftSidebarCollapsed || isRightSidebarCollapsed 
                  ? "lg:col-span-3" 
                  : "lg:col-span-3"
            )}>
              <LiveActivityMarquee
                countries={processedCountries}
                userCountry={countryData ? {
                  id: countryData.id,
                  name: countryData.name,
                  currentPopulation: countryData.calculatedStats?.currentPopulation || 0,
                  currentGdpPerCapita: countryData.calculatedStats?.currentGdpPerCapita || 0,
                  currentTotalGdp: countryData.calculatedStats?.currentTotalGdp || 0,
                  economicTier: countryData.calculatedStats?.economicTier || 'Unknown',
                  populationTier: countryData.calculatedStats?.populationTier || 'Medium',
                  adjustedGdpGrowth: countryData.calculatedStats?.adjustedGdpGrowth || 0,
                  populationGrowthRate: countryData.calculatedStats?.populationGrowthRate || 0
                } : undefined}
                isLoading={countriesLoading}
              />

              <MyCountryCard
                countryData={countryData ? {
                  id: countryData.id,
                  name: countryData.name,
                  currentPopulation: countryData.calculatedStats?.currentPopulation || 0,
                  currentGdpPerCapita: countryData.calculatedStats?.currentGdpPerCapita || 0,
                  currentTotalGdp: countryData.calculatedStats?.currentTotalGdp || 0,
                  economicTier: countryData.calculatedStats?.economicTier || 'Unknown',
                  populationTier: countryData.calculatedStats?.populationTier || 'Medium',
                  adjustedGdpGrowth: countryData.calculatedStats?.adjustedGdpGrowth || 0,
                  populationGrowthRate: countryData.calculatedStats?.populationGrowthRate || 0,
                  populationDensity: countryData.calculatedStats?.populationDensity,
                  continent: countryData.continent,
                  region: countryData.region,
                  governmentType: countryData.governmentType,
                  religion: countryData.religion,
                  leader: countryData.leader
                } : undefined}
                activityRingsData={activityRingsData}
                expandedCards={expandedCards}
                setExpandedCards={setExpandedCards}
                setActivityPopoverOpen={setActivityPopoverOpen}
                isRippleActive={isRippleActive}
                isGlobalCardSlid={isGlobalCardSlid}
              />

              <StrategicOperationsSuite userProfile={userProfile} />

              {/* Section Separator */}
              <div className="relative my-8">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-neutral-200 dark:border-white/[0.2]" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="glass-hierarchy-parent px-4 py-2 rounded-full text-muted-foreground">MyCountry® Premium Suite</span>
                </div>
              </div>

              {/* Bottom Section Grid - ECI (6 span) + SDI (6 span) */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <ECICard
                  countryData={countryData ? {
                    id: countryData.id,
                    name: countryData.name,
                    currentPopulation: countryData.calculatedStats?.currentPopulation || 0,
                    currentGdpPerCapita: countryData.calculatedStats?.currentGdpPerCapita || 0,
                    currentTotalGdp: countryData.calculatedStats?.currentTotalGdp || 0,
                    economicTier: countryData.calculatedStats?.economicTier || 'Unknown',
                    populationTier: countryData.calculatedStats?.populationTier || 'Medium',
                    populationDensity: countryData.calculatedStats?.populationDensity,
                    landArea: countryData.landArea
                  } : undefined}
                  userProfile={userProfile}
                  userId={user?.id}
                  isEciExpanded={isEciExpanded}
                  toggleEciExpansion={toggleEciExpansion}
                  focusedCard={focusedCard}
                  setFocusedCard={setFocusedCard}
                />

                <SDICard
                  userProfile={userProfile}
                  isSdiExpanded={isSdiExpanded}
                  toggleSdiExpansion={toggleSdiExpansion}
                  focusedCard={focusedCard}
                  setFocusedCard={setFocusedCard}
                />
              </div>

              {/* Section Separator */}
              <div className="relative my-8">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-neutral-200 dark:border-white/[0.2]" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="glass-hierarchy-parent px-4 py-2 rounded-full text-muted-foreground">Additional Modules</span>
                </div>
              </div>
            </div>

            {/* Right Sidebar */}
            <AnimatePresence>
              {!isRightSidebarCollapsed && (
                <motion.div 
                  className="lg:col-span-1 sticky top-8 self-start hidden lg:block"
                  initial={{ opacity: 1 }}
                  exit={{ 
                    opacity: 0,
                    transition: { duration: 0.2 }
                  }}
                  transition={{ duration: 0.2 }}
                >
                  
                  <ThinkPagesStatusCard 
                    userProfile={userProfile} 
                    className="h-full"
                    onCollapse={() => setIsRightSidebarCollapsed(true)}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          {/* Collapsed Sidebar Expand Buttons */}
          <AnimatePresence>
            {isLeftSidebarCollapsed && (
              <motion.button
                className="fixed left-2 top-1/2 -translate-y-1/2 z-40 glass-hierarchy-interactive w-8 h-12 rounded-r-lg flex items-center justify-center transition-transform"
                onClick={() => setIsLeftSidebarCollapsed(false)}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
              >
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </motion.button>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {isRightSidebarCollapsed && (
              <motion.button
                className="fixed right-2 top-1/2 -translate-y-1/2 z-40 glass-hierarchy-interactive w-8 h-12 rounded-l-lg flex items-center justify-center transition-transform"
                onClick={() => setIsRightSidebarCollapsed(false)}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
              >
                <ChevronLeft className="h-4 w-4 text-muted-foreground" />
              </motion.button>
            )}
          </AnimatePresence>

          {/* Mobile Sidebar Content */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.2 }}
            className="lg:hidden space-y-6 max-w-none mx-2"
          >
            <GlobalIntelligenceCard
              adaptedGlobalStats={adaptedGlobalStats}
              sdiData={{
                activeCrises,
                intelligenceFeed,
                economicIndicators
              }}
              setIsGlobalCardHovered={setIsGlobalCardHovered}
              collapseGlobalCard={collapseGlobalCard}
              isGlobalCollapsing={isGlobalCollapsing}
              isGlobalCardSlid={isGlobalCardSlid}
              className="w-full"
            />
            <ThinkPagesStatusCard userProfile={userProfile} className="w-full" />
          </motion.div>

          {/* Activity Popovers */}
          {countryData && (
            <>
              <ActivityPopover
                open={activityPopoverOpen === 0}
                anchorEl={null}
                onClose={() => setActivityPopoverOpen(null)}
                countryData={{
                  name: countryData.name,
                  currentGdpPerCapita: countryData.calculatedStats?.currentGdpPerCapita ?? 0,
                  currentTotalGdp: countryData.calculatedStats?.currentTotalGdp ?? 0,
                  currentPopulation: countryData.calculatedStats?.currentPopulation ?? 0,
                  populationGrowthRate: countryData.populationGrowthRate || 0,
                  adjustedGdpGrowth: countryData.adjustedGdpGrowth || 0,
                  economicTier: countryData.calculatedStats?.economicTier ?? "Unknown",
                  populationTier: countryData.calculatedStats?.populationTier || "Unknown",
                  populationDensity: countryData.calculatedStats?.populationDensity || 0
                }}
                selectedRing={0}
              />

              <ActivityPopover
                open={activityPopoverOpen === 1}
                anchorEl={null}
                onClose={() => setActivityPopoverOpen(null)}
                countryData={{
                  name: countryData.name,
                  currentGdpPerCapita: countryData.calculatedStats?.currentGdpPerCapita ?? 0,
                  currentTotalGdp: countryData.calculatedStats?.currentTotalGdp ?? 0,
                  currentPopulation: countryData.calculatedStats?.currentPopulation ?? 0,
                  populationGrowthRate: countryData.populationGrowthRate || 0,
                  adjustedGdpGrowth: countryData.adjustedGdpGrowth || 0,
                  economicTier: countryData.calculatedStats?.economicTier ?? "Unknown",
                  populationTier: countryData.calculatedStats?.populationTier || "Unknown",
                  populationDensity: countryData.calculatedStats?.populationDensity || 0
                }}
                selectedRing={1}
              />

              <ActivityPopover
                open={activityPopoverOpen === 2}
                anchorEl={null}
                onClose={() => setActivityPopoverOpen(null)}
                countryData={{
                  name: countryData.name,
                  currentGdpPerCapita: countryData.calculatedStats?.currentGdpPerCapita ?? 0,
                  currentTotalGdp: countryData.calculatedStats?.currentTotalGdp ?? 0,
                  currentPopulation: countryData.calculatedStats?.currentPopulation ?? 0,
                  populationGrowthRate: countryData.populationGrowthRate || 0,
                  adjustedGdpGrowth: countryData.adjustedGdpGrowth || 0,
                  economicTier: countryData.calculatedStats?.economicTier ?? "Unknown",
                  populationTier: countryData.calculatedStats?.populationTier || "Unknown",
                  populationDensity: countryData.calculatedStats?.populationDensity || 0
                }}
                selectedRing={2}
              />
            </>
          )}

        </div>
      </div>
    </React.Fragment>
  );
});

export default DashboardRefactoredModular;