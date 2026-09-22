"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import {
  NavArrowDown as ChevronDown,
  NavArrowUp as ChevronUp,
  ArrowUp,
  ArrowDown,
  ArrowUpRight,
} from "iconoir-react";
import { cn, createUrl } from "~/lib/utils";
import { soundEffects } from "~/lib/sound/cuelume";
import type { V2Drill } from "~/components/mycountry/shell/DrillSheets";
import { CATEGORY_STYLE } from "./ExecutiveActionCards";

export interface CanonFeedItem {
  id: string;
  title: string;
  category?: string;
  timestamp: number | string | Date;
  kind?: string;
  description?: string | null;
  deltaValue?: number | null;
  targetField?: string | null;
}

function relativeTime(ts: number | string | Date): string {
  const timeMs = typeof ts === "number" ? ts : new Date(ts).getTime();
  const diffSec = Math.max(0, Math.floor((Date.now() - timeMs) / 1000));
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
  item: CanonFeedItem,
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
      badge: { text: "Foreign Dispatch", cls: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20" },
    };
  }

  if (item.kind === "decision") {
    return {
      narrative: `Executive resolution enacted: "${item.title}". Cabinet civil service departments have finalized implementation across local administrative channels.`,
      badge: {
        text: "Executive Resolution",
        cls: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20",
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

export function ExecutiveRecordFeed({
  items,
  countrySlug,
  onOpenDrill,
}: {
  items: CanonFeedItem[];
  countrySlug?: string;
  onOpenDrill?: (drill: Exclude<V2Drill, { kind: "intent" } | null>) => void;
}) {
  const [visibleCount, setVisibleCount] = useState(5);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filterCat, setFilterCat] = useState<string>("all");

  const filteredItems = useMemo(() => {
    if (filterCat === "all") return items;
    return items.filter((it) => {
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
          {visibleItems.map((item) => {
            const meta = (item.category && CATEGORY_STYLE[item.category]) || CATEGORY_STYLE.ledger!;
            const Icon = meta.icon;
            const isExpanded = expandedId === item.id;
            const drill = getDrillForCategory(item.category || "");
            const diagnostic = getUniqueDiagnosticNarrative(item, meta.label);

            return (
              <div
                key={item.id}
                className={cn(
                  "group cursor-pointer rounded-xl border border-transparent p-2.5 transition-all duration-200 select-none",
                  isExpanded ? "border-border/60 bg-muted/20 my-1.5 shadow-sm" : "hover:bg-muted/10"
                )}
                onClick={() => {
                  soundEffects.droplet();
                  setExpandedId((prev) => (prev === item.id ? null : item.id));
                }}
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
                              <ArrowUp className="h-3 w-3 stroke-[3] text-emerald-400" />
                            ) : item.deltaValue && item.deltaValue < 0 ? (
                              <ArrowDown className="h-3 w-3 stroke-[3] text-red-400" />
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
                          countrySlug
                            ? `/mycountry/changelog?country=${countrySlug}`
                            : "/mycountry/changelog"
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
