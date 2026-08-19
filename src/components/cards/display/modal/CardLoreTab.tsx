"use client";

import React from "react";
import { motion } from "motion/react";
import { Globe, PenTool } from "lucide-react";
import { cn } from "~/lib/utils";
import { LoreWikiExcerpt } from "../LoreWikiExcerpt";
import type { CardInstance } from "~/types/cards-display";
import {
  getCategoryTheme,
  getCategoryLabel,
  isValidLoreCategory,
  classifyFromWikitext,
  type LoreCategory,
} from "~/lib/cards";
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
      transition={{ duration: 0.3 }}
      className="space-y-4"
    >
      {/* Wiki source + category + author badges */}
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-bold tracking-wider uppercase shadow-xs backdrop-blur-md",
            card.wikiSource === "iiwiki"
              ? "border-emerald-500/30 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
              : "border-sky-500/30 bg-sky-500/15 text-sky-600 dark:text-sky-400"
          )}
        >
          <Globe className="h-3 w-3" />
          {card.wikiSource === "iiwiki" ? "IIWiki" : "IxWiki"}
        </span>

        {resolvedCategory && categoryLabel && (
          <span
            className="border-border/40 bg-card/60 text-foreground inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-bold shadow-xs backdrop-blur-md"
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
          <span className="inline-flex items-center gap-1 rounded-lg border border-amber-500/30 bg-amber-500/15 px-2.5 py-1 text-xs font-semibold text-amber-600 shadow-xs backdrop-blur-md dark:text-amber-400">
            <PenTool className="h-3 w-3 text-amber-500" />
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
          <div className="glass-hierarchy-child border-border/40 space-y-3 rounded-xl border p-4 backdrop-blur-md">
            <h4 className="text-foreground text-muted-foreground/80 text-xs font-bold tracking-wider uppercase">
              Historical Metrics
            </h4>
            <div className="grid grid-cols-2 gap-3">
              <div className="border-border/40 bg-card/60 rounded-lg border p-3">
                <div className="text-muted-foreground text-xs font-medium">
                  Historical Significance
                </div>
                <div className="mt-1 font-mono text-xl font-bold text-amber-500 tabular-nums dark:text-amber-400">
                  {loreStats.historicalSignificance ?? 0}/100
                </div>
              </div>
              <div className="border-border/40 bg-card/60 rounded-lg border p-3">
                <div className="text-muted-foreground text-xs font-medium">Cultural Impact</div>
                <div className="mt-1 font-mono text-xl font-bold text-purple-500 tabular-nums dark:text-purple-400">
                  {loreStats.culturalImpact ?? 0}/100
                </div>
              </div>
            </div>
            {meta?.qualityScore != null && (
              <div className="text-muted-foreground/70 pt-1 text-[11px]">
                Article Quality Score: {Math.round(Number(meta.qualityScore))}/100
              </div>
            )}
          </div>
        );
      })()}
    </motion.div>
  );
}
