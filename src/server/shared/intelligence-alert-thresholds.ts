/**
 * Shared intelligence alert threshold evaluation module.
 *
 * Moved below the router layer to enable server-side invocation without
 * cross-router dependencies (Plan 153).
 */
import type { PrismaClient } from "@prisma/client";
import { notificationAPI } from "~/lib/notifications/api";
import { threatPictureFor } from "~/server/modules/defense";
import type { ThreatPicture } from "~/lib/military/threat-picture";
import { clockForCountry } from "./realm-time";
import { getEconomicConfigFromDB } from "~/lib/config-service";
import { getComponentsStatsDataForCountries, projectCountryStats } from "./country-helpers";

/**
 * Where the owner reads and resolves these alerts: the Intelligence alerts card on the
 * MyCountry overview (`?focus=alerts` scrolls to it). `/mycountry/intelligence` renders Defense.
 */
export const INTELLIGENCE_ALERTS_HREF = "/mycountry?focus=alerts";

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
  /** Derived on read; loaded only when a threshold watches a security-picture metric. */
  threatPicture: ThreatPicture | null;
  /** The realised annual GDP growth (decimal) the projection applies now; null when not watched. */
  effectiveGdpGrowth: number | null;
}

/** Figures the caller already computed, so the evaluation does not project them again. */
export interface KnownMetrics {
  /** `CountryStats.effectiveGdpGrowth` (decimal) from a projection now on the nation's realm clock. */
  effectiveGdpGrowth?: number;
}

/**
 * The growth rate MyCountry shows: the projection's effective rate now on the nation's realm clock, not the founding
 * `adjustedGdpGrowth` input (which never moves).
 */
async function projectEffectiveGdpGrowth(
  db: PrismaClient,
  countryId: string
): Promise<number | null> {
  const country = await db.country.findUnique({
    where: { id: countryId },
    include: { storytellerEffects: { where: { isActive: true } } },
  });
  if (!country) return null;
  const now = (await clockForCountry(db, country)).now();
  const [components, econConfig] = await Promise.all([
    getComponentsStatsDataForCountries(db, [countryId], () => now),
    getEconomicConfigFromDB(db),
  ]);
  const stats = projectCountryStats(country, components.get(countryId), econConfig, now);
  return stats.effectiveGdpGrowth ?? null;
}

/** Metrics read from the derived threat picture (military strength score 0-100, threat count). */
const THREAT_PICTURE_METRICS = new Set(["militaryStrength", "threatLevel"]);

/** Threshold metric name -> its current value (null when not recorded). */
const METRIC_VALUES: Record<string, (m: MetricSources) => number | null> = {
  // GDP
  gdpGrowthRate: (m) => (m.effectiveGdpGrowth === null ? null : m.effectiveGdpGrowth * 100),
  gdpPerCapita: (m) => m.country.currentGdpPerCapita,
  totalGDP: (m) => m.country.currentTotalGdp,
  // Population
  populationGrowthRate: (m) => m.country.populationGrowthRate * 100,
  totalPopulation: (m) => m.country.currentPopulation,
  populationWellbeing: (m) => m.country.populationWellbeing,
  // Security
  securityScore: (m) => m.realTime.security,
  militaryStrength: (m) => m.threatPicture?.militaryStrength ?? null,
  threatLevel: (m) => m.threatPicture?.activeThreatCount ?? null,
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

/** How each metric reads in an alert (the card and notification show the title as written). */
const METRIC_LABELS: Record<string, string> = {
  gdpGrowthRate: "GDP growth",
  gdpPerCapita: "GDP per capita",
  totalGDP: "Total GDP",
  populationGrowthRate: "Population growth",
  totalPopulation: "Population",
  populationWellbeing: "Population wellbeing",
  securityScore: "Security",
  militaryStrength: "Military strength",
  threatLevel: "Active threats",
  diplomaticStanding: "Diplomatic standing",
  activeRelationships: "Active relationships",
  embassyCount: "Embassies",
  economicVitality: "Economic vitality",
  tradeBalance: "Trade balance",
  unemploymentRate: "Unemployment",
  governmentalEfficiency: "Government efficiency",
  activePolicies: "Active policies",
  publicApproval: "Public approval",
};
const metricLabel = (metricName: string) => METRIC_LABELS[metricName] ?? metricName;

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
  const alertTitle = `${metricLabel(t.metricName)} breached its ${severityBreached} threshold`;
  const alertDescription = `Current value: ${val.toFixed(2)}, past the ${severityBreached} range.`;
  // Titles written before 2026-10-28 named the raw metric (and before 2026-10-05 led with a siren emoji).
  const legacyTitle = `${t.metricName} breached ${severityBreached} threshold`;

  const existingAlert = await db.intelligenceAlert.findFirst({
    where: {
      countryId,
      alertType: "threshold_breach",
      title: { in: [alertTitle, legacyTitle, `\u{1F6A8} ${legacyTitle}`] },
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
    href: INTELLIGENCE_ALERTS_HREF,
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
  userId: string,
  known: KnownMetrics = {}
): Promise<void> {
  const thresholds = await db.intelligenceAlertThreshold.findMany({
    where: { countryId, userId, isActive: true },
  });
  if (thresholds.length === 0) return;

  const country = await db.country.findUnique({ where: { id: countryId } });
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
    threatPicture: thresholds.some((t: { metricName: string }) =>
      THREAT_PICTURE_METRICS.has(t.metricName)
    )
      ? await threatPictureFor(db, countryId)
      : null,
    effectiveGdpGrowth: thresholds.some(
      (t: { metricName: string }) => t.metricName === "gdpGrowthRate"
    )
      ? (known.effectiveGdpGrowth ?? (await projectEffectiveGdpGrowth(db, countryId)))
      : null,
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

/** Evaluates every active threshold set on a country (each user's set separately). */
export async function evaluateCountryThresholds(
  db: PrismaClient,
  countryId: string,
  known: KnownMetrics = {}
): Promise<void> {
  const owners = await db.intelligenceAlertThreshold.findMany({
    where: { countryId, isActive: true },
    select: { userId: true },
    distinct: ["userId"],
  });
  for (const { userId } of owners) {
    await evaluateThresholds(db, countryId, userId, known);
  }
}
