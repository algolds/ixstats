"use client";

import { useMemo } from "react";
import {
  Gavel,
  Building2,
  Users,
  CheckCircle,
  Coins,
  Briefcase,
  Shield,
  Brain,
  FileText,
  Award,
} from "lucide-react";
import { api } from "~/trpc/react";
import {
  SectionContextWidget,
  useCountryData,
  type ContextStat,
  type ContextActivityEntry,
} from "~/components/mycountry/primitives";

interface OverviewSidebarWidgetProps {
  countryId: string;
}

/**
 * Overview context widget — a thin adapter that feeds the unified
 * SectionContextWidget with cross-section stats (active policies, active embassies, registered parties)
 * and a recent-activity log merged from the 3 core game layers.
 */
export function OverviewSidebarWidget({ countryId }: OverviewSidebarWidgetProps) {
  const { country } = useCountryData();
  const { data: policies } = api.policies.getPolicies.useQuery(
    { countryId },
    { enabled: !!countryId, staleTime: 30_000 }
  );
  const { data: embassies } = api.diplomaticEmbassies.getEmbassies.useQuery(
    { countryId },
    { enabled: !!countryId, staleTime: 30_000 }
  );
  const { data: parties } = api.elections.getParties.useQuery(
    { countryId },
    { enabled: !!countryId, staleTime: 30_000 }
  );
  const { data: elections } = api.elections.getElections.useQuery(
    { countryId },
    { enabled: !!countryId, staleTime: 30_000 }
  );
  const { data: securityAssessment } = api.security.getSecurityAssessment.useQuery(
    { countryId },
    { enabled: !!countryId, staleTime: 30_000 }
  );

  const stats = useMemo<ContextStat[]>(() => {
    const activePolicies = policies?.filter((p: any) => p.status === "active").length ?? 0;
    const activeEmbassies =
      embassies?.filter((e: any) => e.status === "ACTIVE" || e.status === "active").length ?? 0;
    const partyCount = parties?.length ?? 0;

    return [
      { label: "Policies", value: activePolicies, accentText: true },
      { label: "Embassies", value: activeEmbassies, accentText: true },
      { label: "Parties", value: partyCount, accentText: true },
    ];
  }, [policies, embassies, parties]);

  const activity = useMemo<ContextActivityEntry[]>(() => {
    const entries: ContextActivityEntry[] = [];

    // Policies enacted
    policies?.forEach((p: any) => {
      if (p.status === "active" && p.effectiveDate) {
        entries.push({
          id: `policy-${p.id}`,
          icon: Gavel,
          iconColor: "text-amber-500",
          text: `Enacted: ${p.name ?? p.title}`,
          time: new Date(p.effectiveDate),
        });
      }
    });

    // Embassies established
    embassies?.forEach((e: any) => {
      entries.push({
        id: `embassy-${e.id}`,
        icon: Building2,
        iconColor: "text-cyan-500",
        text: `Embassy with ${e.country ?? e.guestCountry ?? "Unknown"}`,
        time: new Date(e.establishedAt ?? e.createdAt),
      });
    });

    // Political parties registered
    parties?.forEach((p: any) => {
      entries.push({
        id: `party-${p.id}`,
        icon: Users,
        iconColor: "text-indigo-500",
        text: `Party: ${p.name} registered`,
        time: new Date(p.createdAt),
      });
    });

    // Elections completed
    elections?.forEach((e: any) => {
      const isCompleted = e.status === "COMPLETED" || e.status === "completed";
      if (isCompleted) {
        entries.push({
          id: `election-${e.id}`,
          icon: CheckCircle,
          iconColor: "text-green-500",
          text: `Completed: ${e.name ?? "Election"}`,
          time: new Date(e.updatedAt ?? e.createdAt),
        });
      }
    });

    // Dynamic Country Status Milestones
    if (country) {
      const baseTime = country.createdAt ? new Date(country.createdAt) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

      // 1. Government Constitution Milestone
      entries.push({
        id: "milestone-govt",
        icon: FileText,
        iconColor: "text-blue-400",
        text: `Constitution Registered: Formed a ${country.governmentType || "Autonomous"} state.`,
        time: new Date(baseTime.getTime() + 1 * 3600 * 1000), // 1 hour after creation
      });

      // 2. Fiscal Tier Milestone
      entries.push({
        id: "milestone-fiscal",
        icon: Award,
        iconColor: "text-yellow-500",
        text: `Economic Classification: Registered as a ${country.economicTier || "Developing"} economy.`,
        time: new Date(baseTime.getTime() + 12 * 3600 * 1000), // 12 hours after creation
      });

      // 3. Labor Structure Milestone
      const primary = country.employmentPrimary ?? 0;
      const secondary = country.employmentSecondary ?? 0;
      const tertiary = country.employmentTertiary ?? 0;
      let sectorText = "Labor Force: Standard sector allocation established.";
      if (primary > secondary && primary > tertiary) {
        sectorText = `Labor Structure: Primary resource extraction dominates workforce (${primary}%).`;
      } else if (secondary > primary && secondary > tertiary) {
        sectorText = `Labor Structure: Secondary manufacturing sector leads national employment (${secondary}%).`;
      } else if (tertiary > primary && tertiary > secondary) {
        sectorText = `Labor Structure: Tertiary service sector leads national workforce (${tertiary}%).`;
      }
      entries.push({
        id: "milestone-labor",
        icon: Briefcase,
        iconColor: "text-teal-500",
        text: sectorText,
        time: new Date(baseTime.getTime() + 24 * 3600 * 1000), // 24 hours after creation
      });

      // 4. Defense Readiness Milestone
      const securityScore = securityAssessment?.overallSecurityScore ?? 50;
      let defenseText = "Military Readiness: Core defense coordination initialized.";
      if (securityScore >= 80) {
        defenseText = "Military Readiness: Defense forces classified as combat ready.";
      } else if (securityScore >= 50) {
        defenseText = "Military Readiness: Defensive envelope fully operational.";
      }
      entries.push({
        id: "milestone-defense",
        icon: Shield,
        iconColor: "text-red-500",
        text: defenseText,
        time: new Date(baseTime.getTime() + 36 * 3600 * 1000), // 36 hours after creation
      });

      // 5. Intelligence Security Milestone
      entries.push({
        id: "milestone-intel",
        icon: Brain,
        iconColor: "text-purple-500",
        text: "Intelligence Security: National counter-intel protocols activated.",
        time: new Date(baseTime.getTime() + 48 * 3600 * 1000), // 48 hours after creation
      });

      // 6. Population Milestone
      const pop = country.currentPopulation ?? 0;
      if (pop > 0) {
        const popFormatted = pop < 1000 ? `${pop}M` : `${(pop / 1000000).toFixed(1)}M`;
        let popText = `Population Milestone: Reached ${popFormatted} citizens.`;
        if (pop >= 100 || pop >= 100000000) {
          popText = `Population Milestone: Met superpower threshold of ${popFormatted} citizens.`;
        } else if (pop >= 50 || pop >= 50000000) {
          popText = `Population Milestone: Established footprint with ${popFormatted} citizens.`;
        }
        entries.push({
          id: "milestone-population",
          icon: Users,
          iconColor: "text-emerald-500",
          text: popText,
          time: new Date(Date.now() - 36 * 3600 * 1000), // 1.5 days ago
        });
      }

      // 7. Economic GDP Milestone
      const gdp = country.currentTotalGdp ?? 0;
      if (gdp > 0) {
        const formatGDP = (val: number) => {
          if (val > 1000000000) return `$${(val / 1000000000).toFixed(1)}B`;
          if (val > 1000000) return `$${(val / 1000000).toFixed(1)}M`;
          if (val > 1000) return `$${(val / 1000).toFixed(1)}B`;
          return `$${val}M`;
        };
        const gdpStr = formatGDP(gdp);
        entries.push({
          id: "milestone-gdp",
          icon: Coins,
          iconColor: "text-yellow-600",
          text: `Economic Milestone: Nominal GDP exceeded ${gdpStr}.`,
          time: new Date(Date.now() - 12 * 3600 * 1000), // 12 hours ago
        });
      }
    }

    return entries.sort((a, b) => b.time.getTime() - a.time.getTime()).slice(0, 6);
  }, [policies, embassies, parties, elections, country, securityAssessment]);

  return (
    <SectionContextWidget
      accent="amber"
      title="Country Log"
      stats={stats}
      activity={activity}
      emptyMessage="No activity logged yet"
    />
  );
}
