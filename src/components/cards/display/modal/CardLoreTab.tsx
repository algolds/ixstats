"use client";

import React from "react";
import { motion } from "motion/react";
import { cn } from "~/lib/utils";
import { LoreWikiExcerpt } from "../LoreWikiExcerpt";
import { LoreForumSection } from "../LoreForumSection";
import type { CardInstance } from "~/types/cards-display";

export function CardLoreTab({
  card,
  wikiUrl,
}: {
  card: CardInstance;
  wikiUrl: string | null;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      {/* Wiki source + category badges */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <span
          className={cn(
            "rounded-md border px-3 py-1 text-sm font-bold",
            card.wikiSource === "ixwiki"
              ? "border-blue-400/50 bg-blue-600/80 text-white"
              : card.wikiSource === "iiwiki"
                ? "border-green-400/50 bg-green-600/80 text-white"
                : "border-gray-400/50 bg-gray-600/80 text-white"
          )}
        >
          {card.wikiSource === "ixwiki"
            ? "IxWiki"
            : card.wikiSource === "iiwiki"
              ? "IIWiki"
              : "Wiki"}
        </span>
        {(() => {
          const meta = card.metadata as Record<string, unknown> | null | undefined;
          const category = meta?.category;
          return category ? (
            <span className="rounded-md border border-purple-500/30 bg-purple-600/80 px-3 py-1 text-sm font-bold text-white">
              {String(category)}
            </span>
          ) : null;
        })()}
      </div>

      {/* Wiki article excerpt (full paragraphs) */}
      <LoreWikiExcerpt card={card} wikiUrl={wikiUrl} />

      {/* Lore-specific historical metrics */}
      {(() => {
        const meta = card.metadata as Record<string, unknown> | undefined;
        const loreStats = meta?.loreStats as
          | { historicalSignificance?: number; culturalImpact?: number }
          | undefined;
        if (!loreStats) return null;
        return (
          <div className="glass-hierarchy-child mb-4 rounded-lg p-4">
            <h4 className="text-foreground mb-3 text-sm font-semibold">
              Historical Metrics
            </h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-muted-foreground text-xs">
                  Historical Significance
                </div>
                <div className="text-xl font-bold text-amber-500 dark:text-amber-400">
                  {loreStats.historicalSignificance ?? 0}/100
                </div>
              </div>
              <div>
                <div className="text-muted-foreground text-xs">Cultural Impact</div>
                <div className="text-xl font-bold text-purple-500 dark:text-purple-400">
                  {loreStats.culturalImpact ?? 0}/100
                </div>
              </div>
            </div>
            {meta?.qualityScore != null && (
              <div className="text-muted-foreground/60 mt-3 text-xs">
                Article Quality Score: {Math.round(Number(meta.qualityScore))}/100
              </div>
            )}
          </div>
        );
      })()}

      {/* Forum discussions */}
      <LoreForumSection articleTitle={card.wikiArticleTitle || card.title} />
    </motion.div>
  );
}
