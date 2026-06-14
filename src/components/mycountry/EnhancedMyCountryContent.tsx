"use client";

// eslint-disable-next-line unused-imports/no-unused-imports
import { useState } from "react";
import dynamic from "next/dynamic";
import { useCountryData, SectionShell, InlineWiki } from "./primitives";
// eslint-disable-next-line unused-imports/no-unused-imports
import { AgendaBar } from "./PillarCards";
// eslint-disable-next-line unused-imports/no-unused-imports
import { OverviewHero } from "./OverviewHero";
import { OverviewSidebarWidget } from "./sidebar-widgets/OverviewSidebarWidget";
import { SetupChecklist } from "./SetupChecklist";
import type { MyCountrySection } from "./MyCountrySidebarNav";

// Dynamic import — MyCountryTabSystem is heavy with recharts/modal imports.
const MyCountryTabSystem = dynamic(
  () => import("./MyCountryTabSystem").then((m) => ({ default: m.MyCountryTabSystem })),
  { ssr: false }
);

interface EnhancedMyCountryContentProps {
  variant?: "unified" | "standard" | "premium";
  activeSection?: MyCountrySection;
  onNavigate?: (section: MyCountrySection) => void;
  notifications?: Partial<Record<string, number>>;
}

export function EnhancedMyCountryContent({
  variant = "unified",
  activeSection,
  onNavigate,
  notifications,
}: EnhancedMyCountryContentProps) {
  const { country, isLoading } = useCountryData();

  if (isLoading || !country) {
    return null; // Loading handled by AuthenticationGuard
  }

  return (
    <SectionShell
      section="overview"
      contextWidget={<OverviewSidebarWidget countryId={country.id} />}
      activeSection={activeSection}
      onNavigate={onNavigate}
      notifications={notifications}
    >
      {/* New-player onboarding — self-hides once established */}
      {country?.id && <SetupChecklist countryId={country.id} onNavigate={onNavigate} />}

      {/* Economy & Government tabs */}
      <div id="tabs">
        <MyCountryTabSystem variant={variant} />
      </div>

      {/* Inline Wiki woven at the bottom */}
      <InlineWiki context="overview" accent="amber" maxSections={1} />
    </SectionShell>
  );
}
