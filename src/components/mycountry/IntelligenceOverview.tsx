"use client";

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  AlertTriangle,
  TrendingUp,
  Activity,
  Target,
  Sparkles,
  ArrowRight,
  CheckCircle,
  Clock,
  ChevronRight,
  BarChart3,
} from "lucide-react";
import { motion } from "framer-motion";
import Link from "next/link";
import { createUrl } from "~/lib/url-utils";
import { transformApiDataToVitalityIntelligence } from "~/app/mycountry/utils/liveDataTransformers";
import { generateIntelligenceReport } from "~/lib/intelligence-engine";
import type {
  VitalityIntelligence,
  ActionableRecommendation,
} from "~/app/mycountry/types/intelligence";
import { IxTime } from "~/lib/ixtime";
import { SectionHelpIcon } from "~/components/ui/help-icon";

const briefingTypeConfig = {
  hot_issue: {
    icon: AlertTriangle,
    label: "Hot Issue",
    color: "text-red-600",
    bg: "bg-red-50 dark:bg-red-950/20",
  },
  opportunity: {
    icon: TrendingUp,
    label: "Opportunity",
    color: "text-green-600",
    bg: "bg-green-50 dark:bg-green-950/20",
  },
  risk_mitigation: {
    icon: Target,
    label: "Risk Mitigation",
    color: "text-yellow-600",
    bg: "bg-yellow-50 dark:bg-yellow-950/20",
  },
  strategic_initiative: {
    icon: Target,
    label: "Strategic",
    color: "text-blue-600",
    bg: "bg-blue-50 dark:bg-blue-950/20",
  },
} as const;

interface IntelligenceBriefing {
  id: string;
  title: string;
  description: string;
  type: "hot_issue" | "opportunity" | "risk_mitigation" | "strategic_initiative";
  priority: "critical" | "high" | "medium" | "low";
  area: "economic" | "population" | "diplomatic" | "governance";
  confidence: number;
  urgency: "immediate" | "this_week" | "this_month" | "this_quarter";
  recommendations: ActionableRecommendation[];
  createdAt: number;
}

interface IntelligenceOverviewProps {
  countryData: any;
}

export function IntelligenceOverview({ countryData }: IntelligenceOverviewProps) {
  // Generate advanced intelligence report
  const advancedIntelligenceReport = useMemo(() => {
    if (!countryData) return null;

    try {
      const baseGdp = countryData.currentGdpPerCapita;
      const basePopulation = countryData.currentPopulation;
      const baseUnemployment = countryData.unemploymentRate;

      const gdpHistory = Array.from({ length: 12 }, (_, i) => {
        const trend = (i - 6) * 0.02;
        const noise = (Math.random() - 0.5) * 0.1;
        return baseGdp * (1 + trend + noise);
      });

      const populationHistory = Array.from({ length: 12 }, (_, i) => {
        const trend = (i - 6) * 0.005;
        const noise = (Math.random() - 0.5) * 0.02;
        return basePopulation * (1 + trend + noise);
      });

      const unemploymentHistory = Array.from({ length: 12 }, (_, i) => {
        const trend = (i - 6) * -0.01;
        const noise = (Math.random() - 0.5) * 0.15;
        return Math.max(2, Math.min(20, baseUnemployment * (1 + trend + noise)));
      });

      const peerAverages = {
        gdpPerCapita: countryData.currentGdpPerCapita * 1.15,
        population: countryData.currentPopulation * 0.8,
        unemployment: 6.5,
      };

      return generateIntelligenceReport(
        countryData as any,
        { gdpHistory, populationHistory, unemploymentHistory },
        peerAverages
      );
    } catch (error) {
      console.error("Error generating advanced intelligence:", error);
      return null;
    }
  }, [countryData]);

  // Generate vitality intelligence
  const vitalityIntelligence = useMemo<VitalityIntelligence[]>(() => {
    if (!countryData) return [];

    try {
      const apiCountryData = {
        ...countryData,
        currentTotalGdp:
          countryData.currentTotalGdp ||
          countryData.currentPopulation * countryData.currentGdpPerCapita,
        economicVitality: countryData.economicVitality || 0,
        populationWellbeing: countryData.populationWellbeing || 0,
        diplomaticStanding: countryData.diplomaticStanding || 0,
        governmentalEfficiency: countryData.governmentalEfficiency || 0,
        lastCalculated:
          typeof countryData.lastCalculated === "number" ? countryData.lastCalculated : Date.now(),
        baselineDate:
          typeof countryData.baselineDate === "number" ? countryData.baselineDate : Date.now(),
      };

      return transformApiDataToVitalityIntelligence(apiCountryData as any);
    } catch (error) {
      console.error("Error transforming vitality intelligence:", error);
      return [];
    }
  }, [countryData]);

  // Generate intelligence briefings
  const intelligenceBriefings = useMemo<IntelligenceBriefing[]>(() => {
    const briefings: IntelligenceBriefing[] = [];
    const now = Date.now();

    // Helper function to calculate which quarter based on IxTime
    const getQuarterInfo = () => {
      const currentIxTime = IxTime.getCurrentIxTime();
      const ixDate = new Date(currentIxTime);
      const month = ixDate.getMonth(); // 0-11
      const quarter = Math.floor(month / 3) + 1; // 1-4
      const year = ixDate.getFullYear();
      return `Q${quarter} ${year}`;
    };

    if (advancedIntelligenceReport) {
      advancedIntelligenceReport.alerts.forEach((alert) => {
        const urgency =
          alert.severity === "critical"
            ? "immediate"
            : alert.severity === "high"
              ? "this_week"
              : alert.severity === "medium"
                ? "this_month"
                : "this_quarter";

        const briefingType =
          alert.type === "opportunity"
            ? "opportunity"
            : alert.type === "anomaly" || alert.type === "threshold"
              ? "hot_issue"
              : alert.type === "risk"
                ? "risk_mitigation"
                : "strategic_initiative";

        briefings.push({
          id: alert.id,
          title: alert.title,
          description: alert.description,
          type: briefingType,
          priority:
            alert.severity === "critical" || alert.severity === "high"
              ? (alert.severity as "critical" | "high")
              : "medium",
          area: alert.category,
          confidence: alert.confidence,
          urgency,
          recommendations: alert.recommendations.map((rec, i) => ({
            id: `${alert.id}-rec-${i}`,
            title: rec,
            description: `Recommendation based on ${alert.type} detection`,
            category: alert.category,
            urgency: alert.severity === "critical" ? "urgent" : "important",
            difficulty: alert.severity === "critical" ? "major" : "moderate",
            estimatedDuration: urgency === "immediate" ? "1-2 weeks" : "1-2 months",
            estimatedCost: alert.severity === "critical" ? "High" : "Medium",
            estimatedBenefit: `${Math.abs(alert.metrics.deviation / 2).toFixed(2)}% improvement`,
            prerequisites: [],
            risks: [`Potential ${alert.severity} impact if not implemented correctly`],
            successProbability: Math.min(95, alert.confidence + 10),
            impact: {
              economic: alert.category === "economic" ? alert.metrics.deviation / 2 : 0,
              social: alert.category === "population" ? alert.metrics.deviation / 3 : 0,
              diplomatic: alert.category === "diplomatic" ? alert.metrics.deviation / 3 : 0,
            },
          })),
          createdAt: alert.detected,
        });
      });
    }

    vitalityIntelligence.forEach((vitality) => {
      if (vitality.criticalAlerts.length > 0) {
        briefings.push({
          id: `hot-issue-${vitality.area}-${now}`,
          title: `Critical ${vitality.area.charAt(0).toUpperCase() + vitality.area.slice(1)} Issues`,
          description: `${vitality.criticalAlerts.length} critical alert${vitality.criticalAlerts.length !== 1 ? "s" : ""} requiring immediate action`,
          type: "hot_issue",
          priority: "critical",
          area: vitality.area,
          confidence: 95,
          urgency: "immediate",
          recommendations: vitality.recommendations
            .filter((r) => r.urgency === "urgent")
            .slice(0, 2),
          createdAt: now,
        });
      }

      if (vitality.score > 75 && vitality.trend === "up") {
        const topRecommendations = vitality.recommendations
          .filter((r) => r.urgency === "important")
          .sort((a, b) => b.successProbability - a.successProbability)
          .slice(0, 2);

        if (topRecommendations.length > 0) {
          briefings.push({
            id: `opportunity-${vitality.area}-${now}`,
            title: `${vitality.area.charAt(0).toUpperCase() + vitality.area.slice(1)} Growth Opportunity`,
            description: `Strong performance and positive trends create favorable conditions for strategic advancement`,
            type: "opportunity",
            priority: "high",
            area: vitality.area,
            confidence: 85,
            urgency: "this_week",
            recommendations: topRecommendations,
            createdAt: now,
          });
        }
      }

      if (vitality.score < 60 && vitality.trend === "down") {
        briefings.push({
          id: `risk-${vitality.area}-${now}`,
          title: `${vitality.area.charAt(0).toUpperCase() + vitality.area.slice(1)} Risk Assessment`,
          description: `Declining performance indicators suggest preventive measures are needed`,
          type: "risk_mitigation",
          priority: "high",
          area: vitality.area,
          confidence: 80,
          urgency: "this_week",
          recommendations: vitality.recommendations
            .filter((r) => r.difficulty !== "major")
            .slice(0, 2),
          createdAt: now,
        });
      }
    });

    return briefings.sort((a, b) => {
      const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
      return (priorityOrder[b.priority] || 0) - (priorityOrder[a.priority] || 0);
    });
  }, [vitalityIntelligence, advancedIntelligenceReport]);

  // Critical metrics
  const criticalMetrics = useMemo(() => {
    const allAlerts = vitalityIntelligence.flatMap((vi) => vi.criticalAlerts);
    const criticalCount = allAlerts.filter((a) => a.severity === "critical").length;
    const opportunityCount = intelligenceBriefings.filter((b) => b.type === "opportunity").length;
    const actionableCount = intelligenceBriefings.reduce(
      (sum, b) => sum + b.recommendations.length,
      0
    );
    const avgVitality =
      vitalityIntelligence.length > 0
        ? Math.round(
            vitalityIntelligence.reduce((sum, vi) => sum + vi.score, 0) /
              vitalityIntelligence.length
          )
        : 0;

    return { criticalCount, opportunityCount, actionableCount, avgVitality };
  }, [intelligenceBriefings, vitalityIntelligence]);

  return (
    <div className="space-y-6">
      {/* Critical Metrics Dashboard */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        <Card className="glass-surface glass-refraction border-red-200 dark:border-red-800/40">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-muted-foreground mb-1 text-xs">Critical Issues</p>
                <p className="text-2xl font-bold text-red-600">{criticalMetrics.criticalCount}</p>
                <p className="text-muted-foreground mt-1 text-xs">Require attention</p>
              </div>
              <div className="rounded-full bg-red-100 p-3 dark:bg-red-900/30">
                <AlertTriangle className="h-5 w-5 text-red-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-surface glass-refraction border-green-200 dark:border-green-800/40">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-muted-foreground mb-1 text-xs">Opportunities</p>
                <p className="text-2xl font-bold text-green-600">
                  {criticalMetrics.opportunityCount}
                </p>
                <p className="text-muted-foreground mt-1 text-xs">Growth potential</p>
              </div>
              <div className="rounded-full bg-green-100 p-3 dark:bg-green-900/30">
                <TrendingUp className="h-5 w-5 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-surface glass-refraction border-blue-200 dark:border-blue-800/40">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-muted-foreground mb-1 text-xs">Actionable Items</p>
                <p className="text-2xl font-bold text-blue-600">
                  {criticalMetrics.actionableCount}
                </p>
                <p className="text-muted-foreground mt-1 text-xs">Strategic actions</p>
              </div>
              <div className="rounded-full bg-blue-100 p-3 dark:bg-blue-900/30">
                <Target className="h-5 w-5 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-surface glass-refraction border-purple-200 dark:border-purple-800/40">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-muted-foreground mb-1 text-xs">National Health</p>
                <p className="text-2xl font-bold text-purple-600">{criticalMetrics.avgVitality}%</p>
                <p className="text-muted-foreground mt-1 text-xs">Overall vitality</p>
              </div>
              <div className="rounded-full bg-purple-100 p-3 dark:bg-purple-900/30">
                <Activity className="h-5 w-5 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Top Priority Briefings */}
      <Card className="glass-surface glass-refraction">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-purple-600" />
            Priority Intelligence Briefings
            <SectionHelpIcon
              title="Intelligence Briefings"
              content="AI-generated strategic briefings analyzing your country's performance trends, identifying risks, opportunities, and providing actionable recommendations with confidence scores."
            />
          </CardTitle>
        </CardHeader>
        <CardContent>
          {intelligenceBriefings.slice(0, 3).length > 0 ? (
            <div className="space-y-3">
              {intelligenceBriefings.slice(0, 3).map((briefing, index) => {
                const typeConfig = briefingTypeConfig[briefing.type];
                const TypeIcon = typeConfig.icon;

                return (
                  <motion.div
                    key={briefing.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className={`cursor-pointer rounded-lg border p-4 transition-all hover:shadow-md ${typeConfig.bg}`}
                  >
                    <Link href={createUrl(`/mycountry/intelligence#briefings`)}>
                      <div className="flex items-start gap-3">
                        <div className={`rounded p-2 ${typeConfig.bg}`}>
                          <TypeIcon className={`h-5 w-5 ${typeConfig.color}`} />
                        </div>
                        <div className="flex-1">
                          <div className="mb-1 flex items-center gap-2">
                            <h4 className="font-semibold">{briefing.title}</h4>
                            <Badge variant="outline" className="text-xs">
                              {briefing.confidence.toFixed(2)}% confident
                            </Badge>
                          </div>
                          <p className="text-muted-foreground mb-2 text-sm">
                            {briefing.description}
                          </p>
                          <div className="text-muted-foreground flex items-center gap-3 text-xs">
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {briefing.urgency}
                            </span>
                            <span>•</span>
                            <span>{briefing.recommendations.length} actions</span>
                          </div>
                        </div>
                        <ChevronRight className="text-muted-foreground h-5 w-5 flex-shrink-0" />
                      </div>
                    </Link>
                  </motion.div>
                );
              })}
            </div>
          ) : (
            <div className="text-muted-foreground py-8 text-center">
              <CheckCircle className="mx-auto mb-2 h-12 w-12 text-green-500" />
              <p>All systems operating optimally</p>
            </div>
          )}
          {intelligenceBriefings.length > 3 && (
            <Link href={createUrl("/mycountry/intelligence#briefings")}>
              <Button variant="outline" className="mt-4 w-full">
                View All {intelligenceBriefings.length} Briefings
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          )}
        </CardContent>
      </Card>

      {/* Quick Actions Grid */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Link href={createUrl("/mycountry/intelligence#focus")}>
          <Card className="glass-surface glass-refraction h-full cursor-pointer transition-all hover:shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Target className="h-5 w-5 text-blue-600" />
                Strategic Focus Areas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground mb-3 text-sm">
                Monitor key sectors with actionable metrics and quick interventions
              </p>
              <div className="flex items-center justify-between">
                <span className="text-2xl font-bold text-blue-600">4</span>
                <Button size="sm">
                  View Focus Cards
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href={createUrl("/mycountry/intelligence#analytics")}>
          <Card className="glass-surface glass-refraction h-full cursor-pointer transition-all hover:shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <BarChart3 className="h-5 w-5 text-purple-600" />
                Performance Analytics
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground mb-3 text-sm">
                Deep dive into vitality scores, trends, and comparative rankings
              </p>
              <div className="flex items-center justify-between">
                <span className="text-2xl font-bold text-purple-600">
                  {vitalityIntelligence.length}
                </span>
                <Button size="sm">
                  View Analytics
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  );
}
