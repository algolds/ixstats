"use client";

import dynamic from "next/dynamic";
import { useCountryData, SectionShell } from "./primitives";
import { api } from "~/trpc/react";
import { useSectionDensity } from "~/hooks/useSectionDensity";
import { IntelligenceSidebarWidget } from "./sidebar-widgets/IntelligenceSidebarWidget";
import { IntelligenceWarRoom } from "~/components/intelligence/IntelligenceWarRoom";

const DashboardMapWidget = dynamic(
  () =>
    import("~/components/maps/widgets/DashboardMapWidget").then((m) => ({
      default: m.DashboardMapWidget,
    })),
  { ssr: false, loading: () => <div className="bg-muted h-64 animate-pulse rounded-xl" /> }
);

import type { MyCountrySection } from "./MyCountrySidebarNav";

interface EnhancedIntelligenceContentProps {
  activeSection?: MyCountrySection;
  onNavigate?: (section: MyCountrySection) => void;
  notifications?: Partial<Record<string, number>>;
}

export function EnhancedIntelligenceContent({
  activeSection,
  onNavigate,
  notifications,
}: EnhancedIntelligenceContentProps) {
  const { country, isLoading } = useCountryData();

  const { data: intelligenceOverview } = api.intelCore.getOverview.useQuery(
    { countryId: country?.id ?? "" },
    { enabled: !!country?.id }
  );
  const { data: embassies } = api.diplomaticEmbassies.getEmbassies.useQuery(
    { countryId: country?.id ?? "" },
    { enabled: !!country?.id }
  );

  const totalAlerts = intelligenceOverview?.alerts?.total ?? 0;
  const activeEmbassiesCount =
    embassies?.filter((e: any) => e.status === "ACTIVE" || e.status === "active").length ?? 0;

  // Progressive Disclosure: guided if no alerts and no embassies established
  const { isGuided } = useSectionDensity({
    items: totalAlerts + activeEmbassiesCount,
  });

  if (isLoading || !country) {
    return null;
  }

  return (
    <SectionShell
      section="intelligence"
      hero={
        !isGuided ? (
          <DashboardMapWidget countryId={country.id} viewMode="intelligence" />
        ) : undefined
      }
      contextWidget={<IntelligenceSidebarWidget countryId={country.id} />}
      activeSection={activeSection}
      onNavigate={onNavigate}
      notifications={notifications}
    >
      {/* 3-panel command dashboard (matching executive/diplomacy war room layouts) */}
      <IntelligenceWarRoom countryId={country.id} countryName={country.name} />
    </SectionShell>
  );
}
