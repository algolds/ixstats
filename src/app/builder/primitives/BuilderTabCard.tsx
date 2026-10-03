"use client";

import React, { useId, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";

import { cn } from "~/lib/utils";
import { springSnappy } from "~/lib/design/motion";

export interface TabDefinition {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface BuilderTabCardProps {
  tabs: TabDefinition[];
  activeTab: string;
  onTabChange: (id: string) => void;
  children: React.ReactNode;
  className?: string;
  hideTabList?: boolean;
}

export function BuilderTabCard({
  tabs,
  activeTab,
  onTabChange,
  children,
  className,
  hideTabList = false,
}: BuilderTabCardProps) {
  const activeIndex = tabs.findIndex((t) => t.id === activeTab);
  const tabWidthPercent = 100 / tabs.length;
  const idBase = useId();
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const tabId = (id: string) => `${idBase}-tab-${id}`;
  const panelId = `${idBase}-panel`;
  const focusedIndex = activeIndex === -1 ? 0 : activeIndex;

  // WAI-ARIA tabs: arrows (wrapping), Home and End move focus and select.
  const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    let next: number | null = null;
    if (event.key === "ArrowRight") next = (index + 1) % tabs.length;
    else if (event.key === "ArrowLeft") next = (index - 1 + tabs.length) % tabs.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = tabs.length - 1;
    if (next === null) return;
    event.preventDefault();
    const target = tabs[next];
    if (!target) return;
    onTabChange(target.id);
    tabRefs.current[next]?.focus();
  };

  return (
    <div className={cn("space-y-4", className)}>
      {!hideTabList && (
        <div
          role="tablist"
          aria-orientation="horizontal"
          className="bg-surface rounded-row shadow-card relative flex gap-1 border p-1"
        >
          {/* Sliding indicator behind active tab */}
          {activeIndex !== -1 && (
            <motion.div
              className="rounded-control bg-tint-fill border-tint/20 absolute inset-y-1 z-0 border"
              layout
              layoutId={`builder-tab-indicator-${idBase}`}
              style={{
                width: `calc(${tabWidthPercent}% - 8px)`,
                left: `calc(${(activeIndex / tabs.length) * 100}% + 4px)`,
              }}
              transition={springSnappy}
            />
          )}

          {tabs.map((tab, index) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;

            return (
              <motion.button
                key={tab.id}
                ref={(el) => {
                  tabRefs.current[index] = el;
                }}
                type="button"
                role="tab"
                id={tabId(tab.id)}
                aria-selected={isActive}
                aria-controls={panelId}
                aria-label={tab.label}
                tabIndex={index === focusedIndex ? 0 : -1}
                onClick={() => onTabChange(tab.id)}
                onKeyDown={(event) => handleKeyDown(event, index)}
                className={cn(
                  "rounded-control text-caption focus-visible:outline-tint relative z-10 flex flex-1 cursor-pointer items-center justify-center gap-2 px-3 py-2 font-semibold whitespace-nowrap transition-colors duration-200 pointer-coarse:min-h-11",
                  isActive ? "text-tint-ink font-bold" : "text-label-secondary hover:text-label"
                )}
              >
                <Icon
                  aria-hidden="true"
                  className={cn(
                    "h-3.5 w-3.5 transition-colors duration-200",
                    isActive ? "text-tint" : "text-label-tertiary"
                  )}
                />
                <span className="hidden sm:inline">{tab.label}</span>
              </motion.button>
            );
          })}
        </div>
      )}

      {/* Content Area */}
      <div
        className="relative"
        {...(hideTabList
          ? {}
          : {
              role: "tabpanel",
              id: panelId,
              "aria-labelledby": activeIndex === -1 ? undefined : tabId(tabs[activeIndex]!.id),
            })}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="pt-2"
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
