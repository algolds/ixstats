"use client";

import React, { useState, useMemo, useEffect } from "react";
import { api } from "~/trpc/react";
import { useNotify } from "~/hooks/useNotify";
import { FacetCard } from "~/components/ui/facet-container";
import type { CardRarity } from "@prisma/client";
import { CardDetailsModal } from "~/components/cards/display/CardDetailsModal";
import { LoreCategory, ArtworkSource } from "~/lib/cards/category-enums";
import type { CardInstance } from "~/types/cards-display";

import {
  CardExplorerFilters,
  type CardTypeFilter,
  type SortByOption,
} from "./explorer/CardExplorerFilters";
import { CardExplorerBatchBar } from "./explorer/CardExplorerBatchBar";
import { CardExplorerTable } from "./explorer/CardExplorerTable";
import { CardEditDialog } from "./explorer/CardEditDialog";

const PAGE_SIZE = 25;

interface AdminCardExplorerProps {
  initialCategory?: LoreCategory | "all";
}

export function AdminCardExplorer({ initialCategory = "all" }: AdminCardExplorerProps = {}) {
  const notify = useNotify();

  const [search, setSearch] = useState("");
  const [cardTypeFilter, setCardTypeFilter] = useState<CardTypeFilter>("all");
  const [categoryFilter, setCategoryFilter] = useState<LoreCategory | "all">(initialCategory);
  const [cteFilter, setCteFilter] = useState<"all" | "cte_only" | "active_only">("all");
  const [takedownFilter, setTakedownFilter] = useState<"all" | "visible" | "takedown">("all");
  const [season, setSeason] = useState<number | "all">("all");
  const [rarity, setRarity] = useState<CardRarity | "all">("all");
  const [sortBy, setSortBy] = useState<SortByOption>("recent");
  const [offset, setOffset] = useState(0);

  // Sync category filter if initialCategory changes
  useEffect(() => {
    if (initialCategory) {
      setCategoryFilter(initialCategory);
    }
  }, [initialCategory]);

  // 3D Card Modal Viewer state
  const [selectedCardForViewer, setSelectedCardForViewer] = useState<CardInstance | null>(null);

  // Live Card Studio / Edit Modal state
  const [selectedCardForEdit, setSelectedCardForEdit] = useState<CardInstance | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editCategory, setEditCategory] = useState<LoreCategory | "">("");
  const [editCardType, setEditCardType] = useState<string>("LORE");
  const [editRarity, setEditRarity] = useState<CardRarity>("COMMON");
  const [editArtworkUrl, setEditArtworkUrl] = useState("");
  const [editArtworkSource, setEditArtworkSource] = useState<ArtworkSource>("PROCEDURAL");
  const [editMarketValue, setEditMarketValue] = useState(0);
  const [editIsRetired, setEditIsRetired] = useState(false);

  // Bulk visibility control states
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [bulkTargetType, setBulkTargetType] = useState<
    "all" | "NS_IMPORT" | "LORE" | "USER_CUSTOM" | "COMMONS_IMPORT"
  >("all");
  const [bulkCteFilter, setBulkCteFilter] = useState<"all" | "active" | "cte">("all");
  const [bulkCategoryFilter, setBulkCategoryFilter] = useState<"all" | LoreCategory>("all");
  const [bulkSeason, setBulkSeason] = useState<"all" | "1" | "2" | "3">("all");
  const [bulkRarity, setBulkRarity] = useState<"all" | CardRarity>("all");

  const queryInput = {
    limit: PAGE_SIZE,
    offset,
    search: search || undefined,
    categoryFilter: categoryFilter !== "all" ? categoryFilter : undefined,
    cardTypeFilter,
    season: season !== "all" ? season : undefined,
    rarity: rarity !== "all" ? rarity : undefined,
    cteFilter,
    isRetired:
      takedownFilter === "takedown" ? true : takedownFilter === "visible" ? false : undefined,
    includeRetired: takedownFilter === "all" ? true : undefined,
    sortBy,
  };

  const { data, isLoading, refetch } = api.cards.getNSCards.useQuery(queryInput);

  const bulkVisibilityMutation = api.cards.bulkToggleVisibility.useMutation({
    onSuccess: (res) => {
      notify.success("Bulk Update Complete", res.message);
      setIsBulkModalOpen(false);
      void refetch();
    },
    onError: (err) => {
      notify.error("Bulk Update Failed", err.message);
    },
  });

  const updateDetailsMutation = api.cards.updateCardDetails.useMutation({
    onSuccess: () => {
      notify.success("Card updated", "Card details updated successfully.");
      void refetch();
    },
    onError: (err) => {
      notify.error("Update failed", err.message);
    },
  });

  const total = data?.total ?? 0;
  const cards = data?.cards ?? [];

  const handleOpen3DViewer = (card: any) => {
    const artUrl = card.artworkUrl || card.artwork || card.wikiImageUrl || "";
    const isWikiCard =
      card.cardType === "LORE" ||
      card.cardType === "LORE_BATCH" ||
      Boolean(card.category && card.category !== "NS_IMPORT") ||
      Boolean(card.wikiPageId) ||
      Boolean(card.wikiSource) ||
      Boolean(card.slug);

    const initialArtSource: ArtworkSource =
      card.artworkSource && card.artworkSource !== "PROCEDURAL"
        ? card.artworkSource
        : artUrl
          ? "WIKI_FETCHED"
          : "PROCEDURAL";

    const instance: CardInstance = {
      ...card,
      artwork: artUrl,
      artworkUrl: artUrl,
      artworkSource: initialArtSource,
      cardType: isWikiCard ? "LORE" : card.cardType || "NS_IMPORT",
      category:
        card.category && card.category !== "NS_IMPORT"
          ? (card.category as LoreCategory)
          : isWikiCard
            ? "NATION"
            : undefined,
    };

    setSelectedCardForViewer(instance);
  };

  const handleOpenEditModal = (card: any) => {
    const artUrl = card.artworkUrl || card.artwork || card.wikiImageUrl || "";
    const isWikiCard =
      card.cardType === "LORE" ||
      card.cardType === "LORE_BATCH" ||
      Boolean(card.category && card.category !== "NS_IMPORT") ||
      Boolean(card.wikiPageId) ||
      Boolean(card.wikiSource) ||
      Boolean(card.slug);

    const initCat: LoreCategory | "" =
      card.category && card.category !== "NS_IMPORT"
        ? (card.category as LoreCategory)
        : isWikiCard
          ? "NATION"
          : "";

    const initialCardType = isWikiCard
      ? "LORE"
      : card.cardType || (card.nsCardId ? "NS_IMPORT" : "LORE");

    const initialArtSource: ArtworkSource =
      card.artworkSource && card.artworkSource !== "PROCEDURAL"
        ? card.artworkSource
        : artUrl
          ? "WIKI_FETCHED"
          : "PROCEDURAL";

    const instance: CardInstance = {
      ...card,
      artwork: artUrl,
      artworkUrl: artUrl,
      cardType: initialCardType,
      category: initCat || undefined,
      artworkSource: initialArtSource,
    };

    setSelectedCardForEdit(instance);
    setEditTitle(card.title || "");
    setEditCategory(initCat);
    setEditCardType(initialCardType);
    setEditRarity(card.rarity || "COMMON");
    setEditArtworkUrl(artUrl);
    setEditArtworkSource(initialArtSource);
    setEditMarketValue(card.marketValue || 0);
    setEditIsRetired(card.isRetired || false);
  };

  const livePreviewCard = useMemo(() => {
    if (!selectedCardForEdit) return null;
    return {
      ...selectedCardForEdit,
      title: editTitle,
      category: editCategory || undefined,
      cardType: editCardType,
      rarity: editRarity,
      artworkUrl: editArtworkUrl,
      artwork: editArtworkUrl,
      artworkSource: editArtworkSource,
      marketValue: editMarketValue,
      isRetired: editIsRetired,
    } as CardInstance;
  }, [
    selectedCardForEdit,
    editTitle,
    editCategory,
    editCardType,
    editRarity,
    editArtworkUrl,
    editArtworkSource,
    editMarketValue,
    editIsRetired,
  ]);

  const handleSaveTitle = (cardId: string, title: string) => {
    if (!title.trim()) return;
    updateDetailsMutation.mutate({ cardId, title: title.trim() });
  };

  const handleSaveValue = (cardId: string, marketValue: number) => {
    if (marketValue < 0) return;
    updateDetailsMutation.mutate({ cardId, marketValue });
  };

  const handleToggleTakedown = (cardId: string, currentStatus: boolean) => {
    updateDetailsMutation.mutate({ cardId, isRetired: !currentStatus });
  };

  const handleSaveModalCard = () => {
    if (!selectedCardForEdit) return;
    updateDetailsMutation.mutate({
      cardId: selectedCardForEdit.id,
      title: editTitle,
      category: (editCategory as LoreCategory) || undefined,
      cardType: editCardType,
      rarity: editRarity,
      artworkUrl: editArtworkUrl || null,
      artworkSource: editArtworkSource,
      marketValue: editMarketValue,
      isRetired: editIsRetired,
    });
    setSelectedCardForEdit(null);
  };

  const handleBulkExecute = (isRetired: boolean) => {
    bulkVisibilityMutation.mutate({
      isRetired,
      cardTypeFilter: bulkTargetType,
      cteFilter: bulkCteFilter,
      categoryFilter: bulkCategoryFilter,
      season: bulkSeason,
      rarity: bulkRarity,
    });
  };

  return (
    <FacetCard
      depth={2}
      className="border-border bg-card/70 text-card-foreground space-y-6 rounded-2xl border p-6 shadow-xl backdrop-blur-xl"
    >
      <CardExplorerBatchBar
        total={total}
        loadedCount={cards.length}
        isBulkModalOpen={isBulkModalOpen}
        setIsBulkModalOpen={setIsBulkModalOpen}
        bulkTargetType={bulkTargetType}
        setBulkTargetType={setBulkTargetType}
        bulkCteFilter={bulkCteFilter}
        setBulkCteFilter={setBulkCteFilter}
        bulkCategoryFilter={bulkCategoryFilter}
        setBulkCategoryFilter={setBulkCategoryFilter}
        bulkSeason={bulkSeason}
        setBulkSeason={setBulkSeason}
        bulkRarity={bulkRarity}
        setBulkRarity={setBulkRarity}
        onBulkExecute={handleBulkExecute}
        isPending={bulkVisibilityMutation.isPending}
      />

      <CardExplorerFilters
        search={search}
        setSearch={setSearch}
        cardTypeFilter={cardTypeFilter}
        setCardTypeFilter={setCardTypeFilter}
        categoryFilter={categoryFilter}
        setCategoryFilter={setCategoryFilter}
        cteFilter={cteFilter}
        setCteFilter={setCteFilter}
        takedownFilter={takedownFilter}
        setTakedownFilter={setTakedownFilter}
        season={season}
        setSeason={setSeason}
        rarity={rarity}
        setRarity={setRarity}
        sortBy={sortBy}
        setSortBy={setSortBy}
        setOffset={setOffset}
      />

      <CardExplorerTable
        cards={cards}
        total={total}
        offset={offset}
        pageSize={PAGE_SIZE}
        isLoading={isLoading}
        onPageChange={(page) => setOffset((page - 1) * PAGE_SIZE)}
        onOpen3DViewer={handleOpen3DViewer}
        onOpenEditModal={handleOpenEditModal}
        onSaveTitle={handleSaveTitle}
        onSaveValue={handleSaveValue}
        onToggleTakedown={handleToggleTakedown}
        isPending={updateDetailsMutation.isPending}
      />

      <CardEditDialog
        isOpen={Boolean(selectedCardForEdit)}
        onClose={() => setSelectedCardForEdit(null)}
        selectedCardForEdit={selectedCardForEdit}
        livePreviewCard={livePreviewCard}
        editTitle={editTitle}
        setEditTitle={setEditTitle}
        editCategory={editCategory}
        setEditCategory={setEditCategory}
        editCardType={editCardType}
        setEditCardType={setEditCardType}
        editRarity={editRarity}
        setEditRarity={setEditRarity}
        editArtworkUrl={editArtworkUrl}
        setEditArtworkUrl={setEditArtworkUrl}
        editArtworkSource={editArtworkSource}
        setEditArtworkSource={setEditArtworkSource}
        editMarketValue={editMarketValue}
        setEditMarketValue={setEditMarketValue}
        editIsRetired={editIsRetired}
        setEditIsRetired={setEditIsRetired}
        onSave={handleSaveModalCard}
        isPending={updateDetailsMutation.isPending}
      />

      <CardDetailsModal
        card={selectedCardForViewer}
        open={Boolean(selectedCardForViewer)}
        onClose={() => setSelectedCardForViewer(null)}
      />
    </FacetCard>
  );
}
