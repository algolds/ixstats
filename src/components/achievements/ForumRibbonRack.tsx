"use client";

import React, { useState } from "react";
import { motion } from "motion/react";
import { Award, ShieldCheck, Pin, Check, Star } from "lucide-react";
import { FORUM_RIBBONS, type ForumRibbon } from "./constants";
import { TextureOverlay } from "~/components/ui/texture-overlay";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "~/components/ui/tooltip";
import { cn } from "~/lib/utils";

interface ForumRibbonRackProps {
  unlockedCount: number;
  username?: string;
}

export function ForumRibbonRack({ unlockedCount, username }: ForumRibbonRackProps) {
  const [pinnedIds, setPinnedIds] = useState<string[]>(["wiki-archivist", "community-veteran"]);

  const togglePin = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setPinnedIds((prev) => {
      if (prev.includes(id)) {
        return prev.filter((p) => p !== id);
      }
      if (prev.length >= 3) {
        return [...prev.slice(1), id];
      }
      return [...prev, id];
    });
  };

  const pinnedRibbons = FORUM_RIBBONS.filter((r) => pinnedIds.includes(r.id));

  return (
    <div className="space-y-6">
      {/* Pinned Signature Military Ribbon Bar */}
      <div className="relative overflow-hidden rounded-3xl border border-amber-500/25 border-t-amber-400/35 bg-gradient-to-b from-slate-950/90 via-black/80 to-slate-950/90 p-5 shadow-2xl backdrop-blur-2xl transition-all">
        <TextureOverlay texture="dots" opacity={0.03} />

        <div className="relative z-10 space-y-4">
          <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
            <div className="flex items-center gap-2">
              <Pin className="h-4 w-4 text-amber-400 drop-shadow-[0_0_6px_rgba(245,158,11,0.4)]" />
              <h4 className="text-xs font-extrabold tracking-wider text-slate-200 uppercase">
                Pinned Signature Service Ribbons (Military Display Bar)
              </h4>
            </div>
            <span className="font-mono text-[10px] font-bold text-amber-400">
              {pinnedRibbons.length} / 3 Ribbons Mounted
            </span>
          </div>

          {/* Military Service Mounting Rack Plate */}
          <div className="flex flex-wrap items-center justify-center gap-6 rounded-2xl border border-amber-500/20 bg-slate-950/90 p-4 shadow-inner">
            {[0, 1, 2].map((slotIdx) => {
              const ribbon = pinnedRibbons[slotIdx];
              return (
                <div key={slotIdx} className="flex flex-col items-center gap-2">
                  {ribbon ? (
                    <motion.div
                      whileHover={{ scale: 1.06, y: -4 }}
                      whileTap={{ scale: 0.96 }}
                      className="group relative flex cursor-pointer flex-col items-center select-none"
                    >
                      {/* Top Brass Clasp Header */}
                      <div className="h-2.5 w-16 rounded-t-sm border-b border-amber-950/90 bg-gradient-to-r from-amber-600 via-amber-300 to-amber-600 shadow-md" />

                      {/* Vertical Silk Ribbon Body */}
                      <div
                        className={cn(
                          "relative flex h-28 w-16 flex-col items-center justify-between overflow-hidden border-x p-2 shadow-xl backdrop-blur-md transition-all",
                          `bg-gradient-to-b ${ribbon.stripeGradient} ${ribbon.borderStyle}`
                        )}
                      >
                        {/* Vertical Texture Stripes */}
                        <div className="pointer-events-none absolute inset-0 bg-[repeating-linear-gradient(90deg,transparent,transparent_4px,rgba(0,0,0,0.18)_4px,rgba(0,0,0,0.18)_8px)]" />

                        {/* Top Ribbon Badge Label */}
                        <span className="relative z-10 font-mono text-[9px] font-bold tracking-widest text-slate-950 uppercase drop-shadow">
                          {ribbon.badgeLabel}
                        </span>

                        {/* Center Gold Star Insignia */}
                        <div className="relative z-10 flex h-8 w-8 items-center justify-center rounded-full border border-amber-300/40 bg-amber-400/20 shadow-md backdrop-blur-sm">
                          <Star className="h-4.5 w-4.5 fill-amber-300 text-amber-300 drop-shadow" />
                        </div>

                        {/* Pin Toggle Button */}
                        <button
                          onClick={(e) => togglePin(ribbon.id, e)}
                          className="relative z-10 flex h-5 w-5 items-center justify-center rounded-full border border-slate-950/40 bg-slate-950/30 text-slate-950 transition-all hover:bg-slate-950/60 active:scale-95"
                          title="Unpin Ribbon"
                        >
                          <Check className="h-3 w-3 stroke-[3] text-slate-950" />
                        </button>
                      </div>

                      {/* Bottom Brass Base Clasp */}
                      <div className="h-2.5 w-16 rounded-b-sm border-t border-amber-950/90 bg-gradient-to-r from-amber-600 via-amber-300 to-amber-600 shadow-md" />

                      {/* Title Below */}
                      <span className="mt-2 line-clamp-1 max-w-[100px] text-center text-[10px] font-bold text-amber-200">
                        {ribbon.title}
                      </span>
                    </motion.div>
                  ) : (
                    <div className="flex flex-col items-center">
                      <div className="h-2.5 w-16 rounded-t-sm bg-slate-800" />
                      <div className="flex h-28 w-16 items-center justify-center rounded-sm border border-dashed border-white/15 bg-white/5 text-slate-500">
                        <span className="rotate-90 text-[9px] font-extrabold text-slate-500 uppercase">
                          EMPTY
                        </span>
                      </div>
                      <div className="h-2.5 w-16 rounded-b-sm bg-slate-800" />
                      <span className="mt-2 text-[10px] text-slate-500 italic">
                        Slot {slotIdx + 1}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main Military Ribbon Rack */}
      <div className="relative overflow-hidden rounded-3xl border border-white/10 border-t-white/20 bg-slate-950/70 p-5 shadow-2xl backdrop-blur-2xl transition-all dark:border-white/12 dark:bg-black/60">
        <TextureOverlay texture="dots" opacity={0.03} />

        <div className="relative z-10 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-amber-500/30 bg-amber-500/15 text-amber-400 shadow-sm backdrop-blur-md">
                <Award className="h-4.5 w-4.5 text-amber-400" />
              </div>
              <div>
                <h3 className="text-xs font-extrabold tracking-wider text-slate-200 uppercase">
                  {username ? `${username}'s ` : ""}Vertical Military Ribbon Rack
                </h3>
                <p className="text-[11px] text-slate-400">
                  Out-of-character service ribbons • Conferred to user account
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/15 px-3 py-1 font-mono text-xs font-bold text-amber-400 backdrop-blur-md">
              <ShieldCheck className="h-3.5 w-3.5 text-amber-400" />
              <span>
                {Math.min(unlockedCount, FORUM_RIBBONS.length)} / {FORUM_RIBBONS.length} Honors
              </span>
            </div>
          </div>

          {/* Vertical Military Ribbon Rack Grid */}
          <TooltipProvider>
            <div className="flex flex-wrap items-center justify-center gap-6 pt-2 sm:justify-start">
              {FORUM_RIBBONS.map((ribbon, idx) => {
                const isUnlocked = unlockedCount > idx;
                const isPinned = pinnedIds.includes(ribbon.id);
                return (
                  <Tooltip key={ribbon.id}>
                    <TooltipTrigger asChild>
                      <motion.div
                        whileHover={{ scale: 1.08, y: -4 }}
                        whileTap={{ scale: 0.95 }}
                        transition={{ type: "spring", stiffness: 400, damping: 25 }}
                        className={cn(
                          "group relative flex cursor-pointer flex-col items-center select-none",
                          !isUnlocked && "opacity-45 grayscale"
                        )}
                      >
                        {/* Top Brass Clasp Header */}
                        <div className="h-2 w-14 rounded-t-sm border-b border-amber-950/90 bg-gradient-to-r from-amber-600 via-amber-300 to-amber-600 shadow-md" />

                        {/* Vertical Silk Ribbon Body */}
                        <div
                          className={cn(
                            "relative flex h-24 w-14 flex-col items-center justify-between overflow-hidden border-x p-1.5 shadow-xl backdrop-blur-md transition-all",
                            isUnlocked
                              ? `bg-gradient-to-b ${ribbon.stripeGradient} ${ribbon.borderStyle}`
                              : "border-white/10 bg-slate-900/60"
                          )}
                        >
                          {/* Vertical Texture Stripes */}
                          <div className="pointer-events-none absolute inset-0 bg-[repeating-linear-gradient(90deg,transparent,transparent_4px,rgba(0,0,0,0.18)_4px,rgba(0,0,0,0.18)_8px)]" />

                          {/* Top Ribbon Badge Label */}
                          <span className="relative z-10 font-mono text-[8px] font-bold tracking-widest text-slate-950 uppercase drop-shadow">
                            {ribbon.badgeLabel}
                          </span>

                          {/* Center Insignia */}
                          <div className="relative z-10 flex h-7 w-7 items-center justify-center rounded-full border border-amber-300/40 bg-amber-400/20 shadow-md backdrop-blur-sm">
                            <Star
                              className={cn(
                                "h-4 w-4 drop-shadow",
                                isUnlocked ? "fill-amber-300 text-amber-300" : "text-slate-500"
                              )}
                            />
                          </div>

                          {/* Pin Button */}
                          <div className="relative z-10 flex items-center justify-center">
                            {isUnlocked && (
                              <button
                                onClick={(e) => togglePin(ribbon.id, e)}
                                className={cn(
                                  "flex h-4.5 w-4.5 items-center justify-center rounded-full border transition-all active:scale-95",
                                  isPinned
                                    ? "border-amber-400 bg-amber-400 text-slate-950 shadow-sm"
                                    : "border-slate-950/40 bg-slate-950/20 text-slate-950 hover:bg-slate-950/40"
                                )}
                                title={isPinned ? "Unpin from profile" : "Pin to profile"}
                              >
                                <Pin className="h-2.5 w-2.5" />
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Bottom Brass Base Clasp */}
                        <div className="h-2 w-14 rounded-b-sm border-t border-amber-950/90 bg-gradient-to-r from-amber-600 via-amber-300 to-amber-600 shadow-md" />

                        {/* Title Below */}
                        <span className="mt-1.5 line-clamp-1 max-w-[85px] text-center text-[9px] font-bold text-slate-300">
                          {ribbon.title}
                        </span>
                      </motion.div>
                    </TooltipTrigger>
                    <TooltipContent className="border-white/10 bg-slate-950/90 text-xs text-slate-200 backdrop-blur-xl">
                      <p className="font-bold text-amber-400">{ribbon.title}</p>
                      <p className="text-[10px] text-slate-400">
                        {ribbon.category} Out-of-Character Service Honor
                      </p>
                      <p className="mt-1 font-mono text-[10px] text-slate-300">
                        {isUnlocked ? "✓ Conferred to User Account" : "🔒 Locked Service Ribbon"}
                      </p>
                    </TooltipContent>
                  </Tooltip>
                );
              })}
            </div>
          </TooltipProvider>
        </div>
      </div>
    </div>
  );
}
