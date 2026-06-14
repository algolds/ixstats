"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { CountryFeatureSheet } from "./CountryFeatureSheet";
import type { CountryMapFeature } from "~/components/maps/widgets/CountryMapEmbed";
import { useCountryData, SectionShell, InlineWiki } from "./primitives";
import { api } from "~/trpc/react";
import { CrossPillarBanner } from "./primitives/CrossPillarBanner";
import { DiplomacySidebarWidget } from "./sidebar-widgets/DiplomacySidebarWidget";
import { DiplomacyWarRoom } from "~/components/diplomacy/DiplomacyWarRoom";
import { useSectionDensity } from "~/hooks/useSectionDensity";
import type { MyCountrySection } from "./MyCountrySidebarNav";

const DashboardMapWidget = dynamic(
  () =>
    import("~/components/maps/widgets/DashboardMapWidget").then((m) => ({
      default: m.DashboardMapWidget,
    })),
  { ssr: false, loading: () => <div className="bg-muted h-64 animate-pulse rounded-xl" /> }
);

interface EnhancedDiplomacyContentProps {
  activeSection?: MyCountrySection;
  onNavigate?: (section: MyCountrySection) => void;
  notifications?: Partial<Record<string, number>>;
}

export function EnhancedDiplomacyContent({
  activeSection,
  onNavigate,
  notifications,
}: EnhancedDiplomacyContentProps) {
  const { country, isLoading } = useCountryData();
  const [selectedFeature, setSelectedFeature] = useState<CountryMapFeature | null>(null);

  const { data: rawEmbassies } = api.diplomaticEmbassies.getEmbassies.useQuery(
    { countryId: country?.id ?? "" },
    { enabled: !!country?.id }
  );
  const { data: diplomaticRelations } = api.diplomaticCore.getRelationships.useQuery(
    { countryId: country?.id ?? "" },
    { enabled: !!country?.id }
  );
  const embassies = rawEmbassies ?? [];
  const relations = diplomaticRelations ?? [];

  // Progressive disclosure: a brand-new country (no embassies/relations) gets a
  // focused, guided view — the War Room's own empty-state CTAs lead the way, and
  // we skip the (empty) map and cross-pillar banner until there's something to show.
  const { isGuided } = useSectionDensity({
    items: (embassies.length ?? 0) + (relations.length ?? 0),
  });

  if (isLoading || !country) {
    return null;
  }

  return (
    <SectionShell
      section="diplomacy"
      hero={
        <DashboardMapWidget
          countryId={country.id}
          viewMode="diplomacy"
          onFeatureClick={setSelectedFeature}
        />
      }
      contextWidget={<DiplomacySidebarWidget countryId={country.id} />}
      activeSection={activeSection}
      onNavigate={onNavigate}
      notifications={notifications}
    >
      {!isGuided && (
        <CrossPillarBanner section="diplomacy" countryId={country.id} onNavigate={onNavigate} />
      )}

      {/* War Room — 3-panel command center (leads; carries the guided empty-state CTAs) */}
      <DiplomacyWarRoom countryId={country.id} />

      {/* Wiki woven inline */}
      <InlineWiki context="diplomacy" accent="cyan" maxSections={1} />

      {/* Click-to-manage feature sheet (city / subdivision attributes) */}
      <CountryFeatureSheet
        countryId={country.id}
        feature={selectedFeature}
        onClose={() => setSelectedFeature(null)}
      />
    </SectionShell>
  );
}
