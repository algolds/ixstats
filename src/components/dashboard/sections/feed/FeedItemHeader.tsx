"use client";

import Link from "next/link";
import { Clock, OpenNewWindow as ExternalLink, RssFeed as Rss } from "iconoir-react";
import { Badge } from "~/components/ui/badge";
import { formatTimeAgo } from "~/lib/utils";
import {
  WikiHtmlContent,
  WikiLinkPreview,
  ForumLinkPreview,
} from "~/components/wiki-os/reader/WikiLinkPreview";
import { cn } from "~/lib/utils";

export interface FeedItemHeaderProps {
  activity: any;
  resolvedConfig: {
    icon: typeof Rss;
    color: string;
    bg: string;
    label: string;
  };
  isWiki: boolean;
  isGrouped: boolean;
  sportsBulletin?: any;
  wikiPageTitle?: string;
  wikiHref?: string | null;
  displayTitle: string;
  titleHtml: string;
  externalUrl?: string;
}

export function FeedExternalLink({ url }: { url: string }) {
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

  if (wikiMatch) {
    return (
      <WikiLinkPreview title={decodeURIComponent(wikiMatch[1]!).replace(/_/g, " ")} wiki="ixwiki">
        {link}
      </WikiLinkPreview>
    );
  }
  if (forumMatch) {
    return <ForumLinkPreview threadId={parseInt(forumMatch[1]!, 10)}>{link}</ForumLinkPreview>;
  }

  return link;
}

export function FeedItemHeader({
  activity,
  resolvedConfig,
  isWiki,
  isGrouped,
  sportsBulletin,
  wikiPageTitle,
  wikiHref,
  titleHtml,
  externalUrl,
}: FeedItemHeaderProps) {
  // oxlint-disable-next-line eslint/no-unused-vars
  const Icon = resolvedConfig.icon;

  return (
    <div className="flex flex-wrap items-start justify-between gap-2">
      <div className="flex min-w-0 flex-1 items-center gap-2">
        {/* Wiki: Clickable Page Title */}
        {isWiki && wikiPageTitle ? (
          <Link
            href={wikiHref ?? "#"}
            className="text-foreground truncate text-sm font-semibold tracking-tight transition-colors hover:text-teal-300"
          >
            {wikiPageTitle}
          </Link>
        ) : sportsBulletin ? (
          <span className="text-foreground truncate text-sm font-semibold tracking-tight">
            Sports News Bulletin
          </span>
        ) : (
          <WikiHtmlContent
            html={titleHtml}
            as="span"
            className="text-foreground truncate text-sm font-semibold tracking-tight"
          />
        )}

        {activity._isNew && (
          <Badge className="shrink-0 rounded-full border-teal-500/30 bg-teal-500/15 text-[8px] font-semibold tracking-wider text-teal-400 uppercase">
            NEW
          </Badge>
        )}
      </div>

      {/* Right-aligned metadata chips */}
      <div className="flex shrink-0 items-center gap-2">
        {!isWiki && (
          <Badge
            variant="outline"
            className={cn(
              "shrink-0 rounded-full border-current/30 text-[8.5px] font-medium tracking-wider uppercase",
              resolvedConfig.color
            )}
          >
            {resolvedConfig.label}
          </Badge>
        )}

        {/* Wiki total bytes pill */}
        {isWiki && isGrouped && activity._totalBytes !== undefined && (
          <span
            className={cn(
              "inline-flex items-center rounded-full border px-2 py-0.5 text-[8.5px] font-medium tracking-tight tabular-nums shadow-xs",
              activity._totalBytes > 0
                ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                : activity._totalBytes < 0
                  ? "border-red-500/25 bg-red-500/10 text-red-600 dark:text-red-400"
                  : "text-muted-foreground border-border/40 bg-accent/10"
            )}
          >
            {activity._totalBytes > 0 ? "+" : ""}
            {activity._totalBytes} bytes
          </span>
        )}

        {/* Timestamp */}
        <span className="text-muted-foreground/70 flex items-center gap-1 text-[10px] font-normal tracking-normal tabular-nums">
          <Clock className="h-3 w-3" />
          {formatTimeAgo(new Date(activity.timestamp))}
        </span>

        {/* External open link */}
        {externalUrl && <FeedExternalLink url={externalUrl} />}
      </div>
    </div>
  );
}
