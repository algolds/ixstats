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
import { InventoryTab } from "./cards/InventoryTab";
import { CollectionsTab } from "./cards/CollectionsTab";
import { CardGalleryTab } from "./cards/CardGalleryTab";
import { ownedCardToInstance } from "~/lib/cards/ownership-card";

const LoreCardGenerator = dynamic(
  () => import("~/components/cards/lore/LoreCardGenerator").then((m) => m.LoreCardGenerator),
  { ssr: false }
);

export function VaultCardsSection() {
  const {
    activeTab,
    setActiveTab,
    viewMode,
    sortBy,
    selectMode,
    setSelectMode,
    hideValue,
    filters,
    resetFilters,
  } = useVaultCardsState();

  const [createCollectionOpen, setCreateCollectionOpen] = useState(false);
  const [loreGeneratorOpen, setLoreGeneratorOpen] = useState(false);

  // Gallery Filters State
  const [gallerySource, setGallerySource] = useState<"all" | "ns" | "lore">("lore");
  const [gallerySearch, setGallerySearch] = useState("");
  const [gallerySeason, setGallerySeason] = useState<number | "all">("all");
  const [galleryRarity, setGalleryRarity] = useState<CardRarity | "all">("all");
  const [gallerySortBy, setGallerySortBy] = useState("rarity");

  const { data: ownerships, isLoading: cardsLoading } = api.cards.getMyCards.useQuery({
    sortBy: sortBy as "acquired" | "rarity" | "value" | undefined,
    filterRarity: filters.rarity !== "all" ? filters.rarity : undefined,
  });

  const allCards: CardInstance[] = useMemo(
    () => (ownerships ?? []).map(ownedCardToInstance),
    [ownerships]
  );

  return (
    <div className="space-y-4">
      {/* Sub-Tabs Nav Header - Right Aligned */}
      <div className="flex justify-end">
        <VaultSubTabNav
          tabs={SUB_TABS}
          activeTab={activeTab}
          onTabChange={(tabId) => setActiveTab(tabId as SubTab)}
          maxWidthClass="w-fit"
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

      {activeTab === "gallery" && (
        <CardGalleryTab
          source={gallerySource}
          search={gallerySearch}
          season={gallerySeason}
          rarity={galleryRarity}
          cteFilter="all"
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
