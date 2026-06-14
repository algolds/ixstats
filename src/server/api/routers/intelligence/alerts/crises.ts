/**
 * Unified Intelligence Router
 *
 * Comprehensive intelligence router that combines SDI/ECI functionality with
 * executive dashboard operations, diplomatic channels, and unified intelligence feeds.
 *
 * Features:
 * - Executive dashboard overview (vitality, alerts, quick actions)
 * - Enhanced quick actions with real database effects
 * - Secure diplomatic channel management
 * - Real-time intelligence feed aggregation
 * - Advanced analytics dashboard
 * - Classification-based access control
 * - Notification hooks for all major events
 * - Audit logging for sensitive operations
 */

import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";
import { notificationAPI } from "~/lib/notification-api";
import type { CrisisEvent } from "~/types/sdi";

// ===== SCHEMAS =====
// ===== UNIFIED INTELLIGENCE ROUTER =====

export const intelAlertsCrisesRouter = createTRPCRouter({
  // ===== EXECUTIVE DASHBOARD =====

  // ===== ALERT ACTIONS =====

  // ===== DIPLOMATIC CHANNELS =====

  // ===== INTELLIGENCE FEED =====

  // ===== ANALYTICS DASHBOARD =====

  // ===== ADVANCED ANALYTICS & AI =====

  // ===== ADMIN OPERATIONS =====

  // ===== ALERT THRESHOLD MANAGEMENT =====

  // ===== CABINET MEETING MANAGEMENT =====

  // ===== ECONOMIC POLICY MANAGEMENT =====
  // ===== CRISIS MANAGEMENT (from SDI) =====

  /**
   * Get active crisis events
   * Migrated from SDI router
   */
  getActiveCrises: publicProcedure.query(async ({ ctx }) => {
    try {
      const crises = await ctx.db.crisisEvent.findMany({
        orderBy: { timestamp: "desc" },
      });

      return crises.map(
        (crisis): CrisisEvent => ({
          id: crisis.id,
          type: crisis.type as CrisisEvent["type"],
          title: crisis.title,
          severity: crisis.severity as CrisisEvent["severity"],
          affectedCountries: crisis.affectedCountries ? JSON.parse(crisis.affectedCountries) : [],
          casualties: crisis.casualties || 0,
          economicImpact: crisis.economicImpact || 0,
          status: (crisis.responseStatus as CrisisEvent["status"]) || "monitoring",
          responseStatus: (crisis.responseStatus as CrisisEvent["responseStatus"]) || "monitoring",
          timestamp: crisis.timestamp,
          description: crisis.description || "",
          location: crisis.location || undefined,
          coordinates: undefined,
        })
      );
    } catch (error) {
      console.error("[Unified Intelligence] Error fetching active crises:", error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to fetch active crises",
      });
    }
  }),

  /**
   * Get all crisis events
   * Migrated from SDI router
   */
  getCrisisEvents: publicProcedure.query(async ({ ctx }) => {
    try {
      const crises = await ctx.db.crisisEvent.findMany({
        orderBy: { timestamp: "desc" },
        take: 50,
      });

      return crises.map(
        (crisis): CrisisEvent => ({
          id: crisis.id,
          type: crisis.type as CrisisEvent["type"],
          title: crisis.title,
          severity: crisis.severity as CrisisEvent["severity"],
          affectedCountries: crisis.affectedCountries ? JSON.parse(crisis.affectedCountries) : [],
          casualties: crisis.casualties || 0,
          economicImpact: crisis.economicImpact || 0,
          status: (crisis.responseStatus as CrisisEvent["status"]) || "monitoring",
          responseStatus: (crisis.responseStatus as CrisisEvent["responseStatus"]) || "monitoring",
          timestamp: crisis.timestamp,
          description: crisis.description || "",
          location: crisis.location || undefined,
          coordinates: undefined,
        })
      );
    } catch (error) {
      console.error("[Unified Intelligence] Error fetching crisis events:", error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to fetch crisis events",
      });
    }
  }),

  /**
   * Get crisis response teams
   * Migrated from SDI router
   */
  getResponseTeams: publicProcedure.query(async ({ ctx }) => {
    try {
      // Generate response teams based on active crises
      const activeCrises = await ctx.db.crisisEvent.findMany({
        where: { responseStatus: { not: "resolved" } },
        orderBy: { timestamp: "desc" },
      });

      const responseTeams = [];

      // Generate teams based on crisis types
      const crisisTypes = new Set(activeCrises.map((c) => c.type));

      if (crisisTypes.has("economic_crisis")) {
        responseTeams.push({
          id: "economic-team",
          name: "Economic Stabilization Unit",
          status: "deployed",
          location: "Global",
          assignedCrises: activeCrises.filter((c) => c.type === "economic_crisis").length,
        });
      }

      if (crisisTypes.has("natural_disaster")) {
        const disasters = activeCrises.filter((c) => c.type === "natural_disaster");
        responseTeams.push({
          id: "disaster-team",
          name: "International Aid Coordination",
          status: disasters.length > 0 ? "deployed" : "standby",
          location:
            disasters.length > 0
              ? JSON.parse(disasters[0]?.affectedCountries || "[]")[0] || "Multiple"
              : "Standby",
          assignedCrises: disasters.length,
        });
      }

      if (crisisTypes.has("political_crisis")) {
        responseTeams.push({
          id: "diplomatic-team",
          name: "Diplomatic Crisis Team",
          status: "monitoring",
          location: "Multiple",
          assignedCrises: activeCrises.filter((c) => c.type === "political_crisis").length,
        });
      }

      // Always have a general monitoring team
      responseTeams.push({
        id: "general-team",
        name: "Global Monitoring Center",
        status: activeCrises.length > 0 ? "active" : "standby",
        location: "Global",
        assignedCrises: activeCrises.length,
      });

      return responseTeams;
    } catch (error) {
      console.error("[Unified Intelligence] Error fetching response teams:", error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to fetch response teams",
      });
    }
  }),

  // ===== ECONOMIC INTELLIGENCE (from SDI) =====

  // ===== DIPLOMATIC INTELLIGENCE (from SDI) =====

  // ===== STRATEGIC PLANS & SECURITY =====

  // ===== KEY FINDINGS =====
});

// ===== HELPER FUNCTIONS =====
// Migrated from ECI router for advanced analytics and AI recommendations

/**
 * Calculate volatility metrics from historical data
 */
// eslint-disable-next-line unused-imports/no-unused-vars
function calculateVolatility(data: Record<string, unknown>[]) {
  if (data.length < 2) return { gdp: 0, population: 0, overall: 0 };

  const gdpValues = data.map((d) => d.totalGdp).filter((v): v is number => typeof v === "number");
  const populationValues = data
    .map((d) => d.population)
    .filter((v): v is number => typeof v === "number");

  return {
    gdp: calculateStandardDeviation(gdpValues),
    population: calculateStandardDeviation(populationValues),
    overall:
      (calculateStandardDeviation(gdpValues) + calculateStandardDeviation(populationValues)) / 2,
  };
}

/**
 * Calculate trend analysis from historical data
 */
// eslint-disable-next-line unused-imports/no-unused-vars
function calculateTrends(data: Record<string, unknown>[]) {
  if (data.length < 3) return { gdp: "stable", population: "stable", overall: "stable" };

  const recent = data.slice(0, 10);
  const older = data.slice(10, 20);

  const recentAvgGdp =
    recent.reduce((sum, d) => sum + (typeof d.totalGdp === "number" ? d.totalGdp : 0), 0) /
    recent.length;
  const olderAvgGdp =
    older.reduce((sum, d) => sum + (typeof d.totalGdp === "number" ? d.totalGdp : 0), 0) /
    older.length;

  const gdpTrend =
    recentAvgGdp > olderAvgGdp * 1.02
      ? "growing"
      : recentAvgGdp < olderAvgGdp * 0.98
        ? "declining"
        : "stable";

  return {
    gdp: gdpTrend,
    population: "stable", // Simplified for now
    overall: gdpTrend,
  };
}

/**
 * Calculate correlation analysis (simplified)
 */
// eslint-disable-next-line unused-imports/no-unused-vars
function calculateCorrelations(data: Record<string, unknown>[]) {
  // Simplified correlation analysis
  return {
    gdpPopulation: 0.85,
    gdpGrowthStability: 0.72,
    overallHealth: 0.78,
  };
}

/**
 * Calculate standard deviation for volatility analysis
 */
function calculateStandardDeviation(values: number[]) {
  if (values.length < 2) return 0;
  const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
  const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
  return Math.sqrt(variance);
}

/**
 * Generate AI-powered recommendations based on country data
 */
// eslint-disable-next-line unused-imports/no-unused-vars
function generateAIRecommendations(
  country: Record<string, unknown>,
  // eslint-disable-next-line unused-imports/no-unused-vars
  recentData: Record<string, unknown>[]
) {
  const recommendations = [];

  if (typeof country.currentGdpPerCapita === "number" && country.currentGdpPerCapita < 25000) {
    recommendations.push({
      id: "infrastructure_investment",
      title: "Infrastructure Investment",
      description: "Consider increasing infrastructure spending to boost economic development",
      priority: "high",
      category: "economic",
      impact: "Potential 2-3% GDP growth boost over 2 years",
    });
  }

  if (typeof country.populationGrowthRate === "number" && country.populationGrowthRate > 0.05) {
    recommendations.push({
      id: "education_expansion",
      title: "Education System Expansion",
      description: "High population growth requires expanded educational capacity",
      priority: "medium",
      category: "social",
      impact: "Long-term economic productivity improvement",
    });
  }

  recommendations.push({
    id: "diversification",
    title: "Economic Diversification",
    description: "Reduce economic risk through sector diversification",
    priority: "medium",
    category: "economic",
    impact: "Improved economic stability and resilience",
  });

  return recommendations;
}

/**
 * Generate predictive economic models
 */
// eslint-disable-next-line unused-imports/no-unused-vars
function generatePredictiveModels(
  country: Record<string, unknown>,
  historicalData: Record<string, unknown>[],
  input: Record<string, unknown>
) {
  const timeframePeriods = {
    "6_months": 6,
    "1_year": 12,
    "2_years": 24,
    "5_years": 60,
  };

  const periods = timeframePeriods[input.timeframe as keyof typeof timeframePeriods] || 12;
  const baseGrowthRate = (country.adjustedGdpGrowth as number) || 0.03;

  const scenarios = (Array.isArray(input.scenarios) ? input.scenarios : []).map(
    (scenario: string) => {
      const multiplier = scenario === "optimistic" ? 1.5 : scenario === "pessimistic" ? 0.5 : 1.0;

      const projectedGdp =
        (country.currentTotalGdp as number) *
        Math.pow(1 + baseGrowthRate * multiplier, periods / 12);
      const projectedPopulation =
        (country.currentPopulation as number) *
        Math.pow(1 + ((country.populationGrowthRate as number) || 0.01), periods / 12);
      const projectedGdpPerCapita = projectedGdp / projectedPopulation;

      return {
        scenario,
        projectedGdp,
        projectedPopulation,
        projectedGdpPerCapita,
        confidence: scenario === "realistic" ? 85 : scenario === "optimistic" ? 65 : 70,
      };
    }
  );

  return {
    timeframe: input.timeframe,
    scenarios,
    methodology: "Compound growth model with historical variance analysis",
    lastUpdated: new Date(),
  };
}

/**
 * Calculate real-time country metrics (social, security, political)
 */
async function calculateRealTimeMetrics(db: any, countryId: string) {
  // Get recent security threats
  const securityThreats = await db.intelligenceAlert.findMany({
    where: {
      countryId,
      category: { in: ["security", "SECURITY", "crisis", "CRISIS"] },
      isActive: true,
    },
  });

  const criticalThreats = securityThreats.filter(
    (threat: any) => threat.severity === "critical" || threat.severity === "CRITICAL"
  );

  // Calculate security metric (higher threats = lower score)
  const securityScore = Math.max(
    20,
    100 - securityThreats.length * 10 - criticalThreats.length * 20
  );

  // Get recent policies
  const policies = await db.policy.findMany({
    where: {
      countryId,
      status: "active",
    },
  });

  // Calculate political stability (more active policies = higher stability)
  const politicalScore = Math.min(100, 60 + policies.length * 5);

  // Social metric based on economic tier and policies
  const country = await db.country.findUnique({ where: { id: countryId } });
  const economicTierScores: Record<string, number> = {
    Impoverished: 30,
    Developing: 50,
    Developed: 70,
    Healthy: 80,
    Strong: 90,
    "Very Strong": 95,
    Extravagant: 100,
  };

  const baseSocialScore = economicTierScores[country?.economicTier as string] ?? 50;
  const socialPolicies = policies.filter(
    (p: Record<string, unknown>) => p.policyType === "social" || p.policyType === "SOCIAL"
  );
  const socialScore = Math.min(100, baseSocialScore + socialPolicies.length * 3);

  return {
    social: Math.round(socialScore),
    security: Math.round(securityScore),
    political: Math.round(politicalScore),
  };
}

/**
 * Evaluate alert thresholds for a country and generate intelligence alerts if breached
 */
export async function evaluateThresholds(db: any, countryId: string, userId: string) {
  // Fetch active thresholds
  const thresholds = await db.intelligenceAlertThreshold.findMany({
    where: { countryId, userId, isActive: true },
  });

  if (thresholds.length === 0) return;

  // Fetch country data
  const country = await db.country.findUnique({
    where: { id: countryId },
    include: {
      securityAssessment: true,
    },
  });

  if (!country) return;

  // Fetch active relations & embassies
  const activeRelationships = await db.diplomaticRelation.count({
    where: {
      OR: [{ country1: countryId }, { country2: countryId }],
      status: "active",
    },
  });

  const embassyCount = await db.embassy.count({
    where: {
      OR: [{ hostCountryId: countryId }, { guestCountryId: countryId }],
      status: "active",
    },
  });

  // Calculate real-time metrics
  const realTimeMetrics = await calculateRealTimeMetrics(db, countryId);

  // Helper to map metric names to values
  const getMetricValue = (metricName: string): number => {
    switch (metricName) {
      // GDP
      case "gdpGrowthRate":
        return country.adjustedGdpGrowth * 100;
      case "gdpPerCapita":
        return country.currentGdpPerCapita;
      case "totalGDP":
        return country.currentTotalGdp;
      // Population
      case "populationGrowthRate":
        return country.populationGrowthRate * 100;
      case "totalPopulation":
        return country.currentPopulation;
      case "populationWellbeing":
        return country.populationWellbeing;
      // Security
      case "securityScore":
        return realTimeMetrics.security;
      case "militaryStrength":
        return country.securityAssessment?.militaryStrength ?? 60;
      case "threatLevel":
        return country.securityAssessment?.activeThreatCount ?? 0;
      // Diplomatic
      case "diplomaticStanding":
        return country.diplomaticStanding;
      case "activeRelationships":
        return activeRelationships;
      case "embassyCount":
        return embassyCount;
      // Economic
      case "economicVitality":
        return country.economicVitality;
      case "tradeBalance":
        return country.tradeBalance;
      case "unemploymentRate":
        return country.unemploymentRate ?? 5;
      // Governance
      case "governmentalEfficiency":
        return country.governmentalEfficiency;
      case "activePolicies":
        return realTimeMetrics.political;
      case "publicApproval":
        return country.publicApproval;
      default:
        return 0;
    }
  };

  const mapCategory = (alertType: string): any => {
    const upper = alertType.toUpperCase();
    if (upper === "GDP") return "ECONOMIC";
    if (upper === "POPULATION") return "SOCIAL";
    return upper as any;
  };

  for (const t of thresholds) {
    const val = getMetricValue(t.metricName);

    // Determine severity breached
    let severityBreached: "critical" | "high" | "medium" | null = null;

    // Check critical (min/max)
    if (t.criticalMin !== null && val < t.criticalMin) severityBreached = "critical";
    else if (t.criticalMax !== null && val > t.criticalMax) severityBreached = "critical";
    // Check high
    else if (t.highMin !== null && val < t.highMin) severityBreached = "high";
    else if (t.highMax !== null && val > t.highMax) severityBreached = "high";
    // Check medium
    else if (t.mediumMin !== null && val < t.mediumMin) severityBreached = "medium";
    else if (t.mediumMax !== null && val > t.mediumMax) severityBreached = "medium";

    if (severityBreached) {
      // Check if we should notify
      const shouldNotify =
        (severityBreached === "critical" && t.notifyOnCritical) ||
        (severityBreached === "high" && t.notifyOnHigh) ||
        (severityBreached === "medium" && t.notifyOnMedium);

      if (shouldNotify) {
        const alertTitle = `🚨 ${t.metricName} breached ${severityBreached} threshold`;
        const alertDescription = `Current value: ${val.toFixed(2)}. Threshold ranges breached: ${severityBreached.toUpperCase()}`;

        const existingAlert = await db.intelligenceAlert.findFirst({
          where: {
            countryId,
            alertType: "threshold_breach",
            title: alertTitle,
            isActive: true,
            isResolved: false,
          },
        });

        if (!existingAlert) {
          const alert = await db.intelligenceAlert.create({
            data: {
              countryId,
              title: alertTitle,
              description: alertDescription,
              severity: severityBreached.toUpperCase() as any,
              category: mapCategory(t.alertType),
              alertType: "threshold_breach",
              isActive: true,
              isResolved: false,
              detectedAt: new Date(),
              currentValue: val,
              expectedValue: t.criticalMin ?? t.highMin ?? t.mediumMin ?? 0,
              deviation: val - (t.criticalMin ?? t.highMin ?? t.mediumMin ?? 0),
              zScore: 1.0,
              factors: JSON.stringify([]),
              confidence: 100,
            },
          });

          // Create notification
          await notificationAPI.create({
            title: alertTitle,
            message: alertDescription,
            countryId,
            category: "intelligence",
            priority: severityBreached as any,
            type: "alert",
            href: "/mycountry/intelligence",
            source: "intelligence-system",
            actionable: false,
            metadata: {
              alertId: alert.id,
              thresholdId: t.id,
              metricName: t.metricName,
              val,
            },
          });
        }
      }
    }
  }
}
