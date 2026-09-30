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
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { FacetContainer } from "~/components/ui/facet-container";
import { FacetTabs } from "~/components/ui/facet";
import { timeAgo } from "~/lib/format/compact";
import { consequenceFieldLabel } from "~/lib/intent/consequence-labels";
import type { V2Drill } from "~/components/mycountry/shell/DrillSheets";
import { CATEGORY_STYLE } from "./ExecutiveActionCards";
import { STATUS_TEXT } from "./status-tone";

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

/** Badge text colour: only a direction of change (or a directive's accent) carries colour. */
const POSITIVE = "text-emerald-600";
const NEGATIVE = STATUS_TEXT.critical;
const NEUTRAL = STATUS_TEXT.neutral;

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
                cls: POSITIVE,
              }
            : isNegative
              ? {
                  text: `${deltaStr} decrease`,
                  direction: "down",
                  cls: NEGATIVE,
                }
              : {
                  text: "No net change",
                  direction: "neutral",
                  cls: NEUTRAL,
                }
          : undefined,
    };
  }

  if (item.kind === "effect") {
    return {
      narrative: `Storyteller directive logged: "${item.title}". The Executive Command Engine calculated real-time state shifts across national ${metaLabel.toLowerCase()} subsystems.`,
      badge: {
        text: "Storyteller effect",
        cls: STATUS_TEXT.accent,
      },
    };
  }

  if (item.kind === "diplomacy") {
    return {
      narrative: `Bilateral event "${item.title}" registered in global diplomatic dispatches. Foreign ministry officials report ongoing international standing alignment.`,
      badge: {
        text: "Foreign dispatch",
        cls: NEUTRAL,
      },
    };
  }

  if (item.kind === "decision") {
    return {
      narrative: `Executive resolution enacted: "${item.title}". Cabinet civil service departments have finalized implementation across local administrative channels.`,
      badge: {
        text: "Executive resolution",
        cls: NEUTRAL,
      },
    };
  }

  if (item.kind === "ledger" && item.targetField) {
    const isPositive = (item.deltaValue ?? 0) > 0;
    const badgeCls = isPositive ? POSITIVE : NEGATIVE;

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
    badge: { text: "Canon record", cls: NEUTRAL },
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
      <FacetContainer
        depth={3}
        surface="solid"
        className="flex flex-col items-center rounded-2xl px-6 py-8 text-center"
      >
        <p className="text-foreground text-sm font-semibold">No activity recorded yet</p>
        <p className="text-muted-foreground mt-1 max-w-sm text-xs leading-relaxed">
          Decisions, directive outcomes and issue consequences are logged here as they change your
          nation.
        </p>
      </FacetContainer>
    );
  }

  return (
    <div className="space-y-3">
      <div
        role="group"
        aria-label="Filter activity"
        className="max-w-full scrollbar-none overflow-x-auto"
      >
        <FacetTabs
          size="sm"
          tone="neutral"
          className="w-max"
          activeTab={filterCat}
          onChange={(id) => {
            setFilterCat(id as FeedFilter);
            setExpandedId(null);
          }}
          tabs={FEED_FILTERS.map((opt) => ({
            id: opt.id,
            className: "shrink-0",
            label: (
              <>
                {opt.label}
                {opt.id === filterCat ? <span className="sr-only"> (selected)</span> : null}
              </>
            ),
          }))}
        />
      </div>

      <div
        onScroll={handleScroll}
        className="scrollbar-thumb-muted max-h-[520px] scrollbar-thin scrollbar-track-transparent overflow-y-auto"
      >
        {visibleItems.length === 0 ? (
          <FacetContainer
            depth={3}
            surface="solid"
            className="text-muted-foreground rounded-2xl px-4 py-6 text-center text-xs"
          >
            Nothing in this category yet.
          </FacetContainer>
        ) : (
          <FacetContainer depth={3} surface="solid" className="overflow-hidden rounded-2xl">
            <ul className="divide-border divide-y">
              {visibleItems.map((item) => {
                const meta =
                  (item.category && CATEGORY_STYLE[item.category]) || CATEGORY_STYLE.ledger!;
                const isExpanded = expandedId === item.id;
                const drill = getDrillForCategory(item.category || "");
                const diagnostic = getUniqueDiagnosticNarrative(item, meta.label);
                const panelId = `record-${item.id}`;

                return (
                  <li key={item.id}>
                    <Button
                      type="button"
                      variant="ghost"
                      data-cuelume-press="droplet"
                      aria-expanded={isExpanded}
                      aria-controls={panelId}
                      onClick={() => setExpandedId((prev) => (prev === item.id ? null : item.id))}
                      className={cn(
                        "group h-auto w-full items-start justify-start gap-3 rounded-none px-3 py-3 text-left font-normal whitespace-normal focus-visible:ring-inset active:scale-100",
                        isExpanded && "bg-accent"
                      )}
                    >
                      <meta.icon
                        aria-hidden="true"
                        className={cn("mt-0.5 size-4 shrink-0", STATUS_TEXT[meta.tone])}
                      />
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
                                  <ArrowUp aria-hidden="true" className={cn("size-3", POSITIVE)} />
                                ) : item.deltaValue && item.deltaValue < 0 ? (
                                  <ArrowDown
                                    aria-hidden="true"
                                    className={cn("size-3", NEGATIVE)}
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
                          "text-muted-foreground/60 group-hover:text-muted-foreground mt-1 shrink-0 transition-transform duration-150",
                          isExpanded && "rotate-180"
                        )}
                      />
                    </Button>

                    {isExpanded && (
                      <div
                        id={panelId}
                        className="animate-in fade-in slide-in-from-top-1 space-y-3 px-3 pb-4 pl-10 duration-150"
                      >
                        <div className="flex flex-wrap items-center gap-2 text-xs">
                          {diagnostic.badge && (
                            <Badge variant="outline" className={diagnostic.badge.cls}>
                              {diagnostic.badge.direction === "up" && (
                                <ArrowUp aria-hidden="true" />
                              )}
                              {diagnostic.badge.direction === "down" && (
                                <ArrowDown aria-hidden="true" />
                              )}
                              <span>{diagnostic.badge.text}</span>
                            </Badge>
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
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              onClick={() => onOpenDrill(drill)}
                              className="h-11 sm:h-8"
                            >
                              Open {meta.label.toLowerCase()}
                              <NavArrowRight aria-hidden="true" className="opacity-60" />
                            </Button>
                          )}
                          <Button
                            asChild
                            variant="ghost"
                            size="sm"
                            className="text-muted-foreground h-11 sm:h-8"
                          >
                            <Link
                              href={createUrl(
                                countrySlug
                                  ? `/mycountry/changelog?country=${countrySlug}`
                                  : "/mycountry/changelog"
                              )}
                            >
                              Full ledger
                              <ArrowUpRight aria-hidden="true" className="size-3.5" />
                            </Link>
                          </Button>
                        </div>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </FacetContainer>
        )}

        {visibleCount < filteredItems.length && (
          <Button
            type="button"
            variant="ghost"
            onClick={() => setVisibleCount((prev) => Math.min(filteredItems.length, prev + 10))}
            className="text-muted-foreground mt-2 h-11 w-full sm:h-9"
          >
            Show more ({filteredItems.length - visibleCount})
          </Button>
        )}
      </div>
    </div>
  );
}
