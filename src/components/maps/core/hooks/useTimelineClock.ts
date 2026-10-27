"use client";

import { api } from "~/trpc/react";
import { useRealmClock } from "~/hooks/useRealmClock";
import type { RealmClockReader } from "~/lib/realms/realm-clock";

/** The history range query the scrubber, the historical layers and the welcome notes share (one cache entry). */
export function useHistoryRange(realm: string | undefined) {
  return api.geoCore.getHistoryRange.useQuery(
    { realm },
    { staleTime: 5 * 60_000, gcTime: 30 * 60_000 }
  );
}

/**
 * The clock of the realm the map shows (`?realm=` slug, or the viewer's realm): the timeline's dates read in its
 * calendar. The realm's id comes with the history range. Null until both have loaded.
 */
export function useTimelineClock(realm: string | undefined): RealmClockReader | null {
  const { data: range } = useHistoryRange(realm);
  const reader = useRealmClock(range?.realmId);
  return range ? reader : null;
}
