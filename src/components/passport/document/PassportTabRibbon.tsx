"use client";

import React from "react";
import { motion, useReducedMotion } from "motion/react";
import { Clock, Crown, Globe, Page, Trophy } from "iconoir-react";
import { cn } from "~/lib/utils";
import { hitSlop } from "~/components/ui/button";
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
      <div className="-my-2 flex scrollbar-none items-center gap-1 overflow-x-auto py-2">
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
                // v2: the active tab is the inverted (monochrome primary) pill; tabs press. The
                // 28px pill keeps a 44pt hit area on touch screens (`hitSlop`, inside the py-2).
                hitSlop,
                "rounded-control text-footnote facet-press facet-press-sm focus-visible:outline-tint relative flex h-(--control-height-sm) shrink-0 cursor-pointer items-center gap-2 px-3 font-medium focus-visible:outline-2 focus-visible:outline-offset-2",
                isActive
                  ? "bg-primary-fill text-on-primary shadow-card"
                  : "text-label-secondary hover:text-label hover:bg-fill-4"
              )}
            >
              <span aria-hidden className="font-data tabular-nums opacity-60">
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
                  className="text-caption font-data rounded-full bg-current/15 px-2 tabular-nums"
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
