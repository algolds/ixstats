"use client";

import React, { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";
import {
  Command,
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
  ChevronDown,
  ChevronUp,
  ArrowUp,
  ArrowDown,
  Clock,
  Maximize2,
  Minimize2,
  MapPin,
  Edit3,
} from "lucide-react";
import { motion } from "motion/react";
import { api } from "~/trpc/react";
import { FacetCard } from "~/components/ui/facet-container";
import { Tooltip, TooltipTrigger, TooltipContent } from "~/components/ui/tooltip";
import { cn } from "~/lib/utils";
import { createUrl } from "~/lib/url-utils";
import { CommitmentsAgendaRail as _CommitmentsAgendaRail } from "./CommitmentsAgendaRail";
import { CommandBriefingHero } from "./CommandBriefingHero";
import { ExecutiveOpportunityHero } from "./ExecutiveOpportunityHero";
import { ExecutiveAgenda } from "./ExecutiveAgenda";
import { StandingBands } from "./StandingBands";
import type { DrillSheetKind } from "./DrillSheets";
import type { MyCountrySection } from "./MyCountrySidebarNav";
import {
  DiplomacyGraphic,
  DefenseGraphic,
  PoliticsGraphic,
  EconomyGraphic,
} from "./ActionCardGraphics";

import { useCountryData, QuickVitalityRings } from "./primitives";

const CountryMapEmbed = dynamic(
  () =>
    import("~/components/maps/widgets/CountryMapEmbed").then((m) => ({
      default: m.CountryMapEmbed,
    })),
  {
    ssr: false,
    loading: () => <div className="bg-muted/40 h-56 animate-pulse rounded-xl" />,
  }
);

const CATEGORY_STYLE: Record<string, { label: string; icon: any; cls: string }> = {
  diplomatic: {
    label: "Diplomacy",
    icon: Globe2,
    cls: "border-teal-500/40 text-teal-800 dark:text-teal-400 bg-teal-500/10",
  },
  diplomacy: {
    label: "Diplomacy",
    icon: Globe2,
    cls: "border-teal-500/40 text-teal-800 dark:text-teal-400 bg-teal-500/10",
  },
  military: {
    label: "Defense",
    icon: Shield,
    cls: "border-red-500/40 text-red-800 dark:text-red-400 bg-red-500/10",
  },
  defense: {
    label: "Defense",
    icon: Shield,
    cls: "border-red-500/40 text-red-800 dark:text-red-400 bg-red-500/10",
  },
  security: {
    label: "Defense",
    icon: Shield,
    cls: "border-red-500/40 text-red-800 dark:text-red-400 bg-red-500/10",
  },
  governance: {
    label: "Politics",
    icon: Landmark,
    cls: "border-violet-500/40 text-violet-800 dark:text-violet-400 bg-violet-500/10",
  },
  economic: {
    label: "Economy",
    icon: TrendingUp,
    cls: "border-emerald-500/40 text-emerald-800 dark:text-emerald-400 bg-emerald-500/10",
  },
  economy: {
    label: "Economy",
    icon: TrendingUp,
    cls: "border-emerald-500/40 text-emerald-800 dark:text-emerald-400 bg-emerald-500/10",
  },
  social: {
    label: "Society",
    icon: Heart,
    cls: "border-cyan-500/40 text-cyan-800 dark:text-cyan-400 bg-cyan-500/10",
  },
  emergency: {
    label: "Crisis",
    icon: AlertTriangle,
    cls: "border-amber-500/40 text-amber-800 dark:text-amber-400 bg-amber-500/10",
  },
  ledger: {
    label: "Ledger",
    icon: Scale,
    cls: "border-blue-500/40 text-blue-800 dark:text-blue-400 bg-blue-500/10",
  },
};

const DomainActionTiles = React.memo(function DomainActionTiles({
  onOpenDrill,
}: {
  onOpenDrill: (drill: Exclude<V2Drill, { kind: "intent" } | null>) => void;
}) {
  const { country } = useCountryData();

  const tiles = useMemo(() => {
    const readiness = country?.militaryReadiness ?? country?.readiness ?? 94;
    const posture = country?.defensePosture ?? country?.posture ?? "Defensive";

    const embassies = country?.activeEmbassiesCount ?? country?.embassies?.length ?? 12;
    const dipStance = country?.diplomaticStance ?? "Active Alliance";

    const rawStab = country?.currentStability ?? country?.stability ?? 0.78;
    const stabPct = Math.round(rawStab > 1 ? rawStab : rawStab * 100);

    const rawGrowth = country?.gdpGrowth ?? country?.currentGdpGrowth ?? 0.034;
    const growthPct = (rawGrowth > 1 ? rawGrowth : rawGrowth * 100).toFixed(1);

    return [
      {
        title: "Diplomacy",
        peek: `${embassies} Embassies • ${dipStance}`,
        icon: Handshake,
        graphic: DiplomacyGraphic,
        accent:
          "border-teal-500/30 dark:border-teal-500/20 bg-card/60 dark:bg-gradient-to-r dark:from-teal-500/10 dark:to-emerald-500/5 text-teal-900 dark:text-teal-300 hover:border-teal-500/50 hover:bg-card/90 shadow-xs",
        onClick: () => onOpenDrill({ kind: "relations" }),
      },
      {
        title: "Defense",
        peek: `${readiness}% Readiness • ${posture}`,
        icon: Shield,
        graphic: DefenseGraphic,
        accent:
          "border-red-500/30 dark:border-red-500/20 bg-card/60 dark:bg-gradient-to-r dark:from-red-500/10 dark:to-rose-500/5 text-red-900 dark:text-red-300 hover:border-red-500/50 hover:bg-card/90 shadow-xs",
        onClick: () => onOpenDrill({ kind: "defense" }),
      },
      {
        title: "Politics",
        peek: `${stabPct}% Stability • Active Cabinet`,
        icon: Scale,
        graphic: PoliticsGraphic,
        accent:
          "border-violet-500/30 dark:border-violet-500/20 bg-card/60 dark:bg-gradient-to-r dark:from-violet-500/10 dark:to-purple-500/5 text-violet-900 dark:text-violet-300 hover:border-violet-500/50 hover:bg-card/90 shadow-xs",
        onClick: () => onOpenDrill({ kind: "politics" }),
      },
      {
        title: "Economy & Budget",
        peek: `+${growthPct}% Growth • Fiscal Stable`,
        icon: TrendingUp,
        graphic: EconomyGraphic,
        accent:
          "border-emerald-500/30 dark:border-emerald-500/20 bg-card/60 dark:bg-gradient-to-r dark:from-emerald-500/10 dark:to-teal-500/5 text-emerald-900 dark:text-emerald-300 hover:border-emerald-500/50 hover:bg-card/90 shadow-xs",
        onClick: () => onOpenDrill({ kind: "economy" }),
      },
    ];
  }, [country, onOpenDrill]);

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {tiles.map(({ title, peek, icon: Icon, graphic: Graphic, accent, onClick }) => (
        <motion.button
          key={title}
          type="button"
          whileHover={{ scale: 1.015, transition: { type: "spring", stiffness: 450, damping: 25 } }}
          whileTap={{ scale: 0.97 }}
          onClick={onClick}
          className={cn(
            "group relative flex cursor-pointer items-center justify-between gap-3 overflow-hidden rounded-2xl border px-3.5 py-3 text-xs font-semibold backdrop-blur-md transition-colors duration-200 select-none",
            accent
          )}
        >
          {/* Rescaled Ambient Background Graphic & Glow */}
          <Graphic />

          {/* Left: Icon + Title + Telemetry Peek */}
          <div className="relative z-10 flex min-w-0 items-center gap-3">
            <div className="border-border/60 bg-card/60 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border shadow-2xs transition-transform duration-200 group-hover:scale-105 dark:border-white/12 dark:bg-white/5">
              <Icon className="h-4 w-4 shrink-0" />
            </div>
            <div className="flex min-w-0 flex-col gap-0.5 text-left">
              <span className="text-foreground truncate text-[13px] leading-tight font-bold tracking-tight">
                {title}
              </span>
              <span className="text-muted-foreground truncate text-[11px] leading-tight font-medium tracking-tight">
                {peek}
              </span>
            </div>
          </div>

          {/* Right: Arrow indicator */}
          <ArrowUpRight className="relative z-10 h-3.5 w-3.5 shrink-0 opacity-60 transition-all duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:opacity-100" />
        </motion.button>
      ))}
    </div>
  );
});

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
): {
  narrative: string;
  badge?: { text: string; direction?: "up" | "down" | "neutral"; cls: string };
} {
  const deltaStr = formatDeltaValue(item.deltaValue);
  const fieldName = item.targetField ?? "national indicator";

  if (
    item.description &&
    typeof item.description === "string" &&
    item.description.trim().length > 10
  ) {
    const isPositive = (item.deltaValue ?? 0) > 0;
    const isNegative = (item.deltaValue ?? 0) < 0;
    return {
      narrative: item.description.trim(),
      badge:
        item.deltaValue !== null && item.deltaValue !== undefined
          ? isPositive
            ? {
                text: `${deltaStr} Net Expansion`,
                direction: "up",
                cls: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
              }
            : isNegative
              ? {
                  text: `${deltaStr} Contraction`,
                  direction: "down",
                  cls: "bg-red-500/10 text-red-400 border-red-500/20",
                }
              : {
                  text: `Neutral Shift`,
                  direction: "neutral",
                  cls: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
                }
          : undefined,
    };
  }

  if (item.kind === "effect") {
    return {
      narrative: `Storyteller directive logged: "${item.title}". The Executive Command Engine calculated real-time state shifts across national ${metaLabel.toLowerCase()} subsystems.`,
      badge: {
        text: "Storyteller Effect",
        cls: "bg-amber-500/10 text-amber-400 border-amber-500/20",
      },
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
      badge: {
        text: "Executive Resolution",
        cls: "bg-purple-500/10 text-purple-400 border-purple-500/20",
      },
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
    badge: { text: "Canon Record", cls: "bg-muted text-muted-foreground border-border/40" },
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
  const [visibleCount, setVisibleCount] = useState(5);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filterCat, setFilterCat] = useState<string>("all");

  const filteredItems = useMemo(() => {
    if (filterCat === "all") return items;
    return items.filter((it: any) => {
      const cat = (it.category || "").toLowerCase();
      if (filterCat === "diplomatic") return cat.includes("diplo");
      if (filterCat === "military")
        return cat.includes("milit") || cat.includes("defen") || cat.includes("secur");
      if (filterCat === "economic") return cat.includes("econ") || cat.includes("ledger");
      if (filterCat === "political")
        return cat.includes("polit") || cat.includes("elect") || cat.includes("gov");
      return true;
    });
  }, [items, filterCat]);

  const visibleItems = useMemo(
    () => filteredItems.slice(0, visibleCount),
    [filteredItems, visibleCount]
  );

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    if (target.scrollHeight - target.scrollTop - target.clientHeight < 60) {
      if (visibleCount < filteredItems.length) {
        setVisibleCount((prev) => Math.min(filteredItems.length, prev + 10));
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
      <p className="text-muted-foreground border-border/40 bg-muted/10 rounded-lg border border-dashed px-3 py-8 text-center text-xs">
        No national activity recorded yet.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {/* Activity Filter Selectors */}
      <div className="flex scrollbar-none items-center gap-1 overflow-x-auto pb-1">
        {[
          { id: "all", label: "All" },
          { id: "diplomatic", label: "Diplomacy" },
          { id: "military", label: "Defense" },
          { id: "economic", label: "Economy" },
          { id: "political", label: "Politics" },
        ].map(({ id, label }) => (
          <button
            key={id}
            type="button"
            onClick={() => setFilterCat(id)}
            className={cn(
              "shrink-0 cursor-pointer rounded-lg px-2.5 py-1 text-[11px] font-bold transition-all",
              filterCat === id
                ? "border border-amber-500/40 bg-amber-500/20 text-amber-400 shadow-xs"
                : "bg-muted/20 text-muted-foreground hover:bg-muted/40 hover:text-foreground border-border/30 border"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <div
        onScroll={handleScroll}
        className="scrollbar-thumb-muted max-h-[500px] scrollbar-thin scrollbar-track-transparent space-y-2 overflow-y-auto pr-1"
      >
        <div className="divide-border/40 divide-y">
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
                  "group cursor-pointer rounded-xl border border-transparent p-2.5 transition-all duration-200 select-none",
                  isExpanded ? "border-border/60 bg-muted/20 my-1.5 shadow-sm" : "hover:bg-muted/10"
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
                      <p className="text-foreground/90 text-[13px] leading-snug font-semibold">
                        {item.title}
                      </p>
                      <span className="text-muted-foreground/40 group-hover:text-muted-foreground shrink-0 transition-colors">
                        {isExpanded ? (
                          <ChevronUp className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        )}
                      </span>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px]">
                      <span className="text-muted-foreground font-semibold">{meta.label}</span>
                      <span className="text-muted-foreground/40">•</span>
                      <span className="text-muted-foreground">{relativeTime(item.timestamp)}</span>
                      {item.kind === "ledger" && item.targetField && (
                        <>
                          <span className="text-muted-foreground/40">•</span>
                          <span className="text-muted-foreground border-border/40 bg-muted/20 inline-flex items-center gap-1 rounded border px-1.5 py-px font-mono">
                            {item.deltaValue && item.deltaValue > 0 ? (
                              <ArrowUp className="h-3 w-3 animate-pulse stroke-[3] text-emerald-400" />
                            ) : item.deltaValue && item.deltaValue < 0 ? (
                              <ArrowDown className="h-3 w-3 animate-pulse stroke-[3] text-red-400" />
                            ) : null}
                            <span>
                              {item.targetField}: {formatDeltaValue(item.deltaValue)}
                            </span>
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Inline Expansion Drawer — Theme Compliant */}
                {isExpanded && (
                  <div
                    className="border-border/60 bg-card/60 animate-in fade-in slide-in-from-top-1 mt-3 space-y-3.5 rounded-2xl border p-4 text-xs shadow-md backdrop-blur-xl duration-200"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {/* Header Metadata & Badges */}
                    <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
                      <div className="flex items-center gap-2">
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase",
                            meta.cls
                          )}
                        >
                          <Icon className="h-3 w-3" />
                          {meta.label}
                        </span>
                        {diagnostic.badge && (
                          <span
                            className={cn(
                              "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-extrabold",
                              diagnostic.badge.cls
                            )}
                          >
                            {diagnostic.badge.direction === "up" && (
                              <ArrowUp className="h-3 w-3 stroke-[3] text-emerald-400" />
                            )}
                            {diagnostic.badge.direction === "down" && (
                              <ArrowDown className="h-3 w-3 stroke-[3] text-red-400" />
                            )}
                            <span>{diagnostic.badge.text}</span>
                          </span>
                        )}
                      </div>
                      <span className="text-muted-foreground font-mono text-[10px]">
                        {new Date(item.timestamp).toLocaleString(undefined, {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })}
                      </span>
                    </div>

                    {/* Clean Diagnostic Briefing Text */}
                    <div className="space-y-1 px-0.5">
                      <span className="text-muted-foreground block text-[10px] font-bold tracking-widest uppercase">
                        Diagnostic Briefing
                      </span>
                      <p className="text-foreground/90 text-xs leading-relaxed font-medium sm:text-[13px]">
                        {diagnostic.narrative}
                      </p>
                    </div>

                    {/* Dual Action CTAs */}
                    <div className="border-border/40 flex flex-wrap items-center justify-between gap-2 border-t pt-2">
                      <Link
                        href={createUrl(
                          "/mycountry/changelog",
                          countrySlug ? { country: countrySlug } : {}
                        )}
                        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-[11px] font-semibold transition-colors"
                      >
                        Audit Full Ledger <ArrowUpRight className="h-3 w-3" />
                      </Link>

                      {onOpenDrill && (
                        <button
                          type="button"
                          onClick={() => onOpenDrill(drill)}
                          className="border-primary/20 bg-primary/10 text-primary hover:bg-primary/20 inline-flex cursor-pointer items-center gap-1.5 rounded-xl border px-3.5 py-1.5 text-xs font-bold shadow-sm backdrop-blur-md transition-all hover:scale-105 active:scale-95"
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

        {/* Infinite scroll loader button */}
        {visibleCount < items.length && (
          <button
            type="button"
            onClick={() => setVisibleCount((prev) => Math.min(items.length, prev + 10))}
            className="text-muted-foreground hover:text-foreground w-full cursor-pointer rounded-lg border border-white/10 bg-white/[0.02] py-2 text-center text-xs font-semibold transition-all hover:bg-white/5 active:scale-[0.99]"
          >
            Load more events ({items.length - visibleCount})
          </button>
        )}
      </div>
    </div>
  );
}

function formatCooldownTime(cooldownUntil: number | null | undefined, now = Date.now()): string {
  if (!cooldownUntil) return "Resets next weekly cycle";
  const diffMs = Math.max(0, cooldownUntil - now);
  if (diffMs <= 0) return "Cooldown expiring soon";
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const mins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  const secs = Math.floor((diffMs % (1000 * 60)) / 1000);
  if (days > 0) return `${days}d ${hours}h ${mins}m`;
  if (hours > 0) return `${hours}h ${mins}m ${secs}s`;
  return `${mins}m ${secs}s`;
}

export function ExecutiveHomeComponent({
  countryId,
  onDeclare,
  onOpenDrill,
  onOpenIntent,
  onNavigate,
}: {
  countryId: string;
  onDeclare: (prefilled?: string) => void;
  onOpenDrill: (d: DrillSheetKind) => void;
  onOpenIntent: (intentId: string) => void;
  onNavigate?: (section: MyCountrySection) => void;
}) {
  const _router = useRouter();
  const feed = api.mycountry.getCanonFeed.useQuery(
    { countryId, limit: 60 },
    { enabled: !!countryId }
  );
  const status = api.intent.getStatus.useQuery({ countryId }, { enabled: !!countryId });

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!status?.data?.onCooldown) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [status?.data?.onCooldown]);

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
      {/* Primary Opportunity Briefing Hero */}
      <ExecutiveOpportunityHero
        countryId={countryId}
        onDeclare={onDeclare}
        onNavigate={onNavigate}
        onOpenDrill={onOpenDrill}
        onOpenIntent={onOpenIntent}
      />

      {/* Country Actions grid */}
      <DomainActionTiles onOpenDrill={onOpenDrill} />

      <div className="grid gap-5 lg:grid-cols-3">
        {/* Main Column: Pulse & Agenda Widget + Recent Activity Feed */}
        <div className="space-y-5 lg:col-span-2">
          {/* Primary Agenda Widget */}
          <ExecutiveAgenda
            countryId={countryId}
            onDeclare={onDeclare}
            onOpenIntent={onOpenIntent}
            onOpenDrill={onOpenDrill}
          />

          {/* Main Feed */}
          <FacetCard depth={1} className="bg-card/30 flex flex-col gap-3 p-4 backdrop-blur-md">
            <h4 className="text-muted-foreground text-xs font-bold tracking-widest uppercase">
              Recent Activity - National log
            </h4>
            <RecordFeed items={items} onOpenDrill={onOpenDrill} />
          </FacetCard>
        </div>

        {/* Rail */}
        <aside className="space-y-5">
          {canCommit ? (
            <button
              type="button"
              onClick={() => onDeclare()}
              className="group border-border/50 bg-card/40 hover:bg-card/70 text-foreground relative flex w-full cursor-pointer items-center justify-center gap-2.5 rounded-2xl border p-3 text-sm font-bold shadow-xs backdrop-blur-md transition-all duration-200 hover:border-amber-500/40 hover:shadow-md active:scale-[0.98]"
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-500 transition-all group-hover:scale-105 group-hover:bg-amber-500/20 dark:text-amber-400">
                <Command className="h-3.5 w-3.5" />
              </span>
              <span className="transition-colors group-hover:text-amber-500 dark:group-hover:text-amber-400">
                Declare a new Directive
              </span>
            </button>
          ) : (
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="w-full">
                  <button
                    type="button"
                    disabled
                    className="border-border/40 bg-card/20 text-muted-foreground flex w-full cursor-not-allowed items-center justify-center gap-2.5 rounded-2xl border p-3 text-sm font-bold opacity-75 backdrop-blur-md transition-all"
                  >
                    <span className="border-border/40 bg-muted/20 text-muted-foreground flex h-7 w-7 items-center justify-center rounded-lg border">
                      <FileClock className="h-3.5 w-3.5" />
                    </span>
                    <span>Directive on Cooldown</span>
                  </button>
                </div>
              </TooltipTrigger>
              <TooltipContent
                side="left"
                className="bg-popover/95 max-w-xs space-y-1.5 rounded-xl border border-amber-500/30 p-3 shadow-xl backdrop-blur-xl"
              >
                <div className="flex items-center gap-1.5 text-xs font-bold text-amber-500">
                  <Clock className="h-3.5 w-3.5" />
                  <span>Executive Cooldown Active</span>
                </div>
                <p className="text-muted-foreground text-[11px] leading-relaxed">
                  Your government has issued maximum weekly directives (
                  {status?.data?.usedThisWeek ?? 3}/{status?.data?.cap ?? 3}).
                </p>
                <div className="border-border/30 text-foreground flex items-center justify-between border-t pt-1.5 font-mono text-[10px] font-bold">
                  <span>Next Available Slot:</span>
                  <span className="text-amber-500 dark:text-amber-400">
                    {formatCooldownTime(status?.data?.cooldownUntil, now)}
                  </span>
                </div>
              </TooltipContent>
            </Tooltip>
          )}

          <StandingBands countryId={countryId} />
          <TerritoryMapWidget countryId={countryId} />
        </aside>
      </div>
    </div>
  );
}

const TerritoryMapWidget = React.memo(function TerritoryMapWidget({
  countryId,
}: {
  countryId: string;
}) {
  const router = useRouter();

  return (
    <FacetCard
      depth={1}
      interactive="hover"
      className="group/map border-border/80 relative overflow-hidden rounded-2xl p-0 shadow-lg backdrop-blur-xl dark:border-white/10"
    >
      {/* Interactive Map Canvas (Full Bleed Edge-to-Edge) */}
      <div className="relative h-60 w-full overflow-hidden">
        <CountryMapEmbed
          countryId={countryId}
          height="h-60"
          showNeighbors={true}
          showCities={true}
          showSubdivisions={false}
          interactive={true}
        />

        {/* Floating Glass Badges (Revealed on Hover/Activation) */}
        <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-center justify-between p-2.5 opacity-0 transition-opacity duration-200 group-focus-within/map:opacity-100 group-hover/map:opacity-100">
          {/* Top-Left: Open Maps */}
          <Link
            href="/maps"
            className="bg-background/90 text-foreground hover:bg-background group pointer-events-auto flex items-center gap-1.5 rounded-full border border-black/15 px-3 py-1 text-[11px] font-bold shadow-md backdrop-blur-xl transition-all hover:scale-105 active:scale-95 dark:border-white/20 dark:bg-zinc-900/90"
            title="Open IxWorld Maps"
          >
            <MapPin className="h-3.5 w-3.5 text-emerald-600 transition-transform group-hover:scale-110 dark:text-emerald-400" />
            <span>Open Maps</span>
            <ArrowUpRight className="text-muted-foreground group-hover:text-foreground h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </Link>

          {/* Top-Right: Map Editor */}
          <button
            type="button"
            onClick={() => router.push("/mycountry/editor")}
            className="bg-background/90 text-foreground hover:bg-background group pointer-events-auto flex cursor-pointer items-center gap-1.5 rounded-full border border-black/15 px-3 py-1 text-[11px] font-bold shadow-md backdrop-blur-xl transition-all hover:scale-105 active:scale-95 dark:border-white/20 dark:bg-zinc-900/90"
            title="Open Map Editor"
          >
            <Edit3 className="h-3.5 w-3.5 text-emerald-600 transition-transform group-hover:scale-110 dark:text-emerald-400" />
            <span>Map Editor</span>
          </button>
        </div>
      </div>
    </FacetCard>
  );
});

export const ExecutiveHome = React.memo(ExecutiveHomeComponent);
export const V2Home = ExecutiveHome;
