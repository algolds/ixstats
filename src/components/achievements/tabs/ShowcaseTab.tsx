"use client";

import { motion } from "motion/react";

import React, { useState } from "react";
import { Trophy, Sparks as Sparkles } from "iconoir-react";
import { cn, createUrl } from "~/lib/utils";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { EmptyState } from "~/components/ui/empty-state";
import { springSmooth } from "~/lib/design/motion";
import { getRarityBadgeVariant, getAchievementGameIconPath, getCategoryTheme } from "../constants";
import { JewelAchievementIcon, AchievementCardBackdrop } from "../AchievementDecorations";
import { Card } from "~/components/ui/card";

const MotionCard = motion.create(Card);

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
    <section aria-labelledby="rare-showcase-title" className="space-y-3">
      {/* Shelf title */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Sparkles aria-hidden className="text-label-secondary size-4" />
          <h2 id="rare-showcase-title" className="text-title-3 text-label">
            Rare achievements showcase
          </h2>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-label-secondary text-footnote">
            <span className="font-data tabular-nums">
              {rarestShowcase?.length || 0} / {Math.min(rarestAll?.length || 0, 9)}
            </span>{" "}
            displayed
          </span>

          {(rarestAll?.length || 0) > 3 && (
            <Button
              variant="secondary"
              size="sm"
              className="rounded-full"
              aria-expanded={showAll}
              onClick={() => setShowAll(!showAll)}
            >
              {showAll ? "Show top 3 only" : "See all top 9"}
            </Button>
          )}
        </div>
      </div>

      {rarestShowcase && rarestShowcase.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
          {rarestShowcase.map((achievement, idx) => {
            const isUnlocked = achievement.isUnlocked;
            const categoryTheme = getCategoryTheme(achievement.category);
            const CategoryIcon = categoryTheme.icon;
            const rawIconPath = getAchievementGameIconPath(achievement.key, achievement.category);
            const iconPath = createUrl(rawIconPath);

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
              <MotionCard
                key={achievement.key}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ ...springSmooth, delay: Math.min(idx * 0.02, 0.2) }}
                // v2 showcase: glass cabinet cards that lift on hover, with the full backdrop.
                variant="hero"
                className={cn(
                  "flex flex-col justify-between overflow-hidden p-4",
                  categoryTheme.cardBorderHover
                )}
              >
                <AchievementCardBackdrop
                  iconPath={iconPath}
                  categoryTheme={categoryTheme}
                  isUnlocked={!!isUnlocked}
                  isLegendaryOrEpic={
                    achievement.rarity === "Legendary" || achievement.rarity === "Epic"
                  }
                />

                <div className="relative">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <Badge variant={getRarityBadgeVariant(achievement.rarity, isUnlocked)}>
                      {achievement.rarity}
                    </Badge>
                    <span className="text-label-secondary text-footnote font-data tabular-nums">
                      {achievement.globalUnlockPercent !== undefined
                        ? `${achievement.globalUnlockPercent}% unlocked`
                        : "Rare unlock"}
                    </span>
                  </div>

                  <div className="mb-2 flex items-center gap-3">
                    <div
                      className={cn(
                        "rounded-row relative flex size-11 shrink-0 items-center justify-center select-none",
                        categoryTheme.pedestal
                      )}
                    >
                      <JewelAchievementIcon
                        iconPath={iconPath}
                        categoryTheme={categoryTheme}
                        isUnlocked={!!isUnlocked}
                        className="size-6.5"
                      />
                      {isUnlocked && count > 1 && (
                        <Badge
                          variant="warning"
                          className="bg-surface absolute -top-2 -right-2 tabular-nums"
                        >
                          {count}
                        </Badge>
                      )}
                    </div>

                    <div className="min-w-0 flex-1 space-y-1">
                      <h3 className="text-label text-headline truncate">{achievement.title}</h3>
                      <Badge variant={categoryTheme.badgeVariant}>
                        <CategoryIcon aria-hidden />
                        <span>{achievement.category}</span>
                      </Badge>
                    </div>
                  </div>

                  <p className="text-label-secondary text-footnote line-clamp-2">
                    {achievement.description}
                  </p>
                </div>

                <div className="border-separator relative mt-3 flex items-center justify-between border-t pt-2">
                  <Badge variant="success">{achievement.points} pts</Badge>
                  {achievement.unlockedAt && (
                    <span className="text-label-secondary text-footnote font-data tabular-nums">
                      {new Date(achievement.unlockedAt).toLocaleDateString()}
                    </span>
                  )}
                </div>
              </MotionCard>
            );
          })}
        </div>
      ) : (
        <Card>
          <EmptyState
            icon={<Trophy />}
            title="Showcase cabinet empty"
            message="Unlock the rarest achievements to fill your showcase shelf."
          />
        </Card>
      )}
    </section>
  );
}
