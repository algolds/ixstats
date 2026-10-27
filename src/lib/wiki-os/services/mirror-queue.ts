/**
 * mirror-queue.ts — which mirror job runs next, and what becomes of one that fails.
 *
 * The rules (plan 407):
 *   - per-title FIFO: a job waits for every older job of its title that is not done (pending, running, or
 *     waiting out a backoff), and a `dead` job blocks its title until an administrator requeues or discards
 *     it. A move is about two titles, the one it moves from and the one it moves to, and holds both;
 *   - dead jobs are not in the window (`loadWindow`), so any number of them cannot crowd out the jobs that can run;
 *     their titles are read on their own (`loadDeadTitles`, with the oldest dead job of each) and hold every job of
 *     the title written after that dead job, in `pickRunnable` and `pickBatch`. A job written before it (the oldest
 *     of a dead batch, requeued alone) still runs;
 *   - a failed job is tried again after `min(2^attempts x 30 s, 1 h)`, and goes `dead` after 8 attempts.
 *   - the revision jobs of a title that wait next in line are tried together, as one batch (`pickBatch`).
 * `pickRunnable`, `pickBatch` and `backoffMs` are pure; the rest reads and writes `wiki_mirror_jobs`. The caller holds the
 * mirror lock (mirror-worker.ts): one runner at a time.
 */

import type { WikiMirrorJob } from "@prisma/client";
import { db } from "~/server/db";
import { MIRROR_SOURCE, movePayloadSchema } from "./mirror-outbox";

export const MAX_ATTEMPTS = 8;
/** Most revision jobs of one title imported together. */
export const MAX_BATCH_JOBS = 50;
const BACKOFF_BASE_MS = 30_000;
const BACKOFF_MAX_MS = 60 * 60_000;
/**
 * The oldest not-done jobs a pick looks at: enough to see every blocker of the jobs it could run (a dead job's hold
 * comes from `loadDeadTitles`). A window this full is saturated: the worker warns (mirror-alerts.ts).
 */
export const WINDOW_SIZE = 1_000;
/**
 * All the MediaWiki calls of one attempt together (the login, an import that can take two minutes, the checks, the
 * fallback edit) are cut off after this (see adapters/mediawiki/attempt-scope.ts), which is what the worker's lock
 * has to outlast: a lock transaction can never expire in the middle of an attempt.
 */
export const ATTEMPT_TIMEOUT_MS = 6 * 60_000;
/** A job still `running` this long after its claim belongs to a run that died: longer than any attempt can last. */
export const INTERRUPTED_AFTER_MS = ATTEMPT_TIMEOUT_MS + 4 * 60_000;
const DONE_RETENTION_MS = 30 * 24 * 60 * 60_000;
const LAST_ERROR_LIMIT = 2_000;

export type MirrorJob = WikiMirrorJob;
/** Where a job stands in the queue's order: by `createdAt`, then by `id` (as `loadWindow` sorts). */
export type QueuePosition = Pick<MirrorJob, "createdAt" | "id">;
/** Per title a dead job holds, the oldest such dead job: every job of the title written after it waits. */
export type DeadHolds = ReadonlyMap<string, QueuePosition>;

/**
 * The states of a job that is over: `done` (it reached MediaWiki, or there was nothing to send) and `discarded` (an
 * administrator gave up on a dead job: MediaWiki never got it). Neither holds its title, and neither is in the window.
 */
const FINISHED_STATES = ["done", "discarded"] as const;
/** The jobs the window leaves out: the finished ones, and the dead ones (which still hold their titles). */
const OUT_OF_WINDOW = [...FINISHED_STATES, "dead"] as const;

/** The wait before attempt number `attempts + 1`, after `attempts` failed ones: 60 s, 2 min, 4 min ... capped at 1 h. */
export function backoffMs(attempts: number): number {
  return Math.min(BACKOFF_BASE_MS * 2 ** attempts, BACKOFF_MAX_MS);
}

/** The titles a job is ordered by: its own, and for a move the one it moves to. */
function titlesOf(job: Pick<MirrorJob, "kind" | "title" | "payload">): string[] {
  if (job.kind !== "move") return [job.title];
  const move = movePayloadSchema.safeParse(job.payload);
  return move.success ? [job.title, move.data.to] : [job.title];
}

/** Whether `job` comes after `position` in the queue's order. */
const writtenAfter = (job: QueuePosition, position: QueuePosition) =>
  job.createdAt.getTime() === position.createdAt.getTime()
    ? job.id > position.id
    : job.createdAt > position.createdAt;

/** Whether a dead job (`held`, from `loadDeadTitles`) holds `title` against `job`: it was written before `job`. */
function deadHolds(held: DeadHolds, title: string, job: QueuePosition): boolean {
  const dead = held.get(title);
  return dead !== undefined && writtenAfter(job, dead);
}

/**
 * The next job to run among `jobs` (the not-done jobs, oldest first): the first pending job that is due and
 * whose titles neither an older not-done job nor an older dead job (`held`, from `loadDeadTitles`) holds. Anything
 * older that is not done, whatever its state, holds its titles for everything younger.
 */
export function pickRunnable(
  jobs: readonly MirrorJob[],
  now: Date,
  held: DeadHolds = new Map()
): MirrorJob | null {
  const holding = new Set<string>();
  for (const job of jobs) {
    const titles = titlesOf(job);
    const free = titles.every((title) => !holding.has(title) && !deadHolds(held, title, job));
    if (free && job.state === "pending" && job.nextAttemptAt <= now) return job;
    for (const title of titles) holding.add(title);
  }
  return null;
}

/**
 * The jobs to run together with `first` (the job `pickRunnable` chose): when it is a revision job, every revision job
 * of its title that waits next in line, up to `maxJobs`, oldest first. The batch stops at the first job of the title
 * (or of a move to it) that is anything else: another kind, one that is running, dead or waiting out a backoff, or one
 * written after a dead job of the title (`held`), which must not land before that dead job. Jobs of other titles in
 * between do not matter. Pure.
 */
export function pickBatch(
  window: readonly MirrorJob[],
  first: MirrorJob,
  now: Date,
  maxJobs = MAX_BATCH_JOBS,
  held: DeadHolds = new Map()
): MirrorJob[] {
  const batch = [first];
  if (first.kind !== "revision") return batch;
  for (const job of window.slice(window.findIndex((candidate) => candidate.id === first.id) + 1)) {
    if (batch.length >= maxJobs) break;
    if (!titlesOf(job).includes(first.title)) continue;
    const joins =
      job.kind === "revision" &&
      job.state === "pending" &&
      job.nextAttemptAt <= now &&
      !deadHolds(held, first.title, job);
    if (!joins) break;
    batch.push(job);
  }
  return batch;
}

/** The oldest jobs that are neither finished nor dead, oldest first. */
export function loadWindow(): Promise<MirrorJob[]> {
  return db.wikiMirrorJob.findMany({
    where: { source: MIRROR_SOURCE, state: { notIn: [...OUT_OF_WINDOW] } },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    take: WINDOW_SIZE,
  });
}

/**
 * The titles the dead jobs hold (their own, and a dead move's destination), each with its oldest dead job: no job of
 * those titles written after it runs until an administrator requeues or discards the dead job, so a younger job never
 * overtakes it on MediaWiki.
 */
export async function loadDeadTitles(): Promise<Map<string, QueuePosition>> {
  const dead = await db.wikiMirrorJob.findMany({
    where: { source: MIRROR_SOURCE, state: "dead" },
    select: { id: true, createdAt: true, kind: true, title: true, payload: true },
  });
  const holds = new Map<string, QueuePosition>();
  for (const job of dead) {
    for (const title of titlesOf(job)) {
      const oldest = holds.get(title);
      if (!oldest || writtenAfter(oldest, job))
        holds.set(title, { createdAt: job.createdAt, id: job.id });
    }
  }
  return holds;
}

/**
 * Start an attempt: the job is `running` and counts one more try. Only a job that is still pending can be claimed; null
 * when it is not any more (another runner took it first), and it is then left alone.
 */
export async function claimJob(id: string): Promise<MirrorJob | null> {
  const { count } = await db.wikiMirrorJob.updateMany({
    where: { id, state: "pending" },
    data: { state: "running", attempts: { increment: 1 } },
  });
  return count === 0 ? null : db.wikiMirrorJob.findUnique({ where: { id } });
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

/**
 * Finish `job`, with the MediaWiki revision that holds its text (when there is one) and, when the way it was
 * finished is worth knowing, a `note` kept in its payload.
 */
export function completeJob(
  job: MirrorJob,
  mwRevId: number | null,
  note?: string
): Promise<MirrorJob> {
  // the note joins what the payload holds (a page operation's title, reason): nothing it had is dropped
  const { payload } = job;
  const kept =
    payload !== null && typeof payload === "object" && !Array.isArray(payload) ? payload : {};
  return db.wikiMirrorJob.update({
    where: { id: job.id },
    data: {
      state: "done",
      lastError: null,
      ...(mwRevId === null ? {} : { mwRevId }),
      ...(note ? { payload: { ...kept, note } } : {}),
    },
  });
}

/** Give back claimed jobs that were not tried after all: pending again, the attempt not counted. */
export async function releaseJobs(ids: readonly string[]): Promise<void> {
  if (ids.length === 0) return;
  await db.wikiMirrorJob.updateMany({
    where: { id: { in: [...ids] }, state: "running" },
    data: { state: "pending", attempts: { decrement: 1 } },
  });
}

/**
 * Record a failed attempt of `job` (as claimed, so `attempts` already counts it): pending again after its
 * backoff, or `dead` once the attempts are used up. Resolves to the job as stored.
 */
export function failJob(job: MirrorJob, message: string, now = new Date()): Promise<MirrorJob> {
  const dead = job.attempts >= MAX_ATTEMPTS;
  return db.wikiMirrorJob.update({
    where: { id: job.id },
    data: {
      state: dead ? "dead" : "pending",
      lastError: message.slice(0, LAST_ERROR_LIMIT),
      ...(dead ? {} : { nextAttemptAt: new Date(now.getTime() + backoffMs(job.attempts)) }),
    },
  });
}

/** Forget finished (and discarded) jobs after a month: the table is a queue, the WikiOS history is the record. */
export async function purgeDoneJobs(now = new Date()): Promise<number> {
  const { count } = await db.wikiMirrorJob.deleteMany({
    where: {
      source: MIRROR_SOURCE,
      state: { in: [...FINISHED_STATES] },
      updatedAt: { lt: new Date(now.getTime() - DONE_RETENTION_MS) },
    },
  });
  return count;
}
