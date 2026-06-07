"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { useCountryData, SectionShell, InlineWiki } from "./primitives";
import { AgendaBar } from "./PillarCards";
import { OverviewHero } from "./OverviewHero";
import { OverviewSidebarWidget } from "./sidebar-widgets/OverviewSidebarWidget";
import { SetupChecklist } from "./SetupChecklist";
import { CountryFeatureSheet } from "./CountryFeatureSheet";
import type { MyCountrySection } from "./MyCountrySidebarNav";
import type { CountryMapFeature } from "~/components/maps/widgets/CountryMapEmbed";

// Dynamic import — MyCountryTabSystem is heavy with recharts/modal imports.
const MyCountryTabSystem = dynamic(
  () => import("./MyCountryTabSystem").then((m) => ({ default: m.MyCountryTabSystem })),
  { ssr: false }
);

// Shared interactive map embed (tier-0 surface). Heavy MapLibre import → client-only.
const DashboardMapWidget = dynamic(
  () =>
    import("~/components/maps/widgets/DashboardMapWidget").then((m) => ({
      default: m.DashboardMapWidget,
    })),
  { ssr: false, loading: () => <div className="bg-muted h-64 animate-pulse rounded-xl" /> }
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
  const [heroCollapsed, setHeroCollapsed] = useState(false);
  const [selectedFeature, setSelectedFeature] = useState<CountryMapFeature | null>(null);

  if (isLoading || !country) {
    return null; // Loading handled by AuthenticationGuard
  }

  return (
    <SectionShell
      section="overview"
      hero={
        <OverviewHero
          collapsed={heroCollapsed}
          onCollapsedChange={setHeroCollapsed}
          countryId={country.id}
          onNavigate={onNavigate}
        />
      }
      contextWidget={<OverviewSidebarWidget countryId={country.id} />}
      activeSection={activeSection}
      onNavigate={onNavigate}
      notifications={notifications}
    >
      {/* New-player onboarding — self-hides once established */}
      {country?.id && <SetupChecklist countryId={country.id} onNavigate={onNavigate} />}

      {/* Daily Agenda Bar — actionable national issues & tasks */}
      {onNavigate && (
        <AgendaBar countryId={country.id} onNavigate={onNavigate} activeSection={activeSection} />
      )}

      {/* Tier-0 interactive map — click a city/subdivision to manage it */}
      <DashboardMapWidget
        countryId={country.id}
        viewMode="overview"
        onFeatureClick={setSelectedFeature}
      />

      {/* Economy & Government tabs */}
      <div id="tabs">
        <MyCountryTabSystem variant={variant} />
      </div>

      {/* Inline Wiki woven at the bottom */}
      <InlineWiki context="overview" accent="amber" maxSections={1} />

      {/* Click-to-manage feature sheet (city / subdivision attributes) */}
      <CountryFeatureSheet
        countryId={country.id}
        feature={selectedFeature}
        onClose={() => setSelectedFeature(null)}
      />
    </SectionShell>
  );
}
