/**
 * Soft scores derived from a nation's sim state (owner decision 3, 2026-10-28).
 *
 * Governance scores (GovernmentStructure) and the infrastructure rating (Country) used to sit at
 * their seeded 50 for almost every nation. Each is now derived from what the nation has and does
 * (wealth, growth, government form and components, budget shares, approval, inflation and
 * unemployment), and the stored column keeps its meaning as a running total that issue
 * consequences, directives, elections and component shifts move: the stored value minus the
 * seeded default is a lasting offset on top of the derived score. No migration is needed, and a
 * hand-set or earned value carries over.
 *
 * Pure, deterministic and bounded 0-100. The internal stability scores derive in
 * `~/lib/statecraft/stability-formulas`; `stabilityBudget` here feeds them the budget lines.
 */

import { matchGovernmentForm, type GovernmentFormId } from "./forms";
import { governmentEffectiveness, type ScoredComponent } from "./effectiveness";

export const GOVERNANCE_FIELDS = [
  "politicalStability",
  "democracyIndex",
  "governmentEffectiveness",
  "ruleOfLaw",
  "corruptionIndex",
  "politicalPolarization",
] as const;

export type GovernanceField = (typeof GOVERNANCE_FIELDS)[number];
export type SoftScoreField = GovernanceField | "infrastructureRating";
export type SoftScores = Record<SoftScoreField, number>;
export type StoredSoftScores = Partial<Record<SoftScoreField, number | null>>;

/**
 * What every stored score was seeded with: the column defaults (GovernmentStructure's six and
 * Country.infrastructureRating are all 50). `stored - this` is the lasting offset.
 */
export const SOFT_SCORE_SEEDED_DEFAULTS: Readonly<SoftScores> = {
  politicalStability: 50,
  democracyIndex: 50,
  governmentEffectiveness: 50,
  ruleOfLaw: 50,
  corruptionIndex: 50,
  politicalPolarization: 50,
  infrastructureRating: 50,
};

export interface SoftScoreInputs {
  gdpPerCapita: number | null;
  /** Realised GDP growth, percent per year. */
  growthPercent: number | null;
  /** Percent; the recorded figure or the economy's estimate. */
  unemploymentRate: number | null;
  /** Percent; the recorded figure or the economy's estimate. */
  inflationRate: number | null;
  /** Gini points (0-100); null or 0 when unknown. */
  giniPoints: number | null;
  publicApproval: number | null;
  /** Free-text government type (the country's, else its structure's). */
  governmentType: string | null;
  /** Active government components with their effectiveness scores. */
  components: readonly ScoredComponent[];
  /** The budget in effect as percent of the budget per department category; null without one. */
  budgetShares: Readonly<Record<string, number>> | null;
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const score = (value: number) => Math.round(clamp(value, 0, 100) * 10) / 10;
const finiteOr = (value: number | null | undefined, fallback: number) =>
  typeof value === "number" && Number.isFinite(value) ? value : fallback;

/**
 * Department categories behind each budget driver, and the share (percent) that is neutral: about
 * what the government forms' starting budgets give (`form-departments`), so a default budget moves
 * nothing.
 */
const SHARE_GROUPS = {
  infrastructure: {
    categories: ["Transportation", "Energy", "Communications", "Housing"],
    neutral: 5,
  },
  policing: { categories: ["Interior", "Justice"], neutral: 12 },
  welfare: { categories: ["Education", "Health", "Social Services"], neutral: 55 },
} as const;

type ShareGroup = keyof typeof SHARE_GROUPS;

/** Percent of the budget a group receives; the neutral share when there is no budget. */
export function budgetShare(shares: SoftScoreInputs["budgetShares"], group: ShareGroup): number {
  const { categories, neutral } = SHARE_GROUPS[group];
  if (!shares || Object.keys(shares).length === 0) return neutral;
  return categories.reduce((sum, category) => sum + finiteOr(shares[category], 0), 0);
}

/** Share above or below neutral, in points, clamped. */
function shareGap(inputs: SoftScoreInputs, group: ShareGroup, min: number, max: number): number {
  return clamp(budgetShare(inputs.budgetShares, group) - SHARE_GROUPS[group].neutral, min, max);
}

/** 0 at $1k GDP per capita, 1 at $100k (log scale); 0.5 when unknown. */
export function wealthOf(gdpPerCapita: number | null): number {
  if (!gdpPerCapita || !Number.isFinite(gdpPerCapita) || gdpPerCapita <= 0) return 0.5;
  return clamp((Math.log10(gdpPerCapita) - 3) / 2, 0, 1);
}

/** Democracy a government form starts from; unknown (blank) types sit in the middle. */
const FORM_DEMOCRACY: Record<GovernmentFormId, number> = {
  "parliamentary-republic": 72,
  "presidential-republic": 68,
  "federal-republic": 70,
  "constitutional-monarchy": 72,
  confederation: 62,
  technocracy: 45,
  "merchant-oligarchy": 38,
  theocracy: 28,
  "absolute-monarchy": 20,
  "one-party-state": 18,
  "military-government": 12,
};

function formDemocracy(governmentType: string | null): number {
  const text = governmentType?.trim();
  return text ? FORM_DEMOCRACY[matchGovernmentForm(text)] : 50;
}

/** The economy's pressure terms, in points, shared by several scores. */
function strains(inputs: SoftScoreInputs) {
  return {
    wealth: wealthOf(inputs.gdpPerCapita),
    growth: clamp(finiteOr(inputs.growthPercent, 0), -5, 5),
    approvalGap: clamp(finiteOr(inputs.publicApproval, 50), 0, 100) - 50,
    unemployment: Math.max(0, finiteOr(inputs.unemploymentRate, 5) - 5),
    inflation: Math.max(0, Math.abs(finiteOr(inputs.inflationRate, 2) - 2) - 3),
  };
}

type Strains = ReturnType<typeof strains>;

/** Inequality pressure: the Gini gap from 35 when known, else poorer nations run more unequal. */
function inequality(inputs: SoftScoreInputs, s: Strains): number {
  const gini = inputs.giniPoints;
  return gini && gini > 0 ? (gini - 35) * 0.6 : (0.6 - s.wealth) * 15;
}

// Democracy: the government form, plus wealth (richer nations sustain freer institutions).
function deriveDemocracy(inputs: SoftScoreInputs, s: Strains): number {
  return score(formDemocracy(inputs.governmentType) + (s.wealth - 0.6) * 25);
}

// Effectiveness: the component computation when the nation has components (mean component score
// plus synergies, as `syncGovernmentComponents` stores it); otherwise wealth and growth.
function deriveEffectiveness(inputs: SoftScoreInputs, s: Strains): number {
  if (inputs.components.length > 0) return score(governmentEffectiveness(inputs.components));
  return score(20 + s.wealth * 60 + s.growth * 1.5);
}

// Corruption: poverty, autocracy and weak administration raise it; Justice/Interior spending
// lowers it.
function deriveCorruption(
  s: Strains,
  democracy: number,
  effectiveness: number,
  inputs: SoftScoreInputs
) {
  const policing = shareGap(inputs, "policing", -10, 10);
  return score(
    80 - s.wealth * 50 - (democracy - 50) * 0.25 - (effectiveness - 50) * 0.15 - policing * 0.5
  );
}

// Rule of law: democracy and clean institutions, plus Justice/Interior spending.
function deriveRuleOfLaw(democracy: number, corruption: number, inputs: SoftScoreInputs) {
  const policing = shareGap(inputs, "policing", -10, 10);
  return score(15 + democracy * 0.4 + (100 - corruption) * 0.4 + policing * 0.5);
}

// Polarization: open politics, inequality and economic strain divide; approval and growth unite.
function derivePolarization(inputs: SoftScoreInputs, s: Strains, democracy: number) {
  return score(
    28 +
      democracy * 0.15 +
      inequality(inputs, s) +
      s.unemployment +
      s.inflation * 0.5 -
      s.approvalGap * 0.2 -
      s.growth
  );
}

// Political stability: wealth, approval and growth steady a government; unemployment, inflation
// and polarization shake it.
function deriveStability(s: Strains, polarization: number) {
  return score(
    45 +
      (s.wealth - 0.5) * 30 +
      s.approvalGap * 0.4 +
      s.growth * 2 -
      s.unemployment * 0.8 -
      s.inflation * 0.8 -
      (polarization - 40) * 0.3
  );
}

// Infrastructure: wealth builds it; the Transportation/Energy/Communications/Housing share and
// growth add to it.
function deriveInfrastructure(inputs: SoftScoreInputs, s: Strains) {
  return score(15 + s.wealth * 65 + shareGap(inputs, "infrastructure", -8, 15) + s.growth);
}

/** Every soft score from the nation's sim state, before any stored offset. */
export function deriveSoftScores(inputs: SoftScoreInputs): SoftScores {
  const s = strains(inputs);
  const democracyIndex = deriveDemocracy(inputs, s);
  const effectiveness = deriveEffectiveness(inputs, s);
  const corruptionIndex = deriveCorruption(s, democracyIndex, effectiveness, inputs);
  const politicalPolarization = derivePolarization(inputs, s, democracyIndex);
  return {
    politicalStability: deriveStability(s, politicalPolarization),
    democracyIndex,
    governmentEffectiveness: effectiveness,
    ruleOfLaw: deriveRuleOfLaw(democracyIndex, corruptionIndex, inputs),
    corruptionIndex,
    politicalPolarization,
    infrastructureRating: deriveInfrastructure(inputs, s),
  };
}

/** `derived + (stored - seeded default)`, bounded 0-100; a missing stored value adds nothing. */
export function withStoredOffset(
  field: SoftScoreField,
  derived: number,
  stored: number | null | undefined
) {
  const offset =
    finiteOr(stored, SOFT_SCORE_SEEDED_DEFAULTS[field]) - SOFT_SCORE_SEEDED_DEFAULTS[field];
  return score(derived + offset);
}

/**
 * The scores every reader shows and every formula reads. Government effectiveness of a nation
 * with components is the stored value as is: `syncGovernmentComponents` stores the component
 * computation there and events move it, so adding it again would count it twice.
 */
export function effectiveSoftScores(inputs: SoftScoreInputs, stored: StoredSoftScores): SoftScores {
  const derived = deriveSoftScores(inputs);
  const out = {} as SoftScores;
  for (const field of Object.keys(derived) as SoftScoreField[]) {
    out[field] = withStoredOffset(field, derived[field], stored[field]);
  }
  const storedEffectiveness = stored.governmentEffectiveness;
  if (inputs.components.length > 0 && typeof storedEffectiveness === "number") {
    out.governmentEffectiveness = score(storedEffectiveness);
  }
  return out;
}

/** The budget lines (currency) the stability formula reads. */
export interface StabilityBudget {
  policingBudget: number;
  educationBudget: number;
  socialServicesBudget: number;
  totalBudget: number;
}

/**
 * Budget lines from the nation's spending: its total budget when set, else GDP times its tax take
 * (30% when unknown), split by its budget shares (neutral shares without a budget). Education and
 * social services split the welfare share 30/70, the formula's two welfare lines.
 */
export function stabilityBudget(input: {
  population: number;
  gdpPerCapita: number | null;
  totalBudget: number | null;
  taxRevenueGDPPercent: number | null;
  budgetShares: SoftScoreInputs["budgetShares"];
}): StabilityBudget {
  const gdp =
    Math.max(0, finiteOr(input.population, 0)) * Math.max(0, finiteOr(input.gdpPerCapita, 0));
  const taxShare = clamp(finiteOr(input.taxRevenueGDPPercent, 0), 0, 100) / 100 || 0.3;
  const total = finiteOr(input.totalBudget, 0) > 0 ? input.totalBudget! : gdp * taxShare;
  const welfare = (total * budgetShare(input.budgetShares, "welfare")) / 100;
  return {
    policingBudget: (total * budgetShare(input.budgetShares, "policing")) / 100,
    educationBudget: welfare * 0.3,
    socialServicesBudget: welfare * 0.7,
    totalBudget: total,
  };
}

/** True for the stored columns whose value is a lasting offset over the derived score. */
export function isSoftScoreField(field: string): field is SoftScoreField {
  return Object.hasOwn(SOFT_SCORE_SEEDED_DEFAULTS, field);
}
