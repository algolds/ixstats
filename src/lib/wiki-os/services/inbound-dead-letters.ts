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
import { syncRevisionById } from "./inbound-revision-sync";

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

/** The quarantined steps an administrator still has to retry or dismiss, oldest first. */
export function listQuarantined(limit: number) {
  return db.wikiSyncDeadLetter.findMany({
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
    },
  });
}

/** How many quarantined steps are unresolved (the sync status is DEGRADED while any is). */
export function countQuarantined(): Promise<number> {
  return db.wikiSyncDeadLetter.count({ where: OPEN });
}

const notQuarantined = () =>
  new PageOperationError("NOT_FOUND", "No quarantined sync step with that id.");

const jsonValue = z.json();
const recentChangePayload = z.object({ revid: z.number().int().positive() });
const logEventPayload = z.object({
  logid: z.number().int(),
  type: z.string(),
  action: z.string(),
  title: z.string(),
  user: z.string().nullable(),
  timestamp: z.string(),
  comment: z.string(),
  params: z.record(z.string(), jsonValue),
  pageId: z.number().int().optional(),
});

/** Run a stored step the way the cycle runs it; rejects on a failure or a payload that is not the stream's shape. */
async function runStored(stream: string, payload: Prisma.JsonValue): Promise<void> {
  if (stream === "log") {
    await applyLogEvent(logEventPayload.parse(payload));
    return;
  }
  await syncRevisionById(recentChangePayload.parse(payload).revid);
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/** Retry the quarantined step `id` (the lock is held): applied resolves it, a failure counts the attempt. */
async function retryHeld(id: string): Promise<"applied" | "failed"> {
  const row = await db.wikiSyncDeadLetter.findFirst({
    where: { id, ...OPEN },
    select: { stream: true, payload: true },
  });
  if (!row) throw notQuarantined();
  try {
    await runStored(row.stream, row.payload);
  } catch (err) {
    await db.wikiSyncDeadLetter.update({
      where: { id },
      data: { attempts: { increment: 1 }, lastError: errorMessage(err).slice(0, ERROR_MAX) },
    });
    return "failed";
  }
  await db.wikiSyncDeadLetter.update({ where: { id }, data: { resolvedAt: new Date() } });
  return "applied";
}

/**
 * Apply a quarantined step again: a recent change through `syncRevisionById`, a log event through `applyLogEvent`, under
 * the inbound lock, so the conflict rule judges it as a cycle would. The collisions it records are settled (and their
 * authors told) by the next cycle. Refuses while a sync holds the lock.
 */
export async function retryQuarantined(id: string): Promise<"applied" | "failed"> {
  const outcome = await withJobLock(db, INBOUND_LOCK, () => retryHeld(id), {
    timeoutMs: RETRY_LOCK_TIMEOUT_MS,
  });
  if (!outcome.ran) {
    throw new PageOperationError("CONFLICT", "A sync is running. Try again in a moment.");
  }
  return outcome.result;
}

/** Give up on a quarantined step: it leaves the list, and WikiOS keeps what it has for that page. */
export async function dismissQuarantined(id: string): Promise<void> {
  const { count } = await db.wikiSyncDeadLetter.updateMany({
    where: { id, ...OPEN },
    data: { resolvedAt: new Date() },
  });
  if (count === 0) throw notQuarantined();
}
