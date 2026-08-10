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
  Sparkles,
  History,
  ArrowRightLeft,
  Share2,
  Download,
} from "lucide-react";
import { cn } from "~/lib/utils";
import { titleToWikiOSPath } from "~/lib/wiki-os/url-compat";
import { Dialog, DialogContent, DialogTitle, DialogClose } from "~/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "~/components/ui/tabs";
import { RarityBadge } from "./RarityBadge";
import {
  formatCardStats,
  getCardTypeLabel,
  getRarityConfig,
} from "~/lib/card-display-utils";
import { NationStatesAttribution } from "./NationStatesAttribution";
import type { CardInstance } from "~/types/cards-display";
import { api } from "~/trpc/react";
import { useActiveCosmetics } from "~/hooks/useActiveCosmetics";
import { CardOverviewTab } from "./modal/CardOverviewTab";
import { Card3DTab } from "./modal/Card3DTab";
import { CardMarketTab } from "./modal/CardMarketTab";
import { CardProvenanceTab } from "./modal/CardProvenanceTab";
import { CardStatsTab } from "./modal/CardStatsTab";
import { CardLoreTab } from "./modal/CardLoreTab";
import { CardCompareTab } from "./modal/CardCompareTab";

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
      { enabled: !!card?.ownershipId && open && activeTab === "provenance" }
    );

    const { neonFrame } = useActiveCosmetics();

    const wikiUrl = useMemo(() => {
      if (!card) return null;
      if (card.wikiUrl) return card.wikiUrl;

      if (card.cardType === "LORE" && card.wikiArticleTitle) {
        const path = titleToWikiOSPath(card.wikiArticleTitle);
        const domain = card.wikiSource === "iiwiki" ? "iiwiki.us" : "ixwiki.com";
        return `https://${domain}/${path}`;
      }
      return null;
    }, [card]);

    if (!card) return null;

    return (
      <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
        <DialogContent showCloseButton={false} className="border-border/40 max-h-[90vh] w-full max-w-4xl overflow-hidden p-0 backdrop-blur-xl">
          <DialogTitle className="sr-only">{card.title} Details</DialogTitle>

          <DialogClose className="hover:bg-accent text-muted-foreground focus:ring-ring absolute top-4 right-4 z-50 rounded-full p-2 transition-all hover:scale-110 focus:ring-2 focus:outline-none">
            <X className="h-5 w-5" />
            <span className="sr-only">Close</span>
          </DialogClose>

          {/* Modal Header */}
          <div className="border-border/40 flex flex-col gap-4 border-b p-4 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-foreground text-2xl font-bold sm:text-3xl">{card.title}</h2>
                  <RarityBadge rarity={card.rarity} size="medium" />
                </div>
                <div className="text-muted-foreground mt-1 flex items-center gap-2 text-xs sm:text-sm">
                  <span>{getCardTypeLabel(card.cardType)}</span>
                  <span>•</span>
                  <span>Season {card.season}</span>
                  {card.country && (
                    <>
                      <span>•</span>
                      <span>{card.country.name}</span>
                    </>
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
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-1 flex-col">
            <div className="border-border/40 border-b px-4 sm:px-6">
              <TabsList className="bg-transparent">
                <TabsTrigger value="overview" className="data-[state=active]:bg-primary/20 text-xs">
                  <Info className="mr-1.5 h-3.5 w-3.5" />
                  Overview
                </TabsTrigger>
                <TabsTrigger value="3d-view" className="data-[state=active]:bg-primary/20 text-xs">
                  <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                  3D View
                </TabsTrigger>
                <TabsTrigger value="market" className="data-[state=active]:bg-primary/20 text-xs">
                  <BarChart3 className="mr-1.5 h-3.5 w-3.5" />
                  Market
                </TabsTrigger>
                {card.ownershipId && (
                  <TabsTrigger value="provenance" className="data-[state=active]:bg-primary/20 text-xs">
                    <History className="mr-1.5 h-3.5 w-3.5" />
                    Provenance
                  </TabsTrigger>
                )}
                <TabsTrigger value="stats" className="data-[state=active]:bg-primary/20 text-xs">
                  <TrendingUp className="mr-1.5 h-3.5 w-3.5" />
                  Stats
                </TabsTrigger>
                {card.cardType === "LORE" && (
                  <TabsTrigger value="lore" className="data-[state=active]:bg-primary/20 text-xs">
                    <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                    Lore
                  </TabsTrigger>
                )}
                {comparisonCard && comparisonStats && (
                  <TabsTrigger value="compare" className="data-[state=active]:bg-primary/20 text-xs">
                    <ArrowRightLeft className="mr-1.5 h-3.5 w-3.5" />
                    Compare
                  </TabsTrigger>
                )}
              </TabsList>
            </div>

            {/* Tab content */}
            <div className="flex-1 overflow-auto px-4 py-4 sm:px-6">
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

              <TabsContent value="3d-view" className="flex min-h-[500px] items-center justify-center">
                <Card3DTab card={card} />
              </TabsContent>

              <TabsContent value="market" className="space-y-4">
                <CardMarketTab card={card} rarityConfig={rarityConfig} />
              </TabsContent>

              {card.ownershipId && (
                <TabsContent value="provenance" className="space-y-4">
                  <CardProvenanceTab
                    isLoading={transferHistoryQuery.isLoading}
                    events={transferHistoryQuery.data as any}
                  />
                </TabsContent>
              )}

              <TabsContent value="stats" className="space-y-4">
                <CardStatsTab card={card} stats={stats} />
              </TabsContent>

              {card.cardType === "LORE" && (
                <TabsContent value="lore" className="space-y-4">
                  <CardLoreTab card={card} wikiUrl={wikiUrl} />
                </TabsContent>
              )}

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

          {card.cardType === "NS_IMPORT" && (
            <NationStatesAttribution className="mx-4 mb-3 sm:mx-6" />
          )}
        </DialogContent>
      </Dialog>
    );
  }
);

CardDetailsModal.displayName = "CardDetailsModal";
