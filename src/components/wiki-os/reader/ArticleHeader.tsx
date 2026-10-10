"use client";

import { cn } from "~/lib/utils";
import React, { useState, useEffect, useRef, useMemo } from "react";
import { preload } from "react-dom";
import Link from "next/link";
import {
  Trophy,
  Star,
  Group as Users,
  CheckCircle as CheckCircle2,
  Sparks as Sparkles,
} from "iconoir-react";
import { Popover, PopoverTrigger, PopoverContent } from "~/components/ui/popover";
import { CategoryBreadcrumb } from "./CategoryBreadcrumb";
import { useWikiMediaTheme } from "~/components/wiki-os/shared/MediaThemeContext";
import { detectMediaType } from "~/lib/wiki-os/transformers/media-theme";
import { heroImage } from "~/lib/wiki-os/transformers/image-url";
import type { FlagColors } from "~/lib/flags/flag-color-extractor";
import { TocButton } from "./ArticleToc";
import { EditorialMastheadHeader } from "./headers/EditorialMastheadHeader";
import { WatchButton } from "./WatchButton";
import { focusRing } from "~/components/ui/button";

type ArticleThemeColors =
  | FlagColors
  | {
      primary: string;
      secondary: string;
      accent?: string;
      glow?: string;
      text?: string;
      rgbPrimary?: { r: number; g: number; b: number };
    };

export interface ArticleAuthorInfo {
  creator?: string | null;
  author?: string | null;
  creatorAvatar?: string | null;
  createdAt?: string | null;
  createdTimestamp?: string | null;
  lastEditor?: string | null;
  lastEditorAvatar?: string | null;
  lastEditedAt?: string | null;
  lastModifiedTimestamp?: string | null;
  contributors?: Array<{ username: string; editCount?: number; lastContributedAt?: string }>;
  totalContributors?: number;
}

export interface ArticleHeaderProps {
  title: string;
  lastModified: string | null;
  wikiSource?: string;
  countryData?: Record<string, unknown> | null;
  featuredImageUrl?: string | null;
  /** The size of the lead image's file, when the article's HTML says (it fixes the hero's shape from the first paint). */
  featuredImageFile?: { width: number | null; height: number | null } | null;
  themeColors?: ArticleThemeColors | null;
  authorInfo?: ArticleAuthorInfo | null;
  awardsData?: {
    hasAwards: boolean;
    hasLoreward: boolean;
    awards: Array<{
      id: string;
      category: string;
      name: string;
      description: string | null;
      recipientUsers: string[];
      awardedAt: string;
      metadata: string | null;
    }>;
  } | null;
  /** Number of headings in the article; the Contents button hides at 0. */
  tocLength?: number;
  onTocClick?: () => void;
}

const YELLOW_BADGE = "border-yellow/20 bg-yellow/10 text-yellow-ink hover:bg-yellow/20";

/** Badge and list styling per award category; `listIconColor` overrides `iconColor` in the popover list. */
const AWARD_STYLES: Record<
  string,
  { Icon: typeof Trophy; text: string; classes: string; iconColor: string; listIconColor?: string }
> = {
  LOREWARD: {
    Icon: Trophy,
    text: "Loreward winner",
    classes: YELLOW_BADGE,
    iconColor: "text-yellow",
  },
  FEATURED: {
    Icon: Star,
    text: "Featured article",
    classes: YELLOW_BADGE,
    iconColor: "text-yellow",
  },
  COLLABORATION: {
    Icon: Users,
    text: "Collaborative work",
    classes: "border-green/20 bg-green/10 text-green-ink hover:bg-green/20",
    iconColor: "text-green",
  },
  PEER_REVIEW: {
    Icon: CheckCircle2,
    text: "Peer reviewed",
    classes: "border-tint/20 bg-tint/10 text-tint hover:bg-tint/20",
    iconColor: "text-blue",
    listIconColor: "text-tint",
  },
  EDITOR_MILESTONE: {
    Icon: Sparkles,
    text: "Editor milestone",
    classes: "border-indigo/20 bg-indigo/10 text-indigo-ink hover:bg-indigo/20",
    iconColor: "text-indigo",
  },
};

const awardStyle = (category: string) =>
  AWARD_STYLES[category] ?? {
    Icon: Trophy,
    text: "Wiki award",
    classes: YELLOW_BADGE,
    iconColor: "text-yellow",
  };
/** The hero card's shape: its picture's, kept within a banner's range; 3.2 when the size is not known. */
function heroAspectRatio(width: number | null, height: number | null): number {
  if (!width || !height) return 3.2;
  return Math.max(2.2, Math.min(4.0, width / height));
}

export function WikiOSHeader({
  title,
  lastModified,
  wikiSource,
  countryData,
  featuredImageUrl,
  featuredImageFile,
  themeColors,
  authorInfo,
  awardsData,
  tocLength = 0,
  onTocClick,
}: ArticleHeaderProps) {
  const rawBackdropUrl: string | null =
    typeof countryData?.flagUrl === "string"
      ? countryData.flagUrl
      : typeof featuredImageUrl === "string"
        ? featuredImageUrl
        : null;

  // The hero's picture: a thumbnail 1280 px wide of a larger photo (never the full file, which
  // was the page's biggest download), else the file itself; and its shape, known before any pixel.
  const hero = useMemo(() => {
    if (!rawBackdropUrl) return null;
    // the file size is the lead image's: a country's flag backdrop has no size we know
    const file = typeof countryData?.flagUrl === "string" ? null : featuredImageFile;
    return heroImage(rawBackdropUrl, file?.width ?? null, file?.height ?? null);
  }, [rawBackdropUrl, countryData?.flagUrl, featuredImageFile]);
  const backdropUrl = hero?.original ?? null;
  // A thumbnail the server cannot make falls back to the file, in the same box
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const heroSrc = hero ? (failedSrc === hero.src ? hero.original : hero.src) : null;
  if (heroSrc) {
    // the browser starts fetching it with the HTML, before the page's scripts have run
    preload(heroSrc, { as: "image", fetchPriority: "high", referrerPolicy: "no-referrer" });
  }
  const onHeroError = () => {
    if (hero && hero.src !== hero.original) setFailedSrc(hero.src);
  };
  // A thumbnail that failed before hydration fired no React `onError`: the picture is already
  // "complete" with no pixels. Look once the page is interactive, and fall back the same way.
  const backdropRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const picture = backdropRef.current?.querySelector("img");
    if (picture?.complete && picture.naturalWidth === 0 && hero && failedSrc !== hero.src) {
      // reads the DOM's state (an external system) after hydration, which no render can know
      // oxlint-disable-next-line
      if (hero.src !== hero.original) setFailedSrc(hero.src);
    }
  }, [hero, failedSrc]);

  const cardRef = useRef<HTMLDivElement>(null);
  const [showPopover, setShowPopover] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);

  // Fires gold particle explosion on page mount for award winning articles
  useEffect(() => {
    if (awardsData?.hasLoreward) {
      // oxlint-disable-next-line
      setShowCelebration(true);
      const timer = setTimeout(() => setShowCelebration(false), 1800);
      return () => clearTimeout(timer);
    }
    return;
  }, [awardsData]);

  const primaryAward = useMemo(() => {
    if (!awardsData?.awards || awardsData.awards.length === 0) return null;
    const priority = [
      "LOREWARD",
      "FEATURED",
      "COLLABORATION",
      "PEER_REVIEW",
      "SPECIAL",
      "EDITOR_MILESTONE",
    ];
    const sorted = [...awardsData.awards].sort((a, b) => {
      return priority.indexOf(a.category) - priority.indexOf(b.category);
    });
    return sorted[0]!;
  }, [awardsData]);

  const badgeConfig = primaryAward ? awardStyle(primaryAward.category) : null;

  const containerStyle = {
    aspectRatio: String(heroAspectRatio(hero?.width ?? null, hero?.height ?? null)),
    minHeight: "150px",
    maxHeight: "260px",
  } as React.CSSProperties;

  // The picture's kind (and its own mode, if it has one) as attributes: foundations.css themes it
  // from <html>, so the server and the first client render agree and no theme's frame is shown to
  // the other's reader (an inline `filter` computed here from the theme was not the same twice).
  const { getImageAttributes } = useWikiMediaTheme();
  const heroMediaType = useMemo(() => detectMediaType(backdropUrl), [backdropUrl]);
  const heroMedia = useMemo(
    () => getImageAttributes(backdropUrl || "", heroMediaType),
    [backdropUrl, heroMediaType, getImageAttributes]
  );

  const isSvg = useMemo(() => {
    if (!backdropUrl) return false;
    const lower = backdropUrl.toLowerCase();
    return (
      heroMediaType === "svg" ||
      heroMediaType === "diagram" ||
      heroMediaType === "math" ||
      lower.includes(".svg") ||
      lower.includes("format=svg") ||
      (lower.includes("/special:filepath/") && lower.endsWith(".svg"))
    );
  }, [backdropUrl, heroMediaType]);

  // If no backdrop image is available, render clean Editorial Masthead
  if (!backdropUrl) {
    return (
      <EditorialMastheadHeader
        title={title}
        lastModified={lastModified}
        wikiSource={wikiSource}
        countryData={countryData}
        featuredImageUrl={featuredImageUrl}
        themeColors={themeColors}
        authorInfo={authorInfo}
        awardsData={awardsData}
        tocLength={tocLength}
        onTocClick={onTocClick}
        primaryAward={primaryAward}
        badgeConfig={badgeConfig}
        showCelebration={showCelebration}
        showPopover={showPopover}
        setShowPopover={setShowPopover}
      />
    );
  }

  return (
    <div
      ref={cardRef}
      style={containerStyle}
      className="wikios-header rounded-card shadow-card relative z-10 mb-6 flex w-full cursor-default flex-col justify-end overflow-hidden select-none"
    >
      {/* Backdrop: Centered & Contained Vector Artwork for SVGs / Full-Bleed for Photos */}
      {backdropUrl ? (
        <div
          ref={backdropRef}
          aria-hidden="true"
          className="rounded-card pointer-events-none absolute inset-0 z-0 flex items-center justify-center overflow-hidden select-none"
          {...heroMedia}
        >
          {isSvg ? (
            <>
              <img
                src={heroSrc ?? backdropUrl}
                width={hero?.width ?? undefined}
                height={hero?.height ?? undefined}
                alt=""
                className="h-full max-h-[85%] w-full max-w-[92%] object-contain object-center p-3 transition-[color,background-color,border-color,box-shadow,opacity,transform] duration-300 sm:p-5 md:p-6"
                {...heroMedia}
                loading="eager"
                fetchPriority="high"
                referrerPolicy="no-referrer"
                onError={onHeroError}
              />
            </>
          ) : (
            <img
              src={heroSrc ?? backdropUrl}
              width={hero?.width ?? undefined}
              height={hero?.height ?? undefined}
              alt=""
              className="absolute inset-0 h-full w-full object-cover object-center transition-[color,background-color,border-color,box-shadow,opacity,transform] duration-300"
              loading="eager"
              fetchPriority="high"
              referrerPolicy="no-referrer"
              onError={onHeroError}
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/10 to-transparent" />
        </div>
      ) : (
        <div
          aria-hidden="true"
          className="bg-surface rounded-card pointer-events-none absolute inset-0 z-0 select-none"
        >
          <div
            className="absolute inset-0"
            style={{
              background: `linear-gradient(135deg, ${themeColors?.primary ?? "#3b82f6"}08 0%, transparent 100%)`,
            }}
          />
        </div>
      )}

      {/* Title card floating over the lead image */}
      <div className="relative z-10 m-3 max-w-xl self-start sm:m-4">
        <div className="facet-overlay text-label relative isolate space-y-2 overflow-hidden rounded-2xl p-4 text-left sm:p-5">
          {/* Breadcrumb Path */}
          <div className="text-label-secondary text-eyebrow flex items-center gap-1">
            <CategoryBreadcrumb title={title} />
          </div>

          {/* Title & Award Badge */}
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-label text-title-2 sm:text-title-1">{title.replace(/_/g, " ")}</h1>

            <WatchButton title={title} wikiSource={wikiSource} />
            <TocButton tocLength={tocLength} onClick={onTocClick} />

            {awardsData?.hasAwards && primaryAward && badgeConfig && (
              <Popover open={showPopover} onOpenChange={setShowPopover}>
                <PopoverTrigger asChild>
                  <button
                    className={cn(
                      "group text-caption duration-fast relative flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1 transition-[background-color,border-color]",
                      focusRing,
                      badgeConfig.classes,
                      showCelebration &&
                        primaryAward.category === "LOREWARD" &&
                        "loreward-badge-celebrate"
                    )}
                  >
                    {showCelebration && primaryAward.category === "LOREWARD" && (
                      <div className="pointer-events-none absolute inset-0 overflow-visible">
                        {[...Array(8)].map((_, i) => (
                          <span
                            key={i}
                            className={`loreward-particle loreward-particle-${i + 1}`}
                          />
                        ))}
                      </div>
                    )}
                    <badgeConfig.Icon
                      aria-hidden="true"
                      className={cn("size-3.5 shrink-0", badgeConfig.iconColor)}
                    />

                    {awardsData.awards.length > 1 && (
                      <span className="text-caption leading-none font-semibold tabular-nums">
                        +{awardsData.awards.length - 1}
                      </span>
                    )}
                    <span>{badgeConfig.text}</span>
                  </button>
                </PopoverTrigger>
                <PopoverContent className="font-ui w-72 p-3" align="start">
                  <div className="border-separator mb-2 flex items-center justify-between border-b pb-2">
                    <span className="text-label text-caption font-semibold">
                      Lorewards & accolades
                    </span>
                    <span className="text-label-secondary text-caption">
                      {awardsData.awards.length} awarded
                    </span>
                  </div>
                  <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
                    {awardsData.awards.map((award: any, idx: number) => {
                      const date = new Date(award.awardedAt || award.createdAt);
                      const style = awardStyle(award.category);
                      const AwardIcon = style.Icon;
                      const iconColor = style.listIconColor ?? style.iconColor;

                      return (
                        <div
                          key={award.id || idx}
                          className="border-separator flex items-start gap-2 border-b pb-2 last:border-0 last:pb-0"
                        >
                          <AwardIcon
                            aria-hidden="true"
                            className={`mt-0.5 h-4 w-4 shrink-0 ${iconColor}`}
                          />
                          <div className="flex flex-col text-left">
                            <span className="text-label text-caption font-semibold">
                              {award.name}
                            </span>
                            {award.description && (
                              <span className="text-label-secondary text-footnote mt-0.5 leading-normal">
                                {award.description}
                              </span>
                            )}
                            <span className="text-label-secondary text-footnote mt-0.5">
                              {date.toLocaleDateString(undefined, {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                              })}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="border-separator flex justify-end border-t pt-2">
                    <Link
                      href={"/util/lorewards"}
                      className="text-caption text-tint duration-fast hover:text-tint-hover transition-colors"
                    >
                      View Leaderboard &rarr;
                    </Link>
                  </div>
                </PopoverContent>
              </Popover>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
