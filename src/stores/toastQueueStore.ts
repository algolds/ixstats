"use client";

import type { ReactElement } from "react";
import { create } from "zustand";
import { toast as sonnerToast } from "sonner";
import type { NotificationCategory } from "~/types/unified-notifications";

export type ToastType = "success" | "error" | "warning" | "info";
export type ToastPriority = "critical" | "high" | "medium" | "low";

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface ToastQueueItem {
  id: string;
  title: string;
  message?: string;
  type: ToastType;
  priority: ToastPriority;
  category?: NotificationCategory;
  duration: number; // ms
  actions?: ToastAction[];
  persistent?: boolean; // if true, must be manually dismissed
  timestamp: number;
  paused?: boolean;
}

interface ToastQueueState {
  queue: ToastQueueItem[];
  maxVisible: number;
}

interface ToastQueueActions {
  enqueue: (
    item: Omit<ToastQueueItem, "id" | "timestamp" | "duration"> & {
      /** Reusing an id replaces the visible toast instead of stacking a new one. */
      id?: string;
      duration?: number;
    }
  ) => string;
  dismiss: (id: string) => void;
  dismissAll: () => void;
  pauseAutoDismiss: (id: string) => void;
  resumeAutoDismiss: (id: string) => void;
}

type ToastQueueStore = ToastQueueState & ToastQueueActions;

type ToastCustomRenderer = (toast: ToastQueueItem, onDismiss: () => void) => ReactElement;

let toastRenderer: ToastCustomRenderer | null = null;

/**
 * Register a custom JSX banner renderer (e.g. ToastBanner)
 * Keeps the Zustand store decoupled from React components.
 */
export function registerToastRenderer(renderer: ToastCustomRenderer) {
  toastRenderer = renderer;
}

// Duration defaults by priority

const DURATION_BY_PRIORITY: Record<ToastPriority, number> = {
  critical: 10000,
  high: 7000,
  medium: 5000,
  low: 3000,
};

// Store

let idCounter = 0;

export const useToastQueueStore = create<ToastQueueStore>()((set, get) => ({
  queue: [],
  maxVisible: 3,

  enqueue: (item) => {
    const id = item.id ?? `toast-${Date.now()}-${++idCounter}`;
    const duration = item.duration ?? DURATION_BY_PRIORITY[item.priority] ?? 5000;

    const toast: ToastQueueItem = {
      ...item,
      id,
      duration,
      timestamp: Date.now(),
    };

    set((state) => ({
      queue: [toast, ...state.queue.filter((t) => t.id !== id)].slice(0, 20),
    }));

    // The renderer (Facet ToastBanner) is registered by the <Toaster /> mount in ~/components/ui/toast.
    const renderer = toastRenderer;
    if (renderer) {
      sonnerToast.custom(
        (t) =>
          renderer(toast, () => {
            sonnerToast.dismiss(t);
            get().dismiss(id);
          }),
        {
          id,
          duration: item.persistent ? Infinity : duration,
          onDismiss: () => get().dismiss(id),
          onAutoClose: () => get().dismiss(id),
        }
      );
    }

    return id;
  },

  dismiss: (id) => {
    set((state) => ({
      queue: state.queue.filter((t) => t.id !== id),
    }));
  },

  dismissAll: () => {
    set({ queue: [] });
  },

  pauseAutoDismiss: (id) => {
    set((state) => ({
      queue: state.queue.map((t) => (t.id === id ? { ...t, paused: true } : t)),
    }));
  },

  resumeAutoDismiss: (id) => {
    set((state) => ({
      queue: state.queue.map((t) => (t.id === id ? { ...t, paused: false } : t)),
    }));
  },
}));

// Subscribe to store updates to sync dismisses from store to Sonner (e.g. dismissAll)
if (typeof window !== "undefined") {
  useToastQueueStore.subscribe((state, prevState) => {
    if (state.queue.length < prevState.queue.length) {
      const currentIds = new Set(state.queue.map((t) => t.id));
      prevState.queue.forEach((t) => {
        if (!currentIds.has(t.id)) {
          sonnerToast.dismiss(t.id);
        }
      });
    }
  });
}
