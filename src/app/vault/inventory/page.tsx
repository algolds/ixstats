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
  Grid3x3,
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

// TODO: This will use CardGrid from Agent 1
function CardGrid({ cards, selectable, onSelectionChange }: {
  cards: any[];
  selectable?: boolean;
  onSelectionChange?: (selected: string[]) => void;
}) {
  return (
    <Card className="glass-hierarchy-child">
      <CardContent className="flex flex-col items-center justify-center py-12">
        <Grid3x3 className="mb-4 h-16 w-16 text-muted-foreground" />
        <p className="mb-2 text-lg font-semibold">CardGrid Component</p>
        <p className="text-sm text-muted-foreground">
          This will be the card grid from Agent 1
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          Cards: {cards.length}
        </p>
        <p className="text-xs text-muted-foreground">
          Selectable: {selectable ? "Yes" : "No"}
        </p>
      </CardContent>
    </Card>
  );
}

export default function InventoryPage() {
  const [selectMode, setSelectMode] = useState(false);
  const [selectedCards, setSelectedCards] = useState<string[]>([]);
  const [showDuplicatesOnly, setShowDuplicatesOnly] = useState(false);
  const [sortBy, setSortBy] = useState<string>("date");
  const [filterRarity, setFilterRarity] = useState<string>("all");
  const [filterSeason, setFilterSeason] = useState<string>("all");
  const [filterCollection, setFilterCollection] = useState<string>("all");

  // TODO: Replace with actual API data
  const totalCards = 0;
  const totalValue = 0;
  const duplicateCount = 0;
  const cards: any[] = [];

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

      {/* Bulk actions toolbar */}
      {selectMode && (
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
                  <SelectItem value="date">Acquisition Date</SelectItem>
                  <SelectItem value="rarity">Rarity</SelectItem>
                  <SelectItem value="value">Market Value</SelectItem>
                  <SelectItem value="name">Card Name</SelectItem>
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
      <CardGrid
        cards={cards}
        selectable={selectMode}
        onSelectionChange={setSelectedCards}
      />
    </div>
  );
}
