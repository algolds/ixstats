/**
 * NationStates Card Sync Service
 *
 * Handles daily synchronization of NS card data with IxCards database.
 * Provides incremental sync logic, conflict resolution, and monitoring.
 *
 * Features:
 * - Daily automated sync (cron-compatible)
 * - Incremental updates (only changed cards)
 * - Conflict resolution (NS data takes precedence for NS_IMPORT cards)
 * - Comprehensive logging and monitoring
 * - Database transaction safety
 *
 * Usage:
 * - Call performSync(season) from a cron job
 * - Monitor via logSyncStatus() output
 * - Use scheduleDailySync() to get cron configuration
 */

import { db } from "~/server/db";
import type { NSCard } from "./ns-api-client";
import { nsApiClient } from "./ns-api-client";
import { checkpointManager } from "./ns-sync-checkpoint";

/**
 * Sync status for monitoring
 */
export interface SyncStatus {
  season: number;
  startTime: Date;
  endTime?: Date;
  cardsProcessed: number;
  cardsCreated: number;
  cardsUpdated: number;
  conflictsResolved: number;
  errors: string[];
  status: "running" | "completed" | "failed";
}

/**
 * Cron schedule configuration for daily sync
 * Returns configuration object (actual cron setup handled externally)
 */
export function scheduleDailySync() {
  return {
    // Run at 11:30 PM PST (30 minutes after NS dump generation at 10:30 PM PST)
    cronExpression: "30 23 * * *",
    timezone: "America/Los_Angeles",
    description: "Daily NS card dump sync (runs at 11:30 PM PST)",
    handler: "performSync",
    seasons: [1, 2, 3], // Configure which seasons to sync
  };
}

/**
 * Perform incremental sync of NS cards for a season
 *
 * @param season - Season number to sync
 * @returns Sync status with results
 */
export async function performSync(season: number): Promise<SyncStatus> {
  const status: SyncStatus = {
    season,
    startTime: new Date(),
    cardsProcessed: 0,
    cardsCreated: 0,
    cardsUpdated: 0,
    conflictsResolved: 0,
    errors: [],
    status: "running",
  };

  console.log(`[NS Card Sync] Starting sync for season ${season}`);

  try {
    // Check for existing checkpoint
    let resumeFromCheckpoint = false;
    let startIndex = 0;
    const existingCheckpoint = await checkpointManager.loadCheckpoint(season);

    if (existingCheckpoint) {
      console.log(
        `[NS Card Sync] Resuming from checkpoint: ${existingCheckpoint.cardsProcessed}/${existingCheckpoint.totalCards} cards already processed`
      );
      resumeFromCheckpoint = true;
      startIndex = existingCheckpoint.cardsProcessed;
      status.cardsProcessed = existingCheckpoint.cardsProcessed;
      status.errors = existingCheckpoint.metadata?.errors || [];
    }

    // Fetch and parse card dump
    const xmlData = await nsApiClient.fetchCardDump(season);
    const nsCards = await nsApiClient.parseNSDump(xmlData);

    console.log(`[NS Card Sync] Processing ${nsCards.length} cards for season ${season}` +
      (resumeFromCheckpoint ? ` (resuming from card ${startIndex})` : ""));

    // Create initial checkpoint if not resuming
    if (!resumeFromCheckpoint) {
      await checkpointManager.createInitialCheckpoint(season, nsCards.length);
    }

    // Process cards in batches for better performance
    const batchSize = 100;
    for (let i = startIndex; i < nsCards.length; i += batchSize) {
      const batch = nsCards.slice(i, Math.min(i + batchSize, nsCards.length));

      try {
        // Process batch within transaction for consistency
        await db.$transaction(async (tx) => {
          for (const nsCard of batch) {
            try {
              status.cardsProcessed++;

              // Check if card exists in database
              const existingCard = await tx.card.findFirst({
                where: {
                  nsCardId: parseInt(nsCard.id),
                  nsSeason: parseInt(nsCard.season),
                },
              });

              if (!existingCard) {
                // Create new card
                await tx.card.create({
                  data: {
                    title: nsCard.name || `NS Card ${nsCard.id}`,
                    description: nsCard.slogan || `NationStates trading card from season ${nsCard.season}`,
                    artwork: nsCard.flag || "",
                    cardType: "NS_IMPORT",
                    rarity: nsCard.rarity as any, // Cast to Prisma CardRarity enum
                    season: parseInt(nsCard.season),
                    nsCardId: parseInt(nsCard.id),
                    nsSeason: parseInt(nsCard.season),
                    metadata: {
                      region: nsCard.region,
                      cardCategory: nsCard.cardcategory,
                      badge: nsCard.badge,
                      trophies: nsCard.trophies,
                      marketValue: nsCard.market_value,
                      syncedAt: new Date().toISOString(),
                    },
                    totalSupply: 0,
                    marketValue: parseFloat(nsCard.market_value || "0"),
                  },
                });
                status.cardsCreated++;
              } else {
                // Update existing card if it's an NS_IMPORT type
                const conflict = resolveConflicts(nsCard, existingCard);

                if (conflict.shouldUpdate) {
                  await tx.card.update({
                    where: { id: existingCard.id },
                    data: {
                      title: nsCard.name || existingCard.title,
                      rarity: nsCard.rarity as any,
                      artwork: nsCard.flag || existingCard.artwork,
                      marketValue: parseFloat(nsCard.market_value || "0"),
                      metadata: {
                        ...(existingCard.metadata as any),
                        region: nsCard.region,
                        cardCategory: nsCard.cardcategory,
                        badge: nsCard.badge,
                        trophies: nsCard.trophies,
                        marketValue: nsCard.market_value,
                        syncedAt: new Date().toISOString(),
                      },
                    },
                  });
                  status.cardsUpdated++;

                  if (conflict.wasConflict) {
                    status.conflictsResolved++;
                  }
                }
              }
            } catch (error) {
              const errorMsg = `Error processing card ${nsCard.id}: ${error}`;
              console.error(`[NS Card Sync] ${errorMsg}`);
              status.errors.push(errorMsg);
            }
          }
        });

        // Log progress every 1000 cards
        if ((i + batchSize) % 1000 === 0 || i + batchSize >= nsCards.length) {
          console.log(
            `[NS Card Sync] Progress: ${status.cardsProcessed}/${nsCards.length} ` +
            `(${status.cardsCreated} created, ${status.cardsUpdated} updated, ${status.errors.length} errors)`
          );
        }

        // Save checkpoint every 500 cards
        if (checkpointManager.shouldSaveCheckpoint(status.cardsProcessed)) {
          const lastCard = batch[batch.length - 1];
          await checkpointManager.saveCheckpoint({
            season,
            status: "IN_PROGRESS",
            cardsProcessed: status.cardsProcessed,
            totalCards: nsCards.length,
            lastProcessedCardId: lastCard?.id || null,
            errorCount: status.errors.length,
            startedAt: status.startTime,
            lastCheckpointAt: new Date(),
            completedAt: null,
            metadata: { errors: status.errors },
          });
        }
      } catch (error) {
        const errorMsg = `Batch processing error at index ${i}: ${error}`;
        console.error(`[NS Card Sync] ${errorMsg}`);
        status.errors.push(errorMsg);
      }
    }

    status.endTime = new Date();
    status.status = status.errors.length > 0 && status.cardsProcessed === 0 ? "failed" : "completed";

    // Mark checkpoint as completed or clear it
    if (status.status === "completed") {
      await checkpointManager.markCompleted(season);
      // Clear checkpoint after successful completion
      await checkpointManager.clearCheckpoint(season);
      console.log(`[NS Card Sync] ✓ Sync completed successfully, checkpoint cleared`);
    } else {
      await checkpointManager.markFailed(season, status.errors.join("; "));
      console.warn(`[NS Card Sync] ⚠ Sync completed with errors, checkpoint marked as failed`);
    }

    await logSyncStatus(status);
    return status;
  } catch (error) {
    const errorMsg = `Fatal sync error: ${error}`;
    console.error(`[NS Card Sync] ${errorMsg}`);
    status.errors.push(errorMsg);
    status.endTime = new Date();
    status.status = "failed";

    // Mark checkpoint as failed
    try {
      await checkpointManager.markFailed(season, errorMsg);
    } catch (checkpointError) {
      console.error(`[NS Card Sync] Failed to mark checkpoint as failed:`, checkpointError);
    }

    await logSyncStatus(status);
    return status;
  }
}

/**
 * Resolve conflicts between NS card data and existing IxCard data
 * NS data takes precedence for NS_IMPORT cards
 *
 * @param nsCard - Card data from NS dump
 * @param ixCard - Existing card in database
 * @returns Conflict resolution decision
 */
export function resolveConflicts(
  nsCard: NSCard,
  ixCard: any
): {
  shouldUpdate: boolean;
  wasConflict: boolean;
  reason: string;
} {
  // If card is not NS_IMPORT type, don't update (it's custom IxCards content)
  if (ixCard.cardType !== "NS_IMPORT") {
    return {
      shouldUpdate: false,
      wasConflict: false,
      reason: "Card is custom IxCards content, NS data ignored",
    };
  }

  // Check if data actually changed
  const hasChanges =
    ixCard.title !== nsCard.name ||
    ixCard.rarity !== nsCard.rarity ||
    ixCard.artwork !== nsCard.flag;

  if (!hasChanges) {
    return {
      shouldUpdate: false,
      wasConflict: false,
      reason: "No changes detected",
    };
  }

  // NS data takes precedence for NS_IMPORT cards
  return {
    shouldUpdate: true,
    wasConflict: true,
    reason: "NS data updated (NS takes precedence for NS_IMPORT cards)",
  };
}

/**
 * Log sync status for monitoring and debugging
 *
 * @param status - Sync status to log
 */
export async function logSyncStatus(status: SyncStatus): Promise<void> {
  const duration = status.endTime
    ? (status.endTime.getTime() - status.startTime.getTime()) / 1000
    : 0;

  const summary = {
    season: status.season,
    status: status.status,
    duration: `${duration.toFixed(2)}s`,
    cardsProcessed: status.cardsProcessed,
    cardsCreated: status.cardsCreated,
    cardsUpdated: status.cardsUpdated,
    conflictsResolved: status.conflictsResolved,
    errorCount: status.errors.length,
    startTime: status.startTime.toISOString(),
    endTime: status.endTime?.toISOString() || "running",
  };

  console.log(`[NS Card Sync] Sync Summary:`, JSON.stringify(summary, null, 2));

  if (status.errors.length > 0) {
    console.error(`[NS Card Sync] Errors (${status.errors.length}):`, status.errors);
  }

  // Log to database for historical tracking
  try {
    await db.syncLog.create({
      data: {
        syncType: "ns-card-sync",
        status: status.status,
        itemsProcessed: status.cardsProcessed,
        itemsFailed: status.errors.length,
        errorMessage: status.errors.length > 0 ? JSON.stringify(status.errors) : null,
        startedAt: status.startTime,
        completedAt: status.endTime || null,
        metadata: JSON.stringify({
          season: status.season,
          cardsCreated: status.cardsCreated,
          cardsUpdated: status.cardsUpdated,
          conflictsResolved: status.conflictsResolved,
        }),
      },
    });
  } catch (error) {
    console.error(`[NS Card Sync] Failed to log sync status to database:`, error);
  }
}

/**
 * Get latest sync status for a season
 *
 * @param season - Season number
 * @returns Latest sync status from database
 */
export async function getLatestSyncStatus(season: number): Promise<SyncStatus | null> {
  try {
    const latestLog = await db.syncLog.findFirst({
      where: {
        syncType: "ns-card-sync",
      },
      orderBy: {
        startedAt: "desc",
      },
    });

    if (!latestLog) {
      return null;
    }

    const metadata = latestLog.metadata ? JSON.parse(latestLog.metadata as string) : {};

    return {
      season: metadata.season ?? season,
      startTime: latestLog.startedAt,
      endTime: latestLog.completedAt || undefined,
      cardsProcessed: latestLog.itemsProcessed,
      cardsCreated: metadata.cardsCreated ?? 0,
      cardsUpdated: metadata.cardsUpdated ?? 0,
      conflictsResolved: metadata.conflictsResolved ?? 0,
      errors: latestLog.errorMessage ? JSON.parse(latestLog.errorMessage) : [],
      status: latestLog.status as "running" | "completed" | "failed",
    };
  } catch (error) {
    console.error(`[NS Card Sync] Error fetching sync status:`, error);
    return null;
  }
}

/**
 * Validate sync health across all seasons
 * Checks if syncs are running on schedule
 *
 * @returns Health status for all seasons
 */
export async function validateSyncHealth(): Promise<{
  healthy: boolean;
  seasons: Array<{
    season: number;
    lastSync?: Date;
    hoursSinceSync?: number;
    status: "healthy" | "warning" | "critical";
  }>;
}> {
  const seasons = [1, 2, 3]; // Configure active seasons
  const results = [];

  for (const season of seasons) {
    const latestSync = await getLatestSyncStatus(season);

    if (!latestSync) {
      results.push({
        season,
        status: "critical" as const,
      });
      continue;
    }

    const hoursSinceSync =
      (Date.now() - latestSync.startTime.getTime()) / (1000 * 60 * 60);

    results.push({
      season,
      lastSync: latestSync.startTime,
      hoursSinceSync: Math.round(hoursSinceSync * 10) / 10,
      status:
        hoursSinceSync < 25
          ? ("healthy" as const)
          : hoursSinceSync < 48
            ? ("warning" as const)
            : ("critical" as const),
    });
  }

  const healthy = results.every((r) => r.status === "healthy");

  return {
    healthy,
    seasons: results,
  };
}

/**
 * Batch Import Interface
 * Enhanced user-facing import for NationStates deck imports
 */
export interface BatchImportProgress {
  total: number;
  processed: number;
  created: number;
  duplicates: number;
  errors: string[];
  status: "pending" | "processing" | "completed" | "failed";
  currentCard?: string;
}

/**
 * Perform batch import of NationStates cards from user deck
 * User-friendly wrapper for card imports with progress tracking
 *
 * @param nsCards - Array of NS cards from fetchDeck
 * @param userId - User ID to assign ownership
 * @param onProgress - Optional progress callback
 * @returns Import results
 */
export async function batchImportUserDeck(
  nsCards: NSCard[],
  userId: string,
  onProgress?: (progress: BatchImportProgress) => void
): Promise<BatchImportProgress> {
  const progress: BatchImportProgress = {
    total: nsCards.length,
    processed: 0,
    created: 0,
    duplicates: 0,
    errors: [],
    status: "processing",
  };

  // Notify initial status
  onProgress?.(progress);

  for (const nsCard of nsCards) {
    try {
      progress.currentCard = nsCard.name || `Card ${nsCard.id}`;
      onProgress?.(progress);

      // Check if card already exists
      const existing = await db.card.findFirst({
        where: {
          nsCardId: parseInt(nsCard.id),
          nsSeason: parseInt(nsCard.season),
        },
      });

      if (existing) {
        // Card already imported - mark as duplicate
        progress.duplicates++;
      } else {
        // Import new card
        await db.card.create({
          data: {
            title: nsCard.name || `NS Card ${nsCard.id}`,
            description: nsCard.slogan || `NationStates trading card from season ${nsCard.season}`,
            artwork: nsCard.flag || "",
            cardType: "NS_IMPORT",
            rarity: nsCard.rarity as any,
            season: parseInt(nsCard.season),
            nsCardId: parseInt(nsCard.id),
            nsSeason: parseInt(nsCard.season),
            metadata: {
              region: nsCard.region,
              cardCategory: nsCard.cardcategory,
              badge: nsCard.badge,
              trophies: nsCard.trophies,
              marketValue: nsCard.market_value,
              importedAt: new Date().toISOString(),
              importedBy: userId,
            },
            totalSupply: 0,
            marketValue: parseFloat(nsCard.market_value || "0"),
          },
        });
        progress.created++;
      }

      progress.processed++;
      onProgress?.(progress);
    } catch (error) {
      const errorMsg = `Card ${nsCard.id}: ${error instanceof Error ? error.message : String(error)}`;
      progress.errors.push(errorMsg);
      console.error(`[Batch Import] ${errorMsg}`);
    }
  }

  progress.status = progress.errors.length === 0 ? "completed" : "failed";
  progress.currentCard = undefined;
  onProgress?.(progress);

  console.log(
    `[Batch Import] Completed for user ${userId}: ` +
    `${progress.created} created, ${progress.duplicates} duplicates, ${progress.errors.length} errors`
  );

  return progress;
}
