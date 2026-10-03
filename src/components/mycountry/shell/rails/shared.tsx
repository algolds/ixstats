"use client";

import React from "react";
import { Badge } from "~/components/ui/badge";
import { Eyebrow } from "~/components/ui/eyebrow";
import { cn } from "~/lib/utils";
import type { V2Domain } from "../domain-meta";
import { timeAgo } from "~/lib/format/compact";
import { STATUS_TEXT as SHELL_STATUS_TEXT } from "../status-tone";
import { Card, CardContent, CardHeader } from "~/components/ui/card";

/** Legacy per-domain text accent (re-exported by DomainContextRail; not used by the rails). */
export const DOMAIN_ACCENT: Record<V2Domain, string> = {
  relations: "text-cyan",
  defense: "text-red",
  politics: "text-indigo",
  economy: "text-green",
};

/**
 * Status colours for the domain rails: the shell's shared `status-tone` mapping (destructive,
 * orange warning, MyCountry gold, muted) plus `success` for healthy readings.
 */
export const STATUS_TEXT = {
  ...SHELL_STATUS_TEXT,
  success: "text-green",
} as const;

/** Semantic fill for a progress/level bar. */
export const STATUS_FILL = {
  critical: "bg-destructive",
  warning: "bg-orange",
  accent: "bg-yellow",
  neutral: "bg-label-tertiary",
  success: "bg-green",
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

/**
 * A rail card: a Facet card with a plain title row (muted glyph, sentence-case title, optional
 * trailing accessory such as a count badge) and content below.
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
    <Card className={cn("rounded-card", className)}>
      <CardHeader className="flex-row items-center justify-between gap-2 p-4 pb-3">
        <div className="flex min-w-0 items-center gap-2">
          {Icon && <Icon aria-hidden="true" className="text-label-secondary h-4 w-4 shrink-0" />}
          <h3 className="text-label text-headline truncate">{title}</h3>
        </div>
        {accessory ? <div className="flex shrink-0 items-center gap-2">{accessory}</div> : null}
      </CardHeader>
      <CardContent className={cn("space-y-2 px-4 pb-4", contentClassName)}>{children}</CardContent>
    </Card>
  );
}

/** A row nested inside a rail card: opaque (no stacked blur). */
export function RailRow({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return <Card className={cn("rounded-row text-footnote p-2", className)}>{children}</Card>;
}

/** Thin level bar (0–100). */
export function RailBar({ value, fill = "bg-tint" }: { value: number; fill?: string }) {
  return (
    <div className="bg-fill-3 mt-1 h-1 w-full overflow-hidden rounded-full">
      <div
        className={cn("h-full rounded-full", fill)}
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  );
}

/** Empty-state line inside a rail card. */
export function RailEmpty({ children }: { children: React.ReactNode }) {
  return <p className="text-label-secondary text-footnote py-2 text-center">{children}</p>;
}

/** Count accessory for a rail card header. */
export function RailCount({ children }: { children: React.ReactNode }) {
  return (
    <Badge variant="default" className="tabular-nums">
      {children}
    </Badge>
  );
}

export function DomainKpiGrid({ items }: { items: Kpi[] }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {items.map((item) => (
        <Card key={item.label} className="p-2">
          <Eyebrow className="block truncate">{item.label}</Eyebrow>
          <p className="text-label text-title-3 mt-0.5 tabular-nums">{item.value}</p>
          {item.sub && <p className="text-label-secondary text-footnote mt-0.5">{item.sub}</p>}
        </Card>
      ))}
    </div>
  );
}

export function DomainActivityCard({
  domain: _domain,
  title,
  icon,
  entries,
  emptyMessage,
}: {
  domain: V2Domain;
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

export function DomainWidget({
  domain,
  title,
  kpis,
  activityTitle,
  activityIcon,
  entries,
  emptyMessage,
}: {
  domain: V2Domain;
  title: string;
  kpis: Kpi[];
  activityTitle: string;
  activityIcon: React.ComponentType<{ className?: string }>;
  entries: ActivityEntry[];
  emptyMessage: string;
}) {
  return (
    <div className="space-y-6">
      <RailCard title={title}>
        <DomainKpiGrid items={kpis} />
      </RailCard>

      <DomainActivityCard
        domain={domain}
        title={activityTitle}
        icon={activityIcon}
        entries={entries}
        emptyMessage={emptyMessage}
      />
    </div>
  );
}
