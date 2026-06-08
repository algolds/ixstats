"use client";

import React, { useState, type ReactNode } from "react";
import { MyCountrySidebarLayout } from "~/components/mycountry/MyCountrySidebarLayout";
import type { MyCountrySection } from "~/components/mycountry/MyCountrySidebarNav";
import { useCountryData } from "./CountryDataProvider";
import { OverviewHero } from "../OverviewHero";
import { AgendaBar } from "../PillarCards";

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

  // Fallback to standard OverviewHero if no custom hero is passed
  const finalHero = hero ?? (country?.id ? (
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
      {/* Daily Agenda Bar — actionable national issues & tasks */}
      {country?.id && onNavigate && (
        <AgendaBar
          countryId={country.id}
          onNavigate={onNavigate}
          activeSection={activeSection ?? section}
        />
      )}

      {children}
    </MyCountrySidebarLayout>
  );
}
