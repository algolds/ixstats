"use client";
/**
 * LoreWikiExcerpt — Shows first few paragraphs of a wiki article for lore cards.
 * Shows the card's stored excerpt first, then fetches on-demand via tRPC.
 * Used in the card sheet's About section.
 */

import React, { useMemo } from "react";
import Link from "next/link";
import {
  OpenNewWindow as ExternalLink,
  OpenBook as BookOpen,
  SystemRestart as Loader2,
} from "iconoir-react";
import { api } from "~/trpc/react";
import { WikiLinkPreview, WikiHtmlContent } from "~/components/wiki-os/reader/WikiLinkPreview";
import { cardSourceLabel, parseCardWikiSource } from "~/lib/cards/card-sources";
import { parseWikitextToHtml } from "~/lib/wiki-os/transformers/wikitext-parser";

interface LoreWikiExcerptProps {
  card: {
    title: string;
    description: string | null;
    excerpt: string | null;
    wikiSource: string | null;
    wikiArticleTitle: string | null;
  };
  wikiUrl: string | null;
}

export const LoreWikiExcerpt = React.memo<LoreWikiExcerptProps>(({ card, wikiUrl }) => {
  const storedExcerpt = card.excerpt;
  const targetArticleTitle = card.wikiArticleTitle || card.title;
  const source = parseCardWikiSource(card.wikiSource) ?? "ixwiki";
  // Commons has files and no articles: no wikitext to fetch, no reader page to preview.
  const articleSource = source === "commons" ? null : source;

  const { data: fetchedExcerpt, isLoading } = api.cards.getWikiArticleExcerpt.useQuery(
    {
      articleTitle: targetArticleTitle,
      wikiSource: articleSource ?? "ixwiki",
    },
    {
      enabled: !!targetArticleTitle && articleSource !== null,
      staleTime: 10 * 60 * 1000,
    }
  );

  const excerptText =
    fetchedExcerpt?.wikitext || fetchedExcerpt?.extract || storedExcerpt || card.description;

  const parsedHtml = useMemo(
    () => parseWikitextToHtml(excerptText, articleSource ?? "ixwiki"),
    [excerptText, articleSource]
  );

  return (
    <div className="bg-surface-secondary border-separator rounded-row space-y-3 border p-4">
      <h4 className="text-label text-headline flex items-center gap-2">
        <BookOpen className="text-tint h-4 w-4" />
        {card.wikiArticleTitle?.replace(/_/g, " ") || card.title}
      </h4>

      {isLoading && !storedExcerpt ? (
        <div className="text-label-secondary text-footnote flex items-center gap-2 py-4">
          <Loader2 className="text-tint h-3.5 w-3.5 animate-spin" />
          Loading article excerpt...
        </div>
      ) : excerptText ? (
        <div className="text-label-secondary text-footnote max-h-64 space-y-2 overflow-y-auto pr-1 leading-relaxed">
          <WikiHtmlContent html={parsedHtml} />
        </div>
      ) : (
        <div className="text-label-secondary text-footnote py-2">No article excerpt available.</div>
      )}

      {wikiUrl && articleSource === null && (
        <span className="inline-flex flex-wrap items-center gap-x-3 pt-1">
          <a
            href={wikiUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-tint text-footnote inline-flex items-center gap-2 font-semibold hover:underline"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            View the file page
          </a>
          <span className="text-label-secondary text-footnote">From {cardSourceLabel(source)}</span>
        </span>
      )}

      {wikiUrl && articleSource !== null && (
        <WikiLinkPreview
          title={
            card.wikiArticleTitle ||
            wikiUrl
              .split(/\/(?:wiki|w)\//)
              .pop()
              ?.replace(/\?.*$/, "")
              ?.replace(/_/g, " ") ||
            ""
          }
          wiki={articleSource}
        >
          <span className="inline-flex flex-wrap items-center gap-x-3 pt-1">
            <Link
              href={wikiUrl}
              className="text-tint text-footnote inline-flex items-center gap-2 font-semibold hover:underline"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Read the full article
            </Link>
            {articleSource !== "ixwiki" && (
              <span className="text-label-secondary text-footnote">
                From {cardSourceLabel(articleSource)}
              </span>
            )}
          </span>
        </WikiLinkPreview>
      )}
    </div>
  );
});

LoreWikiExcerpt.displayName = "LoreWikiExcerpt";
