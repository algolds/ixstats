// src/components/wiki-os/reader/ArticleRenderer.tsx
// Renders pre-transformed WikiOS article data in reader mode.
// Composes modular ArticleHeader, ArticleCategories, ArticleFooter, ArticleModals, and ArticlePlaceholders.

"use client";

import React, { useRef, useEffect, useMemo, useState } from "react";
import { ExternalLink } from "lucide-react";
import { createPortal } from "react-dom";
import dynamic from "next/dynamic";
import type { TocEntry } from "~/lib/wiki-os/html-transformer";
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
import { safeDecodeURI } from "~/lib/wiki-os/safe-decode";
import { EMBED_CSS, EMBED_JS } from "~/lib/wiki-os/wiki-embed-shared";

// Subcomponent imports
import { WikiOSHeader } from "./ArticleHeader";
import { QuickHistoryModal, QuickBacklinksModal } from "./ArticleModals";
import {
  injectPlaceholderElements,
  CoordsPill,
  DynamicStatSpan,
} from "./ArticlePlaceholders";
import { CategoriesBar } from "./ArticleCategories";
import { ArticleFooter } from "./ArticleFooter";

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
  const _narrator = useWikiNarrator(contentRef);
  const { isSignedIn } = useWikiAuth();
  const isAuthenticated = isSignedIn;
  const [tocOpen, setTocOpen] = useState(false);
  const showWikiToc = useWikiSetting("wikios:showWikiToc", true);

  // --- Portal & Dynamic Widgets Setup ---
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

  const processedHtml = useMemo(() => injectPlaceholderElements(contentHtml), [contentHtml]);
  const processedInfoboxHtml = useMemo(
    () => (infoboxHtml ? injectPlaceholderElements(infoboxHtml) : null),
    [infoboxHtml]
  );

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
    setWikiPage(title, toc, themeColors);
    return () => setWikiPage(null, [], null);
  }, [title, toc, themeColors, setWikiPage]);

  // Scroll spy
  useEffect(() => {
    if (toc.length === 0) return;

    function tick() {
      const ids = toc.map((e) => e.id);
      let current: string | null = null;
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
  }, [contentHtml]);

  const lightboxPortal = useImageLightbox(contentRef);

  const stashQuery = api.wikios.isStashed.useQuery(
    { pageTitle: title },
    { enabled: isAuthenticated, retry: false }
  );
  const isStashed = stashQuery.data?.stashed ?? false;

  const { toolbarPortal, annotationPopover } = useAnnotationOverlay(
    contentRef,
    title,
    isAuthenticated,
    isStashed
  );

  const citeTooltipPortal = useCiteTooltips(contentRef);

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
