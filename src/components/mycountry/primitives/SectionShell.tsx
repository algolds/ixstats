"use client";

import type { ReactNode } from "react";
import { MyCountrySidebarLayout } from "~/components/mycountry/MyCountrySidebarLayout";
import type { MyCountrySection } from "~/components/mycountry/MyCountrySidebarNav";

interface SectionShellProps {
  /** Which section this shell renders (defaults the active nav state). */
  section: MyCountrySection;
  /** The section hero — CompactSectionHero for sections, big HeroSection for home. */
  hero: ReactNode;
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
 * through. Thin, opinionated wrapper over MyCountrySidebarLayout that enforces
 * the unified pattern: compact hero + nav rail + context widget + content.
 * Keeps the existing single-page router / URL sync untouched.
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
  return (
    <MyCountrySidebarLayout
      heroSection={hero}
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
