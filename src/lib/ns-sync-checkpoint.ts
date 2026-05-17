import { AppError } from "~/lib/app-error";

/**
 * NS Sync Checkpoint Manager
 *
 * Handles checkpoint/resume system for NS card synchronization.
 * Allows recovery from crashes by resuming from last processed card.
 *
 * Features:
 * - Save checkpoints every N cards (default: 500)
 * - Auto-detect and resume from last checkpoint
 * - Clear checkpoints on successful completion
 * - Track progress and error counts
 *
 * Usage:
 *   const manager = new CheckpointManager();
 *   const checkpoint = await manager.loadCheckpoint(season);
 *   if (checkpoint) {
 *     // Resume from checkpoint
 *     await performSync(season, checkpoint.cardsProcessed);
 *   }
 */

import { db } from "~/server/db";

/**
 * Sync checkpoint data structure
 */
export interface SyncCheckpoint {
  id: string;
  season: number;
  status: "IN_PROGRESS" | "COMPLETED" | "FAILED";
  cardsProcessed: number;
  totalCards: number;
  lastProcessedCardId: string | null;
  errorCount: number;
  startedAt: Date;
  lastCheckpointAt: Date;
  completedAt: Date | null;
  metadata?: Record<string, any>;
}

/**
 * Checkpoint Manager
 * Manages checkpoint state for NS card sync operations
 */
export class CheckpointManager {
  private readonly CHECKPOINT_INTERVAL = 500; // Save every 500 cards
  private static readonly SYNC_TYPE = "NS_CARD_SYNC";

  /**
   * Save checkpoint to database
   *
   * @param checkpoint - Checkpoint data to save
   * @returns Saved checkpoint
   */
  async saveCheckpoint(checkpoint: Omit<SyncCheckpoint, "id">): Promise<SyncCheckpoint> {
    try {
      console.log(
        `[Checkpoint] Saving checkpoint for season ${checkpoint.season}: ` +
        `${checkpoint.cardsProcessed}/${checkpoint.totalCards} cards (${checkpoint.errorCount} errors)`
      );

      const checkpointJson = {
        status: checkpoint.status,
        cardsProcessed: checkpoint.cardsProcessed,
        totalCards: checkpoint.totalCards,
        errorCount: checkpoint.errorCount,
        startedAt: checkpoint.startedAt instanceof Date ? checkpoint.startedAt.toISOString() : checkpoint.startedAt,
        lastCheckpointAt:
          checkpoint.lastCheckpointAt instanceof Date
            ? checkpoint.lastCheckpointAt.toISOString()
            : checkpoint.lastCheckpointAt,
        completedAt:
          checkpoint.completedAt instanceof Date || checkpoint.completedAt === null
            ? checkpoint.completedAt
              ? checkpoint.completedAt.toISOString()
              : null
            : checkpoint.completedAt,
        metadata: checkpoint.metadata || {},
      };

      // Upsert checkpoint (create or update)
      const saved = await db.syncCheckpoint.upsert({
        where: {
          syncType_season: {
            syncType: CheckpointManager.SYNC_TYPE,
            season: checkpoint.season,
          },
        },
        create: {
          syncType: CheckpointManager.SYNC_TYPE,
          season: checkpoint.season,
          lastCardId: checkpoint.lastProcessedCardId,
          checkpoint: checkpointJson,
        },
        update: {
          lastCardId: checkpoint.lastProcessedCardId,
          checkpoint: checkpointJson,
        },
      });

      const cp = (saved.checkpoint as any) || {};
      return {
        id: saved.id,
        season: saved.season ?? checkpoint.season,
        status: cp.status as "IN_PROGRESS" | "COMPLETED" | "FAILED",
        cardsProcessed: Number(cp.cardsProcessed ?? 0),
        totalCards: Number(cp.totalCards ?? 0),
        lastProcessedCardId: saved.lastCardId ?? null,
        errorCount: Number(cp.errorCount ?? 0),
        startedAt: cp.startedAt ? new Date(cp.startedAt) : new Date(),
        lastCheckpointAt: cp.lastCheckpointAt ? new Date(cp.lastCheckpointAt) : new Date(),
        completedAt: cp.completedAt ? new Date(cp.completedAt) : null,
        metadata: (cp.metadata as Record<string, any>) || {},
      };
    } catch (error) {
      console.error(`[Checkpoint] Failed to save checkpoint for season ${checkpoint.season}:`, error);
      throw error;
    }
  }

  /**
   * Load checkpoint from database
   *
   * @param season - Season number to load checkpoint for
   * @returns Checkpoint if exists, null otherwise
   */
  async loadCheckpoint(season: number): Promise<SyncCheckpoint | null> {
    try {
      const checkpoint = await db.syncCheckpoint.findUnique({
        where: {
          syncType_season: {
            syncType: CheckpointManager.SYNC_TYPE,
            season,
          },
        },
      });

      if (!checkpoint) {
        console.log(`[Checkpoint] No checkpoint found for season ${season}`);
        return null;
      }

      const cp = (checkpoint.checkpoint as any) || {};

      // Don't resume from COMPLETED or FAILED checkpoints
      if (cp.status !== "IN_PROGRESS") {
        console.log(
          `[Checkpoint] Checkpoint for season ${season} has status ${cp.status}, skipping resume`
        );
        return null;
      }

      console.log(
        `[Checkpoint] Loaded checkpoint for season ${season}: ` +
        `${cp.cardsProcessed}/${cp.totalCards} cards processed ` +
        `(${cp.errorCount} errors, last saved: ${new Date(cp.lastCheckpointAt).toISOString()})`
      );

      return {
        id: checkpoint.id,
        season: checkpoint.season ?? season,
        status: cp.status as "IN_PROGRESS" | "COMPLETED" | "FAILED",
        cardsProcessed: Number(cp.cardsProcessed ?? 0),
        totalCards: Number(cp.totalCards ?? 0),
        lastProcessedCardId: checkpoint.lastCardId ?? null,
        errorCount: Number(cp.errorCount ?? 0),
        startedAt: cp.startedAt ? new Date(cp.startedAt) : new Date(),
        lastCheckpointAt: cp.lastCheckpointAt ? new Date(cp.lastCheckpointAt) : new Date(),
        completedAt: cp.completedAt ? new Date(cp.completedAt) : null,
        metadata: (cp.metadata as Record<string, any>) || {},
      };
    } catch (error) {
      console.error(`[Checkpoint] Error loading checkpoint for season ${season}:`, error);
      return null;
    }
  }

  /**
   * Clear checkpoint for a season
   * Called after successful completion or manual reset
   *
   * @param season - Season number to clear checkpoint for
   */
  async clearCheckpoint(season: number): Promise<void> {
    try {
      await db.syncCheckpoint.delete({
        where: {
          syncType_season: {
            syncType: CheckpointManager.SYNC_TYPE,
            season,
          },
        },
      });
      console.log(`[Checkpoint] Cleared checkpoint for season ${season}`);
    } catch (error) {
      // Ignore error if checkpoint doesn't exist
      if (error instanceof AppError && error.code === "NOT_FOUND") {
        console.log(`[Checkpoint] No checkpoint to clear for season ${season}`);
      } else {
        console.error(`[Checkpoint] Error clearing checkpoint for season ${season}:`, error);
        throw error;
      }
    }
  }

  /**
   * Check if sync should resume from checkpoint
   *
   * @param season - Season number
   * @returns True if should resume, false otherwise
   */
  async shouldResume(season: number): Promise<boolean> {
    const checkpoint = await this.loadCheckpoint(season);
    return checkpoint !== null && checkpoint.status === "IN_PROGRESS";
  }

  /**
   * Create initial checkpoint for a new sync
   *
   * @param season - Season number
   * @param totalCards - Total number of cards to sync
   * @returns Created checkpoint
   */
  async createInitialCheckpoint(season: number, totalCards: number): Promise<SyncCheckpoint> {
    console.log(`[Checkpoint] Creating initial checkpoint for season ${season} (${totalCards} cards)`);

    return await this.saveCheckpoint({
      season,
      status: "IN_PROGRESS",
      cardsProcessed: 0,
      totalCards,
      lastProcessedCardId: null,
      errorCount: 0,
      startedAt: new Date(),
      lastCheckpointAt: new Date(),
      completedAt: null,
      metadata: {},
    });
  }

  /**
   * Mark checkpoint as completed
   *
   * @param season - Season number
   */
  async markCompleted(season: number): Promise<void> {
    try {
      const checkpoint = await db.syncCheckpoint.findUnique({
        where: {
          syncType_season: {
            syncType: CheckpointManager.SYNC_TYPE,
            season,
          },
        },
      });

      if (!checkpoint) {
        console.warn(`[Checkpoint] Cannot mark completed - no checkpoint exists for season ${season}`);
        return;
      }

      const cp = (checkpoint.checkpoint as any) || {};

      await db.syncCheckpoint.update({
        where: {
          syncType_season: {
            syncType: CheckpointManager.SYNC_TYPE,
            season,
          },
        },
        data: {
          checkpoint: {
            ...cp,
            status: "COMPLETED",
            completedAt: new Date().toISOString(),
            lastCheckpointAt: new Date().toISOString(),
          },
        },
      });

      console.log(`[Checkpoint] Marked checkpoint as completed for season ${season}`);
    } catch (error) {
      console.error(`[Checkpoint] Error marking checkpoint as completed for season ${season}:`, error);
      throw error;
    }
  }

  /**
   * Mark checkpoint as failed
   *
   * @param season - Season number
   * @param errorMessage - Error message
   */
  async markFailed(season: number, errorMessage: string): Promise<void> {
    try {
      const checkpoint = await db.syncCheckpoint.findUnique({
        where: {
          syncType_season: {
            syncType: CheckpointManager.SYNC_TYPE,
            season,
          },
        },
      });

      if (!checkpoint) {
        console.warn(`[Checkpoint] Cannot mark failed - no checkpoint exists for season ${season}`);
        return;
      }

      const cp = (checkpoint.checkpoint as any) || {};
      const existingMeta = (cp.metadata as Record<string, any>) || {};

      await db.syncCheckpoint.update({
        where: {
          syncType_season: {
            syncType: CheckpointManager.SYNC_TYPE,
            season,
          },
        },
        data: {
          checkpoint: {
            ...cp,
            status: "FAILED",
            completedAt: new Date().toISOString(),
            lastCheckpointAt: new Date().toISOString(),
            metadata: {
              ...existingMeta,
              errorMessage,
              failedAt: new Date().toISOString(),
            },
          },
        },
      });

      console.log(`[Checkpoint] Marked checkpoint as failed for season ${season}: ${errorMessage}`);
    } catch (error) {
      console.error(`[Checkpoint] Error marking checkpoint as failed for season ${season}:`, error);
      throw error;
    }
  }

  /**
   * Get all checkpoints (for admin UI)
   *
   * @returns Array of all checkpoints
   */
  async getAllCheckpoints(): Promise<SyncCheckpoint[]> {
    try {
      const checkpoints = await db.syncCheckpoint.findMany({
        where: { syncType: CheckpointManager.SYNC_TYPE },
        orderBy: { updatedAt: "desc" },
      });

      return checkpoints.map((checkpoint) => ({
        id: checkpoint.id,
        season: checkpoint.season ?? 0,
        status: ((checkpoint.checkpoint as any)?.status ??
          "IN_PROGRESS") as "IN_PROGRESS" | "COMPLETED" | "FAILED",
        cardsProcessed: Number((checkpoint.checkpoint as any)?.cardsProcessed ?? 0),
        totalCards: Number((checkpoint.checkpoint as any)?.totalCards ?? 0),
        lastProcessedCardId: checkpoint.lastCardId ?? null,
        errorCount: Number((checkpoint.checkpoint as any)?.errorCount ?? 0),
        startedAt: (checkpoint.checkpoint as any)?.startedAt
          ? new Date((checkpoint.checkpoint as any).startedAt)
          : new Date(checkpoint.createdAt),
        lastCheckpointAt: (checkpoint.checkpoint as any)?.lastCheckpointAt
          ? new Date((checkpoint.checkpoint as any).lastCheckpointAt)
          : new Date(checkpoint.updatedAt),
        completedAt: (checkpoint.checkpoint as any)?.completedAt
          ? new Date((checkpoint.checkpoint as any).completedAt)
          : null,
        metadata: ((checkpoint.checkpoint as any)?.metadata as Record<string, any>) || {},
      }));
    } catch (error) {
      console.error("[Checkpoint] Error fetching all checkpoints:", error);
      return [];
    }
  }

  /**
   * Determine if it's time to save a checkpoint
   *
   * @param cardsProcessed - Number of cards processed
   * @returns True if should save checkpoint
   */
  shouldSaveCheckpoint(cardsProcessed: number): boolean {
    return cardsProcessed % this.CHECKPOINT_INTERVAL === 0;
  }
}

/**
 * Singleton instance
 */
export const checkpointManager = new CheckpointManager();
