"use client";

import dynamic from "next/dynamic";
import { AlertTriangle } from "lucide-react";
// eslint-disable-next-line unused-imports/no-unused-imports
import { BrainIcon } from "~/components/ui/icons";
import { useCountryData, SectionShell, InlineWiki, type StatusBadgeConfig } from "./primitives";
import { api } from "~/trpc/react";
import { useFlag } from "~/hooks/useUnifiedFlags";
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

  // Queries needed for stats & status computation
  const { data: defenseOverview } = api.security.getDefenseOverview.useQuery(
    { countryId: country?.id ?? "" },
    { enabled: !!country?.id }
  );
  const { data: intelligenceOverview } = api.intelCore.getOverview.useQuery(
    { countryId: country?.id ?? "" },
    { enabled: !!country?.id }
  );
  const { data: embassies } = api.diplomaticEmbassies.getEmbassies.useQuery(
    { countryId: country?.id ?? "" },
    { enabled: !!country?.id }
  );
  // eslint-disable-next-line unused-imports/no-unused-vars
  const { flagUrl } = useFlag(country?.name ?? "");

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

  const criticalAlerts = intelligenceOverview?.alerts?.critical ?? 0;
  const otherAlerts = Math.max(totalAlerts - criticalAlerts, 0);
  const defOverviewScore = defenseOverview?.overallScore ?? 50;

  // eslint-disable-next-line unused-imports/no-unused-vars
  const intelligenceHealth = Math.max(
    0,
    Math.min(
      100,
      Math.round(
        defOverviewScore - Math.min(criticalAlerts * 10, 20) - Math.min(otherAlerts * 2, 10)
      )
    )
  );

  // eslint-disable-next-line unused-imports/no-unused-vars
  const statusBadges: StatusBadgeConfig[] =
    criticalAlerts > 0
      ? [
          {
            icon: AlertTriangle,
            count: criticalAlerts,
            colorClass: "border-red-500/40 text-red-600 dark:text-red-400",
          },
        ]
      : [];

  // eslint-disable-next-line unused-imports/no-unused-vars
  const heroStats = [
    { label: "Security", value: `${defOverviewScore}/100`, accentText: true },
    { label: "Alerts", value: criticalAlerts, accentText: true },
    { label: "Network", value: `${activeEmbassiesCount} active`, accentText: true },
  ];

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

      {/* Wiki woven inline */}
      <InlineWiki context="intelligence" accent="blue" maxSections={1} />
    </SectionShell>
  );
}
