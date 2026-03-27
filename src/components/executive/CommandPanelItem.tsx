"use client";

import React from "react";
import { Badge } from "~/components/ui/badge";
import { cn } from "~/lib/utils";

const DOT_COLORS: Record<string, string> = {
  red: "bg-red-500",
  amber: "bg-amber-500",
  green: "bg-green-500",
  blue: "bg-blue-500",
  indigo: "bg-indigo-500",
  slate: "bg-slate-400",
  orange: "bg-orange-500",
  purple: "bg-purple-500",
  yellow: "bg-yellow-500",
  cyan: "bg-cyan-500",
};

export interface PanelItemBadge {
  label: string;
  colorClass: string;
}

interface CommandPanelItemProps {
  /** Accent dot color */
  accentColor: string;
  /** Main title */
  title: string;
  /** Subtitle line */
  subtitle?: string;
  /** Status/priority badges */
  badges?: PanelItemBadge[];
  /** Right-side text (deadline, date, etc.) */
  trailingText?: string;
  trailingColor?: string;
  /** Pulse the accent dot (for critical items) */
  pulse?: boolean;
  /** Click handler */
  onClick?: () => void;
  className?: string;
}

/**
 * Compact item row for inside CommandPanel.
 * Designed for density — 3-5 items in a tight panel.
 */
export const CommandPanelItem = React.memo(function CommandPanelItem({
  accentColor,
  title,
  subtitle,
  badges,
  trailingText,
  trailingColor,
  pulse,
  onClick,
  className,
}: CommandPanelItemProps) {
  const dotClass = DOT_COLORS[accentColor] ?? DOT_COLORS.slate;

  return (
    <div
      className={cn(
        "flex items-start gap-2.5 rounded-md px-2.5 py-2 transition-colors",
        onClick && "cursor-pointer hover:bg-muted/50",
        pulse && "bg-red-500/5",
        className,
      )}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === "Enter") onClick(); } : undefined}
    >
      {/* Accent dot */}
      <div className="mt-1.5 flex-shrink-0">
        <div className={cn("h-2 w-2 rounded-full", dotClass, pulse && "animate-pulse")} />
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-medium truncate">{title}</span>
          {badges?.map((badge, i) => (
            <Badge key={i} variant="secondary" className={cn("text-[8px] px-1 py-0 leading-tight flex-shrink-0", badge.colorClass)}>
              {badge.label}
            </Badge>
          ))}
        </div>
        {subtitle && (
          <p className="text-[11px] text-muted-foreground truncate mt-0.5">{subtitle}</p>
        )}
      </div>

      {/* Trailing text (deadline, date) */}
      {trailingText && (
        <span className={cn("text-[10px] font-medium flex-shrink-0 mt-0.5", trailingColor ?? "text-muted-foreground")}>
          {trailingText}
        </span>
      )}
    </div>
  );
});
