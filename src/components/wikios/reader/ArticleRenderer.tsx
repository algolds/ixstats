// src/components/wikios/reader/ArticleRenderer.tsx
// Renders pre-transformed WikiOS article data in reader mode.
// All HTML transformation happens server-side — this component just renders.

"use client";

import { useRef, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  History,
  Link2,
  ExternalLink,
  X,
  Trophy,
  Calendar,
  Star,
  Users,
  CheckCircle2,
  Award,
  Sparkles,
} from "lucide-react";
import { withBasePath } from "~/lib/base-path";
import type { TocEntry } from "~/lib/wikios/html-transformer";
import { AppleBooksTocDrawer } from "~/components/wikios/reader/AppleBooksTocDrawer";
import { InfoboxWithMap } from "~/components/wikios/reader/InfoboxWithMap";
import { useImageLightbox } from "~/components/wikios/reader/ImageLightbox";
import { useWikiContext } from "~/components/wikios/shared/WikiContext";
import { CategoryBreadcrumb } from "~/components/wikios/reader/CategoryBreadcrumb";
import { useAnnotationOverlay } from "~/components/wikios/reader/AnnotationOverlay";
import { useCiteTooltips } from "~/components/wikios/reader/useCiteTooltips";
import { api } from "~/trpc/react";
import { useUser } from "~/context/auth-context";
import { getFlagColors } from "~/lib/flag-color-extractor";
import { Badge } from "~/components/ui/badge";
import { Popover, PopoverTrigger, PopoverContent } from "~/components/ui/popover";

interface ArticleRendererProps {
  title: string;
  contentHtml: string;
  infoboxHtml: string | null;
  noticesHtml: string | null;
  toc: TocEntry[];
  categories: string[];
  lastModified: string | null;
  wikiSource?: "ixwiki" | "iiwiki" | "althistory";
}

const WIKI_SOURCE_LABELS: Record<string, { label: string; url: string }> = {
  iiwiki: { label: "iiwiki.com", url: "https://iiwiki.com/wiki/" },
  althistory: { label: "althistory.fandom.com", url: "https://althistory.fandom.com/wiki/" },
};

function WikiOSHeader({
  title,
  lastModified,
  wikiSource,
  countryData,
  featuredImageUrl,
  themeColors,
  awardsData,
  tocLength,
  onTocClick,
}: {
  title: string;
  lastModified: string | null;
  wikiSource?: string;
  countryData?: any;
  featuredImageUrl?: string | null;
  themeColors: any;
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
}) {
  const rawBackdropUrl = countryData?.flagUrl || featuredImageUrl;

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

  // Capture natural image dimensions to adjust card aspect ratio dynamically (sleeker panoramic format)
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
        // Clamp aspect ratio to a sleeker wide banner shape (between 2.2 and 4.0)
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

  // 3D spring tilt effect
  const tiltStyle = isHovered
    ? {
        transform: `perspective(1200px) rotateY(${coords.x * 12}deg) rotateX(${-coords.y * 12}deg) scale3d(1.015, 1.015, 1.015)`,
        transition: "transform 0.1s cubic-bezier(0.25, 1, 0.5, 1), box-shadow 0.3s ease",
      }
    : {
        transform: `perspective(1200px) rotateY(0deg) rotateX(0deg) scale3d(1, 1, 1)`,
        transition: "transform 0.5s cubic-bezier(0.25, 1, 0.5, 1), box-shadow 0.3s ease",
      };

  // Moving sheen/reflection glint effect
  const sheenStyle = isHovered
    ? {
        background: `radial-gradient(circle 250px at ${(coords.x + 0.5) * 100}% ${(coords.y + 0.5) * 100}%, rgba(255, 255, 255, 0.18), transparent)`,
        mixBlendMode: "overlay" as const,
      }
    : {
        background: "transparent",
      };

  // Combine tilt transform and dynamic aspect ratio (clamped to a sleeker wide format)
  const containerStyle = {
    ...tiltStyle,
    transformStyle: "preserve-3d" as const,
    aspectRatio: aspectRatio ? `${aspectRatio}` : "3.2",
    minHeight: "150px",
    maxHeight: "260px",
  } as React.CSSProperties;

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={handleMouseLeave}
      style={containerStyle}
      className="wikios-header glass-surface glass-refraction relative z-10 mb-6 flex w-full cursor-default flex-col justify-end rounded-2xl border border-white/10 shadow-2xl transition-all duration-300 select-none"
    >
      {/* Immersive Full-Bleed Image Backdrop */}
      {backdropUrl ? (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-0 overflow-hidden rounded-2xl select-none"
        >
          <img
            src={backdropUrl}
            alt=""
            className="absolute inset-0 h-full w-full object-cover object-center saturate-110"
            loading="eager"
            referrerPolicy="no-referrer"
          />
          {/* Subtle gradient wash to ensure legibility on top of the image */}
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
              background: `linear-gradient(135deg, ${themeColors.primary}08 0%, transparent 100%)`,
            }}
          />
        </div>
      )}

      {/* Floating Glass HUD Box in the Bottom-Left */}
      <div
        className="relative z-10 m-3 max-w-xl self-start sm:m-4"
        style={{
          transform: "translateZ(30px)",
          transformStyle: "preserve-3d" as const,
        }}
      >
        <div className="glass-surface glass-refraction space-y-4 rounded-2xl border border-black/15 bg-white/95 p-4 text-left shadow-[0_20px_50px_rgba(0,0,0,0.3)] backdrop-blur-2xl sm:p-5 dark:border-white/10 dark:bg-zinc-950/80 dark:shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
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

          {/* Metadata & Awards Toggle Buttons */}
          {(lastModified || awardsData?.hasAwards) && (
            <div className="flex w-full flex-wrap items-center justify-between gap-4 border-t border-white/5 pt-2">
              <div className="text-muted-foreground flex items-center gap-4 text-[10px]">
                {lastModified && (
                  <span className="flex items-center gap-1">
                    <Calendar size={12} className="text-muted-foreground/60" />
                    Updated: {new Date(lastModified).toLocaleDateString()}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                {awardsData?.hasAwards && primaryAward && badgeConfig && (
                  <Popover open={showPopover} onOpenChange={setShowPopover}>
                    <PopoverTrigger
                      render={
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
                            <span className="text-[10px] leading-none font-black opacity-80">
                              +{awardsData.awards.length - 1}
                            </span>
                          )}
                          <span className="tracking-wider uppercase">{badgeConfig.text}</span>
                        </button>
                      }
                    />

                    <PopoverContent
                      side="bottom"
                      align="end"
                      sideOffset={8}
                      className="z-[100055] w-72 space-y-2.5 rounded-xl border border-zinc-200 bg-white/95 p-3.5 text-xs shadow-[0_12px_36px_rgba(0,0,0,0.15)] backdrop-blur-xl dark:border-zinc-800 dark:bg-zinc-950/90 dark:shadow-[0_16px_48px_rgba(0,0,0,0.5)]"
                    >
                      <div className="text-muted-foreground text-left text-[9px] font-bold tracking-wider uppercase">
                        Awards & Achievements
                      </div>
                      <div className="max-h-48 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent space-y-2 overflow-y-auto pr-1">
                        {awardsData.awards.map((award, idx) => {
                          const date = new Date(award.awardedAt);

                          // Determine icon and color based on award category
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
                          href={withBasePath("/w/special/lorewards")}
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
          )}
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

export function ArticleRenderer({
  title,
  contentHtml,
  infoboxHtml,
  noticesHtml,
  toc,
  categories,
  lastModified,
  wikiSource,
}: ArticleRendererProps) {
  const titleRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const { setWikiPage, activeModal, setActiveModal, setActiveSectionId } = useWikiContext();
  const { user } = useUser();
  const isAuthenticated = !!user;
  const [tocOpen, setTocOpen] = useState(false);

  // Feed TOC data to WikiContext for Dynamic Island wiki mode
  useEffect(() => {
    setWikiPage(title, toc);
    return () => setWikiPage(null, []);
  }, [title, toc, setWikiPage]);

  // Scroll spy to update the active section ID in global context as user scrolls
  useEffect(() => {
    if (toc.length === 0) return;

    function tick() {
      const ids = toc.map((e) => e.id);
      let current: string | null = null;
      // Find the first heading that is currently above or near the top of the viewport
      for (const id of ids) {
        const el = document.getElementById(id);
        if (el) {
          const rect = el.getBoundingClientRect();
          if (rect.top <= 120) {
            current = id;
          }
        }
      }
      setActiveSectionId(current);
    }

    window.addEventListener("scroll", tick, { passive: true });
    tick(); // Run immediately

    return () => {
      window.removeEventListener("scroll", tick);
      setActiveSectionId(null);
    };
  }, [toc, setActiveSectionId]);

  // Make navbox titles clickable to toggle collapse
  useEffect(() => {
    const container = contentRef.current;
    if (!container) return;

    const handleClick = (e: Event) => {
      const target = e.target as HTMLElement;
      const navTitle = target.closest(".navbox-title");
      if (!navTitle) return;
      if (target.closest("a")) return;

      e.stopPropagation();
      e.preventDefault();

      const navbox = navTitle.closest("div.navbox, [role='navigation'].navbox");
      if (navbox) {
        navbox.classList.toggle("wikios-navbox-expanded");
      }
    };

    container.addEventListener("click", handleClick, true);
    return () => container.removeEventListener("click", handleClick, true);
  }, [contentHtml]);

  // Image lightbox
  const lightboxPortal = useImageLightbox(contentRef);

  // Check stash status for annotation overlay
  const stashQuery = api.wikios.isStashed.useQuery(
    { pageTitle: title },
    { enabled: isAuthenticated, retry: false }
  );
  const isStashed = stashQuery.data?.stashed ?? false;

  // Annotation overlay — highlights + selection toolbar
  const { toolbarPortal, annotationPopover } = useAnnotationOverlay(
    contentRef,
    title,
    isAuthenticated,
    isStashed
  );

  // Citation hover tooltips
  const citeTooltipPortal = useCiteTooltips(contentRef);

  // Award and achievement detection
  const awardsQuery = api.lorewards.getArticleAwardsAndAchievements.useQuery(
    { title },
    { staleTime: 300000 }
  );
  const awardsData = awardsQuery.data;

  const slug = encodeURIComponent(title.replace(/ /g, "_"));

  const featuredImageUrl = useMemo(() => {
    const imgRegex = /<img[^>]+src\s*=\s*(?:["']([^"']+)["']|([^>\s"'=]+))/i;
    let rawUrl: string | null = null;
    if (infoboxHtml) {
      const match = infoboxHtml.match(imgRegex);
      if (match) rawUrl = match[1] || match[2] || null;
    }
    if (!rawUrl && contentHtml) {
      const match = contentHtml.match(imgRegex);
      if (match) rawUrl = match[1] || match[2] || null;
    }

    if (rawUrl) {
      // Transform MediaWiki thumbnail URL to full size original
      const thumbMatch = rawUrl.match(/\/thumb(\/[^/]+\/[^/]+\/[^/]+)\//);
      if (thumbMatch) {
        return rawUrl.replace(/\/thumb(\/[^/]+\/[^/]+\/[^/]+)\/[^/]+$/, "$1");
      }
      return rawUrl;
    }
    return null;
  }, [infoboxHtml, contentHtml]);

  const { data: countryData } = api.countries.getByIdBasic.useQuery(
    { id: title },
    {
      enabled:
        !!title &&
        title.trim() !== "" &&
        title !== "Main Page" &&
        title !== "Main_Page" &&
        !title.includes(":"),
      retry: false,
    }
  );

  const themeColors = useMemo(() => {
    if (countryData?.name) {
      return getFlagColors(countryData.name);
    }

    // Fallback: category/namespace matching
    let hue = 217; // Default blue

    const catStr = categories.join(" ").toLowerCase();
    if (
      catStr.includes("history") ||
      catStr.includes("politics") ||
      catStr.includes("executive") ||
      catStr.includes("government")
    ) {
      hue = 38; // Gold/Amber
    } else if (
      catStr.includes("military") ||
      catStr.includes("war") ||
      catStr.includes("conflict") ||
      catStr.includes("defense")
    ) {
      hue = 0; // Red
    } else if (
      catStr.includes("diplomacy") ||
      catStr.includes("geography") ||
      catStr.includes("relation")
    ) {
      hue = 188; // Cyan
    } else if (catStr.includes("file") || catStr.includes("media") || catStr.includes("image")) {
      hue = 142; // Green
    } else if (catStr.includes("talk") || catStr.includes("discussion")) {
      hue = 262; // Purple
    } else if (title.startsWith("File:")) {
      hue = 142; // Green
    } else if (title.startsWith("Talk:")) {
      hue = 262; // Purple
    }

    return {
      primary: `hsl(${hue}, 80%, 45%)`,
      secondary: `hsl(${hue}, 60%, 60%)`,
      accent: `hsl(${hue}, 80%, 45%)`,
      rgbPrimary: { r: 59, g: 130, b: 246 },
    };
  }, [countryData, categories, title]);

  const containerStyle = {
    "--wikios-accent": themeColors.primary,
    "--wikios-accent-hover": themeColors.secondary,
    "--wikios-link": themeColors.primary,
    "--wikios-link-hover": themeColors.secondary,
  } as React.CSSProperties;

  return (
    <div className="wikios-article" style={containerStyle}>
      <div ref={titleRef} className="wikios-title-sentinel" />

      {/* Redesigned Custom WikiOSHeader */}
      <WikiOSHeader
        title={title}
        lastModified={lastModified}
        wikiSource={wikiSource}
        countryData={countryData}
        featuredImageUrl={featuredImageUrl}
        themeColors={themeColors}
        awardsData={awardsData}
        tocLength={toc.length}
        onTocClick={() => setTocOpen(true)}
      />

      {/* External wiki source badge */}
      {wikiSource && wikiSource !== "ixwiki" && WIKI_SOURCE_LABELS[wikiSource] && (
        <div className="mb-4 flex items-center gap-1.5">
          <a
            href={`${WIKI_SOURCE_LABELS[wikiSource]!.url}${encodeURIComponent(title.replace(/ /g, "_"))}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 rounded border border-amber-500/10 bg-amber-50/5 px-2 py-0.5 text-xs text-amber-500 transition-colors hover:bg-amber-500/10"
          >
            <ExternalLink size={11} />
            From {WIKI_SOURCE_LABELS[wikiSource]!.label}
          </a>
        </div>
      )}

      {/* Page-top notices (WIP, stub, hatnotes) */}
      {noticesHtml && (
        <div className="wikios-notices" dangerouslySetInnerHTML={{ __html: noticesHtml }} />
      )}

      {/* Content layout */}
      <div className="wikios-article-with-toc">
        <div className="wikios-article-main" ref={contentRef}>
          <div className="wikios-article-body wikios-article-content">
            {infoboxHtml && <InfoboxWithMap infoboxHtml={infoboxHtml} articleTitle={title} />}
            <div dangerouslySetInnerHTML={{ __html: contentHtml }} />
          </div>

          {categories.length > 0 && <CategoriesBar categories={categories} />}
          <ArticleFooter title={title} lastModified={lastModified} />
        </div>
      </div>

      {lightboxPortal}
      {toolbarPortal}
      {annotationPopover}
      {citeTooltipPortal}

      {/* Table of Contents Drawer */}
      <AppleBooksTocDrawer
        isOpen={tocOpen}
        onClose={() => setTocOpen(false)}
        entries={toc}
        themeColors={themeColors}
      />

      {/* Quick action modals */}
      {activeModal === "history" && (
        <QuickHistoryModal title={title} slug={slug} onClose={() => setActiveModal(null)} />
      )}
      {activeModal === "backlinks" && (
        <QuickBacklinksModal title={title} slug={slug} onClose={() => setActiveModal(null)} />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Quick History Modal
// ---------------------------------------------------------------------------
function QuickHistoryModal({
  title,
  slug,
  onClose,
}: {
  title: string;
  slug: string;
  onClose: () => void;
}) {
  const { data, isLoading } = api.wikios.getHistory.useQuery(
    { title, limit: 10 },
    { staleTime: 30_000 }
  );

  const revisions = data?.revisions ?? [];

  return (
    <div className="wikios-modal-backdrop" onClick={onClose}>
      <div className="wikios-quick-modal" onClick={(e) => e.stopPropagation()}>
        <div className="wikios-quick-modal-header">
          <div className="wikios-quick-modal-title">
            <History size={16} />
            <span>Recent History</span>
          </div>
          <button onClick={onClose} className="wikios-quick-modal-close">
            <X size={16} />
          </button>
        </div>

        <div className="wikios-quick-modal-body">
          {isLoading && <div className="wikios-quick-modal-loading">Loading history...</div>}
          {revisions.map((rev, idx) => {
            const prevRev = revisions[idx + 1];
            const sizeChange = prevRev ? rev.size - prevRev.size : rev.size;
            return (
              <div key={rev.revid} className="wikios-quick-modal-row">
                <div className="wikios-quick-modal-row-main">
                  <span className="wikios-quick-modal-date">
                    {new Date(rev.timestamp).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                  <span className="wikios-quick-modal-user">{rev.user}</span>
                  <span
                    className={`wikios-quick-modal-diff ${sizeChange > 0 ? "wikios-diff-positive" : sizeChange < 0 ? "wikios-diff-negative" : ""}`}
                  >
                    {sizeChange > 0 ? "+" : ""}
                    {sizeChange.toLocaleString()}
                  </span>
                  {rev.minor && <span className="wikios-quick-modal-minor">m</span>}
                </div>
                {rev.comment && <div className="wikios-quick-modal-comment">{rev.comment}</div>}
              </div>
            );
          })}
        </div>

        <Link
          href={withBasePath(`/w/special/history/${slug}`)}
          className="wikios-quick-modal-fullpage"
          onClick={onClose}
        >
          <ExternalLink size={12} />
          View full history
        </Link>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Quick Backlinks Modal
// ---------------------------------------------------------------------------
function QuickBacklinksModal({
  title,
  slug,
  onClose,
}: {
  title: string;
  slug: string;
  onClose: () => void;
}) {
  const { data, isLoading } = api.wikios.getBacklinks.useQuery(
    { title, limit: 20 },
    { staleTime: 60_000 }
  );

  const links = data?.links ?? [];

  return (
    <div className="wikios-modal-backdrop" onClick={onClose}>
      <div className="wikios-quick-modal" onClick={(e) => e.stopPropagation()}>
        <div className="wikios-quick-modal-header">
          <div className="wikios-quick-modal-title">
            <Link2 size={16} />
            <span>What Links Here</span>
          </div>
          <button onClick={onClose} className="wikios-quick-modal-close">
            <X size={16} />
          </button>
        </div>

        <div className="wikios-quick-modal-body">
          {isLoading && <div className="wikios-quick-modal-loading">Loading backlinks...</div>}
          {links.length === 0 && !isLoading && (
            <div className="wikios-quick-modal-empty">No pages link to this article.</div>
          )}
          {links.map((link, i) => (
            <Link
              key={`${link.title}-${i}`}
              href={withBasePath(`/w/${encodeURIComponent(link.title.replace(/ /g, "_"))}`)}
              className="wikios-quick-modal-link"
              onClick={onClose}
            >
              {link.title.replace(/_/g, " ")}
            </Link>
          ))}
        </div>

        <Link
          href={withBasePath(`/w/special/whatlinkshere/${slug}`)}
          className="wikios-quick-modal-fullpage"
          onClick={onClose}
        >
          <ExternalLink size={12} />
          View all backlinks
        </Link>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
function CategoriesBar({ categories }: { categories: string[] }) {
  const visible = categories.filter(
    (cat) =>
      !cat.startsWith("Pages_") &&
      !cat.startsWith("Articles_") &&
      !cat.includes("_with_") &&
      !cat.startsWith("IXWB")
  );
  if (visible.length === 0) return null;

  return (
    <footer className="wikios-categories">
      <span className="wikios-categories-label">Categories:</span>
      <ul className="wikios-categories-list">
        {visible.map((cat) => (
          <li key={cat}>
            <Link
              href={withBasePath(`/w/Category:${encodeURIComponent(cat.replace(/ /g, "_"))}`)}
              className="wikios-category-link"
            >
              {cat.replace(/_/g, " ")}
            </Link>
          </li>
        ))}
      </ul>
    </footer>
  );
}

// ---------------------------------------------------------------------------
function ArticleFooter({ title, lastModified }: { title: string; lastModified: string | null }) {
  const mwBaseUrl = process.env.NEXT_PUBLIC_MEDIAWIKI_URL || "https://ixwiki.com/";
  const mwUrl = `${mwBaseUrl.replace(/\/$/, "")}/wiki/${encodeURIComponent(title.replace(/ /g, "_"))}`;

  return (
    <div className="wikios-article-footer">
      {lastModified && (
        <p className="wikios-last-modified">
          Last modified:{" "}
          {new Date(lastModified).toLocaleDateString("en-US", {
            year: "numeric",
            month: "long",
            day: "numeric",
          })}
        </p>
      )}
      <div className="wikios-footer-links">
        <a href={mwUrl} className="wikios-footer-link" target="_blank" rel="noopener">
          View on Original Wiki
        </a>
      </div>
    </div>
  );
}
