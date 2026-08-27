"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  FireFlame as Flame,
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
import {
  CutoutCard,
  CutoutCardContent,
  CutoutCorner,
  cutoutCardSurfaceClassName,
} from "~/components/ui/cutout-card";
import { api } from "~/trpc/react";
import { cn } from "~/lib/utils";
import { titleToWikiOSRoute } from "~/lib/wiki-os/transformers/url-compat";
import {
  normalizeWikiImageUrl,
  extractLeadImageFromWikitext,
  extractLeadImageFromHtml,
  isNoticeOrUtilityIcon,
} from "~/lib/wiki-os/transformers/image-url";
import { WikiOSLogomark } from "~/components/wiki-os/shared/WikiOSLogomark";

const TRENDING_DEFAULT_LIMIT = 4;
const TRENDING_FILTER_LIMIT = 10;

type FilterTab = "all" | "forum" | "wiki";

const DEFAULT_SOURCE = {
  icon: Activity,
  color: "text-amber-700 dark:text-amber-300",
  bg: "bg-amber-500/15 border-amber-500/30",
  label: "Live Activity",
};

const TRENDING_SOURCE: Record<
  string,
  { icon: typeof Rss | typeof Activity; color: string; bg: string; label: string }
> = {
  thinkpages: {
    icon: Newspaper,
    color: "text-blue-700 dark:text-blue-300",
    bg: "bg-blue-500/15 border-blue-500/30",
    label: "ThinkPages",
  },
  forum: {
    icon: MessageSquare,
    color: "text-violet-700 dark:text-violet-300",
    bg: "bg-violet-500/15 border-violet-500/30",
    label: "Forum",
  },
  wiki: {
    icon: BookOpen,
    color: "text-teal-700 dark:text-teal-300",
    bg: "bg-teal-500/15 border-teal-500/30",
    label: "Wiki",
  },
  ixstats: {
    icon: Activity,
    color: "text-amber-700 dark:text-amber-300",
    bg: "bg-amber-500/15 border-amber-500/30",
    label: "Live Activity",
  },
  general: {
    icon: Activity,
    color: "text-amber-700 dark:text-amber-300",
    bg: "bg-amber-500/15 border-amber-500/30",
    label: "Live Activity",
  },
  crisis: {
    icon: AlertTriangle,
    color: "text-red-700 dark:text-red-300",
    bg: "bg-red-500/15 border-red-500/30",
    label: "Crisis",
  },
};

export function WikiPreviewContent({ title, wiki }: { title: string; wiki: "ixwiki" | "iiwiki" }) {
  const { data: intro } = api.wikios.getIntro.useQuery({ title, wiki }, { staleTime: 30 * 60_000 });
  const { data: pageImages } = api.wikios.getPageImages.useQuery(
    { title },
    { enabled: !!title, staleTime: 30 * 60_000 }
  );

  const leadImage = useMemo(() => {
    if (pageImages && Array.isArray(pageImages) && pageImages.length > 0) {
      const eligible =
        pageImages.find(
          (img: any) =>
            img &&
            (img.thumbUrl || img.url) &&
            !isNoticeOrUtilityIcon(img.title || img.url || img.thumbUrl) &&
            !img.title?.toLowerCase().endsWith(".svg") &&
            !img.title?.toLowerCase().includes("flag") &&
            !img.title?.toLowerCase().includes("icon")
        ) ||
        pageImages.find(
          (img: any) =>
            img &&
            (img.thumbUrl || img.url) &&
            !isNoticeOrUtilityIcon(img.title || img.url || img.thumbUrl)
        ) ||
        pageImages[0];

      const rawUrl = eligible?.thumbUrl || eligible?.url || null;
      if (rawUrl) {
        const normalized = normalizeWikiImageUrl(rawUrl);
        if (normalized) return normalized;
      }
    }

    const rawText = intro?.text || intro?.intro || "";
    if (rawText) {
      const fromWikitext = extractLeadImageFromWikitext(rawText);
      if (fromWikitext) {
        const normalized = normalizeWikiImageUrl(fromWikitext);
        if (normalized) return normalized;
      }
      const fromHtml = extractLeadImageFromHtml(rawText);
      if (fromHtml) {
        const normalized = normalizeWikiImageUrl(fromHtml);
        if (normalized) return normalized;
      }
    }

    return null;
  }, [pageImages, intro?.text, intro?.intro]);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <WikiOSLogomark className="h-3.5 w-3.5 shrink-0 text-teal-500" />
        <span className="text-foreground truncate text-sm font-semibold">{title}</span>
        <span className="bg-muted text-muted-foreground ml-auto shrink-0 rounded-md px-1.5 py-0.5 text-[9px] font-medium">
          {wiki === "ixwiki" ? "IxWiki" : "IIWiki"}
        </span>
      </div>
      <div className="flex items-start gap-2.5">
        <div className="min-w-0 flex-1">
          {intro?.text ? (
            <p className="text-foreground/80 line-clamp-3 text-xs leading-relaxed">
              {intro.text.substring(0, 300)}
              {intro.text.length > 300 ? "…" : ""}
            </p>
          ) : (
            <div className="bg-muted h-10 animate-pulse rounded" />
          )}
        </div>
        {leadImage && (
          <div className="border-border/40 relative h-14 w-18 shrink-0 overflow-hidden rounded-lg border bg-black/5 dark:border-white/10">
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
          <MessageSquare className="h-3.5 w-3.5 shrink-0 text-violet-500" />
          <span className="text-foreground text-sm font-medium">Loading thread...</span>
        </div>
        <div className="bg-muted h-10 animate-pulse rounded" />
      </div>
    );
  }
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <MessageSquare className="h-3.5 w-3.5 shrink-0 text-violet-500" />
        <span className="text-foreground truncate text-sm font-semibold">{thread.title}</span>
      </div>
      {thread.forumName && (
        <span className="inline-block rounded-md bg-violet-500/10 px-1.5 py-0.5 text-[9px] font-medium text-violet-400">
          {thread.forumName}
        </span>
      )}
      {thread.excerpt && (
        <p className="text-foreground/80 line-clamp-3 text-xs leading-relaxed">
          {thread.excerpt.substring(0, 250)}
          {thread.excerpt.length > 250 ? "…" : ""}
        </p>
      )}
      <div className="text-muted-foreground flex items-center gap-3 text-[10px]">
        <span className="flex items-center gap-0.5">
          <Users className="h-2.5 w-2.5" />
          {thread.author}
        </span>
        <span className="flex items-center gap-0.5">
          <MessageSquare className="h-2.5 w-2.5" />
          {thread.replyCount} replies
        </span>
        <span className="flex items-center gap-0.5">
          <Eye className="h-2.5 w-2.5" />
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
    <CutoutCard
      className={cn(cutoutCardSurfaceClassName, "no-wiki-tooltip overflow-hidden rounded-xl")}
      trackPointerHover={false}
    >
      {/* Cutout tab header */}
      <div className="relative bg-amber-500/10 px-4 pt-3 pb-5">
        <div className="text-card-foreground flex items-center gap-2 text-xs font-semibold tracking-tight">
          <Flame className="h-4 w-4 text-amber-500" />
          <span>Trending Topics</span>
        </div>
        <CutoutCorner className="text-card absolute -bottom-px left-0" size={20} />
        <CutoutCorner className="text-card absolute right-0 -bottom-px -scale-x-100" size={20} />
      </div>

      <CutoutCardContent className="space-y-3 px-4 pt-0 pb-4">
        {/* Category Segment Control Bar */}
        <div className="border-border/40 bg-accent/10 grid grid-cols-3 gap-1 rounded-xl border p-1 backdrop-blur-md">
          {(["all", "forum", "wiki"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveFilter(tab)}
              className={cn(
                "cursor-pointer rounded-lg py-1 text-center text-[10px] font-medium capitalize transition-all duration-150 active:scale-[0.97]",
                activeFilter === tab
                  ? "border-border/60 bg-card text-foreground border font-semibold shadow-xs"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent/15 font-medium"
              )}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="space-y-2 pt-1">
          {isLoading && (
            <div className="space-y-2 py-4">
              <div className="bg-muted/40 h-10 animate-pulse rounded-xl" />
              <div className="bg-muted/40 h-10 animate-pulse rounded-xl" />
              <div className="bg-muted/40 h-10 animate-pulse rounded-xl" />
            </div>
          )}

          {!isLoading && trendingItems.length === 0 && (
            <p className="text-muted-foreground py-6 text-center text-[11px] font-medium">
              No trending content found
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
                displayExcerpt = "Sports News & Matchday Bulletin";
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
                  className="group/item border-border/40 bg-card/40 hover:bg-card/80 flex cursor-pointer items-start gap-2.5 rounded-xl border p-2.5 shadow-2xs transition-all duration-200 hover:border-amber-500/40 active:scale-[0.98]"
                >
                  <div
                    className={cn(
                      "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border shadow-xs backdrop-blur-md transition-transform duration-200 group-hover/item:scale-110",
                      src.bg
                    )}
                  >
                    <SrcIcon className={cn("h-3 w-3", src.color)} />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-foreground truncate text-[11px] font-semibold tracking-tight transition-colors group-hover/item:text-amber-600 dark:group-hover/item:text-amber-400">
                        {displayTitle}
                      </span>
                      <Badge
                        variant="outline"
                        className={cn(
                          "shrink-0 border px-1.5 py-0 text-[8px] font-semibold tracking-wider uppercase",
                          src.color,
                          src.bg
                        )}
                      >
                        {src.label}
                      </Badge>
                    </div>

                    {displayExcerpt && (
                      <p className="text-muted-foreground/80 mt-0.5 line-clamp-1 text-[10px] leading-snug font-normal">
                        {displayExcerpt}
                      </p>
                    )}

                    <div className="text-muted-foreground/70 mt-1 flex items-center gap-2.5 text-[9px] font-medium tabular-nums">
                      {item.engagement?.likes > 0 && (
                        <span className="flex items-center gap-0.5 text-rose-600 dark:text-rose-400">
                          <Heart className="h-2.5 w-2.5 fill-current" />
                          {item.engagement.likes}
                        </span>
                      )}
                      {item.engagement?.replies > 0 && (
                        <span className="flex items-center gap-0.5 text-indigo-600 dark:text-indigo-400">
                          <MessageSquare className="h-2.5 w-2.5" />
                          {item.engagement.replies}
                        </span>
                      )}
                      {item.engagement?.views > 0 && (
                        <span className="flex items-center gap-0.5">
                          <Eye className="h-2.5 w-2.5" />
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
      </CutoutCardContent>
    </CutoutCard>
  );
}
