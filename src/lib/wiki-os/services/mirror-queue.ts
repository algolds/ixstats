/**
 * mirror-queue.ts — which mirror job runs next, and what becomes of one that fails.
 *
 * The rules (plan 407):
 *   - per-title FIFO: a job waits for every older job of its title that is not done (pending, running, or
 *     waiting out a backoff), and a `dead` job blocks its title until an administrator requeues or discards
 *     it. A move is about two titles, the one it moves from and the one it moves to, and holds both;
 *   - a failed job is tried again after `min(2^attempts x 30 s, 1 h)`, and goes `dead` after 8 attempts.
 * `pickRunnable` and `backoffMs` are pure; the rest reads and writes `wiki_mirror_jobs`. The caller holds the
 * mirror lock (mirror-worker.ts): one runner at a time.
 */

import type { WikiMirrorJob } from "@prisma/client";
import { db } from "~/server/db";
import { MIRROR_SOURCE, movePayloadSchema } from "./mirror-outbox";

export const MAX_ATTEMPTS = 8;
const BACKOFF_BASE_MS = 30_000;
const BACKOFF_MAX_MS = 60 * 60_000;
/** The oldest not-done jobs a pick looks at: enough to see every blocker of the jobs it could run. */
const WINDOW_SIZE = 1_000;
/** An attempt makes a handful of requests of 30 s at most; one still running after this is not running. */
const INTERRUPTED_AFTER_MS = 10 * 60_000;
const DONE_RETENTION_MS = 30 * 24 * 60 * 60_000;
const LAST_ERROR_LIMIT = 2_000;

export type MirrorJob = WikiMirrorJob;

/** The wait before attempt number `attempts + 1`, after `attempts` failed ones: 60 s, 2 min, 4 min ... capped at 1 h. */
export function backoffMs(attempts: number): number {
  return Math.min(BACKOFF_BASE_MS * 2 ** attempts, BACKOFF_MAX_MS);
}

/** The titles a job is ordered by: its own, and for a move the one it moves to. */
function titlesOf(job: MirrorJob): string[] {
  if (job.kind !== "move") return [job.title];
  const move = movePayloadSchema.safeParse(job.payload);
  return move.success ? [job.title, move.data.to] : [job.title];
}

/**
 * The next job to run among `jobs` (the not-done jobs, oldest first): the first pending job that is due and
 * whose titles no older not-done job holds. Anything older that is not done, whatever its state, holds its
 * titles for everything younger.
 */
export function pickRunnable(jobs: readonly MirrorJob[], now: Date): MirrorJob | null {
  const held = new Set<string>();
  for (const job of jobs) {
    const titles = titlesOf(job);
    const free = titles.every((title) => !held.has(title));
    if (free && job.state === "pending" && job.nextAttemptAt <= now) return job;
    for (const title of titles) held.add(title);
  }
  return null;
}

/** The oldest not-done jobs, oldest first. */
export function loadWindow(): Promise<MirrorJob[]> {
  return db.wikiMirrorJob.findMany({
    where: { source: MIRROR_SOURCE, state: { not: "done" } },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    take: WINDOW_SIZE,
  });
}

/** Start an attempt: the job is `running` and counts one more try. */
export function claimJob(id: string): Promise<MirrorJob> {
  return db.wikiMirrorJob.update({
    where: { id },
    data: { state: "running", attempts: { increment: 1 } },
  });
}

/**
 * A job that has been `running` for longer than any attempt takes belongs to a run that died: pending again
 * (its attempt stays counted, so a job that kills its runner still ends up dead).
 */
export async function reclaimInterruptedJobs(now = new Date()): Promise<number> {
  const { count } = await db.wikiMirrorJob.updateMany({
    where: {
      source: MIRROR_SOURCE,
      state: "running",
      updatedAt: { lt: new Date(now.getTime() - INTERRUPTED_AFTER_MS) },
    },
    data: { state: "pending" },
  });
  return count;
}

export function completeJob(id: string, mwRevId: number | null): Promise<MirrorJob> {
  return db.wikiMirrorJob.update({
    where: { id },
    data: { state: "done", lastError: null, ...(mwRevId === null ? {} : { mwRevId }) },
  });
}

/**
 * Record a failed attempt of `job` (as claimed, so `attempts` already counts it): pending again after its
 * backoff, or `dead` once the attempts are used up. Resolves to the job as stored.
 */
export function failJob(job: MirrorJob, error: unknown, now = new Date()): Promise<MirrorJob> {
  const message = (error instanceof Error ? error.message : String(error)).slice(
    0,
    LAST_ERROR_LIMIT
  );
  const dead = job.attempts >= MAX_ATTEMPTS;
  return db.wikiMirrorJob.update({
    where: { id: job.id },
    data: {
      state: dead ? "dead" : "pending",
      lastError: message,
      ...(dead ? {} : { nextAttemptAt: new Date(now.getTime() + backoffMs(job.attempts)) }),
    },
  });
}

/** Forget finished jobs after a month: the table is a queue, the WikiOS history is the record. */
export async function purgeDoneJobs(now = new Date()): Promise<number> {
  const { count } = await db.wikiMirrorJob.deleteMany({
    where: {
      source: MIRROR_SOURCE,
      state: "done",
      updatedAt: { lt: new Date(now.getTime() - DONE_RETENTION_MS) },
    },
  });
  return count;
}
