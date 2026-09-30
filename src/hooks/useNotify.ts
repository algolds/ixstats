"use client";

/**
 * useNotify — the platform's single toast/notification API.
 *
 * ```tsx
 * const notify = useNotify();
 * notify.success("Embassy established", "Your embassy in Burgundie is now active");
 * notify.error("Trade failed", "Insufficient credits");
 * notify.warning("Budget deficit", "Spending exceeds revenue by 12%");
 * notify.info("Election scheduled", "Voting begins in 3 IxDays");
 * notify.notify({ title, message, type, priority, category, persistent, actions, href });
 * ```
 *
 * Outside React, call `notifyFromStore()` (same options). Rendering (sonner + Facet
 * `ToastBanner`) is mounted once by `<Toaster />` from `~/components/ui/toast`.
 */

import { notifyFromStore, type NotifyStoreOptions } from "~/lib/notifications/notify-store";

export type NotifyOptions = NotifyStoreOptions;

type NotifyShortcut = (title: string, message?: string, opts?: Partial<NotifyOptions>) => void;

export interface NotifyAPI {
  success: NotifyShortcut;
  error: NotifyShortcut;
  warning: NotifyShortcut;
  info: NotifyShortcut;
  notify: (options: NotifyOptions) => void;
}

const notifyApi: NotifyAPI = {
  success: (title, message, opts) =>
    notifyFromStore({ title, message, type: "success", priority: "medium", ...opts }),
  error: (title, message, opts) =>
    notifyFromStore({ title, message, type: "error", priority: "high", ...opts }),
  warning: (title, message, opts) =>
    notifyFromStore({ title, message, type: "warning", priority: "medium", ...opts }),
  info: (title, message, opts) =>
    notifyFromStore({ title, message, type: "info", priority: "medium", ...opts }),
  notify: notifyFromStore,
};

/** Returns the stable notify API (safe to list in hook dependency arrays). */
export function useNotify(): NotifyAPI {
  return notifyApi;
}

export { notifyFromStore, type NotifyStoreOptions };
