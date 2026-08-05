"use client";

import { useMemo } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import {
  ChevronUp,
  ChevronDown,
  Check,
  AlertTriangle,
  Layers,
  Briefcase,
  Clock,
  Edit3,
  Sparkles,
} from "lucide-react";
import * as LucideIcons from "lucide-react";
import { Button } from "~/components/ui/button";
import { useActiveCosmetics } from "~/hooks/useActiveCosmetics";
import { AvatarGlow } from "~/components/vault/AvatarGlow";
import { NeonFrameOverlay } from "~/components/vault/NeonFrameOverlay";
import { api } from "~/trpc/react";
import { UnifiedCountryFlag } from "~/components/UnifiedCountryFlag";
import { createUrl } from "~/lib/url-utils";
import { IxTime } from "~/lib/ixtime";
import { getUpcomingEvents, formatRelativeIxDays } from "~/lib/statecraft-calendar";
import { cn } from "~/lib/utils";
import { TextureOverlay } from "~/components/ui/texture-overlay";
import { Badge } from "~/components/ui/badge";
import { usePremium } from "~/hooks/usePremium";
import { useCountryData } from "./primitives";
import {
  QuickVitalityRings,
  createVitalityRingsFromCountry,
} from "./primitives/tabs/VitalityRingsDisplay";
import { useIssueCount } from "~/hooks/useNationalIssues";
import { useMessageUnreadCount } from "~/hooks/useMessageUnreadCount";
import type { MyCountrySection } from "./MyCountrySidebarNav";
import { SmartStack, buildAgendaItems } from "./SmartStack";
import { ChangedSinceChip } from "./ChangedSinceChip";
import { HeroHelpModal, type HeroHelpStep } from "~/components/ui/hero-help-modal";

const MYCOUNTRY_HELP_STEPS: HeroHelpStep[] = [
  {
    title: "Welcome to MyCountry V2",
    body: "Steer your nation from the executive desk. Propose bold intents, schedule cabinet deliberations, respond to dynamic national issues, and inspect the living ledger feed.",
  },
  {
    title: "Declare Player Intents",
    body: "Use the Intent Composer to state plain-language goals. You can commit options immediately (active), or choose 'Propose as Cabinet Goal' to defer to a formal meeting.",
  },
  {
    title: "Convene & Deliberate Meetings",
    body: "Schedule cabinet sessions for proposed intents. Opening a scheduled meeting presents Measured, Moderate, and Extreme ministry options—authorizing one commits budget lines, active policies, and completes the session.",
  },
  {
    title: "National Issues & Resistance",
    body: "Active intents generate thematic national issues with 2.0x probability. Diplomatic/foreign affairs issues dynamically load actual neighbor and target country leaders, GDPs, and regions from the database.",
  },
  {
    title: "The Living Ledger & Vitality",
    body: "Every decision or issue outcome goes through the event spine. Changes print immediately to the News Feed as ledger audits, steering the compact Vitality Rings in your header.",
  },
  {
    title: "Diplomacy, Defense & Map Editor",
    body: "Manage embassies, build military readiness, or launch the Map Editor to claim territory and layout borders dynamically. Everything updates in real time.",
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
  v2?: boolean;
  onIssueDirective?: (goal?: string) => void;
  agendaViewMode?: "widgets" | "stack";
  onAgendaViewModeChange?: (mode: "widgets" | "stack") => void;
}

// ── Normalize growth rates that may be stored as raw decimals ──
function normalizeGrowth(value: number | null | undefined): number {
  if (!value || !isFinite(value)) return 0;
  let v = value;
  while (Math.abs(v) > 50) v /= 100;
  return Math.min(20, Math.max(-20, v));
}

// ── Format number compactly (e.g. Millions/Billions) ──
function formatCompact(num: number): string {
  if (num >= 1e12) return `${(num / 1e12).toFixed(2)}T`;
  if (num >= 1e9) return `${(num / 1e9).toFixed(2)}B`;
  if (num >= 1e6) return `${(num / 1e6).toFixed(2)}M`;
  return num.toLocaleString();
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
  v2 = false,
  onIssueDirective,
  agendaViewMode = "widgets",
  onAgendaViewModeChange,
}: OverviewHeroProps) {
  const { country } = useCountryData();
  const { isPremium } = usePremium();
  const { avatarGlow, chatBadge, neonFrame } = useActiveCosmetics();
  const CrownIcon = (LucideIcons as any)[chatBadge.icon] || LucideIcons.Crown;

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

  // Politics
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

  // ── Intelligence Derived Stats ──
  const critAlerts = intelligenceOverview?.alerts?.critical ?? 0;

  // ── Defense Derived Stats ──
  const threats = securityData?.activeThreatCount ?? 0;
  const securityScore = securityData?.overallSecurityScore ?? 50;

  // ── Daily Agenda States and Items ──
  const { totalUnread: messageUnreadCount = 0 } = useMessageUnreadCount();
  // Lifted agendaViewMode state to parent props

  const pendingElections =
    elections?.filter(
      (e: any) =>
        e.status === "SCHEDULED" ||
        e.status === "scheduled" ||
        e.status === "IN_PROGRESS" ||
        e.status === "in_progress"
    ).length ?? 0;

  const agendaItems = useMemo(
    () =>
      buildAgendaItems({
        urgentIssueCount,
        issueCount,
        policiesTotal: policies?.length ?? 0,
        activePolicies,
        pendingActions: pActions,
        messageUnreadCount,
        threats,
        securityScore,
        critAlerts,
        pendingElections,
        noEmbassies: activeEmbassies === 0 && embassies?.length === 0,
      }),
    [
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
    ]
  );

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

  // Statecraft Almanac feed — the upcoming dated events (shared with the Halo clock,
  // see plans/statecraft-stage1.md). Fed from data the hero already loads; no new query.
  const upcomingEvents = useMemo(
    () =>
      getUpcomingEvents({
        nowIxTime: IxTime.getCurrentIxTime(),
        elections: elections?.map((e) => ({
          id: e.id,
          name: e.name,
          scheduledIxTime: e.scheduledIxTime,
          status: e.status,
        })),
      }),
    [elections]
  );

  const nextEventText = useMemo(() => {
    const next = upcomingEvents[0];
    if (next)
      return `${next.label} ${formatRelativeIxDays(next.ixTime, IxTime.getCurrentIxTime())}`;
    if (pendingElections > 0) return "Election Pending";
    if (meetings?.some((m) => m.status?.toLowerCase() === "scheduled")) return "Cabinet Meet";
    if (pActions > 0) return "Action Items";
    return "All Clear";
  }, [upcomingEvents, pendingElections, meetings, pActions]);

  if (!country) return null;

  if (collapsed) {
    return (
      <div className="glass-surface glass-refraction bg-card/65 relative flex flex-wrap items-center justify-between gap-3 overflow-hidden rounded-xl border border-white/5 p-3 shadow-sm backdrop-blur-md">
        {/* Neon Frame Overlay */}
        <NeonFrameOverlay neonFrame={neonFrame} className="rounded-xl" />
        <TextureOverlay texture="paperGrain" opacity={0.09} />

        <div className="relative z-10 flex items-center gap-3">
          <AvatarGlow avatarGlow={avatarGlow} roundedClass="rounded-sm">
            <div className="flex items-center justify-center overflow-hidden rounded-sm">
              <UnifiedCountryFlag
                showTooltip={false}
                countryName={stats.countryName}
                size="md"
                className="shrink-0"
              />
            </div>
          </AvatarGlow>
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

          {/* Actions — v2 collapses by default, so the primary actions live on the bar */}
          {v2 && (
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="default"
                size="sm"
                onClick={() => onIssueDirective?.()}
                className="h-8 min-w-[100px] cursor-pointer gap-1 border border-amber-500/30 bg-amber-500/10 text-xs font-bold text-amber-500 transition-all hover:bg-amber-500/20 active:scale-[0.98]"
              >
                <Sparkles className="h-3.5 w-3.5" />
                Directive
              </Button>
              <Link href={createUrl("/mycountry/editor")} className="min-w-[100px]">
                <Button
                  variant="default"
                  size="sm"
                  className="h-8 w-full cursor-pointer gap-1.5 border border-amber-500/30 bg-amber-500/10 text-xs font-bold text-amber-500 transition-all hover:bg-amber-500/20 active:scale-[0.98]"
                >
                  <Edit3 className="h-3.5 w-3.5" />
                  Edit Country
                </Button>
              </Link>
            </div>
          )}

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
      <NeonFrameOverlay neonFrame={neonFrame} className="rounded-xl" />
      <TextureOverlay texture="paperGrain" opacity={0.09} />

      <button
        onClick={() => onCollapsedChange(true)}
        className="text-muted-foreground hover:bg-muted/30 border-border/20 relative z-10 flex w-full cursor-pointer items-center justify-end border-b px-4 py-1.5 text-[10px] transition-colors"
      >
        <ChevronUp className="h-3 w-3 shrink-0" />
      </button>

      <div className="relative z-10 grid gap-4 p-4 pt-3 md:grid-cols-5">
        <div className="border-border/30 flex h-[250px] flex-col overflow-hidden rounded-xl border md:col-span-3 md:h-full md:min-h-[320px]">
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

        <div className="relative z-10 flex flex-col justify-between gap-3 overflow-hidden rounded-xl border border-amber-500/20 bg-amber-500/[0.04] p-3 pb-4 shadow-[0_0_15px_rgba(245,158,11,0.05)] backdrop-blur-md md:col-span-2 md:h-auto md:min-h-[320px] dark:border-amber-500/30 dark:bg-amber-950/[0.18] dark:shadow-[0_0_20px_rgba(245,158,11,0.07)]">
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
                      onAgendaViewModeChange?.(agendaViewMode === "widgets" ? "stack" : "widgets")
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
                  <Link
                    href={createUrl(`/countries/${stats.slug}`)}
                    className="text-foreground/80 flex items-center gap-1 rounded border border-white/5 bg-white/[0.03] px-2 py-0.5 text-[9px] font-bold shadow-sm transition-all hover:bg-white/[0.08] active:scale-95"
                  >
                    View Profile
                  </Link>
                </div>
              </div>

              <div className="mb-2.5 flex items-center gap-2.5">
                <AvatarGlow avatarGlow={avatarGlow} roundedClass="rounded-sm">
                  <div className="flex items-center justify-center overflow-hidden rounded-sm">
                    <UnifiedCountryFlag
                      showTooltip={false}
                      countryName={stats.countryName}
                      size="lg"
                      className="shrink-0"
                    />
                  </div>
                </AvatarGlow>
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
                  <div className="mt-1">
                    <ChangedSinceChip countryId={countryId} />
                  </div>
                </div>
              </div>

              {/* Action Button Row */}
              <div className="mt-3 mb-3.5 flex flex-wrap gap-2">
                {v2 && (
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => onIssueDirective?.()}
                    className="h-8 min-w-[100px] flex-1 cursor-pointer gap-1 border border-amber-500/30 bg-amber-500/10 text-xs font-bold text-amber-500 transition-all hover:bg-amber-500/20 active:scale-[0.98]"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    Directive
                  </Button>
                )}
                <Link href={createUrl("/mycountry/editor")} className="min-w-[100px] flex-1">
                  <Button
                    variant="default"
                    size="sm"
                    className="h-8 w-full cursor-pointer gap-1.5 border border-amber-500/30 bg-amber-500/10 text-xs font-bold text-amber-500 transition-all hover:bg-amber-500/20 active:scale-[0.98]"
                  >
                    <Edit3 className="h-3.5 w-3.5" />
                    Edit Country
                  </Button>
                </Link>
              </div>

              {/* Agenda Widget, Vitality Rings, and Civil Service (v1 only; moved to V2CommandBriefingHero in v2) */}
              {!v2 && (
                <>
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
                      <SmartStack items={agendaItems} onResolve={(section) => onNavigate?.(section)} />
                    )}
                  </div>

                  {/* Vitality Rings Display */}
                  {hasCountry && country && (
                    <div className="mt-1 mb-2.5 flex shrink-0 items-center justify-between border-t border-white/5 pt-2.5 select-none">
                      <div className="flex flex-col items-start text-[9px] font-extrabold tracking-wider uppercase text-muted-foreground/60 leading-tight">
                        <span>Pop: {formatCompact(stats.population)}</span>
                        <span>GDP: ${formatCompact(stats.currentTotalGdp)}</span>
                      </div>
                      <QuickVitalityRings
                        rings={createVitalityRingsFromCountry(country)}
                        size="sm"
                        className="gap-1.5"
                      />
                    </div>
                  )}

                  {/* Civil Service Capacity + Rollout Queue */}
                  <CivilServiceWidget
                    countryId={countryId}
                    enabled={hasCountry}
                    onNavigate={onNavigate}
                  />
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
