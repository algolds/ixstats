"use client";

import { Bell } from "lucide-react";
import { CrownIcon } from "~/components/ui/icons";
import { useCountryData, SectionHero } from "./primitives";
import type { StatusBadgeConfig } from "./primitives";
import { useIssueCount } from "~/hooks/useNationalIssues";
import { api } from "~/trpc/react";
import { MyCountrySidebarLayout } from "./MyCountrySidebarLayout";
import { ExecutiveSidebarWidget } from "./sidebar-widgets/ExecutiveSidebarWidget";
import { WikiLoreBlock } from "./primitives/WikiLoreBlock";
import { CrossPillarBanner } from "./primitives/CrossPillarBanner";
import { ExecutiveWarRoom } from "~/components/executive/ExecutiveWarRoom";

import type { MyCountrySection } from "./MyCountrySidebarNav";

interface EnhancedExecutiveContentProps {
  activeSection?: MyCountrySection;
  onNavigate?: (section: MyCountrySection) => void;
  notifications?: Partial<Record<string, number>>;
}

export function EnhancedExecutiveContent({
  activeSection,
  onNavigate,
  notifications,
}: EnhancedExecutiveContentProps) {
  const { country, isLoading } = useCountryData();
  const { total: issueCount, urgent: urgentIssueCount } = useIssueCount(country?.id);

  const { data: policies } = api.policies.getPolicies.useQuery(
    { countryId: country?.id ?? "" },
    { enabled: !!country?.id }
  );
  const { data: meetings } = api.meetings.getMeetings.useQuery(
    { countryId: country?.id ?? "" },
    { enabled: !!country?.id }
  );



  if (isLoading || !country) {
    return null;
  }

  const issueColor =
    urgentIssueCount > 0
      ? "border-red-500/40 text-red-600 dark:text-red-400"
      : issueCount > 0
        ? "border-amber-500/40 text-amber-600 dark:text-amber-400"
        : "border-emerald-500/40 text-emerald-600 dark:text-emerald-400";

  const statusBadges: StatusBadgeConfig[] = [
    { icon: Bell, count: issueCount, colorClass: issueColor },
  ];

  return (
    <MyCountrySidebarLayout
      heroSection={
        <SectionHero
          context="executive"
          sectionTitle="Executive Command"
          sectionSubtitle="Crisis Management & Executive Command"
          sectionIcon={CrownIcon}
          accentColor="amber"
          countryName={country.name}
          statusBadges={statusBadges}
        />
      }
      sidebarExtra={<ExecutiveSidebarWidget countryId={country.id} />}
      activeSection={activeSection}
      onNavigate={onNavigate}
      notifications={notifications}
    >

      {/* Cross-Pillar Effects */}
      <CrossPillarBanner section="executive" countryId={country.id} onNavigate={onNavigate} />

      {/* War Room — 3-panel command center */}
      <ExecutiveWarRoom countryId={country.id} />

      <WikiLoreBlock context="executive" themeColor="amber" title="Historical Precedent" />
    </MyCountrySidebarLayout>
  );
}
