/**
 * ToastBanner - iOS-style notification banner designed for Sonner.
 *
 * Features:
 * - Glass morphism matching the Facet aesthetic
 * - Category-colored left accent bar
 * - Action buttons
 * - Auto-dismiss progress bar countdown
 */

"use client";

import React, { useEffect, useState } from "react";
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
} from "lucide-react";
import type { ToastQueueItem, ToastType } from "~/stores/toastQueueStore";
import type { NotificationCategory } from "~/types/unified-notifications";

interface ToastBannerProps {
  toast: ToastQueueItem;
  onDismiss: (id: string) => void;
}

// ─── Icon mapping ─────────────────────────────────────────────────────

function getIconForToast(
  type: ToastType,
  category?: NotificationCategory
): React.ComponentType<{ className?: string }> {
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

// ─── Component ────────────────────────────────────────────────────────

export const ToastBanner = React.memo(function ToastBanner({ toast, onDismiss }: ToastBannerProps) {
  const [progress, setProgress] = useState(100);
  const Icon = getIconForToast(toast.type, toast.category);

  // Progress bar countdown
  useEffect(() => {
    if (toast.persistent) return;

    const startTime = Date.now();
    const duration = toast.duration || 5000;

    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, duration - elapsed);
      const pct = (remaining / duration) * 100;
      setProgress(pct);
    }, 50);

    return () => clearInterval(interval);
  }, [toast.duration, toast.persistent]);

  return (
    <div className="pointer-events-auto relative w-[95vw] select-none sm:w-[90vw] md:w-[400px]">
      <div
        className="border-border/40 bg-background/95 dark:bg-background/90 relative overflow-hidden rounded-2xl border shadow-2xl shadow-black/15 dark:border-white/15"
        style={{
          backdropFilter: "blur(40px) saturate(180%)",
          WebkitBackdropFilter: "blur(40px) saturate(180%)",
        }}
      >
        {/* Left accent bar */}
        <div className={`absolute top-0 left-0 h-full w-[3px] ${ACCENT_COLORS[toast.type]}`} />

        {/* Content */}
        <div className="flex items-start gap-3 px-4 py-3.5 pl-5">
          {/* Icon */}
          <div className={`mt-0.5 shrink-0 rounded-lg p-1.5 ${ICON_BG_COLORS[toast.type]}`}>
            <Icon className={`h-4 w-4 ${ICON_COLORS[toast.type]}`} />
          </div>

          {/* Text content */}
          <div className="min-w-0 flex-1">
            <div className="text-foreground/95 text-[13px] leading-tight font-semibold">
              {toast.title}
            </div>
            {toast.message && (
              <div className="text-muted-foreground mt-0.5 line-clamp-2 text-[12px] leading-snug">
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
                        ? "bg-foreground/10 text-foreground hover:bg-foreground/20"
                        : "text-muted-foreground hover:text-foreground"
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
            className="text-muted-foreground/50 hover:bg-foreground/10 hover:text-muted-foreground mt-0.5 shrink-0 rounded-full p-1 transition-colors"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Progress bar */}
        {!toast.persistent && (
          <div className="bg-foreground/5 h-[2px] w-full">
            <div
              className={`h-full ${ACCENT_COLORS[toast.type]}`}
              style={{
                width: `${progress}%`,
                opacity: 0.6,
                transition: "width 0.05s linear",
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
});

export default ToastBanner;
