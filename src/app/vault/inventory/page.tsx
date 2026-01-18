/**
 * Card Inventory Page - PREMIUM EDITION
 * Complete rebuild with advanced filtering, bulk actions, and premium UI
 * Phase 4: Premium inventory management system
 */

"use client";

import { useState, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
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
  Grid3x3,
  List,
  Maximize2,
  Search,
  X,
  ChevronDown,
  AlertCircle,
} from "lucide-react";
import { cn } from "~/lib/utils";
import { toast } from "sonner";
import { api } from "~/trpc/react";
import { Card, CardContent } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import { Input } from "~/components/ui/input";
import { Skeleton } from "~/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { CardDisplay, CardDetailsModal } from "~/components/cards/display";
import { useSoundService } from "~/lib/sound-service";
import NumberFlow from "~/components/ui/number-flow";
import type { CardInstance } from "~/types/cards-display";
import type { CardRarity, CardType } from "@prisma/client";

/**
 * View mode types
 */
type ViewMode = "grid" | "list" | "compact";

/**
 * Filter state interface
 */
interface FilterState {
  search: string;
  rarity: CardRarity | "all";
  cardType: CardType | "all";
  season: number | "all";
  minLevel: number;
  maxLevel: number;
  minValue: number;
  maxValue: number;
}

/**
 * Header Stats Component
 */
function HeaderStats({
  totalCards,
  totalValue,
  duplicates,
}: {
  totalCards: number;
  totalValue: number;
  duplicates: number;
}) {
  return (
    <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
      {/* Total Cards */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <Card className="glass-hierarchy-child overflow-hidden">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="rounded-full bg-gradient-to-br from-purple-500/20 to-purple-600/20 p-3 border border-purple-400/30">
                <Layers className="h-6 w-6 text-purple-400" />
              </div>
              <div>
                <p className="text-sm text-white/60">Total Cards</p>
                <p className="text-3xl font-black text-purple-400">
                  <NumberFlow value={totalCards} />
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Total Value */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <Card className="glass-hierarchy-child overflow-hidden">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="rounded-full bg-gradient-to-br from-gold-500/20 to-gold-600/20 p-3 border border-gold-400/30">
                <TrendingUp className="h-6 w-6 text-gold-400" />
              </div>
              <div>
                <p className="text-sm text-white/60">Total Value</p>
                <p className="text-3xl font-black text-gold-400">
                  <NumberFlow value={totalValue} /> IxC
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Duplicates */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <Card className="glass-hierarchy-child overflow-hidden">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="rounded-full bg-gradient-to-br from-cyan-500/20 to-cyan-600/20 p-3 border border-cyan-400/30">
                <Copy className="h-6 w-6 text-cyan-400" />
              </div>
              <div>
                <p className="text-sm text-white/60">Duplicates</p>
                <p className="text-3xl font-black text-cyan-400">
                  <NumberFlow value={duplicates} />
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}

/**
 * Advanced Filters Sidebar
 */
function FilterSidebar({
  filters,
  onFilterChange,
  onReset,
  isOpen,
  onClose,
}: {
  filters: FilterState;
  onFilterChange: (filters: Partial<FilterState>) => void;
  onReset: () => void;
  isOpen: boolean;
  onClose: () => void;
}) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Mobile overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
            onClick={onClose}
          />

          {/* Sidebar */}
          <motion.div
            initial={{ x: -300, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -300, opacity: 0 }}
            transition={{ type: "spring", damping: 25 }}
            className={cn(
              "fixed lg:static inset-y-0 left-0 z-50",
              "w-80 p-6 space-y-6 overflow-y-auto",
              "glass-hierarchy-child rounded-r-2xl lg:rounded-2xl",
              "border-r lg:border"
            )}
          >
            {/* Header */}
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-bold text-purple-400 flex items-center gap-2">
                <Filter className="h-5 w-5" />
                Filters
              </h3>
              <Button variant="ghost" size="icon" onClick={onClose} className="lg:hidden">
                <X className="h-5 w-5" />
              </Button>
            </div>

            {/* Search */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-white/80">Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
                <Input
                  value={filters.search}
                  onChange={(e) => onFilterChange({ search: e.target.value })}
                  placeholder="Card name or country..."
                  className="pl-10 glass-hierarchy-interactive"
                />
              </div>
            </div>

            {/* Rarity Filter */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-white/80">Rarity</label>
              <div className="space-y-2">
                {["all", "COMMON", "UNCOMMON", "RARE", "ULTRA_RARE", "EPIC", "LEGENDARY"].map((rarity) => (
                  <label key={rarity} className="flex items-center gap-2 cursor-pointer group">
                    <Checkbox
                      checked={filters.rarity === rarity}
                      onCheckedChange={() => onFilterChange({ rarity: rarity as CardRarity | "all" })}
                    />
                    <span
                      className={cn(
                        "text-sm group-hover:text-white transition-colors",
                        rarity === "LEGENDARY"
                          ? "text-yellow-400"
                          : rarity === "EPIC"
                          ? "text-purple-400"
                          : rarity === "RARE" || rarity === "ULTRA_RARE"
                          ? "text-blue-400"
                          : rarity === "UNCOMMON"
                          ? "text-green-400"
                          : "text-white/60"
                      )}
                    >
                      {rarity === "all" ? "All Rarities" : rarity.replace("_", " ")}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {/* Card Type Filter */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-white/80">Card Type</label>
              <Select
                value={filters.cardType}
                onValueChange={(value) => onFilterChange({ cardType: value as CardType | "all" })}
              >
                <SelectTrigger className="glass-hierarchy-interactive">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="glass-hierarchy-modal">
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="NATION">Nation</SelectItem>
                  <SelectItem value="LORE">Lore</SelectItem>
                  <SelectItem value="NS_IMPORT">NS Import</SelectItem>
                  <SelectItem value="SPECIAL">Special</SelectItem>
                  <SelectItem value="COMMUNITY">Community</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Season Filter */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-white/80">Season</label>
              <Select
                value={filters.season.toString()}
                onValueChange={(value) => onFilterChange({ season: value === "all" ? "all" : parseInt(value) })}
              >
                <SelectTrigger className="glass-hierarchy-interactive">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="glass-hierarchy-modal">
                  <SelectItem value="all">All Seasons</SelectItem>
                  <SelectItem value="1">Season 1</SelectItem>
                  <SelectItem value="2">Season 2</SelectItem>
                  <SelectItem value="3">Season 3</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Level Range */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-white/80">Level Range</label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  min={1}
                  max={100}
                  value={filters.minLevel}
                  onChange={(e) => onFilterChange({ minLevel: parseInt(e.target.value) || 1 })}
                  placeholder="Min"
                  className="glass-hierarchy-interactive"
                />
                <Input
                  type="number"
                  min={1}
                  max={100}
                  value={filters.maxLevel}
                  onChange={(e) => onFilterChange({ maxLevel: parseInt(e.target.value) || 100 })}
                  placeholder="Max"
                  className="glass-hierarchy-interactive"
                />
              </div>
            </div>

            {/* Value Range */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-white/80">Market Value (IxC)</label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  min={0}
                  value={filters.minValue}
                  onChange={(e) => onFilterChange({ minValue: parseInt(e.target.value) || 0 })}
                  placeholder="Min"
                  className="glass-hierarchy-interactive"
                />
                <Input
                  type="number"
                  min={0}
                  value={filters.maxValue}
                  onChange={(e) => onFilterChange({ maxValue: parseInt(e.target.value) || 999999 })}
                  placeholder="Max"
                  className="glass-hierarchy-interactive"
                />
              </div>
            </div>

            {/* Reset Button */}
            <Button variant="outline" onClick={onReset} className="w-full">
              <X className="mr-2 h-4 w-4" />
              Reset Filters
            </Button>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

/**
 * Bulk Actions Bar
 */
function BulkActionsBar({
  selectedCount,
  onAddToCollection,
  onListForAuction,
  onJunk,
  onCancel,
}: {
  selectedCount: number;
  onAddToCollection: () => void;
  onListForAuction: () => void;
  onJunk: () => void;
  onCancel: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
    >
      <Card className="glass-hierarchy-interactive border-gold-400/30">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <CheckSquare className="h-5 w-5 text-gold-400" />
              <span className="font-bold text-white">
                {selectedCount} card{selectedCount !== 1 ? "s" : ""} selected
              </span>
            </div>

            <div className="flex flex-wrap gap-2 w-full sm:w-auto">
              <Button variant="outline" size="sm" onClick={onAddToCollection}>
                <Folder className="mr-2 h-4 w-4" />
                Collection
              </Button>
              <Button variant="outline" size="sm" onClick={onListForAuction}>
                <ShoppingBag className="mr-2 h-4 w-4" />
                List for Sale
              </Button>
              <Button variant="outline" size="sm" onClick={onJunk} className="text-red-400 hover:bg-red-500/10">
                <Trash2 className="mr-2 h-4 w-4" />
                Junk
              </Button>
              <Button variant="ghost" size="sm" onClick={onCancel}>
                Cancel
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

/**
 * Main Inventory Page Component
 */
export default function InventoryPage() {
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [selectMode, setSelectMode] = useState(false);
  const [selectedCards, setSelectedCards] = useState<Set<string>>(new Set());
  const [selectedCard, setSelectedCard] = useState<CardInstance | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [sortBy, setSortBy] = useState<string>("acquired");

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

  const soundService = useSoundService();

  // Fetch user's cards
  const { data: ownerships, isLoading } = api.cards.getMyCards.useQuery({
    sortBy: sortBy as any,
    filterRarity: filters.rarity !== "all" ? (filters.rarity as any) : undefined,
  });

  // Transform ownership data to CardInstance format
  const allCards: CardInstance[] = useMemo(() => {
    if (!ownerships) return [];

    return ownerships.map((ownership: any) => ({
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
      owners: [],
    }));
  }, [ownerships]);

  // Apply filters
  const filteredCards = useMemo(() => {
    return allCards.filter((card) => {
      // Search filter
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        const matchesTitle = card.title.toLowerCase().includes(searchLower);
        const matchesCountry = card.country?.name.toLowerCase().includes(searchLower);
        if (!matchesTitle && !matchesCountry) return false;
      }

      // Card type filter
      if (filters.cardType !== "all" && card.cardType !== filters.cardType) return false;

      // Season filter
      if (filters.season !== "all" && card.season !== filters.season) return false;

      // Level range
      if (card.level < filters.minLevel || card.level > filters.maxLevel) return false;

      // Value range
      if (card.marketValue < filters.minValue || card.marketValue > filters.maxValue) return false;

      return true;
    });
  }, [allCards, filters]);

  // Calculate stats
  const totalCards = allCards.length;
  const totalValue = allCards.reduce((sum, card) => sum + card.marketValue, 0);
  const duplicates = 0; // TODO: Calculate actual duplicates based on cardId

  // Handlers
  const handleFilterChange = useCallback((newFilters: Partial<FilterState>) => {
    setFilters((prev) => ({ ...prev, ...newFilters }));
  }, []);

  const handleResetFilters = useCallback(() => {
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

  const handleCardClick = useCallback(
    (card: CardInstance) => {
      if (selectMode) {
        setSelectedCards((prev) => {
          const newSet = new Set(prev);
          if (newSet.has(card.id)) {
            newSet.delete(card.id);
          } else {
            newSet.add(card.id);
          }
          return newSet;
        });
        soundService?.play("card-select", 0.5);
      } else {
        setSelectedCard(card);
        soundService?.play("card-select");
      }
    },
    [selectMode, soundService]
  );

  const handleBulkAddToCollection = useCallback(() => {
    toast.success(`Adding ${selectedCards.size} cards to collection`);
    // TODO: Implement API call
    setSelectedCards(new Set());
    setSelectMode(false);
  }, [selectedCards]);

  const handleBulkListForAuction = useCallback(() => {
    toast.success(`Listing ${selectedCards.size} cards for auction`);
    // TODO: Implement API call
    setSelectedCards(new Set());
    setSelectMode(false);
  }, [selectedCards]);

  const handleBulkJunk = useCallback(() => {
    toast.success(`Junked ${selectedCards.size} cards`);
    // TODO: Implement API call
    setSelectedCards(new Set());
    setSelectMode(false);
  }, [selectedCards]);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-black bg-gradient-to-r from-purple-400 via-gold-400 to-cyan-400 bg-clip-text text-transparent">
          Inventory
        </h1>
        <p className="text-white/60">Manage and organize your card collection</p>
      </div>

      {/* Header Stats */}
      <HeaderStats totalCards={totalCards} totalValue={totalValue} duplicates={duplicates} />

      {/* Toolbar */}
      <Card className="glass-hierarchy-child">
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            {/* Left side */}
            <div className="flex items-center gap-2 flex-wrap">
              <Button
                variant={filtersOpen ? "default" : "outline"}
                size="sm"
                onClick={() => setFiltersOpen(!filtersOpen)}
                className="glass-hierarchy-interactive"
              >
                <Filter className="mr-2 h-4 w-4" />
                Filters
                {filtersOpen && <ChevronDown className="ml-2 h-4 w-4" />}
              </Button>

              <div className="h-6 w-px bg-white/10" />

              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox checked={selectMode} onCheckedChange={(checked) => setSelectMode(checked as boolean)} />
                <span className="text-sm font-medium text-white/80">Select Mode</span>
              </label>
            </div>

            {/* Right side */}
            <div className="flex items-center gap-2 flex-wrap">
              {/* View Mode */}
              <div className="flex items-center gap-1 p-1 rounded-lg bg-black/30">
                <Button
                  variant={viewMode === "grid" ? "default" : "ghost"}
                  size="icon"
                  onClick={() => setViewMode("grid")}
                  className="h-8 w-8"
                >
                  <Grid3x3 className="h-4 w-4" />
                </Button>
                <Button
                  variant={viewMode === "list" ? "default" : "ghost"}
                  size="icon"
                  onClick={() => setViewMode("list")}
                  className="h-8 w-8"
                >
                  <List className="h-4 w-4" />
                </Button>
                <Button
                  variant={viewMode === "compact" ? "default" : "ghost"}
                  size="icon"
                  onClick={() => setViewMode("compact")}
                  className="h-8 w-8"
                >
                  <Maximize2 className="h-4 w-4" />
                </Button>
              </div>

              {/* Sort */}
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-[180px] glass-hierarchy-interactive">
                  <SortAsc className="mr-2 h-4 w-4" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="glass-hierarchy-modal">
                  <SelectItem value="acquired">Recently Acquired</SelectItem>
                  <SelectItem value="rarity">Rarity (High to Low)</SelectItem>
                  <SelectItem value="value">Market Value (High to Low)</SelectItem>
                  <SelectItem value="name">Alphabetical</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Bulk Actions Bar */}
      <AnimatePresence>{selectMode && selectedCards.size > 0 && (
        <BulkActionsBar
          selectedCount={selectedCards.size}
          onAddToCollection={handleBulkAddToCollection}
          onListForAuction={handleBulkListForAuction}
          onJunk={handleBulkJunk}
          onCancel={() => {
            setSelectedCards(new Set());
            setSelectMode(false);
          }}
        />
      )}</AnimatePresence>

      {/* Main Content Area */}
      <div className="flex gap-6">
        {/* Filter Sidebar */}
        <FilterSidebar
          filters={filters}
          onFilterChange={handleFilterChange}
          onReset={handleResetFilters}
          isOpen={filtersOpen}
          onClose={() => setFiltersOpen(false)}
        />

        {/* Cards Grid */}
        <div className="flex-1 min-w-0">
          {isLoading ? (
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                <Skeleton key={i} className="h-80 rounded-2xl" />
              ))}
            </div>
          ) : filteredCards.length === 0 ? (
            <Card className="glass-hierarchy-child">
              <CardContent className="flex flex-col items-center justify-center py-20">
                <AlertCircle className="mb-4 h-16 w-16 text-white/40" />
                <p className="text-xl font-bold text-white/80 mb-2">No cards found</p>
                <p className="text-white/60 text-center max-w-md">
                  {filters.search || filters.rarity !== "all" || filters.cardType !== "all"
                    ? "Try adjusting your filters to see more results"
                    : "Import some NS cards or open a pack to get started!"}
                </p>
                {filters.search || filters.rarity !== "all" || filters.cardType !== "all" ? (
                  <Button onClick={handleResetFilters} className="mt-4" variant="outline">
                    Reset Filters
                  </Button>
                ) : null}
              </CardContent>
            </Card>
          ) : (
            <div
              className={cn(
                "grid gap-4",
                viewMode === "grid" && "grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4",
                viewMode === "list" && "grid-cols-1",
                viewMode === "compact" && "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6"
              )}
            >
              {filteredCards.map((card) => (
                <motion.div
                  key={card.id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.2 }}
                  className="relative"
                >
                  {/* Selection checkbox overlay */}
                  {selectMode && (
                    <div className="absolute top-2 left-2 z-20">
                      <Checkbox
                        checked={selectedCards.has(card.id)}
                        onCheckedChange={() => handleCardClick(card)}
                        className="h-6 w-6 border-2 border-white bg-black/60 backdrop-blur-sm"
                      />
                    </div>
                  )}

                  <CardDisplay
                    card={card}
                    size={viewMode === "compact" ? "small" : "medium"}
                    onClick={handleCardClick}
                    className={cn(
                      "transition-all",
                      selectMode && selectedCards.has(card.id) && "ring-2 ring-gold-400 ring-offset-2 ring-offset-black"
                    )}
                  />
                </motion.div>
              ))}
            </div>
          )}

          {/* Results count */}
          {!isLoading && filteredCards.length > 0 && (
            <div className="mt-6 text-center text-sm text-white/60">
              Showing {filteredCards.length} of {totalCards} cards
            </div>
          )}
        </div>
      </div>

      {/* Card Details Modal */}
      <CardDetailsModal card={selectedCard} open={!!selectedCard} onClose={() => setSelectedCard(null)} />
    </div>
  );
}
