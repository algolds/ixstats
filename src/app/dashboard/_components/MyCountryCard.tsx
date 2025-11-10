"use client";

import React, { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import {
  Crown,
  Building2,
  Globe,
  Settings,
  TrendingUp,
  Users,
  DollarSign,
  BarChart3,
  ChevronUp,
  ChevronDown,
  Plus,
  ExternalLink,
  Briefcase,
  Brain,
  FileText,
  Search,
  Calculator,
  Star,
  Shield,
  Building,
} from "lucide-react";
import { VitalityRings } from "~/components/mycountry/primitives/VitalityRings";
import { HealthRing } from "~/components/ui/health-ring";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Progress } from "~/components/ui/progress";
import { ThemedTabContent } from "~/components/ui/themed-tab-content";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "~/components/ui/dropdown-menu";
import { Tooltip, TooltipTrigger, TooltipContent } from "~/components/ui/tooltip";
import { AppleRippleEffect } from "~/components/ui/apple-ripple-effect";
import { SimpleFlag } from "~/components/SimpleFlag";
import { formatCurrency, formatPopulation } from "~/lib/chart-utils";
import { cn } from "~/lib/utils";

interface CountryData {
  id: string;
  name: string;
  currentPopulation: number;
  currentGdpPerCapita: number;
  currentTotalGdp: number;
  economicTier: string;
  populationTier: string;
  adjustedGdpGrowth: number;
  populationGrowthRate: number;
  populationDensity?: number | null;
  continent?: string | null;
  region?: string | null;
  governmentType?: string | null;
  religion?: string | null;
  leader?: string | null;
}

interface ActivityRingsData {
  economicVitality: number;
  populationWellbeing: number;
  diplomaticStanding: number;
  governmentalEfficiency: number;
}

interface MyCountryCardProps {
  countryData?: CountryData;
  activityRingsData?: ActivityRingsData;
  expandedCards: Set<string>;
  setExpandedCards: (cards: Set<string>) => void;
  setActivityPopoverOpen: (index: number | null) => void;
  isRippleActive: boolean;
  isGlobalCardSlid: boolean;
  className?: string;
}

export function MyCountryCard({
  countryData,
  activityRingsData,
  expandedCards,
  setExpandedCards,
  setActivityPopoverOpen,
  isRippleActive,
  isGlobalCardSlid,
  className,
}: MyCountryCardProps) {
  // Optimized calculations - computed once and memoized
  const vitalityMetrics = useMemo(() => {
    if (!activityRingsData || !countryData) return null;

    // Economic calculations
    const economicGrowthRate = countryData.adjustedGdpGrowth;
    const economicTrendType =
      economicGrowthRate >= 0.02 ? "positive" : economicGrowthRate >= 0 ? "neutral" : "negative";
    const economicTrendColor =
      economicTrendType === "positive"
        ? "text-green-600"
        : economicTrendType === "neutral"
          ? "text-yellow-600"
          : "text-red-600";
    const economicTrendArrow =
      economicTrendType === "positive" ? "↗" : economicTrendType === "neutral" ? "→" : "↘";

    // Population calculations
    const populationGrowthRate = countryData.populationGrowthRate;
    const populationTrendType =
      populationGrowthRate >= 0.015
        ? "positive"
        : populationGrowthRate >= 0.005
          ? "neutral"
          : "negative";
    const populationTrendColor =
      populationTrendType === "positive"
        ? "text-green-600"
        : populationTrendType === "neutral"
          ? "text-yellow-600"
          : "text-red-600";
    const populationTrendArrow =
      populationTrendType === "positive" ? "↗" : populationTrendType === "neutral" ? "→" : "↘";

    // Diplomatic calculations
    const diplomaticScore = activityRingsData.diplomaticStanding;
    const diplomaticAllies = Math.floor((diplomaticScore / 100) * 15 + 5);
    const diplomaticReputation =
      diplomaticScore >= 75
        ? "Excellent"
        : diplomaticScore >= 60
          ? "Good Standing"
          : diplomaticScore >= 40
            ? "Neutral"
            : "Declining";
    const diplomaticTreaties = Math.floor((diplomaticScore / 100) * 12 + 3);
    const diplomaticTrendType =
      diplomaticScore >= 60 ? "positive" : diplomaticScore >= 40 ? "neutral" : "negative";
    const diplomaticTrendColor =
      diplomaticTrendType === "positive"
        ? "text-green-600"
        : diplomaticTrendType === "neutral"
          ? "text-yellow-600"
          : "text-red-600";
    const diplomaticTrendArrow =
      diplomaticTrendType === "positive" ? "↗" : diplomaticTrendType === "neutral" ? "→" : "↘";

    // Government calculations
    const governmentScore = activityRingsData.governmentalEfficiency;
    const governmentApproval = Math.floor(governmentScore * 0.8 + 15);
    const governmentEfficiency =
      governmentScore >= 80
        ? "Very High"
        : governmentScore >= 65
          ? "High"
          : governmentScore >= 50
            ? "Moderate"
            : governmentScore >= 35
              ? "Low"
              : "Very Low";
    const governmentStatus =
      governmentScore >= 70
        ? "Improving"
        : governmentScore >= 50
          ? "Stable"
          : governmentScore >= 30
            ? "Declining"
            : "Critical";
    const governmentTrendType =
      governmentScore >= 60 ? "positive" : governmentScore >= 40 ? "neutral" : "negative";
    const governmentTrendColor =
      governmentTrendType === "positive"
        ? "text-green-600"
        : governmentTrendType === "neutral"
          ? "text-yellow-600"
          : "text-red-600";
    const governmentTrendArrow =
      governmentTrendType === "positive" ? "↗" : governmentTrendType === "neutral" ? "→" : "↘";

    // Performance assessments
    const getPerformanceAssessment = (score: number) =>
      score >= 80
        ? "Excellent performance"
        : score >= 60
          ? "Good performance"
          : score >= 40
            ? "Needs attention"
            : "Critical - immediate action required";

    // Formatted display values
    const formattedGdpPerCapita = `$${(countryData.currentGdpPerCapita / 1000).toFixed(0)}k`;
    const formattedPopulation = `${(countryData.currentPopulation / 1000000).toFixed(1)}M`;
    const formattedEconomicGrowth = `${(economicGrowthRate * 100).toFixed(1)}% growth`;
    const formattedPopulationGrowth = `${(populationGrowthRate * 100).toFixed(1)}% growth`;

    // National Vitality Index calculation (overall performance)
    const nationalVitalityIndex = Math.round(
      (activityRingsData.economicVitality +
        activityRingsData.populationWellbeing +
        activityRingsData.diplomaticStanding +
        activityRingsData.governmentalEfficiency) /
        4
    );

    const vitalityIndexRating =
      nationalVitalityIndex >= 85
        ? "Excellent"
        : nationalVitalityIndex >= 75
          ? "Good"
          : nationalVitalityIndex >= 60
            ? "Satisfactory"
            : "Needs Improvement";

    return {
      economic: {
        score: activityRingsData.economicVitality,
        primary: formattedGdpPerCapita,
        secondary: formattedEconomicGrowth,
        trendColor: economicTrendColor,
        trendArrow: economicTrendArrow,
        tier: countryData.economicTier,
        assessment: getPerformanceAssessment(activityRingsData.economicVitality),
      },
      population: {
        score: activityRingsData.populationWellbeing,
        primary: formattedPopulation,
        secondary: formattedPopulationGrowth,
        trendColor: populationTrendColor,
        trendArrow: populationTrendArrow,
        tier: countryData.populationTier,
        assessment: getPerformanceAssessment(activityRingsData.populationWellbeing),
      },
      diplomatic: {
        score: diplomaticScore,
        primary: `${diplomaticAllies} allies`,
        secondary: diplomaticReputation,
        trendColor: diplomaticTrendColor,
        trendArrow: diplomaticTrendArrow,
        treaties: `${diplomaticTreaties} treaties`,
        assessment: getPerformanceAssessment(diplomaticScore),
      },
      government: {
        score: governmentScore,
        primary: `${governmentApproval}% approval`,
        secondary: governmentEfficiency,
        trendColor: governmentTrendColor,
        trendArrow: governmentTrendArrow,
        status: governmentStatus,
        assessment: getPerformanceAssessment(governmentScore),
      },
      nationalVitality: {
        index: nationalVitalityIndex,
        rating: vitalityIndexRating,
      },
    };
  }, [activityRingsData, countryData]);
  return (
    <motion.div
      className={cn(className)}
      style={{
        willChange: isRippleActive || isGlobalCardSlid ? "transform" : "auto",
      }}
      initial={false}
      animate={{
        scale: isGlobalCardSlid ? [1, 1.02, 1] : 1,
      }}
      transition={{
        duration: 0.4,
        ease: [0.25, 0.1, 0.25, 1],
      }}
    >
      <AppleRippleEffect isActive={isRippleActive} direction="right" className="rounded-xl">
        <motion.div
          className={cn(
            "glass-hierarchy-parent group relative overflow-hidden",
            "rounded-xl border border-neutral-200 p-5 transition-all duration-200 dark:border-white/[0.2]",
            "mycountry-card hover:shadow-xl hover:shadow-yellow-500/10 dark:hover:shadow-yellow-400/20"
          )}
          whileHover={{ y: -2 }}
          transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
          data-theme="executive"
          style={{ willChange: "transform" }}
        >
          {/* Full Bento Flag Background with Realistic Ripple */}
          {countryData && (
            <div className="pointer-events-none absolute inset-0 overflow-hidden">
              <motion.div
                className="relative h-full w-full"
                style={{
                  filter: "blur(8px)",
                  opacity: 0.4,
                }}
              >
                <motion.div
                  className="h-full w-full"
                  animate={{
                    x: [0, 2, -1, 1, 0],
                    rotateY: [0, 1, -0.5, 0.5, 0],
                    scaleX: [1, 1.01, 0.99, 1.005, 1],
                  }}
                  transition={{
                    duration: 6,
                    ease: "easeInOut",
                    repeat: Infinity,
                    times: [0, 0.25, 0.5, 0.75, 1],
                  }}
                >
                  <SimpleFlag
                    countryName={countryData.name}
                    className="h-full w-full object-cover"
                    showPlaceholder={true}
                  />
                </motion.div>
              </motion.div>

              {/* Overlay to ensure readability */}
              <div className="from-background/70 via-background/50 to-background/80 absolute inset-0 bg-gradient-to-b" />
            </div>
          )}

          {/* MyCountry Themed Shimmer Background */}
          <div className="mycountry-gold-shimmer absolute inset-0 bg-gradient-to-br from-yellow-400/20 via-yellow-500/10 to-orange-400/20" />
          <div className="tab-shimmer absolute inset-0" />

          {/* Content Layout */}
          <div className="relative z-10 flex h-full flex-col">
            {/* Top Section - Country Info */}
            <div className="mb-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-8 w-12 overflow-hidden rounded border border-white/30 shadow-lg">
                  {countryData && (
                    <SimpleFlag
                      countryName={countryData.name}
                      className="h-full w-full object-cover"
                    />
                  )}
                </div>
                <div>
                  <div className="mb-1 flex items-center gap-2">
                    <Crown className="h-5 w-5 text-yellow-400" />
                    <h3 className="text-foreground text-xl font-bold drop-shadow-sm">
                      MyCountry® Premium
                    </h3>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-foreground text-lg font-semibold drop-shadow-sm">
                      {countryData?.name || "Configure Country"}
                    </span>
                    {countryData && (
                      <Badge
                        variant="secondary"
                        className="border-yellow-400/50 bg-yellow-500/20 text-yellow-800 dark:text-yellow-200"
                      >
                        {countryData.economicTier}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>

              {/* Dropdown Menu */}
              <DropdownMenu>
                <DropdownMenuTrigger>
                  <div className="glass-hierarchy-interactive glass-refraction relative z-10 cursor-pointer rounded-full p-3 transition-all duration-200 hover:scale-105">
                    <Plus className="text-foreground h-5 w-5" />
                  </div>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="glass-modal w-56 border-yellow-400/30">
                  <Link href="/mycountry">
                    <DropdownMenuItem className="glass-hierarchy-interactive flex items-center gap-2">
                      <Crown className="h-4 w-4 text-yellow-400" />
                      <span>MyCountry Profile</span>
                      <ExternalLink className="ml-auto h-3 w-3" />
                    </DropdownMenuItem>
                  </Link>
                  <Link href="/mycountry#economy">
                    <DropdownMenuItem className="glass-hierarchy-interactive flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-green-400" />
                      <span>Economic Dashboard</span>
                    </DropdownMenuItem>
                  </Link>
                  <Link href="/mycountry#government">
                    <DropdownMenuItem className="glass-hierarchy-interactive flex items-center gap-2">
                      <Settings className="h-4 w-4 text-blue-400" />
                      <span>Policy Management</span>
                    </DropdownMenuItem>
                  </Link>
                  <Link href="/mycountry#demographics">
                    <DropdownMenuItem className="glass-hierarchy-interactive flex items-center gap-2">
                      <Users className="h-4 w-4 text-purple-400" />
                      <span>Demographics</span>
                    </DropdownMenuItem>
                  </Link>
                  <Link href="/mycountry#intelligence">
                    <DropdownMenuItem className="glass-hierarchy-interactive flex items-center gap-2">
                      <Brain className="h-4 w-4 text-indigo-400" />
                      <span>Intelligence Center</span>
                    </DropdownMenuItem>
                  </Link>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* National Vitality Rings Section */}
            {countryData && activityRingsData && (
              <ThemedTabContent theme="executive" className="tab-content-enter mb-5">
                <div className="space-y-4">
                  <h4 className="text-foreground mb-3 flex items-center gap-2 text-base sm:text-lg font-semibold">
                    <BarChart3 className="h-4 w-4 sm:h-5 sm:w-5 text-green-400" />
                    National Vitality Index
                  </h4>

                  <div className="grid grid-cols-2 gap-3 sm:gap-4 md:gap-6 lg:grid-cols-4">
                    {/* Economic Health Ring */}
                    <div className="flex flex-col items-center gap-2 sm:gap-3 text-center">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div>
                            <HealthRing
                              value={activityRingsData.economicVitality}
                              size={60}
                              color="#22c55e"
                              label="Economic Health"
                            />
                          </div>
                        </TooltipTrigger>
                        <TooltipContent className="glass-hierarchy-child max-w-xs p-4">
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <DollarSign size={16} style={{ color: "#22c55e" }} />
                              <span className="font-semibold">Economic Vitality</span>
                            </div>
                            <p className="text-muted-foreground text-sm">
                              Overall economic health including GDP growth, trade balance, and
                              economic stability
                            </p>
                            <div className="space-y-1">
                              <div className="flex justify-between text-sm">
                                <span>Score:</span>
                                <span className="font-medium">
                                  {Math.round(activityRingsData.economicVitality)}/100
                                </span>
                              </div>
                            </div>
                          </div>
                        </TooltipContent>
                      </Tooltip>
                      <div className="space-y-0.5 sm:space-y-1">
                        <div className="flex items-center justify-center gap-1 sm:gap-2">
                          <DollarSign className="h-3 w-3 sm:h-4 sm:w-4" style={{ color: "#22c55e" }} />
                          <span className="text-xs sm:text-sm font-medium">Economic</span>
                        </div>
                        <div className="text-muted-foreground text-[10px] sm:text-xs">
                          {Math.round(activityRingsData.economicVitality)}%
                        </div>
                      </div>
                    </div>

                    {/* Population Wellbeing Ring */}
                    <div className="flex flex-col items-center gap-2 sm:gap-3 text-center">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div>
                            <HealthRing
                              value={activityRingsData.populationWellbeing}
                              size={60}
                              color="#3b82f6"
                              label="Population Wellbeing"
                            />
                          </div>
                        </TooltipTrigger>
                        <TooltipContent className="glass-hierarchy-child max-w-xs p-4">
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <Users size={16} style={{ color: "#3b82f6" }} />
                              <span className="font-semibold">Population Wellbeing</span>
                            </div>
                            <p className="text-muted-foreground text-sm">
                              Demographics health, quality of life, education, and social cohesion
                              indicators
                            </p>
                            <div className="space-y-1">
                              <div className="flex justify-between text-sm">
                                <span>Score:</span>
                                <span className="font-medium">
                                  {Math.round(activityRingsData.populationWellbeing)}/100
                                </span>
                              </div>
                            </div>
                          </div>
                        </TooltipContent>
                      </Tooltip>
                      <div className="space-y-0.5 sm:space-y-1">
                        <div className="flex items-center justify-center gap-1 sm:gap-2">
                          <Users className="h-3 w-3 sm:h-4 sm:w-4" style={{ color: "#3b82f6" }} />
                          <span className="text-xs sm:text-sm font-medium">Population</span>
                        </div>
                        <div className="text-muted-foreground text-[10px] sm:text-xs">
                          {Math.round(activityRingsData.populationWellbeing)}%
                        </div>
                      </div>
                    </div>

                    {/* Diplomatic Standing Ring */}
                    <div className="flex flex-col items-center gap-2 sm:gap-3 text-center">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div>
                            <HealthRing
                              value={activityRingsData.diplomaticStanding}
                              size={60}
                              color="#a855f7"
                              label="Diplomatic Standing"
                            />
                          </div>
                        </TooltipTrigger>
                        <TooltipContent className="glass-hierarchy-child max-w-xs p-4">
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <Shield size={16} style={{ color: "#a855f7" }} />
                              <span className="font-semibold">Diplomatic Standing</span>
                            </div>
                            <p className="text-muted-foreground text-sm">
                              International relationships, treaties, trade partnerships, and global
                              reputation
                            </p>
                            <div className="space-y-1">
                              <div className="flex justify-between text-sm">
                                <span>Score:</span>
                                <span className="font-medium">
                                  {Math.round(activityRingsData.diplomaticStanding)}/100
                                </span>
                              </div>
                            </div>
                          </div>
                        </TooltipContent>
                      </Tooltip>
                      <div className="space-y-0.5 sm:space-y-1">
                        <div className="flex items-center justify-center gap-1 sm:gap-2">
                          <Shield className="h-3 w-3 sm:h-4 sm:w-4" style={{ color: "#a855f7" }} />
                          <span className="text-xs sm:text-sm font-medium">Diplomatic</span>
                        </div>
                        <div className="text-muted-foreground text-[10px] sm:text-xs">
                          {Math.round(activityRingsData.diplomaticStanding)}%
                        </div>
                      </div>
                    </div>

                    {/* Government Efficiency Ring */}
                    <div className="flex flex-col items-center gap-2 sm:gap-3 text-center">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div>
                            <HealthRing
                              value={activityRingsData.governmentalEfficiency}
                              size={60}
                              color="#f97316"
                              label="Government Efficiency"
                            />
                          </div>
                        </TooltipTrigger>
                        <TooltipContent className="glass-hierarchy-child max-w-xs p-4">
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <Building className="h-4 w-4" style={{ color: "#f97316" }} />
                              <span className="font-semibold">Government Efficiency</span>
                            </div>
                            <p className="text-muted-foreground text-sm">
                              Policy effectiveness, administrative efficiency, public approval, and
                              governance quality
                            </p>
                            <div className="space-y-1">
                              <div className="flex justify-between text-sm">
                                <span>Score:</span>
                                <span className="font-medium">
                                  {Math.round(activityRingsData.governmentalEfficiency)}/100
                                </span>
                              </div>
                            </div>
                          </div>
                        </TooltipContent>
                      </Tooltip>
                      <div className="space-y-0.5 sm:space-y-1">
                        <div className="flex items-center justify-center gap-1 sm:gap-2">
                          <Building className="h-3 w-3 sm:h-4 sm:w-4" style={{ color: "#f97316" }} />
                          <span className="text-xs sm:text-sm font-medium">Government</span>
                        </div>
                        <div className="text-muted-foreground text-[10px] sm:text-xs">
                          {Math.round(activityRingsData.governmentalEfficiency)}%
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </ThemedTabContent>
            )}

            {/* Key Metrics Grid - Always visible */}
            {countryData && (
              <div className="mb-4 sm:mb-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3">
                <div className="glass-hierarchy-child rounded-lg p-2 sm:p-2.5 text-center">
                  <div className="text-muted-foreground mb-0.5 sm:mb-1 text-[10px] sm:text-xs">Population</div>
                  <div className="text-xs sm:text-sm font-bold text-blue-400">
                    {formatPopulation(countryData.currentPopulation || 0)}
                  </div>
                </div>
                <div className="glass-hierarchy-child rounded-lg p-2 sm:p-2.5 text-center">
                  <div className="text-muted-foreground mb-0.5 sm:mb-1 text-[10px] sm:text-xs">GDP/Capita</div>
                  <div className="text-xs sm:text-sm font-bold text-green-400">
                    {formatCurrency(countryData.currentGdpPerCapita || 0)}
                  </div>
                </div>
                <div className="glass-hierarchy-child rounded-lg p-2 sm:p-2.5 text-center">
                  <div className="text-muted-foreground mb-0.5 sm:mb-1 text-[10px] sm:text-xs">Total GDP</div>
                  <div className="text-xs sm:text-sm font-bold text-yellow-400">
                    {formatCurrency(countryData.currentTotalGdp || 0)}
                  </div>
                </div>
              </div>
            )}

            {/* Expandable Content - Only shows when expanded */}
            <AnimatePresence>
              {expandedCards.has("mycountry") && countryData && (
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
                      <h4 className="text-foreground mb-3 flex items-center gap-2 text-lg font-semibold">
                        <Globe className="h-5 w-5 text-blue-400" />
                        Country Profile
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {/* Location */}
                        <div className="glass-hierarchy-child rounded-lg p-2.5">
                          <div className="mb-2 flex items-center gap-2">
                            <Globe className="h-4 w-4 text-blue-400" />
                            <div className="text-muted-foreground text-xs">Location</div>
                          </div>
                          <div className="text-foreground text-sm font-medium">
                            {countryData.region
                              ? `${countryData.region}, ${countryData.continent || "Unknown"}`
                              : countryData.continent || "Unknown Region"}
                          </div>
                        </div>

                        {/* Government Type */}
                        <div className="glass-hierarchy-child rounded-lg p-2.5">
                          <div className="mb-2 flex items-center gap-2">
                            <Building2 className="h-4 w-4 text-purple-400" />
                            <div className="text-muted-foreground text-xs">Government</div>
                          </div>
                          <div className="text-foreground text-sm font-medium">
                            {countryData.governmentType || "Constitutional Democracy"}
                          </div>
                        </div>

                        {/* Leader */}
                        <div className="glass-hierarchy-child rounded-lg p-2.5">
                          <div className="mb-2 flex items-center gap-2">
                            <Crown className="h-4 w-4 text-yellow-400" />
                            <div className="text-muted-foreground text-xs">Leader</div>
                          </div>
                          <div className="text-foreground text-sm font-medium">
                            {countryData.leader || "Prime Minister"}
                          </div>
                        </div>

                        {/* Religion */}
                        <div className="glass-hierarchy-child rounded-lg p-2.5">
                          <div className="mb-2 flex items-center gap-2">
                            <Star className="h-4 w-4 text-indigo-400" />
                            <div className="text-muted-foreground text-xs">Religion</div>
                          </div>
                          <div className="text-foreground text-sm font-medium">
                            {countryData.religion || "Secular Pluralism"}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Economic Health Indicators Section */}
                    <div>
                      <h4 className="text-foreground mb-3 flex items-center gap-2 text-lg font-semibold">
                        <BarChart3 className="h-5 w-5 text-green-400" />
                        Economic Health Indicators
                      </h4>
                      <div className="space-y-3">
                        {/* Unemployment Rate */}
                        <div className="glass-hierarchy-child rounded-lg p-2.5">
                          <div className="mb-2 flex items-center justify-between">
                            <span className="text-muted-foreground text-xs">Unemployment Rate</span>
                            <span className="text-muted-foreground text-xs">
                              {(3.5 + ((countryData.adjustedGdpGrowth || 0) < 0 ? 2 : 0)).toFixed(
                                1
                              )}
                              %
                            </span>
                          </div>
                          <Progress
                            value={
                              ((3.5 + ((countryData.adjustedGdpGrowth || 0) < 0 ? 2 : 0)) / 25) *
                              100
                            }
                            className="h-2"
                          />
                          <div className="text-muted-foreground mt-1 flex justify-between text-xs">
                            <span>0%</span>
                            <span className="text-green-600">Optimal: 3-7%</span>
                            <span>25%</span>
                          </div>
                        </div>

                        {/* Labor Force Participation */}
                        <div className="glass-hierarchy-child rounded-lg p-2.5">
                          <div className="mb-2 flex items-center justify-between">
                            <span className="text-muted-foreground text-xs">
                              Labor Force Participation
                            </span>
                            <span className="text-muted-foreground text-xs">
                              {(
                                68.5 +
                                ((countryData.currentGdpPerCapita || 0) / 100000) * 5
                              ).toFixed(1)}
                              %
                            </span>
                          </div>
                          <Progress
                            value={68.5 + ((countryData.currentGdpPerCapita || 0) / 100000) * 5}
                            className="h-2"
                          />
                          <div className="text-muted-foreground mt-1 flex justify-between text-xs">
                            <span>0%</span>
                            <span className="text-green-600">Optimal: 60-80%</span>
                            <span>100%</span>
                          </div>
                        </div>

                        {/* Economic Growth Health */}
                        <div className="glass-hierarchy-child rounded-lg p-2.5">
                          <div className="mb-2 flex items-center justify-between">
                            <span className="text-muted-foreground text-xs">
                              Economic Growth Health
                            </span>
                            <span className="text-muted-foreground text-xs">
                              {((countryData.adjustedGdpGrowth || 0) * 100).toFixed(1)}%
                            </span>
                          </div>
                          <Progress
                            value={Math.max(
                              0,
                              Math.min(100, ((countryData.adjustedGdpGrowth || 0) * 100 + 5) * 10)
                            )}
                            className="h-2"
                          />
                          <div className="text-muted-foreground mt-1 flex justify-between text-xs">
                            <span>-5%</span>
                            <span className="text-green-600">Optimal: 2-5%</span>
                            <span>10%</span>
                          </div>
                        </div>

                        {/* Economic Stability Index */}
                        <div className="glass-hierarchy-child rounded-lg p-2.5">
                          <div className="mb-2 flex items-center justify-between">
                            <span className="text-muted-foreground text-xs">
                              Economic Stability Index
                            </span>
                            <span className="text-muted-foreground text-xs">
                              {activityRingsData?.economicVitality || 0}%
                            </span>
                          </div>
                          <Progress
                            value={activityRingsData?.economicVitality || 0}
                            className="h-2"
                          />
                          <div className="text-muted-foreground mt-1 flex justify-between text-xs">
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
                <div className="mb-4 flex justify-center">
                  <button
                    onClick={() => {
                      const newExpanded = new Set(expandedCards);
                      if (newExpanded.has("mycountry")) {
                        newExpanded.delete("mycountry");
                      } else {
                        newExpanded.add("mycountry");
                      }
                      setExpandedCards(newExpanded);
                    }}
                    className="glass-hierarchy-interactive text-foreground flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-transform hover:scale-105"
                  >
                    {expandedCards.has("mycountry") ? (
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
                <div className="flex flex-wrap justify-center gap-1.5 sm:gap-2">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Link href="/mycountry">
                        <div className="glass-hierarchy-child cursor-pointer rounded-lg p-2 transition-transform hover:scale-105">
                          <FileText className="h-4 w-4 text-blue-400" />
                        </div>
                      </Link>
                    </TooltipTrigger>
                    <TooltipContent>Overview</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Link href="/mycountry#executive">
                        <div className="glass-hierarchy-child cursor-pointer rounded-lg p-2 transition-transform hover:scale-105">
                          <Crown className="h-4 w-4 text-yellow-400" />
                        </div>
                      </Link>
                    </TooltipTrigger>
                    <TooltipContent>Executive</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Link href="/mycountry#economy">
                        <div className="glass-hierarchy-child cursor-pointer rounded-lg p-2 transition-transform hover:scale-105">
                          <TrendingUp className="h-4 w-4 text-green-400" />
                        </div>
                      </Link>
                    </TooltipTrigger>
                    <TooltipContent>Economy</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Link href="/mycountry#labor">
                        <div className="glass-hierarchy-child cursor-pointer rounded-lg p-2 transition-transform hover:scale-105">
                          <Briefcase className="h-4 w-4 text-orange-400" />
                        </div>
                      </Link>
                    </TooltipTrigger>
                    <TooltipContent>Labor</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Link href="/mycountry#government">
                        <div className="glass-hierarchy-child cursor-pointer rounded-lg p-2 transition-transform hover:scale-105">
                          <Building2 className="h-4 w-4 text-purple-400" />
                        </div>
                      </Link>
                    </TooltipTrigger>
                    <TooltipContent>Government</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Link href="/mycountry#demographics">
                        <div className="glass-hierarchy-child cursor-pointer rounded-lg p-2 transition-transform hover:scale-105">
                          <Users className="h-4 w-4 text-pink-400" />
                        </div>
                      </Link>
                    </TooltipTrigger>
                    <TooltipContent>Demographics</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Link href="/mycountry#intelligence">
                        <div className="glass-hierarchy-child cursor-pointer rounded-lg p-2 transition-transform hover:scale-105">
                          <Brain className="h-4 w-4 text-indigo-400" />
                        </div>
                      </Link>
                    </TooltipTrigger>
                    <TooltipContent>Intelligence</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Link href="/mycountry#analytics">
                        <div className="glass-hierarchy-child cursor-pointer rounded-lg p-2 transition-transform hover:scale-105">
                          <Search className="h-4 w-4 text-teal-400" />
                        </div>
                      </Link>
                    </TooltipTrigger>
                    <TooltipContent>Detailed Analysis</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Link href="/mycountry#analytics">
                        <div className="glass-hierarchy-child cursor-pointer rounded-lg p-2 transition-transform hover:scale-105">
                          <Calculator className="h-4 w-4 text-cyan-400" />
                        </div>
                      </Link>
                    </TooltipTrigger>
                    <TooltipContent>Economic Modeling</TooltipContent>
                  </Tooltip>
                </div>
              </div>
            )}

            {/* No country data state */}
            {!countryData && (
              <div className="text-muted-foreground py-8 text-center">
                <Crown className="mx-auto mb-4 h-12 w-12 opacity-50" />
                <p className="text-sm">
                  Configure your country profile to access MyCountry® Premium
                </p>
              </div>
            )}
          </div>
        </motion.div>
      </AppleRippleEffect>
    </motion.div>
  );
}
