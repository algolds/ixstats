"use client";

import { useState, useEffect, useRef, type ReactNode } from "react";
import { DashboardSidebarLayout } from "./sidebar/DashboardSidebarLayout";
import { NewVersionNotice } from "./NewVersionNotice";
import { UnifiedDashboardSection } from "./sections/UnifiedDashboardSection";
import { DashboardHero } from "./hero/DashboardHero";
import { useUser } from "~/context/auth-context";
import { api } from "~/trpc/react";

interface DashboardRouterProps {
  discordBadge?: ReactNode;
}

export function DashboardRouter({ discordBadge }: DashboardRouterProps) {
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
  const countryId = userProfile?.countryId || "";
  const { data: mapStatus } = api.countries.getMapLinkStatus.useQuery(
    { countryId },
    { enabled: !!countryId, staleTime: 60_000 }
  );

  const appliedDefaultCollapse = useRef(false);
  useEffect(() => {
    if (appliedDefaultCollapse.current || !mapStatus) return;
    appliedDefaultCollapse.current = true;
    if (!mapStatus.isMapped) setHeroCollapsed(true);
  }, [mapStatus]);

  return (
    <DashboardSidebarLayout
      alerts={<NewVersionNotice />}
      heroSection={
        !heroCollapsed ? (
          <DashboardHero collapsed={heroCollapsed} onCollapsedChange={setHeroCollapsed} />
        ) : undefined
      }
      heroCollapsed={heroCollapsed}
      onHeroExpand={() => setHeroCollapsed(false)}
      discordBadge={discordBadge}
      disableCollapse={true}
    >
      <UnifiedDashboardSection globalStats={globalStats} />
    </DashboardSidebarLayout>
  );
}
