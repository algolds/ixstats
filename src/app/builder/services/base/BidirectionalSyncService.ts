/**
 * BidirectionalSyncService - Base class for bidirectional builder synchronization
 *
 * Phase 3 optimization: Extends BaseBuilderService with features specific to
 * bidirectional synchronization between builders (e.g., Government↔Economy, Tax↔Economy).
 *
 * Features:
 * - Sync history tracking with configurable max size
 * - Template methods for recommendations and impact calculations
 * - Bidirectional sync orchestration
 * - Sync status tracking (isSyncing flag)
 */

import { BaseBuilderService, type NotifyOptions } from "./BaseBuilderService";

/**
 * Sync event types for history tracking
 */
export type SyncDirection = "forward" | "reverse" | "bidirectional";

/**
 * Base sync event structure
 */
export interface SyncEvent<TSource = unknown, TTarget = unknown> {
  id: string;
  timestamp: Date;
  direction: SyncDirection;
  source: TSource;
  target: TTarget;
  success: boolean;
  error?: string;
  changes?: string[];
}

/**
 * Base recommendation structure
 */
export interface SyncRecommendation {
  id: string;
  type: string;
  title: string;
  description: string;
  priority: "low" | "medium" | "high";
  impact: number; // 0-100 score
  autoApply?: boolean;
}

/**
 * Base impact structure
 */
export interface SyncImpact {
  field: string;
  currentValue: unknown;
  projectedValue: unknown;
  changePercent: number;
  direction: "increase" | "decrease" | "unchanged";
  severity: "positive" | "neutral" | "negative";
}

/**
 * State structure for bidirectional sync services
 */
export interface BidirectionalSyncState<TRecommendation, TImpact> {
  isSyncing: boolean;
  lastSyncTimestamp: Date | null;
  syncError: string | null;
  recommendations: TRecommendation[];
  impacts: TImpact[];
}

/**
 * Abstract base class for bidirectional sync services
 *
 * @template TState - The full state type (extends BidirectionalSyncState)
 * @template TRecommendation - The recommendation type
 * @template TImpact - The impact calculation type
 * @template TSource - The source builder data type
 * @template TTarget - The target builder data type
 */
export abstract class BidirectionalSyncService<
  TState extends BidirectionalSyncState<TRecommendation, TImpact>,
  TRecommendation extends SyncRecommendation,
  TImpact extends SyncImpact,
  TSource = unknown,
  TTarget = unknown
> extends BaseBuilderService<TState, SyncEvent<TSource, TTarget>> {
  protected syncHistory: SyncEvent<TSource, TTarget>[] = [];
  protected maxHistorySize = 100;

  /**
   * Generate recommendations based on source data
   * Must be implemented by subclasses
   */
  protected abstract generateRecommendations(
    source: TSource
  ): Promise<TRecommendation[]> | TRecommendation[];

  /**
   * Calculate impacts on target based on source changes
   * Must be implemented by subclasses
   */
  protected abstract calculateImpacts(
    source: TSource,
    target: TTarget
  ): Promise<TImpact[]> | TImpact[];

  /**
   * Apply recommendations to target
   * Must be implemented by subclasses
   */
  protected abstract applyRecommendations(
    recommendations: TRecommendation[],
    target: TTarget
  ): Promise<TTarget> | TTarget;

  /**
   * Add a sync event to history
   */
  protected addSyncEvent(event: SyncEvent<TSource, TTarget>): void {
    this.syncHistory.push(event);

    // Trim history if exceeds max size
    if (this.syncHistory.length > this.maxHistorySize) {
      this.syncHistory = this.syncHistory.slice(-this.maxHistorySize);
    }
  }

  /**
   * Create a sync event
   */
  protected createSyncEvent(
    direction: SyncDirection,
    source: TSource,
    target: TTarget,
    success: boolean,
    changes?: string[],
    error?: string
  ): SyncEvent<TSource, TTarget> {
    return {
      id: `sync_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      direction,
      source,
      target,
      success,
      changes,
      error,
    };
  }

  /**
   * Get sync history
   */
  getSyncHistory(): SyncEvent<TSource, TTarget>[] {
    return [...this.syncHistory];
  }

  /**
   * Clear sync history
   */
  clearSyncHistory(): void {
    this.syncHistory = [];
  }

  /**
   * Set syncing state and notify listeners
   */
  protected setSyncing(isSyncing: boolean): void {
    this.state = {
      ...this.state,
      isSyncing,
      syncError: isSyncing ? null : this.state.syncError,
    };
    this.notifyListeners();
  }

  /**
   * Set sync error and notify listeners
   */
  protected setSyncError(error: string | null): void {
    this.state = {
      ...this.state,
      isSyncing: false,
      syncError: error,
    };
    this.notifyListeners();
  }

  /**
   * Perform bidirectional sync between source and target
   *
   * @param source - Source builder data
   * @param target - Target builder data
   * @param options - Notification options
   * @returns Updated target data
   */
  async performBidirectionalSync(
    source: TSource,
    target: TTarget,
    options: NotifyOptions = {}
  ): Promise<TTarget> {
    this.setSyncing(true);

    try {
      // Generate recommendations from source
      const recommendations = await this.generateRecommendations(source);

      // Calculate impacts
      const impacts = await this.calculateImpacts(source, target);

      // Update state with recommendations and impacts
      this.state = {
        ...this.state,
        recommendations,
        impacts,
      };

      // Apply recommendations to target
      const updatedTarget = await this.applyRecommendations(
        recommendations.filter((r) => r.autoApply),
        target
      );

      // Record sync event
      const syncEvent = this.createSyncEvent(
        "bidirectional",
        source,
        updatedTarget,
        true,
        recommendations.map((r) => r.title)
      );
      this.addSyncEvent(syncEvent);

      // Update state
      this.state = {
        ...this.state,
        isSyncing: false,
        lastSyncTimestamp: new Date(),
        syncError: null,
      };

      this.notifyListeners(options);

      return updatedTarget;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown sync error";

      // Record failed sync event
      const syncEvent = this.createSyncEvent(
        "bidirectional",
        source,
        target,
        false,
        undefined,
        errorMessage
      );
      this.addSyncEvent(syncEvent);

      this.setSyncError(errorMessage);
      throw error;
    }
  }

  /**
   * Update source data and trigger recommendations/impacts
   */
  async updateSource(source: TSource, target: TTarget): Promise<void> {
    const recommendations = await this.generateRecommendations(source);
    const impacts = await this.calculateImpacts(source, target);

    this.state = {
      ...this.state,
      recommendations,
      impacts,
    };

    this.notifyListeners({ deepEqual: true });
  }

  /**
   * Get pending recommendations (not yet applied)
   */
  getPendingRecommendations(): TRecommendation[] {
    return this.state.recommendations.filter((r) => !r.autoApply);
  }

  /**
   * Get auto-apply recommendations
   */
  getAutoApplyRecommendations(): TRecommendation[] {
    return this.state.recommendations.filter((r) => r.autoApply);
  }

  /**
   * Reset sync state
   */
  override reset(): void {
    this.clearSyncHistory();
    super.reset();
  }
}

export default BidirectionalSyncService;
