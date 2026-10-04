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
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils/cn";

interface ToastBannerProps {
  toast: ToastQueueItem;
  onDismiss: () => void;
}

/**
 * Status chip per toast type: the status `-ink` on a 15% fill (AA on every background,
 * token-contrast.test.ts) and a 30% edge on the banner. Written out so Tailwind sees each class.
 */
const TYPE_STYLES = {
  success: {
    Icon: CheckCircle,
    chip: "bg-success/15 text-success-ink",
    edge: "border-success/30",
  },
  error: {
    Icon: WarningCircle,
    chip: "bg-destructive/15 text-destructive-ink",
    edge: "border-destructive/30",
  },
  warning: {
    Icon: AlertTriangle,
    chip: "bg-warning/15 text-warning-ink",
    edge: "border-warning/30",
  },
  info: {
    Icon: InfoCircle,
    chip: "bg-info/15 text-info-ink",
    edge: "border-info/30",
  },
} as const;

export function ToastBanner({ toast, onDismiss }: ToastBannerProps) {
  const { title, message, type = "info", priority = "medium", actions } = toast;
  const styleConfig = TYPE_STYLES[type as keyof typeof TYPE_STYLES] ?? TYPE_STYLES.info;
  const { Icon } = styleConfig;

  return (
    <div
      role="alert"
      className={cn(
        // Floating chrome: thick material, floating shadow, one hairline tinted by status.
        "group facet-overlay text-label shadow-floating rounded-card pointer-events-auto relative flex w-full max-w-sm items-start gap-3 border p-3 text-left select-none sm:max-w-md sm:p-4",
        "duration-fast ease-out-facet transition-[border-color,box-shadow,opacity,transform]",
        styleConfig.edge
      )}
    >
      {/* Status icon */}
      <div
        className={cn(
          "rounded-control-sm flex size-7 shrink-0 items-center justify-center",
          styleConfig.chip
        )}
      >
        <Icon aria-hidden="true" className="size-4 shrink-0" />
      </div>

      {/* Text Content */}
      <div className="min-w-0 flex-1 pr-1">
        <div className="flex items-center gap-2">
          <h4 className="text-subhead text-label line-clamp-1 font-semibold">{title}</h4>
          {priority === "critical" && <Badge variant="destructive">Urgent</Badge>}
        </div>

        {message && (
          <p className="text-footnote text-label-secondary mt-0.5 line-clamp-3">{message}</p>
        )}

        {/* Custom Actions */}
        {actions && actions.length > 0 && (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {actions.map((action, idx) => (
              <Button
                key={idx}
                size="sm"
                variant="outline"
                onClick={() => {
                  action.onClick();
                  onDismiss();
                }}
              >
                {action.label}
              </Button>
            ))}
          </div>
        )}
      </div>

      {/* Dismiss button */}
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        onClick={onDismiss}
        aria-label="Dismiss notification"
        className="text-label-secondary hover:text-label shrink-0"
      >
        <X aria-hidden="true" className="size-3.5" />
      </Button>
    </div>
  );
}
