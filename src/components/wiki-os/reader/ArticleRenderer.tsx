// src/components/wiki-os/reader/ArticleRenderer.tsx
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
import type { TocEntry } from "~/lib/wiki-os/html-transformer";
import { AppleBooksTocDrawer } from "~/components/wiki-os/reader/AppleBooksTocDrawer";
import { StickyToc } from "~/components/wiki-os/reader/StickyToc";
import { useWikiSetting } from "~/components/wiki-os/shared/useWikiSetting";
import { InfoboxWithMap } from "~/components/wiki-os/reader/InfoboxWithMap";
import { useImageLightbox } from "~/components/wiki-os/reader/ImageLightbox";
import { useWikiContext } from "~/components/wiki-os/shared/WikiContext";
import { CategoryBreadcrumb } from "~/components/wiki-os/reader/CategoryBreadcrumb";
import { useAnnotationOverlay } from "~/components/wiki-os/reader/AnnotationOverlay";
import { useCiteTooltips } from "~/components/wiki-os/reader/useCiteTooltips";
import { useWikiNarrator } from "~/hooks/useWikiNarrator";
import { api } from "~/trpc/react";
import { useWikiAuth } from "~/lib/wiki-os/use-wiki-auth";
import { getFlagColors } from "~/lib/flag-color-extractor";
import { safeDecodeURI } from "~/lib/wiki-os/safe-decode";
import { Badge } from "~/components/ui/badge";
import { Popover, PopoverTrigger, PopoverContent } from "~/components/ui/popover";
import { createPortal } from "react-dom";
import { MapPin } from "lucide-react";
import { EMBED_CSS, EMBED_JS } from "~/lib/wiki-os/wiki-embed-shared";
import dynamic from "next/dynamic";

const CoordinatesMapEmbed = dynamic(
  () =>
    import("~/components/maps/widgets/CoordinatesMapEmbed").then((m) => ({
      default: m.CoordinatesMapEmbed,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="wikios-ixworld-loading flex min-h-[200px] items-center justify-center rounded-xl border border-white/10 bg-white/5">
        <div
          className="wikios-loading-spinner mr-2 animate-spin"
          style={{ width: 20, height: 20 }}
        />
        <span className="text-xs text-zinc-400">Loading map...</span>
      </div>
    ),
  }
);

function getRgbaColor(colorStr: string, opacity: number): string {
  if (colorStr.startsWith("#")) {
    const cleanHex = colorStr.replace("#", "");
    const r = parseInt(cleanHex.substring(0, 2), 16);
    const g = parseInt(cleanHex.substring(2, 4), 16);
    const b = parseInt(cleanHex.substring(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
  }
  if (colorStr.startsWith("hsl")) {
    return colorStr.replace("hsl(", "hsla(").replace(")", `, ${opacity})`);
  }
  return `rgba(59, 130, 246, ${opacity})`;
}

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
                          <span className="text-[10px] leading-none font-black opacity-80">
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

const EMPTY_STATS_DATA: Record<string, any> = {};

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
  const narrator = useWikiNarrator(contentRef);
  const { isSignedIn } = useWikiAuth();
  const isAuthenticated = isSignedIn;
  const [tocOpen, setTocOpen] = useState(false);
  const showWikiToc = useWikiSetting("wikios:showWikiToc", true);

  // --- Portal & Dynamic Widgets Setup ---
  // 1. Extract keys from contentHtml before rendering
  const statKeys = useMemo(() => {
    const keys = new Set<string>();
    const regex = /\{\{((?:MyCountry|CountryData|BusinessData):[^\}\n]+?)\}\}/gi;
    let match;
    while ((match = regex.exec(contentHtml)) !== null) {
      if (match[1]) keys.add(match[1]);
    }
    const linkRegex =
      /Template(?::|%3a)((?:MyCountry|CountryData|BusinessData)(?::|%3a)[^"|?#&]+)/gi;
    while ((match = linkRegex.exec(contentHtml)) !== null) {
      if (match[1]) keys.add(safeDecodeURI(match[1]));
    }
    return Array.from(keys);
  }, [contentHtml]);

  // 2. Fetch the batch data
  const statsQuery = api.wiki.resolveWikiPlaceholders.useQuery(
    { placeholders: statKeys },
    { enabled: statKeys.length > 0, staleTime: 5 * 60 * 1000 }
  );
  const statsData = statsQuery.data || EMPTY_STATS_DATA;

  // 3. User & Country details for calculations
  const { data: currentUserData } = api.users.getCurrentUserWithRole.useQuery(undefined, {
    enabled: isAuthenticated,
  });
  const { data: viewerCountryData } = api.countries.getByIdBasic.useQuery(
    { id: currentUserData?.user?.country?.id || "" },
    { enabled: !!currentUserData?.user?.country?.id }
  );
  const viewerCentroid = useMemo(() => {
    if (!viewerCountryData?.centroid) return null;
    const c = viewerCountryData.centroid as { lat: number; lng: number } | [number, number];
    if (Array.isArray(c)) {
      return { lng: c[0] || 0, lat: c[1] || 0 };
    }
    return { lat: c.lat || 0, lng: c.lng || 0 };
  }, [viewerCountryData]);

  // Inject shared embed CSS + JS (mirrors IxStats PHP extension for vanilla JS embed support)
  useEffect(() => {
    if (typeof document === "undefined") return;

    if (!document.getElementById("ixstats-embed-css")) {
      const style = document.createElement("style");
      style.id = "ixstats-embed-css";
      style.textContent = EMBED_CSS;
      document.head.appendChild(style);
    }
    if (!document.getElementById("ixstats-embed-js")) {
      const script = document.createElement("script");
      script.id = "ixstats-embed-js";
      script.textContent = EMBED_JS;
      document.head.appendChild(script);
    }

    if (!document.getElementById("ixstats-embed-prefetch")) {
      const link = document.createElement("link");
      link.id = "ixstats-embed-prefetch";
      link.rel = "prefetch";
      link.href = "/maps?embed=true";
      link.setAttribute("as", "document");
      document.head.appendChild(link);
    }
  }, []);

  // 4. Transform HTML string to inject placeholders
  const processedHtml = useMemo(() => injectPlaceholderElements(contentHtml), [contentHtml]);
  const processedInfoboxHtml = useMemo(
    () => (infoboxHtml ? injectPlaceholderElements(infoboxHtml) : null),
    [infoboxHtml]
  );

  // 5. Track targets in DOM to render Portals into
  interface PortalTarget {
    element: Element;
    type: "coords" | "map-embed" | "stat";
    data: any;
  }
  const [portalTargets, setPortalTargets] = useState<PortalTarget[]>([]);

  useEffect(() => {
    const container = contentRef.current;
    if (!container) return;

    const targets: PortalTarget[] = [];

    container.querySelectorAll(".wikios-coords-placeholder").forEach((el) => {
      const lat = parseFloat(el.getAttribute("data-lat") || "0");
      const lng = parseFloat(el.getAttribute("data-lng") || "0");
      const zoom = parseInt(el.getAttribute("data-zoom") || "4", 10);
      const label = el.getAttribute("data-label") || "Location";
      targets.push({
        element: el,
        type: "coords",
        data: { lat, lng, zoom, label },
      });
    });

    container.querySelectorAll(".wikios-map-embed-placeholder").forEach((el) => {
      const lat = parseFloat(el.getAttribute("data-lat") || "0");
      const lng = parseFloat(el.getAttribute("data-lng") || "0");
      const zoom = parseInt(el.getAttribute("data-zoom") || "4", 10);
      const options = el.getAttribute("data-options") || "";
      targets.push({
        element: el,
        type: "map-embed",
        data: { lat, lng, zoom, options },
      });
    });

    container.querySelectorAll(".wikios-stat-placeholder").forEach((el) => {
      const key = el.getAttribute("data-key") || "";
      targets.push({
        element: el,
        type: "stat",
        data: { key },
      });
    });

    setPortalTargets(targets);
  }, [processedHtml, processedInfoboxHtml]);

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

  // Feed TOC data to WikiContext for Dynamic Island wiki mode
  useEffect(() => {
    setWikiPage(title, toc, themeColors);
    return () => setWikiPage(null, [], null);
  }, [title, toc, themeColors, setWikiPage]);

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

  const containerStyle = {
    "--wikios-accent": themeColors.primary,
    "--wikios-accent-hover": themeColors.secondary,
    "--wikios-accent-bg": getRgbaColor(themeColors.primary, 0.08),
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

      {/* Narrator now lives in the Halo (Dynamic Island → Wiki → Now Playing) */}

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
            {processedInfoboxHtml && (
              <InfoboxWithMap infoboxHtml={processedInfoboxHtml} articleTitle={title} />
            )}
            <div dangerouslySetInnerHTML={{ __html: processedHtml }} />
            {/* Render portals into injected placeholder nodes */}
            {portalTargets.map((target, _idx) => {
              if (target.type === "coords") {
                return createPortal(
                  <CoordsPill
                    lat={target.data.lat}
                    lng={target.data.lng}
                    zoom={target.data.zoom}
                    label={target.data.label}
                    viewerCentroid={viewerCentroid}
                  />,
                  target.element
                );
              }
              if (target.type === "map-embed") {
                return createPortal(
                  <CoordinatesMapEmbed
                    lat={target.data.lat}
                    lng={target.data.lng}
                    zoom={target.data.zoom}
                    options={target.data.options}
                  />,
                  target.element
                );
              }
              if (target.type === "stat") {
                return createPortal(
                  <DynamicStatSpan
                    placeholderKey={target.data.key}
                    data={statsData[target.data.key]}
                  />,
                  target.element
                );
              }
              return null;
            })}
          </div>

          {categories.length > 0 && <CategoriesBar categories={categories} />}
          <ArticleFooter title={title} lastModified={lastModified} />
        </div>

        {showWikiToc && toc.length > 3 && <StickyToc entries={toc} contentRef={contentRef} />}
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
          href={withBasePath(`/wiki/history/${slug}`)}
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
              href={withBasePath(`/wiki/${encodeURIComponent(link.title.replace(/ /g, "_"))}`)}
              className="wikios-quick-modal-link"
              onClick={onClose}
            >
              {link.title.replace(/_/g, " ")}
            </Link>
          ))}
        </div>

        <Link
          href={withBasePath(`/wiki/whatlinkshere/${slug}`)}
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
// HTML Placeholder Injection Helper
// ---------------------------------------------------------------------------
function injectPlaceholderElements(html: string): string {
  let processed = html;

  // 0. Strip <iframe> tags — WikiOS renders maps inline or via iframe embeds;
  // MediaWiki-generated iframes are redundant and cause CSP violations.
  processed = processed.replace(/<iframe[\s\S]*?<\/iframe>/gi, "");

  // 1. Process Coords anchors e.g. <a href="...Coords:lat,lng,zoom...">Label</a>
  processed = processed.replace(
    /<a[^>]*href="[^"]*Coords(?::|%3a)([^"|?#&]+)[^"]*"[^>]*>(.*?)<\/a>/gi,
    (match, coordsStr, label) => {
      const decoded = safeDecodeURI(coordsStr);
      const [lat, lng, zoom] = decoded.split(",");
      const safeLat = (lat || "0").replace(/"/g, "&quot;");
      const safeLng = (lng || "0").replace(/"/g, "&quot;");
      const safeZoom = (zoom || "4").replace(/"/g, "&quot;");
      const safeLabel = (label || "Location").replace(/"/g, "&quot;");
      return `<span class="wikios-coords-placeholder" data-lat="${safeLat}" data-lng="${safeLng}" data-zoom="${safeZoom}" data-label="${safeLabel}">${label || "Location"}</span>`;
    }
  );

  // 2. Process raw Coords wikitext e.g. [[Coords:lat,lng,zoom|Label]]
  processed = processed.replace(
    /\[\[Coords:([^\]|]+)(?:\|([^\]]+))?\]\]/gi,
    (match, coordsStr, label) => {
      const decoded = safeDecodeURI(coordsStr);
      const [lat, lng, zoom] = decoded.split(",");
      const safeLat = (lat || "0").replace(/"/g, "&quot;");
      const safeLng = (lng || "0").replace(/"/g, "&quot;");
      const safeZoom = (zoom || "4").replace(/"/g, "&quot;");
      const safeLabel = (label || "Location").replace(/"/g, "&quot;");
      return `<span class="wikios-coords-placeholder" data-lat="${safeLat}" data-lng="${safeLng}" data-zoom="${safeZoom}" data-label="${safeLabel}">${label || "Location"}</span>`;
    }
  );

  // 3. Process MapEmbed anchors e.g. <a href="...MapEmbed:lat,lng,zoom...">options</a>
  processed = processed.replace(
    /<a[^>]*href="[^"]*MapEmbed(?::|%3a)([^"|?#&]+)[^"]*"[^>]*>(.*?)<\/a>/gi,
    (match, coordsStr, options) => {
      const decoded = safeDecodeURI(coordsStr);
      const [lat, lng, zoom] = decoded.split(",");
      const safeLat = (lat || "0").replace(/"/g, "&quot;");
      const safeLng = (lng || "0").replace(/"/g, "&quot;");
      const safeZoom = (zoom || "4").replace(/"/g, "&quot;");
      const safeOptions = (options || "").replace(/"/g, "&quot;");
      return `<div class="wikios-map-embed-placeholder" data-lat="${safeLat}" data-lng="${safeLng}" data-zoom="${safeZoom}" data-options="${safeOptions}"></div>`;
    }
  );

  // 4. Process raw MapEmbed wikitext e.g. [[MapEmbed:lat,lng,zoom|options]]
  processed = processed.replace(
    /\[\[MapEmbed:([^\]|]+)(?:\|([^\]]+))?\]\]/gi,
    (match, coordsStr, options) => {
      const decoded = safeDecodeURI(coordsStr);
      const [lat, lng, zoom] = decoded.split(",");
      const safeLat = (lat || "0").replace(/"/g, "&quot;");
      const safeLng = (lng || "0").replace(/"/g, "&quot;");
      const safeZoom = (zoom || "4").replace(/"/g, "&quot;");
      const safeOptions = (options || "").replace(/"/g, "&quot;");
      return `<div class="wikios-map-embed-placeholder" data-lat="${safeLat}" data-lng="${safeLng}" data-zoom="${safeZoom}" data-options="${safeOptions}"></div>`;
    }
  );

  // 5. Process Template stats anchors e.g. <a href="...Template:MyCountry:field...">
  processed = processed.replace(
    /<a[^>]*href="[^"]*Template(?::|%3a)([^"|?#&]+)[^"]*"[^>]*>(.*?)<\/a>/gi,
    (match, templateName, label) => {
      const decoded = safeDecodeURI(templateName);
      if (
        decoded.startsWith("MyCountry:") ||
        decoded.startsWith("CountryData:") ||
        decoded.startsWith("BusinessData:")
      ) {
        const safeKey = decoded.replace(/"/g, "&quot;");
        return `<span class="wikios-stat-placeholder" data-key="${safeKey}"></span>`;
      }
      return match;
    }
  );

  // 6. Process raw wikitext templates e.g. {{MyCountry:field}}
  processed = processed.replace(
    /\{\{((?:MyCountry|CountryData|BusinessData):[^\}\n]+?)\}\}/gi,
    (match, key) => {
      const safeKey = key.replace(/"/g, "&quot;");
      return `<span class="wikios-stat-placeholder" data-key="${safeKey}"></span>`;
    }
  );

  return processed;
}

// ---------------------------------------------------------------------------
// Map Calculation Helper
// ---------------------------------------------------------------------------
function calculateDistanceAndBearing(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): { distanceKm: number; bearing: string } {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distanceKm = Math.round(R * c);

  const y = Math.sin(dLng) * Math.cos((lat2 * Math.PI) / 180);
  const x =
    Math.cos((lat1 * Math.PI) / 180) * Math.sin((lat2 * Math.PI) / 180) -
    Math.sin((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.cos(dLng);
  let brng = (Math.atan2(y, x) * 180) / Math.PI;
  brng = (brng + 360) % 360;

  const directions = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  const index = Math.round(brng / 45) % 8;
  const bearing = directions[index]!;

  return { distanceKm, bearing };
}

// ---------------------------------------------------------------------------
// CoordsMiniMap — lightweight iframe-based map preview (replaces inline MapLibre GL)
// ---------------------------------------------------------------------------
const CoordsMiniMap = ({ lat, lng, zoom }: { lat: number; lng: number; zoom: number }) => {
  const src = `/maps?embed=true&lat=${lat.toFixed(4)}&lng=${lng.toFixed(4)}&zoom=${zoom}`;

  return (
    <iframe
      src={src}
      loading="lazy"
      allow="fullscreen"
      title="Map preview"
      className="h-32 w-full overflow-hidden rounded-lg border border-white/10 bg-white/5"
      style={{ height: 130, border: "none" }}
    />
  );
};

// ---------------------------------------------------------------------------
// CoordsPill Component
// ---------------------------------------------------------------------------
function CoordsPill({
  lat,
  lng,
  zoom,
  label,
  viewerCentroid,
}: {
  lat: number;
  lng: number;
  zoom: number;
  label: string;
  viewerCentroid?: { lat: number; lng: number } | null;
}) {
  const calc = useMemo(() => {
    if (!viewerCentroid) return null;
    return calculateDistanceAndBearing(viewerCentroid.lat, viewerCentroid.lng, lat, lng);
  }, [viewerCentroid, lat, lng]);

  return (
    <Popover>
      <PopoverTrigger>
        <span className="wikios-coords-pill inline-flex cursor-pointer items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-xs font-semibold text-blue-400 transition-all select-none hover:border-white/20 hover:bg-white/10">
          <MapPin size={11} className="animate-pulse text-blue-400" />
          <span>{label}</span>
          <span className="font-mono text-[10px] opacity-65">
            ({lat.toFixed(2)}, {lng.toFixed(2)})
          </span>
        </span>
      </PopoverTrigger>
      <PopoverContent className="z-[10001] flex w-64 flex-col gap-2 rounded-xl border border-white/10 bg-zinc-950/90 p-3 shadow-2xl backdrop-blur-xl">
        <div className="flex items-center justify-between text-xs">
          <span className="font-bold text-zinc-200">{label}</span>
          <span className="font-mono text-[10px] text-zinc-400">Zoom {zoom}</span>
        </div>

        <CoordsMiniMap lat={lat} lng={lng} zoom={zoom} />

        <div className="flex flex-col gap-0.5 text-[10px] font-medium text-zinc-400">
          <div>
            Latitude: <span className="font-mono text-zinc-200">{lat.toFixed(4)}</span>
          </div>
          <div>
            Longitude: <span className="font-mono text-zinc-200">{lng.toFixed(4)}</span>
          </div>
          {calc && (
            <div className="mt-1 font-semibold text-blue-400">
              Distance: {calc.distanceKm.toLocaleString()} km {calc.bearing} of home
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ---------------------------------------------------------------------------
// DynamicStatSpan Component
// ---------------------------------------------------------------------------
function DynamicStatSpan({
  placeholderKey,
  data,
}: {
  placeholderKey: string;
  data?: { value: string; rawVal: any; metadata?: any } | null;
}) {
  if (!data) {
    return <span className="font-mono text-xs text-zinc-500">Loading...</span>;
  }

  const metadata = data.metadata;

  return (
    <Popover>
      <PopoverTrigger>
        <span className="wikios-stat-span cursor-pointer border-b border-dotted border-white/40 font-semibold text-zinc-200 transition-all select-none hover:border-white/90 hover:text-white">
          {data.value}
        </span>
      </PopoverTrigger>
      <PopoverContent className="z-[10001] flex w-60 flex-col gap-3 rounded-2xl border border-white/10 bg-zinc-950/90 p-4 shadow-2xl backdrop-blur-xl">
        <div className="text-[10px] font-bold tracking-wider text-zinc-500 uppercase">
          Simulation Metrics
        </div>

        <div className="flex flex-col text-left">
          <span className="text-xs font-medium text-zinc-400">{metadata?.label || "Value"}</span>
          <span className="mt-0.5 text-xl leading-tight font-bold text-white">{data.value}</span>
          {metadata?.comparisonRank && (
            <span className="mt-1 text-[10px] font-semibold text-blue-400">
              {metadata.comparisonRank}
            </span>
          )}
        </div>

        <div className="flex flex-col gap-1 border-t border-white/5 pt-2.5 text-[10px] text-zinc-400">
          {metadata?.countryName && (
            <div className="flex justify-between">
              <span>Country</span>
              <span className="font-medium text-zinc-200">{metadata.countryName}</span>
            </div>
          )}
          {metadata?.companyName && (
            <div className="flex justify-between">
              <span>Enterprise</span>
              <span className="font-medium text-zinc-200">{metadata.companyName}</span>
            </div>
          )}
          {metadata?.lastCalculated && (
            <div className="flex justify-between">
              <span>Updated</span>
              <span className="font-mono text-zinc-200">
                {new Date(metadata.lastCalculated).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>
          )}
        </div>

        {metadata?.detailsUrl && (
          <Link
            href={withBasePath(metadata.detailsUrl)}
            className="border-t border-white/5 pt-2 text-center text-[10px] font-bold text-blue-400 transition-colors hover:text-blue-300"
          >
            Analyze Dashboard &rarr;
          </Link>
        )}
      </PopoverContent>
    </Popover>
  );
}

// ---------------------------------------------------------------------------
// CategoriesBar
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
              href={withBasePath(`/wiki/Category:${encodeURIComponent(cat.replace(/ /g, "_"))}`)}
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
