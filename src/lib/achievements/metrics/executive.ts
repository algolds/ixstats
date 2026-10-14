/**
 * Executive metrics (country scope): national issues, directives, power brokers and budget years.
 * Durations are real time: weeks and months of `createdAt` / `respondedAt` / `updatedAt`, never
 * IxTime. A count that needs a floor ("across 12 weeks") is emitted as a 0/1 flag, or zeroed
 * until its floor is met, so every rule reads one metric.
 */
import { IxTime } from "~/lib/ixtime";
import { currentBudgetYear } from "~/lib/government/budget-year";
import { loadEffectiveBudget } from "~/lib/government/budget-allocations";
import { deriveBrokers } from "~/lib/statecraft/power-brokers";
import {
  MONTH_MS,
  distinctBuckets,
  longestConsecutiveWeeks,
  weekKey,
} from "~/lib/achievements/time-buckets";
import type { MetricContext, MetricLoader } from "./registry";
import { zeroed } from "./zeroed";

const DIRECTIVE_KEYS = [
  "directivesCommitted",
  "directivesCompletedCategories",
  "directiveWeeks",
  "directiveChainDepth",
  "directivesDisciplineOk",
] as const;

const ISSUE_KEYS = [
  "issuesAnswered",
  "issues100Over12Weeks",
  "issues250Over26Weeks",
  "issueDomainsAt15",
  "criticalStableGains",
  "issueCoverage6mOk",
  "issueLongestWeeks",
] as const;

/** "Full portfolio" counts only if the completions are spread over this many different weeks. */
const PORTFOLIO_MIN_WEEKS = 4;
const DISCIPLINE_MIN_COMMITTED = 30;
const DISCIPLINE_MIN_WEEKS = 10;
const DISCIPLINE_MAX_ABANDONED = 0.1;
const DOMAIN_MIN_ANSWERED = 15;
const COVERAGE_MIN_RAISED = 100;
const COVERAGE_MIN_ANSWERED_SHARE = 0.9;
const COVERAGE_WINDOW_MS = 6 * MONTH_MS;
const FISCAL_WINDOW_MS = 18 * MONTH_MS;
/** Budget years before this follow the pre-pivot clock and legacy rows, so they cannot be mapped to real dates. */
const FISCAL_FIRST_MAPPED_YEAR = 2040;
const GAME_EPOCH_YEAR = 2028;
const MAX_GAME_YEAR = 2200;

export interface DirectiveRow {
  id: string;
  category: string;
  status: string;
  parentId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/** Directives the player committed: an active, completed or abandoned row (a proposed one is a draft). */
const COMMITTED_STATUSES = ["active", "completed", "abandoned"];

/** Nodes in the longest `parentId` chain whose every node is completed. */
function longestCompletedChain(completed: DirectiveRow[]): number {
  const parentOf = new Map(completed.map((d) => [d.id, d.parentId]));
  const depth = (id: string, seen: Set<string>): number => {
    const parent = parentOf.get(id);
    if (!parent || !parentOf.has(parent) || seen.has(parent)) return 1;
    return 1 + depth(parent, new Set(seen).add(parent));
  };
  return Math.max(0, ...completed.map((d) => depth(d.id, new Set([d.id]))));
}

export function directiveMetrics(
  rows: DirectiveRow[]
): Record<(typeof DIRECTIVE_KEYS)[number], number> {
  const committed = rows.filter((d) => COMMITTED_STATUSES.includes(d.status));
  const completed = committed.filter((d) => d.status === "completed");
  const abandoned = committed.filter((d) => d.status === "abandoned");
  const weeks = distinctBuckets(
    committed.map((d) => d.createdAt),
    weekKey
  );
  const completionWeeks = distinctBuckets(
    completed.map((d) => d.updatedAt),
    weekKey
  );
  return {
    directivesCommitted: committed.length,
    directivesCompletedCategories:
      completionWeeks >= PORTFOLIO_MIN_WEEKS ? new Set(completed.map((d) => d.category)).size : 0,
    directiveWeeks: weeks,
    directiveChainDepth: longestCompletedChain(completed),
    directivesDisciplineOk: Number(
      committed.length >= DISCIPLINE_MIN_COMMITTED &&
        weeks >= DISCIPLINE_MIN_WEEKS &&
        abandoned.length / committed.length <= DISCIPLINE_MAX_ABANDONED
    ),
  };
}

export const directivesLoader: MetricLoader = {
  id: "executive-directives",
  scope: "country",
  keys: DIRECTIVE_KEYS,
  async load({ db, countryId }) {
    if (!countryId) return zeroed(DIRECTIVE_KEYS);
    const rows = await db.intent.findMany({
      where: { countryId, status: { in: COMMITTED_STATUSES } },
      select: {
        id: true,
        category: true,
        status: true,
        parentId: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    return directiveMetrics(rows);
  },
};

export interface IssueRow {
  id: string;
  domain: string;
  severity: string;
  createdAt: Date;
  respondedAt: Date | null;
}

/** `Priority` holds both casings of each level. */
const isCritical = (severity: string) => severity.toLowerCase() === "critical";

export interface IssueInput {
  /** Every issue the player answered (`status: "responded"`; auto-resolved and dismissed are not answers). */
  answered: IssueRow[];
  /** How many issues were raised in the trailing 6 months, whatever became of them. */
  raisedInWindow: number;
  /** Net stability delta of each critical answered issue that has stability consequences. */
  criticalStabilityNet: ReadonlyMap<string, number>;
  now: Date;
}

export function issueMetrics({
  answered,
  raisedInWindow,
  criticalStabilityNet,
  now,
}: IssueInput): Record<(typeof ISSUE_KEYS)[number], number> {
  const times = answered.flatMap((i) => (i.respondedAt ? [i.respondedAt] : []));
  const weeks = distinctBuckets(times, weekKey);
  const byDomain = new Map<string, number>();
  for (const issue of answered) byDomain.set(issue.domain, (byDomain.get(issue.domain) ?? 0) + 1);
  const windowStart = now.getTime() - COVERAGE_WINDOW_MS;
  const answeredInWindow = answered.filter((i) => i.createdAt.getTime() >= windowStart).length;
  const critical = answered.filter((i) => isCritical(i.severity));
  return {
    issuesAnswered: answered.length,
    issues100Over12Weeks: Number(answered.length >= 100 && weeks >= 12),
    issues250Over26Weeks: Number(answered.length >= 250 && weeks >= 26),
    issueDomainsAt15: [...byDomain.values()].filter((n) => n >= DOMAIN_MIN_ANSWERED).length,
    criticalStableGains: critical.filter((i) => (criticalStabilityNet.get(i.id) ?? 0) >= 0).length,
    issueCoverage6mOk: Number(
      raisedInWindow >= COVERAGE_MIN_RAISED &&
        answeredInWindow / raisedInWindow >= COVERAGE_MIN_ANSWERED_SHARE
    ),
    issueLongestWeeks: longestConsecutiveWeeks(times),
  };
}

export const issuesLoader: MetricLoader = {
  id: "executive-issues",
  scope: "country",
  keys: ISSUE_KEYS,
  async load({ db, countryId, now }) {
    if (!countryId) return zeroed(ISSUE_KEYS);
    const [answered, raisedInWindow, stability] = await Promise.all([
      db.nationalIssue.findMany({
        where: { countryId, status: "responded" },
        select: {
          id: true,
          domain: true,
          severity: true,
          createdAt: true,
          respondedAt: true,
        },
      }),
      db.nationalIssue.count({
        where: { countryId, createdAt: { gte: new Date(now.getTime() - COVERAGE_WINDOW_MS) } },
      }),
      db.nationalIssueConsequence.groupBy({
        by: ["issueId"],
        where: {
          targetModel: "InternalStabilityMetrics",
          targetField: "stabilityScore",
          issue: { countryId, status: "responded", severity: { in: ["critical", "CRITICAL"] } },
        },
        _sum: { deltaValue: true },
      }),
    ]);
    const criticalStabilityNet = new Map(stability.map((g) => [g.issueId, g._sum.deltaValue ?? 0]));
    return issueMetrics({ answered, raisedInWindow, criticalStabilityNet, now });
  },
};

/** Power brokers satisfied right now, from the same inputs as the MyCountry politics drill-down. */
export const brokersLoader: MetricLoader = {
  id: "executive-brokers",
  scope: "country",
  keys: ["brokersSatisfied"],
  async load({ db, countryId, now }) {
    if (!countryId) return zeroed(["brokersSatisfied"]);
    const [components, budget] = await Promise.all([
      db.governmentComponent.findMany({
        where: { countryId, isActive: true },
        select: { componentType: true },
      }),
      loadEffectiveBudget(db, countryId, { currentYear: gameYearAt(now) }),
    ]);
    const spendByCategory: Record<string, number> = {};
    for (const { department, allocatedPercent } of budget.allocations) {
      spendByCategory[department.category] =
        (spendByCategory[department.category] ?? 0) + allocatedPercent;
    }
    const brokers = deriveBrokers(
      components.map((c) => c.componentType),
      spendByCategory
    );
    return { brokersSatisfied: brokers.filter((b) => b.satisfied).length };
  },
};

/** The budget year (IxTime game year) in effect at the real instant, as the budget writers see it. */
const gameYearAt = (at: Date): number => currentBudgetYear(IxTime.convertToIxTime(at.getTime()));

/**
 * Real start (inclusive) and end (exclusive) of a budget year. A game year is 365.25 IxTime days
 * from the 2028 epoch (`IxTime.getCurrentGameYear`), mapped back to real time.
 */
const budgetYearSpan = (year: number): { start: number; end: number } => {
  const startOf = (y: number) =>
    IxTime.convertFromIxTime(IxTime.addYears(IxTime.getInGameEpoch(), y - GAME_EPOCH_YEAR));
  return { start: startOf(year), end: startOf(year + 1) };
};

/** Budget years that overlap the 18 months before `now`, oldest first. */
export function fiscalWindowYears(now: Date): number[] {
  const windowStart = now.getTime() - FISCAL_WINDOW_MS;
  const years: number[] = [];
  for (let year = GAME_EPOCH_YEAR; year < MAX_GAME_YEAR; year++) {
    const { start, end } = budgetYearSpan(year);
    if (start > now.getTime()) break;
    if (end > windowStart) years.push(year);
  }
  return years;
}

/**
 * 1 when every budget year overlapping the last 18 months has an allocation and the country has
 * been owned for 18 months or more (`ownedSince`; null is not met). Allocation rows are rewritten
 * whenever the builder saves, so their `createdAt` says nothing; ownership stops a new owner from
 * claiming a history they did not keep. The years are contiguous, so the first one holds the
 * window start; if it predates the mappable years the window is not covered yet.
 */
export function fiscalStewardFlag(
  now: Date,
  budgetYears: ReadonlySet<number>,
  ownedSince: Date | null
): number {
  const years = fiscalWindowYears(now);
  const owned = ownedSince !== null && ownedSince.getTime() <= now.getTime() - FISCAL_WINDOW_MS;
  return Number(
    owned &&
      years.length > 0 &&
      years[0]! >= FISCAL_FIRST_MAPPED_YEAR &&
      years.every((year) => budgetYears.has(year))
  );
}

const BUDGET_KEYS = ["budgetCurrentYear", "fiscalSteward18m"] as const;

async function loadBudgetMetrics({ db, countryId, now }: MetricContext) {
  if (!countryId) return zeroed(BUDGET_KEYS);
  const years = fiscalWindowYears(now);
  const [current, withBudget, country] = await Promise.all([
    db.budgetAllocation.count({
      where: { governmentStructure: { countryId }, budgetYear: gameYearAt(now) },
    }),
    db.budgetAllocation.groupBy({
      by: ["budgetYear"],
      where: {
        governmentStructure: { countryId },
        budgetYear: { gte: years[0] ?? 0, lte: years[years.length - 1] ?? 0 },
      },
    }),
    db.country.findUnique({ where: { id: countryId }, select: { ownedSince: true } }),
  ]);
  const budgetYears = new Set(withBudget.map((g) => g.budgetYear));
  return {
    budgetCurrentYear: current,
    fiscalSteward18m: fiscalStewardFlag(now, budgetYears, country?.ownedSince ?? null),
  };
}

export const budgetLoader: MetricLoader = {
  id: "executive-budget",
  scope: "country",
  keys: BUDGET_KEYS,
  load: loadBudgetMetrics,
};

export const EXECUTIVE_LOADERS: MetricLoader[] = [
  directivesLoader,
  issuesLoader,
  brokersLoader,
  budgetLoader,
];
