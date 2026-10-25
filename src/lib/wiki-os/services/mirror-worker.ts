/**
 * mirror-worker.ts — the outbound mirror's worker: applies the outbox (`wiki_mirror_jobs`) to classic MediaWiki.
 *
 * `runMirrorCycle` works through the due jobs (per-title FIFO, mirror-queue.ts), each as the dedicated mirror
 * account: the `revision` jobs of a title that wait next in line together, through one `action=import`
 * (mirror-revision.ts), the page operations one by one through their own API calls (mirror-page-ops.ts), and an
 * uploaded file through `action=upload` (mirror-upload.ts). A failed
 * job is retried with backoff and ends up `dead` after 8 attempts (the operators are warned on Discord, at most once
 * in 30 minutes: mirror-alerts.ts); a login that fails is a failure of the job, never an anonymous write. A dead job
 * leaves the window but holds its titles until an administrator requeues or discards it, and a window that is full
 * of jobs still to run is reported the same way (`alertWindowSaturated`).
 *
 * It runs from the `wiki-mirror` cron job (src/server/cron/jobs.ts, which holds the job lock) and in-process
 * shortly after a write (`scheduleMirrorKick`, which takes the same lock through `runMirrorCycleLocked`), so only
 * one runner works at a time across processes. `SKIP_MEDIAWIKI_SYNC=true` stops the worker; jobs accumulate. Once an hour a cycle
 * also deletes the orphaned staged upload files (staged-uploads.ts).
 */

import { db } from "~/server/db";
import { withJobLock } from "~/lib/system/job-lock";
import { alertDeadJobs, alertWindowSaturated } from "./mirror-alerts";
import { MIRROR_LOCK_NAME, MIRROR_SOURCE } from "./mirror-outbox";
import { runPageJob, type PageJobResult } from "./mirror-page-ops";
import { runUploadJob } from "./mirror-upload";
import { withinAttempt } from "../adapters/mediawiki/attempt-scope";
import {
  ATTEMPT_TIMEOUT_MS,
  claimJob,
  completeJob,
  failJob,
  loadDeadTitles,
  loadWindow,
  MAX_BATCH_JOBS,
  pickBatch,
  pickRunnable,
  purgeDoneJobs,
  releaseJobs,
  reclaimInterruptedJobs,
  WINDOW_SIZE,
  type MirrorJob,
} from "./mirror-queue";
import { checkCollision } from "./mirror-collision";
import {
  executeRevisionBatch,
  planRevisionBatch,
  type BatchOutcome,
  type RevisionBatchPlan,
} from "./mirror-revision";
import { invalidateTemplateDependents } from "./render-service";
import { sweepStagedOrphansIfDue } from "./staged-uploads";
import { refreshWikiosEditingFlag } from "~/lib/wiki-os/editing-switch";

const DEFAULT_MAX_JOBS = 50;
/** No new batch starts after this long (the cron job's lock allows a cycle `MAX_CYCLE_MS`). */
export const DEFAULT_DEADLINE_MS = 50_000;
/** The longest a cycle can run: it starts nothing after the deadline, and its last attempt is cut off after its own limit. */
export const MAX_CYCLE_MS = DEFAULT_DEADLINE_MS + ATTEMPT_TIMEOUT_MS;
/**
 * The lock of an in-process run is held at most this long, and the `wiki-mirror` cron row (src/server/cron/jobs.ts)
 * allows its job the same: more than any cycle can take, so a lock transaction never expires mid-attempt.
 */
export const LOCK_TIMEOUT_MS = 10 * 60_000;

/** Jobs not finished yet: after the editing switch goes off, the worker keeps going until this is 0. */
function outboxWaiting(): Promise<number> {
  return db.wikiMirrorJob.count({
    where: { source: MIRROR_SOURCE, state: { in: ["pending", "running"] } },
  });
}

export interface MirrorCycleOptions {
  maxJobs?: number;
  deadlineMs?: number;
}

export interface MirrorCycleResult {
  /** `SKIP_MEDIAWIKI_SYNC=true`: nothing was run. */
  skipped: boolean;
  done: number;
  /** Attempts that failed: the job waits for its backoff, or went dead. */
  failed: number;
  dead: number;
}

/** The jobs `plan` takes; the rest of `jobs` are given back untried (pending again, the attempt not counted). */
async function keepPlanned(
  jobs: readonly MirrorJob[],
  plan: RevisionBatchPlan
): Promise<readonly MirrorJob[]> {
  await releaseJobs(jobs.slice(plan.members.length).map((job) => job.id));
  return jobs.slice(0, plan.members.length);
}

/**
 * Settle a batch of revision jobs of one title: all of them, as the plan allows (a size cap leaves the tail for the
 * next batch). The conflict rule judges the batch against MediaWiki first (`checkCollision`); after a collision a trail
 * may have been written into a summary, or a lost revision parked, since the plan was made, so the batch is planned
 * again. Nothing is stored until MediaWiki has answered. A failure of MediaWiki fails every job the batch still holds;
 * a failure to store an outcome fails only the jobs not settled yet, never one already marked done.
 */
async function runRevisionBatch(claimed: readonly MirrorJob[]): Promise<MirrorJob[]> {
  let handled = claimed;
  let plan: RevisionBatchPlan;
  let outcomes: BatchOutcome[];
  try {
    plan = await planRevisionBatch(claimed);
    handled = await keepPlanned(claimed, plan);
    outcomes = await withinAttempt(ATTEMPT_TIMEOUT_MS, async () => {
      const collision = await checkCollision(plan);
      if (!collision) return executeRevisionBatch(plan, null);
      plan = await planRevisionBatch(handled);
      handled = await keepPlanned(handled, plan);
      return executeRevisionBatch(plan, collision);
    });
  } catch (error) {
    return failAll(handled, error);
  }

  const settled: MirrorJob[] = [];
  let unsettled: Promise<MirrorJob[]> = Promise.resolve([]);
  for (const [at, { job, mwRevId, note }] of outcomes.entries()) {
    try {
      settled.push(await completeJob(job, mwRevId, note));
    } catch (error) {
      unsettled = failAll(
        outcomes.slice(at).map((outcome) => outcome.job),
        error
      );
      break;
    }
  }
  // A template or module only now has its new text in MediaWiki, which renders every page that uses it:
  // the renders made since the save used the old copy, so those pages are stale again.
  if (settled.length > 0) void invalidateTemplateDependents(plan.title, claimed[0].source);
  return [...settled, ...(await unsettled)];
}

async function failAll(jobs: readonly MirrorJob[], error: unknown): Promise<MirrorJob[]> {
  const [first] = jobs;
  console.warn(
    `[WikiMirror] ${first.kind} job for "${first.title}" failed (attempt ${first.attempts}, ${jobs.length} job(s)):`,
    error
  );
  const message = error instanceof Error ? error.message : String(error);
  return Promise.all(jobs.map((job) => failJob(job, message)));
}

/** An upload or a page operation, as one call (or two) to MediaWiki; a page operation may resolve to a note. */
async function runOneJob(job: MirrorJob): Promise<PageJobResult> {
  if (job.kind !== "upload") return runPageJob(job);
  await runUploadJob(job);
  return {};
}

/**
 * Make the MediaWiki change of `candidates` (one job, or the revision jobs of one title that go together) and
 * resolve to the jobs as stored afterwards. Every attempt counts for every job it carried.
 */
async function runJobs(candidates: readonly MirrorJob[]): Promise<MirrorJob[]> {
  // Claim them in order and stop at the first one another runner took: a later job must not run before it.
  const claimed: MirrorJob[] = [];
  for (const candidate of candidates) {
    const job = await claimJob(candidate.id);
    if (!job) break;
    claimed.push(job);
  }
  const [job] = claimed;
  if (!job) return [];
  if (job.kind === "revision") return runRevisionBatch(claimed);
  try {
    // a page operation the conflict rule ruled lost sends nothing and is done with its note
    const { note } = await withinAttempt(ATTEMPT_TIMEOUT_MS, () => runOneJob(job));
    return [await completeJob(job, null, note)];
  } catch (error) {
    return failAll(claimed, error);
  }
}

/**
 * Work through the due jobs, oldest first, until none is due, `maxJobs` were tried or `deadlineMs` has passed.
 * The caller holds the mirror lock (the cron runner does; `runMirrorCycleLocked` takes it).
 */
export async function runMirrorCycle({
  maxJobs = DEFAULT_MAX_JOBS,
  deadlineMs = DEFAULT_DEADLINE_MS,
}: MirrorCycleOptions = {}): Promise<MirrorCycleResult> {
  const result: MirrorCycleResult = { skipped: false, done: 0, failed: 0, dead: 0 };
  if (process.env.SKIP_MEDIAWIKI_SYNC === "true") return { ...result, skipped: true };
  // Editing off (editing-switch.ts): the mirror still drains what was queued while it was on.
  if (!(await refreshWikiosEditingFlag()) && (await outboxWaiting()) === 0)
    return { ...result, skipped: true };

  const startedAt = Date.now();
  let dead = 0;
  let saturated = 0;
  await reclaimInterruptedJobs();
  while (result.done + result.failed < maxJobs && Date.now() - startedAt < deadlineMs) {
    const now = new Date();
    // The dead jobs' holds first, then the window, one after the other: an administrator may requeue a dead job at
    // any moment (no lock). Read in this order, a job requeued in between is held for by the first read or is in the
    // window of the second; read the other way round (or together) it can be in neither, and a younger job of its
    // title would overtake it.
    const held = await loadDeadTitles();
    const window = await loadWindow();
    if (window.length >= WINDOW_SIZE) saturated = window.length;
    const next = pickRunnable(window, now, held);
    if (!next) break;
    const batch = pickBatch(
      window,
      next,
      now,
      Math.min(MAX_BATCH_JOBS, maxJobs - result.done - result.failed),
      held
    );
    const tried = await runJobs(batch);
    // Nothing could be claimed: another runner is working these jobs (it should never be, the lock is held).
    if (tried.length === 0) break;
    for (const job of tried) {
      if (job.state === "done") {
        result.done++;
      } else {
        result.failed++;
        if (job.state === "dead") dead++;
      }
    }
  }
  result.dead = dead;
  await purgeDoneJobs();
  await alertDeadJobs();
  if (saturated > 0) await alertWindowSaturated(saturated);
  // a leftover file is not worth failing a cycle over
  await sweepStagedOrphansIfDue().catch((error: unknown) =>
    console.warn("[WikiMirror] Sweeping orphaned staged files failed:", error)
  );
  return result;
}

/** One cycle under the mirror lock; null when another runner (the cron job, another process) holds it. */
export async function runMirrorCycleLocked(
  options: MirrorCycleOptions = {}
): Promise<MirrorCycleResult | null> {
  const outcome = await withJobLock(db, MIRROR_LOCK_NAME, () => runMirrorCycle(options), {
    timeoutMs: LOCK_TIMEOUT_MS,
  });
  return outcome.ran ? outcome.result : null;
}
