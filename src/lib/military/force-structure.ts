/**
 * National force structure (MC-3, decision D2): the bounds a player's authored branches and units
 * must respect, the combat-strength formula PvNPC strikes and PvP resolution use, roll-up totals
 * for the Defense UI, and the starter force planned from a nation's builder data.
 *
 * Pure and client-safe: the server routers, the conflict outcome and the Defense panels all read
 * this one module, so the strength a player sees is the strength a battle uses.
 */

export const BRANCH_TYPES = [
  "army",
  "navy",
  "air_force",
  "space_force",
  "marines",
  "coast_guard",
  "cyber_command",
  "special_forces",
] as const;
export type BranchTypeKey = (typeof BRANCH_TYPES)[number];

export const BRANCH_TYPE_LABELS: Record<BranchTypeKey, string> = {
  army: "Army",
  navy: "Navy",
  air_force: "Air force",
  space_force: "Space force",
  marines: "Marines",
  coast_guard: "Coast guard",
  cyber_command: "Cyber command",
  special_forces: "Special forces",
};

/** Formation names offered per branch type; the server accepts any short label. */
export const UNIT_TYPES: Record<BranchTypeKey, readonly string[]> = {
  army: ["corps", "division", "brigade", "regiment", "battalion"],
  navy: ["fleet", "task force", "squadron", "flotilla"],
  air_force: ["air division", "wing", "group", "squadron"],
  space_force: ["delta", "squadron", "garrison"],
  marines: ["division", "regiment", "battalion"],
  coast_guard: ["district", "sector", "station"],
  cyber_command: ["group", "squadron", "team"],
  special_forces: ["group", "regiment", "battalion", "squadron"],
};

/** Server-enforced bounds for authored force structure. */
export const FORCE_LIMITS = {
  maxBranchesPerCountry: 20,
  maxUnitsPerBranch: 200,
  maxAssetsPerBranch: 500,
  maxActiveDuty: 10_000_000,
  maxReserves: 20_000_000,
  maxCivilianStaff: 5_000_000,
  maxUnitPersonnel: 1_000_000,
  maxAssetQuantity: 1_000_000,
  /** 100 trillion in the nation's currency. */
  maxBudget: 1e14,
  /** Active duty plus reserves across all branches, as a share of population. */
  maxPopulationShare: 0.25,
} as const;

interface UnitForce {
  personnel: number | null;
  readiness: number | null;
}

interface AssetForce {
  quantity: number | null;
  operational: number | null;
  modernizationLevel?: number | null;
  status?: string | null;
}

/** A branch as strength reads it; branch-level fields are optional so units-only data still works. */
export interface BranchForce {
  activeDuty?: number | null;
  reserves?: number | null;
  readinessLevel?: number | null;
  technologyLevel?: number | null;
  trainingLevel?: number | null;
  morale?: number | null;
  units: UnitForce[];
  assets: AssetForce[];
}

/** Reserves fight at a quarter of active strength. */
export const RESERVE_WEIGHT = 0.25;
/** Strength points per operational asset at modernization 50. */
export const ASSET_WEIGHT = 10;

const pct = (value: number | null | undefined, fallback = 50) =>
  Math.min(100, Math.max(0, value ?? fallback)) / 100;
const count = (value: number | null | undefined) => Math.max(0, value ?? 0);

/** Personnel assigned to units, split into the share drawn from active duty and from reserves. */
function personnelPools(branch: BranchForce) {
  const assigned = branch.units.reduce((s, u) => s + count(u.personnel), 0);
  const activeDuty = count(branch.activeDuty);
  const reserves = count(branch.reserves);
  const fromActive = Math.min(assigned, activeDuty);
  const fromReserves = Math.min(reserves, assigned - fromActive);
  return {
    assigned,
    unassignedActive: activeDuty - fromActive,
    unassignedReserves: reserves - fromReserves,
  };
}

/**
 * Combat strength of one branch:
 *   personnel = sum(unit personnel x unit readiness)
 *             + unassigned active duty x branch readiness
 *             + unassigned reserves x branch readiness x 0.25
 *   assets    = sum over non-retired assets of min(operational, quantity) x 10 x (0.5 + modernization)
 *   strength  = (personnel + assets) x quality, quality = 0.75 + mean(technology, training, morale) / 2
 * Every level defaults to 50, which makes quality 1.0 and each asset worth 10.
 */
export function branchStrength(branch: BranchForce): number {
  const { unassignedActive, unassignedReserves } = personnelPools(branch);
  const branchReadiness = pct(branch.readinessLevel);
  const unitPart = branch.units.reduce((s, u) => s + count(u.personnel) * pct(u.readiness), 0);
  const personnelPart =
    unitPart +
    unassignedActive * branchReadiness +
    unassignedReserves * branchReadiness * RESERVE_WEIGHT;
  const assetPart = branch.assets.reduce((s, a) => {
    if (a.status === "retired") return s;
    const operational = Math.min(count(a.operational), count(a.quantity));
    return s + operational * ASSET_WEIGHT * (0.5 + pct(a.modernizationLevel));
  }, 0);
  const quality =
    0.75 + (pct(branch.technologyLevel) + pct(branch.trainingLevel) + pct(branch.morale)) / 6;
  return (personnelPart + assetPart) * quality;
}

/** Combat strength of a nation's active branches; zero with no force structure. */
export function militaryStrength(branches: BranchForce[]): number {
  return branches.reduce((sum, b) => sum + branchStrength(b), 0);
}

export interface ForceTotals {
  branches: number;
  units: number;
  assets: number;
  activeDuty: number;
  reserves: number;
  civilianStaff: number;
  /** Personnel assigned to units. */
  assignedPersonnel: number;
  /** Sum of branch budgets; null when they are redacted (a viewer who is not the owner). */
  annualBudget: number | null;
  strength: number;
}

/** Roll-up of a nation's branches for the Defense panel and rail. */
export function forceTotals(
  branches: (BranchForce & { civilianStaff?: number | null; annualBudget?: number | null })[]
): ForceTotals {
  const budgetVisible = branches.some((b) => typeof b.annualBudget === "number");
  return {
    branches: branches.length,
    units: branches.reduce((s, b) => s + b.units.length, 0),
    assets: branches.reduce((s, b) => s + b.assets.reduce((n, a) => n + count(a.quantity), 0), 0),
    activeDuty: branches.reduce((s, b) => s + count(b.activeDuty), 0),
    reserves: branches.reduce((s, b) => s + count(b.reserves), 0),
    civilianStaff: branches.reduce((s, b) => s + count(b.civilianStaff), 0),
    assignedPersonnel: branches.reduce((s, b) => s + personnelPools(b).assigned, 0),
    annualBudget: budgetVisible ? branches.reduce((s, b) => s + count(b.annualBudget), 0) : null,
    strength: militaryStrength(branches),
  };
}

/** Most personnel a nation may field (active duty plus reserves); null when population is unknown. */
export function populationPersonnelCap(population: number | null | undefined): number | null {
  if (!population || population <= 0) return null;
  return Math.floor(population * FORCE_LIMITS.maxPopulationShare);
}

// ===========================
// Starter force from builder data
// ===========================

const STARTER_SHARES: { branchType: BranchTypeKey; share: number }[] = [
  { branchType: "army", share: 0.55 },
  { branchType: "navy", share: 0.25 },
  { branchType: "air_force", share: 0.2 },
];

/** Active duty as a share of population, a typical peacetime figure. */
const STARTER_ACTIVE_SHARE = 0.005;
/** Defense spending as a share of GDP when the builder recorded none. */
const STARTER_GDP_SHARE = 0.02;

export type StarterBudgetSource = "builder" | "defenseBudget" | "estimate" | "none";

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

export interface StarterBranch {
  branchType: BranchTypeKey;
  name: string;
  activeDuty: number;
  reserves: number;
  annualBudget: number;
  budgetPercent: number;
}

/**
 * Army, navy and air force sized from population (0.5% active duty, reserves half that) and
 * funded from the builder's Defense spending, else the stored defense budget, else 2% of GDP.
 * A defense figure above half of GDP is treated as bad data and skipped.
 */
export function planStarterForce(input: {
  population: number | null | undefined;
  totalGdp: number | null | undefined;
  builderDefenseSpending: number | null;
  defenseBudgetTotal: number | null | undefined;
}): { branches: StarterBranch[]; budgetSource: StarterBudgetSource } {
  const gdp = input.totalGdp && input.totalGdp > 0 ? input.totalGdp : 0;
  const plausible = (amount: number | null | undefined) =>
    !!amount && amount > 0 && (gdp === 0 || amount <= gdp * 0.5);

  let budget = 0;
  let budgetSource: StarterBudgetSource = "none";
  if (plausible(input.builderDefenseSpending)) {
    budget = input.builderDefenseSpending!;
    budgetSource = "builder";
  } else if (plausible(input.defenseBudgetTotal)) {
    budget = input.defenseBudgetTotal!;
    budgetSource = "defenseBudget";
  } else if (gdp > 0) {
    budget = gdp * STARTER_GDP_SHARE;
    budgetSource = "estimate";
  }
  budget = Math.min(budget, FORCE_LIMITS.maxBudget);

  const population = input.population && input.population > 0 ? input.population : 0;
  const totalActive = Math.round(population * STARTER_ACTIVE_SHARE);

  const branches = STARTER_SHARES.map(({ branchType, share }) => {
    const activeDuty = Math.min(FORCE_LIMITS.maxActiveDuty, Math.round(totalActive * share));
    return {
      branchType,
      name: BRANCH_TYPE_LABELS[branchType],
      activeDuty,
      reserves: Math.min(FORCE_LIMITS.maxReserves, Math.round(activeDuty * 0.5)),
      annualBudget: Math.round(budget * share),
      budgetPercent: share * 100,
    };
  });
  return { branches, budgetSource };
}
