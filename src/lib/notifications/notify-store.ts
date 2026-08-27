// src/lib/notifications/notify-store.ts
// Non-hook notification dispatcher for service files, utilities, and background callbacks

import {
  useToastQueueStore,
  type ToastType,
  type ToastPriority,
  type ToastAction,
} from "~/stores/toastQueueStore";
import { useNotificationStore } from "~/stores/notificationStore";
import type { NotificationCategory } from "~/types/unified-notifications";
import { soundEffects } from "~/lib/sound/cuelume";

export interface NotifyStoreOptions {
  title: string;
  message?: string;
  type?: ToastType;
  priority?: ToastPriority;
  category?: NotificationCategory;
  duration?: number;
  persistent?: boolean;
  actions?: ToastAction[];
  href?: string;
  metadata?: Record<string, unknown>;
  silent?: boolean;
}

function toSeverity(priority: ToastPriority): "urgent" | "important" | "informational" {
  switch (priority) {
    case "critical":
    case "high":
      return "urgent";
    case "medium":
      return "important";
    default:
      return "informational";
  }
}

/**
 * Dispatches notifications directly through the Zustand store.
 * Safe to call from non-component code, callbacks, or services.
 */
export function notifyFromStore(options: NotifyStoreOptions): void {
  const {
    title,
    message,
    type = "info",
    priority = "medium",
    category = "system",
    duration,
    actions,
    silent = false,
    href,
    metadata,
    persistent = false,
  } = options;

  // 1. Toast queue
  if (!silent && priority !== "low") {
    const toastStore = useToastQueueStore.getState();
    toastStore.enqueue({
      title,
      message,
      type,
      priority,
      category,
      duration,
      actions,
    });

    if (priority === "critical") {
      soundEffects.pulse();
    } else if (type === "success") {
      soundEffects.success();
    } else if (type === "error") {
      soundEffects.error();
    } else if (type === "warning") {
      soundEffects.bloom();
    } else {
      soundEffects.chime();
    }
  }

  // 2. Notification store (only if persistent)
  if (persistent) {
    const notifStore = useNotificationStore.getState();
    void notifStore.addNotification({
      source: "user",
      title,
      message: message ?? "",
      category,
      type,
      priority,
      severity: toSeverity(priority),
      context: {
        userId: "",
        isExecutiveMode: false,
        currentRoute: typeof window !== "undefined" ? window.location.pathname : "",
        ixTime: 0,
        realTime: Date.now(),
        timeMultiplier: 2,
        activeFeatures: [],
        recentActions: [],
        focusMode: false,
        sessionDuration: 0,
        isUserActive: true,
        deviceType: "desktop",
        screenSize: "large",
        networkQuality: "high",
        userPreferences: {} as any,
        historicalEngagement: [],
        interactionHistory: [],
        contextualFactors: {},
        urgencyFactors: [],
        contextualRelevance: 0.5,
      },
      triggers: [],
      relevanceScore: priority === "critical" ? 95 : priority === "high" ? 80 : 50,
      deliveryMethod: "dynamic-island",
      status: "delivered",
      actionable: !!actions?.length || !!href,
      metadata: {
        ...(metadata ?? {}),
        ...(href ? { href } : {}),
      },
    });
  }
}
