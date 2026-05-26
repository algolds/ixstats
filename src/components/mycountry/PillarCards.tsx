"use client";

import React from "react";
import {
  Bell,
  FileText,
  Building2,
  Handshake,
  Users,
  Landmark,
  BarChart3,
  Layers,
  ChevronRight,
} from "lucide-react";
import { CrownIcon, GlobeAltIcon, VoteIcon } from "~/components/ui/icons";
import { Badge } from "~/components/ui/badge";
import { api } from "~/trpc/react";
import { useIssueCount } from "~/hooks/useNationalIssues";
import type { MyCountrySection } from "./MyCountrySidebarNav";

interface PillarCardsProps {
  countryId: string;
  onNavigate: (section: MyCountrySection) => void;
}

interface PillarStat {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  colorClass: string;
}

/**
 * 3-card grid summarizing the core gameplay pillars (Executive, Diplomacy, Politics).
 * Each card shows 3 key metrics and navigates to the corresponding section.
 */
export function PillarCards({ countryId, onNavigate }: PillarCardsProps) {
  // Executive data
  const { total: issueCount, urgent: urgentIssueCount } = useIssueCount(countryId);
  const { data: policies } = api.policies.getPolicies.useQuery(
    { countryId },
    { enabled: !!countryId }
  );
  const { data: meetings } = api.meetings.getMeetings.useQuery(
    { countryId },
    { enabled: !!countryId }
  );

  // Diplomacy data
  const { data: embassies } = api.diplomaticEmbassies.getEmbassies.useQuery(
    { countryId },
    { enabled: !!countryId }
  );
  const { data: relations } = api.diplomaticCore.getRelationships.useQuery(
    { countryId },
    { enabled: !!countryId }
  );

  // Politics data
  const { data: parties } = api.elections.getParties.useQuery(
    { countryId },
    { enabled: !!countryId }
  );
  const { data: legislature } = api.elections.getLegislature.useQuery(
    { countryId },
    { enabled: !!countryId }
  );
  const { data: elections } = api.elections.getElections.useQuery(
    { countryId },
    { enabled: !!countryId }
  );

  // Executive stats
  const activePolicies = policies?.filter((p) => p.status === "active").length ?? 0;
  const pendingActions =
    meetings?.flatMap((m) => m.actionItems).filter((a) => a.status === "pending").length ?? 0;

  // Diplomacy stats
  const activeEmbassies =
    embassies?.filter((e) => e.status === "ACTIVE" || e.status === "active").length ?? 0;
  const totalRelations = relations?.length ?? 0;
  const avgStrength =
    totalRelations > 0
      ? Math.round(relations!.reduce((sum, r) => sum + (r.strength ?? 0), 0) / totalRelations)
      : 0;

  // Politics stats
  const partyCount = parties?.length ?? 0;
  const totalSeats = legislature?.totalSeats ?? 0;
  const pendingElections =
    elections?.filter(
      (e: any) =>
        e.status === "SCHEDULED" ||
        e.status === "scheduled" ||
        e.status === "IN_PROGRESS" ||
        e.status === "in_progress"
    ).length ?? 0;

  const pillars: {
    section: MyCountrySection;
    title: string;
    icon: React.ComponentType<{ size?: number; className?: string }>;
    gradient: string;
    border: string;
    badge?: { label: string; colorClass: string };
    stats: PillarStat[];
  }[] = [
    {
      section: "executive",
      title: "Executive Command",
      icon: CrownIcon,
      gradient: "from-amber-500 to-yellow-500",
      border: "border-amber-500/20 hover:border-amber-500/40",
      badge:
        urgentIssueCount > 0
          ? { label: `${urgentIssueCount} urgent`, colorClass: "bg-red-500 text-white" }
          : issueCount > 0
            ? { label: `${issueCount} pending`, colorClass: "bg-amber-500 text-white" }
            : undefined,
      stats: [
        {
          icon: Bell,
          label: "Issues",
          value: `${issueCount} pending`,
          colorClass:
            urgentIssueCount > 0
              ? "text-red-600 dark:text-red-400"
              : "text-amber-600 dark:text-amber-400",
        },
        {
          icon: FileText,
          label: "Policies",
          value: `${activePolicies} active`,
          colorClass: "text-amber-600 dark:text-amber-400",
        },
        {
          icon: Layers,
          label: "Actions",
          value: pendingActions > 0 ? `${pendingActions} pending` : "all clear",
          colorClass:
            pendingActions > 0
              ? "text-orange-600 dark:text-orange-400"
              : "text-green-600 dark:text-green-400",
        },
      ],
    },
    {
      section: "diplomacy",
      title: "Diplomatic Operations",
      icon: GlobeAltIcon,
      gradient: "from-cyan-500 to-blue-500",
      border: "border-cyan-500/20 hover:border-cyan-500/40",
      stats: [
        {
          icon: Building2,
          label: "Embassies",
          value: `${activeEmbassies} active`,
          colorClass: "text-cyan-600 dark:text-cyan-400",
        },
        {
          icon: Handshake,
          label: "Relations",
          value: `${totalRelations} nations`,
          colorClass: "text-cyan-600 dark:text-cyan-400",
        },
        {
          icon: Handshake,
          label: "Avg Strength",
          value: `${avgStrength}%`,
          colorClass:
            avgStrength >= 50
              ? "text-green-600 dark:text-green-400"
              : "text-cyan-600 dark:text-cyan-400",
        },
      ],
    },
    {
      section: "politics",
      title: "Political Landscape",
      icon: VoteIcon,
      gradient: "from-indigo-500 to-violet-500",
      border: "border-indigo-500/20 hover:border-indigo-500/40",
      badge:
        pendingElections > 0
          ? {
              label: `${pendingElections} election${pendingElections > 1 ? "s" : ""} pending`,
              colorClass: "bg-indigo-500 text-white",
            }
          : undefined,
      stats: [
        {
          icon: Users,
          label: "Parties",
          value: `${partyCount} active`,
          colorClass:
            partyCount >= 3
              ? "text-indigo-600 dark:text-indigo-400"
              : "text-orange-600 dark:text-orange-400",
        },
        {
          icon: Landmark,
          label: "Parliament",
          value: totalSeats > 0 ? `${totalSeats} seats` : "not set up",
          colorClass: "text-indigo-600 dark:text-indigo-400",
        },
        {
          icon: BarChart3,
          label: "Elections",
          value: pendingElections > 0 ? `${pendingElections} pending` : "none pending",
          colorClass:
            pendingElections > 0
              ? "text-violet-600 dark:text-violet-400"
              : "text-indigo-600 dark:text-indigo-400",
        },
      ],
    },
  ];

  return (
    <div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {pillars.map((pillar) => (
          <button
            key={pillar.section}
            onClick={() => onNavigate(pillar.section)}
            className={`glass-hierarchy-child rounded-xl border ${pillar.border} group p-4 text-left transition-all duration-200 hover:shadow-lg`}
          >
            {/* Header */}
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className={`rounded-lg bg-gradient-to-r ${pillar.gradient} p-1.5`}>
                  <pillar.icon size={16} className="text-white" />
                </div>
                <span className="text-sm font-semibold">{pillar.title}</span>
              </div>
              <ChevronRight className="text-muted-foreground h-4 w-4 opacity-0 transition-opacity group-hover:opacity-100" />
            </div>

            {/* Badge */}
            {pillar.badge && (
              <div className="mb-3">
                <Badge className={`text-[0.65rem] ${pillar.badge.colorClass}`}>
                  {pillar.badge.label}
                </Badge>
              </div>
            )}

            {/* Stats */}
            <div className="space-y-2">
              {pillar.stats.map((stat) => (
                <div key={stat.label} className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <stat.icon className={`h-3.5 w-3.5 ${stat.colorClass}`} />
                    <span className="text-muted-foreground text-xs">{stat.label}</span>
                  </div>
                  <span className={`text-xs font-semibold ${stat.colorClass}`}>{stat.value}</span>
                </div>
              ))}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
