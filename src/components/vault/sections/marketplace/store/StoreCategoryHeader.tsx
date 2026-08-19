"use client";

import React from "react";
import { VaultSubTabNav, type VaultTabConfig } from "~/components/vault/VaultSubTabNav";

export interface StoreCategoryHeaderProps<T extends string> {
  tabs: readonly VaultTabConfig<T>[];
  activeTab: T;
  onTabChange: (tabId: T) => void;
  activeColor: {
    text: string;
    bg: string;
    icon: string;
  };
  tabColors: Record<string, { text: string; bg: string; icon: string }>;
  myPacksCount?: number;
}

export function StoreCategoryHeader<T extends string>({
  tabs,
  activeTab,
  onTabChange,
  activeColor,
  tabColors,
  myPacksCount,
}: StoreCategoryHeaderProps<T>) {
  const formattedTabs = tabs.map((tab) => ({
    ...tab,
    badgeCount: tab.id === "my-packs" ? myPacksCount : undefined,
  }));

  return (
    <div className="mb-6 flex justify-center">
      <VaultSubTabNav
        tabs={formattedTabs}
        activeTab={activeTab}
        onTabChange={onTabChange}
        activeColor={activeColor}
        tabColors={tabColors}
        layoutId="store-sub-tab-indicator"
      />
    </div>
  );
}
