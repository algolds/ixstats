"use client";

import dynamic from "next/dynamic";
import { Building2 } from "lucide-react";
import { GlobeAltIcon } from "~/components/ui/icons";
import { api } from "~/trpc/react";
import {
  useCountryData,
  SectionShell,
  CompactSectionHero,
  InlineWiki,
  type StatusBadgeConfig,
} from "./primitives";
import { CrossPillarBanner } from "./primitives/CrossPillarBanner";
import { DiplomacySidebarWidget } from "./sidebar-widgets/DiplomacySidebarWidget";
import { DiplomacyWarRoom } from "~/components/diplomacy/DiplomacyWarRoom";
import { useSectionDensity } from "~/hooks/useSectionDensity";
import type { MyCountrySection } from "./MyCountrySidebarNav";

const DiplomacyMapWidget = dynamic(
  () =>
    import("~/components/maps/widgets/DiplomacyMapWidget").then((m) => ({
      default: m.DiplomacyMapWidget,
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

  const { data: embassies } = api.diplomaticEmbassies.getEmbassies.useQuery(
    { countryId: country?.id ?? "" },
    { enabled: !!country?.id }
  );
  const { data: relations } = api.diplomaticCore.getRelationships.useQuery(
    { countryId: country?.id ?? "" },
    { enabled: !!country?.id }
  );

  // Progressive disclosure: a brand-new country (no embassies/relations) gets a
  // focused, guided view — the War Room's own empty-state CTAs lead the way, and
  // we skip the (empty) map and cross-pillar banner until there's something to show.
  const { isGuided } = useSectionDensity({
    items: (embassies?.length ?? 0) + (relations?.length ?? 0),
  });

  if (isLoading || !country) {
    return null;
  }

  const pendingEmbassies =
    embassies?.filter((e) => e.status === "PENDING" || e.status === "pending").length ?? 0;

  const statusBadges: StatusBadgeConfig[] =
    pendingEmbassies > 0
      ? [
          {
            icon: Building2,
            count: pendingEmbassies,
            colorClass: "border-cyan-500/40 text-cyan-600 dark:text-cyan-400",
          },
        ]
      : [];

  return (
    <SectionShell
      section="diplomacy"
      hero={
        <CompactSectionHero
          section="diplomacy"
          title="Diplomacy"
          subtitle="Embassies, relations & foreign policy"
          icon={GlobeAltIcon}
          countryName={country.name}
          statusBadges={statusBadges}
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

      {/* Embassy network map — meaningful once relations exist */}
      {!isGuided && <DiplomacyMapWidget countryId={country.id} countryName={country.name} />}

      {/* War Room — 3-panel command center (carries the guided empty-state CTAs) */}
      <DiplomacyWarRoom countryId={country.id} />

      {/* Wiki woven inline */}
      <InlineWiki context="diplomacy" accent="cyan" maxSections={1} />
    </SectionShell>
  );
}
