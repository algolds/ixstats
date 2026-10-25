/**
 * Layer (a): the defense budget and its split (research §7.1). The budget is the National budget's Defense
 * department line (D1); a nation without one falls back along the chain the codebase audit recommends.
 */
import {
  DEFAULT_SHARES,
  FALLBACK_GDP_SHARE,
  FALLBACK_SPENDING_GDP_SHARE,
  MAX_PLAUSIBLE_BURDEN,
  MIN_HEALTHY_PROCUREMENT_SHARE,
  SHARE_PRESETS,
  type BudgetShares,
  type SharePreset,
} from "./constants";

export const SHARE_KEYS = ["personnel", "om", "procurement", "rd", "infrastructure"] as const;

export type DefenseBudgetSource =
  | "defenseDepartment"
  | "builder"
  | "governmentForm"
  | "estimate"
  | "none";

/** Shares scaled to sum to 1 (negative entries count as 0); all-zero shares give the defaults. */
export function normaliseShares(shares: BudgetShares): BudgetShares {
  const clean = SHARE_KEYS.map((key) => Math.max(0, shares[key]));
  const total = clean.reduce((sum, value) => sum + value, 0);
  if (total <= 0) return { ...DEFAULT_SHARES };
  const [personnel, om, procurement, rd, infrastructure] = clean.map((value) => value / total);
  return {
    personnel: personnel!,
    om: om!,
    procurement: procurement!,
    rd: rd!,
    infrastructure: infrastructure!,
  };
}

/** The shares a preset applies. */
export function presetShares(preset: SharePreset): BudgetShares {
  return { ...SHARE_PRESETS[preset] };
}

/** One month of each budget line: B = D / 12 split by the shares. */
export function monthlyLines(annualBudget: number, shares: BudgetShares): BudgetShares {
  const monthly = Math.max(0, annualBudget) / 12;
  return {
    personnel: monthly * shares.personnel,
    om: monthly * shares.om,
    procurement: monthly * shares.procurement,
    rd: monthly * shares.rd,
    infrastructure: monthly * shares.infrastructure,
  };
}

interface CategorisedLine {
  allocatedAmount: number;
  allocatedPercent: number;
  department: { category: string };
}

/**
 * Every Defense-category line of one year's budget, summed (D2 changes D1's "largest line": a nation that splits
 * defense across an army ministry and an admiralty funds both). Null when the budget has no Defense line.
 */
export function defenseLinesTotal(
  lines: readonly CategorisedLine[]
): { amount: number; percent: number } | null {
  const defense = lines.filter((line) => line.department.category === "Defense");
  if (defense.length === 0) return null;
  return defense.reduce(
    (sum, line) => ({
      amount: sum.amount + line.allocatedAmount,
      percent: sum.percent + line.allocatedPercent,
    }),
    { amount: 0, percent: 0 }
  );
}

export interface BudgetChainInput {
  gdp: number;
  /** The Defense lines of the budget in effect (`defenseLinesTotal`), or null. */
  defenseLine: { amount: number; percent: number } | null;
  /** The builder's Defense spending (`builderDefenseSpending`), or null. */
  builderDefense: number | null;
  /** The government form's default Defense share of spending (0–1), or null when the form is unknown. */
  formDefenseShare: number | null;
  /** Recorded government spending, or null. */
  governmentSpending: number | null;
}

const plausible = (amount: number | null | undefined, gdp: number): amount is number =>
  typeof amount === "number" &&
  Number.isFinite(amount) &&
  amount > 0 &&
  (gdp <= 0 || amount <= gdp * MAX_PLAUSIBLE_BURDEN);

/** The Defense line, when it decides: a funded line, or a deliberate zero (0% of a real budget). */
function departmentAmount(input: BudgetChainInput): number | null {
  const line = input.defenseLine;
  if (!line) return null;
  if (plausible(line.amount, input.gdp)) return line.amount;
  // 0% allocated is the government's choice; 0 money at a positive share is a budget with no total (bad data).
  return line.amount === 0 && line.percent === 0 ? 0 : null;
}

function formAmount(input: BudgetChainInput): number | null {
  if (input.formDefenseShare === null || input.gdp <= 0) return null;
  const recorded = input.governmentSpending;
  const spending =
    recorded !== null && recorded > 0 && recorded <= input.gdp
      ? recorded
      : input.gdp * FALLBACK_SPENDING_GDP_SHARE;
  const amount = spending * input.formDefenseShare;
  return plausible(amount, input.gdp) ? amount : null;
}

/**
 * The annual defense budget: Defense department line → builder Defense line → government-form default share ×
 * spending → 2% of GDP. Labels the step that answered.
 */
export function resolveDefenseBudget(input: BudgetChainInput): {
  amount: number;
  source: DefenseBudgetSource;
} {
  const department = departmentAmount(input);
  if (department !== null) return { amount: department, source: "defenseDepartment" };
  if (plausible(input.builderDefense, input.gdp)) {
    return { amount: input.builderDefense, source: "builder" };
  }
  const form = formAmount(input);
  if (form !== null) return { amount: form, source: "governmentForm" };
  if (input.gdp > 0) return { amount: input.gdp * FALLBACK_GDP_SHARE, source: "estimate" };
  return { amount: 0, source: "none" };
}

export type BudgetWarning = "cannotRecapitalise" | "readinessFalling" | "payArrears";

/** NATO-style warnings on the split alone (readiness and pay warnings come from the step's funding ratios). */
export function shareWarnings(shares: BudgetShares): BudgetWarning[] {
  return shares.procurement < MIN_HEALTHY_PROCUREMENT_SHARE ? ["cannotRecapitalise"] : [];
}
