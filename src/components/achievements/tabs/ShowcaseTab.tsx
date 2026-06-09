"use client";

import React from "react";

import { TextureCard, TextureCardContent } from "~/components/ui/texture-card";
import { CutoutCard, cutoutCardSurfaceClassName } from "~/components/ui/cutout-card";
import { Badge } from "~/components/ui/badge";
import { Trophy } from "lucide-react";
import { cn } from "~/lib/utils";
import { getRarityColor, getRarityBg } from "../constants";
import { createUrl } from "~/lib/url-utils";

interface ShowcaseTabProps {
  achievements: any[] | undefined;
}

export function ShowcaseTab({ achievements }: ShowcaseTabProps) {
  const rarestShowcase = achievements
    ?.filter((a) => a.isUnlocked)
    .sort((a, b) => (a.globalUnlockPercent || 100) - (b.globalUnlockPercent || 100))
    .slice(0, 12);

  return (
    <div className="space-y-6">


      {rarestShowcase && rarestShowcase.length > 0 ? (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {rarestShowcase.map((achievement) => {
            const isUnlocked = achievement.isUnlocked;

            let count = 0;
            if (achievement.metadata) {
              try {
                const parsed = typeof achievement.metadata === "string" ? JSON.parse(achievement.metadata) : achievement.metadata;
                count = parsed.count || 0;
              } catch (e) {
                // ignore
              }
            }

            return (
              <CutoutCard
                key={achievement.key}
                className={cn(
                  cutoutCardSurfaceClassName,
                  "border-border/50 bg-card/65 relative overflow-hidden rounded-2xl p-5 backdrop-blur-md transition-all duration-300 hover:-translate-y-1.5 hover:border-amber-500/40 hover:shadow-2xl"
                )}
                texture="horizontalLines"
                textureOpacity={0.03}
                trackPointerHover={false}
              >
                {/* Shimmer overlay based on Rarity */}
                {achievement.rarity === "Legendary" && (
                  <div className="pointer-events-none absolute -inset-px rounded-2xl bg-gradient-to-r from-amber-500 to-yellow-500 opacity-10 blur-xl transition duration-500 group-hover:opacity-20" />
                )}
                {achievement.rarity === "Epic" && (
                  <div className="pointer-events-none absolute -inset-px rounded-2xl bg-gradient-to-r from-purple-500 to-pink-500 opacity-10 blur-xl transition duration-500 group-hover:opacity-20" />
                )}

                <div className="relative z-10 mb-4 flex items-center justify-between">
                  <Badge
                    className={cn(
                      "px-2 py-0.5 text-[8px] font-bold tracking-wider uppercase",
                      getRarityColor(achievement.rarity),
                      getRarityBg(achievement.rarity, isUnlocked)
                    )}
                  >
                    {achievement.rarity}
                  </Badge>
                  <div className="text-[10px] font-bold tracking-wider text-amber-600 uppercase dark:text-amber-400">
                    {achievement.globalUnlockPercent !== undefined
                      ? `${achievement.globalUnlockPercent}% Unlocked`
                      : "Rare unlock"}
                  </div>
                </div>

                <div className="relative z-10 mb-4 flex flex-col items-center space-y-3 text-center">
                  <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl border border-amber-500/30 bg-amber-500/10 text-3xl shadow-inner transition duration-300 select-none group-hover:scale-110">
                    {achievement.iconUrl?.startsWith("http") || achievement.iconUrl?.startsWith("/") ? (
                      <img
                        src={achievement.iconUrl?.startsWith("/") ? createUrl(achievement.iconUrl) : achievement.iconUrl}
                        alt={achievement.title}
                        className="h-10 w-10 object-contain"
                      />
                    ) : (
                      achievement.iconUrl
                    )}
                    {isUnlocked && count > 1 && (
                      <span className="absolute -top-1.5 -right-1.5 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-amber-500 px-1.5 text-[10px] font-black text-black border border-background shadow-md">
                        {count}
                      </span>
                    )}
                  </div>
                  <div>
                    <h3 className="text-foreground text-base leading-tight font-bold transition-colors duration-300 group-hover:text-amber-500">
                      {achievement.title}
                    </h3>
                    <span className="text-muted-foreground mt-1 block text-[9px] font-bold tracking-widest uppercase">
                      {achievement.category}
                    </span>
                  </div>
                </div>

                <p className="text-muted-foreground relative z-10 mb-4 min-h-[44px] text-center text-xs leading-relaxed">
                  {achievement.description}
                </p>

                <div className="border-border/40 text-muted-foreground relative z-10 mt-auto flex items-center justify-between border-t pt-3 text-[10px] dark:border-white/5">
                  <div className="flex items-center gap-1 rounded-md border border-green-500/20 bg-green-500/10 px-2 py-0.5 font-bold text-green-600 dark:text-green-400">
                    <span>+{achievement.points}</span>
                    <span>pts</span>
                  </div>
                  {achievement.unlockedAt && (
                    <span>Unlocked {new Date(achievement.unlockedAt).toLocaleDateString()}</span>
                  )}
                </div>
              </CutoutCard>
            );
          })}
        </div>
      ) : (
        <TextureCard className="border-border/50 bg-black/5 dark:bg-black/25">
          <TextureCardContent className="py-12">
            <div className="space-y-4 text-center">
              <Trophy className="text-muted-foreground/20 mx-auto h-16 w-16" />
              <div>
                <h3 className="text-foreground mb-2 text-lg font-bold">Showcase Cabinet Empty</h3>
                <p className="text-muted-foreground text-sm">
                  Unlock rarest achievement badges to populate this showcase shelf!
                </p>
              </div>
            </div>
          </TextureCardContent>
        </TextureCard>
      )}
    </div>
  );
}
