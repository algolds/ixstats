/**
 * CardDetailsModal Component
 * Enhanced expanded card view with 3D viewer, tabs, market history, and social features
 * Phase 1: Card Display Components - Enhanced Edition
 */

"use client";

import React, { useMemo, useState } from "react";
import { motion } from "motion/react";
import Image from "next/image";
import {
  X,
  TrendingUp,
  Users,
  Calendar,
  Star,
  Share2,
  Download,
  BarChart3,
  Info,
  Sparkles,
  ScrollText,
  History,
  Gift,
  ShoppingBag,
  Package,
  ArrowRightLeft,
} from "lucide-react";
import { cn } from "~/lib/utils";
import { titleToWikiOSPath } from "~/lib/wikios/url-compat";
import { Dialog, DialogContent, DialogTitle, DialogClose } from "~/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "~/components/ui/tabs";
import { CardPriceHistoryChart } from "./CardPriceHistoryChart";
import { RarityBadge } from "./RarityBadge";
import { Card3DViewer } from "./Card3DViewer";
import {
  formatCardStats,
  getCardTypeLabel,
  getOwnerCount,
  getRarityConfig,
} from "~/lib/card-display-utils";
import { proxyNSImage } from "~/lib/ns-image-proxy";
import type { CardInstance } from "~/types/cards-display";
import { CardHolographicCover } from "./CardHolographicCover";
import { LoreForumSection } from "./LoreForumSection";
import { LoreWikiExcerpt } from "./LoreWikiExcerpt";
import { IxCreditsSymbol } from "~/components/vault/IxCreditsSymbol";
import { GlassLineChart } from "~/components/charts/RechartsIntegration";
import { api } from "~/trpc/react";
import { useActiveCosmetics } from "~/hooks/useActiveCosmetics";

/**
 * CardDetailsModal component props
 */
export interface CardDetailsModalProps {
  /** Card instance to display */
  card: CardInstance | null;
  /** Modal open state */
  open: boolean;
  /** Close handler */
  onClose: () => void;
  /** Trade action handler */
  onTrade?: (card: CardInstance) => void;
  /** List on market handler */
  onList?: (card: CardInstance) => void;
  /** View collection handler */
  onViewCollection?: (countryId: string) => void;
  /** Comparison card for side-by-side view */
  comparisonCard?: CardInstance | null;
  /** Share handler */
  onShare?: (card: CardInstance) => void;
  /** Download as image handler */
  onDownloadImage?: (card: CardInstance) => void;
}

/**
 * CardDetailsModal - Enhanced full card details with 3D viewer and tabs
 *
 * Features:
 * - Tab system: Overview | 3D View | Market History | Stats
 * - Interactive 3D card viewer
 * - Enhanced market history chart
 * - Card comparison mode
 * - Share & download functionality
 * - Glass modal depth level (z-[100])
 * - Mobile responsive design
 *
 * @example
 * ```tsx
 * <CardDetailsModal
 *   card={selectedCard}
 *   open={isOpen}
 *   onClose={() => setIsOpen(false)}
 *   onTrade={handleTrade}
 *   comparisonCard={comparisonCard}
 * />
 * ```
 */
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
    const { neonFrame } = useActiveCosmetics();
    // Tab state
    const [activeTab, setActiveTab] = useState("overview");

    // Memoized hooks — must be called before any conditional returns
    const valueHistoryQuery = api.cardMarket.getCardValueHistory.useQuery(
      { cardId: card?.id ?? "" },
      { enabled: !!card && activeTab === "market" }
    );

    const transferHistoryQuery = api.cardMarket.getCardTransferHistory.useQuery(
      { ownershipId: card?.ownershipId ?? "" },
      { enabled: !!card && !!card.ownershipId && activeTab === "provenance" }
    );

    // Memoize formatted stats
    const stats = useMemo(() => (card ? formatCardStats(card) : null), [card]);
    const rarityConfig = useMemo(() => (card ? getRarityConfig(card.rarity) : null), [card]);
    const comparisonStats = useMemo(
      () => (comparisonCard ? formatCardStats(comparisonCard) : null),
      [comparisonCard]
    );

    // Resolve wiki URL from metadata or construct from source + title
    const wikiUrl = useMemo(() => {
      if (!card) return null;
      let url = (card.metadata as Record<string, unknown>)?.wikiUrl as string | undefined;
      if (!url && card.wikiSource && card.wikiArticleTitle) {
        if (card.wikiSource === "ixwiki") {
          url = titleToWikiOSPath(card.wikiArticleTitle);
        } else {
          url = `https://iiwiki.com/wiki/${encodeURIComponent(card.wikiArticleTitle)}`;
        }
      }
      if (!url) {
        url = card.wikiUrl ?? null;
      }

      // Post-process: convert legacy external ixwiki links to internal WikiOS /w/ routes
      if (url && (url.includes("ixwiki.com/wiki/") || url.includes("/wiki/"))) {
        const match = url.match(/(?:ixwiki\.com)?\/wiki\/([^#?]+)/);
        if (match && match[1]) {
          url = titleToWikiOSPath(decodeURIComponent(match[1]));
        }
      }
      return url;
    }, [card]);

    // Handle share action
    const handleShare = () => {
      if (card) {
        if (onShare) {
          onShare(card);
        } else {
          // Default: copy link to clipboard
          const url = `${window.location.origin}/vault/cards/${card.id}`;
          navigator.clipboard.writeText(url);
        }
      }
    };

    // Handle download action
    const handleDownload = () => {
      if (card && onDownloadImage) {
        onDownloadImage(card);
      }
    };

    if (!card || !stats || !rarityConfig) return null;

    return (
      <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
        <DialogContent
          showCloseButton={false}
          className={cn(
            // Glass modal styling with theme compatibility
            "bg-card/90 backdrop-blur-xl dark:bg-black/75",
            "border-border/55 border-2 shadow-2xl dark:border-white/10",
            "max-w-[95vw] p-0 sm:max-w-2xl md:max-w-3xl lg:max-w-5xl",
            // Responsive sizing
            "max-h-[90vh] w-[98vw] overflow-hidden sm:w-[95vw]"
          )}
        >
          {/* Header with actions */}
          <div className="border-border/40 bg-muted/40 relative border-b px-4 py-3 backdrop-blur-md sm:px-6 sm:py-4 dark:border-white/10 dark:bg-black/40">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <DialogTitle className="text-foreground text-lg font-bold sm:text-xl">
                  {card.title}
                </DialogTitle>
                <RarityBadge rarity={card.rarity} season={card.season} size="medium" animated />
              </div>
              <div className="flex items-center gap-2">
                {/* Share button */}
                <button
                  onClick={handleShare}
                  className="bg-muted/50 hover:bg-muted/80 rounded-full p-2 backdrop-blur-sm transition-colors dark:bg-white/10 dark:hover:bg-white/20"
                  title="Share card"
                >
                  <Share2 className="text-foreground h-4 w-4" />
                </button>
                {/* Download button */}
                {onDownloadImage && (
                  <button
                    onClick={handleDownload}
                    className="bg-muted/50 hover:bg-muted/80 rounded-full p-2 backdrop-blur-sm transition-colors dark:bg-white/10 dark:hover:bg-white/20"
                    title="Download as image"
                  >
                    <Download className="text-foreground h-4 w-4" />
                  </button>
                )}
                {/* Close button */}
                <DialogClose className="bg-muted/50 hover:bg-muted/80 rounded-full p-2 backdrop-blur-sm transition-colors dark:bg-white/10 dark:hover:bg-white/20">
                  <X className="text-foreground h-5 w-5" />
                </DialogClose>
              </div>
            </div>

            {/* Card metadata */}
            <div className="text-muted-foreground mt-2 flex items-center gap-2 text-xs sm:gap-3 sm:text-sm">
              {card.country && (
                <span className="flex items-center gap-1">
                  {card.country.flag && <span className="text-base">{card.country.flag}</span>}
                  {card.country.name}
                </span>
              )}
              <span>•</span>
              <span>
                {card.cardType === "NS_IMPORT" ? (
                  <img
                    src="https://www.nationstates.net/images/island_small.png"
                    alt="NationStates"
                    className="inline h-4 w-4 rounded-sm align-text-bottom"
                    title="NationStates Import"
                  />
                ) : (
                  getCardTypeLabel(card.cardType)
                )}
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" />
                Season {card.season}
              </span>
            </div>
          </div>

          {/* Tab navigation */}
          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            className="flex h-full max-h-[calc(90vh-120px)] flex-col"
          >
            <TabsList className="glass-hierarchy-child mx-4 mt-4 flex-nowrap justify-start gap-1 overflow-x-auto sm:mx-6 sm:gap-2">
              <TabsTrigger
                value="overview"
                className={cn(
                  "rounded-lg px-3 py-2 text-xs font-medium whitespace-nowrap transition-all sm:px-4 sm:text-sm",
                  activeTab === "overview"
                    ? "glass-hierarchy-interactive text-foreground dark:text-white"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Info className="mr-1.5 h-3.5 w-3.5 sm:h-4 sm:w-4" />
                Overview
              </TabsTrigger>
              <TabsTrigger
                value="3d-view"
                className={cn(
                  "rounded-lg px-3 py-2 text-xs font-medium whitespace-nowrap transition-all sm:px-4 sm:text-sm",
                  activeTab === "3d-view"
                    ? "glass-hierarchy-interactive text-foreground dark:text-white"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Sparkles className="mr-1.5 h-3.5 w-3.5 sm:h-4 sm:w-4" />
                3D View
              </TabsTrigger>
              <TabsTrigger
                value="market"
                className={cn(
                  "rounded-lg px-3 py-2 text-xs font-medium whitespace-nowrap transition-all sm:px-4 sm:text-sm",
                  activeTab === "market"
                    ? "glass-hierarchy-interactive text-foreground dark:text-white"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <TrendingUp className="mr-1.5 h-3.5 w-3.5 sm:h-4 sm:w-4" />
                Price History
              </TabsTrigger>
              {card.ownershipId && (
                <TabsTrigger
                  value="provenance"
                  className={cn(
                    "rounded-lg px-3 py-2 text-xs font-medium whitespace-nowrap transition-all sm:px-4 sm:text-sm",
                    activeTab === "provenance"
                      ? "glass-hierarchy-interactive text-foreground dark:text-white"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <History className="mr-1.5 h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  Provenance
                </TabsTrigger>
              )}
              <TabsTrigger
                value="stats"
                className={cn(
                  "rounded-lg px-3 py-2 text-xs font-medium whitespace-nowrap transition-all sm:px-4 sm:text-sm",
                  activeTab === "stats"
                    ? "glass-hierarchy-interactive text-foreground dark:text-white"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Star className="mr-1.5 h-3.5 w-3.5 sm:h-4 sm:w-4" />
                Stats
              </TabsTrigger>
              {card.cardType === "LORE" && (
                <TabsTrigger
                  value="lore"
                  className={cn(
                    "rounded-lg px-3 py-2 text-xs font-medium whitespace-nowrap transition-all sm:px-4 sm:text-sm",
                    activeTab === "lore"
                      ? "glass-hierarchy-interactive text-foreground dark:text-white"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <ScrollText className="mr-1.5 h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  Lore Excerpt
                </TabsTrigger>
              )}
              {comparisonCard && (
                <TabsTrigger
                  value="compare"
                  className={cn(
                    "rounded-lg px-3 py-2 text-xs font-medium whitespace-nowrap transition-all sm:px-4 sm:text-sm",
                    activeTab === "compare"
                      ? "glass-hierarchy-interactive text-foreground dark:text-white"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  Compare
                </TabsTrigger>
              )}
            </TabsList>

            {/* Tab content */}
            <div className="flex-1 overflow-auto px-4 py-4 sm:px-6">
              {/* Overview Tab */}
              <TabsContent value="overview" className="space-y-4 sm:space-y-6">
                <div className="grid grid-cols-1 gap-4 sm:gap-6 md:grid-cols-2">
                  {/* Left: Card image */}
                  <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3 }}
                    className="space-y-4"
                  >
                    {/* Card image */}
                    <div className="relative w-full overflow-hidden rounded-2xl border-2 shadow-2xl">
                      <div
                        className={cn("absolute inset-0 z-10", rarityConfig.borderColor)}
                        style={{
                          borderWidth: "2px",
                          borderRadius: "1rem",
                        }}
                      />
                      <div className="relative h-[300px] w-full sm:h-[400px]">
                        <CardHolographicCover
                          cardType={card.cardType}
                          rarity={card.rarity}
                          wikiSource={card.wikiSource}
                          title={card.title}
                        />
                        <Image
                          src={proxyNSImage(card.artwork)}
                          alt={card.title}
                          fill
                          className="object-cover"
                          priority
                          sizes="(max-width: 768px) 90vw, 400px"
                          unoptimized
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = "none";
                          }}
                        />
                        {card.isRetired && (
                          <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center">
                            <div className="rotate-[-12deg] rounded-lg border-4 border-red-500/80 bg-red-950/90 px-4 py-2 text-center text-xl font-black tracking-widest text-red-500 uppercase shadow-2xl backdrop-blur-xs select-none">
                              Retired
                            </div>
                          </div>
                        )}
                      </div>
                      {/* Rarity glow */}
                      <div
                        className={cn(
                          "pointer-events-none absolute inset-0 z-20 rounded-2xl",
                          rarityConfig.glowColor,
                          rarityConfig.glowIntensity
                        )}
                      />

                      {/* Neon Frame Overlay */}
                      {neonFrame.enabled && (
                        <motion.div
                          className="pointer-events-none absolute inset-0 z-30 rounded-2xl"
                          style={{
                            border: `2px solid ${neonFrame.color}`,
                            boxShadow: `0 0 12px ${neonFrame.color}, inset 0 0 8px ${neonFrame.color}`,
                          }}
                          animate={
                            neonFrame.style === "pulse"
                              ? {
                                  opacity: [0.5, 1, 0.5],
                                }
                              : undefined
                          }
                          transition={{
                            duration: 2,
                            repeat: Infinity,
                            ease: "easeInOut",
                          }}
                        />
                      )}
                    </div>

                    {/* Market value & ownership */}
                    <div className="grid grid-cols-3 gap-3">
                      <div className="glass-hierarchy-child rounded-lg p-3">
                        <div className="text-muted-foreground flex items-center gap-2 text-xs">
                          <TrendingUp className="h-4 w-4" />
                          Market Value
                        </div>
                        <div
                          className={cn(
                            "mt-1 flex items-baseline gap-1 text-xl font-bold",
                            rarityConfig.color
                          )}
                        >
                          <IxCreditsSymbol size="1em" variant="ic" />
                          {card.marketValue.toLocaleString()}
                        </div>
                      </div>

                      <div className="glass-hierarchy-child rounded-lg p-3">
                        <div className="text-muted-foreground flex items-center gap-2 text-xs">
                          <Users className="h-4 w-4" />
                          Owners
                        </div>
                        <div className="text-foreground mt-1 text-lg font-semibold">
                          {getOwnerCount(card.owners)}
                        </div>
                      </div>

                      <div className="glass-hierarchy-child rounded-lg p-3">
                        <div className="text-muted-foreground flex items-center gap-2 text-xs">
                          <Calendar className="h-4 w-4" />
                          Serial #{card.serialNumber ?? "—"}
                        </div>
                        <div className="text-foreground mt-1 text-lg font-semibold">
                          {card.level > 0 ? `Lv.${card.level}` : "—"}
                        </div>
                      </div>
                    </div>

                    {/* Ownership metadata */}
                    {card.acquiredAt && (
                      <div className="glass-hierarchy-child rounded-lg p-3">
                        <div className="text-muted-foreground flex items-center gap-2 text-xs">
                          <Calendar className="h-4 w-4" />
                          Acquired
                        </div>
                        <div className="text-foreground mt-1 text-sm font-semibold">
                          {new Date(card.acquiredAt).toLocaleDateString(undefined, {
                            year: "numeric",
                            month: "long",
                            day: "numeric",
                          })}
                        </div>
                      </div>
                    )}

                    {card.lastSalePrice != null && (
                      <div className="glass-hierarchy-child rounded-lg p-3">
                        <div className="text-muted-foreground flex items-center gap-2 text-xs">
                          <TrendingUp className="h-4 w-4" />
                          Last Sale
                        </div>
                        <div className="text-foreground mt-1 flex items-baseline gap-1 text-sm font-semibold">
                          <IxCreditsSymbol size="0.8em" variant="ic" />
                          {card.lastSalePrice.toLocaleString()}
                          {card.lastSaleDate && (
                            <span className="text-muted-foreground ml-2 text-xs font-normal">
                              {new Date(card.lastSaleDate).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </motion.div>

                  {/* Right: Card details */}
                  <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3, delay: 0.1 }}
                    className="space-y-4"
                  >
                    {card.inscription && (
                      <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-4 shadow-sm backdrop-blur-xs">
                        <div className="mb-2 flex items-center gap-2 text-xs font-bold tracking-wider text-amber-500 uppercase">
                          <ScrollText className="h-4 w-4" />
                          Card Inscription
                        </div>
                        <p className="text-foreground border-l-2 border-amber-500/40 bg-amber-500/[0.02] py-1 pl-3 text-sm font-medium italic">
                          "{card.inscription}"
                        </p>
                        <div className="text-muted-foreground mt-2 text-right text-[10px] font-medium">
                          Inscribed by user{" "}
                          {card.inscribedById ? card.inscribedById.substring(0, 8) : "System"}
                          {card.inscribedAt &&
                            ` on ${new Date(card.inscribedAt).toLocaleDateString()}`}
                        </div>
                      </div>
                    )}

                    {/* Description */}
                    {card.description && (
                      <div className="glass-hierarchy-child rounded-lg p-4">
                        <h3 className="text-foreground mb-2 text-sm font-semibold">Description</h3>
                        <p className="text-muted-foreground text-sm">{card.description}</p>
                      </div>
                    )}

                    {/* Quick stats */}
                    <div className="glass-hierarchy-child rounded-lg p-4">
                      <div className="mb-3 flex items-center justify-between">
                        <h3 className="text-foreground text-sm font-semibold">Quick Stats</h3>
                        {card.level > 1 && (
                          <span className="rounded-md bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-500 dark:text-amber-400">
                            Lv.{card.level} +{stats.totalBoost}
                          </span>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        {Object.entries(stats.base).map(([key, stat]) => (
                          <div key={key}>
                            <div className="text-muted-foreground text-xs">{stat.def.label}</div>
                            <div className="mt-1 flex items-baseline gap-2">
                              <span className="text-xl font-bold" style={{ color: stat.def.color }}>
                                {stat.value}
                              </span>
                              <span className="text-muted-foreground/50 text-xs">/100</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Quick actions */}
                    <div className="grid grid-cols-2 gap-3">
                      {onTrade && (
                        <button
                          onClick={() => onTrade(card)}
                          className={cn(
                            "glass-hierarchy-interactive rounded-lg px-4 py-3",
                            "text-foreground text-sm font-semibold dark:text-white",
                            "transition-all hover:scale-105"
                          )}
                        >
                          Trade
                        </button>
                      )}
                      {onList && (
                        <button
                          onClick={() => onList(card)}
                          className={cn(
                            "glass-hierarchy-interactive rounded-lg px-4 py-3",
                            "text-foreground text-sm font-semibold dark:text-white",
                            "transition-all hover:scale-105"
                          )}
                        >
                          List
                        </button>
                      )}
                      {onViewCollection && card.countryId && (
                        <button
                          onClick={() => onViewCollection(card.countryId!)}
                          className={cn(
                            "glass-hierarchy-interactive col-span-2 rounded-lg px-4 py-3",
                            "text-foreground text-sm font-semibold dark:text-white",
                            "transition-all hover:scale-105"
                          )}
                        >
                          View Collection
                        </button>
                      )}
                    </div>
                  </motion.div>
                </div>
              </TabsContent>

              {/* 3D View Tab */}
              <TabsContent
                value="3d-view"
                className="flex min-h-[500px] items-center justify-center"
              >
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.4 }}
                  className="flex flex-col items-center gap-6"
                >
                  <Card3DViewer
                    card={card}
                    size="large"
                    enableFlip={true}
                    enableDragRotation={true}
                    enableMouseTracking={true}
                  />
                  <div className="space-y-2 text-center">
                    <p className="text-muted-foreground text-sm">Drag to rotate • Click to flip</p>
                    <p className="text-muted-foreground/60 text-xs">
                      Experience the card in interactive 3D
                    </p>
                  </div>
                </motion.div>
              </TabsContent>

              {/* Market History Tab */}
              <TabsContent value="market" className="space-y-4">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <div className="glass-hierarchy-child rounded-lg p-6">
                    <h3 className="text-foreground mb-4 flex items-center gap-2 text-lg font-semibold">
                      <BarChart3 className="h-5 w-5" />
                      Market History
                    </h3>

                    {/* Market stats */}
                    <div className="mb-6 grid grid-cols-3 gap-4">
                      <div className="glass-hierarchy-child rounded-lg p-4">
                        <p className="text-muted-foreground mb-1 text-xs">Current Value</p>
                        <p
                          className={cn(
                            "flex items-baseline gap-1 text-2xl font-bold",
                            rarityConfig.color
                          )}
                        >
                          <IxCreditsSymbol size="1em" variant="ic" />
                          {card.marketValue.toLocaleString()}
                        </p>
                      </div>
                      <div className="glass-hierarchy-child rounded-lg p-4">
                        <p className="text-muted-foreground mb-1 text-xs">Total Supply</p>
                        <p className="text-foreground text-2xl font-bold">
                          {card.totalSupply.toLocaleString()}
                        </p>
                      </div>
                      <div className="glass-hierarchy-child rounded-lg p-4">
                        <p className="text-muted-foreground mb-1 text-xs">Last Trade</p>
                        <p className="text-foreground text-sm font-semibold">
                          {card.lastTrade ? new Date(card.lastTrade).toLocaleDateString() : "Never"}
                        </p>
                      </div>
                    </div>

                    {/* Market chart */}
                    <div className="mt-4">
                      <CardPriceHistoryChart cardId={card.id} />
                    </div>
                  </div>
                </motion.div>
              </TabsContent>

              {/* Provenance Tab */}
              {card.ownershipId && (
                <TabsContent value="provenance" className="space-y-4">
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                  >
                    <div className="glass-hierarchy-child rounded-lg p-6">
                      <h3 className="text-foreground mb-4 flex items-center gap-2 text-lg font-semibold">
                        <History className="h-5 w-5" />
                        Provenance Timeline
                      </h3>

                      {transferHistoryQuery.isLoading ? (
                        <div className="flex h-32 items-center justify-center">
                          <div className="border-primary h-6 w-6 animate-spin rounded-full border-2 border-t-transparent" />
                        </div>
                      ) : !transferHistoryQuery.data || transferHistoryQuery.data.length === 0 ? (
                        <div className="text-muted-foreground flex h-32 items-center justify-center text-sm">
                          No ownership transfer events found
                        </div>
                      ) : (
                        <div className="relative ml-3 space-y-6 border-l border-slate-200 pl-6 dark:border-white/10">
                          {transferHistoryQuery.data.map((event: any) => {
                            let icon = <Package className="h-4 w-4 text-white" />;
                            let actionLabel = "Transferred";
                            let colorClass = "bg-blue-500";

                            if (event.action === "PACK_OPEN") {
                              icon = <Package className="h-4 w-4 text-white" />;
                              actionLabel = "Pulled from Card Pack";
                              colorClass = "bg-purple-500";
                            } else if (event.action === "DAILY_CLAIM") {
                              icon = <Sparkles className="h-4 w-4 text-white" />;
                              actionLabel = "Claimed as Daily Bonus";
                              colorClass = "bg-yellow-500";
                            } else if (event.action === "GIFT") {
                              icon = <Gift className="h-4 w-4 text-white" />;
                              actionLabel = event.fromUserName
                                ? `Gifted from ${event.fromUserName} to ${event.toUserName}`
                                : `Gifted to ${event.toUserName}`;
                              colorClass = "bg-pink-500";
                            } else if (event.action === "TRADE") {
                              icon = <ArrowRightLeft className="h-4 w-4 text-white" />;
                              actionLabel = event.fromUserName
                                ? `Traded from ${event.fromUserName} to ${event.toUserName}`
                                : `Traded to ${event.toUserName}`;
                              colorClass = "bg-teal-500";
                            } else if (
                              event.action === "AUCTION_BUYOUT" ||
                              event.action === "AUCTION_END"
                            ) {
                              icon = <ShoppingBag className="h-4 w-4 text-white" />;
                              actionLabel = `Purchased at Auction by ${event.toUserName}`;
                              if (event.price) {
                                actionLabel += ` for ${event.price.toLocaleString()} IxC`;
                              }
                              colorClass = "bg-amber-500";
                            } else if (event.action === "ADMIN") {
                              icon = <Star className="h-4 w-4 text-white" />;
                              actionLabel = `Assigned by Admin to ${event.toUserName}`;
                              colorClass = "bg-red-500";
                            }

                            return (
                              <div
                                key={event.id}
                                className="relative flex flex-col items-start gap-1 text-left"
                              >
                                {/* Dot Indicator */}
                                <div
                                  className={cn(
                                    "absolute top-0.5 -left-[37px] flex h-6 w-6 items-center justify-center rounded-full shadow-md",
                                    colorClass
                                  )}
                                >
                                  {icon}
                                </div>
                                <div className="text-foreground text-sm font-semibold">
                                  {actionLabel}
                                </div>
                                <div className="text-muted-foreground text-xs">
                                  {new Date(event.createdAt).toLocaleString(undefined, {
                                    year: "numeric",
                                    month: "short",
                                    day: "numeric",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </motion.div>
                </TabsContent>
              )}

              {/* Stats Tab */}
              <TabsContent value="stats" className="space-y-4">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                  className="glass-hierarchy-child rounded-lg p-6"
                >
                  <h3 className="text-foreground mb-2 flex items-center gap-2 text-lg font-semibold">
                    <Star className="h-5 w-5" />
                    Detailed Statistics
                  </h3>
                  {card.level > 1 && (
                    <p className="text-muted-foreground/70 mb-6 text-xs">
                      Level {card.level} boost applied: +{stats.totalBoost} to all stats
                    </p>
                  )}

                  <div className="space-y-6">
                    {Object.entries(stats.base).map(([key, stat]) => (
                      <div key={key} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="text-muted-foreground text-sm">{stat.def.label}</div>
                          <div className="flex items-baseline gap-2">
                            <span className="text-3xl font-bold" style={{ color: stat.def.color }}>
                              {stat.value}
                            </span>
                            <span className="text-muted-foreground/50 text-sm">/100</span>
                          </div>
                        </div>
                        {/* Progress bar */}
                        <div className="bg-muted/20 h-3 w-full overflow-hidden rounded-full">
                          <motion.div
                            className="h-full rounded-full"
                            initial={{ width: 0 }}
                            animate={{ width: `${stat.value}%` }}
                            transition={{ duration: 0.8, delay: 0.2 }}
                            style={{ backgroundColor: stat.def.color }}
                          />
                        </div>
                        {/* Base + Bonus breakdown */}
                        {stat.bonus > 0 && (
                          <div className="flex items-center gap-3 text-xs">
                            <span className="text-muted-foreground/60">
                              Base: <span className="text-foreground/70">{stat.baseValue}</span>
                            </span>
                            <span className="text-muted-foreground/40">+</span>
                            <span className="text-amber-500 dark:text-amber-400">
                              Level bonus: +{stat.bonus}
                            </span>
                          </div>
                        )}
                        {/* Stat description */}
                        <p className="text-muted-foreground/75 text-xs">{stat.def.description}</p>
                      </div>
                    ))}
                  </div>

                  {/* Special Stats */}
                  {stats.specials.length > 0 && (
                    <div className="mt-8 space-y-4">
                      <h4 className="text-foreground flex items-center gap-2 text-base font-semibold">
                        <Sparkles className="h-4 w-4" />
                        Special Stats
                      </h4>
                      <div className="space-y-4">
                        {stats.specials.map((special) => (
                          <div key={special.def.key} className="space-y-2">
                            <div className="flex items-center justify-between">
                              <div className="text-muted-foreground text-sm">
                                {special.def.label}
                              </div>
                              <div className="flex items-baseline gap-2">
                                <span
                                  className="text-xl font-bold"
                                  style={{ color: special.def.color }}
                                >
                                  {special.rawValue === 0 ? "—" : special.formattedRaw}
                                </span>
                              </div>
                            </div>
                            {typeof special.normalizedValue === "number" &&
                              special.normalizedValue > 0 && (
                                <div className="bg-muted/20 h-2 w-full overflow-hidden rounded-full">
                                  <motion.div
                                    className="h-full rounded-full"
                                    initial={{ width: 0 }}
                                    animate={{ width: `${special.normalizedValue}%` }}
                                    transition={{ duration: 0.8, delay: 0.3 }}
                                    style={{ backgroundColor: special.def.color }}
                                  />
                                </div>
                              )}
                            <p className="text-muted-foreground/75 text-xs">
                              {special.def.description}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </motion.div>
              </TabsContent>

              {/* Lore Tab — only for LORE cards */}
              {card.cardType === "LORE" && (
                <TabsContent value="lore" className="space-y-4">
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                  >
                    {/* Wiki source + category badges */}
                    <div className="mb-4 flex flex-wrap items-center gap-3">
                      <span
                        className={cn(
                          "rounded-md border px-3 py-1 text-sm font-bold",
                          card.wikiSource === "ixwiki"
                            ? "border-blue-400/50 bg-blue-600/80 text-white"
                            : card.wikiSource === "iiwiki"
                              ? "border-green-400/50 bg-green-600/80 text-white"
                              : "border-gray-400/50 bg-gray-600/80 text-white"
                        )}
                      >
                        {card.wikiSource === "ixwiki"
                          ? "IxWiki"
                          : card.wikiSource === "iiwiki"
                            ? "IIWiki"
                            : "Wiki"}
                      </span>
                      {(() => {
                        const meta = card.metadata as Record<string, unknown> | null | undefined;
                        const category = meta?.category;
                        return category ? (
                          <span className="rounded-md border border-purple-500/30 bg-purple-600/80 px-3 py-1 text-sm font-bold text-white">
                            {String(category)}
                          </span>
                        ) : null;
                      })()}
                    </div>

                    {/* Wiki article excerpt (full paragraphs) */}
                    <LoreWikiExcerpt card={card} wikiUrl={wikiUrl} />

                    {/* Lore-specific historical metrics */}
                    {(() => {
                      const meta = card.metadata as Record<string, any> | undefined;
                      const loreStats = meta?.loreStats as
                        | { historicalSignificance?: number; culturalImpact?: number }
                        | undefined;
                      if (!loreStats) return null;
                      return (
                        <div className="glass-hierarchy-child mb-4 rounded-lg p-4">
                          <h4 className="text-foreground mb-3 text-sm font-semibold">
                            Historical Metrics
                          </h4>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <div className="text-muted-foreground text-xs">
                                Historical Significance
                              </div>
                              <div className="text-xl font-bold text-amber-500 dark:text-amber-400">
                                {loreStats.historicalSignificance ?? 0}/100
                              </div>
                            </div>
                            <div>
                              <div className="text-muted-foreground text-xs">Cultural Impact</div>
                              <div className="text-xl font-bold text-purple-500 dark:text-purple-400">
                                {loreStats.culturalImpact ?? 0}/100
                              </div>
                            </div>
                          </div>
                          {meta?.qualityScore != null && (
                            <div className="text-muted-foreground/60 mt-3 text-xs">
                              Article Quality Score: {Math.round(Number(meta.qualityScore))}/100
                            </div>
                          )}
                        </div>
                      );
                    })()}

                    {/* Forum discussions */}
                    <LoreForumSection articleTitle={card.wikiArticleTitle || card.title} />
                  </motion.div>
                </TabsContent>
              )}

              {/* Compare Tab */}
              {comparisonCard && comparisonStats && (
                <TabsContent value="compare" className="space-y-4">
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                  >
                    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                      {/* Original card */}
                      <div className="glass-hierarchy-child rounded-lg p-4">
                        <h4 className="text-foreground mb-4 text-sm font-semibold">{card.title}</h4>
                        <div className="space-y-3">
                          {Object.entries(stats.base).map(([key, stat]) => (
                            <div key={key}>
                              <div className="text-muted-foreground text-xs">{stat.def.label}</div>
                              <div className="text-2xl font-bold" style={{ color: stat.def.color }}>
                                {stat.value}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Comparison card */}
                      <div className="glass-hierarchy-child rounded-lg p-4">
                        <h4 className="text-foreground mb-4 text-sm font-semibold">
                          {comparisonCard.title}
                        </h4>
                        <div className="space-y-3">
                          {Object.entries(comparisonStats.base).map(([key, stat]) => (
                            <div key={key}>
                              <div className="text-muted-foreground text-xs">{stat.def.label}</div>
                              <div className="text-2xl font-bold" style={{ color: stat.def.color }}>
                                {stat.value}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                </TabsContent>
              )}
            </div>
          </Tabs>
        </DialogContent>
      </Dialog>
    );
  }
);

CardDetailsModal.displayName = "CardDetailsModal";
