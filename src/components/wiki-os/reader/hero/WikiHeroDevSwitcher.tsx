"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Layers, Check, Sparkles, SlidersHorizontal, ChevronRight } from "lucide-react";
import { cn } from "~/lib/utils";
import type { WikiHeroVariant } from "./types";

interface WikiHeroDevSwitcherProps {
  currentVariant: WikiHeroVariant;
  onSelectVariant: (variant: WikiHeroVariant) => void;
}

const VARIANTS: Array<{
  id: WikiHeroVariant;
  number: string;
  name: string;
  badge: string;
  desc: string;
}> = [
  {
    id: "command-dock",
    number: "1",
    name: "Command Dock",
    badge: "macOS Dock",
    desc: "Unified Liquid Glass Masthead Dock with search prompt & live telemetry",
  },
  {
    id: "typographic",
    number: "2",
    name: "Typographic",
    badge: "Broadsheet",
    desc: "Pure editorial linework, drop-cap monogram & running headers",
  },
  {
    id: "halo-hub",
    number: "3",
    name: "Halo Hub",
    badge: "Dynamic Island",
    desc: "Obsidian pill that springs open into a command deck on hover/tap",
  },
  {
    id: "split-horizon",
    number: "4",
    name: "Split Horizon",
    badge: "50/50 Studio",
    desc: "Asymmetric brand manifesto + 3D pointer-tilt Featured Lore card",
  },
  {
    id: "sculpted-emblem",
    number: "5",
    name: "Sculpted Emblem",
    badge: "Material",
    desc: "Borderless titanium vector with cursor-following radial spotlight",
  },
];

export function WikiHeroDevSwitcher({
  currentVariant,
  onSelectVariant,
}: WikiHeroDevSwitcherProps) {
  const [isOpen, setIsOpen] = useState(false);

  // Keyboard shortcut: pressing Shift + 1..5 switches hero
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      if (e.shiftKey && ["1", "2", "3", "4", "5"].includes(e.key)) {
        const index = parseInt(e.key, 10) - 1;
        if (VARIANTS[index]) {
          onSelectVariant(VARIANTS[index].id);
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onSelectVariant]);

  const activeOption = VARIANTS.find((v) => v.id === currentVariant) || VARIANTS[0];

  return (
    <div className="w-full max-w-4xl mx-auto mb-4 flex flex-col items-center select-none">
      {/* ── Compact Dev Bar Header & Trigger ── */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          className={cn(
            "flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium cursor-pointer shadow-xs",
            "border border-blue-500/30 bg-blue-500/10 hover:bg-blue-500/20 text-blue-500 dark:text-blue-400",
            "backdrop-blur-md transition-all active:scale-95"
          )}
          title="Toggle Header Layout Direction Switcher (Shift+1..5)"
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
          <span className="font-semibold">Dev Header Lab:</span>
          <span className="font-bold text-foreground underline decoration-blue-500/50 underline-offset-2">
            {activeOption.name}
          </span>
          <span className="text-[10px] text-muted-foreground font-mono ml-1">
            [{isOpen ? "Hide Lab" : "Explore All 5"}]
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
                "w-full rounded-2xl p-2 border border-white/20 dark:border-white/10",
                "bg-white/80 dark:bg-zinc-950/90 backdrop-blur-2xl shadow-xl",
                "grid grid-cols-1 sm:grid-cols-5 gap-1.5"
              )}
            >
              {VARIANTS.map((variant) => {
                const isActive = currentVariant === variant.id;
                return (
                  <button
                    key={variant.id}
                    type="button"
                    onClick={() => onSelectVariant(variant.id)}
                    className={cn(
                      "relative flex flex-col items-start text-left p-2.5 rounded-xl cursor-pointer transition-all text-xs",
                      isActive
                        ? "text-foreground font-semibold shadow-xs"
                        : "text-muted-foreground hover:text-foreground hover:bg-foreground/[0.04]"
                    )}
                  >
                    {/* Active Pill Highlight */}
                    {isActive && (
                      <motion.div
                        layoutId="activeHeroPill"
                        className="absolute inset-0 rounded-xl bg-blue-500/15 border border-blue-500/30 dark:bg-blue-500/20"
                        transition={{ type: "spring", stiffness: 450, damping: 32 }}
                      />
                    )}

                    <div className="relative z-10 flex items-center justify-between w-full mb-1">
                      <div className="flex items-center gap-1.5">
                        <span className="flex h-4 w-4 items-center justify-center rounded-full bg-foreground/10 text-[9px] font-mono font-bold">
                          {variant.number}
                        </span>
                        <span className="font-bold text-[11px] truncate">
                          {variant.name}
                        </span>
                      </div>
                      {isActive && (
                        <Check className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                      )}
                    </div>

                    <span className="relative z-10 text-[10px] text-muted-foreground line-clamp-2 leading-tight">
                      {variant.desc}
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="text-center text-[10px] text-muted-foreground mt-1.5 font-mono">
              Tip: Press <kbd className="px-1 py-0.5 rounded bg-muted">Shift + 1..5</kbd> anywhere on this page to quickly cycle layouts.
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
