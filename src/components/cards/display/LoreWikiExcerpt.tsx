/**
 * LoreWikiExcerpt — Shows first few paragraphs of a wiki article for lore cards.
 * Checks metadata.fullExcerpt first, then fetches on-demand via tRPC.
 * Used inside the Lore tab of CardDetailsModal.
 */

"use client";

import React, { useMemo } from "react";
import Link from "next/link";
import { ExternalLink, BookOpen, Loader2 } from "lucide-react";
import { api } from "~/trpc/react";
import type { CardInstance } from "~/types/cards-display";
import { WikiLinkPreview, WikiHtmlContent } from "~/components/wiki/WikiLinkPreview";
import { parseWikitextToHtml } from "~/lib/wiki/wikitext-parser";

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

  const parsedHtml = useMemo(
    () => parseWikitextToHtml(excerptText, source),
    [excerptText, source]
  );

  return (
    <div className="glass-hierarchy-child rounded-xl border border-border/40 p-4 backdrop-blur-md space-y-3">
      <h3 className="flex items-center gap-2 text-base font-bold text-foreground">
        <BookOpen className="h-4 w-4 text-primary" />
        {card.wikiArticleTitle?.replace(/_/g, " ") || card.title}
      </h3>

      {isLoading && !storedExcerpt ? (
        <div className="flex items-center gap-2 py-4 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
          Loading article excerpt...
        </div>
      ) : excerptText ? (
        <div className="max-h-64 overflow-y-auto pr-1 text-xs leading-relaxed text-muted-foreground space-y-2">
          <WikiHtmlContent html={parsedHtml} />
        </div>
      ) : (
        <div className="py-2 text-xs text-muted-foreground">No article excerpt available.</div>
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
              className="inline-flex items-center gap-1.5 pt-1 text-xs font-semibold text-primary hover:underline"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Read full article on IxWiki
            </Link>
          ) : (
            <a
              href={wikiUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 pt-1 text-xs font-semibold text-primary hover:underline"
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
