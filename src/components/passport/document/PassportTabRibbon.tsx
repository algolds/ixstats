"use client";

import React from "react";
import { motion, useReducedMotion } from "motion/react";
import { Clock, Crown, Globe, Page, Trophy } from "iconoir-react";
import { cn } from "~/lib/utils";
import type { PassportTabType } from "../types";

const RIBBON_TABS: Array<{ id: PassportTabType; label: string; icon: typeof Globe }> = [
  { id: "overview", label: "Overview", icon: Page },
  { id: "realms", label: "Realms", icon: Globe },
  { id: "work", label: "Work", icon: Trophy },
  { id: "vault", label: "Vault", icon: Crown },
  { id: "history", label: "History", icon: Clock },
];

interface PassportTabRibbonProps {
  activeTab: PassportTabType;
  onSelectTab: (tab: PassportTabType) => void;
  /** Badge counts for the tabs whose totals are known without loading the tab. */
  counts: Partial<Record<PassportTabType, number>>;
}

/** The mid-card die-cut index ribbon that switches passport tabs. */
export const PassportTabRibbon = React.memo(function PassportTabRibbon({
  activeTab,
  onSelectTab,
  counts,
}: PassportTabRibbonProps) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <div className="border-y border-black/10 bg-black/[0.025] px-4 py-2.5 sm:px-6 dark:border-white/15 dark:bg-black/40">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex scrollbar-none items-center gap-1.5 overflow-x-auto">
          {RIBBON_TABS.map((tab, idx) => {
            const isActive = activeTab === tab.id;
            const Icon = tab.icon;
            const count = counts[tab.id];
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => onSelectTab(tab.id)}
                aria-pressed={isActive}
                data-cuelume-press="soft"
                className={cn(
                  "flex shrink-0 cursor-pointer items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-semibold transition-[color,background-color,border-color,box-shadow,opacity,transform] duration-150 active:scale-[0.97]",
                  isActive
                    ? "bg-stone-900 text-white shadow-sm dark:bg-white dark:text-stone-950"
                    : "hover:text-foreground text-stone-600 hover:bg-black/5 dark:text-stone-400 dark:hover:bg-white/5"
                )}
              >
                <span className="font-mono text-xs opacity-60">
                  {String(idx + 1).padStart(2, "0")}.
                </span>
                <Icon className="h-3.5 w-3.5" />
                <span>{tab.label}</span>
                {count !== undefined && count > 0 && (
                  <motion.span
                    key={`${tab.id}-${count}`}
                    initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={
                      shouldReduceMotion
                        ? { duration: 0.15 }
                        : { type: "spring", bounce: 0, duration: 0.3 }
                    }
                    className="py-0.2 rounded-full bg-black/10 px-1.5 font-mono text-xs dark:bg-white/15"
                    style={{ willChange: "transform, opacity" }}
                  >
                    {count}
                  </motion.span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
});
