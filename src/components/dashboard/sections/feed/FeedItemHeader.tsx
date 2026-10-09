"use client";

import Link from "next/link";
import { Clock, OpenNewWindow as ExternalLink } from "iconoir-react";
import { Badge } from "~/components/ui/badge";
import { timeAgo } from "~/lib/format/compact";
import { forumThreadIdFromUrl, wikiTitleFromUrl } from "./externalLinks";
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

const OPEN_LINK_CLASS =
  "text-label-secondary hover:text-label bg-fill-3 hover:bg-fill-2 rounded-control-sm text-caption duration-fast ease-out-facet focus-visible:outline-tint flex items-center gap-1 px-2 py-0.5 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2";

function FeedExternalLink({ url }: { url: string }) {
  // An app path (a native forum thread) opens in the app; `Link` adds the production base path.
  if (url.startsWith("/")) {
    return (
      <Link href={url} className={OPEN_LINK_CLASS}>
        <ExternalLink aria-hidden className="size-3.5" />
        <span>Open</span>
      </Link>
    );
  }
  const wikiTitle = wikiTitleFromUrl(url);
  const forumThreadId = forumThreadIdFromUrl(url);

  const link = (
    <a href={url} target="_blank" rel="noopener noreferrer" className={OPEN_LINK_CLASS}>
      <ExternalLink aria-hidden className="size-3.5" />
      <span>Open</span>
    </a>
  );

  if (wikiTitle) {
    return (
      <WikiLinkPreview title={wikiTitle} wiki="ixwiki">
        {link}
      </WikiLinkPreview>
    );
  }
  if (forumThreadId) return <ForumLinkPreview threadId={forumThreadId}>{link}</ForumLinkPreview>;

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
