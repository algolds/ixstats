/**
 * src/lib/wiki-os/services/auto-sync-service.ts — WikiOS recent-changes sync
 *
 * Reads MediaWiki recent changes and log events and brings them into PostgreSQL in the order they
 * happened, one at a time. A revision made on top of WikiOS's head is imported, WikiOS's own edits
 * coming back are recognised, and a revision that collides with a WikiOS edit goes through the conflict
 * rule (inbound-revision-sync.ts); deletes, moves, protections, blocks and rights changes are applied
 * from the log (inbound-log-events.ts). After its steps every cycle settles the conflict log
 * (conflict-notices.ts): the overwritten authors are told and classic winners get their trail.
 * runAutoSyncCycle runs from the `wiki-recentchanges` cron job (src/server/cron/jobs.ts) and from the
 * /api/wikios/inbound-sync webhook; there is no in-process daemon.
 *
 * One sync runs at a time across processes (a Postgres advisory lock): revisions of a page must be
 * applied in order, and the cron job, the webhook and the reader's import must not interleave. A failure
 * is logged and counted, never swallowed; each cycle leaves its outcome in SystemConfig for the health
 * telemetry (`getInboundSyncStatus`). A step that fails in five cycles is quarantined to a dead-letter row
 * (inbound-dead-letters.ts) and the mark moves past it, so one bad step cannot stall the sync.
 */

import { z } from "zod";
import { db } from "~/server/db";
import { withJobLock } from "~/lib/system/job-lock";
import {
  fetchLogEventsPage,
  fetchRecentChangesPage,
  plainTitle,
  type ListPage,
  type LogEvent,
  type RecentChange,
} from "./inbound-mediawiki";
import { applyLogEvent } from "./inbound-log-events";
import {
  syncLatestRevision,
  syncRevisionById,
  type RevisionOutcome,
} from "./inbound-revision-sync";
import { settleConflicts } from "./conflict-notices";
import {
  INBOUND_LOCK,
  clearStepFailure,
  countQuarantined,
  loadFailingKeys,
  loadSettledKeys,
  recordStepFailure,
  type QuarantinableStep,
} from "./inbound-dead-letters";

export interface AutoSyncStats {
  /** Recent changes and log events read in the last cycle. */
  pagesChecked: number;
  pagesUpdated: number;
  revisionsCreated: number;
  /** Log events applied (a delete, move, protection, block or rights change). */
  eventsApplied: number;
  /** Reads and steps that failed in the last cycle (each is retried by the next one). */
  failures: number;
  /** The last failure of the last cycle that had one; null after a clean cycle. */
  lastError: string | null;
  /** Conflict-log rows the last settling left unsettled (someone still to tell, or a trail to write). */
  conflictsPending: number;
  lastRunAt: Date | null;
}

const lastStats: AutoSyncStats = {
  pagesChecked: 0,
  pagesUpdated: 0,
  revisionsCreated: 0,
  eventsApplied: 0,
  failures: 0,
  lastError: null,
  conflictsPending: 0,
  lastRunAt: null,
};

/** A cycle's lock is held at most this long (its cron job is cut off at 10 minutes). */
const CYCLE_LOCK_TIMEOUT_MS = 12 * 60_000;
/** A cycle starts no new step after this long: it must end well inside the lock above, with its marks correct. */
const CYCLE_STEP_BUDGET_MS = 9 * 60_000;
/** A cycle that finds the lock taken (a webhook's import, a reader's) tries again this many times, this far apart. */
const LOCK_RETRIES = 3;
const LOCK_RETRY_WAIT_MS = 2_000;

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
const SINGLE_PAGE_LOCK_TIMEOUT_MS = 60_000;

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/** Count a failure: it is logged where it happened, and the cycle's stats and status keep the last one. */
function recordFailure(what: string, err: unknown): void {
  lastStats.failures++;
  lastStats.lastError = `${what}: ${errorMessage(err)}`;
}

/** Outcomes that left WikiOS with a new revision. */
const CREATED: ReadonlySet<RevisionOutcome> = new Set([
  "older",
  "fast-forward",
  "won",
  "overwritten",
]);
/** Outcomes that gave the page a new head. */
const UPDATED: ReadonlySet<RevisionOutcome> = new Set(["fast-forward", "won"]);
/** Outcomes after which the page exists in WikiOS as MediaWiki has it (or as WikiOS keeps it). */
const SYNCED: ReadonlySet<RevisionOutcome> = new Set(["known", "echo", ...CREATED]);

/**
 * Sync one page's newest revision (the webhook, the reader's import of a page Postgres lacks). Takes
 * the same lock as the cycle, without waiting: false when a sync is running (the cycle will pick the
 * page up). Never throws: false on any failure, when MediaWiki has no such page, and when the revision
 * collides with a WikiOS edit, which the ordered cycle judges.
 */
export async function syncSinglePage(title: string): Promise<boolean> {
  try {
    const outcome = await withJobLock(db, INBOUND_LOCK, () => syncLatestRevision(title), {
      timeoutMs: SINGLE_PAGE_LOCK_TIMEOUT_MS,
    });
    return outcome.ran && SYNCED.has(outcome.result);
  } catch (err) {
    console.error(`[WikiAutoSync] Error syncing page "${title}":`, errorMessage(err));
    return false;
  }
}

/** SystemConfig keys holding the timestamp of the newest recent change / log event already synced. */
const RC_HWM_KEY = "wikiAutoSync.rcHighWater";
const LOG_HWM_KEY = "wikiAutoSync.logHighWater";
/** Entries per request once a high-water mark exists. */
const PAGE_LIMIT = 50;
/** Most pages followed (via the continue token) in one cycle, per list. */
const MAX_LIST_PAGES = 10;

async function readHighWater(key: string): Promise<string | null> {
  const row = await db.systemConfig.findUnique({ where: { key }, select: { value: true } });
  return row?.value || null;
}

async function writeHighWater(key: string, value: string): Promise<void> {
  await db.systemConfig.upsert({ where: { key }, create: { key, value }, update: { value } });
}

/** The log mark is "<timestamp>|<log id>": events at the mark's second up to that id are done (applied, or skipped for good). */
const LOG_MARK_SEPARATOR = "|";

interface LogMark {
  timestamp: string;
  logid: number | null;
}

function parseLogMark(value: string | null): LogMark | null {
  if (!value) return null;
  const [timestamp = "", id] = value.split(LOG_MARK_SEPARATOR);
  const logid = Number(id);
  return { timestamp, logid: id !== undefined && Number.isInteger(logid) ? logid : null };
}

/**
 * The events the mark has not covered. A list read from a timestamp starts at that second, so its last
 * event(s) come back; an event skipped on purpose leaves no log row to recognise it by, so the id says it is done.
 */
function pastMark(events: LogEvent[], mark: LogMark | null): LogEvent[] {
  const doneUpTo = mark?.logid;
  if (!mark || doneUpTo === null || doneUpTo === undefined) return events;
  return events.filter((event) => event.timestamp !== mark.timestamp || event.logid > doneUpTo);
}

/**
 * Entries of a MediaWiki list to sync, oldest first. Without a high-water mark only the latest `limit`
 * are read; with one, every entry since it (up to MAX_LIST_PAGES pages). `names` is the list's own
 * parameter prefix ("rc" for recentchanges, "le" for logevents).
 */
async function collectList<T>(
  highWater: string | null,
  limit: number,
  prefix: "rc" | "le",
  fetchPage: (params: Record<string, string>) => Promise<ListPage<T>>
): Promise<T[]> {
  if (!highWater) {
    const latest = await fetchPage({ [`${prefix}limit`]: String(limit) });
    return latest.entries.reverse();
  }

  const entries: T[] = [];
  let params: Record<string, string> = {
    [`${prefix}dir`]: "newer",
    [`${prefix}start`]: highWater,
    [`${prefix}limit`]: String(PAGE_LIMIT),
  };
  for (let pageCount = 0; pageCount < MAX_LIST_PAGES; pageCount++) {
    const page = await fetchPage(params);
    entries.push(...page.entries);
    if (!page.next) break;
    params = { ...params, ...page.next };
  }
  return entries;
}

type Stream = QuarantinableStep["stream"];

interface StepResult {
  /** The step left WikiOS with a new revision / a changed page / an applied log event. */
  created: number;
  updated: number;
  applied: number;
}

/**
 * One recent change or log event, in the order MediaWiki recorded it. `mark` is what the stream's high-water mark
 * becomes once it is done (a timestamp, for the log with its id); `subject` is what a failure holds back (later steps
 * about the same page wait for the retry); `key` and `payload` are its dead-letter row's.
 */
interface SyncStep extends QuarantinableStep {
  timestamp: string;
  run: () => Promise<StepResult>;
}

const NOTHING: StepResult = { created: 0, updated: 0, applied: 0 };

function editStep(rc: RecentChange): SyncStep {
  return {
    key: `rc:${rc.revid}`,
    stream: "edits",
    timestamp: rc.timestamp,
    mark: rc.timestamp,
    subject: plainTitle(rc.title),
    label: rc.title,
    payload: { ...rc },
    run: async () => {
      const outcome = await syncRevisionById(rc.revid);
      return {
        created: CREATED.has(outcome) ? 1 : 0,
        updated: UPDATED.has(outcome) ? 1 : 0,
        applied: 0,
      };
    },
  };
}

function logStep(event: LogEvent): SyncStep {
  return {
    key: `log:${event.logid}`,
    stream: "log",
    timestamp: event.timestamp,
    mark: `${event.timestamp}${LOG_MARK_SEPARATOR}${event.logid}`,
    subject: plainTitle(event.title),
    label: `${event.type}/${event.action} ${event.title}`,
    payload: { ...event },
    run: async () => ({ ...NOTHING, applied: (await applyLogEvent(event)) === "applied" ? 1 : 0 }),
  };
}

/**
 * The order MediaWiki recorded things in: by time, and a log event before an edit of the same second
 * (a page deleted and created again, a page moved over its redirect, is deleted or moved first).
 */
function chronological(steps: SyncStep[]): SyncStep[] {
  const rank = (step: SyncStep) => (step.stream === "log" ? 0 : 1);
  return [...steps].sort((a, b) =>
    a.timestamp === b.timestamp ? rank(a) - rank(b) : a.timestamp < b.timestamp ? -1 : 1
  );
}

interface StepsResult extends StepResult {
  highWater: Record<Stream, string | null>;
}

/**
 * Count a failed step in the dead letters: true when that quarantines it (its fifth failed cycle, or it already was),
 * so it holds nothing back. A failure that cannot be counted holds the mark, as an uncounted failure always did.
 */
async function quarantines(step: SyncStep, err: unknown): Promise<boolean> {
  try {
    const { quarantined, attempts } = await recordStepFailure(step, errorMessage(err));
    if (quarantined) {
      console.warn(
        `[WikiAutoSync] ${step.label} has failed in ${attempts} cycles: quarantined, the sync moves past it.`
      );
    }
    return quarantined;
  } catch (countErr) {
    console.error(
      `[WikiAutoSync] Could not count the failure of ${step.label}:`,
      errorMessage(countErr)
    );
    return false;
  }
}

/** A step that failed before has succeeded: its count goes (a failure to forget it is counted, not fatal). */
async function forgetFailure(step: SyncStep): Promise<void> {
  try {
    await clearStepFailure(step.key);
  } catch (err) {
    console.error(
      `[WikiAutoSync] Could not clear the failures of ${step.label}:`,
      errorMessage(err)
    );
    recordFailure(`clearing ${step.label}`, err);
  }
}

/** Run one step into `result`; true when its failure holds its page and its stream back (it was not quarantined). */
async function runStep(step: SyncStep, result: StepResult, failing: Set<string>): Promise<boolean> {
  let done: StepResult;
  try {
    done = await step.run();
  } catch (err) {
    console.error(`[WikiAutoSync] Error syncing ${step.label}:`, errorMessage(err));
    recordFailure(step.label, err);
    return !(await quarantines(step, err));
  }
  result.created += done.created;
  result.updated += done.updated;
  result.applied += done.applied;
  if (failing.has(step.key)) await forgetFailure(step);
  return false;
}

/**
 * Run the steps in order until `deadline`. A stream's high-water mark never passes a step that was not
 * applied: not a failed one (retried next cycle), not one held back because an earlier step about the same
 * page failed (applied before the revision it builds on, it would be wrong), and not one the deadline cut
 * off. Steps about other pages still run after a failure. The exception is a quarantined step (failed in
 * QUARANTINE_AFTER cycles): it holds nothing back, so the mark moves past it and the page's later steps run.
 * `failing` are the keys with a dead-letter row, whose success clears it.
 */
async function runSteps(
  steps: SyncStep[],
  deadline: number,
  failing: Set<string>
): Promise<StepsResult> {
  const result: StepsResult = { ...NOTHING, highWater: { edits: null, log: null } };
  const blocked = new Set<string>();
  const failedStreams = new Set<Stream>();

  for (const step of chronological(steps)) {
    if (Date.now() >= deadline) {
      console.warn(
        "[WikiAutoSync] The cycle's time budget is spent: the rest waits for the next one."
      );
      break;
    }
    if (blocked.has(step.subject) || (await runStep(step, result, failing))) {
      blocked.add(step.subject);
      failedStreams.add(step.stream);
    }
    if (!failedStreams.has(step.stream) && step.timestamp) {
      result.highWater[step.stream] = step.mark;
    }
  }
  return result;
}

/**
 * `collectList` that never throws: a list that cannot be read is a failure of this cycle, and the stream
 * simply has nothing to do (its high-water mark stays), so the other stream still runs.
 */
async function collectOrNothing<T>(what: string, collect: () => Promise<T[]>): Promise<T[]> {
  try {
    return await collect();
  } catch (err) {
    console.error(`[WikiAutoSync] Could not read ${what}:`, errorMessage(err));
    recordFailure(`reading ${what}`, err);
    return [];
  }
}

/**
 * Tell whoever the conflict log still owes a notice and write the trails it lacks, under the cycle's lock. Never
 * throws: a failure is counted, and the rows wait for the next cycle.
 */
async function settleConflictLog(): Promise<void> {
  try {
    const settled = await settleConflicts();
    lastStats.conflictsPending = settled.pending;
  } catch (err) {
    console.error("[WikiAutoSync] Settling the conflict log failed:", errorMessage(err));
    recordFailure("settling conflicts", err);
  }
}

/** One cycle; the lock is held by the caller. Never throws: whatever fails is counted. */
async function runCycle(limit: number): Promise<void> {
  lastStats.failures = 0;
  lastStats.lastError = null;
  try {
    const deadline = Date.now() + CYCLE_STEP_BUDGET_MS;
    const [rcMark, logMarkValue] = await Promise.all([
      readHighWater(RC_HWM_KEY),
      readHighWater(LOG_HWM_KEY),
    ]);
    const logMark = parseLogMark(logMarkValue);
    const changes = await collectOrNothing("recent changes", () =>
      collectList(rcMark, limit, "rc", fetchRecentChangesPage)
    );
    const events = pastMark(
      await collectOrNothing("log events", () =>
        collectList(logMark?.timestamp ?? null, limit, "le", fetchLogEventsPage)
      ),
      logMark
    );
    lastStats.pagesChecked = changes.length + events.length;

    const steps = [...changes.map(editStep), ...events.map(logStep)];
    // a quarantined step resolved since (retried, resynced or dismissed) is not run again: the mark is already past it
    const [failing, settled] = await Promise.all([
      loadFailingKeys(),
      loadSettledKeys(steps.map((step) => step.key)),
    ]);
    const done = await runSteps(
      steps.filter((step) => !settled.has(step.key)),
      deadline,
      failing
    );
    if (done.highWater.edits && done.highWater.edits !== rcMark) {
      await writeHighWater(RC_HWM_KEY, done.highWater.edits);
    }
    if (done.highWater.log && done.highWater.log !== logMarkValue) {
      await writeHighWater(LOG_HWM_KEY, done.highWater.log);
    }

    lastStats.pagesUpdated = done.updated;
    lastStats.revisionsCreated = done.created;
    lastStats.eventsApplied = done.applied;
    if (done.created + done.applied > 0) {
      console.log(
        `[WikiAutoSync] Synced ${done.created} revisions and ${done.applied} log events from MediaWiki into PostgreSQL.`
      );
    }
  } catch (err) {
    console.error("[WikiAutoSync] Cycle failed:", errorMessage(err));
    recordFailure("cycle", err);
  }
  // after the steps, whatever they did: collisions recorded now (and earlier ones still open) are settled
  await settleConflictLog();
  lastStats.lastRunAt = new Date();
  await writeStatus();
}

/**
 * One sync cycle, unless another sync keeps running (in this or any other process) through three retries
 * 2 s apart: then the last stats are returned and nothing is read. Never throws.
 */
export async function runAutoSyncCycle(limit = 30): Promise<AutoSyncStats> {
  try {
    // A single-page import (the webhook, a reader) holds the lock for a moment: wait for it a little
    // rather than skip a whole cycle.
    for (let attempt = 0; attempt <= LOCK_RETRIES; attempt++) {
      const outcome = await withJobLock(db, INBOUND_LOCK, () => runCycle(limit), {
        timeoutMs: CYCLE_LOCK_TIMEOUT_MS,
      });
      if (outcome.ran || attempt === LOCK_RETRIES) break;
      await sleep(LOCK_RETRY_WAIT_MS);
    }
  } catch (err) {
    // The lock itself could not be taken (the database is down): nothing ran.
    console.error("[WikiAutoSync] Could not start a cycle:", errorMessage(err));
    recordFailure("starting the cycle", err);
  }
  return lastStats;
}

// ---------------------------------------------------------------------------
// Status for the health telemetry
// ---------------------------------------------------------------------------

const STATUS_KEY = "wikiAutoSync.status";
/** A cycle that has not run for this long means the cron job is not running. */
const STALE_AFTER_MS = 60 * 60_000;

const storedStatusSchema = z.object({
  lastRunAt: z.string(),
  failures: z.number(),
  lastError: z.string().nullable(),
  // absent from a status written before the conflict log was settled
  conflictsPending: z.number().default(0),
});

export interface InboundSyncStatus {
  /**
   * UNKNOWN: no cycle has run; STALE: none for an hour; DEGRADED: the last one had failures, or a quarantined step is
   * unresolved.
   */
  status: "ACTIVE" | "DEGRADED" | "STALE" | "UNKNOWN";
  lastRunAt: string | null;
  failures: number;
  lastError: string | null;
  /** Conflict-log rows the last cycle left unsettled: overwritten authors not told yet, or a trail not written. */
  conflictsPending: number;
  /** Quarantined steps nobody has retried or dismissed yet (read live, not from the last cycle). */
  quarantined: number;
}

/** What the last cycle left behind. Best effort: the sync does not depend on its own telemetry. */
async function writeStatus(): Promise<void> {
  const value = JSON.stringify({
    lastRunAt: lastStats.lastRunAt?.toISOString(),
    failures: lastStats.failures,
    lastError: lastStats.lastError,
    conflictsPending: lastStats.conflictsPending,
  });
  try {
    await db.systemConfig.upsert({
      where: { key: STATUS_KEY },
      create: { key: STATUS_KEY, value },
      update: { value },
    });
  } catch (err) {
    console.error("[WikiAutoSync] Could not store the sync status:", errorMessage(err));
  }
}

/** Whether the inbound sync is running and how its last cycle went (read from the database, so any process can ask). */
export async function getInboundSyncStatus(now = new Date()): Promise<InboundSyncStatus> {
  const [row, quarantined] = await Promise.all([
    db.systemConfig.findUnique({ where: { key: STATUS_KEY }, select: { value: true } }),
    countQuarantined(),
  ]);
  const unknown: InboundSyncStatus = {
    status: "UNKNOWN",
    lastRunAt: null,
    failures: 0,
    lastError: null,
    conflictsPending: 0,
    quarantined,
  };
  if (!row) return unknown;

  let stored: z.infer<typeof storedStatusSchema>;
  try {
    stored = storedStatusSchema.parse(JSON.parse(row.value));
  } catch {
    return unknown;
  }
  const age = now.getTime() - new Date(stored.lastRunAt).getTime();
  const degraded = stored.failures > 0 || quarantined > 0;
  const status = age > STALE_AFTER_MS ? "STALE" : degraded ? "DEGRADED" : "ACTIVE";
  return {
    status,
    lastRunAt: stored.lastRunAt,
    failures: stored.failures,
    lastError: stored.lastError,
    conflictsPending: stored.conflictsPending,
    quarantined,
  };
}
