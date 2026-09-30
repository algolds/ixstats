// src/lib/notifications/notify-store.ts
// The one toast/notification dispatcher. `useNotify()` is a thin hook over this; call it
// directly from service files, utilities, and background callbacks.

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
  /** Reusing an id replaces the visible toast instead of stacking a new one. */
  id?: string;
  /** Persist to the notification center. */
  persistent?: boolean;
  actions?: ToastAction[];
  href?: string;
  metadata?: Record<string, unknown>;
  /** Suppress the toast banner (only add to the notification center). */
  silent?: boolean;
}

function toSeverity(priority: ToastPriority): "urgent" | "important" | "informational" {
  switch (priority) {
    case "critical":
      return "urgent";
    case "high":
      return "important";
    default:
      return "informational";
  }
}

function playToastSound(type: ToastType, priority: ToastPriority): void {
  if (priority === "critical") soundEffects.pulse();
  else if (type === "success") soundEffects.success();
  else if (type === "error") soundEffects.error();
  else if (type === "warning") soundEffects.bloom();
  else soundEffects.chime();
}

/**
 * Shows a toast (Facet `ToastBanner` via sonner, with a cuelume cue) and, when
 * `persistent`, adds the entry to the notification center.
 */
export function notifyFromStore(options: NotifyStoreOptions): void {
  const {
    title,
    message,
    type = "info",
    priority = "medium",
    category = "system",
    duration,
    id,
    actions,
    silent = false,
    href,
    metadata,
    persistent = false,
  } = options;

  if (!silent && priority !== "low") {
    useToastQueueStore
      .getState()
      .enqueue({ id, title, message, type, priority, category, duration, actions });
    playToastSound(type, priority);
  }

  if (persistent) {
    void useNotificationStore.getState().addNotification({
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
        userPreferences: {},
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
