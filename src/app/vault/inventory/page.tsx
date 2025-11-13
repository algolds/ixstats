"use client";

import { useState } from "react";
import { Card, CardContent } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import {
  Layers,
  TrendingUp,
  CheckSquare,
  Folder,
  ShoppingBag,
  Trash2,
  Filter,
  SortAsc,
  Copy,
} from "lucide-react";
import { cn } from "~/lib/utils";
import { toast } from "sonner";
import { api } from "~/trpc/react";
import { CardGrid, CardDetailsModal } from "~/components/cards/display";
import type { CardInstance } from "~/types/cards-display";

export default function InventoryPage() {
  const [selectMode, setSelectMode] = useState(false);
  const [selectedCards, setSelectedCards] = useState<string[]>([]);
  const [showDuplicatesOnly, setShowDuplicatesOnly] = useState(false);
  const [sortBy, setSortBy] = useState<string>("acquired");
  const [filterRarity, setFilterRarity] = useState<string>("all");
  const [filterSeason, setFilterSeason] = useState<string>("all");
  const [filterCollection, setFilterCollection] = useState<string>("all");
  const [selectedCard, setSelectedCard] = useState<CardInstance | null>(null);

  // Fetch user's cards
  const { data: ownerships, isLoading } = api.cards.getMyCards.useQuery({
    sortBy: sortBy as any,
    filterRarity: filterRarity !== "all" ? (filterRarity as any) : undefined,
  });

  // Transform ownership data to CardInstance format
  const cards: CardInstance[] = ownerships?.map((ownership: any) => ({
    id: ownership.cards.id,
    title: ownership.cards.title,
    description: ownership.cards.description || "",
    artwork: ownership.cards.artwork || "/images/cards/placeholder-nation.png",
    artworkVariants: ownership.cards.artworkVariants || null,
    cardType: ownership.cards.cardType,
    rarity: ownership.cards.rarity,
    season: ownership.cards.season,
    nsCardId: ownership.cards.nsCardId || null,
    nsSeason: ownership.cards.nsSeason || null,
    nsData: ownership.cards.nsData || null,
    wikiSource: ownership.cards.wikiSource || null,
    wikiArticleTitle: ownership.cards.wikiArticleTitle || null,
    wikiUrl: ownership.cards.wikiUrl || null,
    countryId: ownership.cards.countryId,
    stats: ownership.cards.stats || {},
    marketValue: ownership.cards.marketValue || 0,
    totalSupply: ownership.cards.totalSupply || 0,
    level: ownership.cards.level || 1,
    evolutionStage: ownership.cards.evolutionStage || 0,
    enhancements: ownership.cards.enhancements || null,
    createdAt: ownership.cards.createdAt,
    updatedAt: ownership.cards.updatedAt,
    lastTrade: ownership.cards.lastTrade || null,
    country: ownership.cards.country,
    owners: [], // Not needed for inventory view
  })) || [];

  const totalCards = cards.length;
  const totalValue = cards.reduce((sum, card) => sum + card.marketValue, 0);
  const duplicateCount = 0; // TODO: Calculate actual duplicates

  const handleBulkAddToCollection = () => {
    if (selectedCards.length === 0) {
      toast.error("No cards selected");
      return;
    }
    // TODO: Open collection selection modal
    toast.success(`Adding ${selectedCards.length} cards to collection`);
  };

  const handleBulkListForAuction = () => {
    if (selectedCards.length === 0) {
      toast.error("No cards selected");
      return;
    }
    // TODO: Open bulk auction creation modal
    toast.success(`Listing ${selectedCards.length} cards for auction`);
  };

  const handleBulkJunk = () => {
    if (selectedCards.length === 0) {
      toast.error("No cards selected");
      return;
    }
    // TODO: Confirm and delete
    toast.success(`Junked ${selectedCards.length} cards`);
    setSelectedCards([]);
  };

  const handleQuickJunkDuplicates = () => {
    // TODO: Confirm and delete all duplicates
    toast.success(`Junked ${duplicateCount} duplicate cards`);
  };

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="space-y-2">
        <h1 className="text-2xl sm:text-3xl font-bold text-gold-400">Inventory</h1>
        <p className="text-sm sm:text-base text-muted-foreground">
          Manage all your cards in one place
        </p>
      </div>

      {/* Stats summary */}
      <div className="grid gap-3 sm:gap-4 grid-cols-1 xs:grid-cols-2 md:grid-cols-3">
        <Card className="glass-hierarchy-child">
          <CardContent className="flex items-center gap-4 p-6">
            <div className="rounded-full bg-gold-500/10 p-3">
              <Layers className="h-6 w-6 text-gold-400" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Cards</p>
              <p className="text-2xl font-bold text-gold-400">{totalCards}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-hierarchy-child">
          <CardContent className="flex items-center gap-4 p-6">
            <div className="rounded-full bg-green-500/10 p-3">
              <TrendingUp className="h-6 w-6 text-green-400" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Value</p>
              <p className="text-2xl font-bold text-green-400">
                {totalValue.toLocaleString()} IxC
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-hierarchy-child">
          <CardContent className="flex items-center gap-4 p-6">
            <div className="rounded-full bg-purple-500/10 p-3">
              <Copy className="h-6 w-6 text-purple-400" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Duplicates</p>
              <p className="text-2xl font-bold text-purple-400">
                {duplicateCount}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <div className="text-center space-y-3">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gold-400 mx-auto"></div>
            <p className="text-sm text-muted-foreground">Loading your cards...</p>
          </div>
        </div>
      )}

      {/* Bulk actions toolbar */}
      {!isLoading && selectMode && (
        <Card className="glass-hierarchy-child">
          <CardContent className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3 sm:p-4">
            <div className="flex items-center gap-2">
              <CheckSquare className="h-4 w-4 sm:h-5 sm:w-5 text-gold-400" />
              <span className="text-sm sm:text-base font-semibold">
                {selectedCards.length} card{selectedCards.length !== 1 ? "s" : ""} selected
              </span>
            </div>
            <div className="flex flex-wrap gap-2 w-full sm:w-auto">
              <Button
                variant="outline"
                size="sm"
                onClick={handleBulkAddToCollection}
              >
                <Folder className="mr-2 h-4 w-4" />
                Add to Collection
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleBulkListForAuction}
              >
                <ShoppingBag className="mr-2 h-4 w-4" />
                List for Auction
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleBulkJunk}
                className="text-red-400 hover:bg-red-500/10"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Junk
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSelectMode(false);
                  setSelectedCards([]);
                }}
              >
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Controls */}
      <Card className="glass-hierarchy-child">
        <CardContent className="p-3 sm:p-4">
          <div className="flex flex-col sm:flex-row flex-wrap items-start sm:items-center gap-3 sm:gap-4">
            {/* Select mode toggle */}
            <div className="flex items-center gap-2">
              <Checkbox
                id="select-mode"
                checked={selectMode}
                onCheckedChange={(checked) => setSelectMode(checked as boolean)}
              />
              <label
                htmlFor="select-mode"
                className="cursor-pointer text-sm font-medium"
              >
                Select Mode
              </label>
            </div>

            {/* Duplicates filter */}
            <div className="flex items-center gap-2">
              <Checkbox
                id="duplicates-only"
                checked={showDuplicatesOnly}
                onCheckedChange={(checked) =>
                  setShowDuplicatesOnly(checked as boolean)
                }
              />
              <label
                htmlFor="duplicates-only"
                className="cursor-pointer text-sm font-medium"
              >
                Show Duplicates Only
              </label>
            </div>

            {showDuplicatesOnly && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleQuickJunkDuplicates}
                className="text-red-400"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Quick Junk All Duplicates
              </Button>
            )}

            <div className="w-full sm:w-auto sm:ml-auto flex flex-col xs:flex-row gap-2">
              {/* Sort */}
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-[180px] glass-hierarchy-child">
                  <SortAsc className="mr-2 h-4 w-4" />
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent className="glass-hierarchy-interactive">
                  <SelectItem value="acquired">Acquisition Date</SelectItem>
                  <SelectItem value="rarity">Rarity</SelectItem>
                  <SelectItem value="value">Market Value</SelectItem>
                </SelectContent>
              </Select>

              {/* Rarity filter */}
              <Select value={filterRarity} onValueChange={setFilterRarity}>
                <SelectTrigger className="w-[150px] glass-hierarchy-child">
                  <Filter className="mr-2 h-4 w-4" />
                  <SelectValue placeholder="Rarity" />
                </SelectTrigger>
                <SelectContent className="glass-hierarchy-interactive">
                  <SelectItem value="all">All Rarities</SelectItem>
                  <SelectItem value="common">Common</SelectItem>
                  <SelectItem value="uncommon">Uncommon</SelectItem>
                  <SelectItem value="rare">Rare</SelectItem>
                  <SelectItem value="epic">Epic</SelectItem>
                  <SelectItem value="legendary">Legendary</SelectItem>
                </SelectContent>
              </Select>

              {/* Season filter */}
              <Select value={filterSeason} onValueChange={setFilterSeason}>
                <SelectTrigger className="w-[150px] glass-hierarchy-child">
                  <Filter className="mr-2 h-4 w-4" />
                  <SelectValue placeholder="Season" />
                </SelectTrigger>
                <SelectContent className="glass-hierarchy-interactive">
                  <SelectItem value="all">All Seasons</SelectItem>
                  <SelectItem value="s1">Season 1</SelectItem>
                  <SelectItem value="s2">Season 2</SelectItem>
                  <SelectItem value="s3">Season 3</SelectItem>
                </SelectContent>
              </Select>

              {/* Collection filter */}
              <Select
                value={filterCollection}
                onValueChange={setFilterCollection}
              >
                <SelectTrigger className="w-[180px] glass-hierarchy-child">
                  <Filter className="mr-2 h-4 w-4" />
                  <SelectValue placeholder="Collection" />
                </SelectTrigger>
                <SelectContent className="glass-hierarchy-interactive">
                  <SelectItem value="all">All Collections</SelectItem>
                  {/* TODO: Populate from user's collections */}
                  <SelectItem value="none">No Collection</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Card grid */}
      {!isLoading && (
        <CardGrid
          cards={cards}
          loading={false}
          onCardClick={(card) => setSelectedCard(card)}
          cardSize="medium"
          emptyMessage="No cards in your inventory yet. Import some NS cards or open a pack to get started!"
        />
      )}

      {/* Card Details Modal */}
      <CardDetailsModal
        card={selectedCard}
        open={!!selectedCard}
        onClose={() => setSelectedCard(null)}
      />
    </div>
  );
}
