/**
 * Country snapshot builder for the National Issues engine: flattens every piece
 * of country data that template trigger conditions and variables reference.
 */

import type { ComponentType, PrismaClient } from "@prisma/client";
import { IxTime } from "~/lib/ixtime";
import {
  calculateCivilServiceCapacity,
  calculateTotalConsumedStaff,
} from "~/lib/government/atomic-utils";
import type { EconomicComponentType } from "~/lib/economy/atomic-data";
import { mapTaxComponentTypeToId } from "~/lib/enums";
import { buildGroundedContext, type GroundedSnapshot } from "./snapshot";
import { resolveNeighbors } from "./neighbors";
import type { CountrySnapshot } from "./types";

type ComponentRow = { componentType: string; isActive: boolean; implementationDate: Date | null };
type ComponentSplit = { active: string[]; implementing: string[] };

function fetchCountryCore(countryId: string, db: PrismaClient) {
  return db.country.findUnique({
    where: { id: countryId },
    select: {
      id: true,
      name: true,
      leader: true,
      governmentType: true,
      economicTier: true,
      populationTier: true,
      continent: true,
      region: true,
      currentPopulation: true,
      currentGdpPerCapita: true,
      currentTotalGdp: true,
      actualGdpGrowth: true,
      unemploymentRate: true,
      inflationRate: true,
      tradeBalance: true,
      taxRevenueGDPPercent: true,
      budgetDeficitSurplus: true,
      totalDebtGDPRatio: true,
      debtPerCapita: true,
      publicApproval: true,
      povertyRate: true,
      incomeInequalityGini: true,
      lifeExpectancy: true,
      literacyRate: true,
      urbanPopulationPercent: true,
      infrastructureRating: true,
      governmentStructure: {
        select: {
          politicalStability: true,
          democracyIndex: true,
          governmentEffectiveness: true,
          ruleOfLaw: true,
          corruptionIndex: true,
          politicalPolarization: true,
        },
      },
      stabilityMetrics: {
        select: {
          stabilityScore: true,
          crimeRate: true,
          protestFrequency: true,
          riotRisk: true,
          socialCohesion: true,
          ethnicTension: true,
          trustInGovernment: true,
        },
      },
      activeAlliances: true,
      activeTreaties: true,
    },
  });
}

type CountryCoreRow = NonNullable<Awaited<ReturnType<typeof fetchCountryCore>>>;

function fetchSnapshotRelations(countryId: string, db: PrismaClient) {
  return Promise.all([
    db.embassy.count({
      where: {
        hostCountryId: countryId,
        status: "active",
      },
    }),
    db.policy.count({
      where: { countryId, status: "active" },
    }),
    db.nationalIssue.count({
      where: {
        countryId,
        status: { in: ["pending", "viewed"] },
      },
    }),
    db.crisisEvent.count({
      where: {
        affectedCountries: { contains: countryId },
        responseStatus: { not: "resolved" },
      },
    }),
    db.governmentComponent.findMany({
      where: { countryId },
      select: { componentType: true, isActive: true, implementationDate: true },
    }),
    db.economicComponent.findMany({
      where: { countryId },
      select: { componentType: true, isActive: true, implementationDate: true },
    }),
    db.taxComponent.findMany({
      where: { countryId },
      select: { componentType: true, isActive: true, implementationDate: true },
    }),
    db.policy.findMany({
      where: { countryId, status: "active" },
      select: { id: true, name: true, calculatedEffects: true },
    }),
    db.intent.findMany({
      where: { countryId, status: "active" },
      select: { goal: true, category: true },
    }),
    buildGroundedContext(countryId, db),
    resolveNeighbors(countryId, db),
  ]);
}

/**
 * A component counts as active once isActive is set OR its implementationDate has
 * elapsed (implementationDate is stored in IxTime, so `now` is IxTime too).
 */
function isComponentActive(c: ComponentRow, now: Date): boolean {
  return c.isActive === true || (!!c.implementationDate && new Date(c.implementationDate) <= now);
}

function splitByActivity(
  rows: ComponentRow[],
  now: Date,
  toId: (componentType: string) => string
): ComponentSplit {
  const split: ComponentSplit = { active: [], implementing: [] };
  for (const c of rows) {
    const id = toId(String(c.componentType));
    (isComponentActive(c, now) ? split.active : split.implementing).push(id);
  }
  return split;
}

/**
 * Classify components into active vs. still-implementing. Staff is consumed by both
 * active and implementing components (rollout still ties up staff).
 */
function classifyComponents(
  govComps: ComponentRow[],
  econComps: ComponentRow[],
  taxComps: ComponentRow[],
  now: Date
) {
  const gov = splitByActivity(govComps, now, (type) => type);
  const econ = splitByActivity(econComps, now, (type) => type);
  const tax = splitByActivity(taxComps, now, mapTaxComponentTypeToId);

  return {
    activeComponents: [...gov.active, ...econ.active, ...tax.active],
    implementingComponents: [...gov.implementing, ...econ.implementing, ...tax.implementing],
    consumedStaff: calculateTotalConsumedStaff(
      [...gov.active, ...gov.implementing] as ComponentType[],
      [...econ.active, ...econ.implementing] as EconomicComponentType[],
      [...tax.active, ...tax.implementing]
    ),
  };
}

function policyKeyFromName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

function parseActivePolicies(policies: Array<{ name: string; calculatedEffects: string | null }>) {
  const activePoliciesList: string[] = [];
  const policySettings: Record<string, Record<string, number>> = {};

  for (const policy of policies) {
    if (!policy.calculatedEffects) {
      activePoliciesList.push(policyKeyFromName(policy.name));
      continue;
    }
    try {
      const parsed = JSON.parse(policy.calculatedEffects) as {
        decretalKey?: string;
        settings?: Record<string, number>;
      };
      const key = parsed.decretalKey || policyKeyFromName(policy.name);
      activePoliciesList.push(key);
      if (parsed.settings) {
        policySettings[key] = parsed.settings;
      }
    } catch {
      // Ignore malformed calculatedEffects JSON
    }
  }
  return { activePoliciesList, policySettings };
}

/** `Country.actualGdpGrowth` (a decimal) as percent, rounded to avoid float noise (0.07 → 7). */
export function growthDecimalToPercent(growth: number | null | undefined): number {
  if (typeof growth !== "number" || !Number.isFinite(growth)) return 0;
  return Math.round(growth * 100 * 1e6) / 1e6;
}

function coreFields(country: CountryCoreRow) {
  return {
    id: country.id,
    name: country.name,
    leader: country.leader,
    governmentType: country.governmentType,
    economicTier: country.economicTier,
    populationTier: country.populationTier,
    continent: country.continent,
    region: country.region,
    currentPopulation: country.currentPopulation,
    currentGdpPerCapita: country.currentGdpPerCapita,
    currentTotalGdp: country.currentTotalGdp,
    // Stored as a decimal (0.03 = 3%); trigger conditions and the {{gdpGrowth}} variable use
    // percent, like every other rate in the snapshot.
    actualGdpGrowth: growthDecimalToPercent(country.actualGdpGrowth),
    unemploymentRate: country.unemploymentRate ?? 0,
    inflationRate: country.inflationRate ?? 0,
    tradeBalance: country.tradeBalance ?? 0,
    taxRevenueGDPPercent: country.taxRevenueGDPPercent ?? 0,
    budgetDeficitSurplus: country.budgetDeficitSurplus ?? 0,
    totalDebtGDPRatio: country.totalDebtGDPRatio ?? 0,
    debtPerCapita: country.debtPerCapita ?? 0,
    publicApproval: country.publicApproval ?? 50,
    povertyRate: country.povertyRate ?? 0,
    incomeInequalityGini: country.incomeInequalityGini ?? 0,
    lifeExpectancy: country.lifeExpectancy ?? 70,
    literacyRate: country.literacyRate ?? 90,
    urbanPopulationPercent: country.urbanPopulationPercent ?? 50,
    infrastructureRating: country.infrastructureRating ?? 50,
  };
}

function governmentFields(gs: CountryCoreRow["governmentStructure"]) {
  return {
    politicalStability: gs?.politicalStability ?? 50,
    democracyIndex: gs?.democracyIndex ?? 50,
    governmentEffectiveness: gs?.governmentEffectiveness ?? 50,
    ruleOfLaw: gs?.ruleOfLaw ?? 50,
    corruptionIndex: gs?.corruptionIndex ?? 50,
    politicalPolarization: gs?.politicalPolarization ?? 40,
  };
}

function stabilityFields(sm: CountryCoreRow["stabilityMetrics"]) {
  return {
    stabilityScore: sm?.stabilityScore ?? 75,
    crimeRate: sm?.crimeRate ?? 5,
    protestFrequency: sm?.protestFrequency ?? 5,
    riotRisk: sm?.riotRisk ?? 10,
    socialCohesion: sm?.socialCohesion ?? 70,
    ethnicTension: sm?.ethnicTension ?? 20,
    trustInGovernment: sm?.trustInGovernment ?? 50,
  };
}

/**
 * Grounded context (Phase 3) — optional, focused-first.
 */
function groundedFields(grounded: GroundedSnapshot | null | undefined) {
  const g: Partial<GroundedSnapshot> = grounded ?? {};
  return {
    geo: g.geo ?? undefined,
    identity: g.identity ?? undefined,
    party: g.party ?? undefined,
    oppositionParty: g.oppositionParty ?? undefined,
    minister: g.minister ?? undefined,
    official: g.official ?? undefined,
    labor: g.labor ?? undefined,
    fiscal: g.fiscal ?? undefined,
    economy: g.economy ?? undefined,
    partners: g.partners ?? undefined,
    embassyPartners: g.embassyPartners ?? undefined,
    worldEvents: g.worldEvents ?? undefined,
    crises: g.crises ?? undefined,
  };
}

/**
 * Build a flattened snapshot of all relevant country data.
 * Single optimized query - all template evaluations share this.
 */
export async function buildCountrySnapshot(
  countryId: string,
  db: PrismaClient
): Promise<CountrySnapshot | null> {
  const country = await fetchCountryCore(countryId, db);
  if (!country) return null;

  const [
    embassyCount,
    policyCount,
    pendingIssueCount,
    crisisCount,
    govComps,
    econComps,
    taxComps,
    activePolicies,
    activeIntents,
    grounded,
    neighbors,
  ] = await fetchSnapshotRelations(countryId, db);

  const currentIxTime = IxTime.getCurrentIxTime();
  const ixDate = new Date(currentIxTime);
  const components = classifyComponents(govComps, econComps, taxComps, ixDate);
  const civilServiceCapacity = calculateCivilServiceCapacity(
    country.currentPopulation ?? 0,
    country.governmentStructure?.governmentEffectiveness ?? 50
  );
  const { activePoliciesList, policySettings } = parseActivePolicies(activePolicies);

  return {
    ...coreFields(country),
    ...governmentFields(country.governmentStructure),
    ...stabilityFields(country.stabilityMetrics),
    activeEmbassyCount: embassyCount,
    activeAllianceCount: country.activeAlliances ?? 0,
    activePolicyCount: policyCount,
    pendingIssueCount: pendingIssueCount,
    recentCrisisCount: crisisCount,
    activeTreatyCount: country.activeTreaties ?? 0,
    activeComponents: components.activeComponents,
    implementingComponents: components.implementingComponents,
    civilServiceCapacity,
    consumedStaff: components.consumedStaff,
    currentIxTime,
    currentIxYear: ixDate.getFullYear(),
    currentIxMonth: ixDate.getMonth() + 1,
    activePoliciesList,
    policySettings,
    activeIntents: activeIntents.map((i) => i.goal),
    activeIntentCategories: activeIntents.map((i) => i.category),
    ...groundedFields(grounded),
    neighbors,
    activeIntentGoals: activeIntents.map((i) => i.goal),
  };
}
