// @ts-nocheck — Suppressed due to Zod v4 extended type inference gaps
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
} from "lucide-react";
import { cn } from "~/lib/utils";
import { Dialog, DialogContent, DialogTitle, DialogClose } from "~/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "~/components/ui/tabs";
import { RarityBadge } from "./RarityBadge";
import { Card3DViewer } from "./Card3DViewer";
import {
  formatCardStats,
  formatMarketValue,
  getCardTypeLabel,
  getOwnerCount,
  getRarityConfig,
} from "~/lib/card-display-utils";
import { proxyNSImage } from "~/lib/ns-image-proxy";
import type { CardInstance } from "~/types/cards-display";
import { CardHolographicCover } from "./CardHolographicCover";
import { LoreForumSection } from "./LoreForumSection";
import { LoreWikiExcerpt } from "./LoreWikiExcerpt";

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
    // Tab state
    const [activeTab, setActiveTab] = useState("overview");

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
      const metaUrl = (card.metadata as Record<string, unknown>)?.wikiUrl as string | undefined;
      if (metaUrl) return metaUrl;
      if (card.wikiSource && card.wikiArticleTitle) {
        const base =
          card.wikiSource === "ixwiki" ? "https://ixwiki.com/wiki" : "https://iiwiki.com/wiki";
        return `${base}/${encodeURIComponent(card.wikiArticleTitle)}`;
      }
      return card.wikiUrl;
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
                <RarityBadge rarity={card.rarity} size="medium" animated />
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
                <BarChart3 className="mr-1.5 h-3.5 w-3.5 sm:h-4 sm:w-4" />
                Market
              </TabsTrigger>
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
                  Lore
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
                      </div>
                      {/* Rarity glow */}
                      <div
                        className={cn(
                          "pointer-events-none absolute inset-0 z-20 rounded-2xl",
                          rarityConfig.glowColor,
                          rarityConfig.glowIntensity
                        )}
                      />
                    </div>

                    {/* Market value & ownership */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="glass-hierarchy-child rounded-lg p-3">
                        <div className="text-muted-foreground flex items-center gap-2 text-xs">
                          <TrendingUp className="h-4 w-4" />
                          Market Value
                        </div>
                        <div className={cn("mt-1 text-xl font-bold", rarityConfig.color)}>
                          {formatMarketValue(card.marketValue)}
                        </div>
                      </div>

                      <div className="glass-hierarchy-child rounded-lg p-3">
                        <div className="text-muted-foreground flex items-center gap-2 text-xs">
                          <Users className="h-4 w-4" />
                          Ownership
                        </div>
                        <div className="text-foreground mt-1 text-lg font-semibold">
                          {getOwnerCount(card.owners)}
                        </div>
                      </div>
                    </div>
                  </motion.div>

                  {/* Right: Card details */}
                  <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3, delay: 0.1 }}
                    className="space-y-4"
                  >
                    {/* Description */}
                    {card.description && (
                      <div className="glass-hierarchy-child rounded-lg p-4">
                        <h3 className="text-foreground mb-2 text-sm font-semibold">Description</h3>
                        <p className="text-muted-foreground text-sm">{card.description}</p>
                      </div>
                    )}

                    {/* Quick stats */}
                    <div className="glass-hierarchy-child rounded-lg p-4">
                      <h3 className="text-foreground mb-3 text-sm font-semibold">Quick Stats</h3>
                      <div className="grid grid-cols-2 gap-3">
                        {Object.entries(stats).map(([key, stat]) => (
                          <div key={key}>
                            <div className="text-muted-foreground text-xs">{stat.label}</div>
                            <div className="mt-1 flex items-baseline gap-2">
                              <span className={cn("text-xl font-bold", stat.color)}>
                                {stat.value}
                              </span>
                              <span className="text-muted-foreground/50 text-xs">/100</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Enhancement level */}
                    {card.level > 1 && (
                      <div className="glass-hierarchy-child rounded-lg p-3">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Enhancement Level</span>
                          <span className="font-bold text-amber-500 dark:text-amber-400">
                            Level {card.level}
                          </span>
                        </div>
                      </div>
                    )}

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
                        <p className={cn("text-2xl font-bold", rarityConfig.color)}>
                          {formatMarketValue(card.marketValue)}
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

                    {/* Placeholder chart */}
                    <div className="border-border bg-muted/20 flex h-64 items-center justify-center rounded-lg border">
                      <div className="text-center">
                        <BarChart3 className="text-muted-foreground/35 mx-auto mb-3 h-12 w-12" />
                        <p className="text-muted-foreground text-sm">
                          Market chart will display trade history
                        </p>
                        <p className="text-muted-foreground/50 mt-2 text-xs">
                          Coming soon: Price trends, volume analysis
                        </p>
                      </div>
                    </div>
                  </div>
                </motion.div>
              </TabsContent>

              {/* Stats Tab */}
              <TabsContent value="stats" className="space-y-4">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                  className="glass-hierarchy-child rounded-lg p-6"
                >
                  <h3 className="text-foreground mb-6 flex items-center gap-2 text-lg font-semibold">
                    <Star className="h-5 w-5" />
                    Detailed Statistics
                  </h3>

                  <div className="space-y-6">
                    {Object.entries(stats).map(([key, stat]) => (
                      <div key={key} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="text-muted-foreground text-sm">{stat.label}</div>
                          <div className="flex items-baseline gap-2">
                            <span className={cn("text-3xl font-bold", stat.color)}>
                              {stat.value}
                            </span>
                            <span className="text-muted-foreground/50 text-sm">/100</span>
                          </div>
                        </div>
                        {/* Progress bar */}
                        <div className="bg-muted/20 h-3 w-full overflow-hidden rounded-full">
                          <motion.div
                            className={cn(
                              "h-full rounded-full",
                              stat.color.replace("text-", "bg-")
                            )}
                            initial={{ width: 0 }}
                            animate={{ width: `${stat.value}%` }}
                            transition={{ duration: 0.8, delay: 0.2 }}
                          />
                        </div>
                        {/* Stat description */}
                        <p className="text-muted-foreground/75 text-xs">
                          {key === "economic" && "Economic power and resource generation"}
                          {key === "diplomatic" && "International influence and relations"}
                          {key === "military" && "Defense capabilities and force projection"}
                          {key === "social" && "Cultural impact and soft power"}
                        </p>
                      </div>
                    ))}
                  </div>
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
                      {(card.metadata as Record<string, unknown>)?.category && (
                        <span className="rounded-md border border-purple-500/30 bg-purple-600/80 px-3 py-1 text-sm font-bold text-white">
                          {String((card.metadata as Record<string, unknown>).category)}
                        </span>
                      )}
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
                          {Object.entries(stats).map(([key, stat]) => (
                            <div key={key}>
                              <div className="text-muted-foreground text-xs">{stat.label}</div>
                              <div className={cn("text-2xl font-bold", stat.color)}>
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
                          {Object.entries(comparisonStats).map(([key, stat]) => (
                            <div key={key}>
                              <div className="text-muted-foreground text-xs">{stat.label}</div>
                              <div className={cn("text-2xl font-bold", stat.color)}>
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
