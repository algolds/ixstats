/**
 * mirror-admin.ts — what an administrator sees of the outbound mirror, and what they can do about a dead job.
 *
 * A dead job means classic MediaWiki is out of sync for that title until the job is requeued (tried again, from
 * the first attempt) or discarded (given up on: it stops blocking the jobs behind it). Both only apply to dead
 * jobs: a job that is pending or running is the worker's.
 */

import { db } from "~/server/db";
import { mirrorBotName } from "../adapters/mediawiki/csrf-cache";
import { PageOperationError } from "../core/page-management-service";
import { MIRROR_SOURCE, scheduleMirrorKick } from "./mirror-outbox";

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
  return {
    paused: process.env.SKIP_MEDIAWIKI_SYNC === "true",
    botConfigured: mirrorBotName() !== null && Boolean(process.env.WIKIOS_MEDIAWIKI_BOT_TOKEN),
    counts,
    oldestPendingSeconds: oldest
      ? Math.max(0, Math.round((now.getTime() - oldest.createdAt.getTime()) / 1000))
      : null,
    uploadsWaiting,
    dead: dead.map(({ updatedAt, ...job }) => ({ ...job, diedAt: updatedAt })),
  };
}

/** The settings the mirror needs before WikiOS may take edits; empty when it can write to MediaWiki. */
export function mirrorMissingSettings(): string[] {
  const missing: string[] = [];
  // Read from the environment, not wikiosConfig (frozen at module load), so the answer follows the current process.
  if (!process.env.WIKIOS_MEDIAWIKI_BOT_USER?.trim()) missing.push("WIKIOS_MEDIAWIKI_BOT_USER");
  if (!process.env.WIKIOS_MEDIAWIKI_BOT_TOKEN) missing.push("WIKIOS_MEDIAWIKI_BOT_TOKEN");
  if (!process.env.WIKIOS_MEDIAWIKI_API) missing.push("WIKIOS_MEDIAWIKI_API");
  return missing;
}

const noDeadJob = () => new PageOperationError("NOT_FOUND", "No dead mirror job with that id.");

/** Try a dead job again from its first attempt; it blocks nothing once it succeeds. */
export async function requeueMirrorJob(id: string): Promise<void> {
  const { count } = await db.wikiMirrorJob.updateMany({
    where: { id, source: MIRROR_SOURCE, state: "dead" },
    data: { state: "pending", attempts: 0, nextAttemptAt: new Date() },
  });
  if (count === 0) throw noDeadJob();
  scheduleMirrorKick();
}

/**
 * Give up on a dead job: it becomes `discarded` (not `done`: MediaWiki never got it, and the status says so, with the
 * error that killed it still on the row), and the jobs behind it for its title can run. MediaWiki keeps what it had.
 */
export async function discardMirrorJob(id: string): Promise<void> {
  const { count } = await db.wikiMirrorJob.updateMany({
    where: { id, source: MIRROR_SOURCE, state: "dead" },
    data: { state: "discarded" },
  });
  if (count === 0) throw noDeadJob();
  scheduleMirrorKick();
}
