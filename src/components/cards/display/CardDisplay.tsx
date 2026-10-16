"use client";

/**
 * CardDisplay Component - PREMIUM EDITION
 * Yu-Gi-Oh style digital trading card with holographic effects
 * Phase 1.5: Premium UI/UX Refactor with Glass Physics
 */

import React, { useState } from "react";
import { motion } from "motion/react";
import Image from "next/image";
import { cn } from "~/lib/utils";
import { TextureOverlay } from "~/components/ui/texture-overlay";
import { CometCard } from "~/components/ui/comet-card";
import { RarityBadge } from "./RarityBadge";
import { HolographicOverlay } from "./HolographicOverlay";
import {
  getRarityGlow,
  getRarityConfig,
  getCardWidth,
  getCardTypeLabel,
} from "~/lib/cards/display-utils";
import { getPremiumBorderConfig, getFoilStampConfig, getMetallicGradient } from "~/lib/themes";
import { proxyNSImage } from "~/lib/cards/ns-image-proxy";
import { CardHolographicCover } from "./CardHolographicCover";
import { RARITY_THEMES } from "./CardBack";
import { NationStatesBadge } from "./NationStatesLogo";
import { IIWikiBadge, isIIWikiCard } from "./IIWikiLogo";
import { CategoryIcon } from "~/components/cards/icons";
import { IxCreditsSymbol } from "~/components/vault/IxCreditsSymbol";
import { getCategoryTheme, getCategoryLabel } from "~/lib/cards/category-theme";
import { isValidLoreCategory, type LoreCategory } from "~/lib/cards/category-enums";
import { classifyFromWikitext } from "~/lib/cards/category-classifier";
import { getHybridRarityMaterial } from "~/lib/cards/rarity-materials";
import { parseWikitextToHtml } from "~/lib/wiki-os/transformers/wikitext-parser";
import { WikiHtmlContent } from "~/components/wiki-os/reader/WikiLinkPreview";
import type { CardInstance, CardDisplaySize } from "~/types/cards-display";
import { getCardDesignMetadata } from "~/lib/cards/card-metadata-resolver";

type SizeKey = "small" | "medium" | "large";

const SIZE_KEY: Record<CardDisplaySize, SizeKey> = {
  small: "small",
  sm: "small",
  medium: "medium",
  md: "medium",
  large: "large",
};

const SIZE_STYLES: Record<
  SizeKey,
  {
    title: string;
    type: string;
    height: string;
    heightPx: string;
    imageSizes: string;
  }
> = {
  small: {
    title: "text-footnote",
    type: "text-footnote",
    height: "h-[179px]",
    heightPx: "179px",
    imageSizes: "128px",
  },
  medium: {
    title: "text-body",
    type: "text-footnote",
    height: "h-[269px]",
    heightPx: "269px",
    imageSizes: "192px",
  },
  large: {
    title: "text-body",
    type: "text-body",
    height: "h-[358px]",
    heightPx: "358px",
    imageSizes: "256px",
  },
};

const HOLOGRAPHIC_RARITIES = ["RARE", "ULTRA_RARE", "EPIC", "LEGENDARY"];

const METALLIC_BY_RARITY: Record<string, "gold" | "purple"> = { LEGENDARY: "gold", EPIC: "purple" };

/** The four dual-border corner brackets (matching CardBack.tsx). */
const CORNER_BRACKETS = [
  "top-2 left-2 border-t-2 border-l-2",
  "top-2 right-2 border-t-2 border-r-2",
  "bottom-2 left-2 border-b-2 border-l-2",
  "right-2 bottom-2 border-r-2 border-b-2",
];

const isNsCard = (card: CardInstance) => card.cardType === "NS" || Boolean(card.nsCardId);

/** Lore cards are identified by type, category, wiki linkage or slug. */
function isLoreCardOf(card: CardInstance, resolvedCategory: LoreCategory | null) {
  return (
    card.cardType === "LORE" ||
    Boolean(card.category) ||
    Boolean(card.wikiSource || card.wikiArticleTitle || card.slug) ||
    resolvedCategory !== null
  );
}

function CornerBrackets({ className }: { className: string }) {
  return (
    <>
      {CORNER_BRACKETS.map((position) => (
        <div
          key={position}
          className={cn(
            "pointer-events-none absolute z-30 h-3 w-3 opacity-85",
            position,
            className
          )}
        />
      ))}
    </>
  );
}

function TopBadges(props: {
  card: CardInstance;
  size: CardDisplaySize;
  performanceMode: boolean;
  isIIWiki: boolean;
  isLoreCard: boolean;
  effectiveCategory: LoreCategory | null;
  accentColor?: string;
  typeFont: string;
}) {
  const { card, isIIWiki, isLoreCard, effectiveCategory } = props;
  const showNsBadge = !isIIWiki && !isLoreCard && isNsCard(card);
  const showTypeLabel =
    !effectiveCategory && !isIIWiki && (isLoreCard || (card.cardType !== "NS" && !card.nsCardId));

  return (
    <div className="flex items-start justify-between">
      <RarityBadge
        rarity={card.rarity}
        season={card.season}
        size={props.size === "large" ? "medium" : "small"}
        animated={!props.performanceMode}
      />
      <div className="flex items-center gap-1">
        {isIIWiki && <IIWikiBadge size="sm" showText={false} className="h-5 w-auto px-1 py-0" />}
        {showNsBadge && <NationStatesBadge />}

        {effectiveCategory ? (
          <span
            className="rounded-control-sm shadow-card flex h-5 w-5 items-center justify-center border border-white/20 bg-slate-950/80 p-0.5 text-white"
            title={getCategoryLabel(effectiveCategory)}
          >
            <CategoryIcon
              category={effectiveCategory}
              treatment="seal"
              size="xs"
              color={props.accentColor}
            />
          </span>
        ) : (
          showTypeLabel && (
            <span
              className={cn(
                "rounded-control-sm shadow-card border border-white/20 bg-slate-950/80 px-2 py-0.5 font-bold text-white",
                props.typeFont
              )}
            >
              {getCardTypeLabel(card.cardType)}
            </span>
          )
        )}
      </div>
    </div>
  );
}

/** Category / rarity line. NS cards show the NationStates badge instead of a type label. */
function SubtitleLine(props: {
  card: CardInstance;
  effectiveCategory: LoreCategory | null;
  isLoreCard: boolean;
  customSubtitle?: string;
}) {
  const { card, effectiveCategory } = props;
  const rarityLabel = props.customSubtitle || card.rarity;
  const categoryLabel =
    card.subcategory ||
    (effectiveCategory ? getCategoryLabel(effectiveCategory) : null) ||
    (props.isLoreCard && card.cardType !== "NS" ? getCardTypeLabel(card.cardType) : null);

  if (isNsCard(card) && !categoryLabel) {
    return (
      <p className="text-footnote mt-0.5 line-clamp-1 flex items-center gap-2 font-semibold tracking-wider text-amber-400 uppercase">
        <span>{rarityLabel}</span>
      </p>
    );
  }
  const showLabel = categoryLabel && !(isNsCard(card) && categoryLabel === "NationStates");
  return (
    <p className="text-footnote mt-0.5 line-clamp-1 flex items-center gap-2 font-semibold tracking-wider text-white/80 uppercase">
      {showLabel && (
        <>
          <span>{categoryLabel}</span>
          <span className="text-white/40">•</span>
        </>
      )}
      <span className="font-semibold tracking-wide text-amber-400">{rarityLabel}</span>
    </p>
  );
}

/** The archive line on a lore card's excerpt: card art typography, so upper case. */
const ARCHIVE_LABELS: Record<string, string> = { ixwiki: "WIKI ARCHIVE", iiwiki: "IIWIKI ARCHIVE" };
const wikiArchiveLabel = (source: string | null | undefined) =>
  ARCHIVE_LABELS[source ?? "ixwiki"] ?? `${(source ?? "").toUpperCase()} ARCHIVE`;

function ExcerptBox({ card, html }: { card: CardInstance; html: string }) {
  return (
    <div className="rounded-row pointer-events-auto mt-1 border border-white/15 bg-slate-950/85 p-2 text-left shadow-inner transition-[color,background-color,border-color,box-shadow,opacity,transform] duration-300">
      <div className="text-footnote line-clamp-2 leading-snug text-white/90">
        <WikiHtmlContent html={html} />
      </div>
      <div className="text-footnote mt-2 flex items-center justify-between border-t border-white/10 pt-2 text-white/50">
        <span className="font-semibold tracking-wider text-amber-400 uppercase">
          {wikiArchiveLabel(card.wikiSource)}
        </span>
        <span className="flex items-center gap-0.5 font-mono font-bold text-white/70 tabular-nums">
          <IxCreditsSymbol className="h-2.5 w-2.5 shrink-0" />
          {card.marketValue.toLocaleString()}
        </span>
      </div>
    </div>
  );
}

/** Category, lore/NS classification and rarity styling derived from the card. */
function useCardIdentity(card: CardInstance) {
  const resolvedCategory: LoreCategory | null = isValidLoreCategory(card.category ?? "")
    ? (card.category as LoreCategory)
    : isValidLoreCategory(card.cardType)
      ? (card.cardType as LoreCategory)
      : null;
  const isLoreCard = isLoreCardOf(card, resolvedCategory);

  const meta = card.metadata as Record<string, unknown> | null | undefined;
  const effectiveCategory = React.useMemo(() => {
    if (resolvedCategory) return resolvedCategory;
    if (!isLoreCard) return null;
    return classifyFromWikitext(
      (meta?.fullExcerpt as string) || card.description,
      card.wikiArticleTitle || card.title
    );
  }, [resolvedCategory, isLoreCard, meta, card.description, card.wikiArticleTitle, card.title]);

  return {
    resolvedCategory,
    isLoreCard,
    effectiveCategory,
    categoryTheme: effectiveCategory ? getCategoryTheme(effectiveCategory) : null,
    isIIWiki: isIIWikiCard(card),
  };
}

function CardArtwork(props: {
  card: CardInstance;
  styles: (typeof SIZE_STYLES)[SizeKey];
  designMeta: ReturnType<typeof getCardDesignMetadata>;
  resolvedCategory: LoreCategory | null;
  isIIWiki: boolean;
  isHovered: boolean;
  performanceMode: boolean;
  showHolographic: boolean;
}) {
  const { card, performanceMode } = props;
  const [imageError, setImageError] = useState(false);
  const artUrl = card.artwork;
  const hasCustomArtwork = Boolean(artUrl?.trim() && !imageError);

  return (
    <div
      className="relative h-full w-full overflow-hidden"
      style={{ height: props.styles.heightPx }}
    >
      {hasCustomArtwork && artUrl ? (
        <Image
          src={proxyNSImage(artUrl)}
          alt={card.title}
          fill
          className="object-cover"
          loading="lazy"
          sizes={props.styles.imageSizes}
          onError={() => setImageError(true)}
          unoptimized
        />
      ) : (
        <CardHolographicCover
          category={props.resolvedCategory}
          cardType={card.cardType}
          rarity={card.rarity}
          wikiSource={props.isIIWiki ? "iiwiki" : card.wikiSource}
          title={card.title}
          designMetadata={props.designMeta}
          isHovered={props.isHovered}
        />
      )}

      {/* Metallic gradient overlay for premium feel */}
      {!performanceMode && (
        <div
          className="absolute inset-0 opacity-10 mix-blend-overlay"
          style={{ background: getMetallicGradient(METALLIC_BY_RARITY[card.rarity] ?? "silver") }}
        />
      )}

      {/* Tactile texture for physical cardstock depth */}
      <TextureOverlay
        texture="paperGrain"
        opacity={0.06}
        className="pointer-events-none z-10 mix-blend-overlay"
      />

      {/* Text-readability gradient over artwork */}
      {hasCustomArtwork && (
        <div className="card-art-linear-t absolute inset-0 from-black/95 via-black/40 to-transparent" />
      )}

      {props.showHolographic && (
        <HolographicOverlay
          rarity={card.rarity}
          enableMouseTracking={!performanceMode}
          enableLightRays={!performanceMode}
          enableFoilStamp={getFoilStampConfig(card.rarity).enabled && !performanceMode}
          enableParticles={!performanceMode}
          disabled={performanceMode}
        />
      )}

      <motion.div
        className={cn("rounded-card absolute inset-0", getRarityGlow(card.rarity))}
        initial={{ opacity: 0 }}
        animate={{ opacity: props.isHovered ? 0.5 : 0.2 }}
        transition={{ duration: 0.3 }}
      />
    </div>
  );
}

function LevelBadge({ level }: { level: number }) {
  return (
    <motion.div
      className={cn(
        "absolute top-2 right-2 flex h-8 w-8 items-center justify-center rounded-full",
        "card-art-linear-br from-amber-400 to-amber-600",
        "text-body font-bold text-black tabular-nums",
        "border-2 border-amber-300",
        "shadow-floating"
      )}
      style={{ textShadow: "0 1px 2px rgba(0,0,0,0.3)" }}
      initial={{ scale: 0.8, opacity: 0, rotate: -180 }}
      animate={{ scale: 1, opacity: 1, rotate: 0 }}
      transition={{ duration: 0.5, type: "spring" }}
    >
      {level}
    </motion.div>
  );
}

/** Rarity border (animated gradient border on premium cards) and drop shadow for the card frame. */
function cardFrame(
  rarity: CardInstance["rarity"],
  specularColor: string,
  performanceMode: boolean
) {
  const border = getPremiumBorderConfig(rarity);
  const animated = border.animated && !performanceMode;
  return {
    className: cn(
      "rounded-card relative h-full w-full overflow-hidden",
      animated ? `border-${border.width} ${border.glow}` : `border-${border.width}`,
      getRarityConfig(rarity).borderColor
    ),
    style: {
      borderImageSource: animated
        ? `linear-gradient(135deg, ${border.gradient
            .split(" ")
            .map((c) => `var(--tw-gradient-${c})`)
            .join(", ")})`
        : undefined,
      borderImageSlice: animated ? 1 : undefined,
      boxShadow: `0 20px 45px -10px rgba(0, 0, 0, 0.85), 0 0 25px ${specularColor}`,
    },
  };
}

function CardInfoOverlay(props: {
  card: CardInstance;
  size: CardDisplaySize;
  styles: (typeof SIZE_STYLES)[SizeKey];
  designMeta: ReturnType<typeof getCardDesignMetadata>;
  identity: ReturnType<typeof useCardIdentity>;
  isHovered: boolean;
  performanceMode: boolean;
  showExcerpt: boolean;
}) {
  const { card, styles, identity, isHovered, performanceMode } = props;
  const excerptText = card.wikiExcerpt || card.description || "";
  const excerptHtml = React.useMemo(
    () => (excerptText ? parseWikitextToHtml(excerptText) : ""),
    [excerptText]
  );

  return (
    <div className="pointer-events-none absolute inset-0 flex flex-col justify-between p-3">
      <TopBadges
        card={card}
        size={props.size}
        performanceMode={performanceMode}
        isIIWiki={identity.isIIWiki}
        isLoreCard={identity.isLoreCard}
        effectiveCategory={identity.effectiveCategory}
        accentColor={identity.categoryTheme?.accentColor}
        typeFont={styles.type}
      />

      <div className="space-y-1">
        <motion.h3
          className={cn("line-clamp-2 font-bold tracking-tight text-white", styles.title)}
          style={{ textShadow: "0 2px 6px rgba(0, 0, 0, 0.9)" }}
          animate={!performanceMode && isHovered ? { scale: [1, 1.02, 1] } : {}}
          transition={{ duration: 0.4 }}
        >
          {card.title}
        </motion.h3>

        <SubtitleLine
          card={card}
          effectiveCategory={identity.effectiveCategory}
          isLoreCard={identity.isLoreCard}
          customSubtitle={props.designMeta.customSubtitle ?? undefined}
        />

        {card.country && (
          <p
            className={cn("font-semibold text-white/90", styles.type)}
            style={{ textShadow: "0 1px 2px rgba(0,0,0,0.8)" }}
          >
            {card.country.name}
          </p>
        )}

        {props.showExcerpt && excerptText && <ExcerptBox card={card} html={excerptHtml} />}
      </div>
    </div>
  );
}

/**
 * CardDisplay component props
 */
interface CardDisplayProps {
  /** Card instance data */
  card: CardInstance;
  /** Display size variant */
  size?: CardDisplaySize;
  /** Click handler */
  onClick?: (card: CardInstance) => void;
  /** Additional CSS classes */
  className?: string;
  /** Enable 3D tilt effect (default: true) */
  enable3D?: boolean;
  /** Enable holographic effects (default: true for rare+) */
  enableHolographic?: boolean;
  /** Performance mode - disable heavy effects */
  performanceMode?: boolean;
  /** Hide market value (accepted for callers; the card face shows none) */
  hideValue?: boolean;
  /** Hide bottom lore excerpt box (default: false) */
  hideExcerpt?: boolean;
}

export const CardDisplay = React.memo<CardDisplayProps>(
  ({
    card,
    size = "medium",
    onClick,
    className,
    enable3D = true,
    enableHolographic,
    performanceMode = false,
    hideExcerpt = false,
  }) => {
    const [isHovered, setIsHovered] = useState(false);

    const designMeta = React.useMemo(() => getCardDesignMetadata(card), [card]);
    const identity = useCardIdentity(card);
    const { isLoreCard, effectiveCategory } = identity;

    const rarityTheme = RARITY_THEMES[card.rarity] ?? RARITY_THEMES.COMMON!;
    const frame = cardFrame(
      card.rarity,
      getHybridRarityMaterial(card.rarity, effectiveCategory, designMeta.enableCategoryTint)
        .specularColor,
      performanceMode
    );

    // Holographic is on for rare+ cards unless explicitly disabled
    const showHolographic =
      enableHolographic !== false && !performanceMode && HOLOGRAPHIC_RARITIES.includes(card.rarity);
    const styles = SIZE_STYLES[SIZE_KEY[size] ?? "medium"];
    const depth3D = enable3D && !performanceMode;

    return (
      <CometCard
        className={cn(
          getCardWidth(size),
          styles.height,
          onClick && "cursor-pointer",
          "transition-[color,background-color,border-color,box-shadow,opacity,transform] duration-300",
          className
        )}
        rotateDepth={depth3D ? 12 : 0}
        translateDepth={depth3D ? 15 : 0}
        holographic={showHolographic}
        holographicIntensity={0.7}
        glassDepth="child"
        disableEffects={performanceMode}
      >
        <motion.div
          className={frame.className}
          style={frame.style}
          onHoverStart={() => setIsHovered(true)}
          onHoverEnd={() => setIsHovered(false)}
          onClick={() => onClick?.(card)}
          whileHover={!performanceMode ? { scale: 1.02, transition: { duration: 0.2 } } : undefined}
        >
          <div
            className={cn(
              "pointer-events-none absolute inset-1 z-30 rounded-[14px] border opacity-60",
              rarityTheme.borderInner
            )}
          />
          <CornerBrackets className={rarityTheme.cornerBracket} />

          <CardArtwork
            card={card}
            styles={styles}
            designMeta={designMeta}
            resolvedCategory={identity.resolvedCategory}
            isIIWiki={identity.isIIWiki}
            isHovered={isHovered}
            performanceMode={performanceMode}
            showHolographic={showHolographic}
          />

          <CardInfoOverlay
            card={card}
            size={size}
            styles={styles}
            designMeta={designMeta}
            identity={identity}
            isHovered={isHovered}
            performanceMode={performanceMode}
            showExcerpt={isLoreCard && !hideExcerpt}
          />

          {card.level > 1 && <LevelBadge level={card.level} />}
        </motion.div>
      </CometCard>
    );
  }
);

CardDisplay.displayName = "CardDisplay";
