"use client";

import React, { useState } from "react";
import {
  Search,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  Eye,
  EyeOff,
  ChevronLeft,
  ChevronRight,
  Layers,
  Globe,
  SlidersHorizontal,
  X,
  UserCheck,
  ArrowUpDown,
  Edit2,
  Check,
} from "lucide-react";
import { api } from "~/trpc/react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { useNotify } from "~/hooks/useNotify";
import { FacetCard, FacetContainer } from "~/components/ui/facet-container";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import type { CardRarity } from "@prisma/client";

const PAGE_SIZE = 25;

type CardTypeFilter = "all" | "NS_IMPORT" | "USER_CUSTOM" | "LORE_BATCH" | "COMMONS_IMPORT";
type SortByOption = "recent" | "marketValue" | "marketValue_asc" | "name" | "rarity";

export function AdminCardExplorer() {
  const notify = useNotify();

  const [search, setSearch] = useState("");
  const [cardTypeFilter, setCardTypeFilter] = useState<CardTypeFilter>("all");
  const [cteFilter, setCteFilter] = useState<"all" | "cte_only" | "active_only">("all");
  const [takedownFilter, setTakedownFilter] = useState<"all" | "visible" | "takedown">("all");
  const [season, setSeason] = useState<number | "all">("all");
  const [rarity, setRarity] = useState<CardRarity | "all">("all");
  const [sortBy, setSortBy] = useState<SortByOption>("recent");
  const [offset, setOffset] = useState(0);

  // Inline edit state tracking
  const [editingTitleId, setEditingTitleId] = useState<string | null>(null);
  const [editingTitleValue, setEditingTitleValue] = useState("");

  const [editingValueId, setEditingValueId] = useState<string | null>(null);
  const [editingValueNum, setEditingValueNum] = useState<number>(0);

  // Bulk visibility control states
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [bulkTargetType, setBulkTargetType] = useState<"all" | "NS_IMPORT" | "LORE" | "USER_CUSTOM" | "COMMONS_IMPORT">("all");
  const [bulkCteFilter, setBulkCteFilter] = useState<"all" | "active" | "cte">("all");
  const [bulkSeason, setBulkSeason] = useState<"all" | "1" | "2" | "3">("all");
  const [bulkRarity, setBulkRarity] = useState<"all" | CardRarity>("all");

  const bulkVisibilityMutation = api.cards.bulkToggleVisibility.useMutation({
    onSuccess: (data) => {
      notify.success("Bulk Update Complete", data.message);
      setIsBulkModalOpen(false);
      void refetch();
    },
    onError: (err) => {
      notify.error("Bulk Update Failed", err.message);
    },
  });

  const queryInput = {
    limit: PAGE_SIZE,
    offset,
    search: search || undefined,
    cardTypeFilter,
    season: season !== "all" ? season : undefined,
    rarity: rarity !== "all" ? rarity : undefined,
    cteFilter,
    isRetired: takedownFilter === "takedown" ? true : takedownFilter === "visible" ? false : undefined,
    includeRetired: takedownFilter === "all" ? true : undefined,
    sortBy,
  };

  const { data, isLoading, isFetching, refetch } = api.cards.getNSCards.useQuery(queryInput);

  const updateDetailsMutation = api.cards.updateCardDetails.useMutation({
    onSuccess: () => {
      notify.success("Card updated", "Card details updated successfully.");
      setEditingTitleId(null);
      setEditingValueId(null);
      void refetch();
    },
    onError: (err) => {
      notify.error("Update failed", err.message);
    },
  });

  const total = data?.total ?? 0;
  const cards = data?.cards ?? [];
  const totalPages = Math.ceil(total / PAGE_SIZE);
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1;

  const isFiltered =
    search !== "" ||
    cardTypeFilter !== "all" ||
    cteFilter !== "all" ||
    takedownFilter !== "all" ||
    season !== "all" ||
    rarity !== "all" ||
    sortBy !== "recent";

  const resetAllFilters = () => {
    setSearch("");
    setCardTypeFilter("all");
    setCteFilter("all");
    setTakedownFilter("all");
    setSeason("all");
    setRarity("all");
    setSortBy("recent");
    setOffset(0);
  };

  const getCardTypeBadge = (card: { cardType?: string | null; nsCardId?: number | null }) => {
    const typeStr = card.cardType ?? "";
    if (typeStr === "LORE" || typeStr === "LORE_BATCH") {
      return (
        <span className="inline-flex items-center rounded-full bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 text-[9px] font-bold text-amber-500 dark:text-amber-300 backdrop-blur-md">
          Lore Card
        </span>
      );
    }
    if (typeStr === "NS_IMPORT" && card.nsCardId !== null && card.nsCardId !== undefined) {
      return (
        <span className="inline-flex items-center rounded-full bg-blue-500/15 border border-blue-500/30 px-2 py-0.5 text-[9px] font-bold text-blue-600 dark:text-blue-300 backdrop-blur-md">
          NS Import
        </span>
      );
    }
    if (typeStr === "COMMONS_IMPORT") {
      return (
        <span className="inline-flex items-center rounded-full bg-teal-500/15 border border-teal-500/30 px-2 py-0.5 text-[9px] font-bold text-teal-600 dark:text-teal-300 backdrop-blur-md">
          Commons Import
        </span>
      );
    }
    return (
      <span className="inline-flex items-center rounded-full bg-cyan-500/15 border border-cyan-500/30 px-2 py-0.5 text-[9px] font-bold text-cyan-600 dark:text-cyan-300 backdrop-blur-md">
        User Imported
      </span>
    );
  };

  const handleSaveTitle = (cardId: string) => {
    if (!editingTitleValue.trim()) return;
    updateDetailsMutation.mutate({ cardId, title: editingTitleValue.trim() });
  };

  const handleSaveValue = (cardId: string) => {
    if (editingValueNum < 0) return;
    updateDetailsMutation.mutate({ cardId, marketValue: editingValueNum });
  };

  const handleToggleTakedown = (cardId: string, currentStatus: boolean) => {
    updateDetailsMutation.mutate({ cardId, isRetired: !currentStatus });
  };

  return (
    <FacetCard depth={2} className="rounded-2xl border border-border bg-card/70 p-6 backdrop-blur-xl shadow-xl space-y-6 text-card-foreground">
      {/* ─── Facet & Apple Design Header Section ────────────────── */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-xl border border-primary/30 bg-primary/10 p-2.5 backdrop-blur-md">
            <SlidersHorizontal className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="text-foreground tracking-tight text-xl font-bold">
              Card Explorer
            </h3>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={() => setIsBulkModalOpen(true)}
            className="h-8 rounded-xl border border-primary/30 bg-primary/20 text-xs font-semibold text-primary hover:bg-primary/30 active:scale-95 transition-all shadow-xs"
          >
            <EyeOff className="mr-1.5 h-3.5 w-3.5" />
            Bulk Visibility Controls
          </Button>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card/60 px-3 py-1 text-xs font-semibold text-foreground backdrop-blur-md">
            <Layers className="h-3.5 w-3.5 text-primary" />
            Showing <strong className="text-foreground">{cards.length}</strong> of{" "}
            <strong className="text-foreground">{total.toLocaleString()}</strong>
          </span>
        </div>
      </div>

      {/* ─── Apple Design Filter Toolbar ─────────────────────────── */}
      <FacetContainer
        depth={1}
        enableRefraction={true}
        className="flex flex-wrap items-center gap-2.5 bg-card/60 p-3.5 rounded-2xl border border-border backdrop-blur-xl shadow-sm"
      >
        {/* Search Input */}
        <div className="relative min-w-[220px] flex-1 max-w-md">
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2" />
          <Input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setOffset(0);
            }}
            placeholder="Search title, nation, or keyword..."
            className="h-8.5 rounded-xl border-border bg-card/80 pl-8 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-1 focus:ring-primary transition-all"
          />
        </div>

        {/* Card Source / Importer Filter */}
        <select
          value={cardTypeFilter}
          onChange={(e) => {
            setCardTypeFilter(e.target.value as CardTypeFilter);
            setOffset(0);
          }}
          className="h-8.5 rounded-xl border border-border bg-card px-3 text-xs font-medium text-foreground shadow-xs transition-all hover:bg-accent focus:outline-none focus:ring-1 focus:ring-primary"
        >
          <option value="all" className="bg-card text-card-foreground">All Card Sources</option>
          <option value="NS_IMPORT" className="bg-card text-card-foreground">NS Official Imports</option>
          <option value="USER_CUSTOM" className="bg-card text-card-foreground">User Imported / Custom</option>
          <option value="LORE_BATCH" className="bg-card text-card-foreground">Wiki Lore Cards</option>
        </select>

        {/* CTE Status Filter */}
        <select
          value={cteFilter}
          onChange={(e) => {
            setCteFilter(e.target.value as any);
            setOffset(0);
          }}
          className="h-8.5 rounded-xl border border-border bg-card px-3 text-xs font-medium text-foreground shadow-xs transition-all hover:bg-accent focus:outline-none focus:ring-1 focus:ring-primary"
        >
          <option value="all" className="bg-card text-card-foreground">All Nation Statuses</option>
          <option value="active_only" className="bg-card text-card-foreground">Active Nations Only</option>
          <option value="cte_only" className="bg-card text-card-foreground">CTE Defunct Only</option>
        </select>

        {/* Takedown Filter */}
        <select
          value={takedownFilter}
          onChange={(e) => {
            setTakedownFilter(e.target.value as any);
            setOffset(0);
          }}
          className="h-8.5 rounded-xl border border-border bg-card px-3 text-xs font-medium text-foreground shadow-xs transition-all hover:bg-accent focus:outline-none focus:ring-1 focus:ring-primary"
        >
          <option value="all" className="bg-card text-card-foreground">All Takedown States</option>
          <option value="visible" className="bg-card text-card-foreground">Visible Cards Only</option>
          <option value="takedown" className="bg-card text-card-foreground">Takedowns / Hidden</option>
        </select>

        {/* Season Selector */}
        <select
          value={season.toString()}
          onChange={(e) => {
            setSeason(e.target.value === "all" ? "all" : parseInt(e.target.value, 10));
            setOffset(0);
          }}
          className="h-8.5 rounded-xl border border-border bg-card px-3 text-xs font-medium text-foreground shadow-xs transition-all hover:bg-accent focus:outline-none focus:ring-1 focus:ring-primary"
        >
          <option value="all" className="bg-card text-card-foreground">All Seasons</option>
          <option value="1" className="bg-card text-card-foreground">Season 1</option>
          <option value="2" className="bg-card text-card-foreground">Season 2</option>
          <option value="3" className="bg-card text-card-foreground">Season 3</option>
        </select>

        {/* Rarity Selector */}
        <select
          value={rarity}
          onChange={(e) => {
            setRarity(e.target.value as any);
            setOffset(0);
          }}
          className="h-8.5 rounded-xl border border-border bg-card px-3 text-xs font-medium text-foreground shadow-xs transition-all hover:bg-accent focus:outline-none focus:ring-1 focus:ring-primary"
        >
          <option value="all" className="bg-card text-card-foreground">All Rarities</option>
          <option value="COMMON" className="bg-card text-card-foreground">Common</option>
          <option value="UNCOMMON" className="bg-card text-card-foreground">Uncommon</option>
          <option value="RARE" className="bg-card text-card-foreground">Rare</option>
          <option value="ULTRA_RARE" className="bg-card text-card-foreground">Ultra Rare</option>
          <option value="EPIC" className="bg-card text-card-foreground">Epic</option>
          <option value="LEGENDARY" className="bg-card text-card-foreground">Legendary</option>
        </select>

        {/* Sort By Selector */}
        <div className="flex items-center gap-1.5 ml-auto">
          <span className="text-muted-foreground font-medium text-[11px] flex items-center gap-1 shrink-0">
            <ArrowUpDown className="h-3 w-3" /> Sort:
          </span>
          <select
            value={sortBy}
            onChange={(e) => {
              setSortBy(e.target.value as SortByOption);
              setOffset(0);
            }}
            className="h-8.5 rounded-xl border border-border bg-card px-3 text-xs font-medium text-foreground shadow-xs transition-all hover:bg-accent focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="recent" className="bg-card text-card-foreground">Newest First</option>
            <option value="marketValue" className="bg-card text-card-foreground">Market Value (High to Low)</option>
            <option value="marketValue_asc" className="bg-card text-card-foreground">Market Value (Low to High)</option>
            <option value="name" className="bg-card text-card-foreground">Title (A-Z)</option>
          </select>

          {isFiltered && (
            <Button
              size="sm"
              variant="ghost"
              onClick={resetAllFilters}
              className="h-8.5 rounded-xl px-2.5 text-rose-500 hover:bg-rose-500/10 hover:text-rose-600 active:scale-95 transition-all text-xs font-medium"
            >
              <X className="mr-1 h-3.5 w-3.5" /> Reset
            </Button>
          )}
        </div>
      </FacetContainer>

      {/* ─── Inline Scroll Data Table Container ─────────────────────── */}
      {isLoading ? (
        <div className="flex h-64 items-center justify-center rounded-xl border border-border/60 bg-card/40 backdrop-blur-md">
          <RefreshCw className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : cards.length === 0 ? (
        <div className="flex h-48 flex-col items-center justify-center rounded-xl border border-dashed border-border/80 bg-card/30 backdrop-blur-md">
          <Globe className="h-8 w-8 text-muted-foreground/50 mb-2" />
          <p className="text-foreground text-sm font-semibold">No cards match these active filters</p>
          <p className="text-muted-foreground text-xs mt-0.5">Try resetting your dropdown filters or search term.</p>
          {isFiltered && (
            <Button
              size="sm"
              onClick={resetAllFilters}
              className="mt-3 h-8 rounded-xl border border-border bg-card text-xs text-foreground hover:bg-accent active:scale-95 transition-all"
            >
              Clear All Filters
            </Button>
          )}
        </div>
      ) : (
        <FacetContainer depth={1} enableRefraction={true} className="overflow-hidden rounded-xl border border-border bg-card/40 backdrop-blur-md shadow-inner">
          <div className="max-h-[560px] overflow-y-auto overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 z-10 border-b border-border bg-card/95 backdrop-blur-xl text-muted-foreground font-semibold tracking-wider uppercase text-[10px]">
                <tr>
                  <th className="px-4 py-3">Card</th>
                  <th className="px-4 py-3">Title</th>
                  <th className="px-4 py-3">Origin</th>
                  <th className="px-4 py-3">Season & Rarity</th>
                  <th className="px-4 py-3">Value</th>
                  <th className="px-4 py-3">Nation Status</th>
                  <th className="px-4 py-3">Takedown / Visibility</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {cards.map((card: any) => {
                  const meta = (card.metadata as Record<string, any>) || {};
                  const isCTE = meta.isCTE === true;
                  const isRetired = card.isRetired === true;

                  const isEditingTitle = editingTitleId === card.id;
                  const isEditingValue = editingValueId === card.id;

                  return (
                    <tr
                      key={card.id}
                      className="group transition-colors hover:bg-accent/40"
                    >
                      {/* Thumbnail */}
                      <td className="px-4 py-2.5">
                        <div className="h-11 w-8 overflow-hidden rounded-md border border-border bg-muted/60 shadow-xs transition-transform group-hover:scale-105">
                          {card.artwork ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={card.artwork}
                              alt={card.title}
                              className="h-full w-full object-cover"
                              onError={(e) => {
                                (e.target as HTMLElement).style.display = "none";
                              }}
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-[7px] text-muted-foreground">
                              N/A
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Title (Inline Editable) */}
                      <td className="px-4 py-2.5 max-w-[220px]">
                        {isEditingTitle ? (
                          <div className="flex items-center gap-1.5">
                            <input
                              value={editingTitleValue}
                              onChange={(e) => setEditingTitleValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") handleSaveTitle(card.id);
                                else if (e.key === "Escape") setEditingTitleId(null);
                              }}
                              className="h-7 w-full rounded-lg border border-primary bg-card px-2 text-xs font-semibold text-foreground focus:outline-none"
                              autoFocus
                            />
                            <button
                              onClick={() => handleSaveTitle(card.id)}
                              disabled={updateDetailsMutation.isPending}
                              className="rounded-md bg-emerald-500/20 p-1 text-emerald-600 dark:text-emerald-300 hover:bg-emerald-500/30"
                            >
                              <Check className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => setEditingTitleId(null)}
                              className="rounded-md bg-rose-500/20 p-1 text-rose-600 dark:text-rose-300 hover:bg-rose-500/30"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ) : (
                          <div className="group/title flex items-center justify-between gap-2">
                            <div>
                              <div className="font-semibold text-foreground truncate max-w-[180px]">
                                {card.title}
                              </div>
                              <div className="font-mono text-[10px] text-muted-foreground">
                                {card.nsCardId ? `NS ID: ${card.nsCardId}` : `ID: ${card.id.slice(0, 8)}`}
                              </div>
                            </div>
                            <button
                              onClick={() => {
                                setEditingTitleId(card.id);
                                setEditingTitleValue(card.title);
                              }}
                              className="opacity-0 group-hover/title:opacity-100 rounded p-1 text-muted-foreground hover:text-primary hover:bg-accent transition-all"
                              title="Edit Title"
                            >
                              <Edit2 className="h-3 w-3" />
                            </button>
                          </div>
                        )}
                      </td>

                      {/* Origin Badge */}
                      <td className="px-4 py-2.5">
                        {getCardTypeBadge(card)}
                      </td>

                      {/* Season / Rarity */}
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-1.5">
                          <span className="rounded-full bg-purple-500/15 border border-purple-500/30 px-2 py-0.5 text-[9px] font-bold text-purple-600 dark:text-purple-300 backdrop-blur-md">
                            S{card.season}
                          </span>
                          <span className="rounded-full bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 text-[9px] font-bold text-amber-600 dark:text-amber-300 backdrop-blur-md">
                            {card.rarity}
                          </span>
                        </div>
                      </td>

                      {/* Market Value (Inline Editable) */}
                      <td className="px-4 py-2.5">
                        {isEditingValue ? (
                          <div className="flex items-center gap-1.5">
                            <input
                              type="number"
                              value={editingValueNum}
                              onChange={(e) => setEditingValueNum(parseInt(e.target.value, 10) || 0)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") handleSaveValue(card.id);
                                else if (e.key === "Escape") setEditingValueId(null);
                              }}
                              className="h-7 w-20 rounded-lg border border-primary bg-card px-2 text-xs font-semibold text-foreground focus:outline-none"
                              autoFocus
                            />
                            <button
                              onClick={() => handleSaveValue(card.id)}
                              disabled={updateDetailsMutation.isPending}
                              className="rounded-md bg-emerald-500/20 p-1 text-emerald-600 dark:text-emerald-300 hover:bg-emerald-500/30"
                            >
                              <Check className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => setEditingValueId(null)}
                              className="rounded-md bg-rose-500/20 p-1 text-rose-600 dark:text-rose-300 hover:bg-rose-500/30"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ) : (
                          <div className="group/val flex items-center gap-2">
                            <span className="font-semibold text-foreground">
                              {(card.marketValue || 0).toLocaleString()}{" "}
                              <span className="text-[9px] text-muted-foreground">CR</span>
                            </span>
                            <button
                              onClick={() => {
                                setEditingValueId(card.id);
                                setEditingValueNum(card.marketValue || 0);
                              }}
                              className="opacity-0 group-hover/val:opacity-100 rounded p-1 text-muted-foreground hover:text-primary hover:bg-accent transition-all"
                              title="Edit Value"
                            >
                              <Edit2 className="h-3 w-3" />
                            </button>
                          </div>
                        )}
                      </td>

                      {/* CTE Status */}
                      <td className="px-4 py-2.5">
                        {isCTE ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/15 border border-rose-500/30 px-2.5 py-0.5 text-[10px] font-bold text-rose-600 dark:text-rose-300 backdrop-blur-md">
                            <AlertTriangle className="h-3 w-3 text-rose-500" />
                            CTE (Defunct)
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-300 backdrop-blur-md">
                            <CheckCircle className="h-3 w-3 text-emerald-500" />
                            Active Nation
                          </span>
                        )}
                      </td>

                      {/* Takedown / Visibility Toggle */}
                      <td className="px-4 py-2.5">
                        <button
                          onClick={() => handleToggleTakedown(card.id, isRetired)}
                          disabled={updateDetailsMutation.isPending}
                          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold transition-all active:scale-95 ${
                            isRetired
                              ? "bg-amber-500/20 border border-amber-500/30 text-amber-600 dark:text-amber-300 hover:bg-amber-500/30"
                              : "bg-muted/80 border border-border text-muted-foreground hover:bg-accent hover:text-foreground"
                          }`}
                          title="Click to toggle visibility / takedown state"
                        >
                          {isRetired ? (
                            <>
                              <EyeOff className="h-3 w-3 text-amber-500" />
                              Hidden (Click to Restore)
                            </>
                          ) : (
                            <>
                              <Eye className="h-3 w-3 text-emerald-500" />
                              Visible (Click to Hide)
                            </>
                          )}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </FacetContainer>
      )}

      {/* ─── Facet Design Pagination Controls ───────────────────────── */}
      <div className="flex items-center justify-between pt-1 text-xs">
        <div className="text-muted-foreground font-medium">
          Page <strong className="text-foreground">{currentPage}</strong> of{" "}
          <strong className="text-foreground">{totalPages || 1}</strong>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={offset === 0 || isFetching}
            onClick={() => setOffset((prev) => Math.max(0, prev - PAGE_SIZE))}
            className="h-7 rounded-lg border-border bg-card text-xs text-foreground hover:bg-accent active:scale-95 transition-all"
          >
            <ChevronLeft className="mr-1 h-3.5 w-3.5" /> Previous
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={offset + PAGE_SIZE >= total || isFetching}
            onClick={() => setOffset((prev) => prev + PAGE_SIZE)}
            className="h-7 rounded-lg border-border bg-card text-xs text-foreground hover:bg-accent active:scale-95 transition-all"
          >
            Next <ChevronRight className="ml-1 h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* ─── Granular Bulk Visibility Controls Modal ────────────────── */}
      <Dialog open={isBulkModalOpen} onOpenChange={setIsBulkModalOpen}>
        <DialogContent className="border border-border bg-card text-card-foreground shadow-2xl backdrop-blur-2xl max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-foreground text-lg font-bold">
              <EyeOff className="h-5 w-5 text-primary" />
              Granular Bulk Visibility Controls
            </DialogTitle>
            <DialogDescription className="text-muted-foreground text-xs">
              Perform bulk visibility updates across all cards or target specific card origins, nation statuses, rarities, or seasons.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Quick 1-Click Global Toggles */}
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 space-y-2">
              <div className="text-foreground text-xs font-semibold">1-Click Global NS Card Actions</div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={() =>
                    bulkVisibilityMutation.mutate({
                      isRetired: true,
                      cardTypeFilter: "NS_IMPORT",
                    })
                  }
                  disabled={bulkVisibilityMutation.isPending}
                  className="flex-1 h-8 rounded-lg bg-rose-500/20 text-rose-600 dark:text-rose-300 border border-rose-500/30 hover:bg-rose-500/30 text-xs font-semibold"
                >
                  <EyeOff className="mr-1.5 h-3.5 w-3.5" /> Hide All NS Cards
                </Button>
                <Button
                  size="sm"
                  onClick={() =>
                    bulkVisibilityMutation.mutate({
                      isRetired: false,
                      cardTypeFilter: "NS_IMPORT",
                    })
                  }
                  disabled={bulkVisibilityMutation.isPending}
                  className="flex-1 h-8 rounded-lg bg-emerald-500/20 text-emerald-600 dark:text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/30 text-xs font-semibold"
                >
                  <Eye className="mr-1.5 h-3.5 w-3.5" /> Restore All NS Cards
                </Button>
              </div>
            </div>

            {/* Granular Filtering Selector */}
            <div className="space-y-3 pt-1">
              <div className="text-foreground text-xs font-semibold">Granular Criteria Selection</div>
              <div className="grid grid-cols-2 gap-3">
                {/* Target Source */}
                <div>
                  <label className="text-muted-foreground text-[11px] font-medium block mb-1">Card Origin / Type</label>
                  <select
                    value={bulkTargetType}
                    onChange={(e) => setBulkTargetType(e.target.value as any)}
                    className="h-8.5 w-full rounded-xl border border-border bg-card px-2.5 text-xs font-medium text-foreground hover:bg-accent focus:outline-none"
                  >
                    <option value="all" className="bg-card text-card-foreground">All Card Types</option>
                    <option value="NS_IMPORT" className="bg-card text-card-foreground">NS Import Only</option>
                    <option value="LORE" className="bg-card text-card-foreground">Lore Cards Only</option>
                    <option value="USER_CUSTOM" className="bg-card text-card-foreground">User Custom Only</option>
                    <option value="COMMONS_IMPORT" className="bg-card text-card-foreground">Commons Import Only</option>
                  </select>
                </div>

                {/* Nation Status */}
                <div>
                  <label className="text-muted-foreground text-[11px] font-medium block mb-1">Nation Status</label>
                  <select
                    value={bulkCteFilter}
                    onChange={(e) => setBulkCteFilter(e.target.value as any)}
                    className="h-8.5 w-full rounded-xl border border-border bg-card px-2.5 text-xs font-medium text-foreground hover:bg-accent focus:outline-none"
                  >
                    <option value="all" className="bg-card text-card-foreground">All Statuses</option>
                    <option value="active" className="bg-card text-card-foreground">Active Nations Only</option>
                    <option value="cte" className="bg-card text-card-foreground">Defunct (CTE) Only</option>
                  </select>
                </div>

                {/* Season */}
                <div>
                  <label className="text-muted-foreground text-[11px] font-medium block mb-1">Card Season</label>
                  <select
                    value={bulkSeason}
                    onChange={(e) => setBulkSeason(e.target.value as any)}
                    className="h-8.5 w-full rounded-xl border border-border bg-card px-2.5 text-xs font-medium text-foreground hover:bg-accent focus:outline-none"
                  >
                    <option value="all" className="bg-card text-card-foreground">All Seasons</option>
                    <option value="1" className="bg-card text-card-foreground">Season 1</option>
                    <option value="2" className="bg-card text-card-foreground">Season 2</option>
                    <option value="3" className="bg-card text-card-foreground">Season 3</option>
                  </select>
                </div>

                {/* Rarity */}
                <div>
                  <label className="text-muted-foreground text-[11px] font-medium block mb-1">Card Rarity</label>
                  <select
                    value={bulkRarity}
                    onChange={(e) => setBulkRarity(e.target.value as any)}
                    className="h-8.5 w-full rounded-xl border border-border bg-card px-2.5 text-xs font-medium text-foreground hover:bg-accent focus:outline-none"
                  >
                    <option value="all" className="bg-card text-card-foreground">All Rarities</option>
                    <option value="COMMON" className="bg-card text-card-foreground">Common</option>
                    <option value="UNCOMMON" className="bg-card text-card-foreground">Uncommon</option>
                    <option value="RARE" className="bg-card text-card-foreground">Rare</option>
                    <option value="ULTRA_RARE" className="bg-card text-card-foreground">Ultra Rare</option>
                    <option value="EPIC" className="bg-card text-card-foreground">Epic</option>
                    <option value="LEGENDARY" className="bg-card text-card-foreground">Legendary</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setIsBulkModalOpen(false)}>Cancel</Button>
            <Button
              onClick={() =>
                bulkVisibilityMutation.mutate({
                  isRetired: true,
                  cardTypeFilter: bulkTargetType,
                  cteFilter: bulkCteFilter,
                  season: bulkSeason,
                  rarity: bulkRarity,
                })
              }
              disabled={bulkVisibilityMutation.isPending}
              className="bg-rose-500 text-white font-semibold hover:bg-rose-600"
            >
              Hide Selected Cards
            </Button>
            <Button
              onClick={() =>
                bulkVisibilityMutation.mutate({
                  isRetired: false,
                  cardTypeFilter: bulkTargetType,
                  cteFilter: bulkCteFilter,
                  season: bulkSeason,
                  rarity: bulkRarity,
                })
              }
              disabled={bulkVisibilityMutation.isPending}
              className="bg-emerald-600 text-white font-semibold hover:bg-emerald-700"
            >
              Restore Selected Cards
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </FacetCard>
  );
}
