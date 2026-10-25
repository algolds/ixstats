"use client";

import { createContext, useCallback, useContext, useSyncExternalStore } from "react";
import type { RealmClockReader } from "~/lib/realms/realm-clock";
import { useCountryClock } from "~/hooks/useRealmClock";

const NationClockContext = createContext<RealmClockReader | null | undefined>(undefined);

/** Shares the clock of the nation in view with everything below (`CountryDataProvider` sets it). */
export const NationClockProvider = NationClockContext.Provider;

/**
 * The clock of the nation in view (realm time design §1): `country`'s realm clock when it carries its realm id (a
 * view of one specific nation, e.g. the map's country panel), else the nearest `NationClockProvider`'s. Null while
 * it loads, or outside any nation: show "–" or a skeleton then, never another clock's date.
 */
export function useNationClock(
  country?: { realmId?: string | null } | null
): RealmClockReader | null {
  const shared = useContext(NationClockContext);
  const own = typeof country?.realmId === "string" ? country : null;
  const fromCountry = useCountryClock(own);
  return own ? fromCountry : (shared ?? null);
}

/**
 * `reader.now()` re-read every `stepMs` real ms and quantised to `stepMs` of clock time, so derivations keyed on it
 * re-run once a step, not every render. Null while the clock loads (and on the server).
 */
export function useClockNow(reader: RealmClockReader | null, stepMs = 60_000): number | null {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const id = setInterval(onChange, stepMs);
      return () => clearInterval(id);
    },
    [stepMs]
  );
  return useSyncExternalStore(
    subscribe,
    () => (reader ? Math.floor(reader.now() / stepMs) * stepMs : null),
    () => null
  );
}
