/**
 * Country public record — the one definition of what a visitor may see of a nation's
 * statecraft. Pure (no React, no Prisma): the server (`countries.getPublicRecord`,
 * `intent.getTree` for non-owners) filters with these constants and shapes rows with these
 * mappers, and the profile layer re-exports them (`src/app/countries/[slug]/_utils/profileLayer.ts`).
 *
 * - Directives: only enacted ones (`active` = in force, `completed`). Drafts (`proposed`, which
 *   also carry `tier: "proposed"`) and `abandoned` directives stay private, and so do the
 *   package line items (`changesJson`), CivCap and cooldowns.
 * - National issues: only resolved ones (`responded`, `auto_resolved`) with the decision label
 *   and the engine's outcome summary. Open, expired and dismissed issues stay private.
 * - Budgets: the government budget (total, department allocations, sub-budgets, revenue
 *   sources), the sector spending split (`GovernmentBudget`, `FiscalSystem.spendingByCategory`),
 *   military branch budgets and embassy budgets stay private. Readers that serve both audiences
 *   strip them for non-owners with the `redact*` helpers below. Macro factbook figures on the
 *   country row (total spending and revenue as a share of GDP, balance, debt, tax rates) stay
 *   public.
 * - Ledger: a visitor's canon feed leaves out entries tied to directives that are not public
 *   (drafts, abandoned) and entries that move a budget field (`isBudgetLedgerRow`).
 */

// ─── Directives ─────────────────────────────────────────────────────────────

export type PublicDirectiveStatus = "active" | "completed";

/** Statuses a visitor may see: declared (in force) and completed. */
export const PUBLIC_DIRECTIVE_STATUSES: readonly PublicDirectiveStatus[] = ["active", "completed"];

/** The draft tier: a directive saved but never committed. */
export const DRAFT_DIRECTIVE_TIER = "proposed";

export function isPublicDirective(row: { status: string; tier?: string | null }): boolean {
  return (
    (PUBLIC_DIRECTIVE_STATUSES as readonly string[]).includes(row.status) &&
    row.tier !== DRAFT_DIRECTIVE_TIER
  );
}

export interface IntentLike {
  id: string;
  goal: string;
  tier: string;
  category: string;
  status: string;
  summary?: string | null;
  progress?: number | null;
  riskRating?: string | null;
  createdIxTime: number;
}

export interface PublicDirective {
  id: string;
  goal: string;
  summary: string | null;
  tier: string;
  category: string;
  status: PublicDirectiveStatus;
  progress: number;
  createdIxTime: number;
}

/** Enacted directives only, newest first. `changesJson`, CivCap and cooldowns are never copied. */
export function toPublicDirectives(
  intents: readonly IntentLike[] | null | undefined
): PublicDirective[] {
  return (intents ?? [])
    .filter((i): i is IntentLike & { status: PublicDirectiveStatus } => isPublicDirective(i))
    .map((i) => ({
      id: i.id,
      goal: i.goal,
      summary: i.summary?.trim() || null,
      tier: i.tier,
      category: i.category,
      status: i.status,
      progress: Math.max(
        0,
        Math.min(100, Math.round(i.progress ?? (i.status === "completed" ? 100 : 0)))
      ),
      createdIxTime: i.createdIxTime,
    }))
    .sort((a, b) => b.createdIxTime - a.createdIxTime);
}

// ─── National issues ────────────────────────────────────────────────────────

/** Issues that reached a public outcome. */
export const PUBLIC_ISSUE_STATUSES = ["responded", "auto_resolved"] as const;

export interface IssueLike {
  id: string;
  title: string;
  domain: string;
  status: string;
  severity?: string | null;
  chosenOptionLabel?: string | null;
  autoResolveLabel?: string | null;
  consequenceLog?: string | null;
  respondedIxTime?: number | null;
  createdIxTime?: number | null;
}

export interface PublicIssueOutcome {
  id: string;
  title: string;
  domain: string;
  /** The response the government chose (or the default that applied when it lapsed). */
  decision: string | null;
  /** The engine's plain-language summary of what happened. */
  outcome: string | null;
  resolvedBy: "government" | "default";
  /** When it was resolved (IxTime ms); the creation time for legacy rows without one. */
  ixTime: number | null;
}

export function toPublicIssueOutcomes(
  issues: readonly IssueLike[] | null | undefined
): PublicIssueOutcome[] {
  return (issues ?? [])
    .filter((i) => (PUBLIC_ISSUE_STATUSES as readonly string[]).includes(i.status))
    .map((i) => ({
      id: i.id,
      title: i.title,
      domain: i.domain,
      decision:
        (i.status === "responded" ? i.chosenOptionLabel : i.autoResolveLabel)?.trim() ||
        i.chosenOptionLabel?.trim() ||
        null,
      outcome: i.consequenceLog?.trim() || null,
      resolvedBy: i.status === "responded" ? ("government" as const) : ("default" as const),
      ixTime: i.respondedIxTime ?? i.createdIxTime ?? null,
    }))
    .sort((a, b) => (b.ixTime ?? 0) - (a.ixTime ?? 0));
}

// ─── Budgets ────────────────────────────────────────────────────────────────

/**
 * A government structure with its budget left out, for a visitor: `totalBudget` is omitted and
 * the budget relation lists (structure and department allocations, sub-budgets, revenue sources)
 * come back empty. Offices, leaders, branches, departments and political metrics are kept.
 */
type RedactedGovernmentBudget<T> = Omit<T, "totalBudget"> & { totalBudget?: undefined };

type DepartmentLike = { budgetAllocations?: unknown; subBudgets?: unknown };

export function redactGovernmentBudget<
  T extends {
    totalBudget?: unknown;
    budgetAllocations?: unknown;
    revenueSources?: unknown;
    departments?: readonly DepartmentLike[];
  },
>(structure: T): RedactedGovernmentBudget<T> {
  const { totalBudget: _totalBudget, ...rest } = structure;
  const out: Record<string, unknown> = { ...rest };
  if ("budgetAllocations" in structure) out.budgetAllocations = [];
  if ("revenueSources" in structure) out.revenueSources = [];
  if (Array.isArray(structure.departments)) {
    out.departments = structure.departments.map((d: DepartmentLike) => {
      const dept: Record<string, unknown> = { ...d };
      if ("budgetAllocations" in d) dept.budgetAllocations = [];
      if ("subBudgets" in d) dept.subBudgets = [];
      return dept;
    });
  }
  return out as RedactedGovernmentBudget<T>;
}

/**
 * A country record with its economic relations, for a visitor: the sector spending split
 * (`governmentBudget`, `fiscalSystem.spendingByCategory`) is nulled. Tax rates and the macro
 * fiscal figures on the row itself are public.
 */
export function redactEconomicBudget<T extends object>(country: T): T {
  const out = { ...country } as Record<string, unknown>;
  if ("governmentBudget" in country) out.governmentBudget = null;
  const fiscal = (country as { fiscalSystem?: unknown }).fiscalSystem;
  if (fiscal && typeof fiscal === "object" && "spendingByCategory" in fiscal) {
    out.fiscalSystem = { ...fiscal, spendingByCategory: null };
  }
  return out as T;
}

/** A military branch without its budget (`annualBudget`, `budgetPercent` omitted). */
export function redactMilitaryBranchBudget<
  T extends { annualBudget?: unknown; budgetPercent?: unknown },
>(
  branch: T
): Omit<T, "annualBudget" | "budgetPercent"> & {
  annualBudget?: undefined;
  budgetPercent?: undefined;
} {
  const { annualBudget: _annualBudget, budgetPercent: _budgetPercent, ...rest } = branch;
  return rest;
}

/**
 * True for a ledger entry that reveals a budget figure: one that moves a budget model or the
 * structure's `totalBudget` (policy maintenance debits it), or a policy entry whose text cites
 * the budget. Macro fields on the country row (`spendingGDPPercent`, `taxRevenueGDPPercent`, …)
 * are public and do not count.
 */
export function isBudgetLedgerRow(row: {
  targetModel?: string | null;
  targetField?: string | null;
  sourceType?: string | null;
  description?: string | null;
}): boolean {
  if (row.targetModel && /budget|allocation|revenuesource/i.test(row.targetModel)) return true;
  if (row.targetModel === "GovernmentStructure" && row.targetField === "totalBudget") return true;
  if (row.targetField) return false;
  return row.sourceType === "policy" && /budget/i.test(row.description ?? "");
}
