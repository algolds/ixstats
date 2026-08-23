"use client";

import React from "react";

import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";

/** Border-left accent color classes */
const ACCENT_BORDERS: Record<string, string> = {
  red: "border-l-red-500",
  amber: "border-l-amber-500",
  green: "border-l-green-500",
  blue: "border-l-blue-500",
  indigo: "border-l-indigo-500",
  slate: "border-l-slate-400",
  emerald: "border-l-emerald-500",
  orange: "border-l-orange-500",
  purple: "border-l-purple-500",
  yellow: "border-l-yellow-500",
  cyan: "border-l-cyan-500",
};

export interface CardBadge {
  label: string;
  colorClass: string;
}

export interface CardMetric {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
}

interface ExecutiveItemCardProps {
  /** Left accent border color */
  accentColor: string;
  /** Header icon */
  icon: React.ComponentType<{ className?: string }>;
  /** Main title */
  title: string;
  /** Subtitle / metadata line (string or JSX) */
  subtitle?: React.ReactNode;
  /** Optional body text (line-clamped to 2 lines) */
  description?: string;
  /** Status/priority badges shown after title */
  badges?: CardBadge[];
  /** Metric chips shown at bottom */
  metrics?: CardMetric[];
  /** Optional action button */
  actionLabel?: string;
  onAction?: (e: React.MouseEvent) => void;
  /** Card click handler (makes entire card clickable) */
  onClick?: () => void;
  /** Shows LOCAL badge for unsynchronized items */
  isLocal?: boolean;
  /** Additional children rendered after metrics */
  children?: React.ReactNode;
  className?: string;
}

/**
 * Unified card component for Executive tab panels.
 * Used for issues, meetings, policies — provides a consistent visual skeleton
 * with slot-based customization.
 */
export const ExecutiveItemCard = React.memo(function ExecutiveItemCard({
  accentColor,
  icon: Icon,
  title,
  subtitle,
  description,
  badges,
  metrics,
  actionLabel,
  onAction,
  onClick,
  isLocal,
  children,
  className,
}: ExecutiveItemCardProps) {
  const borderClass = ACCENT_BORDERS[accentColor] ?? ACCENT_BORDERS.slate;
  const isClickable = !!onClick;

  const content = (
    <div
      className={cn(
        "border-border/60 rounded-lg border border-l-[3px] p-3 transition-all duration-150",
        borderClass,
        isClickable && "hover:bg-muted/30 hover:border-border cursor-pointer hover:shadow-sm",
        className
      )}
      onClick={onClick}
      role={isClickable ? "button" : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onKeyDown={
        isClickable
          ? (e) => {
              if (e.key === "Enter") onClick?.();
            }
          : undefined
      }
    >
      {/* Header row: icon + title + badges */}
      <div className="flex items-start gap-2.5">
        <div className="mt-0.5 shrink-0">
          <Icon className="text-muted-foreground h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="truncate text-sm font-medium">{title}</span>
            {isLocal && (
              <Badge
                variant="outline"
                className="border-amber-500/40 px-1 py-0 text-[9px] text-amber-600 dark:text-amber-400"
              >
                LOCAL
              </Badge>
            )}
            {badges?.map((badge, i) => (
              <Badge
                key={i}
                variant="secondary"
                className={cn("px-1.5 py-0 text-[9px]", badge.colorClass)}
              >
                {badge.label}
              </Badge>
            ))}
          </div>
          {subtitle && <p className="text-muted-foreground mt-0.5 text-xs">{subtitle}</p>}
          {description && (
            <p className="text-muted-foreground mt-1 line-clamp-2 text-xs">{description}</p>
          )}
        </div>
      </div>

      {/* Metrics + action row */}
      {(metrics && metrics.length > 0) || actionLabel ? (
        <div className="border-border/40 mt-2.5 flex items-center justify-between gap-2 border-t pt-2">
          {metrics && metrics.length > 0 && (
            <div className="flex flex-wrap items-center gap-3">
              {metrics.map((metric, i) => (
                <div key={i} className="text-muted-foreground flex items-center gap-1 text-xs">
                  <metric.icon className="h-3 w-3" />
                  <span>{metric.label}:</span>
                  <span className="text-foreground font-medium">{metric.value}</span>
                </div>
              ))}
            </div>
          )}
          {actionLabel && onAction && (
            <Button
              size="sm"
              variant="ghost"
              className="h-6 shrink-0 px-2 text-xs"
              onClick={(e) => {
                e.stopPropagation();
                onAction(e);
              }}
            >
              {actionLabel}
            </Button>
          )}
        </div>
      ) : null}

      {/* Optional children (e.g., nested action items) */}
      {children}
    </div>
  );

  return content;
});
