/**
 * useNotify - Unified Notification Hook
 *
 * THE single entry point for all toast/notification/alert calls in the platform.
 * Replaces: sonner toast(), useToast(), and direct notificationStore.addNotification() calls.
 *
 * Each call:
 * 1. Enqueues to toastQueueStore → DI toast banner animation
 * 2. Adds to notificationStore → persistent notification center
 * 3. If persistent: true → fires tRPC mutation for DB persistence
 *
 * Usage:
 * ```tsx
 * const notify = useNotify();
 * notify.success("Embassy established", "Your embassy in Burgundie is now active");
 * notify.error("Trade failed", "Insufficient credits");
 * notify.warning("Budget deficit", "Spending exceeds revenue by 12%");
 * notify.info("Election scheduled", "Voting begins in 3 IxDays");
 * notify.notify({ title, message, type, priority, category, persistent, actions, href });
 * ```
 */

"use client";

import { useCallback, useMemo } from "react";
import {
  useToastQueueStore,
  type ToastType,
  type ToastPriority,
  type ToastAction,
} from "~/stores/toastQueueStore";
import { useNotificationStore } from "~/stores/notificationStore";
import type { NotificationCategory } from "~/types/unified-notifications";

// ─── Types ────────────────────────────────────────────────────────────

export interface NotifyOptions {
  title: string;
  message?: string;
  type?: ToastType;
  priority?: ToastPriority;
  category?: NotificationCategory;
  duration?: number;
  persistent?: boolean; // persist to database
  actions?: ToastAction[];
  href?: string;
  metadata?: Record<string, unknown>;
  /** If true, suppress the toast banner (only add to notification center) */
  silent?: boolean;
}

export interface NotifyAPI {
  success: (title: string, message?: string, opts?: Partial<NotifyOptions>) => void;
  error: (title: string, message?: string, opts?: Partial<NotifyOptions>) => void;
  warning: (title: string, message?: string, opts?: Partial<NotifyOptions>) => void;
  info: (title: string, message?: string, opts?: Partial<NotifyOptions>) => void;
  notify: (options: NotifyOptions) => void;
}

// ─── Priority → Severity mapping ─────────────────────────────────────

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

// ─── Hook ─────────────────────────────────────────────────────────────

export function useNotify(): NotifyAPI {
  const enqueue = useToastQueueStore((s) => s.enqueue);
  const addNotification = useNotificationStore((s) => s.addNotification);

  const notify = useCallback(
    (options: NotifyOptions) => {
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

      // 1. Enqueue to toast queue for DI banner display (unless silent or low priority)
      if (!silent && priority !== "low") {
        enqueue({
          title,
          message,
          type,
          priority,
          category,
          duration,
          actions,
        });
      }

      // 2. Add to notification store for notification center (only if persistent)
      if (persistent) {
        void addNotification({
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
    },
    [enqueue, addNotification]
  );

  const success = useCallback(
    (title: string, message?: string, opts?: Partial<NotifyOptions>) => {
      notify({ title, message, type: "success", priority: "medium", ...opts });
    },
    [notify]
  );

  const error = useCallback(
    (title: string, message?: string, opts?: Partial<NotifyOptions>) => {
      notify({ title, message, type: "error", priority: "high", ...opts });
    },
    [notify]
  );

  const warning = useCallback(
    (title: string, message?: string, opts?: Partial<NotifyOptions>) => {
      notify({ title, message, type: "warning", priority: "medium", ...opts });
    },
    [notify]
  );

  const info = useCallback(
    (title: string, message?: string, opts?: Partial<NotifyOptions>) => {
      notify({ title, message, type: "info", priority: "medium", ...opts });
    },
    [notify]
  );

  return useMemo(
    () => ({ success, error, warning, info, notify }),
    [success, error, warning, info, notify]
  );
}

// ─── Non-hook companion for use outside React components ─────────────
// Call from utility functions, service files, tRPC callbacks, etc.

export function notifyFromStore(options: NotifyOptions): void {
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

export default useNotify;
