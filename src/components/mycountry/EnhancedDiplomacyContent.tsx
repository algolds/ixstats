"use client";

import { useMemo } from "react";
import dynamic from "next/dynamic";
import { Globe, Building2, Handshake, Sparkles } from "lucide-react";
import { GlobeAltIcon } from "~/components/ui/icons";
import { useCountryData, VitalityRings, SectionHero } from "./primitives";
import type { RingConfig, StatusBadgeConfig } from "./primitives";
import { api } from "~/trpc/react";
import { MyCountrySidebarLayout } from "./MyCountrySidebarLayout";
import { DiplomacySidebarWidget } from "./sidebar-widgets/DiplomacySidebarWidget";
import { WikiLoreBlock } from "./primitives/WikiLoreBlock";
import { CrossPillarBanner } from "./primitives/CrossPillarBanner";
import { DiplomacyWarRoom } from "~/components/diplomacy/DiplomacyWarRoom";

const DiplomacyMapWidget = dynamic(
  () => import("~/components/maps/widgets/DiplomacyMapWidget").then((m) => ({ default: m.DiplomacyMapWidget })),
  { ssr: false, loading: () => <div className="h-64 animate-pulse rounded-xl bg-muted" /> }
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

  const { data: embassies } = api.diplomatic.getEmbassies.useQuery(
    { countryId: country?.id ?? "" },
    { enabled: !!country?.id },
  );
  const { data: relations } = api.diplomatic.getRelationships.useQuery(
    { countryId: country?.id ?? "" },
    { enabled: !!country?.id },
  );

  const diplomacyRings = useMemo((): RingConfig[] => {
    const activeEmbassies = embassies?.filter((e) => e.status === "ACTIVE" || e.status === "active").length ?? 0;
    const totalEmbassies = embassies?.length ?? 0;
    const totalRelations = relations?.length ?? 0;
    const avgStrength = totalRelations > 0
      ? Math.round(relations!.reduce((sum, r) => sum + (r.strength ?? 0), 0) / totalRelations)
      : 0;
    const strongRelations = relations?.filter((r) => (r.strength ?? 0) >= 70).length ?? 0;

    return [
      { key: "embassies", label: "Embassies", subtitle: `${totalEmbassies} total`, color: "#06b6d4", icon: Building2, value: activeEmbassies, target: totalEmbassies || 1, displayValue: `${activeEmbassies} active` },
      { key: "relations", label: "Relations", subtitle: `avg strength ${avgStrength}%`, color: "#3b82f6", icon: Handshake, value: totalRelations, target: totalRelations + 5, displayValue: `${totalRelations} nations` },
      { key: "avg-strength", label: "Avg Strength", subtitle: "relation quality", color: "#22c55e", icon: Globe, value: avgStrength, target: 100, displayValue: `avg ${avgStrength}%` },
      { key: "strong-ties", label: "Strong Ties", subtitle: "strength \u2265 70%", color: strongRelations > 0 ? "#a855f7" : "#64748b", icon: Sparkles, value: strongRelations, target: totalRelations || 1, displayValue: `${strongRelations} allies` },
    ];
  }, [embassies, relations]);

  if (isLoading || !country) {
    return null;
  }

  const pendingEmbassies = embassies?.filter((e) => e.status === "PENDING" || e.status === "pending").length ?? 0;

  const statusBadges: StatusBadgeConfig[] = pendingEmbassies > 0
    ? [{ icon: Building2, count: pendingEmbassies, colorClass: "border-cyan-500/40 text-cyan-600 dark:text-cyan-400" }]
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
      {/* Diplomatic Status Rings */}
      <VitalityRings rings={diplomacyRings} title="Diplomatic Status" variant="grid" />

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
