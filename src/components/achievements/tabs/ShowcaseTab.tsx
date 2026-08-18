"use client";

import React, { useState } from "react";
import { motion } from "motion/react";
import { Trophy, Sparkles } from "lucide-react";
import { cn } from "~/lib/utils";
import { Badge } from "~/components/ui/badge";
import { TextureOverlay } from "~/components/ui/texture-overlay";
import { getRarityColor, getRarityBg } from "../constants";
import { createUrl } from "~/lib/utils";

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
      <div className="flex items-center justify-between border-b border-white/10 pb-2">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-amber-400 drop-shadow-[0_0_8px_rgba(245,158,11,0.4)]" />
          <h3 className="text-xs font-extrabold tracking-wider text-slate-200 uppercase">
            Rare Achievements Showcase
          </h3>
        </div>

        <div className="flex items-center gap-2">
          <span className="font-mono text-[10px] font-bold text-slate-400">
            {rarestShowcase?.length || 0} / {Math.min(rarestAll?.length || 0, 9)} Displayed
          </span>

          {(rarestAll?.length || 0) > 3 && (
            <button
              onClick={() => setShowAll(!showAll)}
              className="rounded-full border border-white/10 bg-white/5 px-3 py-1 font-mono text-[10px] font-bold text-slate-300 transition-all hover:bg-white/10 hover:text-white active:scale-95 backdrop-blur-md"
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

            let count = 0;
            if (achievement.metadata) {
              try {
                const parsed =
                  typeof achievement.metadata === "string"
                    ? JSON.parse(achievement.metadata)
                    : achievement.metadata;
                count = parsed.count || 0;
              } catch (e) {
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
                  delay: Math.min(idx * 0.03, 0.25),
                  ease: [0.23, 1, 0.32, 1],
                }}
                whileHover={{ y: -3, scale: 1.015 }}
                whileTap={{ scale: 0.98 }}
                className={cn(
                  "relative flex flex-col justify-between overflow-hidden rounded-2xl border border-white/10 bg-slate-950/70 p-3.5 shadow-xl backdrop-blur-2xl transition-all border-t-white/20 dark:bg-black/60 dark:border-white/12 dark:border-t-white/25 hover:border-amber-500/30 hover:shadow-amber-500/10"
                )}
              >
                <TextureOverlay texture="dots" opacity={0.03} />

                {/* Shimmer overlay based on Rarity */}
                {achievement.rarity === "Legendary" && (
                  <div className="pointer-events-none absolute -inset-px rounded-2xl bg-gradient-to-r from-amber-500/20 to-yellow-500/20 opacity-30 blur-xl" />
                )}
                {achievement.rarity === "Epic" && (
                  <div className="pointer-events-none absolute -inset-px rounded-2xl bg-gradient-to-r from-purple-500/20 to-pink-500/20 opacity-30 blur-xl" />
                )}

                <div className="relative z-10">
                  <div className="mb-2 flex items-center justify-between">
                    <Badge
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[8px] font-extrabold tracking-wider uppercase backdrop-blur-md border border-white/10",
                        getRarityColor(achievement.rarity),
                        getRarityBg(achievement.rarity, isUnlocked)
                      )}
                    >
                      {achievement.rarity}
                    </Badge>
                    <span className="font-mono text-[9px] font-bold text-amber-400/90 drop-shadow-[0_0_8px_rgba(245,158,11,0.2)]">
                      {achievement.globalUnlockPercent !== undefined
                        ? `${achievement.globalUnlockPercent}% Unlocked`
                        : "Rare unlock"}
                    </span>
                  </div>

                  <div className="mb-2 flex items-center gap-3">
                    <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/15 bg-white/5 text-lg shadow-inner backdrop-blur-md transition-transform duration-300 select-none group-hover:scale-105">
                      {achievement.iconUrl?.startsWith("http") ||
                      achievement.iconUrl?.startsWith("/") ? (
                        <img
                          src={
                            achievement.iconUrl?.startsWith("/")
                              ? createUrl(achievement.iconUrl)
                              : achievement.iconUrl
                          }
                          alt={achievement.title}
                          className="h-5 w-5 object-contain drop-shadow-md"
                        />
                      ) : (
                        achievement.iconUrl
                      )}
                      {isUnlocked && count > 1 && (
                        <span className="absolute -top-1 -right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full border border-amber-300/40 bg-amber-400 px-1 text-[9px] font-black text-slate-950 shadow-md">
                          {count}
                        </span>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <h3 className="truncate text-xs font-bold text-slate-100 tracking-tight">
                        {achievement.title}
                      </h3>
                      <span className="block text-[8px] font-extrabold tracking-widest text-slate-400 uppercase">
                        {achievement.category}
                      </span>
                    </div>
                  </div>

                  <p className="line-clamp-2 text-[11px] leading-snug text-slate-300/90">
                    {achievement.description}
                  </p>
                </div>

                <div className="relative z-10 mt-3 flex items-center justify-between border-t border-white/10 pt-2 text-[10px]">
                  <div className="flex items-center gap-1 rounded-full border border-green-500/30 bg-green-500/15 px-2 py-0.5 text-[9px] font-bold text-green-400 backdrop-blur-md">
                    <span>+{achievement.points}</span>
                    <span>pts</span>
                  </div>
                  {achievement.unlockedAt && (
                    <span className="font-mono text-[9px] text-slate-400">
                      {new Date(achievement.unlockedAt).toLocaleDateString()}
                    </span>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      ) : (
        <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-slate-950/70 p-8 text-center shadow-xl backdrop-blur-2xl border-t-white/20 dark:bg-black/60 dark:border-white/12">
          <TextureOverlay texture="dots" opacity={0.03} />
          <div className="relative z-10 max-w-sm mx-auto space-y-2">
            <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-400 shadow-md backdrop-blur-md">
              <Trophy className="h-5 w-5 text-amber-400" />
            </div>
            <h3 className="text-xs font-bold text-slate-100">Showcase Cabinet Empty</h3>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Unlock rarest achievement badges to populate your showcase shelf!
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
