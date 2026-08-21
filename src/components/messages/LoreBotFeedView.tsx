"use client";

import React, { useState, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import Link from "next/link";
import {
  BookOpen,
  Crown,
  Search,
  Eye,
  Bookmark,
  ExternalLink,
  History,
  User,
  Clock,
  ArrowUpRight,
  Filter,
  CheckCircle,
  FilePlus,
  Edit3,
} from "lucide-react";
import { api } from "~/trpc/react";
import { cn } from "~/lib/utils";
import { Input } from "~/components/ui/input";
import { Button } from "~/components/ui/button";
import { soundEffects } from "~/lib/sound/cuelume";
import { titleToWikiOSRoute } from "~/lib/wiki-os/url-compat";
import { parseWikitextToHtml } from "~/lib/wiki/wikitext-parser";
import { WikiHtmlContent } from "~/components/wiki-os/reader/WikiLinkPreview";

function formatTimestamp(date: Date | string): string {
  const d = new Date(date);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const isToday = d.toDateString() === now.toDateString();
  if (isToday) {
    return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  }
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

type LoreFeedFilter = "all" | "watchlist" | "recent" | "stash";

interface LoreBotFeedViewProps {
  currentUserId: string;
}

export function LoreBotFeedView({ currentUserId }: LoreBotFeedViewProps) {
  const [activeFilter, setActiveFilter] = useState<LoreFeedFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");

  // 1. Fetch recent MediaWiki changes
  const { data: recentChanges, isLoading: isLoadingRecent } =
    api.wikios.getRecentChanges.useQuery({ limit: 40 }, { staleTime: 30000 });

  // 2. Fetch user watchlist items
  const { data: watchlistItems, isLoading: isLoadingWatchlist } =
    api.wikios.getWatchlist.useQuery(undefined, {
      enabled: !!currentUserId,
      staleTime: 30000,
    });

  // 3. Fetch user stashes
  const { data: stashes } = api.wikios.getStashes.useQuery(undefined, {
    enabled: !!currentUserId,
    staleTime: 60000,
  });

  const isLoading = isLoadingRecent || (!!currentUserId && isLoadingWatchlist);

  // Merged and filtered items
  const feedItems = useMemo(() => {
    const list: any[] = [];

    // Recent changes
    if (recentChanges && Array.isArray(recentChanges)) {
      recentChanges.forEach((rc: any, idx: number) => {
        const isWatched = watchlistItems?.some(
          (w: any) => w.pageTitle.toLowerCase() === rc.title.toLowerCase()
        );
        list.push({
          id: `rc-${rc.title}-${rc.timestamp}-${idx}`,
          sourceType: "recent_change",
          title: rc.title,
          user: rc.user || "Wiki Contributor",
          timestamp: rc.timestamp,
          comment: rc.comment,
          type: rc.type || "edit",
          oldLen: rc.oldLen ?? 0,
          newLen: rc.newLen ?? 0,
          delta: (rc.newLen ?? 0) - (rc.oldLen ?? 0),
          isWatched,
        });
      });
    }

    // Watchlist items that may not be in recent changes
    if (watchlistItems && Array.isArray(watchlistItems)) {
      watchlistItems.forEach((w: any) => {
        const alreadyIncluded = list.some(
          (item) => item.title.toLowerCase() === w.pageTitle.toLowerCase()
        );
        if (!alreadyIncluded) {
          list.push({
            id: `watch-${w.id}`,
            sourceType: "watchlist_item",
            title: w.pageTitle,
            user: "Watchlist Tracked",
            timestamp: w.savedAt || w.updatedAt || new Date(),
            comment: "Article currently in your WikiOS Watchlist",
            type: "watchlist",
            delta: 0,
            isWatched: true,
          });
        }
      });
    }

    // Sort descending by timestamp
    list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return list;
  }, [recentChanges, watchlistItems]);

  const filteredItems = useMemo(() => {
    let result = feedItems;

    if (activeFilter === "watchlist") {
      result = result.filter((item) => item.isWatched || item.sourceType === "watchlist_item");
    } else if (activeFilter === "recent") {
      result = result.filter((item) => item.sourceType === "recent_change");
    } else if (activeFilter === "stash") {
      result = result.filter((item) => item.isWatched);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (item) =>
          item.title.toLowerCase().includes(q) ||
          item.user.toLowerCase().includes(q) ||
          (item.comment && item.comment.toLowerCase().includes(q))
      );
    }

    return result;
  }, [feedItems, activeFilter, searchQuery]);

  const filterTabs: { id: LoreFeedFilter; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: "all", label: "All Lorefeed", icon: BookOpen },
    { id: "watchlist", label: `Watchlist (${watchlistItems?.length ?? 0})`, icon: Eye },
    { id: "recent", label: "Recent Edits", icon: Edit3 },
    { id: "stash", label: "Stashes", icon: Bookmark },
  ];

  return (
    <div className="flex h-full flex-col">
      {/* Top Filter & Search Controls */}
      <div className="border-b border-border/40 bg-teal-500/[0.02] p-3 backdrop-blur-md dark:bg-teal-500/[0.04]">
        <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
          {/* Spring Pills */}
          <div className="flex items-center gap-1 overflow-x-auto scrollbar-none">
            {filterTabs.map((tab) => {
              const isActive = activeFilter === tab.id;
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    soundEffects.toggle();
                    setActiveFilter(tab.id);
                  }}
                  className={cn(
                    "relative flex cursor-pointer items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-[11px] font-semibold tracking-tight transition-all duration-150 select-none active:scale-95",
                    isActive
                      ? "text-teal-400 shadow-2xs"
                      : "text-muted-foreground hover:bg-accent/15 hover:text-foreground"
                  )}
                >
                  {isActive && (
                    <motion.div
                      layoutId="lorebot-filter-pill"
                      className="absolute inset-0 rounded-xl border border-teal-500/30 bg-teal-500/10 shadow-xs"
                      transition={{ type: "spring", stiffness: 450, damping: 30 }}
                    />
                  )}
                  <Icon className="relative z-10 h-3.5 w-3.5" />
                  <span className="relative z-10">{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Search bar */}
          <div className="relative min-w-[180px] max-w-xs">
            <Search className="text-muted-foreground/60 absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter lore updates..."
              className="h-8 rounded-xl border-border/40 bg-background/50 pl-8 text-xs backdrop-blur-xs"
            />
          </div>
        </div>
      </div>

      {/* Main Stream */}
      <div
        className="flex-1 space-y-3 overflow-y-auto p-4 scrollbar-none"
        style={{ scrollbarWidth: "thin", scrollbarColor: "rgba(128,128,128,0.2) transparent" }}
      >
        {isLoading ? (
          <div className="flex h-64 flex-col items-center justify-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-teal-500/20 bg-teal-500/10 text-teal-400 shadow-sm animate-pulse">
              <BookOpen className="h-5 w-5" />
            </div>
            <p className="text-xs font-semibold text-muted-foreground">Syncing LoreBot dispatches...</p>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="mx-auto flex max-w-sm flex-col items-center justify-center py-16 text-center">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl border border-teal-500/20 bg-teal-500/10 text-teal-400 shadow-sm">
              <BookOpen className="h-6 w-6" />
            </div>
            <h4 className="text-sm font-semibold text-foreground">No lore activity found</h4>
            <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
              {searchQuery
                ? `No articles match "${searchQuery}" in this filter.`
                : "Watch pages in WikiOS to receive personalized live dispatches right here."}
            </p>
            <Link
              href="/wikios"
              className="mt-4 inline-flex items-center gap-1.5 rounded-xl border border-teal-500/30 bg-teal-500/10 px-3.5 py-1.5 text-xs font-semibold text-teal-400 transition-all hover:bg-teal-500/20 active:scale-95"
            >
              <span>Explore WikiOS</span>
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {filteredItems.map((item) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ type: "spring", stiffness: 400, damping: 30 }}
                className="group relative rounded-2xl border border-border/50 bg-card/65 p-4 shadow-2xs backdrop-blur-xl transition-all duration-200 hover:border-teal-500/30 hover:bg-card/90 hover:shadow-md"
              >
                {/* Top Badge & Author Line */}
                <div className="mb-2 flex items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    {/* Source badge */}
                    {item.type === "new" ? (
                      <span className="inline-flex items-center gap-1 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[9.5px] font-bold tracking-wider uppercase text-emerald-500">
                        <FilePlus className="h-3 w-3" />
                        New Article
                      </span>
                    ) : item.type === "watchlist" ? (
                      <span className="inline-flex items-center gap-1 rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[9.5px] font-bold tracking-wider uppercase text-amber-500">
                        <Eye className="h-3 w-3" />
                        Watchlist
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-md border border-teal-500/30 bg-teal-500/10 px-2 py-0.5 text-[9.5px] font-bold tracking-wider uppercase text-teal-400">
                        <Edit3 className="h-3 w-3" />
                        Revision
                      </span>
                    )}

                    {/* Delta badge */}
                    {item.delta !== 0 && (
                      <span
                        className={cn(
                          "rounded-md px-1.5 py-0.5 text-[10px] font-bold tabular-nums",
                          item.delta > 0
                            ? "border border-emerald-500/20 bg-emerald-500/10 text-emerald-400"
                            : "border border-amber-500/20 bg-amber-500/10 text-amber-400"
                        )}
                      >
                        {item.delta > 0 ? `+${item.delta} B` : `${item.delta} B`}
                      </span>
                    )}

                    {/* Watched tag */}
                    {item.isWatched && item.type !== "watchlist" && (
                      <span className="inline-flex items-center gap-1 rounded-md border border-amber-500/20 bg-amber-500/10 px-1.5 py-0.5 text-[9.5px] font-semibold text-amber-400">
                        <Eye className="h-2.5 w-2.5" />
                        Watched
                      </span>
                    )}
                  </div>

                  {/* Timestamp */}
                  <span className="text-muted-foreground/70 flex items-center gap-1 text-[11px] font-medium tabular-nums">
                    <Clock className="h-3 w-3" />
                    {formatTimestamp(item.timestamp)}
                  </span>
                </div>

                {/* Article Header & Excerpt */}
                <div className="mb-3">
                  <h4 className="text-foreground group-hover:text-teal-400 text-sm font-bold tracking-tight transition-colors">
                    <Link
                      href={titleToWikiOSRoute(item.title)}
                      className="hover:underline"
                    >
                      {item.title}
                    </Link>
                  </h4>

                  {item.comment && (
                    <p className="text-muted-foreground mt-1 line-clamp-2 text-xs leading-relaxed font-normal">
                      <span className="font-semibold text-foreground/80">{item.user}: </span>
                      {item.comment}
                    </p>
                  )}
                </div>

                {/* Bottom Action Tray */}
                <div className="flex items-center justify-between gap-2 border-t border-border/30 pt-2.5">
                  <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <User className="h-3 w-3" />
                    <span className="font-medium text-foreground/80">{item.user}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <Link
                      href={`${titleToWikiOSRoute(item.title)}?tab=history`}
                      className="inline-flex items-center gap-1 rounded-lg border border-border/40 bg-accent/20 px-2.5 py-1 text-[11px] font-semibold text-muted-foreground transition-all hover:bg-accent/40 hover:text-foreground active:scale-95"
                    >
                      <History className="h-3 w-3" />
                      <span>History</span>
                    </Link>

                    <Link
                      href={titleToWikiOSRoute(item.title)}
                      className="inline-flex items-center gap-1 rounded-lg bg-teal-600 px-3 py-1 text-[11px] font-semibold text-white shadow-2xs transition-all hover:bg-teal-500 active:scale-95"
                    >
                      <span>Read in WikiOS</span>
                      <ArrowUpRight className="h-3 w-3" />
                    </Link>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
