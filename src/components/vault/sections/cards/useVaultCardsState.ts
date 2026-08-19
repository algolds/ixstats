import { useState, useCallback } from "react";
import { usePathname } from "next/navigation";
import { getSubTabFromPathname } from "../../VaultSidebarNav";
import type { SubTab, ViewMode, FilterState } from "./types";

const isDev = process.env.NODE_ENV === "development";

export function resolveInitialTab(initialTab: string | null | undefined): SubTab {
  if (initialTab === "collections") return "collections";
  if (
    isDev &&
    (initialTab === "gallery" || initialTab === "lore-gallery" || initialTab === "ns-library")
  )
    return "gallery";
  return "inventory";
}

export function useVaultCardsState() {
  const pathname = usePathname();
  const [activeTab, setActiveTab] = useState<SubTab>(() => {
    const subTab = getSubTabFromPathname(pathname);
    return resolveInitialTab(subTab);
  });

  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [sortBy, setSortBy] = useState<string>("acquired");
  const [selectMode, setSelectMode] = useState(false);
  const [hideValue, setHideValue] = useState(false);
  const [filters, setFilters] = useState<FilterState>({
    search: "",
    rarity: "all",
    cardType: "all",
    season: "all",
    minLevel: 1,
    maxLevel: 100,
    minValue: 0,
    maxValue: 999999,
  });

  const resetFilters = useCallback(() => {
    setFilters({
      search: "",
      rarity: "all",
      cardType: "all",
      season: "all",
      minLevel: 1,
      maxLevel: 100,
      minValue: 0,
      maxValue: 999999,
    });
  }, []);

  return {
    activeTab,
    setActiveTab,
    viewMode,
    setViewMode,
    sortBy,
    setSortBy,
    selectMode,
    setSelectMode,
    hideValue,
    setHideValue,
    filters,
    setFilters,
    resetFilters,
  };
}
