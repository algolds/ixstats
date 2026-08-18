/**
 * CardDetailsModal Component
 * Enhanced expanded card view with 3D viewer, tabs, market history, and social features
 */

"use client";

import React, { useMemo, useState } from "react";
import {
  X,
  TrendingUp,
  BarChart3,
  Info,
  BookOpen,
  ArrowRightLeft,
  Share2,
  Download,
} from "lucide-react";
import { cn } from "~/lib/utils";
import { titleToWikiOSPath } from "~/lib/wiki-os/url-compat";
import { Dialog, DialogContent, DialogTitle, DialogClose } from "~/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "~/components/ui/tabs";
import { RarityBadge } from "./RarityBadge";
import { formatCardStats, getRarityConfig } from "~/lib/cards";
import { NationStatesAttribution } from "./NationStatesAttribution";
import type { CardInstance } from "~/types/cards-display";
import { api } from "~/trpc/react";
import { useActiveCosmetics } from "~/hooks/useActiveCosmetics";
import { CardOverviewTab } from "./modal/CardOverviewTab";
import { CardMarketTab } from "./modal/CardMarketTab";
import { CardStatsTab } from "./modal/CardStatsTab";
import { CardLoreTab } from "./modal/CardLoreTab";
import { CardCompareTab } from "./modal/CardCompareTab";
import { CardTakedownVerificationModal } from "./CardTakedownVerificationModal";
import { IIWikiBadge, isIIWikiCard } from "./IIWikiLogo";
import { CategoryIcon } from "~/components/cards/icons";
import {
  getCategoryTheme,
  getCategoryLabel,
  isValidLoreCategory,
  classifyFromWikitext,
  type LoreCategory,
} from "~/lib/cards";

export interface CardDetailsModalProps {
  card: CardInstance | null;
  open: boolean;
  onClose: () => void;
  onTrade?: (card: CardInstance) => void;
  onList?: (card: CardInstance) => void;
  onViewCollection?: (countryId: string) => void;
  comparisonCard?: CardInstance | null;
  onShare?: (card: CardInstance) => void;
  onDownloadImage?: (card: CardInstance) => void;
}

export const CardDetailsModal = React.memo<CardDetailsModalProps>(
  ({
    card,
    open,
    onClose,
    onTrade,
    onList,
    onViewCollection,
    comparisonCard,
    onShare,
    onDownloadImage,
  }) => {
    const [activeTab, setActiveTab] = useState("overview");
    const [isTakedownModalOpen, setIsTakedownModalOpen] = useState(false);

    const rarityConfig = useMemo(() => {
      if (!card) return getRarityConfig("COMMON");
      return getRarityConfig(card.rarity);
    }, [card]);

    const stats = useMemo(() => {
      if (!card) return { base: {}, specials: [], level: 0, totalBoost: 0 };
      return formatCardStats(card);
    }, [card]);

    const comparisonStats = useMemo(() => {
      if (!comparisonCard) return null;
      return formatCardStats(comparisonCard);
    }, [comparisonCard]);

    const transferHistoryQuery = api.cardMarket.getCardTransferHistory.useQuery(
      { ownershipId: card?.ownershipId || "" },
      { enabled: !!card?.ownershipId && open && activeTab === "market" }
    );

    const { neonFrame } = useActiveCosmetics();

    const isIIWiki = useMemo(() => isIIWikiCard(card), [card]);

    const isLoreCard = useMemo(() => {
      if (!card) return false;
      return (
        isIIWiki ||
        card.cardType === "LORE" ||
        card.cardType === "LORE_BATCH" ||
        Boolean(card.category && card.category !== "NS_IMPORT") ||
        Boolean(card.wikiPageId) ||
        Boolean(card.wikiSource) ||
        Boolean(card.wikiArticleTitle) ||
        Boolean(card.slug)
      );
    }, [card, isIIWiki]);

    const isNsImportCard = useMemo(() => {
      if (!card) return false;
      return !isLoreCard && (card.cardType === "NS_IMPORT" || Boolean(card.nsCardId));
    }, [card, isLoreCard]);

    const wikiUrl = useMemo(() => {
      if (!card) return null;
      if (card.wikiUrl) return card.wikiUrl;

      if (card.wikiArticleTitle) {
        const path = titleToWikiOSPath(card.wikiArticleTitle);
        const domain = card.wikiSource === "iiwiki" ? "iiwiki.com" : "ixwiki.com";
        return `https://${domain}/${path}`;
      }
      return null;
    }, [card]);

    const resolvedCategory = useMemo(() => {
      if (!card) return null;
      const meta = card.metadata as Record<string, unknown> | null | undefined;
      const rawCat = card.category || (meta?.category as string);
      if (rawCat && isValidLoreCategory(rawCat) && rawCat !== "NS_IMPORT") {
        return rawCat as LoreCategory;
      }
      if (isLoreCard) {
        return classifyFromWikitext(
          (meta?.fullExcerpt as string) || card.description,
          card.wikiArticleTitle || card.title
        );
      }
      return null;
    }, [card, isLoreCard]);

    const categoryTheme = useMemo(
      () => (resolvedCategory ? getCategoryTheme(resolvedCategory) : null),
      [resolvedCategory]
    );
    const categoryLabel = useMemo(
      () => (resolvedCategory ? getCategoryLabel(resolvedCategory) : null),
      [resolvedCategory]
    );

    if (!card) return null;

    return (
      <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
        <DialogContent
          showCloseButton={false}
          className={cn(
            "border-border/40 bg-card/85 border-border/50 flex h-auto max-h-[95vh] w-full max-w-4xl flex-col gap-0 overflow-hidden rounded-3xl border p-0 shadow-2xl backdrop-blur-2xl transition-all duration-300",
            isTakedownModalOpen && "pointer-events-none scale-[0.98] blur-sm brightness-75"
          )}
        >
          <DialogTitle className="sr-only">{card.title} Details</DialogTitle>

          <DialogClose className="hover:bg-accent/80 text-muted-foreground focus:ring-ring absolute top-4 right-4 z-50 rounded-full p-2 transition-all hover:scale-110 focus:ring-2 focus:outline-none">
            <X className="h-5 w-5" />
            <span className="sr-only">Close</span>
          </DialogClose>

          {/* Modal Header */}
          <div className="border-border/40 flex flex-col gap-4 border-b p-4 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-foreground text-2xl font-bold tracking-tight sm:text-3xl">
                    {card.title}
                  </h2>
                  <RarityBadge rarity={card.rarity} size="medium" />
                  {isIIWiki && <IIWikiBadge size="sm" />}
                  {isLoreCard && resolvedCategory && categoryLabel && (
                    <span
                      className="border-border/40 text-foreground inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-bold shadow-xs backdrop-blur-md"
                      style={
                        categoryTheme
                          ? {
                              borderColor: categoryTheme.accentColor,
                              backgroundColor: categoryTheme.accentSoft,
                            }
                          : undefined
                      }
                    >
                      <CategoryIcon
                        category={resolvedCategory}
                        treatment="seal"
                        size="xs"
                        color={categoryTheme?.accentColor}
                      />
                      <span>{categoryLabel}</span>
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                {onShare && (
                  <button
                    onClick={() => onShare(card)}
                    className="glass-hierarchy-interactive flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold"
                  >
                    <Share2 className="h-3.5 w-3.5" />
                    Share
                  </button>
                )}
                {onDownloadImage && (
                  <button
                    onClick={() => onDownloadImage(card)}
                    className="glass-hierarchy-interactive flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Save Image
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Tabs Container */}
          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            className="flex min-h-0 flex-1 flex-col"
          >
            <div className="border-border/40 shrink-0 border-b px-4 sm:px-6">
              <TabsList className="bg-transparent">
                <TabsTrigger
                  value="overview"
                  className="data-[state=active]:bg-primary/20 text-xs font-medium"
                >
                  <Info className="mr-1.5 h-3.5 w-3.5" />
                  Overview
                </TabsTrigger>
                <TabsTrigger
                  value="market"
                  className="data-[state=active]:bg-primary/20 text-xs font-medium"
                >
                  <BarChart3 className="mr-1.5 h-3.5 w-3.5" />
                  Market & Provenance
                </TabsTrigger>
                {isNsImportCard && (
                  <TabsTrigger
                    value="stats"
                    className="data-[state=active]:bg-primary/20 text-xs font-medium"
                  >
                    <TrendingUp className="mr-1.5 h-3.5 w-3.5" />
                    Stats
                  </TabsTrigger>
                )}
                <TabsTrigger
                  value="lore"
                  className="data-[state=active]:bg-primary/20 text-xs font-medium"
                >
                  <BookOpen className="mr-1.5 h-3.5 w-3.5 text-amber-500" />
                  Lore
                </TabsTrigger>
                {comparisonCard && comparisonStats && (
                  <TabsTrigger
                    value="compare"
                    className="data-[state=active]:bg-primary/20 text-xs font-medium"
                  >
                    <ArrowRightLeft className="mr-1.5 h-3.5 w-3.5" />
                    Compare
                  </TabsTrigger>
                )}
              </TabsList>
            </div>

            {/* Tab content */}
            <div className="min-h-0 flex-1 scrollbar-none overflow-y-auto px-4 py-4 sm:px-6">
              <TabsContent value="overview" className="space-y-4 sm:space-y-6">
                <CardOverviewTab
                  card={card}
                  rarityConfig={rarityConfig}
                  neonFrame={neonFrame}
                  stats={stats}
                  onTrade={onTrade}
                  onList={onList}
                  onViewCollection={onViewCollection}
                />
              </TabsContent>

              <TabsContent value="market" className="space-y-4">
                <CardMarketTab
                  card={card}
                  rarityConfig={rarityConfig}
                  isLoadingProvenance={transferHistoryQuery.isLoading}
                  provenanceEvents={transferHistoryQuery.data as any}
                />
              </TabsContent>

              {isNsImportCard && (
                <TabsContent value="stats" className="space-y-4">
                  <CardStatsTab card={card} stats={stats} />
                </TabsContent>
              )}

              <TabsContent value="lore" className="space-y-4">
                <CardLoreTab card={card} wikiUrl={wikiUrl} />
              </TabsContent>

              {comparisonCard && comparisonStats && (
                <TabsContent value="compare" className="space-y-4">
                  <CardCompareTab
                    card={card}
                    comparisonCard={comparisonCard}
                    stats={stats}
                    comparisonStats={comparisonStats}
                  />
                </TabsContent>
              )}
            </div>
          </Tabs>

          {isNsImportCard && (
            <div className="border-border/40 bg-card/30 shrink-0 border-t p-3 sm:px-6">
              <NationStatesAttribution onRequestTakedown={() => setIsTakedownModalOpen(true)} />
            </div>
          )}
        </DialogContent>

        {card && (
          <CardTakedownVerificationModal
            isOpen={isTakedownModalOpen}
            onClose={() => setIsTakedownModalOpen(false)}
            cardId={card.id}
            cardTitle={card.title}
            nsCardId={card.nsCardId}
            season={card.season}
            onTakedownSuccess={() => setIsTakedownModalOpen(false)}
          />
        )}
      </Dialog>
    );
  }
);

CardDetailsModal.displayName = "CardDetailsModal";
