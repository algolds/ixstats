"use client";

import React, { useId, useMemo, useState } from "react";
import { StatsReport } from "iconoir-react";
import { FacetCard, FacetCardContent, FacetCardHeader } from "~/components/ui/facet-container";
import { FacetList, FacetListSection, FacetRow } from "~/components/ui/facet-list";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { EmptyState } from "~/components/ui/empty-state";
import { Skeleton } from "~/components/ui/skeleton";
import { api } from "~/trpc/react";
import { formatCompact } from "~/lib/format/compact";
import type { Ranking, RankingCategory } from "~/types/mycountry";

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

/**
 * Tie-break order when two ranks stand out equally: the headline measures of a nation first.
 * Categories not listed sort last.
 */
export const CENSUS_PRIORITY: readonly RankingCategory[] = [
  "Total GDP",
  "GDP per Capita",
  "Population",
  "Public Approval",
  "Stability",
  "GDP Growth",
  "Diplomatic Standing",
  "Infrastructure",
  "Debt to GDP",
  "Income Equality",
];

/** How many census rows show before "See more". */
export const CENSUS_VISIBLE_COUNT = 5;

function priorityOf(category: RankingCategory): number {
  const i = CENSUS_PRIORITY.indexOf(category);
  return i === -1 ? CENSUS_PRIORITY.length : i;
}

/**
 * The census in order of relevance: where the nation stands out most among its realm peers.
 * Best rank percentile first (percentile already accounts for "lower is better" and for how many
 * nations report the category), then the better absolute position, then the headline order
 * above. Pure; returns a new array.
 */
export function sortCensusByRelevance(rankings: readonly Ranking[]): Ranking[] {
  return [...rankings].sort(
    (a, b) =>
      b.percentile - a.percentile ||
      a.global.position - b.global.position ||
      priorityOf(a.category) - priorityOf(b.category)
  );
}

export interface WorldCensusListProps {
  rankings: Ranking[] | undefined;
  isLoading?: boolean;
  /** Rows shown before the "See more" disclosure (default 5). */
  visibleCount?: number;
}

function describeRank(r: Ranking): string {
  return (
    `${r.category}: #${r.global.position} of ${r.global.total} in the realm` +
    (r.regional.total > 0
      ? `, #${r.regional.position} of ${r.regional.total} in ${r.regional.region}`
      : "") +
    (r.lowerIsBetter ? " (lower is better)" : "")
  );
}

/**
 * The census rows — category, value and realm rank — most relevant first. The first
 * `visibleCount` rows show; the rest sit behind an accessible "See N more" / "See less"
 * disclosure (`aria-expanded` + `aria-controls` on the list).
 */
export function WorldCensusList({
  rankings,
  isLoading,
  visibleCount = CENSUS_VISIBLE_COUNT,
}: WorldCensusListProps) {
  const [expanded, setExpanded] = useState(false);
  const listId = useId();
  const sorted = useMemo(() => sortCensusByRelevance(rankings ?? []), [rankings]);

  if (isLoading) {
    return (
      <div className="flex flex-col" aria-busy="true" aria-label="Loading census">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="flex min-h-11 items-center justify-between gap-3 py-2">
            <Skeleton className="h-3.5 w-2/5" />
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
        ))}
      </div>
    );
  }
  if (sorted.length === 0) {
    return (
      <EmptyState
        compact
        icon={<StatsReport />}
        title="No census data yet."
        message="Ranks appear once your nation and its realm peers have population and GDP on record."
      />
    );
  }

  const hiddenCount = Math.max(0, sorted.length - visibleCount);
  const shown = expanded ? sorted : sorted.slice(0, visibleCount);

  return (
    <div className="flex flex-col">
      <FacetList variant="plain">
        <FacetListSection id={listId} aria-label="Census ranks">
          {shown.map((r) => (
            <FacetRow
              key={r.category}
              className="pl-0"
              title={<span className="text-body text-label font-normal">{r.category}</span>}
              trailing={
                <span className="flex items-center gap-2.5" title={describeRank(r)}>
                  <span className="text-footnote text-label-secondary tabular-nums">
                    {formatCensusValue(r)}
                  </span>
                  {/* A top-three rank is the one meaningful status here: it takes the app tint. */}
                  <Badge
                    variant={r.global.position <= 3 ? "tinted" : "neutral"}
                    className="min-w-14 font-semibold tabular-nums"
                  >
                    #{r.global.position}
                    <span className="font-normal opacity-70">/{r.global.total}</span>
                    <span className="sr-only"> in the realm</span>
                  </Badge>
                </span>
              }
            />
          ))}
        </FacetListSection>
      </FacetList>
      {hiddenCount > 0 ? (
        <Button
          type="button"
          variant="plain"
          size="sm"
          aria-expanded={expanded}
          aria-controls={listId}
          onClick={() => setExpanded((v) => !v)}
          className="mt-1 self-start px-0 hover:bg-transparent"
        >
          {expanded ? "See less" : `See ${hiddenCount} more`}
        </Button>
      ) : null}
    </div>
  );
}

export interface WorldCensusCardProps {
  countryId: string;
}

/**
 * MyCountry rail card: the country's World Census ranks within its realm — the five where it
 * stands out most, with the rest behind "See more".
 */
export function WorldCensusCard({ countryId }: WorldCensusCardProps) {
  const { data, isLoading } = api.mycountry.getRankings.useQuery(
    { countryId },
    { enabled: !!countryId, staleTime: 300_000 }
  );

  return (
    <FacetCard
      depth={2}
      interactive="none"
      role="region"
      aria-labelledby="world-census-title"
      className="rounded-3xl"
    >
      <FacetCardHeader className="gap-0.5 px-4 pt-4 pb-0">
        <h2 id="world-census-title" className="text-headline text-label">
          World Census
        </h2>
        <p className="text-footnote text-label-secondary">Where you stand out in your realm</p>
      </FacetCardHeader>
      <FacetCardContent className="px-4 pt-1 pb-3">
        <WorldCensusList rankings={data} isLoading={isLoading} />
      </FacetCardContent>
    </FacetCard>
  );
}
