"use client";

import React from "react";
import type { LucideIcon } from "lucide-react";
import { Plus } from "lucide-react";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";

/** Accent color → Tailwind class mappings */
const ACCENT_CLASSES: Record<string, { bg: string; text: string; border: string; btnBg: string }> = {
  amber: { bg: "bg-amber-500/8", text: "text-amber-600 dark:text-amber-400", border: "border-amber-500/20", btnBg: "bg-amber-600 hover:bg-amber-700" },
  cyan: { bg: "bg-cyan-500/8", text: "text-cyan-600 dark:text-cyan-400", border: "border-cyan-500/20", btnBg: "bg-cyan-600 hover:bg-cyan-700" },
  indigo: { bg: "bg-indigo-500/8", text: "text-indigo-600 dark:text-indigo-400", border: "border-indigo-500/20", btnBg: "bg-indigo-600 hover:bg-indigo-700" },
  red: { bg: "bg-red-500/8", text: "text-red-600 dark:text-red-400", border: "border-red-500/20", btnBg: "bg-red-600 hover:bg-red-700" },
  emerald: { bg: "bg-emerald-500/8", text: "text-emerald-600 dark:text-emerald-400", border: "border-emerald-500/20", btnBg: "bg-emerald-600 hover:bg-emerald-700" },
  slate: { bg: "bg-slate-500/8", text: "text-slate-600 dark:text-slate-400", border: "border-slate-500/20", btnBg: "bg-slate-600 hover:bg-slate-700" },
};

const STAT_COLORS: Record<string, string> = {
  red: "text-red-600 dark:text-red-400",
  amber: "text-amber-600 dark:text-amber-400",
  green: "text-green-600 dark:text-green-400",
  blue: "text-blue-600 dark:text-blue-400",
  indigo: "text-indigo-600 dark:text-indigo-400",
  slate: "text-muted-foreground",
  emerald: "text-emerald-600 dark:text-emerald-400",
  orange: "text-orange-600 dark:text-orange-400",
  purple: "text-purple-600 dark:text-purple-400",
  yellow: "text-yellow-600 dark:text-yellow-400",
  cyan: "text-cyan-600 dark:text-cyan-400",
};

export interface TabStat {
  label: string;
  value: number | string;
  color: string;
}

interface TabActionBarProps {
  title: string;
  subtitle?: string;
  icon: LucideIcon;
  accentColor: string;
  stats?: TabStat[];
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

/**
 * Compact action bar for Executive tab panels.
 * Replaces TabHeroBanner + separate stats strip with a single unified element.
 * Shows title, subtitle, inline stats, and a primary CTA button.
 */
export const TabActionBar = React.memo(function TabActionBar({
  title,
  subtitle,
  icon: Icon,
  accentColor,
  stats,
  actionLabel,
  onAction,
  className,
}: TabActionBarProps) {
  const accent = ACCENT_CLASSES[accentColor] ?? ACCENT_CLASSES.amber;

  return (
    <div className={cn(
      "flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-lg border p-3",
      accent.bg, accent.border,
      className,
    )}>
      {/* Left: Icon + Title */}
      <div className="flex items-center gap-2.5 min-w-0">
        <div className={cn("rounded-lg p-1.5 flex-shrink-0", accent.bg)}>
          <Icon className={cn("h-4 w-4", accent.text)} />
        </div>
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-foreground truncate">{title}</h3>
          {subtitle && <p className="text-xs text-muted-foreground truncate">{subtitle}</p>}
        </div>
      </div>

      {/* Right: Stats + CTA */}
      <div className="flex items-center gap-3 flex-shrink-0">
        {/* Inline stats */}
        {stats && stats.length > 0 && (
          <div className="flex items-center gap-3">
            {stats.map((stat) => (
              <div key={stat.label} className="text-center">
                <div className={cn("text-sm font-bold leading-none", STAT_COLORS[stat.color] ?? "text-foreground")}>
                  {stat.value}
                </div>
                <div className="text-[10px] text-muted-foreground mt-0.5">{stat.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* CTA button */}
        {actionLabel && onAction && (
          <Button
            size="sm"
            onClick={onAction}
            className={cn("gap-1 text-white text-xs h-7 px-2.5", accent.btnBg)}
          >
            <Plus className="h-3 w-3" />
            <span className="hidden sm:inline">{actionLabel}</span>
          </Button>
        )}
      </div>
    </div>
  );
});
