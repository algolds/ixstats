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
import { Card } from "~/components/ui/card";

export function WikiFeedCard({ activity }: { activity: any }) {
  const isGrouped = !!activity._grouped;
  const metadata = activity.content?.metadata ?? {};
  const wikiPageTitle = (metadata.pageTitle as string) || activity.content?.title || "";

  const cleanTitle = useMemo(() => {
    try {
      return decodeURIComponent(wikiPageTitle)
        .replace(/^(Wiki edit|New wiki page):\s*/i, "")
        .replace(/_/g, " ")
        .trim();
    } catch {
      return wikiPageTitle
        .replace(/^(Wiki edit|New wiki page):\s*/i, "")
        .replace(/_/g, " ")
        .trim();
    }
  }, [wikiPageTitle]);

  const wikiHref = titleToWikiOSRoute(cleanTitle);

  // ─── Queries ─────────────────────────────────────────────────────────────────
  const { data: intro } = api.wikios.getIntro.useQuery(
    { title: cleanTitle, wiki: "ixwiki" },
    { enabled: !!cleanTitle, staleTime: 30 * 60_000 }
  );

  const [isHistoryExpanded, setIsHistoryExpanded] = useState(false);

  const formattedIntroHtml = useMemo(() => {
    const raw = intro?.text || intro?.intro || activity.content?.metadata?.blurb || "";
    if (!raw) return "";
    return parseWikitextToHtml(raw, "ixwiki");
  }, [intro?.text, intro?.intro, activity.content?.metadata?.blurb]);

  const leadImage = useWikiLeadImage(cleanTitle, intro?.text || intro?.intro || "");

  const descText = activity.content?.description ?? "";
  const descHtml = descText ? formatThinkpagesContentForDisplay(descText) : "";

  return (
    <Card padding="md">
      {/* ── 1. Header row ── */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <WikiOSLogomark aria-hidden className="text-wiki mt-0.5 size-5 shrink-0" />

          {/* Title & metadata */}
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

            {/* Author / subtitle / diff metadata */}
            <div className="text-label-secondary text-footnote flex flex-wrap items-center gap-2">
              {isGrouped ? (
                <span>
                  <span className="text-label font-medium tabular-nums">{activity._editCount}</span>{" "}
                  edits by{" "}
                  {activity._editors?.map((editor: string, idx: number) => (
                    <span key={editor}>
                      {idx > 0 && ", "}
                      <WikiAuthorPopover username={editor} />
                    </span>
                  ))}
                </span>
              ) : (
                activity.user?.name && (
                  <span className="flex items-center gap-1">
                    <span>by</span>
                    <WikiAuthorPopover username={activity.user.name} />
                  </span>
                )
              )}

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

        {/* Timestamp & open link */}
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

      {/* ── 2. Excerpt & lead image ── */}
      {(formattedIntroHtml || leadImage) && (
        <div className="mt-3 flex items-start gap-3">
          <div className="min-w-0 flex-1 space-y-1">
            {formattedIntroHtml && (
              <WikiHtmlContent
                html={formattedIntroHtml}
                className="text-label text-callout line-clamp-3 [&_a]:transition-colors"
              />
            )}
          </div>

          {/* Lead image thumbnail */}
          {leadImage && (
            <Link
              href={wikiHref}
              className="border-separator bg-fill-4 rounded-row focus-visible:outline-tint relative h-20 w-28 shrink-0 overflow-hidden border focus-visible:outline-2 focus-visible:outline-offset-2 sm:h-24 sm:w-34"
              title={`View ${cleanTitle}`}
            >
              <img
                src={leadImage}
                alt={cleanTitle}
                className="h-full w-full object-cover"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = "none";
                }}
              />
            </Link>
          )}
        </div>
      )}

      {/* ── 3. Grouped edit history ── */}
      {isGrouped && activity._subEdits && activity._subEdits.length > 1 && (
        <div className="mt-3">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="rounded-full"
            aria-expanded={isHistoryExpanded}
            onClick={() => setIsHistoryExpanded(!isHistoryExpanded)}
          >
            <ChevronDown
              aria-hidden
              className={cn(
                "duration-fast ease-out-facet transition-transform",
                isHistoryExpanded && "rotate-180"
              )}
            />
            <span>
              {isHistoryExpanded ? "Hide edit history" : `Show ${activity._subEdits.length} edits`}
            </span>
          </Button>

          {isHistoryExpanded && (
            <ul className="bg-surface-secondary rounded-row mt-2 space-y-1 p-3">
              {activity._subEdits.map((sub: any, i: number) => {
                const subDesc = sub.content?.description ?? "";
                return (
                  <li
                    key={i}
                    className="text-label-secondary text-footnote flex items-center justify-between py-0.5"
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-2 truncate">
                      <span className="text-label shrink-0 font-medium">
                        {sub.user?.name ?? "?"}
                      </span>
                      <span aria-hidden className="text-label-tertiary">
                        ·
                      </span>
                      <span className="truncate">{subDesc}</span>
                    </div>
                    <span className="ml-2 shrink-0 tabular-nums">
                      {timeAgo(new Date(sub.timestamp))}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      {/* ── 4. Action toolbar, margin composer, repost ── */}
      <WikiArticleActions title={cleanTitle} />
    </Card>
  );
}
