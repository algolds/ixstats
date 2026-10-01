import React from "react";
import { cn } from "~/lib/utils";
import { SegmentedControl } from "~/components/ui/segmented-control";

export interface VaultTabConfig<T extends string> {
  id: T;
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  badgeCount?: number;
}

export interface VaultSubTabNavProps<T extends string> {
  tabs: readonly VaultTabConfig<T>[];
  activeTab: T;
  onTabChange: (tabId: T) => void;
  /** @deprecated Ignored — the selection uses the app tint (Facet 3). */
  activeColor?: {
    text: string;
    bg: string;
    icon: string;
  };
  /** @deprecated Ignored — the selection uses the app tint (Facet 3). */
  tabColors?: Record<string, { text: string; bg: string; icon: string }>;
  className?: string;
  maxWidthClass?: string;
  /** @deprecated Ignored (the segmented control animates its own indicator). */
  layoutId?: string;
}

/** The vault's in-page section switcher: a full-width `SegmentedControl` exposed as tabs. */
export function VaultSubTabNav<T extends string>({
  tabs,
  activeTab,
  onTabChange,
  className,
  maxWidthClass = "sm:max-w-md",
}: VaultSubTabNavProps<T>) {
  return (
    <SegmentedControl<T>
      asTabs
      fullWidth
      aria-label="Sections"
      value={activeTab}
      onValueChange={onTabChange}
      className={cn("w-full", maxWidthClass, className)}
      options={tabs.map((tab) => {
        const Icon = tab.icon;
        return {
          value: tab.id,
          icon: Icon ? <Icon /> : undefined,
          label:
            tab.badgeCount !== undefined && tab.badgeCount > 0 ? (
              <>
                {tab.label}
                <span className="bg-tint text-on-tint text-caption ml-1 rounded-full px-1.5 tabular-nums">
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
