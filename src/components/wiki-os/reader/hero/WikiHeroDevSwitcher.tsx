"use client";

import React, { useState, useEffect } from "react";
import {
  Check,
  ControlSlider as SlidersHorizontal,
  Sparks as Sparkles,
  OpenBook as BookOpen,
  Compass,
} from "iconoir-react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "~/lib/utils";
import type { WikiHeroVariant } from "./types";
import {
  REFRACTION_MODES,
  type RefractionMode,
} from "./FeaturedImageRefraction";

interface WikiHeroDevSwitcherProps {
  currentVariant: WikiHeroVariant;
  onSelectVariant: (variant: WikiHeroVariant) => void;
  currentRefraction?: RefractionMode;
  onSelectRefraction?: (mode: RefractionMode) => void;
}

const VARIANTS: Array<{
  id: WikiHeroVariant;
  number: string;
  name: string;
  badge: string;
  desc: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  {
    id: "editorial-masthead",
    number: "1",
    name: "Editorial Masthead",
    badge: "Archival",
    desc: "Archival linework, search, quick-launch chips, 4 stats tiles, and featured article",
    icon: BookOpen,
  },
  {
    id: "sculpted-emblem",
    number: "2",
    name: "Sculpted Emblem",
    badge: "Material",
    desc: "Specular spotlight, sculpted emblem, quick-launch chips, 4 stats tiles, and featured article",
    icon: Sparkles,
  },
];

export function WikiHeroDevSwitcher({
  currentVariant,
  onSelectVariant,
  currentRefraction = "ambient-underglow",
  onSelectRefraction,
}: WikiHeroDevSwitcherProps) {
  const [isOpen, setIsOpen] = useState(false);

  // Keyboard shortcut: Shift + 1/2 for hero, Shift + R to cycle refraction modes
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      if (e.shiftKey && (e.key === "1" || e.key === "!" || e.code === "Digit1")) {
        if (VARIANTS[0]) {
          onSelectVariant(VARIANTS[0].id);
        }
      } else if (e.shiftKey && (e.key === "2" || e.key === "@" || e.code === "Digit2")) {
        if (VARIANTS[1]) {
          onSelectVariant(VARIANTS[1].id);
        }
      } else if (e.shiftKey && (e.key === "R" || e.key === "r" || e.code === "KeyR")) {
        e.preventDefault();
        if (onSelectRefraction) {
          const currentIndex = REFRACTION_MODES.findIndex((m) => m.id === currentRefraction);
          const nextIndex = (currentIndex + 1) % REFRACTION_MODES.length;
          onSelectRefraction(REFRACTION_MODES[nextIndex].id);
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onSelectVariant, onSelectRefraction, currentRefraction]);

  const activeOption = VARIANTS.find((v) => v.id === currentVariant) || VARIANTS[0];
  const activeRefraction =
    REFRACTION_MODES.find((m) => m.id === currentRefraction) || REFRACTION_MODES[0];

  return (
    <div className="w-full max-w-4xl mx-auto mb-3 sm:mb-4 flex flex-col items-center select-none">
      {/* ── Compact Dev Bar Header & Trigger ── */}
      <div className="flex items-center gap-2 flex-wrap justify-center">
        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          data-cuelume-press="droplet"
          data-cuelume-hover="tick"
          className={cn(
            "flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium cursor-pointer shadow-xs",
            "border border-blue-500/30 bg-blue-500/10 hover:bg-blue-500/20 text-blue-500 dark:text-blue-400",
            "backdrop-blur-md transition-colors duration-150 active:scale-95"
          )}
          title="Toggle Design Lab Controls (Shift+1/2, Shift+R)"
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
          <span className="font-semibold">Design Lab:</span>
          <span className="font-bold text-foreground underline decoration-blue-500/50 underline-offset-2">
            {activeOption.name}
          </span>
          <span className="opacity-40">·</span>
          <span className="text-amber-500 font-semibold">{activeRefraction.name}</span>
          <span className="text-[10px] text-muted-foreground ml-1">
            [{isOpen ? "Close Lab" : "Dev Controls"}]
          </span>
        </button>
      </div>

      {/* ── Expanded Switcher Segmented Deck ── */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0, y: -6 }}
            animate={{ opacity: 1, height: "auto", y: 0 }}
            exit={{ opacity: 0, height: 0, y: -6 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            className="overflow-hidden w-full pt-3"
          >
            <div
              className={cn(
                "w-full max-w-3xl mx-auto rounded-2xl p-3 sm:p-4 border border-white/20 dark:border-white/10",
                "bg-white/85 dark:bg-zinc-950/90 backdrop-blur-2xl shadow-xl flex flex-col gap-4"
              )}
            >
              {/* Section 1: Hero Layouts */}
              <div>
                <div className="text-[11px] font-bold tracking-wider uppercase text-muted-foreground mb-2 flex items-center justify-between">
                  <span>1. Header Layout Direction</span>
                  <span className="text-[10px] font-normal lowercase">Shift + 1 / Shift + 2</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {VARIANTS.map((variant) => {
                    const isActive = currentVariant === variant.id;
                    const Icon = variant.icon;
                    return (
                      <button
                        key={variant.id}
                        type="button"
                        onClick={() => onSelectVariant(variant.id)}
                        data-cuelume-press="page"
                        data-cuelume-hover="tick"
                        className={cn(
                          "relative flex flex-col items-start text-left p-2.5 rounded-xl cursor-pointer transition-colors text-xs active:scale-[0.98]",
                          isActive
                            ? "text-foreground font-semibold shadow-xs"
                            : "text-muted-foreground hover:text-foreground hover:bg-foreground/[0.04]"
                        )}
                      >
                        {isActive && (
                          <motion.div
                            layoutId="activeHeroPill"
                            className="absolute inset-0 rounded-xl bg-blue-500/15 border border-blue-500/30 dark:bg-blue-500/20"
                            transition={{ type: "spring", stiffness: 450, damping: 32 }}
                          />
                        )}
                        <div className="relative z-10 flex items-center justify-between w-full mb-0.5">
                          <div className="flex items-center gap-1.5 font-bold text-xs text-foreground">
                            <Icon className="h-3.5 w-3.5 text-blue-500" />
                            <span>{variant.name}</span>
                          </div>
                          {isActive && <Check className="h-3.5 w-3.5 text-blue-500 shrink-0" />}
                        </div>
                        <span className="relative z-10 text-[10.5px] text-muted-foreground leading-snug">
                          {variant.desc}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Section 2: Refraction Directions */}
              {onSelectRefraction && (
                <div className="border-t border-black/5 dark:border-white/10 pt-3">
                  <div className="text-[11px] font-bold tracking-wider uppercase text-amber-500 mb-2 flex items-center justify-between">
                    <span>2. Glass & Backlight Direction</span>
                    <span className="text-[10px] font-normal lowercase text-muted-foreground">
                      Press Shift + R to toggle
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {REFRACTION_MODES.map((mode) => {
                      const isActive = currentRefraction === mode.id;
                      return (
                        <button
                          key={mode.id}
                          type="button"
                          onClick={() => onSelectRefraction(mode.id)}
                          data-cuelume-press="sparkle"
                          data-cuelume-hover="tick"
                          className={cn(
                            "relative flex flex-col items-start text-left p-2.5 rounded-xl cursor-pointer transition-colors text-xs active:scale-[0.98]",
                            isActive
                              ? "text-foreground font-semibold shadow-xs"
                              : "text-muted-foreground hover:text-foreground hover:bg-foreground/[0.04]"
                          )}
                        >
                          {isActive && (
                            <motion.div
                              layoutId="activeRefractionPill"
                              className="absolute inset-0 rounded-xl bg-amber-500/15 border border-amber-500/30 dark:bg-amber-500/20"
                              transition={{ type: "spring", stiffness: 450, damping: 32 }}
                            />
                          )}
                          <div className="relative z-10 flex items-center justify-between w-full mb-0.5">
                            <span className="font-bold text-xs text-foreground">{mode.name}</span>
                            {isActive && <Check className="h-3.5 w-3.5 text-amber-500 shrink-0" />}
                          </div>
                          <span className="relative z-10 text-[10.5px] text-muted-foreground leading-snug">
                            {mode.desc}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
            <div className="text-center text-[10px] text-muted-foreground mt-2">
              Tip: Press <kbd className="px-1.5 py-0.5 rounded bg-muted">Shift + 1</kbd> or <kbd className="px-1.5 py-0.5 rounded bg-muted">Shift + 2</kbd> for layout, <kbd className="px-1.5 py-0.5 rounded bg-muted">Shift + R</kbd> for refraction.
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
