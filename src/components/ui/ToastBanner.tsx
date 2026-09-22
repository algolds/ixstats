"use client";
// src/components/ui/ToastBanner.tsx
// Facet Design System Floating Toast Banner Component

import React from "react";
import {
  CheckCircle,
  WarningCircle,
  WarningTriangle as AlertTriangle,
  InfoCircle,
  Xmark as X,
} from "iconoir-react";
import type { ToastQueueItem } from "~/stores/toastQueueStore";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";

interface ToastBannerProps {
  toast: ToastQueueItem;
  onDismiss: () => void;
}

export function ToastBanner({ toast, onDismiss }: ToastBannerProps) {
  const { title, message, type = "info", priority = "medium", actions } = toast;

  const getTypeStyles = () => {
    switch (type) {
      case "success":
        return {
          icon: <CheckCircle className="h-4 w-4 shrink-0 text-emerald-500" />,
          badgeBg: "bg-emerald-500/15 border-emerald-500/30 text-emerald-600 dark:text-emerald-400",
          glow: "shadow-[0_4px_24px_rgba(16,185,129,0.15)]",
          borderAccent: "border-emerald-500/30",
        };
      case "error":
        return {
          icon: <WarningCircle className="h-4 w-4 shrink-0 text-red-500" />,
          badgeBg: "bg-red-500/15 border-red-500/30 text-red-600 dark:text-red-400",
          glow: "shadow-[0_4px_24px_rgba(239,68,68,0.18)]",
          borderAccent: "border-red-500/40",
        };
      case "warning":
        return {
          icon: <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" />,
          badgeBg: "bg-amber-500/15 border-amber-500/30 text-amber-600 dark:text-amber-400",
          glow: "shadow-[0_4px_24px_rgba(245,158,11,0.15)]",
          borderAccent: "border-amber-500/30",
        };
      case "info":
      default:
        return {
          icon: <InfoCircle className="h-4 w-4 shrink-0 text-cyan-500" />,
          badgeBg: "bg-cyan-500/15 border-cyan-500/30 text-cyan-600 dark:text-cyan-400",
          glow: "shadow-[0_4px_24px_rgba(6,182,212,0.12)]",
          borderAccent: "border-cyan-500/30",
        };
    }
  };

  const styleConfig = getTypeStyles();

  return (
    <div
      role="alert"
      className={cn(
        "group pointer-events-auto relative flex w-full max-w-sm sm:max-w-md items-start gap-3 rounded-2xl border p-3.5 sm:p-4 text-left select-none",
        "bg-card/95 dark:bg-card/90 text-card-foreground backdrop-blur-2xl",
        "border-border/60 transition-all duration-200",
        styleConfig.glow,
        styleConfig.borderAccent
      )}
    >
      {/* Icon Badge */}
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-muted/40 border border-border/40">
        {styleConfig.icon}
      </div>

      {/* Text Content */}
      <div className="flex-1 min-w-0 pr-1">
        <div className="flex items-center gap-2">
          <h4 className="text-xs sm:text-sm font-semibold text-foreground tracking-tight line-clamp-1">
            {title}
          </h4>
          {priority === "critical" && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider bg-red-500/20 text-red-500 border border-red-500/30">
              Urgent
            </span>
          )}
        </div>

        {message && (
          <p className="mt-0.5 text-[11px] sm:text-xs text-muted-foreground leading-relaxed line-clamp-3">
            {message}
          </p>
        )}

        {/* Custom Actions */}
        {actions && actions.length > 0 && (
          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            {actions.map((action, idx) => (
              <Button
                key={idx}
                size="sm"
                variant="outline"
                onClick={() => {
                  action.onClick();
                  onDismiss();
                }}
                className="h-6 rounded-lg border-border/50 px-2.5 text-[10px] font-semibold transition-transform active:scale-[0.98]"
              >
                {action.label}
              </Button>
            ))}
          </div>
        )}
      </div>

      {/* Dismiss button */}
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss notification"
        className="shrink-0 p-1 rounded-lg text-muted-foreground/70 hover:text-foreground hover:bg-muted/50 transition-colors active:scale-[0.95]"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

export default ToastBanner;
