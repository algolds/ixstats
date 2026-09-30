"use client";

import React from "react";
import { FacetCard } from "~/components/ui/facet-container";
import { api } from "~/trpc/react";
import { formatCompact } from "~/lib/format/compact";
import { cn } from "~/lib/utils";
import type { Ranking } from "~/types/mycountry";

/** Format a census value for display, in the category's own units. */
export function formatCensusValue(ranking: Pick<Ranking, "category" | "value">): string {
  const v = ranking.value;
  if (typeof v !== "number" || !Number.isFinite(v)) return "—";
  switch (ranking.category) {
    case "GDP per Capita":
    case "Total GDP":
      return `$${formatCompact(Math.round(v))}`;
    case "Population":
      return formatCompact(Math.round(v));
    case "GDP Growth":
      return `${(v * 100).toFixed(1)}%`;
    case "Public Approval":
    case "Debt to GDP":
      return `${Math.round(v)}%`;
    case "Income Equality":
      return `Gini ${v.toFixed(2)}`;
    default:
      return `${Math.round(v)}/100`;
  }
}

export interface WorldCensusListProps {
  rankings: Ranking[] | undefined;
  isLoading?: boolean;
}

/** The census rows: category, value and rank within the realm. */
export function WorldCensusList({ rankings, isLoading }: WorldCensusListProps) {
  if (isLoading) {
    return (
      <div className="space-y-1.5" aria-busy="true">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="bg-muted/40 h-6 animate-pulse rounded-md" />
        ))}
      </div>
    );
  }
  if (!rankings || rankings.length === 0) {
    return <p className="text-muted-foreground text-xs">No census data yet.</p>;
  }
  return (
    <ul className="divide-border/40 divide-y">
      {rankings.map((r) => (
        <li
          key={r.category}
          className="flex items-center justify-between gap-2 py-1.5 text-xs"
          title={
            `${r.category}: #${r.global.position} of ${r.global.total} in the realm` +
            (r.regional.total > 0
              ? `, #${r.regional.position} of ${r.regional.total} in ${r.regional.region}`
              : "") +
            (r.lowerIsBetter ? " (lower is better)" : "")
          }
        >
          <span className="text-muted-foreground min-w-0 truncate font-semibold">{r.category}</span>
          <span className="flex shrink-0 items-center gap-2">
            <span className="text-foreground font-mono tabular-nums">{formatCensusValue(r)}</span>
            <span
              className={cn(
                "rounded-full border px-1.5 py-0.5 font-bold tabular-nums",
                r.global.position <= 3
                  ? "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400"
                  : "border-border/60 bg-muted/40 text-foreground"
              )}
            >
              #{r.global.position}
              <span className="text-muted-foreground font-normal">/{r.global.total}</span>
            </span>
          </span>
        </li>
      ))}
    </ul>
  );
}

export interface WorldCensusCardProps {
  countryId: string;
}

/** MyCountry rail card: the country's World Census ranks within its realm. */
export function WorldCensusCard({ countryId }: WorldCensusCardProps) {
  const { data, isLoading } = api.mycountry.getRankings.useQuery(
    { countryId },
    { enabled: !!countryId, staleTime: 300_000 }
  );

  return (
    <FacetCard
      depth={1}
      interactive="none"
      className="border-border/60 bg-card/60 flex flex-col gap-2 rounded-2xl border p-3.5 shadow-sm backdrop-blur-md"
    >
      <div className="flex flex-col">
        <span className="text-muted-foreground/70 text-xs font-bold tracking-wider uppercase">
          World Census
        </span>
        <span className="text-muted-foreground text-xs">Rank among nations in your realm</span>
      </div>
      <WorldCensusList rankings={data} isLoading={isLoading} />
    </FacetCard>
  );
}
