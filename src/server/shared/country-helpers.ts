import { mapTaxComponentTypeToId } from "~/lib/enums";
import {
  assertPersistableStats,
  DEFAULT_INFLATION_RATE,
  IxStatsCalculator,
} from "~/lib/economy/calculations";
import type { BaseCountryData, CountryStats, EconomicConfig } from "~/types/ixstats";

const validateGrowthRate = (value: number | null | undefined): number => {
  const numValue = Number(value);
  if (!isFinite(numValue) || isNaN(numValue)) return 0;
  return Math.min(Math.max(numValue, -0.5), 0.5);
};

const COMPONENT_DEFAULTS = {
  activeGovComponents: [],
  activeEconComponents: [],
  activeTaxComponents: [],
  implementingGovComponents: [],
  implementingEconComponents: [],
  implementingTaxComponents: [],
  activePolicyMaintenanceCost: 0,
} as const;

/** The engine's stand-ins for inputs a nation never recorded: used in the math, never shown. */
const ENGINE_STAND_INS = { taxRevenueGDPPercent: 25, unemploymentRate: 5 } as const;

/**
 * The projected figures whose input the nation never recorded, as undefined: the engine ran on a
 * stand-in (ENGINE_STAND_INS), so readers show "—" rather than that stand-in as a real figure.
 */
export function withoutStandIns(
  country: { unemploymentRate?: number | null; taxRevenueGDPPercent?: number | null },
  stats: { unemploymentRate?: number | null; taxRevenueGDPPercent?: number | null }
) {
  return {
    unemploymentRate:
      country.unemploymentRate == null ? undefined : (stats.unemploymentRate ?? undefined),
    taxRevenueGDPPercent:
      country.taxRevenueGDPPercent == null ? undefined : (stats.taxRevenueGDPPercent ?? undefined),
  };
}

export const prepareBaseCountryData = (country: any, componentsData?: any): BaseCountryData => ({
  country: country.name,
  continent: country.continent,
  region: country.region,
  governmentType: country.governmentType,
  religion: country.religion,
  leader: country.leader,
  population: country.baselinePopulation,
  gdpPerCapita: country.baselineGdpPerCapita,
  landArea: country.landArea,
  areaSqMi: country.areaSqMi,
  maxGdpGrowthRate: validateGrowthRate(country.maxGdpGrowthRate),
  adjustedGdpGrowth: validateGrowthRate(country.adjustedGdpGrowth),
  populationGrowthRate: validateGrowthRate(country.populationGrowthRate),
  projected2040Population: country.projected2040Population || 0,
  projected2040Gdp: country.projected2040Gdp || 0,
  projected2040GdpPerCapita: country.projected2040GdpPerCapita || 0,
  actualGdpGrowth: validateGrowthRate(country.actualGdpGrowth),
  localGrowthFactor: country.localGrowthFactor || 1.0,

  totalGovernmentSpending: country.totalGovernmentSpending ?? 0,
  taxRevenueGDPPercent: country.taxRevenueGDPPercent ?? ENGINE_STAND_INS.taxRevenueGDPPercent,
  unemploymentRate: country.unemploymentRate ?? ENGINE_STAND_INS.unemploymentRate,
  inflationRate: country.inflationRate ?? DEFAULT_INFLATION_RATE,

  ...(Object.fromEntries(
    Object.entries(COMPONENT_DEFAULTS).map(([key, fallback]) => [
      key,
      componentsData?.[key] ?? fallback,
    ])
  ) as Pick<BaseCountryData, keyof typeof COMPONENT_DEFAULTS>),
});

/**
 * One country's component and policy figures for the projection. A read only: a component whose
 * implementationDate has passed by `nowMs` (the nation's clock) counts as active without writing `isActive` back.
 */
export async function getCountryComponentsStatsData(db: any, countryId: string, nowMs: number) {
  const now = new Date(nowMs);

  const [gov, econ, tax] = await Promise.all([
    db.governmentComponent.findMany({
      where: { countryId },
      select: { componentType: true, implementationDate: true, isActive: true },
    }),
    db.economicComponent.findMany({
      where: { countryId },
      select: { componentType: true, implementationDate: true, isActive: true },
    }),
    db.taxComponent.findMany({
      where: { countryId },
      select: { componentType: true, implementationDate: true, isActive: true },
    }),
  ]).catch(() => [[], [], []]);

  const activePolicies = await db.policy
    .findMany({
      where: { countryId, status: "active" },
      select: { maintenanceCost: true },
    })
    .catch(() => []);

  return classifyComponentsStatsData(gov, econ, tax, activePolicies, now);
}

type ComponentsStatsData = ReturnType<typeof classifyComponentsStatsData>;

interface ComponentRow {
  componentType: string;
  implementationDate: Date;
  isActive: boolean;
}

/**
 * Split one country's component rows into active / implementing and total its active policies'
 * maintenance (shared by the per-country and batch loaders).
 */
function classifyComponentsStatsData(
  gov: ComponentRow[],
  econ: ComponentRow[],
  tax: ComponentRow[],
  activePolicies: Array<{ maintenanceCost: number | null }>,
  now: Date
) {
  const activeGov: string[] = [];
  const implementingGov: string[] = [];
  gov.forEach((c) => {
    if (c.isActive || c.implementationDate <= now) {
      activeGov.push(c.componentType);
    } else {
      implementingGov.push(c.componentType);
    }
  });

  const activeEcon: string[] = [];
  const implementingEcon: string[] = [];
  econ.forEach((c) => {
    if (c.isActive || c.implementationDate <= now) {
      activeEcon.push(c.componentType);
    } else {
      implementingEcon.push(c.componentType);
    }
  });

  const activeTax: string[] = [];
  const implementingTax: string[] = [];
  tax.forEach((c) => {
    const frontendId = mapTaxComponentTypeToId(c.componentType);
    if (c.isActive || c.implementationDate <= now) {
      activeTax.push(frontendId);
    } else {
      implementingTax.push(frontendId);
    }
  });

  const activePolicyMaintenanceCost = activePolicies.reduce(
    (sum: number, p) => sum + (p.maintenanceCost || 0),
    0
  );

  return {
    activeGovComponents: activeGov,
    implementingGovComponents: implementingGov,
    activeEconComponents: activeEcon,
    implementingEconComponents: implementingEcon,
    activeTaxComponents: activeTax,
    implementingTaxComponents: implementingTax,
    activePolicyMaintenanceCost,
  };
}

/**
 * Batch form of getCountryComponentsStatsData for jobs: four queries for the whole batch and no
 * writes (classification already treats a due implementationDate as active). `nowOf` is each
 * country's time on its realm's clock.
 */
export async function getComponentsStatsDataForCountries(
  db: any,
  countryIds: string[],
  nowOf: (countryId: string) => number
): Promise<Map<string, ComponentsStatsData>> {
  const where = { countryId: { in: countryIds } };
  const select = { countryId: true, componentType: true, implementationDate: true, isActive: true };
  type Row = ComponentRow & { countryId: string };
  const [gov, econ, tax, policies]: [
    Row[],
    Row[],
    Row[],
    Array<{ countryId: string; maintenanceCost: number | null }>,
  ] = await Promise.all([
    db.governmentComponent.findMany({ where, select }),
    db.economicComponent.findMany({ where, select }),
    db.taxComponent.findMany({ where, select }),
    db.policy.findMany({
      where: { ...where, status: "active" },
      select: { countryId: true, maintenanceCost: true },
    }),
  ]);

  const byCountry = <T extends { countryId: string }>(rows: T[], id: string) =>
    rows.filter((r) => r.countryId === id);
  const out = new Map<string, ComponentsStatsData>();
  for (const id of countryIds) {
    out.set(
      id,
      classifyComponentsStatsData(
        byCountry(gov, id),
        byCountry(econ, id),
        byCountry(tax, id),
        byCountry(policies, id),
        new Date(nowOf(id))
      )
    );
  }
  return out;
}

/**
 * The projection every surface shows: baseline stats at `baselineDate`, progressed to `ixTime`
 * with the country's StorytellerEffects (pass only the active ones).
 */
export function projectCountryStats(
  country: any,
  componentsData: ComponentsStatsData | undefined,
  econConfig: EconomicConfig,
  ixTime: number
): CountryStats {
  const calc = new IxStatsCalculator(econConfig, new Date(country.baselineDate).getTime());
  const baselineStats = calc.initializeCountryStats(
    prepareBaseCountryData(country, componentsData)
  );
  const effects = ((country.storytellerEffects ?? []) as any[]).map((e) => ({
    ...e,
    ixTimeTimestamp:
      e.ixTimeTimestamp instanceof Date ? e.ixTimeTimestamp.getTime() : e.ixTimeTimestamp,
  }));
  return calc.calculateTimeProgression(baselineStats, ixTime, effects).newStats;
}

/**
 * The Country columns a persisted projection writes. Never includes a baseline column.
 * Throws (assertPersistableStats) on a non-finite or negative stat.
 */
export function projectedStatsUpdate(stats: CountryStats, ixTime: number) {
  assertPersistableStats(stats);
  return {
    currentPopulation: stats.currentPopulation,
    currentGdpPerCapita: stats.currentGdpPerCapita,
    currentTotalGdp: stats.currentTotalGdp,
    economicTier: stats.economicTier.toString(),
    populationTier: stats.populationTier.toString(),
    populationDensity: stats.populationDensity,
    gdpDensity: stats.gdpDensity,
    lastCalculated: new Date(ixTime),
  };
}
