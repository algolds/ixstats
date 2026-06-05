"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import { usePathname } from "next/navigation";
import { getSubTabFromPathname } from "../VaultSidebarNav";
import dynamic from "next/dynamic";
import { motion, AnimatePresence } from "motion/react";
import {
  Layers,
  CheckSquare,
  Folder,
  ShoppingBag,
  Trash2,
  SortAsc,
  Copy,
  Grid3x3,
  List,
  Maximize2,
  Search,
  X,
  AlertCircle,
  Globe,
  Plus,
  BookOpen,
  MapPin,
  Loader2,
  Coins,
  Sparkles,
  Calendar,
  FileText,
  Settings,
  Filter,
  ChevronDown,
} from "lucide-react";
import { cn } from "~/lib/utils";
import { vaultNotify } from "~/lib/vault-notifications";
import { api } from "~/trpc/react";
import { IxCreditsSymbol } from "../IxCreditsSymbol";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "~/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "~/components/ui/popover";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "~/components/ui/sheet";
import { CardDisplay } from "~/components/cards/display";
import { VaultCardsFilterSidebar } from "./VaultCardsFilterSidebar";
import NumberFlow from "~/components/ui/number-flow";
import {
  CutoutCard,
  CutoutCardContent,
  cutoutCardSurfaceClassName,
} from "~/components/ui/cutout-card";
import type { CardInstance } from "~/types/cards-display";
import type { CardRarity, CardType } from "@prisma/client";

const CardDetailsModal = dynamic(
  () => import("~/components/cards/display/CardDetailsModal").then((m) => m.CardDetailsModal),
  { ssr: false }
);

type SubTab = "inventory" | "collections" | "gallery";

const SUB_TABS: { id: SubTab; label: string; icon: typeof Layers }[] = [
  { id: "inventory", label: "Inventory", icon: Layers },
  { id: "collections", label: "Collections", icon: Folder },
  { id: "gallery", label: "Card Gallery", icon: Globe },
];

type ViewMode = "grid" | "list" | "compact";
type GallerySource = "all" | "ns" | "lore";

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

interface VaultCardsSectionProps {
  initialTab?: string | null;
}

// ─── Sidebar: Inventory filters ──────────────────────────────────

function InventorySidebarContent({
  totalCards,
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
  onResetFilters,
}: {
  totalCards: number;
  totalValue: number;
  capacityBoost: number;
  filters: FilterState;
  setFilters: React.Dispatch<React.SetStateAction<FilterState>>;
  sortBy: string;
  setSortBy: (v: string) => void;
  viewMode: ViewMode;
  setViewMode: (v: ViewMode) => void;
  selectMode: boolean;
  setSelectMode: (v: boolean) => void;
  hideValue: boolean;
  setHideValue: (v: boolean) => void;
  onResetFilters: () => void;
}) {
  return (
    <div className="space-y-3">
      {/* Stats */}
      <div className="rounded-lg bg-cyan-500/5 p-2.5">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground text-[10px] font-bold tracking-widest uppercase">
            My Cards
          </span>
          <Layers className="h-3 w-3 text-cyan-600 dark:text-cyan-400" />
        </div>
        <div className="mt-1.5 flex items-baseline gap-1">
          <span className="text-xl font-extrabold tracking-tighter text-cyan-600 dark:text-cyan-400">
            {totalCards} / {150 + capacityBoost}
          </span>
          <span className="text-muted-foreground text-[10px]">cards</span>
        </div>
        <div className="mt-1.5 flex items-center gap-3 text-xs">
          <div className="flex items-center gap-1">
            <IxCreditsSymbol className="h-3 w-3 shrink-0 text-amber-600 dark:text-amber-400" />
            <span className="font-bold text-amber-600 dark:text-amber-400">
              <NumberFlow value={totalValue} />
            </span>
          </div>
          <div className="flex items-center gap-1">
            <Copy className="h-3 w-3 shrink-0 text-purple-600 dark:text-purple-400" />
            <span className="font-bold text-purple-600 dark:text-purple-400">0</span>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2 h-3 w-3 -translate-y-1/2" />
        <Input
          value={filters.search}
          onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))}
          placeholder="Search cards..."
          className="border-border/50 placeholder:text-muted-foreground/50 h-7 bg-transparent pr-6 pl-6.5 text-xs"
        />
        {filters.search && (
          <button
            onClick={() => setFilters((prev) => ({ ...prev, search: "" }))}
            className="absolute top-1/2 right-1.5 -translate-y-1/2"
          >
            <X className="text-muted-foreground hover:text-foreground h-3 w-3 transition-colors" />
          </button>
        )}
      </div>

      {/* Rarity */}
      <Select
        value={filters.rarity}
        onValueChange={(val) => setFilters((prev) => ({ ...prev, rarity: val as any }))}
      >
        <SelectTrigger
          className={cn(
            "h-7 w-full px-2 text-xs",
            filters.rarity !== "all" && "border-amber-500/30 bg-amber-500/20 text-amber-100"
          )}
        >
          <Sparkles className="mr-1.5 h-3 w-3 shrink-0" />
          <SelectValue placeholder="Rarity" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Rarities</SelectItem>
          <SelectItem value="COMMON">Common</SelectItem>
          <SelectItem value="UNCOMMON">Uncommon</SelectItem>
          <SelectItem value="RARE">Rare</SelectItem>
          <SelectItem value="ULTRA_RARE">Ultra Rare</SelectItem>
          <SelectItem value="EPIC">Epic</SelectItem>
          <SelectItem value="LEGENDARY">Legendary</SelectItem>
        </SelectContent>
      </Select>

      {/* Card Type */}
      <Select
        value={filters.cardType}
        onValueChange={(val) => setFilters((prev) => ({ ...prev, cardType: val as any }))}
      >
        <SelectTrigger
          className={cn(
            "h-7 w-full px-2 text-xs",
            filters.cardType !== "all" && "border-cyan-500/30 bg-cyan-500/20 text-cyan-100"
          )}
        >
          <FileText className="mr-1.5 h-3 w-3 shrink-0" />
          <SelectValue placeholder="Type" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Types</SelectItem>
          <SelectItem value="NS_IMPORT">NationStates Import</SelectItem>
          <SelectItem value="LORE_CARD">Lore Card</SelectItem>
          <SelectItem value="EVENT_CARD">Event Card</SelectItem>
        </SelectContent>
      </Select>

      {/* Season */}
      <Select
        value={filters.season.toString()}
        onValueChange={(val) =>
          setFilters((prev) => ({ ...prev, season: val === "all" ? "all" : parseInt(val) }))
        }
      >
        <SelectTrigger
          className={cn(
            "h-7 w-full px-2 text-xs",
            filters.season !== "all" && "border-purple-500/30 bg-purple-500/20 text-purple-100"
          )}
        >
          <Calendar className="mr-1.5 h-3 w-3 shrink-0" />
          <SelectValue placeholder="Season" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Seasons</SelectItem>
          <SelectItem value="1">Season 1</SelectItem>
          <SelectItem value="2">Season 2</SelectItem>
          <SelectItem value="3">Season 3</SelectItem>
        </SelectContent>
      </Select>

      <div className="border-border/40 space-y-3 border-t pt-3">
        {/* Sort */}
        <div>
          <p className="text-muted-foreground mb-1 text-[10px] font-bold tracking-widest uppercase">
            Sort By
          </p>
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="h-7 w-full text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="acquired">Recently Acquired</SelectItem>
              <SelectItem value="rarity">Rarity (High to Low)</SelectItem>
              <SelectItem value="value">Market Value (High to Low)</SelectItem>
              <SelectItem value="name">Alphabetical</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* View Mode */}
        <div>
          <p className="text-muted-foreground mb-1 text-[10px] font-bold tracking-widest uppercase">
            View
          </p>
          <div className="flex gap-1">
            {(["grid", "list", "compact"] as ViewMode[]).map((mode) => (
              <Button
                key={mode}
                variant={viewMode === mode ? "default" : "outline"}
                size="sm"
                onClick={() => setViewMode(mode)}
                className="h-6 flex-1 text-[10px] font-semibold"
              >
                {mode === "grid" ? (
                  <>
                    <Grid3x3 className="mr-1 h-3 w-3" /> Grid
                  </>
                ) : mode === "list" ? (
                  <>
                    <List className="mr-1 h-3 w-3" /> List
                  </>
                ) : (
                  <>
                    <Maximize2 className="mr-1 h-3 w-3" /> Cmpt
                  </>
                )}
              </Button>
            ))}
          </div>
        </div>

        {/* Multi-Select & Hide Value */}
        <div className="flex flex-col gap-1">
          <label className="flex cursor-pointer items-center gap-2 rounded-lg p-1.5 transition-colors hover:bg-white/5">
            <Checkbox
              checked={selectMode}
              onCheckedChange={(checked) => setSelectMode(checked as boolean)}
              className="h-3.5 w-3.5"
            />
            <span className="text-xs font-medium">Multi-Select Mode</span>
          </label>
          <label className="flex cursor-pointer items-center gap-2 rounded-lg p-1.5 transition-colors hover:bg-white/5">
            <Checkbox
              checked={hideValue}
              onCheckedChange={(checked) => setHideValue(checked as boolean)}
              className="h-3.5 w-3.5"
            />
            <span className="text-xs font-medium">Hide Card Values</span>
          </label>
        </div>
      </div>

      {/* Clear Filters */}
      {(filters.search ||
        filters.rarity !== "all" ||
        filters.cardType !== "all" ||
        filters.season !== "all") && (
        <button
          onClick={onResetFilters}
          className="border-border/50 text-muted-foreground hover:text-foreground flex w-full items-center justify-center gap-1 rounded-lg border py-1.5 text-xs font-semibold transition-colors hover:bg-white/5"
        >
          <X className="h-3 w-3" /> Clear Filters
        </button>
      )}
    </div>
  );
}

// ─── Sidebar: Collections actions ────────────────────────────────

function CollectionsSidebarContent({ onCreateCollection }: { onCreateCollection: () => void }) {
  return (
    <div className="space-y-3">
      <Button size="sm" onClick={onCreateCollection} className="h-8 w-full text-xs">
        <Plus className="mr-1.5 h-3.5 w-3.5" /> Create Collection
      </Button>

      <div className="rounded-lg bg-amber-500/5 p-2.5">
        <div className="flex items-center gap-1.5">
          <BookOpen className="h-3 w-3 shrink-0 text-amber-600 dark:text-amber-400" />
          <span className="text-muted-foreground text-[10px] font-bold tracking-widest uppercase">
            Tip
          </span>
        </div>
        <p className="text-muted-foreground mt-1 text-[11px] leading-relaxed">
          Use <span className="text-foreground font-semibold">Multi-Select Mode</span> in the
          Inventory tab to select cards and add them to your collections.
        </p>
      </div>
    </div>
  );
}

// ─── Sidebar: Gallery filters ────────────────────────────────────

function GallerySidebarContent({
  source,
  setSource,
  search,
  setSearch,
  season,
  setSeason,
  rarity,
  setRarity,
  sortBy,
  setSortBy,
  onClearFilters,
  onRequestLoreCard,
}: {
  source: GallerySource;
  setSource: (v: GallerySource) => void;
  search: string;
  setSearch: (v: string) => void;
  season: number | "all";
  setSeason: (v: number | "all") => void;
  rarity: CardRarity | "all";
  setRarity: (v: CardRarity | "all") => void;
  sortBy: string;
  setSortBy: (v: string) => void;
  onClearFilters: () => void;
  onRequestLoreCard: () => void;
}) {
  return (
    <div className="space-y-3">
      {/* Source Toggle */}
      <div>
        <p className="text-muted-foreground mb-1.5 text-[10px] font-bold tracking-widest uppercase">
          Source
        </p>
        <div className="flex gap-1">
          {(["all", "ns", "lore"] as GallerySource[]).map((s) => (
            <button
              key={s}
              onClick={() => setSource(s)}
              className={cn(
                "flex-1 rounded-md px-2 py-1 text-[10px] font-semibold transition-all",
                source === s
                  ? "bg-purple-500/20 text-purple-400"
                  : "text-muted-foreground hover:text-foreground hover:bg-white/5"
              )}
            >
              {s === "all" ? "All" : s === "ns" ? "NS" : "Lore"}
            </button>
          ))}
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2 h-3 w-3 -translate-y-1/2" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search cards..."
          className="border-border/50 placeholder:text-muted-foreground/50 h-7 bg-transparent pr-6 pl-6.5 text-xs"
        />
        {search && (
          <button
            onClick={() => setSearch("")}
            className="absolute top-1/2 right-1.5 -translate-y-1/2"
          >
            <X className="text-muted-foreground hover:text-foreground h-3 w-3 transition-colors" />
          </button>
        )}
      </div>

      {/* Season */}
      <Select
        value={season.toString()}
        onValueChange={(v) => setSeason(v === "all" ? "all" : parseInt(v))}
      >
        <SelectTrigger
          className={cn(
            "h-7 w-full px-2 text-xs",
            season !== "all" && "border-purple-500/30 bg-purple-500/20 text-purple-100"
          )}
        >
          <Calendar className="mr-1.5 h-3 w-3 shrink-0" />
          <SelectValue placeholder="Season" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Seasons</SelectItem>
          <SelectItem value="1">Season 1</SelectItem>
          <SelectItem value="2">Season 2</SelectItem>
          <SelectItem value="3">Season 3</SelectItem>
        </SelectContent>
      </Select>

      {/* Rarity */}
      <Select value={rarity} onValueChange={(v) => setRarity(v as CardRarity | "all")}>
        <SelectTrigger
          className={cn(
            "h-7 w-full px-2 text-xs",
            rarity !== "all" && "border-amber-500/30 bg-amber-500/20 text-amber-100"
          )}
        >
          <Sparkles className="mr-1.5 h-3 w-3 shrink-0" />
          <SelectValue placeholder="Rarity" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Rarities</SelectItem>
          <SelectItem value="COMMON">Common</SelectItem>
          <SelectItem value="UNCOMMON">Uncommon</SelectItem>
          <SelectItem value="RARE">Rare</SelectItem>
          <SelectItem value="ULTRA_RARE">Ultra Rare</SelectItem>
          <SelectItem value="EPIC">Epic</SelectItem>
          <SelectItem value="LEGENDARY">Legendary</SelectItem>
        </SelectContent>
      </Select>

      {/* Sort */}
      <div>
        <p className="text-muted-foreground mb-1 text-[10px] font-bold tracking-widest uppercase">
          Sort By
        </p>
        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="h-7 w-full text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="rarity">Rarity</SelectItem>
            <SelectItem value="marketValue">Market Value</SelectItem>
            <SelectItem value="recent">Recent</SelectItem>
            <SelectItem value="name">Name</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Request Lore Card */}
      {(source === "all" || source === "lore") && (
        <Button
          size="sm"
          variant="outline"
          onClick={onRequestLoreCard}
          className="h-8 w-full border-purple-500/30 text-xs text-purple-600 hover:bg-purple-500/10 dark:text-purple-400"
        >
          <BookOpen className="mr-1.5 h-3 w-3" /> Request Lore Card
          <span className="ml-1.5 flex items-center gap-0.5 rounded-full bg-amber-500/10 px-1.5 py-0 text-[9px] font-semibold text-amber-600 dark:bg-amber-500/20 dark:text-amber-400">
            <IxCreditsSymbol className="h-2.5 w-2.5 shrink-0" />
            50
          </span>
        </Button>
      )}

      {/* Clear */}
      {(search || rarity !== "all" || season !== "all") && (
        <button
          onClick={onClearFilters}
          className="border-border/50 text-muted-foreground hover:text-foreground flex w-full items-center justify-center gap-1 rounded-lg border py-1.5 text-xs font-semibold transition-colors hover:bg-white/5"
        >
          <X className="h-3 w-3" /> Clear Filters
        </button>
      )}
    </div>
  );
}

// ─── Inventory Tab ───────────────────────────────────────────────

function InventoryTab({
  ownerships,
  isLoading,
  allCards,
  viewMode,
  selectMode,
  setSelectMode,
  hideValue,
  filters,
  onResetFilters,
}: {
  ownerships: any;
  isLoading: boolean;
  allCards: CardInstance[];
  viewMode: ViewMode;
  selectMode: boolean;
  setSelectMode: (v: boolean) => void;
  hideValue: boolean;
  filters: FilterState;
  onResetFilters: () => void;
}) {
  const [selectedCards, setSelectedCards] = useState<Set<string>>(new Set());
  const [selectedCard, setSelectedCard] = useState<CardInstance | null>(null);

  const utils = api.useUtils();
  const junkCardsMutation = api.cards.junkCards.useMutation({
    onSuccess: (data) => {
      vaultNotify.success(data.message || "Cards junked successfully!");
      setSelectedCards(new Set());
      setSelectMode(false);
      utils.cards.getMyCards.invalidate();
      utils.vault.getBalance.invalidate();
    },
    onError: (error) => {
      vaultNotify.error(error.message);
    },
  });

  const filteredCards = useMemo(() => {
    return allCards.filter((card) => {
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        const matchesTitle = card.title.toLowerCase().includes(searchLower);
        const matchesCountry = card.country?.name.toLowerCase().includes(searchLower);
        if (!matchesTitle && !matchesCountry) return false;
      }
      if (filters.cardType !== "all" && card.cardType !== filters.cardType) return false;
      if (filters.season !== "all" && card.season !== filters.season) return false;
      if (card.level < filters.minLevel || card.level > filters.maxLevel) return false;
      if (card.marketValue < filters.minValue || card.marketValue > filters.maxValue) return false;
      return true;
    });
  }, [allCards, filters]);

  const totalCards = allCards.length;

  const handleCardClick = useCallback(
    (card: CardInstance) => {
      const key = card.ownershipId || card.id;
      if (selectMode) {
        setSelectedCards((prev) => {
          const newSet = new Set(prev);
          if (newSet.has(key)) newSet.delete(key);
          else newSet.add(key);
          return newSet;
        });
      } else {
        setSelectedCard(card);
      }
    },
    [selectMode]
  );

  return (
    <div className="space-y-4">
      {/* Bulk Actions */}
      <AnimatePresence>
        {selectMode && selectedCards.size > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 50, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className="fixed bottom-6 left-1/2 z-50 w-full max-w-2xl -translate-x-1/2 px-4"
          >
            <Card className="glass-hierarchy-interactive rounded-2xl border-amber-400/30 bg-black/85 shadow-2xl shadow-black/80 backdrop-blur-xl">
              <CardContent className="p-3.5">
                <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
                  <div className="flex items-center gap-3">
                    <CheckSquare className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                    <span className="text-foreground text-sm font-bold">
                      {selectedCards.size} card{selectedCards.size !== 1 ? "s" : ""} selected
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        vaultNotify.cardsBulkAction("Added to collection:", selectedCards.size);
                        setSelectedCards(new Set());
                        setSelectMode(false);
                      }}
                      className="h-8 text-xs"
                    >
                      <Folder className="mr-1.5 h-3.5 w-3.5" /> Collection
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        vaultNotify.cardsBulkAction("Listed for auction:", selectedCards.size);
                        setSelectedCards(new Set());
                        setSelectMode(false);
                      }}
                      className="h-8 text-xs"
                    >
                      <ShoppingBag className="mr-1.5 h-3.5 w-3.5" /> Sell
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const ownershipIds = Array.from(selectedCards);
                        junkCardsMutation.mutate({ ownershipIds });
                      }}
                      disabled={junkCardsMutation.isPending}
                      className="h-8 text-xs text-red-400 hover:bg-red-500/10"
                    >
                      {junkCardsMutation.isPending ? (
                        <>
                          <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                          Junking...
                        </>
                      ) : (
                        <>
                          <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Junk
                        </>
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSelectedCards(new Set());
                        setSelectMode(false);
                      }}
                      className="h-8 text-xs"
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Card grid */}
      <div className="min-w-0 flex-1">
        {isLoading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
              <Skeleton key={i} className="h-80 rounded-2xl" />
            ))}
          </div>
        ) : filteredCards.length === 0 ? (
          <Card className="glass-hierarchy-child">
            <CardContent className="flex flex-col items-center justify-center py-8">
              <AlertCircle className="text-muted-foreground/40 mb-3 h-10 w-10" />
              <p className="text-foreground/80 mb-1 text-sm font-bold">No cards found</p>
              <p className="text-muted-foreground max-w-md text-center text-xs">
                {filters.search || filters.rarity !== "all" || filters.cardType !== "all"
                  ? "Try adjusting your filters to see more results"
                  : "Import some NS cards or open a pack to get started!"}
              </p>
              {(filters.search || filters.rarity !== "all" || filters.cardType !== "all") && (
                <Button onClick={onResetFilters} className="mt-4" variant="outline">
                  Reset Filters
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div
            className={cn(
              "grid gap-4",
              viewMode === "grid" && "grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4",
              viewMode === "list" && "grid-cols-1",
              viewMode === "compact" &&
                "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6"
            )}
          >
            {filteredCards.map((card) => (
              <motion.div
                key={card.ownershipId || card.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.2 }}
                className="relative"
              >
                {selectMode && (
                  <div className="absolute top-2 left-2 z-20">
                    <Checkbox
                      checked={selectedCards.has(card.ownershipId || card.id)}
                      onCheckedChange={() => handleCardClick(card)}
                      className="h-6 w-6 border-2 border-white bg-black/60 backdrop-blur-sm"
                    />
                  </div>
                )}
                <CardDisplay
                  card={card}
                  size={viewMode === "compact" ? "small" : "medium"}
                  onClick={handleCardClick}
                  hideValue={hideValue}
                  className={cn(
                    "transition-all",
                    selectMode &&
                      selectedCards.has(card.ownershipId || card.id) &&
                      "ring-2 ring-amber-400 ring-offset-2 ring-offset-black"
                  )}
                />
              </motion.div>
            ))}
          </div>
        )}
        {!isLoading && filteredCards.length > 0 && (
          <div className="text-muted-foreground mt-6 text-center text-sm">
            Showing {filteredCards.length} of {totalCards} cards
          </div>
        )}
      </div>

      <CardDetailsModal
        card={selectedCard}
        open={!!selectedCard}
        onClose={() => setSelectedCard(null)}
      />
    </div>
  );
}

// ─── Collections Tab ─────────────────────────────────────────────

function CollectionsTab({
  createOpen,
  onCreateOpenChange,
}: {
  createOpen: boolean;
  onCreateOpenChange: (v: boolean) => void;
}) {
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newIsPublic, setNewIsPublic] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data: collections, isLoading, refetch } = api.cards.getMyCollections.useQuery();
  const { data: collectionCards } = api.cards.getCollectionCards.useQuery(
    { collectionId: expandedId! },
    { enabled: !!expandedId }
  );

  const createCollection = api.cards.createCollection.useMutation({
    onSuccess: () => {
      vaultNotify.success("Collection created!");
      onCreateOpenChange(false);
      setNewName("");
      setNewDescription("");
      setNewIsPublic(false);
      void refetch();
    },
    onError: (error) => vaultNotify.error(error.message),
  });

  const deleteCollection = api.cards.deleteCollection.useMutation({
    onSuccess: () => {
      vaultNotify.success("Collection deleted");
      setExpandedId(null);
      void refetch();
    },
    onError: (error) => vaultNotify.error(error.message),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Folder className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
          <span className="text-xs font-bold">My Collections</span>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 rounded-lg" />
          ))}
        </div>
      ) : !collections || collections.length === 0 ? (
        <Card className="glass-hierarchy-child">
          <CardContent className="flex flex-col items-center justify-center py-8">
            <Folder className="text-muted-foreground/40 mb-3 h-10 w-10" />
            <p className="text-foreground/80 mb-1 text-sm font-bold">No Collections</p>
            <p className="text-muted-foreground max-w-md text-center text-xs">
              Create collections to organize cards by theme, rarity, or custom categories.
            </p>
            <Button
              className="mt-4"
              variant="outline"
              size="sm"
              onClick={() => onCreateOpenChange(true)}
            >
              <Plus className="mr-2 h-3.5 w-3.5" />
              Create Collection
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {collections.map((collection: any) => (
            <div key={collection.id}>
              <button
                onClick={() => setExpandedId(expandedId === collection.id ? null : collection.id)}
                className={cn(
                  "glass-hierarchy-child flex w-full items-center justify-between rounded-lg border p-3 text-left transition-all",
                  expandedId === collection.id
                    ? "border-amber-400/30"
                    : "border-border hover:border-foreground/20"
                )}
              >
                <div className="flex items-center gap-2.5">
                  <Folder className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                  <div>
                    <span className="text-xs font-bold">{collection.name}</span>
                    <p className="text-muted-foreground text-[0.6rem]">
                      {collection._count?.items ?? 0} cards
                      {collection.isPublic && " • Public"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 text-red-400 hover:bg-red-500/10"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteCollection.mutate({ collectionId: collection.id });
                    }}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                  {expandedId === collection.id ? (
                    <ChevronDown className="h-3 w-3 rotate-180 transition-transform" />
                  ) : (
                    <ChevronDown className="h-3 w-3 transition-transform" />
                  )}
                </div>
              </button>

              {/* Expanded cards */}
              <AnimatePresence>
                {expandedId === collection.id && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="pt-2 pl-4">
                      {!collectionCards || collectionCards.length === 0 ? (
                        <p className="text-muted-foreground py-4 text-center text-xs">
                          No cards in this collection yet. Use Select Mode in Inventory to add
                          cards.
                        </p>
                      ) : (
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
                          {collectionCards.map((item: any) => (
                            <CardDisplay
                              key={item.id}
                              card={item.cardOwnership?.cards ?? item}
                              size="small"
                              performanceMode
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>
      )}

      {/* Create Collection Dialog */}
      <Dialog open={createOpen} onOpenChange={onCreateOpenChange}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold">Create Collection</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-muted-foreground mb-1 block text-xs font-semibold">Name</label>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="My Rare Cards"
                className="h-8 text-xs"
                maxLength={100}
              />
            </div>
            <div>
              <label className="text-muted-foreground mb-1 block text-xs font-semibold">
                Description (optional)
              </label>
              <Input
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder="A collection of my rarest finds"
                className="h-8 text-xs"
              />
            </div>
            <label className="flex cursor-pointer items-center gap-2">
              <Checkbox
                checked={newIsPublic}
                onCheckedChange={(v) => setNewIsPublic(v as boolean)}
              />
              <span className="text-muted-foreground text-xs">Make this collection public</span>
            </label>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onCreateOpenChange(false)}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              className="text-xs"
              disabled={!newName.trim() || createCollection.isPending}
              onClick={() =>
                createCollection.mutate({
                  name: newName.trim(),
                  description: newDescription.trim() || undefined,
                  isPublic: newIsPublic,
                })
              }
            >
              {createCollection.isPending ? "Creating..." : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Card Gallery Tab (NS Library + Lore Cards unified) ──────────

const PAGE_SIZE = 50;

function CardGalleryTab({
  source,
  search,
  season,
  rarity,
  sortBy,
  onSourceChange,
  onSearchChange,
  onSeasonChange,
  onRarityChange,
  onSortByChange,
}: {
  source: GallerySource;
  search: string;
  season: number | "all";
  rarity: CardRarity | "all";
  sortBy: string;
  onSourceChange: (v: GallerySource) => void;
  onSearchChange: (v: string) => void;
  onSeasonChange: (v: number | "all") => void;
  onRarityChange: (v: CardRarity | "all") => void;
  onSortByChange: (v: string) => void;
}) {
  const [offset, setOffset] = useState(0);
  const [allNsCards, setAllNsCards] = useState<any[]>([]);
  const [selectedCard, setSelectedCard] = useState<CardInstance | null>(null);

  // NS Cards query (when source is "all" or "ns")
  const nsQueryInput = useMemo(
    () => ({
      limit: PAGE_SIZE,
      offset,
      search: search || undefined,
      season: season !== "all" ? season : undefined,
      rarity: rarity !== "all" ? rarity : undefined,
      sortBy: sortBy as any,
    }),
    [search, season, rarity, sortBy, offset]
  );

  const {
    data: nsCardsData,
    isLoading: nsLoading,
    isFetching: nsFetching,
  } = api.cards.getNSCards.useQuery(nsQueryInput, { enabled: source === "all" || source === "ns" });
  const { data: libraryStats } = api.cards.getNSLibraryStats.useQuery(undefined, {
    enabled: source === "all" || source === "ns",
  });

  // Lore Cards query (when source is "all" or "lore")
  const { data: loreData, isLoading: loreLoading } = api.loreCards.getAllLoreCards.useQuery(
    {
      limit: PAGE_SIZE,
      wikiSource: "all",
      search: search || undefined,
      sortBy: (sortBy === "rarity"
        ? "rarity"
        : sortBy === "marketValue"
          ? "marketValue"
          : sortBy === "name"
            ? "title"
            : "dateAdded") as any,
    },
    { enabled: source === "all" || source === "lore" }
  );

  // Accumulate NS cards for load-more
  useEffect(() => {
    if (nsCardsData) {
      if (offset === 0) {
        setAllNsCards(nsCardsData.cards);
      } else {
        setAllNsCards((prev) => {
          const existingIds = new Set(prev.map((c: any) => c.id));
          const newCards = nsCardsData.cards.filter((c: any) => !existingIds.has(c.id));
          return [...prev, ...newCards];
        });
      }
    }
  }, [nsCardsData, offset]);

  // Reset pagination when filters or source change
  const handleFilterChange = useCallback(() => {
    setOffset(0);
    setAllNsCards([]);
  }, []);

  useEffect(() => {
    handleFilterChange();
  }, [search, season, rarity, sortBy, source, handleFilterChange]);

  // Build display cards based on source
  const displayCards = useMemo(() => {
    const nsCards =
      source === "all" || source === "ns"
        ? allNsCards.length > 0
          ? allNsCards
          : (nsCardsData?.cards ?? [])
        : [];
    const loreCards =
      source === "all" || source === "lore"
        ? (loreData?.cards ?? []).map((card: any) => ({
            ...card,
            artwork: card.artwork || "/images/cards/lore-placeholder.svg",
            stats: card.stats || {},
            metadata: card.metadata || {},
            level: card.level || 1,
            evolutionStage: 0,
            enhancements: null,
            lastTrade: null,
            owners: [],
            country: null,
            nsCardId: null,
            nsSeason: null,
            nsData: null,
            wikiUrl: card.metadata?.wikiUrl || null,
            countryId: null,
          }))
        : [];

    if (source === "ns") return nsCards;
    if (source === "lore") return loreCards;

    // Merge and dedupe for "all"
    const merged = [...nsCards];
    const existingIds = new Set(merged.map((c: any) => c.id));
    for (const card of loreCards) {
      if (!existingIds.has(card.id)) {
        merged.push(card);
      }
    }
    return merged;
  }, [source, allNsCards, nsCardsData, loreData]);

  const isLoading = source === "all" || source === "ns" ? nsLoading : loreLoading;
  const hasMore = source !== "lore" && nsCardsData?.hasMore;
  const totalCount =
    source === "lore"
      ? (loreData?.total ?? 0)
      : source === "ns"
        ? (nsCardsData?.total ?? 0)
        : (nsCardsData?.total ?? 0) + (loreData?.total ?? 0);

  return (
    <div className="space-y-4">
      {/* Library stats banner (NS source) */}
      {(source === "all" || source === "ns") && libraryStats && libraryStats.totalCards > 0 && (
        <div className="flex flex-wrap items-center gap-4 rounded-xl border border-purple-400/20 bg-gradient-to-r from-purple-500/5 to-blue-500/5 px-4 py-2.5">
          <div className="flex items-center gap-2">
            <Layers className="h-3.5 w-3.5 text-purple-400" />
            <span className="text-xs font-bold text-purple-400">
              <NumberFlow value={libraryStats.totalCards} />
            </span>
            <span className="text-muted-foreground text-[0.65rem]">cards in library</span>
          </div>
          {libraryStats.cardsByRegion?.length > 0 && (
            <div className="flex items-center gap-1.5">
              <MapPin className="text-muted-foreground h-3 w-3" />
              <span className="text-muted-foreground text-[0.65rem]">
                Top:{" "}
                <span className="text-foreground/80 font-semibold">
                  {libraryStats.cardsByRegion[0]?.region}
                </span>
              </span>
            </div>
          )}
        </div>
      )}

      {/* Cards grid */}
      {isLoading && offset === 0 ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <Skeleton key={i} className="h-72 rounded-xl" />
          ))}
        </div>
      ) : displayCards.length === 0 ? (
        <Card className="glass-hierarchy-child">
          <CardContent className="flex flex-col items-center justify-center py-8">
            <Globe className="text-muted-foreground/40 mb-3 h-10 w-10" />
            <p className="text-foreground/80 mb-1 text-sm font-bold">No Cards Found</p>
            <p className="text-muted-foreground max-w-md text-center text-xs">
              {search || rarity !== "all" || season !== "all"
                ? "Try adjusting your filters"
                : source === "lore"
                  ? "No lore cards yet. Request one from a wiki article!"
                  : "No cards in the gallery yet."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {displayCards.map((card: any) => (
              <CardDisplay
                key={card.id}
                card={card}
                size="medium"
                onClick={(c) => {
                  setSelectedCard(c);
                }}
              />
            ))}
          </div>

          {/* Load More + count */}
          <div className="flex flex-col items-center gap-3 pt-2">
            <p className="text-muted-foreground text-xs">
              Showing {displayCards.length} of {totalCount.toLocaleString()} cards
            </p>
            {hasMore && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setOffset((prev) => prev + PAGE_SIZE)}
                disabled={nsFetching}
                className="border-white/10 text-xs"
              >
                {nsFetching ? (
                  <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <ChevronDown className="mr-2 h-3.5 w-3.5" />
                )}
                Load More
              </Button>
            )}
          </div>
        </>
      )}

      <CardDetailsModal
        card={selectedCard}
        open={!!selectedCard}
        onClose={() => setSelectedCard(null)}
      />
    </div>
  );
}

// ─── Main Section Component ──────────────────────────────────────

function resolveInitialTab(initialTab: string | null | undefined): SubTab {
  if (initialTab === "collections") return "collections";
  if (initialTab === "gallery" || initialTab === "lore-gallery" || initialTab === "ns-library")
    return "gallery";
  return "inventory";
}

export function VaultCardsSection() {
  const pathname = usePathname();
  const [activeTab, setActiveTab] = useState<SubTab>(() => {
    const subTab = getSubTabFromPathname(pathname);
    return resolveInitialTab(subTab);
  });

  const { data: userStatsData } = api.vault.getUserStats.useQuery(undefined, {
    staleTime: 30000,
  });

  // ─── Lifted Inventory State ───────────────────────────────────
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

  const { data: ownerships, isLoading: cardsLoading } = api.cards.getMyCards.useQuery({
    sortBy: sortBy as any,
    filterRarity: filters.rarity !== "all" ? (filters.rarity as any) : undefined,
  });

  const allCards: CardInstance[] = useMemo(() => {
    if (!ownerships) return [];
    return ownerships.map((ownership: any) => ({
      id: ownership.cards.id,
      ownershipId: ownership.id,
      isLocked: ownership.isLocked,
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
      baseStats: ownership.cards.stats || {},
      marketValue: ownership.cards.marketValue || 0,
      totalSupply: ownership.cards.totalSupply || 0,
      level: ownership.level ?? 1,
      evolutionStage: ownership.cards.evolutionStage || 0,
      enhancements: ownership.cards.enhancements || null,
      serialNumber: ownership.serialNumber,
      experience: ownership.experience,
      lastSalePrice: ownership.lastSalePrice,
      lastSaleDate: ownership.lastSaleDate,
      acquiredAt: ownership.acquiredAt,
      createdAt: ownership.cards.createdAt,
      updatedAt: ownership.cards.updatedAt,
      lastTrade: ownership.cards.lastTrade || null,
      country: ownership.cards.country,
      owners: [
        {
          userId: ownership.ownerId,
          quantity: ownership.quantity,
          acquiredDate: ownership.acquiredAt,
          acquiredMethod: "acquired",
        },
      ],
    }));
  }, [ownerships]);

  const totalCards = allCards.length;
  const totalValue = allCards.reduce((sum, card) => sum + card.marketValue, 0);

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

  // ─── Lifted Gallery State ─────────────────────────────────────
  const [gallerySource, setGallerySource] = useState<GallerySource>("all");
  const [gallerySearch, setGallerySearch] = useState("");
  const [gallerySeason, setGallerySeason] = useState<number | "all">("all");
  const [galleryRarity, setGalleryRarity] = useState<CardRarity | "all">("all");
  const [gallerySortBy, setGallerySortBy] = useState<string>("rarity");

  const handleGalleryClearFilters = useCallback(() => {
    setGallerySearch("");
    setGalleryRarity("all");
    setGallerySeason("all");
    setGallerySortBy("rarity");
  }, []);

  // ─── Request Lore Card State ──────────────────────────────────
  const [requestOpen, setRequestOpen] = useState(false);
  const [articleTitle, setArticleTitle] = useState("");
  const [wikiSource, setWikiSource] = useState<"ixwiki" | "iiwiki">("ixwiki");
  const requestLoreCard = api.loreCards.requestLoreCard.useMutation({
    onSuccess: () => {
      vaultNotify.success("Lore card requested! An admin will review it.");
      setRequestOpen(false);
      setArticleTitle("");
    },
    onError: (error) => vaultNotify.error(error.message),
  });

  // ─── Collections Create Dialog State ──────────────────────────
  const [collectionsCreateOpen, setCollectionsCreateOpen] = useState(false);

  // ─── Sidebar content (shared between desktop + mobile sheet) ───
  const sidebarContent = (
    <>
      {activeTab === "inventory" && (
        <InventorySidebarContent
          totalCards={totalCards}
          totalValue={totalValue}
          capacityBoost={userStatsData?.capacityBoost ?? 0}
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
          onResetFilters={handleResetFilters}
        />
      )}
      {activeTab === "collections" && (
        <CollectionsSidebarContent onCreateCollection={() => setCollectionsCreateOpen(true)} />
      )}
      {activeTab === "gallery" && (
        <GallerySidebarContent
          source={gallerySource}
          setSource={setGallerySource}
          search={gallerySearch}
          setSearch={setGallerySearch}
          season={gallerySeason}
          setSeason={setGallerySeason}
          rarity={galleryRarity}
          setRarity={setGalleryRarity}
          sortBy={gallerySortBy}
          setSortBy={setGallerySortBy}
          onClearFilters={handleGalleryClearFilters}
          onRequestLoreCard={() => setRequestOpen(true)}
        />
      )}
    </>
  );

  const hasActiveFilters = useMemo(() => {
    if (activeTab === "inventory") {
      return !!(
        filters.search ||
        filters.rarity !== "all" ||
        filters.cardType !== "all" ||
        filters.season !== "all"
      );
    }
    if (activeTab === "gallery") {
      return !!(gallerySearch || galleryRarity !== "all" || gallerySeason !== "all");
    }
    return false;
  }, [activeTab, filters, gallerySearch, galleryRarity, gallerySeason]);

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        {/* Tab strip */}
        <div className="glass-surface glass-refraction border-border/40 relative flex gap-1 overflow-hidden rounded-xl border p-1 shadow-sm backdrop-blur-md">
          <motion.div
            className="absolute inset-y-1 rounded-lg bg-white/8"
            layout
            layoutId="cards-tab-indicator"
            style={{
              width: `${100 / SUB_TABS.length}%`,
              left: `${(SUB_TABS.findIndex((t) => t.id === activeTab) / SUB_TABS.length) * 100}%`,
            }}
            transition={{ type: "spring", stiffness: 350, damping: 30 }}
          />
          {SUB_TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "relative z-10 flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-lg border-none bg-transparent px-3 py-2 text-xs font-semibold whitespace-nowrap transition-colors duration-205",
                  isActive
                    ? "text-amber-600 dark:text-amber-400"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon
                  className={cn(
                    "h-3.5 w-3.5 transition-colors duration-205",
                    isActive && "text-amber-600 dark:text-amber-400"
                  )}
                />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Mobile: filter button + sheet */}
        <div className="lg:hidden">
          <Sheet>
            <SheetTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className={cn(
                  "h-8 w-full text-xs",
                  hasActiveFilters &&
                    "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400"
                )}
              >
                <Filter className="mr-1.5 h-3 w-3" />
                Filters & Sort
                {hasActiveFilters && (
                  <span className="ml-1.5 rounded-full bg-amber-500/20 px-1.5 py-0 text-[9px] font-semibold text-amber-600 dark:text-amber-400">
                    active
                  </span>
                )}
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-72">
              <SheetHeader>
                <SheetTitle className="text-sm">Filters</SheetTitle>
              </SheetHeader>
              <div className="mt-4">{sidebarContent}</div>
            </SheetContent>
          </Sheet>
        </div>

        {/* Main layout: content + desktop sidebar */}
        <div className="flex gap-4 sm:gap-6">
          {/* Tab content */}
          <div className="min-w-0 flex-1">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.15 }}
              >
                {activeTab === "inventory" && (
                  <InventoryTab
                    ownerships={ownerships}
                    isLoading={cardsLoading}
                    allCards={allCards}
                    viewMode={viewMode}
                    selectMode={selectMode}
                    setSelectMode={setSelectMode}
                    hideValue={hideValue}
                    filters={filters}
                    onResetFilters={handleResetFilters}
                  />
                )}
                {activeTab === "collections" && (
                  <CollectionsTab
                    createOpen={collectionsCreateOpen}
                    onCreateOpenChange={setCollectionsCreateOpen}
                  />
                )}
                {activeTab === "gallery" && (
                  <CardGalleryTab
                    source={gallerySource}
                    onSourceChange={setGallerySource}
                    search={gallerySearch}
                    onSearchChange={setGallerySearch}
                    season={gallerySeason}
                    onSeasonChange={setGallerySeason}
                    rarity={galleryRarity}
                    onRarityChange={setGalleryRarity}
                    sortBy={gallerySortBy}
                    onSortByChange={setGallerySortBy}
                  />
                )}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Desktop: right sidebar */}
          <div className="relative z-30 hidden shrink-0 lg:block">
            <div className="sticky top-6">
              <VaultCardsFilterSidebar>{sidebarContent}</VaultCardsFilterSidebar>
            </div>
          </div>
        </div>
      </div>

      {/* Request Lore Card Dialog */}
      <Dialog open={requestOpen} onOpenChange={setRequestOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold">Request Lore Card</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-muted-foreground text-xs">
              Submit a wiki article to be turned into a lore card. An admin will review your
              request. Cost:{" "}
              <span className="inline-flex items-center gap-0.5 align-middle font-semibold text-amber-600 dark:text-amber-400">
                <IxCreditsSymbol className="h-3 w-3 shrink-0" />
                50
              </span>
            </p>
            <div>
              <label className="text-muted-foreground mb-1 block text-xs font-semibold">
                Article Title
              </label>
              <Input
                value={articleTitle}
                onChange={(e) => setArticleTitle(e.target.value)}
                placeholder="e.g. Battle of Kingsport"
                className="h-8 text-xs"
                maxLength={200}
              />
            </div>
            <div>
              <label className="text-muted-foreground mb-1 block text-xs font-semibold">
                Wiki Source
              </label>
              <Select
                value={wikiSource}
                onValueChange={(v) => setWikiSource(v as "ixwiki" | "iiwiki")}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ixwiki">IxWiki</SelectItem>
                  <SelectItem value="iiwiki">IIWiki</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setRequestOpen(false)}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              className="text-xs"
              disabled={!articleTitle.trim() || requestLoreCard.isPending}
              onClick={() =>
                requestLoreCard.mutate({ articleTitle: articleTitle.trim(), wikiSource })
              }
            >
              <IxCreditsSymbol className="mr-1.5 h-3 w-3 shrink-0 text-white" />
              {requestLoreCard.isPending ? "Requesting..." : "Request (50)"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
