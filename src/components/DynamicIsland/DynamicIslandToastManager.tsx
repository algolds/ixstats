/**
 * DynamicIslandToastManager
 *
 * Orchestrator that renders toast banners anchored to the Dynamic Island.
 * Toasts visually emerge from below the DI pill, matching Apple's Live Activities style.
 *
 * - Positioned directly below the DI pill via absolute positioning
 * - Hidden when the ExpandedView is active (toasts queue silently)
 * - Triggers DI pill glow animation on critical notifications
 * - Max 3 visible banners with stack effect
 */

"use client";

import React, { useEffect, useRef, useState } from "react";
import { AnimatePresence } from "motion/react";
import { useToastQueueStore } from "~/stores/toastQueueStore";
import { ToastBanner } from "./ToastBanner";

interface DynamicIslandToastManagerProps {
  isExpanded: boolean;
  onCriticalNotification?: () => void; // callback to trigger DI pill pulse
}

export function DynamicIslandToastManager({
  isExpanded,
  onCriticalNotification,
}: DynamicIslandToastManagerProps) {
  const queue = useToastQueueStore((s) => s.queue);
  const maxVisible = useToastQueueStore((s) => s.maxVisible);
  const dismiss = useToastQueueStore((s) => s.dismiss);
  const pauseAutoDismiss = useToastQueueStore((s) => s.pauseAutoDismiss);
  const resumeAutoDismiss = useToastQueueStore((s) => s.resumeAutoDismiss);

  // Track last seen toast to detect new arrivals for critical pulse
  const lastSeenIdRef = useRef<string | null>(null);

  useEffect(() => {
    const latestToast = queue[0];
    if (
      latestToast &&
      latestToast.id !== lastSeenIdRef.current &&
      latestToast.priority === "critical"
    ) {
      onCriticalNotification?.();
    }
    lastSeenIdRef.current = latestToast?.id ?? null;
  }, [queue, onCriticalNotification]);

  // Only show visible slice
  const visibleToasts = queue.slice(0, maxVisible);

  // Don't render toasts when expanded view is showing
  if (isExpanded) return null;

  return (
    <div
      className="pointer-events-none absolute top-full left-1/2 z-[10001] mt-3 flex -translate-x-1/2 flex-col items-center"
      aria-live="polite"
      aria-label="Notifications"
    >
      <AnimatePresence mode="popLayout">
        {visibleToasts.map((toast, index) => (
          <ToastBanner
            key={toast.id}
            toast={toast}
            index={index}
            onDismiss={dismiss}
            onPause={pauseAutoDismiss}
            onResume={resumeAutoDismiss}
          />
        ))}
      </AnimatePresence>

      {/* Overflow indicator */}
      {queue.length > maxVisible && (
        <div className="pointer-events-none mt-2 text-[10px] font-medium text-white/30">
          +{queue.length - maxVisible} more
        </div>
      )}
    </div>
  );
}

export default DynamicIslandToastManager;
