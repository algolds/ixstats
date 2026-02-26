"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
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
  Globe,
  Plus,
  BookOpen,
  MapPin,
  Loader2,
  Coins,
} from "lucide-react";
import { cn } from "~/lib/utils";
import { vaultNotify } from "~/lib/vault-notifications";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "~/components/ui/dialog";
import { CardDisplay } from "~/components/cards/display";
import { useSoundService } from "~/lib/sound-service";
import NumberFlow from "~/components/ui/number-flow";
import type { CardInstance } from "~/types/cards-display";
import type { CardRarity, CardType } from "@prisma/client";

const CardDetailsModal = dynamic(
  () => import("~/components/cards/display/CardDetailsModal").then(m => m.CardDetailsModal),
  { ssr: false }
);

type SubTab = "inventory" | "collections" | "gallery";

const SUB_TABS: { id: SubTab; label: string; icon: typeof Layers }[] = [
  { id: "inventory", label: "Inventory", icon: Layers },
  { id: "collections", label: "Collections", icon: Folder },
  { id: "gallery", label: "Card Gallery", icon: Globe },
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

  const _handleFilterChange = useCallback((newFilters: Partial<FilterState>) => {
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
    <div className="space-y-4">
      {/* Stats strip */}
      <div className="grid gap-3 grid-cols-3">
        {[
          { label: "Total Cards", value: totalCards, icon: Layers, color: "text-purple-400" },
          { label: "Total Value", value: totalValue, icon: TrendingUp, color: "text-amber-400", suffix: " IxC" },
          { label: "Duplicates", value: 0, icon: Copy, color: "text-cyan-400" },
        ].map((stat) => (
          <div key={stat.label} className="glass-hierarchy-child flex items-center gap-2 rounded-lg p-2.5">
            <stat.icon className={cn("h-3.5 w-3.5 flex-shrink-0", stat.color)} />
            <div className="min-w-0">
              <p className="text-[0.65rem] text-muted-foreground truncate">{stat.label}</p>
              <p className={cn("text-lg font-bold leading-tight", stat.color)}>
                <NumberFlow value={stat.value} />{stat.suffix ?? ""}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <Card className="glass-hierarchy-child">
        <CardContent className="p-3">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-center gap-2 flex-wrap">
              <Button variant={filtersOpen ? "default" : "outline"} size="sm" onClick={() => setFiltersOpen(!filtersOpen)}>
                <Filter className="mr-2 h-4 w-4" /> Filters
              </Button>
              <div className="h-6 w-px bg-border" />
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox checked={selectMode} onCheckedChange={(checked) => setSelectMode(checked as boolean)} />
                <span className="text-sm font-medium text-muted-foreground">Select Mode</span>
              </label>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="glass-hierarchy-child flex items-center gap-1 rounded-lg p-1">
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
                <SelectContent>
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
                    <Button variant="outline" size="sm" onClick={() => { vaultNotify.cardsBulkAction("Added to collection:", selectedCards.size); setSelectedCards(new Set()); setSelectMode(false); }}>
                      <Folder className="mr-2 h-4 w-4" /> Collection
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => { vaultNotify.cardsBulkAction("Listed for auction:", selectedCards.size); setSelectedCards(new Set()); setSelectMode(false); }}>
                      <ShoppingBag className="mr-2 h-4 w-4" /> List for Sale
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => { vaultNotify.cardsBulkAction("Junked", selectedCards.size); setSelectedCards(new Set()); setSelectMode(false); }} className="text-red-400 hover:bg-red-500/10">
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
            <CardContent className="flex flex-col items-center justify-center py-8">
              <AlertCircle className="mb-3 h-10 w-10 text-muted-foreground/40" />
              <p className="text-sm font-bold text-foreground/80 mb-1">No cards found</p>
              <p className="text-xs text-muted-foreground text-center max-w-md">
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

// ─── Collections Tab ─────────────────────────────────────────────

function CollectionsTab() {
  const [createOpen, setCreateOpen] = useState(false);
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
      setCreateOpen(false);
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
          <Folder className="h-3.5 w-3.5 text-amber-400" />
          <span className="text-xs font-bold">My Collections</span>
        </div>
        <Button size="sm" onClick={() => setCreateOpen(true)} className="glass-hierarchy-interactive text-xs">
          <Plus className="mr-1.5 h-3.5 w-3.5" /> Create Collection
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 rounded-lg" />)}
        </div>
      ) : !collections || collections.length === 0 ? (
        <Card className="glass-hierarchy-child">
          <CardContent className="flex flex-col items-center justify-center py-8">
            <Folder className="mb-3 h-10 w-10 text-muted-foreground/40" />
            <p className="text-sm font-bold text-foreground/80 mb-1">No Collections</p>
            <p className="text-xs text-muted-foreground text-center max-w-md">
              Create collections to organize cards by theme, rarity, or custom categories.
            </p>
            <Button className="mt-4" variant="outline" size="sm" onClick={() => setCreateOpen(true)}>
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
                  expandedId === collection.id ? "border-amber-400/30" : "border-border hover:border-foreground/20"
                )}
              >
                <div className="flex items-center gap-2.5">
                  <Folder className="h-4 w-4 text-amber-400" />
                  <div>
                    <span className="text-xs font-bold">{collection.name}</span>
                    <p className="text-[0.6rem] text-muted-foreground">
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
                  {expandedId === collection.id ? <ChevronDown className="h-3 w-3 rotate-180 transition-transform" /> : <ChevronDown className="h-3 w-3 transition-transform" />}
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
                        <p className="py-4 text-center text-xs text-muted-foreground">
                          No cards in this collection yet. Use Select Mode in Inventory to add cards.
                        </p>
                      ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
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
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold">Create Collection</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-muted-foreground">Name</label>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="My Rare Cards"
                className="h-8 text-xs"
                maxLength={100}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-muted-foreground">Description (optional)</label>
              <Input
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder="A collection of my rarest finds"
                className="h-8 text-xs"
              />
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <Checkbox checked={newIsPublic} onCheckedChange={(v) => setNewIsPublic(v as boolean)} />
              <span className="text-xs text-muted-foreground">Make this collection public</span>
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setCreateOpen(false)} className="text-xs">Cancel</Button>
            <Button
              size="sm"
              className="text-xs"
              disabled={!newName.trim() || createCollection.isPending}
              onClick={() => createCollection.mutate({ name: newName.trim(), description: newDescription.trim() || undefined, isPublic: newIsPublic })}
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

type GallerySource = "all" | "ns" | "lore";

const PAGE_SIZE = 50;

function CardGalleryTab() {
  const [source, setSource] = useState<GallerySource>("all");
  const [search, setSearch] = useState("");
  const [season, setSeason] = useState<number | "all">("all");
  const [rarity, setRarity] = useState<CardRarity | "all">("all");
  const [sortBy, setSortBy] = useState<string>("rarity");
  const [offset, setOffset] = useState(0);
  const [allNsCards, setAllNsCards] = useState<any[]>([]);
  const [selectedCard, setSelectedCard] = useState<CardInstance | null>(null);

  // Request lore card state
  const [requestOpen, setRequestOpen] = useState(false);
  const [articleTitle, setArticleTitle] = useState("");
  const [wikiSource, setWikiSource] = useState<"ixwiki" | "iiwiki">("ixwiki");

  const soundService = useSoundService();

  // NS Cards query (when source is "all" or "ns")
  const nsQueryInput = useMemo(() => ({
    limit: PAGE_SIZE,
    offset,
    search: search || undefined,
    season: season !== "all" ? season : undefined,
    rarity: rarity !== "all" ? rarity : undefined,
    sortBy: sortBy as any,
  }), [search, season, rarity, sortBy, offset]);

  const { data: nsCardsData, isLoading: nsLoading, isFetching: nsFetching } = api.cards.getNSCards.useQuery(
    nsQueryInput,
    { enabled: source === "all" || source === "ns" }
  );
  const { data: libraryStats } = api.cards.getNSLibraryStats.useQuery(
    undefined,
    { enabled: source === "all" || source === "ns" }
  );

  // Lore Cards query (when source is "all" or "lore")
  const { data: loreData, isLoading: loreLoading } = api.loreCards.getAllLoreCards.useQuery(
    {
      limit: PAGE_SIZE,
      wikiSource: "all",
      search: search || undefined,
      sortBy: (sortBy === "rarity" ? "rarity" : sortBy === "marketValue" ? "marketValue" : sortBy === "name" ? "title" : "dateAdded") as any,
    },
    { enabled: source === "all" || source === "lore" }
  );

  // Request lore card mutation
  const requestLoreCard = api.loreCards.requestLoreCard.useMutation({
    onSuccess: () => {
      vaultNotify.success("Lore card requested! An admin will review it.");
      setRequestOpen(false);
      setArticleTitle("");
    },
    onError: (error) => vaultNotify.error(error.message),
  });

  // Accumulate NS cards for load-more
  useEffect(() => {
    if (nsCardsData) {
      if (offset === 0) {
        setAllNsCards(nsCardsData.cards);
      } else {
        setAllNsCards(prev => {
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
    const nsCards = (source === "all" || source === "ns") ? (allNsCards.length > 0 ? allNsCards : nsCardsData?.cards ?? []) : [];
    const loreCards = (source === "all" || source === "lore")
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

  const isLoading = (source === "all" || source === "ns") ? nsLoading : loreLoading;
  const hasMore = source !== "lore" && nsCardsData?.hasMore;
  const totalCount = source === "lore" ? (loreData?.total ?? 0) : source === "ns" ? (nsCardsData?.total ?? 0) : ((nsCardsData?.total ?? 0) + (loreData?.total ?? 0));

  return (
    <div className="space-y-4">
      {/* Source toggle */}
      <div className="flex items-center gap-2">
        {(["all", "ns", "lore"] as GallerySource[]).map((s) => (
          <button
            key={s}
            onClick={() => setSource(s)}
            className={cn(
              "rounded-lg px-3 py-1.5 text-xs font-semibold transition-all",
              source === s
                ? "bg-purple-500/20 text-purple-400"
                : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
            )}
          >
            {s === "all" ? "All Cards" : s === "ns" ? "NS Cards" : "Lore Cards"}
          </button>
        ))}

        <div className="flex-1" />

        {/* Request Lore Card button */}
        {(source === "all" || source === "lore") && (
          <Button size="sm" variant="outline" onClick={() => setRequestOpen(true)} className="text-xs border-purple-400/30 text-purple-400 hover:bg-purple-500/10">
            <BookOpen className="mr-1.5 h-3 w-3" /> Request Lore Card
            <span className="ml-1.5 rounded-full bg-amber-500/20 px-1.5 py-0 text-[9px] font-semibold text-amber-400">50 IxC</span>
          </Button>
        )}
      </div>

      {/* Library stats banner (NS source) */}
      {(source === "all" || source === "ns") && libraryStats && libraryStats.totalCards > 0 && (
        <div className="flex flex-wrap items-center gap-4 rounded-xl border border-purple-400/20 bg-gradient-to-r from-purple-500/5 to-blue-500/5 px-4 py-2.5">
          <div className="flex items-center gap-2">
            <Layers className="h-3.5 w-3.5 text-purple-400" />
            <span className="text-xs font-bold text-purple-400">
              <NumberFlow value={libraryStats.totalCards} />
            </span>
            <span className="text-[0.65rem] text-muted-foreground">cards in library</span>
          </div>
          {libraryStats.cardsByRegion?.length > 0 && (
            <div className="flex items-center gap-1.5">
              <MapPin className="h-3 w-3 text-muted-foreground" />
              <span className="text-[0.65rem] text-muted-foreground">
                Top: <span className="font-semibold text-foreground/80">{libraryStats.cardsByRegion[0]?.region}</span>
              </span>
            </div>
          )}
        </div>
      )}

      {/* Filters */}
      <Card className="glass-hierarchy-child">
        <CardContent className="p-3">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search cards..."
                className="h-8 pl-8 text-xs glass-hierarchy-interactive"
              />
              {search && (
                <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2">
                  <X className="h-3 w-3 text-muted-foreground" />
                </button>
              )}
            </div>
            <Select value={season.toString()} onValueChange={(v) => setSeason(v === "all" ? "all" : parseInt(v))}>
              <SelectTrigger className="h-8 w-[120px] text-xs glass-hierarchy-interactive">
                <SelectValue placeholder="Season" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Seasons</SelectItem>
                <SelectItem value="1">Season 1</SelectItem>
                <SelectItem value="2">Season 2</SelectItem>
                <SelectItem value="3">Season 3</SelectItem>
              </SelectContent>
            </Select>
            <Select value={rarity} onValueChange={(v) => setRarity(v as CardRarity | "all")}>
              <SelectTrigger className="h-8 w-[130px] text-xs glass-hierarchy-interactive">
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
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="h-8 w-[130px] text-xs glass-hierarchy-interactive">
                <SelectValue placeholder="Sort" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="rarity">Rarity</SelectItem>
                <SelectItem value="marketValue">Market Value</SelectItem>
                <SelectItem value="recent">Recent</SelectItem>
                <SelectItem value="name">Name</SelectItem>
              </SelectContent>
            </Select>
            {(search || rarity !== "all" || season !== "all") && (
              <button
                onClick={() => { setSearch(""); setRarity("all"); setSeason("all"); setSortBy("rarity"); }}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="h-3 w-3" /> Clear
              </button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Cards grid */}
      {isLoading && offset === 0 ? (
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <Skeleton key={i} className="h-72 rounded-xl" />
          ))}
        </div>
      ) : displayCards.length === 0 ? (
        <Card className="glass-hierarchy-child">
          <CardContent className="flex flex-col items-center justify-center py-8">
            <Globe className="mb-3 h-10 w-10 text-muted-foreground/40" />
            <p className="text-sm font-bold text-foreground/80 mb-1">No Cards Found</p>
            <p className="text-xs text-muted-foreground text-center max-w-md">
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
          <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {displayCards.map((card: any) => (
              <CardDisplay
                key={card.id}
                card={card}
                size="medium"
                onClick={(c) => {
                  setSelectedCard(c);
                  soundService?.play("card-select");
                }}
              />
            ))}
          </div>

          {/* Load More + count */}
          <div className="flex flex-col items-center gap-3 pt-2">
            <p className="text-xs text-muted-foreground">
              Showing {displayCards.length} of {totalCount.toLocaleString()} cards
            </p>
            {hasMore && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setOffset(prev => prev + PAGE_SIZE)}
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

      {/* Request Lore Card Dialog */}
      <Dialog open={requestOpen} onOpenChange={setRequestOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold">Request Lore Card</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Submit a wiki article to be turned into a lore card. An admin will review your request.
              Cost: <span className="font-semibold text-amber-400">50 IxC</span>
            </p>
            <div>
              <label className="mb-1 block text-xs font-semibold text-muted-foreground">Article Title</label>
              <Input
                value={articleTitle}
                onChange={(e) => setArticleTitle(e.target.value)}
                placeholder="e.g. Battle of Kingsport"
                className="h-8 text-xs"
                maxLength={200}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-muted-foreground">Wiki Source</label>
              <Select value={wikiSource} onValueChange={(v) => setWikiSource(v as "ixwiki" | "iiwiki")}>
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
            <Button variant="outline" size="sm" onClick={() => setRequestOpen(false)} className="text-xs">Cancel</Button>
            <Button
              size="sm"
              className="text-xs"
              disabled={!articleTitle.trim() || requestLoreCard.isPending}
              onClick={() => requestLoreCard.mutate({ articleTitle: articleTitle.trim(), wikiSource })}
            >
              <Coins className="mr-1.5 h-3 w-3" />
              {requestLoreCard.isPending ? "Requesting..." : "Request (50 IxC)"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <CardDetailsModal card={selectedCard} open={!!selectedCard} onClose={() => setSelectedCard(null)} />
    </div>
  );
}

// ─── Main Section Component ──────────────────────────────────────

function resolveInitialTab(initialTab: string | null | undefined): SubTab {
  if (initialTab === "collections") return "collections";
  if (initialTab === "gallery" || initialTab === "lore-gallery" || initialTab === "ns-library") return "gallery";
  return "inventory";
}

export function VaultCardsSection({ initialTab }: VaultCardsSectionProps) {
  const [activeTab, setActiveTab] = useState<SubTab>(() => resolveInitialTab(initialTab));

  return (
    <div className="space-y-4">
      {/* Tab strip */}
      <div className="glass-hierarchy-child flex gap-1 overflow-x-auto rounded-lg p-1">
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
          {activeTab === "gallery" && <CardGalleryTab />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
