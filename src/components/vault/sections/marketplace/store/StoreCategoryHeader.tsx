"use client";

import React from "react";
import { VaultSubTabNav, type VaultTabConfig } from "~/components/vault/VaultSubTabNav";

interface StoreCategoryHeaderProps<T extends string> {
  tabs: readonly VaultTabConfig<T>[];
  activeTab: T;
  onTabChange: (tabId: T) => void;
  myPacksCount?: number;
}

export function StoreCategoryHeader<T extends string>({
  tabs,
  activeTab,
  onTabChange,
  myPacksCount,
}: StoreCategoryHeaderProps<T>) {
  const formattedTabs = tabs.map((tab) => ({
    ...tab,
    badgeCount: tab.id === "my-packs" ? myPacksCount : undefined,
  }));

  // A block, not a flex row: a row sized the tabs to their content and centred them past both edges of a phone's
  // window. In a block the track takes the window's width (up to max-w-xl, where all four fit) and scrolls below it.
  return (
    <div className="mb-6">
      <VaultSubTabNav
        tabs={formattedTabs}
        activeTab={activeTab}
        onTabChange={onTabChange}
        className="mx-auto"
      />
    </div>
  );
}
