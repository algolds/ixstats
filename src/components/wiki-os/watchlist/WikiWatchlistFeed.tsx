"use client";
// src/components/wiki-os/watchlist/WikiWatchlistFeed.tsx
// Native Stash Watchlist Activity Feed with inline DiffViewer & unread indicators

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
      <div className="border-border/40 bg-card/75 rounded-2xl border p-6 backdrop-blur-xl">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/15 text-amber-400">
                <Eye className="h-5 w-5" />
              </div>
              <h1 className="text-foreground text-xl font-bold">Stash Watchlist</h1>
            </div>
            <p className="text-muted-foreground text-xs">
              Tracking changes across{" "}
              <span className="text-foreground font-semibold">{watchlistItems?.length ?? 0}</span>{" "}
              watched articles
              {unreadCount > 0 && (
                <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-medium text-emerald-400">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
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
                className="border-border/40 bg-secondary/60 text-foreground hover:bg-secondary inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-medium transition-all duration-160 active:scale-[0.98]"
              >
                <Check className="h-3.5 w-3.5 text-emerald-400" />
                Mark all as visited
              </button>
            )}

            <button
              type="button"
              onClick={() => void refetch()}
              disabled={isRefetching}
              className="border-border/40 bg-secondary/60 text-muted-foreground hover:bg-secondary hover:text-foreground inline-flex h-8 w-8 items-center justify-center rounded-xl border transition-all duration-160 active:scale-[0.98]"
              title="Refresh Watchlist"
            >
              <RefreshCw className={`h-4 w-4 ${isRefetching ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>

        {/* Filters Bar */}
        <div className="border-border/30 mt-5 flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
          {/* Timeframe Selector */}
          <div className="flex items-center gap-1.5">
            <Calendar className="text-muted-foreground mr-1 h-4 w-4" />
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
                className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-all duration-160 active:scale-[0.98] ${
                  days === t.val
                    ? "bg-wiki/20 border-wiki/40 text-wiki border font-semibold"
                    : "bg-secondary/40 text-muted-foreground hover:bg-secondary hover:text-foreground"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Search Filter */}
          <div className="relative flex-1 sm:max-w-xs">
            <Search className="text-muted-foreground absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2" />
            <input
              type="text"
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              placeholder="Filter changes…"
              className="border-border/40 bg-background/50 text-foreground placeholder:text-muted-foreground/60 focus:border-wiki/60 focus:ring-wiki/60 h-8 w-full rounded-xl border pr-3 pl-8 text-xs focus:ring-1 focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* Feed List */}
      <div className="space-y-3">
        {isLoading ? (
          <div className="border-border/40 bg-card/40 flex h-48 items-center justify-center rounded-2xl border">
            <div className="border-wiki h-6 w-6 animate-spin rounded-full border-2 border-t-transparent" />
          </div>
        ) : filteredFeed.length === 0 ? (
          <div className="border-border/50 bg-card/30 flex flex-col items-center justify-center rounded-2xl border border-dashed p-12 text-center">
            <EyeClosed className="text-muted-foreground/40 mb-3 h-10 w-10" />
            <h3 className="text-foreground text-sm font-semibold">No recent changes</h3>
            <p className="text-muted-foreground mt-1 max-w-sm text-xs">
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
                className="border-border/40 bg-card/60 hover:border-border hover:bg-card/80 overflow-hidden rounded-2xl border transition-all duration-160"
              >
                {/* Row Header */}
                <div className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-start gap-3">
                    {/* Unread indicator */}
                    <div className="mt-1 flex h-4 w-4 items-center justify-center">
                      {item.isUnread ? (
                        <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400 ring-4 ring-emerald-400/20" />
                      ) : (
                        <span className="bg-muted-foreground/30 h-1.5 w-1.5 rounded-full" />
                      )}
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <Link
                          href={withBasePath(`/wiki/${item.articleSlug}`)}
                          className="text-foreground hover:text-wiki text-sm font-semibold transition-colors"
                        >
                          {item.articleTitle}
                        </Link>
                        {item.namespacePrefix && (
                          <span className="bg-secondary/80 text-muted-foreground rounded px-1.5 py-0.5 text-[10px] font-medium">
                            {item.namespacePrefix}
                          </span>
                        )}
                        {item.minor && (
                          <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-amber-400">
                            m
                          </span>
                        )}
                      </div>

                      <div className="text-muted-foreground mt-1 flex flex-wrap items-center gap-2 text-xs">
                        <span>
                          by{" "}
                          <strong className="text-foreground/90 font-medium">{item.author}</strong>
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
                              className={`font-mono text-[11px] font-medium ${isPositive ? "text-emerald-400" : isNegative ? "text-rose-400" : "text-muted-foreground"}`}
                            >
                              {isPositive ? `+${delta}` : delta} B
                            </span>
                          </>
                        )}
                      </div>

                      {item.summary && (
                        <p className="text-muted-foreground/80 mt-1 text-xs italic">
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
                      className={`rounded-xl px-3 py-1.5 text-xs font-medium transition-all duration-160 active:scale-[0.98] ${
                        isExpanded
                          ? "bg-wiki/20 border-wiki/40 text-wiki border"
                          : "border-border/40 bg-secondary/60 text-foreground hover:bg-secondary border"
                      }`}
                    >
                      {isExpanded ? "Hide Diff" : "Inline Diff"}
                    </button>

                    <button
                      type="button"
                      onClick={() => unwatchMutation.mutate({ pageTitle: item.articleTitle })}
                      className="text-muted-foreground hover:bg-secondary rounded-xl p-1.5 transition-colors hover:text-rose-400"
                      title="Unwatch page"
                    >
                      <EyeClosed className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {/* Inline Slide-Down Diff Viewer */}
                {isExpanded && (
                  <div className="border-border/40 bg-background/75 animate-in fade-in border-t p-4 duration-200">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-muted-foreground text-xs font-medium">
                        Revision <strong className="text-foreground">{item.id}</strong> preview
                      </span>
                      <Link
                        href={withBasePath(`/wiki/history/${item.articleSlug}`)}
                        className="text-wiki text-xs font-medium hover:underline"
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
