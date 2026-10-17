"use client";

import { springSmooth } from "~/lib/design/motion";
import React from "react";
import { motion } from "motion/react";
import { Globe, EditPencil as PenTool } from "iconoir-react";
import { cn } from "~/lib/utils";
import { LoreWikiExcerpt } from "../LoreWikiExcerpt";
import type { CardInstance } from "~/types/cards-display";
import { getCategoryTheme, getCategoryLabel } from "~/lib/cards/category-theme";
import { isValidLoreCategory, type LoreCategory } from "~/lib/cards/category-enums";
import { classifyFromWikitext } from "~/lib/cards/category-classifier";
import { CategoryIcon } from "~/components/cards/icons";
import { cardSourceLabel, parseCardWikiSource } from "~/lib/cards/card-sources";

export function CardLoreTab({ card, wikiUrl }: { card: CardInstance; wikiUrl: string | null }) {
  const meta = card.metadata as Record<string, unknown> | null | undefined;
  const source = parseCardWikiSource(card.wikiSource) ?? "ixwiki";
  const rawAuthor =
    (meta?.authorInfo as { displayAuthor?: string } | undefined)?.displayAuthor ||
    (meta?.author as string);
  let cleanAuthor = rawAuthor
    ? String(rawAuthor)
        .replace(/(?:imported|import)\s*>\s*/gi, "")
        .replace(/User:\s*/gi, "")
        .trim()
    : "";
  if (
    !cleanAuthor ||
    cleanAuthor.toLowerCase().includes("community") ||
    cleanAuthor.toLowerCase() === "unknown"
  ) {
    cleanAuthor = "";
  }

  const cardTypeStr = (card.cardType as string) || "";
  const isLoreCard =
    cardTypeStr === "LORE" ||
    Boolean(card.category) ||
    Boolean(card.wikiSource) ||
    Boolean(card.slug);

  const rawCat = card.category || (meta?.category as string);
  const resolvedCategory = (
    rawCat && isValidLoreCategory(rawCat)
      ? (rawCat as LoreCategory)
      : isLoreCard
        ? classifyFromWikitext(
            (meta?.fullExcerpt as string) || card.description,
            card.wikiArticleTitle || card.title
          )
        : null
  ) as LoreCategory | null;

  const fullExcerpt = meta?.fullExcerpt;
  const storedExcerpt = typeof fullExcerpt === "string" ? fullExcerpt : null;

  const categoryTheme = resolvedCategory ? getCategoryTheme(resolvedCategory) : null;
  const categoryLabel = resolvedCategory ? getCategoryLabel(resolvedCategory) : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={springSmooth}
      className="space-y-4"
    >
      {/* Wiki source + category + author badges */}
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={cn(
            "rounded-control text-caption shadow-card inline-flex items-center gap-1 border px-3 py-1",
            source !== "ixwiki"
              ? "border-green/30 bg-green/15 text-green"
              : "border-wiki/30 bg-wiki/15 text-wiki"
          )}
        >
          <Globe className="h-3 w-3" />
          {cardSourceLabel(source)}
        </span>

        {resolvedCategory && categoryLabel && (
          <span
            className="border-separator bg-surface text-label rounded-control text-footnote shadow-card inline-flex items-center gap-2 border px-3 py-1 font-semibold"
            style={
              categoryTheme
                ? {
                    borderColor: categoryTheme.accentColor,
                    backgroundColor: categoryTheme.accentSoft,
                  }
                : undefined
            }
          >
            <CategoryIcon
              category={resolvedCategory}
              treatment="seal"
              size="xs"
              color={categoryTheme?.accentColor}
            />
            {categoryLabel}
          </span>
        )}

        {cleanAuthor && (
          <span className="rounded-control border-yellow/30 bg-yellow/15 text-footnote text-yellow shadow-card inline-flex items-center gap-1 border px-3 py-1 font-semibold">
            <PenTool className="text-yellow h-3 w-3" />
            {cleanAuthor}
          </span>
        )}
      </div>

      {/* Wiki article excerpt (full paragraphs) */}
      <LoreWikiExcerpt card={{ ...card, excerpt: storedExcerpt }} wikiUrl={wikiUrl} />
    </motion.div>
  );
}
