/**
 * Scheduled Changes Cron Job
 *
 * Applies every due, pending ScheduledChange exactly once through the shared service
 * (`~/server/modules/scheduled-changes/service`). Each applied change writes a correctly
 * dated StorytellerEffect that the normal calculation pipeline picks up via
 * getActiveEffects — no direct Country writes and no separate "recalculation" step.
 *
 * Usage:
 * - HTTP: GET/POST /api/cron/apply-scheduled-changes (CRON_SECRET-guarded route)
 * - Manual: call applyScheduledChangesJob() from server code
 * - Scheduling: plan 330's job table calls applyDueScheduledChanges() directly
 */

import { db } from "~/server/db";
import { applyDueScheduledChanges } from "~/server/modules/scheduled-changes/service";

interface ApplyResult {
  success: boolean;
  appliedCount: number;
  errorCount: number;
  affectedCountries: string[];
  errors: Array<{ changeId: string; error: string }>;
  duration: number;
}

/**
 * Main cron job function
 */
export async function applyScheduledChangesJob(): Promise<ApplyResult> {
  const startTime = Date.now();
  console.log("[CRON] Starting scheduled changes application...");

  try {
    const result = await applyDueScheduledChanges();
    const duration = Date.now() - startTime;

    console.log(
      `[CRON] Applied: ${result.appliedCount}, Skipped: ${result.skippedCount}, Errors: ${result.errors.length} (${duration}ms)`
    );

    return {
      success: result.errors.length === 0,
      appliedCount: result.appliedCount,
      errorCount: result.errors.length,
      affectedCountries: result.affectedCountries,
      errors: result.errors,
      duration,
    };
  } catch (error) {
    console.error("[CRON] Fatal error in scheduled changes job:", error);
    throw error;
  }
}

/**
 * Cleanup old scheduled changes
 * Removes applied/cancelled changes older than 30 days
 */
export async function cleanupOldChanges(): Promise<number> {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const result = await db.scheduledChange.deleteMany({
    where: {
      status: {
        in: ["applied", "cancelled"],
      },
      updatedAt: {
        lt: thirtyDaysAgo,
      },
    },
  });

  console.log(`[CLEANUP] Removed ${result.count} old scheduled changes`);
  return result.count;
}

/**
 * Get statistics about scheduled changes
 */
export async function getScheduledChangesStats() {
  const [total, pending, applied, cancelled, failed, overdue] = await Promise.all([
    db.scheduledChange.count(),
    db.scheduledChange.count({ where: { status: "pending" } }),
    db.scheduledChange.count({ where: { status: "applied" } }),
    db.scheduledChange.count({ where: { status: "cancelled" } }),
    db.scheduledChange.count({ where: { status: "failed" } }),
    db.scheduledChange.count({
      where: {
        status: "pending",
        scheduledFor: {
          lt: new Date(),
        },
      },
    }),
  ]);

  return {
    total,
    pending,
    applied,
    cancelled,
    failed,
    overdue,
  };
}
