// @ts-nocheck
"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Clock,
  ExternalLink,
  Globe,
  Landmark,
  Map as MapIcon,
  Rss,
  Shield,
  TrendingUp,
  Trophy,
  Users,
  BookOpen,
  MessageCircle,
  ChevronDown,
} from "lucide-react";
import { Badge } from "~/components/ui/badge";
import { FeedPollWidget } from "~/components/ui/FeedPollWidget";
import { WikiLinkPreview, ForumLinkPreview } from "~/components/wiki/WikiLinkPreview";
import { titleToWikiOSRoute } from "~/lib/wikios/url-compat";
import { formatTimeAgo } from "~/lib/time-utils";
import { renderDiscordEmojis } from "~/lib/text-formatter";
import { sanitizeUserContent } from "~/lib/sanitize-html";
import { cn } from "~/lib/utils";
import { WikiAuthorPopover } from "./WikiAuthorPopover";

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

export function UnifiedFeedItem({ activity }: { activity: any }) {
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
  const titleHtml = displayTitle ? sanitizeUserContent(renderDiscordEmojis(displayTitle)) : "";

  const descHtml = activity.content?.description
    ? sanitizeUserContent(renderDiscordEmojis(activity.content.description))
    : "";

  return (
    <div className="group glass-hierarchy-child bg-muted/5 hover:bg-muted/15 border-border/30 rounded-xl border p-3 transition-colors">
      <div className="flex items-start gap-3">
        {/* Source icon — wiki uses the W logo */}
        <div
          className={cn(
            "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
            isWiki ? "bg-teal-500/10" : resolvedConfig.bg
          )}
        >
          {isWiki ? (
            <img src="https://cdn.simpleicons.org/wikipedia/teal" alt="Wiki" className="h-4 w-4" />
          ) : (
            <Icon className={cn("h-4 w-4", resolvedConfig.color)} />
          )}
        </div>
        <div className="min-w-0 flex-1">
          {/* Title row */}
          <div className="mb-1 flex items-center gap-2">
            {/* Wiki: clickable page title */}
            {isWiki && wikiPageTitle ? (
              <Link
                href={wikiHref ?? "#"}
                className="text-foreground truncate text-sm font-medium hover:underline"
              >
                {wikiPageTitle}
              </Link>
            ) : (
              <span
                className="text-foreground truncate text-sm font-medium"
                dangerouslySetInnerHTML={{ __html: titleHtml }}
              />
            )}
            {/* Badge — wiki shows nothing, others show dynamic label */}
            {!isWiki && (
              <Badge
                variant="outline"
                className={cn("shrink-0 text-[10px]", resolvedConfig.color, "border-current/30")}
              >
                {resolvedConfig.label}
              </Badge>
            )}
            {activity._isNew && (
              <Badge className="shrink-0 border-teal-500/30 bg-teal-500/15 text-[9px] text-teal-500">
                NEW
              </Badge>
            )}
          </div>

          {/* Grouped summary (wiki edits or IxStats activity batches) */}
          {isGrouped ? (
            <div>
              {isWiki ? (
                /* Wiki: byte-count summary */
                <p className="text-muted-foreground text-xs">
                  <span className="text-foreground font-medium">{activity._editCount}</span> edits
                  by{" "}
                  <span className="text-foreground font-medium">
                    {activity._editors.length === 1
                      ? activity._editors[0]
                      : `${activity._editors.length} editors`}
                  </span>
                  {" · "}
                  <span
                    className={cn(
                      "font-medium",
                      activity._totalBytes > 0
                        ? "text-emerald-500"
                        : activity._totalBytes < 0
                          ? "text-red-500"
                          : "text-muted-foreground"
                    )}
                  >
                    {activity._totalBytes > 0 ? "+" : ""}
                    {activity._totalBytes} bytes
                  </span>
                </p>
              ) : (
                /* IxStats activity: count summary */
                <p className="text-muted-foreground text-xs">
                  <span className="text-foreground font-medium">{activity._editCount}</span> updates
                  by{" "}
                  <span className="text-foreground font-medium">
                    {activity._editors?.[0] ?? "unknown"}
                  </span>
                </p>
              )}
              {/* Expandable sub-items */}
              {activity._subEdits.length > 1 && (
                <button
                  onClick={() => setExpanded(!expanded)}
                  className="text-muted-foreground hover:text-foreground mt-1 flex cursor-pointer items-center gap-0.5 text-[10px] transition-colors"
                >
                  <ChevronDown
                    className={cn("h-3 w-3 transition-transform", expanded && "rotate-180")}
                  />
                  {expanded ? "Hide" : "Show"} {activity._subEdits.length}{" "}
                  {isWiki ? "edits" : "items"}
                </button>
              )}
              {expanded && (
                <div className="border-border/20 mt-1.5 space-y-0.5 border-l-2 pl-2">
                  {activity._subEdits.map((sub: any, i: number) => {
                    const subTitle = sub.content?.title ?? "";
                    const subDesc = sub.content?.description ?? "";
                    const display = isWiki ? subDesc.slice(0, 80) : subTitle.slice(0, 80);
                    return (
                      <div key={i} className="text-muted-foreground text-[10px]">
                        <span className="text-foreground/70 font-medium">
                          {sub.user?.name ?? "?"}
                        </span>
                        {" · "}
                        <span>{display}</span>
                        {" · "}
                        <span>{formatTimeAgo(new Date(sub.timestamp))}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : activity.poll ? (
            <FeedPollWidget poll={activity.poll} />
          ) : descHtml ? (
            <p
              className="text-muted-foreground text-xs break-words whitespace-pre-wrap"
              dangerouslySetInnerHTML={{ __html: descHtml }}
            />
          ) : null}

          {/* Footer metadata */}
          <div className="text-muted-foreground mt-1.5 flex items-center gap-3 text-[10px]">
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {formatTimeAgo(new Date(activity.timestamp))}
            </span>
            {!isGrouped &&
              activity.user?.name &&
              (isWiki ? (
                <WikiAuthorPopover username={activity.user.name} />
              ) : activity.poll && activity.user.name === "User" ? null : (
                <span>by {activity.user.name}</span>
              ))}
            {isGrouped && activity._editors.length <= 3 && (
              <span className="flex items-center gap-1">
                {activity._editors.map((editor: string, idx: number) => (
                  <span key={editor}>
                    {idx > 0 && ", "}
                    <WikiAuthorPopover username={editor} />
                  </span>
                ))}
              </span>
            )}
            {externalUrl && <FeedExternalLink url={externalUrl} title={activity.content?.title} />}
          </div>
        </div>
      </div>
    </div>
  );
}

export function FeedExternalLink({ url }: { url: string; title?: string }) {
  const wikiMatch = url.match(/ixwiki\.com\/wiki\/([^#?]+)/);
  const forumMatch = url.match(/forum\.ixwiki\.com\/threads\/(?:[^/]*\.)?(\d+)/);
  const link = (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="text-muted-foreground hover:text-foreground flex items-center gap-0.5 transition-colors"
    >
      <ExternalLink className="h-3 w-3" />
      Open
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
