"use client";

import { useState, useMemo, memo } from "react";
import Link from "next/link";
import {
  WarningTriangle as AlertTriangle,
  Clock,
  OpenNewWindow as ExternalLink,
  Globe,
  Bank as Landmark,
  Map as MapIcon,
  RssFeed as Rss,
  Shield,
  StatUp as TrendingUp,
  Trophy,
  Group as Users,
  OpenBook as BookOpen,
  ChatBubble as MessageCircle,
  NavArrowDown as ChevronDown,
} from "iconoir-react";
import { api } from "~/trpc/react";
import { Badge } from "~/components/ui/badge";
import { FeedPollWidget } from "~/components/ui/FeedPollWidget";
import {
  WikiLinkPreview,
  ForumLinkPreview,
  WikiHtmlContent,
} from "~/components/wiki-os/reader/WikiLinkPreview";
import { titleToWikiOSRoute } from "~/lib/wiki-os/transformers/url-compat";
import { resolveImageUrl, getImageUrl } from "~/lib/wiki-os/transformers/image-url";
import { parseSportsBulletin } from "~/lib/sports/feed-bulletins";
import { SportsBulletinCard } from "~/components/thinkpages/SportsBulletinCard";
import { formatTimeAgo } from "~/lib/utils";
import { formatThinkpagesContentForDisplay } from "~/lib/utils";
import { cn } from "~/lib/utils";
import { WikiAuthorPopover } from "./WikiAuthorPopover";
import { FeedItemHeader } from "./feed/FeedItemHeader";
import { FeedGroupedDrawer } from "./feed/FeedGroupedDrawer";
import { InlineWikiArticlePreview, parseWikitextToHtml } from "./feed/InlineWikiArticlePreview";
import type { ProcessedFeedItem } from "~/types/dashboard-feed";

export { parseWikitextToHtml, InlineWikiArticlePreview };

export const SOURCE_CONFIG: Record<
  string,
  { icon: typeof Rss; color: string; bg: string; label: string }
> = {
  activity: { icon: Rss, color: "text-blue-400", bg: "bg-blue-500/10", label: "Activity" },
  thinkpages: {
    icon: Users,
    color: "text-purple-400",
    bg: "bg-purple-500/10",
    label: "Social",
  },
  wiki: { icon: BookOpen, color: "text-teal-400", bg: "bg-teal-500/10", label: "Wiki" },
  forum: { icon: MessageCircle, color: "text-indigo-400", bg: "bg-indigo-500/10", label: "Forum" },
};

export function getActivityLabel(activity: any): {
  label: string;
  icon: typeof Rss;
  color: string;
  bg: string;
} {
  const cat = activity.category ?? activity.content?.metadata?.category ?? "";
  const title = (activity.content?.title ?? "").toLowerCase();

  if (title.includes("point of interest") || title.includes("poi"))
    return { label: "POI", icon: MapIcon, color: "text-emerald-400", bg: "bg-emerald-500/10" };
  if (title.includes("city") || title.includes("settlement"))
    return { label: "City", icon: MapIcon, color: "text-emerald-400", bg: "bg-emerald-500/10" };
  if (
    title.includes("subdivision") ||
    title.includes("province") ||
    title.includes("state") ||
    title.includes("region")
  )
    return {
      label: "Subdivision",
      icon: MapIcon,
      color: "text-emerald-400",
      bg: "bg-emerald-500/10",
    };
  if (cat === "map" || title.includes("map") || title.includes("claim"))
    return { label: "Maps", icon: MapIcon, color: "text-emerald-400", bg: "bg-emerald-500/10" };
  if (
    cat === "economic" ||
    title.includes("gdp") ||
    title.includes("econom") ||
    title.includes("trade")
  )
    return {
      label: "Economy",
      icon: TrendingUp,
      color: "text-emerald-400",
      bg: "bg-emerald-500/10",
    };
  if (
    cat === "diplomatic" ||
    title.includes("embassy") ||
    title.includes("diplom") ||
    title.includes("treaty")
  )
    return { label: "Diplomacy", icon: Globe, color: "text-cyan-400", bg: "bg-cyan-500/10" };
  if (
    cat === "military" ||
    title.includes("military") ||
    title.includes("defense") ||
    title.includes("deploy")
  )
    return { label: "Defense", icon: Shield, color: "text-red-400", bg: "bg-red-500/10" };
  if (
    cat === "political" ||
    title.includes("govern") ||
    title.includes("politic") ||
    title.includes("election")
  )
    return { label: "Politics", icon: Landmark, color: "text-purple-400", bg: "bg-purple-500/10" };
  if (cat === "crisis" || title.includes("crisis"))
    return { label: "Crisis", icon: AlertTriangle, color: "text-red-400", bg: "bg-red-500/10" };
  if (cat === "achievement" || title.includes("tier") || title.includes("achieve"))
    return { label: "Achievement", icon: Trophy, color: "text-amber-400", bg: "bg-amber-500/10" };
  return { label: "Activity", icon: Rss, color: "text-blue-400", bg: "bg-blue-500/10" };
}

export const UnifiedFeedItem = memo(function UnifiedFeedItem({
  activity,
}: {
  activity: ProcessedFeedItem | any;
}) {
  const source = activity.source ?? "activity";
  const isWiki = source === "wiki";
  const isGrouped = !!activity._grouped;
  const [expanded, setExpanded] = useState(false);

  // Dynamic badge for IxStats activities
  const resolvedConfig = useMemo(() => {
    if (source === "activity") return getActivityLabel(activity);
    return SOURCE_CONFIG[source] ?? SOURCE_CONFIG.activity!;
  }, [source, activity]);

  const Icon = resolvedConfig.icon;
  const metadata = activity.content?.metadata ?? {};
  const externalUrl = metadata.wikiUrl ?? metadata.forumUrl;

  // Wiki page title for clickable link
  const wikiPageTitle = metadata.pageTitle as string | undefined;
  const wikiHref = wikiPageTitle ? titleToWikiOSRoute(wikiPageTitle) : null;

  const titleText = activity.content?.title ?? "";
  // For wiki items, strip the "Wiki edit: " or "New wiki page: " prefix
  const displayTitle =
    isWiki && wikiPageTitle
      ? activity._isNew
        ? "New page created"
        : isGrouped
          ? ""
          : titleText.replace(/^(Wiki edit|New wiki page):\s*/i, "")
      : titleText;
  const titleHtml = displayTitle ? formatThinkpagesContentForDisplay(displayTitle) : "";

  const descHtml = activity.content?.description
    ? formatThinkpagesContentForDisplay(activity.content.description)
    : activity.post?.content
      ? formatThinkpagesContentForDisplay(activity.post.content as string)
      : "";

  const rawContentText = [
    activity.content?.title,
    activity.content?.description,
    activity.post?.content,
  ]
    .filter((x): x is string => typeof x === "string" && x.length > 0)
    .join("\n");

  const sportsBulletin = useMemo(() => parseSportsBulletin(rawContentText), [rawContentText]);

  return (
    <div className="group relative overflow-hidden rounded-2xl border border-border/50 bg-card/75 p-4 shadow-xs backdrop-blur-xl transition-all duration-200 hover:border-border/80 hover:bg-card/95 hover:shadow-md">
      <div className="flex items-start gap-3">
        {/* Source icon — wiki uses the W logo */}
        <div
          className={cn(
            "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border shadow-xs transition-transform duration-200 group-hover:scale-105",
            isWiki ? "border-teal-500/20 bg-teal-500/10" : cn(resolvedConfig.bg, "border-border/30")
          )}
        >
          {isWiki ? (
            <img
              src="https://cdn.simpleicons.org/wikipedia/teal"
              alt="Wiki"
              className="h-4.5 w-4.5"
            />
          ) : (
            <Icon className={cn("h-4.5 w-4.5", resolvedConfig.color)} />
          )}
        </div>

        <div className="min-w-0 flex-1 space-y-1.5">
          {/* Header Row: Title on Left, Badges / Timestamp / Open Link on Right */}
          <FeedItemHeader
            activity={activity}
            resolvedConfig={resolvedConfig}
            isWiki={isWiki}
            isGrouped={isGrouped}
            sportsBulletin={sportsBulletin}
            wikiPageTitle={wikiPageTitle}
            wikiHref={wikiHref}
            displayTitle={displayTitle}
            titleHtml={titleHtml}
            externalUrl={externalUrl}
          />

          {/* Subtitle / Author Row */}
          <div className="text-muted-foreground flex flex-wrap items-center gap-2 text-xs font-medium tracking-tight">
            {isGrouped ? (
              isWiki ? (
                <span>
                  <span className="text-foreground font-semibold">{activity._editCount}</span> edits
                  by{" "}
                  {activity._editors.map((editor: string, idx: number) => (
                    <span key={editor}>
                      {idx > 0 && ", "}
                      <WikiAuthorPopover username={editor} />
                    </span>
                  ))}
                </span>
              ) : (
                <span>
                  <span className="text-foreground font-semibold">{activity._editCount}</span>{" "}
                  updates by{" "}
                  <span className="text-foreground font-semibold">
                    {activity._editors?.[0] ?? "unknown"}
                  </span>
                </span>
              )
            ) : (
              activity.user?.name &&
              (isWiki ? (
                <span className="flex items-center gap-1">
                  <span>by</span> <WikiAuthorPopover username={activity.user.name} />
                </span>
              ) : activity.poll && activity.user.name === "User" ? null : (
                <span>
                  by <span className="text-foreground/90 font-semibold">{activity.user.name}</span>
                </span>
              ))
            )}
          </div>

          {/* Edit description for non-grouped wiki items or standard posts */}
          {!isGrouped && descHtml && (
            <WikiHtmlContent
              html={descHtml}
              className="text-muted-foreground/90 pt-0.5 text-xs leading-relaxed tracking-tight break-words whitespace-pre-wrap"
            />
          )}

          {/* Inline Wiki Article Lead Snippet Preview */}
          {isWiki && wikiPageTitle && (
            <InlineWikiArticlePreview title={wikiPageTitle} wiki="ixwiki" />
          )}

          {/* Body Content / Poll / Sports Card (non-wiki items) */}
          {!isWiki &&
            !isGrouped &&
            (activity.poll ? (
              <FeedPollWidget poll={activity.poll} />
            ) : sportsBulletin ? (
              <SportsBulletinCard data={sportsBulletin} />
            ) : null)}

          {/* Grouped sub-items expandable drawer */}
          {isGrouped && <FeedGroupedDrawer subEdits={activity._subEdits} isWiki={isWiki} />}
        </div>
      </div>
    </div>
  );
});

export function FeedExternalLink({ url }: { url: string; title?: string }) {
  const wikiMatch = url.match(/ixwiki\.com\/wiki\/([^#?]+)/);
  const forumMatch = url.match(/forum\.ixwiki\.com\/threads\/(?:[^/]*\.)?(\d+)/);
  const link = (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="text-muted-foreground hover:text-foreground flex items-center gap-1 rounded-lg border border-border/50 bg-accent/10 px-2 py-0.5 text-[10px] font-medium tracking-tight transition-all duration-150 hover:bg-accent/20 active:scale-[0.95]"
    >
      <ExternalLink className="h-3 w-3" />
      <span>Open</span>
    </a>
  );
  if (wikiMatch)
    return (
      <WikiLinkPreview title={decodeURIComponent(wikiMatch[1]!).replace(/_/g, " ")} wiki="ixwiki">
        {link}
      </WikiLinkPreview>
    );
  if (forumMatch)
    return <ForumLinkPreview threadId={parseInt(forumMatch[1]!, 10)}>{link}</ForumLinkPreview>;
  return link;
}
