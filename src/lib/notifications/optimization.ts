/**
 * Notification Optimization Utilities
 * Pure functions for enhanced priority calculation, categorization,
 * delivery optimization, and smart batching.
 */

import type {
  UnifiedNotification,
  NotificationCategory,
  NotificationPriority,
  NotificationSeverity,
  DeliveryMethod,
  DeliveryContext,
  UserNotificationPreferences,
  NotificationBatch,
} from "~/types/unified-notifications";

/** Generate a deterministic/safe unique key for notification items without ceremony */
export function generateSafeKey(
  id: string | undefined | null,
  fallbackPrefix: string,
  index: number = 0
): string {
  const cleanId = id && typeof id === "string" ? id.trim() : "";
  if (cleanId) return `${fallbackPrefix}-${cleanId}`;
  return `${fallbackPrefix}-fallback-${index}-${Date.now()}`;
}

const PRIORITY_ORDER: NotificationPriority[] = ["low", "medium", "high", "critical"];

function priorityIndex(p: NotificationPriority): number {
  return PRIORITY_ORDER.indexOf(p);
}

function clampPriority(index: number): NotificationPriority {
  const clamped = Math.max(0, Math.min(PRIORITY_ORDER.length - 1, index));
  return PRIORITY_ORDER[clamped]!;
}

/**
 * Calculates enhanced priority based on notification context, user preferences,
 * and recent notification history.
 */
export function calculateEnhancedPriority(
  notification: UnifiedNotification,
  existingNotifications: UnifiedNotification[],
  preferences: UserNotificationPreferences
): { finalPriority: NotificationPriority; relevanceScore: number } {
  let pIndex = priorityIndex(notification.priority);
  let relevanceScore = notification.relevanceScore ?? 50;

  // Boost priority if category is in executive mode filters
  if (preferences.executiveModeFilters.includes(notification.category as NotificationCategory)) {
    pIndex = Math.min(pIndex + 1, PRIORITY_ORDER.length - 1);
    relevanceScore = Math.min(relevanceScore + 15, 100);
  }

  // Lower priority if many same-category notifications in last 5 minutes
  const fiveMinAgo = Date.now() - 5 * 60 * 1000;
  const recentSameCategory = existingNotifications.filter(
    (n) => n.category === notification.category && n.timestamp > fiveMinAgo
  );
  if (recentSameCategory.length >= 3) {
    pIndex = Math.max(pIndex - 1, 0);
    relevanceScore = Math.max(relevanceScore - 10, 0);
  }

  // Respect user's minimum priority for this category
  const categoryPrefs = preferences.categories[notification.category as NotificationCategory];
  if (categoryPrefs) {
    const minPIndex = priorityIndex(categoryPrefs.minPriority);
    if (pIndex < minPIndex) {
      // Below user's minimum - they don't want to see this
      relevanceScore = Math.max(relevanceScore - 20, 0);
    }
  }

  // Boost relevance for critical/high type notifications
  if (notification.type === "critical") {
    relevanceScore = Math.min(relevanceScore + 25, 100);
    pIndex = Math.max(pIndex, priorityIndex("high"));
  } else if (notification.type === "warning") {
    relevanceScore = Math.min(relevanceScore + 10, 100);
  }

  return {
    finalPriority: clampPriority(pIndex),
    relevanceScore,
  };
}

/**
 * Refines notification category and severity based on content analysis.
 */
export function categorizeNotification(notification: UnifiedNotification): {
  primary: NotificationCategory;
  severity: NotificationSeverity;
} {
  const category = notification.category;

  // Map notification type to severity
  let severity: NotificationSeverity;
  switch (notification.type) {
    case "critical":
      severity = "urgent";
      break;
    case "alert":
    case "warning":
      severity = "important";
      break;
    case "error":
      severity = "important";
      break;
    case "info":
    case "update":
    case "success":
      severity = "informational";
      break;
    case "opportunity":
      severity = "informational";
      break;
    default:
      severity = notification.severity || "informational";
  }

  // Override severity for high-priority categories
  if (notification.priority === "critical") {
    severity = "urgent";
  }

  return { primary: category, severity };
}

/**
 * Determines the optimal delivery method based on notification priority
 * and user context (activity, preferences, quiet hours).
 */
export function optimizeDeliveryMethod(
  notification: UnifiedNotification,
  context: DeliveryContext
): { method: DeliveryMethod; shouldDefer: boolean } {
  // Critical always gets dynamic-island immediately
  if (notification.priority === "critical") {
    return { method: "dynamic-island", shouldDefer: false };
  }

  // Check quiet hours
  if (context.timeOfDay !== undefined) {
    // Simple quiet hours check (11pm-7am)
    const isQuietHours = context.timeOfDay >= 23 || context.timeOfDay < 7;
    if (isQuietHours && notification.priority !== "high") {
      return { method: "silent", shouldDefer: true };
    }
  }

  // User not active - defer low/medium priority
  if (!context.isUserActive) {
    if (notification.priority === "low") {
      return { method: "badge", shouldDefer: true };
    }
    if (notification.priority === "medium") {
      return { method: "toast", shouldDefer: true };
    }
  }

  // High priority gets dynamic island
  if (notification.priority === "high") {
    return { method: "dynamic-island", shouldDefer: false };
  }

  // Medium priority
  if (notification.priority === "medium") {
    return { method: "toast", shouldDefer: false };
  }

  // Low priority - badge only
  return { method: "badge", shouldDefer: false };
}

/**
 * Groups pending notifications by category and creates smart batches
 * when multiple notifications of the same type arrive within a short window.
 */
export function createSmartBatches(
  notifications: UnifiedNotification[],
  preferences: UserNotificationPreferences
): NotificationBatch[] {
  if (!preferences.batchingEnabled || notifications.length === 0) {
    return [];
  }

  // Group by category
  const groups = new Map<string, UnifiedNotification[]>();
  for (const n of notifications) {
    const key = n.category;
    const existing = groups.get(key) || [];
    existing.push(n);
    groups.set(key, existing);
  }

  const batches: NotificationBatch[] = [];
  const fiveMinAgo = Date.now() - 5 * 60 * 1000;

  for (const [category, group] of groups) {
    // Only batch if 3+ notifications in the same category within 5 minutes
    const recentGroup = group.filter((n) => n.timestamp > fiveMinAgo);
    if (recentGroup.length >= 3) {
      // Find highest priority in group
      const highestPriority = recentGroup.reduce<NotificationPriority>(
        (max, n) => (priorityIndex(n.priority) > priorityIndex(max) ? n.priority : max),
        "low"
      );

      batches.push({
        id: generateSafeKey(`batch-${category}`, "batch", Date.now()),
        notifications: recentGroup,
        priority: highestPriority,
        estimatedDeliveryTime: Date.now() + 1000, // Deliver in 1 second
        batchingReason: `${recentGroup.length} ${category} notifications grouped`,
        createdAt: Date.now(),
      });
    }
  }

  return batches;
}
