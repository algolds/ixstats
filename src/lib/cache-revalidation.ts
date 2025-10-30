// src/lib/cache-revalidation.ts
/**
 * Cache Revalidation Service
 * Automatically checks and revalidates cached external API data
 */

import { db } from "~/server/db";
import { externalApiCache, REVALIDATION_INTERVAL } from "./external-api-cache";

/**
 * Find cache entries that need revalidation
 */
export async function findStaleEntries(limit = 50) {
  const now = new Date();
  const weekAgo = new Date(Date.now() - REVALIDATION_INTERVAL.DEFAULT);

  try {
    const entries = await db.externalApiCache.findMany({
      where: {
        OR: [
          // Entries marked as needing revalidation
          { validationStatus: "needs_revalidation" },
          // Entries that haven't been validated recently
          {
            lastValidatedAt: {
              lt: weekAgo,
            },
            validationStatus: "valid",
          },
        ],
        // Not expired yet
        expiresAt: {
          gt: now,
        },
      },
      orderBy: [
        // Prioritize by hit count (popular entries first)
        { hitCount: "desc" },
        // Then by last validation date (oldest first)
        { lastValidatedAt: "asc" },
      ],
      take: limit,
      select: {
        id: true,
        key: true,
        service: true,
        type: true,
        identifier: true,
        countryName: true,
        hitCount: true,
        lastValidatedAt: true,
      },
    });

    return entries;
  } catch (error) {
    console.error("[CacheRevalidation] Error finding stale entries:", error);
    return [];
  }
}

/**
 * Mark entries as needing revalidation
 */
export async function markForRevalidation(
  service?: string,
  countryName?: string
): Promise<number> {
  try {
    const where: any = {};

    if (service) {
      where.service = service;
    }

    if (countryName) {
      where.countryName = countryName;
    }

    const result = await db.externalApiCache.updateMany({
      where,
      data: {
        validationStatus: "needs_revalidation",
      },
    });

    console.log(`[CacheRevalidation] Marked ${result.count} entries for revalidation`);
    return result.count;
  } catch (error) {
    console.error("[CacheRevalidation] Error marking entries for revalidation:", error);
    return 0;
  }
}

/**
 * Get revalidation statistics
 */
export async function getRevalidationStats() {
  try {
    const [needsRevalidation, stale, failed, totalEntries, avgHitCount] = await Promise.all([
      db.externalApiCache.count({
        where: { validationStatus: "needs_revalidation" },
      }),
      db.externalApiCache.count({
        where: { validationStatus: "stale" },
      }),
      db.externalApiCache.count({
        where: { validationStatus: "failed" },
      }),
      db.externalApiCache.count(),
      db.externalApiCache.aggregate({
        _avg: { hitCount: true },
      }),
    ]);

    const weekAgo = new Date(Date.now() - REVALIDATION_INTERVAL.DEFAULT);
    const notRecentlyValidated = await db.externalApiCache.count({
      where: {
        lastValidatedAt: {
          lt: weekAgo,
        },
        validationStatus: "valid",
      },
    });

    return {
      totalEntries,
      needsRevalidation,
      stale,
      failed,
      notRecentlyValidated,
      averageHitCount: avgHitCount._avg.hitCount ?? 0,
    };
  } catch (error) {
    console.error("[CacheRevalidation] Error getting stats:", error);
    return null;
  }
}

/**
 * Clean up failed entries (entries that failed validation multiple times)
 */
export async function cleanupFailedEntries(maxRetries = 5): Promise<number> {
  try {
    // Find entries with too many failed revalidation attempts
    const failedEntries = await db.externalApiCache.findMany({
      where: {
        validationStatus: "failed",
      },
      select: {
        id: true,
        metadata: true,
      },
    });

    const toDelete: string[] = [];

    for (const entry of failedEntries) {
      if (entry.metadata) {
        try {
          const metadata = JSON.parse(entry.metadata);
          if (metadata.revalidationAttempts >= maxRetries) {
            toDelete.push(entry.id);
          }
        } catch {
          // Invalid metadata, mark for deletion
          toDelete.push(entry.id);
        }
      }
    }

    if (toDelete.length > 0) {
      await db.externalApiCache.deleteMany({
        where: {
          id: {
            in: toDelete,
          },
        },
      });

      console.log(`[CacheRevalidation] Deleted ${toDelete.length} failed entries`);
    }

    return toDelete.length;
  } catch (error) {
    console.error("[CacheRevalidation] Error cleaning up failed entries:", error);
    return 0;
  }
}

/**
 * Automatic cleanup job
 * Combines expired entry cleanup with failed entry cleanup
 */
export async function runCleanupJob() {
  console.log("[CacheRevalidation] Running automatic cleanup job...");

  const [expiredCount, failedCount] = await Promise.all([
    externalApiCache.cleanupExpired(),
    cleanupFailedEntries(),
  ]);

  const stats = await getRevalidationStats();

  console.log("[CacheRevalidation] Cleanup complete:", {
    expiredRemoved: expiredCount,
    failedRemoved: failedCount,
    stats,
  });

  return {
    expiredRemoved: expiredCount,
    failedRemoved: failedCount,
    stats,
  };
}
