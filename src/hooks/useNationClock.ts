"use client";

import { createContext, useCallback, useContext, useSyncExternalStore } from "react";
import type { RealmClockReader } from "~/lib/realms/realm-clock";
import { useCountryClock, useRealmClock } from "~/hooks/useRealmClock";
import { useViewerRealmId } from "~/hooks/useViewerRealmId";

const NationClockContext = createContext<RealmClockReader | null | undefined>(undefined);

/** Shares the clock of the nation in view with everything below (`CountryDataProvider` sets it). */
export const NationClockProvider = NationClockContext.Provider;

/**
 * The clock of the nation in view (realm time design §1): the nearest `NationClockProvider`'s (`CountryDataProvider`
 * in MyCountry and on country pages). Null while it loads, or outside any nation: show "–" or a skeleton then,
 * never another clock's date.
 */
export function useNationClock(): RealmClockReader | null {
  return useContext(NationClockContext) ?? null;
}

/**
 * The clock of one specific nation (e.g. the map's country panel): its realm's clock when it carries its realm id,
 * else the provider's (`useNationClock`).
 */
export function useNationClockFor(
  country: { realmId?: string | null } | null | undefined
): RealmClockReader | null {
  const shared = useNationClock();
  const own = typeof country?.realmId === "string" ? country : null;
  const fromCountry = useCountryClock(own);
  return own ? fromCountry : shared;
}

/**
 * The clock of the viewer's own nation (its realm's; Ixnay without one), for what they act on as their nation from
 * any page, e.g. scheduling a meeting from another country's profile. Null while their profile loads.
 */
export function useViewerNationClock(): RealmClockReader | null {
  const realmId = useViewerRealmId();
  const reader = useRealmClock(realmId);
  return realmId === undefined ? null : reader;
}

/**
 * `reader.now()` re-read every `stepMs` real ms and quantised to `stepMs` of clock time, so derivations keyed on it
 * re-run once a step, not every render. Null only while the clock loads.
 */
export function useClockNow(reader: RealmClockReader | null, stepMs = 60_000): number | null {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const id = setInterval(onChange, stepMs);
      return () => clearInterval(id);
    },
    [stepMs]
  );
  const read = () => (reader ? Math.floor(reader.now() / stepMs) * stepMs : null);
  return useSyncExternalStore(subscribe, read, read);
}
