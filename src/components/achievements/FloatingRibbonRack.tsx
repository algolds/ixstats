"use client";

import React from "react";
import { motion } from "motion/react";
import { Star, ShieldCheck, Award } from "lucide-react";
import { FORUM_RIBBONS, type ForumRibbon } from "./constants";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "~/components/ui/tooltip";
import { cn } from "~/lib/utils";

interface FloatingRibbonRackProps {
  pinnedIds?: string[];
  unlockedCount?: number;
  className?: string;
  style?: React.CSSProperties;
  hasImage?: boolean;
}

export function FloatingRibbonRack({
  pinnedIds = ["wiki-archivist", "community-veteran", "forum-pioneer"],
  unlockedCount = 3,
  className,
  style,
  hasImage = true,
}: FloatingRibbonRackProps) {
  const ribbonsToDisplay = FORUM_RIBBONS.filter((r) => pinnedIds.includes(r.id)).slice(0, 3);

  if (ribbonsToDisplay.length === 0) return null;

  return (
    <TooltipProvider delayDuration={100}>
      <div
        className={cn(
          "inline-flex cursor-pointer items-center gap-1.5 drop-shadow-[0_2px_10px_rgba(0,0,0,0.7)] transition-all duration-200 select-none",
          className
        )}
        style={style}
      >
        {ribbonsToDisplay.map((ribbon, idx) => {
          const isUnlocked = unlockedCount > idx;
          return (
            <Tooltip key={ribbon.id}>
              <TooltipTrigger asChild>
                <motion.div
                  whileHover={{ scale: 1.18, y: -2 }}
                  whileTap={{ scale: 0.94 }}
                  transition={{ type: "spring", stiffness: 450, damping: 25 }}
                  className={cn(
                    "group/ribbon relative flex cursor-pointer flex-col items-center",
                    !isUnlocked && "opacity-40 grayscale"
                  )}
                >
                  {/* Frameless Vertical Ribbon Fabric Bar */}
                  <div
                    className={cn(
                      "relative flex h-5 w-4 items-center justify-center overflow-hidden rounded-xs border border-border/60 shadow-md transition-all duration-150 group-hover/ribbon:border-amber-400 group-hover/ribbon:shadow-[0_0_12px_rgba(251,191,36,0.4)]",
                      isUnlocked ? `bg-gradient-to-b ${ribbon.stripeGradient}` : "bg-muted/80"
                    )}
                  >
                    {/* Top Gold Hardware Mounting Pin */}
                    <div className="absolute inset-x-0 top-0 z-20 h-[1.5px] bg-gradient-to-r from-amber-400 via-yellow-200 to-amber-500 opacity-95" />

                    {/* Fabric Texture Moire & Specular Highlight */}
                    <div className="pointer-events-none absolute inset-0 z-10 bg-[repeating-linear-gradient(90deg,transparent,transparent_1px,rgba(0,0,0,0.25)_1px,rgba(0,0,0,0.25)_2px)]" />
                    <div className="pointer-events-none absolute inset-0 z-10 bg-gradient-to-r from-white/35 via-transparent to-black/45" />

                    {/* Center 3D Gold Star Insignia */}
                    <Star
                      className={cn(
                        "relative z-20 h-2.5 w-2.5 drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)] transition-transform duration-150 group-hover/ribbon:scale-110",
                        isUnlocked ? "fill-amber-300 text-amber-300" : "text-muted-foreground/60"
                      )}
                    />

                    {/* Bottom Gold Hardware Mounting Pin */}
                    <div className="absolute inset-x-0 bottom-0 z-20 h-[1.5px] bg-gradient-to-r from-amber-400 via-yellow-200 to-amber-500 opacity-95" />
                  </div>
                </motion.div>
              </TooltipTrigger>
              <TooltipContent
                side="bottom"
                align="center"
                sideOffset={8}
                className="z-[100] max-w-xs rounded-xl border border-amber-500/30 bg-popover/95 p-3 text-xs text-popover-foreground shadow-2xl backdrop-blur-2xl transition-all duration-200 dark:border-amber-400/35"
              >
                <div className="mb-1.5 flex items-center gap-2 border-b border-border/60 pb-1.5">
                  <Award className="h-3.5 w-3.5 shrink-0 text-amber-500 dark:text-amber-400" />
                  <span className="text-xs font-extrabold tracking-wider text-amber-600 uppercase dark:text-amber-400">
                    {ribbon.title}
                  </span>
                </div>
                <p className="mb-1.5 text-[11px] leading-snug font-medium text-muted-foreground">
                  Conferred platform honor for excellence in {ribbon.category}.
                </p>
                <div className="flex items-center justify-between border-t border-border/50 pt-1 text-[10px]">
                  <span className="font-medium text-muted-foreground">
                    Platform Honor
                  </span>
                  <span className="rounded-xs border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 font-mono font-semibold text-amber-600 dark:bg-amber-500/15 dark:text-amber-300">
                    {ribbon.badgeLabel}
                  </span>
                </div>
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    </TooltipProvider>
  );
}
