/**
 * LoreWikiExcerpt — Shows first few paragraphs of a wiki article for lore cards.
 * Checks metadata.fullExcerpt first, then fetches on-demand via tRPC.
 * Used inside the Lore tab of CardDetailsModal.
 */

"use client";

import React from "react";
import Link from "next/link";
import { ExternalLink, BookOpen, Loader2 } from "lucide-react";
import { api } from "~/trpc/react";
import type { CardInstance } from "~/types/cards-display";
import { WikiLinkPreview } from "~/components/wiki/WikiLinkPreview";

interface LoreWikiExcerptProps {
  card: CardInstance;
  wikiUrl: string | null;
}

export const LoreWikiExcerpt = React.memo<LoreWikiExcerptProps>(({ card, wikiUrl }) => {
  const meta = card.metadata as Record<string, unknown> | undefined;
  const storedExcerpt = meta?.fullExcerpt as string | undefined;

  const { data: fetchedExcerpt, isLoading } = api.cards.getWikiArticleExcerpt.useQuery(
    {
      articleTitle: card.wikiArticleTitle!,
      wikiSource: card.wikiSource as "ixwiki" | "iiwiki",
    },
    {
      enabled:
        !storedExcerpt &&
        !!card.wikiArticleTitle &&
        !!card.wikiSource &&
        (card.wikiSource === "ixwiki" || card.wikiSource === "iiwiki"),
      staleTime: 10 * 60 * 1000,
    }
  );

  const excerptText = storedExcerpt || fetchedExcerpt?.extract || card.description;

  return (
    <div className="glass-hierarchy-child mb-4 rounded-lg p-4">
      <h3 className="mb-3 flex items-center gap-2 text-lg font-semibold text-white">
        <BookOpen className="h-4 w-4" />
        {card.wikiArticleTitle?.replace(/_/g, " ") || card.title}
      </h3>

      {isLoading && !storedExcerpt ? (
        <div className="flex items-center gap-2 text-sm text-white/50">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Loading article excerpt...
        </div>
      ) : excerptText ? (
        <div className="max-h-64 overflow-y-auto pr-1 text-sm leading-relaxed whitespace-pre-line text-white/80">
          {excerptText}
        </div>
      ) : (
        <div className="text-sm text-white/50">No article excerpt available.</div>
      )}

      {wikiUrl && (
        <WikiLinkPreview
          title={card.wikiArticleTitle || wikiUrl.split(/\/(?:wiki|w)\//).pop()?.replace(/_/g, " ") || ""}
          wiki={card.wikiSource as "ixwiki" | "iiwiki" | undefined}
        >
          {card.wikiSource === "ixwiki" ? (
            <Link
              href={wikiUrl}
              className="mt-3 inline-flex items-center gap-1.5 text-sm text-blue-400 hover:text-blue-300"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Read full article on IxWiki
            </Link>
          ) : (
            <a
              href={wikiUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex items-center gap-1.5 text-sm text-blue-400 hover:text-blue-300"
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
