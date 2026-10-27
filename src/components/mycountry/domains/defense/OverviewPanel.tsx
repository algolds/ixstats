"use client";

import { Skeleton } from "~/components/ui/skeleton";
import { useClockNow, useNationClock } from "~/hooks/useNationClock";
import { useDefenseOverview } from "~/hooks/useDefenseConsole";
import { DefenseOverview } from "./overview/DefenseOverview";
import { DefenseBudgetSection } from "./command";

/** The Overview tab: the nation's defense summary and the Defense budget line. */
export function OverviewPanel({ countryId }: { countryId: string }) {
  const { owner, isLoading } = useDefenseOverview(countryId);
  const reader = useNationClock();
  const now = useClockNow(reader);

  if (isLoading || !owner) {
    return (
      <div className="space-y-3" aria-busy="true" aria-label="Loading defense overview">
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }
  return (
    <div className="space-y-4">
      <DefenseOverview overview={owner} reader={reader} nowClockMs={now ?? owner.clockMs} />
      <DefenseBudgetSection countryId={countryId} />
    </div>
  );
}
