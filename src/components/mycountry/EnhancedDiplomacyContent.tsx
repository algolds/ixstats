"use client";

import dynamic from "next/dynamic";
import { Building2 } from "lucide-react";
import { GlobeAltIcon } from "~/components/ui/icons";
import { api } from "~/trpc/react";
import { useFlag } from "~/hooks/useUnifiedFlags";
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
  const { flagUrl } = useFlag(country?.name ?? "");

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

  const activeEmbassies =
    embassies?.filter((e) => e.status === "ACTIVE" || e.status === "active").length ?? 0;
  const totalEmbassies = embassies?.length ?? 0;
  const totalRelations = relations?.length ?? 0;
  const avgStrength =
    totalRelations > 0
      ? Math.round(relations!.reduce((sum, r) => sum + (r.strength ?? 0), 0) / totalRelations)
      : 0;

  const embassyRatio = totalEmbassies > 0 ? activeEmbassies / totalEmbassies : 0;
  const diplomaticHealth = Math.max(0, Math.min(100, Math.round(
    avgStrength * 0.5 + embassyRatio * 30 + Math.min(totalRelations * 2, 20)
  )));

  const heroStats = [
    { label: "Embassies", value: activeEmbassies, accentText: true },
    { label: "Relations", value: totalRelations, accentText: true },
    { label: "Avg", value: `${avgStrength}%`, accentText: true },
  ];

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
          flagUrl={flagUrl}
          stats={heroStats}
          statusBadges={statusBadges}
          health={diplomaticHealth}
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

      {/* Embassy network map — secondary, shown once there's a network to plot */}
      {!isGuided && <DiplomacyMapWidget countryId={country.id} countryName={country.name} />}

      {/* Wiki woven inline */}
      <InlineWiki context="diplomacy" accent="cyan" maxSections={1} />
    </SectionShell>
  );
}
