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
import type { PrismaClient } from "@prisma/client";

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

      // Upsert checkpoint (create or update)
      const saved = await db.syncCheckpoint.upsert({
        where: { season: checkpoint.season },
        create: {
          season: checkpoint.season,
          status: checkpoint.status,
          cardsProcessed: checkpoint.cardsProcessed,
          totalCards: checkpoint.totalCards,
          lastProcessedCardId: checkpoint.lastProcessedCardId,
          errorCount: checkpoint.errorCount,
          startedAt: checkpoint.startedAt,
          lastCheckpointAt: checkpoint.lastCheckpointAt,
          completedAt: checkpoint.completedAt,
          metadata: checkpoint.metadata || {},
        },
        update: {
          status: checkpoint.status,
          cardsProcessed: checkpoint.cardsProcessed,
          lastProcessedCardId: checkpoint.lastProcessedCardId,
          errorCount: checkpoint.errorCount,
          lastCheckpointAt: checkpoint.lastCheckpointAt,
          completedAt: checkpoint.completedAt,
          metadata: checkpoint.metadata || {},
        },
      });

      return {
        id: saved.id,
        season: saved.season,
        status: saved.status as "IN_PROGRESS" | "COMPLETED" | "FAILED",
        cardsProcessed: saved.cardsProcessed,
        totalCards: saved.totalCards,
        lastProcessedCardId: saved.lastProcessedCardId,
        errorCount: saved.errorCount,
        startedAt: saved.startedAt,
        lastCheckpointAt: saved.lastCheckpointAt,
        completedAt: saved.completedAt,
        metadata: saved.metadata as Record<string, any>,
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
        where: { season },
      });

      if (!checkpoint) {
        console.log(`[Checkpoint] No checkpoint found for season ${season}`);
        return null;
      }

      // Don't resume from COMPLETED or FAILED checkpoints
      if (checkpoint.status !== "IN_PROGRESS") {
        console.log(
          `[Checkpoint] Checkpoint for season ${season} has status ${checkpoint.status}, skipping resume`
        );
        return null;
      }

      console.log(
        `[Checkpoint] Loaded checkpoint for season ${season}: ` +
        `${checkpoint.cardsProcessed}/${checkpoint.totalCards} cards processed ` +
        `(${checkpoint.errorCount} errors, last saved: ${checkpoint.lastCheckpointAt.toISOString()})`
      );

      return {
        id: checkpoint.id,
        season: checkpoint.season,
        status: checkpoint.status as "IN_PROGRESS" | "COMPLETED" | "FAILED",
        cardsProcessed: checkpoint.cardsProcessed,
        totalCards: checkpoint.totalCards,
        lastProcessedCardId: checkpoint.lastProcessedCardId,
        errorCount: checkpoint.errorCount,
        startedAt: checkpoint.startedAt,
        lastCheckpointAt: checkpoint.lastCheckpointAt,
        completedAt: checkpoint.completedAt,
        metadata: checkpoint.metadata as Record<string, any>,
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
        where: { season },
      });
      console.log(`[Checkpoint] Cleared checkpoint for season ${season}`);
    } catch (error) {
      // Ignore error if checkpoint doesn't exist
      if (error instanceof Error && error.message.includes("Record to delete does not exist")) {
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
        where: { season },
      });

      if (!checkpoint) {
        console.warn(`[Checkpoint] Cannot mark completed - no checkpoint exists for season ${season}`);
        return;
      }

      await db.syncCheckpoint.update({
        where: { season },
        data: {
          status: "COMPLETED",
          completedAt: new Date(),
          lastCheckpointAt: new Date(),
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
        where: { season },
      });

      if (!checkpoint) {
        console.warn(`[Checkpoint] Cannot mark failed - no checkpoint exists for season ${season}`);
        return;
      }

      await db.syncCheckpoint.update({
        where: { season },
        data: {
          status: "FAILED",
          completedAt: new Date(),
          lastCheckpointAt: new Date(),
          metadata: {
            ...(checkpoint.metadata as Record<string, any>),
            errorMessage,
            failedAt: new Date().toISOString(),
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
        orderBy: { lastCheckpointAt: "desc" },
      });

      return checkpoints.map((checkpoint) => ({
        id: checkpoint.id,
        season: checkpoint.season,
        status: checkpoint.status as "IN_PROGRESS" | "COMPLETED" | "FAILED",
        cardsProcessed: checkpoint.cardsProcessed,
        totalCards: checkpoint.totalCards,
        lastProcessedCardId: checkpoint.lastProcessedCardId,
        errorCount: checkpoint.errorCount,
        startedAt: checkpoint.startedAt,
        lastCheckpointAt: checkpoint.lastCheckpointAt,
        completedAt: checkpoint.completedAt,
        metadata: checkpoint.metadata as Record<string, any>,
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
