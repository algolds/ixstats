"use client";

// src/app/labs/onoma/components/sections/HistorySection.tsx
// Onoma — Generation History & Favorites Timeline

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Clock, Star, ChevronDown, BarChart3, RefreshCw, Copy, Check } from "lucide-react";
import { FacetMaterial } from "~/components/ui/facet";
import { useOnomaHistory } from "~/hooks/useOnomaHistory";

type HistoryEvent = {
  id: string;
  createdAt: Date;
  category: string;
  culturalProfile: string | null;
  count: number;
  names: string[];
  favorites: Array<{ name: string }>;
};

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

export default function HistorySection({ hideHeader = false }: { hideHeader?: boolean } = {}) {
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
  const [showStats, setShowStats] = useState(false);

  const grouped = useMemo(() => groupByDate(events as HistoryEvent[]), [events]);

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
        <RefreshCw className="text-muted-foreground h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        {!hideHeader ? (
          <div>
            <h2 className="text-foreground text-xl font-bold tracking-tight">Generation History</h2>
            <p className="text-muted-foreground mt-1 text-sm">
              Every name you&apos;ve generated, searchable and replayable.
            </p>
          </div>
        ) : (
          <div />
        )}
        <button
          onClick={() => setShowStats(!showStats)}
          className="border-border/40 bg-secondary/20 text-muted-foreground flex cursor-pointer items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-all hover:border-amber-500/30 hover:bg-amber-500/10 hover:text-amber-600 active:scale-95 dark:hover:text-amber-400"
        >
          <BarChart3 className="h-3.5 w-3.5" />
          Stats
        </button>
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
            <FacetMaterial material="satin" className="border border-amber-500/20 p-4">
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <div className="text-center">
                  <p className="text-2xl font-bold text-amber-500">
                    {stats.totalNames.toLocaleString()}
                  </p>
                  <p className="text-muted-foreground text-xs">Names Generated</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-amber-500">
                    {stats.totalEvents.toLocaleString()}
                  </p>
                  <p className="text-muted-foreground text-xs">Sessions</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-amber-500">
                    {stats.totalFavorites.toLocaleString()}
                  </p>
                  <p className="text-muted-foreground text-xs">Favorites</p>
                </div>
                <div className="text-center">
                  <p className="text-foreground text-2xl font-bold capitalize">
                    {stats.categoryBreakdown[0]?.category ?? "—"}
                  </p>
                  <p className="text-muted-foreground text-xs">Top Category</p>
                </div>
              </div>
              {/* Category Breakdown */}
              {stats.categoryBreakdown.length > 1 && (
                <div className="border-border/20 mt-4 border-t pt-3">
                  <div className="flex flex-wrap gap-2">
                    {stats.categoryBreakdown.map((item) => (
                      <div
                        key={item.category}
                        className="bg-secondary/30 rounded-md px-2 py-1 text-xs"
                      >
                        <span className="text-foreground font-medium capitalize">
                          {item.category}
                        </span>
                        <span className="text-muted-foreground ml-1">
                          {item.count.toLocaleString()}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </FacetMaterial>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <select
          value={category ?? ""}
          onChange={(e) => setCategory(e.target.value || undefined)}
          className="border-border/40 bg-secondary/20 text-foreground rounded-lg border px-3 py-1.5 text-xs"
        >
          <option value="">All Categories</option>
          <option value="country">Country</option>
          <option value="city">City</option>
          <option value="province">Province</option>
          <option value="person">Person</option>
          <option value="dynasty">Dynasty</option>
          <option value="military">Military</option>
          <option value="organization">Organization</option>
          <option value="geography">Geography</option>
          <option value="culture">Culture</option>
          <option value="ship">Ship</option>
        </select>
        <button
          onClick={() => setFavoritesOnly(!favoritesOnly)}
          className={`flex cursor-pointer items-center gap-1 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-all active:scale-95 ${
            favoritesOnly
              ? "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400"
              : "border-border/40 bg-secondary/20 text-muted-foreground hover:border-amber-500/30 hover:text-amber-600"
          }`}
        >
          <Star className={`h-3 w-3 ${favoritesOnly ? "fill-amber-500" : ""}`} />
          Favorites
        </button>
      </div>

      {/* Timeline */}
      {events.length === 0 ? (
        <FacetMaterial material="satin" className="border-border/20 border p-8 text-center">
          <Clock className="text-muted-foreground mx-auto mb-3 h-10 w-10 opacity-40" />
          <p className="text-muted-foreground text-sm">
            {favoritesOnly
              ? "No favorited names yet. Star names you love to find them here."
              : "No generation history yet. Generate some names and they'll appear here."}
          </p>
        </FacetMaterial>
      ) : (
        <div className="space-y-6">
          {Array.from(grouped.entries()).map(([dateKey, dayEvents]) => (
            <div key={dateKey}>
              <h3 className="text-muted-foreground mb-3 text-xs font-semibold tracking-wider uppercase">
                {dateKey}
              </h3>
              <div className="space-y-2">
                {dayEvents.map((event) => {
                  const isExpanded = expandedEvents.has(event.id);
                  const names = event.names ?? [];
                  const favoriteNames = new Set((event.favorites ?? []).map((f) => f.name));

                  return (
                    <FacetMaterial
                      key={event.id}
                      material="satin"
                      className="border-border/20 border transition-all"
                    >
                      {/* Event Header */}
                      <button
                        onClick={() => toggleExpanded(event.id)}
                        className="flex w-full cursor-pointer items-center justify-between p-3 text-left"
                      >
                        <div className="flex items-center gap-3">
                          <div className="bg-secondary/40 rounded-md px-2 py-0.5 text-xs font-semibold capitalize">
                            {event.category}
                          </div>
                          {event.culturalProfile && (
                            <span className="text-muted-foreground text-xs capitalize">
                              {event.culturalProfile}
                            </span>
                          )}
                          <span className="text-muted-foreground text-xs">
                            {event.count} name{event.count !== 1 ? "s" : ""}
                          </span>
                          {favoriteNames.size > 0 && (
                            <span className="flex items-center gap-0.5 text-xs text-amber-500">
                              <Star className="h-3 w-3 fill-amber-500" />
                              {favoriteNames.size}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground text-xs">
                            {new Date(event.createdAt).toLocaleTimeString("en-US", {
                              hour: "numeric",
                              minute: "2-digit",
                            })}
                          </span>
                          <ChevronDown
                            className={`text-muted-foreground h-4 w-4 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                          />
                        </div>
                      </button>

                      {/* Expanded Names List */}
                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            className="overflow-hidden"
                          >
                            <div className="border-border/20 border-t px-3 pt-2 pb-3">
                              <div className="flex flex-wrap gap-1.5">
                                {names.map((name, idx) => {
                                  const isFav = favoriteNames.has(name);
                                  return (
                                    <div
                                      key={`${name}-${idx}`}
                                      className="bg-secondary/30 group flex items-center gap-1 rounded-md px-2.5 py-1 text-sm"
                                    >
                                      <span className="text-foreground">{name}</span>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          void toggleFavorite(event.id, name);
                                        }}
                                        disabled={isTogglingFavorite}
                                        className="cursor-pointer opacity-0 transition-opacity group-hover:opacity-100"
                                        title={isFav ? "Unfavorite" : "Favorite"}
                                      >
                                        <Star
                                          className={`h-3 w-3 ${isFav ? "fill-amber-500 text-amber-500" : "text-muted-foreground hover:text-amber-500"}`}
                                        />
                                      </button>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleCopy(name);
                                        }}
                                        className="cursor-pointer opacity-0 transition-opacity group-hover:opacity-100"
                                        title="Copy"
                                      >
                                        {copiedName === name ? (
                                          <Check className="h-3 w-3 text-emerald-500" />
                                        ) : (
                                          <Copy className="text-muted-foreground h-3 w-3 hover:text-emerald-500" />
                                        )}
                                      </button>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </FacetMaterial>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Load More */}
          {hasMore && (
            <div className="flex justify-center">
              <button
                onClick={() => loadMore()}
                disabled={isLoadingMore}
                className="border-border/40 bg-secondary/20 text-muted-foreground hover:bg-secondary/40 cursor-pointer rounded-lg border px-4 py-2 text-sm transition-all active:scale-95"
              >
                {isLoadingMore ? "Loading..." : "Load More"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
