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
} from "lucide-react";
import * as LucideIcons from "lucide-react";
import { useActiveCosmetics } from "~/hooks/useActiveCosmetics";
import { api } from "~/trpc/react";
import { UnifiedCountryFlag } from "~/components/UnifiedCountryFlag";
import { createUrl } from "~/lib/url-utils";
import { cn } from "~/lib/utils";
import { TextureOverlay } from "~/components/ui/texture-overlay";
import { LocationBadge } from "~/components/ui/tier-badge";
import { Badge } from "~/components/ui/badge";
import { usePremium } from "~/hooks/usePremium";
import { useCountryData } from "./primitives";
import { useIssueCount } from "~/hooks/useNationalIssues";
import type { MyCountrySection } from "./MyCountrySidebarNav";
import { HealthRing } from "~/components/ui/health-ring";

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

const indicatorColor = (label: string) => {
  switch (label.toLowerCase()) {
    case "exec":
      return "#f59e0b"; // Amber
    case "diplo":
      return "#06b6d4"; // Cyan
    case "pol":
      return "#8b5cf6"; // Purple/Violet
    case "intel":
      return "#3b82f6"; // Blue
    case "def":
      return "#ef4444"; // Red
    default:
      return "#10b981"; // Green
  }
};

function StatusIndicator({
  icon: Icon,
  label,
  health,
}: {
  icon: any;
  label: string;
  health: number;
}) {
  const status = health < 40 ? "critical" : health < 70 ? "warning" : "healthy";
  const colorClass =
    status === "critical"
      ? "text-red-500 bg-red-500/10 border-red-500/20"
      : status === "warning"
        ? "text-amber-500 bg-amber-500/10 border-amber-500/20"
        : "text-emerald-500 bg-emerald-500/10 border-emerald-500/20";
  return (
    <div
      className={cn(
        "flex flex-1 flex-col items-center rounded-lg border px-1 py-1 text-center text-[9px] font-semibold transition-colors",
        colorClass
      )}
    >
      <div className="relative mb-0.5 flex h-8 w-8 shrink-0 items-center justify-center">
        <div className="absolute inset-0 flex items-center justify-center">
          <HealthRing value={health} size={32} color={indicatorColor(label)} hideValue={true} />
        </div>
        <Icon className="relative z-10 h-3 w-3 shrink-0" style={{ color: indicatorColor(label) }} />
      </div>
      <span>{Math.round(health)}%</span>
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
  const { data: parliament } = api.elections.getCurrentParliament.useQuery(
    { countryId },
    { enabled: hasCountry }
  );
  const { data: elections } = api.elections.getElections.useQuery(
    { countryId },
    { enabled: hasCountry }
  );

  // Intelligence (Premium)
  const { data: defenseOverview } = api.security.getDefenseOverview.useQuery(
    { countryId },
    { enabled: hasCountry && isPremium }
  );
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
  const activeMeetings =
    meetings?.filter((m) => m.status === "in_progress" || m.status === "IN_PROGRESS").length ?? 0;
  const pActions =
    meetings
      ?.flatMap((m) => m.actionItems ?? [])
      .filter((a) => a.status === "pending" || a.status === "PENDING").length ?? 0;
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
          Math.min(pActions * 2, 10)
      )
    )
  );

  // ── Diplomacy Derived Stats ──
  const activeEmbassies =
    embassies?.filter((e) => e.status === "ACTIVE" || e.status === "active").length ?? 0;
  const totalRelations = relations?.length ?? 0;
  const avgStrength =
    totalRelations > 0
      ? Math.round(relations!.reduce((sum, r) => sum + (r.strength ?? 0), 0) / totalRelations)
      : 0;
  const totalEmbassies = embassies?.length ?? 0;
  const embassyRatio = totalEmbassies > 0 ? activeEmbassies / totalEmbassies : 0;
  const diplomaticHealth = Math.max(
    0,
    Math.min(
      100,
      Math.round(avgStrength * 0.5 + embassyRatio * 30 + Math.min(totalRelations * 2, 20))
    )
  );

  // ── Politics Derived Stats ──
  const partyCount = parties?.length ?? 0;
  const totalSeats = legislature?.totalSeats ?? 0;
  const filledSeats =
    parliament?.seatSummary?.reduce((sum: number, s: any) => sum + s.seats, 0) ?? 0;
  const pendingElections =
    elections?.filter(
      (e: any) =>
        e.status === "SCHEDULED" ||
        e.status === "scheduled" ||
        e.status === "IN_PROGRESS" ||
        e.status === "in_progress"
    ).length ?? 0;
  const politicsHealth = Math.max(
    0,
    Math.min(
      100,
      Math.round(
        50 +
          Math.min(partyCount * 10, 30) +
          (totalSeats > 0 ? Math.min((filledSeats / totalSeats) * 30, 30) : 0) -
          (pendingElections > 0 ? 10 : 0)
      )
    )
  );

  // ── Intelligence Derived Stats ──
  const critAlerts = intelligenceOverview?.alerts?.critical ?? 0;
  const totalAlerts = intelligenceOverview?.alerts?.total ?? 0;
  const otherAlerts = Math.max(totalAlerts - critAlerts, 0);
  const defOverviewScore = defenseOverview?.overallScore ?? 50;
  const intelligenceHealth = Math.max(
    0,
    Math.min(
      100,
      Math.round(defOverviewScore - Math.min(critAlerts * 10, 20) - Math.min(otherAlerts * 2, 10))
    )
  );

  // ── Defense Derived Stats ──
  const threats = securityData?.activeThreatCount ?? 0;
  const branchCount = militaryBranches?.length ?? 0;
  const avgReadiness =
    branchCount > 0
      ? Math.round(
          militaryBranches!.reduce((sum, b) => sum + (b.readinessLevel ?? 0), 0) / branchCount
        )
      : 0;
  const securityScore = securityData?.securityScore ?? 50;
  const defenseHealth = Math.max(
    0,
    Math.min(100, Math.round(securityScore * 0.6 + avgReadiness * 0.4))
  );

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
            className="relative flex shrink-0 items-center justify-center overflow-hidden rounded-sm"
            style={
              avatarGlow.enabled
                ? {
                    boxShadow: `0 0 ${avatarGlow.intensity} ${avatarGlow.color}`,
                    border: `1px solid ${avatarGlow.color}`,
                  }
                : undefined
            }
          >
            <UnifiedCountryFlag
              showTooltip={false}
              countryName={stats.countryName}
              size="md"
              className="shrink-0"
            />
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
                {stats.landArea ? `${stats.landArea.toLocaleString()} km²` : "N/A"}
              </span>
            </div>
          </div>
          <button
            onClick={() => onCollapsedChange(false)}
            className="text-muted-foreground hover:bg-muted/30 border-border/40 flex cursor-pointer items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs transition-colors"
          >
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
      <button
        onClick={() => onCollapsedChange(true)}
        className="text-muted-foreground hover:bg-muted/30 border-border/20 relative z-10 flex w-full cursor-pointer items-center justify-end border-b px-4 py-1.5 text-[10px] transition-colors"
      >
        <ChevronUp className="h-3 w-3 shrink-0" />
      </button>

      <div className="relative z-10 grid gap-4 p-4 pt-3 md:grid-cols-5">
        <div className="border-border/30 overflow-hidden rounded-xl border md:col-span-3">
          <CountryMapEmbed
            countryId={countryId}
            height="h-52"
            showNeighbors={true}
            showCities={true}
            interactive={true}
            boundsPadding={30}
          />
        </div>

        <div className="relative z-10 flex h-full flex-col justify-between gap-3 overflow-hidden rounded-xl border border-amber-500/10 bg-amber-500/[0.01] p-3 shadow-[0_0_15px_rgba(245,158,11,0.03)] md:col-span-2 dark:border-amber-500/25 dark:bg-amber-950/[0.05] dark:shadow-[0_0_20px_rgba(245,158,11,0.05)]">
          <TextureOverlay texture="paperGrain" opacity={0.09} />

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
                <div className="flex items-center gap-1 rounded border border-emerald-500/10 bg-emerald-500/5 px-1.5 py-0.5 text-[8px] font-semibold text-emerald-500 dark:bg-emerald-500/10 dark:text-emerald-400/90">
                  <span className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-emerald-500" />
                  <span>ONLINE</span>
                </div>
              </div>

              <div className="mb-2.5 flex items-center gap-2.5">
                <div
                  className="relative flex shrink-0 items-center justify-center overflow-hidden rounded-sm"
                  style={
                    avatarGlow.enabled
                      ? {
                          boxShadow: `0 0 ${avatarGlow.intensity} ${avatarGlow.color}`,
                          border: `1px solid ${avatarGlow.color}`,
                        }
                      : undefined
                  }
                >
                  <UnifiedCountryFlag
                    showTooltip={false}
                    countryName={stats.countryName}
                    size="lg"
                    className="shrink-0"
                  />
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

              {/* Status Row */}
              <div className="mt-1.5 mb-3 flex justify-between gap-1.5">
                <StatusIndicator icon={Crown} label="Exec" health={executiveHealth} />
                <StatusIndicator icon={Users} label="Diplo" health={diplomaticHealth} />
                <StatusIndicator icon={Vote} label="Pol" health={politicsHealth} />
                {isPremium && (
                  <>
                    <StatusIndicator icon={Brain} label="Intel" health={intelligenceHealth} />
                    <StatusIndicator icon={Shield} label="Def" health={defenseHealth} />
                  </>
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
                ) : (
                  <div className="flex w-full items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-1.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                    <Check className="h-3.5 w-3.5 shrink-0" />
                    <span>All systems operational</span>
                  </div>
                )}
              </div>
            </div>

            {/* Badges */}
            <div className="border-border/10 mt-3 flex gap-1.5 border-t pt-2">
              {stats.continent && <LocationBadge type="continent" value={stats.continent} />}
              {stats.governmentType && (
                <LocationBadge type="government" value={stats.governmentType} />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
