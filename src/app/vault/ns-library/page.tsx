"use client";

/**
 * NationStates Card Library Page
 * Browse and filter all NS_IMPORT cards in the system
 *
 * Features:
 * - Season filtering (1, 2, 3, All)
 * - Rarity filtering (maps to IxCards rarity)
 * - Card category filtering (from NS metadata)
 * - Region filtering (from NS metadata)
 * - Nation name search
 * - NS-specific metadata display
 * - Grid display with CardDisplay component
 * - Pagination
 * - Stats summary dashboard
 */

import { useState, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Globe,
  Search,
  Filter,
  TrendingUp,
  Layers,
  Award,
  Trophy,
  MapPin,
  Tag,
  ChevronDown,
  X,
  ArrowRight,
  Download,
  AlertCircle,
  Star,
  Sparkles,
} from "lucide-react";
import { cn } from "~/lib/utils";
import { api } from "~/trpc/react";
import { Card, CardContent } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Badge } from "~/components/ui/badge";
import { Skeleton } from "~/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { CardDisplay } from "~/components/cards/display/CardDisplay";
import NumberFlow from "~/components/ui/number-flow";
import Link from "next/link";
import type { CardInstance } from "~/types/cards-display";
import type { CardRarity } from "@prisma/client";

/**
 * Filter state interface
 */
interface NSLibraryFilters {
  search: string;
  season: number | "all";
  rarity: CardRarity | "all";
  category: string | "all";
  region: string | "all";
}

/**
 * NS metadata type (from Card.metadata field)
 */
interface NSMetadata {
  region?: string;
  cardCategory?: string;
  badge?: string;
  trophies?: number;
  marketValue?: string;
  syncedAt?: string;
  importedAt?: string;
  importedBy?: string;
}

/**
 * Stats Header Component
 */
function StatsHeader({
  totalCards,
  season1Count,
  season2Count,
  season3Count,
  avgMarketValue,
}: {
  totalCards: number;
  season1Count: number;
  season2Count: number;
  season3Count: number;
  avgMarketValue: number;
}) {
  return (
    <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-5">
      {/* Total Cards */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <Card className="glass-hierarchy-child overflow-hidden border-blue-200 dark:border-blue-700/40">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="rounded-full bg-gradient-to-br from-blue-500/20 to-blue-600/20 p-3 border border-blue-400/30">
                <Layers className="h-6 w-6 text-blue-400" />
              </div>
              <div>
                <p className="text-sm text-white/60">Total NS Cards</p>
                <p className="text-3xl font-black text-blue-400">
                  <NumberFlow value={totalCards} />
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Season 1 */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <Card className="glass-hierarchy-child overflow-hidden">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="rounded-full bg-gradient-to-br from-cyan-500/20 to-cyan-600/20 p-3 border border-cyan-400/30">
                <Award className="h-6 w-6 text-cyan-400" />
              </div>
              <div>
                <p className="text-sm text-white/60">Season 1</p>
                <p className="text-3xl font-black text-cyan-400">
                  <NumberFlow value={season1Count} />
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Season 2 */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <Card className="glass-hierarchy-child overflow-hidden">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="rounded-full bg-gradient-to-br from-purple-500/20 to-purple-600/20 p-3 border border-purple-400/30">
                <Star className="h-6 w-6 text-purple-400" />
              </div>
              <div>
                <p className="text-sm text-white/60">Season 2</p>
                <p className="text-3xl font-black text-purple-400">
                  <NumberFlow value={season2Count} />
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Season 3 */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
      >
        <Card className="glass-hierarchy-child overflow-hidden">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="rounded-full bg-gradient-to-br from-gold-500/20 to-gold-600/20 p-3 border border-gold-400/30">
                <Sparkles className="h-6 w-6 text-gold-400" />
              </div>
              <div>
                <p className="text-sm text-white/60">Season 3</p>
                <p className="text-3xl font-black text-gold-400">
                  <NumberFlow value={season3Count} />
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Average Value */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
      >
        <Card className="glass-hierarchy-child overflow-hidden">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="rounded-full bg-gradient-to-br from-green-500/20 to-green-600/20 p-3 border border-green-400/30">
                <TrendingUp className="h-6 w-6 text-green-400" />
              </div>
              <div>
                <p className="text-sm text-white/60">Avg. Value</p>
                <p className="text-3xl font-black text-green-400">
                  <NumberFlow value={avgMarketValue} format="compact" />
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
 * Filter Sidebar Component
 */
function FilterSidebar({
  filters,
  onFilterChange,
  onReset,
  isOpen,
  onClose,
  uniqueCategories,
  uniqueRegions,
}: {
  filters: NSLibraryFilters;
  onFilterChange: (filters: Partial<NSLibraryFilters>) => void;
  onReset: () => void;
  isOpen: boolean;
  onClose: () => void;
  uniqueCategories: string[];
  uniqueRegions: string[];
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
              "border-r lg:border border-blue-200 dark:border-blue-700/40"
            )}
          >
            {/* Header */}
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-bold text-blue-400 flex items-center gap-2">
                <Filter className="h-5 w-5" />
                NS Filters
              </h3>
              <Button variant="ghost" size="icon" onClick={onClose} className="lg:hidden">
                <X className="h-5 w-5" />
              </Button>
            </div>

            {/* Search */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-white/80 flex items-center gap-2">
                <Search className="h-4 w-4" />
                Search Nation
              </label>
              <Input
                value={filters.search}
                onChange={(e) => onFilterChange({ search: e.target.value })}
                placeholder="Nation name..."
                className="glass-hierarchy-interactive"
              />
            </div>

            {/* Season Filter */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-white/80 flex items-center gap-2">
                <Award className="h-4 w-4" />
                NS Season
              </label>
              <Select
                value={filters.season.toString()}
                onValueChange={(value) =>
                  onFilterChange({ season: value === "all" ? "all" : parseInt(value) })
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

            {/* Rarity Filter */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-white/80 flex items-center gap-2">
                <Sparkles className="h-4 w-4" />
                Rarity
              </label>
              <Select
                value={filters.rarity}
                onValueChange={(value) => onFilterChange({ rarity: value as CardRarity | "all" })}
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
              <label className="text-sm font-medium text-white/80 flex items-center gap-2">
                <Tag className="h-4 w-4" />
                Card Category
              </label>
              <Select
                value={filters.category}
                onValueChange={(value) => onFilterChange({ category: value })}
              >
                <SelectTrigger className="glass-hierarchy-interactive">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="glass-hierarchy-modal">
                  <SelectItem value="all">All Categories</SelectItem>
                  {uniqueCategories.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Region Filter */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-white/80 flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                Region
              </label>
              <Select
                value={filters.region}
                onValueChange={(value) => onFilterChange({ region: value })}
              >
                <SelectTrigger className="glass-hierarchy-interactive">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="glass-hierarchy-modal max-h-[300px]">
                  <SelectItem value="all">All Regions</SelectItem>
                  {uniqueRegions.map((region) => (
                    <SelectItem key={region} value={region}>
                      {region}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Reset Button */}
            <Button variant="outline" onClick={onReset} className="w-full">
              <X className="mr-2 h-4 w-4" />
              Reset Filters
            </Button>

            {/* NS Branding */}
            <div className="pt-4 border-t border-white/10">
              <div className="rounded-lg bg-blue-500/10 border border-blue-400/30 p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <Globe className="h-5 w-5 text-blue-400" />
                  <span className="font-bold text-blue-400">NationStates</span>
                </div>
                <p className="text-xs text-white/60">
                  These cards are imported from NationStates trading card game
                </p>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

/**
 * NS Card Badge Component
 */
function NSCardBadge({ season, metadata }: { season: number; metadata?: NSMetadata }) {
  return (
    <div className="absolute top-2 left-2 z-10 flex flex-col gap-1">
      {/* NS Season Badge */}
      <Badge
        variant="outline"
        className="bg-blue-600/90 border-blue-400 text-white backdrop-blur-md font-black"
      >
        <Globe className="h-3 w-3 mr-1" />
        NS S{season}
      </Badge>

      {/* Badge Type */}
      {metadata?.badge && (
        <Badge
          variant="outline"
          className="bg-gold-600/90 border-gold-400 text-white backdrop-blur-md font-bold text-xs"
        >
          <Trophy className="h-3 w-3 mr-1" />
          {metadata.badge}
        </Badge>
      )}
    </div>
  );
}

/**
 * Main NS Library Page Component
 */
export default function NSLibraryPage() {
  const [filters, setFilters] = useState<NSLibraryFilters>({
    search: "",
    season: "all",
    rarity: "all",
    category: "all",
    region: "all",
  });
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [page, setPage] = useState(1);
  const cardsPerPage = 24;

  // Fetch all NS_IMPORT cards
  const { data: cardsData, isLoading } = api.cards.getCards.useQuery({
    type: "NS_IMPORT",
    season: filters.season !== "all" ? filters.season : undefined,
    rarity: filters.rarity !== "all" ? filters.rarity : undefined,
    search: filters.search || undefined,
    limit: 1000, // Get all for client-side filtering
    offset: 0,
  });

  // Transform card data to CardInstance format
  const allCards: CardInstance[] = useMemo(() => {
    if (!cardsData?.cards) return [];

    return cardsData.cards.map((card: any) => ({
      id: card.id,
      title: card.title,
      description: card.description || "",
      artwork: card.artwork || "/images/cards/placeholder-nation.png",
      artworkVariants: card.artworkVariants || null,
      cardType: card.cardType,
      rarity: card.rarity,
      season: card.season,
      nsCardId: card.nsCardId || null,
      nsSeason: card.nsSeason || null,
      nsData: card.nsData || null,
      wikiSource: card.wikiSource || null,
      wikiArticleTitle: card.wikiArticleTitle || null,
      wikiUrl: card.wikiUrl || null,
      countryId: card.countryId,
      stats: card.stats || {},
      marketValue: card.marketValue || 0,
      totalSupply: card.totalSupply || 0,
      level: card.level || 1,
      evolutionStage: card.evolutionStage || 0,
      enhancements: card.enhancements || null,
      createdAt: card.createdAt,
      updatedAt: card.updatedAt,
      lastTrade: card.lastTrade || null,
      country: card.country,
      owners: [],
      metadata: card.metadata as NSMetadata | undefined,
    }));
  }, [cardsData]);

  // Extract unique categories and regions
  const { uniqueCategories, uniqueRegions } = useMemo(() => {
    const categories = new Set<string>();
    const regions = new Set<string>();

    allCards.forEach((card) => {
      const metadata = card.metadata as NSMetadata | undefined;
      if (metadata?.cardCategory) categories.add(metadata.cardCategory);
      if (metadata?.region) regions.add(metadata.region);
    });

    return {
      uniqueCategories: Array.from(categories).sort(),
      uniqueRegions: Array.from(regions).sort(),
    };
  }, [allCards]);

  // Apply client-side filters
  const filteredCards = useMemo(() => {
    return allCards.filter((card) => {
      const metadata = card.metadata as NSMetadata | undefined;

      // Category filter
      if (filters.category !== "all") {
        if (metadata?.cardCategory !== filters.category) return false;
      }

      // Region filter
      if (filters.region !== "all") {
        if (metadata?.region !== filters.region) return false;
      }

      return true;
    });
  }, [allCards, filters]);

  // Pagination
  const totalPages = Math.ceil(filteredCards.length / cardsPerPage);
  const paginatedCards = filteredCards.slice(
    (page - 1) * cardsPerPage,
    page * cardsPerPage
  );

  // Calculate stats
  const stats = useMemo(() => {
    const season1 = allCards.filter((c) => c.nsSeason === 1).length;
    const season2 = allCards.filter((c) => c.nsSeason === 2).length;
    const season3 = allCards.filter((c) => c.nsSeason === 3).length;
    const avgValue = allCards.length > 0
      ? allCards.reduce((sum, c) => sum + c.marketValue, 0) / allCards.length
      : 0;

    return {
      total: allCards.length,
      season1,
      season2,
      season3,
      avgMarketValue: avgValue,
    };
  }, [allCards]);

  // Handlers
  const handleFilterChange = useCallback((newFilters: Partial<NSLibraryFilters>) => {
    setFilters((prev) => ({ ...prev, ...newFilters }));
    setPage(1); // Reset to first page
  }, []);

  const handleResetFilters = useCallback(() => {
    setFilters({
      search: "",
      season: "all",
      rarity: "all",
      category: "all",
      region: "all",
    });
    setPage(1);
  }, []);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600">
            <Globe className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-black bg-gradient-to-r from-blue-400 via-cyan-400 to-purple-400 bg-clip-text text-transparent">
              NationStates Library
            </h1>
            <p className="text-white/60">Browse all imported NationStates trading cards</p>
          </div>
        </div>
      </div>

      {/* Stats Header */}
      <StatsHeader
        totalCards={stats.total}
        season1Count={stats.season1}
        season2Count={stats.season2}
        season3Count={stats.season3}
        avgMarketValue={stats.avgMarketValue}
      />

      {/* Toolbar */}
      <Card className="glass-hierarchy-child border-blue-200 dark:border-blue-700/40">
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

              {/* Active filters indicator */}
              {(filters.season !== "all" ||
                filters.rarity !== "all" ||
                filters.category !== "all" ||
                filters.region !== "all" ||
                filters.search) && (
                <Badge variant="outline" className="bg-blue-500/20 border-blue-400/30 text-blue-400">
                  {[
                    filters.season !== "all" && `Season ${filters.season}`,
                    filters.rarity !== "all" && filters.rarity,
                    filters.category !== "all" && filters.category,
                    filters.region !== "all" && filters.region,
                    filters.search && "Search active",
                  ]
                    .filter(Boolean)
                    .length}{" "}
                  active
                </Badge>
              )}
            </div>

            {/* Right side */}
            <div className="flex items-center gap-2 flex-wrap">
              <Button variant="outline" size="sm" asChild>
                <Link href="/vault/import">
                  <Download className="mr-2 h-4 w-4" />
                  Import More
                </Link>
              </Button>

              <div className="text-sm text-white/60">
                Showing {filteredCards.length} of {stats.total} cards
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Content Area */}
      <div className="flex gap-6">
        {/* Filter Sidebar */}
        <FilterSidebar
          filters={filters}
          onFilterChange={handleFilterChange}
          onReset={handleResetFilters}
          isOpen={filtersOpen}
          onClose={() => setFiltersOpen(false)}
          uniqueCategories={uniqueCategories}
          uniqueRegions={uniqueRegions}
        />

        {/* Cards Grid */}
        <div className="flex-1 min-w-0 space-y-6">
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
                <p className="text-white/60 text-center max-w-md mb-4">
                  {stats.total === 0
                    ? "No NationStates cards have been imported yet. Start by importing your deck!"
                    : "Try adjusting your filters to see more results"}
                </p>
                {stats.total === 0 ? (
                  <Button asChild>
                    <Link href="/vault/import">
                      <Download className="mr-2 h-4 w-4" />
                      Import NS Cards
                    </Link>
                  </Button>
                ) : (
                  <Button onClick={handleResetFilters} variant="outline">
                    Reset Filters
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                {paginatedCards.map((card) => {
                  const metadata = card.metadata as NSMetadata | undefined;

                  return (
                    <motion.div
                      key={card.id}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ duration: 0.2 }}
                      className="relative group"
                    >
                      {/* NS Badge Overlay */}
                      <NSCardBadge season={card.nsSeason || card.season} metadata={metadata} />

                      {/* Card Display */}
                      <CardDisplay card={card} size="medium" />

                      {/* NS Metadata Hover Overlay */}
                      <AnimatePresence>
                        <motion.div
                          className="absolute inset-0 bg-gradient-to-t from-blue-900/95 via-blue-900/80 to-transparent rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none p-4 flex flex-col justify-end"
                          initial={{ opacity: 0 }}
                          whileHover={{ opacity: 1 }}
                        >
                          <div className="space-y-1 text-xs">
                            {metadata?.region && (
                              <div className="flex items-center gap-1 text-white/90">
                                <MapPin className="h-3 w-3" />
                                <span>{metadata.region}</span>
                              </div>
                            )}
                            {metadata?.cardCategory && (
                              <div className="flex items-center gap-1 text-white/90">
                                <Tag className="h-3 w-3" />
                                <span>{metadata.cardCategory}</span>
                              </div>
                            )}
                            {metadata?.trophies && metadata.trophies > 0 && (
                              <div className="flex items-center gap-1 text-gold-400">
                                <Trophy className="h-3 w-3" />
                                <span>{metadata.trophies} Trophies</span>
                              </div>
                            )}
                            {metadata?.marketValue && (
                              <div className="flex items-center justify-between mt-2 pt-2 border-t border-white/20">
                                <span className="text-white/70">NS Value:</span>
                                <span className="font-bold text-blue-400">
                                  {metadata.marketValue}
                                </span>
                              </div>
                            )}
                            <div className="flex items-center justify-between">
                              <span className="text-white/70">IxC Value:</span>
                              <span className="font-bold text-gold-400">
                                {card.marketValue.toFixed(2)}
                              </span>
                            </div>
                          </div>
                        </motion.div>
                      </AnimatePresence>
                    </motion.div>
                  );
                })}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <Card className="glass-hierarchy-child">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        disabled={page === 1}
                      >
                        Previous
                      </Button>

                      <div className="flex items-center gap-2">
                        <span className="text-sm text-white/60">
                          Page {page} of {totalPages}
                        </span>
                      </div>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                        disabled={page === totalPages}
                      >
                        Next
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
