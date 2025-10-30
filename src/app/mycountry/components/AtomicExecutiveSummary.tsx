"use client";

import React from "react";
import { motion } from "framer-motion";
import {
  Crown,
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
  CheckCircle,
  Clock,
  Target,
  Zap,
  Calendar,
  Globe2,
  BarChart3,
  Users,
  DollarSign,
  Shield,
  Building2,
  Activity,
  Brain,
  Lightbulb,
} from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Progress } from "~/components/ui/progress";
import { Separator } from "~/components/ui/separator";
import { AtomicIntelligenceFeed } from "~/components/intelligence/AtomicIntelligenceFeed";

import type { ComponentType } from "~/types/government";
import {
  ComponentType as PrismaComponentType,
  EconomicComponentType,
  TaxComponentType,
} from "@prisma/client";
import { api } from "~/trpc/react";

// Enhanced types for atomic integration
interface AtomicExecutiveSummaryProps {
  countryId: string;
  countryName: string;
  countryFlag?: string;
  isOwner?: boolean;
  economicData: {
    gdpGrowthRate: number;
    inflationRate: number;
    gdpPerCapita: number;
    unemploymentRate?: number;
  };
  nationalHealth: {
    overallScore: number;
    trendDirection: "up" | "down" | "stable";
    criticalAlerts: Array<{
      id: string;
      type: "security" | "economic" | "social" | "environmental";
      severity: "critical" | "high" | "medium" | "low";
      message: string;
      timestamp: Date;
      source: string;
    }>;
    keyOpportunities: Array<{
      id: string;
      category: "economic" | "diplomatic" | "social" | "governance";
      title: string;
      description: string;
      impact: "high" | "medium" | "low";
      timeframe: "immediate" | "short-term" | "medium-term" | "long-term";
    }>;
  };
  className?: string;
  showAtomicIntelligence?: boolean;
}

function getTrendIcon(trend: "up" | "down" | "stable", size = 16) {
  const props = {
    size,
    className:
      trend === "up" ? "text-green-600" : trend === "down" ? "text-red-600" : "text-yellow-600",
  };

  switch (trend) {
    case "up":
      return <TrendingUp {...props} />;
    case "down":
      return <TrendingDown {...props} />;
    case "stable":
      return <Minus {...props} />;
  }
}

function getHealthStatus(score: number) {
  if (score >= 85)
    return { label: "Excellent", color: "text-green-600", bg: "bg-green-50 dark:bg-green-950/20" };
  if (score >= 70)
    return { label: "Good", color: "text-blue-600", bg: "bg-blue-50 dark:bg-blue-950/20" };
  if (score >= 50)
    return {
      label: "Moderate",
      color: "text-yellow-600",
      bg: "bg-yellow-50 dark:bg-yellow-950/20",
    };
  if (score >= 30)
    return {
      label: "Concerning",
      color: "text-orange-600",
      bg: "bg-orange-50 dark:bg-orange-950/20",
    };
  return { label: "Critical", color: "text-red-600", bg: "bg-red-50 dark:bg-red-950/20" };
}

export function AtomicExecutiveSummary({
  countryId,
  countryName,
  countryFlag,
  isOwner = false,
  economicData,
  nationalHealth,
  className = "",
  showAtomicIntelligence = true,
}: AtomicExecutiveSummaryProps) {
  // Fetch unified atomic components
  const { data: allComponents, isLoading: componentsLoading } = api.unifiedAtomic.getAll.useQuery(
    { countryId },
    {
      enabled: !!countryId && showAtomicIntelligence,
      staleTime: 30000,
    }
  );

  const { data: synergies, isLoading: synergiesLoading } =
    api.unifiedAtomic.detectSynergies.useQuery(
      { countryId },
      {
        enabled: !!countryId && showAtomicIntelligence,
        staleTime: 30000,
      }
    );

  const { data: effectiveness, isLoading: effectivenessLoading } =
    api.unifiedAtomic.calculateCombinedEffectiveness.useQuery(
      { countryId },
      {
        enabled: !!countryId && showAtomicIntelligence,
        staleTime: 30000,
      }
    );

  const activeGovernmentComponents =
    allComponents?.government?.filter((c) => c.isActive).map((c) => c.componentType) || [];
  const activeEconomicComponents =
    allComponents?.economic?.filter((c) => c.isActive).map((c) => c.componentType) || [];
  const activeTaxComponents =
    allComponents?.tax?.filter((c) => c.isActive).map((c) => c.componentType) || [];
  const totalActiveComponents =
    activeGovernmentComponents.length +
    activeEconomicComponents.length +
    activeTaxComponents.length;
  const healthStatus = getHealthStatus(nationalHealth.overallScore);

  const taxData = {
    collectionEfficiency: 85, // Could be fetched from tax system
    complianceRate: 80,
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
      className={className}
    >
      {/* Executive Header */}
      <Card className="glass-hierarchy-parent overflow-hidden border-0 border-l-4 border-l-amber-600 bg-gradient-to-br from-amber-700/15 via-amber-600/10 to-amber-400/5">
        <CardHeader className="pb-4">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              {countryFlag && (
                <div className="h-8 w-12 overflow-hidden rounded border shadow-sm">
                  <img
                    src={countryFlag}
                    alt={`${countryName} flag`}
                    className="h-full w-full object-cover"
                  />
                </div>
              )}
              <div>
                <CardTitle className="flex items-center gap-3 text-2xl font-bold">
                  <Crown className="h-6 w-6 text-amber-600" />
                  {isOwner ? `MyCountry: ${countryName}` : countryName}
                  <Badge variant="outline" className="text-xs">
                    Atomic Executive Dashboard
                  </Badge>
                </CardTitle>
                <p className="text-muted-foreground mt-1">
                  Atomic System: {totalActiveComponents} Components Active
                  {activeGovernmentComponents.length > 0 &&
                    ` (${activeGovernmentComponents.length} Gov)`}
                  {activeEconomicComponents.length > 0 &&
                    ` (${activeEconomicComponents.length} Econ)`}
                  {activeTaxComponents.length > 0 && ` (${activeTaxComponents.length} Tax)`}
                </p>
              </div>
            </div>

            <div className="text-right">
              <div className="mb-1 flex items-center gap-2">
                <div className={`text-sm font-semibold ${healthStatus.color}`}>
                  {healthStatus.label}
                </div>
                {getTrendIcon(nationalHealth.trendDirection, 20)}
              </div>
              <div className="text-2xl font-bold">{nationalHealth.overallScore}%</div>
              <div className="text-muted-foreground text-xs">National Health Score</div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Key Economic Indicators Enhanced with Atomic Context */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <div className="rounded-lg bg-blue-50/50 p-3 text-center dark:bg-blue-950/20">
              <BarChart3 className="mx-auto mb-2 h-5 w-5 text-blue-600" />
              <div className="text-lg font-semibold text-blue-600">
                {economicData.gdpGrowthRate.toFixed(1)}%
              </div>
              <div className="text-muted-foreground text-xs">GDP Growth</div>
            </div>

            <div className="rounded-lg bg-green-50/50 p-3 text-center dark:bg-green-950/20">
              <Target className="mx-auto mb-2 h-5 w-5 text-green-600" />
              <div className="text-lg font-semibold text-green-600">
                {economicData.inflationRate.toFixed(1)}%
              </div>
              <div className="text-muted-foreground text-xs">Inflation Rate</div>
            </div>

            <div className="rounded-lg bg-purple-50/50 p-3 text-center dark:bg-purple-950/20">
              <DollarSign className="mx-auto mb-2 h-5 w-5 text-purple-600" />
              <div className="text-lg font-semibold text-purple-600">
                ${(economicData.gdpPerCapita / 1000).toFixed(0)}K
              </div>
              <div className="text-muted-foreground text-xs">GDP Per Capita</div>
            </div>

            <div className="rounded-lg bg-orange-50/50 p-3 text-center dark:bg-orange-950/20">
              <Shield className="mx-auto mb-2 h-5 w-5 text-orange-600" />
              <div className="text-lg font-semibold text-orange-600">
                {effectiveness?.combinedScore?.toFixed(1) || "N/A"}%
              </div>
              <div className="text-muted-foreground text-xs">System Effectiveness</div>
            </div>
          </div>

          {/* Atomic System Breakdown */}
          {showAtomicIntelligence &&
            (activeGovernmentComponents.length > 0 ||
              activeEconomicComponents.length > 0 ||
              activeTaxComponents.length > 0) && (
              <div>
                <h4 className="mb-3 flex items-center gap-2 text-sm font-medium text-blue-600">
                  <Activity className="h-4 w-4" />
                  Atomic System Status
                </h4>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  {/* Government Components */}
                  {activeGovernmentComponents.length > 0 && (
                    <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 dark:bg-blue-950/20">
                      <div className="mb-2 flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-blue-600" />
                        <span className="text-sm font-medium text-blue-800">Government</span>
                        <Badge variant="outline" className="text-xs">
                          {activeGovernmentComponents.length}
                        </Badge>
                      </div>
                      <div className="text-xs text-blue-700">
                        Effectiveness: {effectiveness?.governmentScore?.toFixed(1) || "N/A"}%
                      </div>
                    </div>
                  )}

                  {/* Economic Components */}
                  {activeEconomicComponents.length > 0 && (
                    <div className="rounded-lg border border-green-200 bg-green-50 p-3 dark:bg-green-950/20">
                      <div className="mb-2 flex items-center gap-2">
                        <TrendingUp className="h-4 w-4 text-green-600" />
                        <span className="text-sm font-medium text-green-800">Economic</span>
                        <Badge variant="outline" className="text-xs">
                          {activeEconomicComponents.length}
                        </Badge>
                      </div>
                      <div className="text-xs text-green-700">
                        Effectiveness: {effectiveness?.economicScore?.toFixed(1) || "N/A"}%
                      </div>
                    </div>
                  )}

                  {/* Tax Components */}
                  {activeTaxComponents.length > 0 && (
                    <div className="rounded-lg border border-purple-200 bg-purple-50 p-3 dark:bg-purple-950/20">
                      <div className="mb-2 flex items-center gap-2">
                        <DollarSign className="h-4 w-4 text-purple-600" />
                        <span className="text-sm font-medium text-purple-800">Tax</span>
                        <Badge variant="outline" className="text-xs">
                          {activeTaxComponents.length}
                        </Badge>
                      </div>
                      <div className="text-xs text-purple-700">
                        Effectiveness: {effectiveness?.taxScore?.toFixed(1) || "N/A"}%
                      </div>
                    </div>
                  )}
                </div>

                {/* Synergies Display */}
                {synergies && synergies.length > 0 && (
                  <div className="mt-4">
                    <h5 className="mb-2 flex items-center gap-2 text-sm font-medium text-emerald-600">
                      <Zap className="h-4 w-4" />
                      Active Synergies ({synergies.length})
                    </h5>
                    <div className="space-y-2">
                      {synergies
                        .slice(0, 5)
                        .map(
                          (
                            synergy: { type: string; description: string; bonus: number },
                            index: number
                          ) => (
                            <div
                              key={index}
                              className="rounded border border-emerald-200 bg-emerald-50 p-2 dark:bg-emerald-950/20"
                            >
                              <div className="text-xs font-medium text-emerald-800">
                                {synergy.type === "GOV_ECON"
                                  ? "Government-Economic Synergy"
                                  : synergy.type === "GOV_TAX"
                                    ? "Government-Tax Synergy"
                                    : synergy.type === "ECON_TAX"
                                      ? "Economic-Tax Synergy"
                                      : synergy.type === "ALL_THREE"
                                        ? "Comprehensive Framework"
                                        : "Cross-System Synergy"}
                              </div>
                              <div className="text-xs text-emerald-700">{synergy.description}</div>
                              <div className="text-xs text-emerald-600">
                                Bonus: +{synergy.bonus}%
                              </div>
                            </div>
                          )
                        )}
                    </div>
                  </div>
                )}
              </div>
            )}

          {/* Critical Alerts Section */}
          {nationalHealth.criticalAlerts.length > 0 && (
            <div>
              <h4 className="mb-3 flex items-center gap-2 text-sm font-medium text-red-600">
                <AlertTriangle className="h-4 w-4" />
                Critical Alerts ({nationalHealth.criticalAlerts.length})
              </h4>
              <div className="space-y-2">
                {nationalHealth.criticalAlerts.slice(0, 3).map((alert) => (
                  <div
                    key={alert.id}
                    className="flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 p-3 dark:bg-red-950/20"
                  >
                    <AlertTriangle className="h-4 w-4 flex-shrink-0 text-red-600" />
                    <div className="min-w-0 flex-grow">
                      <div className="text-sm font-medium text-red-800">{alert.message}</div>
                      <div className="mt-1 text-xs text-red-600">
                        {alert.source} • {new Date(alert.timestamp).toLocaleString()}
                      </div>
                    </div>
                    <Badge variant="destructive" className="text-xs">
                      {alert.severity}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Key Opportunities */}
          {nationalHealth.keyOpportunities.length > 0 && (
            <div>
              <h4 className="mb-3 flex items-center gap-2 text-sm font-medium text-green-600">
                <Lightbulb className="h-4 w-4" />
                Key Opportunities ({nationalHealth.keyOpportunities.length})
              </h4>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {nationalHealth.keyOpportunities.slice(0, 4).map((opportunity) => (
                  <div
                    key={opportunity.id}
                    className="rounded-lg border border-green-200 bg-green-50 p-3 dark:bg-green-950/20"
                  >
                    <div className="mb-2 flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        {opportunity.category}
                      </Badge>
                      <Badge
                        variant={opportunity.impact === "high" ? "default" : "secondary"}
                        className="text-xs"
                      >
                        {opportunity.impact} impact
                      </Badge>
                    </div>
                    <h5 className="mb-1 text-sm font-medium text-green-800">{opportunity.title}</h5>
                    <p className="text-xs text-green-700">{opportunity.description}</p>
                    <div className="mt-2 text-xs text-green-600">
                      Timeline: {opportunity.timeframe}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Atomic Intelligence Integration */}
      {showAtomicIntelligence && (
        <div className="mt-6">
          {componentsLoading ? (
            <Card>
              <CardContent className="p-6 text-center">
                <Brain className="mx-auto mb-2 h-8 w-8 animate-pulse text-blue-500" />
                <p className="text-muted-foreground">Loading atomic intelligence...</p>
              </CardContent>
            </Card>
          ) : (
            <AtomicIntelligenceFeed
              components={activeGovernmentComponents}
              economicComponents={activeEconomicComponents}
              taxComponents={activeTaxComponents}
              economicData={economicData}
              taxData={taxData}
              countryName={countryName}
              showDetailedAnalysis={true}
              maxItems={8}
              synergies={{
                governmentSynergies:
                  synergies
                    ?.filter((s) => s.type === "GOV_ECON" || s.type === "GOV_TAX")
                    .map((s) => ({
                      name:
                        s.type === "GOV_ECON"
                          ? "Government-Economic Synergy"
                          : "Government-Tax Synergy",
                      description: s.description,
                    })) || [],
                crossBuilderSynergies:
                  synergies
                    ?.filter((s) => s.type === "ECON_TAX" || s.type === "ALL_THREE")
                    .map((s, idx) => ({
                      id: `synergy-${idx}`,
                      description: s.description,
                      effectivenessBonus: s.bonus,
                    })) || [],
              }}
              effectiveness={effectiveness}
            />
          )}
        </div>
      )}
    </motion.div>
  );
}
