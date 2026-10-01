"use client";

import { useState, useMemo, memo } from "react";
import {
  WarningTriangle as AlertTriangle,
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
} from "iconoir-react";
// oxlint-disable-next-line eslint/no-unused-vars
import { Badge } from "~/components/ui/badge";
import { FacetCard } from "~/components/ui/facet-container";
import { Skeleton } from "~/components/ui/skeleton";
import { FeedPollWidget } from "~/components/shared/polls/FeedPollWidget";
import {
  WikiLinkPreview,
  ForumLinkPreview,
  WikiHtmlContent,
} from "~/components/wiki-os/reader/WikiLinkPreview";
import { WikiOSLogomark } from "~/components/wiki-os/shared/WikiOSLogomark";
import { titleToWikiOSRoute } from "~/lib/wiki-os/transformers/url-compat";
import { parseSportsBulletin } from "~/lib/sports/feed-bulletins";
import { SportsBulletinCard } from "~/components/thinkpages/SportsBulletinCard";
import { formatThinkpagesContentForDisplay } from "~/lib/utils";
import { cn } from "~/lib/utils";
import { WikiAuthorPopover } from "./WikiAuthorPopover";
import { FeedItemHeader } from "./feed/FeedItemHeader";
import { FeedGroupedDrawer } from "./feed/FeedGroupedDrawer";
import { InlineWikiArticlePreview, parseWikitextToHtml } from "./feed/InlineWikiArticlePreview";
import { WikiFeedCard } from "./feed/WikiFeedCard";
import type { ProcessedFeedItem } from "~/types/dashboard-feed";

export { parseWikitextToHtml, InlineWikiArticlePreview, WikiFeedCard };

export const SOURCE_CONFIG: Record<
  string,
  { icon: typeof Rss; color: string; bg: string; label: string }
> = {
  activity: { icon: Rss, color: "text-blue", bg: "bg-fill-3", label: "Activity" },
  thinkpages: {
    icon: Users,
    color: "text-blue",
    bg: "bg-fill-3",
    label: "Social",
  },
  wiki: { icon: BookOpen, color: "text-wiki", bg: "bg-fill-3", label: "Wiki" },
  forum: { icon: MessageCircle, color: "text-orange", bg: "bg-fill-3", label: "Forum" },
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
    return { label: "POI", icon: MapIcon, color: "text-green", bg: "bg-fill-3" };
  if (title.includes("city") || title.includes("settlement"))
    return { label: "City", icon: MapIcon, color: "text-green", bg: "bg-fill-3" };
  if (
    title.includes("subdivision") ||
    title.includes("province") ||
    title.includes("state") ||
    title.includes("region")
  )
    return {
      label: "Subdivision",
      icon: MapIcon,
      color: "text-green",
      bg: "bg-fill-3",
    };
  if (cat === "map" || title.includes("map") || title.includes("claim"))
    return { label: "Maps", icon: MapIcon, color: "text-green", bg: "bg-fill-3" };
  if (
    cat === "economic" ||
    title.includes("gdp") ||
    title.includes("econom") ||
    title.includes("trade")
  )
    return {
      label: "Economy",
      icon: TrendingUp,
      color: "text-green",
      bg: "bg-fill-3",
    };
  if (
    cat === "diplomatic" ||
    title.includes("embassy") ||
    title.includes("diplom") ||
    title.includes("treaty")
  )
    return { label: "Diplomacy", icon: Globe, color: "text-teal", bg: "bg-fill-3" };
  if (
    cat === "military" ||
    title.includes("military") ||
    title.includes("defense") ||
    title.includes("deploy")
  )
    return { label: "Defense", icon: Shield, color: "text-red", bg: "bg-fill-3" };
  if (
    cat === "political" ||
    title.includes("govern") ||
    title.includes("politic") ||
    title.includes("election")
  )
    return { label: "Politics", icon: Landmark, color: "text-indigo", bg: "bg-fill-3" };
  if (cat === "crisis" || title.includes("crisis"))
    return { label: "Crisis", icon: AlertTriangle, color: "text-red", bg: "bg-fill-3" };
  if (cat === "achievement" || title.includes("tier") || title.includes("achieve"))
    return { label: "Achievement", icon: Trophy, color: "text-yellow", bg: "bg-fill-3" };
  return { label: "Activity", icon: Rss, color: "text-blue", bg: "bg-fill-3" };
}

export const UnifiedFeedItem = memo(function UnifiedFeedItem({
  activity,
}: {
  activity: ProcessedFeedItem | any;
}) {
  const source = activity.source ?? "activity";
  const isWiki = source === "wiki";
  const isGrouped = !!activity._grouped;
  // oxlint-disable-next-line eslint/no-unused-vars
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

  // For wiki activities, render the dedicated cohesive WikiFeedCard
  if (isWiki) {
    return <WikiFeedCard activity={activity} />;
  }

  return (
    <FacetCard padding="md">
      <div className="flex items-start gap-3">
        {/* Source icon — wiki uses the W logo */}
        <div
          aria-hidden
          className={cn(
            "rounded-row mt-0.5 flex size-9 shrink-0 items-center justify-center",
            resolvedConfig.bg
          )}
        >
          {isWiki ? (
            <WikiOSLogomark className="text-wiki size-4.5" />
          ) : (
            <Icon className={cn("size-4.5", resolvedConfig.color)} />
          )}
        </div>

        <div className="min-w-0 flex-1 space-y-2">
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
          <div className="text-label-secondary text-footnote flex flex-wrap items-center gap-2">
            {isGrouped ? (
              isWiki ? (
                <span>
                  <span className="text-label font-medium">{activity._editCount}</span> edits by{" "}
                  {activity._editors.map((editor: string, idx: number) => (
                    <span key={editor}>
                      {idx > 0 && ", "}
                      <WikiAuthorPopover username={editor} />
                    </span>
                  ))}
                </span>
              ) : (
                <span>
                  <span className="text-label font-medium">{activity._editCount}</span> updates by{" "}
                  <span className="text-label font-medium">
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
                  by <span className="text-label font-medium">{activity.user.name}</span>
                </span>
              ))
            )}
          </div>

          {/* Edit description for non-grouped wiki items or standard posts */}
          {!isGrouped && descHtml && (
            <WikiHtmlContent
              html={descHtml}
              className="text-label-secondary text-callout pt-0.5 break-words whitespace-pre-wrap"
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
    </FacetCard>
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
      className="text-label-secondary hover:text-label bg-fill-3 hover:bg-fill-2 rounded-control-sm text-caption duration-fast ease-out-facet focus-visible:outline-tint flex items-center gap-1 px-2 py-0.5 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2"
    >
      <ExternalLink aria-hidden className="size-3.5" />
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

/** Loading placeholder shaped like a feed card. */
export function FeedItemSkeleton() {
  return (
    <FacetCard padding="md" aria-hidden className="flex items-start gap-3">
      <Skeleton className="rounded-row size-9 shrink-0" />
      <div className="flex-1 space-y-2">
        <Skeleton className="rounded-control-sm h-4 w-3/4" />
        <Skeleton className="rounded-control-sm h-3 w-1/2" />
      </div>
    </FacetCard>
  );
}
