import { springSmooth } from "~/lib/design/motion";
import React from "react";
import { motion } from "motion/react";
import {
  StatUp as TrendingUp,
  Group as Users,
  Calendar,
  Page as ScrollText,
  Component as Layers,
  Globe,
} from "iconoir-react";
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
import { Button } from "~/components/ui/button";

export interface CardOverviewTabProps {
  card: CardInstance;
  rarityConfig: {
    borderColor: string;
    glowColor: string;
    glowIntensity: string;
    color: string;
  };
  neonFrame: Parameters<typeof NeonFrameOverlay>[0]["neonFrame"];
  stats?: FormattedStats;
  onTrade?: (card: CardInstance) => void;
  onList?: (card: CardInstance) => void;
  onViewCollection?: (countryId: string) => void;
}

export function CardOverviewTab({
  card,
  rarityConfig,
  neonFrame: _neonFrame,
  stats: _stats,
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
        transition={springSmooth}
        className="space-y-4"
      >
        {/* Interactive 3D Viewer Container */}
        <div className="border-separator bg-fill-4 rounded-card relative flex min-h-[380px] flex-col items-center justify-center border p-4">
          {card.isRetired && (
            <div className="pointer-events-none absolute top-4 z-30 flex items-center justify-center">
              <div className="rounded-control border-red/80 bg-surface text-headline text-red shadow-floating rotate-[-12deg] border-4 px-4 py-1 text-center uppercase select-none">
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
          <div className="bg-surface-secondary border-separator rounded-control border p-3">
            <div className="text-label-secondary text-footnote flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Market Value
            </div>
            <div className={cn("text-title-2 mt-1 flex items-baseline gap-1", rarityConfig.color)}>
              <IxCreditsSymbol size="1em" variant="ic" />
              {card.marketValue.toLocaleString()}
            </div>
          </div>

          <div className="bg-surface-secondary border-separator rounded-control border p-3">
            <div className="text-label-secondary text-footnote flex items-center gap-2">
              <Users className="h-4 w-4" />
              Owners
            </div>
            <div className="text-label text-title-3 mt-1 font-semibold">
              {getOwnerCount(card.owners)}
            </div>
          </div>

          <div className="bg-surface-secondary border-separator rounded-control border p-3">
            <div className="text-label-secondary text-footnote flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Serial #{card.serialNumber ?? "—"}
            </div>
            <div className="text-label text-title-3 mt-1 font-semibold">
              {card.level > 0 ? `Lv.${card.level}` : "—"}
            </div>
          </div>
        </div>

        {/* Ownership metadata */}
        {card.acquiredAt && (
          <div className="bg-surface-secondary border-separator rounded-control border p-3">
            <div className="text-label-secondary text-footnote flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Acquired
            </div>
            <div className="text-label text-headline mt-1">
              {new Date(card.acquiredAt).toLocaleDateString(undefined, {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </div>
          </div>
        )}

        {card.lastSalePrice != null && (
          <div className="bg-surface-secondary border-separator rounded-control border p-3">
            <div className="text-label-secondary text-footnote flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Last Sale
            </div>
            <div className="text-label text-headline mt-1 flex items-baseline gap-1">
              <IxCreditsSymbol size="0.8em" variant="ic" />
              {card.lastSalePrice.toLocaleString()}
              {card.lastSaleDate && (
                <span className="text-label-secondary text-footnote ml-2 font-normal">
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
        transition={{ ...springSmooth, delay: 0.1 }}
        className="space-y-4"
      >
        {card.inscription && (
          <div className="rounded-control border-yellow/20 bg-yellow/5 shadow-card border p-4">
            <div className="text-eyebrow text-yellow mb-2 flex items-center gap-2">
              <ScrollText className="h-4 w-4" />
              Card Inscription
            </div>
            <p className="text-label border-yellow/40 bg-yellow/[0.02] text-body border-l-2 py-1 pl-3 font-medium italic">
              "{card.inscription}"
            </p>
            <div className="text-label-secondary text-footnote mt-2 text-right font-medium">
              Inscribed by user {card.inscribedById ? card.inscribedById.substring(0, 8) : "System"}
              {card.inscribedAt && ` on ${new Date(card.inscribedAt).toLocaleDateString()}`}
            </div>
          </div>
        )}

        {/* Description */}
        {card.description && (
          <div className="bg-surface-secondary border-separator rounded-control border p-4">
            <h3 className="text-label text-headline mb-2">Description</h3>
            <div className="text-label-secondary text-body space-y-1 leading-relaxed">
              <WikiHtmlContent
                html={parseWikitextToHtml(card.description, card.wikiSource || undefined)}
              />
            </div>
          </div>
        )}

        {/* Card Specifications */}
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

          return (
            <div className="bg-surface-secondary border-separator rounded-row space-y-3 border p-4">
              <h3 className="text-label text-label-secondary text-eyebrow mb-2 flex items-center gap-2">
                <Layers className="text-tint h-3.5 w-3.5" />
                Card Specifications
              </h3>

              <div className="divide-separator text-footnote space-y-2 divide-y">
                {resolvedCategory && (
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-label-secondary font-medium">Category</span>
                    <span className="text-label inline-flex items-center gap-2 font-semibold">
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
                  <span className="text-label-secondary font-medium">Tier & Season</span>
                  <div className="inline-flex items-center gap-2">
                    <RarityBadge rarity={card.rarity} size="small" />
                    <span className="text-label font-semibold">Season {card.season}</span>
                  </div>
                </div>

                {isLoreCard && (
                  <div className="flex items-center justify-between pt-2">
                    <span className="text-label-secondary font-medium">Wiki Archive</span>
                    {isIIWiki ? (
                      <IIWikiBadge size="sm" />
                    ) : (
                      <span className="text-wiki text-footnote inline-flex items-center gap-1 font-semibold">
                        <Globe className="h-3 w-3" /> IxWiki
                      </span>
                    )}
                  </div>
                )}

                {wikiAuthor && (
                  <div className="flex items-center justify-between pt-2">
                    <span className="text-label-secondary font-medium">Wiki Author</span>
                    <span
                      className="text-label max-w-[200px] truncate font-semibold"
                      title={wikiAuthor}
                    >
                      {wikiAuthor}
                    </span>
                  </div>
                )}
              </div>
            </div>
          );
        })()}

        {/* Quick actions */}
        <div className="grid grid-cols-2 gap-3">
          {onTrade && (
            <Button variant="gray" size="lg" onClick={() => onTrade(card)}>
              Trade
            </Button>
          )}
          {onList && (
            <Button variant="gray" size="lg" onClick={() => onList(card)}>
              List
            </Button>
          )}
          {onViewCollection && card.countryId && (
            <Button
              variant="gray"
              size="lg"
              onClick={() => onViewCollection(card.countryId!)}
              className="col-span-2"
            >
              View Collection
            </Button>
          )}
        </div>
      </motion.div>
    </div>
  );
}
