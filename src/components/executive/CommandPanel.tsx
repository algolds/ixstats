"use client";

import React from "react";
import type { LucideIcon } from "lucide-react";
import { ChevronRight, Plus, HelpCircle } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { cn } from "~/lib/utils";

const GRADIENT_CLASSES: Record<
  string,
  { border: string; headerBg: string; iconBg: string; statBg: string }
> = {
  amber: {
    border: "border-amber-500/25",
    headerBg: "bg-gradient-to-r from-amber-500/8 to-yellow-500/5",
    iconBg: "bg-gradient-to-r from-amber-500 to-yellow-500",
    statBg: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
  },
  blue: {
    border: "border-blue-500/25",
    headerBg: "bg-gradient-to-r from-blue-500/8 to-cyan-500/5",
    iconBg: "bg-gradient-to-r from-blue-500 to-cyan-500",
    statBg: "bg-blue-500/10 text-blue-700 dark:text-blue-300",
  },
  indigo: {
    border: "border-indigo-500/25",
    headerBg: "bg-gradient-to-r from-indigo-500/8 to-violet-500/5",
    iconBg: "bg-gradient-to-r from-indigo-500 to-violet-500",
    statBg: "bg-indigo-500/10 text-indigo-700 dark:text-indigo-300",
  },
  red: {
    border: "border-red-500/25",
    headerBg: "bg-gradient-to-r from-red-500/8 to-orange-500/5",
    iconBg: "bg-gradient-to-r from-red-500 to-orange-500",
    statBg: "bg-red-500/10 text-red-700 dark:text-red-300",
  },
  cyan: {
    border: "border-cyan-500/25",
    headerBg: "bg-gradient-to-r from-cyan-500/8 to-blue-500/5",
    iconBg: "bg-gradient-to-r from-cyan-500 to-blue-500",
    statBg: "bg-cyan-500/10 text-cyan-700 dark:text-cyan-300",
  },
};

export interface PanelStat {
  label: string;
  value: number | string;
}

interface CommandPanelProps {
  title: string;
  icon: LucideIcon | React.ComponentType<{ size?: number; className?: string }>;
  accentColor: string;
  stats?: PanelStat[];
  /** Primary CTA button */
  ctaLabel?: string;
  onCta?: () => void;
  /** Footer link */
  footerLabel?: string;
  onFooter?: () => void;
  /** Number of total items (shown in footer) */
  totalCount?: number;
  /** Empty state message (used as the title when emptyTitle is not provided) */
  emptyIcon?: LucideIcon;
  emptyMessage?: string;
  /** Richer empty state: bold title + supporting description. Falls back to emptyMessage. */
  emptyTitle?: string;
  emptyDescription?: string;
  children: React.ReactNode;
  className?: string;
  /** Help icon click handler */
  onHelp?: () => void;
}

/**
 * Rich branded command panel for the Executive War Room.
 * Shows a gradient header with icon + stats, content items, and a footer with CTA.
 */
export const CommandPanel = React.memo(function CommandPanel({
  title,
  icon: Icon,
  accentColor,
  stats,
  ctaLabel,
  onCta,
  footerLabel,
  onFooter,
  totalCount,
  emptyIcon: EmptyIcon,
  emptyMessage,
  emptyTitle,
  emptyDescription,
  children,
  className,
  onHelp,
}: CommandPanelProps) {
  const theme = GRADIENT_CLASSES[accentColor] ?? GRADIENT_CLASSES.amber;
  const hasChildren = React.Children.count(children) > 0;

  return (
    <div
      className={cn(
        "glass-hierarchy-child flex flex-col overflow-hidden rounded-xl border",
        theme.border,
        className
      )}
    >
      {/* Gradient header */}
      <div className={cn("px-3.5 py-3", theme.headerBg)}>
        <div className="flex items-center justify-between gap-2.5">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className={cn("shrink-0 rounded-lg p-1.5", theme.iconBg)}>
              <Icon size={14} className="text-white" />
            </div>
            <h3 className="truncate text-sm font-semibold">{title}</h3>
          </div>
          {onHelp && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onHelp();
              }}
              className="text-muted-foreground hover:text-foreground shrink-0 transition-colors p-0.5 rounded hover:bg-white/10"
              title="Help"
            >
              <HelpCircle size={14} />
            </button>
          )}
        </div>

        {/* Stat chips */}
        {stats && stats.length > 0 && (
          <div className="mt-2 flex items-center gap-1.5">
            {stats.map((stat) => (
              <Badge
                key={stat.label}
                variant="secondary"
                className={cn("px-1.5 py-0.5 text-[10px] font-medium", theme.statBg)}
              >
                {stat.value} {stat.label}
              </Badge>
            ))}
          </div>
        )}
      </div>

      {/* Content items */}
      <div className="flex-1 px-1.5 py-1.5">
        {hasChildren ? (
          <div className="divide-border/30 divide-y">{children}</div>
        ) : (
          <div className="flex flex-col items-center justify-center gap-1.5 px-3 py-7 text-center">
            {EmptyIcon && <EmptyIcon className="text-muted-foreground/40 mb-0.5 h-7 w-7" />}
            <p className="text-foreground/90 text-sm font-medium">
              {emptyTitle ?? emptyMessage ?? "Nothing here yet"}
            </p>
            {emptyDescription && (
              <p className="text-muted-foreground max-w-[32ch] text-xs leading-relaxed">
                {emptyDescription}
              </p>
            )}
            {ctaLabel && onCta && (
              <Button size="sm" onClick={onCta} className="mt-2 h-7 gap-1 px-3 text-xs">
                <Plus className="h-3 w-3" />
                {ctaLabel}
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Footer: View All + CTA */}
      <div className="border-border/30 bg-muted/20 flex items-center justify-between border-t px-3.5 py-2.5">
        {footerLabel && onFooter ? (
          <button
            onClick={onFooter}
            className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-xs transition-colors"
          >
            {footerLabel}
            {totalCount != null && totalCount > 0 && (
              <Badge variant="secondary" className="ml-0.5 px-1 py-0 text-[9px]">
                {totalCount}
              </Badge>
            )}
            <ChevronRight className="h-3 w-3" />
          </button>
        ) : (
          <div />
        )}
        {ctaLabel && onCta && hasChildren && (
          <Button size="sm" variant="outline" onClick={onCta} className="h-7 gap-1 px-2.5 text-xs">
            <Plus className="h-3 w-3" />
            {ctaLabel}
          </Button>
        )}
      </div>
    </div>
  );
});
