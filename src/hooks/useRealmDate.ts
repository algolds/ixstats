"use client";

import { useSyncExternalStore } from "react";
import { formatRealmDate, type RealmClockReader } from "~/lib/realms/realm-clock";

const subscribeMinute = (onChange: () => void) => {
  const id = setInterval(onChange, 60_000);
  return () => clearInterval(id);
};

/**
 * The realm's date in its calendar, live: re-read each minute from its clock (`useRealmClock`; the label changes
 * only with the day). The server and the hydrating pass show `serverLabel`, the date the server formatted, so they
 * agree; so does a clock still loading.
 */
export function useRealmDate(
  reader: RealmClockReader | null,
  serverLabel: string | null
): string | null {
  return useSyncExternalStore(
    subscribeMinute,
    () => (reader ? formatRealmDate(reader.now(), reader.calendar) : serverLabel),
    () => serverLabel
  );
}
