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
import { NationStatesLogo } from "./NationStatesLogo";
import type { CardInstance } from "~/types/cards-display";
import { api } from "~/trpc/react";
import { useActiveCosmetics } from "~/hooks/useActiveCosmetics";
import { CardOverviewTab } from "./modal/CardOverviewTab";
import { CardMarketTab } from "./modal/CardMarketTab";
import { CardStatsTab } from "./modal/CardStatsTab";
import { CardLoreTab } from "./modal/CardLoreTab";
import { CardCompareTab } from "./modal/CardCompareTab";
import { CardTakedownVerificationModal } from "./CardTakedownVerificationModal";

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
      <DialogContent
          showCloseButton={false}
          className={cn(
            "border-border/40 flex flex-col gap-0 max-h-[95vh] h-auto w-full max-w-4xl overflow-hidden p-0 backdrop-blur-xl transition-all duration-300",
            isTakedownModalOpen && "blur-sm brightness-75 pointer-events-none scale-[0.98]"
          )}
        >
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
                  {card.cardType === "NS_IMPORT" ? (
                    <span className="inline-flex items-center gap-1.5 font-semibold text-foreground">
                      <NationStatesLogo size="sm" />
                      NS Card
                    </span>
                  ) : (
                    <span>{getCardTypeLabel(card.cardType)}</span>
                  )}
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
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-1 flex-col min-h-0">
            <div className="border-border/40 shrink-0 border-b px-4 sm:px-6">
              <TabsList className="bg-transparent">
                <TabsTrigger value="overview" className="data-[state=active]:bg-primary/20 text-xs">
                  <Info className="mr-1.5 h-3.5 w-3.5" />
                  Overview
                </TabsTrigger>
                <TabsTrigger value="market" className="data-[state=active]:bg-primary/20 text-xs">
                  <BarChart3 className="mr-1.5 h-3.5 w-3.5" />
                  Market & Provenance
                </TabsTrigger>
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
            <div className="flex-1 min-h-0 overflow-y-auto scrollbar-none px-4 py-4 sm:px-6">
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
            <div className="shrink-0 border-t border-border/40 bg-card/30 p-3 sm:px-6">
              <NationStatesAttribution
                onRequestTakedown={() => setIsTakedownModalOpen(true)}
              />
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
