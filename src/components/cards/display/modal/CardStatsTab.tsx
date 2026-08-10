"use client";

import React from "react";
import { motion } from "motion/react";
import { Star, Sparkles } from "lucide-react";
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
      transition={{ duration: 0.3 }}
      className="glass-hierarchy-child rounded-lg p-6"
    >
      <h3 className="text-foreground mb-2 flex items-center gap-2 text-lg font-semibold">
        <Star className="h-5 w-5" />
        Detailed Statistics
      </h3>
      {card.level > 1 && (
        <p className="text-muted-foreground/70 mb-6 text-xs">
          Level {card.level} boost applied: +{stats.totalBoost} to all stats
        </p>
      )}

      <div className="space-y-6">
        {Object.entries(stats.base).map(([key, stat]) => (
          <div key={key} className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="text-muted-foreground text-sm">{stat.def.label}</div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold" style={{ color: stat.def.color }}>
                  {stat.value}
                </span>
                <span className="text-muted-foreground/50 text-sm">/100</span>
              </div>
            </div>
            {/* Progress bar */}
            <div className="bg-muted/20 h-3 w-full overflow-hidden rounded-full">
              <motion.div
                className="h-full rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${stat.value}%` }}
                transition={{ duration: 0.8, delay: 0.2 }}
                style={{ backgroundColor: stat.def.color }}
              />
            </div>
            {/* Base + Bonus breakdown */}
            {stat.bonus > 0 && (
              <div className="flex items-center gap-3 text-xs">
                <span className="text-muted-foreground/60">
                  Base: <span className="text-foreground/70">{stat.baseValue}</span>
                </span>
                <span className="text-muted-foreground/40">+</span>
                <span className="text-amber-500 dark:text-amber-400">
                  Level bonus: +{stat.bonus}
                </span>
              </div>
            )}
            {/* Stat description */}
            <p className="text-muted-foreground/75 text-xs">{stat.def.description}</p>
          </div>
        ))}
      </div>

      {/* Special Stats */}
      {stats.specials.length > 0 && (
        <div className="mt-8 space-y-4">
          <h4 className="text-foreground flex items-center gap-2 text-base font-semibold">
            <Sparkles className="h-4 w-4" />
            Special Stats
          </h4>
          <div className="space-y-4">
            {stats.specials.map((special) => (
              <div key={special.def.key} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="text-muted-foreground text-sm">{special.def.label}</div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-xl font-bold" style={{ color: special.def.color }}>
                      {special.rawValue === 0 ? "—" : special.formattedRaw}
                    </span>
                  </div>
                </div>
                {typeof special.normalizedValue === "number" && special.normalizedValue > 0 && (
                  <div className="bg-muted/20 h-2 w-full overflow-hidden rounded-full">
                    <motion.div
                      className="h-full rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${special.normalizedValue}%` }}
                      transition={{ duration: 0.8, delay: 0.3 }}
                      style={{ backgroundColor: special.def.color }}
                    />
                  </div>
                )}
                <p className="text-muted-foreground/75 text-xs">{special.def.description}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
}
