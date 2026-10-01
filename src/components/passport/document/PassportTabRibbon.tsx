"use client";

import React from "react";
import { motion, useReducedMotion } from "motion/react";
import { Clock, Crown, Globe, Page, Trophy } from "iconoir-react";
import { cn } from "~/lib/utils";
import { REDUCED_MOTION_FADE, springSnappy } from "~/lib/design/motion";
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
    <div className="border-separator bg-surface-secondary border-y px-4 py-2 sm:px-6">
      <div className="flex scrollbar-none items-center gap-1 overflow-x-auto">
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
              className={cn(
                "rounded-control text-footnote duration-fast ease-out-facet focus-visible:outline-tint flex h-(--control-height-sm) shrink-0 cursor-pointer items-center gap-2 px-3 font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2",
                isActive
                  ? "bg-surface text-label shadow-card"
                  : "text-label-secondary hover:text-label hover:bg-fill-4"
              )}
            >
              <span aria-hidden className="text-label-tertiary tabular-nums">
                {String(idx + 1).padStart(2, "0")}.
              </span>
              <Icon aria-hidden className="size-3.5" />
              <span>{tab.label}</span>
              {count !== undefined && count > 0 && (
                <motion.span
                  key={`${tab.id}-${count}`}
                  initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={shouldReduceMotion ? REDUCED_MOTION_FADE : springSnappy}
                  className="bg-fill-3 text-caption rounded-full px-2 tabular-nums"
                >
                  {count}
                </motion.span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
});
