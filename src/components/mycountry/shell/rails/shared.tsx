"use client";

import React from "react";
import { cn } from "~/lib/utils";
import type { MyCountryDomain } from "../domain-meta";
import { timeAgo } from "~/lib/format/compact";
import { STATUS_TEXT as SHELL_STATUS_TEXT } from "../status-tone";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Progress } from "~/components/ui/progress";
/**
 * Status colours for the domain rails: the shell's shared `status-tone` mapping (destructive,
 * warning, MyCountry gold, muted) plus `success` for healthy readings.
 */
export const STATUS_TEXT = {
  ...SHELL_STATUS_TEXT,
  success: "text-success",
} as const;

/** Semantic fill for a progress/level bar. */
export const STATUS_FILL = {
  critical: "bg-destructive",
  warning: "bg-warning",
  accent: "bg-label-secondary",
  neutral: "bg-label-tertiary",
  success: "bg-success",
} as const;

export type StatusTone = keyof typeof STATUS_TEXT;

export interface Kpi {
  label: string;
  value: string | number;
  sub?: string;
}

export interface ActivityEntry {
  id: string;
  icon: React.ComponentType<{ className?: string }>;
  iconColor: string;
  text: string;
  time: Date;
}

/** Appends an activity entry only when the record carries a real timestamp (never "now"). */
export function pushRecorded(
  entries: ActivityEntry[],
  entry: Omit<ActivityEntry, "time">,
  ...stamps: Array<string | Date | null | undefined>
): void {
  const stamp = stamps.find((value) => value != null);
  if (stamp != null) entries.push({ ...entry, time: new Date(stamp) });
}

/**
 * A rail card: a neutral Facet pane `Card` with a sentence-case title row and hairline-divided content below.
 */
export function RailCard({
  title,
  icon: Icon,
  accessory,
  className,
  contentClassName,
  children,
}: {
  title: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
  accessory?: React.ReactNode;
  className?: string;
  contentClassName?: string;
  children: React.ReactNode;
}) {
  return (
    <Card padding="none" className={cn("rounded-card", className)}>
      <CardHeader className="flex-row items-center justify-between gap-2 p-4 pb-3">
        <CardTitle
          icon={Icon ? <Icon /> : undefined}
          role="heading"
          aria-level={3}
          className="min-w-0"
        >
          <span className="truncate">{title}</span>
        </CardTitle>
        {accessory ? <div className="flex shrink-0 items-center gap-2">{accessory}</div> : null}
      </CardHeader>
      <CardContent className={cn("space-y-2 px-4 pb-4", contentClassName)}>{children}</CardContent>
    </Card>
  );
}

/** A clean flat row inside a rail card (divided by hairlines, no nested box). */
export function RailRow({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "border-separator/60 text-footnote border-t py-2 first:border-t-0 first:pt-0 last:pb-0",
        className
      )}
    >
      {children}
    </div>
  );
}

/** Thin level bar (0–100). */
export function RailBar({ value, fill = "bg-label-secondary" }: { value: number; fill?: string }) {
  return (
    <Progress
      value={Math.min(100, Math.max(0, value))}
      aria-hidden
      className="bg-fill-3 mt-1 h-1"
      indicatorClassName={fill}
    />
  );
}

/** Empty-state line inside a rail card. */
export function RailEmpty({ children }: { children: React.ReactNode }) {
  return <p className="text-label-secondary text-footnote py-2 text-center">{children}</p>;
}

/** Quiet count accessory for a rail card header. */
export function RailCount({ children }: { children: React.ReactNode }) {
  return <span className="text-label-secondary text-footnote tabular-nums">{children}</span>;
}

export function DomainKpiGrid({ items }: { items: Kpi[] }) {
  return (
    <dl className="divide-separator/60 grid grid-cols-3 divide-x">
      {items.map((item) => (
        <div key={item.label} className="min-w-0 px-2.5 first:pl-0 last:pr-0">
          <dt className="text-caption text-label-secondary truncate">{item.label}</dt>
          <dd className="text-label text-title-3 mt-0.5 tabular-nums">{item.value}</dd>
          {item.sub && <dd className="text-label-secondary text-footnote mt-0.5">{item.sub}</dd>}
        </div>
      ))}
    </dl>
  );
}

export function DomainActivityCard({
  domain: _domain,
  title,
  icon,
  entries,
  emptyMessage,
}: {
  domain: MyCountryDomain;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  entries: ActivityEntry[];
  emptyMessage: string;
}) {
  const recent = entries.slice(0, 5);
  return (
    <RailCard title={title} icon={icon} accessory={<RailCount>{recent.length}</RailCount>}>
      {recent.length === 0 ? (
        <RailEmpty>{emptyMessage}</RailEmpty>
      ) : (
        <ul className="divide-separator divide-y">
          {recent.map((e) => (
            <li key={e.id} className="flex items-start gap-2 py-2 first:pt-0 last:pb-0">
              <e.icon
                aria-hidden="true"
                className={cn("mt-0.5 h-3.5 w-3.5 shrink-0", e.iconColor)}
              />
              <div className="min-w-0 flex-1">
                <p className="text-label text-footnote line-clamp-1 leading-snug">{e.text}</p>
                <span className="text-label-secondary text-footnote">{timeAgo(e.time)}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </RailCard>
  );
}
