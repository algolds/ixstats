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
import { HealthRing } from "~/components/ui/health-ring";
import { SimpleFlag } from "~/components/SimpleFlag";
import { ActivityPopover } from "~/components/ui/activity-modal";
import { Popover, PopoverTrigger, PopoverContent } from "~/components/ui/popover";
import { CountryExecutiveSection } from "~/app/countries/_components/CountryExecutiveSection";
import { CountryIntelligenceSection } from "~/app/countries/_components/CountryIntelligenceSection";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Progress } from "~/components/ui/progress";

// Icons
import { 
  Crown, Building2, Globe, Shield, Settings, TrendingUp, 
  Users, DollarSign, MapPin, Command, Zap, Activity,
  BarChart3, AlertTriangle, CheckCircle2,
  Target, Star, ChevronDown, ChevronUp, X,
  Sparkles, Gauge, PieChart, LineChart,
  Lock, Eye, Brain
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
}

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

export default function DashboardRefactored() {
  // Interactive grid background pattern
  const GridPattern = () => (
    <div className="absolute inset-0 opacity-20 dark:opacity-10 pointer-events-none">
      <motion.div
        className="w-full h-full bg-gradient-to-br from-blue-500/5 via-purple-500/5 to-cyan-500/5"
        style={{
          backgroundImage: `
            linear-gradient(to right, rgba(59, 130, 246, 0.1) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(59, 130, 246, 0.1) 1px, transparent 1px)
          `,
          backgroundSize: '60px 60px'
        }}
        animate={{
          backgroundPosition: ['0px 0px', '60px 60px', '0px 0px'],
        }}
        transition={{
          duration: 20,
          ease: "linear",
          repeat: Infinity,
        }}
      />
      <motion.div
        className="absolute inset-0 glass-refraction opacity-30"
        style={{
          background: `
            radial-gradient(circle at 20% 50%, rgba(147, 51, 234, 0.1) 0%, transparent 50%),
            radial-gradient(circle at 80% 20%, rgba(59, 130, 246, 0.1) 0%, transparent 50%),
            radial-gradient(circle at 40% 80%, rgba(16, 185, 129, 0.1) 0%, transparent 50%)
          `
        }}
        animate={{
          opacity: [0.3, 0.6, 0.3],
          scale: [1, 1.1, 1],
        }}
        transition={{
          duration: 15,
          ease: "easeInOut",
          repeat: Infinity,
        }}
      />
    </div>
  );
  const { user } = useUser();
  const [commandOpen, setCommandOpen] = useState(false);
  // Removed selectedSection state - replaced with expandedCard for arrow expansion
  const [activityPopoverOpen, setActivityPopoverOpen] = useState<number | null>(null);
  const [hasAnimated, setHasAnimated] = useState(false);
  const [headerVisible, setHeaderVisible] = useState(true);
  const [focusedCard, setFocusedCard] = useState<string | null>(null);
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());

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

  // Helper function to toggle card expansion
  const toggleCardExpansion = (cardId: string) => {
    setExpandedCards(prev => {
      const newSet = new Set(prev);
      if (newSet.has(cardId)) {
        newSet.delete(cardId);
      } else {
        newSet.add(cardId);
      }
      return newSet;
    });
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

  // Header animation and scroll handling
  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 100 && !hasAnimated) {
        setHeaderVisible(false);
        setHasAnimated(true);
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [hasAnimated]);

  // Data fetching
  const { data: userProfile, isLoading: profileLoading } = api.users.getProfile.useQuery(
    { userId: user?.id || '' },
    { enabled: !!user?.id }
  );

  const { data: allData, isLoading: countriesLoading, error: countriesError } = api.countries.getAll.useQuery(undefined, {
    retry: 1,
    retryDelay: 1000
  });

  const { data: globalStatsData, isLoading: statsLoading, error: statsError } = api.countries.getGlobalStats.useQuery(undefined, {
    retry: 1,
    retryDelay: 1000
  });

  const { data: countryData, isLoading: countryLoading } = api.countries.getByIdWithEconomicData.useQuery(
    { id: userProfile?.countryId || '' },
    { enabled: !!userProfile?.countryId, retry: 1, retryDelay: 1000 }
  );

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
    <div className="relative min-h-screen bg-background">
      {/* Interactive Grid Background */}
      <GridPattern />
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
        {!headerVisible && (
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
        )}

        {/* Setup Required Banner */}
        {userProfile && !userProfile.countryId && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-hierarchy-parent p-6 rounded-xl mb-8 text-center border border-yellow-400/30"
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

        {/* Fixed Bento Grid Layout */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="grid grid-cols-1 lg:grid-cols-12 gap-6 max-w-7xl mx-auto"
        >
          {/* MyCountry Overview - Spans 8 columns */}
          <motion.div
            className={cn(
              "lg:col-span-8 glass-hierarchy-parent relative overflow-hidden group cursor-pointer",
              "rounded-xl border border-neutral-200 dark:border-white/[0.2] p-6 transition-all duration-200",
              "hover:shadow-xl hover:shadow-yellow-500/10 dark:hover:shadow-yellow-400/20",
              focusedCard && focusedCard !== "mycountry" && "blur-sm scale-95 opacity-50"
            )}
            onClick={() => setFocusedCard(focusedCard === "mycountry" ? null : "mycountry")}
            whileHover={{ y: -2 }}
            whileTap={{ scale: 0.995 }}
            transition={{ type: "spring", stiffness: 400, damping: 40 }}
            layout
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
            
            {/* Gold Shimmer Background */}
            <div className="absolute inset-0 bg-gradient-to-br from-yellow-400/20 via-yellow-500/10 to-orange-400/20" />
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-yellow-400/40 to-transparent transform -skew-x-12 -translate-x-full group-hover:translate-x-full transition-transform duration-3000 ease-in-out" />
            
            {/* Content Layout */}
            <div className="relative z-10 h-full flex flex-col justify-between">
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
                
                {/* Expand Arrow */}
                <button 
                  className="p-2 rounded-full glass-surface glass-interactive hover:glass-depth-2 transition-all duration-200"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleCardExpansion("mycountry");
                  }}
                >
                  {expandedCards.has("mycountry") ? (
                    <ChevronUp className="h-5 w-5 text-foreground" />
                  ) : (
                    <ChevronDown className="h-5 w-5 text-foreground" />
                  )}
                </button>
              </div>

              {/* Activity Rings Section */}
              {countryData && (
                <motion.div 
                  className="grid grid-cols-3 gap-4 mb-6"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.4 }}
                >
                  <div className="flex flex-col items-center p-3 rounded-lg glass-hierarchy-child hover:glass-depth-2 transition-all duration-200">
                    <HealthRing
                      value={Math.min(100, (countryData.currentGdpPerCapita / 50000) * 100)}
                      size={60}
                      color="#10b981"
                      label="Economic"
                      tooltip="Click to view detailed economic metrics"
                      isClickable={true}
                      onClick={() => setActivityPopoverOpen(0)}
                      className="mb-3"
                    />
                    <span className="text-sm font-medium text-foreground">Economic</span>
                    <span className="text-xs text-muted-foreground">
                      {formatCurrency(countryData.currentGdpPerCapita)}
                    </span>
                  </div>
                  <div className="flex flex-col items-center p-3 rounded-lg glass-hierarchy-child hover:glass-depth-2 transition-all duration-200">
                    <HealthRing
                      value={Math.min(100, Math.max(0, ((countryData.populationGrowthRate || 0) * 100 + 2) * 25))}
                      size={60}
                      color="#3b82f6"
                      label="Growth"
                      tooltip="Click to view population dynamics"
                      isClickable={true}
                      onClick={() => setActivityPopoverOpen(1)}
                      className="mb-3"
                    />
                    <span className="text-sm font-medium text-foreground">Growth</span>
                    <span className="text-xs text-muted-foreground">
                      {formatPopulation(countryData.currentPopulation)}
                    </span>
                  </div>
                  <div className="flex flex-col items-center p-3 rounded-lg glass-hierarchy-child hover:glass-depth-2 transition-all duration-200">
                    <HealthRing
                      value={countryData.economicTier === "Extravagant" ? 100 : 
                             countryData.economicTier === "Very Strong" ? 85 :
                             countryData.economicTier === "Strong" ? 70 :
                             countryData.economicTier === "Healthy" ? 55 :
                             countryData.economicTier === "Developed" ? 40 :
                             countryData.economicTier === "Developing" ? 25 : 10}
                      size={60}
                      color="#8b5cf6"
                      label="Development"
                      tooltip="Click to view development index details"
                      isClickable={true}
                      onClick={() => setActivityPopoverOpen(2)}
                      className="mb-3"
                    />
                    <span className="text-sm font-medium text-foreground">Development</span>
                    <span className="text-xs text-muted-foreground">
                      {countryData.economicTier}
                    </span>
                  </div>
                </motion.div>
              )}

              {/* Bottom Section - Key Metrics */}
              {countryData && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="glass-hierarchy-child p-3 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <Users className="h-4 w-4 text-blue-400" />
                      <span className="text-xs text-muted-foreground">Population</span>
                    </div>
                    <div className="text-sm font-bold text-foreground">
                      {formatPopulation(countryData.currentPopulation)}
                    </div>
                  </div>
                  <div className="glass-hierarchy-child p-3 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <DollarSign className="h-4 w-4 text-green-400" />
                      <span className="text-xs text-muted-foreground">GDP/Capita</span>
                    </div>
                    <div className="text-sm font-bold text-foreground">
                      {formatCurrency(countryData.currentGdpPerCapita)}
                    </div>
                  </div>
                  <div className="glass-hierarchy-child p-3 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <MapPin className="h-4 w-4 text-purple-400" />
                      <span className="text-xs text-muted-foreground">Density</span>
                    </div>
                    <div className="text-sm font-bold text-foreground">
                      {countryData.populationDensity ? `${Math.round(countryData.populationDensity)}/km²` : 'N/A'}
                    </div>
                  </div>
                  <div className="glass-hierarchy-child p-3 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <CheckCircle2 className="h-4 w-4 text-green-400" />
                      <span className="text-xs text-muted-foreground">Status</span>
                    </div>
                    <div className="text-sm font-bold text-green-400">
                      Active
                    </div>
                  </div>
                </div>
              )}

              {/* Expandable Content */}
              <AnimatePresence>
                {expandedCards.has("mycountry") && countryData && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.4, ease: "easeOut" }}
                    className="mt-6 overflow-hidden"
                  >
                    <div className="glass-hierarchy-child p-6 rounded-lg space-y-6">
                      <h4 className="text-lg font-semibold mb-4">Extended MyCountry® Dashboard</h4>
                      
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="glass-depth-1 glass-refraction p-4 rounded-lg">
                          <div className="flex items-center gap-2 mb-3">
                            <PieChart className="h-5 w-5 text-green-500" />
                            <h3 className="font-semibold">Economic Health</h3>
                          </div>
                          <div className="text-2xl font-bold text-green-500 mb-2">
                            {formatCurrency(countryData.currentGdpPerCapita)}
                          </div>
                          <p className="text-sm text-muted-foreground">GDP per Capita</p>
                          <div className="mt-3 text-xs text-muted-foreground">
                            Total GDP: {formatCurrency(countryData.currentTotalGdp)}
                          </div>
                        </div>
                        
                        <div className="glass-depth-1 glass-refraction p-4 rounded-lg">
                          <div className="flex items-center gap-2 mb-3">
                            <Users className="h-5 w-5 text-blue-500" />
                            <h3 className="font-semibold">Population</h3>
                          </div>
                          <div className="text-2xl font-bold text-blue-500 mb-2">
                            {formatPopulation(countryData.currentPopulation)}
                          </div>
                          <p className="text-sm text-muted-foreground">Total Citizens</p>
                          <div className="mt-3 text-xs text-muted-foreground">
                            Density: {countryData.populationDensity ? `${Math.round(countryData.populationDensity)}/km²` : 'N/A'}
                          </div>
                        </div>
                        
                        <div className="glass-depth-1 glass-refraction p-4 rounded-lg">
                          <div className="flex items-center gap-2 mb-3">
                            <TrendingUp className="h-5 w-5 text-purple-500" />
                            <h3 className="font-semibold">Development</h3>
                          </div>
                          <div className="text-2xl font-bold text-purple-500 mb-2">
                            {countryData.economicTier}
                          </div>
                          <p className="text-sm text-muted-foreground">Economic Tier</p>
                          <div className="mt-3 text-xs text-muted-foreground">
                            Population Tier: {countryData.populationTier}
                          </div>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>

          {/* Global Intelligence Overview - Right column */}
            <motion.div
              className={cn(
                "lg:col-span-4 glass-hierarchy-parent relative overflow-hidden group cursor-pointer",
                "rounded-xl border border-neutral-200 dark:border-white/[0.2] p-6 transition-all duration-200",
                "hover:shadow-xl hover:shadow-blue-500/10 dark:hover:shadow-blue-400/20",
                focusedCard && focusedCard !== "global" && "blur-sm scale-95 opacity-50"
              )}
              onClick={() => setFocusedCard(focusedCard === "global" ? null : "global")}
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.995 }}
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ type: "spring", stiffness: 400, damping: 40, delay: 0.1 }}
              layout
            >
              {/* Full Bento Flag Mosaic Background with Rubik's Cube Animation */}
              <div className="absolute inset-0 pointer-events-none overflow-hidden">
                <motion.div 
                  className="w-full h-full grid grid-cols-3 grid-rows-3 gap-1"
                  animate={{
                    filter: [
                      "blur(6px) brightness(1.1)",
                      "blur(4px) brightness(1.3)",
                      "blur(6px) brightness(1.1)",
                      "blur(8px) brightness(0.9)",
                      "blur(6px) brightness(1.1)"
                    ]
                  }}
                  transition={{
                    duration: 10,
                    ease: "easeInOut",
                    repeat: Infinity,
                    repeatType: "reverse"
                  }}
                >
                  {processedCountries.slice(0, 9).map((country, index) => (
                    <motion.div
                      key={country.id}
                      className="relative overflow-hidden opacity-50"
                      animate={{
                        x: [0, 1, -0.5, 0.5, 0],
                        rotateY: [0, 0.5, -0.2, 0.3, 0],
                        scale: [1, 1.02, 0.99, 1.01, 1]
                      }}
                      transition={{
                        duration: 8 + index * 0.3,
                        ease: "easeInOut",
                        repeat: Infinity,
                        times: [0, 0.25, 0.5, 0.75, 1],
                        delay: index * 0.2
                      }}
                      whileHover={{
                        rotateX: [0, 180, 360],
                        rotateY: [0, 180, 360],
                        scale: [1, 1.1, 1],
                        transition: {
                          duration: 1.2,
                          ease: "easeInOut",
                          times: [0, 0.5, 1]
                        }
                      }}
                    >
                      <SimpleFlag 
                        countryName={country.name}
                        className="w-full h-full object-cover"
                        showPlaceholder={true}
                      />
                    </motion.div>
                  ))}
                </motion.div>
                
                {/* Lighter overlay to maintain flag visibility */}
                <div className="absolute inset-0 bg-gradient-to-b from-background/70 via-background/40 to-background/80" />
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
                  
                  {/* Expand Arrow */}
                  <button 
                    className="p-2 rounded-full glass-surface glass-interactive hover:glass-depth-2 transition-all duration-200"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleCardExpansion("global");
                    }}
                  >
                    {expandedCards.has("global") ? (
                      <ChevronUp className="h-5 w-5 text-foreground" />
                    ) : (
                      <ChevronDown className="h-5 w-5 text-foreground" />
                    )}
                  </button>
                </div>

                {/* Middle Section - Key Stats */}
                {adaptedGlobalStats && (
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <div className="glass-hierarchy-child p-3 rounded text-center">
                      <div className="text-lg font-bold text-blue-400">
                        {formatCurrency(adaptedGlobalStats.totalGdp)}
                      </div>
                      <div className="text-xs text-muted-foreground">World GDP</div>
                    </div>
                    <div className="glass-hierarchy-child p-3 rounded text-center">
                      <div className="text-lg font-bold text-green-400">
                        +{(adaptedGlobalStats.globalGrowthRate * 100).toFixed(1)}%
                      </div>
                      <div className="text-xs text-muted-foreground">Growth</div>
                    </div>
                  </div>
                )}
                
                {/* Bottom Section - Power Classification */}
                <div className="glass-hierarchy-child p-3 rounded-lg">
                  <div className="flex items-center gap-2 mb-3">
                    <Crown className="h-4 w-4 text-purple-400" />
                    <span className="text-sm font-medium text-foreground">Power Classification</span>
                  </div>
                  <div className="space-y-2">
                    <Popover>
                      <PopoverTrigger>
                        <div className="flex justify-between items-center w-full p-2 rounded glass-hierarchy-interactive hover:scale-[1.02] transition-transform cursor-pointer">
                          <div className="flex items-center gap-2">
                            <span className="text-xs">👑</span>
                            <span className="text-xs text-muted-foreground">Superpowers</span>
                          </div>
                          <Badge variant="outline" className="text-xs bg-yellow-500/20 text-yellow-800 dark:text-yellow-200 border-yellow-400/50 px-2 py-1 ml-2">
                            {powerGrouped.superpower?.length || 0}
                          </Badge>
                        </div>
                      </PopoverTrigger>
                      <PopoverContent side="right" className="w-80 p-4 glass-modal">
                        <div className="space-y-3">
                          <div className="flex items-center gap-2">
                            <span className="text-lg">👑</span>
                            <div>
                              <div className="font-semibold text-foreground">Superpowers</div>
                              <div className="text-xs text-muted-foreground">{powerGrouped.superpower?.length || 0} countries</div>
                            </div>
                          </div>
                          <div className="text-sm text-muted-foreground">
                            Countries with exceptional economic and military influence. These nations have global reach and significant impact on world affairs.
                          </div>
                        </div>
                      </PopoverContent>
                    </Popover>

                    <Popover>
                      <PopoverTrigger>
                        <div className="flex justify-between items-center w-full p-2 rounded glass-hierarchy-interactive hover:scale-[1.02] transition-transform cursor-pointer">
                          <div className="flex items-center gap-2">
                            <span className="text-xs">⭐</span>
                            <span className="text-xs text-muted-foreground">Major Powers</span>
                          </div>
                          <Badge variant="outline" className="text-xs bg-blue-500/20 text-blue-800 dark:text-blue-200 border-blue-400/50 px-2 py-1 ml-2">
                            {powerGrouped.major?.length || 0}
                          </Badge>
                        </div>
                      </PopoverTrigger>
                      <PopoverContent side="right" className="w-80 p-4 glass-modal">
                        <div className="space-y-3">
                          <div className="flex items-center gap-2">
                            <span className="text-lg">⭐</span>
                            <div>
                              <div className="font-semibold text-foreground">Major Powers</div>
                              <div className="text-xs text-muted-foreground">{powerGrouped.major?.length || 0} countries</div>
                            </div>
                          </div>
                          <div className="text-sm text-muted-foreground">
                            Influential countries with significant regional impact. These nations have substantial economies and military capabilities.
                          </div>
                        </div>
                      </PopoverContent>
                    </Popover>

                    <Popover>
                      <PopoverTrigger>
                        <div className="flex justify-between items-center w-full p-2 rounded glass-hierarchy-interactive hover:scale-[1.02] transition-transform cursor-pointer">
                          <div className="flex items-center gap-2">
                            <span className="text-xs">🌍</span>
                            <span className="text-xs text-muted-foreground">Regional Powers</span>
                          </div>
                          <Badge variant="outline" className="text-xs bg-green-500/20 text-green-800 dark:text-green-200 border-green-400/50 px-2 py-1 ml-2">
                            {powerGrouped.regional?.length || 0}
                          </Badge>
                        </div>
                      </PopoverTrigger>
                      <PopoverContent side="right" className="w-80 p-4 glass-modal">
                        <div className="space-y-3">
                          <div className="flex items-center gap-2">
                            <span className="text-lg">🌍</span>
                            <div>
                              <div className="font-semibold text-foreground">Regional Powers</div>
                              <div className="text-xs text-muted-foreground">{powerGrouped.regional?.length || 0} countries</div>
                            </div>
                          </div>
                          <div className="text-sm text-muted-foreground">
                            Countries with notable influence within their geographic regions. These nations play important roles in regional politics and economics.
                          </div>
                        </div>
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
                
                {/* Expandable Content */}
                <AnimatePresence>
                  {expandedCards.has("global") && (
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
                                    ${((adaptedGlobalStats.totalGdp || 0) / 1e12).toFixed(1)}T
                                  </div>
                                  <p className="text-sm text-muted-foreground">World GDP</p>
                                </div>
                                <div>
                                  <div className="text-2xl font-bold text-blue-500">
                                    {adaptedGlobalStats.countryCount || 0}
                                  </div>
                                  <p className="text-sm text-muted-foreground">Active Nations</p>
                                </div>
                                <div>
                                  <div className="text-2xl font-bold text-purple-500">
                                    +{(adaptedGlobalStats.globalGrowthRate * 100).toFixed(1)}%
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
                      toggleCardExpansion("eci");
                    }}
                  >
                    {expandedCards.has("eci") ? (
                      <ChevronUp className="h-5 w-5 text-foreground" />
                    ) : (
                      <ChevronDown className="h-5 w-5 text-foreground" />
                    )}
                  </button>
                </div>
              </div>

              {/* ECI Preview - Always Visible */}
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center p-4 glass-hierarchy-child rounded-lg">
                  <div className="text-2xl font-bold text-purple-400 mb-2">85</div>
                  <div className="text-sm text-muted-foreground">Social Harmony</div>
                  <Progress value={85} className="mt-2 h-2" />
                </div>
                <div className="text-center p-4 glass-hierarchy-child rounded-lg">
                  <div className="text-2xl font-bold text-blue-400 mb-2">72</div>
                  <div className="text-sm text-muted-foreground">Security Index</div>
                  <Progress value={72} className="mt-2 h-2" />
                </div>
                <div className="text-center p-4 glass-hierarchy-child rounded-lg">
                  <div className="text-2xl font-bold text-green-400 mb-2">89</div>
                  <div className="text-sm text-muted-foreground">Political Stability</div>
                  <Progress value={89} className="mt-2 h-2" />
                </div>
              </div>

              {/* Expandable ECI Content */}
              <AnimatePresence>
                {expandedCards.has("eci") && userProfile?.countryId && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.4, ease: "easeOut" }}
                    className="mt-6 overflow-hidden"
                  >
                    <div className="glass-hierarchy-child p-6 rounded-lg">
                      <CountryExecutiveSection countryId={userProfile.countryId} userId={user?.id} />
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
                      toggleCardExpansion("sdi");
                    }}
                  >
                    {expandedCards.has("sdi") ? (
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

              {/* Expandable SDI Content */}
              <AnimatePresence>
                {expandedCards.has("sdi") && userProfile?.countryId && (
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
        </motion.div>

        {/* Focus Card Modal */}
        <AnimatePresence>
          {focusedCard && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
            >
              {/* Backdrop */}
              <div 
                className="absolute inset-0 bg-black/50 dark:bg-black/70 backdrop-blur-md"
                onClick={() => setFocusedCard(null)}
              />
              
              {/* Focus Card Content */}
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="relative w-full max-w-4xl max-h-[80vh] overflow-y-auto glass-modal glass-refraction glass-depth-3 rounded-xl p-6 shadow-2xl border border-white/20 dark:border-white/10"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Close Button */}
                <button
                  onClick={() => setFocusedCard(null)}
                  className="absolute top-4 right-4 p-2 rounded-full glass-surface glass-interactive hover:glass-depth-2 transition-all duration-200 z-10"
                >
                  <X className="h-5 w-5" />
                </button>

                {/* Dynamic Content Based on Focused Card */}
                {focusedCard === "mycountry" && countryData && (
                  <div className="space-y-6">
                    <div className="flex items-center gap-3 mb-6">
                      <Crown className="h-8 w-8 text-yellow-400" />
                      <div>
                        <h2 className="text-2xl font-bold text-foreground">MyCountry® Premium Dashboard</h2>
                        <p className="text-muted-foreground">{countryData.name} - Comprehensive Overview</p>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="glass-depth-1 glass-refraction p-4 rounded-lg">
                        <div className="flex items-center gap-2 mb-3">
                          <PieChart className="h-5 w-5 text-green-500" />
                          <h3 className="font-semibold">Economic Health</h3>
                        </div>
                        <div className="text-2xl font-bold text-green-500 mb-2">
                          {formatCurrency(countryData.currentGdpPerCapita)}
                        </div>
                        <p className="text-sm text-muted-foreground">GDP per Capita</p>
                        <div className="mt-3 text-xs text-muted-foreground">
                          Total GDP: {formatCurrency(countryData.currentTotalGdp)}
                        </div>
                      </div>
                      
                      <div className="glass-depth-1 glass-refraction p-4 rounded-lg">
                        <div className="flex items-center gap-2 mb-3">
                          <Users className="h-5 w-5 text-blue-500" />
                          <h3 className="font-semibold">Population</h3>
                        </div>
                        <div className="text-2xl font-bold text-blue-500 mb-2">
                          {formatPopulation(countryData.currentPopulation)}
                        </div>
                        <p className="text-sm text-muted-foreground">Total Citizens</p>
                        <div className="mt-3 text-xs text-muted-foreground">
                          Density: {countryData.populationDensity ? `${Math.round(countryData.populationDensity)}/km²` : 'N/A'}
                        </div>
                      </div>
                      
                      <div className="glass-depth-1 glass-refraction p-4 rounded-lg">
                        <div className="flex items-center gap-2 mb-3">
                          <TrendingUp className="h-5 w-5 text-purple-500" />
                          <h3 className="font-semibold">Development</h3>
                        </div>
                        <div className="text-2xl font-bold text-purple-500 mb-2">
                          {countryData.economicTier}
                        </div>
                        <p className="text-sm text-muted-foreground">Economic Tier</p>
                        <div className="mt-3 text-xs text-muted-foreground">
                          Population Tier: {countryData.populationTier}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {focusedCard === "global" && (
                  <div className="space-y-6">
                    <div className="flex items-center gap-3 mb-6">
                      <Brain className="h-8 w-8 text-blue-400" />
                      <div>
                        <h2 className="text-2xl font-bold text-foreground">Global Intelligence Network</h2>
                        <p className="text-muted-foreground">Worldwide Economic & Political Analysis</p>
                      </div>
                    </div>
                    
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
                                ${((adaptedGlobalStats.totalGdp || 0) / 1e12).toFixed(1)}T
                              </div>
                              <p className="text-sm text-muted-foreground">World GDP</p>
                            </div>
                            <div>
                              <div className="text-2xl font-bold text-blue-500">
                                {adaptedGlobalStats.countryCount || 0}
                              </div>
                              <p className="text-sm text-muted-foreground">Active Nations</p>
                            </div>
                            <div>
                              <div className="text-2xl font-bold text-purple-500">
                                +{(adaptedGlobalStats.globalGrowthRate * 100).toFixed(1)}%
                              </div>
                              <p className="text-sm text-muted-foreground">Global Growth</p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {focusedCard === "eci" && (
                  <div className="space-y-6">
                    <div className="flex items-center gap-3 mb-6">
                      <Gauge className="h-8 w-8 text-indigo-400" />
                      <div>
                        <h2 className="text-2xl font-bold text-foreground">Executive Command Interface</h2>
                        <p className="text-muted-foreground">Strategic Governance & Policy Management</p>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="text-center p-6 glass-depth-1 glass-refraction rounded-lg">
                        <div className="text-3xl font-bold text-purple-400 mb-2">85</div>
                        <div className="text-sm text-muted-foreground mb-3">Social Harmony</div>
                        <Progress value={85} className="h-3" />
                      </div>
                      <div className="text-center p-6 glass-depth-1 glass-refraction rounded-lg">
                        <div className="text-3xl font-bold text-blue-400 mb-2">72</div>
                        <div className="text-sm text-muted-foreground mb-3">Security Index</div>
                        <Progress value={72} className="h-3" />
                      </div>
                      <div className="text-center p-6 glass-depth-1 glass-refraction rounded-lg">
                        <div className="text-3xl font-bold text-green-400 mb-2">89</div>
                        <div className="text-sm text-muted-foreground mb-3">Political Stability</div>
                        <Progress value={89} className="h-3" />
                      </div>
                    </div>
                    
                    <div className="mt-6">
                      <Button 
                        onClick={() => window.open(createUrl("/eci"), "_blank")}
                        className="w-full bg-indigo-600 hover:bg-indigo-700"
                      >
                        <Building2 className="h-4 w-4 mr-2" />
                        Open Full ECI Dashboard
                      </Button>
                    </div>
                  </div>
                )}

                {focusedCard === "sdi" && (
                  <div className="space-y-6">
                    <div className="flex items-center gap-3 mb-6">
                      <Eye className="h-8 w-8 text-red-400" />
                      <div>
                        <h2 className="text-2xl font-bold text-foreground">Strategic Defense Intelligence</h2>
                        <p className="text-muted-foreground">Intelligence Operations & Security Oversight</p>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="glass-depth-1 glass-refraction p-4 rounded-lg">
                        <h3 className="font-semibold mb-3 flex items-center gap-2">
                          <Lock className="h-4 w-4" />
                          Threat Assessment
                        </h3>
                        <div className="space-y-3">
                          <div className="flex items-center justify-between p-3 bg-red-50 dark:bg-red-950/20 rounded">
                            <span className="text-sm">Current Threat Level</span>
                            <Badge variant="destructive" className="text-xs">ELEVATED</Badge>
                          </div>
                          <div className="flex items-center justify-between p-3 bg-orange-50 dark:bg-orange-950/20 rounded">
                            <span className="text-sm">Active Situations</span>
                            <span className="text-sm font-medium text-red-400">3 Global Crises</span>
                          </div>
                          <div className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-950/20 rounded">
                            <span className="text-sm">Intelligence Reports</span>
                            <Badge variant="outline">12 New</Badge>
                          </div>
                        </div>
                      </div>
                      
                      <div className="glass-depth-1 glass-refraction p-4 rounded-lg">
                        <h3 className="font-semibold mb-3 flex items-center gap-2">
                          <Activity className="h-4 w-4" />
                          Operational Status
                        </h3>
                        <div className="space-y-3">
                          <div className="p-3 bg-green-50 dark:bg-green-950/20 rounded">
                            <div className="flex items-center gap-2 mb-1">
                              <CheckCircle2 className="h-4 w-4 text-green-500" />
                              <span className="text-sm font-medium">Defense Systems</span>
                            </div>
                            <p className="text-xs text-muted-foreground">All systems operational</p>
                          </div>
                          <div className="p-3 bg-blue-50 dark:bg-blue-950/20 rounded">
                            <div className="flex items-center gap-2 mb-1">
                              <Shield className="h-4 w-4 text-blue-500" />
                              <span className="text-sm font-medium">Border Security</span>
                            </div>
                            <p className="text-xs text-muted-foreground">Enhanced monitoring active</p>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="mt-6">
                      <Button 
                        onClick={() => window.open(createUrl("/sdi"), "_blank")}
                        className="w-full bg-red-600 hover:bg-red-700"
                      >
                        <Shield className="h-4 w-4 mr-2" />
                        Open Full SDI Dashboard
                      </Button>
                    </div>
                  </div>
                )}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Activity Popovers */}
        <ActivityPopover
          open={activityPopoverOpen === 0}
          anchorEl={null}
          onClose={() => setActivityPopoverOpen(null)}
          countryData={countryData ? {
            name: countryData.name,
            currentGdpPerCapita: countryData.currentGdpPerCapita,
            currentTotalGdp: countryData.currentTotalGdp,
            currentPopulation: countryData.currentPopulation,
            populationGrowthRate: countryData.populationGrowthRate || 0,
            adjustedGdpGrowth: countryData.adjustedGdpGrowth || 0,
            economicTier: countryData.economicTier,
            populationTier: countryData.populationTier || "Unknown",
            populationDensity: countryData.populationDensity || 0
          } : null}
          selectedRing={0}
        />

        <ActivityPopover
          open={activityPopoverOpen === 1}
          anchorEl={null}
          onClose={() => setActivityPopoverOpen(null)}
          countryData={countryData ? {
            name: countryData.name,
            currentGdpPerCapita: countryData.currentGdpPerCapita,
            currentTotalGdp: countryData.currentTotalGdp,
            currentPopulation: countryData.currentPopulation,
            populationGrowthRate: countryData.populationGrowthRate || 0,
            adjustedGdpGrowth: countryData.adjustedGdpGrowth || 0,
            economicTier: countryData.economicTier,
            populationTier: countryData.populationTier || "Unknown",
            populationDensity: countryData.populationDensity || 0
          } : null}
          selectedRing={1}
        />

        <ActivityPopover
          open={activityPopoverOpen === 2}
          anchorEl={null}
          onClose={() => setActivityPopoverOpen(null)}
          countryData={countryData ? {
            name: countryData.name,
            currentGdpPerCapita: countryData.currentGdpPerCapita,
            currentTotalGdp: countryData.currentTotalGdp,
            currentPopulation: countryData.currentPopulation,
            populationGrowthRate: countryData.populationGrowthRate || 0,
            adjustedGdpGrowth: countryData.adjustedGdpGrowth || 0,
            economicTier: countryData.economicTier,
            populationTier: countryData.populationTier || "Unknown",
            populationDensity: countryData.populationDensity || 0
          } : null}
          selectedRing={2}
        />
      </div>

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
  );
}