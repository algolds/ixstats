/**
 * The scheduled-job table (plan 330). cron-runner.mjs is the ONLY scheduler: it imports every
 * row's module at startup (exiting non-zero if any fails), schedules the rows named in
 * CRON_ENABLED_JOBS, and runs each one under the advisory job lock `lockName`
 * (src/lib/system/job-lock.ts).
 *
 * Adding a job: add a row here (jobs.test.ts checks `modulePath` and `exportName` against the
 * source), then the operator adds its name to CRON_ENABLED_JOBS. Lock names are shared with any
 * manual trigger of the same job (e.g. `manualDistribution` uses "passive-income"); never
 * rename one without updating those callers.
 *
 * Static imports stay out of this file: `load` imports each job lazily so the table can be read
 * without loading Prisma.
 */
import { isValidCronPattern } from "./scheduler";

type CronJobResult = object | number;
type CronJobRun = () => Promise<CronJobResult>;

interface CronJobDefinition {
  /** Stable kebab-case id; used in CRON_ENABLED_JOBS. */
  name: string;
  /** 5-field UTC cron. */
  defaultSchedule: string;
  /** SystemConfig key whose value may override the schedule. */
  scheduleConfigKey?: string;
  /** Advisory lock name (withJobLock). Jobs sharing a name never overlap. */
  lockName: string;
  /** Lock transaction timeout; raise it if logs show "Transaction already closed". */
  timeoutMs: number;
  /** `~/` specifier of the module `load` imports (checked by jobs.test.ts). */
  modulePath: string;
  exportName: string;
  load: () => Promise<CronJobRun>;
}

const MINUTE = 60_000;

export const CRON_JOBS: readonly CronJobDefinition[] = [
  {
    name: "auction-completion",
    defaultSchedule: "* * * * *",
    lockName: "auction-completion",
    timeoutMs: 5 * MINUTE,
    modulePath: "~/lib/economy/auction-completion-cron",
    exportName: "processExpiredAuctions",
    load: async () =>
      (await import("~/lib/economy/auction-completion-cron")).processExpiredAuctions,
  },
  {
    name: "passive-income",
    defaultSchedule: "0 0 * * *",
    scheduleConfigKey: "cronSchedule_passiveIncome",
    lockName: "passive-income",
    timeoutMs: 30 * MINUTE,
    modulePath: "~/lib/economy/passive-income-distribution-cron",
    exportName: "distributePassiveIncome",
    load: async () =>
      (await import("~/lib/economy/passive-income-distribution-cron")).distributePassiveIncome,
  },
  {
    name: "card-values",
    defaultSchedule: "0 */6 * * *",
    scheduleConfigKey: "cronSchedule_cardValue",
    lockName: "card-value",
    timeoutMs: 30 * MINUTE,
    modulePath: "~/lib/lorewards/card-value-cron",
    exportName: "updateCardValues",
    load: async () => (await import("~/lib/lorewards/card-value-cron")).updateCardValues,
  },
  {
    name: "lore-card-generation",
    defaultSchedule: "0 2 * * *",
    lockName: "lore-card-generation",
    timeoutMs: 60 * MINUTE,
    modulePath: "~/lib/lorewards/generation-cron",
    exportName: "generateDailyLoreCards",
    load: async () => (await import("~/lib/lorewards/generation-cron")).generateDailyLoreCards,
  },
  {
    name: "lorewards-full-sync",
    defaultSchedule: "0 6 * * *",
    scheduleConfigKey: "cronSchedule_lorewardsScoring",
    lockName: "lorewards",
    timeoutMs: 60 * MINUTE,
    modulePath: "~/lib/lorewards/sync",
    exportName: "fullSync",
    load: async () => (await import("~/lib/lorewards/sync")).fullSync,
  },
  {
    // Same lock as lorewards-full-sync: the two never overlap.
    name: "lorewards-state-sync",
    defaultSchedule: "*/10 * * * *",
    lockName: "lorewards",
    timeoutMs: 10 * MINUTE,
    modulePath: "~/lib/lorewards/sync",
    exportName: "syncFromStateFile",
    load: async () => (await import("~/lib/lorewards/sync")).syncFromStateFile,
  },
  {
    name: "trade-expiry",
    defaultSchedule: "*/5 * * * *",
    lockName: "trade-expiry",
    timeoutMs: 5 * MINUTE,
    modulePath: "~/lib/economy/trade-expiry-cron",
    exportName: "processExpiredTrades",
    load: async () => (await import("~/lib/economy/trade-expiry-cron")).processExpiredTrades,
  },
  {
    name: "sports-season-advance",
    defaultSchedule: "*/15 * * * *",
    lockName: "sports-advance",
    timeoutMs: 30 * MINUTE,
    modulePath: "~/lib/sports/season-cron",
    exportName: "advanceSportsSeasons",
    load: async () => {
      const [{ advanceSportsSeasons }, { db }] = await Promise.all([
        import("~/lib/sports/season-cron"),
        import("~/server/db"),
      ]);
      return () => advanceSportsSeasons(db);
    },
  },
  {
    name: "scheduled-changes",
    defaultSchedule: "*/10 * * * *",
    lockName: "scheduled-changes",
    timeoutMs: 10 * MINUTE,
    modulePath: "~/server/modules/scheduled-changes/service",
    exportName: "applyDueScheduledChanges",
    load: async () =>
      (await import("~/server/modules/scheduled-changes/service")).applyDueScheduledChanges,
  },
  {
    name: "elections",
    defaultSchedule: "*/10 * * * *",
    lockName: "elections",
    timeoutMs: 10 * MINUTE,
    modulePath: "~/lib/government/election-cron",
    exportName: "processDueElections",
    load: async () => (await import("~/lib/government/election-cron")).processDueElections,
  },
  {
    name: "politics-drift",
    defaultSchedule: "0 */6 * * *",
    lockName: "politics-drift",
    timeoutMs: 30 * MINUTE,
    modulePath: "~/lib/government/politics-drift-cron",
    exportName: "runPoliticsDrift",
    load: async () => (await import("~/lib/government/politics-drift-cron")).runPoliticsDrift,
  },
  {
    name: "diplomatic-drift",
    defaultSchedule: "0 */6 * * *",
    lockName: "diplomatic-drift",
    timeoutMs: 30 * MINUTE,
    modulePath: "~/lib/diplomacy/drift-cron",
    exportName: "runDiplomaticDrift",
    load: async () => (await import("~/lib/diplomacy/drift-cron")).runDiplomaticDrift,
  },
  {
    // Debits national treasuries every 6 h.
    name: "policy-maintenance",
    defaultSchedule: "0 */6 * * *",
    lockName: "policy-maintenance",
    timeoutMs: 30 * MINUTE,
    modulePath: "~/lib/policies/maintenance-cron",
    exportName: "runPolicyMaintenanceDebits",
    load: async () => (await import("~/lib/policies/maintenance-cron")).runPolicyMaintenanceDebits,
  },
  {
    name: "national-issues",
    defaultSchedule: "*/30 * * * *",
    lockName: "national-issues",
    timeoutMs: 30 * MINUTE,
    modulePath: "~/lib/national-issues/generation-cron",
    exportName: "generateNationalIssues",
    load: async () =>
      (await import("~/lib/national-issues/generation-cron")).generateNationalIssues,
  },
  {
    name: "wiki-recentchanges",
    defaultSchedule: "*/10 * * * *",
    scheduleConfigKey: "cronSchedule_wikiRecentChanges",
    lockName: "wiki-recentchanges",
    timeoutMs: 10 * MINUTE,
    modulePath: "~/lib/wiki-os/services/auto-sync-service",
    exportName: "runAutoSyncCycle",
    load: async () => (await import("~/lib/wiki-os/services/auto-sync-service")).runAutoSyncCycle,
  },
  {
    // Once per new IxTime year, remind each owned country to set that year's budget (MC-1).
    name: "budget-year-rollover",
    defaultSchedule: "41 * * * *",
    lockName: "budget-year-rollover",
    timeoutMs: 10 * MINUTE,
    modulePath: "~/lib/government/budget-year-rollover-cron",
    exportName: "runBudgetYearRollover",
    load: async () =>
      (await import("~/lib/government/budget-year-rollover-cron")).runBudgetYearRollover,
  },
  {
    // Persists the economic projection into stored current* stats + monthly history (MC-7),
    // then refreshes stored internal stability (viewing it no longer writes, MC-13).
    // Same lock as the admin forceRecalculation button.
    name: "stat-progression",
    defaultSchedule: "23 */6 * * *",
    scheduleConfigKey: "cronSchedule_statProgression",
    lockName: "stat-progression",
    timeoutMs: 30 * MINUTE,
    modulePath: "~/server/cron/stat-progression",
    exportName: "runStatProgression",
    load: async () => {
      const { runStatProgression } = await import("~/server/cron/stat-progression");
      const { refreshStoredInternalStability } = await import("~/lib/statecraft/stability-store");
      const { db } = await import("~/server/db");
      return async () => ({
        ...(await runStatProgression({ db })),
        stability: await refreshStoredInternalStability(db),
      });
    },
  },
  {
    // Engagement-decay trending for ThinkPages posts + TrendingTopic hashtags; also reconciles
    // the posts' like/reply/repost counters.
    name: "thinkpages-trending",
    defaultSchedule: "*/15 * * * *",
    scheduleConfigKey: "cronSchedule_thinkpagesTrending",
    lockName: "thinkpages-trending",
    timeoutMs: 10 * MINUTE,
    modulePath: "~/lib/thinkpages/trending-cron",
    exportName: "runThinkPagesTrending",
    load: async () => (await import("~/lib/thinkpages/trending-cron")).runThinkPagesTrending,
  },
  {
    // Evaluates achievements (account-level and active-country) for users seen recently.
    name: "achievements-evaluate",
    defaultSchedule: "41 * * * *",
    lockName: "achievements-evaluate",
    timeoutMs: 30 * MINUTE,
    modulePath: "~/lib/achievements/evaluate-cron",
    exportName: "runAchievementsEvaluate",
    load: async () => (await import("~/lib/achievements/evaluate-cron")).runAchievementsEvaluate,
  },
  {
    // pg_dump to backups/ in the runner's cwd, keeping the newest 14 (PL-11).
    name: "db-backup",
    defaultSchedule: "17 3 * * *",
    lockName: "db-backup",
    timeoutMs: 60 * MINUTE,
    modulePath: "~/lib/system/db-backup",
    exportName: "runDatabaseBackup",
    load: async () => (await import("~/lib/system/db-backup")).runDatabaseBackup,
  },
];

/** `"*"` enables every job; unset or empty enables none. Names are comma-separated. */
export function resolveEnabledJobs(
  allowlist: string | undefined,
  jobs: readonly CronJobDefinition[] = CRON_JOBS
): { enabled: CronJobDefinition[]; unknown: string[] } {
  const names = (allowlist ?? "")
    .split(",")
    .map((name) => name.trim())
    .filter((name) => name.length > 0);
  const known = new Set(jobs.map((job) => job.name));
  const enabled = names.includes("*") ? [...jobs] : jobs.filter((job) => names.includes(job.name));
  return { enabled, unknown: names.filter((name) => name !== "*" && !known.has(name)) };
}

/** The SystemConfig override when it is a valid pattern, otherwise the default. */
export function resolveSchedule(
  job: CronJobDefinition,
  overrides: ReadonlyMap<string, string>
): string {
  const override = job.scheduleConfigKey ? overrides.get(job.scheduleConfigKey)?.trim() : undefined;
  if (!override) return job.defaultSchedule;
  if (isValidCronPattern(override)) return override;
  console.warn(
    `[Cron] Ignoring invalid ${job.scheduleConfigKey} "${override}" for ${job.name}; using ${job.defaultSchedule}`
  );
  return job.defaultSchedule;
}

/** One-line log summary of a job's result, capped so a large result cannot flood the log. */
export function summarizeResult(result: CronJobResult): string {
  try {
    return JSON.stringify(result).slice(0, 300);
  } catch {
    return "[unserializable result]";
  }
}
