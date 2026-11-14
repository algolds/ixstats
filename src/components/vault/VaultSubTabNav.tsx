import React from "react";
import { cn } from "~/lib/utils";
import { SegmentedControl } from "~/components/ui/segmented-control";

export interface VaultTabConfig<T extends string> {
  id: T;
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  badgeCount?: number;
}

interface VaultSubTabNavProps<T extends string> {
  tabs: readonly VaultTabConfig<T>[];
  activeTab: T;
  onTabChange: (tabId: T) => void;
  className?: string;
  maxWidthClass?: string;
}

/**
 * The vault's in-page section switcher: a natural-width `SegmentedControl` exposed as tabs. No tab is narrower than its
 * label; where they do not all fit (a phone), the track scrolls rather than clipping them.
 */
export function VaultSubTabNav<T extends string>({
  tabs,
  activeTab,
  onTabChange,
  className,
  maxWidthClass = "max-w-full",
}: VaultSubTabNavProps<T>) {
  return (
    <SegmentedControl<T>
      asTabs
      scrollable
      itemClassName="min-w-max max-[24rem]:[&_svg]:hidden"
      aria-label="Sections"
      value={activeTab}
      onValueChange={onTabChange}
      className={cn(maxWidthClass, className)}
      options={tabs.map((tab) => {
        const Icon = tab.icon;
        return {
          value: tab.id,
          icon: Icon ? <Icon /> : undefined,
          label:
            tab.badgeCount !== undefined && tab.badgeCount > 0 ? (
              <>
                {tab.label}
                <span className="bg-tint-fill text-tint-ink text-caption ml-1 rounded-full px-1.5 tabular-nums">
                  {tab.badgeCount}
                </span>
              </>
            ) : (
              tab.label
            ),
          "aria-label": tab.badgeCount ? `${tab.label} (${tab.badgeCount})` : undefined,
        };
      })}
    />
  );
}
