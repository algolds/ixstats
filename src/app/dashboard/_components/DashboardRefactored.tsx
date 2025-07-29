"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { useUser } from "@clerk/nextjs";
import { api } from "~/trpc/react";
import { createUrl } from "~/lib/url-utils";

// UI Components
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "~/components/ui/command";
import { TextAnimate } from "~/components/magicui/text-animate";
import { Badge } from "~/components/ui/badge";
import { SimpleFlag } from "~/components/SimpleFlag";
import { ActivityPopover } from "~/components/ui/activity-modal";
import { Popover, PopoverTrigger, PopoverContent } from "~/components/ui/popover";
import { Button } from "~/components/ui/button";
import { Progress } from "~/components/ui/progress";
import { ExecutiveActivityRings } from "~/components/ui/executive-activity-rings";
import { RubiksCubeFlags } from "~/components/ui/rubiks-cube-flags";
import { ThemedTabContent } from "~/components/ui/themed-tab-content";
import { CountryExecutiveSection } from "~/app/countries/_components/CountryExecutiveSection";
import { CountryIntelligenceSection } from "~/app/countries/_components/CountryIntelligenceSection";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "~/components/ui/dropdown-menu";
import { Tooltip, TooltipTrigger, TooltipContent } from "~/components/ui/tooltip";
import { AppleRippleEffect } from "~/components/ui/apple-ripple-effect";
import { InteractiveGridPattern } from "~/components/magicui/interactive-grid-pattern";
import { GlassActivityMarquee } from "./GlassActivityMarquee";
// Icons
import { 
  Crown, Building2, Globe, Shield, Settings, TrendingUp, 
  Users, DollarSign, Command, Activity,
  BarChart3, AlertTriangle,
  Target, Star, ChevronDown, ChevronUp, ChevronLeft,
  Gauge, Eye, Brain, Plus, FileText, Briefcase,
  Calculator, Search, ExternalLink
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

  // Save expanded cards to cookie whenever it changes
  useEffect(() => {
    const expandedArray = Array.from(expandedCards);
    const expires = new Date();
    expires.setFullYear(expires.getFullYear() + 1); // 1 year expiry
    document.cookie = `dashboardExpanded=${encodeURIComponent(JSON.stringify(expandedArray))}; expires=${expires.toUTCString()}; path=/`;
  }, [expandedCards]);

  // Helper functions to toggle individual card expansions
  const toggleEciExpansion = () => {
    setIsEciExpanded(prev => !prev);
  };

  const toggleSdiExpansion = () => {
    setIsSdiExpanded(prev => !prev);
  };

  // Apple Intelligence-style collapse animation
  const collapseGlobalCard = () => {
    // Start ripple effect on MyCountry card
    setIsRippleActive(true);
    
    // Phase 1: Begin visual collapse
    setIsGlobalCollapsing(true);
    
    // Phase 2: Complete merge after ripple
    setTimeout(() => {
      setIsGlobalCardSlid(true);
      setIsRippleActive(false);
      
      // Phase 3: Cleanup
      setTimeout(() => {
        setIsGlobalCollapsing(false);
      }, 600);
    }, 1200); // Align with new ripple timing
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

  // Data fetching
  const { data: userProfile } = api.users.getProfile.useQuery(
    { userId: user?.id || '' },
    { enabled: !!user?.id }
  );



  const { data: globalStatsData, error: statsError } = api.countries.getGlobalStats.useQuery(undefined, {
    retry: 1,
    retryDelay: 1000
  });

  const { data: countryData } = api.countries.getByIdWithEconomicData.useQuery(
    { id: userProfile?.countryId || '' },
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
          { title: "Go to Countries", icon: <Globe className="h-4 w-4" />, action: () => window.location.href = createUrl("/countries/new") },
          { title: "View Analytics", icon: <BarChart3 className="h-4 w-4" />, action: () => window.location.href = createUrl("/analytics") },
          { title: "Open Settings", icon: <Settings className="h-4 w-4" />, action: () => window.location.href = createUrl("/settings") },
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
          { title: "Go to MyCountry", icon: <Crown className="h-4 w-4" />, action: () => window.location.href = createUrl("/mycountry") },
          { title: "Open ECI Suite", icon: <Gauge className="h-4 w-4" />, action: () => window.location.href = createUrl("/eci") },
          { title: "Access SDI Intelligence", icon: <Eye className="h-4 w-4" />, action: () => window.location.href = createUrl("/sdi") },
        ]
      });
    } else {
      // Show setup-related commands for users without country profiles
      baseItems.splice(1, 0, {
        group: "Setup Required",
        items: [
          { title: "Complete Setup", icon: <Target className="h-4 w-4" />, action: () => window.location.href = createUrl("/setup") },
          { title: "Configure Profile", icon: <Settings className="h-4 w-4" />, action: () => window.location.href = createUrl("/profile") },
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

        {/* Persistent Command Palette Button */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="fixed top-4 right-4 z-40"
        >
          <div className="glass-hierarchy-interactive px-3 py-2 rounded-lg cursor-pointer hover:scale-[1.02] transition-transform"
               onClick={() => setCommandOpen(true)}>
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
              href={createUrl("/setup")}
              className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-white font-medium rounded-lg transition-all duration-200"
            >
              <Target className="h-4 w-4" />
              Initialize MyDashboard
            </Link>
          </motion.div>
        )}

        {/* Dynamic Bento Grid Layout */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="max-w-7xl mx-auto space-y-6"
        >
          {/* Live Activity Marquee - Prominent placement at top */}
          <GlassActivityMarquee
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
          {/* Top Section Grid - MyCountry (8 span) + Global Intelligence (4 span) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* MyCountry Section - 8 columns (12 when global is slid away) */}
<motion.div
  layout
  className={cn(
    isGlobalCardSlid ? "lg:col-span-12" : "lg:col-span-8"
  )}
>
<AppleRippleEffect
  isActive={isRippleActive}
  direction="right"
  className="rounded-xl"
>
<motion.div
  className={cn(
    "glass-hierarchy-parent relative overflow-hidden group",
    "rounded-xl border border-neutral-200 dark:border-white/[0.2] p-6 transition-all duration-200",
    "hover:shadow-xl hover:shadow-yellow-500/10 dark:hover:shadow-yellow-400/20 mycountry-card"
  )}
  whileHover={{ y: -2 }}
  transition={{ type: "spring", stiffness: 400, damping: 40 }}
  layout
  data-theme="executive"
>
{/* Full Bento Flag Background with Realistic Ripple */}
{countryData && (
  <div className="absolute inset-0 pointer-events-none overflow-hidden">
    <motion.div 
      className="w-full h-full relative"
      style={{
        filter: "blur(8px)",
        opacity: 0.4
      }}
    >
      <motion.div
        className="w-full h-full"
        animate={{
          x: [0, 2, -1, 1, 0],
          rotateY: [0, 1, -0.5, 0.5, 0],
          scaleX: [1, 1.01, 0.99, 1.005, 1]
        }}
        transition={{
          duration: 6,
          ease: "easeInOut",
          repeat: Infinity,
          times: [0, 0.25, 0.5, 0.75, 1]
        }}
      >
        <SimpleFlag 
          countryName={countryData.name}
          className="w-full h-full object-cover"
          showPlaceholder={true}
        />
      </motion.div>
    </motion.div>
    
    {/* Overlay to ensure readability */}
    <div className="absolute inset-0 bg-gradient-to-b from-background/70 via-background/50 to-background/80" />
  </div>
)}

{/* MyCountry Themed Shimmer Background */}
<div className="absolute inset-0 bg-gradient-to-br from-yellow-400/20 via-yellow-500/10 to-orange-400/20 mycountry-gold-shimmer" />
<div className="absolute inset-0 tab-shimmer" />

{/* Content Layout */}
<div className="relative z-10 h-full flex flex-col">
  {/* Top Section - Country Info */}
  <div className="flex items-center justify-between mb-6">
    <div className="flex items-center gap-3">
      <div className="w-12 h-8 rounded border border-white/30 overflow-hidden shadow-lg">
        {countryData && <SimpleFlag countryName={countryData.name} className="w-full h-full object-cover" />}
      </div>
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Crown className="h-5 w-5 text-yellow-400" />
          <h3 className="text-xl font-bold text-foreground drop-shadow-sm">MyCountry® Premium</h3>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-lg font-semibold text-foreground drop-shadow-sm">
            {countryData?.name || 'Configure Country'}
          </span>
          {countryData && (
            <Badge variant="secondary" className="bg-yellow-500/20 text-yellow-800 dark:text-yellow-200 border-yellow-400/50">
              {countryData.economicTier}
            </Badge>
          )}
        </div>
      </div>
    </div>
    
    {/* Dropdown Menu */}
    <DropdownMenu>
      <DropdownMenuTrigger>
        <div className="p-3 rounded-full glass-hierarchy-interactive glass-refraction transition-all duration-200 relative z-10 hover:scale-105 cursor-pointer">
          <Plus className="h-5 w-5 text-foreground" />
        </div>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56 glass-modal border-yellow-400/30">
        <DropdownMenuItem className="flex items-center gap-2 glass-hierarchy-interactive">
          <Crown className="h-4 w-4 text-yellow-400" />
          <span>MyCountry Profile</span>
          <ExternalLink className="h-3 w-3 ml-auto" />
        </DropdownMenuItem>
        <DropdownMenuItem className="flex items-center gap-2 glass-hierarchy-interactive">
          <TrendingUp className="h-4 w-4 text-green-400" />
          <span>Economic Dashboard</span>
        </DropdownMenuItem>
        <DropdownMenuItem className="flex items-center gap-2 glass-hierarchy-interactive">
          <Settings className="h-4 w-4 text-blue-400" />
          <span>Policy Management</span>
        </DropdownMenuItem>
        <DropdownMenuItem className="flex items-center gap-2 glass-hierarchy-interactive">
          <Users className="h-4 w-4 text-purple-400" />
          <span>Demographics</span>
        </DropdownMenuItem>
        <DropdownMenuItem className="flex items-center gap-2 glass-hierarchy-interactive">
          <Brain className="h-4 w-4 text-indigo-400" />
          <span>Intelligence Center</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  </div>

  {/* National Performance Metrics Section */}
  {countryData && (
    <ThemedTabContent theme="executive" className="tab-content-enter mb-6">
      <div className="space-y-4">
        <h4 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-green-400" />
          National Performance Metrics
        </h4>
        
        <div className="grid grid-cols-3 gap-3">
          {/* Economic Performance */}
          <div className="glass-hierarchy-child p-4 rounded-lg text-center cursor-pointer hover:scale-105 transition-transform"
               onClick={() => setActivityPopoverOpen(0)}>
            <div className="w-12 h-12 mx-auto mb-2 rounded-full bg-green-400/20 flex items-center justify-center">
              <TrendingUp className="h-6 w-6 text-green-400" />
            </div>
            <div className="text-lg font-bold text-green-400 mb-1">
              {Math.min(100, Math.round((countryData.currentGdpPerCapita / 70000) * 100))}%
            </div>
            <div className="text-xs text-muted-foreground">Economic Index</div>
          </div>
          
          {/* Social Performance */}
          <div className="glass-hierarchy-child p-4 rounded-lg text-center cursor-pointer hover:scale-105 transition-transform"
               onClick={() => setActivityPopoverOpen(1)}>
            <div className="w-12 h-12 mx-auto mb-2 rounded-full bg-blue-400/20 flex items-center justify-center">
              <Users className="h-6 w-6 text-blue-400" />
            </div>
            <div className="text-lg font-bold text-blue-400 mb-1">
              {Math.min(100, Math.round(85 + (countryData.populationGrowthRate * 1000)))}%
            </div>
            <div className="text-xs text-muted-foreground">Social Index</div>
          </div>
          
          {/* Governance Performance */}
          <div className="glass-hierarchy-child p-4 rounded-lg text-center cursor-pointer hover:scale-105 transition-transform"
               onClick={() => setActivityPopoverOpen(2)}>
            <div className="w-12 h-12 mx-auto mb-2 rounded-full bg-purple-400/20 flex items-center justify-center">
              <Crown className="h-6 w-6 text-purple-400" />
            </div>
            <div className="text-lg font-bold text-purple-400 mb-1">
              {countryData.economicTier === 'Extravagant' ? '95' : 
               countryData.economicTier === 'Very Strong' ? '88' : 
               countryData.economicTier === 'Strong' ? '82' : '75'}%
            </div>
            <div className="text-xs text-muted-foreground">Governance Index</div>
          </div>
        </div>
        
        {/* Performance Summary */}
        <div className="glass-hierarchy-child p-3 rounded-lg">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Overall Performance:</span>
            <div className="flex items-center gap-2">
              <div className="text-sm font-bold text-green-400">
                {Math.round((
                  Math.min(100, Math.round((countryData.currentGdpPerCapita / 70000) * 100)) +
                  Math.min(100, Math.round(85 + (countryData.populationGrowthRate * 1000))) +
                  (countryData.economicTier === 'Extravagant' ? 95 : 
                   countryData.economicTier === 'Very Strong' ? 88 : 
                   countryData.economicTier === 'Strong' ? 82 : 75)
                ) / 3)}%
              </div>
              <Badge variant="secondary" className="text-xs">
                {Math.round((
                  Math.min(100, Math.round((countryData.currentGdpPerCapita / 70000) * 100)) +
                  Math.min(100, Math.round(85 + (countryData.populationGrowthRate * 1000))) +
                  (countryData.economicTier === 'Extravagant' ? 95 : 
                   countryData.economicTier === 'Very Strong' ? 88 : 
                   countryData.economicTier === 'Strong' ? 82 : 75)
                ) / 3) >= 85 ? 'Excellent' : 
                Math.round((
                  Math.min(100, Math.round((countryData.currentGdpPerCapita / 70000) * 100)) +
                  Math.min(100, Math.round(85 + (countryData.populationGrowthRate * 1000))) +
                  (countryData.economicTier === 'Extravagant' ? 95 : 
                   countryData.economicTier === 'Very Strong' ? 88 : 
                   countryData.economicTier === 'Strong' ? 82 : 75)
                ) / 3) >= 75 ? 'Good' : 'Needs Improvement'}
              </Badge>
            </div>
          </div>
        </div>
      </div>
    </ThemedTabContent>
  )}

  {/* Key Metrics Grid - Always visible */}
  {countryData && (
    <div className="grid grid-cols-2 gap-3 mb-6">
      <div className="glass-hierarchy-child p-3 rounded-lg text-center">
        <div className="text-xs text-muted-foreground mb-1">Population</div>
        <div className="text-sm font-bold text-blue-400">
          {(countryData.currentPopulation / 1000000).toFixed(1)}M
        </div>
      </div>
      <div className="glass-hierarchy-child p-3 rounded-lg text-center">
        <div className="text-xs text-muted-foreground mb-1">GDP per Capita</div>
        <div className="text-sm font-bold text-green-400">
          ${(countryData.currentGdpPerCapita / 1000).toFixed(0)}k
        </div>
      </div>
      <div className="glass-hierarchy-child p-3 rounded-lg text-center">
        <div className="text-xs text-muted-foreground mb-1">Employment</div>
        <div className="text-sm font-bold text-purple-400">
          {(96.5 - (countryData.adjustedGdpGrowth < 0 ? 2 : 0)).toFixed(1)}%
        </div>
      </div>
      <div className="glass-hierarchy-child p-3 rounded-lg text-center">
        <div className="text-xs text-muted-foreground mb-1">Economic Health</div>
        <div className="text-sm font-bold text-green-400">
          {Math.min(100, Math.round((countryData.currentGdpPerCapita / 70000) * 100))}%
        </div>
      </div>
    </div>
  )}

  {/* Expandable Content - Only shows when expanded */}
  <AnimatePresence>
    {expandedCards.has('mycountry') && countryData && (
      <motion.div
        initial={{ opacity: 0, height: 0 }}
        animate={{ opacity: 1, height: "auto" }}
        exit={{ opacity: 0, height: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="mb-6 overflow-hidden"
      >
        <div className="space-y-6">
          {/* Location/Government/Leader/Religion Section */}
          <div>
            <h4 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
              <Globe className="h-5 w-5 text-blue-400" />
              Country Profile
            </h4>
            <div className="grid grid-cols-2 gap-3">
              {/* Location */}
              <div className="glass-hierarchy-child p-3 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Globe className="h-4 w-4 text-blue-400" />
                  <div className="text-xs text-muted-foreground">Location</div>
                </div>
                <div className="text-sm font-medium text-foreground">
                  {countryData.region ? `${countryData.region}, ${countryData.continent || 'Unknown'}` : (countryData.continent || 'Unknown Region')}
                </div>
              </div>
              
              {/* Government Type */}
              <div className="glass-hierarchy-child p-3 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Building2 className="h-4 w-4 text-purple-400" />
                  <div className="text-xs text-muted-foreground">Government</div>
                </div>
                <div className="text-sm font-medium text-foreground">
                  {countryData.governmentType || 'Constitutional Democracy'}
                </div>
              </div>
              
              {/* Leader */}
              <div className="glass-hierarchy-child p-3 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Crown className="h-4 w-4 text-yellow-400" />
                  <div className="text-xs text-muted-foreground">Leader</div>
                </div>
                <div className="text-sm font-medium text-foreground">
                  {countryData.leader || 'Prime Minister'}
                </div>
              </div>
              
              {/* Religion */}
              <div className="glass-hierarchy-child p-3 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Star className="h-4 w-4 text-indigo-400" />
                  <div className="text-xs text-muted-foreground">Religion</div>
                </div>
                <div className="text-sm font-medium text-foreground">
                  {countryData.religion || 'Secular Pluralism'}
                </div>
              </div>
            </div>
          </div>
          
          {/* Economic Health Indicators Section */}
          <div>
            <h4 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-green-400" />
              Economic Health Indicators
            </h4>
            <div className="space-y-3">
              {/* Unemployment Rate */}
              <div className="glass-hierarchy-child p-3 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-muted-foreground">Unemployment Rate</span>
                  <span className="text-xs text-muted-foreground">{(3.5 + (countryData.adjustedGdpGrowth < 0 ? 2 : 0)).toFixed(1)}%</span>
                </div>
                <Progress value={((3.5 + (countryData.adjustedGdpGrowth < 0 ? 2 : 0)) / 25) * 100} className="h-2" />
                <div className="flex justify-between text-xs text-muted-foreground mt-1">
                  <span>0%</span>
                  <span className="text-green-600">Optimal: 3-7%</span>
                  <span>25%</span>
                </div>
              </div>
              
              {/* Labor Force Participation */}
              <div className="glass-hierarchy-child p-3 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-muted-foreground">Labor Force Participation</span>
                  <span className="text-xs text-muted-foreground">{(68.5 + (countryData.currentGdpPerCapita / 100000) * 5).toFixed(1)}%</span>
                </div>
                <Progress value={68.5 + (countryData.currentGdpPerCapita / 100000) * 5} className="h-2" />
                <div className="flex justify-between text-xs text-muted-foreground mt-1">
                  <span>0%</span>
                  <span className="text-green-600">Optimal: 60-80%</span>
                  <span>100%</span>
                </div>
              </div>
              
              {/* Economic Growth Health */}
              <div className="glass-hierarchy-child p-3 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-muted-foreground">Economic Growth Health</span>
                  <span className="text-xs text-muted-foreground">{((countryData.adjustedGdpGrowth || 0) * 100).toFixed(1)}%</span>
                </div>
                <Progress value={Math.max(0, Math.min(100, ((countryData.adjustedGdpGrowth || 0) * 100 + 5) * 10))} className="h-2" />
                <div className="flex justify-between text-xs text-muted-foreground mt-1">
                  <span>-5%</span>
                  <span className="text-green-600">Optimal: 2-5%</span>
                  <span>10%</span>
                </div>
              </div>
              
              {/* Economic Stability Index */}
              <div className="glass-hierarchy-child p-3 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-muted-foreground">Economic Stability Index</span>
                  <span className="text-xs text-muted-foreground">{Math.min(100, Math.round((countryData.currentGdpPerCapita / 70000) * 100))}%</span>
                </div>
                <Progress value={Math.min(100, Math.round((countryData.currentGdpPerCapita / 70000) * 100))} className="h-2" />
                <div className="flex justify-between text-xs text-muted-foreground mt-1">
                  <span>0%</span>
                  <span className="text-green-600">Target: 85%+</span>
                  <span>100%</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    )}
  </AnimatePresence>

  {/* MyCountry Submodule Icons - Always at bottom */}
  {countryData && (
    <div className="mt-auto">
      {/* Expand/Collapse Button */}
      <div className="flex justify-center mb-4">
        <button
          onClick={() => {
            const newExpanded = new Set(expandedCards);
            if (newExpanded.has('mycountry')) {
              newExpanded.delete('mycountry');
            } else {
              newExpanded.add('mycountry');
            }
            setExpandedCards(newExpanded);
          }}
          className="px-4 py-2 glass-hierarchy-interactive rounded-lg text-sm font-medium text-foreground hover:scale-105 transition-transform flex items-center gap-2"
        >
          {expandedCards.has('mycountry') ? (
            <>
              <ChevronUp className="h-4 w-4" />
              Show Less
            </>
          ) : (
            <>
              <ChevronDown className="h-4 w-4" />
              Show More
            </>
          )}
        </button>
      </div>

      {/* Icons - Always visible at bottom */}
      <div className="flex flex-wrap gap-2 justify-center">
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="p-2 glass-hierarchy-child rounded-lg hover:scale-105 transition-transform cursor-pointer">
              <FileText className="h-4 w-4 text-blue-400" />
            </div>
          </TooltipTrigger>
          <TooltipContent>Overview</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="p-2 glass-hierarchy-child rounded-lg hover:scale-105 transition-transform cursor-pointer">
              <Crown className="h-4 w-4 text-yellow-400" />
            </div>
          </TooltipTrigger>
          <TooltipContent>Executive</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="p-2 glass-hierarchy-child rounded-lg hover:scale-105 transition-transform cursor-pointer">
              <TrendingUp className="h-4 w-4 text-green-400" />
            </div>
          </TooltipTrigger>
          <TooltipContent>Economy</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="p-2 glass-hierarchy-child rounded-lg hover:scale-105 transition-transform cursor-pointer">
              <Briefcase className="h-4 w-4 text-orange-400" />
            </div>
          </TooltipTrigger>
          <TooltipContent>Labor</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="p-2 glass-hierarchy-child rounded-lg hover:scale-105 transition-transform cursor-pointer">
              <Building2 className="h-4 w-4 text-purple-400" />
            </div>
          </TooltipTrigger>
          <TooltipContent>Government</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="p-2 glass-hierarchy-child rounded-lg hover:scale-105 transition-transform cursor-pointer">
              <Users className="h-4 w-4 text-pink-400" />
            </div>
          </TooltipTrigger>
          <TooltipContent>Demographics</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="p-2 glass-hierarchy-child rounded-lg hover:scale-105 transition-transform cursor-pointer">
              <Brain className="h-4 w-4 text-indigo-400" />
            </div>
          </TooltipTrigger>
          <TooltipContent>Intelligence</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="p-2 glass-hierarchy-child rounded-lg hover:scale-105 transition-transform cursor-pointer">
              <Search className="h-4 w-4 text-teal-400" />
            </div>
          </TooltipTrigger>
          <TooltipContent>Detailed Analysis</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="p-2 glass-hierarchy-child rounded-lg hover:scale-105 transition-transform cursor-pointer">
              <Calculator className="h-4 w-4 text-cyan-400" />
            </div>
          </TooltipTrigger>
          <TooltipContent>Economic Modeling</TooltipContent>
        </Tooltip>
      </div>
    </div>
  )}

  {/* No country data state */}
  {!countryData && (
    <div className="text-center py-8 text-muted-foreground">
      <Crown className="h-12 w-12 mx-auto mb-4 opacity-50" />
      <p className="text-sm">Configure your country profile to access MyCountry® Premium</p>
    </div>
  )}
</div>
</motion.div>
</AppleRippleEffect>
</motion.div>

            {/* Global Intelligence Section - 4 columns (hidden when slid away) */}
            <AnimatePresence>
              {!isGlobalCardSlid && (
                <motion.div
                  layout
                  className="lg:col-span-4"
                  initial={{ x: 0, opacity: 1 }}
                  exit={{ 
                    x: 300, 
                    opacity: 0,
                    transition: { duration: 0.6, ease: "easeInOut" }
                  }}
                >
            <motion.div
              className={cn(
                "glass-hierarchy-parent glass-refraction relative overflow-hidden group",
                "rounded-xl border border-neutral-200 dark:border-white/[0.2] transition-all duration-200",
                "hover:shadow-xl hover:shadow-blue-500/10 dark:hover:shadow-blue-400/20",
                "backdrop-blur-xl bg-gradient-to-br from-white/10 via-white/5 to-white/10",
                "shadow-[inset_0_1px_0_rgba(255,255,255,0.1),inset_0_-1px_0_rgba(255,255,255,0.05)]",
                "h-auto p-6"
              )}
              whileHover={{ y: -2 }}
              initial={{ opacity: 0, x: 10 }}
              animate={
                isGlobalCollapsing ? {
                  scaleY: 0.1,
                  height: "20px",
                  transition: {
                    duration: 0.4,
                    ease: "easeInOut"
                  }
                } : isGlobalCardSlid ? {
                  scaleX: 0,
                  width: "0px",
                  opacity: 0,
                  transition: {
                    duration: 0.6,
                    ease: "easeInOut"
                  }
                } : {
                  opacity: 1,
                  x: 0
                }
              }
              transition={{ type: "spring", stiffness: 400, damping: 40, delay: 0.1 }}
              layout
              onMouseEnter={() => setIsGlobalCardHovered(true)}
              onMouseLeave={() => setIsGlobalCardHovered(false)}
            >
              {/* Rubik's Cube Flag Animation with Camera Depth of Field Blur */}
              <div className="absolute inset-0 pointer-events-none overflow-hidden">
                {/* Background layer with heavy depth of field blur */}
                <div className="absolute inset-0 filter blur-[12px] opacity-60">
                  <RubiksCubeFlags
                    countries={processedCountries.map(country => ({
                      id: country.id,
                      name: country.name,
                      currentPopulation: country.currentPopulation,
                      currentGdpPerCapita: country.currentGdpPerCapita,
                      currentTotalGdp: country.currentTotalGdp,
                      economicTier: country.economicTier
                    }))}
                    className="w-full h-full"
                    gridSize={4}
                    animationSpeed={1500}
                    hoverOnly={true}
                    externalHover={isGlobalCardHovered}
                  />
                </div>
                
                {/* Mid-ground layer with moderate blur */}
                <div className="absolute inset-0 filter blur-[6px] opacity-40">
                  <RubiksCubeFlags
                    countries={processedCountries.map(country => ({
                      id: country.id,
                      name: country.name,
                      currentPopulation: country.currentPopulation,
                      currentGdpPerCapita: country.currentGdpPerCapita,
                      currentTotalGdp: country.currentTotalGdp,
                      economicTier: country.economicTier
                    }))}
                    className="w-full h-full"
                    gridSize={4}
                    animationSpeed={1500}
                    hoverOnly={true}
                    externalHover={isGlobalCardHovered}
                  />
                </div>
                
                {/* Foreground layer with subtle blur */}
                <div className="absolute inset-0 filter blur-[2px] opacity-25">
                  <RubiksCubeFlags
                    countries={processedCountries.map(country => ({
                      id: country.id,
                      name: country.name,
                      currentPopulation: country.currentPopulation,
                      currentGdpPerCapita: country.currentGdpPerCapita,
                      currentTotalGdp: country.currentTotalGdp,
                      economicTier: country.economicTier
                    }))}
                    className="w-full h-full"
                    gridSize={4}
                    animationSpeed={1500}
                    hoverOnly={true}
                    externalHover={isGlobalCardHovered}
                  />
                </div>
                
                {/* Text visibility overlay with adaptive backdrop blur */}
                <div className="absolute inset-0 bg-gradient-to-b from-background/90 via-background/70 to-background/90 backdrop-blur-md" />
                
                {/* Enhanced text legibility with soft depth blur */}
                <div className="absolute inset-0 bg-gradient-to-b from-white/10 via-transparent to-white/15 dark:from-black/20 dark:via-transparent dark:to-black/25 backdrop-blur-sm" />
                
                {/* Final text contrast enhancement */}
                <div className="absolute inset-0" style={{
                  background: 'radial-gradient(circle at center, rgba(var(--background-rgb, 255, 255, 255), 0.3) 0%, transparent 50%, rgba(var(--background-rgb, 255, 255, 255), 0.4) 100%)'
                }} />
              </div>
              
              {/* Blue Shimmer Background */}
              <div className="absolute inset-0 bg-gradient-to-br from-blue-400/20 via-blue-500/10 to-indigo-400/20" />
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-blue-400/30 to-transparent transform skew-x-12 -translate-x-full group-hover:translate-x-full transition-transform duration-3000 ease-in-out" />
              
              {/* Content Layout */}
              <div className="relative z-10 h-full flex flex-col justify-between">
                {/* Top Section - Title */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Brain className="h-6 w-6 text-blue-400 drop-shadow-sm" />
                    <h3 className="text-lg font-bold text-foreground drop-shadow-sm">Global Intelligence</h3>
                  </div>
                  
                  {/* Collapse Arrow */}
                  {(
                    <button 
                      className="p-2 rounded-full glass-surface glass-interactive hover:glass-depth-2 transition-all duration-200"
                      onClick={(e) => {
                        e.stopPropagation();
                        collapseGlobalCard();
                      }}
                    >
                      <ChevronLeft className="h-5 w-5 text-foreground" />
                    </button>
                  )}
                </div>

                {/* Global Activity Rings */}
                <div className="mb-4 flex justify-center">
                  <ExecutiveActivityRings
                    countryData={{
                      name: "Global Economy",
                      currentGdpPerCapita: adaptedGlobalStats?.averageGdpPerCapita || 0,
                      currentTotalGdp: adaptedGlobalStats?.totalGdp || 0,
                      currentPopulation: adaptedGlobalStats?.totalPopulation || 0,
                      populationGrowthRate: 0.01,
                      adjustedGdpGrowth: adaptedGlobalStats?.globalGrowthRate || 0,
                      economicTier: "Global",
                      populationTier: "Global",
                      populationDensity: adaptedGlobalStats?.averagePopulationDensity || 0
                    }}
                    onRingClick={() => {}}
                    compact={true}
                    className="mb-4"
                  />
                </div>
                
                {/* SDI Overview */}
                <div className="space-y-3">
                  {/* Active Crises and Intel Items */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="glass-hierarchy-child p-3 rounded text-center">
                      <div className="text-lg font-bold text-red-400">
                        {activeCrises?.length || 0}
                      </div>
                      <div className="text-xs text-muted-foreground">Active Crises</div>
                    </div>
                    <div className="glass-hierarchy-child p-3 rounded text-center">
                      <div className="text-lg font-bold text-blue-400">
                        {intelligenceFeed?.total || 0}
                      </div>
                      <div className="text-xs text-muted-foreground">Intel Items</div>
                    </div>
                  </div>

                  {/* Economic Intelligence */}
                  {economicIndicators && (
                    <div className="glass-hierarchy-child p-3 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <TrendingUp className="h-4 w-4 text-green-400" />
                        <span className="text-sm font-medium text-foreground">Economic Intelligence</span>
                      </div>
                      <div className="space-y-1 text-xs">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Global Growth:</span>
                          <span className="text-green-400">+{(economicIndicators.globalGrowth || 0).toFixed(3)}%</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Inflation Rate:</span>
                          <span className="text-yellow-400">{(economicIndicators.inflationRate || 0).toFixed(3)}%</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                
                {/* Expandable Content */}
                <AnimatePresence>
                  {false && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.4, ease: "easeOut" }}
                      className="mt-6 overflow-hidden"
                    >
                      <div className="glass-hierarchy-child p-6 rounded-lg space-y-6">
                        <h4 className="text-lg font-semibold mb-4">Global Intelligence Network</h4>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div className="glass-depth-1 glass-refraction p-4 rounded-lg">
                            <h3 className="font-semibold mb-3">Power Distribution</h3>
                            <div className="space-y-3">
                              <div className="flex justify-between items-center">
                                <span className="flex items-center gap-2">
                                  <span>👑</span>
                                  <span className="text-sm">Superpowers</span>
                                </span>
                                <Badge variant="secondary">{powerGrouped.superpower?.length || 0}</Badge>
                              </div>
                              <div className="flex justify-between items-center">
                                <span className="flex items-center gap-2">
                                  <span>⭐</span>
                                  <span className="text-sm">Major Powers</span>
                                </span>
                                <Badge variant="secondary">{powerGrouped.major?.length || 0}</Badge>
                              </div>
                              <div className="flex justify-between items-center">
                                <span className="flex items-center gap-2">
                                  <span>🌍</span>
                                  <span className="text-sm">Regional Powers</span>
                                </span>
                                <Badge variant="secondary">{powerGrouped.regional?.length || 0}</Badge>
                              </div>
                            </div>
                          </div>
                          
                          {adaptedGlobalStats && (
                            <div className="glass-depth-1 glass-refraction p-4 rounded-lg">
                              <h3 className="font-semibold mb-3">Global Statistics</h3>
                              <div className="space-y-3">
                                <div>
                                  <div className="text-2xl font-bold text-green-500">
                                    ${((adaptedGlobalStats?.totalGdp || 0) / 1e12).toFixed(1)}T
                                  </div>
                                  <p className="text-sm text-muted-foreground">World GDP</p>
                                </div>
                                <div>
                                  <div className="text-2xl font-bold text-blue-500">
                                    {adaptedGlobalStats?.countryCount || 0}
                                  </div>
                                  <p className="text-sm text-muted-foreground">Active Nations</p>
                                </div>
                                <div>
                                  <div className="text-2xl font-bold text-purple-500">
                                    +{((adaptedGlobalStats?.globalGrowthRate || 0) * 100).toFixed(1)}%
                                  </div>
                                  <p className="text-sm text-muted-foreground">Global Growth</p>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>


          {/* Section Separator */}
          <div className="relative my-8">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-neutral-200 dark:border-white/[0.2]" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="glass-hierarchy-parent px-4 py-2 rounded-full text-muted-foreground">MyCountry® Premium Suite</span>
            </div>
          </div>

          {/* Middle Section Grid - ECI (6 span) + SDI (6 span) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* ECI Executive Command Center */}
          <motion.div
            className={cn(
              "lg:col-span-6",
              "glass-hierarchy-parent relative overflow-hidden group cursor-pointer",
              "rounded-xl border border-neutral-200 dark:border-white/[0.2] transition-all duration-200",
              "hover:shadow-xl hover:shadow-indigo-500/10 dark:hover:shadow-indigo-400/20",
              focusedCard && focusedCard !== "eci" && "blur-sm scale-95 opacity-50"
            )}
            onClick={() => setFocusedCard(focusedCard === "eci" ? null : "eci")}
            whileHover={{ y: -2 }}
            whileTap={{ scale: 0.995 }}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 40, delay: 0.2 }}
            layout
          >
            {/* Indigo glow overlay for ECI section theme */}
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-400/10 via-indigo-300/5 to-indigo-500/10 
                          rounded-xl animate-pulse pointer-events-none" style={{ animationDuration: '6s' }} />
            
            <div className="relative z-10 p-6">
              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <Gauge className="h-6 w-6 text-indigo-400" />
                  <div>
                    <h3 className="text-xl font-bold text-foreground">Executive Command Interface</h3>
                    <p className="text-sm text-muted-foreground">High-level executive tools for strategic governance</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="glass-hierarchy-interactive"
                    onClick={(e) => {
                      e.stopPropagation();
                      window.open(createUrl("/eci"), "_blank");
                    }}
                  >
                    → Open ECI
                  </Button>
                  
                  {/* Expand Arrow */}
                  <button 
                    className="p-2 rounded-full glass-surface glass-interactive hover:glass-depth-2 transition-all duration-200"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleEciExpansion();
                    }}
                  >
                    {isEciExpanded ? (
                      <ChevronUp className="h-5 w-5 text-foreground" />
                    ) : (
                      <ChevronDown className="h-5 w-5 text-foreground" />
                    )}
                  </button>
                </div>
              </div>

              {/* ECI Preview - Always Visible with Live National Metrics */}
              {countryData ? (
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center p-4 glass-hierarchy-child rounded-lg">
                    <div className="text-2xl font-bold text-green-400 mb-2">
                      {formatCurrency(countryData.currentGdpPerCapita)}
                    </div>
                    <div className="text-sm text-muted-foreground">GDP per Capita</div>
                    <Progress 
                      value={Math.min((countryData.currentGdpPerCapita / 100000) * 100, 100)} 
                      className="mt-2 h-2" 
                    />
                  </div>
                  <div className="text-center p-4 glass-hierarchy-child rounded-lg">
                    <div className="text-2xl font-bold text-blue-400 mb-2">
                      {formatPopulation(countryData.currentPopulation)}
                    </div>
                    <div className="text-sm text-muted-foreground">Population</div>
                    <Progress 
                      value={Math.min((countryData.currentPopulation / 1000000000) * 100, 100)} 
                      className="mt-2 h-2" 
                    />
                  </div>
                  <div className="text-center p-4 glass-hierarchy-child rounded-lg">
                    <div className="text-2xl font-bold text-purple-400 mb-2">
                      {countryData.populationDensity ? `${Math.round(countryData.populationDensity)}` : 'N/A'}
                    </div>
                    <div className="text-sm text-muted-foreground">Density/km²</div>
                    <Progress 
                      value={countryData.populationDensity ? Math.min((countryData.populationDensity / 1000) * 100, 100) : 0} 
                      className="mt-2 h-2" 
                    />
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center p-4 glass-hierarchy-child rounded-lg">
                    <div className="text-2xl font-bold text-muted-foreground mb-2">--</div>
                    <div className="text-sm text-muted-foreground">GDP per Capita</div>
                    <Progress value={0} className="mt-2 h-2" />
                  </div>
                  <div className="text-center p-4 glass-hierarchy-child rounded-lg">
                    <div className="text-2xl font-bold text-muted-foreground mb-2">--</div>
                    <div className="text-sm text-muted-foreground">Population</div>
                    <Progress value={0} className="mt-2 h-2" />
                  </div>
                  <div className="text-center p-4 glass-hierarchy-child rounded-lg">
                    <div className="text-2xl font-bold text-muted-foreground mb-2">--</div>
                    <div className="text-sm text-muted-foreground">Density/km²</div>
                    <Progress value={0} className="mt-2 h-2" />
                  </div>
                </div>
              )}

              {/* ECI Submodule Icons - Only show when not expanded */}
              {!isEciExpanded && (
                <div className="mt-4 flex flex-wrap gap-2 justify-center">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="p-2 glass-hierarchy-child rounded-lg hover:scale-105 transition-transform cursor-pointer">
                        <TrendingUp className="h-4 w-4 text-green-400" />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>Economic Intelligence</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="p-2 glass-hierarchy-child rounded-lg hover:scale-105 transition-transform cursor-pointer">
                        <Globe className="h-4 w-4 text-blue-400" />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>Trade Analysis</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="p-2 glass-hierarchy-child rounded-lg hover:scale-105 transition-transform cursor-pointer">
                        <DollarSign className="h-4 w-4 text-yellow-400" />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>Financial Metrics</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="p-2 glass-hierarchy-child rounded-lg hover:scale-105 transition-transform cursor-pointer">
                        <Users className="h-4 w-4 text-purple-400" />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>Population Analytics</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="p-2 glass-hierarchy-child rounded-lg hover:scale-105 transition-transform cursor-pointer">
                        <Building2 className="h-4 w-4 text-orange-400" />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>Infrastructure Status</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="p-2 glass-hierarchy-child rounded-lg hover:scale-105 transition-transform cursor-pointer">
                        <Gauge className="h-4 w-4 text-indigo-400" />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>Performance Gauge</TooltipContent>
                  </Tooltip>
                </div>
              )}

              {/* Expandable ECI Content */}
              <AnimatePresence>
                {isEciExpanded && userProfile?.countryId && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.4, ease: "easeOut" }}
                    className="mt-6 overflow-hidden"
                  >
                    <div className="glass-hierarchy-child p-6 rounded-lg">
                      <CountryExecutiveSection countryId={userProfile.countryId} userId={user?.id || ''} />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {!userProfile?.countryId && (
                <div className="text-center py-8 text-muted-foreground">
                  <Building2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p className="text-sm">Configure your country profile to access the Executive Command Center</p>
                </div>
              )}
            </div>
          </motion.div>

          {/* SDI Strategic Intelligence */}
          <motion.div
            className={cn(
              "lg:col-span-6",
              "glass-hierarchy-parent relative overflow-hidden group cursor-pointer",
              "rounded-xl border border-neutral-200 dark:border-white/[0.2] transition-all duration-200",
              "hover:shadow-xl hover:shadow-red-500/10 dark:hover:shadow-red-400/20",
              focusedCard && focusedCard !== "sdi" && "blur-sm scale-95 opacity-50"
            )}
            onClick={() => setFocusedCard(focusedCard === "sdi" ? null : "sdi")}
            whileHover={{ y: -2 }}
            whileTap={{ scale: 0.995 }}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 40, delay: 0.3 }}
            layout
          >
            {/* Red glow overlay for SDI section theme */}
            <div className="absolute inset-0 bg-gradient-to-br from-red-400/10 via-red-300/5 to-red-500/10 
                          rounded-xl animate-pulse pointer-events-none" style={{ animationDuration: '7s' }} />
            
            <div className="relative z-10 p-6">
              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <Eye className="h-6 w-6 text-red-400" />
                  <div>
                    <h3 className="text-xl font-bold text-foreground">Strategic Defense Intelligence</h3>
                    <p className="text-sm text-muted-foreground">Intelligence operations and security oversight</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="glass-hierarchy-interactive"
                    onClick={(e) => {
                      e.stopPropagation();
                      window.open(createUrl("/sdi"), "_blank");
                    }}
                  >
                    → Open SDI
                  </Button>
                  
                  {/* Expand Arrow */}
                  <button 
                    className="p-2 rounded-full glass-surface glass-interactive hover:glass-depth-2 transition-all duration-200"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleSdiExpansion();
                    }}
                  >
                    {isSdiExpanded ? (
                      <ChevronUp className="h-5 w-5 text-foreground" />
                    ) : (
                      <ChevronDown className="h-5 w-5 text-foreground" />
                    )}
                  </button>
                </div>
              </div>

              {/* SDI Preview - Always Visible */}
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 glass-hierarchy-child rounded">
                  <span className="text-sm text-muted-foreground">Threat Level</span>
                  <Badge variant="destructive" className="text-xs">ELEVATED</Badge>
                </div>
                <div className="flex items-center justify-between p-3 glass-hierarchy-child rounded">
                  <span className="text-sm text-muted-foreground">Global Crises</span>
                  <span className="text-sm font-medium text-red-400">3 Active</span>
                </div>
                <div className="flex items-center justify-between p-3 glass-hierarchy-child rounded">
                  <span className="text-sm text-muted-foreground">Intel Reports</span>
                  <Badge variant="outline">12 New</Badge>
                </div>
              </div>

              {/* SDI Submodule Icons - Only show when not expanded */}
              {!isSdiExpanded && (
                <div className="mt-4 flex flex-wrap gap-2 justify-center">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="p-2 glass-hierarchy-child rounded-lg hover:scale-105 transition-transform cursor-pointer">
                        <Shield className="h-4 w-4 text-red-400" />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>Security Monitoring</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="p-2 glass-hierarchy-child rounded-lg hover:scale-105 transition-transform cursor-pointer">
                        <AlertTriangle className="h-4 w-4 text-orange-400" />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>Threat Analysis</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="p-2 glass-hierarchy-child rounded-lg hover:scale-105 transition-transform cursor-pointer">
                        <Eye className="h-4 w-4 text-blue-400" />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>Intelligence Reports</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="p-2 glass-hierarchy-child rounded-lg hover:scale-105 transition-transform cursor-pointer">
                        <Target className="h-4 w-4 text-purple-400" />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>Crisis Management</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="p-2 glass-hierarchy-child rounded-lg hover:scale-105 transition-transform cursor-pointer">
                        <Brain className="h-4 w-4 text-green-400" />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>Strategic Planning</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="p-2 glass-hierarchy-child rounded-lg hover:scale-105 transition-transform cursor-pointer">
                        <Settings className="h-4 w-4 text-gray-400" />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>Defense Systems</TooltipContent>
                  </Tooltip>
                </div>
              )}

              {/* Expandable SDI Content */}
              <AnimatePresence>
                {isSdiExpanded && userProfile?.countryId && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.4, ease: "easeOut" }}
                    className="mt-6 overflow-hidden"
                  >
                    <div className="glass-hierarchy-child p-6 rounded-lg">
                      <CountryIntelligenceSection countryId={userProfile.countryId} />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {!userProfile?.countryId && (
                <div className="text-center py-8 text-muted-foreground">
                  <Shield className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p className="text-sm">Configure your country profile to access Strategic Defense Intelligence</p>
                </div>
              )}
            </div>
          </motion.div>
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
              open={activityPopoverOpen === 1}
              anchorEl={null}
              onClose={() => setActivityPopoverOpen(null)}
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
              open={activityPopoverOpen === 2}
              anchorEl={null}
              onClose={() => setActivityPopoverOpen(null)}
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
          </>
        )}

        {/* Command Palette */}
        <CommandDialog open={commandOpen} onOpenChange={setCommandOpen}>
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
                      setCommandOpen(false);
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