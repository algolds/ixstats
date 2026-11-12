"use client";

import React, { useMemo, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { api } from "~/trpc/react";
import { Skeleton } from "~/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Clock } from "iconoir-react";
import { CrisisSignal } from "./CrisisSignal";
import { ExecutiveOpportunityHero } from "./ExecutiveOpportunityHero";
import { ExecutiveAgenda } from "./ExecutiveAgenda";
import { ExecutiveRecordFeed } from "./ExecutiveRecordFeed";
import { IntelligenceAlertsCard } from "./IntelligenceAlertsCard";
import { FirstStepsCard } from "./FirstStepsCard";
import type { DrillSheetKind } from "~/components/mycountry/shell/DrillSheets";

/**
 * The Overview panel under the command document: the signals that need the owner (crisis, first
 * steps, the priority, open intelligence alerts), then the agenda beside recent activity.
 * Standing and territory live on the command face; the sections live on its ribbon.
 */
function ExecutiveHomeComponent({
  countryId,
  onDeclare,
  onOpenDrill,
  onOpenIntent,
}: {
  countryId: string;
  onDeclare: (prefilled?: string) => void;
  onOpenDrill: (d: DrillSheetKind) => void;
  onOpenIntent: (intentId: string) => void;
}) {
  const searchParams = useSearchParams();
  const focusParam = searchParams?.get("focus");

  useEffect(() => {
    if (!focusParam) return;
    if (focusParam === "directives") {
      onDeclare();
    } else if (focusParam === "agenda") {
      document.getElementById("executive-agenda")?.scrollIntoView({ behavior: "smooth" });
    }
    // Consume the param so returning home doesn't act on it again.
    const url = new URL(window.location.href);
    url.searchParams.delete("focus");
    window.history.replaceState(window.history.state, "", url);
  }, [focusParam, onDeclare]);

  const feed = api.mycountry.getCanonFeed.useQuery(
    { countryId, limit: 60 },
    { enabled: !!countryId }
  );

  const items = useMemo(() => feed.data ?? [], [feed.data]);

  return (
    <div className="space-y-6">
      <CrisisSignal countryId={countryId} />
      <FirstStepsCard countryId={countryId} />
      <ExecutiveOpportunityHero
        countryId={countryId}
        onOpenDrill={onOpenDrill}
        onOpenIntent={onOpenIntent}
      />

      <IntelligenceAlertsCard countryId={countryId} onOpenDrill={onOpenDrill} />

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="min-w-0">
          <ExecutiveAgenda
            countryId={countryId}
            onOpenIntent={onOpenIntent}
            onOpenDrill={onOpenDrill}
          />
        </div>

        <Card
          role="region"
          content="feed"
          aria-labelledby="recent-activity-title"
          className="min-w-0"
        >
          <CardHeader className="p-4 pb-0 sm:p-5 sm:pb-0">
            <CardTitle id="recent-activity-title" icon={<Clock />} role="heading" aria-level={2}>
              Recent activity
            </CardTitle>
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
    </div>
  );
}

export const ExecutiveHome = React.memo(ExecutiveHomeComponent);
