"use client";

import { useMemo } from "react";
import { Bell, FileText, Layers } from "lucide-react";
import { CrownIcon } from "~/components/ui/icons";
import { useCountryData, VitalityRings, SectionHero } from "./primitives";
import type { RingConfig, StatusBadgeConfig } from "./primitives";
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
    { enabled: !!country?.id },
  );
  const { data: meetings } = api.meetings.getMeetings.useQuery(
    { countryId: country?.id ?? "" },
    { enabled: !!country?.id },
  );

  const executiveRings = useMemo((): RingConfig[] => {
    const activePolicies = policies?.filter((p) => p.status === "active").length ?? 0;
    const totalPolicies = policies?.length ?? 0;
    const pendingActions = meetings?.flatMap((m) => m.actionItems).filter((a) => a.status === "pending").length ?? 0;
    const totalActions = meetings?.flatMap((m) => m.actionItems).length ?? 0;
    const completedActions = totalActions - pendingActions;

    return [
      { key: "issues", label: "Issues", subtitle: urgentIssueCount > 0 ? `${urgentIssueCount} urgent` : "pending", color: urgentIssueCount > 0 ? "#ef4444" : issueCount > 0 ? "#f59e0b" : "#22c55e", icon: Bell, value: issueCount, target: Math.max(issueCount + 3, 5), displayValue: `${issueCount} pending` },
      { key: "policies", label: "Policies", subtitle: `${totalPolicies} total`, color: activePolicies > 0 ? "#f59e0b" : "#6b7280", icon: FileText, value: activePolicies, target: totalPolicies || 1, displayValue: `${activePolicies} active` },
      { key: "actions", label: "Actions", subtitle: pendingActions > 0 ? "require attention" : "all clear", color: pendingActions > 0 ? "#f97316" : "#22c55e", icon: Layers, value: completedActions, target: totalActions || 1, displayValue: pendingActions > 0 ? `${pendingActions} pending` : "all done" },
    ];
  }, [issueCount, urgentIssueCount, policies, meetings]);

  if (isLoading || !country) {
    return null;
  }

  const issueColor = urgentIssueCount > 0
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
      {/* Executive Status Rings */}
      <VitalityRings rings={executiveRings} title="Executive Status" variant="grid" />

      {/* Cross-Pillar Effects */}
      <CrossPillarBanner section="executive" countryId={country.id} onNavigate={onNavigate} />

      {/* War Room — 3-panel command center */}
      <ExecutiveWarRoom countryId={country.id} />

      <WikiLoreBlock context="executive" themeColor="amber" title="Historical Precedent" />
    </MyCountrySidebarLayout>
  );
}
