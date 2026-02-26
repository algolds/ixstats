/**
 * ToastBanner - iOS-style notification banner that animates from the Dynamic Island
 *
 * Features:
 * - Spring physics animation (matches DI stiffness/damping)
 * - Swipe-to-dismiss via horizontal drag
 * - Auto-dismiss progress bar
 * - Glass morphism matching DI aesthetic
 * - Category-colored left accent bar
 * - Action buttons
 * - Stack spacing for multiple banners
 */

"use client";

import React, { useEffect, useState } from "react";
import { motion, useMotionValue, useTransform, type PanInfo } from "motion/react";
import {
  CheckCircle,
  AlertCircle,
  AlertTriangle,
  Info,
  X,
  TrendingUp,
  Globe,
  Users,
  Building2,
  Shield,
  Trophy,
  Zap,
  Swords,
  Bell,
} from "lucide-react";
import type { ToastQueueItem, ToastType } from "~/stores/toastQueueStore";
import type { NotificationCategory } from "~/types/unified-notifications";

interface ToastBannerProps {
  toast: ToastQueueItem;
  index: number;
  onDismiss: (id: string) => void;
  onPause: (id: string) => void;
  onResume: (id: string) => void;
}

// ─── Icon mapping ─────────────────────────────────────────────────────

function getIconForToast(
  type: ToastType,
  category?: NotificationCategory
): React.ComponentType<{ className?: string }> {
  // Category-specific icons take precedence
  if (category) {
    switch (category) {
      case "economic":
      case "opportunity":
        return TrendingUp;
      case "diplomatic":
        return Globe;
      case "social":
        return Users;
      case "governance":
      case "policy":
        return Building2;
      case "security":
        return Shield;
      case "achievement":
        return Trophy;
      case "crisis":
        return AlertCircle;
      case "intelligence":
        return Zap;
      case "military":
        return Swords;
      default:
        break;
    }
  }

  // Fall back to type-based icons
  switch (type) {
    case "success":
      return CheckCircle;
    case "error":
      return AlertCircle;
    case "warning":
      return AlertTriangle;
    case "info":
      return Info;
  }
}

// ─── Color mapping ────────────────────────────────────────────────────

const ACCENT_COLORS: Record<ToastType, string> = {
  success: "bg-emerald-500",
  error: "bg-red-500",
  warning: "bg-amber-500",
  info: "bg-blue-500",
};

const ICON_COLORS: Record<ToastType, string> = {
  success: "text-emerald-400",
  error: "text-red-400",
  warning: "text-amber-400",
  info: "text-blue-400",
};

const ICON_BG_COLORS: Record<ToastType, string> = {
  success: "bg-emerald-500/15",
  error: "bg-red-500/15",
  warning: "bg-amber-500/15",
  info: "bg-blue-500/15",
};

// ─── Spring config matching DI ────────────────────────────────────────

const SPRING_CONFIG = {
  type: "spring" as const,
  stiffness: 400,
  damping: 30,
};

const DISMISS_THRESHOLD = 100; // px drag distance to dismiss
const DISMISS_VELOCITY = 500; // px/s velocity to dismiss

// ─── Component ────────────────────────────────────────────────────────

export const ToastBanner = React.memo(function ToastBanner({
  toast,
  index,
  onDismiss,
  onPause,
  onResume,
}: ToastBannerProps) {
  const [progress, setProgress] = useState(100);
  const dragX = useMotionValue(0);
  const opacity = useTransform(dragX, [-DISMISS_THRESHOLD, 0, DISMISS_THRESHOLD], [0.3, 1, 0.3]);

  const Icon = getIconForToast(toast.type, toast.category);

  // Progress bar countdown
  useEffect(() => {
    if (toast.persistent || toast.paused) return;

    const startTime = toast.timestamp;
    const endTime = startTime + toast.duration;

    const interval = setInterval(() => {
      const now = Date.now();
      const remaining = Math.max(0, endTime - now);
      const pct = (remaining / toast.duration) * 100;
      setProgress(pct);
    }, 50);

    return () => clearInterval(interval);
  }, [toast.timestamp, toast.duration, toast.persistent, toast.paused]);

  // Handle drag end for swipe-to-dismiss
  const handleDragEnd = (_: unknown, info: PanInfo) => {
    if (
      Math.abs(info.offset.x) > DISMISS_THRESHOLD ||
      Math.abs(info.velocity.x) > DISMISS_VELOCITY
    ) {
      onDismiss(toast.id);
    }
  };

  // Stack offset: each subsequent banner shifts down and scales down slightly
  const stackY = index * 8;
  const stackScale = 1 - index * 0.03;
  const stackOpacity = 1 - index * 0.1;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -20, scale: 0.85 }}
      animate={{
        opacity: stackOpacity,
        y: stackY,
        scale: stackScale,
      }}
      exit={{
        opacity: 0,
        y: -10,
        scale: 0.95,
        transition: { duration: 0.2, ease: "easeOut" },
      }}
      transition={SPRING_CONFIG}
      drag="x"
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.4}
      onDragEnd={handleDragEnd}
      onHoverStart={() => onPause(toast.id)}
      onHoverEnd={() => onResume(toast.id)}
      style={{ x: dragX, opacity }}
      className="pointer-events-auto relative w-[95vw] cursor-grab select-none active:cursor-grabbing sm:w-[90vw] md:w-[400px]"
    >
      <div
        className="relative overflow-hidden rounded-2xl border border-white/20 shadow-2xl shadow-black/20"
        style={{
          background:
            "linear-gradient(135deg, rgba(30,30,40,0.92) 0%, rgba(20,20,30,0.96) 100%)",
          backdropFilter: "blur(40px) saturate(180%)",
          WebkitBackdropFilter: "blur(40px) saturate(180%)",
        }}
      >
        {/* Left accent bar */}
        <div
          className={`absolute top-0 left-0 h-full w-[3px] ${ACCENT_COLORS[toast.type]}`}
        />

        {/* Content */}
        <div className="flex items-start gap-3 px-4 py-3.5 pl-5">
          {/* Icon */}
          <div className={`mt-0.5 flex-shrink-0 rounded-lg p-1.5 ${ICON_BG_COLORS[toast.type]}`}>
            <Icon className={`h-4 w-4 ${ICON_COLORS[toast.type]}`} />
          </div>

          {/* Text content */}
          <div className="min-w-0 flex-1">
            <div className="text-[13px] font-semibold leading-tight text-white/95">
              {toast.title}
            </div>
            {toast.message && (
              <div className="mt-0.5 line-clamp-2 text-[12px] leading-snug text-white/60">
                {toast.message}
              </div>
            )}

            {/* Action buttons */}
            {toast.actions && toast.actions.length > 0 && (
              <div className="mt-2 flex items-center gap-2">
                {toast.actions.map((action, i) => (
                  <button
                    key={i}
                    onClick={(e) => {
                      e.stopPropagation();
                      action.onClick();
                      onDismiss(toast.id);
                    }}
                    className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors ${
                      i === 0
                        ? "bg-white/15 text-white hover:bg-white/25"
                        : "text-white/50 hover:text-white/70"
                    }`}
                  >
                    {action.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Dismiss button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDismiss(toast.id);
            }}
            className="mt-0.5 flex-shrink-0 rounded-full p-1 text-white/30 transition-colors hover:bg-white/10 hover:text-white/60"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Progress bar */}
        {!toast.persistent && (
          <div className="h-[2px] w-full bg-white/5">
            <motion.div
              className={`h-full ${ACCENT_COLORS[toast.type]}`}
              style={{ width: `${progress}%`, opacity: 0.6 }}
              transition={{ duration: 0.05, ease: "linear" }}
            />
          </div>
        )}
      </div>
    </motion.div>
  );
});

export default ToastBanner;
