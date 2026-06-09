"use client";

import React, { useMemo, useState } from "react";
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
  ChevronUp,
  ChevronDown,
  Mail,
  Shield,
  Brain,
  Gavel,
} from "lucide-react";
import { CrownIcon, GlobeAltIcon, VoteIcon } from "~/components/ui/icons";
import { Badge } from "~/components/ui/badge";
import { api } from "~/trpc/react";
import { useIssueCount } from "~/hooks/useNationalIssues";
import { useMessageUnreadCount } from "~/hooks/useMessageUnreadCount";
import type { MyCountrySection } from "./MyCountrySidebarNav";
import { cn } from "~/lib/utils";
import { TextureOverlay } from "~/components/ui/texture-overlay";

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

  // New-player guidance: surface an explicit "get started" hint when a pillar has no data yet.
  const executiveEmpty = issueCount === 0 && activePolicies === 0 && pendingActions === 0;
  const diplomacyEmpty = activeEmbassies === 0 && totalRelations === 0;
  const politicsEmpty = partyCount === 0 && totalSeats === 0;

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

            {/* New-player get-started hint */}
            {((pillar.section === "executive" && executiveEmpty) ||
              (pillar.section === "diplomacy" && diplomacyEmpty) ||
              (pillar.section === "politics" && politicsEmpty)) && (
              <div className="border-border/40 text-foreground/70 group-hover:text-foreground mt-3 flex items-center gap-1 border-t pt-2.5 text-xs font-medium transition-colors">
                {pillar.section === "executive"
                  ? "Start governing"
                  : pillar.section === "diplomacy"
                    ? "Establish your first embassy"
                    : "Set up your legislature"}
                <ChevronRight className="h-3 w-3" />
              </div>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

export function AgendaBar({
  countryId,
  onNavigateAction,
  activeSection,
}: {
  countryId: string;
  onNavigateAction: (section: MyCountrySection) => void;
  activeSection?: MyCountrySection;
}) {
  const { total: issueCount, urgent: urgentIssueCount } = useIssueCount(countryId);
  const { data: elections } = api.elections.getElections.useQuery(
    { countryId },
    { enabled: !!countryId }
  );
  const { data: embassies } = api.diplomaticEmbassies.getEmbassies.useQuery(
    { countryId },
    { enabled: !!countryId }
  );
  const { data: meetings } = api.meetings.getMeetings.useQuery(
    { countryId },
    { enabled: !!countryId }
  );
  const { data: policies } = api.policies.getPolicies.useQuery(
    { countryId },
    { enabled: !!countryId }
  );
  const { data: securityAssessment } = api.security.getSecurityAssessment.useQuery(
    { countryId },
    { enabled: !!countryId }
  );
  const { data: intelligenceOverview } = api.intelCore.getOverview.useQuery(
    { countryId },
    { enabled: !!countryId }
  );
  const { totalUnread } = useMessageUnreadCount();

  const [agendaOpen, setAgendaOpen] = useState(false);

  const pendingElections =
    elections?.filter(
      (e: any) =>
        e.status === "SCHEDULED" ||
        e.status === "scheduled" ||
        e.status === "IN_PROGRESS" ||
        e.status === "in_progress"
    ).length ?? 0;

  const activeEmbassies =
    embassies?.filter((e) => e.status === "ACTIVE" || e.status === "active").length ?? 0;

  const pendingActions =
    meetings
      ?.flatMap((m) => m.actionItems ?? [])
      .filter((a) => a.status === "pending" || a.status === "PENDING").length ?? 0;

  const activePolicies = policies?.filter((p: any) => p.status?.toLowerCase() === "active").length ?? 0;
  const totalPolicies = policies?.filter((p: any) => {
    const status = p.status?.toLowerCase();
    return status && status !== "archived" && status !== "draft";
  }).length ?? 0;

  const activeThreatCount = securityAssessment?.activeThreatCount ?? 0;
  const securityScore = securityAssessment?.overallSecurityScore ?? 100;

  const criticalIntelAlerts = intelligenceOverview?.alerts?.critical ?? 0;

  const agendaItems = useMemo(() => {
    const list: {
      id: string;
      label: string;
      text: string;
      section: MyCountrySection;
      colorClass: string;
      bgClass: string;
      icon: any;
    }[] = [];

    // 1. Cabinet Issues (Urgent or Pending)
    if (urgentIssueCount > 0) {
      list.push({
        id: "exec-urgent",
        label: "Urgent Issues",
        text: `${urgentIssueCount} urgent issue${urgentIssueCount !== 1 ? "s" : ""} require response`,
        section: "executive",
        colorClass: "text-red-500",
        bgClass: "hover:bg-red-500/5",
        icon: CrownIcon,
      });
    } else if (issueCount > 0) {
      list.push({
        id: "exec-pending",
        label: "Cabinet Issues",
        text: `${issueCount} pending issue${issueCount !== 1 ? "s" : ""} in cabinet`,
        section: "executive",
        colorClass: "text-amber-500",
        bgClass: "hover:bg-amber-500/5",
        icon: CrownIcon,
      });
    }

    // 2. Active Policies
    if (totalPolicies > 0) {
      list.push({
        id: "exec-policies",
        label: "Active Policies",
        text: `${activePolicies} of ${totalPolicies} policies active`,
        section: "executive",
        colorClass: "text-emerald-500",
        bgClass: "hover:bg-emerald-500/5",
        icon: Gavel,
      });
    }

    // 3. Meeting Action Items
    if (pendingActions > 0) {
      list.push({
        id: "exec-actions",
        label: "Meeting Actions",
        text: `${pendingActions} action item${pendingActions !== 1 ? "s" : ""} pending`,
        section: "executive",
        colorClass: "text-orange-500",
        bgClass: "hover:bg-orange-500/5",
        icon: Layers,
      });
    }

    // 4. Unread Messages
    if (totalUnread > 0) {
      list.push({
        id: "diplo-unread-messages",
        label: "Unread Messages",
        text: `${totalUnread} unread message${totalUnread !== 1 ? "s" : ""} in inbox`,
        section: "diplomacy",
        colorClass: "text-blue-500",
        bgClass: "hover:bg-blue-500/5",
        icon: Mail,
      });
    }

    // 5. Defense Threats / Assessment
    if (activeThreatCount > 0) {
      list.push({
        id: "def-threats",
        label: "Security Threats",
        text: `${activeThreatCount} active threat${activeThreatCount !== 1 ? "s" : ""} detected`,
        section: "defense",
        colorClass: "text-red-500",
        bgClass: "hover:bg-red-500/5",
        icon: Shield,
      });
    } else if (securityScore < 60) {
      list.push({
        id: "def-low-score",
        label: "Defense Readiness",
        text: `Defense Readiness Score is low: ${securityScore}/100`,
        section: "defense",
        colorClass: "text-amber-500",
        bgClass: "hover:bg-amber-500/5",
        icon: Shield,
      });
    }

    // 6. Intelligence Alerts
    if (criticalIntelAlerts > 0) {
      list.push({
        id: "intel-critical",
        label: "Intel Security",
        text: `${criticalIntelAlerts} critical intelligence alert${criticalIntelAlerts !== 1 ? "s" : ""}`,
        section: "intelligence",
        colorClass: "text-red-500",
        bgClass: "hover:bg-red-500/5",
        icon: Brain,
      });
    }

    // 7. Elections
    if (pendingElections > 0) {
      list.push({
        id: "pol-elections",
        label: "Elections",
        text: `${pendingElections} active/scheduled election${pendingElections !== 1 ? "s" : ""}`,
        section: "politics",
        colorClass: "text-indigo-500",
        bgClass: "hover:bg-indigo-500/5",
        icon: VoteIcon,
      });
    }

    // 8. Embassies
    if (activeEmbassies === 0) {
      list.push({
        id: "diplo-no-emb",
        label: "Diplomatic Embassies",
        text: "Establish your first embassy",
        section: "diplomacy",
        colorClass: "text-cyan-500",
        bgClass: "hover:bg-cyan-500/5",
        icon: GlobeAltIcon,
      });
    }

    return list;
  }, [
    issueCount,
    urgentIssueCount,
    pendingActions,
    totalPolicies,
    activePolicies,
    totalUnread,
    activeThreatCount,
    securityScore,
    criticalIntelAlerts,
    pendingElections,
    activeEmbassies,
  ]);

  // Dynamic sorting: match active section tasks first
  const sortedAgendaItems = useMemo(() => {
    if (!activeSection) return agendaItems;
    return [...agendaItems].sort((a, b) => {
      const aMatch = a.section === activeSection ? 1 : 0;
      const bMatch = b.section === activeSection ? 1 : 0;
      return bMatch - aMatch;
    });
  }, [agendaItems, activeSection]);

  const activeSectionTasks = useMemo(() => {
    return agendaItems.filter((item) => item.section === activeSection);
  }, [agendaItems, activeSection]);

  const activeSectionTaskCount = activeSectionTasks.length;

  const summaryText = useMemo(() => {
    if (agendaItems.length === 0) {
      return "All clear! No tasks for today.";
    }
    if (activeSection && activeSectionTaskCount > 0) {
      const sectionName =
        activeSection === "overview"
          ? "Overview"
          : activeSection.charAt(0).toUpperCase() + activeSection.slice(1);
      const firstTaskText = activeSectionTasks[0]?.text ?? "";
      return `${sectionName} Priority: ${firstTaskText}`;
    }
    return `${agendaItems.length} active task${agendaItems.length !== 1 ? "s" : ""} requiring attention`;
  }, [agendaItems, activeSection, activeSectionTasks, activeSectionTaskCount]);

  return (
    <div className="relative">
      <button
        onClick={() => agendaItems.length > 0 && setAgendaOpen(!agendaOpen)}
        className={cn(
          "glass-surface glass-refraction bg-card/45 relative z-10 flex w-full items-center justify-between overflow-hidden rounded-xl border border-white/5 p-3.5 text-left backdrop-blur-md",
          agendaItems.length > 0 ? "cursor-pointer" : "cursor-default"
        )}
      >
        <TextureOverlay texture="paperGrain" opacity={0.05} />
        <div className="relative z-10 flex items-center gap-2.5">
          <div
            className={cn(
              "rounded-lg border p-1.5",
              agendaItems.length === 0
                ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-500"
                : activeSection && activeSectionTaskCount > 0
                  ? "border-amber-500/20 bg-amber-500/10 text-amber-500"
                  : "text-muted-foreground border-white/5 bg-white/[0.03]"
            )}
          >
            <FileText className="h-4 w-4" />
          </div>
          <div>
            <span className="text-foreground block text-xs font-semibold tracking-wider uppercase sm:inline-block">
              Your Daily Agenda
            </span>
            <span className="text-muted-foreground/60 mx-1.5 hidden text-xs sm:inline">•</span>
            {agendaItems.length === 0 ? (
              <span className="text-xs font-medium text-emerald-500 dark:text-emerald-400">
                {summaryText}
              </span>
            ) : activeSection && activeSectionTaskCount > 0 ? (
              <span className="text-xs font-medium text-amber-500 dark:text-amber-400">
                {summaryText}
              </span>
            ) : (
              <span className="text-xs font-medium text-amber-500/80 dark:text-amber-400/80">
                {summaryText}
              </span>
            )}
          </div>
        </div>

        <div className="relative z-10 flex items-center gap-2">
          {agendaItems.length > 0 &&
            (agendaOpen ? (
              <ChevronUp className="text-muted-foreground/60 h-4 w-4 transition-transform" />
            ) : (
              <ChevronDown className="text-muted-foreground/60 h-4 w-4 transition-transform" />
            ))}
        </div>
      </button>

      {agendaOpen && agendaItems.length > 0 && (
        <div className="bg-card/45 animate-in fade-in slide-in-from-top-1 relative z-10 mt-1.5 flex flex-col gap-1.5 rounded-xl border border-white/5 p-2 backdrop-blur-md duration-150">
          <TextureOverlay texture="paperGrain" opacity={0.05} />
          {sortedAgendaItems.map((item) => {
            const Icon = item.icon;
            const isHighlighted = item.section === activeSection;
            return (
              <button
                key={item.id}
                onClick={() => {
                  setAgendaOpen(false);
                  onNavigateAction(item.section);
                }}
                className={cn(
                  "group relative z-10 flex cursor-pointer items-center justify-between rounded-lg border p-3 text-left transition-all duration-200",
                  isHighlighted
                    ? "border-amber-500/30 bg-amber-500/[0.04] shadow-[0_0_12px_rgba(245,158,11,0.05)] dark:bg-amber-500/[0.02]"
                    : "border-white/5 bg-white/[0.01] hover:bg-white/[0.03]",
                  item.bgClass
                )}
              >
                <div className="flex items-center gap-2.5">
                  {/* Checklist Circle / pulsing dot */}
                  <div className="relative mr-1 flex shrink-0 items-center justify-center">
                    {isHighlighted && (
                      <span className="absolute inline-flex h-3 w-3 animate-ping rounded-full bg-amber-500/40 opacity-75" />
                    )}
                    <div
                      className={cn(
                        "z-10 flex h-4 w-4 items-center justify-center rounded-full border transition-colors",
                        isHighlighted ? "border-amber-500/50" : "border-muted-foreground/30"
                      )}
                    >
                      <div
                        className={cn(
                          "h-1.5 w-1.5 rounded-full transition-colors",
                          isHighlighted
                            ? "bg-amber-500"
                            : "group-hover:bg-muted-foreground/50 bg-transparent"
                        )}
                      />
                    </div>
                  </div>

                  <div
                    className={cn(
                      "rounded-lg border border-white/5 bg-white/[0.03] p-1.5",
                      item.colorClass
                    )}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  <div>
                    <span className="text-foreground block text-xs font-semibold tracking-wider uppercase sm:inline-block">
                      {item.label}
                    </span>
                    <span className="text-muted-foreground/60 mx-1.5 hidden text-xs sm:inline">
                      •
                    </span>
                    <span className={cn("text-xs font-medium", item.colorClass)}>{item.text}</span>
                  </div>
                </div>
                <ChevronRight className="text-muted-foreground/45 h-4 w-4" />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export const PillarBar = AgendaBar;
