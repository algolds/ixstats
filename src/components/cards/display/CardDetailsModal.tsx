"use client";
/**
 * CardDetailsModal Component
 * Enhanced expanded card view with 3D viewer, tabs, market history, and social features
 */

import { Button } from "~/components/ui/button";
import React, { useMemo, useState } from "react";
import {
  Xmark as X,
  StatsReport as BarChart3,
  InfoCircle as Info,
  OpenBook as BookOpen,
  ShareAndroid as Share2,
  Download,
} from "iconoir-react";
import { cn } from "~/lib/utils";
import { cardWikiHref } from "./card-wiki-href";
import { Dialog, DialogContent, DialogTitle, DialogClose } from "~/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "~/components/ui/tabs";
import { RarityBadge } from "./RarityBadge";
import { getRarityConfig } from "~/lib/cards/display-utils";
import { NationStatesAttribution } from "./NationStatesAttribution";
import type { CardInstance } from "~/types/cards-display";
import { api } from "~/trpc/react";
import { useActiveCosmetics } from "~/hooks/useActiveCosmetics";
import { CardOverviewTab } from "./modal/CardOverviewTab";
import { CardMarketTab } from "./modal/CardMarketTab";
import { CardLoreTab } from "./modal/CardLoreTab";
import { CardTakedownVerificationModal } from "./CardTakedownVerificationModal";
import { IIWikiBadge, isIIWikiCard } from "./IIWikiLogo";
import { CategoryIcon } from "~/components/cards/icons";
import { getCategoryTheme, getCategoryLabel } from "~/lib/cards/category-theme";
import { isValidLoreCategory } from "~/lib/cards/category-enums";
import { classifyFromWikitext } from "~/lib/cards/category-classifier";

interface CardDetailsModalProps {
  card: CardInstance | null;
  open: boolean;
  onClose: () => void;
  onTrade?: (card: CardInstance) => void;
  onList?: (card: CardInstance) => void;
  onViewCollection?: (countryId: string) => void;
  onShare?: (card: CardInstance) => void;
  onDownloadImage?: (card: CardInstance) => void;
}

export const CardDetailsModal = React.memo<CardDetailsModalProps>(
  ({ card, open, onClose, onTrade, onList, onViewCollection, onShare, onDownloadImage }) => {
    const [activeTab, setActiveTab] = useState("overview");
    const [isTakedownModalOpen, setIsTakedownModalOpen] = useState(false);

    const rarityConfig = useMemo(() => {
      if (!card) return getRarityConfig("COMMON");
      return getRarityConfig(card.rarity);
    }, [card]);

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
        Boolean(card.category) ||
        Boolean(card.wikiSource) ||
        Boolean(card.wikiArticleTitle) ||
        Boolean(card.slug)
      );
    }, [card, isIIWiki]);

    const isNsCard = useMemo(() => {
      if (!card) return false;
      return !isLoreCard && (card.cardType === "NS" || Boolean(card.nsCardId));
    }, [card, isLoreCard]);

    const wikiUrl = useMemo(() => cardWikiHref(card), [card]);

    const resolvedCategory = useMemo(() => {
      if (!card) return null;
      const meta = card.metadata as Record<string, unknown> | null | undefined;
      const rawCat = card.category || (meta?.category as string);
      if (rawCat && isValidLoreCategory(rawCat)) return rawCat;
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
            "flex h-auto max-h-[95vh] w-full max-w-4xl flex-col gap-0 overflow-hidden p-0",
            isTakedownModalOpen && "pointer-events-none opacity-60"
          )}
        >
          <DialogTitle className="sr-only">{card.title} Details</DialogTitle>

          <DialogClose className="hover:bg-fill-3 text-label-secondary focus-visible:outline-tint z-raised duration-fast absolute top-4 right-4 cursor-pointer rounded-full p-2 transition-colors focus-visible:outline-2">
            <X className="h-5 w-5" />
            <span className="sr-only">Close</span>
          </DialogClose>

          {/* Modal Header */}
          <div className="border-separator flex flex-col gap-4 border-b p-4 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-label text-title-1 sm:text-large-title">{card.title}</h2>
                  <RarityBadge rarity={card.rarity} size="medium" />
                  {isIIWiki && <IIWikiBadge size="sm" />}
                  {isLoreCard && resolvedCategory && categoryLabel && (
                    <span
                      className="border-separator text-label text-caption inline-flex items-center gap-2 rounded-full border px-3 py-1"
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
                  <Button size="sm" variant="secondary" onClick={() => onShare(card)}>
                    <Share2 className="h-3.5 w-3.5" />
                    Share
                  </Button>
                )}
                {onDownloadImage && (
                  <Button size="sm" variant="secondary" onClick={() => onDownloadImage(card)}>
                    <Download className="h-3.5 w-3.5" />
                    Save image
                  </Button>
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
            <div className="border-separator shrink-0 border-b px-4 sm:px-6">
              <TabsList className="bg-transparent">
                <TabsTrigger value="overview">
                  <Info className="mr-2 h-3.5 w-3.5" />
                  Overview
                </TabsTrigger>
                <TabsTrigger value="market">
                  <BarChart3 className="mr-2 h-3.5 w-3.5" />
                  Market & provenance
                </TabsTrigger>
                <TabsTrigger value="lore">
                  <BookOpen className="mr-2 h-3.5 w-3.5" />
                  Lore
                </TabsTrigger>
              </TabsList>
            </div>

            {/* Tab content */}
            <div className="min-h-0 flex-1 scrollbar-none overflow-y-auto px-4 py-4 sm:px-6">
              <TabsContent value="overview" className="space-y-4 sm:space-y-6">
                <CardOverviewTab
                  card={card}
                  rarityConfig={rarityConfig}
                  neonFrame={neonFrame}
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
                  provenanceEvents={transferHistoryQuery.data}
                />
              </TabsContent>

              <TabsContent value="lore" className="space-y-4">
                <CardLoreTab card={card} wikiUrl={wikiUrl} />
              </TabsContent>
            </div>
          </Tabs>

          {isNsCard && (
            <div className="border-separator bg-surface shrink-0 border-t p-3 sm:px-6">
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
