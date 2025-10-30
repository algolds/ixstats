/**
 * Global Notification Store
 * Single source of truth for all notifications with persistence and real-time sync
 */

import type {
  UnifiedNotification,
  NotificationContext,
  NotificationEngagement,
  NotificationAnalytics,
  NotificationCategory,
  NotificationPriority,
  NotificationStatus,
  DeliveryMethod,
  UserNotificationPreferences,
} from "~/types/unified-notifications";

// Storage interfaces
interface StoredNotification extends UnifiedNotification {
  persisted: boolean;
  syncVersion: number;
}

interface NotificationFilter {
  userId?: string;
  countryId?: string;
  categories?: NotificationCategory[];
  priorities?: NotificationPriority[];
  statuses?: NotificationStatus[];
  sources?: string[];
  deliveryMethods?: DeliveryMethod[];
  dateRange?: { start: number; end: number };
  searchQuery?: string;
  limit?: number;
  offset?: number;
}

interface NotificationSubscription {
  id: string;
  filter: NotificationFilter;
  callback: (notifications: UnifiedNotification[]) => void;
  lastTriggered: number;
}

interface StoreStats {
  totalNotifications: number;
  notificationsByStatus: Record<NotificationStatus, number>;
  notificationsByCategory: Record<NotificationCategory, number>;
  notificationsByPriority: Record<NotificationPriority, number>;
  averageRelevanceScore: number;
  oldestNotification: number;
  newestNotification: number;
}

// Event types for store changes
type StoreEventType =
  | "notification-added"
  | "notification-updated"
  | "notification-removed"
  | "bulk-update"
  | "store-cleared"
  | "sync-completed";

interface StoreEvent {
  type: StoreEventType;
  notification?: UnifiedNotification;
  notifications?: UnifiedNotification[];
  metadata?: Record<string, any>;
  timestamp: number;
}

export class GlobalNotificationStore {
  private notifications: Map<string, StoredNotification> = new Map();
  private userNotifications: Map<string, Set<string>> = new Map(); // userId -> notificationIds
  private countryNotifications: Map<string, Set<string>> = new Map(); // countryId -> notificationIds
  private categoryIndex: Map<NotificationCategory, Set<string>> = new Map();
  private priorityIndex: Map<NotificationPriority, Set<string>> = new Map();
  private statusIndex: Map<NotificationStatus, Set<string>> = new Map();
  private subscriptions: Map<string, NotificationSubscription> = new Map();
  private eventListeners: Map<StoreEventType, Set<(event: StoreEvent) => void>> = new Map();

  // Configuration
  private readonly MAX_NOTIFICATIONS = 10000;
  private readonly CLEANUP_INTERVAL = 60 * 60 * 1000; // 1 hour
  private readonly PERSISTENCE_KEY = "unified-notifications";
  private readonly SYNC_DEBOUNCE_MS = 1000;

  // State tracking
  private nextSyncVersion = 1;
  private lastCleanup = 0;
  private pendingSyncTimeout: NodeJS.Timeout | null = null;
  private isInitialized = false;

  constructor() {
    this.initializeStore();
    this.startPeriodicCleanup();
    console.log("[GlobalNotificationStore] Initialized");
  }

  /**
   * Add a new notification to the store
   */
  async addNotification(
    notification: UnifiedNotification,
    context: NotificationContext
  ): Promise<boolean> {
    try {
      const storedNotification: StoredNotification = {
        ...notification,
        persisted: false,
        syncVersion: this.nextSyncVersion++,
      };

      // Add to main store
      this.notifications.set(notification.id, storedNotification);

      // Update indexes
      this.updateIndexes(notification, "add");

      // Update user/country mappings
      this.updateUserMapping(context.userId, notification.id);
      if (context.countryId) {
        this.updateCountryMapping(context.countryId, notification.id);
      }

      // Trigger subscriptions
      await this.triggerSubscriptions(notification);

      // Emit event
      this.emitEvent("notification-added", { notification });

      // Schedule persistence
      this.schedulePersistence();

      // Cleanup if needed
      await this.cleanupIfNeeded();

      return true;
    } catch (error) {
      console.error("[GlobalNotificationStore] Failed to add notification:", error);
      return false;
    }
  }

  /**
   * Update an existing notification
   */
  async updateNotification(
    notificationId: string,
    updates: Partial<UnifiedNotification>
  ): Promise<boolean> {
    const existing = this.notifications.get(notificationId);
    if (!existing) {
      console.warn(`[GlobalNotificationStore] Notification ${notificationId} not found for update`);
      return false;
    }

    try {
      // Remove from old indexes
      this.updateIndexes(existing, "remove");

      // Apply updates
      const updated: StoredNotification = {
        ...existing,
        ...updates,
        syncVersion: this.nextSyncVersion++,
        persisted: false,
      };

      // Update store
      this.notifications.set(notificationId, updated);

      // Update indexes
      this.updateIndexes(updated, "add");

      // Trigger subscriptions
      await this.triggerSubscriptions(updated);

      // Emit event
      this.emitEvent("notification-updated", { notification: updated });

      // Schedule persistence
      this.schedulePersistence();

      return true;
    } catch (error) {
      console.error("[GlobalNotificationStore] Failed to update notification:", error);
      return false;
    }
  }

  /**
   * Remove a notification from the store
   */
  async removeNotification(notificationId: string): Promise<boolean> {
    const notification = this.notifications.get(notificationId);
    if (!notification) return false;

    try {
      // Remove from main store
      this.notifications.delete(notificationId);

      // Update indexes
      this.updateIndexes(notification, "remove");

      // Update user/country mappings
      this.removeFromUserMapping(notificationId);
      this.removeFromCountryMapping(notificationId);

      // Emit event
      this.emitEvent("notification-removed", { notification });

      // Schedule persistence
      this.schedulePersistence();

      return true;
    } catch (error) {
      console.error("[GlobalNotificationStore] Failed to remove notification:", error);
      return false;
    }
  }

  /**
   * Get notifications with filtering and pagination
   */
  getNotifications(filter: NotificationFilter = {}): UnifiedNotification[] {
    let results = Array.from(this.notifications.values());

    // Apply filters
    if (filter.userId) {
      const userNotificationIds = this.userNotifications.get(filter.userId) || new Set();
      results = results.filter((n) => userNotificationIds.has(n.id));
    }

    if (filter.countryId) {
      const countryNotificationIds = this.countryNotifications.get(filter.countryId) || new Set();
      results = results.filter((n) => countryNotificationIds.has(n.id));
    }

    if (filter.categories?.length) {
      results = results.filter((n) => filter.categories!.includes(n.category));
    }

    if (filter.priorities?.length) {
      results = results.filter((n) => filter.priorities!.includes(n.priority));
    }

    if (filter.statuses?.length) {
      results = results.filter((n) => filter.statuses!.includes(n.status));
    }

    if (filter.sources?.length) {
      results = results.filter((n) => filter.sources!.includes(n.source));
    }

    if (filter.deliveryMethods?.length) {
      results = results.filter((n) => filter.deliveryMethods!.includes(n.deliveryMethod));
    }

    if (filter.dateRange) {
      results = results.filter(
        (n) => n.timestamp >= filter.dateRange!.start && n.timestamp <= filter.dateRange!.end
      );
    }

    if (filter.searchQuery) {
      const query = filter.searchQuery.toLowerCase();
      results = results.filter(
        (n) => n.title.toLowerCase().includes(query) || n.message.toLowerCase().includes(query)
      );
    }

    // Sort by timestamp (newest first) and relevance
    results.sort((a, b) => {
      const timeDiff = b.timestamp - a.timestamp;
      if (Math.abs(timeDiff) < 60000) {
        // Within 1 minute, sort by relevance
        return b.relevanceScore - a.relevanceScore;
      }
      return timeDiff;
    });

    // Apply pagination
    const start = filter.offset || 0;
    const end = filter.limit ? start + filter.limit : undefined;

    return results.slice(start, end);
  }

  /**
   * Get a single notification by ID
   */
  getNotification(notificationId: string): UnifiedNotification | null {
    const stored = this.notifications.get(notificationId);
    return stored || null;
  }

  /**
   * Subscribe to notification changes
   */
  subscribe(
    filter: NotificationFilter,
    callback: (notifications: UnifiedNotification[]) => void
  ): string {
    const subscriptionId = `sub-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const subscription: NotificationSubscription = {
      id: subscriptionId,
      filter,
      callback,
      lastTriggered: 0,
    };

    this.subscriptions.set(subscriptionId, subscription);

    // Immediately trigger with current matching notifications
    const currentNotifications = this.getNotifications(filter);
    if (currentNotifications.length > 0) {
      callback(currentNotifications);
      subscription.lastTriggered = Date.now();
    }

    return subscriptionId;
  }

  /**
   * Unsubscribe from notification changes
   */
  unsubscribe(subscriptionId: string): boolean {
    return this.subscriptions.delete(subscriptionId);
  }

  /**
   * Clear all notifications (optionally filtered)
   */
  async clearNotifications(filter?: NotificationFilter): Promise<number> {
    if (!filter) {
      // Clear everything
      const count = this.notifications.size;
      this.notifications.clear();
      this.userNotifications.clear();
      this.countryNotifications.clear();
      this.clearIndexes();

      this.emitEvent("store-cleared", {});
      this.schedulePersistence();

      return count;
    }

    // Clear filtered notifications
    const toRemove = this.getNotifications(filter);
    let removedCount = 0;

    for (const notification of toRemove) {
      if (await this.removeNotification(notification.id)) {
        removedCount++;
      }
    }

    return removedCount;
  }

  /**
   * Get store statistics
   */
  getStats(): StoreStats {
    const notifications = Array.from(this.notifications.values());

    const stats: StoreStats = {
      totalNotifications: notifications.length,
      notificationsByStatus: {} as Record<NotificationStatus, number>,
      notificationsByCategory: {} as Record<NotificationCategory, number>,
      notificationsByPriority: {} as Record<NotificationPriority, number>,
      averageRelevanceScore: 0,
      oldestNotification: 0,
      newestNotification: 0,
    };

    if (notifications.length === 0) return stats;

    // Initialize counters
    const statuses: NotificationStatus[] = [
      "pending",
      "delivered",
      "read",
      "dismissed",
      "expired",
      "suppressed",
    ];
    const categories: NotificationCategory[] = [
      "economic",
      "diplomatic",
      "governance",
      "social",
      "security",
      "system",
      "achievement",
      "crisis",
      "opportunity",
    ];
    const priorities: NotificationPriority[] = ["critical", "high", "medium", "low"];

    statuses.forEach((status) => (stats.notificationsByStatus[status] = 0));
    categories.forEach((category) => (stats.notificationsByCategory[category] = 0));
    priorities.forEach((priority) => (stats.notificationsByPriority[priority] = 0));

    // Calculate stats
    let totalRelevance = 0;
    let oldestTime = Number.MAX_SAFE_INTEGER;
    let newestTime = 0;

    for (const notification of notifications) {
      stats.notificationsByStatus[notification.status]++;
      stats.notificationsByCategory[notification.category]++;
      stats.notificationsByPriority[notification.priority]++;

      totalRelevance += notification.relevanceScore;
      oldestTime = Math.min(oldestTime, notification.timestamp);
      newestTime = Math.max(newestTime, notification.timestamp);
    }

    stats.averageRelevanceScore = totalRelevance / notifications.length;
    stats.oldestNotification = oldestTime;
    stats.newestNotification = newestTime;

    return stats;
  }

  /**
   * Export notifications for backup or analysis
   */
  exportNotifications(filter?: NotificationFilter): string {
    const notifications = this.getNotifications(filter || {});
    return JSON.stringify(
      {
        exportedAt: Date.now(),
        count: notifications.length,
        notifications: notifications.map((n) => ({
          ...n,
          // Remove functions from actions for serialization
          actions: n.actions?.map((action) => ({
            ...action,
            onClick: undefined, // Remove function reference
          })),
        })),
      },
      null,
      2
    );
  }

  /**
   * Listen to store events
   */
  addEventListener(eventType: StoreEventType, listener: (event: StoreEvent) => void) {
    if (!this.eventListeners.has(eventType)) {
      this.eventListeners.set(eventType, new Set());
    }
    this.eventListeners.get(eventType)!.add(listener);
  }

  /**
   * Remove store event listener
   */
  removeEventListener(eventType: StoreEventType, listener: (event: StoreEvent) => void) {
    const listeners = this.eventListeners.get(eventType);
    if (listeners) {
      listeners.delete(listener);
    }
  }

  // Private methods

  private async initializeStore() {
    if (this.isInitialized) return;

    try {
      // Load from localStorage if available
      if (typeof window !== "undefined") {
        await this.loadFromPersistence();
      }

      this.isInitialized = true;
      console.log(`[GlobalNotificationStore] Loaded ${this.notifications.size} notifications`);
    } catch (error) {
      console.error("[GlobalNotificationStore] Failed to initialize:", error);
    }
  }

  private async loadFromPersistence() {
    try {
      const stored = localStorage.getItem(this.PERSISTENCE_KEY);
      if (!stored) return;

      const data = JSON.parse(stored);
      if (!data.notifications || !Array.isArray(data.notifications)) return;

      for (const notification of data.notifications) {
        const storedNotification: StoredNotification = {
          ...notification,
          persisted: true,
          syncVersion: this.nextSyncVersion++,
        };

        this.notifications.set(notification.id, storedNotification);
        this.updateIndexes(notification, "add");

        // Rebuild user/country mappings
        if (notification.context?.userId) {
          this.updateUserMapping(notification.context.userId, notification.id);
        }
        if (notification.context?.countryId) {
          this.updateCountryMapping(notification.context.countryId, notification.id);
        }
      }
    } catch (error) {
      console.error("[GlobalNotificationStore] Failed to load from persistence:", error);
    }
  }

  private schedulePersistence() {
    if (this.pendingSyncTimeout) {
      clearTimeout(this.pendingSyncTimeout);
    }

    this.pendingSyncTimeout = setTimeout(() => {
      this.persistToStorage();
    }, this.SYNC_DEBOUNCE_MS);
  }

  private async persistToStorage() {
    if (typeof window === "undefined") return;

    try {
      const unpersisted = Array.from(this.notifications.values()).filter((n) => !n.persisted);

      if (unpersisted.length === 0) return;

      const allNotifications = Array.from(this.notifications.values());
      const dataToStore = {
        version: 1,
        lastUpdate: Date.now(),
        notifications: allNotifications.map((n) => {
          const { persisted, syncVersion, ...notification } = n;
          return notification;
        }),
      };

      localStorage.setItem(this.PERSISTENCE_KEY, JSON.stringify(dataToStore));

      // Mark as persisted
      unpersisted.forEach((n) => {
        n.persisted = true;
      });

      this.emitEvent("sync-completed", { metadata: { count: unpersisted.length } });
    } catch (error) {
      console.error("[GlobalNotificationStore] Failed to persist:", error);
    }
  }

  private updateIndexes(notification: UnifiedNotification, operation: "add" | "remove") {
    const { category, priority, status } = notification;

    if (operation === "add") {
      // Category index
      if (!this.categoryIndex.has(category)) {
        this.categoryIndex.set(category, new Set());
      }
      this.categoryIndex.get(category)!.add(notification.id);

      // Priority index
      if (!this.priorityIndex.has(priority)) {
        this.priorityIndex.set(priority, new Set());
      }
      this.priorityIndex.get(priority)!.add(notification.id);

      // Status index
      if (!this.statusIndex.has(status)) {
        this.statusIndex.set(status, new Set());
      }
      this.statusIndex.get(status)!.add(notification.id);
    } else {
      // Remove from indexes
      this.categoryIndex.get(category)?.delete(notification.id);
      this.priorityIndex.get(priority)?.delete(notification.id);
      this.statusIndex.get(status)?.delete(notification.id);
    }
  }

  private updateUserMapping(userId: string, notificationId: string) {
    if (!this.userNotifications.has(userId)) {
      this.userNotifications.set(userId, new Set());
    }
    this.userNotifications.get(userId)!.add(notificationId);
  }

  private updateCountryMapping(countryId: string, notificationId: string) {
    if (!this.countryNotifications.has(countryId)) {
      this.countryNotifications.set(countryId, new Set());
    }
    this.countryNotifications.get(countryId)!.add(notificationId);
  }

  private removeFromUserMapping(notificationId: string) {
    for (const [userId, notificationIds] of this.userNotifications) {
      if (notificationIds.has(notificationId)) {
        notificationIds.delete(notificationId);
        if (notificationIds.size === 0) {
          this.userNotifications.delete(userId);
        }
        break;
      }
    }
  }

  private removeFromCountryMapping(notificationId: string) {
    for (const [countryId, notificationIds] of this.countryNotifications) {
      if (notificationIds.has(notificationId)) {
        notificationIds.delete(notificationId);
        if (notificationIds.size === 0) {
          this.countryNotifications.delete(countryId);
        }
        break;
      }
    }
  }

  private clearIndexes() {
    this.categoryIndex.clear();
    this.priorityIndex.clear();
    this.statusIndex.clear();
  }

  private async triggerSubscriptions(notification: UnifiedNotification) {
    const now = Date.now();

    for (const subscription of this.subscriptions.values()) {
      // Check if notification matches filter
      if (this.notificationMatchesFilter(notification, subscription.filter)) {
        try {
          const matchingNotifications = this.getNotifications(subscription.filter);
          subscription.callback(matchingNotifications);
          subscription.lastTriggered = now;
        } catch (error) {
          console.error("[GlobalNotificationStore] Subscription callback error:", error);
        }
      }
    }
  }

  private notificationMatchesFilter(
    notification: UnifiedNotification,
    filter: NotificationFilter
  ): boolean {
    // Simplified matching logic - would be more comprehensive in practice
    if (filter.categories && !filter.categories.includes(notification.category)) return false;
    if (filter.priorities && !filter.priorities.includes(notification.priority)) return false;
    if (filter.statuses && !filter.statuses.includes(notification.status)) return false;
    if (filter.sources && !filter.sources.includes(notification.source)) return false;

    return true;
  }

  private emitEvent(type: StoreEventType, data: Partial<StoreEvent>) {
    const event: StoreEvent = {
      type,
      timestamp: Date.now(),
      ...data,
    };

    const listeners = this.eventListeners.get(type);
    if (listeners) {
      listeners.forEach((listener) => {
        try {
          listener(event);
        } catch (error) {
          console.error("[GlobalNotificationStore] Event listener error:", error);
        }
      });
    }
  }

  private startPeriodicCleanup() {
    setInterval(() => {
      this.cleanupIfNeeded();
    }, this.CLEANUP_INTERVAL);
  }

  private async cleanupIfNeeded() {
    const now = Date.now();

    // Skip if cleaned up recently
    if (now - this.lastCleanup < this.CLEANUP_INTERVAL) return;

    let removedCount = 0;
    const cutoffTime = now - 7 * 24 * 60 * 60 * 1000; // 7 days ago

    // Remove old, low-priority notifications
    for (const [id, notification] of this.notifications) {
      const shouldRemove =
        (notification.timestamp < cutoffTime &&
          notification.priority === "low" &&
          notification.status === "read") ||
        (notification.status === "expired" && notification.timestamp < now - 24 * 60 * 60 * 1000); // 1 day old expired

      if (shouldRemove) {
        await this.removeNotification(id);
        removedCount++;
      }
    }

    // Enforce max notifications limit
    if (this.notifications.size > this.MAX_NOTIFICATIONS) {
      const sortedNotifications = Array.from(this.notifications.values()).sort(
        (a, b) => a.timestamp - b.timestamp
      ); // Oldest first

      const toRemove = sortedNotifications.slice(
        0,
        this.notifications.size - this.MAX_NOTIFICATIONS
      );

      for (const notification of toRemove) {
        await this.removeNotification(notification.id);
        removedCount++;
      }
    }

    this.lastCleanup = now;

    if (removedCount > 0) {
      console.log(`[GlobalNotificationStore] Cleaned up ${removedCount} notifications`);
    }
  }
}

// Singleton instance
let storeInstance: GlobalNotificationStore | null = null;

/**
 * Get the singleton global notification store instance
 */
export function getGlobalNotificationStore(): GlobalNotificationStore {
  if (!storeInstance) {
    storeInstance = new GlobalNotificationStore();
  }
  return storeInstance;
}

export default GlobalNotificationStore;
