"use client";

import React, { useState } from "react";
import { motion } from "motion/react";
import { cn, createUrl } from "~/lib/utils";
import { Badge } from "~/components/ui/badge";
import {
  CutoutCard,
  CutoutCardContent,
  cutoutCardSurfaceClassName,
} from "~/components/ui/cutout-card";
import { Tooltip, TooltipTrigger, TooltipContent } from "~/components/ui/tooltip";
import { Lock, Crown, Layers, Package, Eye, EyeOff } from "lucide-react";
import { IxCreditsSymbol } from "~/components/vault/IxCreditsSymbol";
import { TextureOverlay } from "~/components/ui/texture-overlay";
import { getAchievementGameIconPath, getCategoryTheme } from "./constants";

interface QuestPathCardProps {
  path: {
    name: string;
    description: string;
    icon: React.ComponentType<any>;
    badgeColor: string;
    glowColor: string;
    lineColor: string;
    activeLineColor: string;
    nodeColor: string;
    keys: string[];
  };
  achievements: any[] | undefined;
  getRarityColor: (rarity: string) => string;
  getRarityBg: (rarity: string, isUnlocked?: boolean) => string;
}

export function QuestPathCard({
  path,
  achievements,
  getRarityColor,
  getRarityBg,
}: QuestPathCardProps) {
  const PathIcon = path.icon;
  // Gather path achievements
  const pathAchievements = path.keys
    .map((key) => achievements?.find((a) => a.key === key))
    .filter(Boolean) as any[];

  const unlockedCount = pathAchievements.filter((a) => a.isUnlocked).length;
  const totalCount = pathAchievements.length;
  const progressPercent = totalCount > 0 ? (unlockedCount / totalCount) * 100 : 0;

  // Track currently selected node in path card to show detail panel (prevents vertical tooltip cut-off)
  const firstUnlocked = pathAchievements.find((a) => a.isUnlocked);
  const [selectedNodeKey, setSelectedNodeKey] = useState<string | null>(
    firstUnlocked ? firstUnlocked.key : (pathAchievements[0]?.key ?? null)
  );
  const [shakingKey, setShakingKey] = useState<string | null>(null);
  const selectedNode = pathAchievements.find((a) => a.key === selectedNodeKey);

  const triggerLockedShake = (key: string) => {
    setShakingKey(key);
    setTimeout(() => setShakingKey(null), 400);
  };

  return (
    <CutoutCard
      className={cn(
        cutoutCardSurfaceClassName,
        "border-border/50 bg-card/65 relative overflow-hidden rounded-2xl shadow-lg backdrop-blur-md"
      )}
      texture="horizontalLines"
      textureOpacity={0.03}
      trackPointerHover={false}
    >
      <CutoutCardContent className="relative z-10 p-0">
        {/* Path Header */}
        <div className="border-border/40 bg-muted/20 border-b px-6 py-4 dark:border-white/5 dark:bg-white/[0.01]">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className={cn("rounded-lg border p-2", path.badgeColor)}>
                <PathIcon className="h-5 w-5 animate-pulse" />
              </div>
              <div>
                <h3 className="text-foreground text-base font-bold">{path.name}</h3>
                <p className="text-muted-foreground text-xs">{path.description}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-lg border border-border/50 bg-muted/40 px-3 py-1.5 dark:border-white/5 dark:bg-black/40">
              <span className="text-xs font-semibold text-amber-600 dark:text-amber-400">
                {unlockedCount} / {totalCount} ({Math.round(progressPercent)}%)
              </span>
              <div className="h-1.5 w-24 overflow-hidden rounded-full bg-muted/50 dark:bg-white/10">
                <div
                  className={cn(
                    "h-full transition-all duration-500",
                    path.nodeColor === "emerald"
                      ? "bg-emerald-500"
                      : path.nodeColor === "yellow"
                        ? "bg-yellow-500"
                        : path.nodeColor === "red"
                          ? "bg-rose-500"
                          : path.nodeColor === "blue"
                            ? "bg-sky-500"
                            : path.nodeColor === "purple"
                              ? "bg-purple-500"
                              : "bg-pink-500"
                  )}
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
          </div>

          {/* Linear Nodes Scrollable Container */}
          <div className="flex items-center gap-2 overflow-x-auto py-3 pr-2 select-none scrollbar-thin scrollbar-thumb-border/40 scrollbar-track-transparent">
            {pathAchievements.map((achievement, idx) => {
              const isUnlocked = achievement.isUnlocked;
              const isSelected = selectedNodeKey === achievement.key;
              const isSecret =
                (achievement.key.startsWith("vid-") || achievement.key.startsWith("meme-")) &&
                !isUnlocked;
              const nextNode = pathAchievements[idx + 1];

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
                <React.Fragment key={achievement.key}>
                  {/* Node */}
                  <div className="group relative z-10 flex flex-col items-center gap-3">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <motion.button
                          animate={shakingKey === achievement.key ? { x: [0, -6, 6, -5, 5, -2, 2, 0] } : { x: 0 }}
                          transition={{ duration: 0.38, ease: [0.36, 0.07, 0.19, 0.97] }}
                          onClick={() => {
                            if (!isUnlocked) {
                              triggerLockedShake(achievement.key);
                              return;
                            }
                            setSelectedNodeKey(achievement.key);
                          }}
                          onMouseEnter={() => {
                            if (isUnlocked) setSelectedNodeKey(achievement.key);
                          }}
                          className={cn(
                            "relative flex h-16 w-16 items-center justify-center rounded-full border transition-all duration-300 select-none",
                            isUnlocked
                              ? "bg-card cursor-pointer border-amber-500 shadow-lg active:scale-95 dark:border-amber-400"
                              : "cursor-not-allowed border-dashed border-border/40 bg-muted/20 opacity-60 hover:border-rose-500/40",
                            isSelected && "ring-primary ring-offset-background ring-2 ring-offset-2"
                          )}
                        >
                          {isUnlocked ? (
                            <img
                              src={createUrl(getAchievementGameIconPath(achievement.key, achievement.category))}
                              alt={achievement.title}
                              className="h-9 w-9 object-contain transition duration-300 group-hover:scale-110 invert filter dark:filter-none"
                              loading="lazy"
                            />
                          ) : (
                            <div className="relative flex h-full w-full items-center justify-center">
                              <img
                                src={createUrl(getAchievementGameIconPath(achievement.key, achievement.category))}
                                alt={achievement.title}
                                className="h-7 w-7 object-contain opacity-20 blur-[1px] filter"
                                loading="lazy"
                              />
                              <Lock className="absolute h-5 w-5 text-muted-foreground/80 drop-shadow-sm" />
                            </div>
                          )}

                          {isUnlocked && count > 1 && (
                            <span className="border-background absolute -top-1 -right-1 z-20 flex h-5 min-w-[20px] items-center justify-center rounded-full border bg-amber-500 px-1 text-[10px] font-bold text-black tabular-nums shadow-md">
                              {count}
                            </span>
                          )}
                        </motion.button>
                      </TooltipTrigger>
                      <TooltipContent
                        side="top"
                        className="bg-card/95 border-border/80 text-card-foreground z-50 w-64 space-y-1.5 p-3 shadow-2xl backdrop-blur-md"
                      >
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            {isUnlocked ? (
                              <img
                                src={createUrl(getAchievementGameIconPath(achievement.key, achievement.category))}
                                alt={achievement.title}
                                className="h-5 w-5 object-contain invert filter dark:filter-none"
                                loading="lazy"
                              />
                            ) : (
                              <Lock className="text-muted-foreground/60 h-4 w-4" />
                            )}
                            <span className="text-foreground text-xs leading-none font-bold">
                              {isSecret ? "Secret Achievement" : achievement.title}
                            </span>
                            <Badge
                              variant="outline"
                              className={cn(
                                "px-1.5 py-0 text-[8px] leading-none",
                                getRarityColor(achievement.rarity),
                                getRarityBg(achievement.rarity, isUnlocked)
                              )}
                            >
                              {achievement.rarity}
                            </Badge>
                          </div>
                          <p className="text-muted-foreground text-[10px] leading-normal">
                            {isSecret
                              ? "Keep playing to unlock this secret achievement challenge."
                              : achievement.description}
                          </p>
                        </div>
                      </TooltipContent>
                    </Tooltip>

                    <span
                      className={cn(
                        "max-w-[110px] truncate text-center text-xs font-medium transition-all",
                        isUnlocked ? "text-foreground font-semibold" : "text-muted-foreground/50 blur-[0.4px]"
                      )}
                    >
                      {isSecret ? "Secret" : achievement.title}
                    </span>
                  </div>

                  {/* Connector Line */}
                  {idx < pathAchievements.length - 1 && (
                    <div className="relative z-0 h-0.5 w-10 shrink-0">
                      <div
                        className={cn(
                          "absolute inset-0 transition-all duration-300",
                          isUnlocked && nextNode?.isUnlocked
                            ? path.activeLineColor
                            : "bg-muted dark:bg-white/5"
                        )}
                      />
                    </div>
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>

        {/* Selected Node Details Panel */}
        {selectedNode && (
          <div className="border-border/40 bg-muted/10 border-t p-5 transition-all duration-300 dark:border-white/5 dark:bg-white/[0.01]">
            <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
              <div className="flex-1 space-y-1.5">
                <div className="flex flex-wrap items-center gap-2.5">
                  <img
                    src={createUrl(getAchievementGameIconPath(selectedNode.key, selectedNode.category))}
                    alt={selectedNode.title}
                    className="h-8 w-8 object-contain drop-shadow-md invert filter dark:filter-none"
                    loading="lazy"
                  />
                  <span
                    className={cn(
                      "text-sm font-bold md:text-base",
                      selectedNode.isUnlocked ? "text-foreground" : "text-muted-foreground blur-[0.4px]"
                    )}
                  >
                    {selectedNode.title}
                  </span>
                  <Badge
                    variant="outline"
                    className={cn(
                      "px-1.5 py-0 text-[9px] leading-none",
                      getRarityColor(selectedNode.rarity),
                      getRarityBg(selectedNode.rarity)
                    )}
                  >
                    {selectedNode.rarity}
                  </Badge>
                  {selectedNode.isUnlocked ? (
                    <Badge className="border-green-500/20 bg-green-500/10 px-1.5 py-0 text-[9px] leading-none text-green-600 dark:text-green-400">
                      Unlocked
                    </Badge>
                  ) : (
                    <Badge className="bg-muted text-muted-foreground/60 border-border/50 px-1.5 py-0 text-[9px] leading-none">
                      Locked
                    </Badge>
                  )}
                  <span className="text-muted-foreground/50 text-[10px] font-semibold tracking-widest uppercase">
                    {selectedNode.category}
                  </span>
                </div>
                <p
                  className={cn(
                    "text-xs leading-relaxed transition-all",
                    selectedNode.isUnlocked
                      ? "text-muted-foreground"
                      : "text-muted-foreground/60 blur-[1.5px]"
                  )}
                >
                  {selectedNode.description}
                </p>
                {selectedNode.isUnlocked && selectedNode.unlockedAt && (
                  <div className="text-muted-foreground/50 text-[10px]">
                    Unlocked on {new Date(selectedNode.unlockedAt).toLocaleDateString()}
                  </div>
                )}
              </div>

              <div className="flex w-full shrink-0 flex-col gap-2.5 border-t border-border/30 pt-3 md:w-auto md:items-end md:border-t-0 md:pt-0">
                <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-600 select-none dark:text-emerald-400">
                  <span>Value:</span>
                  <span>{selectedNode.points} pts</span>
                  {selectedNode.globalUnlockPercent !== undefined && (
                    <span className="font-normal text-muted-foreground/60">
                      ({selectedNode.globalUnlockPercent}% unlocked)
                    </span>
                  )}
                </div>

                {selectedNode.rewards && (
                  <div className="flex flex-wrap gap-1.5">
                    {selectedNode.rewards.credits > 0 && (
                      <Badge
                        variant="secondary"
                        className="border-emerald-500/20 bg-emerald-500/10 text-[9px] text-emerald-600 dark:text-emerald-400"
                      >
                        <IxCreditsSymbol className="mr-1 inline-block h-3 w-3 align-text-top" />
                        {selectedNode.rewards.credits} IxC
                      </Badge>
                    )}
                    {selectedNode.rewards.cardIds?.map((cId: string) => (
                      <Badge
                        key={cId}
                        variant="secondary"
                        className="border-blue-500/20 bg-blue-500/10 text-[9px] text-blue-600 dark:text-blue-400"
                      >
                        <Layers className="mr-1 inline-block h-3 w-3 align-text-top" />
                        Card
                      </Badge>
                    ))}
                    {selectedNode.rewards.cardPacks?.map((pId: string) => (
                      <Badge
                        key={pId}
                        variant="secondary"
                        className="border-purple-500/20 bg-purple-500/10 text-[9px] text-purple-600 dark:text-purple-400"
                      >
                        <Package className="mr-1 inline-block h-3 w-3 align-text-top" />
                        Pack
                      </Badge>
                    ))}
                    {selectedNode.rewards.titles?.map((t: string) => (
                      <Badge
                        key={t}
                        variant="secondary"
                        className="border-pink-500/20 bg-pink-500/10 text-[9px] text-pink-600 dark:text-pink-400"
                      >
                        <Crown className="mr-1 inline-block h-3 w-3 align-text-top" />
                        Title: {t}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </CutoutCardContent>
    </CutoutCard>
  );
}
