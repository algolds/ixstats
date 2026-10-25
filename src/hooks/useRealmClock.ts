"use client";

import { useMemo } from "react";
import { api } from "~/trpc/react";
import {
  ixnayClockReader,
  realmClockReader,
  type RealmClock,
  type RealmClockReader,
} from "~/lib/realms/realm-clock";
import { DEFAULT_REALM_ID } from "~/lib/realms/realm-ids";
import { useIxTimeStore } from "~/stores/ixtime-store";

/**
 * Ixnay's clock on the client: the IxTime store (bot-synced). The reader changes only when the store's anchor or
 * speed does, not on its per-second tick.
 */
function useIxnayReader(realmId: string, fallback: boolean): RealmClockReader {
  const referenceTimestamp = useIxTimeStore((s) => s.referenceTimestamp);
  const referenceRealTime = useIxTimeStore((s) => s.referenceRealTime);
  const multiplier = useIxTimeStore((s) => (s.isPaused ? 0 : s.multiplier));
  return useMemo(
    () =>
      ixnayClockReader(
        realmId,
        {
          now: () => referenceTimestamp + (Date.now() - referenceRealTime) * multiplier,
          multiplier,
        },
        fallback
      ),
    [realmId, fallback, referenceTimestamp, referenceRealTime, multiplier]
  );
}

/**
 * A realm's clock (realm time design §1): `reader.now()` on the shared timeline, its speed and its calendar
 * (`formatRealmDate(reader.now(), reader.calendar)`). Ixnay (and no realm) reads the IxTime store at once; another
 * realm's clock comes from `realms.region.contextClock`, null until it arrives. `initial` (a clock the page already
 * has, e.g. the realm overview's) skips the fetch. A realm missing its clock, or one the viewer may not see, reads
 * Ixnay's clock. `reader.now()` is not reactive: re-read it on your own tick.
 */
export function useRealmClock(
  realmId: string | null | undefined,
  initial?: RealmClock | null
): RealmClockReader | null {
  const id = realmId ?? DEFAULT_REALM_ID;
  const isIxnay = id === DEFAULT_REALM_ID;
  const { data } = api.realms.region.contextClock.useQuery(
    { realmId: id },
    {
      enabled: !isIxnay && !initial,
      staleTime: 5 * 60_000,
      refetchOnWindowFocus: false,
    }
  );
  const clock = initial ?? data?.clock ?? null;
  const loaded = isIxnay || !!initial || data !== undefined;
  const ixnay = useIxnayReader(id, !isIxnay && loaded && !clock);
  const realm = useMemo(() => (clock ? realmClockReader(id, clock) : null), [id, clock]);
  if (!loaded) return null;
  return realm ?? ixnay;
}

/**
 * A nation's clock: its realm's (`useRealmClock`). Null while the country (or its realm's clock) is loading; a
 * country without a realm id reads Ixnay's.
 */
export function useCountryClock(
  country: { realmId?: string | null } | null | undefined
): RealmClockReader | null {
  const reader = useRealmClock(country?.realmId);
  return country ? reader : null;
}
