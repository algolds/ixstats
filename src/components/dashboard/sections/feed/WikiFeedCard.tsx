"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { OpenNewWindow as ExternalLink, NavArrowDown as ChevronDown } from "iconoir-react";
import { api } from "~/trpc/react";
import { WikiHtmlContent } from "~/components/wiki-os/reader/WikiLinkPreview";
import { parseWikitextToHtml } from "~/lib/wiki-os/transformers/wikitext-parser";
import { titleToWikiOSRoute } from "~/lib/wiki-os/transformers/url-compat";
import { formatThinkpagesContentForDisplay, cn } from "~/lib/utils";
import { timeAgo } from "~/lib/format/compact";
import { WikiOSLogomark } from "~/components/wiki-os/shared/WikiOSLogomark";
import { WikiAuthorPopover } from "../WikiAuthorPopover";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { WikiArticleActions } from "./WikiArticleActions";
import { useWikiLeadImage } from "./useWikiLeadImage";
import { WikiLeadThumb } from "./WikiLeadThumb";
import { decodeWikiTitle } from "./externalLinks";
import { Card } from "~/components/ui/card";

const cleanWikiTitle = (raw: string) =>
  decodeWikiTitle(raw).replace(/^(Wiki edit|New wiki page):\s*/i, "");

function WikiByline({ activity }: { activity: any }) {
  if (activity._grouped) {
    return (
      <span>
        <span className="text-label font-medium tabular-nums">{activity._editCount}</span> edits by{" "}
        {activity._editors?.map((editor: string, idx: number) => (
          <span key={editor}>
            {idx > 0 && ", "}
            <WikiAuthorPopover username={editor} />
          </span>
        ))}
      </span>
    );
  }
  if (!activity.user?.name) return null;
  return (
    <span className="flex items-center gap-1">
      <span>by</span>
      <WikiAuthorPopover username={activity.user.name} />
    </span>
  );
}

/** Collapsible list of the edits a grouped entry stands for. */
function WikiEditHistory({ edits }: { edits: any[] }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="mt-3">
      <Button
        type="button"
        variant="secondary"
        size="sm"
        className="rounded-full"
        aria-expanded={expanded}
        onClick={() => setExpanded(!expanded)}
      >
        <ChevronDown
          aria-hidden
          className={cn(
            "duration-fast ease-out-facet transition-transform",
            expanded && "rotate-180"
          )}
        />
        <span>{expanded ? "Hide edit history" : `Show ${edits.length} edits`}</span>
      </Button>

      {expanded && (
        <ul className="bg-surface-secondary rounded-row mt-2 space-y-1 p-3">
          {edits.map((sub, i) => (
            <li
              key={i}
              className="text-label-secondary text-footnote flex items-center justify-between py-0.5"
            >
              <div className="flex min-w-0 flex-1 items-center gap-2 truncate">
                <span className="text-label shrink-0 font-medium">{sub.user?.name ?? "?"}</span>
                <span aria-hidden className="text-label-tertiary">
                  ·
                </span>
                <span className="truncate">{sub.content?.description ?? ""}</span>
              </div>
              <span className="ml-2 shrink-0 tabular-nums">{timeAgo(new Date(sub.timestamp))}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Intro excerpt with the lead image thumbnail beside it. */
function WikiExcerpt({
  html,
  image,
  href,
  title,
}: {
  html: string;
  image: string | null | undefined;
  href: string;
  title: string;
}) {
  if (!html && !image) return null;
  return (
    <div className="mt-3 flex items-start gap-3">
      <div className="min-w-0 flex-1 space-y-1">
        {html && (
          <WikiHtmlContent
            html={html}
            className="text-label text-callout line-clamp-3 [&_a]:transition-colors"
          />
        )}
      </div>

      {image && (
        <WikiLeadThumb image={image} href={href} title={title} className="sm:h-24 sm:w-34" />
      )}
    </div>
  );
}

export function WikiFeedCard({ activity }: { activity: any }) {
  const isGrouped = !!activity._grouped;
  const blurb = activity.content?.metadata?.blurb;
  const wikiPageTitle =
    (activity.content?.metadata?.pageTitle as string) || activity.content?.title || "";
  const cleanTitle = cleanWikiTitle(wikiPageTitle);
  const wikiHref = titleToWikiOSRoute(cleanTitle);

  const { data: intro } = api.wikios.getIntro.useQuery(
    { title: cleanTitle, wiki: "ixwiki" },
    { enabled: !!cleanTitle, staleTime: 30 * 60_000 }
  );
  const introText = intro?.text || intro?.intro || "";
  const introHtml = useMemo(
    () => (introText || blurb ? parseWikitextToHtml(introText || blurb, "ixwiki") : ""),
    [introText, blurb]
  );
  const leadImage = useWikiLeadImage(cleanTitle, introText);

  const descText = activity.content?.description ?? "";
  const descHtml = descText ? formatThinkpagesContentForDisplay(descText) : "";

  return (
    <Card padding="md">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <WikiOSLogomark aria-hidden className="text-wiki mt-0.5 size-5 shrink-0" />

          <div className="min-w-0 flex-1 space-y-0.5">
            <div className="flex items-center gap-2">
              <Link
                href={wikiHref}
                className="text-label text-headline truncate underline-offset-2 hover:underline"
              >
                {cleanTitle}
              </Link>
              {activity._isNew && <Badge variant="info">New</Badge>}
            </div>

            <div className="text-label-secondary text-footnote flex flex-wrap items-center gap-2">
              <WikiByline activity={activity} />
              {!isGrouped && descHtml && (
                <>
                  <span aria-hidden className="text-label-tertiary">
                    ·
                  </span>
                  <WikiHtmlContent html={descHtml} as="span" className="text-label-secondary" />
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <span className="text-label-secondary text-footnote tabular-nums">
            {timeAgo(new Date(activity.timestamp))}
          </span>
          <Button asChild variant="secondary" size="sm" className="rounded-full">
            <Link href={wikiHref}>
              <span>Open</span>
              <ExternalLink aria-hidden />
            </Link>
          </Button>
        </div>
      </div>

      <WikiExcerpt html={introHtml} image={leadImage} href={wikiHref} title={cleanTitle} />

      {isGrouped && activity._subEdits?.length > 1 && (
        <WikiEditHistory edits={activity._subEdits} />
      )}

      <WikiArticleActions title={cleanTitle} />
    </Card>
  );
}
