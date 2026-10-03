"use client";

import React from "react";
import { cn } from "~/lib/utils";
import { SegmentedControl } from "~/components/ui/segmented-control";

interface SectionTab<Id extends string> {
  id: Id;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  /** Optional count shown after the label. */
  badge?: React.ReactNode;
  /**
   * Active-state accent for this tab's icon; falls back to the bar's `activeClassName`.
   * Only the text colour is used — the selected segment itself is the neutral Facet thumb.
   */
  activeClassName?: string;
}

interface SectionTabBarProps<Id extends string> {
  tabs: ReadonlyArray<SectionTab<Id>>;
  activeTab: Id;
  onChange: (id: Id) => void;
  /**
   * Accent for the active tab's icon. Only text-colour utilities are kept: the selected segment
   * is the neutral Facet thumb so every domain reads the same.
   */
  activeClassName?: string;
  /** Accessible name of the tab list. */
  "aria-label"?: string;
  className?: string;
}

/** Keep only the text-colour utilities (role or system colour) from an accent class string. */
function iconAccent(classes: string | undefined): string {
  if (!classes) return "text-label";
  const kept = classes
    .split(/\s+/)
    .filter((c) => /^text-[a-z]+(?:-[a-z]+)*$/.test(c) && !/^text-(?:left|center|right)$/.test(c));
  return kept.length > 0 ? kept.join(" ") : "text-label";
}

/**
 * The sub-tab bar shared by the MyCountry domain sections (Economy, Politics, Diplomacy,
 * Defense): a Facet `SegmentedControl` exposed as a tablist. More than five sections
 * scroll horizontally; the active section's icon takes the domain accent and counts sit in the
 * segment's badge slot.
 */
export function SectionTabBar<Id extends string>({
  tabs,
  activeTab,
  onChange,
  activeClassName,
  "aria-label": ariaLabel = "Sections",
  className,
}: SectionTabBarProps<Id>): React.JSX.Element {
  return (
    <SegmentedControl<Id>
      asTabs
      aria-label={ariaLabel}
      className={cn("max-w-full", className)}
      value={activeTab}
      onValueChange={onChange}
      options={tabs.map(({ id, label, icon: Icon, badge, activeClassName: tabActive }) => ({
        value: id,
        label: <span className="truncate">{label}</span>,
        "aria-label": label,
        icon: (
          <Icon
            className={cn(
              "h-4 w-4 shrink-0",
              activeTab === id ? iconAccent(tabActive ?? activeClassName) : "text-label-secondary"
            )}
          />
        ),
        badge: badge ?? undefined,
        badgeLabel: typeof badge === "number" || typeof badge === "string" ? `${badge}` : undefined,
      }))}
    />
  );
}
