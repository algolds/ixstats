"use client";

import { useMemo } from "react";
import { Landmark, Users, BarChart3 } from "lucide-react";
import {
  useCountryData,
  VitalityRings,
  SectionShell,
  InlineWiki,
  type RingConfig,
} from "./primitives";
import { api } from "~/trpc/react";
import { useSectionDensity } from "~/hooks/useSectionDensity";
import { PoliticsSidebarWidget } from "./sidebar-widgets/PoliticsSidebarWidget";
import { CrossPillarBanner } from "./primitives/CrossPillarBanner";
import { PoliticsWarRoom } from "~/components/executive/politics/PoliticsWarRoom";
import { CabinetPanel } from "~/components/executive/politics/CabinetPanel";
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
  const { data: parliament } = api.elections.getCurrentParliament.useQuery(
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

  const politicsRings = useMemo((): RingConfig[] => {
    const partyCount = parties?.length ?? 0;
    const filledSeats =
      parliament?.partySummary?.reduce((sum: number, s: any) => sum + s.seats, 0) ?? 0;
    const completedElections =
      elections?.filter((e: any) => e.status === "COMPLETED" || e.status === "completed").length ??
      0;

    const partyColor = partyCount >= 3 ? "#22c55e" : partyCount > 0 ? "#f97316" : "#6b7280";
    const seatColor =
      totalSeats > 0 && filledSeats >= totalSeats
        ? "#22c55e"
        : totalSeats > 0
          ? "#3b82f6"
          : "#6b7280";

    return [
      {
        key: "parties",
        label: "Parties",
        subtitle: "registered",
        color: partyColor,
        icon: Users,
        value: partyCount,
        target: Math.max(partyCount + 2, 5),
        displayValue: `${partyCount} active`,
      },
      {
        key: "seats",
        label: "Parliament",
        subtitle: totalSeats > 0 ? `${totalSeats} total seats` : "not configured",
        color: seatColor,
        icon: Landmark,
        value: filledSeats,
        target: totalSeats || 1,
        displayValue: totalSeats > 0 ? `${filledSeats}/${totalSeats}` : "—",
      },
      {
        key: "elections",
        label: "Elections",
        subtitle: "held",
        color: completedElections > 0 ? "#8b5cf6" : "#6b7280",
        icon: BarChart3,
        value: completedElections,
        target: Math.max(completedElections + 2, 3),
        displayValue: `${completedElections} completed`,
      },
    ];
  }, [parties, parliament, elections, totalSeats]);

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
      {/* Political Status Rings */}
      <VitalityRings rings={politicsRings} title="Political Status" variant="grid" />

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
      <IssuesInbox countryId={country.id} domain="political" variant="compact" maxVisible={4} />

      {/* Cabinet staffing panel */}
      <CabinetPanel countryId={country.id} />

      {/* Wiki woven inline */}
      <InlineWiki context="politics" accent="indigo" maxSections={1} />
    </SectionShell>
  );
}
