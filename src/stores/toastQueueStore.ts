/**
 * Toast Queue Store
 * Lightweight Zustand store for transient toast display in the Dynamic Island.
 * Manages the queue of toast banners that animate from the DI pill.
 */

"use client";

import { create } from "zustand";
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
  enqueue: (item: Omit<ToastQueueItem, "id" | "timestamp" | "duration"> & { duration?: number }) => string;
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

    // Auto-dismiss (unless persistent or critical with no auto-dismiss)
    if (!item.persistent) {
      setTimeout(() => {
        const current = get().queue.find((t) => t.id === id);
        if (current && !current.paused) {
          get().dismiss(id);
        }
      }, duration);
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

    // Restart auto-dismiss with remaining time
    const toast = get().queue.find((t) => t.id === id);
    if (toast && !toast.persistent) {
      const elapsed = Date.now() - toast.timestamp;
      const remaining = Math.max(toast.duration - elapsed, 1000);
      setTimeout(() => {
        const current = get().queue.find((t) => t.id === id);
        if (current && !current.paused) {
          get().dismiss(id);
        }
      }, remaining);
    }
  },
}));

export default useToastQueueStore;
