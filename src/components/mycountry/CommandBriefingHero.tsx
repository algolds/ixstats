"use client";

import { useState, useMemo } from "react";
import { Briefcase, AlertTriangle, Clock, Check, TrendingUp, RotateCw } from "lucide-react";
import { api } from "~/trpc/react";
import { FacetCard } from "~/components/ui/facet-container";
import { cn } from "~/lib/utils";
import { useCountryData } from "./primitives";
import type { DrillSheetKind, V2Drill } from "./DrillSheets";
import type { MyCountrySection } from "./MyCountrySidebarNav";

function formatRolloutRemaining(remainingMs: number): string {
  if (remainingMs <= 0) return "Finalizing";
  const days = remainingMs / 86_400_000;
  if (days >= 365) return `${(days / 365).toFixed(1)}y left`;
  if (days >= 60) return `${Math.round(days / 30.44)}mo left`;
  if (days >= 1) return `${Math.round(days)}d left`;
  return "<1d left";
}

function CivilServiceWidget({
  countryId,
  enabled,
  onNavigate,
  onDeclare,
  onOpenDrill,
}: {
  countryId: string;
  enabled: boolean;
  onNavigate?: (section: MyCountrySection) => void;
  onDeclare?: (prefilled?: string) => void;
  onOpenDrill?: (drill: Exclude<V2Drill, { kind: "intent" } | null>) => void;
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
    ? "text-red-400"
    : util >= 80
      ? "text-amber-400"
      : "text-emerald-400";

  const handleWidgetClick = () => {
    if (onDeclare) {
      onDeclare(
        data?.overCapacity
          ? "Rebalance civil service staffing capacity and program allocation"
          : "Expand civil service program capacity and administrative operations"
      );
    } else if (onNavigate) {
      onNavigate("executive");
    }
  };

  return (
    <div
      onClick={handleWidgetClick}
      className="group relative flex min-w-0 flex-1 cursor-pointer flex-col justify-between gap-2 overflow-hidden rounded-xl border border-white/10 bg-white/[0.03] p-3 backdrop-blur-md transition-all hover:border-white/20 hover:bg-white/[0.06]"
    >
      {/* Ambient Background Graphic & Watermark Glyph */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden transition-all duration-300">
        <div className="absolute -right-4 -bottom-4 h-24 w-24 rounded-full bg-amber-500/10 opacity-20 blur-xl transition-opacity group-hover:opacity-35" />
        <Briefcase
          className="absolute -right-2 -bottom-2 h-20 w-20 text-amber-400 opacity-[0.05] transition-all duration-300 group-hover:scale-105 group-hover:opacity-[0.10]"
          strokeWidth={1}
        />
      </div>

      <div className="z-10">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            handleWidgetClick();
          }}
          className="group/btn flex w-full cursor-pointer items-center justify-between gap-2 text-left"
        >
          <div className="flex items-center gap-1.5">
            <Briefcase className="h-3.5 w-3.5 text-amber-500" />
            <span className="text-muted-foreground/70 text-[9px] font-extrabold tracking-wider uppercase">
              Civil Service Capacity
            </span>
          </div>
          <span className={cn("shrink-0 text-[10px] font-bold tabular-nums", valueColor)}>
            {Math.round(data.consumedStaff)} / {Math.round(data.capacity)}
          </span>
        </button>
        <div className="relative mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
          <div
            className={cn("h-full rounded-full transition-all duration-500", barColor)}
            style={{ width: `${Math.min(100, util)}%` }}
          />
        </div>
        {data.overCapacity && (
          <div className="mt-1 flex items-center gap-1 text-[9px] font-semibold text-red-400">
            <AlertTriangle className="h-2.5 w-2.5 shrink-0" />
            <span>Staffing shortage — active programs exceed capacity</span>
          </div>
        )}
      </div>

      {data.rolloutQueue.length > 0 && (
        <div className="z-10 mt-0.5 flex flex-col gap-1.5 border-t border-white/5 pt-1.5">
          <div className="flex items-center gap-1.5">
            <Clock className="h-3 w-3 text-cyan-400" />
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
                  style={{ width: `${Math.min(100, Math.max(0, (item as any).progressPercent ?? (item as any).progress ?? 0))}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function V2CommandBriefingHero({
  countryId,
  onNavigate,
  onOpenDrill,
  onDeclare,
}: {
  countryId: string;
  onNavigate?: (section: MyCountrySection) => void;
  onOpenDrill?: (drill: Exclude<V2Drill, { kind: "intent" } | null>) => void;
  onDeclare?: (prefilled?: string) => void;
}) {
  const { country, economyData } = useCountryData();

  // Fetch national issues count
  const pendingIssues = api.nationalIssues.getPendingCount.useQuery(
    { countryId },
    { enabled: !!countryId }
  );
  const pendingCount = pendingIssues.data?.total ?? 0;

  // Fetch civil service status for opportunity signals
  const civilService = api.government.getCivilServiceStatus.useQuery(
    { countryId },
    { enabled: !!countryId, staleTime: 60_000 }
  );
  const csData = civilService.data;

  // --- Proactive Opportunity Engine ---
  // Evaluates available data and surfaces the most important context.
  // Priority: Crises > Capacity Alerts > Economic Signals > Stability > All Clear
  const contextCards = useMemo(() => {
    const cards: Array<{
      id: string;
      label: string;
      title: string;
      subtitle: string;
      actionText: string;
      prefilledGoal: string;
      section: MyCountrySection;
      accentCls: string;
      badgeCls: string;
      glowBgCls: string;
      bgImage: string;
      icon: any;
    }> = [];

    // Priority 1: Pending Directives / National Issues
    if (pendingCount > 0) {
      cards.push({
        id: "pending-directives",
        label: "PENDING DIRECTIVE",
        title: `${pendingCount} National Issue${pendingCount > 1 ? "s" : ""} Awaiting Executive Action`,
        subtitle: "Immediate cabinet intervention recommended to prevent stability decay.",
        actionText: "Resolve Directives",
        prefilledGoal: "Resolve pending national directives and restore cabinet alignment",
        section: "executive",
        accentCls: "border-amber-500/30 text-amber-400 bg-amber-500/10",
        badgeCls: "bg-amber-500/20 text-amber-300 border-amber-500/30",
        glowBgCls: "bg-amber-500",
        bgImage: "https://images.unsplash.com/photo-1541872703-74c5e44368f9?w=1200&q=80",
        icon: AlertTriangle,
      });
    }

    // Priority 2: Civil Service over capacity
    if (csData?.overCapacity) {
      cards.push({
        id: "cs-over-capacity",
        label: "CAPACITY ALERT",
        title: "Civil Service Staffing Exceeded",
        subtitle: `Programs consume ${Math.round(csData.consumedStaff)} staff against ${Math.round(csData.capacity)} available. Consider suspending or consolidating programs.`,
        actionText: "Manage Programs",
        prefilledGoal:
          "Rebalance civil service workload and consolidate active government programs",
        section: "executive",
        accentCls: "border-red-500/30 text-red-400 bg-red-500/10",
        badgeCls: "bg-red-500/20 text-red-300 border-red-500/30",
        glowBgCls: "bg-red-500",
        bgImage: "https://images.unsplash.com/photo-1555848962-6e79363ec58f?w=1200&q=80",
        icon: AlertTriangle,
      });
    }

    // Priority 3: Civil Service severely underutilized
    if (csData && !csData.overCapacity && csData.utilizationPercent < 40 && csData.capacity > 0) {
      cards.push({
        id: "cs-underutilized",
        label: "OPPORTUNITY",
        title: `Civil Service at ${Math.round(csData.utilizationPercent)}% Utilization`,
        subtitle: `${Math.round(csData.capacity - csData.consumedStaff)} staff slots available. Expand active programs to strengthen governance.`,
        actionText: "Expand Programs",
        prefilledGoal: "Expand civil service programs to utilize available administrative capacity",
        section: "executive",
        accentCls: "border-blue-500/30 text-blue-400 bg-blue-500/10",
        badgeCls: "bg-blue-500/20 text-blue-300 border-blue-500/30",
        glowBgCls: "bg-blue-500",
        bgImage: "https://images.unsplash.com/photo-1497366216548-37526070297c?w=1200&q=80",
        icon: Briefcase,
      });
    }

    // Priority 4: Economy signals from country data
    const gdpGrowth = country?.gdpGrowthRate ?? country?.gdpGrowth ?? null;
    if (typeof gdpGrowth === "number" && Math.abs(gdpGrowth) > 3) {
      const isPositive = gdpGrowth > 0;
      cards.push({
        id: "economic-signal",
        label: isPositive ? "GROWTH SIGNAL" : "ECONOMIC WARNING",
        title: isPositive
          ? `Economy Expanding at ${gdpGrowth.toFixed(1)}% Growth`
          : `Economy Contracting at ${gdpGrowth.toFixed(1)}%`,
        subtitle: isPositive
          ? "Strong growth detected. Consider investing in infrastructure or expanding programs."
          : "Negative trend detected. Review fiscal policy and consider stabilization measures.",
        actionText: isPositive ? "Review Fiscal Policy" : "Stabilize Economy",
        prefilledGoal: isPositive
          ? "Expand infrastructure and capital investment to leverage economic growth"
          : "Implement fiscal stabilization and economic stimulus measures",
        section: "executive",
        accentCls: isPositive
          ? "border-emerald-500/30 text-emerald-400 bg-emerald-500/10"
          : "border-red-500/30 text-red-400 bg-red-500/10",
        badgeCls: isPositive
          ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
          : "bg-red-500/20 text-red-300 border-red-500/30",
        glowBgCls: isPositive ? "bg-emerald-500" : "bg-red-500",
        bgImage: isPositive
          ? "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=1200&q=80"
          : "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=1200&q=80",
        icon: isPositive ? TrendingUp : AlertTriangle,
      });
    }

    // Priority 5: Political stability concern
    const stability = country?.politicalStability ?? country?.stability ?? null;
    if (typeof stability === "number" && stability < 50) {
      cards.push({
        id: "stability-warning",
        label: "STABILITY WARNING",
        title: `Political Stability at ${Math.round(stability)}%`,
        subtitle:
          "Low stability increases risk of unrest. Prioritize domestic policy and cabinet engagement.",
        actionText: "Review Stability",
        prefilledGoal:
          "Enact domestic policy reforms to stabilize government and address public unrest",
        section: "politics",
        accentCls: "border-orange-500/30 text-orange-400 bg-orange-500/10",
        badgeCls: "bg-orange-500/20 text-orange-300 border-orange-500/30",
        glowBgCls: "bg-orange-500",
        bgImage: "https://images.unsplash.com/photo-1529180979161-06b8b6d6f2be?w=1200&q=80",
        icon: AlertTriangle,
      });
    }

    // Fallback: Sector Harmony — All Clear
    if (cards.length === 0) {
      cards.push({
        id: "all-clear",
        label: "SECTOR HARMONY",
        title: "All State Sectors Operating Normally",
        subtitle: "No critical directives or opportunities detected. System telemetry stable.",
        actionText: "Command Suite",
        prefilledGoal: "Maintain stable government operations and economic growth",
        section: "overview",
        accentCls: "border-emerald-500/30 text-emerald-400 bg-emerald-500/10",
        badgeCls: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
        glowBgCls: "bg-emerald-500",
        bgImage: "https://images.unsplash.com/photo-1569974507005-6dc61f97fb5c?w=1200&q=80",
        icon: Check,
      });
    }

    return cards;
  }, [pendingCount, csData, country]);

  const [activeIdx, setActiveIdx] = useState(0);
  const safeIdx = activeIdx >= contextCards.length ? 0 : activeIdx;
  const activeCard = contextCards[safeIdx];
  const Icon = activeCard.icon;

  const handleCardClick = () => {
    if (onDeclare) {
      onDeclare(activeCard.prefilledGoal);
    } else if (onNavigate) {
      onNavigate(activeCard.section);
    }
  };

  return (
    <FacetCard depth={1} className="bg-card/30 flex flex-col gap-4 p-5 backdrop-blur-md">
      <div className="flex w-full flex-col items-stretch justify-center gap-4 md:flex-row">
        {/* Dynamic Context-Aware Hero Banner */}
        <div
          onClick={handleCardClick}
          className={cn(
            "group relative flex min-w-0 flex-1 cursor-pointer flex-col justify-between overflow-hidden rounded-2xl border p-4.5 text-xs backdrop-blur-xl transition-all duration-300 hover:scale-[1.01] hover:shadow-lg active:scale-[0.99]",
            activeCard.accentCls
          )}
        >
          {/* Cinematic Context-Aware Unsplash Background Photography Overlay */}
          {activeCard.bgImage && (
            <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl">
              <img
                src={activeCard.bgImage}
                alt=""
                className="h-full w-full object-cover object-center opacity-20 mix-blend-overlay brightness-90 saturate-[1.2] filter transition-transform duration-700 ease-out group-hover:scale-105 dark:opacity-25"
              />
              <div className="from-background/90 via-background/60 absolute inset-0 bg-gradient-to-t to-transparent" />
              <div className="from-background/80 to-background/50 absolute inset-0 bg-gradient-to-r via-transparent" />
            </div>
          )}

          {/* Ambient Background Graphic & Watermark Glyph */}
          <div className="pointer-events-none absolute inset-0 overflow-hidden transition-all duration-300">
            <div
              className={cn(
                "absolute -right-6 -bottom-6 h-36 w-36 rounded-full opacity-20 blur-2xl transition-opacity duration-300 group-hover:opacity-35",
                activeCard.glowBgCls
              )}
            />
            <Icon
              className="absolute -right-2 -bottom-2 h-28 w-28 text-current opacity-[0.07] transition-all duration-300 group-hover:scale-105 group-hover:opacity-[0.14]"
              strokeWidth={1}
            />
          </div>
          {/* Header Row */}
          <div className="z-10 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-extrabold uppercase",
                  activeCard.badgeCls
                )}
              >
                <Icon className="h-3 w-3 shrink-0" />
                {activeCard.label}
              </span>
            </div>

            {/* Stack Cycle Dots if multiple contexts exist */}
            {contextCards.length > 1 && (
              <div
                className="flex items-center gap-1 rounded-full border border-white/10 bg-black/20 px-2 py-1 backdrop-blur-md"
                onClick={(e) => e.stopPropagation()}
              >
                {contextCards.map((c, idx) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setActiveIdx(idx)}
                    className={cn(
                      "h-1.5 cursor-pointer rounded-full transition-all duration-300",
                      idx === safeIdx ? "w-4 bg-current" : "w-1.5 bg-white/30 hover:bg-white/50"
                    )}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Body Content */}
          <div className="z-10 my-3 space-y-1">
            <h3 className="text-foreground text-sm leading-snug font-black tracking-tight sm:text-base">
              {activeCard.title}
            </h3>
            <p className="text-muted-foreground text-xs leading-relaxed font-medium">
              {activeCard.subtitle}
            </p>
          </div>

          {/* Footer Action Row */}
          <div className="z-10 flex flex-wrap items-center justify-between gap-2 border-t border-white/10 pt-1">
            <div className="flex items-center gap-2">
              <span className="text-foreground/90 group-hover:text-foreground flex items-center gap-1 text-[11px] font-bold transition-colors">
                {activeCard.actionText} <Check className="h-3 w-3 opacity-60" />
              </span>

              {onDeclare && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeclare(
                      `Convene Emergency Crisis Cabinet Meeting regarding ${activeCard.title}`
                    );
                  }}
                  className="inline-flex cursor-pointer items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/15 px-2.5 py-0.5 text-[10px] font-extrabold text-amber-300 shadow-xs transition-all hover:bg-amber-500/30 active:scale-95"
                >
                  <AlertTriangle className="h-2.5 w-2.5 text-amber-400" />
                  <span>Convene Crisis Cabinet</span>
                </button>
              )}
            </div>

            {contextCards.length > 1 ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveIdx((prev) => (prev + 1) % contextCards.length);
                }}
                className="text-muted-foreground hover:text-foreground flex cursor-pointer items-center gap-1.5 rounded-full border border-white/10 bg-black/25 px-2.5 py-0.5 text-[10px] font-bold shadow-sm transition-all hover:bg-black/45 active:scale-95"
                title="Cycle to next context card"
              >
                <span>
                  Cycle ({safeIdx + 1}/{contextCards.length})
                </span>
                <RotateCw className="h-3 w-3 opacity-70 transition-transform duration-500 group-hover:rotate-180" />
              </button>
            ) : (
              <span className="text-muted-foreground/40 flex items-center gap-1 font-mono text-[10px]">
                <RotateCw className="h-2.5 w-2.5 opacity-50" /> 1/1
              </span>
            )}
          </div>
        </div>

        {/* Civil Service Capacity Widget */}
        <CivilServiceWidget
          countryId={countryId}
          enabled={!!countryId}
          onNavigate={onNavigate}
          onDeclare={onDeclare}
          onOpenDrill={onOpenDrill}
        />
      </div>
    </FacetCard>
  );
}
