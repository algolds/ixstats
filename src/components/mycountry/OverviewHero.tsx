"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { motion } from "motion/react";
import {
  Crown,
  Users,
  Brain,
  Shield,
  Vote,
  ChevronUp,
  ChevronDown,
  ChevronRight,
  Handshake,
  Check,
  Sword,
  Target,
  AlertTriangle,
  Landmark,
  Mail,
  Layers,
  Briefcase,
  Clock,
  Edit3,
  Eye,
} from "lucide-react";
import * as LucideIcons from "lucide-react";
import { Button } from "~/components/ui/button";
import { useActiveCosmetics } from "~/hooks/useActiveCosmetics";
import { api } from "~/trpc/react";
import { UnifiedCountryFlag } from "~/components/UnifiedCountryFlag";
import { createUrl } from "~/lib/url-utils";
import { IxTime } from "~/lib/ixtime";
import { cn } from "~/lib/utils";
import { TextureOverlay } from "~/components/ui/texture-overlay";
import { Badge } from "~/components/ui/badge";
import { usePremium } from "~/hooks/usePremium";
import { useCountryData } from "./primitives";
import { useIssueCount } from "~/hooks/useNationalIssues";
import { useMessageUnreadCount } from "~/hooks/useMessageUnreadCount";
import type { MyCountrySection } from "./MyCountrySidebarNav";
import { HeroHelpModal, type HeroHelpStep } from "~/components/ui/hero-help-modal";

const MYCOUNTRY_HELP_STEPS: HeroHelpStep[] = [
  {
    title: "Welcome to MyCountry",
    body: "This is your nation's command suite. Everything you need to run your country lives here — your daily agenda, government, diplomacy, intelligence, and defense.",
  },
  {
    title: "Executive",
    body: "Hold cabinet meetings, enact and review policies, and work through your daily agenda. This is where you make the decisions that move your nation.",
  },
  {
    title: "Resolve national issues",
    body: "Issues surface problems facing your nation. Address them from the Executive/Intelligence views — resolving them improves stability and your vitality scores.",
  },
  {
    title: "Diplomacy & Intelligence",
    body: "Manage embassies and relations under Diplomacy. Check the Intelligence tab for your vitality index, briefings, and alerts about what needs attention.",
  },
  {
    title: "Defense",
    body: "Review and build your military and internal security posture from the Defense section.",
  },
  {
    title: "Edit your nation",
    body: "Use the editor to update your country's identity, government, economy, and tax system. Changes autosave as you go — no save button hunting required.",
  },
];

const CountryMapEmbed = dynamic(
  () =>
    import("~/components/maps/widgets/CountryMapEmbed").then((m) => ({
      default: m.CountryMapEmbed,
    })),
  { ssr: false, loading: () => <div className="bg-muted h-52 animate-pulse rounded-xl" /> }
);

interface OverviewHeroProps {
  collapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
  countryId: string;
  onNavigate?: (section: MyCountrySection) => void;
}

// ── Normalize growth rates that may be stored as raw decimals ──
function normalizeGrowth(value: number | null | undefined): number {
  if (!value || !isFinite(value)) return 0;
  let v = value;
  while (Math.abs(v) > 50) v /= 100;
  return Math.min(20, Math.max(-20, v));
}

// ── Format an IxTime-domain rollout duration (ms) as a short countdown label ──
function formatRolloutRemaining(remainingMs: number): string {
  if (remainingMs <= 0) return "Finalizing";
  const days = remainingMs / 86_400_000;
  if (days >= 365) return `${(days / 365).toFixed(1)}y left`;
  if (days >= 60) return `${Math.round(days / 30.44)}mo left`;
  if (days >= 1) return `${Math.round(days)}d left`;
  return "<1d left";
}

// ── Civil Service Capacity + Rollout Queue widget ──
// Surfaces consumed-vs-available administrative staff and any atomic components
// still rolling out. Renders nothing when the country has no components configured.
function CivilServiceWidget({
  countryId,
  enabled,
  onNavigate,
}: {
  countryId: string;
  enabled: boolean;
  onNavigate?: (section: MyCountrySection) => void;
}) {
  const { data } = api.government.getCivilServiceStatus.useQuery(
    { countryId },
    { enabled, staleTime: 60_000 }
  );

  if (!data) return null;
  if (data.activeCount === 0 && data.implementingCount === 0 && data.consumedStaff === 0) {
    return null;
  }

  const util = data.utilizationPercent;
  const barColor = data.overCapacity
    ? "bg-red-500"
    : util >= 80
      ? "bg-amber-500"
      : "bg-emerald-500";
  const valueColor = data.overCapacity
    ? "text-red-600 dark:text-red-400"
    : util >= 80
      ? "text-amber-600 dark:text-amber-400"
      : "text-emerald-600 dark:text-emerald-400";

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-white/10 bg-white/[0.03] p-2.5 backdrop-blur-md">
      {/* Civil Service Capacity */}
      <button
        type="button"
        onClick={() => onNavigate?.("executive")}
        className="group flex w-full items-center justify-between gap-2 text-left"
      >
        <div className="flex items-center gap-1.5">
          <Briefcase className="h-3.5 w-3.5 text-amber-500" />
          <span className="text-muted-foreground/70 text-[8px] font-bold tracking-wider uppercase">
            Civil Service Capacity
          </span>
        </div>
        <span className={cn("shrink-0 text-[10px] font-bold tabular-nums", valueColor)}>
          {Math.round(data.consumedStaff)} / {Math.round(data.capacity)}
        </span>
      </button>
      <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-white/10">
        <div
          className={cn("h-full rounded-full transition-all duration-500", barColor)}
          style={{ width: `${Math.min(100, util)}%` }}
        />
      </div>
      {data.overCapacity && (
        <div className="flex items-center gap-1 text-[9px] font-semibold text-red-600 dark:text-red-400">
          <AlertTriangle className="h-2.5 w-2.5 shrink-0" />
          <span>Staffing shortage — active programs exceed capacity</span>
        </div>
      )}

      {/* Rollout Queue */}
      {data.rolloutQueue.length > 0 && (
        <div className="mt-0.5 flex flex-col gap-1.5 border-t border-white/5 pt-1.5">
          <div className="flex items-center gap-1.5">
            <Clock className="h-3 w-3 text-cyan-500" />
            <span className="text-muted-foreground/70 text-[8px] font-bold tracking-wider uppercase">
              Rollout Queue ({data.rolloutQueue.length})
            </span>
          </div>
          {data.rolloutQueue.slice(0, 3).map((item) => (
            <div key={item.id} className="flex flex-col gap-0.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-foreground truncate text-[10px] font-medium">
                  {item.name}
                </span>
                <span className="text-muted-foreground/60 shrink-0 text-[8px] tabular-nums">
                  {formatRolloutRemaining(item.remainingMs)}
                </span>
              </div>
              <div className="relative h-1 w-full overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-cyan-500 transition-all duration-500"
                  style={{ width: `${Math.min(100, Math.max(0, item.progress))}%` }}
                />
              </div>
            </div>
          ))}
          {data.rolloutQueue.length > 3 && (
            <span className="text-muted-foreground/50 text-[8px]">
              +{data.rolloutQueue.length - 3} more in progress
            </span>
          )}
        </div>
      )}
    </div>
  );
}

export function OverviewHero({
  collapsed,
  onCollapsedChange,
  countryId,
  onNavigate,
}: OverviewHeroProps) {
  const { isPremium } = usePremium();
  const { avatarGlow, chatBadge, neonFrame } = useActiveCosmetics();
  const CrownIcon = (LucideIcons as any)[chatBadge.icon] || LucideIcons.Crown;

  const [alertsOpen, setAlertsOpen] = useState(false);

  const { country } = useCountryData();
  const hasCountry = !!countryId && countryId.trim() !== "";

  // ── Section-specific data ──
  // Executive
  const { total: issueCount, urgent: urgentIssueCount } = useIssueCount(countryId);
  const { data: policies } = api.policies.getPolicies.useQuery(
    { countryId },
    { enabled: hasCountry }
  );
  const { data: meetings } = api.meetings.getMeetings.useQuery(
    { countryId },
    { enabled: hasCountry }
  );

  // Diplomacy
  const { data: embassies } = api.diplomaticEmbassies.getEmbassies.useQuery(
    { countryId },
    { enabled: hasCountry }
  );
  const { data: relations } = api.diplomaticCore.getRelationships.useQuery(
    { countryId },
    { enabled: hasCountry }
  );

  // Politics
  const { data: parties } = api.elections.getParties.useQuery(
    { countryId },
    { enabled: hasCountry }
  );
  const { data: legislature } = api.elections.getLegislature.useQuery(
    { countryId },
    { enabled: hasCountry }
  );

  const { data: elections } = api.elections.getElections.useQuery(
    { countryId },
    { enabled: hasCountry }
  );

  // Intelligence (Premium)

  const { data: intelligenceOverview } = api.intelCore.getOverview.useQuery(
    { countryId },
    { enabled: hasCountry && isPremium }
  );

  // Defense (Premium)
  const { data: securityData } = api.security.getSecurityAssessment.useQuery(
    { countryId },
    { enabled: hasCountry && isPremium }
  );
  const { data: militaryBranches } = api.security.getMilitaryBranches.useQuery(
    { countryId },
    { enabled: hasCountry && isPremium }
  );

  const stats = {
    tier: country.economicTier ?? "—",
    countryName: country.name ?? "",
    leader: country.leader ?? (country as any).newStats?.leader ?? "",
    continent: country.continent ?? "",
    governmentType: country.governmentType ?? (country as any).newStats?.governmentType ?? "",
    slug: country.slug ?? (country as any).newStats?.slug ?? "",
    gdpPerCapita: country.currentGdpPerCapita ?? 0,
    population: country.currentPopulation ?? 0,
    populationTier: country.populationTier ?? "1",
    currentTotalGdp:
      country.currentTotalGdp ??
      (country.currentPopulation && country.currentGdpPerCapita
        ? country.currentPopulation * country.currentGdpPerCapita
        : 0),
    economicTier: country.economicTier ?? "Developing",
    populationDensity:
      country.populationDensity ?? (country as any).newStats?.populationDensity ?? null,
    landArea: country.landArea ?? null,
    areaSqMi: country.areaSqMi ?? (country as any).newStats?.areaSqMi ?? null,
    gdpGrowth: normalizeGrowth(
      country.realGDPGrowthRate ??
        (country as any).newStats?.realGDPGrowthRate ??
        country.adjustedGdpGrowth
    ),
    popGrowth: normalizeGrowth(
      country.populationGrowthRate ?? (country as any).newStats?.populationGrowthRate
    ),
    maxGdpGrowthRate: country.maxGdpGrowthRate ?? (country as any).newStats?.maxGdpGrowthRate ?? 0,
  };

  // ── Executive Derived Stats ──
  const activePolicies = policies?.filter((p) => p.status === "active").length ?? 0;
  const pActions =
    meetings
      ?.flatMap((m) => m.actionItems ?? [])
      .filter((a) => a.status === "pending" || a.status === "PENDING").length ?? 0;

  // ── Diplomacy Derived Stats ──
  const activeEmbassies =
    embassies?.filter((e) => e.status === "ACTIVE" || e.status === "active").length ?? 0;
  const totalRelations = relations?.length ?? 0;
  const avgStrength =
    totalRelations > 0
      ? Math.round(relations!.reduce((sum, r) => sum + (r.strength ?? 0), 0) / totalRelations)
      : 0;

  // ── Politics Derived Stats ──
  const partyCount = parties?.length ?? 0;
  const totalSeats = legislature?.totalSeats ?? 0;

  // ── Intelligence Derived Stats ──
  const critAlerts = intelligenceOverview?.alerts?.critical ?? 0;

  // ── Defense Derived Stats ──
  const threats = securityData?.activeThreatCount ?? 0;
  const branchCount = militaryBranches?.length ?? 0;
  const avgReadiness =
    branchCount > 0
      ? Math.round(
          militaryBranches!.reduce((sum, b) => sum + (b.readinessLevel ?? 0), 0) / branchCount
        )
      : 0;
  const securityScore = securityData?.overallSecurityScore ?? 50;

  // ── Daily Agenda States and Items ──
  const { totalUnread: messageUnreadCount = 0 } = useMessageUnreadCount();
  const [agendaViewMode, setAgendaViewMode] = useState<"widgets" | "stack">("widgets");
  const [activeStackIndex, setActiveStackIndex] = useState(0);

  const pendingElections =
    elections?.filter(
      (e: any) =>
        e.status === "SCHEDULED" ||
        e.status === "scheduled" ||
        e.status === "IN_PROGRESS" ||
        e.status === "in_progress"
    ).length ?? 0;

  const agendaItems = useMemo(() => {
    const list: {
      id: string;
      label: string;
      text: string;
      section: MyCountrySection;
      colorClass: string;
      bgClass: string;
      borderClass: string;
      icon: any;
      priority: number;
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
        borderClass: "border-red-500/40 text-red-500 bg-red-500/5 dark:bg-red-500/10",
        icon: Crown,
        priority: 1,
      });
    } else if (issueCount > 0) {
      list.push({
        id: "exec-pending",
        label: "Cabinet Issues",
        text: `${issueCount} pending issue${issueCount !== 1 ? "s" : ""} in cabinet`,
        section: "executive",
        colorClass: "text-amber-500",
        bgClass: "hover:bg-amber-500/5",
        borderClass: "border-amber-500/40 text-amber-500 bg-amber-500/5 dark:bg-amber-500/10",
        icon: Crown,
        priority: 2,
      });
    }

    // 2. Active Policies Setup
    if (policies && policies.length > 0 && activePolicies < policies.length) {
      const inactive = policies.length - activePolicies;
      list.push({
        id: "exec-policies",
        label: "Policy Setup",
        text: `${inactive} draft/inactive polic${inactive !== 1 ? "ies" : "y"} pending`,
        section: "executive",
        colorClass: "text-emerald-500",
        bgClass: "hover:bg-emerald-500/5",
        borderClass:
          "border-emerald-500/40 text-emerald-500 bg-emerald-500/5 dark:bg-emerald-500/10",
        icon: Landmark,
        priority: 3,
      });
    }

    // 3. Meeting Action Items
    if (pActions > 0) {
      list.push({
        id: "exec-actions",
        label: "Meeting Actions",
        text: `${pActions} action item${pActions !== 1 ? "s" : ""} pending`,
        section: "executive",
        colorClass: "text-orange-500",
        bgClass: "hover:bg-orange-500/5",
        borderClass: "border-orange-500/40 text-orange-500 bg-orange-500/5 dark:bg-orange-500/10",
        icon: Layers,
        priority: 2,
      });
    }

    // 4. Unread Messages
    if (messageUnreadCount > 0) {
      list.push({
        id: "diplo-unread-messages",
        label: "Unread Messages",
        text: `${messageUnreadCount} unread message${messageUnreadCount !== 1 ? "s" : ""} in inbox`,
        section: "diplomacy",
        colorClass: "text-blue-500",
        bgClass: "hover:bg-blue-500/5",
        borderClass: "border-blue-500/40 text-blue-500 bg-blue-500/5 dark:bg-blue-500/10",
        icon: Mail,
        priority: 2,
      });
    }

    // 5. Defense Threats / Assessment
    if (threats > 0) {
      list.push({
        id: "def-threats",
        label: "Security Threats",
        text: `${threats} active threat${threats !== 1 ? "s" : ""} detected`,
        section: "defense",
        colorClass: "text-red-500",
        bgClass: "hover:bg-red-500/5",
        borderClass: "border-red-500/40 text-red-500 bg-red-500/5 dark:bg-red-500/10",
        icon: Shield,
        priority: 1,
      });
    } else if (securityScore < 60) {
      list.push({
        id: "def-low-score",
        label: "Defense Readiness",
        text: `Defense Readiness Score is low: ${securityScore}/100`,
        section: "defense",
        colorClass: "text-amber-500",
        bgClass: "hover:bg-amber-500/5",
        borderClass: "border-amber-500/40 text-amber-500 bg-amber-500/5 dark:bg-amber-500/10",
        icon: Shield,
        priority: 2,
      });
    }

    // 6. Intelligence Security Alerts
    if (critAlerts > 0) {
      list.push({
        id: "intel-critical",
        label: "Intel Security",
        text: `${critAlerts} critical intelligence alert${critAlerts !== 1 ? "s" : ""}`,
        section: "intelligence",
        colorClass: "text-red-500",
        bgClass: "hover:bg-red-500/5",
        borderClass: "border-red-500/40 text-red-500 bg-red-500/5 dark:bg-red-500/10",
        icon: Brain,
        priority: 1,
      });
    }

    // 7. Elections
    if (pendingElections > 0) {
      list.push({
        id: "pol-elections",
        label: "Elections",
        text: `${pendingElections} active/scheduled election${pendingElections !== 1 ? "s" : ""}`,
        section: "politics",
        colorClass: "text-purple-500",
        bgClass: "hover:bg-purple-500/5",
        borderClass: "border-purple-500/40 text-purple-500 bg-purple-500/5 dark:bg-purple-500/10",
        icon: Vote,
        priority: 3,
      });
    }

    // 8. Embassies Setup
    if (activeEmbassies === 0 && embassies?.length === 0) {
      list.push({
        id: "diplo-no-emb",
        label: "Diplomatic Embassies",
        text: "Establish your first embassy",
        section: "diplomacy",
        colorClass: "text-cyan-500",
        bgClass: "hover:bg-cyan-500/5",
        borderClass: "border-cyan-500/40 text-cyan-500 bg-cyan-500/5 dark:bg-cyan-500/10",
        icon: Handshake,
        priority: 3,
      });
    }

    return list;
  }, [
    urgentIssueCount,
    issueCount,
    policies,
    activePolicies,
    pActions,
    messageUnreadCount,
    threats,
    securityScore,
    critAlerts,
    pendingElections,
    activeEmbassies,
    embassies,
  ]);

  const days = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
  const months = [
    "JAN",
    "FEB",
    "MAR",
    "APR",
    "MAY",
    "JUN",
    "JUL",
    "AUG",
    "SEP",
    "OCT",
    "NOV",
    "DEC",
  ];
  // Calendar reflects in-game IxTime, not real-world time
  const today = useMemo(() => new Date(IxTime.getCurrentIxTime()), []);

  const nextEventText = useMemo(() => {
    if (pendingElections > 0) return "Election Pending";
    if (meetings?.some((m) => m.status?.toLowerCase() === "scheduled")) return "Cabinet Meet";
    if (pActions > 0) return "Action Items";
    return "All Clear";
  }, [pendingElections, meetings, pActions]);

  // ── Dynamic Alerts List ──
  const alertsList = useMemo(() => {
    const list: {
      id: string;
      section: MyCountrySection;
      type: "critical" | "warning" | "info" | "success";
      icon: any;
      text: string;
    }[] = [];

    // Diplomacy Alerts (Status-only, no agenda duplication)
    if (totalRelations > 0 && avgStrength < 40) {
      list.push({
        id: "diplo-low-strength",
        section: "diplomacy",
        type: "warning",
        icon: Handshake,
        text: `Low average diplomatic strength (${avgStrength}%)`,
      });
    }

    // Politics Alerts (Status-only, no agenda duplication)
    if (partyCount === 0) {
      list.push({
        id: "pol-no-party",
        section: "politics",
        type: "warning",
        icon: Users,
        text: "No political parties registered",
      });
    }
    if (totalSeats === 0) {
      list.push({
        id: "pol-no-seats",
        section: "politics",
        type: "warning",
        icon: Landmark,
        text: "Legislature seats not configured",
      });
    }

    // Intelligence Alerts
    if (isPremium && critAlerts > 0) {
      list.push({
        id: "intel-critical",
        section: "intelligence",
        type: "critical",
        icon: AlertTriangle,
        text: `${critAlerts} critical security alert${critAlerts !== 1 ? "s" : ""}`,
      });
    }

    // Defense Alerts
    if (isPremium) {
      if (threats > 0) {
        list.push({
          id: "def-threats",
          section: "defense",
          type: "critical",
          icon: Sword,
          text: `${threats} active border threat${threats !== 1 ? "s" : ""}`,
        });
      }
      if (avgReadiness < 60 && branchCount > 0) {
        list.push({
          id: "def-readiness",
          section: "defense",
          type: "warning",
          icon: Target,
          text: `Military readiness is low (${avgReadiness}%)`,
        });
      }
    }

    // Fallback if everything is clear
    if (list.length === 0) {
      list.push({
        id: "all-clear",
        section: "overview",
        type: "success",
        icon: Check,
        text: "All national sectors operating normally",
      });
    }

    return list;
  }, [
    totalRelations,
    avgStrength,
    partyCount,
    totalSeats,
    isPremium,
    critAlerts,
    threats,
    avgReadiness,
    branchCount,
  ]);

  const systemAlerts = useMemo(() => {
    return alertsList.filter((a) => a.id !== "all-clear");
  }, [alertsList]);

  const hasRealAlerts = systemAlerts.length > 0;

  const highestSeverity = useMemo(() => {
    if (systemAlerts.some((a) => a.type === "critical")) return "critical";
    if (systemAlerts.some((a) => a.type === "warning")) return "warning";
    return "info";
  }, [systemAlerts]);

  const triggerColorClass =
    highestSeverity === "critical"
      ? "border-red-500/30 bg-red-500/5 hover:bg-red-500/10 text-red-600 dark:text-red-400"
      : highestSeverity === "warning"
        ? "border-amber-500/30 bg-amber-500/5 hover:bg-amber-500/10 text-amber-600 dark:text-amber-400"
        : "border-blue-500/30 bg-blue-500/5 hover:bg-blue-500/10 text-blue-600 dark:text-blue-400";

  if (!country) return null;

  if (collapsed) {
    return (
      <div className="glass-surface glass-refraction bg-card/65 relative flex flex-wrap items-center justify-between gap-3 overflow-hidden rounded-xl border border-white/5 p-3 shadow-sm backdrop-blur-md">
        {/* Neon Frame Overlay */}
        {neonFrame.enabled && (
          <motion.div
            className="pointer-events-none absolute inset-0 z-20 rounded-xl"
            style={{
              border: `2px solid ${neonFrame.color}`,
              boxShadow: `0 0 12px ${neonFrame.color}, inset 0 0 8px ${neonFrame.color}`,
            }}
            animate={
              neonFrame.style === "pulse"
                ? {
                    opacity: [0.5, 1, 0.5],
                  }
                : undefined
            }
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
        )}
        <TextureOverlay texture="paperGrain" opacity={0.09} />

        <div className="relative z-10 flex items-center gap-3">
          <div
            className="relative flex shrink-0 items-center justify-center rounded-sm"
            style={
              avatarGlow.enabled
                ? {
                    boxShadow: `0 0 ${avatarGlow.intensity} ${avatarGlow.color}`,
                    border: `1px solid ${avatarGlow.color}`,
                  }
                : undefined
            }
          >
            <div className="flex items-center justify-center overflow-hidden rounded-sm">
              <UnifiedCountryFlag
                showTooltip={false}
                countryName={stats.countryName}
                size="md"
                className="shrink-0"
              />
            </div>
          </div>
          <div>
            <span className="text-foreground text-sm font-bold">
              {stats.countryName.replace(/_/g, " ")}
            </span>
            <span className="text-muted-foreground/60 ml-2 hidden text-xs sm:inline">
              — {stats.leader}
            </span>
          </div>
        </div>

        <div className="relative z-10 flex items-center gap-4 text-xs">
          <div className="hidden items-center gap-4 md:flex">
            <div>
              <span className="text-muted-foreground/60 block text-[9px] font-semibold tracking-wider uppercase">
                GDP/Cap
              </span>
              <span className="text-foreground font-bold">
                ${Math.round(stats.gdpPerCapita).toLocaleString("en-US")}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground/60 block text-[9px] font-semibold tracking-wider uppercase">
                Population
              </span>
              <span className="text-foreground font-bold">
                {Math.round(stats.population).toLocaleString("en-US")}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground/60 block text-[9px] font-semibold tracking-wider uppercase">
                Land Area
              </span>
              <span className="text-foreground font-bold">
                {stats.landArea ? `${Math.round(stats.landArea).toLocaleString()} km²` : "N/A"}
              </span>
            </div>
          </div>
          <button
            onClick={() => onCollapsedChange(false)}
            className="text-muted-foreground hover:bg-muted/30 border-border/40 flex cursor-pointer items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs transition-colors"
          >
            {agendaItems.length > 0 && (
              <span className="flex h-4 min-w-4 animate-pulse items-center justify-center rounded-full bg-amber-500 px-1 text-[9px] font-bold text-black">
                {agendaItems.length}
              </span>
            )}
            <span>Expand Overview</span>
            <ChevronDown className="h-3.5 w-3.5 shrink-0" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="glass-surface glass-refraction bg-card/65 relative overflow-hidden rounded-xl border border-white/5 shadow-sm backdrop-blur-md">
      {/* Neon Frame Overlay */}
      {neonFrame.enabled && (
        <motion.div
          className="pointer-events-none absolute inset-0 z-20 rounded-xl"
          style={{
            border: `2px solid ${neonFrame.color}`,
            boxShadow: `0 0 12px ${neonFrame.color}, inset 0 0 8px ${neonFrame.color}`,
          }}
          animate={
            neonFrame.style === "pulse"
              ? {
                  opacity: [0.5, 1, 0.5],
                }
              : undefined
          }
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      )}
      <TextureOverlay texture="paperGrain" opacity={0.09} />

      <button
        onClick={() => onCollapsedChange(true)}
        className="text-muted-foreground hover:bg-muted/30 border-border/20 relative z-10 flex w-full cursor-pointer items-center justify-end border-b px-4 py-1.5 text-[10px] transition-colors"
      >
        <ChevronUp className="h-3 w-3 shrink-0" />
      </button>

      <div className="relative z-10 grid gap-4 p-4 pt-3 md:grid-cols-5">
        <div className="border-border/30 flex h-[250px] flex-col overflow-hidden rounded-xl border md:col-span-3 md:h-full md:min-h-[300px]">
          <CountryMapEmbed
            countryId={countryId}
            height="h-full"
            className="w-full flex-1"
            showNeighbors={true}
            showCities={true}
            showSubdivisions={true}
            interactive={true}
            boundsPadding={30}
          />
        </div>

        <div className="relative z-10 flex h-full flex-col justify-between gap-3 overflow-hidden rounded-xl border border-amber-500/20 bg-amber-500/[0.04] p-3 shadow-[0_0_15px_rgba(245,158,11,0.05)] backdrop-blur-md md:col-span-2 dark:border-amber-500/30 dark:bg-amber-950/[0.18] dark:shadow-[0_0_20px_rgba(245,158,11,0.07)]">
          <div className="flex h-full flex-col justify-between">
            {/* Header */}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Badge
                    variant="outline"
                    className="h-4.5 rounded-full border-amber-500/20 bg-gradient-to-r from-amber-500/10 to-orange-500/10 px-2 py-0.5 text-[9px] font-black tracking-wider text-amber-600 uppercase shadow-[0_0_8px_rgba(245,158,11,0.1)] dark:from-amber-950/30 dark:to-orange-950/30 dark:text-amber-400"
                  >
                    MyCountry®
                  </Badge>
                  {isPremium && (
                    <Badge
                      variant="outline"
                      className="h-4.5 rounded border-amber-500/30 bg-amber-500/15 px-1.5 py-0.5 text-[8px] font-bold tracking-widest text-amber-600 uppercase dark:text-amber-400"
                    >
                      Premium
                    </Badge>
                  )}
                  <span className="text-muted-foreground/30 text-[9px]">/</span>
                  <span className="text-muted-foreground/60 text-[9px] font-bold tracking-wider uppercase">
                    Overview
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <HeroHelpModal
                    title="MyCountry guide"
                    steps={MYCOUNTRY_HELP_STEPS}
                    accentClass="text-amber-500"
                    className="h-6 w-6"
                  />
                  <button
                    onClick={() =>
                      setAgendaViewMode((v) => (v === "widgets" ? "stack" : "widgets"))
                    }
                    title={
                      agendaViewMode === "widgets"
                        ? "Switch to Smart Stack"
                        : "Switch to Split Widgets"
                    }
                    className="text-muted-foreground hover:text-foreground rounded border border-white/5 p-1 transition-all hover:bg-white/5 active:scale-95"
                  >
                    <Layers className="h-3 w-3" />
                  </button>
                  <div className="flex items-center gap-1 rounded border border-emerald-500/10 bg-emerald-500/5 px-1.5 py-0.5 text-[8px] font-semibold text-emerald-500 dark:bg-emerald-500/10 dark:text-emerald-400/90">
                    <span className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-emerald-500" />
                    <span>ONLINE</span>
                  </div>
                </div>
              </div>

              <div className="mb-2.5 flex items-center gap-2.5">
                <div
                  className="relative flex shrink-0 items-center justify-center rounded-sm"
                  style={
                    avatarGlow.enabled
                      ? {
                          boxShadow: `0 0 ${avatarGlow.intensity} ${avatarGlow.color}`,
                          border: `1px solid ${avatarGlow.color}`,
                        }
                      : undefined
                  }
                >
                  <div className="flex items-center justify-center overflow-hidden rounded-sm">
                    <UnifiedCountryFlag
                      showTooltip={false}
                      countryName={stats.countryName}
                      size="lg"
                      className="shrink-0"
                    />
                  </div>
                </div>
                <div>
                  <Link
                    href={createUrl(`/countries/${stats.slug}`)}
                    className="flex items-center gap-1.5 text-sm font-bold hover:underline"
                  >
                    <span>{stats.countryName.replace(/_/g, " ")}</span>
                    {chatBadge.enabled && (
                      <CrownIcon
                        className="h-3.5 w-3.5 shrink-0"
                        style={{ color: chatBadge.color }}
                      />
                    )}
                  </Link>
                  <p className="text-muted-foreground text-[10px]">{stats.leader}</p>
                </div>
              </div>

              {/* Action Button Row */}
              <div className="mt-3 mb-3.5 flex gap-2">
                <Link href={createUrl("/mycountry/editor")} className="flex-1">
                  <Button
                    variant="default"
                    size="sm"
                    className="w-full h-8 cursor-pointer gap-1.5 border border-amber-500/30 bg-amber-500/10 text-xs font-bold text-amber-500 hover:bg-amber-500/20 active:scale-[0.98] transition-all"
                  >
                    <Edit3 className="h-3.5 w-3.5" />
                    Edit Country
                  </Button>
                </Link>
                <Link href={createUrl(`/countries/${stats.slug}`)} className="flex-1">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full h-8 cursor-pointer gap-1.5 border-white/10 hover:bg-white/10 hover:text-white text-xs font-bold active:scale-[0.98] transition-all"
                  >
                    <Eye className="h-3.5 w-3.5" />
                    View Profile
                  </Button>
                </Link>
              </div>

              {/* Apple-style Daily Agenda Widget */}
              <div className="mt-2 mb-3">
                {agendaViewMode === "widgets" ? (
                  <div className="grid h-[105px] grid-cols-5 gap-2.5">
                    {/* Left Column: iOS Calendar widget */}
                    <div className="col-span-2 flex h-full flex-col overflow-hidden rounded-xl border border-white/10 bg-white/[0.03] shadow-inner backdrop-blur-md select-none">
                      <div className="bg-red-500 px-1 py-0.5 text-center text-[8px] leading-none font-extrabold tracking-widest text-white uppercase">
                        {months[today.getMonth()]}
                      </div>
                      <div className="flex flex-grow flex-col items-center justify-center p-1">
                        <span className="text-[8px] leading-none font-bold tracking-wider text-red-500 uppercase">
                          {days[today.getDay()]}
                        </span>
                        <span className="text-foreground mt-0.5 text-xl leading-none font-black tracking-tighter">
                          {today.getDate()}
                        </span>
                        <span className="text-muted-foreground/60 mt-1 max-w-full truncate px-1 text-center text-[7px] font-semibold tracking-tight uppercase">
                          Up Next: {nextEventText}
                        </span>
                      </div>
                    </div>

                    {/* Right Column: iOS Reminders widget */}
                    <div className="col-span-3 flex h-full flex-col justify-between rounded-xl border border-white/10 bg-white/[0.03] p-2">
                      <div className="text-muted-foreground/60 mb-1 flex items-center justify-between text-[8px] font-extrabold tracking-wider uppercase">
                        <span>Reminders</span>
                        <span className="text-foreground/80 rounded-full bg-white/10 px-1 text-[7px] font-bold">
                          {agendaItems.length}
                        </span>
                      </div>

                      <div className="flex-1 scrollbar-thin space-y-1 overflow-y-auto pr-0.5">
                        {agendaItems.length > 0 ? (
                          agendaItems.slice(0, 3).map((item) => {
                            return (
                              <button
                                key={item.id}
                                onClick={() => onNavigate?.(item.section)}
                                className="group text-foreground/80 hover:text-foreground flex w-full items-center gap-1.5 rounded px-1 py-0.5 text-left text-[9px] font-medium transition-colors hover:bg-white/[0.05] active:scale-[0.98]"
                              >
                                <div
                                  className={cn(
                                    "flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border transition-all",
                                    item.borderClass
                                  )}
                                >
                                  <Check className="h-2 w-2 scale-0 transition-transform group-hover:scale-100" />
                                </div>
                                <span className="flex-1 truncate">{item.text}</span>
                              </button>
                            );
                          })
                        ) : (
                          <div className="flex h-full flex-col items-center justify-center p-1 text-center text-emerald-500/80">
                            <Check className="mb-0.5 h-4 w-4" />
                            <span className="text-[8px] font-medium">All Tasks Complete</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  // SMART STACK VIEW
                  <div className="relative flex h-[105px] w-full items-center justify-between overflow-hidden rounded-xl border border-white/10 bg-white/[0.03] p-2.5 backdrop-blur-md">
                    {agendaItems.length > 0 ? (
                      (() => {
                        const currentStackItem = agendaItems[activeStackIndex] ?? agendaItems[0];
                        if (!currentStackItem) return null;
                        const ItemIcon = currentStackItem.icon;
                        return (
                          <div className="flex w-full items-center gap-3">
                            <div
                              className={cn(
                                "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border",
                                currentStackItem.borderClass
                              )}
                            >
                              <ItemIcon className="h-5 w-5" />
                            </div>
                            <div className="min-w-0 flex-1 pr-6">
                              <span className="text-muted-foreground/60 text-[8px] font-bold tracking-wider uppercase">
                                {currentStackItem.label}
                              </span>
                              <p className="text-foreground mt-0.5 truncate text-[10px] leading-tight font-semibold">
                                {currentStackItem.text}
                              </p>
                              <button
                                onClick={() => onNavigate?.(currentStackItem.section)}
                                className="mt-1 flex items-center gap-0.5 text-[8px] font-bold text-amber-500 hover:text-amber-400 hover:underline"
                              >
                                Resolve Task <ChevronRight className="h-2.5 w-2.5" />
                              </button>
                            </div>
                          </div>
                        );
                      })()
                    ) : (
                      <div className="flex w-full flex-col items-center justify-center py-2 text-center text-emerald-500">
                        <Check className="mb-1 h-5 w-5" />
                        <span className="text-[10px] font-bold">
                          All sectors operating normally
                        </span>
                        <p className="text-muted-foreground/60 mt-0.5 text-[8px]">
                          Your daily agenda is completely clear.
                        </p>
                      </div>
                    )}

                    {/* Pagination for Smart Stack */}
                    {agendaItems.length > 1 && (
                      <div className="absolute top-0 right-2 bottom-0 z-20 flex flex-col justify-center gap-1">
                        <button
                          onClick={() =>
                            setActiveStackIndex(
                              (prev) => (prev - 1 + agendaItems.length) % agendaItems.length
                            )
                          }
                          className="text-muted-foreground/50 hover:text-foreground/80 p-0.5 transition-colors active:scale-90"
                        >
                          <ChevronUp className="h-3 w-3" />
                        </button>
                        <div className="my-0.5 flex flex-col items-center gap-1">
                          {agendaItems.map((_, idx) => (
                            <div
                              key={idx}
                              className={cn(
                                "h-1 w-1 rounded-full transition-all duration-300",
                                idx === activeStackIndex ? "scale-125 bg-amber-500" : "bg-white/20"
                              )}
                            />
                          ))}
                        </div>
                        <button
                          onClick={() =>
                            setActiveStackIndex((prev) => (prev + 1) % agendaItems.length)
                          }
                          className="text-muted-foreground/50 hover:text-foreground/80 p-0.5 transition-colors active:scale-90"
                        >
                          <ChevronDown className="h-3 w-3" />
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Dropdown Alerts Inline */}
              <div className="relative z-20">
                {hasRealAlerts ? (
                  <div className="flex flex-col gap-1">
                    <button
                      onClick={() => setAlertsOpen(!alertsOpen)}
                      className={cn(
                        "flex w-full cursor-pointer items-center justify-between gap-2 rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold transition-all",
                        triggerColorClass
                      )}
                    >
                      <div className="flex items-center gap-1.5">
                        <AlertTriangle className="h-3.5 w-3.5 shrink-0 animate-pulse text-amber-500 dark:text-amber-400" />
                        <span>
                          {systemAlerts.length} System Alert{systemAlerts.length !== 1 ? "s" : ""}{" "}
                          Active
                        </span>
                      </div>
                      {alertsOpen ? (
                        <ChevronUp className="h-3 w-3 shrink-0 opacity-70" />
                      ) : (
                        <ChevronDown className="h-3 w-3 shrink-0 opacity-70" />
                      )}
                    </button>

                    {alertsOpen && (
                      <div className="border-border/20 animate-in fade-in slide-in-from-top-1 mt-1 flex max-h-[90px] scrollbar-thin flex-col gap-1 overflow-y-auto rounded-lg border bg-black/5 p-1.5 duration-150 dark:bg-white/[0.02]">
                        {systemAlerts.map((alert) => {
                          const Icon = alert.icon;
                          const severityColor =
                            alert.type === "critical"
                              ? "border-red-500/10 bg-red-500/5 hover:bg-red-500/10 text-red-600 dark:text-red-400"
                              : alert.type === "warning"
                                ? "border-amber-500/10 bg-amber-500/5 hover:bg-amber-500/10 text-amber-600 dark:text-amber-400"
                                : "border-blue-500/10 bg-blue-500/5 hover:bg-blue-500/10 text-blue-600 dark:text-blue-400";
                          return (
                            <button
                              key={alert.id}
                              onClick={() => {
                                setAlertsOpen(false);
                                if (onNavigate) {
                                  onNavigate(alert.section);
                                }
                              }}
                              className={cn(
                                "flex w-full cursor-pointer items-center gap-2 rounded-md border p-1.5 text-left text-[10px] transition-all",
                                severityColor
                              )}
                            >
                              <Icon className="h-3 w-3 shrink-0" />
                              <span className="flex-1 truncate font-medium">{alert.text}</span>
                              <ChevronRight className="h-3 w-3 shrink-0 opacity-40" />
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ) : null}
              </div>

              {/* Civil Service Capacity + Rollout Queue */}
              <CivilServiceWidget
                countryId={countryId}
                enabled={hasCountry}
                onNavigate={onNavigate}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
