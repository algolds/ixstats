/**
 * National force structure (realm time D2): the domains a player's branches serve in, the formation names offered
 * per domain, the bounds authored structure respects, and the builder's Defense figure the budget chain reads.
 * Strength, headcounts, capital and readiness are derived by the defense model (`~/lib/military/model`), never
 * typed. Pure and client-safe.
 */
import { BRANCH_DOMAINS, DOMAIN_LABELS, type BranchDomain } from "./model/constants";

export { BRANCH_DOMAINS, DOMAIN_LABELS, type BranchDomain };

/** Formation names offered per domain; the server accepts any short label. */
export const UNIT_TYPES: Record<BranchDomain, readonly string[]> = {
  land: ["corps", "division", "brigade", "regiment", "battalion"],
  sea: ["fleet", "task force", "squadron", "flotilla"],
  air: ["air division", "wing", "group", "squadron"],
  marines: ["division", "regiment", "battalion"],
  space: ["delta", "squadron", "garrison"],
  strategic_missile: ["army", "division", "regiment"],
};

/** Server-enforced bounds for authored force structure. */
export const FORCE_LIMITS = {
  maxBranchesPerCountry: 20,
  maxUnitsPerBranch: 200,
  maxAssetsPerBranch: 500,
  /** Most a player may set as a branch's desired active strength. */
  maxActiveDuty: 10_000_000,
  maxCivilianStaff: 5_000_000,
  maxUnitPersonnel: 1_000_000,
} as const;

/**
 * The Defense amount from `GovernmentBudget.spendingCategories`, which the builder stores either as
 * an array of `{ category, amount }` (economic builder) or a `{ category: amount }` map
 * (government builder). Null when absent, unparsable or not positive.
 */
export function builderDefenseSpending(
  spendingCategories: string | null | undefined
): number | null {
  if (!spendingCategories) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(spendingCategories);
  } catch {
    return null;
  }
  const isDefense = (name: unknown) =>
    typeof name === "string" && /defen[cs]e|military/i.test(name);
  let amount: unknown = null;
  if (Array.isArray(parsed)) {
    amount = (parsed as { category?: unknown; amount?: unknown }[]).find((c) =>
      isDefense(c?.category)
    )?.amount;
  } else if (parsed && typeof parsed === "object") {
    amount = Object.entries(parsed as Record<string, unknown>).find(([k]) => isDefense(k))?.[1];
  }
  return typeof amount === "number" && Number.isFinite(amount) && amount > 0 ? amount : null;
}

/** A branch as the Defense panel and rail read it: rows from `security.getMilitaryBranches`. */
interface TotalsBranch {
  activeDuty: number;
  reserves: number;
  civilianStaff?: number | null;
  units: readonly { personnel: number }[];
  assets: readonly { quantity: number }[];
  /** The owner's derived state; null for other viewers. */
  derived: { combatPower: number; readiness: number; personnel: number } | null;
}

export interface ForceTotals {
  branches: number;
  units: number;
  assets: number;
  activeDuty: number;
  reserves: number;
  /** Personnel assigned to units. */
  assignedPersonnel: number;
  /** Derived combat power and personnel-weighted readiness; null when not disclosed to the viewer. */
  strength: number | null;
  readiness: number | null;
}

/** Roll-up of a nation's branches for the Defense panel and rail. */
export function forceTotals(branches: readonly TotalsBranch[]): ForceTotals {
  const sum = (pick: (b: TotalsBranch) => number) => branches.reduce((s, b) => s + pick(b), 0);
  const disclosed = branches.length > 0 && branches.every((b) => b.derived !== null);
  const personnel = sum((b) => b.derived?.personnel ?? 0);
  return {
    branches: branches.length,
    units: sum((b) => b.units.length),
    assets: sum((b) => b.assets.reduce((n, a) => n + a.quantity, 0)),
    activeDuty: sum((b) => b.activeDuty),
    reserves: sum((b) => b.reserves),
    assignedPersonnel: sum((b) => b.units.reduce((n, u) => n + u.personnel, 0)),
    strength: disclosed ? sum((b) => b.derived?.combatPower ?? 0) : null,
    readiness:
      disclosed && personnel > 0
        ? sum((b) => (b.derived?.readiness ?? 0) * (b.derived?.personnel ?? 0)) / personnel
        : null,
  };
}
