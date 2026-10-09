"use client";

import { useState, useEffect, useRef } from "react";
import { DashboardColumn } from "./DashboardColumn";
import { UnifiedDashboardSection } from "./sections/UnifiedDashboardSection";
import { AccountsSection } from "./accounts/AccountsSection";
import { DashboardHero } from "./hero/DashboardHero";
import { useUser } from "~/context/auth-context";
import { api } from "~/trpc/react";
import type { DashboardSection } from "~/lib/dashboard-sections";

interface DashboardRouterProps {
  /** Country id resolved on the server, used until getProfile loads so map status fetches in parallel. */
  initialCountryId?: string;
  /** The section on screen (useDashboardSection owns it). */
  section?: DashboardSection;
  /** Switches the section in place. */
  onNavigate?: (section: DashboardSection) => void;
}

export function DashboardRouter({
  initialCountryId = "",
  section = "home",
  onNavigate,
}: DashboardRouterProps) {
  const { data: globalStats } = api.countries.getGlobalStats.useQuery(undefined, {
    enabled: section === "home",
    staleTime: 300_000,
  });
  const [heroCollapsed, setHeroCollapsed] = useState(false);

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
        section === "home" && !heroCollapsed ? (
          <DashboardHero collapsed={heroCollapsed} onCollapsedChange={setHeroCollapsed} />
        ) : undefined
      }
    >
      {section === "accounts" ? (
        <AccountsSection initialCountryId={initialCountryId} onBack={() => onNavigate?.("home")} />
      ) : (
        <UnifiedDashboardSection
          globalStats={globalStats}
          onOpenAccounts={() => onNavigate?.("accounts")}
        />
      )}
    </DashboardColumn>
  );
}
