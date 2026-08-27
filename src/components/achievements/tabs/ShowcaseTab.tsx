"use client";

import React, { useState } from "react";
import { motion } from "motion/react";
import { Trophy, Sparks as Sparkles } from "iconoir-react";
import { cn, createUrl } from "~/lib/utils";
import { Badge } from "~/components/ui/badge";
import { TextureOverlay } from "~/components/ui/texture-overlay";
import {
  getRarityColor,
  getRarityBg,
  getAchievementGameIconPath,
  getCategoryTheme,
} from "../constants";
import { JewelAchievementIcon, AchievementCardBackdrop } from "../AchievementDecorations";

interface ShowcaseTabProps {
  achievements: any[] | undefined;
}

export function ShowcaseTab({ achievements }: ShowcaseTabProps) {
  const [showAll, setShowAll] = useState(false);

  const rarestAll = achievements
    ?.filter((a) => a.isUnlocked)
    .sort((a, b) => (a.globalUnlockPercent || 100) - (b.globalUnlockPercent || 100));

  const rarestShowcase = rarestAll?.slice(0, showAll ? 9 : 3);

  return (
    <div className="space-y-3">
      {/* Shelf Title */}
      <div className="border-border/50 flex items-center justify-between border-b pb-2">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-amber-500 drop-shadow-[0_0_8px_rgba(245,158,11,0.4)] dark:text-amber-400" />
          <h3 className="text-foreground text-xs font-extrabold tracking-wider uppercase">
            Rare Achievements Showcase
          </h3>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-muted-foreground font-mono text-[10px] font-bold">
            {rarestShowcase?.length || 0} / {Math.min(rarestAll?.length || 0, 9)} Displayed
          </span>

          {(rarestAll?.length || 0) > 3 && (
            <button
              onClick={() => setShowAll(!showAll)}
              className="border-border/60 bg-muted/50 text-foreground/80 hover:bg-muted/80 hover:text-foreground rounded-full border px-3 py-1 font-mono text-[10px] font-bold backdrop-blur-md transition-all active:scale-95"
            >
              {showAll ? "Show Top 3 Only" : "See All Top 9"}
            </button>
          )}
        </div>
      </div>

      {rarestShowcase && rarestShowcase.length > 0 ? (
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 md:grid-cols-3">
          {rarestShowcase.map((achievement, idx) => {
            const isUnlocked = achievement.isUnlocked;
            const categoryTheme = getCategoryTheme(achievement.category);
            const CategoryIcon = categoryTheme.icon;
            const rawIconPath = getAchievementGameIconPath(achievement.key, achievement.category);
            const iconPath = createUrl(rawIconPath);
            const isLegendaryOrEpic =
              achievement.rarity === "Legendary" || achievement.rarity === "Epic";

            let count = 0;
            if (achievement.metadata) {
              try {
                const parsed =
                  typeof achievement.metadata === "string"
                    ? JSON.parse(achievement.metadata)
                    : achievement.metadata;
                count = parsed.count || 0;
              } catch {
                // ignore
              }
            }

            return (
              <motion.div
                key={achievement.key}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  duration: 0.25,
                  delay: Math.min(idx * 0.02, 0.2),
                  ease: [0.23, 1, 0.32, 1],
                }}
                whileHover={{ y: -3, scale: 1.015 }}
                whileTap={{ scale: 0.98 }}
                className={cn(
                  "group border-border/60 bg-card/75 dark:border-border/40 dark:bg-card/60 relative flex flex-col justify-between overflow-hidden rounded-2xl border border-t-white/15 p-4 shadow-xl backdrop-blur-2xl transition-all hover:shadow-2xl dark:border-t-white/10",
                  categoryTheme.cardBorderHover
                )}
              >
                {/* Unified Aurora & Watermark Backdrop */}
                <AchievementCardBackdrop
                  iconPath={iconPath}
                  categoryTheme={categoryTheme}
                  isUnlocked={!!isUnlocked}
                  isLegendaryOrEpic={isLegendaryOrEpic}
                />

                <div className="relative z-10">
                  <div className="mb-2 flex items-center justify-between">
                    <Badge
                      className={cn(
                        "rounded-full border px-2 py-0.5 text-[8px] font-extrabold tracking-wider uppercase backdrop-blur-md",
                        getRarityColor(achievement.rarity),
                        getRarityBg(achievement.rarity, isUnlocked)
                      )}
                    >
                      {achievement.rarity}
                    </Badge>
                    <span className="font-mono text-[9px] font-bold text-amber-600 drop-shadow-sm dark:text-amber-400">
                      {achievement.globalUnlockPercent !== undefined
                        ? `${achievement.globalUnlockPercent}% Unlocked`
                        : "Rare unlock"}
                    </span>
                  </div>

                  <div className="mb-2 flex items-center gap-3">
                    <div
                      className={cn(
                        "relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border shadow-inner backdrop-blur-md transition-transform duration-300 select-none group-hover:scale-105",
                        categoryTheme.pedestal
                      )}
                    >
                      <JewelAchievementIcon
                        iconPath={iconPath}
                        categoryTheme={categoryTheme}
                        isUnlocked={!!isUnlocked}
                        className="h-6.5 w-6.5"
                      />
                      {isUnlocked && count > 1 && (
                        <span className="absolute -top-1 -right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full border border-amber-500/40 bg-amber-400 px-1 text-[9px] font-bold text-slate-950 tabular-nums shadow-md">
                          {count}
                        </span>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <h3 className="text-foreground truncate text-xs font-extrabold tracking-tight">
                        {achievement.title}
                      </h3>
                      <span
                        className={cn(
                          "py-0.2 inline-flex items-center gap-0.5 rounded-full border px-1.5 text-[8px] font-bold uppercase backdrop-blur-md",
                          categoryTheme.badge
                        )}
                      >
                        <CategoryIcon className="h-2 w-2" />
                        <span>{achievement.category}</span>
                      </span>
                    </div>
                  </div>

                  <p className="text-muted-foreground line-clamp-2 text-[11px] leading-snug font-medium">
                    {achievement.description}
                  </p>
                </div>

                <div className="border-border/40 relative z-10 mt-3 flex items-center justify-between border-t pt-2 text-[10px]">
                  <div className="flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 font-mono text-[9px] font-bold text-emerald-600 backdrop-blur-md dark:text-emerald-400">
                    <span>{achievement.points}</span>
                    <span>pts</span>
                  </div>
                  {achievement.unlockedAt && (
                    <span className="text-muted-foreground font-mono text-[9px]">
                      {new Date(achievement.unlockedAt).toLocaleDateString()}
                    </span>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      ) : (
        <div className="border-border/60 bg-card/75 dark:border-border/40 dark:bg-card/60 relative overflow-hidden rounded-2xl border border-t-white/15 p-8 text-center shadow-xl backdrop-blur-2xl">
          <TextureOverlay texture="dots" opacity={0.03} />
          <div className="relative z-10 mx-auto max-w-sm space-y-2">
            <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-600 shadow-md backdrop-blur-md dark:text-amber-400">
              <Trophy className="h-5 w-5 text-amber-500 dark:text-amber-400" />
            </div>
            <h3 className="text-foreground text-xs font-bold">Showcase Cabinet Empty</h3>
            <p className="text-muted-foreground text-[11px] leading-relaxed">
              Unlock rarest achievement badges to populate your showcase shelf!
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
