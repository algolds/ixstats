"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import Link from "next/link";
import {
  Trophy,
  Star,
  Group as Users,
  CheckCircle as CheckCircle2,
  Sparks as Sparkles,
  Medal as Award,
  Calendar,
  User,
  EditPencil as PenTool,
} from "iconoir-react";
import { Badge } from "~/components/ui/badge";
import { Popover, PopoverTrigger, PopoverContent } from "~/components/ui/popover";
import { CategoryBreadcrumb } from "./CategoryBreadcrumb";
import { withBasePath } from "~/lib/base-path";
import { useWikiMediaTheme } from "~/components/wiki-os/shared/MediaThemeContext";
import { detectMediaType } from "~/lib/wiki-os/transformers/media-theme";
import type { ActiveCountryData } from "~/components/wiki-os/shared/ActiveCountryUnifiedWidget";
import type { FlagColors } from "~/lib/flags/flag-color-extractor";

export type ArticleThemeColors =
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
}

export interface ArticleHeaderProps {
  title: string;
  lastModified: string | null;
  wikiSource?: string;
  countryData?: ActiveCountryData | Record<string, unknown> | null;
  featuredImageUrl?: string | null;
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
  tocLength: number;
  onTocClick: () => void;
}

export function WikiOSHeader({
  title,
  lastModified,
  wikiSource,
  countryData,
  featuredImageUrl,
  themeColors,
  authorInfo,
  awardsData,
  _tocLength,
  _onTocClick,
}: ArticleHeaderProps & { _tocLength?: number; _onTocClick?: () => void }) {
  const rawBackdropUrl: string | null =
    typeof countryData?.flagUrl === "string"
      ? countryData.flagUrl
      : typeof featuredImageUrl === "string"
        ? featuredImageUrl
        : null;

  const backdropUrl = useMemo(() => {
    if (!rawBackdropUrl) return null;
    const thumbMatch = rawBackdropUrl.match(/\/thumb(\/[^/]+\/[^/]+\/[^/]+)\//);
    if (thumbMatch) {
      return rawBackdropUrl.replace(/\/thumb(\/[^/]+\/[^/]+\/[^/]+)\/[^/]+$/, "$1");
    }
    return rawBackdropUrl;
  }, [rawBackdropUrl]);

  const cardRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState({ x: 0, y: 0 });
  const [isHovered, setIsHovered] = useState(false);
  const [aspectRatio, setAspectRatio] = useState<number | null>(null);
  const [showPopover, setShowPopover] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);

  // Fires gold particle explosion on page mount for award winning articles
  useEffect(() => {
    if (awardsData?.hasLoreward) {
      setShowCelebration(true);
      const timer = setTimeout(() => setShowCelebration(false), 1800);
      return () => clearTimeout(timer);
    }
    return;
  }, [awardsData]);

  // Capture natural image dimensions to adjust card aspect ratio dynamically
  useEffect(() => {
    if (!backdropUrl) {
      setAspectRatio(null);
      return;
    }
    const img = new Image();
    img.src = backdropUrl;
    img.referrerPolicy = "no-referrer";
    img.onload = () => {
      if (img.naturalWidth && img.naturalHeight) {
        const ratio = img.naturalWidth / img.naturalHeight;
        setAspectRatio(Math.max(2.2, Math.min(4.0, ratio)));
      }
    };
  }, [backdropUrl]);

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

  const badgeConfig = useMemo(() => {
    if (!primaryAward) return null;
    switch (primaryAward.category) {
      case "LOREWARD":
        return {
          Icon: Trophy,
          text: "Loreward Winner",
          classes:
            "border-amber-600/20 bg-amber-600/10 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/15 dark:text-amber-400 dark:hover:bg-amber-500/25 hover:bg-amber-600/20",
          iconColor: "text-amber-600 dark:text-amber-400",
        };
      case "FEATURED":
        return {
          Icon: Star,
          text: "Featured Article",
          classes:
            "border-yellow-500/20 bg-yellow-500/10 text-yellow-700 dark:border-yellow-500/30 dark:bg-yellow-500/15 dark:text-yellow-400 dark:hover:bg-yellow-500/25 hover:bg-yellow-500/20",
          iconColor: "text-yellow-600 dark:text-yellow-400",
        };
      case "COLLABORATION":
        return {
          Icon: Users,
          text: "Collaborative Work",
          classes:
            "border-green-600/20 bg-green-600/10 text-green-800 dark:border-green-500/30 dark:bg-green-500/15 dark:text-green-400 dark:hover:bg-green-500/25 hover:bg-green-600/20",
          iconColor: "text-green-600 dark:text-green-400",
        };
      case "PEER_REVIEW":
        return {
          Icon: CheckCircle2,
          text: "Peer Reviewed",
          classes:
            "border-blue-600/20 bg-blue-600/10 text-blue-800 dark:border-blue-500/30 dark:bg-blue-500/15 dark:text-blue-400 dark:hover:bg-blue-500/25 hover:bg-blue-600/20",
          iconColor: "text-blue-600 dark:text-blue-400",
        };
      case "EDITOR_MILESTONE":
        return {
          Icon: Sparkles,
          text: "Editor Milestone",
          classes:
            "border-indigo-600/20 bg-indigo-600/10 text-indigo-800 dark:border-indigo-500/30 dark:bg-indigo-500/15 dark:text-indigo-400 dark:hover:bg-indigo-500/25 hover:bg-indigo-600/20",
          iconColor: "text-indigo-600 dark:text-indigo-400",
        };
      default:
        return {
          Icon: Award,
          text: "Wiki Award",
          classes:
            "border-purple-600/20 bg-purple-600/10 text-purple-800 dark:border-purple-500/30 dark:bg-purple-500/15 dark:text-purple-400 dark:hover:bg-purple-500/25 hover:bg-purple-600/20",
          iconColor: "text-purple-600 dark:text-purple-400",
        };
    }
  }, [primaryAward]);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    setCoords({ x, y });
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    setCoords({ x: 0, y: 0 });
  };

  const tiltStyle = isHovered
    ? {
        transform: `perspective(1200px) rotateY(${coords.x * 12}deg) rotateX(${-coords.y * 12}deg) scale3d(1.015, 1.015, 1.015)`,
        transition: "transform 0.1s cubic-bezier(0.25, 1, 0.5, 1), box-shadow 0.3s ease",
      }
    : {
        transform: `perspective(1200px) rotateY(0deg) rotateX(0deg) scale3d(1, 1, 1)`,
        transition: "transform 0.5s cubic-bezier(0.25, 1, 0.5, 1), box-shadow 0.3s ease",
      };

  const sheenStyle = isHovered
    ? {
        background: `radial-gradient(circle 250px at ${(coords.x + 0.5) * 100}% ${(coords.y + 0.5) * 100}%, rgba(255, 255, 255, 0.18), transparent)`,
        mixBlendMode: "overlay" as const,
      }
    : {
        background: "transparent",
      };

  const containerStyle = {
    ...tiltStyle,
    transformStyle: "preserve-3d" as const,
    aspectRatio: aspectRatio ? `${aspectRatio}` : "3.2",
    minHeight: "150px",
    maxHeight: "260px",
  } as React.CSSProperties;

  const { getImageStyle, isDarkTheme } = useWikiMediaTheme();
  const heroMediaType = useMemo(() => detectMediaType(backdropUrl), [backdropUrl]);
  const heroMediaStyle = useMemo(
    () => getImageStyle(backdropUrl || "", heroMediaType),
    [backdropUrl, heroMediaType, getImageStyle]
  );

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={handleMouseLeave}
      style={containerStyle}
      className="wikios-header facet-surface facet-refraction relative z-10 mb-6 flex w-full cursor-default flex-col justify-end rounded-2xl border border-white/10 shadow-2xl transition-all duration-300 select-none"
    >
      {/* Immersive Full-Bleed Image Backdrop */}
      {backdropUrl ? (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-0 overflow-hidden rounded-2xl select-none"
          style={heroMediaStyle.backgroundColor ? { backgroundColor: heroMediaStyle.backgroundColor } : undefined}
        >
          <img
            src={backdropUrl}
            alt=""
            className="absolute inset-0 h-full w-full object-cover object-center saturate-110 transition-all duration-300"
            style={heroMediaStyle.filter ? { filter: heroMediaStyle.filter } : undefined}
            loading="eager"
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/10 to-transparent dark:from-black/75 dark:via-black/25 dark:to-transparent" />
        </div>
      ) : (
        <div
          aria-hidden="true"
          className="bg-card pointer-events-none absolute inset-0 z-0 rounded-2xl select-none"
        >
          <div
            className="absolute inset-0 bg-gradient-to-br"
            style={{
              background: `linear-gradient(135deg, ${themeColors?.primary ?? "#3b82f6"}08 0%, transparent 100%)`,
            }}
          />
        </div>
      )}

      {/* Floating Glass HUD Box */}
      <div
        className="relative z-10 m-3 max-w-xl self-start sm:m-4"
        style={{
          transform: "translateZ(30px)",
          transformStyle: "preserve-3d" as const,
        }}
      >
        <div className="facet-surface facet-refraction space-y-4 rounded-2xl border border-black/15 bg-white/95 p-4 text-left shadow-[0_20px_50px_rgba(0,0,0,0.3)] backdrop-blur-2xl sm:p-5 dark:border-white/10 dark:bg-zinc-950/80 dark:shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
          {/* Breadcrumb Path */}
          <div className="text-muted-foreground flex items-center gap-1 text-[10px] font-semibold tracking-wider uppercase">
            <CategoryBreadcrumb title={title} />
          </div>

          {/* Title and Badge */}
          <div className="flex flex-wrap items-baseline gap-2.5">
            <h1 className="text-foreground text-xl leading-tight font-bold tracking-tight sm:text-2xl">
              {title.replace(/_/g, " ")}
            </h1>
            {wikiSource && wikiSource !== "ixwiki" && (
              <Badge
                variant="outline"
                className="border-amber-500/20 bg-amber-500/10 px-1.5 py-0 text-[10px] text-amber-400"
              >
                {wikiSource}
              </Badge>
            )}
          </div>

          {/* Metadata & Awards */}
          {(() => {
            const creatorName = authorInfo?.creator || authorInfo?.author || null;
            const creatorAvatar = authorInfo?.creatorAvatar || null;
            const lastEditorName = authorInfo?.lastEditor || null;
            const lastEditorAvatar = authorInfo?.lastEditorAvatar || null;

            return (lastModified || awardsData?.hasAwards || creatorName || lastEditorName) && (
              <div className="flex w-full flex-wrap items-center justify-between gap-3 border-t border-black/10 dark:border-white/5 pt-2.5">
                <div className="text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[11px]">
                  {/* Author Attribution (Apple Design Hierarchy) */}
                  {creatorName && (
                    <div className="flex items-center gap-1.5 font-medium">
                      <span className="text-[10px] text-muted-foreground/80 font-normal">Author:</span>
                      <Link
                        href={withBasePath(`/wiki/User:${encodeURIComponent(creatorName.replace(/ /g, "_"))}`)}
                        className="group/author inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 text-foreground font-semibold hover:border-purple-500/40 hover:bg-purple-500/10 hover:text-purple-300 active:scale-95 transition-all text-[11px]"
                      >
                        {creatorAvatar ? (
                          <span className="relative flex size-4 shrink-0 overflow-hidden rounded-full ring-1 ring-black/10 dark:ring-white/20">
                            <img
                              src={creatorAvatar}
                              alt={creatorName}
                              className="aspect-square size-full object-cover"
                              onError={(e) => {
                                (e.currentTarget as HTMLElement).style.display = "none";
                              }}
                            />
                            <User className="h-2.5 w-2.5 text-purple-400 absolute inset-0 m-auto -z-10" />
                          </span>
                        ) : (
                          <User className="h-3 w-3 text-purple-400 shrink-0" />
                        )}
                        <span>{creatorName}</span>
                      </Link>
                    </div>
                  )}

                  {/* Most Recent Editor (if different from original author) */}
                  {lastEditorName &&
                    creatorName &&
                    lastEditorName.toLowerCase() !== creatorName.toLowerCase() && (
                      <div className="flex items-center gap-1.5 font-medium">
                        <span className="text-muted-foreground/40 select-none">•</span>
                        <span className="text-[10px] text-muted-foreground/80 font-normal">Updated by:</span>
                        <Link
                          href={withBasePath(`/wiki/User:${encodeURIComponent(lastEditorName.replace(/ /g, "_"))}`)}
                          className="group/editor inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 text-foreground font-semibold hover:border-purple-500/40 hover:bg-purple-500/10 hover:text-purple-300 active:scale-95 transition-all text-[11px]"
                        >
                          {lastEditorAvatar ? (
                            <span className="relative flex size-4 shrink-0 overflow-hidden rounded-full ring-1 ring-black/10 dark:ring-white/20">
                              <img
                                src={lastEditorAvatar}
                                alt={lastEditorName}
                                className="aspect-square size-full object-cover"
                                onError={(e) => {
                                  (e.currentTarget as HTMLElement).style.display = "none";
                                }}
                              />
                              <PenTool className="h-2.5 w-2.5 text-purple-400 absolute inset-0 m-auto -z-10" />
                            </span>
                          ) : (
                            <PenTool className="h-2.5 w-2.5 text-purple-400 shrink-0" />
                          )}
                          <span>{lastEditorName}</span>
                        </Link>
                      </div>
                    )}

                  {/* Updated Timestamp */}
                  {lastModified && (
                    <div className="flex items-center gap-1.5 text-muted-foreground/80 text-[10.5px]">
                      {(creatorName || lastEditorName) && (
                        <span className="text-muted-foreground/40 select-none">•</span>
                      )}
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3 text-muted-foreground/60" />
                        {new Date(lastModified).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2">
                {awardsData?.hasAwards && primaryAward && badgeConfig && (
                  <Popover open={showPopover} onOpenChange={setShowPopover}>
                    <PopoverTrigger asChild>
                      <button
                        className={`group relative flex cursor-pointer items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[10px] font-bold shadow-sm transition-all duration-300 hover:shadow-md active:scale-95 ${
                          badgeConfig.classes
                        } ${
                          showCelebration && primaryAward.category === "LOREWARD"
                            ? "loreward-badge-celebrate"
                            : ""
                        }`}
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
                          className={`h-3.5 w-3.5 shrink-0 group-hover:animate-bounce ${badgeConfig.iconColor}`}
                        />

                        {awardsData.awards.length > 1 && (
                          <span className="text-[10px] leading-none font-bold tabular-nums opacity-80">
                            +{awardsData.awards.length - 1}
                          </span>
                        )}
                        <span className="tracking-wider uppercase">{badgeConfig.text}</span>
                      </button>
                    </PopoverTrigger>

                    <PopoverContent
                      side="bottom"
                      align="end"
                      sideOffset={8}
                      className="z-[100055] w-72 space-y-2.5 rounded-xl border border-zinc-200 bg-white/95 p-3.5 text-xs shadow-[0_12px_36px_rgba(0,0,0,0.15)] backdrop-blur-xl dark:border-zinc-800 dark:bg-zinc-950/90 dark:shadow-[0_16px_48px_rgba(0,0,0,0.5)]"
                    >
                      <div className="text-muted-foreground text-left text-[9px] font-semibold tracking-wider uppercase">
                        Awards & Achievements
                      </div>
                      <div className="max-h-48 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent space-y-2 overflow-y-auto pr-1">
                        {awardsData.awards.map((award, idx) => {
                          const date = new Date(award.awardedAt);

                          let AwardIcon = Award;
                          let iconColor = "text-purple-500";
                          if (award.category === "LOREWARD") {
                            AwardIcon = Trophy;
                            iconColor = "text-amber-500";
                          } else if (award.category === "FEATURED") {
                            AwardIcon = Star;
                            iconColor = "text-yellow-500";
                          } else if (award.category === "COLLABORATION") {
                            AwardIcon = Users;
                            iconColor = "text-green-500";
                          } else if (award.category === "PEER_REVIEW") {
                            AwardIcon = CheckCircle2;
                            iconColor = "text-blue-500";
                          } else if (award.category === "EDITOR_MILESTONE") {
                            AwardIcon = Sparkles;
                            iconColor = "text-indigo-500";
                          }

                          return (
                            <div
                              key={award.id || idx}
                              className="flex items-start gap-2 border-b border-zinc-100 pb-2 last:border-0 last:pb-0 dark:border-white/5"
                            >
                              <AwardIcon className={`mt-0.5 h-4 w-4 shrink-0 ${iconColor}`} />
                              <div className="flex flex-col text-left">
                                <span className="text-foreground text-[11px] font-semibold">
                                  {award.name}
                                </span>
                                {award.description && (
                                  <span className="text-muted-foreground mt-0.5 text-[10px] leading-normal">
                                    {award.description}
                                  </span>
                                )}
                                <span className="text-muted-foreground/60 mt-0.5 text-[9px]">
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
                      <div className="flex justify-end border-t border-zinc-100 pt-2 dark:border-white/5">
                        <Link
                          href={withBasePath("/wiki/lorewards")}
                          className="text-[10px] font-bold text-amber-600 transition-colors hover:text-amber-700 dark:text-amber-400 dark:hover:text-amber-300"
                        >
                          View Leaderboard &rarr;
                        </Link>
                      </div>
                    </PopoverContent>
                  </Popover>
                )}
              </div>
            </div>
          );
        })()}
        </div>
      </div>

      {/* Dynamic Cursor Sheen Overlay */}
      <div
        className="pointer-events-none absolute inset-0 z-20 rounded-2xl transition-opacity duration-300"
        style={sheenStyle}
      />
    </div>
  );
}
