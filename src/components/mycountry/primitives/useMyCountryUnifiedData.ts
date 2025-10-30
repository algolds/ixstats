"use client";

import { useMemo } from "react";
import { useUser } from "~/context/auth-context";
import { api } from "~/trpc/react";
import { useCountryData } from "./CountryDataProvider";
import { useUnifiedIntelligence } from "~/hooks/useUnifiedIntelligence";
import type { UseUnifiedIntelligenceReturn } from "~/hooks/useUnifiedIntelligence";
import type { ExecutiveIntelligence } from "~/app/mycountry/types/intelligence";

interface DiplomaticMetrics {
  treatyCount: number;
  tradePartnerCount: number;
  relationshipsCount: number;
}

interface UseMyCountryUnifiedDataOptions {
  autoRefresh?: boolean;
}

interface UseMyCountryUnifiedDataReturn {
  country: ReturnType<typeof useCountryData>["country"];
  userProfile: ReturnType<typeof useCountryData>["userProfile"];
  economyData: ReturnType<typeof useCountryData>["economyData"];
  activityRingsData: ReturnType<typeof useCountryData>["activityRingsData"];
  unifiedIntelligence: UseUnifiedIntelligenceReturn;
  executiveIntelligence: ExecutiveIntelligence;
  diplomaticRelations: ReturnType<typeof api.diplomatic.getRelationships.useQuery>["data"];
  embassies: ReturnType<typeof api.diplomatic.getEmbassies.useQuery>["data"];
  recentDiplomaticActivity: ReturnType<typeof api.diplomatic.getRecentChanges.useQuery>["data"];
  diplomaticMetrics: DiplomaticMetrics;
  quickActionMeetings: ReturnType<typeof api.quickActions.getMeetings.useQuery>["data"];
  quickActionPolicies: ReturnType<typeof api.quickActions.getPolicies.useQuery>["data"];
  refetchQuickActionMeetings: ReturnType<typeof api.quickActions.getMeetings.useQuery>["refetch"];
  refetchQuickActionPolicies: ReturnType<typeof api.quickActions.getPolicies.useQuery>["refetch"];
}

function deriveDiplomaticMetrics(relations: any[] | undefined): DiplomaticMetrics {
  if (!relations || relations.length === 0) {
    return {
      treatyCount: 0,
      tradePartnerCount: 0,
      relationshipsCount: 0,
    };
  }

  const treatyCount = relations.reduce((count, rel) => {
    const treaties = rel?.treaties ?? [];
    return count + (Array.isArray(treaties) ? treaties.length : 0);
  }, 0);

  const tradePartnerCount = relations.reduce((count, rel) => {
    const tradeVolume = typeof rel?.tradeVolume === "number" ? rel.tradeVolume : 0;
    return tradeVolume > 0 ? count + 1 : count;
  }, 0);

  return {
    treatyCount,
    tradePartnerCount,
    relationshipsCount: relations.length,
  };
}

function buildExecutiveIntelligencePayload(
  overview: UseUnifiedIntelligenceReturn["overview"],
  quickActions: UseUnifiedIntelligenceReturn["quickActions"],
  metrics: UseUnifiedIntelligenceReturn["metrics"],
  country: ReturnType<typeof useCountryData>["country"],
  diplomaticMetrics: DiplomaticMetrics
): ExecutiveIntelligence {
  const vitalityIntelligence = [
    {
      area: "economic" as const,
      score: (overview as any)?.vitality?.economic || 0,
      trend: "stable" as const,
      change: {
        value: 0,
        period: "week" as const,
        reason: "No significant changes detected",
      },
      status: "good" as const,
      keyMetrics: [
        {
          id: "gdp-growth",
          label: "GDP Growth",
          value: ((overview as any)?.vitality?.economic || 0).toFixed(1),
          unit: "/100",
          trend: "stable" as const,
          changeValue: 0,
          changePercent: 0,
          changePeriod: "week",
          status: "good" as const,
        },
        {
          id: "economic-tier",
          label: "Economic Tier",
          value: (overview as any)?.country?.economicTier || "N/A",
          unit: "",
          trend: "stable" as const,
          changeValue: 0,
          changePercent: 0,
          changePeriod: "week",
          status: "good" as const,
        },
      ],
      criticalAlerts: [],
      recommendations: [],
      forecast: {
        shortTerm: {
          projected: (overview as any)?.vitality?.economic || 0,
          confidence: 70,
          factors: ["Current economic indicators", "Historical trends"],
        },
        longTerm: {
          projected: (overview as any)?.vitality?.economic || 0,
          confidence: 50,
          factors: ["Long-term growth patterns", "Global economic outlook"],
        },
      },
      comparisons: {
        peerAverage: 75,
        regionalAverage: 70,
        historicalBest: 85,
        rank: 0,
        totalCountries: 0,
      },
    },
    {
      area: "population" as const,
      score: (overview as any)?.vitality?.social || 0,
      trend: "stable" as const,
      change: {
        value: 0,
        period: "week" as const,
        reason: "No significant changes detected",
      },
      status: "good" as const,
      keyMetrics: [
        {
          id: "population-tier",
          label: "Population Tier",
          value: (overview as any)?.country?.populationTier || "N/A",
          unit: "",
          trend: "stable" as const,
          changeValue: 0,
          changePercent: 0,
          changePeriod: "week",
          status: "good" as const,
        },
        {
          id: "wellbeing",
          label: "Wellbeing",
          value: String((overview as any)?.country?.overallNationalHealth || 0),
          unit: "/100",
          trend: "stable" as const,
          changeValue: 0,
          changePercent: 0,
          changePeriod: "week",
          status: "good" as const,
        },
      ],
      criticalAlerts: [],
      recommendations: [],
      forecast: {
        shortTerm: {
          projected: (overview as any)?.vitality?.social || 0,
          confidence: 70,
          factors: ["Social indicators", "Population trends"],
        },
        longTerm: {
          projected: (overview as any)?.vitality?.social || 0,
          confidence: 50,
          factors: ["Demographic projections", "Social policy impact"],
        },
      },
      comparisons: {
        peerAverage: 75,
        regionalAverage: 70,
        historicalBest: 85,
        rank: 0,
        totalCountries: 0,
      },
    },
    {
      area: "diplomatic" as const,
      score: (overview as any)?.vitality?.diplomatic || 0,
      trend: "stable" as const,
      change: {
        value: 0,
        period: "week" as const,
        reason: "No significant changes detected",
      },
      status: "good" as const,
      keyMetrics: [
        {
          id: "active-treaties",
          label: "Active Treaties",
          value: String(diplomaticMetrics.treatyCount),
          unit: "",
          trend:
            diplomaticMetrics.treatyCount > 5
              ? ("up" as const)
              : diplomaticMetrics.treatyCount < 3
                ? ("down" as const)
                : ("stable" as const),
          changeValue: 0,
          changePercent: 0,
          changePeriod: "week",
          status:
            diplomaticMetrics.treatyCount >= 8
              ? ("excellent" as const)
              : diplomaticMetrics.treatyCount >= 5
                ? ("good" as const)
                : diplomaticMetrics.treatyCount >= 2
                  ? ("concerning" as const)
                  : ("critical" as const),
        },
        {
          id: "trade-partners",
          label: "Trade Partners",
          value: String(diplomaticMetrics.tradePartnerCount),
          unit: "",
          trend:
            diplomaticMetrics.tradePartnerCount > 15
              ? ("up" as const)
              : diplomaticMetrics.tradePartnerCount < 8
                ? ("down" as const)
                : ("stable" as const),
          changeValue: 0,
          changePercent: 0,
          changePeriod: "week",
          status:
            diplomaticMetrics.tradePartnerCount >= 20
              ? ("excellent" as const)
              : diplomaticMetrics.tradePartnerCount >= 10
                ? ("good" as const)
                : diplomaticMetrics.tradePartnerCount >= 5
                  ? ("concerning" as const)
                  : ("critical" as const),
        },
      ],
      criticalAlerts: [],
      recommendations: [],
      forecast: {
        shortTerm: {
          projected: (overview as any)?.vitality?.diplomatic || 0,
          confidence: 70,
          factors: ["Current diplomatic relations", "International standing"],
        },
        longTerm: {
          projected: (overview as any)?.vitality?.diplomatic || 0,
          confidence: 50,
          factors: ["Geopolitical trends", "Alliance developments"],
        },
      },
      comparisons: {
        peerAverage: 75,
        regionalAverage: 70,
        historicalBest: 85,
        rank: 0,
        totalCountries: 0,
      },
    },
    {
      area: "governance" as const,
      score: (overview as any)?.vitality?.governance || 0,
      trend: "stable" as const,
      change: {
        value: 0,
        period: "week" as const,
        reason: "No significant changes detected",
      },
      status: "good" as const,
      keyMetrics: [
        {
          id: "active-policies",
          label: "Active Policies",
          value: String((overview as any)?.activity?.activePolicies || 0),
          unit: "",
          trend: "stable" as const,
          changeValue: 0,
          changePercent: 0,
          changePeriod: "week",
          status: "good" as const,
        },
        {
          id: "pending-decisions",
          label: "Pending Decisions",
          value: String((overview as any)?.activity?.pendingDecisions || 0),
          unit: "",
          trend: "stable" as const,
          changeValue: 0,
          changePercent: 0,
          changePeriod: "week",
          status: "good" as const,
        },
      ],
      criticalAlerts: [],
      recommendations: [],
      forecast: {
        shortTerm: {
          projected: (overview as any)?.vitality?.governance || 0,
          confidence: 70,
          factors: ["Policy throughput", "Decision velocity"],
        },
        longTerm: {
          projected: (overview as any)?.vitality?.governance || 0,
          confidence: 50,
          factors: ["Institutional reforms", "Administrative capacity"],
        },
      },
      comparisons: {
        peerAverage: 75,
        regionalAverage: 70,
        historicalBest: 85,
        rank: 0,
        totalCountries: 0,
      },
    },
  ];

  const criticalAlerts = (overview as any)?.alerts?.items
    ? (overview as any).alerts.items
        .filter((alert: any) => alert.severity?.toString().toLowerCase() === "critical")
        .map((alert: any) => ({
          id: alert.id ?? `critical-${alert.title}`,
          title: alert.title,
          message: alert.description,
          severity: "critical" as const,
          category: alert.category ?? "executive",
          timestamp: alert.detectedAt ? new Date(alert.detectedAt) : new Date(),
          actionRequired: alert.isActive,
          relatedEntities: [],
          isRead: !alert.isActive,
          isActive: alert.isActive,
          isResolved: alert.isResolved,
        }))
    : [];

  const trendingInsights = (overview as any)?.briefings?.items
    ? (overview as any).briefings.items.map((briefing: any) => ({
        id: briefing.id ?? `briefing-${briefing.title}`,
        title: briefing.title,
        description: briefing.description ?? "",
        trend:
          briefing.priority === "HIGH" || briefing.priority === "CRITICAL"
            ? ("up" as const)
            : ("stable" as const),
        confidence: briefing.confidence ?? 70,
        metric: briefing.area ?? "executive",
        currentValue: 0,
        previousValue: 0,
        percentageChange: 0,
        timestamp: briefing.generatedAt ? new Date(briefing.generatedAt) : new Date(),
        implications: [],
        forecast: {
          nextWeek: 0,
          nextMonth: 0,
          nextQuarter: 0,
        },
        context: briefing.description ?? "",
      }))
    : [];

  const quickActionList = Array.isArray((quickActions as any)?.actions)
    ? (quickActions as any).actions
    : [];

  const urgentActions = quickActionList.map((action: any) => ({
    id: action.id ?? action.actionType,
    title: action.title,
    description: action.description,
    category: (action.category ?? "governance") as
      | "economic"
      | "population"
      | "diplomatic"
      | "governance",
    priority: (action.priority ?? "high") as "critical" | "high" | "medium" | "low",
    urgency: (action.urgency ?? "important") as "urgent" | "important" | "routine" | "future",
    difficulty: (action.difficulty ?? "moderate") as "easy" | "moderate" | "complex" | "major",
    estimatedDuration: action.estimatedDuration ?? "TBD",
    estimatedCost: String(action.estimatedCost ?? 0),
    estimatedBenefit: action.estimatedBenefit ?? "",
    prerequisites: action.requirements ?? [],
    risks: action.risks ?? [],
    successProbability: action.successProbability ?? 75,
    impact: {
      economic: action.category === "economic" ? 50 : undefined,
      social: action.category === "population" ? 50 : undefined,
      diplomatic: action.category === "diplomatic" ? 50 : undefined,
      governance: action.category === "governance" ? 50 : undefined,
    },
  }));

  return {
    countryId: country?.id || "",
    generatedAt: Date.now(),
    nextUpdate: Date.now() + 30 * 60 * 1000,
    forwardIntelligence: {
      predictions: [],
      opportunities: [],
      risks: [],
      competitiveIntelligence: [],
    },
    lastMajorChange: {
      date: Date.now(),
      description: "Intelligence data processed",
      impact: "neutral",
    },
    viewMode: "executive" as const,
    priorityThreshold: "medium" as const,
    overallStatus: metrics?.overallHealth
      ? metrics.overallHealth >= 80
        ? ("excellent" as const)
        : metrics.overallHealth >= 60
          ? ("good" as const)
          : metrics.overallHealth >= 40
            ? ("concerning" as const)
            : ("critical" as const)
      : ("good" as const),
    confidenceLevel: 85,
    vitalityIntelligence,
    criticalAlerts,
    trendingInsights,
    urgentActions,
  };
}

export function useMyCountryUnifiedData({
  autoRefresh = false,
}: UseMyCountryUnifiedDataOptions = {}): UseMyCountryUnifiedDataReturn {
  const { user } = useUser();
  const countryContext = useCountryData();
  const countryId = countryContext.country?.id ?? "";
  const userId = user?.id ?? "";

  const unifiedIntelligence = useUnifiedIntelligence({
    countryId,
    userId,
    autoRefresh,
  });

  const { data: diplomaticRelations } = api.diplomatic.getRelationships.useQuery(
    { countryId },
    { enabled: !!countryId }
  );

  const { data: embassies } = api.diplomatic.getEmbassies.useQuery(
    { countryId },
    { enabled: !!countryId }
  );

  const { data: recentDiplomaticActivity } = api.diplomatic.getRecentChanges.useQuery(
    { countryId, hours: 72 },
    { enabled: !!countryId }
  );

  const { data: quickActionMeetings, refetch: refetchQuickActionMeetings } =
    api.quickActions.getMeetings.useQuery({ countryId, limit: 25 }, { enabled: !!countryId });

  const { data: quickActionPolicies, refetch: refetchQuickActionPolicies } =
    api.quickActions.getPolicies.useQuery({ countryId }, { enabled: !!countryId });

  const normalizedDiplomaticRelations = Array.isArray(diplomaticRelations)
    ? diplomaticRelations
    : [];
  const normalizedEmbassies = Array.isArray(embassies) ? embassies : [];
  const normalizedRecentDiplomaticActivity = Array.isArray(recentDiplomaticActivity)
    ? recentDiplomaticActivity
    : [];
  const normalizedMeetings = Array.isArray(quickActionMeetings) ? quickActionMeetings : [];
  const normalizedPolicies = Array.isArray(quickActionPolicies) ? quickActionPolicies : [];

  const diplomaticMetrics = useMemo(
    () => deriveDiplomaticMetrics(normalizedDiplomaticRelations),
    [normalizedDiplomaticRelations]
  );

  const executiveIntelligence = useMemo(
    () =>
      buildExecutiveIntelligencePayload(
        unifiedIntelligence.overview,
        unifiedIntelligence.quickActions,
        unifiedIntelligence.metrics,
        countryContext.country,
        diplomaticMetrics
      ),
    [
      unifiedIntelligence.overview,
      unifiedIntelligence.quickActions,
      unifiedIntelligence.metrics,
      countryContext.country,
      diplomaticMetrics,
    ]
  );

  return {
    country: countryContext.country,
    userProfile: countryContext.userProfile,
    economyData: countryContext.economyData,
    activityRingsData: countryContext.activityRingsData,
    unifiedIntelligence,
    executiveIntelligence,
    diplomaticRelations: normalizedDiplomaticRelations,
    embassies: normalizedEmbassies,
    recentDiplomaticActivity: normalizedRecentDiplomaticActivity,
    diplomaticMetrics,
    quickActionMeetings: normalizedMeetings,
    quickActionPolicies: normalizedPolicies,
    refetchQuickActionMeetings,
    refetchQuickActionPolicies,
  };
}
