/**
 * Shared intelligence alert threshold evaluation module.
 *
 * Moved below the router layer to enable server-side invocation without
 * cross-router dependencies (Plan 153).
 */
import { notificationAPI } from "~/lib/notifications/api";

/**
 * Calculate real-time country metrics (social, security, political)
 */
export async function calculateRealTimeMetrics(db: any, countryId: string) {
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
export async function evaluateThresholds(
  db: any,
  countryId: string,
  userId: string
): Promise<void> {
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
