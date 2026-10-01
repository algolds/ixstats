/**
 * src/lib/wiki-os/services/auto-sync-service.ts — WikiOS recent-changes sync
 *
 * Reads MediaWiki recent changes and brings them into PostgreSQL one revision at a time, oldest
 * first: a revision made on top of WikiOS's head is imported, WikiOS's own edits coming back are
 * recognised, and a revision that conflicts is parked (inbound-revision-sync.ts holds the rule).
 * runAutoSyncCycle runs from the `wiki-recentchanges` cron job (src/server/cron/jobs.ts) and from the
 * /api/wikios/inbound-sync webhook; there is no in-process daemon.
 */

import { db } from "~/server/db";
import { fetchRecentChangesPage, plainTitle, type RecentChange } from "./inbound-mediawiki";
import { syncLatestRevision, syncRevisionById, type RevisionOutcome } from "./inbound-revision-sync";

export interface AutoSyncStats {
  pagesChecked: number;
  pagesUpdated: number;
  revisionsCreated: number;
  lastRunAt: Date | null;
}

const lastStats: AutoSyncStats = {
  pagesChecked: 0,
  pagesUpdated: 0,
  revisionsCreated: 0,
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

/** SystemConfig key holding the timestamp of the newest recent change already synced. */
const HWM_KEY = "wikiAutoSync.rcHighWater";
/** Changes per recentchanges request once a high-water mark exists. */
const RC_PAGE_LIMIT = 50;
/** Most recentchanges pages followed (via rccontinue) in one cycle. */
const MAX_RC_PAGES = 10;

async function readHighWater(): Promise<string | null> {
  const row = await db.systemConfig.findUnique({
    where: { key: HWM_KEY },
    select: { value: true },
  });
  return row?.value || null;
}

async function writeHighWater(value: string): Promise<void> {
  await db.systemConfig.upsert({
    where: { key: HWM_KEY },
    create: { key: HWM_KEY, value },
    update: { value },
  });
}

/**
 * Recent changes to sync, oldest first. Without a high-water mark only the latest `limit`
 * changes are read; with one, every change since it (up to MAX_RC_PAGES pages).
 */
async function collectRecentChanges(
  highWater: string | null,
  limit: number
): Promise<RecentChange[]> {
  if (!highWater) {
    const latest = await fetchRecentChangesPage({ rclimit: String(limit) });
    return latest.entries.reverse();
  }

  const changes: RecentChange[] = [];
  let params: Record<string, string> = {
    rcdir: "newer",
    rcstart: highWater,
    rclimit: String(RC_PAGE_LIMIT),
  };
  for (let pageCount = 0; pageCount < MAX_RC_PAGES; pageCount++) {
    const page = await fetchRecentChangesPage(params);
    changes.push(...page.entries);
    if (!page.next) break;
    params = { ...params, ...page.next };
  }
  return changes;
}

/**
 * Sync changes in order. The returned high-water mark never passes a failed change, so the
 * failure is retried next cycle; later changes of other pages are still synced, those of the
 * failed page wait (they would be applied before the revision they build on).
 */
async function syncChanges(changes: RecentChange[]): Promise<{
  created: number;
  updated: number;
  highWater: string | null;
}> {
  const blockedTitles = new Set<string>();
  let created = 0;
  let updated = 0;
  let highWater: string | null = null;
  let failed = false;

  for (const rc of changes) {
    const subject = plainTitle(rc.title);
    if (rc.revid > 0 && subject && !blockedTitles.has(subject)) {
      try {
        const outcome = await syncRevisionById(rc.revid);
        if (CREATED.has(outcome)) created++;
        if (outcome === "fast-forward") updated++;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`[WikiAutoSync] Error syncing page "${rc.title}":`, message);
        blockedTitles.add(subject);
        failed = true;
      }
    }
    if (!failed && rc.timestamp) highWater = rc.timestamp;
  }

  return { created, updated, highWater };
}

export async function runAutoSyncCycle(limit = 30): Promise<AutoSyncStats> {
  if (isSyncing) return lastStats;
  isSyncing = true;

  try {
    const previousHighWater = await readHighWater();
    const changes = await collectRecentChanges(previousHighWater, limit);
    lastStats.pagesChecked = changes.length;

    const { created, updated, highWater } = await syncChanges(changes);
    if (highWater && highWater !== previousHighWater) await writeHighWater(highWater);

    lastStats.pagesUpdated = updated;
    lastStats.revisionsCreated = created;
    lastStats.lastRunAt = new Date();
    if (created > 0) {
      console.log(`[WikiAutoSync] Auto-synced ${created} new revisions from MediaWiki into PostgreSQL.`);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[WikiAutoSync] Cycle failed:", message);
  } finally {
    isSyncing = false;
  }

  return lastStats;
}
