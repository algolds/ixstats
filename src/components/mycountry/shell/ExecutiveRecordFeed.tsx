"use client";

import React, { useState } from "react";
import { NavArrowDown as ChevronDown, NavArrowRight, ArrowUp, ArrowDown } from "iconoir-react";
import { cn } from "~/lib/utils";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { useNationClock } from "~/hooks/useNationClock";
import { timeAgo } from "~/lib/format/compact";
import { formatStampAsClockDate } from "~/lib/realms/nation-time";
import type { RealmClockReader } from "~/lib/realms/realm-clock";
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

type FeedFilter = "all" | "diplomatic" | "economic" | "political";

const FEED_FILTERS: ReadonlyArray<{ id: FeedFilter; label: string }> = [
  { id: "all", label: "All" },
  { id: "diplomatic", label: "Diplomacy" },
  { id: "economic", label: "Economy" },
  { id: "political", label: "Politics" },
];

type FeedDrill = Exclude<DrillSheetKind, { kind: "intent" } | null>;

/** Category substrings that put an item under each filter. */
const FILTER_KEYWORDS: Record<Exclude<FeedFilter, "all">, string[]> = {
  diplomatic: ["diplo"],
  economic: ["econ", "ledger"],
  political: ["polit", "elect", "gov"],
};

const DRILL_BY_CATEGORY: Record<string, FeedDrill> = {
  diplomatic: { kind: "relations" },
  diplomacy: { kind: "relations" },
  economic: { kind: "economy" },
  ledger: { kind: "economy" },
};

const matchesFilter = (item: CanonFeedItem, filter: FeedFilter) =>
  filter === "all" ||
  FILTER_KEYWORDS[filter].some((keyword) => (item.category || "").toLowerCase().includes(keyword));

/** One collapsible row of the activity record. */
function RecordRow({
  item,
  clock,
  isExpanded,
  onToggle,
  onOpenDrill,
}: {
  item: CanonFeedItem;
  clock: RealmClockReader | null;
  isExpanded: boolean;
  onToggle: () => void;
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
          "group rounded-control-sm h-auto w-full items-start justify-start gap-3 px-2.5 py-3 text-left font-normal whitespace-normal focus-visible:ring-inset",
          isExpanded && "bg-fill-4"
        )}
      >
        <span
          aria-hidden="true"
          className="bg-fill-3 text-label-secondary rounded-control-sm flex size-7 shrink-0 items-center justify-center"
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
        <div id={panelId} className="space-y-3 px-2.5 pt-2 pb-4 pl-12">
          <div className="text-footnote flex flex-wrap items-center gap-2">
            {diagnostic.badge && (
              <Badge variant="outline" className={diagnostic.badge.cls}>
                {diagnostic.badge.direction === "up" && <ArrowUp aria-hidden="true" />}
                {diagnostic.badge.direction === "down" && <ArrowDown aria-hidden="true" />}
                <span>{diagnostic.badge.text}</span>
              </Badge>
            )}
            <span className="text-label-secondary tabular-nums">
              {formatStampAsClockDate(item.timestamp, clock, "–")}
            </span>
          </div>

          <p className="text-label text-body leading-relaxed">{diagnostic.narrative}</p>

          {onOpenDrill && (
            <div className="flex flex-wrap items-center gap-2">
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
            </div>
          )}
        </div>
      )}
    </li>
  );
}

export function ExecutiveRecordFeed({
  items,
  onOpenDrill,
}: {
  items: CanonFeedItem[];
  onOpenDrill?: (drill: FeedDrill) => void;
}) {
  const clock = useNationClock();
  const [visibleCount, setVisibleCount] = useState(5);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filterCat, setFilterCat] = useState<FeedFilter>("all");

  const filteredItems = items.filter((item) => matchesFilter(item, filterCat));
  const visibleItems = filteredItems.slice(0, visibleCount);
  const showMore = () => setVisibleCount((prev) => Math.min(filteredItems.length, prev + 10));

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center px-4 py-6 text-center">
        <p className="text-label text-headline">No activity recorded yet</p>
        <p className="text-label-secondary text-footnote mt-1 max-w-sm leading-relaxed">
          Decisions, directive outcomes and issue consequences are logged here as they change your
          nation.
        </p>
      </div>
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

      {/* The page scrolls, not the list: an inner scroller would trap the wheel and the finger. */}
      <div>
        {visibleItems.length === 0 ? (
          <p className="text-label-secondary text-footnote px-4 py-6 text-center">
            Nothing in this category yet.
          </p>
        ) : (
          <ul className="divide-separator divide-y">
            {visibleItems.map((item) => (
              <RecordRow
                key={item.id}
                item={item}
                clock={clock}
                isExpanded={expandedId === item.id}
                onToggle={() => setExpandedId((prev) => (prev === item.id ? null : item.id))}
                onOpenDrill={onOpenDrill}
              />
            ))}
          </ul>
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
