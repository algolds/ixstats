"use client";

import React, { useMemo, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { api } from "~/trpc/react";
import { Skeleton } from "~/components/ui/skeleton";
import { CrisisSignal } from "./CrisisSignal";
import { ExecutiveOpportunityHero } from "./ExecutiveOpportunityHero";
import { ExecutiveAgenda } from "./ExecutiveAgenda";
import { StandingBands } from "./StandingBands";
import { TerritoryMapWidget } from "./TerritoryMapWidget";
import { ExecutiveRecordFeed } from "./ExecutiveRecordFeed";
import { DomainPeeksCard } from "./DomainPeeksCard";
import { IntelligenceAlertsCard } from "./IntelligenceAlertsCard";
import type { DrillSheetKind } from "~/components/mycountry/shell/DrillSheets";
import { Card, CardContent, CardHeader } from "~/components/ui/card";

function ExecutiveHomeComponent({
  countryId,
  onDeclare,
  onNavigate,
  onOpenDrill,
  onOpenIntent,
}: {
  countryId: string;
  onDeclare: (prefilled?: string) => void;
  onNavigate?: (section: string) => void;
  onOpenDrill: (d: DrillSheetKind) => void;
  onOpenIntent: (intentId: string) => void;
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
      <CrisisSignal countryId={countryId} />
      <ExecutiveOpportunityHero
        countryId={countryId}
        onOpenDrill={onOpenDrill}
        onOpenIntent={onOpenIntent}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="min-w-0 space-y-6 lg:col-span-2">
          <ExecutiveAgenda
            countryId={countryId}
            onOpenIntent={onOpenIntent}
            onOpenDrill={onOpenDrill}
          />

          <Card role="region" aria-labelledby="recent-activity-title">
            <CardHeader className="p-4 pb-0 sm:p-5 sm:pb-0">
              <h2 id="recent-activity-title" className="text-label text-title-3">
                Recent activity
              </h2>
            </CardHeader>
            <CardContent className="p-4 sm:p-5">
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
            </CardContent>
          </Card>
        </div>

        {/* Rail: open intelligence alerts, national standing, domain quick actions and the territory */}
        <aside
          className="min-w-0 space-y-6"
          aria-label="Intelligence alerts, national standing, domains and territory"
        >
          <IntelligenceAlertsCard countryId={countryId} onOpenDrill={onOpenDrill} />
          <StandingBands countryId={countryId} />
          <DomainPeeksCard onNavigate={onNavigate} />
          <TerritoryMapWidget countryId={countryId} />
        </aside>
      </div>
    </div>
  );
}

export const ExecutiveHome = React.memo(ExecutiveHomeComponent);
