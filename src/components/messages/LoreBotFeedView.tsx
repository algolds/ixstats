"use client";

import React, { useState, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import Link from "next/link";
// oxlint-disable-next-line eslint/no-unused-vars
import {
  OpenBook as BookOpen,
  Eye,
  Bookmark,
  ClockRotateRight as History,
  User,
  Clock,
  ArrowUpRight,
  CheckCircle,
  PagePlus as FilePlus,
  EditPencil as Edit3,
} from "iconoir-react";
import { api } from "~/trpc/react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { EmptyState } from "~/components/ui/empty-state";
import { SearchField } from "~/components/ui/search-field";
import { SegmentedControl } from "~/components/ui/segmented-control";
import { springSmooth } from "~/lib/design/motion";
import { soundEffects } from "~/lib/sound/cuelume";
import { titleToWikiOSRoute } from "~/lib/wiki-os/transformers/url-compat";
// oxlint-disable-next-line eslint/no-unused-vars
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
  const { data: recentChanges, isLoading: isLoadingRecent } = api.wikios.getRecentChanges.useQuery(
    { limit: 40 },
    { staleTime: 30000 }
  );

  // 2. Fetch user watchlist items
  const { data: watchlistItems, isLoading: isLoadingWatchlist } = api.wikios.getWatchlist.useQuery(
    undefined,
    {
      enabled: !!currentUserId,
      staleTime: 30000,
    }
  );

  // 3. Fetch user stashes
  // oxlint-disable-next-line eslint/no-unused-vars
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

  const filterTabs: {
    id: LoreFeedFilter;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
  }[] = [
    { id: "all", label: "All Lorefeed", icon: BookOpen },
    { id: "watchlist", label: `Watchlist (${watchlistItems?.length ?? 0})`, icon: Eye },
    { id: "recent", label: "Recent edits", icon: Edit3 },
    { id: "stash", label: "Stashes", icon: Bookmark },
  ];

  return (
    <div className="flex h-full flex-col">
      {/* Top Filter & Search Controls */}
      <div className="border-separator border-b p-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <SegmentedControl
            size="sm"
            aria-label="Lore feed filter"
            value={activeFilter}
            onValueChange={(value) => {
              soundEffects.toggle();
              setActiveFilter(value);
            }}
            options={filterTabs.map((tab) => {
              const Icon = tab.icon;
              return { value: tab.id, label: tab.label, icon: <Icon /> };
            })}
            className="max-w-full scrollbar-none overflow-x-auto"
          />

          <SearchField
            size="sm"
            containerClassName="max-w-xs min-w-[180px]"
            value={searchQuery}
            onValueChange={setSearchQuery}
            placeholder="Filter lore updates..."
            aria-label="Filter lore updates"
          />
        </div>
      </div>

      {/* Main Stream */}
      <div
        className="flex-1 scrollbar-none space-y-3 overflow-y-auto p-4"
        style={{ scrollbarWidth: "thin" }}
      >
        {isLoading ? (
          <div className="flex h-64 flex-col items-center justify-center gap-3">
            <span className="border-tint size-5 animate-spin rounded-full border-2 border-t-transparent" />
            <p className="text-footnote text-label-secondary">Syncing LoreBot dispatches...</p>
          </div>
        ) : filteredItems.length === 0 ? (
          <EmptyState
            className="mx-auto max-w-sm py-16"
            icon={<BookOpen />}
            title="No lore activity found"
            message={
              searchQuery
                ? `No articles match "${searchQuery}" in this filter.`
                : "Watch pages in WikiOS to follow their changes here."
            }
            action={
              <Button asChild variant="secondary" size="sm">
                <Link href="/wikios">
                  <span>Explore WikiOS</span>
                  <ArrowUpRight aria-hidden="true" />
                </Link>
              </Button>
            }
          />
        ) : (
          <AnimatePresence initial={false}>
            {filteredItems.map((item) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={springSmooth}
                className="group bg-surface-secondary rounded-row relative p-4"
              >
                {/* Top Badge & Author Line */}
                <div className="mb-2 flex items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    {/* Source badge */}
                    {item.type === "new" ? (
                      <Badge variant="success">
                        <FilePlus aria-hidden="true" />
                        New article
                      </Badge>
                    ) : item.type === "watchlist" ? (
                      <Badge variant="warning">
                        <Eye aria-hidden="true" />
                        Watchlist
                      </Badge>
                    ) : (
                      <Badge variant="info">
                        <Edit3 aria-hidden="true" />
                        Revision
                      </Badge>
                    )}

                    {/* Delta badge */}
                    {item.delta !== 0 && (
                      <Badge
                        variant={item.delta > 0 ? "success" : "warning"}
                        className="tabular-nums"
                      >
                        {item.delta > 0 ? `+${item.delta} B` : `${item.delta} B`}
                      </Badge>
                    )}

                    {/* Watched tag */}
                    {item.isWatched && item.type !== "watchlist" && (
                      <Badge variant="default">
                        <Eye aria-hidden="true" />
                        Watched
                      </Badge>
                    )}
                  </div>

                  {/* Timestamp */}
                  <span className="text-footnote text-label-secondary flex items-center gap-1 tabular-nums">
                    <Clock className="size-3.5" aria-hidden="true" />
                    {formatTimestamp(item.timestamp)}
                  </span>
                </div>

                {/* Article Header & Excerpt */}
                <div className="mb-3">
                  <h4 className="text-headline text-label group-hover:text-tint transition-colors">
                    <Link href={titleToWikiOSRoute(item.title)} className="hover:underline">
                      {item.title}
                    </Link>
                  </h4>

                  {item.comment && (
                    <p className="text-callout text-label-secondary mt-1 line-clamp-2">
                      <span className="text-label font-medium">{item.user}: </span>
                      {item.comment}
                    </p>
                  )}
                </div>

                {/* Bottom Action Tray */}
                <div className="border-separator flex items-center justify-between gap-2 border-t pt-2">
                  <div className="text-footnote text-label-secondary flex items-center gap-1">
                    <User className="size-3.5" aria-hidden="true" />
                    <span className="text-label font-medium">{item.user}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button asChild variant="secondary" size="sm">
                      <Link href={`${titleToWikiOSRoute(item.title)}?tab=history`}>
                        <History aria-hidden="true" />
                        <span>History</span>
                      </Link>
                    </Button>

                    <Button asChild variant="secondary" size="sm">
                      <Link href={titleToWikiOSRoute(item.title)}>
                        <span>Read in WikiOS</span>
                        <ArrowUpRight aria-hidden="true" />
                      </Link>
                    </Button>
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
