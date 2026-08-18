"use client";

import { create } from "zustand";
import { toast as sonnerToast } from "sonner";
import { ToastBanner } from "~/components/halo/ToastBanner";
import type { NotificationCategory } from "~/types/unified-notifications";

// ─── Types ────────────────────────────────────────────────────────────

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
    item: Omit<ToastQueueItem, "id" | "timestamp" | "duration"> & { duration?: number }
  ) => string;
  dismiss: (id: string) => void;
  dismissAll: () => void;
  pauseAutoDismiss: (id: string) => void;
  resumeAutoDismiss: (id: string) => void;
}

type ToastQueueStore = ToastQueueState & ToastQueueActions;

// ─── Duration defaults by priority ───────────────────────────────────

const DURATION_BY_PRIORITY: Record<ToastPriority, number> = {
  critical: 10000,
  high: 7000,
  medium: 5000,
  low: 3000,
};

// ─── Store ────────────────────────────────────────────────────────────

let idCounter = 0;

export const useToastQueueStore = create<ToastQueueStore>()((set, get) => ({
  queue: [],
  maxVisible: 3,

  enqueue: (item) => {
    const id = `toast-${Date.now()}-${++idCounter}`;
    const duration = item.duration ?? DURATION_BY_PRIORITY[item.priority] ?? 5000;

    const toast: ToastQueueItem = {
      ...item,
      id,
      duration,
      timestamp: Date.now(),
    };

    set((state) => ({
      queue: [toast, ...state.queue].slice(0, 20), // Keep max 20 in queue
    }));

    // Trigger Sonner with custom glassmorphic rendering matching the Dynamic Island
    sonnerToast.custom(
      (t) => (
        <ToastBanner
          toast={toast}
          onDismiss={() => {
            sonnerToast.dismiss(t);
            get().dismiss(id);
          }}
        />
      ),
      {
        id,
        duration: item.persistent ? Infinity : duration,
        onDismiss: () => get().dismiss(id),
        onAutoClose: () => get().dismiss(id),
      }
    );

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

export default useToastQueueStore;
