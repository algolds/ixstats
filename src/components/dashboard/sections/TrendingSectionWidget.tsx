"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  RssFeed as Rss,
  Journal as Newspaper,
  OpenBook as BookOpen,
  Group as Users,
  Eye,
  ChatBubble as MessageSquare,
  WarningTriangle as AlertTriangle,
  Heart,
  Activity,
} from "iconoir-react";
import { Badge } from "~/components/ui/badge";
import { Tooltip } from "~/components/ui/tooltip-card";
import { Card } from "~/components/ui/card";
import { SegmentedControl } from "~/components/ui/segmented-control";
import { Skeleton } from "~/components/ui/skeleton";
import { api } from "~/trpc/react";
import { cn } from "~/lib/utils";
import { titleToWikiOSRoute } from "~/lib/wiki-os/transformers/url-compat";
import { useWikiLeadImage } from "./feed/useWikiLeadImage";
import { WikiOSLogomark } from "~/components/wiki-os/shared/WikiOSLogomark";

const TRENDING_DEFAULT_LIMIT = 4;
const TRENDING_FILTER_LIMIT = 10;

type FilterTab = "all" | "forum" | "wiki";

const DEFAULT_SOURCE = {
  icon: Activity,
  color: "text-yellow",
  label: "Live activity",
};

const TRENDING_SOURCE: Record<
  string,
  { icon: typeof Rss | typeof Activity; color: string; label: string }
> = {
  thinkpages: {
    icon: Newspaper,
    color: "text-blue",
    label: "ThinkPages",
  },
  forum: {
    icon: MessageSquare,
    color: "text-orange",
    label: "Forum",
  },
  wiki: {
    icon: BookOpen,
    color: "text-wiki",
    label: "Wiki",
  },
  ixstats: {
    icon: Activity,
    color: "text-yellow",
    label: "Live activity",
  },
  general: {
    icon: Activity,
    color: "text-yellow",
    label: "Live activity",
  },
  crisis: {
    icon: AlertTriangle,
    color: "text-red",
    label: "Crisis",
  },
};

export function WikiPreviewContent({ title, wiki }: { title: string; wiki: "ixwiki" | "iiwiki" }) {
  const { data: intro } = api.wikios.getIntro.useQuery({ title, wiki }, { staleTime: 30 * 60_000 });

  const leadImage = useWikiLeadImage(title, intro?.text || intro?.intro || "");

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <WikiOSLogomark aria-hidden className="text-wiki size-3.5 shrink-0" />
        <span className="text-label text-headline truncate">{title}</span>
        <Badge variant="default" className="ml-auto">
          {wiki === "ixwiki" ? "IxWiki" : "IIWiki"}
        </Badge>
      </div>
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          {intro?.text ? (
            <p className="text-label-secondary text-footnote line-clamp-3">
              {intro.text.substring(0, 300)}
              {intro.text.length > 300 ? "…" : ""}
            </p>
          ) : (
            <Skeleton className="rounded-control-sm h-10" />
          )}
        </div>
        {leadImage && (
          <div className="border-separator bg-fill-4 rounded-control relative h-14 w-18 shrink-0 overflow-hidden border">
            <img src={leadImage} alt={title} className="h-full w-full object-cover" />
          </div>
        )}
      </div>
    </div>
  );
}

export function ForumPreviewContent({ threadId }: { threadId: number }) {
  const { data: thread } = api.wikios.getForumThreadPreview.useQuery(
    { threadId },
    { staleTime: 10 * 60_000 }
  );
  if (!thread) {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <MessageSquare aria-hidden className="text-label-secondary size-3.5 shrink-0" />
          <span className="text-label text-headline">Loading thread...</span>
        </div>
        <Skeleton className="rounded-control-sm h-10" />
      </div>
    );
  }
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <MessageSquare aria-hidden className="text-label-secondary size-3.5 shrink-0" />
        <span className="text-label text-headline truncate">{thread.title}</span>
      </div>
      {thread.forumName && <Badge variant="default">{thread.forumName}</Badge>}
      {thread.excerpt && (
        <p className="text-label-secondary text-footnote line-clamp-3">
          {thread.excerpt.substring(0, 250)}
          {thread.excerpt.length > 250 ? "…" : ""}
        </p>
      )}
      <div className="text-label-secondary text-footnote flex items-center gap-3 tabular-nums">
        <span className="flex items-center gap-1">
          <Users aria-hidden className="size-3.5" />
          {thread.author}
        </span>
        <span className="flex items-center gap-1">
          <MessageSquare aria-hidden className="size-3.5" />
          {thread.replyCount} replies
        </span>
        <span className="flex items-center gap-1">
          <Eye aria-hidden className="size-3.5" />
          <span className="sr-only">Views: </span>
          {thread.viewCount}
        </span>
      </div>
    </div>
  );
}

export function TrendingSectionWidget() {
  const [activeFilter, setActiveFilter] = useState<FilterTab>("all");

  const { data: trendingData, isLoading } = api.activities.getUnifiedTrending.useQuery(
    { limit: 50 },
    { refetchInterval: 5 * 60_000 }
  );

  const trendingItems = useMemo(() => {
    const rawItems = trendingData?.items ?? [];
    if (rawItems.length === 0) return [];

    // oxlint-disable-next-line
    const nowMs = Date.now();

    const scored = rawItems.map((item: any) => {
      const { source, engagement, timestamp } = item;
      const likes = engagement?.likes ?? 0;
      const replies = engagement?.replies ?? 0;
      const reposts = engagement?.reposts ?? 0;
      const views = engagement?.views ?? 0;

      let baseInteraction = 0;
      if (source === "thinkpages") {
        baseInteraction = likes * 3 + replies * 5 + reposts * 8 + Math.min(views * 0.02, 15);
      } else if (source === "wiki") {
        const editsMatch = item.excerpt?.match(/(\d+)\s+edit/);
        const editorsMatch = item.excerpt?.match(/(\d+)\s+editor/);
        const edits = editsMatch ? parseInt(editsMatch[1], 10) : 1;
        const editors = editorsMatch ? parseInt(editorsMatch[1], 10) : 1;
        baseInteraction = edits * 3 + editors * 5;
      } else if (source === "forum") {
        baseInteraction = replies * 5 + Math.min(views * 0.03, 15);
      } else {
        baseInteraction = likes * 3 + replies * 5 + 15;
      }

      const scoreBase = Math.max(1, baseInteraction);
      const ageHours = Math.max(0.1, (nowMs - new Date(timestamp).getTime()) / 3600000);
      const decayFactor = 1 / Math.pow(ageHours + 2, 1.2);
      const finalScore = scoreBase * decayFactor;

      return { ...item, computedScore: finalScore };
    });

    const sorted = scored.sort((a: any, b: any) => b.computedScore - a.computedScore);

    if (activeFilter !== "all") {
      return sorted
        .filter((item: any) => item.source === activeFilter)
        .slice(0, TRENDING_FILTER_LIMIT);
    }

    const result: any[] = [];
    const categories = ["thinkpages", "forum", "wiki", "ixstats"];
    const usedIds = new Set<string>();

    for (const cat of categories) {
      const topCat = sorted.find((i: any) => i.source === cat && !usedIds.has(i.id));
      if (topCat) {
        result.push(topCat);
        usedIds.add(topCat.id);
      }
    }

    for (const item of sorted) {
      if (result.length >= TRENDING_DEFAULT_LIMIT) break;
      if (!usedIds.has(item.id)) {
        result.push(item);
        usedIds.add(item.id);
      }
    }

    return result.sort((a, b) => b.computedScore - a.computedScore);
  }, [trendingData, activeFilter]);

  return (
    <Card padding="md" className="no-wiki-tooltip">
      <h2 className="text-headline text-label mb-3">Trending topics</h2>

      <div className="space-y-3">
        <SegmentedControl
          aria-label="Trending source"
          size="sm"
          fullWidth
          value={activeFilter}
          onValueChange={setActiveFilter}
          options={[
            { value: "all", label: "All" },
            { value: "forum", label: "Forum" },
            { value: "wiki", label: "Wiki" },
          ]}
        />

        <div className="space-y-2 pt-1">
          {isLoading && (
            <div className="space-y-2 py-2">
              <Skeleton className="rounded-row h-12" />
              <Skeleton className="rounded-row h-12" />
              <Skeleton className="rounded-row h-12" />
            </div>
          )}

          {!isLoading && trendingItems.length === 0 && (
            <p className="text-label-secondary text-callout py-6 text-center">
              Nothing is trending right now.
            </p>
          )}

          {!isLoading &&
            trendingItems.map((item: any) => {
              const src = (item.source && TRENDING_SOURCE[item.source as string]) ?? DEFAULT_SOURCE;
              const SrcIcon = src.icon;
              const wikiMatch = item.url?.match(/ixwiki\.com\/wiki\/([^#?]+)/);
              const forumMatch = item.url?.match(/forum\.ixwiki\.com\/threads\/(?:[^/]*\.)?(\d+)/);
              const wikiTitle = wikiMatch
                ? decodeURIComponent(wikiMatch[1]!).replace(/_/g, " ")
                : null;
              const forumThreadId = forumMatch ? parseInt(forumMatch[1]!, 10) : null;

              const isWiki = !!wikiTitle;
              const isForum = !!forumThreadId;

              let displayTitle = item.title;
              if (displayTitle.includes("sports-bulletin:") || displayTitle.includes("<!--")) {
                const match = displayTitle.match(/<!--\s*sports-bulletin:([\s\S]*?)-->/i);
                if (match && match[1]) {
                  try {
                    const data = JSON.parse(match[1].trim());
                    displayTitle = `${data.sportEmoji || "⚽"} ${data.league?.name || "League"} Matchday ${data.matchDay || ""}`;
                  } catch (_e) {
                    displayTitle = "⚽ Sports Bulletin";
                  }
                } else {
                  displayTitle = item.author ? `@${item.author}` : "⚽ Sports Bulletin";
                }
              }

              let displayExcerpt = (item.excerpt || "")
                .replace(/<!--\s*sports-bulletin:[\s\S]*?-->/gi, "")
                .trim();
              if (!displayExcerpt && item.source === "thinkpages") {
                displayExcerpt = "Sports news and matchday bulletin";
              }

              const itemHref = isWiki && wikiTitle ? titleToWikiOSRoute(wikiTitle) : item.url;
              const isInternal = !!itemHref && itemHref.startsWith("/");
              const W = isInternal ? Link : itemHref ? "a" : "div";
              const linkProps = isInternal
                ? { href: itemHref }
                : itemHref
                  ? { href: itemHref, target: "_blank", rel: "noopener noreferrer" }
                  : {};

              const el = (
                <W
                  key={item.id}
                  {...(linkProps as any)}
                  className="group/item bg-surface-secondary border-separator hover:border-tint/40 hover:bg-fill-3 rounded-row facet-press facet-press-subtle focus-visible:outline-tint flex cursor-pointer items-start gap-3 border p-3 focus-visible:outline-2 focus-visible:outline-offset-2"
                >
                  <span
                    aria-hidden
                    className="bg-surface border-separator rounded-control-sm mt-0.5 flex size-6 shrink-0 items-center justify-center border"
                  >
                    <SrcIcon className={cn("size-3.5", src.color)} />
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-label text-headline group-hover/item:text-tint group-focus-visible/item:text-tint truncate transition-colors">
                        {displayTitle}
                      </span>
                      <Badge variant="default">{src.label}</Badge>
                    </div>

                    {displayExcerpt && (
                      <p className="text-label-secondary text-footnote mt-0.5 line-clamp-1">
                        {displayExcerpt}
                      </p>
                    )}

                    <div className="text-label-secondary text-footnote mt-1 flex items-center gap-3 tabular-nums">
                      {item.engagement?.likes > 0 && (
                        <span className="flex items-center gap-1">
                          <Heart aria-hidden className="text-red size-3.5 fill-current" />
                          <span className="sr-only">Likes: </span>
                          {item.engagement.likes}
                        </span>
                      )}
                      {item.engagement?.replies > 0 && (
                        <span className="flex items-center gap-1">
                          <MessageSquare aria-hidden className="text-indigo size-3.5" />
                          <span className="sr-only">Replies: </span>
                          {item.engagement.replies}
                        </span>
                      )}
                      {item.engagement?.views > 0 && (
                        <span className="flex items-center gap-1">
                          <Eye aria-hidden className="size-3.5" />
                          <span className="sr-only">Views: </span>
                          {item.engagement.views}
                        </span>
                      )}
                    </div>
                  </div>
                </W>
              );

              if (isWiki)
                return (
                  <Tooltip
                    key={item.id}
                    content={<WikiPreviewContent title={wikiTitle!} wiki="ixwiki" />}
                    containerClassName="block"
                  >
                    {el}
                  </Tooltip>
                );
              if (isForum)
                return (
                  <Tooltip
                    key={item.id}
                    content={<ForumPreviewContent threadId={forumThreadId!} />}
                    containerClassName="block"
                  >
                    {el}
                  </Tooltip>
                );
              return el;
            })}
        </div>
      </div>
    </Card>
  );
}
