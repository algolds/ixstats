/**
 * Lore Card Gallery - PUBLIC PAGE
 * Browse all lore cards generated from IxWiki and IIWiki articles
 *
 * NOTE: This page is currently under /vault/lore-gallery which requires admin access
 * due to the vault layout. To make it truly public, either:
 * 1. Move to /lore-gallery outside vault directory
 * 2. Add route exception in vault layout
 *
 * For now, it uses the vault navigation and admin-only access.
 */

"use client";

import { useState, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Filter,
  Search,
  X,
  Grid3x3,
  List,
  ChevronDown,
  AlertCircle,
  Globe,
  BookOpen,
  SortAsc,
  Sparkles,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { cn } from "~/lib/utils";
import { api } from "~/trpc/react";
import { Card, CardContent } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
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
import NumberFlow from "~/components/ui/number-flow";
import type { CardRarity } from "@prisma/client";
import { LORE_CATEGORIES } from "~/lib/lore-card-constants";

/**
 * View mode types
 */
type ViewMode = "grid" | "list";

/**
 * Filter state interface
 */
interface FilterState {
  search: string;
  wikiSource: "all" | "ixwiki" | "iiwiki";
  rarity: CardRarity | "all";
  category: string;
  season: number | "all";
  sortBy: "rarity" | "season" | "dateAdded" | "marketValue" | "title";
}

/**
 * Lore categories for filtering
 */
const CATEGORY_OPTIONS = [
  { value: "all", label: "All Categories" },
  { value: LORE_CATEGORIES.HISTORICAL_FIGURES, label: "Historical Figures" },
  { value: LORE_CATEGORIES.LOCATIONS, label: "Locations" },
  { value: LORE_CATEGORIES.EVENTS, label: "Historical Events" },
  { value: LORE_CATEGORIES.ARTIFACTS, label: "Artifacts" },
  { value: LORE_CATEGORIES.CULTURE, label: "Culture" },
  { value: LORE_CATEGORIES.MYTHOLOGY, label: "Mythology" },
];

/**
 * Transform API card data to CardInstance format
 */
function transformToCardInstance(card: any) {
  // Build wiki URL from source and article title
  const wikiUrl = card.wikiSource && card.wikiArticleTitle
    ? card.wikiSource === "ixwiki"
      ? `https://ixwiki.com/wiki/${encodeURIComponent(card.wikiArticleTitle)}`
      : `https://iiwiki.us/wiki/${encodeURIComponent(card.wikiArticleTitle)}`
    : null;

  return {
    id: card.id,
    title: card.title,
    description: card.description || "",
    artwork: card.artwork || "/images/cards/placeholder-lore.png",
    artworkVariants: card.artworkVariants || null,
    cardType: card.cardType as any,
    rarity: card.rarity as CardRarity,
    season: card.season,
    nsCardId: null,
    nsSeason: null,
    nsData: null,
    wikiSource: card.wikiSource || null,
    wikiArticleTitle: card.wikiArticleTitle || null,
    wikiUrl: wikiUrl,
    countryId: null,
    stats: card.stats || {},
    marketValue: card.marketValue || 0,
    totalSupply: card.totalSupply || 0,
    level: card.level || 1,
    evolutionStage: 0,
    enhancements: null,
    createdAt: card.createdAt,
    updatedAt: card.updatedAt,
    lastTrade: null,
    country: null,
    owners: [],
    metadata: card.metadata,
  };
}

/**
 * Header Stats Component
 */
function HeaderStats({ total, loading }: { total: number; loading: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
    >
      <Card className="glass-hierarchy-child overflow-hidden">
        <CardContent className="p-6">
          <div className="flex items-center gap-4">
            <div className="rounded-full bg-gradient-to-br from-purple-500/20 to-purple-600/20 p-3 border border-purple-400/30">
              <BookOpen className="h-6 w-6 text-purple-400" />
            </div>
            <div>
              <p className="text-sm text-white/60">Total Lore Cards</p>
              {loading ? (
                <Skeleton className="h-9 w-20" />
              ) : (
                <p className="text-3xl font-black text-purple-400">
                  <NumberFlow value={total} />
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

/**
 * Filters Panel Component
 */
function FiltersPanel({
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
              <Button
                variant="ghost"
                size="icon"
                onClick={onClose}
                className="lg:hidden"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>

            {/* Search */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-white/80">
                Search
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
                <Input
                  value={filters.search}
                  onChange={(e) => onFilterChange({ search: e.target.value })}
                  placeholder="Card title or article..."
                  className="pl-10 glass-hierarchy-interactive"
                />
              </div>
            </div>

            {/* Wiki Source Filter */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-white/80">
                Wiki Source
              </label>
              <Select
                value={filters.wikiSource}
                onValueChange={(value) =>
                  onFilterChange({
                    wikiSource: value as "all" | "ixwiki" | "iiwiki",
                  })
                }
              >
                <SelectTrigger className="glass-hierarchy-interactive">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="glass-hierarchy-modal">
                  <SelectItem value="all">All Sources</SelectItem>
                  <SelectItem value="ixwiki">IxWiki</SelectItem>
                  <SelectItem value="iiwiki">IIWiki</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Rarity Filter */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-white/80">
                Rarity
              </label>
              <Select
                value={filters.rarity}
                onValueChange={(value) =>
                  onFilterChange({ rarity: value as CardRarity | "all" })
                }
              >
                <SelectTrigger className="glass-hierarchy-interactive">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="glass-hierarchy-modal">
                  <SelectItem value="all">All Rarities</SelectItem>
                  <SelectItem value="COMMON">Common</SelectItem>
                  <SelectItem value="UNCOMMON">Uncommon</SelectItem>
                  <SelectItem value="RARE">Rare</SelectItem>
                  <SelectItem value="ULTRA_RARE">Ultra Rare</SelectItem>
                  <SelectItem value="EPIC">Epic</SelectItem>
                  <SelectItem value="LEGENDARY">Legendary</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Category Filter */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-white/80">
                Category
              </label>
              <Select
                value={filters.category}
                onValueChange={(value) => onFilterChange({ category: value })}
              >
                <SelectTrigger className="glass-hierarchy-interactive">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="glass-hierarchy-modal">
                  {CATEGORY_OPTIONS.map((cat) => (
                    <SelectItem key={cat.value} value={cat.value}>
                      {cat.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Season Filter */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-white/80">
                Season
              </label>
              <Select
                value={filters.season.toString()}
                onValueChange={(value) =>
                  onFilterChange({
                    season: value === "all" ? "all" : parseInt(value),
                  })
                }
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
 * Pagination Controls Component
 */
function PaginationControls({
  currentPage,
  totalPages,
  onPageChange,
}: {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}) {
  return (
    <div className="flex items-center justify-center gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
        className="glass-hierarchy-interactive"
      >
        <ChevronLeft className="h-4 w-4 mr-1" />
        Previous
      </Button>

      <div className="flex items-center gap-2">
        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
          let pageNum: number;
          if (totalPages <= 5) {
            pageNum = i + 1;
          } else if (currentPage <= 3) {
            pageNum = i + 1;
          } else if (currentPage >= totalPages - 2) {
            pageNum = totalPages - 4 + i;
          } else {
            pageNum = currentPage - 2 + i;
          }

          return (
            <Button
              key={pageNum}
              variant={currentPage === pageNum ? "default" : "outline"}
              size="sm"
              onClick={() => onPageChange(pageNum)}
              className="w-10 glass-hierarchy-interactive"
            >
              {pageNum}
            </Button>
          );
        })}
      </div>

      <Button
        variant="outline"
        size="sm"
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        className="glass-hierarchy-interactive"
      >
        Next
        <ChevronRight className="h-4 w-4 ml-1" />
      </Button>
    </div>
  );
}

/**
 * Main Lore Gallery Page Component
 */
export default function LoreGalleryPage() {
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [selectedCard, setSelectedCard] = useState<any>(null);
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  const [filters, setFilters] = useState<FilterState>({
    search: "",
    wikiSource: "all",
    rarity: "all",
    category: "all",
    season: "all",
    sortBy: "dateAdded",
  });

  // Calculate offset for pagination
  const offset = (currentPage - 1) * itemsPerPage;

  // Fetch lore cards with filters
  const { data, isLoading } = api.loreCards.getAllLoreCards.useQuery({
    wikiSource: filters.wikiSource,
    rarity: filters.rarity,
    category: filters.category !== "all" ? filters.category : undefined,
    season: filters.season !== "all" ? filters.season : undefined,
    search: filters.search || undefined,
    sortBy: filters.sortBy,
    limit: itemsPerPage,
    offset,
  });

  // Transform cards to CardInstance format
  const cards = useMemo(() => {
    if (!data?.cards) return [];
    return data.cards.map(transformToCardInstance);
  }, [data]);

  const totalCards = data?.total || 0;
  const totalPages = Math.ceil(totalCards / itemsPerPage);

  // Handlers
  const handleFilterChange = useCallback(
    (newFilters: Partial<FilterState>) => {
      setFilters((prev) => ({ ...prev, ...newFilters }));
      setCurrentPage(1); // Reset to page 1 when filters change
    },
    []
  );

  const handleResetFilters = useCallback(() => {
    setFilters({
      search: "",
      wikiSource: "all",
      rarity: "all",
      category: "all",
      season: "all",
      sortBy: "dateAdded",
    });
    setCurrentPage(1);
  }, []);

  const handleCardClick = useCallback((card: any) => {
    setSelectedCard(card);
  }, []);

  const handlePageChange = useCallback((page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="rounded-full bg-gradient-to-br from-purple-500/20 to-purple-600/20 p-3 border border-purple-400/30">
            <Sparkles className="h-6 w-6 text-purple-400" />
          </div>
          <div>
            <h1 className="text-3xl font-black bg-gradient-to-r from-purple-400 via-gold-400 to-cyan-400 bg-clip-text text-transparent">
              Lore Card Gallery
            </h1>
            <p className="text-white/60">
              Explore lore cards from IxWiki and IIWiki articles
            </p>
          </div>
        </div>

        {/* Info Banner */}
        <Card className="glass-hierarchy-child border-purple-400/30">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <Globe className="h-5 w-5 text-purple-400 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm text-white/80">
                  Browse cards generated from wiki articles. Each card
                  represents notable historical figures, locations, events,
                  artifacts, and cultural heritage.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Header Stats */}
      <HeaderStats total={totalCards} loading={isLoading} />

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
              </div>

              {/* Sort */}
              <Select
                value={filters.sortBy}
                onValueChange={(value) =>
                  handleFilterChange({
                    sortBy: value as FilterState["sortBy"],
                  })
                }
              >
                <SelectTrigger className="w-[180px] glass-hierarchy-interactive">
                  <SortAsc className="mr-2 h-4 w-4" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="glass-hierarchy-modal">
                  <SelectItem value="dateAdded">Recently Added</SelectItem>
                  <SelectItem value="rarity">Rarity</SelectItem>
                  <SelectItem value="marketValue">Market Value</SelectItem>
                  <SelectItem value="season">Season</SelectItem>
                  <SelectItem value="title">Alphabetical</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Content Area */}
      <div className="flex gap-6">
        {/* Filter Sidebar */}
        <FiltersPanel
          filters={filters}
          onFilterChange={handleFilterChange}
          onReset={handleResetFilters}
          isOpen={filtersOpen}
          onClose={() => setFiltersOpen(false)}
        />

        {/* Cards Grid */}
        <div className="flex-1 min-w-0 space-y-6">
          {isLoading ? (
            <div
              className={cn(
                "grid gap-4",
                viewMode === "grid"
                  ? "grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"
                  : "grid-cols-1"
              )}
            >
              {Array.from({ length: 20 }).map((_, i) => (
                <Skeleton key={i} className="h-80 rounded-2xl" />
              ))}
            </div>
          ) : cards.length === 0 ? (
            <Card className="glass-hierarchy-child">
              <CardContent className="flex flex-col items-center justify-center py-20">
                <AlertCircle className="mb-4 h-16 w-16 text-white/40" />
                <p className="text-xl font-bold text-white/80 mb-2">
                  No lore cards found
                </p>
                <p className="text-white/60 text-center max-w-md">
                  {filters.search ||
                  filters.rarity !== "all" ||
                  filters.category !== "all"
                    ? "Try adjusting your filters to see more results"
                    : "No lore cards have been generated yet. Check back soon!"}
                </p>
                {filters.search ||
                filters.rarity !== "all" ||
                filters.category !== "all" ? (
                  <Button
                    onClick={handleResetFilters}
                    className="mt-4"
                    variant="outline"
                  >
                    Reset Filters
                  </Button>
                ) : null}
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Cards Grid */}
              <div
                className={cn(
                  "grid gap-4",
                  viewMode === "grid"
                    ? "grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"
                    : "grid-cols-1"
                )}
              >
                {cards.map((card) => (
                  <motion.div
                    key={card.id}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.2 }}
                  >
                    <CardDisplay
                      card={card}
                      size={viewMode === "list" ? "medium" : "small"}
                      onClick={handleCardClick}
                      className="h-full"
                    />
                  </motion.div>
                ))}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <Card className="glass-hierarchy-child">
                  <CardContent className="p-4">
                    <PaginationControls
                      currentPage={currentPage}
                      totalPages={totalPages}
                      onPageChange={handlePageChange}
                    />
                  </CardContent>
                </Card>
              )}

              {/* Results count */}
              <div className="text-center text-sm text-white/60">
                Showing {offset + 1}-{Math.min(offset + itemsPerPage, totalCards)} of{" "}
                {totalCards} cards
              </div>
            </>
          )}
        </div>
      </div>

      {/* Card Details Modal */}
      <CardDetailsModal
        card={selectedCard}
        open={!!selectedCard}
        onClose={() => setSelectedCard(null)}
      />
    </div>
  );
}
