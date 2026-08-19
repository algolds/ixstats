"use client";

import React, { useState, useMemo, useEffect, useCallback } from "react";
import dynamic from "next/dynamic";
import { Layers, Globe, MapPin, Loader2, ChevronDown } from "lucide-react";
import { api } from "~/trpc/react";
import { Card, CardContent } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Skeleton } from "~/components/ui/skeleton";
import { CardDisplay } from "~/components/cards/display";
import NumberFlow from "~/components/ui/number-flow";
import type { CardInstance } from "~/types/cards-display";
import type { CardRarity } from "@prisma/client";
import type { GallerySource } from "./types";

const CardDetailsModal = dynamic(
  () => import("~/components/cards/display/CardDetailsModal").then((m) => m.CardDetailsModal),
  { ssr: false }
);

const PAGE_SIZE = 50;

export function CardGalleryTab({
  source,
  search,
  season,
  rarity,
  cteFilter,
  sortBy,
  onSourceChange: _onSourceChange,
  onSearchChange: _onSearchChange,
  onSeasonChange: _onSeasonChange,
  onRarityChange: _onRarityChange,
  onSortByChange: _onSortByChange,
}: {
  source: GallerySource;
  search: string;
  season: number | "all";
  rarity: CardRarity | "all";
  cteFilter?: "all" | "cte_only" | "active_only";
  sortBy: string;
  onSourceChange: (v: GallerySource) => void;
  onSearchChange: (v: string) => void;
  onSeasonChange: (v: number | "all") => void;
  onRarityChange: (v: CardRarity | "all") => void;
  onSortByChange: (v: string) => void;
}) {
  const [offset, setOffset] = useState(0);
  const [allNsCards, setAllNsCards] = useState<CardInstance[]>([]);
  const [selectedCard, setSelectedCard] = useState<CardInstance | null>(null);

  // NS Cards query (when source is "all" or "ns")
  const nsQueryInput = useMemo(
    () => ({
      limit: PAGE_SIZE,
      offset,
      search: search || undefined,
      season: season !== "all" ? season : undefined,
      rarity: rarity !== "all" ? rarity : undefined,
      cteFilter: cteFilter && cteFilter !== "all" ? cteFilter : undefined,
      sortBy: (sortBy === "marketValue"
        ? "marketValue"
        : sortBy === "recent"
          ? "recent"
          : sortBy === "name"
            ? "name"
            : "rarity") as "name" | "rarity" | "marketValue" | "recent" | undefined,
    }),
    [search, season, rarity, cteFilter, sortBy, offset]
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
            : "dateAdded") as "rarity" | "marketValue" | "title" | "dateAdded",
    },
    { enabled: source === "all" || source === "lore" }
  );

  // Accumulate NS cards for load-more
  useEffect(() => {
    if (nsCardsData) {
      if (offset === 0) {
        setAllNsCards(nsCardsData.cards as unknown as CardInstance[]);
      } else {
        setAllNsCards((prev) => {
          const existingIds = new Set(prev.map((c) => c.id));
          const newCards = (nsCardsData.cards as unknown as CardInstance[]).filter(
            (c) => !existingIds.has(c.id)
          );
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
  const displayCards: CardInstance[] = useMemo(() => {
    const nsCards =
      source === "all" || source === "ns"
        ? allNsCards.length > 0
          ? allNsCards
          : ((nsCardsData?.cards ?? []) as unknown as CardInstance[])
        : [];
    const loreCards =
      source === "all" || source === "lore"
        ? (loreData?.cards ?? []).map(
            (card) =>
              ({
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
                wikiUrl: (card.metadata as { wikiUrl?: string })?.wikiUrl || null,
                countryId: null,
              }) as unknown as CardInstance
          )
        : [];

    if (source === "ns") return nsCards;
    if (source === "lore") return loreCards;

    // Merge and dedupe for "all"
    const merged = [...nsCards];
    const existingIds = new Set(merged.map((c) => c.id));
    for (const card of loreCards) {
      if (!existingIds.has(card.id)) {
        merged.push(card as unknown as CardInstance);
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
            {displayCards.map((card: CardInstance) => (
              <CardDisplay
                key={card.id}
                card={card}
                size="medium"
                enable3D={true}
                performanceMode={false}
                onClick={setSelectedCard}
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
