"use client";

import React from "react";
import { motion, useReducedMotion } from "motion/react";
import { cn } from "~/lib/utils";
import { hitSlop } from "~/components/ui/button";
import { REDUCED_MOTION_FADE, springSnappy } from "~/lib/design/motion";

export interface RibbonTab<T extends string> {
  id: T;
  label: string;
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
}

/** The DOM id of a ribbon tab (`idBase` from the document's `useId`). */
export function ribbonTabId(idBase: string, tab: string): string {
  return `${idBase}-tab-${tab}`;
}

/** The DOM id of the tab panel the ribbon controls. */
export function ribbonPanelId(idBase: string): string {
  return `${idBase}-panel`;
}

interface DocumentRibbonProps<T extends string> {
  tabs: readonly RibbonTab<T>[];
  activeTab: T;
  onSelectTab: (tab: T) => void;
  /** Badge counts for the tabs whose totals are known without loading the tab. */
  counts?: Partial<Record<T, number>>;
  /** Shared id prefix with the tab panel (`ribbonPanelId(idBase)`). */
  idBase: string;
  /** The tablist's accessible name ("Passport sections"). */
  label: string;
}

/**
 * The die-cut index ribbon of a document (the passport, the country page) that switches its
 * panel, using the WAI-ARIA tabs pattern: `role="tablist"` of `role="tab"`s with
 * `aria-selected`, the selected tab controls the panel (`ribbonPanelId`), roving tabindex (only
 * the selected tab is in the Tab order), and ←/→/Home/End move focus and select (automatic
 * activation).
 */
function DocumentRibbonComponent<T extends string>({
  tabs,
  activeTab,
  onSelectTab,
  counts = {},
  idBase,
  label,
}: DocumentRibbonProps<T>) {
  const shouldReduceMotion = useReducedMotion();
  const tabRefs = React.useRef<Array<HTMLButtonElement | null>>([]);

  const handleKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
      const last = tabs.length - 1;
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
      onSelectTab(tabs[next]!.id);
    },
    [onSelectTab, tabs]
  );

  return (
    <div className="border-separator bg-surface-secondary border-y px-4 py-2 sm:px-6">
      <div
        role="tablist"
        aria-label={label}
        aria-orientation="horizontal"
        className="-my-2 flex scrollbar-none items-center gap-1 overflow-x-auto py-2"
      >
        {tabs.map((tab, idx) => {
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
              id={ribbonTabId(idBase, tab.id)}
              aria-selected={isActive}
              aria-controls={isActive ? ribbonPanelId(idBase) : undefined}
              tabIndex={isActive ? 0 : -1}
              onClick={() => onSelectTab(tab.id)}
              onKeyDown={(event) => handleKeyDown(event, idx)}
              className={cn(
                // The active tab is the inverted (primary) pill. The 28px pill keeps a 44pt hit
                // area on touch screens (`hitSlop`).
                hitSlop,
                "rounded-control text-footnote focus-visible:outline-tint relative flex h-(--control-height-sm) shrink-0 cursor-pointer items-center gap-2 px-3 font-medium focus-visible:outline-2 focus-visible:outline-offset-2",
                isActive
                  ? "bg-primary-fill text-on-primary shadow-card"
                  : "text-label-secondary hover:text-label hover:bg-fill-4"
              )}
            >
              <Icon aria-hidden className="size-3.5" />
              <span>{tab.label}</span>
              {count !== undefined && count > 0 && (
                <motion.span
                  key={`${tab.id}-${count}`}
                  initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={shouldReduceMotion ? REDUCED_MOTION_FADE : springSnappy}
                  className="text-caption rounded-full bg-current/15 px-2 tabular-nums"
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
}

export const DocumentRibbon = React.memo(DocumentRibbonComponent) as typeof DocumentRibbonComponent;
