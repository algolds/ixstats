/**
 * Typed access to the economy relation rows that `countries.getByIdWithEconomicData` includes
 * (the query behind MyCountry's `useCountryData`). That query builds its `include` dynamically,
 * so the relations aren't in its inferred type; these readers give them a shape and keep every
 * missing value `null` so the UI can show "—" instead of a stand-in number.
 */

interface EconomicProfileRow {
  economicComplexity?: number | null;
  sectorBreakdown?: string | null;
  exportsGDPPercent?: number | null;
  importsGDPPercent?: number | null;
}

interface LaborMarketRow {
  youthUnemploymentRate?: number | null;
  femaleParticipationRate?: number | null;
  informalEmploymentRate?: number | null;
  medianWage?: number | null;
}

interface FiscalSystemRow {
  corporateTaxRates?: string | null;
  personalIncomeTaxRates?: string | null;
  salesTaxRate?: number | null;
  wealthTaxRate?: number | null;
  exciseTaxRates?: string | null;
  taxEfficiency?: number | null;
}

interface IncomeDistributionRow {
  /** JSON list of `{ name, populationPercent, wealthPercent }`: the only column founding writes. */
  economicClasses?: string | null;
  intergenerationalMobility?: number | null;
}

export interface CountryEconomicRelations {
  economicProfile: EconomicProfileRow | null;
  laborMarket: LaborMarketRow | null;
  fiscalSystem: FiscalSystemRow | null;
  incomeDistribution: IncomeDistributionRow | null;
}

function row<T>(value: unknown): T | null {
  return value && typeof value === "object" ? (value as T) : null;
}

export function economicRelationsOf(country: unknown): CountryEconomicRelations {
  const c = row<Record<string, unknown>>(country);
  return {
    economicProfile: row<EconomicProfileRow>(c?.economicProfile),
    laborMarket: row<LaborMarketRow>(c?.laborMarket),
    fiscalSystem: row<FiscalSystemRow>(c?.fiscalSystem),
    incomeDistribution: row<IncomeDistributionRow>(c?.incomeDistribution),
  };
}

/**
 * The scalar figures the Economy tabs read off the country record. The procedure returns `any`,
 * so reading through this type makes a misspelt field fail the typecheck instead of rendering "—".
 */
export interface CountryEconomyFigures {
  currentTotalGdp: number | null;
  /** The engine's annual GDP per capita growth, as a decimal (`calculatedStats.gdpGrowth`). */
  gdpGrowth: number | null;
  /** Undefined on the record when never recorded (the engine's stand-in is not shown). */
  unemploymentRate: number | null;
  incomeInequalityGini: number | null;
  /** 0-100. */
  socialMobilityIndex: number | null;
  /** The founding revenue: shown only while no tax rate is saved (`nationalRevenue`). */
  governmentRevenueTotal: number | null;
}

export function economyFiguresOf(country: unknown): CountryEconomyFigures {
  const c = row<Record<string, unknown>>(country);
  const stats = row<Record<string, unknown>>(c?.calculatedStats);
  return {
    currentTotalGdp: finiteOrNull(c?.currentTotalGdp),
    gdpGrowth: finiteOrNull(stats?.gdpGrowth),
    unemploymentRate: finiteOrNull(c?.unemploymentRate),
    incomeInequalityGini: finiteOrNull(c?.incomeInequalityGini),
    socialMobilityIndex: finiteOrNull(c?.socialMobilityIndex),
    governmentRevenueTotal: finiteOrNull(c?.governmentRevenueTotal),
  };
}

/** A finite number, or null. Use for nullable DB columns so 0 stays a real value. */
export function finiteOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/**
 * The overall tariff rate saved by the Fiscal Policy tab. It lives in `FiscalSystem.exciseTaxRates`,
 * as `{"tariffRate": n, ...}` or — when the builder stored an excise list — as a
 * `{"type": "tariff", "rate": n}` entry in that array. Null when none is saved.
 */
export function savedTariffRate(exciseTaxRates: string | null | undefined): number | null {
  if (!exciseTaxRates) return null;
  try {
    const parsed: unknown = JSON.parse(exciseTaxRates);
    if (Array.isArray(parsed)) {
      const entry = parsed.find(
        (e) => e && typeof e === "object" && (e as Record<string, unknown>).type === "tariff"
      ) as Record<string, unknown> | undefined;
      return finiteOrNull(entry?.rate);
    }
    if (parsed && typeof parsed === "object") {
      return finiteOrNull((parsed as Record<string, unknown>).tariffRate);
    }
  } catch {
    // not JSON
  }
  return null;
}
