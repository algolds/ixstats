/**
 * Scheduled changes — apply service shared by the tRPC router and the cron job.
 *
 * A change is applied exactly once: the row is claimed with a conditional `updateMany`
 * (`status = "pending" AND scheduledFor <= now`) inside the same transaction that writes
 * its StorytellerEffect. Postgres row locking makes this safe under concurrency: a second
 * transaction blocks on the row, re-evaluates `status = 'pending'` after the first
 * commits, and gets `count === 0`. Notifications fire only after commit.
 *
 * Retry policy: a change that fails validation (disallowed field path, non-numeric or
 * zero oldValue) is deterministic and goes to the terminal status "failed" (the column is
 * a plain String, so no migration is needed). Transient failures (DB errors inside the
 * claim transaction) roll back and leave the row "pending", so the next run retries it.
 * An attempt counter was rejected because it would need a schema migration against
 * production data for a feature with (as far as the repo shows) no creation UI.
 *
 * Value semantics: the effect `value` is the relative change `(new - old) / |old|`
 * (see ./effect-value.ts), which the economy engine clamps to ±0.5.
 */

import type { PrismaClient, ScheduledChange } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import { db as defaultDb } from "~/server/db";
import { IxTime } from "~/lib/ixtime";
import { notificationAPI } from "~/lib/notifications/api";
import {
  FIELD_TO_EFFECT_TYPE,
  IMPACT_TO_DURATION,
  IMPACT_TO_PRIORITY,
  isAllowedFieldPath,
  toEffectValue,
  type AllowedFieldPath,
} from "./effect-value";

interface ApplyDueResult {
  appliedCount: number;
  /** Deterministic validation failures plus transient errors; equals `errors.length`. */
  failedCount: number;
  /** Rows that were no longer claimable (applied/cancelled concurrently, or not due). */
  skippedCount: number;
  appliedChanges: string[];
  affectedCountries: string[];
  errors: Array<{ changeId: string; error: string }>;
}

type ChangeRow = Pick<
  ScheduledChange,
  "id" | "userId" | "countryId" | "fieldPath" | "oldValue" | "newValue" | "impactLevel"
>;

type ValidatedChange =
  | { ok: true; fieldPath: AllowedFieldPath; value: number }
  | { ok: false; reason: string };

type ApplyOutcome = { kind: "applied" } | { kind: "skipped" } | { kind: "failed"; reason: string };

function validateChange(change: ChangeRow): ValidatedChange {
  if (!isAllowedFieldPath(change.fieldPath)) {
    return { ok: false, reason: `Invalid field path: "${change.fieldPath}"` };
  }
  const valueResult = toEffectValue(change.oldValue, change.newValue);
  if (!valueResult.ok) return valueResult;
  return { ok: true, fieldPath: change.fieldPath, value: valueResult.value };
}

async function fireAndForgetNotify(promise: Promise<string>): Promise<void> {
  try {
    await promise;
  } catch {
    // fire-and-forget — notification failure must not fail the apply
  }
}

/** Validate before claiming; then claim + write the effect atomically. */
async function applyOne(db: PrismaClient, change: ChangeRow, now: Date): Promise<ApplyOutcome> {
  const validated = validateChange(change);
  if (!validated.ok) {
    // Conditional, so a concurrent apply/cancel is never overwritten.
    await db.scheduledChange.updateMany({
      where: { id: change.id, status: "pending" },
      data: { status: "failed" },
    });
    return { kind: "failed", reason: validated.reason };
  }

  const claimed = await db.$transaction(async (tx) => {
    const claim = await tx.scheduledChange.updateMany({
      where: { id: change.id, status: "pending", scheduledFor: { lte: now } },
      data: { status: "applied", appliedAt: now },
    });
    if (claim.count !== 1) return false; // someone else applied/cancelled it, or not due
    await tx.storytellerEffect.create({
      data: {
        countryId: change.countryId,
        ixTimeTimestamp: new Date(IxTime.getCurrentIxTime()), // already milliseconds
        inputType: FIELD_TO_EFFECT_TYPE[validated.fieldPath],
        value: validated.value,
        description: `Scheduled change: ${validated.fieldPath} → ${change.newValue} (impact: ${change.impactLevel})`,
        duration: IMPACT_TO_DURATION[change.impactLevel] ?? 0,
        isActive: true,
        createdBy: change.userId,
      },
    });
    return true;
  });
  if (!claimed) return { kind: "skipped" };

  // Only after commit.
  void fireAndForgetNotify(
    notificationAPI.create({
      title: "Scheduled Change Applied",
      message: `${validated.fieldPath} updated to ${change.newValue} (${change.impactLevel} impact)`,
      countryId: change.countryId,
      category: "economic",
      type: "update",
      priority: IMPACT_TO_PRIORITY[change.impactLevel] ?? "medium",
      source: "scheduled-changes",
    })
  );
  return { kind: "applied" };
}

/** Owner-triggered early/manual apply. Throws TRPCError. */
export async function applyScheduledChangeForUser(
  db: PrismaClient,
  args: { changeId: string; userId: string; now?: Date }
): Promise<ScheduledChange> {
  const now = args.now ?? new Date();
  const change = await db.scheduledChange.findUnique({ where: { id: args.changeId } });

  if (!change) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Scheduled change not found" });
  }
  if (change.userId !== args.userId) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "You don't have permission to apply this change",
    });
  }
  if (change.scheduledFor > now) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Change is not due yet" });
  }
  if (change.status !== "pending") {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Change has already been applied or cancelled",
    });
  }

  const outcome = await applyOne(db, change, now);
  if (outcome.kind === "failed") {
    throw new TRPCError({ code: "BAD_REQUEST", message: outcome.reason });
  }
  if (outcome.kind === "skipped") {
    throw new TRPCError({ code: "CONFLICT", message: "Change was already applied or cancelled" });
  }
  return db.scheduledChange.findUniqueOrThrow({ where: { id: args.changeId } });
}

/** Cron/admin: apply every due pending change once. Never throws per-change. */
export async function applyDueScheduledChanges(
  opts: { db?: PrismaClient; now?: Date } = {}
): Promise<ApplyDueResult> {
  const db = opts.db ?? defaultDb;
  const now = opts.now ?? new Date();

  const due = await db.scheduledChange.findMany({
    where: { status: "pending", scheduledFor: { lte: now } },
    orderBy: { scheduledFor: "asc" },
    take: 500, // explicit: src/server/db.ts otherwise forces 1000
    select: {
      id: true,
      userId: true,
      countryId: true,
      fieldPath: true,
      oldValue: true,
      newValue: true,
      impactLevel: true,
    },
  });

  const result: ApplyDueResult = {
    appliedCount: 0,
    failedCount: 0,
    skippedCount: 0,
    appliedChanges: [],
    affectedCountries: [],
    errors: [],
  };
  const affected = new Set<string>();

  for (const change of due) {
    try {
      const outcome = await applyOne(db, change, now);
      if (outcome.kind === "applied") {
        result.appliedCount += 1;
        result.appliedChanges.push(change.id);
        affected.add(change.countryId);
      } else if (outcome.kind === "skipped") {
        result.skippedCount += 1;
      } else {
        result.failedCount += 1;
        result.errors.push({ changeId: change.id, error: outcome.reason });
      }
    } catch (error) {
      // Transient: the transaction rolled back, the row is still pending and retries next run.
      result.failedCount += 1;
      result.errors.push({
        changeId: change.id,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  result.affectedCountries = Array.from(affected);
  return result;
}
