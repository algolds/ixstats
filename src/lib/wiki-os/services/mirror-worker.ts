/**
 * mirror-worker.ts — the outbound mirror's worker: applies the outbox (`wiki_mirror_jobs`) to classic MediaWiki.
 *
 * `runMirrorCycle` works through the due jobs (per-title FIFO, mirror-queue.ts), each as the dedicated mirror
 * account: the `revision` jobs of a title that wait next in line together, through one `action=import`
 * (mirror-revision.ts), the page operations one by one through their own API calls (mirror-page-ops.ts). A failed
 * job is retried with backoff and ends up `dead` after 8 attempts (the operators are warned on Discord, at most once
 * in 30 minutes: mirror-alerts.ts); a login that fails is a failure of the job, never an anonymous write.
 *
 * It runs from the `wiki-mirror` cron job (src/server/cron/jobs.ts, which holds the job lock) and in-process
 * shortly after a write (`scheduleMirrorKick`, which takes the same lock through `runMirrorCycleLocked`), so only
 * one runner works at a time across processes. `SKIP_MEDIAWIKI_SYNC=true` stops the worker; jobs accumulate.
 */

import { db } from "~/server/db";
import { withJobLock } from "~/lib/system/job-lock";
import { alertDeadJobs } from "./mirror-alerts";
import { MIRROR_LOCK_NAME } from "./mirror-outbox";
import { runPageJob } from "./mirror-page-ops";
import { withinAttempt } from "../adapters/mediawiki/attempt-scope";
import {
  ATTEMPT_TIMEOUT_MS,
  claimJob,
  completeJob,
  failJob,
  loadWindow,
  MAX_BATCH_JOBS,
  pickBatch,
  pickRunnable,
  purgeDoneJobs,
  releaseJobs,
  reclaimInterruptedJobs,
  type MirrorJob,
} from "./mirror-queue";
import {
  executeRevisionBatch,
  planRevisionBatch,
  type BatchOutcome,
  type RevisionBatchPlan,
} from "./mirror-revision";
import { invalidateTemplateDependents } from "./render-service";

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

/**
 * Settle a batch of revision jobs of one title: all of them, as the plan allows (a size cap leaves the tail for the
 * next batch). Nothing is stored until MediaWiki has answered. A failure of MediaWiki fails every job of the batch;
 * a failure to store an outcome fails only the jobs not settled yet, never one already marked done.
 */
async function runRevisionBatch(claimed: readonly MirrorJob[]): Promise<MirrorJob[]> {
  let handled = claimed;
  let plan: RevisionBatchPlan;
  let outcomes: BatchOutcome[];
  try {
    plan = await planRevisionBatch(claimed);
    handled = claimed.slice(0, plan.members.length);
    await releaseJobs(claimed.slice(handled.length).map((job) => job.id));
    outcomes = await withinAttempt(ATTEMPT_TIMEOUT_MS, () => executeRevisionBatch(plan));
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
    await withinAttempt(ATTEMPT_TIMEOUT_MS, () => runPageJob(job));
    return [await completeJob(job, null)];
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

  const startedAt = Date.now();
  let dead = 0;
  await reclaimInterruptedJobs();
  while (result.done + result.failed < maxJobs && Date.now() - startedAt < deadlineMs) {
    const now = new Date();
    const window = await loadWindow();
    const next = pickRunnable(window, now);
    if (!next) break;
    const batch = pickBatch(
      window,
      next,
      now,
      Math.min(MAX_BATCH_JOBS, maxJobs - result.done - result.failed)
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
