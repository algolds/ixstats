"use client";

import React, { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { Dialog, DialogContent } from "~/components/ui/dialog";
import { VaultSubTabNav } from "../VaultSubTabNav";
import { api } from "~/trpc/react";
import type { CardInstance } from "~/types/cards-display";
import type { CardRarity } from "@prisma/client";
import { SUB_TABS, type SubTab } from "./cards/types";
import { useVaultCardsState } from "./cards/useVaultCardsState";
import { InventorySidebarContent } from "./cards/InventorySidebarContent";
import { CollectionsSidebarContent } from "./cards/CollectionsSidebarContent";
import { GallerySidebarContent } from "./cards/GallerySidebarContent";
import { InventoryTab } from "./cards/InventoryTab";
import { CollectionsTab } from "./cards/CollectionsTab";
import { CardGalleryTab } from "./cards/CardGalleryTab";

const LoreCardGenerator = dynamic(
  () => import("~/components/cards/lore/LoreCardGenerator").then((m) => m.LoreCardGenerator),
  { ssr: false }
);

export function VaultCardsSection() {
  const {
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
  } = useVaultCardsState();

  const [createCollectionOpen, setCreateCollectionOpen] = useState(false);
  const [loreGeneratorOpen, setLoreGeneratorOpen] = useState(false);

  const isDev = process.env.NODE_ENV === "development";

  // Gallery Filters State
  const [gallerySource, setGallerySource] = useState<"all" | "ns" | "lore">("all");
  const [gallerySearch, setGallerySearch] = useState("");
  const [gallerySeason, setGallerySeason] = useState<number | "all">("all");
  const [galleryRarity, setGalleryRarity] = useState<CardRarity | "all">("all");
  const [galleryCteFilter, setGalleryCteFilter] = useState<"all" | "cte_only" | "active_only">(
    "all"
  );
  const [gallerySortBy, setGallerySortBy] = useState("rarity");

  const { data: userStatsData } = api.vault.getUserStats.useQuery(undefined, {
    staleTime: 30000,
  });

  const { data: ownerships, isLoading: cardsLoading } = api.cards.getMyCards.useQuery({
    sortBy: sortBy as "acquired" | "rarity" | "value" | undefined,
    filterRarity: filters.rarity !== "all" ? filters.rarity : undefined,
  });

  const allCards: CardInstance[] = useMemo(() => {
    if (!ownerships) return [];
    return ownerships.map((ownership) => {
      const cardData = ownership.cards as unknown as Record<string, unknown>;
      return {
        id: String(cardData.id ?? ""),
        ownershipId: ownership.id,
        isLocked: ownership.isLocked,
        title: String(cardData.title ?? ""),
        description: String(cardData.description || ""),
        artwork: String(cardData.artwork || "/images/cards/placeholder-nation.png"),
        artworkVariants: (cardData.artworkVariants as any) || null,
        cardType: cardData.cardType as any,
        rarity: cardData.rarity as any,
        season: Number(cardData.season ?? 1),
        nsCardId: (cardData.nsCardId as string) || null,
        nsSeason: (cardData.nsSeason as number) || null,
        nsData: (cardData.nsData as any) || null,
        wikiSource: (cardData.wikiSource as string) || null,
        wikiArticleTitle: (cardData.wikiArticleTitle as string) || null,
        wikiUrl: (cardData.wikiUrl as string) || null,
        countryId: (cardData.countryId as string) || null,
        stats: (cardData.stats as any) || {},
        baseStats: (cardData.stats as any) || {},
        marketValue: Number(cardData.marketValue || 0),
        totalSupply: Number(cardData.totalSupply || 0),
        level: ownership.level ?? 1,
        evolutionStage: Number(cardData.evolutionStage || 0),
        enhancements: (cardData.enhancements as any) || null,
        serialNumber: ownership.serialNumber,
        experience: ownership.experience,
        lastSalePrice: ownership.lastSalePrice,
        lastSaleDate: ownership.lastSaleDate,
        acquiredAt: ownership.acquiredAt,
        createdAt: ownership.createdAt,
        updatedAt: ownership.updatedAt,
        lastTrade: (cardData.lastTrade as any) || null,
        country: (cardData.country as any) || null,
        owners: [],
      } as CardInstance;
    });
  }, [ownerships]);

  const totalValue = useMemo(() => {
    return allCards.reduce((sum, c) => sum + (c.marketValue || 0), 0);
  }, [allCards]);

  const capacityBoost = userStatsData?.cardCapacityBoost ?? 0;

  // Render current sidebar content
  const sidebarContent = useMemo(() => {
    if (activeTab === "collections") {
      return <CollectionsSidebarContent onCreateCollection={() => setCreateCollectionOpen(true)} />;
    }
    if (activeTab === "gallery" && isDev) {
      return (
        <GallerySidebarContent
          source={gallerySource}
          setSource={setGallerySource}
          search={gallerySearch}
          setSearch={setGallerySearch}
          season={gallerySeason}
          setSeason={setGallerySeason}
          rarity={galleryRarity}
          setRarity={setGalleryRarity}
          cteFilter={galleryCteFilter}
          setCteFilter={setGalleryCteFilter}
          sortBy={gallerySortBy}
          setSortBy={setGallerySortBy}
          onClearFilters={() => {
            setGallerySearch("");
            setGallerySeason("all");
            setGalleryRarity("all");
            setGalleryCteFilter("all");
          }}
          onRequestLoreCard={() => setLoreGeneratorOpen(true)}
        />
      );
    }
    return (
      <InventorySidebarContent
        totalCards={allCards.length}
        totalValue={totalValue}
        capacityBoost={capacityBoost}
        filters={filters}
        setFilters={setFilters}
        sortBy={sortBy}
        setSortBy={setSortBy}
        viewMode={viewMode}
        setViewMode={setViewMode}
        selectMode={selectMode}
        setSelectMode={setSelectMode}
        hideValue={hideValue}
        setHideValue={setHideValue}
        onResetFilters={resetFilters}
      />
    );
  }, [
    activeTab,
    allCards.length,
    totalValue,
    capacityBoost,
    filters,
    setFilters,
    sortBy,
    setSortBy,
    viewMode,
    setViewMode,
    selectMode,
    setSelectMode,
    hideValue,
    setHideValue,
    resetFilters,
    gallerySource,
    gallerySearch,
    gallerySeason,
    galleryRarity,
    galleryCteFilter,
    gallerySortBy,
  ]);

  return (
    <div className="space-y-4">
      {/* Sub-Tabs Nav Header - Right Aligned */}
      <div className="flex justify-end">
        <VaultSubTabNav
          tabs={SUB_TABS}
          activeTab={activeTab}
          onTabChange={(tabId) => setActiveTab(tabId as SubTab)}
          maxWidthClass="w-fit"
          layoutId="cards-subtab-indicator"
        />
      </div>

      {/* Tab Content */}
      {activeTab === "inventory" && (
        <InventoryTab
          ownerships={allCards}
          isLoading={cardsLoading}
          allCards={allCards}
          viewMode={viewMode}
          selectMode={selectMode}
          setSelectMode={setSelectMode}
          hideValue={hideValue}
          filters={filters}
          onResetFilters={resetFilters}
        />
      )}

      {activeTab === "collections" && (
        <CollectionsTab
          createOpen={createCollectionOpen}
          onCreateOpenChange={setCreateCollectionOpen}
        />
      )}

      {activeTab === "gallery" && isDev && (
        <CardGalleryTab
          source={gallerySource}
          search={gallerySearch}
          season={gallerySeason}
          rarity={galleryRarity}
          cteFilter={galleryCteFilter}
          sortBy={gallerySortBy}
          onSourceChange={setGallerySource}
          onSearchChange={setGallerySearch}
          onSeasonChange={setGallerySeason}
          onRarityChange={setGalleryRarity}
          onSortByChange={setGallerySortBy}
        />
      )}

      <Dialog open={loreGeneratorOpen} onOpenChange={setLoreGeneratorOpen}>
        <DialogContent className="max-w-xl">
          <LoreCardGenerator onRequestSubmitted={() => setLoreGeneratorOpen(false)} />
        </DialogContent>
      </Dialog>
    </div>
  );
}
