/**
 * Founding snapshot: everything a new nation is founded with, computed without a database.
 *
 * `createCountry` writes what this returns and `countries.previewFounding` shows its summary, so
 * the live nation card can never drift from the founded nation (redesign spec §2, §3).
 *
 * Two regimes:
 * - Generated (the casual builder sends none of `taxSystemData`, `governmentStructure`,
 *   `economyBuilderState`): every default is derived from the archetype and the size and wealth
 *   bands, and the starting budget balances against the starting tax revenue.
 * - Explicit (a caller sends any of those payloads, as the builder does today): the country's
 *   number fallbacks stay the historical constants and the payloads are kept as sent, except
 *   that derived fields (economic tier, average income) follow GDP per capita and any piece the
 *   caller left out is generated.
 *
 * Exact economic inputs always win over generated values.
 */

import type { Country, EconomicArchetype } from "@prisma/client";
import type { z } from "zod";
import {
  governmentEffectiveness,
  NEW_COMPONENT_EFFECTIVENESS,
  type ScoredComponent,
} from "~/lib/government/effectiveness";
import { getGovernmentForm, type GovernmentInstitutions } from "~/lib/government/forms";
import { getArchetypeDisplay } from "~/lib/economy/archetypes/display";
import { currentBudgetYear } from "~/lib/government/budget-year";
import {
  DEFAULT_FORM_ID,
  departmentsForForm,
  governmentTypeForForm,
} from "~/lib/government/form-departments";
import {
  bandForGdpPerCapita,
  figureForPopulationBand,
  figureForWealthBand,
  type PopulationBandId,
  type WealthBandId,
} from "~/lib/builder/founding-bands";
import { calculateStabilityMetrics } from "~/lib/statecraft/stability-formulas";
import { getDefaultEconomicConfig } from "~/lib/config-service";
import { IxTime } from "~/lib/ixtime";
import { getEconomicTierFromGdpPerCapita, getPopulationTierFromPopulation } from "~/lib/tier-utils";
import { projectCountryStats } from "~/server/shared/country-helpers";
import type {
  countryEconomicInputsSchema,
  countryEconomyBuilderStateSchema,
  countryGovernmentComponentSchema,
  countryGovernmentStructureInputSchema,
  countryTaxSystemInputSchema,
} from "~/server/shared/country-payload-builder";

export type EconInputs = NonNullable<z.infer<typeof countryEconomicInputsSchema>>;
export type TaxInput = z.infer<typeof countryTaxSystemInputSchema>;
export type GovernmentStructureInput = z.infer<typeof countryGovernmentStructureInputSchema>;
export type GovernmentComponentInput = z.infer<typeof countryGovernmentComponentSchema>;
export type EconomyBuilderInput = z.infer<typeof countryEconomyBuilderStateSchema>;

export type NumberKey = {
  [K in keyof Country]: Country[K] extends number | null ? K : never;
}[keyof Country];

/** A percent input as a fraction; absent stays absent. */
const pct = (value: number | undefined) => (value === undefined ? undefined : value / 100);
/** `Country.maxGdpGrowthRate` for a new nation. */
export const FOUNDING_MAX_GDP_GROWTH = 0.15;

const round2 = (value: number) => Math.round(value * 100) / 100;
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

// ---------------------------------------------------------------------------------------------
// Input and output

/** The foundation (Ixnay benchmark nation) columns a founding reads. */
export type FoundingFoundation = Pick<
  Country,
  "baselinePopulation" | "baselineGdpPerCapita" | "landArea"
>;

export interface FoundingSnapshotInput {
  name: string;
  archetype: EconomicArchetype | null;
  foundation: FoundingFoundation | null;
  /** Exact economic inputs from the builder; any figure here wins over a band or default. */
  econ?: EconInputs;
  populationBand?: PopulationBandId;
  wealthBand?: WealthBandId;
  governmentFormId?: string | null;
  /** Institution names the player renamed; any left out take the form's names. */
  institutionNames?: Partial<GovernmentInstitutions> | null;
  governmentComponents?: GovernmentComponentInput[];
  taxSystemData?: TaxInput | null;
  governmentStructure?: GovernmentStructureInput | null;
  economyBuilderState?: EconomyBuilderInput | null;
  /** Budget year for the starting allocations; defaults to the current IxTime year. */
  budgetYear?: number;
}

export interface Baseline {
  population: number;
  gdpPerCapita: number;
  nominalGDP: number;
}

export type BudgetBalanceLabel = "Balanced" | "Small deficit" | "Large deficit" | "Surplus";

/** The figures the live nation card shows (spec §2). Percentages are 0 to 100. */
export interface FoundingSummary {
  gdp: number;
  gdpPerCapita: number;
  population: number;
  /** (revenue - spending) / GDP × 100; negative is a deficit. */
  budgetBalancePercentOfGdp: number;
  budgetBalanceLabel: BudgetBalanceLabel;
  /** Internal stability score, 0 to 100. */
  stability: number;
  /** Government effectiveness, 0 to 100. */
  governmentEffectiveness: number;
  /** Expected total GDP growth over the first year, in percent. */
  expectedGrowth: number;
}

export interface FoundingSnapshot {
  base: Baseline;
  /** The numeric Country columns. */
  numbers: Record<NumberKey, number>;
  economicTier: string;
  populationTier: string;
  totalWorkforce: number;
  /** The government form the structure was generated for (given or inferred). */
  governmentFormId: string;
  taxSystemData: TaxInput;
  governmentStructure: GovernmentStructureInput;
  governmentComponents: GovernmentComponentInput[];
  economyBuilderState: EconomyBuilderInput;
  summary: FoundingSummary;
}

// ---------------------------------------------------------------------------------------------
// Archetype parsing

export interface TaxProfile {
  incomeRate: number;
  corporateRate: number;
  consumptionRate: number;
  /** Share of statutory revenue actually collected, 0 to 1. */
  revenueEfficiency: number;
}

/** The "Balanced mixed economy" profile: blank and imported nations use it (spec §3). */
export const DEFAULT_TAX_PROFILE: TaxProfile = {
  incomeRate: 30,
  corporateRate: 22,
  consumptionRate: 12,
  revenueEfficiency: 0.8,
};

function parseJson<T>(raw: string | null | undefined): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

const finiteOr = (value: unknown, fallback: number) =>
  typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : fallback;

export function archetypeTaxProfile(archetype: EconomicArchetype | null): TaxProfile {
  const raw = parseJson<Partial<TaxProfile>>(archetype?.taxProfile);
  if (!raw) return DEFAULT_TAX_PROFILE;
  const profile = {
    incomeRate: finiteOr(raw.incomeRate, DEFAULT_TAX_PROFILE.incomeRate),
    corporateRate: finiteOr(raw.corporateRate, DEFAULT_TAX_PROFILE.corporateRate),
    consumptionRate: finiteOr(raw.consumptionRate, DEFAULT_TAX_PROFILE.consumptionRate),
    revenueEfficiency: clamp(
      finiteOr(raw.revenueEfficiency, DEFAULT_TAX_PROFILE.revenueEfficiency),
      0.3,
      1
    ),
  };
  return modelledRevenuePercent(profile) > 0 ? profile : DEFAULT_TAX_PROFILE;
}

function archetypeStrings(raw: string | null | undefined): string[] {
  const parsed = parseJson<unknown>(raw);
  return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [];
}

function archetypeRecord<T extends object>(raw: string | null | undefined): Partial<T> {
  const parsed = parseJson<unknown>(raw);
  return parsed && typeof parsed === "object" && !Array.isArray(parsed)
    ? (parsed as Partial<T>)
    : {};
}

// ---------------------------------------------------------------------------------------------
// Tax revenue model

/**
 * Share of GDP each tax falls on. A deliberately simple model: income tax on the wage share of
 * GDP, corporate tax on profits, consumption tax on household spending.
 */
export const TAX_BASE_SHARE_OF_GDP = { income: 0.45, corporate: 0.1, consumption: 0.55 } as const;

/** Generated starting revenue stays in this band (percent of GDP). */
export const REVENUE_TARGET_RANGE = { min: 10, max: 45 } as const;

const MAX_TAX_RATE = 100;

/** Tax revenue a profile raises, in percent of GDP. */
export function modelledRevenuePercent(profile: TaxProfile): number {
  return (
    profile.revenueEfficiency *
    (profile.incomeRate * TAX_BASE_SHARE_OF_GDP.income +
      profile.corporateRate * TAX_BASE_SHARE_OF_GDP.corporate +
      profile.consumptionRate * TAX_BASE_SHARE_OF_GDP.consumption)
  );
}

/**
 * Tax revenue of a tax system payload in percent of GDP, by the same model: the income,
 * corporate and consumption categories' base rates times `collectionEfficiency` (percent).
 */
export function estimateTaxRevenuePercent(taxSystem: TaxInput): number {
  const categories = Array.isArray(taxSystem.categories) ? taxSystem.categories : [];
  const rateOf = (type: string) =>
    categories.reduce<number>((sum, cat) => {
      if (!cat || typeof cat !== "object" || Array.isArray(cat)) return sum;
      const record = cat as Record<string, unknown>;
      if (record.categoryType !== type || record.isActive === false) return sum;
      return sum + (typeof record.baseRate === "number" ? record.baseRate : 0);
    }, 0);
  return modelledRevenuePercent({
    incomeRate: rateOf("income"),
    corporateRate: rateOf("corporate"),
    consumptionRate: rateOf("consumption"),
    revenueEfficiency:
      (taxSystem.collectionEfficiency ?? DEFAULT_TAX_PROFILE.revenueEfficiency * 100) / 100,
  });
}

/** The profile with its rates scaled so it raises `targetPercent` of GDP (rates capped at 100). */
function scaleTaxProfile(profile: TaxProfile, targetPercent: number): TaxProfile {
  const factor = targetPercent / modelledRevenuePercent(profile);
  const scale = (rate: number) => round2(Math.min(MAX_TAX_RATE, rate * factor));
  return {
    incomeRate: scale(profile.incomeRate),
    corporateRate: scale(profile.corporateRate),
    consumptionRate: scale(profile.consumptionRate),
    revenueEfficiency: profile.revenueEfficiency,
  };
}

function buildTaxSystem(name: string, profile: TaxProfile, taxAuthority: string): TaxInput {
  const category = (categoryName: string, categoryType: string, baseRate: number) => ({
    categoryName,
    categoryType,
    baseRate,
    isActive: true,
  });
  return {
    taxSystemName: `${name} Tax System`,
    taxAuthority,
    progressiveTax: true,
    baseRate: profile.incomeRate,
    collectionEfficiency: round2(profile.revenueEfficiency * 100),
    categories: [
      {
        ...category("Income Tax", "income", profile.incomeRate),
        brackets: [
          {
            bracketName: "Base Bracket",
            minIncome: 0,
            maxIncome: null,
            rate: profile.incomeRate,
            isActive: true,
          },
        ],
      },
      category("Corporate Tax", "corporate", profile.corporateRate),
      category("Consumption Tax", "consumption", profile.consumptionRate),
    ],
  };
}

// ---------------------------------------------------------------------------------------------
// Wealth-band defaults

interface WealthDefaults {
  populationGrowthPercent: number;
  lifeExpectancy: number;
  literacyRate: number;
  urbanPercent: number;
  povertyRate: number;
  gini: number;
  ageDistribution: { under15: number; age15to64: number; over65: number };
  educationLevels: { noEducation: number; primary: number; secondary: number; tertiary: number };
  employmentType: {
    fullTime: number;
    partTime: number;
    temporary: number;
    seasonal: number;
    selfEmployed: number;
    gig: number;
    informal: number;
  };
  birthRate: number;
  deathRate: number;
  medianAge: number;
  infantMortalityRate: number;
  maternalMortalityRate: number;
  healthExpenditureGDP: number;
  paidVacationDays: number;
  workplaceSafetyIndex: number;
  laborRightsScore: number;
  technologyLevel: "Traditional" | "Modern" | "Advanced" | "Cutting-Edge";
}

const WEALTH_DEFAULTS: Record<WealthBandId, WealthDefaults> = {
  developing: {
    populationGrowthPercent: 2.2,
    lifeExpectancy: 66,
    literacyRate: 70,
    urbanPercent: 40,
    povertyRate: 35,
    gini: 0.42,
    ageDistribution: { under15: 38, age15to64: 58, over65: 4 },
    educationLevels: { noEducation: 20, primary: 45, secondary: 28, tertiary: 7 },
    employmentType: {
      fullTime: 45,
      partTime: 8,
      temporary: 6,
      seasonal: 8,
      selfEmployed: 10,
      gig: 3,
      informal: 20,
    },
    birthRate: 30,
    deathRate: 8,
    medianAge: 20,
    infantMortalityRate: 40,
    maternalMortalityRate: 300,
    healthExpenditureGDP: 4,
    paidVacationDays: 10,
    workplaceSafetyIndex: 45,
    laborRightsScore: 45,
    technologyLevel: "Traditional",
  },
  emerging: {
    populationGrowthPercent: 1.2,
    lifeExpectancy: 73,
    literacyRate: 90,
    urbanPercent: 58,
    povertyRate: 18,
    gini: 0.38,
    ageDistribution: { under15: 26, age15to64: 66, over65: 8 },
    educationLevels: { noEducation: 6, primary: 30, secondary: 46, tertiary: 18 },
    employmentType: {
      fullTime: 60,
      partTime: 10,
      temporary: 6,
      seasonal: 4,
      selfEmployed: 9,
      gig: 3,
      informal: 8,
    },
    birthRate: 18,
    deathRate: 7,
    medianAge: 30,
    infantMortalityRate: 15,
    maternalMortalityRate: 60,
    healthExpenditureGDP: 6,
    paidVacationDays: 15,
    workplaceSafetyIndex: 60,
    laborRightsScore: 60,
    technologyLevel: "Modern",
  },
  wealthy: {
    populationGrowthPercent: 0.5,
    lifeExpectancy: 80,
    literacyRate: 98,
    urbanPercent: 75,
    povertyRate: 10,
    gini: 0.32,
    ageDistribution: { under15: 16, age15to64: 65, over65: 19 },
    educationLevels: { noEducation: 1, primary: 14, secondary: 50, tertiary: 35 },
    employmentType: {
      fullTime: 70,
      partTime: 14,
      temporary: 5,
      seasonal: 1,
      selfEmployed: 7,
      gig: 2,
      informal: 1,
    },
    birthRate: 10,
    deathRate: 9,
    medianAge: 41,
    infantMortalityRate: 4,
    maternalMortalityRate: 10,
    healthExpenditureGDP: 9,
    paidVacationDays: 20,
    workplaceSafetyIndex: 78,
    laborRightsScore: 75,
    technologyLevel: "Advanced",
  },
  "very-wealthy": {
    populationGrowthPercent: 0.4,
    lifeExpectancy: 82.5,
    literacyRate: 99,
    urbanPercent: 82,
    povertyRate: 7,
    gini: 0.3,
    ageDistribution: { under15: 16, age15to64: 64, over65: 20 },
    educationLevels: { noEducation: 1, primary: 10, secondary: 45, tertiary: 44 },
    employmentType: {
      fullTime: 72,
      partTime: 15,
      temporary: 4,
      seasonal: 1,
      selfEmployed: 6,
      gig: 1,
      informal: 1,
    },
    birthRate: 10,
    deathRate: 8,
    medianAge: 42,
    infantMortalityRate: 3,
    maternalMortalityRate: 6,
    healthExpenditureGDP: 11,
    paidVacationDays: 25,
    workplaceSafetyIndex: 85,
    laborRightsScore: 82,
    technologyLevel: "Cutting-Edge",
  },
};

/** The economy builder's four-step tier (`EconomyStructure.economicTier`) for a GDP per capita. */
export function economyBuilderTier(
  gdpPerCapita: number
): "Developing" | "Emerging" | "Developed" | "Advanced" {
  if (gdpPerCapita > 50000) return "Advanced";
  if (gdpPerCapita > 20000) return "Developed";
  if (gdpPerCapita > 5000) return "Emerging";
  return "Developing";
}

/** Average annual income for a GDP per capita (the rule `createCountry` has always used). */
export const averageIncomeFor = (gdpPerCapita: number) => gdpPerCapita * 0.8;

// ---------------------------------------------------------------------------------------------
// Country numbers

type Getter = (e: EconInputs, taxRate: number | undefined) => number | undefined;

/** Numeric columns where a missing or zero input falls back to a default. */
const ZERO_FALLBACK_FIELDS: ReadonlyArray<readonly [NumberKey, Getter]> = [
  ["currencyExchangeRate", (e) => e.coreIndicators?.currencyExchangeRate],
  ["laborForceParticipationRate", (e) => e.laborEmployment?.laborForceParticipationRate],
  ["employmentRate", (e) => e.laborEmployment?.employmentRate],
  ["unemploymentRate", (e) => e.laborEmployment?.unemploymentRate],
  ["averageWorkweekHours", (e) => e.laborEmployment?.averageWorkweekHours],
  ["minimumWage", (e) => e.laborEmployment?.minimumWage],
  ["averageAnnualIncome", (e) => e.laborEmployment?.averageAnnualIncome],
  ["taxRevenueGDPPercent", (e, taxRate) => e.fiscalSystem?.taxRevenueGDPPercent || taxRate],
  ["governmentRevenueTotal", (e) => e.fiscalSystem?.governmentRevenueTotal],
  ["taxRevenuePerCapita", (e) => e.fiscalSystem?.taxRevenuePerCapita],
  ["governmentBudgetGDPPercent", (e) => e.fiscalSystem?.governmentBudgetGDPPercent],
  ["budgetDeficitSurplus", (e) => e.fiscalSystem?.budgetDeficitSurplus],
  ["internalDebtGDPPercent", (e) => e.fiscalSystem?.internalDebtGDPPercent],
  ["externalDebtGDPPercent", (e) => e.fiscalSystem?.externalDebtGDPPercent],
  ["totalDebtGDPRatio", (e) => e.fiscalSystem?.totalDebtGDPRatio],
  ["debtPerCapita", (e) => e.fiscalSystem?.debtPerCapita],
  ["interestRates", (e) => e.fiscalSystem?.interestRates],
  ["debtServiceCosts", (e) => e.fiscalSystem?.debtServiceCosts],
  ["povertyRate", (e) => e.incomeWealth?.povertyRate],
  [
    "incomeInequalityGini",
    (e) =>
      e.incomeWealth?.incomeInequalityGini ||
      (e.incomeWealth?.giniIndex ? e.incomeWealth.giniIndex / 100 : undefined),
  ],
  ["socialMobilityIndex", (e) => e.incomeWealth?.socialMobilityIndex],
  ["totalGovernmentSpending", (e) => e.governmentSpending?.totalSpending],
  ["spendingGDPPercent", (e) => e.governmentSpending?.spendingGDPPercent],
  ["spendingPerCapita", (e) => e.governmentSpending?.spendingPerCapita],
  ["lifeExpectancy", (e) => e.demographics?.lifeExpectancy],
  ["urbanPopulationPercent", (e) => e.demographics?.urbanRuralSplit?.urban],
  ["ruralPopulationPercent", (e) => e.demographics?.urbanRuralSplit?.rural],
  ["literacyRate", (e) => e.demographics?.literacyRate],
];

/** Growth and inflation inputs arrive as percents; only an absent value (not 0) takes the default. */
const RATE_FIELDS: ReadonlyArray<readonly [NumberKey, Getter]> = [
  ["adjustedGdpGrowth", (e) => pct(e.coreIndicators?.realGDPGrowthRate)],
  ["actualGdpGrowth", (e) => pct(e.coreIndicators?.realGDPGrowthRate)],
  ["realGDPGrowthRate", (e) => pct(e.coreIndicators?.realGDPGrowthRate)],
  ["populationGrowthRate", (e) => pct(e.demographics?.populationGrowthRate)],
  ["inflationRate", (e) => pct(e.coreIndicators?.inflationRate)],
];

type Defaults = Record<NumberKey, number>;

/** The historical fallbacks, kept for callers that send explicit sub-system payloads. */
function legacyDefaults(base: Baseline): Partial<Defaults> {
  const gdp = base.nominalGDP;
  return {
    currencyExchangeRate: 1,
    laborForceParticipationRate: 65,
    employmentRate: 95,
    unemploymentRate: 5,
    averageWorkweekHours: 40,
    minimumWage: 15,
    averageAnnualIncome: averageIncomeFor(base.gdpPerCapita),
    taxRevenueGDPPercent: 25,
    governmentRevenueTotal: gdp * 0.25,
    taxRevenuePerCapita: (gdp * 0.25) / base.population,
    governmentBudgetGDPPercent: 25,
    budgetDeficitSurplus: 0,
    internalDebtGDPPercent: 30,
    externalDebtGDPPercent: 20,
    totalDebtGDPRatio: 50,
    debtPerCapita: (gdp * 0.5) / base.population,
    interestRates: 3.5,
    debtServiceCosts: gdp * 0.02,
    povertyRate: 12,
    incomeInequalityGini: 0.35,
    socialMobilityIndex: 65,
    totalGovernmentSpending: gdp * 0.22,
    spendingGDPPercent: 22,
    spendingPerCapita: (gdp * 0.22) / base.population,
    lifeExpectancy: 78.5,
    urbanPopulationPercent: 65,
    ruralPopulationPercent: 35,
    literacyRate: 95,
    adjustedGdpGrowth: 0.025,
    actualGdpGrowth: 0.025,
    realGDPGrowthRate: 0.025,
    populationGrowthRate: 0.008,
    inflationRate: 0.02,
  };
}

/**
 * Defaults derived from the archetype and wealth band, with revenue and spending both at
 * `revenuePercent` of GDP so the budget balances.
 */
function generatedDefaults(
  base: Baseline,
  archetype: EconomicArchetype | null,
  wealth: WealthDefaults,
  revenuePercent: number
): Partial<Defaults> {
  const gdp = base.nominalGDP;
  const employment = archetypeRecord<{ unemploymentRate: number; laborParticipation: number }>(
    archetype?.employmentProfile
  );
  const growth = archetypeRecord<{ gdpGrowth: number }>(archetype?.growthMetrics);
  const unemployment = clamp(finiteOr(employment.unemploymentRate, 5), 0.1, 40);
  const gdpGrowth = pct(clamp(finiteOr(growth.gdpGrowth, 2.5), 0, 10))!;
  const revenue = (gdp * revenuePercent) / 100;
  const income = averageIncomeFor(base.gdpPerCapita);
  return {
    ...legacyDefaults(base),
    laborForceParticipationRate: clamp(finiteOr(employment.laborParticipation, 65), 30, 90),
    employmentRate: round2(100 - unemployment),
    unemploymentRate: unemployment,
    minimumWage: Math.max(0.5, round2((income * 0.4) / 2000)),
    taxRevenueGDPPercent: revenuePercent,
    governmentRevenueTotal: revenue,
    taxRevenuePerCapita: revenue / base.population,
    governmentBudgetGDPPercent: revenuePercent,
    budgetDeficitSurplus: 0,
    totalGovernmentSpending: revenue,
    spendingGDPPercent: revenuePercent,
    spendingPerCapita: revenue / base.population,
    povertyRate: wealth.povertyRate,
    incomeInequalityGini: wealth.gini,
    lifeExpectancy: wealth.lifeExpectancy,
    urbanPopulationPercent: wealth.urbanPercent,
    ruralPopulationPercent: 100 - wealth.urbanPercent,
    literacyRate: wealth.literacyRate,
    adjustedGdpGrowth: gdpGrowth,
    actualGdpGrowth: gdpGrowth,
    realGDPGrowthRate: gdpGrowth,
    populationGrowthRate: pct(wealth.populationGrowthPercent)!,
  };
}

function buildCountryNumbers(
  econ: EconInputs,
  taxRate: number | undefined,
  defaults: Partial<Defaults>
): Record<NumberKey, number> {
  return Object.fromEntries([
    ...ZERO_FALLBACK_FIELDS.map(([key, get]) => [key, get(econ, taxRate) || defaults[key]]),
    ...RATE_FIELDS.map(([key, get]) => [key, get(econ, taxRate) ?? defaults[key]]),
  ]) as Record<NumberKey, number>;
}

// ---------------------------------------------------------------------------------------------
// Distributions

/** Scales values to sum to 100, rounded to 2 decimals; the rounding remainder goes to the largest. */
export function normaliseTo100(values: number[]): number[] {
  const clean = values.map((v) => (Number.isFinite(v) && v > 0 ? v : 0));
  const total = clean.reduce((sum, v) => sum + v, 0);
  if (total <= 0) return values.map((_, i) => (i === 0 ? 100 : 0));
  const scaled = clean.map((v) => round2((v / total) * 100));
  const remainder = round2(100 - scaled.reduce((sum, v) => sum + v, 0));
  const largest = scaled.indexOf(Math.max(...scaled));
  scaled[largest] = round2(scaled[largest]! + remainder);
  return scaled;
}

function normaliseRecord<K extends string>(record: Record<K, number>): Record<K, number> {
  const keys = Object.keys(record) as K[];
  const values = normaliseTo100(keys.map((k) => record[k]));
  return Object.fromEntries(keys.map((k, i) => [k, values[i]])) as Record<K, number>;
}

// ---------------------------------------------------------------------------------------------
// Sectors

type SectorCategory = "Primary" | "Secondary" | "Tertiary";

interface SectorProfile {
  name: string;
  category: SectorCategory;
  /** Output per worker relative to the economy's average. */
  productivity: number;
  growthRate: number;
  exports: number;
  imports: number;
  /** Where its workers sit in `LaborConfiguration.sectorDistribution`, as weights. */
  labor: Partial<Record<LaborSectorKey, number>>;
}

const LABOR_SECTOR_KEYS = [
  "agriculture",
  "mining",
  "manufacturing",
  "construction",
  "utilities",
  "wholesale",
  "retail",
  "transportation",
  "information",
  "finance",
  "professional",
  "education",
  "healthcare",
  "hospitality",
  "government",
  "other",
] as const;
type LaborSectorKey = (typeof LABOR_SECTOR_KEYS)[number];

const SECTOR_PROFILES: Record<string, SectorProfile> = {
  agriculture: {
    name: "Agriculture",
    category: "Primary",
    productivity: 0.5,
    growthRate: 1.5,
    exports: 25,
    imports: 15,
    labor: { agriculture: 1 },
  },
  mining: {
    name: "Mining",
    category: "Primary",
    productivity: 1.6,
    growthRate: 2,
    exports: 60,
    imports: 10,
    labor: { mining: 1 },
  },
  energy: {
    name: "Energy",
    category: "Secondary",
    productivity: 1.6,
    growthRate: 2.5,
    exports: 20,
    imports: 20,
    labor: { utilities: 1 },
  },
  manufacturing: {
    name: "Manufacturing",
    category: "Secondary",
    productivity: 1.2,
    growthRate: 2.5,
    exports: 40,
    imports: 30,
    labor: { manufacturing: 1 },
  },
  pharmaceuticals: {
    name: "Pharmaceuticals",
    category: "Secondary",
    productivity: 1.8,
    growthRate: 4,
    exports: 55,
    imports: 25,
    labor: { manufacturing: 0.7, professional: 0.3 },
  },
  construction: {
    name: "Construction",
    category: "Secondary",
    productivity: 0.9,
    growthRate: 2.5,
    exports: 2,
    imports: 5,
    labor: { construction: 1 },
  },
  trade: {
    name: "Trade",
    category: "Tertiary",
    productivity: 1,
    growthRate: 2.5,
    exports: 15,
    imports: 20,
    labor: { wholesale: 0.4, retail: 0.6 },
  },
  transportation: {
    name: "Transportation",
    category: "Tertiary",
    productivity: 1,
    growthRate: 2.5,
    exports: 15,
    imports: 10,
    labor: { transportation: 1 },
  },
  technology: {
    name: "Technology",
    category: "Tertiary",
    productivity: 1.7,
    growthRate: 5,
    exports: 30,
    imports: 20,
    labor: { information: 0.7, professional: 0.3 },
  },
  finance: {
    name: "Finance",
    category: "Tertiary",
    productivity: 1.8,
    growthRate: 3,
    exports: 20,
    imports: 10,
    labor: { finance: 1 },
  },
  services: {
    name: "Services",
    category: "Tertiary",
    productivity: 0.9,
    growthRate: 2.5,
    exports: 10,
    imports: 8,
    labor: { retail: 0.2, hospitality: 0.2, healthcare: 0.25, education: 0.15, professional: 0.2 },
  },
  government: {
    name: "Government",
    category: "Tertiary",
    productivity: 0.9,
    growthRate: 1.5,
    exports: 0,
    imports: 2,
    labor: { government: 0.6, education: 0.2, healthcare: 0.2 },
  },
};

/** The sector mix a nation without an archetype (or with an empty `sectorFocus`) starts with. */
export const DEFAULT_SECTOR_FOCUS: Record<string, number> = {
  agriculture: 6,
  mining: 4,
  manufacturing: 18,
  trade: 14,
  services: 28,
  finance: 12,
  government: 18,
};

function sectorProfile(key: string): SectorProfile {
  const known = SECTOR_PROFILES[key.toLowerCase()];
  if (known) return known;
  const name = key.charAt(0).toUpperCase() + key.slice(1).replace(/[_-]+/g, " ");
  return {
    name,
    category: "Tertiary",
    productivity: 1,
    growthRate: 2.5,
    exports: 10,
    imports: 10,
    labor: { other: 1 },
  };
}

function sectorFocusOf(archetype: EconomicArchetype | null): Record<string, number> {
  const focus = archetypeRecord<Record<string, number>>(archetype?.sectorFocus);
  const entries = Object.entries(focus).filter(
    ([, share]) => typeof share === "number" && Number.isFinite(share) && share > 0
  );
  return entries.length > 0
    ? (Object.fromEntries(entries) as Record<string, number>)
    : DEFAULT_SECTOR_FOCUS;
}

interface GeneratedSector {
  id: string;
  name: string;
  category: SectorCategory;
  gdpContribution: number;
  employmentShare: number;
  productivity: number;
  growthRate: number;
  exports: number;
  imports: number;
  technologyLevel: WealthDefaults["technologyLevel"];
  automation: number;
  regulation: "Light" | "Moderate" | "Heavy" | "Comprehensive";
  subsidy: number;
  innovation: number;
  sustainability: number;
  competitiveness: number;
}

function buildSectors(
  archetype: EconomicArchetype | null,
  wealth: WealthDefaults
): GeneratedSector[] {
  const focus = Object.entries(sectorFocusOf(archetype));
  const profiles = focus.map(([key]) => sectorProfile(key));
  const gdpShares = normaliseTo100(focus.map(([, share]) => share));
  const employmentShares = normaliseTo100(
    gdpShares.map((share, i) => share / profiles[i]!.productivity)
  );
  const growth = archetypeRecord<{ innovationIndex: number; competitiveness: number }>(
    archetype?.growthMetrics
  );
  const innovation = clamp(finiteOr(growth.innovationIndex, 60), 0, 100);
  const competitiveness = clamp(finiteOr(growth.competitiveness, 60), 0, 100);
  const automation = { Traditional: 10, Modern: 30, Advanced: 50, "Cutting-Edge": 65 }[
    wealth.technologyLevel
  ];
  return focus.map(([key], i) => {
    const profile = profiles[i]!;
    return {
      id: key.toLowerCase(),
      name: profile.name,
      category: profile.category,
      gdpContribution: gdpShares[i]!,
      employmentShare: employmentShares[i]!,
      productivity: round2(profile.productivity * 100),
      growthRate: profile.growthRate,
      exports: profile.exports,
      imports: profile.imports,
      technologyLevel: wealth.technologyLevel,
      automation,
      regulation: "Moderate",
      subsidy: 0,
      innovation,
      sustainability: 60,
      competitiveness,
    };
  });
}

/** Workforce per labor-sector key from the sectors' employment shares, plus construction. */
function laborSectorDistribution(sectors: GeneratedSector[]): Record<LaborSectorKey, number> {
  const weights = Object.fromEntries(LABOR_SECTOR_KEYS.map((k) => [k, 0])) as Record<
    LaborSectorKey,
    number
  >;
  for (const sector of sectors) {
    const labor = sectorProfile(sector.id).labor;
    for (const [key, weight] of Object.entries(labor) as Array<[LaborSectorKey, number]>) {
      weights[key] += sector.employmentShare * weight;
    }
  }
  // Every economy builds: when no sector covers construction, it takes a fixed 6%.
  if (weights.construction === 0) {
    const others = Object.values(weights).reduce((sum, v) => sum + v, 0);
    weights.construction = (others * 6) / 94;
  }
  return normaliseRecord(weights);
}

// ---------------------------------------------------------------------------------------------
// Government

/** A plausible government form for a component set, for foundings that name no form. */
export function inferFormId(componentTypes: readonly string[]): string {
  const has = (type: string) => componentTypes.includes(type);
  if (has("RELIGIOUS_LEGITIMACY")) return "theocracy";
  if (has("MILITARY_ADMINISTRATION") && !has("DEMOCRATIC_PROCESS")) return "military-government";
  if (has("TRADITIONAL_LEGITIMACY")) {
    return has("DEMOCRATIC_PROCESS") ? "constitutional-monarchy" : "absolute-monarchy";
  }
  if (has("PARTISAN_INSTITUTIONS") && has("AUTOCRATIC_PROCESS")) return "one-party-state";
  if (has("TECHNOCRATIC_PROCESS")) return "technocracy";
  if (has("OLIGARCHIC_PROCESS")) return "merchant-oligarchy";
  if (has("CONFEDERATE_SYSTEM")) return "confederation";
  if (has("FEDERAL_SYSTEM")) return "federal-republic";
  if (has("AUTOCRATIC_PROCESS")) return "one-party-state";
  return DEFAULT_FORM_ID;
}

/**
 * Government effectiveness of a new nation's components: `governmentEffectiveness` over the rows
 * `syncGovernmentComponents` creates for them (duplicates dropped, a missing score starts at
 * `NEW_COMPONENT_EFFECTIVENESS`), so the preview shows the number the save writes.
 */
export function foundingGovernmentEffectiveness(components: GovernmentComponentInput[]): number {
  const records: ScoredComponent[] = [];
  for (const comp of components) {
    if (records.some((r) => r.componentType === comp.componentType)) continue;
    records.push({
      componentType: comp.componentType,
      effectivenessScore: comp.effectivenessScore ?? NEW_COMPONENT_EFFECTIVENESS,
    });
  }
  return governmentEffectiveness(records);
}

/** The component set a government form starts with; empty for an unknown form id. */
function formComponentsOf(formId: string): GovernmentComponentInput[] {
  return (getGovernmentForm(formId)?.components ?? []).map((componentType) => ({
    componentType,
    effectivenessScore: 60,
    isActive: true,
  }));
}

function archetypeComponents(archetype: EconomicArchetype | null): GovernmentComponentInput[] {
  return archetypeStrings(archetype?.governmentComponents).map((componentType) => ({
    componentType,
    effectivenessScore: 60,
    isActive: true,
  }));
}

type JsonRecord = Record<string, unknown>;
const isRecord = (value: unknown): value is JsonRecord =>
  !!value && typeof value === "object" && !Array.isArray(value);

/** The structure fields `syncGovernmentStructure` reads: nested `structure` wins over flat. */
function structureFields(structure: GovernmentStructureInput): JsonRecord {
  return { ...structure, ...(isRecord(structure.structure) ? structure.structure : {}) };
}

function buildGovernmentStructure(
  name: string,
  formId: string,
  totalBudget: number,
  budgetYear: number,
  renamed?: Partial<GovernmentInstitutions> | null
): GovernmentStructureInput {
  const departments = departmentsForForm(formId);
  let allocated = 0;
  const budgetAllocations = departments.map((dept, index) => {
    const last = index === departments.length - 1;
    const allocatedAmount = last ? totalBudget - allocated : totalBudget * dept.spendingShare;
    allocated += allocatedAmount;
    return {
      departmentId: String(index),
      budgetYear,
      allocatedAmount,
      allocatedPercent: round2(dept.spendingShare * 100),
    };
  });
  const named = getGovernmentForm(formId)?.institutions;
  const institutions = named && {
    ...named,
    ...Object.fromEntries(Object.entries(renamed ?? {}).filter(([, value]) => value?.trim())),
  };
  return {
    governmentName: `Government of ${name}`,
    governmentType: governmentTypeForForm(formId) ?? "Parliamentary Republic",
    headOfState: institutions?.headOfStateTitle,
    headOfGovernment: institutions?.headOfGovernmentTitle,
    legislatureName: institutions?.legislatureName,
    executiveName: institutions?.executiveName,
    judicialName: institutions?.judicialName,
    totalBudget,
    fiscalYear: "Calendar Year",
    budgetCurrency: "USD",
    departments: departments.map((dept) => ({
      name: dept.name,
      shortName: dept.shortName,
      category: dept.category,
      ministerTitle: dept.ministerTitle,
      priority: dept.priority,
      organizationalLevel: "Ministry",
      isActive: true,
    })),
    budgetAllocations,
  };
}

// ---------------------------------------------------------------------------------------------
// Economy builder state

function buildEconomyBuilderState(args: {
  archetype: EconomicArchetype | null;
  base: Baseline;
  numbers: Record<NumberKey, number>;
  wealth: WealthDefaults;
  sectors: GeneratedSector[];
  totalWorkforce: number;
}): EconomyBuilderInput {
  const { archetype, base, numbers, wealth, sectors, totalWorkforce } = args;
  const participation = numbers.laborForceParticipationRate;
  const unemployment = numbers.unemploymentRate;
  const income = numbers.averageAnnualIncome;
  const byCategory = (category: SectorCategory) =>
    sectors.filter((s) => s.category === category).map((s) => s.name);
  const [urban, rural] = normaliseTo100([
    numbers.urbanPopulationPercent,
    numbers.ruralPopulationPercent,
  ]);
  const age = normaliseRecord(wealth.ageDistribution);
  const youthDependency = round2((age.under15 / age.age15to64) * 100);
  const elderlyDependency = round2((age.over65 / age.age15to64) * 100);

  return {
    selectedAtomicComponents: archetypeStrings(archetype?.economicComponents),
    structure: {
      economicModel: "Mixed Economy",
      primarySectors: byCategory("Primary"),
      secondarySectors: byCategory("Secondary"),
      tertiarySectors: byCategory("Tertiary"),
      totalGDP: base.nominalGDP,
      gdpCurrency: "USD",
      economicTier: economyBuilderTier(base.gdpPerCapita),
      growthStrategy: "Balanced",
    },
    sectors: sectors as unknown as EconomyBuilderInput["sectors"],
    laborMarket: {
      totalWorkforce,
      laborForceParticipationRate: participation,
      employmentRate: numbers.employmentRate,
      unemploymentRate: unemployment,
      underemploymentRate: 5,
      youthUnemploymentRate: round2(Math.min(60, unemployment * 2)),
      seniorEmploymentRate: 20,
      femaleParticipationRate: round2(Math.max(0, participation - 5)),
      maleParticipationRate: round2(Math.min(100, participation + 5)),
      sectorDistribution: laborSectorDistribution(sectors),
      employmentType: normaliseRecord(wealth.employmentType),
      averageAnnualIncome: income,
      averageWorkweekHours: numbers.averageWorkweekHours,
      averageOvertimeHours: 2,
      paidVacationDays: wealth.paidVacationDays,
      paidSickLeaveDays: 10,
      parentalLeaveWeeks: 12,
      unionizationRate: 15,
      collectiveBargainingCoverage: 20,
      minimumWageHourly: numbers.minimumWage,
      livingWageHourly: round2(Math.max(numbers.minimumWage, (income * 0.6) / 2000)),
      workplaceSafetyIndex: wealth.workplaceSafetyIndex,
      laborRightsScore: wealth.laborRightsScore,
      workerProtections: {
        jobSecurity: wealth.laborRightsScore,
        wageProtection: wealth.laborRightsScore,
        healthSafety: wealth.workplaceSafetyIndex,
        discriminationProtection: wealth.laborRightsScore,
        collectiveRights: wealth.laborRightsScore,
      },
    },
    demographics: {
      totalPopulation: base.population,
      populationGrowthRate: round2(numbers.populationGrowthRate * 100),
      ageDistribution: age,
      urbanRuralSplit: { urban: urban!, rural: rural! },
      regions: [],
      lifeExpectancy: numbers.lifeExpectancy,
      literacyRate: numbers.literacyRate,
      educationLevels: normaliseRecord(wealth.educationLevels),
      netMigrationRate: 0,
      immigrationRate: 2,
      emigrationRate: 2,
      infantMortalityRate: wealth.infantMortalityRate,
      maternalMortalityRate: wealth.maternalMortalityRate,
      healthExpenditureGDP: wealth.healthExpenditureGDP,
      youthDependencyRatio: youthDependency,
      elderlyDependencyRatio: elderlyDependency,
      totalDependencyRatio: round2(youthDependency + elderlyDependency),
      birthRate: wealth.birthRate,
      deathRate: wealth.deathRate,
      medianAge: wealth.medianAge,
    },
  };
}

/**
 * An explicit economy builder state with its derived fields brought in line with GDP per capita
 * (the builder hardcodes "Developing" and 30,000) and, when it has no sectors, the generated ones.
 */
function reconcileEconomyBuilderState(
  state: EconomyBuilderInput,
  generated: EconomyBuilderInput,
  gdpPerCapita: number,
  averageAnnualIncome: number
): EconomyBuilderInput {
  const next: EconomyBuilderInput = { ...state };
  if (isRecord(state.structure)) {
    next.structure = { ...state.structure, economicTier: economyBuilderTier(gdpPerCapita) };
  }
  if (isRecord(state.laborMarket)) {
    next.laborMarket = { ...state.laborMarket, averageAnnualIncome };
  }
  if (!Array.isArray(state.sectors) || state.sectors.length === 0) {
    next.sectors = generated.sectors;
  }
  return next;
}

// ---------------------------------------------------------------------------------------------
// Summary figures

/** Plain label for a budget balance in percent of GDP. */
export function budgetBalanceLabel(balancePercentOfGdp: number): BudgetBalanceLabel {
  if (balancePercentOfGdp > 1) return "Surplus";
  if (balancePercentOfGdp >= -1) return "Balanced";
  if (balancePercentOfGdp >= -3) return "Small deficit";
  return "Large deficit";
}

/** The Country columns the stability formula and growth projection read. */
export interface FoundedCountryFigures {
  name: string;
  baselinePopulation: number;
  baselineGdpPerCapita: number;
  currentPopulation: number;
  currentGdpPerCapita: number;
  landArea?: number | null;
  populationDensity?: number | null;
  realGDPGrowthRate: number;
  adjustedGdpGrowth: number;
  actualGdpGrowth: number;
  populationGrowthRate: number;
  maxGdpGrowthRate: number;
  unemploymentRate: number;
  incomeInequalityGini: number;
  inflationRate: number;
  povertyRate: number;
  urbanPopulationPercent: number;
  totalGovernmentSpending: number;
  taxRevenueGDPPercent: number;
}

/**
 * Stability of a just-founded nation: `calculateStabilityMetrics` with the inputs
 * `computeFormulaStability` (lib/statecraft/stability-store) assembles for a country, read from
 * the founded columns. A new nation has no economic profile, demographics diversity, political
 * metrics or recent policies yet, so those take the same fallbacks and schema defaults the
 * store would read (corruption 30, diversity 50, political stability 0.5, polarization 50,
 * democracy index 50, election cycle 4).
 */
export function foundingStability(country: FoundedCountryFigures): number {
  const population = country.currentPopulation;
  return calculateStabilityMetrics(
    {
      gdpGrowth: country.realGDPGrowthRate ?? country.adjustedGdpGrowth ?? 2.5,
      unemploymentRate: country.unemploymentRate ?? 5.0,
      giniIndex: country.incomeInequalityGini ?? 35,
      inflationRate: country.inflationRate ?? 2.0,
      gdpPerCapita: country.currentGdpPerCapita ?? 35000,
      povertyRate: country.povertyRate ?? 12,
    },
    {
      policingBudget: population * 200,
      educationBudget: population * 1500,
      socialServicesBudget: population * 800,
      totalBudget: population * 5000,
      corruptionIndex: 30,
    },
    {
      population,
      ethnicDiversity: 50,
      religiousDiversity: 50,
      urbanizationRate: country.urbanPopulationPercent ?? 75,
      youthUnemployment: (country.unemploymentRate ?? 5) * 2,
      populationDensity: country.populationDensity ?? 100,
    },
    {
      politicalStability: 0.5,
      politicalPolarization: 50,
      electionCycle: 4,
      democracyIndex: 50,
      protestFrequency: 8,
    },
    []
  ).stabilityScore;
}

/**
 * Expected total GDP growth over the first year, in percent: the projection every surface
 * shows (`projectCountryStats` with the IxStats calculator and the default economic config),
 * run one IxTime year past founding with the nation's starting components.
 */
export function foundingExpectedGrowth(
  country: FoundedCountryFigures,
  activeGovComponents: string[],
  activeEconComponents: string[]
): number {
  const baselineDate = IxTime.getInGameEpoch();
  const stats = projectCountryStats(
    { ...country, baselineDate, localGrowthFactor: 1 },
    {
      activeGovComponents,
      activeEconComponents,
      activeTaxComponents: [],
      implementingGovComponents: [],
      implementingEconComponents: [],
      implementingTaxComponents: [],
      activePolicyMaintenanceCost: 0,
    },
    getDefaultEconomicConfig(),
    IxTime.addYears(baselineDate, 1)
  );
  const start = country.baselinePopulation * country.baselineGdpPerCapita;
  return round2((stats.currentTotalGdp / start - 1) * 100);
}

// ---------------------------------------------------------------------------------------------
// Snapshot

/** Population and GDP per capita: exact figure, then band, then foundation, then default. */
export function resolveBaseline(
  econ: EconInputs,
  foundation: FoundingFoundation | null,
  populationBand?: PopulationBandId,
  wealthBand?: WealthBandId
): Baseline {
  const population =
    econ.coreIndicators?.totalPopulation ||
    (populationBand ? figureForPopulationBand(populationBand) : 0) ||
    foundation?.baselinePopulation ||
    10000000;
  const gdpPerCapita =
    econ.coreIndicators?.gdpPerCapita ||
    (wealthBand ? figureForWealthBand(wealthBand) : 0) ||
    foundation?.baselineGdpPerCapita ||
    25000;
  return {
    population,
    gdpPerCapita,
    nominalGDP: econ.coreIndicators?.nominalGDP || population * gdpPerCapita,
  };
}

export function computeFoundingSnapshot(input: FoundingSnapshotInput): FoundingSnapshot {
  const econ = input.econ ?? {};
  const { archetype, foundation } = input;
  // The archetype's typical size and wealth stand in for bands the player has not chosen.
  const display = archetype ? getArchetypeDisplay(archetype.key) : undefined;
  const base = resolveBaseline(
    econ,
    foundation,
    input.populationBand ?? (foundation ? undefined : display?.typicalPopulationBand),
    input.wealthBand ?? (foundation ? undefined : display?.typicalWealthBand)
  );
  const wealth = WEALTH_DEFAULTS[bandForGdpPerCapita(base.gdpPerCapita)];
  const explicit = !!(
    input.taxSystemData ||
    input.governmentStructure ||
    input.economyBuilderState
  );
  const taxRate = input.taxSystemData?.totalTaxRate;

  // Revenue target: an exact figure, else what the archetype's tax profile raises, kept in a
  // plausible band; the generated tax system is scaled to it and spending matches it.
  const profile = archetypeTaxProfile(archetype);
  const exactRevenue = econ.fiscalSystem?.taxRevenueGDPPercent || taxRate;
  const target =
    exactRevenue ||
    clamp(modelledRevenuePercent(profile), REVENUE_TARGET_RANGE.min, REVENUE_TARGET_RANGE.max);
  const scaledProfile = scaleTaxProfile(profile, target);
  const revenuePercent = exactRevenue || modelledRevenuePercent(scaledProfile);

  const numbers = buildCountryNumbers(
    econ,
    taxRate,
    explicit ? legacyDefaults(base) : generatedDefaults(base, archetype, wealth, revenuePercent)
  );
  const totalWorkforce =
    econ.laborEmployment?.totalWorkforce ||
    Math.round(base.population * (numbers.laborForceParticipationRate / 100));

  // Government: components as sent, else the named form's, else the archetype's; form as named,
  // else the archetype's starting form, else inferred from the components.
  const namedForm =
    input.governmentFormId ??
    (input.governmentComponents?.length ? "" : (display?.startingGovernmentForm ?? ""));
  const formComponents = formComponentsOf(namedForm);
  const governmentComponents =
    input.governmentComponents && input.governmentComponents.length > 0
      ? input.governmentComponents
      : input.governmentFormId && formComponents.length > 0
        ? formComponents
        : archetypeComponents(archetype);
  const governmentFormId = governmentTypeForForm(namedForm)
    ? namedForm
    : inferFormId(governmentComponents.map((c) => c.componentType));
  const budgetYear = input.budgetYear ?? currentBudgetYear();
  const governmentStructure = input.governmentStructure
    ? {
        ...input.governmentStructure,
        governmentType:
          input.governmentStructure.governmentType ||
          (governmentTypeForForm(namedForm) ?? undefined),
      }
    : buildGovernmentStructure(
        input.name,
        governmentFormId,
        numbers.totalGovernmentSpending,
        budgetYear,
        input.institutionNames
      );

  // Tax: as sent, else the archetype's profile scaled to the country's revenue.
  const financeDepartment = departmentsForForm(governmentFormId).find(
    (d) => d.category === "Finance"
  );
  const taxSystemData =
    input.taxSystemData ??
    buildTaxSystem(
      input.name,
      exactRevenue || explicit
        ? scaleTaxProfile(profile, numbers.taxRevenueGDPPercent)
        : scaledProfile,
      financeDepartment?.name ?? "Ministry of Finance"
    );

  const sectors = buildSectors(archetype, wealth);
  const generatedEconomy = buildEconomyBuilderState({
    archetype,
    base,
    numbers,
    wealth,
    sectors,
    totalWorkforce,
  });
  const economyBuilderState = input.economyBuilderState
    ? reconcileEconomyBuilderState(
        input.economyBuilderState,
        generatedEconomy,
        base.gdpPerCapita,
        numbers.averageAnnualIncome
      )
    : generatedEconomy;

  // Summary figures, from the same values createCountry writes.
  const landArea = foundation?.landArea ?? null;
  const figures: FoundedCountryFigures = {
    ...(numbers as unknown as FoundedCountryFigures),
    name: input.name,
    baselinePopulation: base.population,
    baselineGdpPerCapita: base.gdpPerCapita,
    currentPopulation: base.population,
    currentGdpPerCapita: base.gdpPerCapita,
    landArea,
    populationDensity: landArea ? base.population / landArea : undefined,
    maxGdpGrowthRate: FOUNDING_MAX_GDP_GROWTH,
  };
  const writtenBudget = Number(structureFields(governmentStructure).totalBudget) || 0;
  const spending = writtenBudget > 0 ? writtenBudget : numbers.totalGovernmentSpending;
  const balance = round2(((numbers.governmentRevenueTotal - spending) / base.nominalGDP) * 100);
  const econComponents = Array.isArray(economyBuilderState.selectedAtomicComponents)
    ? economyBuilderState.selectedAtomicComponents
    : [];

  return {
    base,
    numbers,
    economicTier: getEconomicTierFromGdpPerCapita(base.gdpPerCapita),
    populationTier: getPopulationTierFromPopulation(base.population),
    totalWorkforce,
    governmentFormId,
    taxSystemData,
    governmentStructure,
    governmentComponents,
    economyBuilderState,
    summary: {
      gdp: base.nominalGDP,
      gdpPerCapita: base.gdpPerCapita,
      population: base.population,
      budgetBalancePercentOfGdp: balance,
      budgetBalanceLabel: budgetBalanceLabel(balance),
      stability: foundingStability(figures),
      governmentEffectiveness: round2(foundingGovernmentEffectiveness(governmentComponents)),
      expectedGrowth: foundingExpectedGrowth(
        figures,
        governmentComponents.filter((c) => c.isActive !== false).map((c) => c.componentType),
        econComponents
      ),
    },
  };
}
