import type { PrismaClient } from "@prisma/client";
import { formatCurrency, formatPopulation } from "~/lib/utils";
import type { CountrySnapshot, EvaluationResult } from "../engine";

export interface ResponseOptionTemplate {
  id: string;
  label: string;
  description: string;
  consequences: Array<{
    targetType: string;
    targetField: string;
    operation: "add" | "subtract" | "multiply" | "set";
    value: number | string | boolean;
    durationDays?: number;
    delayDays?: number;
  }>;
  previewEffects: {
    economicImpact?: string;
    stabilityImpact?: string;
    socialImpact?: string;
  };
  outcomeText: string;
  isAutoResolveDefault?: boolean;
}

export interface TemplateCandidate {
  template: {
    id: string;
    slug: string;
    title: string;
    description: string;
    longDescription: string | null;
    domain: string;
    category: string;
    baseSeverity: string;
    baseUrgency: number;
    deadlineDaysBase: number | null;
    triggerConditions: string;
    cooldownDays: number;
    maxActivePerCountry: number;
    responseOptions: string;
    followUpTemplateIds: string | null;
    personalityModifiers: string | null;
    variableDefinitions: string | null;
  };
  probability: number;
}

const SECTOR_NAMES = [
  "manufacturing",
  "mining",
  "services",
  "agriculture",
  "technology",
  "energy",
  "financial services",
  "healthcare",
  "transportation",
  "telecommunications",
];

const CITY_DESCRIPTORS = [
  "the capital",
  "the industrial heartland",
  "the southern provinces",
  "the port district",
  "the northern territories",
  "the eastern corridor",
  "the western highlands",
  "the central valley",
];

const OFFICIAL_TITLES = [
  "the Minister of Finance",
  "the Minister of Defense",
  "the Minister of Interior",
  "the Foreign Secretary",
  "the Chief Economic Advisor",
  "the Attorney General",
  "the Health Minister",
  "the Education Secretary",
];

function randomFrom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

function randomBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

type VariableResolver = (snapshot: CountrySnapshot) => string;

export const BUILT_IN_VARIABLES: Record<string, VariableResolver> = {
  countryName: (s) => s.name,
  leaderName: (s) => s.leader || "the Head of State",
  governmentType: (s) => s.governmentType || "the government",
  economicTier: (s) => s.economicTier,
  populationTier: (s) => s.populationTier,
  continent: (s) => s.continent || "the region",
  region: (s) => s.region || "the area",
  gdpFormatted: (s) => formatCurrency(s.currentTotalGdp),
  gdpPerCapitaFormatted: (s) => formatCurrency(s.currentGdpPerCapita),
  populationFormatted: (s) => formatPopulation(s.currentPopulation),
  unemploymentRate: (s) => (s.unemploymentRate ?? 0).toFixed(1) + "%",
  inflationRate: (s) => (s.inflationRate ?? 0).toFixed(1) + "%",
  approvalRating: (s) => Math.round(s.publicApproval).toString() + "%",
  povertyRate: (s) => (s.povertyRate ?? 0).toFixed(1) + "%",
  gdpGrowth: (s) => (s.actualGdpGrowth ?? 0).toFixed(1) + "%",
  debtRatio: (s) => (s.totalDebtGDPRatio ?? 0).toFixed(1) + "%",
  infrastructureRating: (s) => Math.round(s.infrastructureRating).toString(),
  stabilityScore: (s) => Math.round(s.stabilityScore).toString(),
  currentYear: (s) => String(s.currentIxYear),
  // Computed random variables
  sectorName: () => randomFrom(SECTOR_NAMES),
  cityName: (s) =>
    s.identity?.capitalCity || s.identity?.largestCity || randomFrom(CITY_DESCRIPTORS),
  officialTitle: (s) => s.official?.title || s.minister?.title || randomFrom(OFFICIAL_TITLES),
  percentageSmall: () => String(randomBetween(3, 12)),
  percentageMedium: () => String(randomBetween(12, 30)),
  percentageLarge: () => String(randomBetween(30, 55)),
  amountSmall: (s) => formatCurrency(s.currentTotalGdp * (randomBetween(1, 5) / 1000)),
  amountMedium: (s) => formatCurrency(s.currentTotalGdp * (randomBetween(5, 20) / 1000)),
  amountLarge: (s) => formatCurrency(s.currentTotalGdp * (randomBetween(20, 80) / 1000)),
  workerCount: (s) => formatPopulation(s.currentPopulation * (randomBetween(1, 5) / 100)),
  // Grounded names (Phase 3): real values when available, descriptive fallbacks otherwise.
  neighborName: (s) => s.neighbors?.[0]?.name || s.partners?.[0]?.name || "a neighboring state",
  allyName: (s) => {
    const ally = s.partners?.find((p) => p.band === "ALLY");
    return ally?.name || s.partners?.[0]?.name || "an ally";
  },
  rivalName: (s) => {
    const rival = s.partners?.find((p) => p.band === "HOSTILE" || p.band === "TENSE");
    return rival?.name || s.neighbors?.[0]?.name || "a rival power";
  },
  partnerName: (s) => s.partners?.[0]?.name || s.embassyPartners?.[0] || "a partner state",
  partyName: (s) => s.party?.name || s.oppositionParty?.name || "the ruling coalition",
  oppositionParty: (s) =>
    s.oppositionParty?.name ||
    s.party?.name ||
    randomFrom([
      "the opposition coalition",
      "reform-minded lawmakers",
      "the minority bloc",
      "progressive legislators",
      "conservative hardliners",
    ]),
  ministerName: (s) => s.minister?.name || s.official?.name || "the cabinet",
  capitalCity: (s) => s.identity?.capitalCity || s.identity?.largestCity || "the capital",
  dominantClimate: (s) => s.geo?.dominantClimate || "temperate",
  activeIntentGoal: (s) => s.activeIntentGoals?.[0] || "reform",
  mediaOutlet: () =>
    randomFrom([
      "the national press",
      "investigative journalists",
      "a major media outlet",
      "independent reporters",
      "the state broadcaster",
    ]),
};

/**
 * Substitute {{variable}} placeholders in a template string.
 */
export function substituteVariables(
  template: string,
  snapshot: CountrySnapshot,
  extraVars?: Record<string, string>
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_match, varName: string) => {
    if (extraVars?.[varName]) return extraVars[varName];
    const resolver = BUILT_IN_VARIABLES[varName];
    if (resolver) return resolver(snapshot);
    return `{{${varName}}}`;
  });
}

/**
 * Auto-trigger a "Government Staffing Shortage" issue when active + implementing
 * component staff requirements exceed the country's civil service capacity.
 */
export async function maybeTriggerStaffingShortage(
  countryId: string,
  db: PrismaClient,
  snapshot: CountrySnapshot,
  result: EvaluationResult
): Promise<void> {
  if (snapshot.consumedStaff <= snapshot.civilServiceCapacity) return;

  try {
    const overstaff = Math.round(snapshot.consumedStaff - snapshot.civilServiceCapacity);
    const slug = "government_staffing_shortage";

    const responseOptions = JSON.stringify([
      {
        id: "expand_civil_service",
        label: "Expand the civil service",
        description:
          "Fund additional administrative staff to meet the demands of active programs.",
        consequences: [],
        previewEffects: {
          economicImpact: "Higher payroll costs",
          stabilityImpact: "Stability recovers",
        },
        outcomeText: "New civil servants are recruited and the administrative backlog eases.",
        isAutoResolveDefault: true,
      },
      {
        id: "scale_back_programs",
        label: "Scale back programs",
        description:
          "Pause or decommission the least essential components to relieve the staffing burden.",
        consequences: [],
        previewEffects: {
          economicImpact: "Reduced program coverage",
          stabilityImpact: "Stability recovers",
        },
        outcomeText: "Lower-priority programs are wound down until capacity is restored.",
      },
    ]);

    const template = await db.nationalIssueTemplate.upsert({
      where: { slug },
      update: {},
      create: {
        slug,
        title: "Government Staffing Shortage",
        description:
          "The civil service is overstretched: active and rolling-out programs require more staff than {{countryName}} can currently supply.",
        longDescription:
          "Government programs in {{countryName}} demand more administrative capacity than the civil service can provide. Until the shortfall is resolved, government effectiveness and political stability will continue to suffer.",
        domain: "political",
        category: "governance",
        baseSeverity: "high",
        baseUrgency: 70,
        deadlineDaysBase: null,
        triggerConditions: JSON.stringify({ field: "consumedStaff", op: ">", value: 0 }),
        cooldownDays: 30,
        maxActivePerCountry: 1,
        responseOptions,
        isActive: true,
        isGlobal: true,
      },
    });

    const existing = await db.nationalIssue.count({
      where: { countryId, templateId: template.id, status: { in: ["pending", "viewed"] } },
    });
    if (existing > 0) return;

    await db.nationalIssue.create({
      data: {
        templateId: template.id,
        countryId,
        title: substituteVariables(template.title, snapshot),
        description: substituteVariables(template.description, snapshot),
        longDescription: template.longDescription
          ? substituteVariables(template.longDescription, snapshot)
          : null,
        domain: template.domain,
        category: template.category as any,
        severity: template.baseSeverity as any,
        urgency: template.baseUrgency,
        deadlineIxTime: null,
        status: "pending",
        autoResolveOptionId: "expand_civil_service",
        autoResolveLabel: "Expand the civil service",
        responseOptions: template.responseOptions,
        contextSnapshot: JSON.stringify({
          consumedStaff: Math.round(snapshot.consumedStaff),
          civilServiceCapacity: Math.round(snapshot.civilServiceCapacity),
          overstaff,
          activeComponents: snapshot.activeComponents.length,
          implementingComponents: snapshot.implementingComponents.length,
        }),
        triggerReason: `Civil service capacity exceeded (${Math.round(
          snapshot.consumedStaff
        )} staff required vs. ${Math.round(
          snapshot.civilServiceCapacity
        )} capacity, shortfall ${overstaff}).`,
        aiConfidence: 100,
        createdIxTime: snapshot.currentIxTime,
      },
    });

    result.issuesGenerated++;
  } catch (err) {
    result.errors.push(`Failed to trigger staffing shortage: ${(err as Error).message}`);
  }
}
