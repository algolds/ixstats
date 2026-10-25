/**
 * mirror-admin.ts — what an administrator sees of the outbound mirror, and what they can do about a dead job.
 *
 * A dead job means classic MediaWiki is out of sync for that title until the job is requeued (tried again, from
 * the first attempt) or discarded (given up on: it stops blocking the jobs behind it), one by one or all the dead jobs
 * of a title (or every dead job) at once. Both only apply to dead jobs: a job that is pending or running is the
 * worker's.
 */

import { db } from "~/server/db";
import { mirrorBotName } from "../adapters/mediawiki/csrf-cache";
import { mirrorWriteUrlProblem } from "../config";
import { PageOperationError } from "../core/page-management-service";
import { canonicalizeTitle } from "../core/title";
import { MIRROR_SOURCE, scheduleMirrorKick } from "./mirror-outbox";
import { WINDOW_SIZE } from "./mirror-queue";

const STATES = ["pending", "running", "done", "dead", "discarded"] as const;
type MirrorState = (typeof STATES)[number];
const DEAD_JOBS_SHOWN = 20;

export interface DeadMirrorJob {
  id: string;
  kind: string;
  title: string;
  attempts: number;
  lastError: string | null;
  createdAt: Date;
  /** When the job went dead. */
  diedAt: Date;
}

export interface MirrorStatus {
  /** SKIP_MEDIAWIKI_SYNC=true: the worker is stopped and the jobs accumulate. */
  paused: boolean;
  /**
   * Production with no private render engine (WIKIOS_MEDIAWIKI_INTERNAL_URL) and no write URL of its own
   * (WIKIOS_MEDIAWIKI_API): the worker waits rather than write to the public wiki, and the jobs accumulate.
   */
  loopbackMissing: boolean;
  /** Production with WIKIOS_MEDIAWIKI_API on the public wiki's host: the worker waits the same way. */
  publicWriteUrl: boolean;
  /** Whether the bot account (WIKIOS_MEDIAWIKI_BOT_USER and _TOKEN) is configured: without it every job fails. */
  botConfigured: boolean;
  counts: Record<MirrorState, number>;
  /** How long the oldest job that has not finished has been waiting, in seconds; null when nothing waits. */
  oldestPendingSeconds: number | null;
  /**
   * Uploads (plan 411) that MediaWiki does not hold yet, dead ones included: WikiOS alone keeps their bytes, in its
   * staging directory, which therefore belongs in the backups until this is 0.
   */
  uploadsWaiting: number;
  /** The last dead jobs, newest first. */
  dead: DeadMirrorJob[];
  /**
   * The worker's window is full: at least `WINDOW_SIZE` jobs wait that are neither finished nor dead, so the mirror
   * is falling behind (the operators are warned on Discord too).
   */
  windowSaturated: boolean;
  /** How many jobs the worker's window holds (`WINDOW_SIZE`): `windowSaturated` means this many wait. */
  windowSize: number;
}

export async function getMirrorStatus(now = new Date()): Promise<MirrorStatus> {
  const [grouped, oldest, dead, uploadsWaiting] = await Promise.all([
    db.wikiMirrorJob.groupBy({
      by: ["state"],
      where: { source: MIRROR_SOURCE },
      _count: { _all: true },
    }),
    db.wikiMirrorJob.findFirst({
      where: { source: MIRROR_SOURCE, state: { in: ["pending", "running"] } },
      orderBy: { createdAt: "asc" },
      select: { createdAt: true },
    }),
    db.wikiMirrorJob.findMany({
      where: { source: MIRROR_SOURCE, state: "dead" },
      orderBy: { updatedAt: "desc" },
      take: DEAD_JOBS_SHOWN,
      select: {
        id: true,
        kind: true,
        title: true,
        attempts: true,
        lastError: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    db.wikiMirrorJob.count({
      where: {
        source: MIRROR_SOURCE,
        kind: "upload",
        state: { in: ["pending", "running", "dead"] },
      },
    }),
  ]);

  const counts: Record<MirrorState, number> = {
    pending: 0,
    running: 0,
    done: 0,
    dead: 0,
    discarded: 0,
  };
  for (const row of grouped) {
    const state = STATES.find((candidate) => candidate === row.state);
    if (state) counts[state] = row._count._all;
  }
  const writeUrl = mirrorWriteUrlProblem();
  return {
    paused: process.env.SKIP_MEDIAWIKI_SYNC === "true",
    loopbackMissing: writeUrl === "WIKIOS_MEDIAWIKI_INTERNAL_URL",
    publicWriteUrl: writeUrl === "WIKIOS_MEDIAWIKI_API",
    botConfigured: mirrorBotName() !== null && Boolean(process.env.WIKIOS_MEDIAWIKI_BOT_TOKEN),
    counts,
    oldestPendingSeconds: oldest
      ? Math.max(0, Math.round((now.getTime() - oldest.createdAt.getTime()) / 1000))
      : null,
    uploadsWaiting,
    dead: dead.map(({ updatedAt, ...job }) => ({ ...job, diedAt: updatedAt })),
    windowSaturated: counts.pending + counts.running >= WINDOW_SIZE,
    windowSize: WINDOW_SIZE,
  };
}

/** How the missing settings name a WIKIOS_MEDIAWIKI_API on the public wiki's host. */
const PUBLIC_WRITE_URL = "WIKIOS_MEDIAWIKI_API (it points at the public wiki)";

/** The settings the mirror needs before WikiOS may take edits; empty when it can write to MediaWiki. */
export function mirrorMissingSettings(): string[] {
  const missing: string[] = [];
  // Read from the environment, not wikiosConfig (frozen at module load), so the answer follows the current process.
  // The api.php the mirror writes to is not asked for: without WIKIOS_MEDIAWIKI_API it is the internal one, which
  // production must have, and in production WIKIOS_MEDIAWIKI_API must not be the public wiki (`mirrorWriteUrlProblem`).
  if (!process.env.WIKIOS_MEDIAWIKI_BOT_USER?.trim()) missing.push("WIKIOS_MEDIAWIKI_BOT_USER");
  if (!process.env.WIKIOS_MEDIAWIKI_BOT_TOKEN) missing.push("WIKIOS_MEDIAWIKI_BOT_TOKEN");
  const writeUrl = mirrorWriteUrlProblem();
  if (writeUrl === "WIKIOS_MEDIAWIKI_INTERNAL_URL") missing.push(writeUrl);
  if (writeUrl === "WIKIOS_MEDIAWIKI_API") missing.push(PUBLIC_WRITE_URL);
  return missing;
}

const noDeadJob = () => new PageOperationError("NOT_FOUND", "No dead mirror job with that id.");

/** A requeued job: pending, due now, from its first attempt, its old error cleared. */
const requeued = () => ({
  state: "pending",
  attempts: 0,
  lastError: null,
  nextAttemptAt: new Date(),
});
/** Discarded: given up on, the error that killed it kept on the row. */
const DISCARDED = { state: "discarded" } as const;

/**
 * Which dead jobs a bulk action covers: every one, or the ones that hold `title` (the jobs of that title, and the
 * moves into it). The title is read as a job's is stored, canonical ("foo_bar" is "Foo bar").
 */
export interface DeadJobFilter {
  title?: string;
}

/** A title as a job's is stored, canonical; one that is no title stays as typed. */
export function deadJobTitle(typed: string): string {
  return canonicalizeTitle(typed, { source: MIRROR_SOURCE })?.title ?? typed;
}

const deadJobs = ({ title: typed }: DeadJobFilter) => {
  const title = typed === undefined ? undefined : deadJobTitle(typed);
  return {
    source: MIRROR_SOURCE,
    state: "dead",
    ...(title === undefined
      ? {}
      : { OR: [{ title }, { kind: "move", payload: { path: ["to"], equals: title } }] }),
  };
};

/** Try a dead job again from its first attempt; it blocks nothing once it succeeds. */
export async function requeueMirrorJob(id: string): Promise<void> {
  const { count } = await db.wikiMirrorJob.updateMany({
    where: { id, source: MIRROR_SOURCE, state: "dead" },
    data: requeued(),
  });
  if (count === 0) throw noDeadJob();
  scheduleMirrorKick();
}

/** Change the dead jobs `filter` covers, kick the worker when any changed, and say how many did. */
async function updateDeadJobs(
  filter: DeadJobFilter,
  data: ReturnType<typeof requeued> | typeof DISCARDED
): Promise<number> {
  const { count } = await db.wikiMirrorJob.updateMany({ where: deadJobs(filter), data });
  if (count > 0) scheduleMirrorKick();
  return count;
}

/**
 * Try every dead job of a title (or every dead job) again from its first attempt. They run in their order, through
 * the conflict rule like any job.
 */
export function requeueDeadJobs(filter: DeadJobFilter): Promise<number> {
  return updateDeadJobs(filter, requeued());
}

/** Give up on every dead job of a title (or every dead job): its title is free, so the younger jobs run next. */
export function discardDeadJobs(filter: DeadJobFilter): Promise<number> {
  return updateDeadJobs(filter, DISCARDED);
}

/**
 * Give up on a dead job: it becomes `discarded` (not `done`: MediaWiki never got it, and the status says so, with the
 * error that killed it still on the row), and the jobs behind it for its title can run. MediaWiki keeps what it had.
 */
export async function discardMirrorJob(id: string): Promise<void> {
  const { count } = await db.wikiMirrorJob.updateMany({
    where: { id, source: MIRROR_SOURCE, state: "dead" },
    data: DISCARDED,
  });
  if (count === 0) throw noDeadJob();
  scheduleMirrorKick();
}
