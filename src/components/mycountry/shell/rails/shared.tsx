"use client";

import React from "react";
import { FacetCard } from "~/components/ui/facet-container";
import { cn } from "~/lib/utils";
import type { V2Domain } from "../domain-meta";
import { timeAgo } from "~/lib/format/compact";

export const DOMAIN_ACCENT: Record<V2Domain, string> = {
  relations: "text-cyan-500",
  defense: "text-red-500",
  politics: "text-indigo-500",
  economy: "text-emerald-500",
};

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

export function DomainKpiGrid({ items }: { items: Kpi[] }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {items.map((item) => (
        <div
          key={item.label}
          className="rounded-xl border border-white/5 bg-white/[0.02] p-2.5 text-center backdrop-blur-md"
        >
          <p className="text-foreground text-sm font-bold tabular-nums">{item.value}</p>
          <p className="text-muted-foreground/70 mt-0.5 text-[9px] font-medium tracking-wider uppercase">
            {item.label}
          </p>
          {item.sub && <p className="text-muted-foreground mt-0.5 text-[10px]">{item.sub}</p>}
        </div>
      ))}
    </div>
  );
}

export function DomainActivityCard({
  domain,
  title,
  icon: HeaderIcon,
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
    <FacetCard depth={1} className="bg-card/30 p-4 backdrop-blur-md">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <HeaderIcon className={cn("h-3.5 w-3.5", DOMAIN_ACCENT[domain])} />
          <h4 className={cn("text-xs font-bold tracking-widest uppercase", DOMAIN_ACCENT[domain])}>
            {title}
          </h4>
        </div>
        <span className="text-muted-foreground/60 rounded-full border border-white/10 px-1.5 py-0.5 text-[9px] font-bold">
          {recent.length}
        </span>
      </div>

      <div className="mt-3 space-y-1.5">
        {recent.length === 0 && (
          <p className="text-muted-foreground rounded-lg border border-dashed border-white/10 bg-white/[0.01] px-3 py-5 text-center text-[11px] leading-relaxed">
            {emptyMessage}
          </p>
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
    </FacetCard>
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
    <div className="space-y-5">
      <FacetCard depth={1} className="bg-card/30 p-4 backdrop-blur-md">
        <div className="mb-3 flex items-center gap-2">
          <h4 className={cn("text-xs font-bold tracking-widest uppercase", DOMAIN_ACCENT[domain])}>
            {title}
          </h4>
        </div>
        <DomainKpiGrid items={kpis} />
      </FacetCard>

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
