"use client";

import { useState, useMemo, useCallback } from "react";
import dynamic from "next/dynamic";
import { motion, AnimatePresence } from "motion/react";
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
  Lock,
  Globe,
  Plus,
  Edit,
  Eye,
  Sparkles,
  Package,
  Star,
  Image as ImageIcon,
  BookOpen,
  ChevronLeft,
  ChevronRight,
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
import { CardDisplay } from "~/components/cards/display";
import { useSoundService } from "~/lib/sound-service";
import NumberFlow from "~/components/ui/number-flow";
import type { CardInstance } from "~/types/cards-display";
import type { CardRarity, CardType } from "@prisma/client";

const CardDetailsModal = dynamic(
  () => import("~/components/cards/display/CardDetailsModal").then(m => m.CardDetailsModal),
  { ssr: false }
);

type SubTab = "inventory" | "collections" | "lore-gallery";

const SUB_TABS: { id: SubTab; label: string; icon: typeof Layers }[] = [
  { id: "inventory", label: "Inventory", icon: Layers },
  { id: "collections", label: "Collections", icon: Folder },
  { id: "lore-gallery", label: "Lore Gallery", icon: BookOpen },
];

interface VaultCardsSectionProps {
  initialTab?: string | null;
}

// ─── Inventory Tab ───────────────────────────────────────────────

type ViewMode = "grid" | "list" | "compact";

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

function InventoryTab() {
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

  const { data: ownerships, isLoading } = api.cards.getMyCards.useQuery({
    sortBy: sortBy as any,
    filterRarity: filters.rarity !== "all" ? (filters.rarity as any) : undefined,
  });

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
  const totalValue = allCards.reduce((sum, card) => sum + card.marketValue, 0);

  const handleFilterChange = useCallback((newFilters: Partial<FilterState>) => {
    setFilters((prev) => ({ ...prev, ...newFilters }));
  }, []);

  const handleResetFilters = useCallback(() => {
    setFilters({ search: "", rarity: "all", cardType: "all", season: "all", minLevel: 1, maxLevel: 100, minValue: 0, maxValue: 999999 });
  }, []);

  const handleCardClick = useCallback(
    (card: CardInstance) => {
      if (selectMode) {
        setSelectedCards((prev) => {
          const newSet = new Set(prev);
          if (newSet.has(card.id)) newSet.delete(card.id);
          else newSet.add(card.id);
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

  return (
    <div className="space-y-6">
      {/* Stats row */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
        <Card className="glass-hierarchy-child overflow-hidden">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="rounded-full bg-gradient-to-br from-purple-500/20 to-purple-600/20 p-3 border border-purple-400/30">
                <Layers className="h-6 w-6 text-purple-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Cards</p>
                <p className="text-3xl font-black text-purple-400"><NumberFlow value={totalCards} /></p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="glass-hierarchy-child overflow-hidden">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="rounded-full bg-gradient-to-br from-amber-500/20 to-amber-600/20 p-3 border border-amber-400/30">
                <TrendingUp className="h-6 w-6 text-amber-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Value</p>
                <p className="text-3xl font-black text-amber-400"><NumberFlow value={totalValue} /> IxC</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="glass-hierarchy-child overflow-hidden">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="rounded-full bg-gradient-to-br from-cyan-500/20 to-cyan-600/20 p-3 border border-cyan-400/30">
                <Copy className="h-6 w-6 text-cyan-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Duplicates</p>
                <p className="text-3xl font-black text-cyan-400"><NumberFlow value={0} /></p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Toolbar */}
      <Card className="glass-hierarchy-child">
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-center gap-2 flex-wrap">
              <Button variant={filtersOpen ? "default" : "outline"} size="sm" onClick={() => setFiltersOpen(!filtersOpen)}>
                <Filter className="mr-2 h-4 w-4" /> Filters
              </Button>
              <div className="h-6 w-px bg-white/10" />
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox checked={selectMode} onCheckedChange={(checked) => setSelectMode(checked as boolean)} />
                <span className="text-sm font-medium text-muted-foreground">Select Mode</span>
              </label>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-1 p-1 rounded-lg bg-black/30">
                {(["grid", "list", "compact"] as ViewMode[]).map((mode) => (
                  <Button key={mode} variant={viewMode === mode ? "default" : "ghost"} size="icon" onClick={() => setViewMode(mode)} className="h-8 w-8">
                    {mode === "grid" ? <Grid3x3 className="h-4 w-4" /> : mode === "list" ? <List className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                  </Button>
                ))}
              </div>
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-[180px] glass-hierarchy-interactive">
                  <SortAsc className="mr-2 h-4 w-4" /><SelectValue />
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

      {/* Bulk Actions */}
      <AnimatePresence>
        {selectMode && selectedCards.size > 0 && (
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
            <Card className="glass-hierarchy-interactive border-amber-400/30">
              <CardContent className="p-4">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <CheckSquare className="h-5 w-5 text-amber-400" />
                    <span className="font-bold text-foreground">{selectedCards.size} card{selectedCards.size !== 1 ? "s" : ""} selected</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" onClick={() => { toast.success(`Adding ${selectedCards.size} cards to collection`); setSelectedCards(new Set()); setSelectMode(false); }}>
                      <Folder className="mr-2 h-4 w-4" /> Collection
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => { toast.success(`Listing ${selectedCards.size} cards for auction`); setSelectedCards(new Set()); setSelectMode(false); }}>
                      <ShoppingBag className="mr-2 h-4 w-4" /> List for Sale
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => { toast.success(`Junked ${selectedCards.size} cards`); setSelectedCards(new Set()); setSelectMode(false); }} className="text-red-400 hover:bg-red-500/10">
                      <Trash2 className="mr-2 h-4 w-4" /> Junk
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => { setSelectedCards(new Set()); setSelectMode(false); }}>Cancel</Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Card grid */}
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
              <AlertCircle className="mb-4 h-16 w-16 text-muted-foreground/40" />
              <p className="text-xl font-bold text-foreground/80 mb-2">No cards found</p>
              <p className="text-muted-foreground text-center max-w-md">
                {filters.search || filters.rarity !== "all" || filters.cardType !== "all"
                  ? "Try adjusting your filters to see more results"
                  : "Import some NS cards or open a pack to get started!"}
              </p>
              {(filters.search || filters.rarity !== "all" || filters.cardType !== "all") && (
                <Button onClick={handleResetFilters} className="mt-4" variant="outline">Reset Filters</Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className={cn(
            "grid gap-4",
            viewMode === "grid" && "grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4",
            viewMode === "list" && "grid-cols-1",
            viewMode === "compact" && "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6"
          )}>
            {filteredCards.map((card) => (
              <motion.div key={card.id} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.2 }} className="relative">
                {selectMode && (
                  <div className="absolute top-2 left-2 z-20">
                    <Checkbox checked={selectedCards.has(card.id)} onCheckedChange={() => handleCardClick(card)} className="h-6 w-6 border-2 border-white bg-black/60 backdrop-blur-sm" />
                  </div>
                )}
                <CardDisplay
                  card={card}
                  size={viewMode === "compact" ? "small" : "medium"}
                  onClick={handleCardClick}
                  className={cn("transition-all", selectMode && selectedCards.has(card.id) && "ring-2 ring-amber-400 ring-offset-2 ring-offset-black")}
                />
              </motion.div>
            ))}
          </div>
        )}
        {!isLoading && filteredCards.length > 0 && (
          <div className="mt-6 text-center text-sm text-muted-foreground">
            Showing {filteredCards.length} of {totalCards} cards
          </div>
        )}
      </div>

      <CardDetailsModal card={selectedCard} open={!!selectedCard} onClose={() => setSelectedCard(null)} />
    </div>
  );
}

// ─── Collections Tab (placeholder wrapper) ───────────────────────

function CollectionsTab() {
  return (
    <div className="space-y-6">
      <Card className="glass-hierarchy-child">
        <CardContent className="flex flex-col items-center justify-center py-20">
          <Folder className="mb-4 h-16 w-16 text-muted-foreground/40" />
          <p className="text-xl font-bold text-foreground/80 mb-2">Collections</p>
          <p className="text-muted-foreground text-center max-w-md">
            Create and manage your card collections. Organize cards by theme, rarity, or custom categories.
          </p>
          <Button className="mt-6" variant="outline">
            <Plus className="mr-2 h-4 w-4" />
            Create Collection
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Lore Gallery Tab (placeholder wrapper) ──────────────────────

function LoreGalleryTab() {
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  const { data: loreCards, isLoading } = api.cards.getLoreCards.useQuery({
    limit: 50,
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h3 className="text-xl font-black text-foreground">Lore Card Gallery</h3>
          <p className="text-sm text-muted-foreground">Browse lore cards generated from IxWiki and IIWiki articles</p>
        </div>
        <div className="flex items-center gap-1 p-1 rounded-lg bg-black/30">
          <Button variant={viewMode === "grid" ? "default" : "ghost"} size="icon" onClick={() => setViewMode("grid")} className="h-8 w-8">
            <Grid3x3 className="h-4 w-4" />
          </Button>
          <Button variant={viewMode === "list" ? "default" : "ghost"} size="icon" onClick={() => setViewMode("list")} className="h-8 w-8">
            <List className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <Skeleton key={i} className="h-80 rounded-2xl" />
          ))}
        </div>
      ) : !loreCards || loreCards.length === 0 ? (
        <Card className="glass-hierarchy-child">
          <CardContent className="flex flex-col items-center justify-center py-20">
            <BookOpen className="mb-4 h-16 w-16 text-muted-foreground/40" />
            <p className="text-xl font-bold text-foreground/80 mb-2">No Lore Cards Yet</p>
            <p className="text-muted-foreground text-center max-w-md">
              Lore cards are generated from wiki articles. Check back soon!
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className={cn("grid gap-4", viewMode === "grid" ? "grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4" : "grid-cols-1")}>
          {loreCards.map((card: any) => (
            <CardDisplay key={card.id} card={card} size="medium" />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main Section Component ──────────────────────────────────────

function resolveInitialTab(initialTab: string | null | undefined): SubTab {
  if (initialTab === "collections") return "collections";
  if (initialTab === "lore-gallery") return "lore-gallery";
  return "inventory";
}

export function VaultCardsSection({ initialTab }: VaultCardsSectionProps) {
  const [activeTab, setActiveTab] = useState<SubTab>(() => resolveInitialTab(initialTab));

  return (
    <div className="space-y-6">
      {/* Tab strip */}
      <div className="flex gap-1 overflow-x-auto rounded-lg bg-black/20 p-1 backdrop-blur-sm">
        {SUB_TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex items-center gap-2 whitespace-nowrap rounded-md px-4 py-2.5 text-sm font-semibold transition-all",
                isActive
                  ? "bg-amber-500/20 text-amber-400 shadow-sm"
                  : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
              )}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.15 }}
        >
          {activeTab === "inventory" && <InventoryTab />}
          {activeTab === "collections" && <CollectionsTab />}
          {activeTab === "lore-gallery" && <LoreGalleryTab />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
