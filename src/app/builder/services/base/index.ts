/**
 * Builder Services Base Classes
 *
 * Phase 3 optimization: Provides reusable base classes for builder integration services
 * to eliminate code duplication and standardize patterns.
 */

export { BaseBuilderService, type NotifyOptions, type QueueOptions } from "./BaseBuilderService";

export {
  BidirectionalSyncService,
  type SyncDirection,
  type SyncEvent,
  type SyncRecommendation,
  type SyncImpact,
  type BidirectionalSyncState,
} from "./BidirectionalSyncService";
