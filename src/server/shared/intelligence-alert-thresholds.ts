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

interface MetricSources {
  country: any;
  realTime: Awaited<ReturnType<typeof calculateRealTimeMetrics>>;
  activeRelationships: number;
  embassyCount: number;
}

/** Threshold metric name -> its current value (null when not recorded). */
const METRIC_VALUES: Record<string, (m: MetricSources) => number | null> = {
  // GDP
  gdpGrowthRate: (m) => m.country.adjustedGdpGrowth * 100,
  gdpPerCapita: (m) => m.country.currentGdpPerCapita,
  totalGDP: (m) => m.country.currentTotalGdp,
  // Population
  populationGrowthRate: (m) => m.country.populationGrowthRate * 100,
  totalPopulation: (m) => m.country.currentPopulation,
  populationWellbeing: (m) => m.country.populationWellbeing,
  // Security
  securityScore: (m) => m.realTime.security,
  militaryStrength: (m) => m.country.securityAssessment?.militaryStrength ?? null,
  threatLevel: (m) => m.country.securityAssessment?.activeThreatCount ?? null,
  // Diplomatic
  diplomaticStanding: (m) => m.country.diplomaticStanding,
  activeRelationships: (m) => m.activeRelationships,
  embassyCount: (m) => m.embassyCount,
  // Economic
  economicVitality: (m) => m.country.economicVitality,
  tradeBalance: (m) => m.country.tradeBalance,
  unemploymentRate: (m) => m.country.unemploymentRate ?? null,
  // Governance
  governmentalEfficiency: (m) => m.country.governmentalEfficiency,
  activePolicies: (m) => m.realTime.political,
  publicApproval: (m) => m.country.publicApproval,
};

type Severity = "critical" | "high" | "medium";

/** The most severe band whose min/max the value breaches, checked critical -> high -> medium. */
function breachedSeverity(t: any, val: number): Severity | null {
  for (const severity of ["critical", "high", "medium"] as const) {
    const min = t[`${severity}Min`];
    const max = t[`${severity}Max`];
    if ((min !== null && val < min) || (max !== null && val > max)) return severity;
  }
  return null;
}

const ALERT_CATEGORY_OVERRIDES: Record<string, string> = { GDP: "ECONOMIC", POPULATION: "SOCIAL" };

const mapCategory = (alertType: string): any => {
  const upper = alertType.toUpperCase();
  return ALERT_CATEGORY_OVERRIDES[upper] ?? upper;
};

/** Raises an alert and notification for a breached threshold unless an identical one is open. */
async function raiseBreachAlert(
  db: any,
  countryId: string,
  t: any,
  severityBreached: Severity,
  val: number
) {
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
  if (existingAlert) return;

  const expectedValue = t.criticalMin ?? t.highMin ?? t.mediumMin ?? 0;
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
      expectedValue,
      deviation: val - expectedValue,
      zScore: 1.0,
      factors: JSON.stringify([]),
      confidence: 100,
    },
  });

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
    metadata: { alertId: alert.id, thresholdId: t.id, metricName: t.metricName, val },
  });
}

const NOTIFY_FLAG = {
  critical: "notifyOnCritical",
  high: "notifyOnHigh",
  medium: "notifyOnMedium",
} as const;

/**
 * Evaluate alert thresholds for a country and generate intelligence alerts if breached
 */
export async function evaluateThresholds(
  db: any,
  countryId: string,
  userId: string
): Promise<void> {
  const thresholds = await db.intelligenceAlertThreshold.findMany({
    where: { countryId, userId, isActive: true },
  });
  if (thresholds.length === 0) return;

  const country = await db.country.findUnique({
    where: { id: countryId },
    include: { securityAssessment: true },
  });
  if (!country) return;

  const activeRelationships = await db.diplomaticRelation.count({
    where: { OR: [{ country1: countryId }, { country2: countryId }], status: "active" },
  });
  const embassyCount = await db.embassy.count({
    where: {
      OR: [{ hostCountryId: countryId }, { guestCountryId: countryId }],
      status: "active",
    },
  });
  const sources: MetricSources = {
    country,
    realTime: await calculateRealTimeMetrics(db, countryId),
    activeRelationships,
    embassyCount,
  };

  for (const t of thresholds) {
    const val = METRIC_VALUES[t.metricName]?.(sources) ?? null;
    // No recorded value for this metric: nothing to breach.
    if (val === null) continue;

    const severityBreached = breachedSeverity(t, val);
    if (severityBreached && t[NOTIFY_FLAG[severityBreached]]) {
      await raiseBreachAlert(db, countryId, t, severityBreached, val);
    }
  }
}
