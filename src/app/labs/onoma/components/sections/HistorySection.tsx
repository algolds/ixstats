"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Clock,
  Star,
  NavArrowDown as ChevronDown,
  StatsReport as BarChart3,
  Refresh as RefreshCw,
  Copy,
  Check,
  Hashtag as Hash,
  Wrench,
  Bookmark as BookmarkPlus,
  Search,
} from "iconoir-react";
import { useOnomaHistory } from "~/hooks/useOnomaHistory";
import { useNameBank } from "~/hooks/useNameBank";
import { useNotify } from "~/hooks/useNotify";
import { Input } from "~/components/ui/input";
import { FacetCard } from "~/components/ui/facet-container";
import { Button } from "~/components/ui/button";
import { Toggle } from "~/components/ui/toggle";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";

type HistoryEvent = {
  id: string;
  sessionId?: string | null;
  createdAt: Date;
  category: string;
  culturalProfile: string | null;
  count: number;
  names: string[];
  favorites: Array<{ name: string }>;
  parameters?: Record<string, unknown> | null;
};

interface HistorySectionProps {
  hideHeader?: boolean;
  onLoadToStudio?: (words: string[], title: string) => void;
}

/** Group events by human-readable date strings. */
function groupByDate(events: HistoryEvent[]): Map<string, HistoryEvent[]> {
  const groups = new Map<string, HistoryEvent[]>();
  for (const event of events) {
    const dateKey = new Date(event.createdAt).toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    const group = groups.get(dateKey) ?? [];
    group.push(event);
    groups.set(dateKey, group);
  }
  return groups;
}

export default function HistorySection({
  hideHeader = false,
  onLoadToStudio,
}: HistorySectionProps = {}) {
  const notify = useNotify();
  const bank = useNameBank();
  const {
    events,
    stats,
    isLoading,
    isLoadingMore,
    hasMore,
    loadMore,
    toggleFavorite,
    isTogglingFavorite,
    category,
    setCategory,
    favoritesOnly,
    setFavoritesOnly,
  } = useOnomaHistory();

  const [expandedEvents, setExpandedEvents] = useState<Set<string>>(new Set());
  const [copiedName, setCopiedName] = useState<string | null>(null);
  const [copiedHash, setCopiedHash] = useState<string | null>(null);
  const [showStats, setShowStats] = useState(false);
  const [hashFilter, setHashFilter] = useState("");

  const filteredEvents = useMemo(() => {
    if (!hashFilter.trim()) return events as HistoryEvent[];
    const q = hashFilter.toLowerCase().trim();
    return (events as HistoryEvent[]).filter(
      (e) =>
        (e.sessionId && e.sessionId.toLowerCase().includes(q)) ||
        e.names?.some((n) => n.toLowerCase().includes(q))
    );
  }, [events, hashFilter]);

  const grouped = useMemo(() => groupByDate(filteredEvents), [filteredEvents]);

  const handleCopy = (name: string) => {
    void navigator.clipboard.writeText(name);
    setCopiedName(name);
    setTimeout(() => setCopiedName(null), 1500);
  };

  const toggleExpanded = (eventId: string) => {
    setExpandedEvents((prev) => {
      const next = new Set(prev);
      if (next.has(eventId)) next.delete(eventId);
      else next.add(eventId);
      return next;
    });
  };

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <RefreshCw className="text-label-secondary h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        {!hideHeader ? (
          <div>
            <h2 className="text-label text-title-2 font-bold">Generation History</h2>
            <p className="text-label-secondary text-body mt-1">
              Every name you&apos;ve generated, searchable and replayable.
            </p>
          </div>
        ) : (
          <div />
        )}
        <Button variant="outline" size="sm" onClick={() => setShowStats(!showStats)}>
          <BarChart3 className="h-3.5 w-3.5" />
          Stats
        </Button>
      </div>

      {/* Stats Panel */}
      <AnimatePresence>
        {showStats && stats && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <FacetCard variant="inset" padding="none" className="p-4">
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <div className="text-center">
                  <p className="text-title-1 text-yellow font-bold">
                    {stats.totalNames.toLocaleString()}
                  </p>
                  <p className="text-label-secondary text-footnote">Names Generated</p>
                </div>
                <div className="text-center">
                  <p className="text-title-1 text-yellow font-bold">
                    {stats.totalEvents.toLocaleString()}
                  </p>
                  <p className="text-label-secondary text-footnote">Sessions</p>
                </div>
                <div className="text-center">
                  <p className="text-title-1 text-yellow font-bold">
                    {stats.totalFavorites.toLocaleString()}
                  </p>
                  <p className="text-label-secondary text-footnote">Favorites</p>
                </div>
                <div className="text-center">
                  <p className="text-label text-title-1 font-bold capitalize">
                    {stats.categoryBreakdown[0]?.category ?? "—"}
                  </p>
                  <p className="text-label-secondary text-footnote">Top Category</p>
                </div>
              </div>
              {/* Category Breakdown */}
              {stats.categoryBreakdown.length > 1 && (
                <div className="border-separator mt-4 border-t pt-3">
                  <div className="flex flex-wrap gap-2">
                    {stats.categoryBreakdown.map((item) => (
                      <div
                        key={item.category}
                        className="bg-fill-3 rounded-control-sm text-footnote px-2 py-1"
                      >
                        <span className="text-label font-medium capitalize">{item.category}</span>
                        <span className="text-label-secondary ml-1">
                          {item.count.toLocaleString()}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </FacetCard>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Search & Filters */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="relative w-full sm:w-64">
          <Search className="text-label-secondary absolute top-2 left-3 h-3.5 w-3.5" />
          <Input
            type="text"
            placeholder="Search run hash or name..."
            value={hashFilter}
            onChange={(e) => setHashFilter(e.target.value)}
            className="text-footnote w-full pr-4 pl-8"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={(category ?? "") || "__none__"}
            onValueChange={(v) => setCategory((v === "__none__" ? "" : v) || undefined)}
          >
            <SelectTrigger size="sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">All Categories</SelectItem>
              <SelectItem value="country">Country</SelectItem>
              <SelectItem value="city">City</SelectItem>
              <SelectItem value="province">Province</SelectItem>
              <SelectItem value="person">Person</SelectItem>
              <SelectItem value="dynasty">Dynasty</SelectItem>
              <SelectItem value="military">Military</SelectItem>
              <SelectItem value="organization">Organization</SelectItem>
              <SelectItem value="geography">Geography</SelectItem>
              <SelectItem value="culture">Culture</SelectItem>
              <SelectItem value="ship">Ship</SelectItem>
              <SelectItem value="sandbox">Sandbox</SelectItem>
            </SelectContent>
          </Select>
          <Toggle
            variant="outline"
            size="sm"
            pressed={favoritesOnly}
            onPressedChange={setFavoritesOnly}
            className="hover:text-yellow-ink data-[state=on]:bg-yellow/15 data-[state=on]:text-yellow-ink data-[state=on]:hover:bg-yellow/25 px-3"
          >
            <Star className={`h-3 w-3 ${favoritesOnly ? "fill-yellow" : ""}`} />
            Favorites
          </Toggle>
        </div>
      </div>

      {/* Timeline */}
      {filteredEvents.length === 0 ? (
        <FacetCard variant="inset" padding="none">
          <div className="flex flex-col items-center justify-center space-y-2 p-8 text-center">
            <Clock className="text-label-secondary mb-1 h-10 w-10 opacity-40" />
            <p className="text-label-secondary text-body max-w-sm">
              {hashFilter
                ? "No generation events match your search query."
                : favoritesOnly
                  ? "No favorited names yet. Star names you love to find them here."
                  : "No generation history yet. Generate some names and they'll appear here."}
            </p>
          </div>
        </FacetCard>
      ) : (
        <div className="space-y-6">
          {Array.from(grouped.entries()).map(([dateKey, dayEvents]) => (
            <div key={dateKey}>
              <h3 className="text-label-secondary text-subhead mb-3">{dateKey}</h3>
              <div className="space-y-2">
                {dayEvents.map((event) => {
                  const isExpanded = expandedEvents.has(event.id);
                  const names = event.names ?? [];
                  const favoriteNames = new Set((event.favorites ?? []).map((f) => f.name));

                  return (
                    <FacetCard
                      variant="inset"
                      padding="none"
                      key={event.id}
                      className="transition-[color,background-color,border-color,box-shadow,opacity,transform]"
                    >
                      {/* Event Header */}
                      <Button
                        variant="ghost"
                        onClick={() => toggleExpanded(event.id)}
                        aria-expanded={isExpanded}
                        className="rounded-row h-auto w-full justify-between p-3 text-left font-normal whitespace-normal active:scale-100"
                      >
                        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                          <div className="bg-fill-3 rounded-control-sm text-footnote px-2 py-0.5 font-semibold capitalize">
                            {event.category}
                          </div>
                          {event.sessionId && (
                            <span
                              onClick={(e) => {
                                e.stopPropagation();
                                void navigator.clipboard.writeText(event.sessionId!);
                                setCopiedHash(event.sessionId!);
                                setTimeout(() => setCopiedHash(null), 1500);
                              }}
                              className="bg-tint/10 text-tint hover:bg-tint/20 rounded-control-sm text-caption flex items-center gap-1 px-2 py-0.5 font-mono transition-colors"
                              title="Click to copy unique run hash"
                            >
                              <Hash className="h-2.5 w-2.5" />
                              <span>{event.sessionId}</span>
                              {copiedHash === event.sessionId ? (
                                <Check className="text-green h-2.5 w-2.5" />
                              ) : (
                                <Copy className="h-2.5 w-2.5 opacity-60" />
                              )}
                            </span>
                          )}
                          {event.culturalProfile && (
                            <span className="text-label-secondary text-footnote capitalize">
                              {event.culturalProfile}
                            </span>
                          )}
                          <span className="text-label-secondary text-footnote">
                            {event.count} name{event.count !== 1 ? "s" : ""}
                          </span>
                          {favoriteNames.size > 0 && (
                            <span className="text-footnote text-yellow flex items-center gap-0.5">
                              <Star className="fill-yellow h-3 w-3" />
                              {favoriteNames.size}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-label-secondary text-footnote">
                            {new Date(event.createdAt).toLocaleTimeString("en-US", {
                              hour: "numeric",
                              minute: "2-digit",
                            })}
                          </span>
                          <ChevronDown
                            className={`text-label-secondary h-4 w-4 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                          />
                        </div>
                      </Button>

                      {/* Expanded Names List & Batch Actions */}
                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            className="overflow-hidden"
                          >
                            <div className="border-separator space-y-3 border-t px-3 pt-2 pb-4">
                              {/* Batch Actions Bar */}
                              <div className="border-separator flex flex-wrap items-center justify-between gap-2 border-b pb-2">
                                <div className="text-label-secondary text-caption">
                                  Run payload ({names.length} names)
                                </div>
                                <div className="flex flex-wrap items-center gap-2">
                                  {onLoadToStudio && (
                                    <Button
                                      variant="secondary"
                                      size="sm"
                                      type="button"
                                      onClick={() =>
                                        onLoadToStudio(
                                          names,
                                          event.sessionId
                                            ? `Run ${event.sessionId}`
                                            : `${event.category} batch`
                                        )
                                      }

                                      title="Load entire run into Studio Workshop"
                                    >
                                      <Wrench className="h-3 w-3" />
                                      <span>Load to Studio</span>
                                    </Button>
                                  )}
                                  <Button
                                    variant="secondary"
                                    size="sm"
                                    onClick={async () => {
                                      const title = event.sessionId
                                        ? `Run ${event.sessionId}`
                                        : `${event.category.toUpperCase()} Run`;
                                      await bank.saveEntry({
                                        type: "dictionary",
                                        title,
                                        values: names,
                                        category: event.category as any,
                                      });
                                      notify.success(`Saved run as dictionary "${title}"!`);
                                    }}
                                    title="Save entire run as custom Stash Dictionary"
                                  >
                                    <BookmarkPlus className="h-3 w-3" />
                                    <span>Save as Dictionary</span>
                                  </Button>
                                  <Button
                                    variant="secondary"
                                    size="sm"
                                    type="button"
                                    onClick={() => {
                                      void navigator.clipboard.writeText(names.join(", "));
                                      notify.success("Copied all names to clipboard.");
                                    }}

                                    title="Copy all names comma-separated"
                                  >
                                    <Copy className="h-3 w-3" />
                                    <span>Copy All</span>
                                  </Button>
                                </div>
                              </div>

                              {/* Badges Grid */}
                              <div className="flex flex-wrap gap-2">
                                {names.map((name, idx) => {
                                  const isFav = favoriteNames.has(name);
                                  return (
                                    <div
                                      key={`${name}-${idx}`}
                                      className="bg-fill-3 group rounded-control-sm text-body flex items-center gap-1 px-3 py-1"
                                    >
                                      <span className="text-label">{name}</span>
                                      <Button
                                        variant="ghost"
                                        size="icon-sm"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          void toggleFavorite(event.id, name);
                                        }}
                                        disabled={isTogglingFavorite}
                                        title={isFav ? "Unfavorite" : "Favorite"}
                                        aria-label={isFav ? "Unfavorite" : "Favorite"}
                                        className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
                                      >
                                        <Star
                                          className={`h-3 w-3 ${isFav ? "fill-yellow text-yellow" : "text-label-secondary hover:text-yellow"}`}
                                        />
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="icon-sm"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleCopy(name);
                                        }}
                                        title="Copy"
                                        aria-label="Copy"
                                        className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
                                      >
                                        {copiedName === name ? (
                                          <Check className="text-green h-3 w-3" />
                                        ) : (
                                          <Copy className="text-label-secondary hover:text-green h-3 w-3" />
                                        )}
                                      </Button>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </FacetCard>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Load More */}
          {hasMore && (
            <div className="flex justify-center">
              <Button
                variant="outline"
                size="default"
                onClick={() => loadMore()}
                disabled={isLoadingMore}
              >
                {isLoadingMore ? "Loading..." : "Load More"}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
