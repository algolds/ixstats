"use client";

import React, { useEffect, useRef, useState, type ReactNode } from "react";
import { MyCountrySidebarLayout } from "~/components/mycountry/MyCountrySidebarLayout";
import type { MyCountrySection } from "~/components/mycountry/MyCountrySidebarNav";
import { useCountryData } from "./CountryDataProvider";
import { OverviewHero } from "../OverviewHero";
import { api } from "~/trpc/react";

interface SectionShellProps {
  /** Which section this shell renders (defaults the active nav state). */
  section: MyCountrySection;
  /** The section hero — defaults to standardized OverviewHero if omitted. */
  hero?: ReactNode;
  /** The unified left context widget (quick-stats + activity). Optional. */
  contextWidget?: ReactNode;
  /** Alerts/banners rendered above the content. */
  alerts?: ReactNode;
  /** Router controlled-mode passthroughs (instant section switching). */
  activeSection?: MyCountrySection;
  onNavigate?: (section: MyCountrySection) => void;
  notifications?: Partial<Record<string, number>>;
  /** The section's primary content (War Room canvas or tabs). */
  children: ReactNode;
}

/**
 * SectionShell — the single canonical layout every MyCountry section renders
 * through. Enforces the unified pattern: dynamic map/hero + daily agenda + content.
 */
export function SectionShell({
  section,
  hero,
  contextWidget,
  alerts,
  activeSection,
  onNavigate,
  notifications,
  children,
}: SectionShellProps) {
  const { country } = useCountryData();
  const [heroCollapsed, setHeroCollapsed] = useState(false);

  // Collapse the hero by default for a valid-but-unmapped country. Applied once
  // when the map status resolves; never fights the user's later expand/collapse.
  const { data: mapStatus } = api.countries.getMapLinkStatus.useQuery(
    { countryId: country?.id ?? "" },
    { enabled: !!country?.id }
  );
  const appliedDefaultCollapse = useRef(false);
  useEffect(() => {
    if (appliedDefaultCollapse.current || !mapStatus) return;
    appliedDefaultCollapse.current = true;
    if (!mapStatus.isMapped) setHeroCollapsed(true);
  }, [mapStatus]);

  // Fallback to standard OverviewHero if no custom hero is passed
  const finalHero =
    hero ??
    (country?.id ? (
      <OverviewHero
        collapsed={heroCollapsed}
        onCollapsedChange={setHeroCollapsed}
        countryId={country.id}
        onNavigate={onNavigate}
      />
    ) : null);

  return (
    <MyCountrySidebarLayout
      heroSection={finalHero}
      sidebarExtra={contextWidget}
      alerts={alerts}
      activeSection={activeSection ?? section}
      onNavigate={onNavigate}
      notifications={notifications}
    >
      {children}
    </MyCountrySidebarLayout>
  );
}
