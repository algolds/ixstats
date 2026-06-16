"use client";

import { useCountryData, SectionShell, InlineWiki } from "./primitives";
import { useIssueCount } from "~/hooks/useNationalIssues";
import { api } from "~/trpc/react";
import { useSectionDensity } from "~/hooks/useSectionDensity";
import { ExecutiveSidebarWidget } from "./sidebar-widgets/ExecutiveSidebarWidget";
import { NewsFeedWidget } from "./NewsFeedWidget";
import { CrossPillarBanner } from "./primitives/CrossPillarBanner";
import { ExecutiveWarRoom } from "~/components/executive/ExecutiveWarRoom";
import { NarrativeFeed } from "./NarrativeFeed";
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
  const { total: issueCount } = useIssueCount(country?.id);

  const { data: policies } = api.policies.getPolicies.useQuery(
    { countryId: country?.id ?? "" },
    { enabled: !!country?.id }
  );
  const { data: meetings } = api.meetings.getMeetings.useQuery(
    { countryId: country?.id ?? "" },
    { enabled: !!country?.id }
  );

  const activePolicies = policies?.filter((p: any) => p.status === "active").length ?? 0;

  const { isGuided } = useSectionDensity({
    items: activePolicies + (meetings?.length ?? 0) + issueCount,
  });

  if (isLoading || !country) {
    return null;
  }

  return (
    <SectionShell
      section="executive"
      contextWidget={
        <>
          <ExecutiveSidebarWidget countryId={country.id} />
          <NewsFeedWidget countryId={country.id} />
        </>
      }
      activeSection={activeSection}
      onNavigate={onNavigate}
      notifications={notifications}
    >
      {!isGuided && (
        <CrossPillarBanner section="executive" countryId={country.id} onNavigate={onNavigate} />
      )}

      {/* War Room — 3-panel command center */}
      <ExecutiveWarRoom countryId={country.id} />

      <NarrativeFeed countryId={country.id} />

      {/* Wiki woven inline */}
      <InlineWiki context="executive" accent="amber" maxSections={1} />
    </SectionShell>
  );
}
