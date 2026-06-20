"use client";

import React, { useState } from "react";
import { TabsContent } from "~/components/ui/tabs";
import { TextureCard, TextureCardContent } from "~/components/ui/texture-card";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Lock, Trophy } from "lucide-react";
import { cn } from "~/lib/utils";
import { categories, rarities, getRarityColor, getRarityBg } from "../constants";
import { createUrl } from "~/lib/url-utils";

interface AllAchievementsTabProps {
  achievements: any[] | undefined;
  selectedCategory: string;
  setSelectedCategory: (cat: string) => void;
}

export function AllAchievementsTab({
  achievements,
  selectedCategory,
  setSelectedCategory,
}: AllAchievementsTabProps) {
  const [selectedRarity, setSelectedRarity] = useState<string>("all");

  const filteredAchievements = achievements
    ?.filter((a) => selectedCategory === "all" || a.category === selectedCategory)
    ?.filter((a) => selectedRarity === "all" || a.rarity === selectedRarity);

  return (
    <TabsContent value="all-achievements" className="space-y-6 outline-none">
      {/* Category / Rarity Filters */}
      <TextureCard className="border-border/50 bg-black/5 dark:bg-black/25">
        <TextureCardContent className="flex flex-col items-start justify-between gap-4 p-4 lg:flex-row lg:items-center">
          <div className="flex flex-wrap gap-2">
            {categories.map((cat) => {
              const Icon = cat.icon;
              const isSelected = selectedCategory === cat.id;
              return (
                <Button
                  key={cat.id}
                  variant={isSelected ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedCategory(cat.id)}
                  className={cn(
                    "h-8 text-xs transition-all duration-200",
                    isSelected
                      ? "bg-primary text-primary-foreground font-bold shadow-md"
                      : "border-border/60 hover:bg-muted text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Icon className="mr-1.5 h-3.5 w-3.5" />
                  {cat.name}
                </Button>
              );
            })}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-muted-foreground mr-1 text-xs font-medium">Rarity:</span>
            <div className="flex flex-wrap gap-1.5">
              {rarities.map((r) => {
                const isSelected = selectedRarity === r;
                return (
                  <Button
                    key={r}
                    variant={isSelected ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSelectedRarity(r)}
                    className={cn(
                      "h-8 text-xs capitalize transition-all duration-200",
                      isSelected
                        ? "bg-primary text-primary-foreground font-bold shadow-md"
                        : "border-border/60 hover:bg-muted text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {r === "all" ? "All" : r}
                  </Button>
                );
              })}
            </div>
          </div>
        </TextureCardContent>
      </TextureCard>

      {/* Achievements list layout */}
      {filteredAchievements && filteredAchievements.length > 0 ? (
        <div className="space-y-3">
          {filteredAchievements.map((achievement) => {
            const isUnlocked = achievement.isUnlocked;
            const isSecret =
              (achievement.key.startsWith("vid-") || achievement.key.startsWith("meme-")) &&
              !isUnlocked;

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
              <div
                key={achievement.key}
                className={cn(
                  "group border-border/50 bg-card/65 hover:border-border hover:bg-card/85 relative flex flex-col items-start justify-between gap-4 overflow-hidden rounded-xl border p-4 backdrop-blur-md transition-all duration-200 sm:flex-row sm:items-center",
                  !isUnlocked && "opacity-60"
                )}
              >
                {/* Status bar */}
                {isUnlocked && <div className="absolute top-0 bottom-0 left-0 w-1 bg-green-500" />}

                <div className="flex min-w-0 flex-1 items-center gap-3.5 pl-1">
                  {/* Icon Badge */}
                  <div
                    className={cn(
                      "relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full border text-2xl shadow-inner transition-transform duration-300 select-none group-hover:scale-105",
                      isUnlocked
                        ? "border-green-500/30 bg-green-500/10 text-green-500 dark:bg-green-500/20"
                        : "bg-muted border-border/50 text-muted-foreground/30 dark:border-white/5"
                    )}
                  >
                    {isUnlocked ? (
                      achievement.iconUrl?.startsWith("http") ||
                      achievement.iconUrl?.startsWith("/") ? (
                        <img
                          src={
                            achievement.iconUrl?.startsWith("/")
                              ? createUrl(achievement.iconUrl)
                              : achievement.iconUrl
                          }
                          alt={achievement.title}
                          className="h-8 w-8 object-contain"
                        />
                      ) : (
                        achievement.iconUrl
                      )
                    ) : (
                      <Lock className="text-muted-foreground/45 h-5 w-5" />
                    )}
                    {isUnlocked && count > 1 && (
                      <span className="border-background absolute -top-1 -right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full border bg-amber-500 px-1 text-[9px] font-black text-black shadow-md">
                        {count}
                      </span>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <h4
                        className={cn(
                          "text-sm font-bold tracking-tight",
                          isUnlocked ? "text-foreground" : "text-muted-foreground"
                        )}
                      >
                        {isSecret ? "Secret Achievement" : achievement.title}
                      </h4>
                      <Badge
                        variant="outline"
                        className={cn(
                          "px-1.5 py-0.5 text-[8px] leading-none font-bold tracking-wider uppercase",
                          getRarityColor(achievement.rarity),
                          getRarityBg(achievement.rarity, isUnlocked)
                        )}
                      >
                        {achievement.rarity}
                      </Badge>
                      <span className="text-muted-foreground/50 text-[10px] font-semibold tracking-widest uppercase">
                        {achievement.category}
                      </span>
                    </div>
                    <p className="text-muted-foreground mt-0.5 max-w-xl truncate text-xs">
                      {isSecret
                        ? "Keep playing to unlock this secret achievement challenge."
                        : achievement.description}
                    </p>
                  </div>
                </div>

                {/* Right side stats */}
                <div className="border-border/30 mt-2 flex w-full shrink-0 items-center justify-end gap-4 border-t pt-2.5 sm:mt-0 sm:w-auto sm:border-t-0 sm:pt-0">
                  {/* Unlock rate */}
                  <div className="flex flex-col justify-center text-right">
                    <span className="text-muted-foreground/60 text-[9px] leading-none font-bold tracking-wider uppercase">
                      Unlock Rate
                    </span>
                    <span className="text-foreground mt-0.5 font-mono text-xs font-bold">
                      {achievement.globalUnlockPercent !== undefined
                        ? `${achievement.globalUnlockPercent}%`
                        : "—"}
                    </span>
                  </div>

                  {/* Points value */}
                  <div className="flex items-center gap-1.5 rounded-lg border border-green-500/20 bg-green-500/10 px-3 py-1 text-xs font-extrabold text-green-600 select-none dark:text-green-400">
                    <span>{achievement.points}</span>
                    <span className="text-[9px] font-semibold tracking-wide text-green-500/70 uppercase">
                      pts
                    </span>
                  </div>

                  {/* Date details */}
                  <div className="text-muted-foreground w-20 text-right text-[10px]">
                    {isUnlocked && achievement.unlockedAt ? (
                      <>
                        <span className="block text-[8px] font-medium tracking-wider uppercase opacity-60">
                          Unlocked
                        </span>
                        <span className="mt-0.5 block font-semibold">
                          {new Date(achievement.unlockedAt).toLocaleDateString()}
                        </span>
                      </>
                    ) : (
                      <span className="italic opacity-40">Locked</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <TextureCard className="border-border/50 bg-black/5 dark:bg-black/25">
          <TextureCardContent className="py-12">
            <div className="space-y-4 text-center">
              <Trophy className="text-muted-foreground/20 mx-auto h-16 w-16" />
              <div>
                <h3 className="text-foreground mb-2 text-lg font-bold">No Matching Achievements</h3>
                <p className="text-muted-foreground text-sm">
                  Try adjusting your category or rarity filters.
                </p>
              </div>
            </div>
          </TextureCardContent>
        </TextureCard>
      )}
    </TabsContent>
  );
}
