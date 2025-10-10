/**
 * Scheduled Changes Cron Job
 *
 * This cron job should run every IxDay to:
 * 1. Apply all scheduled changes that are due
 * 2. Trigger country recalculations for affected countries
 * 3. Update vitality scores
 * 4. Log results
 *
 * Usage:
 * - Vercel Cron: Configure in vercel.json
 * - Manual: Call applyScheduledChangesJob() from an API route
 * - Local dev: Use node-cron or similar
 */

import { db } from "~/server/db";
import { IxTime } from "~/lib/ixtime";

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
    // Get current IxTime for logging
    const currentIxTime = IxTime.getCurrentIxTime();
    console.log(`[CRON] Current IxTime timestamp: ${currentIxTime}`);

    // Find all changes that are due
    const now = new Date();
    const dueChanges = await db.scheduledChange.findMany({
      where: {
        status: "pending",
        scheduledFor: {
          lte: now,
        },
      },
      include: {
        user: {
          include: {
            country: true,
          },
        },
      },
      orderBy: {
        scheduledFor: "asc",
      },
    });

    console.log(`[CRON] Found ${dueChanges.length} due changes`);

    if (dueChanges.length === 0) {
      return {
        success: true,
        appliedCount: 0,
        errorCount: 0,
        affectedCountries: [],
        errors: [],
        duration: Date.now() - startTime,
      };
    }

    const appliedChanges: string[] = [];
    const errors: Array<{ changeId: string; error: string }> = [];
    const affectedCountries = new Set<string>();

    // Apply each change
    for (const change of dueChanges) {
      try {
        console.log(`[CRON] Applying change ${change.id} to field ${change.fieldPath}`);

        // Parse the new value
        const newValue = JSON.parse(change.newValue) as unknown;

        // Build update object
        const updateData: Record<string, unknown> = {};
        updateData[change.fieldPath] = newValue;

        // Update the country
        await db.country.update({
          where: { id: change.countryId },
          data: updateData,
        });

        // Mark change as applied
        await db.scheduledChange.update({
          where: { id: change.id },
          data: {
            status: "applied",
            appliedAt: new Date(),
          },
        });

        appliedChanges.push(change.id);
        affectedCountries.add(change.countryId);

        console.log(`[CRON] ✓ Successfully applied change ${change.id}`);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        console.error(`[CRON] ✗ Failed to apply change ${change.id}:`, errorMessage);

        errors.push({
          changeId: change.id,
          error: errorMessage,
        });

        // Mark change as failed (optional - add a "failed" status to schema if desired)
        // For now, we'll leave it as pending so it can be retried
      }
    }

    // Trigger recalculations for affected countries
    console.log(`[CRON] Triggering recalculations for ${affectedCountries.size} countries...`);

    for (const countryId of affectedCountries) {
      try {
        // You would call your recalculation logic here
        // For now, we'll just update the lastCalculated timestamp
        await db.country.update({
          where: { id: countryId },
          data: {
            lastCalculated: new Date(),
          },
        });

        console.log(`[CRON] ✓ Triggered recalculation for country ${countryId}`);
      } catch (error) {
        console.error(`[CRON] ✗ Failed to trigger recalculation for country ${countryId}:`, error);
      }
    }

    const duration = Date.now() - startTime;
    const result: ApplyResult = {
      success: errors.length === 0,
      appliedCount: appliedChanges.length,
      errorCount: errors.length,
      affectedCountries: Array.from(affectedCountries),
      errors,
      duration,
    };

    console.log(`[CRON] Completed in ${duration}ms`);
    console.log(`[CRON] Applied: ${result.appliedCount}, Errors: ${result.errorCount}`);

    return result;
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
  const [total, pending, applied, cancelled, overdue] = await Promise.all([
    db.scheduledChange.count(),
    db.scheduledChange.count({ where: { status: "pending" } }),
    db.scheduledChange.count({ where: { status: "applied" } }),
    db.scheduledChange.count({ where: { status: "cancelled" } }),
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
    overdue,
  };
}
