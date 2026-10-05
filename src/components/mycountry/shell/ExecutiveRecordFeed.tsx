"use client";

import React, { useState } from "react";
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
import { timeAgo } from "~/lib/format/compact";
import { consequenceFieldLabel } from "~/lib/intent/consequence-labels";
import type { DrillSheetKind } from "~/components/mycountry/shell/DrillSheets";
import { CATEGORY_STYLE } from "./domain-tiles";
import {
  type CanonFeedItem,
  NEGATIVE,
  POSITIVE,
  describeRecord,
  formatDeltaValue,
} from "./recordNarrative";
import { SegmentedControl } from "~/components/ui/segmented-control";
import { Card } from "~/components/ui/card";

type FeedFilter = "all" | "diplomatic" | "military" | "economic" | "political";

const FEED_FILTERS: ReadonlyArray<{ id: FeedFilter; label: string }> = [
  { id: "all", label: "All" },
  { id: "diplomatic", label: "Diplomacy" },
  { id: "military", label: "Defense" },
  { id: "economic", label: "Economy" },
  { id: "political", label: "Politics" },
];

type FeedDrill = Exclude<DrillSheetKind, { kind: "intent" } | null>;

/** Category substrings that put an item under each filter. */
const FILTER_KEYWORDS: Record<Exclude<FeedFilter, "all">, string[]> = {
  diplomatic: ["diplo"],
  military: ["milit", "defen", "secur"],
  economic: ["econ", "ledger"],
  political: ["polit", "elect", "gov"],
};

const DRILL_BY_CATEGORY: Record<string, FeedDrill> = {
  diplomatic: { kind: "relations" },
  diplomacy: { kind: "relations" },
  military: { kind: "defense" },
  defense: { kind: "defense" },
  security: { kind: "defense" },
  economic: { kind: "economy" },
  ledger: { kind: "economy" },
};

const matchesFilter = (item: CanonFeedItem, filter: FeedFilter) =>
  filter === "all" ||
  FILTER_KEYWORDS[filter].some((keyword) => (item.category || "").toLowerCase().includes(keyword));

/** One collapsible row of the activity record. */
function RecordRow({
  item,
  isExpanded,
  onToggle,
  countrySlug,
  onOpenDrill,
}: {
  item: CanonFeedItem;
  isExpanded: boolean;
  onToggle: () => void;
  countrySlug?: string;
  onOpenDrill?: (drill: FeedDrill) => void;
}) {
  const meta = (item.category && CATEGORY_STYLE[item.category]) || CATEGORY_STYLE.ledger!;
  const drill = DRILL_BY_CATEGORY[item.category || ""] ?? { kind: "politics" };
  const diagnostic = describeRecord(item, meta.label);
  const panelId = `record-${item.id}`;
  const deltaValue = item.deltaValue ?? 0;

  return (
    <li>
      <Button
        type="button"
        variant="ghost"
        aria-expanded={isExpanded}
        aria-controls={panelId}
        onClick={onToggle}
        className={cn(
          "group h-auto w-full items-start justify-start gap-3 rounded-none px-3 py-3 text-left font-normal whitespace-normal focus-visible:ring-inset",
          isExpanded && "bg-fill-3"
        )}
      >
        <span
          aria-hidden="true"
          className="bg-fill-3 text-label-secondary flex size-7 shrink-0 items-center justify-center rounded-lg"
        >
          <meta.icon className="size-3.5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="text-label text-body block leading-snug font-medium">{item.title}</span>
          <span className="text-label-secondary text-footnote mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <span>{meta.label}</span>
            <span aria-hidden="true">·</span>
            <span>{timeAgo(item.timestamp)}</span>
            {item.kind === "ledger" && item.targetField && (
              <>
                <span aria-hidden="true">·</span>
                <span className="inline-flex items-center gap-0.5 tabular-nums">
                  {deltaValue > 0 && (
                    <ArrowUp aria-hidden="true" className={cn("size-3", POSITIVE)} />
                  )}
                  {deltaValue < 0 && (
                    <ArrowDown aria-hidden="true" className={cn("size-3", NEGATIVE)} />
                  )}
                  {consequenceFieldLabel(item.targetField)} {formatDeltaValue(item.deltaValue)}
                </span>
              </>
            )}
          </span>
        </span>
        <ChevronDown
          aria-hidden="true"
          className={cn(
            "text-label-tertiary group-hover:text-label-secondary mt-1 shrink-0 transition-transform duration-150",
            isExpanded && "rotate-180"
          )}
        />
      </Button>

      {isExpanded && (
        <div
          id={panelId}
          className="animate-in fade-in slide-in-from-top-1 space-y-3 px-3 pb-4 pl-13 duration-150"
        >
          <div className="text-footnote flex flex-wrap items-center gap-2">
            {diagnostic.badge && (
              <Badge variant="outline" className={diagnostic.badge.cls}>
                {diagnostic.badge.direction === "up" && <ArrowUp aria-hidden="true" />}
                {diagnostic.badge.direction === "down" && <ArrowDown aria-hidden="true" />}
                <span>{diagnostic.badge.text}</span>
              </Badge>
            )}
            <span className="text-label-secondary tabular-nums">
              {new Date(item.timestamp).toLocaleString(undefined, {
                dateStyle: "medium",
                timeStyle: "short",
              })}
            </span>
          </div>

          <p className="text-label text-body leading-relaxed">{diagnostic.narrative}</p>

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
            <Button asChild variant="ghost" size="sm" className="text-label-secondary h-11 sm:h-8">
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
}

export function ExecutiveRecordFeed({
  items,
  countrySlug,
  onOpenDrill,
}: {
  items: CanonFeedItem[];
  countrySlug?: string;
  onOpenDrill?: (drill: FeedDrill) => void;
}) {
  const [visibleCount, setVisibleCount] = useState(5);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filterCat, setFilterCat] = useState<FeedFilter>("all");

  const filteredItems = items.filter((item) => matchesFilter(item, filterCat));
  const visibleItems = filteredItems.slice(0, visibleCount);
  const showMore = () => setVisibleCount((prev) => Math.min(filteredItems.length, prev + 10));

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    const nearBottom = target.scrollHeight - target.scrollTop - target.clientHeight < 60;
    if (nearBottom && visibleCount < filteredItems.length) showMore();
  };

  if (items.length === 0) {
    return (
      <Card className="rounded-card flex flex-col items-center px-6 py-8 text-center">
        <p className="text-label text-headline">No activity recorded yet</p>
        <p className="text-label-secondary text-footnote mt-1 max-w-sm leading-relaxed">
          Decisions, directive outcomes and issue consequences are logged here as they change your
          nation.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <SegmentedControl
        aria-label="Filter activity"
        size="sm"
        scrollable
        value={filterCat}
        onValueChange={(id) => {
          setFilterCat(id as FeedFilter);
          setExpandedId(null);
        }}
        options={FEED_FILTERS.map((opt) => ({ value: opt.id, label: opt.label }))}
      />

      <div
        onScroll={handleScroll}
        className="scrollbar-thumb-muted max-h-[520px] scrollbar-thin scrollbar-track-transparent overflow-y-auto"
      >
        {visibleItems.length === 0 ? (
          <Card className="text-label-secondary rounded-card text-footnote px-4 py-6 text-center">
            Nothing in this category yet.
          </Card>
        ) : (
          <Card className="rounded-card overflow-hidden">
            <ul className="divide-separator divide-y">
              {visibleItems.map((item) => (
                <RecordRow
                  key={item.id}
                  item={item}
                  isExpanded={expandedId === item.id}
                  onToggle={() => setExpandedId((prev) => (prev === item.id ? null : item.id))}
                  countrySlug={countrySlug}
                  onOpenDrill={onOpenDrill}
                />
              ))}
            </ul>
          </Card>
        )}

        {visibleCount < filteredItems.length && (
          <Button
            type="button"
            variant="ghost"
            onClick={showMore}
            className="text-label-secondary mt-2 h-11 w-full sm:h-9"
          >
            Show more ({filteredItems.length - visibleCount})
          </Button>
        )}
      </div>
    </div>
  );
}
