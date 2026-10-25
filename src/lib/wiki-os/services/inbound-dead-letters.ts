/**
 * src/lib/wiki-os/services/inbound-dead-letters.ts — the inbound sync's dead letters (A5)
 *
 * A step of the inbound cycle (a classic recent change or log event) that fails is counted in `wiki_sync_dead_letters`,
 * once per cycle. While it is counted the cycle holds its high-water mark behind it, and the later steps of its page,
 * as before. On its fifth failed cycle it is quarantined: the cycle moves its mark past it and runs the page's later
 * steps, so one bad step cannot stall the sync. The row keeps the step's payload, so an administrator can retry it (the
 * same appliers the cycle runs, under the same lock, so through the same conflict rule) or dismiss it. A success, in a
 * cycle or a retry, clears the count or resolves the quarantined row.
 */

import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "~/server/db";
import { withJobLock } from "~/lib/system/job-lock";
import { PageOperationError } from "~/lib/wiki-os/core/page-operation-error";
import { applyLogEvent } from "./inbound-log-events";
import { fetchRevisionHash } from "./inbound-mediawiki";
import { syncLatestRevision, syncRevisionById } from "./inbound-revision-sync";
import { staleMessage, staleSubject, storedLogEvent } from "./inbound-stale-steps";

/** A step is quarantined on this many failed cycles. */
export const QUARANTINE_AFTER = 5;
/** The advisory lock every inbound sync takes: the cycle, a single page, a retry. */
export const INBOUND_LOCK = "wikios-inbound-sync";
/** A retry holds the lock at most this long. */
const RETRY_LOCK_TIMEOUT_MS = 60_000;
/** `lastError`'s column width. */
const ERROR_MAX = 2_000;

/** What the dead letters need of a cycle's step. */
export interface QuarantinableStep {
  /** "rc:<revid>" | "log:<logid>". */
  key: string;
  stream: "edits" | "log";
  /** The page the step is about. */
  subject: string;
  label: string;
  /** The stream's high-water mark once the step is done. */
  mark: string;
  /** What a retry runs: the recent change, or the log event as the cycle read it. */
  payload: Prisma.InputJsonObject;
}

/**
 * Count one failed cycle of `step`. It is quarantined on its QUARANTINE_AFTER-th, and stays so (a dismissed step that
 * fails again is not counted anew). Called under the inbound lock, so a read then a write is safe.
 */
export async function recordStepFailure(
  step: QuarantinableStep,
  error: string
): Promise<{ quarantined: boolean; attempts: number }> {
  const existing = await db.wikiSyncDeadLetter.findUnique({
    where: { stepKey: step.key },
    select: { attempts: true, quarantinedAt: true },
  });
  const attempts = (existing?.attempts ?? 0) + 1;
  const quarantinedAt =
    existing?.quarantinedAt ?? (attempts >= QUARANTINE_AFTER ? new Date() : null);
  const lastError = error.slice(0, ERROR_MAX);
  await db.wikiSyncDeadLetter.upsert({
    where: { stepKey: step.key },
    create: {
      stepKey: step.key,
      stream: step.stream,
      subject: step.subject,
      label: step.label,
      mark: step.mark,
      payload: step.payload,
      attempts,
      lastError,
      quarantinedAt,
    },
    update: { attempts, lastError, quarantinedAt },
  });
  return { quarantined: quarantinedAt !== null, attempts };
}

/** The steps still failing (counted, or quarantined and unresolved): only their successes have a row to clear. */
export async function loadFailingKeys(): Promise<Set<string>> {
  const rows = await db.wikiSyncDeadLetter.findMany({
    where: { resolvedAt: null },
    select: { stepKey: true },
  });
  return new Set(rows.map((row) => row.stepKey));
}

/** A step succeeded: its count goes, and a quarantined row is resolved (kept as a record). */
export async function clearStepFailure(stepKey: string): Promise<void> {
  await db.wikiSyncDeadLetter.deleteMany({ where: { stepKey, quarantinedAt: null } });
  await db.wikiSyncDeadLetter.updateMany({
    where: { stepKey, quarantinedAt: { not: null }, resolvedAt: null },
    data: { resolvedAt: new Date() },
  });
}

/** Quarantined and neither applied since nor dismissed. */
const OPEN = { quarantinedAt: { not: null }, resolvedAt: null } as const;

/** Why retrying a stored step would undo a later classic change (a log event overtaken), or null. */
async function staleReasonOf(stream: string, payload: Prisma.JsonValue): Promise<string | null> {
  if (stream !== "log") return null;
  const event = storedLogEvent.safeParse(payload);
  if (!event.success) return null;
  const subject = await staleSubject(event.data);
  return subject ? staleMessage(subject) : null;
}

/**
 * The quarantined steps an administrator still has to retry or dismiss, oldest first. `stale`: a later classic change
 * of the step's page or user was applied, so it can only be dismissed (`staleReason` says so).
 */
export async function listQuarantined(limit: number) {
  const rows = await db.wikiSyncDeadLetter.findMany({
    where: OPEN,
    orderBy: [{ quarantinedAt: "asc" }, { id: "asc" }],
    take: limit,
    select: {
      id: true,
      stepKey: true,
      stream: true,
      subject: true,
      label: true,
      attempts: true,
      lastError: true,
      quarantinedAt: true,
      payload: true,
    },
  });
  return Promise.all(
    rows.map(async ({ payload, ...row }) => {
      const staleReason = await staleReasonOf(row.stream, payload);
      return { ...row, stale: staleReason !== null, staleReason };
    })
  );
}

/** How many quarantined steps are unresolved (the sync status is DEGRADED while any is); a dismissed one is not. */
export function countQuarantined(): Promise<number> {
  return db.wikiSyncDeadLetter.count({ where: OPEN });
}

/**
 * Of `keys` (a cycle's steps), those quarantined and resolved since: applied by a retry or a resync, or dismissed. The
 * cycle does not run them again (an rc step at the mark's second comes back every cycle until the mark moves).
 */
export async function loadSettledKeys(keys: string[]): Promise<Set<string>> {
  const rows = await db.wikiSyncDeadLetter.findMany({
    where: { stepKey: { in: keys }, quarantinedAt: { not: null }, resolvedAt: { not: null } },
    select: { stepKey: true },
  });
  return new Set(rows.map((row) => row.stepKey));
}

/** A retry or resync this module refuses (not a failure of the step): nothing is counted, the caller is told why. */
class StepRefusal extends PageOperationError {}

const notQuarantined = () =>
  new PageOperationError("NOT_FOUND", "No quarantined sync step with that id.");

const recentChangePayload = z.object({
  revid: z.number().int().positive(),
  title: z.string().min(1),
});

/** What a retry or a resync did: applied, nothing left to apply (MediaWiki no longer has it), or failed again. */
export type RetryOutcome = "applied" | "skipped" | "failed";

/**
 * Run a stored step the way the cycle runs it: "skipped" when there was nothing to apply. Rejects on a failure, a payload
 * that is not the stream's shape, and (CONFLICT) a log event a later classic change overtook.
 */
async function runStored(
  stream: string,
  payload: Prisma.JsonValue
): Promise<"applied" | "skipped"> {
  if (stream === "log") {
    const event = storedLogEvent.parse(payload);
    const subject = await staleSubject(event);
    if (subject) throw new StepRefusal("CONFLICT", staleMessage(subject));
    return (await applyLogEvent(event)) === "skipped" ? "skipped" : "applied";
  }
  return (await syncRevisionById(recentChangePayload.parse(payload).revid)) === "skipped"
    ? "skipped"
    : "applied";
}

/**
 * Bring the page of a stored recent change over from classic as it is now, judged like a cycle's revision: the page
 * the revision is on at classic now (by its id), not the title it had then.
 */
async function resyncStored(
  stream: string,
  payload: Prisma.JsonValue
): Promise<"applied" | "skipped"> {
  if (stream !== "edits") {
    throw new StepRefusal("BAD_REQUEST", "Only an edit's page can be resynced.");
  }
  const stored = recentChangePayload.parse(payload);
  // classic may have moved the page since: its old title then holds a redirect, so ask classic where the page is now
  const title = (await fetchRevisionHash(stored.revid)).title ?? stored.title;
  return (await syncLatestRevision(title, { judgeCollisions: true })) === "skipped"
    ? "skipped"
    : "applied";
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

type StoredRun = (stream: string, payload: Prisma.JsonValue) => Promise<"applied" | "skipped">;

/**
 * Run `run` on the quarantined step `id` (the lock is held): done resolves it, a failure counts the attempt. A refusal
 * (a log event overtaken, a resync of a log step) changes nothing and is thrown.
 */
async function attemptHeld(id: string, run: StoredRun): Promise<RetryOutcome> {
  const row = await db.wikiSyncDeadLetter.findFirst({
    where: { id, ...OPEN },
    select: { stream: true, payload: true },
  });
  if (!row) throw notQuarantined();
  let outcome: "applied" | "skipped";
  try {
    outcome = await run(row.stream, row.payload);
  } catch (err) {
    if (err instanceof StepRefusal) throw err;
    await db.wikiSyncDeadLetter.update({
      where: { id },
      data: { attempts: { increment: 1 }, lastError: errorMessage(err).slice(0, ERROR_MAX) },
    });
    return "failed";
  }
  await db.wikiSyncDeadLetter.update({ where: { id }, data: { resolvedAt: new Date() } });
  return outcome;
}

/** `attemptHeld` under the inbound lock; refuses while a sync holds it. */
async function attempt(id: string, run: StoredRun): Promise<RetryOutcome> {
  const outcome = await withJobLock(db, INBOUND_LOCK, () => attemptHeld(id, run), {
    timeoutMs: RETRY_LOCK_TIMEOUT_MS,
  });
  if (!outcome.ran) {
    throw new PageOperationError("CONFLICT", "A sync is running. Try again in a moment.");
  }
  return outcome.result;
}

/**
 * Apply a quarantined step again: a recent change through `syncRevisionById`, a log event through `applyLogEvent`, under
 * the inbound lock, so the conflict rule judges it as a cycle would. A log event a later classic change of its page or
 * user overtook is refused (CONFLICT): replayed, it would undo that change. The collisions it records are settled (and
 * their authors told) by the next cycle.
 */
export function retryQuarantined(id: string): Promise<RetryOutcome> {
  return attempt(id, runStored);
}

/**
 * For a quarantined recent change: bring its page over from classic as it is now (its newest revision, judged with
 * `judgeCollisions`), under the inbound lock, and resolve the row. For a page left behind when the quarantined revision
 * is its newest.
 */
export function resyncQuarantined(id: string): Promise<RetryOutcome> {
  return attempt(id, resyncStored);
}

/** Give up on a quarantined step: it leaves the list, and WikiOS keeps what it has for that page. */
export async function dismissQuarantined(id: string): Promise<void> {
  const { count } = await db.wikiSyncDeadLetter.updateMany({
    where: { id, ...OPEN },
    data: { resolvedAt: new Date() },
  });
  if (count === 0) throw notQuarantined();
}
