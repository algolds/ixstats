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
