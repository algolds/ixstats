"use client";

import { useState, useMemo, memo, type ReactNode } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Shield,
  Coins,
  Group as Users,
  Map as MapIcon,
  Bell,
  Page as FileText,
  Component as Layers,
  City as Building2,
  Community as Handshake,
  Globe,
  WarningTriangle as AlertTriangle,
  Tournament as Sword,
  Archery as Target,
  Activity,
  Heart,
  ScaleFrameEnlarge as Scale,
  Flash as Zap,
} from "iconoir-react";
import { cn } from "~/lib/utils";
import { api } from "~/trpc/react";
import { Tooltip, TooltipTrigger, TooltipContent } from "~/components/ui/tooltip";
import { HealthRing } from "~/components/ui/health-ring";
import { GrowthArrow } from "~/components/ui/GrowthArrow";
import { PreText } from "~/components/ui/pretext";
import { UnifiedCountryFlag } from "~/components/ui/UnifiedCountryFlag";
import { StandingBands } from "~/components/mycountry/shell/StandingBands";
import type { HeroSection } from "./useHeroAutoCycle";

// Helper UI primitives
export function StatPill({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  color: string;
}) {
  return (
    <div className="flex items-center gap-1.5 rounded-lg bg-white/[0.04] px-2 py-1.5">
      <Icon className={cn("h-3 w-3 shrink-0", color)} />
      <div className="min-w-0">
        <p className="text-muted-foreground/60 text-[8px] tracking-wider uppercase">{label}</p>
        <p className="text-foreground text-[11px] font-bold">{value}</p>
      </div>
    </div>
  );
}

export function MiniBar({
  value,
  max = 100,
  color = "bg-amber-500",
}: {
  value: number;
  max?: number;
  color?: string;
}) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  return (
    <div className="h-1 w-full overflow-hidden rounded-full bg-white/[0.06]">
      <div className={cn("h-full rounded-full", color)} style={{ width: `${pct}%` }} />
    </div>
  );
}

export function IndicatorRow({
  label,
  value,
  valueClass = "text-foreground",
  barValue,
  barMax = 100,
  barColor = "bg-amber-500",
}: {
  label: string;
  value: string;
  valueClass?: string;
  barValue?: number;
  barMax?: number;
  barColor?: string;
}) {
  return (
    <div className="space-y-0.5">
      <div className="flex items-center justify-between gap-2 text-[9px]">
        <span className="text-muted-foreground/70 truncate">{label}</span>
        <span className={cn("shrink-0 font-bold", valueClass)}>{value}</span>
      </div>
      {barValue != null && <MiniBar value={barValue} max={barMax} color={barColor} />}
    </div>
  );
}

export function DetailList({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mt-1.5 flex min-h-0 flex-1 flex-col gap-1 rounded-lg bg-white/[0.02] p-2">
      <p className="text-muted-foreground/50 text-[8px] font-semibold tracking-wider uppercase">
        {title}
      </p>
      <div className="flex min-h-0 flex-1 flex-col justify-center gap-1.5">{children}</div>
    </div>
  );
}

export interface HeroSnapshotData {
  stats: {
    gdpPerCapita: number;
    currentTotalGdp: number;
    population: number;
    populationDensity: number | null;
    landArea: number | null;
    areaSqMi: number | null;
    gdpGrowth: number;
    popGrowth: number;
  };
  activityRingsData?: {
    economicVitality?: number;
    populationWellbeing?: number;
    diplomaticStanding?: number;
    governmentalEfficiency?: number;
  };
  policies?: Array<{ id: string; name: string; category: string; status: string }>;
  meetings?: Array<{ actionItems: Array<{ status: string }> }>;
  embassies?: Array<{ status: string }>;
  relations?: Array<{ id: string; targetCountryName: string; strength?: number }>;
  defenseOverview?: { overallScore?: number };
  intelligenceOverview?: {
    alerts?: { critical?: number; items?: Array<{ id: string; severity: string; title: string }> };
  };
  securityData?: { overallSecurityScore?: number; activeThreatCount?: number };
  militaryBranches?: Array<{ id: string; name: string; readinessLevel?: number }>;
  civilServiceStatus?: {
    consumedStaff: number;
    capacity: number;
    utilizationPercent: number;
    overCapacity: boolean;
    activeCount: number;
  };
  pendingIssuesCount?: number;
}

function getQualitativeRating(score: number): { label: string; color: string } {
  if (score >= 80) return { label: "Optimal", color: "text-emerald-600 dark:text-emerald-400" };
  if (score >= 65) return { label: "Strong", color: "text-emerald-600 dark:text-emerald-400" };
  if (score >= 45) return { label: "Stable", color: "text-cyan-600 dark:text-cyan-400" };
  if (score >= 30) return { label: "Moderate", color: "text-amber-600 dark:text-amber-400" };
  return { label: "Vulnerable", color: "text-red-600 dark:text-red-400" };
}

function getDiplomaticStance(strength: number): { label: string; color: string } {
  if (strength >= 80) return { label: "Ironclad Alliance", color: "text-purple-400" };
  if (strength >= 65) return { label: "Strong Ties", color: "text-emerald-400" };
  if (strength >= 45) return { label: "Warm Relations", color: "text-cyan-400" };
  if (strength >= 25) return { label: "Neutral Stance", color: "text-blue-400" };
  return { label: "Strained Ties", color: "text-amber-400" };
}

function getForceReadinessLabel(readiness: number): { label: string; color: string } {
  if (readiness >= 75) return { label: "Combat Ready", color: "text-emerald-400" };
  if (readiness >= 50) return { label: "Operational", color: "text-cyan-400" };
  if (readiness >= 30) return { label: "Refitting", color: "text-amber-400" };
  return { label: "Standby", color: "text-red-400" };
}

function HeroSnapshotPanelsComponent({
  isPremium,
  data,
  countryId,
  onOpenModal,
}: {
  isPremium: boolean;
  data: HeroSnapshotData;
  countryId?: string;
  onOpenModal: (modal: "vitality" | "gdp" | "population" | "government") => void;
}) {
  const getMetricColor = (val: number) => {
    if (val < 35) return "#ef4444";
    if (val < 60) return "#f97316";
    if (val < 80) return "#eab308";
    return "#10b981";
  };

  const dashboardData = (api as any).mycountry?.getCountryDashboard?.useQuery?.(
    { countryId: countryId || "" },
    { enabled: !!countryId, staleTime: 30_000 }
  );

  const approvalPct = useMemo(() => {
    const raw =
      (dashboardData?.data as any)?.currentPublicApproval ??
      (dashboardData?.data as any)?.approvalRating ??
      0.65;
    return Math.round(raw > 1 ? raw : raw * 100);
  }, [dashboardData?.data]);

  const stabilityPct = useMemo(() => {
    const raw =
      (dashboardData?.data as any)?.currentStability ??
      (dashboardData?.data as any)?.stability ??
      0.4;
    return Math.round(raw > 1 ? raw : raw * 100);
  }, [dashboardData?.data]);

  const capacityPct = 100;

  const pop = data.stats.population ? Math.round(data.stats.population).toLocaleString() : "—";
  const gdp = data.stats.currentTotalGdp
    ? `$${(data.stats.currentTotalGdp / 1e12).toFixed(2)}T`
    : data.stats.gdpPerCapita
      ? `$${Math.round(data.stats.gdpPerCapita).toLocaleString()}`
      : "—";

  const rings = data.activityRingsData
    ? [
        {
          label: "Economy",
          value: data.activityRingsData.economicVitality || 0,
          color: getMetricColor(data.activityRingsData.economicVitality || 0),
          modal: "vitality" as const,
        },
        {
          label: "Wellbeing",
          value: data.activityRingsData.populationWellbeing || 0,
          color: getMetricColor(data.activityRingsData.populationWellbeing || 0),
          modal: "vitality" as const,
        },
        {
          label: "Diplomatic",
          value: data.activityRingsData.diplomaticStanding || 0,
          color: getMetricColor(data.activityRingsData.diplomaticStanding || 0),
          modal: "vitality" as const,
        },
        {
          label: "Efficiency",
          value: data.activityRingsData.governmentalEfficiency || 0,
          color: getMetricColor(data.activityRingsData.governmentalEfficiency || 0),
          modal: "vitality" as const,
        },
      ]
    : [];

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-xl border border-white/15 bg-white/[0.04] shadow-sm backdrop-blur-md">
      {/* Section 1: Prominent Telemetry Header Bar */}
      <div className="grid grid-cols-3 gap-1.5 bg-white/[0.04] p-2.5">
        <div
          onClick={() => onOpenModal("population")}
          className="group/pop flex min-w-0 cursor-pointer items-center gap-2"
          title="Click for Population Breakdown"
        >
          <Users className="h-4 w-4 shrink-0 text-blue-600 transition-transform group-hover/pop:scale-110 dark:text-blue-400" />
          <div className="min-w-0">
            <p className="text-muted-foreground/70 text-[8px] font-semibold tracking-wider uppercase">
              Pop
            </p>
            <p className="text-foreground truncate text-xs font-bold tracking-tight tabular-nums group-hover/pop:underline sm:text-sm">
              {pop}
            </p>
          </div>
        </div>

        <div
          onClick={() => onOpenModal("gdp")}
          className="group/gdp flex min-w-0 cursor-pointer items-center gap-2 border-l border-white/10 pl-2"
          title="Click for GDP Breakdown"
        >
          <Coins className="h-4 w-4 shrink-0 text-emerald-600 transition-transform group-hover/gdp:scale-110 dark:text-emerald-400" />
          <div className="min-w-0">
            <p className="text-muted-foreground/70 text-[8px] font-semibold tracking-wider uppercase">
              GDP
            </p>
            <p className="truncate text-xs font-bold tracking-tight text-emerald-600 tabular-nums group-hover/gdp:underline sm:text-sm dark:text-emerald-400">
              {gdp}
            </p>
          </div>
        </div>

        <div
          onClick={() => onOpenModal("vitality")}
          className="group/standing flex min-w-0 cursor-pointer items-center gap-2 border-l border-white/10 pl-2"
          title="Click for full Vitality Breakdown"
        >
          <Activity className="h-4 w-4 shrink-0 text-amber-600 transition-transform group-hover/standing:scale-110 dark:text-amber-400" />
          <div className="min-w-0">
            <p className="text-muted-foreground/70 text-[8px] font-semibold tracking-wider uppercase">
              Standing
            </p>
            <p className="truncate text-xs font-bold tracking-tight text-amber-700 group-hover/standing:underline sm:text-sm dark:text-amber-300">
              Optimal
            </p>
          </div>
        </div>
      </div>

      {/* Section 2: 4 Vitality Rings Grid */}
      <div className="flex flex-1 flex-col justify-center border-t border-white/10 bg-white/[0.02] p-2.5">
        <div className="grid grid-cols-2 gap-2">
          {rings.map((ring) => {
            const rating = getQualitativeRating(ring.value);
            return (
              <div
                key={ring.label}
                onClick={() => onOpenModal("vitality")}
                className="group flex cursor-pointer items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] p-2 transition-all duration-150 hover:border-white/20 hover:bg-white/[0.08] active:scale-[0.97]"
                title="Click for full Vitality Breakdown"
              >
                <HealthRing value={ring.value} size={32} color={ring.color} label={ring.label} />
                <div className="min-w-0 flex-1">
                  <span className="text-muted-foreground/70 group-hover:text-foreground block truncate text-[8px] font-medium tracking-wider uppercase transition-colors">
                    {ring.label}
                  </span>
                  <span className={cn("text-xs font-semibold tracking-tight", rating.color)}>
                    {rating.label}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Section 3: Integrated Executive Telemetry Micro-Bar */}
      <div className="grid grid-cols-3 gap-1 border-t border-white/10 bg-white/[0.02] p-1.5">
        <div className="flex min-w-0 items-center justify-center gap-1">
          <Heart className="h-3 w-3 shrink-0 text-red-400" />
          <span className="text-muted-foreground/70 text-[8px] font-medium tracking-wider uppercase">
            Approval:
          </span>
          <span className="text-foreground truncate text-[10px] font-semibold tabular-nums">
            {approvalPct}%
          </span>
        </div>

        <div className="flex min-w-0 items-center justify-center gap-1 border-l border-white/10 pl-1">
          <Scale className="h-3 w-3 shrink-0 text-violet-400" />
          <span className="text-muted-foreground/70 text-[8px] font-medium tracking-wider uppercase">
            Stability:
          </span>
          <span className="text-foreground truncate text-[10px] font-semibold tabular-nums">
            {stabilityPct}%
          </span>
        </div>

        <div className="flex min-w-0 items-center justify-center gap-1 border-l border-white/10 pl-1">
          <Zap className="h-3 w-3 shrink-0 text-amber-400" />
          <span className="text-muted-foreground/70 text-[8px] font-medium tracking-wider uppercase">
            Capacity:
          </span>
          <span className="text-foreground truncate text-[10px] font-semibold tabular-nums">
            {capacityPct}%
          </span>
        </div>
      </div>
    </div>
  );
}

export const HeroSnapshotPanels = memo(HeroSnapshotPanelsComponent);
