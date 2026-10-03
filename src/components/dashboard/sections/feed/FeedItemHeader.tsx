"use client";

import { Clock, OpenNewWindow as ExternalLink } from "iconoir-react";
import { Badge } from "~/components/ui/badge";
import { timeAgo } from "~/lib/format/compact";
import {
  WikiHtmlContent,
  WikiLinkPreview,
  ForumLinkPreview,
} from "~/components/wiki-os/reader/WikiLinkPreview";

interface FeedItemHeaderProps {
  activity: any;
  label: string;
  sportsBulletin?: any;
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
  label,
  sportsBulletin,
  titleHtml,
  externalUrl,
}: FeedItemHeaderProps) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-2">
      <div className="flex min-w-0 flex-1 items-center gap-2">
        {sportsBulletin ? (
          <span className="text-label text-headline truncate">Sports news bulletin</span>
        ) : (
          <WikiHtmlContent
            html={titleHtml}
            as="span"
            className="text-label text-headline truncate"
          />
        )}
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <Badge variant="default" className="shrink-0">
          {label}
        </Badge>
        <span className="text-label-secondary text-footnote flex items-center gap-1 tabular-nums">
          <Clock aria-hidden className="size-3.5" />
          {timeAgo(new Date(activity.timestamp))}
        </span>
        {externalUrl && <FeedExternalLink url={externalUrl} />}
      </div>
    </div>
  );
}
