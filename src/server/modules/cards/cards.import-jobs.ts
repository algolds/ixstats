/**
 * Server-side card imports (cards refresh spec §2.4): an import is a job of items, worked through by the
 * card-import-jobs cron and by a kick from the web process when a job starts, under one job lease, so closing the
 * admin tab never stops it. Items are claimed QUEUED → PROCESSING by compare-and-swap, oldest job first. A run reads
 * each wiki through one throttled discovery client: the licence reads through its query, the article reads through
 * its pace. A wiki that refuses or rate-limits (DiscoveryStopped) fails the job with its reason, leaves its items
 * queued for Retry and is read no more in that run. Any other failure is the item's, recorded with its reason: a
 * licence read the client gave up on (an HTTP error, a timeout) fails that item, and the next gets a fresh client.
 * A job's counters always equal its item rows: a cancelled item counts as skipped, and as processed.
 */
import type {
  CardImportItem,
  CardImportItemStatus,
  CardImportJob,
  CardImportJobKind,
  Prisma,
  PrismaClient,
} from "@prisma/client";
import { TRPCError } from "@trpc/server";
import { db as appDb } from "~/server/db";
import { withJobLock } from "~/lib/system/job-lock";
import {
  createDiscoveryClient,
  DISCOVERY_DELAY_MS,
  DiscoveryStopped,
  type DiscoveryStopKind,
} from "~/lib/realms/sources/wiki-discovery-client";
import {
  cardSourceLabel,
  parseCardWikiSource,
  type CardWikiSource,
} from "~/lib/cards/card-sources";
import { stoppedWikiMessage } from "~/lib/cards/lore-card-mediawiki";
import { getRarityThresholds } from "./cards.config";
import {
  stageArticleCard,
  stageCommonsFile,
  type ImportContext,
  type StageInput,
  type StageOutcome,
} from "./cards.importer";

export const IMPORT_LOCK = "card-import-jobs";
export const MAX_IMPORT_TITLES = 2000;
const MINUTE = 60_000;
/** The lease a run holds; the card-import-jobs cron row holds the same. */
const IMPORT_LEASE_MS = 5 * MINUTE;
/** A run stops taking items after this, well inside its lease. */
const IMPORT_RUN_BUDGET_MS = 4 * MINUTE;
/** One run's requests per wiki: twice what its budget allows at the client's pace, so only a runaway reaches it. */
const RUN_REQUEST_CAP = (2 * IMPORT_RUN_BUDGET_MS) / DISCOVERY_DELAY_MS;
const CANCELLED = "Cancelled";
/** The stops that fail only the item being read (the client gave up on one answer); the others park the wiki. */
const ITEM_STOPS: ReadonlySet<DiscoveryStopKind> = new Set(["error", "unreachable"]);

export interface CreateImportJobInput {
  source: CardWikiSource;
  kind: CardImportJobKind;
  label: string;
  titles: readonly string[];
  requestedBy: string | null;
  requireImage?: boolean;
}

export async function createImportJob(
  db: PrismaClient,
  input: CreateImportJobInput
): Promise<{ jobId: string; queued: number }> {
  const titles = [...new Set(input.titles.map((title) => title.trim()).filter(Boolean))].slice(
    0,
    MAX_IMPORT_TITLES
  );
  if (titles.length === 0) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Choose at least one page to import" });
  }
  const job = await db.cardImportJob.create({
    data: {
      source: input.source,
      kind: input.kind,
      label: input.label.slice(0, 200),
      requestedBy: input.requestedBy,
      requireImage: input.requireImage ?? false,
      total: titles.length,
      items: { createMany: { data: titles.map((title) => ({ title })) } },
    },
    select: { id: true },
  });
  return { jobId: job.id, queued: titles.length };
}

export type StageItem = (
  db: PrismaClient,
  source: CardWikiSource,
  input: StageInput,
  context: ImportContext
) => Promise<StageOutcome>;

export interface RunDeps {
  now?: () => number;
  stage?: StageItem;
  contextFor?: (db: PrismaClient, source: CardWikiSource) => Promise<ImportContext>;
}

const stageItem: StageItem = (db, source, input, context) =>
  source === "commons"
    ? stageCommonsFile(db, input, context)
    : stageArticleCard(db, source, input, context);

/** The wiki's client for this run, and its stored rarity table. */
async function runContext(db: PrismaClient, source: CardWikiSource): Promise<ImportContext> {
  const client = createDiscoveryClient(source, { maxRequests: RUN_REQUEST_CAP });
  return {
    query: client.query,
    pace: client.pace,
    thresholds: (await getRarityThresholds(db))[source],
  };
}

/** What a run leaves alone: the wikis that stopped answering, and jobs whose last items another runner holds. */
interface Passed {
  sources: Set<string>;
  jobs: Set<string>;
}

/** Items a dead runner left PROCESSING (claimed longer ago than a lease) go back to the queue. */
async function requeueAbandoned(db: PrismaClient, at: number) {
  await db.cardImportItem.updateMany({
    where: { status: "PROCESSING", updatedAt: { lt: new Date(at - IMPORT_LEASE_MS) } },
    data: { status: "QUEUED" },
  });
}

/** The oldest job still to work on, moved to RUNNING. */
async function nextJob(db: PrismaClient, passed: Passed): Promise<CardImportJob | null> {
  const job = await db.cardImportJob.findFirst({
    where: {
      status: { in: ["QUEUED", "RUNNING"] },
      id: { notIn: [...passed.jobs] },
      source: { notIn: [...passed.sources] },
    },
    orderBy: { createdAt: "asc" },
  });
  if (job?.status === "QUEUED") {
    await db.cardImportJob.updateMany({
      where: { id: job.id, status: "QUEUED" },
      data: { status: "RUNNING", startedAt: new Date() },
    });
  }
  return job;
}

/** The job's next queued item, claimed so no other runner can work it; null when none is left. */
async function claimNextItem(db: PrismaClient, jobId: string): Promise<CardImportItem | null> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const item = await db.cardImportItem.findFirst({
      where: { jobId, status: "QUEUED" },
      orderBy: { id: "asc" },
    });
    if (!item) return null;
    // The claim's time is what requeueAbandoned reads.
    const claimed = await db.cardImportItem.updateMany({
      where: { id: item.id, status: "QUEUED" },
      data: { status: "PROCESSING", updatedAt: new Date() },
    });
    if (claimed.count === 1) return item;
  }
  return null;
}

const COUNTER: Record<StageOutcome["status"], "staged" | "skipped" | "blocked" | "failed"> = {
  STAGED: "staged",
  SKIPPED: "skipped",
  BLOCKED: "blocked",
  FAILED: "failed",
};

/** The item's outcome and its job's counters, in one transaction. */
async function recordOutcome(
  db: PrismaClient,
  jobId: string,
  itemId: string,
  outcome: StageOutcome
) {
  const counts: Prisma.CardImportJobUpdateInput = {
    processed: { increment: 1 },
    heartbeatAt: new Date(),
  };
  counts[COUNTER[outcome.status]] = { increment: 1 };
  await db.$transaction([
    db.cardImportItem.update({
      where: { id: itemId },
      data:
        outcome.status === "STAGED"
          ? {
              status: "STAGED",
              cardId: outcome.cardId,
              rarity: outcome.rarity,
              licence: outcome.licence,
            }
          : { status: outcome.status, reason: outcome.reason.slice(0, 500) },
    }),
    db.cardImportJob.update({ where: { id: jobId }, data: counts }),
  ]);
}

/** Ends a job with nothing left to work on; false while another runner still holds one of its items. */
async function finishJob(db: PrismaClient, jobId: string): Promise<boolean> {
  const left = await db.cardImportItem.count({
    where: { jobId, status: { in: ["QUEUED", "PROCESSING"] } },
  });
  if (left > 0) return false;
  await db.cardImportJob.updateMany({
    where: { id: jobId, status: "RUNNING" },
    data: { status: "DONE", finishedAt: new Date() },
  });
  return true;
}

/** Fails a running job with its reason; false when it is no longer running (an admin cancelled it). */
async function failJob(db: PrismaClient, jobId: string, reason: string): Promise<boolean> {
  const failed = await db.cardImportJob.updateMany({
    where: { id: jobId, status: "RUNNING" },
    data: { status: "FAILED", error: reason, finishedAt: new Date() },
  });
  return failed.count === 1;
}

/** The wiki stopped answering: the job fails and the item waits for Retry, or is skipped if the job was cancelled. */
async function stopJob(db: PrismaClient, jobId: string, itemId: string, reason: string) {
  if (await failJob(db, jobId, reason)) {
    await db.cardImportItem.update({ where: { id: itemId }, data: { status: "QUEUED" } });
    return;
  }
  await recordOutcome(db, jobId, itemId, { status: "SKIPPED", reason: CANCELLED });
}

/**
 * How a claimed item ended: recorded; recorded as failed after its wiki's client gave up on a read (the run builds a
 * fresh one); or put back for Retry because its wiki stopped answering, which stopped the job.
 */
type ItemEnd = "recorded" | "client-lost" | "wiki-stopped";

async function workItem(
  db: PrismaClient,
  stage: StageItem,
  source: CardWikiSource,
  job: CardImportJob,
  item: CardImportItem,
  context: ImportContext
): Promise<ItemEnd> {
  const input: StageInput = {
    title: item.title,
    requestedBy: job.requestedBy,
    jobId: job.id,
    requireImage: job.requireImage,
  };
  let outcome: StageOutcome;
  let end: ItemEnd = "recorded";
  try {
    outcome = await stage(db, source, input, context);
  } catch (error) {
    if (!(error instanceof DiscoveryStopped)) {
      console.error(`[Card imports] Staging "${item.title}" failed:`, error);
      outcome = {
        status: "FAILED",
        reason: error instanceof Error ? error.message : String(error),
      };
    } else {
      console.error(
        `[Card imports] ${cardSourceLabel(source)} stopped answering for "${item.title}": ${error.message}`
      );
      const reason = stoppedWikiMessage(source, error.stop);
      if (!ITEM_STOPS.has(error.stop.kind)) {
        await stopJob(db, job.id, item.id, reason);
        return "wiki-stopped";
      }
      outcome = { status: "FAILED", reason };
      end = "client-lost";
    }
  }
  await recordOutcome(db, job.id, item.id, outcome);
  return end;
}

/** Works through queued imports, oldest job first, until none is left or the time budget is spent. */
export async function runImportJobs(
  db: PrismaClient,
  deps: RunDeps = {}
): Promise<{ items: number }> {
  const now = deps.now ?? Date.now;
  const stage = deps.stage ?? stageItem;
  const contextFor = deps.contextFor ?? runContext;
  const deadline = now() + IMPORT_RUN_BUDGET_MS;
  const contexts = new Map<CardWikiSource, ImportContext>();
  const passed: Passed = { sources: new Set(), jobs: new Set() };
  await requeueAbandoned(db, now());

  let items = 0;
  while (now() < deadline) {
    const job = await nextJob(db, passed);
    if (!job) break;
    const source = parseCardWikiSource(job.source);
    if (!source) {
      await failJob(db, job.id, `Unknown source wiki "${job.source}"`);
      continue;
    }
    // Built before the claim, so a failure here leaves no item PROCESSING.
    const context = contexts.get(source) ?? (await contextFor(db, source));
    contexts.set(source, context);
    const item = await claimNextItem(db, job.id);
    if (!item) {
      if (!(await finishJob(db, job.id))) passed.jobs.add(job.id);
      continue;
    }
    const end = await workItem(db, stage, source, job, item, context);
    if (end === "wiki-stopped") passed.sources.add(source);
    else items++;
    if (end !== "recorded") contexts.delete(source);
  }
  return { items };
}

/** The cron entry: one run (cron-runner already holds the `card-import-jobs` lease). */
export async function runQueuedCardImports(): Promise<{ items: number }> {
  return runImportJobs(appDb);
}

/** Starts a run in the background under the lease; a no-op while the cron or another kick holds it. */
export function kickImportRunner(db: PrismaClient): void {
  void withJobLock(db, IMPORT_LOCK, () => runImportJobs(db), {
    timeoutMs: IMPORT_LEASE_MS,
  }).catch((error) => console.error("[Card imports] Run failed:", error));
}

/** Cancels an unfinished job: what is still queued is skipped, and counted as skipped and processed. */
export async function cancelImportJob(db: PrismaClient, jobId: string): Promise<void> {
  await db.$transaction(async (tx) => {
    const cancelled = await tx.cardImportJob.updateMany({
      where: { id: jobId, status: { in: ["QUEUED", "RUNNING", "FAILED"] } },
      data: { status: "CANCELLED", finishedAt: new Date() },
    });
    if (cancelled.count !== 1) {
      throw new TRPCError({ code: "CONFLICT", message: "This import has already finished" });
    }
    const skipped = await tx.cardImportItem.updateMany({
      where: { jobId, status: "QUEUED" },
      data: { status: "SKIPPED", reason: CANCELLED },
    });
    await tx.cardImportJob.update({
      where: { id: jobId },
      data: { processed: { increment: skipped.count }, skipped: { increment: skipped.count } },
    });
  });
}

export async function retryImportJob(db: PrismaClient, jobId: string): Promise<void> {
  const retried = await db.cardImportJob.updateMany({
    where: { id: jobId, status: "FAILED" },
    data: { status: "QUEUED", error: null, finishedAt: null },
  });
  if (retried.count !== 1) {
    throw new TRPCError({ code: "CONFLICT", message: "Only a failed import can be retried" });
  }
}

export function listImportJobs(db: PrismaClient, limit = 20) {
  return db.cardImportJob.findMany({ orderBy: { createdAt: "desc" }, take: limit });
}

export function importJobItems(db: PrismaClient, jobId: string, status?: CardImportItemStatus) {
  return db.cardImportItem.findMany({
    where: { jobId, ...(status ? { status } : {}) },
    orderBy: { id: "asc" },
    take: 500,
    select: {
      id: true,
      title: true,
      status: true,
      cardId: true,
      rarity: true,
      licence: true,
      reason: true,
    },
  });
}
