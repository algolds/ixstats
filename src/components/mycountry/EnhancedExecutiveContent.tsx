"use client";

import { Bell } from "lucide-react";
import { CrownIcon } from "~/components/ui/icons";
import { useCountryData, SectionShell, InlineWiki, type StatusBadgeConfig } from "./primitives";
import { useIssueCount } from "~/hooks/useNationalIssues";
import { api } from "~/trpc/react";
import { useFlag } from "~/hooks/useUnifiedFlags";
import { useSectionDensity } from "~/hooks/useSectionDensity";
import { ExecutiveSidebarWidget } from "./sidebar-widgets/ExecutiveSidebarWidget";
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

  const activePolicies = policies?.filter((p: any) => p.status === "active").length ?? 0;
  const { flagUrl } = useFlag(country?.name ?? "");

  const { isGuided } = useSectionDensity({
    items: activePolicies + (meetings?.length ?? 0) + issueCount,
  });

  if (isLoading || !country) {
    return null;
  }

  const statusBadges: StatusBadgeConfig[] =
    urgentIssueCount > 0
      ? [
          {
            icon: Bell,
            count: urgentIssueCount,
            colorClass: "border-amber-500/40 text-amber-600 dark:text-amber-400",
          },
        ]
      : [];

  const activeMeetings =
    meetings?.filter((m: any) => m.status === "in_progress" || m.status === "IN_PROGRESS").length ??
    0;
  const pendingActions =
    meetings
      ?.flatMap((m: any) => m.actionItems ?? [])
      .filter((a: any) => a.status === "pending" || a.status === "PENDING").length ?? 0;
  const executiveHealth = Math.max(
    0,
    Math.min(
      100,
      Math.round(
        50 +
          Math.min(activePolicies * 4, 20) +
          Math.min(activeMeetings * 5, 10) -
          Math.min(issueCount * 3, 15) -
          Math.min(urgentIssueCount * 5, 15) -
          Math.min(pendingActions * 2, 10)
      )
    )
  );

  const heroStats = [
    { label: "Issues", value: issueCount, accentText: true },
    { label: "Policies", value: activePolicies, accentText: true },
    { label: "Meetings", value: meetings?.length ?? 0, accentText: true },
  ];

  return (
    <SectionShell
      section="executive"
      contextWidget={<ExecutiveSidebarWidget countryId={country.id} />}
      activeSection={activeSection}
      onNavigate={onNavigate}
      notifications={notifications}
    >
      {!isGuided && (
        <CrossPillarBanner section="executive" countryId={country.id} onNavigate={onNavigate} />
      )}

      {/* War Room — 3-panel command center */}
      <ExecutiveWarRoom countryId={country.id} />

      {/* Wiki woven inline */}
      <InlineWiki context="executive" accent="amber" maxSections={1} />
    </SectionShell>
  );
}
