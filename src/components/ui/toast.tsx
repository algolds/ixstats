"use client";

/**
 * Toaster — the single toast mount point (root layout).
 *
 * Toasts are raised with `useNotify()` / `notifyFromStore()` (`~/hooks/useNotify`), queued in
 * `toastQueueStore` (which the Halo reads), and rendered here by sonner as Facet `ToastBanner`s.
 */

import { Toaster as SonnerToaster } from "sonner";
import { registerToastRenderer } from "~/stores/toastQueueStore";
import { ToastBanner } from "~/components/ui/ToastBanner";

registerToastRenderer((toast, onDismiss) => <ToastBanner toast={toast} onDismiss={onDismiss} />);

export function Toaster() {
  return (
    <SonnerToaster
      position="top-center"
      className="dynamic-island-toaster"
      offset={76}
      mobileOffset={16}
    />
  );
}
