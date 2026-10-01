"use client";
// src/components/wiki-os/watchlist/WikiWatchlistFeed.tsx
// Native Stash Watchlist Activity Feed with inline DiffViewer & unread indicators

import { cn } from "~/lib/utils";
import * as React from "react";
import Link from "next/link";
import { Eye, EyeClosed, Check, Search, Calendar, Refresh as RefreshCw } from "iconoir-react";
import { api } from "~/trpc/react";
import { DiffViewer } from "~/components/diff-viewer";
import { withBasePath } from "~/lib/base-path";

export function WikiWatchlistFeed() {
  const [days, setDays] = React.useState<number>(7);
  const [filterQuery, setFilterQuery] = React.useState<string>("");
  const [expandedRevId, setExpandedRevId] = React.useState<string | null>(null);

  const utils = api.useUtils();

  const {
    data: feed,
    isLoading,
    refetch,
    isRefetching,
  } = api.wikios.getWatchlistFeed.useQuery({ days, limit: 50 }, { staleTime: 15_000 });

  const { data: watchlistItems } = api.wikios.getWatchlist.useQuery(undefined, {
    staleTime: 30_000,
  });

  const markAllVisitedMutation = api.wikios.markAllWatchedVisited.useMutation({
    onSuccess: () => {
      void utils.wikios.getWatchlistFeed.invalidate();
      void utils.wikios.getWatchlist.invalidate();
    },
  });

  const unwatchMutation = api.wikios.unwatchPage.useMutation({
    onSuccess: () => {
      void utils.wikios.getWatchlistFeed.invalidate();
      void utils.wikios.getWatchlist.invalidate();
    },
  });

  const unreadCount = feed?.filter((item) => item.isUnread).length ?? 0;

  const filteredFeed = React.useMemo(() => {
    if (!feed) return [];
    if (!filterQuery.trim()) return feed;
    const q = filterQuery.toLowerCase();
    return feed.filter(
      (item) =>
        item.articleTitle.toLowerCase().includes(q) ||
        item.author.toLowerCase().includes(q) ||
        (item.summary && item.summary.toLowerCase().includes(q))
    );
  }, [feed, filterQuery]);

  return (
    <div className="space-y-6">
      {/* Header Deck */}
      <div className="border-separator bg-surface rounded-card border p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="rounded-control bg-yellow/15 text-yellow flex h-8 w-8 items-center justify-center">
                <Eye className="h-5 w-5" />
              </div>
              <h1 className="text-label text-title-2">Stash Watchlist</h1>
            </div>
            <p className="text-label-secondary text-footnote">
              Tracking changes across{" "}
              <span className="text-label font-semibold">{watchlistItems?.length ?? 0}</span>{" "}
              watched articles
              {unreadCount > 0 && (
                <span className="bg-green/15 text-caption text-green ml-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5">
                  <span className="bg-green/70 h-1.5 w-1.5 animate-pulse rounded-full" />
                  {unreadCount} unread
                </span>
              )}
            </p>
          </div>

          {/* Action Bar */}
          <div className="flex flex-wrap items-center gap-2">
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={() => markAllVisitedMutation.mutate()}
                disabled={markAllVisitedMutation.isPending}
                className="border-separator bg-fill-3 text-label hover:bg-fill-3 rounded-row text-caption inline-flex items-center gap-1.5 border px-3 py-1.5 transition-[color,background-color,border-color,box-shadow,opacity,transform] duration-160 active:scale-[0.98]"
              >
                <Check className="text-green h-3.5 w-3.5" />
                Mark all as visited
              </button>
            )}

            <button
              type="button"
              onClick={() => void refetch()}
              disabled={isRefetching}
              className="border-separator bg-fill-3 text-label-secondary hover:bg-fill-3 hover:text-label rounded-row inline-flex h-8 w-8 items-center justify-center border transition-[color,background-color,border-color,box-shadow,opacity,transform] duration-160 active:scale-[0.98]"
              title="Refresh Watchlist"
            >
              <RefreshCw className={`h-4 w-4 ${isRefetching ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>

        {/* Filters Bar */}
        <div className="border-separator mt-5 flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
          {/* Timeframe Selector */}
          <div className="flex items-center gap-1.5">
            <Calendar className="text-label-secondary mr-1 h-4 w-4" />
            {[
              { label: "24h", val: 1 },
              { label: "3d", val: 3 },
              { label: "7d", val: 7 },
              { label: "30d", val: 30 },
            ].map((t) => (
              <button
                key={t.val}
                type="button"
                onClick={() => setDays(t.val)}
                className={cn(
                  "rounded-control text-caption px-2.5 py-1 transition-[color,background-color,border-color,box-shadow,opacity,transform] duration-160 active:scale-[0.98]",
                  days === t.val
                    ? "bg-tint/20 border-tint/40 text-tint border font-semibold"
                    : "bg-fill-3 text-label-secondary hover:bg-fill-3 hover:text-label"
                )}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Search Filter */}
          <div className="relative flex-1 sm:max-w-xs">
            <Search className="text-label-secondary absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2" />
            <input
              type="text"
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              placeholder="Filter changes…"
              className="border-separator bg-surface text-label placeholder:text-label-tertiary focus:border-tint/60 focus:ring-tint/60 rounded-row text-footnote h-8 w-full border pr-3 pl-8 focus:ring-1 focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* Feed List */}
      <div className="space-y-3">
        {isLoading ? (
          <div className="border-separator bg-surface rounded-card flex h-48 items-center justify-center border">
            <div className="border-tint h-6 w-6 animate-spin rounded-full border-2 border-t-transparent" />
          </div>
        ) : filteredFeed.length === 0 ? (
          <div className="border-separator bg-surface rounded-card flex flex-col items-center justify-center border border-dashed p-12 text-center">
            <EyeClosed className="text-label-secondary mb-3 h-10 w-10" />
            <h3 className="text-label text-headline">No recent changes</h3>
            <p className="text-label-secondary text-footnote mt-1 max-w-sm">
              {watchlistItems?.length === 0
                ? "You haven't added any articles to your watchlist yet. Star or watch articles to track changes here."
                : `None of your watched articles were edited in the last ${days} day${days > 1 ? "s" : ""}.`}
            </p>
          </div>
        ) : (
          filteredFeed.map((item) => {
            const isExpanded = expandedRevId === item.id;
            const delta = item.byteDelta;
            const isPositive = delta > 0;
            const isNegative = delta < 0;

            return (
              <div
                key={item.id}
                className="border-separator bg-surface hover:border-separator hover:bg-surface rounded-card overflow-hidden border transition-[color,background-color,border-color,box-shadow,opacity,transform] duration-160"
              >
                {/* Row Header */}
                <div className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-start gap-3">
                    {/* Unread indicator */}
                    <div className="mt-1 flex h-4 w-4 items-center justify-center">
                      {item.isUnread ? (
                        <span className="bg-green/70 ring-green/20 h-2 w-2 animate-pulse rounded-full ring-4" />
                      ) : (
                        <span className="bg-muted-foreground/30 h-1.5 w-1.5 rounded-full" />
                      )}
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <Link
                          href={withBasePath(`/wiki/${item.articleSlug}`)}
                          className="text-label hover:text-tint text-headline transition-colors"
                        >
                          {item.articleTitle}
                        </Link>
                        {item.namespacePrefix && (
                          <span className="bg-fill-2 text-label-secondary rounded-control-sm text-caption px-1.5 py-0.5">
                            {item.namespacePrefix}
                          </span>
                        )}
                        {item.minor && (
                          <span className="rounded-control-sm bg-yellow/15 text-caption text-yellow px-1.5 py-0.5 font-semibold">
                            m
                          </span>
                        )}
                      </div>

                      <div className="text-label-secondary text-footnote mt-1 flex flex-wrap items-center gap-2">
                        <span>
                          by <strong className="text-label font-medium">{item.author}</strong>
                        </span>
                        <span>•</span>
                        <span>
                          {new Date(item.createdAt).toLocaleString(undefined, {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                        {delta !== 0 && (
                          <>
                            <span>•</span>
                            <span
                              className={`text-caption tabular-nums ${isPositive ? "text-green" : isNegative ? "text-red" : "text-label-secondary"}`}
                            >
                              {isPositive ? `+${delta}` : delta} B
                            </span>
                          </>
                        )}
                      </div>

                      {item.summary && (
                        <p className="text-label-secondary text-footnote mt-1 italic">
                          &ldquo;{item.summary}&rdquo;
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Row Actions */}
                  <div className="flex items-center gap-2 self-end sm:self-center">
                    <button
                      type="button"
                      onClick={() => setExpandedRevId(isExpanded ? null : item.id)}
                      className={cn(
                        "rounded-row text-caption px-3 py-1.5 transition-[color,background-color,border-color,box-shadow,opacity,transform] duration-160 active:scale-[0.98]",
                        isExpanded
                          ? "bg-tint/20 border-tint/40 text-tint border"
                          : "border-separator bg-fill-3 text-label hover:bg-fill-3 border"
                      )}
                    >
                      {isExpanded ? "Hide Diff" : "Inline Diff"}
                    </button>

                    <button
                      type="button"
                      onClick={() => unwatchMutation.mutate({ pageTitle: item.articleTitle })}
                      className="text-label-secondary hover:bg-fill-3 rounded-row hover:text-red p-1.5 transition-colors"
                      title="Unwatch page"
                    >
                      <EyeClosed className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {/* Inline Slide-Down Diff Viewer */}
                {isExpanded && (
                  <div className="border-separator bg-surface animate-in fade-in border-t p-4 duration-200">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-label-secondary text-caption">
                        Revision <strong className="text-label">{item.id}</strong> preview
                      </span>
                      <Link
                        href={withBasePath(`/wiki/history/${item.articleSlug}`)}
                        className="text-tint text-caption hover:underline"
                      >
                        View Full History &rarr;
                      </Link>
                    </div>

                    <DiffViewer
                      oldCode=""
                      newCode={item.wikitext}
                      layout="unified"
                      language="markdown"
                      newTitle={`${item.articleTitle} (${item.author})`}
                    />
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
