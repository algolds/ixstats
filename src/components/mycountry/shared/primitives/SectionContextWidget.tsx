"use client";

import React from "react";

import { Page as ScrollText } from "iconoir-react";
import { cn } from "~/lib/utils";
import { Badge } from "~/components/ui/badge";
import { CutoutPanel } from "~/components/mycountry/cards";
import { ACCENT_CLASSES, type MyCountryAccent } from "~/components/mycountry/shared/cards/accents";

export interface ContextStat {
  label: string;
  value: string | number;
  /** Render the value in the section accent color. */
  accentText?: boolean;
}

export interface ContextActivityEntry {
  id: string;
  icon: React.ComponentType<{ className?: string }>;
  iconColor: string;
  text: string;
  time: Date;
}

interface SectionContextWidgetProps {
  accent?: MyCountryAccent;
  /** Activity-log header title (default "Activity"). */
  title?: string;
  icon?: React.ComponentType<{ className?: string }>;
  /** Compact quick-stat snapshot rendered above the log. */
  stats?: ContextStat[];
  /** Recent-activity entries (latest first; only the first 5 are shown). */
  activity?: ContextActivityEntry[];
  emptyMessage?: string;
  className?: string;
}

const STATS_GRID: Record<number, string> = {
  1: "grid-cols-1",
  2: "grid-cols-2",
  3: "grid-cols-3",
};

/**
 * SectionContextWidget — the single, consistent left-sidebar widget for every
 * MyCountry section: a compact quick-stats snapshot atop a recent-activity log.
 * Sections feed it `stats` + `activity` arrays (data adapters), so the widget
 * itself stays data-agnostic and uniform across all six sections.
 */
export function SectionContextWidget({
  accent = "neutral",
  title = "Activity",
  icon: HeaderIcon = ScrollText,
  stats,
  activity,
  emptyMessage = "No recent activity yet",
  className,
}: SectionContextWidgetProps) {
  const a = ACCENT_CLASSES[accent];
  const hasStats = Boolean(stats && stats.length > 0);
  const recent = activity?.slice(0, 5) ?? [];

  return (
    <CutoutPanel className={className} contentClassName="p-3">
      {hasStats && (
        <div className={cn("grid gap-2", STATS_GRID[Math.min(stats!.length, 3)] ?? "grid-cols-3")}>
          {stats!.map((s) => (
            <div key={s.label} className="bg-muted/40 rounded-lg p-2 text-center">
              <div className={cn("text-sm font-bold", s.accentText && a.text)}>{s.value}</div>
              <div className="text-muted-foreground text-[10px]">{s.label}</div>
            </div>
          ))}
        </div>
      )}

      <div className={cn("flex items-center justify-between", hasStats ? "mt-3 mb-2" : "mb-2.5")}>
        <div className="flex items-center gap-2">
          <HeaderIcon className={cn("h-3.5 w-3.5", a.text)} />
          <span className="text-xs font-semibold">{title}</span>
        </div>
        <Badge variant="outline" className="px-1.5 py-0 text-[0.65rem]">
          {recent.length}
        </Badge>
      </div>

      <div className="space-y-1.5">
        {recent.length === 0 && (
          <p className="text-muted-foreground py-3 text-center text-[11px]">{emptyMessage}</p>
        )}
        {recent.map((e) => (
          <div key={e.id} className="flex items-start gap-2 py-1">
            <e.icon className={cn("mt-0.5 h-3 w-3 shrink-0", e.iconColor)} />
            <div className="min-w-0 flex-1">
              <p className="line-clamp-1 text-[11px] leading-snug">{e.text}</p>
              <span className="text-muted-foreground text-[10px]">{timeAgo(e.time)}</span>
            </div>
          </div>
        ))}
      </div>
    </CutoutPanel>
  );
}

function timeAgo(date: Date): string {
  const diffMin = Math.floor((Date.now() - date.getTime()) / 60000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 30) return `${diffDay}d ago`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
