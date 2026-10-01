"use client";

import { springSmooth } from "~/lib/design/motion";
import React from "react";
import { motion } from "motion/react";
import { Star, Flash as Zap } from "iconoir-react";
import type { CardInstance, FormattedStats } from "~/types/cards-display";

export interface CardStatsTabProps {
  card: CardInstance;
  stats: FormattedStats;
}

export function CardStatsTab({ card, stats }: CardStatsTabProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={springSmooth}
      className="bg-surface-secondary border-separator rounded-control border p-6"
    >
      <h3 className="text-label text-title-3 mb-2 flex items-center gap-2 font-semibold">
        <Star className="h-5 w-5" />
        Detailed Statistics
      </h3>
      {card.level > 1 && (
        <p className="text-label-tertiary text-footnote mb-6">
          Level {card.level} boost applied: +{stats.totalBoost} to all stats
        </p>
      )}

      <div className="space-y-6">
        {Object.entries(stats.base).map(([key, stat]) => (
          <div key={key} className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="text-label-secondary text-body">{stat.def.label}</div>
              <div className="flex items-baseline gap-2">
                <span className="text-large-title" style={{ color: stat.def.color }}>
                  {stat.value}
                </span>
                <span className="text-label-tertiary text-body">/100</span>
              </div>
            </div>
            {/* Progress bar */}
            <div className="bg-fill-4 h-3 w-full overflow-hidden rounded-full">
              <motion.div
                className="h-full rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${stat.value}%` }}
                transition={{ ...springSmooth, delay: 0.2 }}
                style={{ backgroundColor: stat.def.color }}
              />
            </div>
            {/* Base + Bonus breakdown */}
            {stat.bonus > 0 && (
              <div className="text-footnote flex items-center gap-3">
                <span className="text-label-tertiary">
                  Base: <span className="text-label">{stat.baseValue}</span>
                </span>
                <span className="text-label-tertiary">+</span>
                <span className="text-yellow">Level bonus: +{stat.bonus}</span>
              </div>
            )}
            {/* Stat description */}
            <p className="text-label-secondary text-footnote">{stat.def.description}</p>
          </div>
        ))}
      </div>

      {/* Special Stats */}
      {stats.specials.length > 0 && (
        <div className="mt-8 space-y-4">
          <h4 className="text-label text-headline flex items-center gap-2">
            <Zap className="text-yellow h-4 w-4" />
            Special Stats
          </h4>
          <div className="space-y-4">
            {stats.specials.map((special) => (
              <div key={special.def.key} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="text-label-secondary text-body">{special.def.label}</div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-title-2" style={{ color: special.def.color }}>
                      {special.rawValue === 0 ? "—" : special.formattedRaw}
                    </span>
                  </div>
                </div>
                {typeof special.normalizedValue === "number" && special.normalizedValue > 0 && (
                  <div className="bg-fill-4 h-2 w-full overflow-hidden rounded-full">
                    <motion.div
                      className="h-full rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${special.normalizedValue}%` }}
                      transition={{ ...springSmooth, delay: 0.3 }}
                      style={{ backgroundColor: special.def.color }}
                    />
                  </div>
                )}
                <p className="text-label-secondary text-footnote">{special.def.description}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
}
