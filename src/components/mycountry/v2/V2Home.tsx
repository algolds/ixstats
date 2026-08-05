"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Sparkles,
  Globe2,
  Shield,
  Landmark,
  TrendingUp,
  Heart,
  AlertTriangle,
  Scale,
  FileClock,
  ArrowUpRight,
  Handshake,
  Activity,
  ChevronDown,
  ChevronUp,
  ArrowUp,
  ArrowDown,
  TrendingDown,
} from "lucide-react";
import { api } from "~/trpc/react";
import { FacetCard } from "~/components/ui/facet-container";
import { HealthRing } from "~/components/ui/health-ring";
import { VitalityBreakdownModal } from "~/components/modals/VitalityBreakdownModal";
import { cn } from "~/lib/utils";
import { createUrl } from "~/lib/url-utils";
import { V2Agenda } from "./V2Agenda";
import { V2CommandBriefingHero } from "./V2CommandBriefingHero";
import type { V2Drill } from "./V2DrillSheets";
import {
  DiplomacyGraphic,
  DefenseGraphic,
  PoliticsGraphic,
  EconomyGraphic,
} from "./ActionCardGraphics";

import {
  useCountryData,
  QuickVitalityRings,
  createVitalityRingsFromCountry,
} from "../primitives";

const CATEGORY_STYLE: Record<string, { label: string; icon: any; cls: string }> = {
  diplomatic: { label: "Diplomacy", icon: Globe2, cls: "border-teal-500/40 text-teal-400 bg-teal-500/10" },
  diplomacy: { label: "Diplomacy", icon: Globe2, cls: "border-teal-500/40 text-teal-400 bg-teal-500/10" },
  military: { label: "Defense", icon: Shield, cls: "border-red-500/40 text-red-400 bg-red-500/10" },
  defense: { label: "Defense", icon: Shield, cls: "border-red-500/40 text-red-400 bg-red-500/10" },
  security: { label: "Defense", icon: Shield, cls: "border-red-500/40 text-red-400 bg-red-500/10" },
  governance: { label: "Politics", icon: Landmark, cls: "border-violet-500/40 text-violet-400 bg-violet-500/10" },
  economic: { label: "Economy", icon: TrendingUp, cls: "border-emerald-500/40 text-emerald-400 bg-emerald-500/10" },
  economy: { label: "Economy", icon: TrendingUp, cls: "border-emerald-500/40 text-emerald-400 bg-emerald-500/10" },
  social: { label: "Society", icon: Heart, cls: "border-cyan-500/40 text-cyan-400 bg-cyan-500/10" },
  emergency: { label: "Crisis", icon: AlertTriangle, cls: "border-amber-500/40 text-amber-400 bg-amber-500/10" },
  ledger: { label: "Ledger", icon: Scale, cls: "border-blue-500/40 text-blue-400 bg-blue-500/10" },
};

function formatCompact(num: number): string {
  if (num >= 1e12) return `${(num / 1e12).toFixed(2)}T`;
  if (num >= 1e9) return `${(num / 1e9).toFixed(2)}B`;
  if (num >= 1e6) return `${(num / 1e6).toFixed(2)}M`;
  return (num ?? 0).toLocaleString();
}

function relativeTime(ts: number): string {
  const diffSec = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (diffSec < 60) return "just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay}d ago`;
}

function StandingBands({ countryId }: { countryId: string }) {
  const { country } = useCountryData();
  const [showExactPop, setShowExactPop] = useState(false);
  const [isBreakdownOpen, setIsBreakdownOpen] = useState(false);

  const { data: _data } = api.mycountry.getCountryDashboard.useQuery(
    { countryId },
    { enabled: !!countryId, refetchInterval: 15_000 }
  );

  const rings = useMemo(() => {
    if (!country) return [];
    return createVitalityRingsFromCountry(country);
  }, [country]);

  const compositeScore = rings.length > 0
    ? Math.round(rings.reduce((sum, r) => sum + r.value, 0) / rings.length)
    : 0;

  const ratingLabel = (score: number) => {
    if (score >= 85) return "Optimal";
    if (score >= 70) return "Strong";
    if (score >= 50) return "Moderate";
    return "Strained";
  };

  const population = country?.currentPopulation ?? country?.population ?? (country as any)?.populationTotal ?? 0;
  const totalGdp =
    country?.currentTotalGdp ??
    country?.gdp ??
    (population && country?.currentGdpPerCapita
      ? population * country.currentGdpPerCapita
      : 0);

  const formattedPop = showExactPop
    ? Math.round(population).toLocaleString()
    : formatCompact(population);

  return (
    <>
      <FacetCard depth={1} className="bg-card/30 flex flex-col gap-3 p-4 backdrop-blur-md">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h4 className="text-xs font-bold tracking-widest text-muted-foreground uppercase">
            National Standing
          </h4>
          <button
            type="button"
            onClick={() => setIsBreakdownOpen(true)}
            className="group flex items-center gap-1.5 rounded-lg border border-primary/20 bg-primary/10 px-2 py-1 text-xs font-bold text-primary transition-all hover:bg-primary/20 hover:scale-105 active:scale-95 cursor-pointer shadow-sm"
            title="Click for full Vitality Breakdown"
          >
            <Activity className="h-3.5 w-3.5 text-primary" />
            <span>{compositeScore}/100</span>
            <span className="text-[10px] font-semibold text-muted-foreground uppercase">
              ({ratingLabel(compositeScore)})
            </span>
          </button>
        </div>

        {country && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/5 bg-white/[0.02] p-2.5 text-xs sm:text-sm font-extrabold tracking-wide">
            <button
              type="button"
              onClick={() => setShowExactPop((prev) => !prev)}
              className="hover:text-foreground group flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Click to toggle exact population count"
            >
              <span className="text-muted-foreground text-xs font-bold uppercase">Population:</span>
              <strong className="text-foreground text-sm sm:text-base font-black group-hover:underline">
                {formattedPop}
              </strong>
            </button>
            <div className="flex items-center gap-1.5">
              <span className="text-muted-foreground text-xs font-bold uppercase">GDP:</span>
              <strong className="text-emerald-400 text-sm sm:text-base font-black">${formatCompact(totalGdp)}</strong>
            </div>
          </div>
        )}

        {/* 4 Vitality Rings Grid */}
        <div className="grid grid-cols-2 gap-2 pt-0.5">
          {rings.map((ring) => (
            <button
              key={ring.id}
              type="button"
              onClick={() => setIsBreakdownOpen(true)}
              className="group flex items-center gap-2 rounded-xl border border-white/5 bg-white/[0.02] p-2 text-left transition-all hover:border-white/20 hover:bg-white/[0.06] hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
            >
              <HealthRing
                value={ring.value}
                size={38}
                color={ring.color}
                label={ring.label}
              />
              <div className="min-w-0 flex-1">
                <span className="block truncate text-[9px] font-bold tracking-wider text-muted-foreground/70 uppercase group-hover:text-foreground">
                  {ring.label}
                </span>
                <span className="text-xs font-extrabold text-foreground" style={{ color: ring.color }}>
                  {ring.value}<span className="text-[9px] text-muted-foreground/60 font-normal">/100</span>
                </span>
              </div>
            </button>
          ))}
        </div>
      </FacetCard>

      <VitalityBreakdownModal
        isOpen={isBreakdownOpen}
        onClose={() => setIsBreakdownOpen(false)}
        rings={rings}
        countryName={country?.name}
      />
    </>
  );
}

function ActionGrid({
  onOpenDrill,
}: {
  onOpenDrill: (drill: Exclude<V2Drill, { kind: "intent" } | null>) => void;
}) {
  const tiles = [
    {
      title: "Diplomacy",
      blurb: "Embassies, treaties & stance",
      icon: Handshake,
      graphic: DiplomacyGraphic,
      accent:
        "border-teal-500/20 bg-gradient-to-r from-teal-500/5 to-emerald-500/5 text-teal-400 hover:from-teal-500/15 hover:to-emerald-500/15",
      onClick: () => onOpenDrill({ kind: "relations" }),
    },
    {
      title: "Defense",
      blurb: "Readiness & posture",
      icon: Shield,
      graphic: DefenseGraphic,
      accent:
        "border-red-500/20 bg-gradient-to-r from-red-500/5 to-rose-500/5 text-red-400 hover:from-red-500/15 hover:to-rose-500/15",
      onClick: () => onOpenDrill({ kind: "defense" }),
    },
    {
      title: "Politics",
      blurb: "Cabinet, parties & legislature",
      icon: Scale,
      graphic: PoliticsGraphic,
      accent:
        "border-violet-500/20 bg-gradient-to-r from-violet-500/5 to-purple-500/5 text-violet-400 hover:from-violet-500/15 hover:to-purple-500/15",
      onClick: () => onOpenDrill({ kind: "politics" }),
    },
    {
      title: "Economy & Budget",
      blurb: "Macro trends & fiscal health",
      icon: TrendingUp,
      graphic: EconomyGraphic,
      accent:
        "border-emerald-500/20 bg-gradient-to-r from-emerald-500/5 to-teal-500/5 text-emerald-400 hover:from-emerald-500/15 hover:to-teal-500/15",
      onClick: () => onOpenDrill({ kind: "economy" }),
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {tiles.map(({ title, blurb, icon: Icon, graphic: Graphic, accent, onClick }) => (
        <button
          key={title}
          type="button"
          onClick={onClick}
          className={cn(
            "group relative flex cursor-pointer flex-col justify-between gap-3 overflow-hidden rounded-2xl border p-4 text-xs font-semibold backdrop-blur-md transition-all duration-300 hover:scale-[1.02] hover:shadow-lg active:scale-[0.98]",
            accent
          )}
        >
          <div className="flex w-full items-center justify-between z-10">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/10 bg-white/5">
                <Icon className="h-4 w-4 shrink-0" />
              </div>
              <span className="text-foreground/95 text-xs font-bold leading-tight">{title}</span>
            </div>
            <ArrowUpRight className="h-3.5 w-3.5 opacity-40 transition-all duration-200 group-hover:opacity-100 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </div>

          <Graphic className="my-0.5 z-0" />

          <div className="flex w-full items-center justify-between z-10">
            <span className="text-muted-foreground/90 text-[11px] font-medium leading-snug">{blurb}</span>
          </div>
        </button>
      ))}
    </div>
  );
}

function formatDeltaValue(val: number | null | undefined): string {
  if (val === null || val === undefined || !isFinite(val)) return "Updated";
  const absVal = Math.abs(val);
  const formatted = absVal.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
  });
  return `${val > 0 ? "+" : val < 0 ? "-" : ""}${formatted}`;
}

function getUniqueDiagnosticNarrative(
  item: any,
  metaLabel: string
): { narrative: string; badge?: { text: string; direction?: "up" | "down" | "neutral"; cls: string } } {
  const deltaStr = formatDeltaValue(item.deltaValue);
  const fieldName = item.targetField ?? "national indicator";

  if (item.description && typeof item.description === "string" && item.description.trim().length > 10) {
    const isPositive = (item.deltaValue ?? 0) > 0;
    const isNegative = (item.deltaValue ?? 0) < 0;
    return {
      narrative: item.description.trim(),
      badge:
        item.deltaValue !== null && item.deltaValue !== undefined
          ? isPositive
            ? { text: `${deltaStr} Net Expansion`, direction: "up", cls: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" }
            : isNegative
            ? { text: `${deltaStr} Contraction`, direction: "down", cls: "bg-red-500/10 text-red-400 border-red-500/20" }
            : { text: `Neutral Shift`, direction: "neutral", cls: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20" }
          : undefined,
    };
  }

  if (item.kind === "effect") {
    return {
      narrative: `Storyteller directive logged: "${item.title}". The Executive Command Engine calculated real-time state shifts across national ${metaLabel.toLowerCase()} subsystems.`,
      badge: { text: "Storyteller Effect", cls: "bg-amber-500/10 text-amber-400 border-amber-500/20" },
    };
  }

  if (item.kind === "diplomacy") {
    return {
      narrative: `Bilateral event "${item.title}" registered in global diplomatic dispatches. Foreign ministry officials report ongoing international standing alignment.`,
      badge: { text: "Foreign Dispatch", cls: "bg-teal-500/10 text-teal-400 border-teal-500/20" },
    };
  }

  if (item.kind === "decision") {
    return {
      narrative: `Executive resolution enacted: "${item.title}". Cabinet civil service departments have finalized implementation across local administrative channels.`,
      badge: { text: "Executive Resolution", cls: "bg-purple-500/10 text-purple-400 border-purple-500/20" },
    };
  }

  if (item.kind === "ledger" && item.targetField) {
    const isPositive = (item.deltaValue ?? 0) > 0;
    const badgeCls = isPositive
      ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
      : "bg-red-500/10 text-red-400 border-red-500/20";

    const metricNarratives: Record<string, string> = {
      currentPopulation: isPositive
        ? `Demographic growth recorded a net addition of ${deltaStr} citizens following regional migration and baseline birth balance.`
        : `Demographic census registered a net reduction of ${deltaStr} citizens across monitored urban sectors.`,
      currentTotalGdp: isPositive
        ? `National economic output expanded by ${deltaStr} total GDP, driven by active trade channels and commercial yield.`
        : `National economic output experienced a contraction of ${deltaStr} total GDP due to fiscal adjustments and market cooling.`,
      currentGdpPerCapita: isPositive
        ? `Average per capita purchasing power rose by ${deltaStr}, improving household prosperity metrics.`
        : `Average per capita income shifted by ${deltaStr} as population totals and GDP output adjusted.`,
      economicVitality: isPositive
        ? `Economic vitality index gained +${deltaStr} points following positive fiscal performance.`
        : `Economic vitality index adjusted by ${deltaStr} points reflecting recent market headwinds.`,
      populationWellbeing: isPositive
        ? `Population wellbeing index rose by +${deltaStr} points thanks to expanded social and healthcare coverage.`
        : `Population wellbeing index adjusted by ${deltaStr} points during administrative recalculation.`,
      diplomaticStanding: isPositive
        ? `Diplomatic standing index gained +${deltaStr} points following active embassy treaties and international prestige.`
        : `Diplomatic standing index shifted by ${deltaStr} points amidst regional diplomatic negotiations.`,
      governmentalEfficiency: isPositive
        ? `Governmental efficiency index advanced by +${deltaStr} points due to streamlined civil service throughput.`
        : `Governmental efficiency index adjusted by ${deltaStr} points following administrative bureau reorganizations.`,
    };

    const narrative =
      metricNarratives[item.targetField] ??
      `Simulation metric '${fieldName}' adjusted by ${deltaStr} under the ${metaLabel.toLowerCase()} domain ledger.`;

    return {
      narrative,
      badge: {
        text: `${fieldName}: ${deltaStr}`,
        direction: isPositive ? "up" : "down",
        cls: badgeCls,
      },
    };
  }

  return {
    narrative: `Canon event '${item.title}' recorded under the ${metaLabel.toLowerCase()} domain. System state updated successfully.`,
    badge: { text: "Canon Record", cls: "bg-white/10 text-muted-foreground border-white/20" },
  };
}

function RecordFeed({
  items,
  countrySlug,
  onOpenDrill,
}: {
  items: any[];
  countrySlug?: string;
  onOpenDrill?: (drill: Exclude<V2Drill, { kind: "intent" } | null>) => void;
}) {
  const [visibleCount, setVisibleCount] = useState(12);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const visibleItems = useMemo(
    () => items.slice(0, visibleCount),
    [items, visibleCount]
  );

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    if (target.scrollHeight - target.scrollTop - target.clientHeight < 60) {
      if (visibleCount < items.length) {
        setVisibleCount((prev) => Math.min(items.length, prev + 10));
      }
    }
  };

  const getDrillForCategory = (cat: string): Exclude<V2Drill, { kind: "intent" } | null> => {
    if (cat === "diplomatic" || cat === "diplomacy") return { kind: "relations" };
    if (cat === "military" || cat === "defense" || cat === "security") return { kind: "defense" };
    if (cat === "economic" || cat === "ledger") return { kind: "economy" };
    return { kind: "politics" };
  };

  if (items.length === 0) {
    return (
      <p className="text-muted-foreground rounded-lg border border-dashed border-white/10 bg-white/[0.01] px-3 py-8 text-center text-xs">
        No canon events yet. Declare a directive to start the record.
      </p>
    );
  }

  return (
    <div
      onScroll={handleScroll}
      className="max-h-[540px] space-y-2 overflow-y-auto pr-1 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/10"
    >
      <div className="divide-y divide-white/5">
        {visibleItems.map((item: any) => {
          const meta = CATEGORY_STYLE[item.category] || CATEGORY_STYLE.ledger;
          const Icon = meta.icon;
          const isExpanded = expandedId === item.id;
          const drill = getDrillForCategory(item.category);
          const diagnostic = getUniqueDiagnosticNarrative(item, meta.label);

          return (
            <div
              key={item.id}
              className={cn(
                "group rounded-xl p-2.5 transition-all duration-200 cursor-pointer border border-transparent select-none",
                isExpanded ? "border-white/10 bg-white/[0.04] shadow-md my-1.5" : "hover:bg-white/[0.02]"
              )}
              onClick={() => setExpandedId((prev) => (prev === item.id ? null : item.id))}
            >
              <div className="flex items-start gap-3">
                <span
                  className={cn(
                    "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border",
                    meta.cls
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-foreground/90 text-[13px] font-semibold leading-snug">
                      {item.title}
                    </p>
                    <span className="text-muted-foreground/40 group-hover:text-muted-foreground shrink-0 transition-colors">
                      {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </span>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px]">
                    <span className="text-muted-foreground/70 font-semibold">{meta.label}</span>
                    <span className="text-muted-foreground/40">•</span>
                    <span className="text-muted-foreground/60">{relativeTime(item.timestamp)}</span>
                    {item.kind === "ledger" && item.targetField && (
                      <>
                        <span className="text-muted-foreground/40">•</span>
                        <span className="text-muted-foreground/70 font-mono inline-flex items-center gap-1 rounded border border-white/10 bg-white/[0.03] px-1.5 py-px">
                          {item.deltaValue && item.deltaValue > 0 ? (
                            <ArrowUp className="h-3 w-3 text-emerald-400 animate-pulse stroke-[3]" />
                          ) : item.deltaValue && item.deltaValue < 0 ? (
                            <ArrowDown className="h-3 w-3 text-red-400 animate-pulse stroke-[3]" />
                          ) : null}
                          <span>{item.targetField}: {formatDeltaValue(item.deltaValue)}</span>
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Inline Expansion Drawer */}
              {isExpanded && (
                <div
                  className="mt-3 space-y-3 rounded-xl border border-white/10 bg-black/60 p-4 text-xs backdrop-blur-md animate-in fade-in slide-in-from-top-1 duration-200"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-2 text-[10px]">
                    <div className="flex items-center gap-1.5">
                      <span className={cn("inline-flex items-center gap-1 rounded-md border px-2 py-0.5 font-bold uppercase", meta.cls)}>
                        <Icon className="h-3 w-3" />
                        {meta.label}
                      </span>
                      <span className="text-muted-foreground/60 font-semibold uppercase">
                        • {item.kind ?? "ledger"} event
                      </span>
                    </div>
                    <span className="text-muted-foreground/70 font-mono">
                      {new Date(item.timestamp).toLocaleString(undefined, {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </span>
                  </div>

                  {/* Highlighted Impact Badge with Animated Arrow */}
                  {diagnostic.badge && (
                    <div className="flex items-center gap-2">
                      <span className={cn("inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-extrabold shadow-sm", diagnostic.badge.cls)}>
                        {diagnostic.badge.direction === "up" && (
                          <span className="inline-flex items-center text-emerald-400 animate-bounce">
                            <ArrowUp className="h-3.5 w-3.5 stroke-[3]" />
                          </span>
                        )}
                        {diagnostic.badge.direction === "down" && (
                          <span className="inline-flex items-center text-red-400 animate-bounce">
                            <ArrowDown className="h-3.5 w-3.5 stroke-[3]" />
                          </span>
                        )}
                        <span>{diagnostic.badge.text}</span>
                      </span>
                    </div>
                  )}

                  {/* Unique Diagnostic Narrative */}
                  <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
                    <span className="block text-[9px] font-extrabold tracking-wider text-muted-foreground/70 uppercase mb-1.5">
                      Diagnostic Briefing
                    </span>
                    <p className="text-foreground/95 text-xs leading-relaxed font-medium">
                      {diagnostic.narrative}
                    </p>
                  </div>

                  {/* Dual Action CTAs */}
                  <div className="pt-1 flex flex-wrap items-center justify-between gap-2 border-t border-white/5">
                    <Link
                      href={createUrl("/mycountry/changelog", countrySlug ? { country: countrySlug } : {})}
                      className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground hover:text-foreground transition-colors"
                    >
                      Audit Full Ledger <ArrowUpRight className="h-3 w-3" />
                    </Link>

                    {onOpenDrill && (
                      <button
                        type="button"
                        onClick={() => onOpenDrill(drill)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs font-bold text-primary transition-all hover:bg-primary/20 active:scale-95 cursor-pointer shadow-sm"
                      >
                        Inspect {meta.label} Sheet <ArrowUpRight className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Infinite scroll loader / 30-day manual boundary button */}
      {visibleCount < items.length ? (
        <button
          type="button"
          onClick={() => setVisibleCount((prev) => Math.min(items.length, prev + 10))}
          className="text-muted-foreground hover:text-foreground w-full cursor-pointer rounded-lg border border-white/10 bg-white/[0.02] py-2 text-center text-xs font-semibold transition-all hover:bg-white/5 active:scale-[0.99]"
        >
          Load older events ({items.length - visibleCount} remaining in 30-day window)
        </button>
      ) : (
        <div className="pt-2 text-center">
          <Link
            href={createUrl("/mycountry/changelog", countrySlug ? { country: countrySlug } : {})}
            className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs font-bold text-amber-400 transition-all hover:bg-amber-500/20 active:scale-95"
          >
            30-day history window reached — Browse complete historical ledger
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      )}
    </div>
  );
}

export function V2Home({
  countryId,
  onDeclare,
  onOpenDrill,
  onOpenIntent,
}: {
  countryId: string;
  onDeclare: () => void;
  onOpenDrill: (drill: Exclude<V2Drill, { kind: "intent" } | null>) => void;
  onOpenIntent: (id: string) => void;
}) {
  const _router = useRouter();
  const feed = api.mycountry.getCanonFeed.useQuery(
    { countryId, limit: 60 },
    { enabled: !!countryId }
  );
  const status = api.intent.getStatus.useQuery({ countryId }, { enabled: !!countryId });

  const items = useMemo(() => feed.data ?? [], [feed.data]);

  const briefing = useMemo(() => {
    if (items.length === 0) return null;
    const latest = items[0];
    return {
      latest,
      weekCount: items.length,
    };
  }, [items]);

  const canCommit = status?.data?.canCommit ?? true;

  return (
    <div className="space-y-5">
      {/* Command Briefing Hero — session recap, Smart Stack, Calendar, Reminders & Civil Service capacity */}
      <V2CommandBriefingHero countryId={countryId} />

      {/* Country Actions grid — matches Dynamic Island country actions */}
      <ActionGrid onOpenDrill={onOpenDrill} />

      <div className="grid gap-5 lg:grid-cols-3">
        {/* Main feed */}
        <FacetCard depth={1} className="bg-card/30 flex flex-col gap-3 p-4 backdrop-blur-md lg:col-span-2">
          <h4 className="text-xs font-bold tracking-widest text-muted-foreground uppercase">
            The Record — your nation&apos;s story
          </h4>
          <RecordFeed items={items} onOpenDrill={onOpenDrill} />
        </FacetCard>

        {/* Rail */}
        <aside className="space-y-5">
          <button
            type="button"
            onClick={onDeclare}
            className={cn(
              "flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border p-4 text-sm font-bold transition-all active:scale-[0.98]",
              canCommit
                ? "border-amber-500/40 bg-gradient-to-br from-amber-500/15 to-orange-500/5 text-amber-500 shadow-[0_0_20px_rgba(245,158,11,0.08)] hover:bg-amber-500/20"
                : "cursor-not-allowed border-white/10 bg-white/[0.02] text-muted-foreground"
            )}
          >
            <Sparkles className="h-4 w-4" />
            {canCommit ? "Declare an Intent" : "Directive on cooldown"}
          </button>

          <StandingBands countryId={countryId} />
          <V2Agenda countryId={countryId} onOpenIntent={onOpenIntent} />
        </aside>
      </div>
    </div>
  );
}