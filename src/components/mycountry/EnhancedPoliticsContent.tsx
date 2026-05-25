"use client";

import { useMemo } from "react";
import { Landmark, Users, BarChart3 } from "lucide-react";
import { VoteIcon } from "~/components/ui/icons";
import { useCountryData, VitalityRings, SectionHero } from "./primitives";
import type { RingConfig, StatusBadgeConfig } from "./primitives";
import { api } from "~/trpc/react";
import { MyCountrySidebarLayout } from "./MyCountrySidebarLayout";
import { PoliticsSidebarWidget } from "./sidebar-widgets/PoliticsSidebarWidget";
import { WikiLoreBlock } from "./primitives/WikiLoreBlock";
import { CrossPillarBanner } from "./primitives/CrossPillarBanner";
import { PoliticsWarRoom } from "~/components/executive/politics/PoliticsWarRoom";
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

  const politicsRings = useMemo((): RingConfig[] => {
    const partyCount = parties?.length ?? 0;
    const totalSeats = legislature?.totalSeats ?? 0;
    const filledSeats =
      parliament?.seatSummary?.reduce((sum: number, s: any) => sum + s.seats, 0) ?? 0;
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
  }, [parties, legislature, parliament, elections]);

  if (isLoading || !country) {
    return null;
  }

  const pendingElections =
    elections?.filter(
      (e: any) =>
        e.status === "SCHEDULED" ||
        e.status === "scheduled" ||
        e.status === "IN_PROGRESS" ||
        e.status === "in_progress"
    ).length ?? 0;

  const statusBadges: StatusBadgeConfig[] =
    pendingElections > 0
      ? [
          {
            icon: BarChart3,
            count: pendingElections,
            colorClass: "border-indigo-500/40 text-indigo-600 dark:text-indigo-400",
          },
        ]
      : [];

  return (
    <MyCountrySidebarLayout
      heroSection={
        <SectionHero
          context="politics"
          sectionTitle="Political Landscape"
          sectionSubtitle="Legislature, Parties & Elections"
          sectionIcon={VoteIcon}
          accentColor="indigo"
          countryName={country.name}
          statusBadges={statusBadges}
        />
      }
      sidebarExtra={<PoliticsSidebarWidget countryId={country.id} />}
      activeSection={activeSection}
      onNavigate={onNavigate}
      notifications={notifications}
    >
      {/* Political Status Rings */}
      <VitalityRings rings={politicsRings} title="Political Status" variant="grid" />

      {/* Cross-Pillar Effects */}
      <CrossPillarBanner section="politics" countryId={country.id} onNavigate={onNavigate} />

      {/* War Room — 3-panel command center */}
      <PoliticsWarRoom countryId={country.id} />

      <WikiLoreBlock context="politics" themeColor="indigo" title="Government Lore" />
    </MyCountrySidebarLayout>
  );
}
