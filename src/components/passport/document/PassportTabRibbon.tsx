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

/** The DOM id of a ribbon tab (`idBase` from the document's `useId`). */
export function passportTabId(idBase: string, tab: PassportTabType): string {
  return `${idBase}-tab-${tab}`;
}

/** The DOM id of the tab panel the ribbon controls. */
export function passportTabPanelId(idBase: string): string {
  return `${idBase}-panel`;
}

interface PassportTabRibbonProps {
  activeTab: PassportTabType;
  onSelectTab: (tab: PassportTabType) => void;
  /** Badge counts for the tabs whose totals are known without loading the tab. */
  counts: Partial<Record<PassportTabType, number>>;
  /** Shared id prefix with the tab panel (`passportTabPanelId(idBase)`). */
  idBase: string;
}

/**
 * The mid-card die-cut index ribbon that switches passport tabs — the WAI-ARIA tabs pattern:
 * `role="tablist"` of `role="tab"`s with `aria-selected`, the selected tab controls the panel
 * (`passportTabPanelId`), roving tabindex (only the selected tab is in the Tab order), and
 * ←/→/Home/End move focus and select (automatic activation).
 */
export const PassportTabRibbon = React.memo(function PassportTabRibbon({
  activeTab,
  onSelectTab,
  counts,
  idBase,
}: PassportTabRibbonProps) {
  const shouldReduceMotion = useReducedMotion();
  const tabRefs = React.useRef<Array<HTMLButtonElement | null>>([]);

  const handleKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
      const last = RIBBON_TABS.length - 1;
      let next: number;
      switch (event.key) {
        case "ArrowRight":
          next = index === last ? 0 : index + 1;
          break;
        case "ArrowLeft":
          next = index === 0 ? last : index - 1;
          break;
        case "Home":
          next = 0;
          break;
        case "End":
          next = last;
          break;
        default:
          return;
      }
      event.preventDefault();
      tabRefs.current[next]?.focus();
      onSelectTab(RIBBON_TABS[next]!.id);
    },
    [onSelectTab]
  );

  return (
    <div className="border-separator bg-surface-secondary border-y px-4 py-2 sm:px-6">
      <div
        role="tablist"
        aria-label="Passport sections"
        aria-orientation="horizontal"
        className="-my-2 flex scrollbar-none items-center gap-1 overflow-x-auto py-2"
      >
        {RIBBON_TABS.map((tab, idx) => {
          const isActive = activeTab === tab.id;
          const Icon = tab.icon;
          const count = counts[tab.id];
          return (
            <button
              key={tab.id}
              ref={(node) => {
                tabRefs.current[idx] = node;
              }}
              type="button"
              role="tab"
              id={passportTabId(idBase, tab.id)}
              aria-selected={isActive}
              aria-controls={isActive ? passportTabPanelId(idBase) : undefined}
              tabIndex={isActive ? 0 : -1}
              onClick={() => onSelectTab(tab.id)}
              onKeyDown={(event) => handleKeyDown(event, idx)}
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
