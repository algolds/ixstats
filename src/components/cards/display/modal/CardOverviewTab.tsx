import React from "react";
import { motion } from "motion/react";
import { StatUp as TrendingUp, Group as Users, Calendar, Page as ScrollText, Component as Layers, Globe } from "iconoir-react";
import { cn } from "~/lib/utils";
import { Card3DViewer } from "../Card3DViewer";
import { NeonFrameOverlay } from "~/components/vault/NeonFrameOverlay";
import { IxCreditsSymbol } from "~/components/vault/IxCreditsSymbol";
import { getOwnerCount } from "~/lib/cards/display-utils";
import type { CardInstance, FormattedStats, CardAuthorInfo } from "~/types/cards-display";
import { CategoryIcon } from "~/components/cards/icons";
import { getCategoryTheme, getCategoryLabel } from "~/lib/cards/category-theme";
import { isValidLoreCategory, LoreCategory } from "~/lib/cards/category-enums";
import { classifyFromWikitext } from "~/lib/cards/category-classifier";
import { RarityBadge } from "../RarityBadge";
import { IIWikiBadge, isIIWikiCard } from "../IIWikiLogo";
import { parseWikitextToHtml } from "~/lib/wiki-os/transformers/wikitext-parser";
import { WikiHtmlContent } from "~/components/wiki-os/reader/WikiLinkPreview";
import { api } from "~/trpc/react";

export interface CardOverviewTabProps {
  card: CardInstance;
  rarityConfig: {
    borderColor: string;
    glowColor: string;
    glowIntensity: string;
    color: string;
  };
  neonFrame: Parameters<typeof NeonFrameOverlay>[0]["neonFrame"];
  stats: FormattedStats;
  onTrade?: (card: CardInstance) => void;
  onList?: (card: CardInstance) => void;
  onViewCollection?: (countryId: string) => void;
}

export function CardOverviewTab({
  card,
  rarityConfig,
  neonFrame: _neonFrame,
  stats,
  onTrade,
  onList,
  onViewCollection,
}: CardOverviewTabProps) {
  const rawMeta = (card.metadata as Record<string, unknown> | null | undefined) ?? {};
  const rawAttrs = (card.attributes as Record<string, unknown> | null | undefined) ?? {};
  const authorInfoFromMeta = (rawMeta.authorInfo as CardAuthorInfo | undefined) || null;

  const cardTypeStr = (card.cardType as string) || "";
  const isLoreCard =
    cardTypeStr === "LORE" ||
    cardTypeStr === "LORE_BATCH" ||
    Boolean(card.category && card.category !== "NS_IMPORT") ||
    Boolean(card.wikiPageId) ||
    Boolean(card.wikiSource) ||
    Boolean(card.slug);

  const hasStoredAuthor = Boolean(
    authorInfoFromMeta?.displayAuthor &&
    !authorInfoFromMeta.displayAuthor.includes("Community") &&
    !authorInfoFromMeta.displayAuthor.includes("Unknown") &&
    !authorInfoFromMeta.displayAuthor.includes("imported>")
  );

  const { data: liveAuthorData } = api.loreCards.getCardAuthorInfo.useQuery(
    {
      cardId: card.id,
      articleTitle: card.wikiArticleTitle || "",
      source: (card.wikiSource === "iiwiki" ? "iiwiki" : "ixwiki") as "ixwiki" | "iiwiki",
    },
    {
      enabled: Boolean(isLoreCard && card.wikiArticleTitle && !hasStoredAuthor),
      staleTime: 1000 * 60 * 60,
    }
  );

  const rawAuthorStr =
    liveAuthorData?.authorInfo?.displayAuthor ||
    authorInfoFromMeta?.displayAuthor ||
    (rawMeta.author as string) ||
    (rawMeta.creator as string) ||
    (rawMeta.wikiAuthor as string) ||
    (rawAttrs.author as string) ||
    (rawAttrs.creator as string) ||
    card.artworkCredit ||
    "";

  let wikiAuthor: string | null = rawAuthorStr
    .replace(/(?:imported|import)\s*>\s*/gi, "")
    .replace(/User:\s*/gi, "")
    .trim();

  if (
    !wikiAuthor ||
    wikiAuthor.toLowerCase().includes("community") ||
    wikiAuthor.toLowerCase() === "unknown"
  ) {
    wikiAuthor = null;
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:gap-6 md:grid-cols-2">
      {/* Left: Interactive 3D Card Presentation */}
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.3 }}
        className="space-y-4"
      >
        {/* Interactive 3D Viewer Container */}
        <div className="border-border/40 bg-muted/20 relative flex min-h-[380px] flex-col items-center justify-center rounded-2xl border p-4 backdrop-blur-md">
          {card.isRetired && (
            <div className="pointer-events-none absolute top-4 z-30 flex items-center justify-center">
              <div className="rotate-[-12deg] rounded-lg border-4 border-red-500/80 bg-red-950/90 px-4 py-1 text-center text-sm font-bold tracking-widest text-red-500 uppercase shadow-2xl backdrop-blur-xs select-none">
                Retired
              </div>
            </div>
          )}

          <Card3DViewer
            card={card}
            size="large"
            enableFlip={true}
            enableDragRotation={true}
            enableMouseTracking={true}
            hideValue={true}
            hideStats={true}
            hideExcerpt={true}
          />
        </div>

        {/* Market value & ownership */}
        <div className="grid grid-cols-3 gap-3">
          <div className="facet-hierarchy-child rounded-lg p-3">
            <div className="text-muted-foreground flex items-center gap-2 text-xs">
              <TrendingUp className="h-4 w-4" />
              Market Value
            </div>
            <div
              className={cn("mt-1 flex items-baseline gap-1 text-xl font-bold", rarityConfig.color)}
            >
              <IxCreditsSymbol size="1em" variant="ic" />
              {card.marketValue.toLocaleString()}
            </div>
          </div>

          <div className="facet-hierarchy-child rounded-lg p-3">
            <div className="text-muted-foreground flex items-center gap-2 text-xs">
              <Users className="h-4 w-4" />
              Owners
            </div>
            <div className="text-foreground mt-1 text-lg font-semibold">
              {getOwnerCount(card.owners)}
            </div>
          </div>

          <div className="facet-hierarchy-child rounded-lg p-3">
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
          <div className="facet-hierarchy-child rounded-lg p-3">
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
          <div className="facet-hierarchy-child rounded-lg p-3">
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
              Inscribed by user {card.inscribedById ? card.inscribedById.substring(0, 8) : "System"}
              {card.inscribedAt && ` on ${new Date(card.inscribedAt).toLocaleDateString()}`}
            </div>
          </div>
        )}

        {/* Description */}
        {card.description && (
          <div className="facet-hierarchy-child rounded-lg p-4">
            <h3 className="text-foreground mb-2 text-sm font-semibold">Description</h3>
            <div className="text-muted-foreground space-y-1 text-sm leading-relaxed">
              <WikiHtmlContent
                html={parseWikitextToHtml(card.description, card.wikiSource || undefined)}
              />
            </div>
          </div>
        )}

        {/* Card Specifications or NS Stats */}
        {(() => {
          const cardTypeStr = (card.cardType as string) || "";
          const isIIWiki = isIIWikiCard(card);
          const isLoreCard =
            isIIWiki ||
            cardTypeStr === "LORE" ||
            cardTypeStr === "LORE_BATCH" ||
            Boolean(card.category && card.category !== "NS_IMPORT") ||
            Boolean(card.wikiPageId) ||
            Boolean(card.wikiSource) ||
            Boolean(card.slug);

          const meta = card.metadata as Record<string, unknown> | null | undefined;
          const rawCat = card.category || (meta?.category as string);
          const resolvedCategory = (
            rawCat && isValidLoreCategory(rawCat) && rawCat !== "NS_IMPORT"
              ? (rawCat as LoreCategory)
              : isLoreCard
                ? classifyFromWikitext(
                    (meta?.fullExcerpt as string) || card.description,
                    card.wikiArticleTitle || card.title
                  )
                : null
          ) as LoreCategory | null;

          const categoryTheme = resolvedCategory ? getCategoryTheme(resolvedCategory) : null;

          if (isLoreCard) {
            return (
              <div className="facet-hierarchy-child border-border/40 space-y-3 rounded-xl border p-4 backdrop-blur-md">
                <h3 className="text-foreground text-muted-foreground/80 mb-2 flex items-center gap-1.5 text-xs font-bold tracking-wider uppercase">
                  <Layers className="text-primary h-3.5 w-3.5" />
                  Card Specifications
                </h3>

                <div className="space-y-2.5 divide-y divide-white/5 text-xs">
                  {resolvedCategory && (
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-muted-foreground font-medium">Category</span>
                      <span className="text-foreground inline-flex items-center gap-1.5 font-bold">
                        <CategoryIcon
                          category={resolvedCategory}
                          treatment="seal"
                          size="xs"
                          color={categoryTheme?.accentColor}
                        />
                        {getCategoryLabel(resolvedCategory)}
                      </span>
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-2">
                    <span className="text-muted-foreground font-medium">Tier & Season</span>
                    <div className="inline-flex items-center gap-2">
                      <RarityBadge rarity={card.rarity} size="small" />
                      <span className="text-foreground font-semibold">Season {card.season}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <span className="text-muted-foreground font-medium">Wiki Archive</span>
                    {isIIWiki ? (
                      <IIWikiBadge size="sm" />
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-sky-600 dark:text-sky-400">
                        <Globe className="h-3 w-3" /> IxWiki
                      </span>
                    )}
                  </div>

                  {wikiAuthor && (
                    <div className="flex items-center justify-between pt-2">
                      <span className="text-muted-foreground font-medium">Wiki Author</span>
                      <span
                        className="text-foreground max-w-[200px] truncate font-semibold"
                        title={wikiAuthor}
                      >
                        {wikiAuthor}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          }

          return Object.keys(stats.base).length > 0 ? (
            <div className="facet-hierarchy-child border-border/40 space-y-3 rounded-xl border p-4 backdrop-blur-md">
              <div className="flex items-center justify-between">
                <h3 className="text-foreground text-sm font-bold">NS Simulation Stats</h3>
                {card.level > 1 && (
                  <span className="rounded-md bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-500 dark:text-amber-400">
                    Lv.{card.level} +{stats.totalBoost}
                  </span>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                {Object.entries(stats.base).map(([key, stat]) => (
                  <div key={key} className="rounded-lg border border-white/10 bg-black/40 p-2.5">
                    <div className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
                      {stat.def.label}
                    </div>
                    <div className="mt-0.5 flex items-baseline gap-2">
                      <span
                        className="font-mono text-lg font-bold tabular-nums"
                        style={{ color: stat.def.color }}
                      >
                        {stat.value}
                      </span>
                      <span className="text-muted-foreground/50 text-[10px]">/100</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null;
        })()}

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
  );
}
