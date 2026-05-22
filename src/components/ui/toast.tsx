/**
 * Toast System - Backward-Compatible Facade
 *
 * This file now delegates all toast calls to the unified Dynamic Island toast system
 * (toastQueueStore + notificationStore) while preserving the existing API surface.
 *
 * Old rendering (ToastContainer at fixed top-4 right-4) has been removed.
 * All toasts now animate from the Dynamic Island via DynamicIslandToastManager.
 *
 * Migration path:
 * - Existing useToast() calls continue to work (delegates to DI toast queue)
 * - New code should use useNotify() from ~/hooks/useNotify instead
 */

"use client";

import * as React from "react";
import { createContext, useContext } from "react";
import { useToastQueueStore } from "~/stores/toastQueueStore";

import { Toaster } from "sonner";

export type ToastType = "success" | "error" | "warning" | "info";


export interface Toast {
  id: string;
  title: string;
  description?: string;
  type: ToastType;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
}

// ─── Context (kept for backward compatibility) ──────────────────────

type ToastAction =
  | { type: "ADD_TOAST"; toast: Toast }
  | { type: "REMOVE_TOAST"; id: string }
  | { type: "REMOVE_ALL_TOASTS" };

const ToastContext = createContext<{
  state: { toasts: Toast[] };
  dispatch: React.Dispatch<ToastAction>;
  toast: (toast: Omit<Toast, "id">) => void;
} | null>(null);

// ─── Provider (no longer renders ToastContainer) ────────────────────

export function ToastProvider({ children }: { children: React.ReactNode }) {
  // Facade: toast() now delegates to the DI toast queue store
  const toastFn = React.useCallback((input: Omit<Toast, "id">) => {
    const store = useToastQueueStore.getState();
    store.enqueue({
      title: input.title,
      message: input.description,
      type: input.type,
      priority: input.type === "error" ? "high" : "medium",
      duration: input.duration,
      actions: input.action ? [input.action] : undefined,
    });
  }, []);

  // Provide a no-op dispatch since we no longer use the reducer
  const noopDispatch = React.useCallback((_action: ToastAction) => {}, []);

  return (
    <ToastContext.Provider value={{ state: { toasts: [] }, dispatch: noopDispatch, toast: toastFn }}>
      {children}
      <Toaster
        position="top-center"
        className="dynamic-island-toaster"
        offset={76}
        mobileOffset={16}
      />
    </ToastContext.Provider>
  );
}

// ─── Hook ───────────────────────────────────────────────────────────

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    // Graceful fallback: return a facade that delegates directly to the store
    // This handles cases where useToast is called outside ToastProvider
    return {
      state: { toasts: [] as Toast[] },
      dispatch: (() => {}) as React.Dispatch<ToastAction>,
      toast: (input: Omit<Toast, "id">) => {
        const store = useToastQueueStore.getState();
        store.enqueue({
          title: input.title,
          message: input.description,
          type: input.type,
          priority: input.type === "error" ? "high" : "medium",
          duration: input.duration,
          actions: input.action ? [input.action] : undefined,
        });
      },
    };
  }
  return context;
}

// ─── Convenience helpers ────────────────────────────────────────────

export function useToastHelpers() {
  const { toast } = useToast();
  return {
    success: (title: string, description?: string, action?: Toast["action"]) => {
      toast({ type: "success", title, description, action });
    },
    error: (title: string, description?: string, action?: Toast["action"]) => {
      toast({ type: "error", title, description, action });
    },
    warning: (title: string, description?: string, action?: Toast["action"]) => {
      toast({ type: "warning", title, description, action });
    },
    info: (title: string, description?: string, action?: Toast["action"]) => {
      toast({ type: "info", title, description, action });
    },
  };
}
