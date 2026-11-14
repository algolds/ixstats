"use client";

import React from "react";
import { cn } from "~/lib/utils";
import { SegmentedControl } from "~/components/ui/segmented-control";

interface SectionTab<Id extends string> {
  id: Id;
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  /** Optional count shown after the label. */
  badge?: React.ReactNode;
  activeClassName?: string;
}

interface SectionTabBarProps<Id extends string> {
  tabs: ReadonlyArray<SectionTab<Id>>;
  activeTab: Id;
  onChange: (id: Id) => void;
  activeClassName?: string;
  /** Accessible name of the tab list. */
  "aria-label"?: string;
  className?: string;
}

/**
 * Secondary sub-view control shared by the MyCountry domain sections (Economy, Politics,
 * Diplomacy, Defense): a compact Facet `SegmentedControl` (`size="sm"`) exposed as a tablist so
 * it reads visibly calmer than the primary `DocumentRibbon` above it. Labels never truncate; on
 * narrow screens the strip scrolls horizontally.
 */
export function SectionTabBar<Id extends string>({
  tabs,
  activeTab,
  onChange,
  "aria-label": ariaLabel = "Sections",
  className,
}: SectionTabBarProps<Id>): React.JSX.Element {
  return (
    <SegmentedControl<Id>
      asTabs
      scrollable
      size="sm"
      aria-label={ariaLabel}
      className={cn("max-w-full", className)}
      value={activeTab}
      onValueChange={onChange}
      options={tabs.map(({ id, label, badge }) => ({
        value: id,
        label,
        "aria-label": label,
        badge: badge ?? undefined,
        badgeLabel: typeof badge === "number" || typeof badge === "string" ? `${badge}` : undefined,
      }))}
    />
  );
}
