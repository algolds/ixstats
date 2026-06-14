// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
"use client";

import { useMemo } from "react";
import {
  Flame,
  ExternalLink,
  Rss,
  Newspaper,
  MessageCircle,
  BookOpen,
  Users,
  Eye,
  MessageSquare,
  AlertTriangle,
} from "lucide-react";
import {
  CutoutCard,
  CutoutCardContent,
  CutoutCorner,
  cutoutCardSurfaceClassName,
} from "~/components/ui/cutout-card";
import { Badge } from "~/components/ui/badge";
import { Tooltip } from "~/components/ui/tooltip-card";
import { api } from "~/trpc/react";
import { cn } from "~/lib/utils";
import { titleToWikiOSRoute } from "~/lib/wiki-os/url-compat";
import { BlurbSection } from "./BlurbSection";

const TRENDING_LIMIT = 5;

const TRENDING_SOURCE: Record<
  string,
  { icon: typeof Rss; color: string; bg: string; label: string }
> = {
  thinkpages: {
    icon: Newspaper,
    color: "text-purple-400",
    bg: "bg-purple-500/10",
    label: "Social",
  },
  forum: { icon: MessageCircle, color: "text-indigo-400", bg: "bg-indigo-500/10", label: "Forum" },
  wiki: { icon: BookOpen, color: "text-teal-400", bg: "bg-teal-500/10", label: "Wiki" },
  ixstats: { icon: Rss, color: "text-blue-400", bg: "bg-blue-500/10", label: "IxStats" },
  crisis: { icon: AlertTriangle, color: "text-red-400", bg: "bg-red-500/10", label: "Crisis" },
};

export function WikiPreviewContent({ title, wiki }: { title: string; wiki: "ixwiki" | "iiwiki" }) {
  const { data: intro } = api.wiki.getIntro.useQuery({ title, wiki }, { staleTime: 30 * 60_000 });
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <BookOpen className="h-3.5 w-3.5 shrink-0 text-amber-500" />
        <span className="text-foreground truncate text-sm font-semibold">{title}</span>
        <span className="bg-muted text-muted-foreground ml-auto shrink-0 rounded-md px-1.5 py-0.5 text-[9px] font-medium">
          {wiki === "ixwiki" ? "IxWiki" : "IIWiki"}
        </span>
      </div>
      {intro?.text ? (
        <p className="text-foreground/80 line-clamp-4 text-xs leading-relaxed">
          {intro.text.substring(0, 300)}
          {intro.text.length > 300 ? "…" : ""}
        </p>
      ) : (
        <div className="bg-muted h-10 animate-pulse rounded" />
      )}
    </div>
  );
}

export function ForumPreviewContent({ threadId }: { threadId: number }) {
  const { data: thread } = api.wiki.getForumThreadPreview.useQuery(
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
  const { data: trendingData } = api.activities.getUnifiedTrending.useQuery(
    { limit: 50 },
    { refetchInterval: 5 * 60_000 }
  );

  const trendingItems = useMemo(() => {
    const rawItems = trendingData?.items ?? [];
    if (rawItems.length === 0) return [];

    const nowMs = Date.now();

    const scored = rawItems.map((item: any) => {
      const { source, engagement, timestamp } = item;
      const likes = engagement?.likes ?? 0;
      const replies = engagement?.replies ?? 0;
      const reposts = engagement?.reposts ?? 0;
      const views = engagement?.views ?? 0;

      let baseInteraction = 0;
      if (source === "thinkpages") {
        baseInteraction = likes + replies * 3 + reposts * 5 + views * 0.05;
      } else if (source === "wiki") {
        const editsMatch = item.excerpt?.match(/(\d+)\s+edit/);
        const editorsMatch = item.excerpt?.match(/(\d+)\s+editor/);
        const bytesMatch = item.excerpt?.match(/([+-]?\d+)\s+bytes/);
        const edits = editsMatch ? parseInt(editsMatch[1], 10) : 1;
        const editors = editorsMatch ? parseInt(editorsMatch[1], 10) : 1;
        const bytes = bytesMatch ? Math.abs(parseInt(bytesMatch[1], 10)) : 100;
        baseInteraction =
          edits * 8 + editors * 15 + Math.min(bytes / 50, 30) + (item.isNew ? 25 : 0);
      } else if (source === "forum") {
        baseInteraction = replies * 4 + views * 0.1;
      } else {
        baseInteraction = likes * 2 + replies * 4 + reposts * 6 + views * 0.05;
      }

      const scoreBase = Math.max(1, baseInteraction);
      const ageHours = Math.max(0.1, (nowMs - new Date(timestamp).getTime()) / 3600000);
      const decayFactor = 1 / Math.pow(ageHours + 2, 1.4);
      const finalScore = scoreBase * decayFactor;

      return { ...item, computedScore: finalScore };
    });

    return scored.sort((a, b) => b.computedScore - a.computedScore).slice(0, TRENDING_LIMIT);
  }, [trendingData]);

  return (
    <CutoutCard
      className={cn(cutoutCardSurfaceClassName, "no-wiki-tooltip overflow-hidden rounded-xl")}
      trackPointerHover={false}
      texture="diagonal"
      textureOpacity={0.06}
    >
      {/* Cutout tab header */}
      <div className="relative bg-orange-500/10 px-4 pt-3 pb-5">
        <div className="text-card-foreground flex items-center gap-2 text-sm font-bold">
          <Flame className="h-4.5 w-4.5 text-orange-400" />
          Trending
        </div>
        <CutoutCorner className="text-card absolute -bottom-px left-0" size={20} />
        <CutoutCorner className="text-card absolute right-0 -bottom-px -scale-x-100" size={20} />
      </div>
      <CutoutCardContent className="space-y-3 px-4 pt-0 pb-4">
        <div className="space-y-1">
          {trendingItems.length === 0 && (
            <p className="text-muted-foreground py-6 text-center text-[11px]">
              No trending content
            </p>
          )}
          {trendingItems.map((item: any) => {
            const src = TRENDING_SOURCE[item.source as string] ?? TRENDING_SOURCE.ixstats!;
            const SrcIcon = src.icon;
            const W = item.url ? "a" : "div";
            const wp = item.url
              ? { href: item.url, target: "_blank", rel: "noopener noreferrer" }
              : {};

            const wikiMatch = item.url?.match(/ixwiki\.com\/wiki\/([^#?]+)/);
            const forumMatch = item.url?.match(/forum\.ixwiki\.com\/threads\/(?:[^/]*\.)?(\d+)/);
            const wikiTitle = wikiMatch
              ? decodeURIComponent(wikiMatch[1]!).replace(/_/g, " ")
              : null;
            const forumThreadId = forumMatch ? parseInt(forumMatch[1]!, 10) : null;

            const isWiki = !!wikiTitle;
            const isForum = !!forumThreadId;
            const wikiHref = isWiki && wikiTitle ? titleToWikiOSRoute(wikiTitle) : null;

            const el = (
              <W
                key={item.id}
                {...(isWiki ? { href: wikiHref } : wp)}
                className="border-border/30 hover:bg-muted/40 flex cursor-pointer items-start gap-2 rounded-lg border p-2 transition-colors"
              >
                <div
                  className={cn(
                    "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded",
                    isWiki ? "bg-teal-500/15" : src.bg
                  )}
                >
                  {isWiki ? (
                    <img
                      src="https://cdn.simpleicons.org/wikipedia/teal"
                      alt=""
                      className="h-2.5 w-2.5"
                    />
                  ) : (
                    <SrcIcon className={cn("h-2.5 w-2.5", src.color)} />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-foreground truncate text-[11px] font-medium">
                      {item.title}
                    </span>
                    {isForum && item.url && (
                      <ExternalLink className="text-muted-foreground h-2 w-2 shrink-0" />
                    )}
                  </div>
                  {!isWiki && (
                    <div className="mt-0.5 flex items-center gap-1.5">
                      <Badge
                        variant="outline"
                        className={cn("px-1 py-0 text-[8px]", src.color, "border-current/30")}
                      >
                        {src.label}
                      </Badge>
                    </div>
                  )}
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

        {/* Blurb of the Day — integrated */}
        <BlurbSection />
      </CutoutCardContent>
    </CutoutCard>
  );
}
