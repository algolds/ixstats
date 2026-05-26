"use client";

import { useMemo } from "react";
import { api } from "~/trpc/react";
import type { MyCountrySection } from "~/components/mycountry/MyCountrySidebarNav";

export type SectionNotifications = Partial<Record<MyCountrySection, number>>;

/**
 * Aggregates notification counts for all MyCountry sidebar sections.
 * Called once in MyCountryRouter and threaded down via props.
 */
export function useMyCountryNotifications(countryId: string | undefined): SectionNotifications {
  const enabled = !!countryId;

  // Executive: pending national issues
  const { data: issueCount } = api.nationalIssues.getPendingCount.useQuery(
    { countryId: countryId! },
    { enabled, refetchInterval: 60_000 }
  );

  // Diplomacy: active missions
  const { data: missions } = api.diplomaticEmbassies.getActiveMissions.useQuery(
    { countryId: countryId! },
    { enabled, refetchInterval: 60_000 }
  );

  // Intelligence: critical alerts
  const { data: intelOverview } = api.intelCore.getOverview.useQuery(
    { countryId: countryId! },
    { enabled, refetchInterval: 60_000 }
  );

  // Defense: active threats
  const { data: securityData } = api.security.getSecurityAssessment.useQuery(
    { countryId: countryId! },
    { enabled, refetchInterval: 60_000 }
  );

  return useMemo(
    (): SectionNotifications => ({
      executive: issueCount?.total ?? 0,
      diplomacy: missions?.length ?? 0,
      intelligence: intelOverview?.alerts?.critical ?? 0,
      defense: (securityData as any)?.activeThreatCount ?? 0,
    }),
    [issueCount, missions, intelOverview, securityData]
  );
}
