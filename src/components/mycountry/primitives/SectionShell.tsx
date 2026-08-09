"use client";

import React, { useEffect, useRef, type ReactNode } from "react";
import { MyCountrySidebarLayout } from "~/components/mycountry/MyCountrySidebarLayout";
import type { MyCountrySection } from "~/components/mycountry/MyCountrySidebarNav";
import { useCountryData } from "./CountryDataProvider";
import { OverviewHero } from "../OverviewHero";
import { api } from "~/trpc/react";
import { useHeroCollapsed } from "~/hooks/useHeroCollapsed";

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
  v2?: boolean;
  onIssueDirective?: () => void;
  agendaViewMode?: "widgets" | "stack";
  onAgendaViewModeChange?: (mode: "widgets" | "stack") => void;
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
  v2 = false,
  onIssueDirective,
  agendaViewMode,
  onAgendaViewModeChange,
}: SectionShellProps) {
  const { country } = useCountryData();

  // Hero collapse — persisted per country; v2 defaults to collapsed (actions-first).
  const {
    collapsed: heroCollapsed,
    setCollapsed: persistCollapsed,
    hasStoredPref,
  } = useHeroCollapsed(v2, country?.id);

  // v1 legacy: collapse by default for a valid-but-unmapped country. Applied once
  // and only when the user hasn't recorded a preference; never fights a stored choice.
  const { data: mapStatus } = api.countries.getMapLinkStatus.useQuery(
    { countryId: country?.id ?? "" },
    { enabled: !!country?.id }
  );
  const appliedDefaultCollapse = useRef(false);
  useEffect(() => {
    if (appliedDefaultCollapse.current || hasStoredPref || v2 || !mapStatus) return;
    appliedDefaultCollapse.current = true;
    if (!mapStatus.isMapped) persistCollapsed(true);
  }, [mapStatus, v2, persistCollapsed, hasStoredPref]);

  // Fallback to standard OverviewHero if no custom hero is passed
  const finalHero =
    hero ??
    (country?.id ? (
      <OverviewHero
        collapsed={heroCollapsed}
        onCollapsedChange={persistCollapsed}
        countryId={country.id}
        onNavigate={onNavigate}
        v2={v2}
        onIssueDirective={onIssueDirective}
        agendaViewMode={agendaViewMode}
        onAgendaViewModeChange={onAgendaViewModeChange}
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
