"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import {
  NavArrowDown as ChevronDown,
  NavArrowRight,
  ArrowUp,
  ArrowDown,
  ArrowUpRight,
} from "iconoir-react";
import { cn, createUrl } from "~/lib/utils";
import { timeAgo } from "~/lib/format/compact";
import { consequenceFieldLabel } from "~/lib/intent/consequence-labels";
import { soundEffects } from "~/lib/sound/cuelume";
import type { V2Drill } from "~/components/mycountry/shell/DrillSheets";
import { CATEGORY_STYLE } from "./ExecutiveActionCards";
import {
  FOCUS_RING,
  GHOST_BUTTON,
  IconTile,
  SECONDARY_BUTTON,
  SegmentedFilter,
} from "./surface-kit";

type FeedFilter = "all" | "diplomatic" | "military" | "economic" | "political";

const FEED_FILTERS: ReadonlyArray<{ id: FeedFilter; label: string }> = [
  { id: "all", label: "All" },
  { id: "diplomatic", label: "Diplomacy" },
  { id: "military", label: "Defense" },
  { id: "economic", label: "Economy" },
  { id: "political", label: "Politics" },
];

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
                text: `${deltaStr} increase`,
                direction: "up",
                cls: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20",
              }
            : isNegative
              ? {
                  text: `${deltaStr} decrease`,
                  direction: "down",
                  cls: "bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20",
                }
              : {
                  text: "No net change",
                  direction: "neutral",
                  cls: "bg-cyan-500/10 text-cyan-700 dark:text-cyan-400 border-cyan-500/20",
                }
          : undefined,
    };
  }

  if (item.kind === "effect") {
    return {
      narrative: `Storyteller directive logged: "${item.title}". The Executive Command Engine calculated real-time state shifts across national ${metaLabel.toLowerCase()} subsystems.`,
      badge: {
        text: "Storyteller effect",
        cls: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20",
      },
    };
  }

  if (item.kind === "diplomacy") {
    return {
      narrative: `Bilateral event "${item.title}" registered in global diplomatic dispatches. Foreign ministry officials report ongoing international standing alignment.`,
      badge: {
        text: "Foreign dispatch",
        cls: "bg-cyan-500/10 text-cyan-700 dark:text-cyan-400 border-cyan-500/20",
      },
    };
  }

  if (item.kind === "decision") {
    return {
      narrative: `Executive resolution enacted: "${item.title}". Cabinet civil service departments have finalized implementation across local administrative channels.`,
      badge: {
        text: "Executive resolution",
        cls: "bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border-indigo-500/20",
      },
    };
  }

  if (item.kind === "ledger" && item.targetField) {
    const isPositive = (item.deltaValue ?? 0) > 0;
    const badgeCls = isPositive
      ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20"
      : "bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20";

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
    badge: { text: "Canon record", cls: "bg-muted text-muted-foreground border-border/40" },
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
  const [filterCat, setFilterCat] = useState<FeedFilter>("all");

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
      <div className="bg-muted/30 flex flex-col items-center rounded-2xl px-6 py-8 text-center">
        <p className="text-foreground text-sm font-semibold">No activity recorded yet</p>
        <p className="text-muted-foreground mt-1 max-w-sm text-xs leading-relaxed">
          Decisions, directive outcomes and issue consequences are logged here as they change your
          nation.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <SegmentedFilter
        label="Filter activity"
        options={FEED_FILTERS}
        value={filterCat}
        onChange={(id) => {
          setFilterCat(id);
          setExpandedId(null);
        }}
        className="self-start"
      />

      <div
        onScroll={handleScroll}
        className="scrollbar-thumb-muted max-h-[520px] scrollbar-thin scrollbar-track-transparent overflow-y-auto"
      >
        {visibleItems.length === 0 ? (
          <p className="text-muted-foreground bg-muted/30 rounded-2xl px-4 py-6 text-center text-xs">
            Nothing in this category yet.
          </p>
        ) : (
          <ul className="bg-muted/40 divide-border/60 divide-y overflow-hidden rounded-2xl">
            {visibleItems.map((item) => {
              const meta =
                (item.category && CATEGORY_STYLE[item.category]) || CATEGORY_STYLE.ledger!;
              const isExpanded = expandedId === item.id;
              const drill = getDrillForCategory(item.category || "");
              const diagnostic = getUniqueDiagnosticNarrative(item, meta.label);
              const panelId = `record-${item.id}`;

              return (
                <li key={item.id}>
                  <button
                    type="button"
                    aria-expanded={isExpanded}
                    aria-controls={panelId}
                    onClick={() => {
                      soundEffects.droplet();
                      setExpandedId((prev) => (prev === item.id ? null : item.id));
                    }}
                    className={cn(
                      "group hover:bg-muted/60 flex w-full cursor-pointer items-start gap-3 px-3 py-3 text-left transition-colors duration-150",
                      FOCUS_RING,
                      "focus-visible:ring-offset-0 focus-visible:ring-inset",
                      isExpanded && "bg-muted/60"
                    )}
                  >
                    <IconTile icon={meta.icon} tone={meta.tone} size="sm" className="mt-0.5" />
                    <span className="min-w-0 flex-1">
                      <span className="text-foreground block text-sm leading-snug font-medium">
                        {item.title}
                      </span>
                      <span className="text-muted-foreground mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs">
                        <span>{meta.label}</span>
                        <span aria-hidden="true">·</span>
                        <span>{timeAgo(item.timestamp)}</span>
                        {item.kind === "ledger" && item.targetField && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="inline-flex items-center gap-0.5 tabular-nums">
                              {item.deltaValue && item.deltaValue > 0 ? (
                                <ArrowUp
                                  aria-hidden="true"
                                  className="h-3 w-3 text-emerald-600 dark:text-emerald-400"
                                />
                              ) : item.deltaValue && item.deltaValue < 0 ? (
                                <ArrowDown
                                  aria-hidden="true"
                                  className="h-3 w-3 text-red-600 dark:text-red-400"
                                />
                              ) : null}
                              {consequenceFieldLabel(item.targetField)}{" "}
                              {formatDeltaValue(item.deltaValue)}
                            </span>
                          </>
                        )}
                      </span>
                    </span>
                    <ChevronDown
                      aria-hidden="true"
                      className={cn(
                        "text-muted-foreground/60 group-hover:text-muted-foreground mt-1 h-4 w-4 shrink-0 transition-transform duration-150",
                        isExpanded && "rotate-180"
                      )}
                    />
                  </button>

                  {isExpanded && (
                    <div
                      id={panelId}
                      className="animate-in fade-in slide-in-from-top-1 space-y-3 px-3 pb-4 pl-13 duration-150"
                    >
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        {diagnostic.badge && (
                          <span
                            className={cn(
                              "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-medium",
                              diagnostic.badge.cls
                            )}
                          >
                            {diagnostic.badge.direction === "up" && (
                              <ArrowUp aria-hidden="true" className="h-3 w-3" />
                            )}
                            {diagnostic.badge.direction === "down" && (
                              <ArrowDown aria-hidden="true" className="h-3 w-3" />
                            )}
                            <span>{diagnostic.badge.text}</span>
                          </span>
                        )}
                        <span className="text-muted-foreground tabular-nums">
                          {new Date(item.timestamp).toLocaleString(undefined, {
                            dateStyle: "medium",
                            timeStyle: "short",
                          })}
                        </span>
                      </div>

                      <p className="text-foreground/90 text-sm leading-relaxed">
                        {diagnostic.narrative}
                      </p>

                      <div className="flex flex-wrap items-center gap-2">
                        {onOpenDrill && (
                          <button
                            type="button"
                            onClick={() => onOpenDrill(drill)}
                            className={cn(SECONDARY_BUTTON, "sm:h-8")}
                          >
                            Open {meta.label.toLowerCase()}
                            <NavArrowRight aria-hidden="true" className="h-4 w-4 opacity-60" />
                          </button>
                        )}
                        <Link
                          href={createUrl(
                            countrySlug
                              ? `/mycountry/changelog?country=${countrySlug}`
                              : "/mycountry/changelog"
                          )}
                          className={cn(GHOST_BUTTON, "sm:h-8")}
                        >
                          Full ledger
                          <ArrowUpRight aria-hidden="true" className="h-3.5 w-3.5" />
                        </Link>
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        {visibleCount < filteredItems.length && (
          <button
            type="button"
            onClick={() => setVisibleCount((prev) => Math.min(filteredItems.length, prev + 10))}
            className={cn(GHOST_BUTTON, "mt-2 w-full")}
          >
            Show more ({filteredItems.length - visibleCount})
          </button>
        )}
      </div>
    </div>
  );
}
