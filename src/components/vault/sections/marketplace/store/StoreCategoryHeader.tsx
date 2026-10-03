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

  return (
    <div className="mb-6 flex justify-center">
      <VaultSubTabNav tabs={formattedTabs} activeTab={activeTab} onTabChange={onTabChange} />
    </div>
  );
}
