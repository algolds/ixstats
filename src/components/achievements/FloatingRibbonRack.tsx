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
          "inline-flex items-center gap-1.5 cursor-pointer select-none drop-shadow-[0_2px_10px_rgba(0,0,0,0.7)] transition-all duration-200",
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
                    "group/ribbon relative flex flex-col items-center cursor-pointer",
                    !isUnlocked && "opacity-40 grayscale"
                  )}
                >
                  {/* Frameless Vertical Ribbon Fabric Bar */}
                  <div
                    className={cn(
                      "relative flex h-5 w-4 items-center justify-center overflow-hidden rounded-xs border border-white/30 shadow-md transition-all duration-150 group-hover/ribbon:border-amber-300 group-hover/ribbon:shadow-[0_0_12px_rgba(251,191,36,0.55)]",
                      isUnlocked
                        ? `bg-gradient-to-b ${ribbon.stripeGradient}`
                        : "bg-slate-900/80"
                    )}
                  >
                    {/* Top Gold Hardware Mounting Pin */}
                    <div className="absolute top-0 inset-x-0 h-[1.5px] bg-gradient-to-r from-amber-400 via-yellow-200 to-amber-500 opacity-95 z-20" />

                    {/* Fabric Texture Moire & Specular Highlight */}
                    <div className="pointer-events-none absolute inset-0 bg-[repeating-linear-gradient(90deg,transparent,transparent_1px,rgba(0,0,0,0.25)_1px,rgba(0,0,0,0.25)_2px)] z-10" />
                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-white/35 via-transparent to-black/45 z-10" />

                    {/* Center 3D Gold Star Insignia */}
                    <Star
                      className={cn(
                        "h-2.5 w-2.5 relative z-20 drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)] transition-transform duration-150 group-hover/ribbon:scale-110",
                        isUnlocked ? "text-amber-300 fill-amber-300" : "text-slate-500"
                      )}
                    />

                    {/* Bottom Gold Hardware Mounting Pin */}
                    <div className="absolute bottom-0 inset-x-0 h-[1.5px] bg-gradient-to-r from-amber-400 via-yellow-200 to-amber-500 opacity-95 z-20" />
                  </div>
                </motion.div>
              </TooltipTrigger>
              <TooltipContent
                side="bottom"
                align="center"
                sideOffset={8}
                className="z-[100] max-w-xs rounded-xl border border-amber-500/30 bg-background/90 p-3 text-xs text-foreground backdrop-blur-2xl saturate-180 shadow-2xl ring-1 ring-black/5 dark:border-amber-400/35 dark:bg-zinc-950/95 dark:text-slate-100 dark:ring-white/10 transition-all duration-200"
              >
                <div className="flex items-center gap-2 border-b border-border/60 dark:border-amber-500/20 pb-1.5 mb-1.5">
                  <Award className="h-3.5 w-3.5 text-amber-500 dark:text-amber-400 shrink-0" />
                  <span className="font-extrabold text-amber-600 dark:text-amber-400 text-xs uppercase tracking-wider">
                    {ribbon.title}
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground dark:text-slate-300 font-medium mb-1.5 leading-snug">
                  Conferred platform honor for excellence in {ribbon.category}.
                </p>
                <div className="flex items-center justify-between pt-1 border-t border-border/50 dark:border-white/10 text-[10px]">
                  <span className="text-muted-foreground dark:text-slate-400 font-medium">Platform Honor</span>
                  <span className="font-mono text-amber-600 dark:text-amber-300 font-semibold px-1.5 py-0.5 rounded-xs bg-amber-500/10 dark:bg-amber-500/15 border border-amber-500/30">
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
