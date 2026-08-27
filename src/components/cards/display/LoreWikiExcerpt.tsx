/**
 * LoreWikiExcerpt — Shows first few paragraphs of a wiki article for lore cards.
 * Checks metadata.fullExcerpt first, then fetches on-demand via tRPC.
 * Used inside the Lore tab of CardDetailsModal.
 */

"use client";

import React, { useMemo } from "react";
import Link from "next/link";
import {
  OpenNewWindow as ExternalLink,
  OpenBook as BookOpen,
  SystemRestart as Loader2,
} from "iconoir-react";
import { api } from "~/trpc/react";
import type { CardInstance } from "~/types/cards-display";
import { WikiLinkPreview, WikiHtmlContent } from "~/components/wiki-os/reader/WikiLinkPreview";
import { parseWikitextToHtml } from "~/lib/wiki-os/transformers/wikitext-parser";

interface LoreWikiExcerptProps {
  card: CardInstance;
  wikiUrl: string | null;
}

export const LoreWikiExcerpt = React.memo<LoreWikiExcerptProps>(({ card, wikiUrl }) => {
  const meta = card.metadata as Record<string, unknown> | undefined;
  const storedExcerpt = meta?.fullExcerpt as string | undefined;
  const targetArticleTitle = card.wikiArticleTitle || card.title;
  const source = (card.wikiSource as "ixwiki" | "iiwiki") || "ixwiki";

  const { data: fetchedExcerpt, isLoading } = api.cards.getWikiArticleExcerpt.useQuery(
    {
      articleTitle: targetArticleTitle,
      wikiSource: source,
    },
    {
      enabled: !!targetArticleTitle,
      staleTime: 10 * 60 * 1000,
    }
  );

  const excerptText =
    fetchedExcerpt?.wikitext || fetchedExcerpt?.extract || storedExcerpt || card.description;

  const parsedHtml = useMemo(() => parseWikitextToHtml(excerptText, source), [excerptText, source]);

  return (
    <div className="facet-hierarchy-child border-border/40 space-y-3 rounded-xl border p-4 backdrop-blur-md">
      <h3 className="text-foreground flex items-center gap-2 text-base font-bold">
        <BookOpen className="text-primary h-4 w-4" />
        {card.wikiArticleTitle?.replace(/_/g, " ") || card.title}
      </h3>

      {isLoading && !storedExcerpt ? (
        <div className="text-muted-foreground flex items-center gap-2 py-4 text-xs">
          <Loader2 className="text-primary h-3.5 w-3.5 animate-spin" />
          Loading article excerpt...
        </div>
      ) : excerptText ? (
        <div className="text-muted-foreground max-h-64 space-y-2 overflow-y-auto pr-1 text-xs leading-relaxed">
          <WikiHtmlContent html={parsedHtml} />
        </div>
      ) : (
        <div className="text-muted-foreground py-2 text-xs">No article excerpt available.</div>
      )}

      {wikiUrl && (
        <WikiLinkPreview
          title={
            card.wikiArticleTitle ||
            wikiUrl
              .split(/\/(?:wiki|w)\//)
              .pop()
              ?.replace(/_/g, " ") ||
            ""
          }
          wiki={card.wikiSource as "ixwiki" | "iiwiki" | undefined}
        >
          {card.wikiSource === "ixwiki" ? (
            <Link
              href={wikiUrl}
              className="text-primary inline-flex items-center gap-1.5 pt-1 text-xs font-semibold hover:underline"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Read full article on IxWiki
            </Link>
          ) : (
            <a
              href={wikiUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary inline-flex items-center gap-1.5 pt-1 text-xs font-semibold hover:underline"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Read full article on IIWiki
            </a>
          )}
        </WikiLinkPreview>
      )}
    </div>
  );
});

LoreWikiExcerpt.displayName = "LoreWikiExcerpt";
