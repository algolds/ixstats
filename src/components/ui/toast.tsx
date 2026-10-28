"use client";

/**
 * Toaster — the single toast mount point (root layout).
 *
 * Toasts are raised with `useNotify()` / `notifyFromStore()` (`~/hooks/useNotify`), queued in
 * `toastQueueStore` (which the Halo reads), and rendered here by sonner as Facet `ToastBanner`s.
 *
 * Toasts rise from the bottom, above the TabBar and clear of the Inspector column, so they never cover a page
 * header. Halo peeks the toast title in the island at the top.
 */

import { Toaster as SonnerToaster } from "sonner";
import { registerToastRenderer } from "~/stores/toastQueueStore";
import { ToastBanner } from "~/components/ui/ToastBanner";

registerToastRenderer((toast, onDismiss) => <ToastBanner toast={toast} onDismiss={onDismiss} />);

export const TOASTER_PLACEMENT = {
  position: "bottom-right",
  offset: {
    bottom: "calc(var(--shell-tabbar-height) + 1rem)",
    right: "calc(var(--shell-inspector-width) + 1rem)",
  },
  mobileOffset: {
    bottom: "calc(var(--shell-tabbar-height) + 0.5rem)",
    left: "1rem",
    right: "1rem",
  },
} as const;

export function Toaster() {
  return <SonnerToaster {...TOASTER_PLACEMENT} className="dynamic-island-toaster" />;
}
