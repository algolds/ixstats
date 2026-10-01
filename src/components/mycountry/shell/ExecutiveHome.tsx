"use client";

import React, { useState, useMemo, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { api } from "~/trpc/react";
import { FacetCard, FacetCardContent, FacetCardHeader } from "~/components/ui/facet-container";
import { Skeleton } from "~/components/ui/skeleton";
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

  return (
    <div className="space-y-6">
      {/* Calm summary of the nation's vitals */}
      <StandingBands countryId={countryId} />

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

        {/* Rail: where the nation stands among its peers, and its territory */}
        <aside className="min-w-0 space-y-6" aria-label="Rankings and territory">
          <WorldCensusCard countryId={countryId} />
          <TerritoryMapWidget countryId={countryId} />
        </aside>
      </div>
    </div>
  );
}

export const ExecutiveHome = React.memo(ExecutiveHomeComponent);
export const V2Home = ExecutiveHome;
