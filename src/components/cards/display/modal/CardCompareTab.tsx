"use client";

import { springSmooth } from "~/lib/design/motion";
import React from "react";
import { motion } from "motion/react";
import type { CardInstance, FormattedStats } from "~/types/cards-display";

export function CardCompareTab({
  card,
  comparisonCard,
  stats,
  comparisonStats,
}: {
  card: CardInstance;
  comparisonCard: CardInstance;
  stats: FormattedStats;
  comparisonStats: FormattedStats;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={springSmooth}
    >
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* Original card */}
        <div className="bg-surface-secondary border-separator rounded-control border p-4">
          <h4 className="text-label text-headline mb-4">{card.title}</h4>
          <div className="space-y-3">
            {Object.entries(stats.base).map(([key, stat]) => (
              <div key={key}>
                <div className="text-label-secondary text-footnote">{stat.def.label}</div>
                <div className="text-title-1" style={{ color: stat.def.color }}>
                  {stat.value}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Comparison card */}
        <div className="bg-surface-secondary border-separator rounded-control border p-4">
          <h4 className="text-label text-headline mb-4">{comparisonCard.title}</h4>
          <div className="space-y-3">
            {Object.entries(comparisonStats.base).map(([key, stat]) => (
              <div key={key}>
                <div className="text-label-secondary text-footnote">{stat.def.label}</div>
                <div className="text-title-1" style={{ color: stat.def.color }}>
                  {stat.value}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
