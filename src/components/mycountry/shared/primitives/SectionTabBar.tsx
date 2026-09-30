"use client";

import React from "react";
import { cn } from "~/lib/utils";

export interface SectionTab<Id extends string> {
  id: Id;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  /** Optional count shown after the label. */
  badge?: React.ReactNode;
  /**
   * Active-state accent for this tab's icon; falls back to the bar's `activeClassName`.
   * Only the text colour is used — the active pill itself is the neutral Facet segment.
   */
  activeClassName?: string;
}

export interface SectionTabBarProps<Id extends string> {
  tabs: ReadonlyArray<SectionTab<Id>>;
  activeTab: Id;
  onChange: (id: Id) => void;
  /**
   * Accent for the active tab's icon. Only `text-*` utilities are kept: the active segment is
   * the neutral Facet surface (`bg-background text-foreground`) so every domain reads the same.
   */
  activeClassName?: string;
  className?: string;
}

/** Keep only the text-colour utilities (incl. `dark:text-*`) from a legacy active class string. */
function iconAccent(classes: string | undefined): string {
  if (!classes) return "text-foreground";
  const kept = classes.split(/\s+/).filter((c) => /^(dark:)?text-[a-z]+-\d{2,3}$/.test(c));
  return kept.length > 0 ? kept.join(" ") : "text-foreground";
}

/**
 * The sub-tab bar shared by the MyCountry domain sections (Economy, Politics, Diplomacy,
 * Defense). A Facet segmented control: a muted track with the active tab lifted onto the
 * background surface. Tabs wrap onto a second row instead of scrolling or spilling out of the
 * main column, and long labels truncate inside their segment.
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
      className={cn("bg-muted/50 flex flex-wrap items-center gap-1 rounded-xl p-1", className)}
    >
      {tabs.map(({ id, label, icon: Icon, badge, activeClassName: tabActive }) => {
        const isActive = activeTab === id;
        return (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={isActive}
            tabIndex={isActive ? 0 : -1}
            title={label}
            data-state={isActive ? "active" : "inactive"}
            data-cuelume-press="page"
            data-cuelume-hover="tick"
            onClick={() => onChange(id)}
            className={cn(
              "focus-visible:ring-ring flex min-h-9 max-w-full min-w-0 cursor-pointer items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium transition-[color,background-color,box-shadow,transform] duration-150 outline-none focus-visible:ring-2 active:scale-[0.98]",
              isActive
                ? "bg-background text-foreground font-semibold shadow-xs"
                : "text-muted-foreground hover:text-foreground hover:bg-background/50"
            )}
          >
            <Icon
              className={cn(
                "h-4 w-4 shrink-0",
                isActive ? iconAccent(tabActive ?? activeClassName) : "text-muted-foreground"
              )}
            />
            <span className="truncate">{label}</span>
            {badge !== undefined && badge !== null && (
              <span
                className={cn(
                  "shrink-0 rounded-md px-1.5 text-xs tabular-nums",
                  isActive ? "bg-muted text-foreground" : "bg-muted/60 text-muted-foreground"
                )}
              >
                {badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
