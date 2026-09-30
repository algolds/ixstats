"use client";

import React from "react";
import { FacetCard } from "~/components/ui/facet-container";
import { Skeleton } from "~/components/ui/skeleton";
import { SectionHeader } from "./surface-kit";
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
      <div
        className="bg-muted/40 divide-border/60 divide-y overflow-hidden rounded-2xl"
        aria-busy="true"
        aria-label="Loading census"
      >
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="flex items-center justify-between gap-3 px-3 py-2.5">
            <Skeleton className="h-3.5 w-2/5" />
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
        ))}
      </div>
    );
  }
  if (!rankings || rankings.length === 0) {
    return (
      <div className="bg-muted/30 rounded-2xl px-4 py-6 text-center">
        <p className="text-foreground text-sm font-medium">No census data yet.</p>
        <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
          Ranks appear once your nation and its realm peers have population and GDP on record.
        </p>
      </div>
    );
  }
  return (
    <ul className="bg-muted/40 divide-border/60 divide-y overflow-hidden rounded-2xl">
      {rankings.map((r) => (
        <li
          key={r.category}
          className="flex min-h-11 items-center justify-between gap-3 px-3 py-2 text-sm"
          title={
            `${r.category}: #${r.global.position} of ${r.global.total} in the realm` +
            (r.regional.total > 0
              ? `, #${r.regional.position} of ${r.regional.total} in ${r.regional.region}`
              : "") +
            (r.lowerIsBetter ? " (lower is better)" : "")
          }
        >
          <span className="text-foreground min-w-0 truncate">{r.category}</span>
          <span className="flex shrink-0 items-center gap-2.5">
            <span className="text-muted-foreground text-xs tabular-nums">
              {formatCensusValue(r)}
            </span>
            <span
              className={cn(
                "min-w-14 rounded-full px-2 py-0.5 text-center text-xs font-semibold tabular-nums",
                r.global.position <= 3
                  ? "bg-amber-500/15 text-amber-700 dark:text-amber-400"
                  : "bg-card text-foreground"
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
      role="region"
      aria-labelledby="world-census-title"
      className="flex flex-col gap-4 rounded-3xl p-4 sm:p-5"
    >
      <SectionHeader
        id="world-census-title"
        title="World Census"
        subtitle="Your rank among nations in your realm"
      />
      <WorldCensusList rankings={data} isLoading={isLoading} />
    </FacetCard>
  );
}
