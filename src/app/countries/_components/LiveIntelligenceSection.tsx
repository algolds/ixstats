"use client";

import React, { useState, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "~/lib/utils";
import { api } from "~/trpc/react";
import Link from "next/link";
import { createUrl } from "~/lib/url-utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Skeleton } from "~/components/ui/skeleton";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { Progress } from "~/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import type { CriticalAlert } from "~/types/intelligence-unified";
import {
  Brain,
  Activity,
  Bell,
  BarChart3,
  Users,
  DollarSign,
  Globe,
  Building2,
  Building,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  Clock,
  Shield,
  Zap,
  Eye,
  Calendar,
  ChevronDown,
} from "lucide-react";
import { Tooltip, TooltipTrigger, TooltipContent } from "~/components/ui/tooltip";
import { FocusCards, createDefaultFocusCards } from "~/app/mycountry/components/FocusCards";
import { HealthRing } from "~/components/ui/health-ring";
import { formatCurrency, formatPopulation } from "~/lib/chart-utils";

interface LiveIntelligenceSectionProps {
  countryId: string;
  country?: {
    name: string;
    economicTier: string;
    currentGdpPerCapita: number;
    currentTotalGdp: number;
    currentPopulation: number;
    populationTier: string;
    populationGrowthRate?: number;
    adjustedGdpGrowth?: number;
    growthStreak?: number;
    populationDensity?: number;
    landArea?: number;
    continent?: string;
    region?: string;
  };
}

interface IntelligenceBriefing {
  id: string;
  category: string;
  title: string;
  priority: "low" | "medium" | "high" | "critical";
  confidenceScore: number;
  summary: string;
  details: string[];
  timestamp: number;
  source: string;
}

interface ApiAlert {
  id: string;
  type: string;
  title: string;
  message: string;
  urgent: boolean;
}

interface Notification {
  id: string;
  type: string;
  priority: string;
  title: string;
  message: string;
  timestamp: number;
  category: string;
  actionRequired: boolean;
  relatedData?: any;
}

// Import the correct Alert type from the FocusCards component
type FocusCardAlert = {
  id: string;
  type: "info" | "warning" | "error" | "success";
  title: string;
  message: string;
  urgent: boolean;
};

function convertApiAlert(apiAlert: ApiAlert): CriticalAlert {
  return {
    id: apiAlert.id,
    createdAt: Date.now(),
    category: "economic", // Default category
    source: "system",
    confidence: 80,
    actionable: apiAlert.urgent,
    title: apiAlert.title,
    message: apiAlert.message,
    severity: apiAlert.urgent ? "critical" : "medium",
    actionRequired: apiAlert.urgent,
    timeframe: "immediate",
    estimatedImpact: {
      magnitude: "medium",
      areas: [],
    },
    recommendedActions: [],
  };
}

export function LiveIntelligenceSection({ countryId, country }: LiveIntelligenceSectionProps) {
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
  // Get live intelligence data
  const { data: briefings, isLoading: briefingsLoading } =
    api.countries.getIntelligenceBriefings.useQuery({ countryId, timeframe: "week" });

  const { data: focusCardsData, isLoading: focusLoading } =
    api.countries.getFocusCardsData.useQuery({ countryId });

  const { data: activityRingsData, isLoading: activityLoading } =
    api.countries.getActivityRingsData.useQuery({ countryId });

  const { data: notifications, isLoading: notificationsLoading } =
    api.countries.getNotifications.useQuery({ countryId, limit: 10 });

  const isLoading = briefingsLoading || focusLoading || activityLoading || notificationsLoading;

  // Calculate strategic assessment metrics like the profile page
  const economicMetrics = useMemo(() => {
    if (!country) return null;
    const economicHealth = Math.min(100, (country.currentGdpPerCapita / 50000) * 100);
    const growthRate = country.adjustedGdpGrowth || 0;
    const unemploymentRate = Math.max(2, Math.min(15, 8 - growthRate * 100));

    return {
      economicHealth,
      growthRate,
      unemploymentRate,
      gdpPerCapita: country.currentGdpPerCapita,
      totalGdp: country.currentTotalGdp,
      economicTier: country.economicTier,
      growthTrend: (growthRate > 0.02 ? "up" : growthRate < -0.01 ? "down" : "stable") as
        | "up"
        | "down"
        | "stable",
    };
  }, [country]);

  const demographicMetrics = useMemo(() => {
    if (!country) return null;
    const popGrowthRate = country.populationGrowthRate || 0;
    const populationGrowth = Math.min(100, Math.max(0, (popGrowthRate * 100 + 2) * 25));
    const literacyRate = Math.min(99, 70 + country.currentGdpPerCapita / 1000);
    const lifeExpectancy = Math.min(85, 65 + country.currentGdpPerCapita / 2000);

    return {
      populationGrowth,
      literacyRate,
      lifeExpectancy,
      population: country.currentPopulation,
      populationTier: country.populationTier,
      populationDensity: country.populationDensity,
      landArea: country.landArea,
      growthTrend: (popGrowthRate > 0.01 ? "up" : popGrowthRate < 0 ? "down" : "stable") as
        | "up"
        | "down"
        | "stable",
    };
  }, [country]);

  const developmentMetrics = useMemo(() => {
    if (!country) return null;
    const tierScores: Record<string, number> = {
      Extravagant: 100,
      "Very Strong": 85,
      Strong: 70,
      Healthy: 55,
      Developed: 40,
      Developing: 25,
    };
    const developmentIndex = tierScores[country.economicTier] || 10;
    const stabilityRating = Math.min(100, 75 + (country.growthStreak || 0) * 2);

    return {
      developmentIndex,
      stabilityRating,
      economicTier: country.economicTier,
      growthStreak: country.growthStreak || 0,
      continent: country.continent,
      region: country.region,
    };
  }, [country]);

  // Helper functions for trends
  const getTrendIcon = (trend: "up" | "down" | "stable") => {
    switch (trend) {
      case "up":
        return TrendingUp;
      case "down":
        return TrendingUp; // Using same icon, will rotate with color
      default:
        return Activity;
    }
  };

  const getTrendColor = (trend: "up" | "down" | "stable") => {
    switch (trend) {
      case "up":
        return "text-green-400";
      case "down":
        return "text-red-400";
      default:
        return "text-gray-400";
    }
  };

  // Toggle card expansion
  const toggleCard = useCallback((cardId: string) => {
    setExpandedCards((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(cardId)) {
        newSet.delete(cardId);
      } else {
        newSet.add(cardId);
      }
      return newSet;
    });
  }, []);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-1/3" />
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Skeleton className="h-96" />
          <Skeleton className="h-96" />
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  // Transform data for components
  const focusCards = focusCardsData
    ? createDefaultFocusCards({
        economic: {
          healthScore: focusCardsData.economic.healthScore,
          gdpPerCapita: focusCardsData.economic.gdpPerCapita,
          growthRate: focusCardsData.economic.growthRate,
          economicTier: focusCardsData.economic.economicTier,
          alerts: focusCardsData.economic.alerts.map(convertApiAlert),
        },
        population: {
          healthScore: focusCardsData.population.healthScore,
          population: focusCardsData.population.population,
          growthRate: focusCardsData.population.growthRate,
          populationTier: focusCardsData.population.populationTier,
          alerts: focusCardsData.population.alerts.map(convertApiAlert),
        },
        diplomatic: {
          healthScore: focusCardsData.diplomatic.healthScore,
          allies: focusCardsData.diplomatic.allies,
          reputation: focusCardsData.diplomatic.reputation,
          treaties: focusCardsData.diplomatic.treaties,
          alerts: focusCardsData.diplomatic.alerts.map(convertApiAlert),
        },
        government: {
          healthScore: focusCardsData.government.healthScore,
          approval: focusCardsData.government.approval,
          efficiency: focusCardsData.government.efficiency,
          stability: focusCardsData.government.stability,
          alerts: focusCardsData.government.alerts.map(convertApiAlert),
        },
      })
    : [];
  // Create activity data matching the countries/[id] page format
  const activityData = activityRingsData
    ? [
        {
          label: "Economic Health",
          value: activityRingsData.economicVitality || 0,
          color: "#22c55e",
          icon: DollarSign,
        },
        {
          label: "Population Wellbeing",
          value: activityRingsData.populationWellbeing || 0,
          color: "#3b82f6",
          icon: Users,
        },
        {
          label: "Diplomatic Standing",
          value: activityRingsData.diplomaticStanding || 0,
          color: "#a855f7",
          icon: Shield,
        },
        {
          label: "Government Efficiency",
          value: activityRingsData.governmentalEfficiency || 0,
          color: "#f97316",
          icon: Building,
        },
      ]
    : [];

  const highPriorityNotifications =
    notifications?.notifications
      ?.filter((notif: Notification) => notif.priority === "high" || notif.priority === "critical")
      .slice(0, 5) || [];

  const recentBriefings = briefings?.briefings?.slice(0, 3) || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Live Intelligence Dashboard</h2>
        <Badge className="bg-gradient-to-r from-blue-500 to-purple-500 text-white">
          <Eye className="mr-1 h-3 w-3" />
          LIVE DATA
        </Badge>
      </div>

      {/* Full Intelligence Center CTA */}
      <Card className="border-2 border-indigo-200 bg-gradient-to-r from-indigo-50 via-purple-50 to-blue-50 dark:border-indigo-800 dark:from-indigo-950/40 dark:via-purple-950/40 dark:to-blue-950/40">
        <CardContent className="p-6">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 p-3">
                <Brain className="h-6 w-6 text-white" />
              </div>
              <div>
                <h3 className="mb-1 text-lg font-semibold">Unified Intelligence Center</h3>
                <p className="text-muted-foreground text-sm">
                  Access AI recommendations, global intelligence feed, and advanced analysis in one
                  place
                </p>
              </div>
            </div>
            <Link href={createUrl("/mycountry/intelligence")}>
              <Button className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:from-indigo-700 hover:to-purple-700">
                <Brain className="mr-2 h-4 w-4" />
                Open Intelligence Center
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="overview" className="flex items-center gap-1">
            <Activity className="h-4 w-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="focus" className="flex items-center gap-1">
            <BarChart3 className="h-4 w-4" />
            Focus Areas
          </TabsTrigger>
          <TabsTrigger value="briefings" className="flex items-center gap-1">
            <Brain className="h-4 w-4" />
            Briefings
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab - Strategic Assessment + Alerts */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {/* Strategic Assessment Cards */}
            <div className="space-y-4 lg:col-span-2">
              {/* Economic Intelligence Card */}
              {economicMetrics && (
                <Card className="border border-amber-500/20 bg-gradient-to-br from-amber-500/5 to-transparent dark:border-amber-400/20 dark:from-amber-400/5">
                  <CardContent className="p-0">
                    <button
                      onClick={() => toggleCard("economic")}
                      className="w-full p-4 text-left transition-colors hover:bg-amber-500/10 dark:hover:bg-amber-400/10"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <DollarSign className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                          <div>
                            <h3 className="text-lg font-semibold text-amber-700 dark:text-amber-300">
                              Economic Intelligence
                            </h3>
                            <p className="text-muted-foreground text-sm">
                              {formatCurrency(economicMetrics.gdpPerCapita)} GDP/capita
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <div className="text-lg font-bold text-amber-600 dark:text-amber-400">
                              {economicMetrics.economicHealth.toFixed(0)}%
                            </div>
                            <div className="text-muted-foreground flex items-center gap-1 text-xs">
                              {(() => {
                                const TrendIcon = getTrendIcon(economicMetrics.growthTrend);
                                return (
                                  <TrendIcon
                                    className={cn(
                                      "h-3 w-3",
                                      getTrendColor(economicMetrics.growthTrend)
                                    )}
                                  />
                                );
                              })()}
                              {economicMetrics.economicTier}
                            </div>
                          </div>
                          <motion.div
                            animate={{ rotate: expandedCards.has("economic") ? 180 : 0 }}
                            transition={{ duration: 0.2 }}
                          >
                            <ChevronDown className="text-muted-foreground h-4 w-4" />
                          </motion.div>
                        </div>
                      </div>
                    </button>

                    <AnimatePresence>
                      {expandedCards.has("economic") && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.3 }}
                          className="border-t border-amber-500/20 bg-amber-500/5 dark:border-amber-400/20 dark:bg-amber-400/5"
                        >
                          <div className="space-y-4 p-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
                              <div className="bg-muted/50 rounded-lg p-3">
                                <div className="text-muted-foreground text-xs">Total GDP</div>
                                <div className="text-foreground font-semibold">
                                  {formatCurrency(economicMetrics.totalGdp)}
                                </div>
                              </div>
                              <div className="bg-muted/50 rounded-lg p-3">
                                <div className="text-muted-foreground text-xs">Growth Rate</div>
                                <div className="text-foreground font-semibold">
                                  {(economicMetrics.growthRate * 100).toFixed(1)}%
                                </div>
                              </div>
                              <div className="bg-muted/50 rounded-lg p-3">
                                <div className="text-muted-foreground text-xs">
                                  Unemployment Est.
                                </div>
                                <div className="text-foreground font-semibold">
                                  {economicMetrics.unemploymentRate.toFixed(1)}%
                                </div>
                              </div>
                            </div>

                            <div className="rounded-lg border border-amber-200/20 bg-amber-50/50 p-3 dark:border-amber-800/20 dark:bg-amber-950/20">
                              <div className="text-muted-foreground mb-2 text-xs">
                                Economic Assessment
                              </div>
                              <div className="text-foreground text-sm leading-relaxed">
                                {economicMetrics.economicHealth > 70
                                  ? "Strong economic fundamentals with healthy GDP per capita and growth trajectory."
                                  : economicMetrics.economicHealth > 40
                                    ? "Moderate economic performance. Growth opportunities exist with strategic development."
                                    : "Developing economy with significant potential for expansion and improvement."}
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </CardContent>
                </Card>
              )}

              {/* Demographic Intelligence Card */}
              {demographicMetrics && (
                <Card className="border border-blue-500/20 bg-gradient-to-br from-blue-500/5 to-transparent dark:border-blue-400/20 dark:from-blue-400/5">
                  <CardContent className="p-0">
                    <button
                      onClick={() => toggleCard("demographic")}
                      className="w-full p-4 text-left transition-colors hover:bg-blue-500/10 dark:hover:bg-blue-400/10"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Users className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                          <div>
                            <h3 className="text-lg font-semibold text-blue-700 dark:text-blue-300">
                              Population Intelligence
                            </h3>
                            <p className="text-muted-foreground text-sm">
                              {formatPopulation(demographicMetrics.population)} people
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <div className="text-lg font-bold text-blue-600 dark:text-blue-400">
                              Tier {demographicMetrics.populationTier}
                            </div>
                            <div className="text-muted-foreground flex items-center gap-1 text-xs">
                              {(() => {
                                const TrendIcon = getTrendIcon(demographicMetrics.growthTrend);
                                return (
                                  <TrendIcon
                                    className={cn(
                                      "h-3 w-3",
                                      getTrendColor(demographicMetrics.growthTrend)
                                    )}
                                  />
                                );
                              })()}
                              {((country?.populationGrowthRate || 0) * 100).toFixed(1)}%
                            </div>
                          </div>
                          <motion.div
                            animate={{ rotate: expandedCards.has("demographic") ? 180 : 0 }}
                            transition={{ duration: 0.2 }}
                          >
                            <ChevronDown className="text-muted-foreground h-4 w-4" />
                          </motion.div>
                        </div>
                      </div>
                    </button>

                    <AnimatePresence>
                      {expandedCards.has("demographic") && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.3 }}
                          className="border-t border-blue-500/20 bg-blue-500/5 dark:border-blue-400/20 dark:bg-blue-400/5"
                        >
                          <div className="space-y-4 p-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                              <div className="bg-muted/50 rounded-lg p-3">
                                <div className="text-muted-foreground text-xs">Life Expectancy</div>
                                <div className="text-foreground font-semibold">
                                  {demographicMetrics.lifeExpectancy.toFixed(0)} years
                                </div>
                              </div>
                              <div className="bg-muted/50 rounded-lg p-3">
                                <div className="text-muted-foreground text-xs">Literacy Rate</div>
                                <div className="text-foreground font-semibold">
                                  {demographicMetrics.literacyRate.toFixed(1)}%
                                </div>
                              </div>
                              {demographicMetrics.populationDensity && (
                                <div className="bg-muted/50 rounded-lg p-3">
                                  <div className="text-muted-foreground text-xs">Density</div>
                                  <div className="text-foreground font-semibold">
                                    {demographicMetrics.populationDensity.toFixed(1)}/km²
                                  </div>
                                </div>
                              )}
                              {demographicMetrics.landArea && (
                                <div className="bg-muted/50 rounded-lg p-3">
                                  <div className="text-muted-foreground text-xs">Land Area</div>
                                  <div className="text-foreground font-semibold">
                                    {demographicMetrics.landArea.toLocaleString()} km²
                                  </div>
                                </div>
                              )}
                            </div>

                            <div className="rounded-lg border border-blue-200/20 bg-blue-50/50 p-3 dark:border-blue-800/20 dark:bg-blue-950/20">
                              <div className="text-muted-foreground mb-2 text-xs">
                                Demographic Analysis
                              </div>
                              <div className="text-foreground text-sm leading-relaxed">
                                {demographicMetrics.populationGrowth > 70
                                  ? "Robust population growth indicating strong social stability and economic opportunities."
                                  : demographicMetrics.populationGrowth > 40
                                    ? "Moderate demographic trends with balanced population dynamics."
                                    : "Stable or declining population growth, typical of developed nations."}
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </CardContent>
                </Card>
              )}

              {/* Development Intelligence Card */}
              {developmentMetrics && (
                <Card className="border border-purple-500/20 bg-gradient-to-br from-purple-500/5 to-transparent dark:border-purple-400/20 dark:from-purple-400/5">
                  <CardContent className="p-0">
                    <button
                      onClick={() => toggleCard("development")}
                      className="w-full p-4 text-left transition-colors hover:bg-purple-500/10 dark:hover:bg-purple-400/10"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Building className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                          <div>
                            <h3 className="text-lg font-semibold text-purple-700 dark:text-purple-300">
                              Development Intelligence
                            </h3>
                            <p className="text-muted-foreground text-sm">
                              {developmentMetrics.economicTier} nation
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <div className="text-lg font-bold text-purple-600 dark:text-purple-400">
                              {developmentMetrics.developmentIndex}%
                            </div>
                            <div className="text-muted-foreground text-xs">
                              {developmentMetrics.growthStreak}Q Streak
                            </div>
                          </div>
                          <motion.div
                            animate={{ rotate: expandedCards.has("development") ? 180 : 0 }}
                            transition={{ duration: 0.2 }}
                          >
                            <ChevronDown className="text-muted-foreground h-4 w-4" />
                          </motion.div>
                        </div>
                      </div>
                    </button>

                    <AnimatePresence>
                      {expandedCards.has("development") && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.3 }}
                          className="border-t border-purple-500/20 bg-purple-500/5 dark:border-purple-400/20 dark:bg-purple-400/5"
                        >
                          <div className="space-y-4 p-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                              <div className="bg-muted/50 rounded-lg p-3">
                                <div className="text-muted-foreground text-xs">
                                  Development Index
                                </div>
                                <div className="text-foreground font-semibold">
                                  {developmentMetrics.developmentIndex}%
                                </div>
                              </div>
                              <div className="bg-muted/50 rounded-lg p-3">
                                <div className="text-muted-foreground text-xs">
                                  Stability Rating
                                </div>
                                <div className="text-foreground font-semibold">
                                  {developmentMetrics.stabilityRating.toFixed(0)}%
                                </div>
                              </div>
                            </div>

                            <div className="space-y-2 text-sm">
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Economic Tier:</span>
                                <span className="font-medium text-purple-600 dark:text-purple-400">
                                  {developmentMetrics.economicTier}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Growth Streak:</span>
                                <span className="text-green-600 dark:text-green-400">
                                  {developmentMetrics.growthStreak} Quarters
                                </span>
                              </div>
                              {developmentMetrics.region && (
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">Region:</span>
                                  <span className="text-foreground">
                                    {developmentMetrics.region}
                                  </span>
                                </div>
                              )}
                            </div>

                            <div className="rounded-lg border border-purple-200/20 bg-purple-50/50 p-3 dark:border-purple-800/20 dark:bg-purple-950/20">
                              <div className="text-muted-foreground mb-2 text-xs">
                                Development Assessment
                              </div>
                              <div className="text-foreground text-sm leading-relaxed">
                                {developmentMetrics.developmentIndex > 80
                                  ? "Highly developed nation with advanced infrastructure and strong institutional frameworks."
                                  : developmentMetrics.developmentIndex > 50
                                    ? "Well-developed country with solid economic foundations and growing capabilities."
                                    : "Developing nation with significant potential for growth and modernization."}
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Alerts Column */}
            <div className="space-y-4">
              {/* High Priority Alerts */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-red-500" />
                    Critical Alerts
                  </CardTitle>
                  <CardDescription className="text-xs">High priority notifications</CardDescription>
                </CardHeader>
                <CardContent>
                  {highPriorityNotifications.length > 0 ? (
                    <div className="space-y-2">
                      {highPriorityNotifications.map((notif: Notification) => (
                        <div
                          key={notif.id}
                          className={`rounded-lg border-l-4 p-3 ${
                            notif.priority === "critical"
                              ? "border-l-red-500 bg-red-50 dark:bg-red-950/20"
                              : "border-l-orange-500 bg-orange-50 dark:bg-orange-950/20"
                          }`}
                        >
                          <div className="mb-1 flex items-start justify-between">
                            <h4 className="text-sm font-semibold">{notif.title}</h4>
                            <Badge
                              className={`text-xs ${
                                notif.priority === "critical" ? "bg-red-500" : "bg-orange-500"
                              }`}
                            >
                              {notif.priority}
                            </Badge>
                          </div>
                          <p className="text-muted-foreground mb-2 text-xs">{notif.message}</p>
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground">{notif.category}</span>
                            <span className="text-muted-foreground">
                              {new Date(notif.timestamp).toLocaleDateString()}
                            </span>
                          </div>
                          {notif.actionRequired && (
                            <Button variant="outline" size="sm" className="mt-2 h-6 w-full text-xs">
                              Take Action
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-muted-foreground py-6 text-center">
                      <CheckCircle className="mx-auto mb-2 h-8 w-8 text-green-500 opacity-50" />
                      <p className="text-xs text-green-600">No critical alerts</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Recent Notifications */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Bell className="h-4 w-4 text-blue-500" />
                    Recent Activity
                  </CardTitle>
                  <CardDescription className="text-xs">Latest system updates</CardDescription>
                </CardHeader>
                <CardContent>
                  {notifications?.notifications && notifications.notifications.length > 0 ? (
                    <div className="space-y-2">
                      {notifications.notifications.slice(0, 4).map((notif: Notification) => (
                        <div key={notif.id} className="bg-muted/30 rounded-lg border p-2">
                          <div className="mb-1 flex items-start justify-between">
                            <h4 className="text-xs font-medium">{notif.title}</h4>
                            <Badge variant="outline" className="text-xs">
                              {notif.priority}
                            </Badge>
                          </div>
                          <p className="text-muted-foreground mb-1 text-xs">{notif.message}</p>
                          <div className="text-muted-foreground text-xs">
                            {new Date(notif.timestamp).toLocaleDateString()}
                          </div>
                        </div>
                      ))}
                      {notifications.total > 4 && (
                        <div className="pt-2 text-center">
                          <Button variant="ghost" size="sm" className="h-6 text-xs">
                            +{notifications.total - 4} more
                          </Button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-muted-foreground py-6 text-center">
                      <Bell className="mx-auto mb-2 h-8 w-8 opacity-50" />
                      <p className="text-xs">No recent activity</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* Focus Areas Tab - Focus Cards */}
        <TabsContent value="focus" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-purple-500" />
                Strategic Focus Areas
              </CardTitle>
              <CardDescription>
                Intelligence-driven command center for key national sectors
              </CardDescription>
            </CardHeader>
            <CardContent>
              {focusCards.length > 0 ? (
                <FocusCards cards={focusCards} layout="grid" expandable={true} interactive={true} />
              ) : (
                <div className="text-muted-foreground py-8 text-center">
                  <BarChart3 className="mx-auto mb-4 h-12 w-12 opacity-50" />
                  <p className="text-sm">No focus area data available</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Intelligence Briefings Tab */}
        <TabsContent value="briefings" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Brain className="h-5 w-5 text-cyan-500" />
                Intelligence Briefings
              </CardTitle>
              <CardDescription>
                Real-time intelligence analysis for the past {briefings?.timeframe || "week"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {recentBriefings.length > 0 ? (
                <div className="space-y-4">
                  {recentBriefings.map((briefing: IntelligenceBriefing) => (
                    <Card key={briefing.id} className="border-l-4 border-l-cyan-500">
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <CardTitle className="text-lg">{briefing.title}</CardTitle>
                            <div className="mt-1 flex items-center gap-2">
                              <Badge variant="outline" className="text-xs">
                                {briefing.category}
                              </Badge>
                              <Badge
                                className={
                                  briefing.priority === "critical"
                                    ? "bg-red-500"
                                    : briefing.priority === "high"
                                      ? "bg-orange-500"
                                      : briefing.priority === "medium"
                                        ? "bg-yellow-500"
                                        : "bg-green-500"
                                }
                              >
                                {briefing.priority}
                              </Badge>
                              <span className="text-muted-foreground flex items-center gap-1 text-xs">
                                <Shield className="h-3 w-3" />
                                {briefing.confidenceScore}% confidence
                              </span>
                            </div>
                          </div>
                          <span className="text-muted-foreground text-xs">
                            {new Date(briefing.timestamp).toLocaleDateString()}
                          </span>
                        </div>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <p className="mb-3 text-sm">{briefing.summary}</p>
                        {briefing.details.length > 0 && (
                          <div className="space-y-1">
                            {briefing.details.map((detail, i) => (
                              <div
                                key={i}
                                className="text-muted-foreground flex items-start gap-2 text-xs"
                              >
                                <CheckCircle className="mt-0.5 h-3 w-3 flex-shrink-0 text-green-500" />
                                {detail}
                              </div>
                            ))}
                          </div>
                        )}
                        <div className="mt-3 flex items-center justify-between border-t pt-3">
                          <span className="text-muted-foreground text-xs">
                            Source: {briefing.source}
                          </span>
                          <Button variant="ghost" size="sm" className="h-6 px-2 text-xs">
                            View Details
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="text-muted-foreground py-8 text-center">
                  <Brain className="mx-auto mb-4 h-12 w-12 opacity-50" />
                  <p className="text-sm">No intelligence briefings available</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Footer with data freshness indicator */}
      <Alert>
        <Zap className="h-4 w-4" />
        <AlertDescription>
          Intelligence data is updated in real-time based on current country statistics and economic
          indicators. Last updated:{" "}
          {briefings?.generatedAt ? new Date(briefings.generatedAt).toLocaleString() : "Loading..."}
        </AlertDescription>
      </Alert>
    </div>
  );
}
