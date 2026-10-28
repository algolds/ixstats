/**
 * Inflation, unemployment and public debt for a nation that never recorded them, derived from
 * what its economy does record (owner decision 2026-10-28: blank economic figures are derived from
 * the economy, shown as estimates, and a recorded figure always wins). Computed on read, never
 * stored. Kept deliberately boring: one linear rule per figure over three gaps, each clamped.
 *
 * - income: log2 of GDP per capita relative to $30k (+1 per doubling). Tier stands in when GDP per
 *   capita is missing.
 * - growth: real GDP growth minus a 2% trend, in points.
 * - deficit: government spending minus tax revenue, in points of GDP; 0 unless both are recorded.
 */

/** What the estimate reads. Every field is optional; a missing or non-finite one is neutral. */
export interface EconomicFigureInputs {
  economicTier?: string | null;
  gdpPerCapita?: number | null;
  /** Real GDP growth, percent per year (3 = 3%). */
  realGrowthPct?: number | null;
  /** Tax revenue, percent of GDP. */
  revenueGdpPct?: number | null;
  /** Government spending, percent of GDP. */
  spendingGdpPct?: number | null;
}

/** All three in percent: inflation and unemployment per year, debt of GDP. */
export interface EconomicFigures {
  inflationRate: number;
  unemploymentRate: number;
  totalDebtGDPRatio: number;
}

export type EstimatedField = keyof EconomicFigures;

export const ESTIMATED_FIELDS: readonly EstimatedField[] = [
  "inflationRate",
  "unemploymentRate",
  "totalDebtGDPRatio",
];

export function isEstimatedField(field: string): field is EstimatedField {
  return (ESTIMATED_FIELDS as readonly string[]).includes(field);
}

/**
 * Figures whose exact 0 reads as blank (owner ruling 2026-10-28): no economy runs at 0% inflation or 0%
 * unemployment, and imports wrote 0 as a default. A 0% debt is a real (if rare) figure and stays.
 */
export const ZERO_IS_BLANK_FIELDS: readonly EstimatedField[] = [
  "inflationRate",
  "unemploymentRate",
];

/**
 * Whether a stored inflation, unemployment or debt value counts as never recorded, so the estimate stands in.
 * False for any other field.
 */
export function isBlankFigure(field: string, value: number | null | undefined): boolean {
  if (!isEstimatedField(field)) return false;
  if (!isFiniteNumber(value)) return true;
  return value === 0 && ZERO_IS_BLANK_FIELDS.includes(field);
}

const REFERENCE_GDP_PER_CAPITA = 30_000;
const TREND_GROWTH_PCT = 2;

/** Mid-band GDP per capita of each economic tier (`EconomicTier` thresholds), for a row without one. */
const TIER_GDP_PER_CAPITA: Readonly<Record<string, number>> = {
  Impoverished: 5_000,
  Developing: 17_500,
  Developed: 30_000,
  Healthy: 40_000,
  Strong: 50_000,
  "Very Strong": 60_000,
  Extravagant: 80_000,
};

function isFiniteNumber(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function positiveOrNull(value: number | null | undefined): number | null {
  return isFiniteNumber(value) && value > 0 ? value : null;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function incomeGap(inputs: EconomicFigureInputs): number {
  const gdpPerCapita =
    positiveOrNull(inputs.gdpPerCapita) ??
    TIER_GDP_PER_CAPITA[inputs.economicTier ?? ""] ??
    REFERENCE_GDP_PER_CAPITA;
  return Math.log2(clamp(gdpPerCapita, 250, 500_000) / REFERENCE_GDP_PER_CAPITA);
}

function growthGap(inputs: EconomicFigureInputs): number {
  const growth = inputs.realGrowthPct;
  return isFiniteNumber(growth) ? clamp(growth - TREND_GROWTH_PCT, -6, 6) : 0;
}

function fiscalGap(inputs: EconomicFigureInputs): number {
  const spending = positiveOrNull(inputs.spendingGdpPct);
  const revenue = positiveOrNull(inputs.revenueGdpPct);
  return spending !== null && revenue !== null ? clamp(spending - revenue, -15, 15) : 0;
}

/** Deterministic, finite and bounded for any input. */
export function estimateEconomicFigures(inputs: EconomicFigureInputs): EconomicFigures {
  const income = incomeGap(inputs);
  const growth = growthGap(inputs);
  const deficit = fiscalGap(inputs);
  return {
    // A 5% natural rate at $30k, +1.8 points per halving of income (poorer economies carry more
    // slack); Okun's law, about 0.4 points per point of growth below trend. Range 2-30%.
    unemploymentRate: round1(clamp(5 - 1.8 * income - 0.4 * growth, 2, 30)),
    // 3% at $30k, +1.2 points per halving of income (weaker monetary anchors); +0.3 per point of
    // growth above trend (the output gap); +0.15 per point of deficit (monetary financing). 0.5-40%.
    inflationRate: round1(
      clamp(3 - 1.2 * income + 0.3 * growth + 0.15 * Math.max(0, deficit), 0.5, 40)
    ),
    // 55% at $30k, +8 points per doubling of income (richer states borrow more cheaply); +12 per
    // point of deficit (half the Domar steady state, deficit / 4% nominal growth); -2 per point of
    // growth above trend (growth erodes the ratio). Range 5-250%.
    totalDebtGDPRatio: round1(clamp(55 + 8 * income + 12 * deficit - 2 * growth, 5, 250)),
  };
}

export interface EffectiveFigure {
  value: number;
  /** True when the nation never recorded this figure and `value` is the estimate. */
  estimated: boolean;
}

export type EffectiveEconomicFigures = Record<EstimatedField, EffectiveFigure>;

/** The country columns `effectiveFiguresOfCountry` reads. */
export interface EconomicFigureRow {
  economicTier?: string | null;
  currentGdpPerCapita?: number | null;
  taxRevenueGDPPercent?: number | null;
  governmentBudgetGDPPercent?: number | null;
  spendingGDPPercent?: number | null;
  inflationRate?: number | null;
  unemploymentRate?: number | null;
  totalDebtGDPRatio?: number | null;
}

/** Prisma `Country` select fragment for `effectiveFiguresOfCountry`. */
export const ECONOMIC_FIGURE_SELECT = {
  economicTier: true,
  currentGdpPerCapita: true,
  taxRevenueGDPPercent: true,
  governmentBudgetGDPPercent: true,
  spendingGDPPercent: true,
  inflationRate: true,
  unemploymentRate: true,
  totalDebtGDPRatio: true,
} as const;

/**
 * Each figure as the nation recorded it (any number; an exact 0 inflation or unemployment is blank), otherwise the estimate
 * flagged `estimated`. `realGrowthPct` is the realised growth in percent, as the caller reads it.
 */
export function effectiveFiguresOfCountry(
  row: EconomicFigureRow,
  realGrowthPct: number | null | undefined
): EffectiveEconomicFigures {
  const estimate = estimateEconomicFigures({
    economicTier: row.economicTier,
    gdpPerCapita: row.currentGdpPerCapita,
    realGrowthPct,
    revenueGdpPct: row.taxRevenueGDPPercent,
    // The builder writes the budget share; older rows only have spendingGDPPercent.
    spendingGdpPct:
      positiveOrNull(row.governmentBudgetGDPPercent) ?? positiveOrNull(row.spendingGDPPercent),
  });
  const pick = (field: EstimatedField): EffectiveFigure => {
    const stored = row[field];
    return isFiniteNumber(stored) && !isBlankFigure(field, stored)
      ? { value: stored, estimated: false }
      : { value: estimate[field], estimated: true };
  };
  return {
    inflationRate: pick("inflationRate"),
    unemploymentRate: pick("unemploymentRate"),
    totalDebtGDPRatio: pick("totalDebtGDPRatio"),
  };
}
