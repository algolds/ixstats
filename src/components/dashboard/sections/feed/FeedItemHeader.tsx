"use client";

import Link from "next/link";
import { Clock, OpenNewWindow as ExternalLink, RssFeed as Rss } from "iconoir-react";
import { Badge } from "~/components/ui/badge";
import { timeAgo } from "~/lib/format/compact";
import {
  WikiHtmlContent,
  WikiLinkPreview,
  ForumLinkPreview,
} from "~/components/wiki-os/reader/WikiLinkPreview";

interface FeedItemHeaderProps {
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

function FeedExternalLink({ url }: { url: string }) {
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
            className="text-label text-headline truncate underline-offset-2 hover:underline"
          >
            {wikiPageTitle}
          </Link>
        ) : sportsBulletin ? (
          <span className="text-label text-headline truncate">Sports news bulletin</span>
        ) : (
          <WikiHtmlContent
            html={titleHtml}
            as="span"
            className="text-label text-headline truncate"
          />
        )}

        {activity._isNew && (
          <Badge variant="info" className="shrink-0">
            New
          </Badge>
        )}
      </div>

      {/* Right-aligned metadata chips */}
      <div className="flex shrink-0 items-center gap-2">
        {!isWiki && (
          <Badge variant="default" className="shrink-0">
            {resolvedConfig.label}
          </Badge>
        )}

        {/* Wiki total bytes pill */}
        {isWiki && isGrouped && activity._totalBytes !== undefined && (
          <Badge
            variant={
              activity._totalBytes > 0
                ? "success"
                : activity._totalBytes < 0
                  ? "destructive"
                  : "default"
            }
            className="tabular-nums"
          >
            {activity._totalBytes > 0 ? "+" : ""}
            {activity._totalBytes} bytes
          </Badge>
        )}

        {/* Timestamp */}
        <span className="text-label-secondary text-footnote flex items-center gap-1 tabular-nums">
          <Clock aria-hidden className="size-3.5" />
          {timeAgo(new Date(activity.timestamp))}
        </span>

        {/* External open link */}
        {externalUrl && <FeedExternalLink url={externalUrl} />}
      </div>
    </div>
  );
}
