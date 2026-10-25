/**
 * The Defense page's arithmetic: the budget split as whole percents that always add up to 100, which readiness area
 * is weakest, the manpower model a volunteer share reads as, the mobilisation arrival curve, alert bite timing,
 * procurement quotes and order progress, and the model's funding rerun on a draft policy for the levers' previews.
 * Pure and client-safe.
 */
import {
  ALERT_LEVELS,
  ALERT_PARAMS,
  CATALOG_CATEGORY_DOMAINS,
  DEFAULT_DESIGN_YEAR,
  ERA_DESIGN_YEAR,
  MOBILISATION_TAU_DAYS,
  MONTH_MS,
  ORDER_DOWN_PAYMENT,
  SHARE_KEYS,
  SHARE_PRESETS,
  fundingAt,
  leadMonths,
  memberPay,
  orderUnitCost,
  type AlertLevel,
  type BranchDomain,
  type BranchState,
  type BudgetShares,
  type Doctrine,
  type FundingReport,
  type OrderSource,
  type PolicyState,
  type SharePreset,
  type SubScores,
} from "./model";

// ---------------------------------------------------------------------------------------------------------------
// Budget split
// ---------------------------------------------------------------------------------------------------------------

export type ShareKey = (typeof SHARE_KEYS)[number];
/** The five budget lines as whole percents adding up to 100. */
export type SharePercents = Record<ShareKey, number>;

const clampPercent = (value: number) => Math.min(100, Math.max(0, Math.round(value)));

/** Whole numbers proportional to `weights` that add up to `total` (largest remainder). */
function apportion(weights: readonly number[], total: number): number[] {
  const sum = weights.reduce((s, w) => s + w, 0);
  const exact = weights.map((w) => (sum > 0 ? (w / sum) * total : total / weights.length));
  const floors = exact.map(Math.floor);
  let left = total - floors.reduce((s, f) => s + f, 0);
  const order = exact
    .map((value, index) => ({ index, remainder: value - Math.floor(value) }))
    .sort((a, b) => b.remainder - a.remainder || a.index - b.index);
  for (const { index } of order) {
    if (left <= 0) break;
    floors[index]! += 1;
    left -= 1;
  }
  return floors;
}

function fromList(values: readonly number[]): SharePercents {
  const [personnel, om, procurement, rd, infrastructure] = values;
  return {
    personnel: personnel ?? 0,
    om: om ?? 0,
    procurement: procurement ?? 0,
    rd: rd ?? 0,
    infrastructure: infrastructure ?? 0,
  };
}

/** Stored shares (fractions) as whole percents adding up to 100. */
export function toPercents(shares: BudgetShares): SharePercents {
  return fromList(apportion(SHARE_KEYS.map((key) => Math.max(0, shares[key])), 100));
}

export function toShares(percents: SharePercents): BudgetShares {
  return fromList(SHARE_KEYS.map((key) => percents[key] / 100));
}

/**
 * Set one line and spread the difference over the other four in proportion to what they hold (evenly when they
 * hold nothing), so the split still adds up to 100.
 */
export function rebalancePercents(
  percents: SharePercents,
  key: ShareKey,
  value: number
): SharePercents {
  const fixed = clampPercent(value);
  const others = SHARE_KEYS.filter((k) => k !== key);
  const spread = apportion(
    others.map((k) => percents[k]),
    100 - fixed
  );
  const next = { ...percents, [key]: fixed };
  others.forEach((k, i) => {
    next[k] = spread[i]!;
  });
  return next;
}

/** The preset a split matches exactly, if any. */
export function matchingPreset(percents: SharePercents): SharePreset | null {
  const presets = Object.keys(SHARE_PRESETS) as SharePreset[];
  return (
    presets.find((preset) =>
      SHARE_KEYS.every((key) => Math.round(SHARE_PRESETS[preset][key] * 100) === percents[key])
    ) ?? null
  );
}

export const sameSplit = (a: SharePercents, b: SharePercents) =>
  SHARE_KEYS.every((key) => a[key] === b[key]);

// ---------------------------------------------------------------------------------------------------------------
// Readiness
// ---------------------------------------------------------------------------------------------------------------

export const SUB_SCORE_KEYS = ["personnel", "equipment", "condition", "training"] as const;
export type SubScoreKey = (typeof SUB_SCORE_KEYS)[number];

/** The weakest readiness area (the first on a tie): the one readiness is held back by. */
export function worstSubScore(scores: SubScores): SubScoreKey {
  return SUB_SCORE_KEYS.reduce((worst, key) => (scores[key] < scores[worst] ? key : worst));
}

/** Personnel-weighted sub-scores across branches (evenly weighted when nobody serves yet). */
export function nationalSubScores(
  branches: readonly { personnel: number; subScores: SubScores }[]
): SubScores | null {
  if (branches.length === 0) return null;
  const people = branches.reduce((sum, b) => sum + Math.max(0, b.personnel), 0);
  const weight = (b: { personnel: number }) =>
    people > 0 ? Math.max(0, b.personnel) / people : 1 / branches.length;
  const mean = (key: SubScoreKey) =>
    branches.reduce((sum, b) => sum + b.subScores[key] * weight(b), 0);
  return {
    personnel: mean("personnel"),
    equipment: mean("equipment"),
    condition: mean("condition"),
    training: mean("training"),
  };
}

// ---------------------------------------------------------------------------------------------------------------
// Manpower and mobilisation
// ---------------------------------------------------------------------------------------------------------------

export type ManpowerModel = "volunteer" | "mixed" | "conscription";

/** Volunteer share each manpower model sets (mixed is half and half). */
export const MANPOWER_VOLUNTEER_SHARE: Record<ManpowerModel, number> = {
  volunteer: 1,
  mixed: 0.5,
  conscription: 0,
};

export function manpowerModelOf(volunteerShare: number): ManpowerModel {
  if (volunteerShare >= 0.995) return "volunteer";
  if (volunteerShare <= 0.005) return "conscription";
  return "mixed";
}

/** Days after an order at which the page reports arrivals. */
export const MOBILISATION_MILESTONE_DAYS = [3, 14, 60] as const;

/** Share of a mobilisation order reported after each milestone, under a doctrine's arrival speed. */
export function mobilisationSchedule(doctrine: Doctrine): { days: number; share: number }[] {
  const tau = MOBILISATION_TAU_DAYS[doctrine];
  return MOBILISATION_MILESTONE_DAYS.map((days) => ({ days, share: 1 - Math.exp(-days / tau) }));
}

/** The annual emergency supplement once `reservists` have all reported: their pay, outside the budget. */
export function mobilisationCost(input: {
  reservists: number;
  volunteerShare: number;
  gdpPerCapita: number;
}): number {
  return Math.max(0, input.reservists) * memberPay(input.volunteerShare, input.gdpPerCapita);
}

// ---------------------------------------------------------------------------------------------------------------
// Alert
// ---------------------------------------------------------------------------------------------------------------

const alertRank = (level: AlertLevel) => ALERT_LEVELS.indexOf(level);

/** What ordering `next` from the level in effect does: a raise waits its bite days, a lowering is instant. */
export function alertChange(inEffect: AlertLevel, next: AlertLevel) {
  const raise = alertRank(next) > alertRank(inEffect);
  return { raise, biteDays: raise ? ALERT_PARAMS[next].biteDays : 0 };
}

/** A raised alert not yet in effect, and when it bites. */
export function pendingAlert(policy: {
  alertLevel: AlertLevel;
  alertInEffect: AlertLevel;
  alertEffectiveAtClockMs: number;
}): { level: AlertLevel; effectiveAtClockMs: number } | null {
  return policy.alertLevel !== policy.alertInEffect
    ? { level: policy.alertLevel, effectiveAtClockMs: policy.alertEffectiveAtClockMs }
    : null;
}

// ---------------------------------------------------------------------------------------------------------------
// Procurement
// ---------------------------------------------------------------------------------------------------------------

export const designYearOf = (era: string | null | undefined) =>
  ERA_DESIGN_YEAR[era ?? ""] ?? DEFAULT_DESIGN_YEAR;

/** Whether a catalog category can serve in a branch of `domain`. */
export function fitsDomain(catalogCategory: string | null | undefined, domain: BranchDomain) {
  const allowed = CATALOG_CATEGORY_DOMAINS[catalogCategory ?? ""];
  return !allowed || allowed.includes(domain);
}

export interface OrderQuote {
  unitCost: number;
  total: number;
  leadMonths: number;
  downPayment: number;
  /** Paid each month after the down payment until delivery. */
  monthlyPayment: number;
  deliveryClockMs: number;
  designYear: number;
  /** Monthly draw on domestic capacity (0 for imports). */
  capacityDraw: number;
}

/** What an order costs and when it arrives, as the server will price it. */
export function quoteOrder(input: {
  catalogCost: number;
  subcategory: string | null | undefined;
  era: string | null | undefined;
  quantity: number;
  source: OrderSource;
  priceIndex: number;
  surging: boolean;
  nowClockMs: number;
}): OrderQuote {
  const lead = leadMonths(input.subcategory, input.source);
  const unitCost = orderUnitCost({
    catalogCost: input.catalogCost,
    priceIndex: input.priceIndex,
    source: input.source,
    surging: input.surging,
  });
  const total = unitCost * Math.max(0, input.quantity);
  return {
    unitCost,
    total,
    leadMonths: lead,
    downPayment: total * ORDER_DOWN_PAYMENT,
    monthlyPayment: (total * (1 - ORDER_DOWN_PAYMENT)) / Math.max(1, lead),
    deliveryClockMs: input.nowClockMs + lead * MONTH_MS,
    designYear: designYearOf(input.era),
    capacityDraw: input.source === "domestic" ? total / Math.max(1, lead) : 0,
  };
}

export type DomesticBlock = "frontier" | "capacity" | null;

/** Why domestic industry would refuse an order (the server's rules), or null when it can take it. */
export function domesticBlock(input: {
  quote: OrderQuote;
  accessibleYear: number;
  capacityMonthly: number;
  capacityUsedMonthly: number;
}): DomesticBlock {
  if (input.quote.designYear > input.accessibleYear) return "frontier";
  if (input.capacityUsedMonthly + input.quote.capacityDraw > input.capacityMonthly) return "capacity";
  return null;
}

/** Whole months an order has slipped past its lead time for want of money. */
export function orderSlipMonths(order: {
  orderedClockMs: number;
  expectedClockMs: number;
  leadMonths: number;
}): number {
  return Math.max(
    0,
    Math.round((order.expectedClockMs - order.orderedClockMs) / MONTH_MS - order.leadMonths)
  );
}

export const orderPaidShare = (order: { paidSoFar: number; totalCost: number }) =>
  order.totalCost > 0 ? Math.min(1, order.paidSoFar / order.totalCost) : 0;

// ---------------------------------------------------------------------------------------------------------------
// Funding preview
// ---------------------------------------------------------------------------------------------------------------

/** What the owner overview carries that the model's funding reads. */
export interface PreviewSource {
  clockMs: number;
  budget: { annual: number };
  policy: PolicyState;
  economy: { population: number; gdpPerCapita: number; gdp: number };
  branches: readonly {
    id: string;
    domain: BranchDomain;
    active: number;
    reserves: number;
    capital: number;
    effortShare: number;
    targetActive: number | null;
    mobilisationOrder: number;
    operationWear: number;
    subScores: SubScores;
  }[];
}

export type PolicyDraft = Partial<
  Pick<PolicyState, "shares" | "volunteerShare" | "serviceMonths" | "reserveYears" | "omPriority">
>;

/** The month's funding the model would report under a draft policy, everything else as it stands. */
export function fundingPreview(source: PreviewSource, draft: PolicyDraft): FundingReport {
  const branches: BranchState[] = source.branches.map((b) => ({
    id: b.id,
    domain: b.domain,
    effortShare: b.effortShare,
    targetActive: b.targetActive,
    active: b.active,
    reserves: b.reserves,
    capital: b.capital,
    condition: b.subScores.condition,
    training: b.subScores.training,
    reserveTraining: 0,
    mobilisationOrder: b.mobilisationOrder,
    mobilisationOrderedClockMs: null,
    operationWear: b.operationWear,
  }));
  const { report } = fundingAt(
    {
      policy: { ...source.policy, ...draft },
      branches,
      orders: [],
      lastTickClockMs: source.clockMs,
    },
    {
      ...source.economy,
      defenseBudget: source.budget.annual,
      realmMedianGdpPerCapita: source.economy.gdpPerCapita,
      frontierYear: 0,
    },
    source.clockMs
  );
  return { ...report, slipped: 0 };
}
