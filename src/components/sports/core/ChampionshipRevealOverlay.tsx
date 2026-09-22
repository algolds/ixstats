"use client";

import React, { useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Trophy, Star, Sparks as Sparkles, Xmark } from "iconoir-react";
import { Button } from "~/components/ui/button";
import { soundEffects } from "~/lib/sound/cuelume";
import { getSportTheme } from "~/lib/sports/theming";

export interface ChampionshipRevealOverlayProps {
  isOpen: boolean;
  championName: string;
  championLogo?: string | null;
  championColor?: string | null;
  seasonNumber: number;
  leagueName: string;
  sportPreset?: string;
  onClose: () => void;
}

export function ChampionshipRevealOverlay({
  isOpen,
  championName,
  championLogo,
  championColor,
  seasonNumber,
  leagueName,
  sportPreset,
  onClose,
}: ChampionshipRevealOverlayProps) {
  const sportTheme = getSportTheme(sportPreset);

  useEffect(() => {
    if (isOpen) {
      soundEffects.bloom();
      setTimeout(() => soundEffects.sparkle(), 400);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          style={{ zIndex: "var(--z-depth-modal, 100001)" }}
          className="fixed inset-0 flex items-center justify-center p-4 backdrop-blur-2xl bg-black/80"
        >
          {/* Ambient Lighting Rays */}
          <div
            className="absolute inset-0 pointer-events-none opacity-40 bg-[radial-gradient(circle_at_center,rgba(234,179,8,0.35)_0%,transparent_70%)]"
          />

          {/* Close button */}
          <button
            type="button"
            onClick={onClose}
            data-cuelume-press="subtle"
            className="absolute top-6 right-6 z-20 cursor-pointer rounded-full border border-white/20 bg-white/10 p-2.5 text-white/80 backdrop-blur-md transition hover:bg-white/20 hover:text-white active:scale-95"
            aria-label="Close"
          >
            <Xmark className="h-5 w-5" />
          </button>

          {/* Card Container */}
          <motion.div
            initial={{ scale: 0.85, y: 30, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.9, y: 20, opacity: 0 }}
            transition={{ type: "spring", damping: 20, stiffness: 260 }}
            className="relative z-10 mx-auto max-w-xl w-full rounded-3xl border border-amber-500/30 bg-gradient-to-b from-amber-500/15 via-background/95 to-background p-8 text-center shadow-2xl backdrop-blur-3xl"
          >
            {/* Top Trophy & Sparks */}
            <div className="relative mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-3xl border border-amber-500/40 bg-gradient-to-br from-amber-400/20 to-amber-600/10 shadow-lg backdrop-blur-xl">
              <Trophy className="h-12 w-12 text-amber-400 animate-pulse" />
              <Sparkles className="absolute -top-2 -right-2 h-6 w-6 text-amber-300" />
              <Star className="absolute -bottom-1 -left-1 h-5 w-5 fill-amber-400 text-amber-400" />
            </div>

            {/* Header Badge */}
            <div className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/40 bg-amber-500/20 px-3 py-1 text-xs font-black tracking-widest text-amber-400 uppercase">
              <span>{leagueName}</span>
              <span>•</span>
              <span>Season {seasonNumber} Champion</span>
            </div>

            {/* Champion Title */}
            <motion.h2
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              transition={{ repeat: Infinity, repeatType: "reverse", duration: 2 }}
              className="mt-4 text-3xl sm:text-4xl font-black tracking-tight text-white"
            >
              {championName}
            </motion.h2>

            <p className="mt-2 text-sm text-muted-foreground">
              Crowned champions of {leagueName} after a decisive campaign in Season {seasonNumber}.
            </p>

            {/* Champion Logo / Emblems */}
            <div className="my-8 flex items-center justify-center gap-4">
              <div
                className="flex h-20 w-20 items-center justify-center rounded-2xl border border-white/20 shadow-2xl overflow-hidden"
                style={{
                  backgroundColor: championColor ? `${championColor}30` : "rgba(234, 179, 8, 0.15)",
                }}
              >
                {championLogo ? (
                  <img src={championLogo} alt={championName} className="h-full w-full object-cover" />
                ) : (
                  <Trophy className="h-10 w-10 text-amber-400" />
                )}
              </div>
            </div>

            {/* Trophy Quote / Lore Banner */}
            <div className="rounded-2xl border border-border/40 bg-card/60 p-4 text-xs font-semibold text-muted-foreground backdrop-blur-md">
              <p>
                The {sportTheme.name} championship trophy has been formally awarded. All statistics and honors
                have been archived in the Competition Almanac.
              </p>
            </div>

            {/* Actions */}
            <div className="mt-8 flex justify-center gap-3">
              <Button
                onClick={onClose}
                data-cuelume-press="subtle"
                className="rounded-xl border border-amber-500/40 bg-amber-500 text-black font-bold px-8 py-2.5 shadow-lg hover:bg-amber-400 active:scale-[0.98] transition-all cursor-pointer"
              >
                Continue Campaign
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
