"use client";

import dynamic from "next/dynamic";
import { Building2 } from "lucide-react";
import { GlobeAltIcon } from "~/components/ui/icons";
import { useCountryData, SectionHero } from "./primitives";
import type { StatusBadgeConfig } from "./primitives";
import { api } from "~/trpc/react";
import { MyCountrySidebarLayout } from "./MyCountrySidebarLayout";
import { DiplomacySidebarWidget } from "./sidebar-widgets/DiplomacySidebarWidget";
import { WikiLoreBlock } from "./primitives/WikiLoreBlock";
import { CrossPillarBanner } from "./primitives/CrossPillarBanner";
import { DiplomacyWarRoom } from "~/components/diplomacy/DiplomacyWarRoom";

const DiplomacyMapWidget = dynamic(
  () =>
    import("~/components/maps/widgets/DiplomacyMapWidget").then((m) => ({
      default: m.DiplomacyMapWidget,
    })),
  { ssr: false, loading: () => <div className="bg-muted h-64 animate-pulse rounded-xl" /> }
);

import type { MyCountrySection } from "./MyCountrySidebarNav";

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
    <MyCountrySidebarLayout
      heroSection={
        <SectionHero
          context="diplomacy"
          sectionTitle="Diplomatic Operations"
          sectionSubtitle="Diplomatic Operations & International Relations"
          sectionIcon={GlobeAltIcon}
          accentColor="cyan"
          countryName={country.name}
          statusBadges={statusBadges}
        />
      }
      sidebarExtra={<DiplomacySidebarWidget countryId={country.id} />}
      activeSection={activeSection}
      onNavigate={onNavigate}
      notifications={notifications}
    >


      {/* Cross-Pillar Effects */}
      <CrossPillarBanner section="diplomacy" countryId={country.id} onNavigate={onNavigate} />

      {/* Embassy Network Map */}
      <DiplomacyMapWidget countryId={country.id} countryName={country.name} />

      {/* War Room — 3-panel command center */}
      <DiplomacyWarRoom countryId={country.id} />

      <WikiLoreBlock context="diplomacy" themeColor="cyan" title="Diplomatic Lore" />
    </MyCountrySidebarLayout>
  );
}
