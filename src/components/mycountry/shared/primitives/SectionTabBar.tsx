"use client";

import React from "react";
import { cn } from "~/lib/utils";
import { soundEffects } from "~/lib/sound/cuelume";

export interface SectionTab<Id extends string> {
  id: Id;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  /** Optional count pill shown after the label. */
  badge?: React.ReactNode;
  /** Active-state colours for this tab; falls back to the bar's `activeClassName`. */
  activeClassName?: string;
}

export interface SectionTabBarProps<Id extends string> {
  tabs: ReadonlyArray<SectionTab<Id>>;
  activeTab: Id;
  onChange: (id: Id) => void;
  /** Active-state colours (border / background / text) for the section's accent. */
  activeClassName: string;
  className?: string;
}

/**
 * The sub-tab bar shared by the MyCountry domain sections (Economy, Politics, Diplomacy,
 * Defense). Tabs wrap onto a second row instead of scrolling or spilling out of the main
 * column, and long labels truncate inside their pill.
 */
export function SectionTabBar<Id extends string>({
  tabs,
  activeTab,
  onChange,
  activeClassName,
  className,
}: SectionTabBarProps<Id>): React.JSX.Element {
  return (
    <div
      role="tablist"
      className={cn(
        "border-border/30 flex flex-wrap items-center gap-1.5 border-b pb-2",
        className
      )}
    >
      {tabs.map(({ id, label, icon: Icon, badge, activeClassName: tabActive }) => {
        const isActive = activeTab === id;
        return (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={isActive}
            title={label}
            data-cuelume-press="soft"
            onClick={() => {
              soundEffects.press();
              onChange(id);
            }}
            className={cn(
              "flex max-w-full min-w-0 cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-xs font-extrabold transition-[color,background-color,border-color,box-shadow,opacity,transform] active:scale-95",
              isActive
                ? cn("shadow-sm", tabActive ?? activeClassName)
                : "bg-muted/20 text-muted-foreground hover:bg-muted/40 hover:text-foreground border-border/30"
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            <span className="truncate">{label}</span>
            {badge !== undefined && badge !== null && (
              <span className="shrink-0 rounded-full bg-current/15 px-2 py-0.5 font-mono text-xs">
                {badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
