"use client";

import React, { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import {
  AlertCircle,
  TrendingUp,
  TrendingDown,
  Activity,
  Zap,
  Shield,
  Crown,
  ChevronRight,
  Eye,
  Clock,
  Target,
  AlertTriangle,
  Brain,
  Sparkles,
  Globe,
  MessageSquare,
  Building,
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Progress } from "~/components/ui/progress";
import { NumberFlowDisplay } from "~/components/ui/number-flow";
import type {
  ExecutiveIntelligence,
  CriticalAlert,
  TrendingInsight,
  ActionableRecommendation,
  IntelligenceComponentProps,
} from "../types/intelligence";
import {
  getIntelligenceEconomicData,
  getQuickEconomicHealth,
} from "~/lib/enhanced-economic-service";
import type { CountryWithEconomicData } from "~/types/ixstats";
import type { EconomyData } from "~/types/economics";
import { api } from "~/trpc/react";
import { useUser } from "~/context/auth-context";
import { toast } from "sonner";
import { withBasePath } from "~/lib/base-path";
import { DiplomaticHealthRing } from "~/components/diplomatic/DiplomaticHealthRing";
import { DiplomaticMeetingScheduler } from "~/components/executive/DiplomaticMeetingScheduler";

interface ExecutiveCommandCenterProps extends IntelligenceComponentProps {
  intelligence: ExecutiveIntelligence;
  country: {
    name: string;
    flag: string;
    leader: string;
  };
  isOwner: boolean;
  countryStats?: CountryWithEconomicData;
  economyData?: EconomyData;
  onActionClick?: (action: ActionableRecommendation) => void;
  onAlertClick?: (alert: CriticalAlert) => void;
  onPrivateAccess?: () => void;
  onNavigateToIntelligence?: () => void;
  onNavigateToMeetings?: () => void;
  onNavigateToPolicy?: () => void;
}

const severityConfig = {
  critical: {
    color: "border-red-500 bg-red-50 dark:bg-red-950/20",
    badge: "bg-red-500 text-white",
    icon: AlertTriangle,
  },
  warning: {
    color: "border-yellow-500 bg-yellow-50 dark:bg-yellow-950/20",
    badge: "bg-yellow-500 text-white",
    icon: AlertCircle,
  },
  info: {
    color: "border-blue-500 bg-blue-50 dark:bg-blue-950/20",
    badge: "bg-blue-500 text-white",
    icon: Activity,
  },
  success: {
    color: "border-green-500 bg-green-50 dark:bg-green-950/20",
    badge: "bg-green-500 text-white",
    icon: Shield,
  },
} as const;

const urgencyConfig = {
  urgent: { color: "text-red-600", icon: AlertTriangle },
  important: { color: "text-yellow-600", icon: Clock },
  routine: { color: "text-blue-600", icon: Activity },
  future: { color: "text-gray-600", icon: Target },
} as const;

function CriticalAlertsSection({
  alerts,
  onAlertClick,
  onNavigateToFeed,
  countryId,
}: {
  alerts: CriticalAlert[];
  onAlertClick?: (alert: CriticalAlert) => void;
  onNavigateToFeed?: () => void;
  countryId?: string;
}) {
  // Add diplomatic alerts to the critical alerts
  const { data: diplomaticChanges = [] } = api.diplomatic.getRecentChanges.useQuery(
    { countryId: countryId || "", hours: 48 },
    { enabled: !!countryId }
  );

  const diplomaticAlerts = React.useMemo(() => {
    const criticalDiplomaticEvents = diplomaticChanges
      .filter(
        (change: any) =>
          change.changeType === "relationship_change" ||
          change.changeType === "embassy_update" ||
          change.changeType === "mission_failed"
      )
      .slice(0, 2);

    return criticalDiplomaticEvents.map(
      (event: any) =>
        ({
          id: `diplomatic-${event.id}`,
          title: `Diplomatic Update: ${event.targetCountry}`,
          message: event.description || `${event.changeType.replace("_", " ")} detected`,
          severity: event.changeType === "mission_failed" ? "critical" : "warning",
          priority: event.changeType === "mission_failed" ? "high" : "medium",
          actionRequired: event.changeType === "mission_failed",
        }) as CriticalAlert
    );
  }, [diplomaticChanges]);

  const allAlerts = [...alerts, ...diplomaticAlerts];

  if (allAlerts.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="mb-6"
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-red-600" />
          <span className="font-semibold text-red-600">Critical Alerts</span>
          <Badge variant="destructive" className="text-xs">
            {allAlerts.length}
          </Badge>
        </div>
        {onNavigateToFeed && allAlerts.length > 0 && (
          <button
            onClick={onNavigateToFeed}
            className="text-xs text-blue-600 hover:text-blue-800 hover:underline"
          >
            View Intelligence Feed
          </button>
        )}
      </div>

      <div className="space-y-2">
        {allAlerts.slice(0, 3).map((alert, index) => {
          const config = severityConfig[alert.severity];
          const Icon = config.icon;

          return (
            <motion.div
              key={
                alert.id && alert.id.trim() ? `alert-${alert.id.trim()}` : `alert-fallback-${index}`
              }
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
              className={`cursor-pointer rounded-lg border-l-4 p-3 transition-all hover:shadow-md ${config.color}`}
              onClick={() => onAlertClick?.(alert)}
            >
              <div className="flex items-start gap-3">
                <Icon className="mt-0.5 h-4 w-4 flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex items-center gap-2">
                    <h4 className="truncate text-sm font-medium">{alert.title}</h4>
                    <Badge className={`text-xs ${config.badge}`}>{alert.priority}</Badge>
                  </div>
                  <p className="text-muted-foreground line-clamp-2 text-sm">{alert.message}</p>
                  {alert.actionRequired && (
                    <div className="mt-2 text-xs font-medium text-amber-600">Action Required</div>
                  )}
                </div>
                <ChevronRight className="text-muted-foreground h-4 w-4 flex-shrink-0" />
              </div>
            </motion.div>
          );
        })}

        {allAlerts.length > 3 && (
          <Button variant="outline" size="sm" className="w-full text-xs">
            View All Alerts ({allAlerts.length})
          </Button>
        )}
      </div>
    </motion.div>
  );
}

function TrendingInsightsSection({ insights }: { insights: TrendingInsight[] }) {
  if (insights.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.1 }}
      className="mb-6"
    >
      <div className="mb-3 flex items-center gap-2">
        <TrendingUp className="h-4 w-4 text-blue-600" />
        <span className="font-semibold text-blue-600">Trending Insights</span>
        <Badge variant="secondary" className="text-xs">
          {insights.length}
        </Badge>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {insights.slice(0, 4).map((insight, index) => {
          const Icon = insight.icon;
          const TrendIcon =
            insight.trend === "up"
              ? TrendingUp
              : insight.trend === "down"
                ? TrendingDown
                : Activity;

          return (
            <motion.div
              key={
                insight.id && insight.id.trim()
                  ? `insight-${insight.id.trim()}`
                  : `insight-fallback-${index}`
              }
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.1 }}
              className="border-border bg-card rounded-lg border p-3 transition-all hover:shadow-sm"
            >
              <div className="flex items-start gap-3">
                <div className="rounded-lg bg-blue-50 p-2 dark:bg-blue-950/20">
                  <Icon className="h-4 w-4 text-blue-600" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex items-center gap-2">
                    <h4 className="truncate text-sm font-medium">{insight.title}</h4>
                    <TrendIcon
                      className={`h-3 w-3 ${
                        insight.trend === "up"
                          ? "text-green-600"
                          : insight.trend === "down"
                            ? "text-red-600"
                            : "text-gray-600"
                      }`}
                    />
                  </div>
                  <p className="text-muted-foreground line-clamp-2 text-xs">
                    {insight.description}
                  </p>
                  <div className="mt-2 flex items-center gap-2">
                    <Badge variant="outline" className="text-xs capitalize">
                      {insight.significance}
                    </Badge>
                    <span className="text-muted-foreground text-xs">
                      {insight.context.confidence}% confidence
                    </span>
                  </div>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}

function QuickActionsSection({
  actions,
  onActionClick,
  onNavigateToPolicy,
}: {
  actions: ActionableRecommendation[];
  onActionClick?: (action: ActionableRecommendation) => void;
  onNavigateToPolicy?: () => void;
}) {
  if (actions.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.2 }}
      className="mb-6"
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-purple-600" />
          <span className="font-semibold text-purple-600">Recommended Actions</span>
          <Badge variant="secondary" className="text-xs">
            {actions.length}
          </Badge>
        </div>
        {onNavigateToPolicy && actions.length > 0 && (
          <button
            onClick={onNavigateToPolicy}
            className="text-xs text-purple-600 hover:text-purple-800 hover:underline"
          >
            Create Custom Policy
          </button>
        )}
      </div>

      <div className="space-y-2">
        {actions.slice(0, 3).map((action, index) => {
          const config = urgencyConfig[action.urgency];
          const Icon = config.icon;

          return (
            <motion.div
              key={
                action.id && action.id.trim()
                  ? `action-${action.id.trim()}`
                  : `action-fallback-${index}`
              }
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
              className="border-border bg-card cursor-pointer rounded-lg border p-3 transition-all hover:shadow-sm"
              onClick={() => onActionClick?.(action)}
            >
              <div className="flex items-start gap-3">
                <div className="rounded-lg bg-purple-50 p-2 dark:bg-purple-950/20">
                  <Icon className={`h-4 w-4 ${config.color}`} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex items-center gap-2">
                    <h4 className="text-sm font-medium">{action.title}</h4>
                    <Badge variant="outline" className="text-xs capitalize">
                      {action.urgency}
                    </Badge>
                  </div>
                  <p className="text-muted-foreground mb-2 line-clamp-2 text-xs">
                    {action.description}
                  </p>
                  <div className="text-muted-foreground flex items-center gap-3 text-xs">
                    <span>Duration: {action.estimatedDuration}</span>
                    <span>•</span>
                    <span>Success: {action.successProbability}%</span>
                    <span>•</span>
                    <span className="text-green-600">{action.estimatedBenefit}</span>
                  </div>
                </div>
                <ChevronRight className="text-muted-foreground h-4 w-4 flex-shrink-0" />
              </div>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}

// Helper components for diplomatic section
function DiplomaticStat({
  countryId,
  statType,
}: {
  countryId: string;
  statType: "embassies" | "relationships" | "pending";
}) {
  const { data: embassies = [] } = api.diplomatic.getEmbassies.useQuery(
    { countryId },
    { enabled: !!countryId && statType === "embassies" }
  );
  const { data: recentChanges = [] } = api.diplomatic.getRecentChanges.useQuery(
    { countryId, hours: 24 },
    { enabled: !!countryId && statType === "relationships" }
  );

  if (statType === "embassies") {
    const activeEmbassies = embassies.filter(
      (e: any) => e.status === "ACTIVE" || e.status === "active"
    );
    return (
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-2">
          <Building className="text-muted-foreground h-3 w-3" />
          <span className="text-muted-foreground">Active Embassies</span>
        </div>
        <span className="font-medium">{activeEmbassies.length}</span>
      </div>
    );
  }

  if (statType === "relationships") {
    const relationshipChanges = recentChanges
      .filter(
        (c: any) => c.changeType === "relationship_change" || c.changeType === "mission_completed"
      )
      .slice(0, 3);

    if (relationshipChanges.length === 0) {
      return (
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            <Activity className="text-muted-foreground h-3 w-3" />
            <span className="text-muted-foreground">Recent Changes</span>
          </div>
          <span className="text-muted-foreground text-xs">None</span>
        </div>
      );
    }

    return (
      <div className="space-y-1">
        <div className="text-muted-foreground text-xs font-medium">Recent Changes:</div>
        {relationshipChanges.map((change: any, idx: number) => (
          <div key={change.id || idx} className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground flex-1 truncate">{change.targetCountry}</span>
            <Badge variant="outline" className="text-xs">
              {change.changeType.replace("_", " ")}
            </Badge>
          </div>
        ))}
      </div>
    );
  }

  // pending actions
  return (
    <div className="flex items-center justify-between text-sm">
      <div className="flex items-center gap-2">
        <Clock className="text-muted-foreground h-3 w-3" />
        <span className="text-muted-foreground">Pending Actions</span>
      </div>
      <Badge variant="secondary" className="text-xs">
        0
      </Badge>
    </div>
  );
}

function DiplomaticRecommendations({ countryId }: { countryId: string }) {
  const { data: embassies = [] } = api.diplomatic.getEmbassies.useQuery(
    { countryId },
    { enabled: !!countryId }
  );
  const { data: relations = [] } = api.diplomatic.getRelationships.useQuery(
    { countryId },
    { enabled: !!countryId }
  );

  const recommendations: Array<{ text: string; action: string; icon: any }> = [];

  // Recommend establishing more embassies if count is low
  if (embassies.length < 5) {
    recommendations.push({
      text: "Expand embassy network to strengthen diplomatic presence",
      action: "Establish Embassy",
      icon: Building,
    });
  }

  // Recommend improving weak relationships
  const weakRelations = relations.filter((r: any) => r.strength < 40);
  if (weakRelations.length > 0) {
    recommendations.push({
      text: `Improve ${weakRelations.length} weak relationship${weakRelations.length !== 1 ? "s" : ""}`,
      action: "Launch Mission",
      icon: Target,
    });
  }

  // Recommend cultural exchange if none active
  recommendations.push({
    text: "Host cultural exchange to boost diplomatic goodwill",
    action: "Create Exchange",
    icon: Globe,
  });

  if (recommendations.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      <div className="text-muted-foreground text-xs font-medium">Recommendations:</div>
      {recommendations.slice(0, 2).map((rec, idx) => {
        const Icon = rec.icon;
        return (
          <div
            key={idx}
            className="rounded-md border border-purple-200 bg-purple-50 p-2 text-xs dark:border-purple-800 dark:bg-purple-950/20"
          >
            <div className="flex items-start gap-2">
              <Icon className="mt-0.5 h-3 w-3 flex-shrink-0 text-purple-600" />
              <div className="min-w-0 flex-1">
                <p className="text-purple-900 dark:text-purple-100">{rec.text}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function ExecutiveCommandCenter({
  intelligence,
  country,
  isOwner,
  countryStats,
  economyData,
  onActionClick,
  onAlertClick,
  onPrivateAccess,
  onNavigateToIntelligence,
  onNavigateToMeetings,
  onNavigateToPolicy,
  className = "",
  loading = false,
}: ExecutiveCommandCenterProps) {
  const { user } = useUser();
  const [viewMode, setViewMode] = useState<"overview" | "detailed">("overview");
  const [diplomaticMeetingOpen, setDiplomaticMeetingOpen] = useState(false);

  // Get country ID from countryStats
  const countryId = countryStats?.id || "";

  // Get live quick actions from unified intelligence API
  const { data: quickActionsData, refetch: refetchActions } =
    api.unifiedIntelligence.getQuickActions.useQuery(
      { countryId: countryId },
      { enabled: !!countryId }
    );

  // Execute quick action mutation using unified intelligence API
  const executeAction = api.unifiedIntelligence.executeAction.useMutation({
    onSuccess: (result) => {
      toast.success(`Action executed: ${result.message}`);
      void refetchActions();
    },
    onError: (error) => {
      toast.error(`Failed to execute action: ${error.message}`);
    },
  });

  // Handle quick action execution
  const handleQuickActionClick = (action: ActionableRecommendation) => {
    if (action.id && countryId) {
      // Map action ID to action type
      const actionType = action.id.includes("infrastructure")
        ? "infrastructure_boost"
        : action.id.includes("security")
          ? "security_review"
          : action.id.includes("education")
            ? "education_expansion"
            : action.id.includes("trade")
              ? "trade_mission"
              : action.id.includes("diplomatic")
                ? "diplomatic_outreach"
                : action.id.includes("economic")
                  ? "economic_stimulus"
                  : action.id.includes("meeting") || action.id.includes("schedule")
                    ? "schedule_meeting"
                    : action.id.includes("policy") || action.id.includes("create_policy")
                      ? "create_policy"
                      : action.id.includes("planning")
                        ? "strategic_planning"
                        : action.id.includes("recommendation")
                          ? "policy_implementation"
                          : "policy_implementation";

      executeAction.mutate({
        countryId: countryId,
        actionType: actionType as any,
        parameters: {
          title: action.title,
          description: action.description,
        },
        priority: "NORMAL",
        notes: action.description,
      });
    }

    // Also call the original onActionClick if provided
    onActionClick?.(action);
  };

  // Enhanced economic intelligence
  const enhancedEconomicData = useMemo(() => {
    if (countryStats && economyData) {
      try {
        // Convert CountryWithEconomicData to CountryStats format
        const mappedCountryStats = {
          id: countryStats.id,
          name: countryStats.name,
          country: countryStats.name,
          continent: countryStats.continent,
          region: countryStats.region,
          governmentType: countryStats.governmentType,
          religion: countryStats.religion,
          leader: countryStats.leader,
          areaSqMi: countryStats.areaSqMi,
          population: countryStats.currentPopulation,
          gdpPerCapita: countryStats.currentGdpPerCapita,
          landArea: countryStats.landArea,
          maxGdpGrowthRate: countryStats.maxGdpGrowthRate,
          adjustedGdpGrowth: countryStats.adjustedGdpGrowth,
          populationGrowthRate: countryStats.populationGrowthRate,
          actualGdpGrowth: countryStats.adjustedGdpGrowth,
          projected2040Population: countryStats.currentPopulation * 1.2, // Estimate
          projected2040Gdp: countryStats.currentTotalGdp * 1.2, // Estimate
          projected2040GdpPerCapita: countryStats.currentGdpPerCapita * 1.2, // Estimate
          localGrowthFactor: countryStats.localGrowthFactor,
          totalGdp: countryStats.currentTotalGdp,
          currentPopulation: countryStats.currentPopulation,
          currentGdpPerCapita: countryStats.currentGdpPerCapita,
          currentTotalGdp: countryStats.currentTotalGdp,
          lastCalculated: countryStats.lastCalculated,
          baselineDate: countryStats.baselineDate,
          economicTier: countryStats.economicTier as any,
          populationTier: countryStats.populationTier as any,
          populationDensity: countryStats.populationDensity,
          gdpDensity: countryStats.gdpDensity,
          globalGrowthFactor: 1.0, // Default value
          historicalData: (countryStats.historical || []).map((h) => ({
            id: `historical-${h.year}`,
            countryId: countryStats.id,
            ixTimeTimestamp: new Date(h.year, 0, 1).getTime(),
            population: h.population,
            gdpPerCapita: h.gdp / h.population,
            totalGdp: h.gdp,
            populationGrowthRate: 0, // Not available in HistoricalData
            gdpGrowthRate: 0, // Not available in HistoricalData
            landArea: countryStats.landArea,
            populationDensity: h.population / (countryStats.landArea || 1),
            gdpDensity: h.gdp / (countryStats.landArea || 1),
          })),
        };

        const healthCheck = getQuickEconomicHealth(mappedCountryStats, economyData);
        const intelligenceData = getIntelligenceEconomicData(mappedCountryStats, economyData);
        return { healthCheck, intelligenceData, hasData: true };
      } catch (error) {
        console.warn("Enhanced economic data unavailable:", error);
        return { hasData: false };
      }
    }
    return { hasData: false };
  }, [countryStats, economyData]);

  const overallHealthColor = useMemo(() => {
    switch (intelligence.overallStatus) {
      case "excellent":
        return "text-green-600";
      case "good":
        return "text-blue-600";
      case "concerning":
        return "text-yellow-600";
      case "critical":
        return "text-red-600";
      default:
        return "text-gray-600";
    }
  }, [intelligence.overallStatus]);

  const averageScore = useMemo(() => {
    return Math.round(
      intelligence.vitalityIntelligence.reduce((sum, v) => sum + v.score, 0) /
        intelligence.vitalityIntelligence.length
    );
  }, [intelligence.vitalityIntelligence]);

  if (loading) {
    return (
      <Card className={`glass-hierarchy-parent ${className}`}>
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="bg-muted h-4 w-3/4 rounded"></div>
            <div className="bg-muted h-4 w-1/2 rounded"></div>
            <div className="bg-muted h-20 rounded"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className={className}
    >
      <Card className="glass-hierarchy-parent overflow-hidden">
        <CardHeader className="pb-4">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className="ring-border h-12 w-12 overflow-hidden rounded-full ring-2">
                  {country.flag ? (
                    <img
                      src={country.flag}
                      alt={`${country.name} flag`}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="bg-muted flex h-full w-full items-center justify-center text-xs font-semibold">
                      {(country.name || "").slice(0, 2).toUpperCase()}
                    </div>
                  )}
                </div>
                <div
                  className={`border-background absolute -right-1 -bottom-1 h-4 w-4 rounded-full border-2 ${
                    intelligence.overallStatus === "excellent"
                      ? "bg-green-500"
                      : intelligence.overallStatus === "good"
                        ? "bg-blue-500"
                        : intelligence.overallStatus === "concerning"
                          ? "bg-yellow-500"
                          : "bg-red-500"
                  }`}
                ></div>
              </div>

              <div>
                <CardTitle className="flex items-center gap-2 text-xl font-bold">
                  {country.name}
                  <Crown className="h-5 w-5 text-amber-500" />
                </CardTitle>
                <p className="text-muted-foreground text-sm">
                  Executive Command Center • {country.leader}
                </p>
                <div className="mt-2 flex items-center gap-3">
                  <div className="flex items-center gap-1">
                    <span className="text-sm font-medium">Overall Health:</span>
                    <span className={`text-sm font-bold ${overallHealthColor}`}>
                      {averageScore}/100 • {intelligence.overallStatus.toUpperCase()}
                    </span>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {intelligence.confidenceLevel}% confidence
                  </Badge>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant={viewMode === "overview" ? "default" : "outline"}
                size="sm"
                onClick={() => setViewMode("overview")}
              >
                <Eye className="mr-1 h-4 w-4" />
                Overview
              </Button>
              <Button
                variant={viewMode === "detailed" ? "default" : "outline"}
                size="sm"
                onClick={() => setViewMode("detailed")}
              >
                <Activity className="mr-1 h-4 w-4" />
                Detailed
              </Button>
            </div>
          </div>

          <div className="mt-4">
            <Progress value={averageScore} className="h-2" />
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          <AnimatePresence mode="wait">
            {viewMode === "overview" ? (
              <motion.div
                key="overview"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6"
              >
                <CriticalAlertsSection
                  alerts={intelligence.criticalAlerts}
                  onAlertClick={onAlertClick}
                  onNavigateToFeed={onNavigateToIntelligence}
                  countryId={countryId}
                />

                <TrendingInsightsSection insights={intelligence.trendingInsights} />

                <div className="hidden md:block">
                  <QuickActionsSection
                    actions={
                      quickActionsData?.actions
                        ? quickActionsData.actions.map((action: any) => ({
                            id: action.id,
                            title: action.title,
                            description: action.description,
                            category: action.category || "governance",
                            urgency: action.urgency as
                              | "urgent"
                              | "important"
                              | "routine"
                              | "future",
                            difficulty: action.difficulty || "moderate",
                            estimatedDuration: action.estimatedDuration,
                            estimatedCost: action.estimatedCost || 0,
                            successProbability: action.successProbability,
                            estimatedBenefit: action.estimatedBenefit,
                            prerequisites: action.requirements || [],
                            expectedOutcome:
                              action.estimatedBenefit || "Improved system performance",
                            risks: action.risks || ["Implementation complexity"],
                            impact: action.impact || "medium",
                            context: { confidence: action.successProbability },
                          }))
                        : intelligence.urgentActions
                    }
                    onActionClick={handleQuickActionClick}
                    onNavigateToPolicy={onNavigateToPolicy}
                  />
                </div>

                <div className="border-border/60 bg-muted/40 text-muted-foreground rounded-xl border border-dashed p-4 text-sm md:hidden">
                  <p className="text-foreground font-medium">Quick actions moved</p>
                  <p className="mt-1 leading-snug">
                    Access actionable plays from the Intelligence Center via the mobile menu.
                  </p>
                  <Link
                    href={withBasePath("/mycountry/intelligence")}
                    className="text-primary mt-3 inline-flex items-center gap-2 hover:underline"
                  >
                    <Shield className="h-4 w-4" />
                    <span>Open Intelligence Center</span>
                  </Link>
                </div>

                {/* Enhanced Economic Intelligence */}
                {enhancedEconomicData.hasData && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: 0.3 }}
                    className="space-y-4"
                  >
                    <div className="mb-3 flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-emerald-600" />
                      <span className="font-semibold text-emerald-600">
                        Enhanced Economic Intelligence
                      </span>
                      <Badge
                        className={`text-xs ${
                          enhancedEconomicData.healthCheck!.overallGrade === "A+" ||
                          enhancedEconomicData.healthCheck!.overallGrade === "A"
                            ? "bg-green-100 text-green-800"
                            : enhancedEconomicData.healthCheck!.overallGrade.startsWith("B")
                              ? "bg-blue-100 text-blue-800"
                              : enhancedEconomicData.healthCheck!.overallGrade.startsWith("C")
                                ? "bg-yellow-100 text-yellow-800"
                                : "bg-red-100 text-red-800"
                        }`}
                      >
                        Grade {enhancedEconomicData.healthCheck!.overallGrade}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                      <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-center dark:border-emerald-800 dark:bg-emerald-950/20">
                        <div className="text-lg font-bold text-emerald-600">
                          {
                            enhancedEconomicData.intelligenceData!.executiveIntelligence
                              .overallRating.score
                          }
                        </div>
                        <div className="text-xs text-emerald-700">Overall Score</div>
                      </div>

                      <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-center dark:border-blue-800 dark:bg-blue-950/20">
                        <div className="text-sm font-bold text-blue-600 capitalize">
                          {enhancedEconomicData.healthCheck!.healthIndicators.growth}
                        </div>
                        <div className="text-xs text-blue-700">Growth</div>
                      </div>

                      <div className="rounded-lg border border-purple-200 bg-purple-50 p-3 text-center dark:border-purple-800 dark:bg-purple-950/20">
                        <div className="text-sm font-bold text-purple-600 capitalize">
                          {enhancedEconomicData.healthCheck!.healthIndicators.stability}
                        </div>
                        <div className="text-xs text-purple-700">Stability</div>
                      </div>

                      <div className="rounded-lg border border-orange-200 bg-orange-50 p-3 text-center dark:border-orange-800 dark:bg-orange-950/20">
                        <div className="text-sm font-bold text-orange-600 capitalize">
                          {enhancedEconomicData.healthCheck!.healthIndicators.sustainability}
                        </div>
                        <div className="text-xs text-orange-700">Sustainability</div>
                      </div>
                    </div>

                    <div className="rounded-lg border border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50 p-3 dark:border-blue-800 dark:from-blue-950/20 dark:to-indigo-950/20">
                      <p className="text-sm text-blue-800 dark:text-blue-200">
                        <strong>AI Analysis:</strong> {enhancedEconomicData.healthCheck!.keyMessage}
                      </p>
                    </div>
                  </motion.div>
                )}

                {/* Diplomatic Operations Section */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: 0.4 }}
                  className="space-y-4"
                >
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Globe className="h-4 w-4 text-purple-600" />
                      <span className="font-semibold text-purple-600">Diplomatic Operations</span>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setDiplomaticMeetingOpen(true)}
                      className="text-xs"
                    >
                      <Calendar className="mr-1 h-3 w-3" />
                      Schedule Meeting
                    </Button>
                  </div>

                  {/* Diplomatic Health Ring and Quick Stats */}
                  <div className="flex items-start gap-4">
                    <DiplomaticHealthRing
                      countryId={countryId}
                      size="sm"
                      interactive={true}
                      onClick={() => (window.location.href = withBasePath("/diplomatic"))}
                    />

                    <div className="flex-1 space-y-3">
                      {/* Active Embassies */}
                      <DiplomaticStat countryId={countryId} statType="embassies" />

                      {/* Recent Relationship Changes */}
                      <DiplomaticStat countryId={countryId} statType="relationships" />

                      {/* Pending Actions */}
                      <DiplomaticStat countryId={countryId} statType="pending" />
                    </div>
                  </div>

                  {/* Quick Action Buttons */}
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => (window.location.href = withBasePath("/diplomatic"))}
                      className="text-xs"
                    >
                      <Building className="mr-1 h-3 w-3" />
                      View Embassies
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        (window.location.href = withBasePath("/diplomatic?tab=messages"))
                      }
                      className="text-xs"
                    >
                      <MessageSquare className="mr-1 h-3 w-3" />
                      Send Message
                    </Button>
                  </div>

                  {/* Diplomatic Recommendations */}
                  <DiplomaticRecommendations countryId={countryId} />
                </motion.div>
              </motion.div>
            ) : (
              <motion.div
                key="detailed"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6"
              >
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  {intelligence.vitalityIntelligence.map((vitality, index) => (
                    <motion.div
                      key={vitality.area}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: index * 0.1 }}
                      className="border-border bg-card rounded-lg border p-4"
                    >
                      <div className="mb-3 flex items-center justify-between">
                        <h3 className="font-semibold capitalize">{vitality.area}</h3>
                        <div className="flex items-center gap-2">
                          <span className="text-2xl font-bold">{vitality.score}</span>
                          <div
                            className={`text-sm ${
                              vitality.trend === "up"
                                ? "text-green-600"
                                : vitality.trend === "down"
                                  ? "text-red-600"
                                  : "text-gray-600"
                            }`}
                          >
                            {(vitality.change?.value ?? 0) > 0 ? "+" : ""}
                            <NumberFlowDisplay
                              value={vitality.change?.value ?? 0}
                              decimalPlaces={1}
                              className=""
                            />
                          </div>
                        </div>
                      </div>

                      <Progress value={vitality.score} className="mb-3 h-2" />

                      <div className="space-y-2">
                        {vitality.keyMetrics.slice(0, 2).map((metric, metricIndex) => (
                          <div
                            key={`${vitality.area}-metric-${metricIndex}`}
                            className="flex justify-between text-sm"
                          >
                            <span className="text-muted-foreground">{metric.label}</span>
                            <span className="font-medium">
                              {metric.value}
                              {metric.unit}
                            </span>
                          </div>
                        ))}
                      </div>

                      {vitality.criticalAlerts.length > 0 && (
                        <Badge variant="destructive" className="mt-2 text-xs">
                          {vitality.criticalAlerts.length} Alert
                          {vitality.criticalAlerts.length !== 1 ? "s" : ""}
                        </Badge>
                      )}
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {isOwner && (
            <div className="border-border space-y-2 border-t pt-4">
              <Button
                onClick={onNavigateToIntelligence || onPrivateAccess}
                className="w-full bg-gradient-to-r from-blue-600 to-indigo-700 text-white hover:from-blue-700 hover:to-indigo-800"
              >
                <Brain className="mr-2 h-4 w-4" />
                Access Full Intelligence Dashboard
              </Button>

              {viewMode === "overview" && (
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onNavigateToMeetings}
                    className="text-xs"
                  >
                    <Target className="mr-1 h-3 w-3" />
                    Schedule Meeting
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onNavigateToPolicy}
                    className="text-xs"
                  >
                    <Sparkles className="mr-1 h-3 w-3" />
                    Create Policy
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Diplomatic Meeting Scheduler Modal */}
      <DiplomaticMeetingScheduler
        countryId={countryId}
        open={diplomaticMeetingOpen}
        onOpenChange={setDiplomaticMeetingOpen}
      />
    </motion.div>
  );
}

export default ExecutiveCommandCenter;
