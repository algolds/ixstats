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

export function CardLoreTab({ card, wikiUrl }: { card: CardInstance; wikiUrl: string | null }) {
  const meta = card.metadata as Record<string, unknown> | null | undefined;
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
    cardTypeStr === "LORE_BATCH" ||
    Boolean(card.category && card.category !== "NS_IMPORT") ||
    Boolean(card.wikiPageId) ||
    Boolean(card.wikiSource) ||
    Boolean(card.slug);

  const rawCat = card.category || (meta?.category as string);
  const resolvedCategory = (
    rawCat && isValidLoreCategory(rawCat) && rawCat !== "NS_IMPORT"
      ? (rawCat as LoreCategory)
      : isLoreCard
        ? classifyFromWikitext(
            (meta?.fullExcerpt as string) || card.description,
            card.wikiArticleTitle || card.title
          )
        : null
  ) as LoreCategory | null;

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
            "rounded-control text-eyebrow shadow-card inline-flex items-center gap-1 border px-3 py-1",
            card.wikiSource === "iiwiki"
              ? "border-green/30 bg-green/15 text-green"
              : "border-wiki/30 bg-wiki/15 text-wiki"
          )}
        >
          <Globe className="h-3 w-3" />
          {card.wikiSource === "iiwiki" ? "IIWiki" : "IxWiki"}
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
      <LoreWikiExcerpt card={card} wikiUrl={wikiUrl} />

      {/* Lore-specific historical metrics */}
      {(() => {
        const loreStats = meta?.loreStats as
          { historicalSignificance?: number; culturalImpact?: number } | undefined;
        if (!loreStats) return null;
        return (
          <div className="bg-surface-secondary border-separator rounded-row space-y-3 border p-4">
            <h4 className="text-label text-label-secondary text-eyebrow">Historical Metrics</h4>
            <div className="grid grid-cols-2 gap-3">
              <div className="border-separator bg-surface rounded-control border p-3">
                <div className="text-label-secondary text-footnote font-medium">
                  Historical Significance
                </div>
                <div className="text-title-2 text-yellow mt-1 tabular-nums">
                  {loreStats.historicalSignificance ?? 0}/100
                </div>
              </div>
              <div className="border-separator bg-surface rounded-control border p-3">
                <div className="text-label-secondary text-footnote font-medium">
                  Cultural Impact
                </div>
                <div className="text-title-2 text-indigo mt-1 tabular-nums">
                  {loreStats.culturalImpact ?? 0}/100
                </div>
              </div>
            </div>
            {meta?.qualityScore != null && (
              <div className="text-label-tertiary text-footnote pt-1">
                Article Quality Score: {Math.round(Number(meta.qualityScore))}/100
              </div>
            )}
          </div>
        );
      })()}
    </motion.div>
  );
}
