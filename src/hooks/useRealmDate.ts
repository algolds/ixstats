"use client";

import { useSyncExternalStore } from "react";
import { formatRealmDate, type RealmClock } from "~/lib/realms/realm-clock";

const subscribeMinute = (onChange: () => void) => {
  const id = setInterval(onChange, 60_000);
  return () => clearInterval(id);
};

/**
 * The realm's date, live: re-read each minute from its clock (the label changes only with the day). The server and
 * the hydrating pass show `serverLabel`, the date the server formatted, so they agree; with no clock, the label.
 */
export function useRealmDate(clock: RealmClock | null, serverLabel: string | null): string | null {
  return useSyncExternalStore(
    subscribeMinute,
    () => (clock ? formatRealmDate(clock, Date.now()) : serverLabel),
    () => serverLabel
  );
}
