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
import { forumThreadIdFromUrl, wikiTitleFromUrl } from "./feed/externalLinks";
import { WikiOSLogomark } from "~/components/wiki-os/shared/WikiOSLogomark";

const TRENDING_DEFAULT_LIMIT = 4;
const TRENDING_FILTER_LIMIT = 10;

type FilterTab = "all" | "forum" | "wiki";

const DEFAULT_SOURCE = { icon: Activity, color: "text-yellow", label: "Live activity" };

const TRENDING_SOURCE: Record<
  string,
  { icon: typeof Rss | typeof Activity; color: string; label: string }
> = {
  thinkpages: { icon: Newspaper, color: "text-blue", label: "ThinkPages" },
  forum: { icon: MessageSquare, color: "text-orange", label: "Forum" },
  wiki: { icon: BookOpen, color: "text-wiki", label: "Wiki" },
  crisis: { icon: AlertTriangle, color: "text-red", label: "Crisis" },
};

const FILTER_OPTIONS: { value: FilterTab; label: string }[] = [
  { value: "all", label: "All" },
  { value: "forum", label: "Forum" },
  { value: "wiki", label: "Wiki" },
];

const ENGAGEMENT_STATS = [
  { key: "likes", label: "Likes", icon: Heart, className: "text-red size-3.5 fill-current" },
  { key: "replies", label: "Replies", icon: MessageSquare, className: "text-indigo size-3.5" },
  { key: "views", label: "Views", icon: Eye, className: "size-3.5" },
] as const;

/** Engagement weight per source; unlisted sources fall back to likes, replies and a flat bonus. */
const INTERACTION_SCORE: Record<string, (item: any, e: Record<string, number>) => number> = {
  thinkpages: (_, e) =>
    e.likes! * 3 + e.replies! * 5 + e.reposts! * 8 + Math.min(e.views! * 0.02, 15),
  wiki: (item) => {
    const edits = parseInt(item.excerpt?.match(/(\d+)\s+edit/)?.[1] ?? "1", 10);
    const editors = parseInt(item.excerpt?.match(/(\d+)\s+editor/)?.[1] ?? "1", 10);
    return edits * 3 + editors * 5;
  },
  forum: (_, e) => e.replies! * 5 + Math.min(e.views! * 0.03, 15),
};
const DEFAULT_INTERACTION = (_: unknown, e: Record<string, number>) =>
  e.likes! * 3 + e.replies! * 5 + 15;

/** Engagement score decayed by age in hours. */
function scoreItem(item: any, nowMs: number): number {
  const e = Object.fromEntries(
    ["likes", "replies", "reposts", "views"].map((k) => [k, item.engagement?.[k] ?? 0])
  );
  const base = Math.max(1, (INTERACTION_SCORE[item.source] ?? DEFAULT_INTERACTION)(item, e));
  const ageHours = Math.max(0.1, (nowMs - new Date(item.timestamp).getTime()) / 3600000);
  return base / Math.pow(ageHours + 2, 1.2);
}

/** "All" shows the best item of each source first, then fills up with the rest by score. */
function selectTrending(rawItems: any[], filter: FilterTab): any[] {
  // oxlint-disable-next-line
  const nowMs = Date.now();
  const sorted = rawItems
    .map((item) => ({ ...item, computedScore: scoreItem(item, nowMs) }))
    .sort((a, b) => b.computedScore - a.computedScore);

  if (filter !== "all") {
    return sorted.filter((item) => item.source === filter).slice(0, TRENDING_FILTER_LIMIT);
  }

  const picked = new Map<string, any>();
  for (const cat of ["thinkpages", "forum", "wiki", "ixstats"]) {
    const top = sorted.find((i) => i.source === cat && !picked.has(i.id));
    if (top) picked.set(top.id, top);
  }
  for (const item of sorted) {
    if (picked.size >= TRENDING_DEFAULT_LIMIT) break;
    if (!picked.has(item.id)) picked.set(item.id, item);
  }
  return [...picked.values()].sort((a, b) => b.computedScore - a.computedScore);
}

/** Sports bulletins arrive as an HTML-comment payload; show a readable headline instead. */
function trendingTitle(item: any): string {
  const title: string = item.title;
  if (!title.includes("sports-bulletin:") && !title.includes("<!--")) return title;
  const payload = title.match(/<!--\s*sports-bulletin:([\s\S]*?)-->/i)?.[1];
  if (!payload) return item.author ? `@${item.author}` : "⚽ Sports Bulletin";
  try {
    const data = JSON.parse(payload.trim());
    return `${data.sportEmoji || "⚽"} ${data.league?.name || "League"} Matchday ${data.matchDay || ""}`;
  } catch {
    return "⚽ Sports Bulletin";
  }
}

function trendingExcerpt(item: any): string {
  const excerpt = (item.excerpt || "").replace(/<!--\s*sports-bulletin:[\s\S]*?-->/gi, "").trim();
  return excerpt || (item.source === "thinkpages" ? "Sports news and matchday bulletin" : "");
}

function RowLink({
  href,
  className,
  children,
}: {
  href?: string;
  className: string;
  children: React.ReactNode;
}) {
  if (href?.startsWith("/")) {
    return (
      <Link href={href} className={className}>
        {children}
      </Link>
    );
  }
  if (href) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
        {children}
      </a>
    );
  }
  return <div className={className}>{children}</div>;
}

function TrendingRow({ item }: { item: any }) {
  const src = TRENDING_SOURCE[item.source as string] ?? DEFAULT_SOURCE;
  const SrcIcon = src.icon;
  const wikiTitle = wikiTitleFromUrl(item.url);
  const forumThreadId = forumThreadIdFromUrl(item.url);
  const excerpt = trendingExcerpt(item);

  const row = (
    <RowLink
      href={wikiTitle ? titleToWikiOSRoute(wikiTitle) : item.url}
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
            {trendingTitle(item)}
          </span>
          <Badge variant="default">{src.label}</Badge>
        </div>

        {excerpt && (
          <p className="text-label-secondary text-footnote mt-0.5 line-clamp-1">{excerpt}</p>
        )}

        <div className="text-label-secondary text-footnote mt-1 flex items-center gap-3 tabular-nums">
          {ENGAGEMENT_STATS.map(({ key, label, icon: Icon, className }) => {
            const count = item.engagement?.[key];
            return (
              count > 0 && (
                <span key={key} className="flex items-center gap-1">
                  <Icon aria-hidden className={className} />
                  <span className="sr-only">{label}: </span>
                  {count}
                </span>
              )
            );
          })}
        </div>
      </div>
    </RowLink>
  );

  const preview = wikiTitle ? (
    <WikiPreviewContent title={wikiTitle} wiki="ixwiki" />
  ) : forumThreadId ? (
    <ForumPreviewContent threadId={forumThreadId} />
  ) : null;
  return preview ? (
    <Tooltip content={preview} containerClassName="block">
      {row}
    </Tooltip>
  ) : (
    row
  );
}

function WikiPreviewContent({ title, wiki }: { title: string; wiki: "ixwiki" | "iiwiki" }) {
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

function ForumPreviewContent({ threadId }: { threadId: number }) {
  const { data: thread } = api.wikios.getForumThreadPreview.useQuery(
    { threadId },
    { staleTime: 10 * 60_000 }
  );
  const heading = (
    <div className="flex items-center gap-2">
      <MessageSquare aria-hidden className="text-label-secondary size-3.5 shrink-0" />
      <span className={cn("text-label text-headline", thread && "truncate")}>
        {thread?.title ?? "Loading thread..."}
      </span>
    </div>
  );
  if (!thread) {
    return (
      <div className="space-y-2">
        {heading}
        <Skeleton className="rounded-control-sm h-10" />
      </div>
    );
  }
  return (
    <div className="space-y-2">
      {heading}
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

  const trendingItems = useMemo(
    () => selectTrending(trendingData?.items ?? [], activeFilter),
    [trendingData, activeFilter]
  );

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
          options={FILTER_OPTIONS}
        />

        <div className="space-y-2 pt-1">
          {isLoading ? (
            <div className="space-y-2 py-2">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="rounded-row h-12" />
              ))}
            </div>
          ) : trendingItems.length === 0 ? (
            <p className="text-label-secondary text-callout py-6 text-center">
              Nothing is trending right now.
            </p>
          ) : (
            trendingItems.map((item) => <TrendingRow key={item.id} item={item} />)
          )}
        </div>
      </div>
    </Card>
  );
}
