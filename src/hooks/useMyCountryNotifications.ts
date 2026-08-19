"use client";

import { useMemo } from "react";
import { api } from "~/trpc/react";
import type { MyCountrySection } from "~/components/mycountry/shell/MyCountrySidebarNav";
import { useVisibleRefetch } from "./useVisibleRefetch";

export type SectionNotifications = Partial<Record<MyCountrySection, number>>;

/**
 * Aggregates notification counts for all MyCountry sidebar sections.
 * Consolidated into a single batch query + visibility-aware polling.
 */
export function useMyCountryNotifications(countryId: string | undefined): SectionNotifications {
  const enabled = !!countryId;
  const refetchInterval = useVisibleRefetch(60_000);

  const { data } = api.mycountry.getNotificationCounts.useQuery(
    { countryId: countryId ?? "" },
    { enabled, refetchInterval }
  );

  return useMemo(
    (): SectionNotifications => ({
      executive: data?.executive ?? 0,
      diplomacy: data?.diplomacy ?? 0,
      intelligence: data?.intelligence ?? 0,
      defense: data?.defense ?? 0,
    }),
    [data]
  );
}
