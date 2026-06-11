"use client";

/**
 * useSwipeableDI — Optional DynamicIsland integration for SwipeableRow
 *
 * Provides `notifyCommit()` and `notifyCommitWithUndo()` methods that push
 * toast notifications to the DI via the existing `useToastQueueStore`.
 *
 * This hook has ZERO dependency on the SwipeableRow primitive itself.
 * Consumers call it inside their commit action callbacks.
 *
 * @example
 * const { notifyCommitWithUndo } = useSwipeableDI();
 *
 * <SwipeableRow.Trailing commit={{
 *   action: () => {
 *     deleteNotification(id);
 *     notifyCommitWithUndo({
 *       title: "Notification dismissed",
 *       type: "info",
 *       onUndo: () => restoreNotification(id),
 *     });
 *   },
 *   label: "Delete",
 * }}>
 */

import { useCallback } from "react";
import { useToastQueueStore } from "~/stores/toastQueueStore";
import type { ToastType } from "~/stores/toastQueueStore";

interface CommitNotifyOptions {
  /** Title text shown in the DI toast banner */
  title: string;
  /** Toast type (determines color and icon) */
  type: ToastType;
  /** Optional description text */
  message?: string;
  /** Duration in ms before auto-dismiss (default: 3000) */
  duration?: number;
}

interface CommitNotifyWithUndoOptions extends CommitNotifyOptions {
  /** Callback fired when the user taps "Undo" */
  onUndo: () => void;
  /** Label for the undo button (default: "Undo") */
  undoLabel?: string;
  /** Duration in ms (longer for undo toasts, default: 5000) */
  duration?: number;
}

export function useSwipeableDI() {
  const enqueue = useToastQueueStore((s) => s.enqueue);

  /**
   * Push a simple commit notification to the DI toast queue.
   */
  const notifyCommit = useCallback(
    (opts: CommitNotifyOptions) => {
      enqueue({
        title: opts.title,
        message: opts.message,
        type: opts.type,
        priority: "medium",
        duration: opts.duration ?? 3000,
      });
    },
    [enqueue]
  );

  /**
   * Push a commit notification with an "Undo" action button.
   * The toast stays visible longer (5s default) and includes an undo button
   * that fires the provided callback.
   */
  const notifyCommitWithUndo = useCallback(
    (opts: CommitNotifyWithUndoOptions) => {
      enqueue({
        title: opts.title,
        message: opts.message,
        type: opts.type,
        priority: "high", // Higher priority to stay visible longer
        duration: opts.duration ?? 5000,
        actions: [
          {
            label: opts.undoLabel ?? "Undo",
            onClick: opts.onUndo,
          },
        ],
      });
    },
    [enqueue]
  );

  return { notifyCommit, notifyCommitWithUndo };
}
