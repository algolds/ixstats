"use client";

import { useState, useEffect, useRef } from "react";
import { DashboardColumn } from "./DashboardColumn";
import { UnifiedDashboardSection } from "./sections/UnifiedDashboardSection";
import { DashboardHero } from "./hero/DashboardHero";
import { useUser } from "~/context/auth-context";
import { api } from "~/trpc/react";

interface DashboardRouterProps {
  /** Country id resolved on the server, used until getProfile loads so map status fetches in parallel. */
  initialCountryId?: string;
}

export function DashboardRouter({ initialCountryId = "" }: DashboardRouterProps) {
  const { data: globalStats } = api.countries.getGlobalStats.useQuery(undefined, {
    staleTime: 300_000,
  });
  const [heroCollapsed, setHeroCollapsed] = useState(false);

  useEffect(() => {
    document.title = "Dashboard - IxStats";
  }, []);

  // Collapse the hero by default for a valid-but-unmapped country. Applied once
  // when the map status resolves; never fights the user's later expand/collapse.
  const { user } = useUser();
  const { data: userProfile } = api.users.getProfile.useQuery(undefined, {
    enabled: !!user?.id,
    staleTime: 60_000,
  });
  const countryId: string = (userProfile ? userProfile.countryId : initialCountryId) || "";
  const { data: mapStatus } = api.countries.getMapLinkStatus.useQuery(
    { countryId },
    { enabled: !!countryId && countryId.trim() !== "", staleTime: 60_000 }
  );

  const appliedDefaultCollapse = useRef(false);
  useEffect(() => {
    if (appliedDefaultCollapse.current || !mapStatus) return;
    appliedDefaultCollapse.current = true;
    // oxlint-disable-next-line
    if (!mapStatus.isMapped) setHeroCollapsed(true);
  }, [mapStatus]);

  return (
    <DashboardColumn
      heroSection={
        !heroCollapsed ? (
          <DashboardHero collapsed={heroCollapsed} onCollapsedChange={setHeroCollapsed} />
        ) : undefined
      }
    >
      <UnifiedDashboardSection globalStats={globalStats} />
    </DashboardColumn>
  );
}
