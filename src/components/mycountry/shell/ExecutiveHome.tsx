"use client";

import React, { useState, useMemo, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { KeyCommand as Command, ClockRotateRight as FileClock, Clock } from "iconoir-react";
import { api } from "~/trpc/react";
import { cn } from "~/lib/utils";
import { FacetCard, FacetCardContent, FacetCardHeader } from "~/components/ui/facet-container";
import { focusRing } from "~/components/ui/button";
import { Skeleton } from "~/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "~/components/ui/tooltip";
import { ExecutiveOpportunityHero } from "./ExecutiveOpportunityHero";
import { ExecutiveAgenda } from "./ExecutiveAgenda";
import { StandingBands } from "./StandingBands";
import { WorldCensusCard } from "./WorldCensusCard";
import { TerritoryMapWidget } from "./TerritoryMapWidget";
import {
  ExecutiveActionCards,
  DomainActionTiles,
  DOMAIN_TILES,
  CATEGORY_STYLE,
} from "./ExecutiveActionCards";
import { ExecutiveRecordFeed } from "./ExecutiveRecordFeed";
import { GOLD_RIM } from "./domain-hue";
import type { DrillSheetKind } from "~/components/mycountry/shell/DrillSheets";
import type { MyCountrySection } from "~/components/mycountry/shell/MyCountrySidebarNav";

export {
  ExecutiveActionCards,
  DomainActionTiles,
  DOMAIN_TILES,
  CATEGORY_STYLE,
  TerritoryMapWidget,
  ExecutiveRecordFeed,
};

function formatCooldownTime(cooldownUntil: number | null | undefined, now = Date.now()): string {
  if (!cooldownUntil) return "Resets next weekly cycle";
  const diffMs = Math.max(0, cooldownUntil - now);
  if (diffMs <= 0) return "Cooldown expiring soon";
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const mins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  const secs = Math.floor((diffMs % (1000 * 60)) / 1000);
  if (days > 0) return `${days}d ${hours}h ${mins}m`;
  if (hours > 0) return `${hours}h ${mins}m ${secs}s`;
  return `${mins}m ${secs}s`;
}

/** Leaf countdown — ticks every second without re-rendering the whole executive home. */
export const CooldownTimer = React.memo(function CooldownTimer({
  cooldownUntil,
}: {
  cooldownUntil: number | null | undefined;
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  return <>{formatCooldownTime(cooldownUntil, now)}</>;
});

/**
 * The v2 rail trigger (c5c6b382): "Declare a new Directive" as a full-width card button with the
 * gold Command badge — or, once the week's directives are spent, a disabled card whose tooltip
 * counts down to the next slot.
 */
function DeclareRailButton({ countryId, onDeclare }: { countryId: string; onDeclare: () => void }) {
  const status = api.intent.getStatus.useQuery({ countryId }, { enabled: !!countryId });
  const canCommit = status.data?.canCommit ?? true;

  if (canCommit) {
    return (
      <button
        type="button"
        onClick={onDeclare}
        className={cn(
          "group bg-surface text-label rounded-card shadow-card text-body relative flex w-full cursor-pointer items-center justify-center gap-3 border p-3 font-semibold select-none",
          "facet-press facet-lift",
          GOLD_RIM,
          focusRing
        )}
      >
        <span
          aria-hidden="true"
          className="facet-gold rounded-control-sm flex size-8 items-center justify-center transition-[scale] duration-150 group-hover:scale-105 motion-reduce:group-hover:scale-100"
        >
          <Command className="size-4" />
        </span>
        <span className="group-hover:text-tint transition-colors">Declare a new Directive</span>
      </button>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {/* A disabled button does not fire pointer events; the wrapper carries the tooltip. */}
        <div className="w-full">
          <button
            type="button"
            disabled
            className="border-separator bg-surface text-label-secondary rounded-card text-body flex w-full cursor-not-allowed items-center justify-center gap-3 border p-3 font-semibold opacity-75"
          >
            <span
              aria-hidden="true"
              className="border-separator bg-fill-3 rounded-control-sm flex size-8 items-center justify-center border"
            >
              <FileClock className="size-4" />
            </span>
            <span>Directive on cooldown</span>
          </button>
        </div>
      </TooltipTrigger>
      <TooltipContent side="left" className="max-w-xs space-y-2 p-3">
        <p className="text-tint text-footnote flex items-center gap-2 font-semibold">
          <Clock aria-hidden="true" className="size-3.5" />
          Executive cooldown active
        </p>
        <p className="text-footnote">
          Your government has issued this week&apos;s directives (
          <span className="font-data tabular-nums">
            {status.data?.usedThisWeek ?? 0}/{status.data?.cap ?? 0}
          </span>
          ).
        </p>
        <p className="border-separator text-footnote flex items-center justify-between gap-3 border-t pt-2">
          <span>Next slot</span>
          <span className="text-tint font-data font-semibold tabular-nums">
            <CooldownTimer cooldownUntil={status.data?.cooldownUntil} />
          </span>
        </p>
      </TooltipContent>
    </Tooltip>
  );
}

export function ExecutiveHomeComponent({
  countryId,
  onDeclare,
  onOpenDrill,
  onOpenIntent,
  onNavigate,
}: {
  countryId: string;
  onDeclare: (prefilled?: string) => void;
  onOpenDrill: (d: DrillSheetKind) => void;
  onOpenIntent: (intentId: string) => void;
  onNavigate?: (section: MyCountrySection) => void;
}) {
  const searchParams = useSearchParams();
  const focusParam = searchParams?.get("focus");

  useEffect(() => {
    if (focusParam === "directives") {
      onDeclare();
    } else if (focusParam === "agenda") {
      const el = document.getElementById("executive-agenda");
      if (el) {
        el.scrollIntoView({ behavior: "smooth" });
      }
    }
  }, [focusParam, onDeclare]);

  const feed = api.mycountry.getCanonFeed.useQuery(
    { countryId, limit: 60 },
    { enabled: !!countryId }
  );

  const items = useMemo(() => feed.data ?? [], [feed.data]);

  // v2 composition (c5c6b382): the priority hero first; then the agenda and the national log,
  // with the rail of national standing, the World Census, the directive trigger and the map.
  return (
    <div className="space-y-6">
      {/* The one thing that most needs the leader's attention */}
      <ExecutiveOpportunityHero
        countryId={countryId}
        onDeclare={onDeclare}
        onNavigate={onNavigate}
        onOpenDrill={onOpenDrill}
        onOpenIntent={onOpenIntent}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main column: agenda, then the national log */}
        <div className="min-w-0 space-y-6 lg:col-span-2">
          <ExecutiveAgenda
            countryId={countryId}
            onIssueDirective={onDeclare}
            onOpenIntent={onOpenIntent}
            onOpenDrill={onOpenDrill}
          />

          <FacetCard role="region" aria-labelledby="recent-activity-title" className="rounded-card">
            <FacetCardHeader className="gap-0.5 p-4 pb-0 sm:p-5 sm:pb-0">
              <h2 id="recent-activity-title" className="text-label text-title-3">
                Recent activity
              </h2>
              <p className="text-label-secondary text-footnote">
                Changes recorded in your national ledger
              </p>
            </FacetCardHeader>
            <FacetCardContent className="p-4 sm:p-5">
              {feed.isLoading ? (
                <div className="space-y-2" aria-busy="true" aria-label="Loading recent activity">
                  {[0, 1, 2, 3].map((i) => (
                    <div key={i} className="flex items-center gap-3 p-2">
                      <Skeleton className="size-4 shrink-0 rounded-xs" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-3.5 w-3/5" />
                        <Skeleton className="h-3 w-2/5" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <ExecutiveRecordFeed items={items} onOpenDrill={onOpenDrill} />
              )}
            </FacetCardContent>
          </FacetCard>
        </div>

        {/* Rail: national standing, rank among peers, the directive trigger and the territory */}
        <aside className="min-w-0 space-y-6" aria-label="National standing, rankings and territory">
          <StandingBands countryId={countryId} />
          <WorldCensusCard countryId={countryId} />
          <DeclareRailButton countryId={countryId} onDeclare={() => onDeclare()} />
          <TerritoryMapWidget countryId={countryId} />
        </aside>
      </div>
    </div>
  );
}

export const ExecutiveHome = React.memo(ExecutiveHomeComponent);
export const V2Home = ExecutiveHome;
