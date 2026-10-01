/**
 * src/lib/wiki-os/services/auto-sync-service.ts — WikiOS recent-changes sync
 *
 * Reads MediaWiki recent changes and log events and brings them into PostgreSQL in the order they
 * happened, one at a time. A revision made on top of WikiOS's head is imported, WikiOS's own edits
 * coming back are recognised, and a revision that conflicts is parked (inbound-revision-sync.ts holds
 * the rule); deletes, moves, protections, blocks and rights changes are applied from the log
 * (inbound-log-events.ts). runAutoSyncCycle runs from the `wiki-recentchanges` cron job
 * (src/server/cron/jobs.ts) and from the /api/wikios/inbound-sync webhook; there is no in-process daemon.
 */

import { db } from "~/server/db";
import {
  fetchLogEventsPage,
  fetchRecentChangesPage,
  plainTitle,
  type ListPage,
  type LogEvent,
  type RecentChange,
} from "./inbound-mediawiki";
import { applyLogEvent } from "./inbound-log-events";
import { syncLatestRevision, syncRevisionById, type RevisionOutcome } from "./inbound-revision-sync";

export interface AutoSyncStats {
  /** Recent changes and log events read in the last cycle. */
  pagesChecked: number;
  pagesUpdated: number;
  revisionsCreated: number;
  /** Log events applied (a delete, move, protection, block or rights change). */
  eventsApplied: number;
  lastRunAt: Date | null;
}

const lastStats: AutoSyncStats = {
  pagesChecked: 0,
  pagesUpdated: 0,
  revisionsCreated: 0,
  eventsApplied: 0,
  lastRunAt: null,
};

let isSyncing = false;

/** Outcomes that left WikiOS with a new revision. */
const CREATED: ReadonlySet<RevisionOutcome> = new Set(["fast-forward", "parked"]);
/** Outcomes after which the page exists in WikiOS as MediaWiki has it (or as WikiOS keeps it). */
const SYNCED: ReadonlySet<RevisionOutcome> = new Set(["known", "echo", "fast-forward", "parked"]);

/**
 * Sync one page's newest revision (the webhook, the reader's import of a page Postgres lacks).
 * Never throws: false on any failure, when MediaWiki has no such page, and when the revision is a
 * conflict, which the ordered cycle parks.
 */
export async function syncSinglePage(title: string): Promise<boolean> {
  try {
    return SYNCED.has(await syncLatestRevision(title));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[WikiAutoSync] Error syncing page "${title}":`, message);
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

type Stream = "edits" | "log";

interface StepResult {
  /** The step left WikiOS with a new revision / a changed page / an applied log event. */
  created: number;
  updated: number;
  applied: number;
}

/** One recent change or log event, in the order MediaWiki recorded it. */
interface SyncStep {
  stream: Stream;
  timestamp: string;
  /** What a failure holds back: later steps about the same page wait for the retry. */
  subject: string;
  label: string;
  run: () => Promise<StepResult>;
}

const NOTHING: StepResult = { created: 0, updated: 0, applied: 0 };

function editStep(rc: RecentChange): SyncStep {
  return {
    stream: "edits",
    timestamp: rc.timestamp,
    subject: plainTitle(rc.title),
    label: rc.title,
    run: async () => {
      const outcome = await syncRevisionById(rc.revid);
      return {
        created: CREATED.has(outcome) ? 1 : 0,
        updated: outcome === "fast-forward" ? 1 : 0,
        applied: 0,
      };
    },
  };
}

function logStep(event: LogEvent): SyncStep {
  return {
    stream: "log",
    timestamp: event.timestamp,
    subject: plainTitle(event.title),
    label: `${event.type}/${event.action} ${event.title}`,
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
 * Run the steps in order. A stream's high-water mark never passes a failed step, so the failure is
 * retried next cycle; later steps about other pages still run, those about the failed page wait (they
 * would be applied before the revision they build on).
 */
async function runSteps(steps: SyncStep[]): Promise<StepsResult> {
  const result: StepsResult = { ...NOTHING, highWater: { edits: null, log: null } };
  const blocked = new Set<string>();
  const failedStreams = new Set<Stream>();

  for (const step of chronological(steps)) {
    if (!blocked.has(step.subject)) {
      try {
        const done = await step.run();
        result.created += done.created;
        result.updated += done.updated;
        result.applied += done.applied;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`[WikiAutoSync] Error syncing ${step.label}:`, message);
        blocked.add(step.subject);
        failedStreams.add(step.stream);
      }
    }
    if (!failedStreams.has(step.stream) && step.timestamp) {
      result.highWater[step.stream] = step.timestamp;
    }
  }
  return result;
}

export async function runAutoSyncCycle(limit = 30): Promise<AutoSyncStats> {
  if (isSyncing) return lastStats;
  isSyncing = true;

  try {
    const [rcMark, logMark] = await Promise.all([
      readHighWater(RC_HWM_KEY),
      readHighWater(LOG_HWM_KEY),
    ]);
    const changes = await collectList(rcMark, limit, "rc", fetchRecentChangesPage);
    const events = await collectList(logMark, limit, "le", fetchLogEventsPage);
    lastStats.pagesChecked = changes.length + events.length;

    const done = await runSteps([...changes.map(editStep), ...events.map(logStep)]);
    if (done.highWater.edits && done.highWater.edits !== rcMark) {
      await writeHighWater(RC_HWM_KEY, done.highWater.edits);
    }
    if (done.highWater.log && done.highWater.log !== logMark) {
      await writeHighWater(LOG_HWM_KEY, done.highWater.log);
    }

    lastStats.pagesUpdated = done.updated;
    lastStats.revisionsCreated = done.created;
    lastStats.eventsApplied = done.applied;
    lastStats.lastRunAt = new Date();
    if (done.created + done.applied > 0) {
      console.log(
        `[WikiAutoSync] Synced ${done.created} revisions and ${done.applied} log events from MediaWiki into PostgreSQL.`
      );
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[WikiAutoSync] Cycle failed:", message);
  } finally {
    isSyncing = false;
  }

  return lastStats;
}
