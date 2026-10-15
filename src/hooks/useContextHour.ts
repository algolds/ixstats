"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { api } from "~/trpc/react";
import { useHydrated } from "~/hooks/useHydrated";
import { stripBasePath } from "~/lib/base-path";
import { realmCalendarMs } from "~/lib/realms/realm-clock";
import { clockContextForPath } from "~/lib/time/clock-context";
import { isStandaloneClient } from "~/lib/system/standalone-detection";
import { useIxTimeStore } from "~/stores/ixtime-store";

/**
 * The hour a greeting goes by: inside a realm, its clock (its calendar's hour; global IxTime for Ixnay and realms
 * without their own clock); outside realms, the viewer's real local hour. Null until hydrated, so the server render
 * and the hydrating pass agree.
 */
export function useContextHour(): number | null {
  const pathname = stripBasePath(usePathname() ?? "/");
  const realmParam = useSearchParams()?.get("realm") ?? null;
  const hydrated = useHydrated();
  // The maps host is known only in the browser; nothing depends on it before hydration (the hour is null).
  const context = clockContextForPath(pathname, realmParam, hydrated && isStandaloneClient());
  const { kind: _kind, ...input } = context;
  const { data } = api.realms.region.contextClock.useQuery(input, {
    enabled: hydrated && context.kind === "realm",
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });
  const clock = data?.clock ?? null;
  // The selector runs on every store tick (each second) but returns only the hour, so the caller re-renders
  // only when the hour changes.
  const hour = useIxTimeStore((s) => {
    if (context.kind === "real") return new Date().getHours();
    if (clock) return new Date(realmCalendarMs(clock, Date.now())).getUTCHours();
    return new Date(s.ixTimeTimestamp).getUTCHours();
  });
  return hydrated ? hour : null;
}
