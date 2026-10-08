/**
 * Baseline data for a brand-new Country row: a realm
 * nation created by an approved claim (realms ruling E-f). Callers add the slug and any realm/wiki fields.
 * Its growth comes from the realm's per-tier table (`Realm.settings.nationDefaults`), else IxStats's defaults.
 */
import { IxTime } from "~/lib/ixtime";
import { getDefaultEconomicConfig } from "~/lib/config-service";
import { IxStatsCalculator } from "~/lib/economy/calculations";
import {
  IXSTATS_NATION_GROWTH_DEFAULTS,
  nationGrowthFor,
  type NationGrowthTable,
} from "~/lib/realms/nation-growth-defaults";
import type { BaseCountryData } from "~/types/ixstats";

/** Values the builder may supply; missing, empty or zero values fall back to the defaults. */
export interface BaselineCountryInitial {
  continent?: string;
  region?: string;
  baselinePopulation?: number;
  baselineGdpPerCapita?: number;
  landArea?: number;
  flag?: string;
  coatOfArms?: string;
  government?: string;
  leader?: string;
  nominalGDP?: number;
  realGDPGrowthRate?: number;
  inflationRate?: number;
  unemploymentRate?: number;
  taxRevenueGDPPercent?: number;
  literacyRate?: number;
  lifeExpectancy?: number;
}

function baselineFields(name: string, initial: BaselineCountryInitial) {
  const now = new Date(IxTime.getCurrentIxTime());
  return {
    name,
    continent: initial.continent || null,
    region: initial.region || null,
    baselinePopulation: initial.baselinePopulation || 1000000,
    baselineGdpPerCapita: initial.baselineGdpPerCapita || 50000,
    landArea: initial.landArea || 100000,
    flag: initial.flag || undefined,
    coatOfArms: initial.coatOfArms || undefined,
    governmentType: initial.government || undefined,
    leader: initial.leader || undefined,
    baselineDate: now,
    lastCalculated: now,
    localGrowthFactor: 1.0,
  };
}

function indicatorFields(initial: BaselineCountryInitial, totalGdp: number) {
  return {
    nominalGDP: initial.nominalGDP || totalGdp,
    realGDPGrowthRate: initial.realGDPGrowthRate || 3.0,
    inflationRate: initial.inflationRate || 2.0,
    unemploymentRate: initial.unemploymentRate || 5.0,
    taxRevenueGDPPercent: initial.taxRevenueGDPPercent || 20.0,
    literacyRate: initial.literacyRate || 95.0,
    lifeExpectancy: initial.lifeExpectancy || 75.0,
  };
}

/**
 * A new country's create data: defaults, growth from `growth` for its tier (the cap from the IxStats tier rule),
 * then the calculator's current stats and tiers at the present IxTime.
 */
export function buildBaselineCountryData(
  name: string,
  initial: BaselineCountryInitial = {},
  growth: NationGrowthTable = IXSTATS_NATION_GROWTH_DEFAULTS
) {
  const base = baselineFields(name, initial);
  const { populationGrowthRate, adjustedGdpGrowth, maxGdpGrowthRate } = nationGrowthFor(
    base.baselineGdpPerCapita,
    growth
  );
  const calculator = new IxStatsCalculator(getDefaultEconomicConfig(), base.baselineDate.getTime());
  const seed: BaseCountryData = {
    country: base.name,
    continent: base.continent,
    region: base.region,
    population: base.baselinePopulation,
    gdpPerCapita: base.baselineGdpPerCapita,
    landArea: base.landArea,
    maxGdpGrowthRate,
    adjustedGdpGrowth,
    populationGrowthRate,
    actualGdpGrowth: 0.03,
    projected2040Population: base.baselinePopulation * 1.2,
    projected2040Gdp: base.baselinePopulation * base.baselineGdpPerCapita * 1.5,
    projected2040GdpPerCapita: base.baselineGdpPerCapita * 1.25,
    localGrowthFactor: 1.0,
  };
  const { newStats } = calculator.calculateTimeProgression(calculator.initializeCountryStats(seed));
  return {
    ...base,
    currentPopulation: newStats.currentPopulation,
    currentGdpPerCapita: newStats.currentGdpPerCapita,
    currentTotalGdp: newStats.currentTotalGdp,
    economicTier: newStats.economicTier,
    populationTier: newStats.populationTier,
    populationGrowthRate: newStats.populationGrowthRate,
    adjustedGdpGrowth: newStats.adjustedGdpGrowth,
    maxGdpGrowthRate: newStats.maxGdpGrowthRate,
    populationDensity: newStats.populationDensity,
    gdpDensity: newStats.gdpDensity,
    ...indicatorFields(initial, base.baselinePopulation * base.baselineGdpPerCapita),
  };
}
