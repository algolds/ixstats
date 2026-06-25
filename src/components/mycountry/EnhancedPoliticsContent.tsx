"use client";

import { useCountryData, SectionShell, InlineWiki } from "./primitives";
import { api } from "~/trpc/react";
import { useSectionDensity } from "~/hooks/useSectionDensity";
import { PoliticsSidebarWidget } from "./sidebar-widgets/PoliticsSidebarWidget";
import { CrossPillarBanner } from "./primitives/CrossPillarBanner";
import { PoliticsWarRoom } from "~/components/executive/politics/PoliticsWarRoom";
import { BillsPanel } from "~/components/executive/politics/BillsPanel";
import { ApprovalPanel } from "~/components/executive/politics/ApprovalPanel";
import { IssuesInbox } from "~/components/national-issues/IssuesInbox";
import type { MyCountrySection } from "./MyCountrySidebarNav";

interface EnhancedPoliticsContentProps {
  activeSection?: MyCountrySection;
  onNavigate?: (section: MyCountrySection) => void;
  notifications?: Partial<Record<string, number>>;
}

export function EnhancedPoliticsContent({
  activeSection,
  onNavigate,
  notifications,
}: EnhancedPoliticsContentProps) {
  const { country, isLoading } = useCountryData();

  const { data: parties } = api.elections.getParties.useQuery(
    { countryId: country?.id ?? "" },
    { enabled: !!country?.id }
  );
  const { data: legislature } = api.elections.getLegislature.useQuery(
    { countryId: country?.id ?? "" },
    { enabled: !!country?.id }
  );
  const { data: elections } = api.elections.getElections.useQuery(
    { countryId: country?.id ?? "" },
    { enabled: !!country?.id }
  );

  const totalSeats = legislature?.totalSeats ?? 0;

  const { isGuided } = useSectionDensity({
    items: (parties?.length ?? 0) + (totalSeats > 0 ? 1 : 0) + (elections?.length ?? 0),
  });

  if (isLoading || !country) {
    return null;
  }

  return (
    <SectionShell
      section="politics"
      contextWidget={<PoliticsSidebarWidget countryId={country.id} />}
      activeSection={activeSection}
      onNavigate={onNavigate}
      notifications={notifications}
    >
      {!isGuided && (
        <CrossPillarBanner section="politics" countryId={country.id} onNavigate={onNavigate} />
      )}

      {/* War Room — 3-panel command center */}
      <PoliticsWarRoom countryId={country.id} />

      {/* Legislative floor + live polling */}
      <div className="grid gap-3 lg:grid-cols-2">
        <BillsPanel countryId={country.id} />
        <ApprovalPanel countryId={country.id} />
      </div>

      {/* Political crises & scandals — reuses the National Issues loop, scoped to politics */}
      <div className="glass-hierarchy-child border-border rounded-xl border p-4">
        <IssuesInbox countryId={country.id} domain="political" variant="compact" maxVisible={4} />
      </div>

      {/* Wiki woven inline */}
      <InlineWiki context="politics" accent="indigo" maxSections={1} />
    </SectionShell>
  );
}
