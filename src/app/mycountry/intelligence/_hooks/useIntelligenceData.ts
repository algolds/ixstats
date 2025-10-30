import { useMemo } from "react";
import type { VitalityIntelligence, CriticalAlert } from "../../types/intelligence";
import type { IntelligenceBriefing } from "../_config/types";
import type { IntelligenceReport } from "~/lib/intelligence-engine";
import { IxTime } from "~/lib/ixtime";

interface UseIntelligenceDataParams {
  vitalityIntelligence: VitalityIntelligence[];
  advancedIntelligenceReport: IntelligenceReport | null;
}

export function useIntelligenceData({
  vitalityIntelligence,
  advancedIntelligenceReport,
}: UseIntelligenceDataParams) {
  // Generate intelligence briefings from vitality data + advanced analysis
  const intelligenceBriefings = useMemo<IntelligenceBriefing[]>(() => {
    const briefings: IntelligenceBriefing[] = [];
    const now = Date.now();

    const getQuarterInfo = () => {
      const currentIxTime = IxTime.getCurrentIxTime();
      const ixDate = new Date(currentIxTime);
      const month = ixDate.getMonth();
      const quarter = Math.floor(month / 3) + 1;
      const year = ixDate.getFullYear();
      return `Q${quarter} ${year}`;
    };

    // Add advanced intelligence alerts as briefings
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
          impact: {
            magnitude:
              alert.severity === "critical"
                ? "critical"
                : alert.severity === "high"
                  ? "high"
                  : "medium",
            scope: alert.factors,
            timeframe:
              urgency === "immediate"
                ? "Immediate"
                : urgency === "this_week"
                  ? "1 week"
                  : urgency === "this_month"
                    ? "1 month"
                    : getQuarterInfo(),
          },
          evidence: {
            metrics: [
              `Current: ${alert.metrics.current.toFixed(2)}`,
              `Expected: ${alert.metrics.expected.toFixed(2)}`,
              `Deviation: ${alert.metrics.deviation.toFixed(2)}%`,
              `Z-Score: ${alert.metrics.zScore.toFixed(2)}`,
            ],
            trends: [`Detected via ${alert.type} analysis`],
            comparisons: alert.factors.map((f) => `Factor: ${f}`),
          },
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
          alerts: [],
          createdAt: alert.detected,
          lastUpdated: alert.detected,
          tags: alert.factors,
        });
      });
    }

    vitalityIntelligence.forEach((vitality) => {
      // Hot Issues from critical alerts
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
          impact: {
            magnitude: "critical",
            scope: [vitality.area, "overall stability"],
            timeframe: "immediate",
          },
          evidence: {
            metrics: vitality.keyMetrics
              .slice(0, 3)
              .map((m) => `${m.label}: ${m.value}${m.unit || ""}`),
            trends: [`Score: ${vitality.score}/100 (${vitality.trend})`],
            comparisons: [
              `Rank: #${vitality.comparisons.rank}/${vitality.comparisons.totalCountries}`,
            ],
          },
          recommendations: vitality.recommendations
            .filter((r) => r.urgency === "urgent")
            .slice(0, 2),
          alerts: vitality.criticalAlerts,
          createdAt: now,
          lastUpdated: now,
          tags: ["critical", vitality.area, "urgent"],
        });
      }

      // Opportunities from strong performance
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
            impact: {
              magnitude: "high",
              scope: [vitality.area, "regional standing"],
              timeframe: "3-6 months",
            },
            evidence: {
              metrics: vitality.keyMetrics
                .slice(0, 2)
                .map((m) => `${m.label}: ${m.value}${m.unit || ""} (${m.trend})`),
              trends: [
                `Score improving: ${vitality.change.value > 0 ? "+" : ""}${vitality.change.value.toFixed(1)} points`,
              ],
              comparisons: [`Above peer average: ${vitality.comparisons.peerAverage.toFixed(0)}`],
            },
            recommendations: topRecommendations,
            alerts: [],
            createdAt: now,
            lastUpdated: now,
            tags: ["opportunity", vitality.area, "growth"],
          });
        }
      }

      // Risk Mitigation for declining areas
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
          impact: {
            magnitude: "medium",
            scope: [vitality.area],
            timeframe: "1-3 months",
          },
          evidence: {
            metrics: vitality.keyMetrics
              .filter((m) => m.trend === "down")
              .map((m) => `${m.label}: ${m.value}${m.unit || ""} (declining)`),
            trends: [`Score declining: ${vitality.change.value.toFixed(1)} points`],
            comparisons: [`Below peer average: ${vitality.comparisons.peerAverage.toFixed(0)}`],
          },
          recommendations: vitality.recommendations
            .filter((r) => r.difficulty !== "major")
            .slice(0, 2),
          alerts: [],
          createdAt: now,
          lastUpdated: now,
          tags: ["risk", vitality.area, "prevention"],
        });
      }
    });

    return briefings.sort((a, b) => {
      const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
      return (priorityOrder[b.priority] || 0) - (priorityOrder[a.priority] || 0);
    });
  }, [vitalityIntelligence, advancedIntelligenceReport]);

  // Aggregate all alerts
  const allAlerts = useMemo(() => {
    const alerts: CriticalAlert[] = [];
    vitalityIntelligence.forEach((vi) => {
      alerts.push(...vi.criticalAlerts);
    });
    return alerts.sort((a, b) => {
      const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
      return (
        (priorityOrder[b.priority as keyof typeof priorityOrder] || 0) -
        (priorityOrder[a.priority as keyof typeof priorityOrder] || 0)
      );
    });
  }, [vitalityIntelligence]);

  // Critical metrics summary
  const criticalMetrics = useMemo(() => {
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
  }, [allAlerts, intelligenceBriefings, vitalityIntelligence]);

  return {
    intelligenceBriefings,
    allAlerts,
    criticalMetrics,
  };
}
