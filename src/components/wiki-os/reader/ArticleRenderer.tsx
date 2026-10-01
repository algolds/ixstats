"use client";
// src/components/wiki-os/reader/ArticleRenderer.tsx
// Renders pre-transformed WikiOS article data in reader mode.
// Composes modular ArticleHeader, ArticleCategories, ArticleFooter, ArticleModals, and ArticlePlaceholders.

import React, { useRef, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import dynamic from "next/dynamic";
import { addSectionEditLinks, type TocEntry } from "~/lib/wiki-os/transformers/html-transformer";
import { AppleBooksTocDrawer } from "~/components/wiki-os/reader/AppleBooksTocDrawer";
import { StickyToc } from "~/components/wiki-os/reader/StickyToc";
import { useWikiSetting } from "~/components/wiki-os/shared/useWikiSetting";
import { InfoboxWithMap } from "~/components/wiki-os/reader/InfoboxWithMap";
import { useImageLightbox } from "~/components/wiki-os/reader/ImageLightbox";
import { useWikiContext } from "~/components/wiki-os/shared/WikiContext";
import { useAnnotationOverlay } from "~/components/wiki-os/reader/AnnotationOverlay";
import { useCiteTooltips } from "~/components/wiki-os/reader/useCiteTooltips";
import { useWikiNarrator } from "~/hooks/useWikiNarrator";
import { api } from "~/trpc/react";
import { useWikiAuth } from "~/lib/wiki-os/use-wiki-auth";
import { getFlagColors } from "~/lib/flags/flag-color-extractor";
import { safeDecodeURI } from "~/lib/wiki-os/transformers/safe-decode";
import { EMBED_CSS, EMBED_JS, EMBED_PREFETCH } from "~/lib/wiki-os/editor/wiki-embed-shared";
import { parseWikiSource } from "~/lib/wiki-os/config";

// Subcomponent imports
import { WikiOSHeader, type ArticleAuthorInfo } from "./ArticleHeader";
import { QuickHistoryModal, QuickBacklinksModal } from "./ArticleModals";
import {
  injectPlaceholderElements,
  CoordsPill,
  DynamicStatSpan,
  type DynamicStatData,
} from "./ArticlePlaceholders";
import { CategoriesBar } from "./ArticleCategories";
import { ArticleFooter } from "./ArticleFooter";
import { ArticleCompanionHUD } from "./ArticleCompanionHUD";
import { SourceWikiNote } from "./SourceWikiNote";
import { cn } from "~/lib/utils";
import { withBasePath } from "~/lib/base-path";
import { soundCues } from "~/lib/sound/cuelume";
import { NavArrowRight as ChevronRight, NavArrowLeft as ChevronLeft } from "iconoir-react";
import { useNotify } from "~/hooks/useNotify";
import { extractLeadImageFromHtml } from "~/lib/wiki-os/transformers/image-url";
import {
  WikiMarginDrawer,
  MarginGutterPins,
  SelectionCapsule,
  MarginShareModal,
  type SelectionPayload,
} from "~/components/wiki-os/margin";

const CoordinatesMapEmbed = dynamic(
  () =>
    import("~/components/maps/widgets/CoordinatesMapEmbed").then((m) => ({
      default: m.CoordinatesMapEmbed,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="wikios-ixworld-loading rounded-row border-separator bg-fill-4 flex min-h-[200px] items-center justify-center border">
        <div
          className="wikios-loading-spinner mr-2 animate-spin"
          style={{ width: 20, height: 20 }}
        />
        <span className="text-footnote text-label-secondary">Loading map...</span>
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
  authorInfo?: ArticleAuthorInfo | null;
}

// oxlint-disable-next-line eslint/no-unused-vars
const WIKI_SOURCE_LABELS: Record<string, { label: string; url: string }> = {
  iiwiki: { label: "iiwiki.com", url: "https://iiwiki.com/wiki/" },
  althistory: { label: "althistory.fandom.com", url: "https://althistory.fandom.com/wiki/" },
};

const EMPTY_STATS_DATA: Record<string, DynamicStatData> = {};

type PortalTarget =
  | {
      element: Element;
      type: "coords";
      data: { lat: number; lng: number; zoom: number; label: string };
    }
  | {
      element: Element;
      type: "map-embed";
      data: { lat: number; lng: number; zoom: number; options: string };
    }
  | {
      element: Element;
      type: "stat";
      data: { key: string };
    };

/** A plain article title that may name a country: not empty, not the Main Page, no namespace. */
function mayNameCountry(title: string): boolean {
  return (
    title.trim() !== "" && title !== "Main Page" && title !== "Main_Page" && !title.includes(":")
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
  authorInfo,
}: ArticleRendererProps) {
  const titleRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const {
    setWikiPage,
    activeModal,
    setActiveModal,
    setActiveSectionId,
    isMarginOpen,
    setIsMarginOpen: setMarginOpen,
    marginTab,
    setMarginTab,
    toggleMargin,
  } = useWikiContext();
  const { isSignedIn } = useWikiAuth();
  const isAuthenticated = isSignedIn;
  // Another wiki's page (ruling E-l) is read-only here: no section edits, no margin, no IxWiki history.
  const source = parseWikiSource(wikiSource);
  const readOnly = source !== "ixwiki";
  const marginOpen = isMarginOpen && !readOnly;
  const marginEnabled = !!title && !readOnly;
  const [tocOpen, setTocOpen] = useState(false);
  // oxlint-disable-next-line eslint/no-unused-vars
  const showWikiToc = useWikiSetting("wikios:showWikiToc", true);
  const [companionCollapsed, setCompanionCollapsed] = useState(false);

  // Persist companion collapsed preference (xl only)
  useEffect(() => {
    try {
      const v = localStorage.getItem("wikios:companionCollapsed");
      if (v === "true") setCompanionCollapsed(true);
    } catch {
      /* ignore */
    }
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem("wikios:companionCollapsed", String(companionCollapsed));
    } catch {
      /* ignore */
    }
  }, [companionCollapsed]);

  // --- WikiOS Margin Suite State ---
  const [marginExpanded, setMarginExpanded] = useState(false);
  const [activeAnchor, setActiveAnchor] = useState<string | null>(null);
  const [draftQuote, setDraftQuote] = useState<string | null>(null);
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [selectedAnnotationId, setSelectedAnnotationId] = useState<string | null>(null);
  const utils = api.useUtils();

  const slug = useMemo(() => encodeURIComponent(title.replace(/ /g, "_")), [title]);

  // Query discussions for Gutter Pins & counts
  // oxlint-disable-next-line eslint/no-unused-vars
  const { data: marginData, refetch: refetchMargin } = api.wikios.getArticleMarginData.useQuery(
    { articleTitle: title, status: "ALL" },
    { enabled: marginEnabled, staleTime: 15_000 }
  );

  // Sync activeModal from Toolbar/Sidebar triggers
  useEffect(() => {
    if (activeModal === "margin") {
      setMarginOpen(true);
      setActiveModal(null);
    }
  }, [activeModal, setActiveModal, setMarginOpen]);

  // Global hotkey listener: 'T' or 'I' toggles Margin
  useEffect(() => {
    if (readOnly) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)
      ) {
        return;
      }
      if (
        (e.key === "t" || e.key === "T" || e.key === "i" || e.key === "I") &&
        !e.metaKey &&
        !e.ctrlKey &&
        !e.altKey
      ) {
        e.preventDefault();
        toggleMargin();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [toggleMargin, readOnly]);

  // Selection Capsule Handlers & Live Sync
  const notify = useNotify();

  const { data: annotationsData, refetch: refetchAnnotations } = api.wikios.getAnnotations.useQuery(
    { pageTitle: title },
    { enabled: marginEnabled && isAuthenticated, staleTime: 15_000 }
  );

  const addAnnotationMutation = api.wikios.addAnnotation.useMutation({
    onSuccess: () => {
      soundCues?.success?.();
      void utils.wikios.getAnnotations.invalidate({ pageTitle: title });
      void utils.wikios.getStashItems.invalidate();
      void utils.wikios.getStashes.invalidate();
      void refetchAnnotations();
    },
    onError: (err: { message?: string }) => {
      notify.error(err.message || "Failed to add highlight");
    },
  });

  const stashPageMutation = api.wikios.stashPage.useMutation({
    onSuccess: () => {
      void utils.wikios.isStashed.invalidate({ pageTitle: title });
      void utils.wikios.getStashes.invalidate();
      void utils.wikios.getStashItems.invalidate();
    },
    onError: (err: { message?: string }) => {
      notify.error(err.message || "Failed to stash page");
    },
  });

  const handleAddHighlight = (payload: SelectionPayload, color: string) => {
    addAnnotationMutation.mutate(
      {
        pageTitle: title,
        selectedText: payload.text,
        color,
      },
      {
        onSuccess: () => {
          notify.success("Highlight saved to Margin Markup");
        },
      }
    );
  };

  const handleOpenThreadDraft = (payload: SelectionPayload) => {
    setActiveAnchor(null);
    setDraftQuote(payload.text);
    setMarginTab("threads");
    setMarginOpen(true);
  };

  const handleStashQuote = (payload: SelectionPayload) => {
    addAnnotationMutation.mutate(
      {
        pageTitle: title,
        selectedText: payload.text,
        comment: "Saved quote",
        color: "#f472b6",
      },
      {
        onSuccess: () => {
          notify.success("Quote saved to Stash & Margin");
          stashPageMutation.mutate({ pageTitle: title });
        },
      }
    );
  };

  const [sharePayload, setSharePayload] = useState<SelectionPayload | null>(null);

  const handleSuggestEdit = (payload: SelectionPayload) => {
    setActiveAnchor(null);
    setDraftQuote(payload.text);
    setMarginTab("threads");
    setMarginOpen(true);
  };

  const handleShareQuote = (payload: SelectionPayload) => {
    setSharePayload(payload);
  };

  // --- Portal & Dynamic Widgets Setup ---
  const statKeys = useMemo(() => {
    const keys = new Set<string>();
    const regex = /\{\{((?:MyCountry|CountryData|BusinessData):[^}\n]+?)\}\}/gi;
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

  const statsQuery = api.wikios.resolveWikiPlaceholders.useQuery(
    { placeholders: statKeys },
    { enabled: statKeys.length > 0, staleTime: 5 * 60 * 1000 }
  );
  const statsData = statsQuery.data || EMPTY_STATS_DATA;

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

  // Inject shared embed CSS + JS
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
      // The embed iframes load /maps, which lives under the app's base path.
      script.textContent = EMBED_JS.replace(
        `'${EMBED_PREFETCH}'`,
        JSON.stringify(withBasePath(EMBED_PREFETCH))
      );
      // The CSP carries a per-request nonce, so an inline script only runs if it carries it too.
      const nonce = document.querySelector<HTMLScriptElement>("script[nonce]")?.nonce;
      if (nonce) script.nonce = nonce;
      document.head.appendChild(script);
    }
    if (!document.getElementById("ixstats-embed-prefetch")) {
      const link = document.createElement("link");
      link.id = "ixstats-embed-prefetch";
      link.rel = "prefetch";
      link.href = withBasePath(EMBED_PREFETCH);
      link.setAttribute("as", "document");
      document.head.appendChild(link);
    }
  }, []);

  const processedHtml = useMemo(() => {
    const html = injectPlaceholderElements(contentHtml);
    return isAuthenticated && !readOnly ? addSectionEditLinks(html, slug) : html;
  }, [contentHtml, isAuthenticated, readOnly, slug]);
  const processedInfoboxHtml = useMemo(
    () => (infoboxHtml ? injectPlaceholderElements(infoboxHtml) : null),
    [infoboxHtml]
  );

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
    // oxlint-disable-next-line
  }, [processedHtml, processedInfoboxHtml]);

  const { data: countryData } = api.countries.getByIdBasic.useQuery(
    { id: title },
    { enabled: mayNameCountry(title), retry: false }
  );

  const themeColors = useMemo(() => {
    if (countryData?.name) {
      return getFlagColors(countryData.name);
    }

    let hue = 217;
    const catStr = categories.join(" ").toLowerCase();
    if (
      catStr.includes("history") ||
      catStr.includes("politics") ||
      catStr.includes("executive") ||
      catStr.includes("government")
    ) {
      hue = 38;
    } else if (
      catStr.includes("military") ||
      catStr.includes("war") ||
      catStr.includes("conflict") ||
      catStr.includes("defense")
    ) {
      hue = 0;
    } else if (
      catStr.includes("diplomacy") ||
      catStr.includes("geography") ||
      catStr.includes("relation")
    ) {
      hue = 188;
    } else if (catStr.includes("file") || catStr.includes("media") || catStr.includes("image")) {
      hue = 142;
    } else if (catStr.includes("talk") || catStr.includes("discussion")) {
      hue = 262;
    } else if (title.startsWith("File:")) {
      hue = 142;
    } else if (title.startsWith("Talk:")) {
      hue = 262;
    }

    return {
      primary: `hsl(${hue}, 80%, 45%)`,
      secondary: `hsl(${hue}, 60%, 60%)`,
      accent: `hsl(${hue}, 80%, 45%)`,
      rgbPrimary: { r: 59, g: 130, b: 246 },
    };
  }, [countryData, categories, title]);

  useEffect(() => {
    setWikiPage(title, toc, themeColors, source);
    return () => setWikiPage(null, [], null);
  }, [title, toc, themeColors, source, setWikiPage]);

  // Scroll spy — single owner now in WikiArticleRightRail; this keeps WikiContext activeSectionId in sync
  useEffect(() => {
    if (toc.length === 0) return;
    function tick() {
      const ids = toc.map((e) => e.id);
      let current: string | null = null;
      for (const id of ids) {
        const el = document.getElementById(id);
        if (el) {
          const rect = el.getBoundingClientRect();
          if (rect.top <= 120) current = id;
        }
      }
      setActiveSectionId(current);
    }
    window.addEventListener("scroll", tick, { passive: true });
    tick();
    return () => {
      window.removeEventListener("scroll", tick);
      setActiveSectionId(null);
    };
  }, [toc, setActiveSectionId]);

  // Navbox collapse toggle
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
    // oxlint-disable-next-line
  }, [contentHtml]);

  const lightboxPortal = useImageLightbox(contentRef);

  const _stashQuery = api.wikios.isStashed.useQuery(
    { pageTitle: title },
    { enabled: isAuthenticated, retry: false }
  );

  useAnnotationOverlay({
    contentRef,
    annotations: (annotationsData as any) || [],
    selectedAnnotationId,
    onSelectAnnotation: (id) => {
      setSelectedAnnotationId(id);
      setSelectedThreadId(null);
      setMarginTab("markup");
      setMarginOpen(true);
    },
  });

  const citeTooltipPortal = useCiteTooltips(contentRef);

  const awardsQuery = api.lorewards.getArticleAwardsAndAchievements.useQuery(
    { title },
    { staleTime: 300000 }
  );
  const awardsData = awardsQuery.data;

  const featuredImageUrl = useMemo(() => {
    return extractLeadImageFromHtml(infoboxHtml) ?? extractLeadImageFromHtml(contentHtml);
  }, [infoboxHtml, contentHtml]);

  const containerStyle = {
    "--wikios-accent": themeColors.primary,
    "--wikios-accent-hover": themeColors.secondary,
    "--wikios-accent-bg": getRgbaColor(themeColors.primary, 0.08),
    "--wikios-link": themeColors.primary,
    "--wikios-link-hover": themeColors.secondary,
  } as React.CSSProperties;

  const narrator = useWikiNarrator(contentRef);

  return (
    <div
      ref={titleRef}
      className={cn(
        "wikios-article wikios-reader-container relative flex items-start justify-center gap-8 transition-[margin-right,padding-right] duration-350 ease-[cubic-bezier(0.32,0.72,0,1)] 2xl:gap-10",
        marginOpen && (marginExpanded ? "lg:mr-[400px]" : "lg:mr-80")
      )}
      style={containerStyle}
    >
      <div ref={titleRef} className="wikios-title-sentinel" />

      {/* Main Reading Vessel — expands when companion is collapsed */}
      <div
        className={cn(
          "wikios-reading-vessel w-full min-w-0 flex-1 transition-[max-width] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]",
          companionCollapsed ? "max-w-[1160px]" : "max-w-[1024px]"
        )}
      >
        {/* Redesigned Custom WikiOSHeader */}
        <WikiOSHeader
          title={title}
          lastModified={lastModified}
          wikiSource={wikiSource}
          countryData={countryData}
          featuredImageUrl={featuredImageUrl}
          themeColors={themeColors}
          authorInfo={authorInfo}
          awardsData={awardsData}
          tocLength={toc.length}
          onTocClick={() => setTocOpen(true)}
        />
        <SourceWikiNote title={title} wikiSource={source} />

        {/* Mobile Byline Strip (< XL screens where right Intel HUD is hidden) */}
        {(() => {
          const creator = authorInfo?.creator;
          const creatorName =
            typeof creator === "object"
              ? (creator as any)?.username
              : creator || (authorInfo as any)?.author || null;

          if (!creatorName && !lastModified) return null;

          return (
            <div className="text-label-secondary text-footnote mt-2.5 mb-3 flex flex-wrap items-center gap-x-2.5 gap-y-1 px-1 xl:hidden">
              {creatorName && (
                <span className="text-label font-medium">
                  By <span className="font-semibold">{creatorName}</span>
                </span>
              )}
              {lastModified && (
                <>
                  {creatorName && <span className="text-label-secondary select-none">•</span>}
                  <span>
                    {new Date(lastModified).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </span>
                </>
              )}
            </div>
          );
        })()}

        {/* Page-top notices (WIP, stub, hatnotes) */}
        {noticesHtml && (
          <div className="wikios-notices" dangerouslySetInnerHTML={{ __html: noticesHtml }} />
        )}

        {/* Content layout */}
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
          <ArticleFooter title={title} lastModified={lastModified} wikiSource={source} />

          {/* Margin Suite: Gutter Pins aligned to article text */}
          {!readOnly && (
            <MarginGutterPins
              contentRef={contentRef}
              threads={(marginData?.threads as any) || []}
              annotations={(annotationsData as any) || []}
              themeColors={themeColors}
              isMarginOpen={marginOpen}
              onSelectAnchor={(anchor, id, tab) => {
                setActiveAnchor(anchor);
                if (tab === "markup") {
                  setSelectedAnnotationId(id || null);
                  setSelectedThreadId(null);
                } else {
                  setSelectedThreadId(id || null);
                  setSelectedAnnotationId(null);
                }
                setMarginTab(tab || "threads");
              }}
              onOpenDrawer={() => setMarginOpen(true)}
            />
          )}
        </div>
      </div>

      {/* Right static panel — Vector 2022 / Notion pattern: companion pinned, only TOC scrolls */}
      {!marginOpen && !companionCollapsed && (
        <aside
          className="animate-in fade-in border-separator sticky top-(--shell-top-offset) hidden max-h-[calc(100vh-6rem)] w-[240px] shrink-0 flex-col gap-3 self-start border-l pr-1 pl-3 duration-200 xl:flex 2xl:w-[280px]"
          aria-label="Article companion and table of contents"
        >
          <button
            type="button"
            onPointerDown={(e) => {
              // §1 Response — kill latency: active feedback on pointer-down, not click
              (e.currentTarget as HTMLButtonElement).style.transform = "scale(0.96)";
            }}
            onPointerUp={(e) => {
              (e.currentTarget as HTMLButtonElement).style.transform = "";
            }}
            onPointerLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.transform = "";
            }}
            onClick={() => {
              setCompanionCollapsed(true);
            }}
            className="text-label-secondary hover:text-label border-separator bg-fill-4 text-caption hover:border-separator hover:bg-fill-4 -mb-1 hidden cursor-pointer items-center justify-center gap-1 self-end rounded-full border px-2 py-1 transition-[color,background-color,border-color,box-shadow,opacity,transform] duration-150 select-none active:scale-[0.98] xl:flex"
            title="Hide companion"
            aria-label="Hide companion"
          >
            <span>Hide</span>
            <ChevronRight className="h-3 w-3" />
          </button>
          <ArticleCompanionHUD
            title={title}
            slug={slug}
            contentHtml={contentHtml}
            lastModified={lastModified}
            authorInfo={authorInfo}
            categories={categories}
            awardsData={awardsData}
            marginThreadsCount={(marginData?.threads as any)?.length ?? 0}
            marginAnnotationsCount={(annotationsData as any)?.length ?? 0}
            onOpenMargin={(tab) => {
              setMarginTab(tab || "threads");
              setMarginOpen(true);
            }}
            onOpenHistory={() => setActiveModal("history")}
            onOpenBacklinks={() => setActiveModal("backlinks")}
            narrator={narrator}
            isAuthenticated={isAuthenticated}
            isCollapsed={false}
            readOnly={readOnly}
          />
          {toc.length > 0 && (
            <div className="-mr-1 min-h-0 flex-1 scrollbar-thin overflow-y-auto [mask-image:linear-gradient(to_bottom,transparent,black_8px,black_calc(100%-8px),transparent)] pr-1">
              <StickyToc entries={toc} contentRef={contentRef} isCollapsed={false} />
            </div>
          )}
        </aside>
      )}
      {/* Companion collapsed — edge handle on the same border-l line (spatial consistency §7, hint §8) */}
      {!marginOpen && companionCollapsed && (
        <button
          type="button"
          onClick={() => {
            setCompanionCollapsed(false);
          }}
          className="text-label-secondary hover:text-label border-separator hover:border-separator hover:bg-fill-4 sticky top-(--shell-top-offset) hidden h-[calc(100vh-6rem)] w-8 shrink-0 cursor-pointer items-start justify-center self-start border-l pt-8 transition-colors duration-150 select-none xl:flex"
          title="Show companion"
          aria-label="Show companion"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
        </button>
      )}

      {/* Apple Books Style TOC Drawer (Modal Sheet) */}
      <AppleBooksTocDrawer
        isOpen={tocOpen}
        onClose={() => setTocOpen(false)}
        entries={toc}
        themeColors={themeColors}
      />

      {lightboxPortal}
      {citeTooltipPortal}

      {/* Quick action modals */}
      {activeModal === "history" && (
        <QuickHistoryModal title={title} slug={slug} onClose={() => setActiveModal(null)} />
      )}
      {activeModal === "backlinks" && (
        <QuickBacklinksModal title={title} slug={slug} onClose={() => setActiveModal(null)} />
      )}

      {!readOnly && (
        <>
          <SelectionCapsule
            contentRef={contentRef}
            isAuthenticated={isAuthenticated}
            onAddHighlight={handleAddHighlight}
            onOpenThreadDraft={handleOpenThreadDraft}
            onSuggestEdit={handleSuggestEdit}
            onStashQuote={handleStashQuote}
            onShareQuote={handleShareQuote}
          />

          <WikiMarginDrawer
            isOpen={marginOpen}
            onClose={() => setMarginOpen(false)}
            articleTitle={title}
            initialTab={marginTab}
            activeAnchor={activeAnchor}
            draftQuote={draftQuote}
            onClearDraftQuote={() => setDraftQuote(null)}
            selectedThreadId={selectedThreadId}
            onSelectThread={setSelectedThreadId}
            selectedAnnotationId={selectedAnnotationId}
            onSelectAnnotation={setSelectedAnnotationId}
            contentRef={contentRef}
            isAuthenticated={isAuthenticated}
            themeColors={themeColors}
            onExpandedChange={setMarginExpanded}
          />

          {/* Share Modal Dialog */}
          {sharePayload && (
            <MarginShareModal
              isOpen={!!sharePayload}
              onClose={() => setSharePayload(null)}
              articleTitle={title}
              quoteText={sharePayload.text}
              isAuthenticated={isAuthenticated}
            />
          )}
        </>
      )}
    </div>
  );
}
