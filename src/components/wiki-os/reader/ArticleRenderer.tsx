"use client";
import React, { useRef, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  appendSectionEditLinks,
  removeSectionEditLinks,
  type TocEntry,
} from "~/lib/wiki-os/transformers/html-transformer";
import { StickyToc } from "~/components/wiki-os/reader/StickyToc";
import { Sheet, SheetContent, SheetTitle } from "~/components/ui/sheet";
import { useMediaQuery } from "~/hooks/useMediaQuery";
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
import { parseWikiSource } from "~/lib/wiki-os/config";
import { hexToRgb } from "~/lib/color";
import type { ArticleAuthorInfo } from "~/lib/wiki-os/types/canonical";

// Subcomponent imports
import { WikiOSHeader } from "./ArticleHeader";
import { normalizeAuthorInfo } from "./author-info";
import { QuickHistoryModal, QuickBacklinksModal } from "./ArticleModals";
import {
  injectPlaceholderElements,
  extractStatKeys,
  CoordsPill,
  DynamicStatSpan,
} from "./ArticlePlaceholders";
import { useStatValues } from "./useStatValues";
import { useHydrated } from "./useHydrated";
import { useScrollSpy } from "./useScrollSpy";
import { leanElementId, parseLeanMarker, resolveLeanHtml } from "~/lib/wiki-os/lean-article";
import { CategoriesBar } from "./ArticleCategories";
import { ArticleFooter } from "./ArticleFooter";
import { ArticleCompanionHUD } from "./ArticleCompanionHUD";
import { Button } from "~/components/ui/button";
import { NavArrowLeft, NavArrowRight } from "iconoir-react";
import { SourceWikiNote } from "./SourceWikiNote";
import { useEmbedAssets } from "./useEmbedAssets";
import {
  CoordinatesMapEmbed,
  MarginGutterPins,
  MarginShareModal,
  SelectionCapsule,
  WikiMarginDrawer,
} from "./article-lazy";
import { cn } from "~/lib/utils";
import { ARTICLE_STYLE_ROOT_CLASS } from "~/lib/utils/scope-template-styles";
import { soundCues } from "~/lib/sound/cuelume";
import { useNotify } from "~/hooks/useNotify";
import { extractLeadImage } from "~/lib/wiki-os/transformers/image-url";
import { useMountOnFirstOpen } from "~/components/wiki-os/shared/useMountOnFirstOpen";
import { heroCardInputs, mayNameCountry } from "~/lib/wiki-os/hero-card";
import type { SelectionPayload } from "~/components/wiki-os/margin/SelectionCapsule";

/** Accent hue by article category keywords (first match wins); otherwise decided by the title prefix. */
const HUE_RULES: ReadonlyArray<[hue: number, keywords: string[]]> = [
  [38, ["history", "politics", "executive", "government"]],
  [0, ["military", "war", "conflict", "defense"]],
  [188, ["diplomacy", "geography", "relation"]],
  [142, ["file", "media", "image"]],
  [262, ["talk", "discussion"]],
];

function getRgbaColor(colorStr: string, opacity: number): string {
  if (colorStr.startsWith("#")) {
    const { r, g, b } = hexToRgb(colorStr);
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
  /** Authorship the page already came with (another wiki's page); an IxWiki page loads its own. */
  authorInfo?: ArticleAuthorInfo | null;
}

const AUTHORS_STALE_MS = 10 * 60 * 1000;

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

export function ArticleRenderer({
  title,
  contentHtml: contentMarker,
  infoboxHtml: infoboxMarker,
  noticesHtml: noticesMarker,
  toc,
  categories,
  lastModified,
  wikiSource,
  authorInfo,
}: ArticleRendererProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  // In lean mode (lib/wiki-os/lean-article.ts) the three parts arrive as markers, and the real HTML is
  // read from where the server rendered it: the DOM in the browser, the server's stash in the SSR render.
  const leanToken = parseLeanMarker(contentMarker)?.token ?? null;
  const contentHtml = useMemo(() => resolveLeanHtml(contentMarker) ?? "", [contentMarker]);
  const infoboxHtml = useMemo(() => resolveLeanHtml(infoboxMarker), [infoboxMarker]);
  const noticesHtml = useMemo(() => resolveLeanHtml(noticesMarker), [noticesMarker]);
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
  // The Inspector sheet below 1280px, opened by the header's Contents button.
  const [tocOpen, setTocOpen] = useState(false);
  // The setting gates the whole Inspector: off, the page opts out of the gutter (ArticlePageClient).
  const showWikiToc = useWikiSetting("wikios:showWikiToc", true);
  const tocVisible = showWikiToc && toc.length > 0;
  // From 1280px the sidebar shows only the contents until the page info is opened (remembered
  // per browser).
  const wide = useMediaQuery("(min-width: 1280px)");
  const railCollapsed = useWikiSetting("wikios:railCollapsed", true);
  const asideShown = showWikiToc && !marginOpen;
  const toggleRail = () => {
    try {
      localStorage.setItem("wikios:railCollapsed", String(!railCollapsed));
    } catch {
      return;
    }
    window.dispatchEvent(new Event("wikios-settings-changed"));
  };

  const marginDrawerMounted = useMountOnFirstOpen(marginOpen);

  const [marginExpanded, setMarginExpanded] = useState(false);
  const [activeAnchor, setActiveAnchor] = useState<string | null>(null);
  const [draftQuote, setDraftQuote] = useState<string | null>(null);
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [selectedAnnotationId, setSelectedAnnotationId] = useState<string | null>(null);
  const utils = api.useUtils();

  const slug = useMemo(() => encodeURIComponent(title.replace(/ /g, "_")), [title]);

  // Authorship loads beside the article, never in front of it (it can take MediaWiki a moment).
  const authorsQuery = api.wikios.getArticleAuthors.useQuery(
    { title, wikiSource: source },
    { enabled: !authorInfo && !!title, staleTime: AUTHORS_STALE_MS, retry: false }
  );
  const authors = useMemo(
    () => normalizeAuthorInfo(authorInfo ?? authorsQuery.data),
    [authorInfo, authorsQuery.data]
  );

  // Query discussions for Gutter Pins & counts
  const { data: marginData } = api.wikios.getArticleMarginData.useQuery(
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

  // Both open the Margin threads tab with the selection quoted in a new-thread draft.
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

  // --- Portal & Dynamic Widgets Setup ---
  const statKeys = useMemo(
    () => extractStatKeys(infoboxHtml ? `${contentHtml}${infoboxHtml}` : contentHtml),
    [contentHtml, infoboxHtml]
  );

  const statsData = useStatValues(statKeys);

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

  useEmbedAssets(contentHtml, infoboxHtml);

  // The placeholder pass needs a DOM, so the server renders the article as it is. The browser's
  // hydrating pass must start from that same HTML (it does until `hydrated`), and the pass is applied
  // straight after: a mismatch would leave the server's HTML in place with no placeholders mounted.
  const hydrated = useHydrated();
  const processedHtml = useMemo(() => {
    if (!hydrated) return contentHtml;
    return injectPlaceholderElements(contentHtml);
  }, [hydrated, contentHtml]);

  // A signed-in reader's section edit links are added to the live article, in place: signing in
  // resolves after hydration, and the article's HTML is never written again for it. Signing out
  // takes them out the same way.
  const canEdit = isAuthenticated && !readOnly;
  useEffect(() => {
    const container = contentRef.current;
    if (!container) return;
    if (canEdit) appendSectionEditLinks(container, slug);
    else removeSectionEditLinks(container);
  }, [canEdit, slug, processedHtml]);
  // React writes a `dangerouslySetInnerHTML` element's HTML again whenever the prop is a new object,
  // even for the same string (React 19): built here once per HTML, so a re-render (a section change in
  // the scroll spy, a query settling) leaves the article's DOM, its images and its added links alone.
  const bodyMarkup = useMemo(() => ({ __html: processedHtml }), [processedHtml]);
  const noticesMarkup = useMemo(
    () => (noticesHtml ? { __html: noticesHtml } : null),
    [noticesHtml]
  );
  const processedInfoboxHtml = useMemo(() => {
    if (!infoboxHtml) return null;
    return hydrated ? injectPlaceholderElements(infoboxHtml) : infoboxHtml;
  }, [hydrated, infoboxHtml]);

  const [portalTargets, setPortalTargets] = useState<PortalTarget[]>([]);

  useEffect(() => {
    const container = contentRef.current;
    if (!container) return;

    const targets: PortalTarget[] = [];
    const mapAttrs = (el: Element) => ({
      lat: parseFloat(el.getAttribute("data-lat") || "0"),
      lng: parseFloat(el.getAttribute("data-lng") || "0"),
      zoom: parseInt(el.getAttribute("data-zoom") || "4", 10),
    });

    container.querySelectorAll(".wikios-coords-placeholder").forEach((element) => {
      const label = element.getAttribute("data-label") || "Location";
      targets.push({ element, type: "coords", data: { ...mapAttrs(element), label } });
    });
    container.querySelectorAll(".wikios-map-embed-placeholder").forEach((element) => {
      const options = element.getAttribute("data-options") || "";
      targets.push({ element, type: "map-embed", data: { ...mapAttrs(element), options } });
    });
    container.querySelectorAll(".wikios-stat-placeholder").forEach((element) => {
      targets.push({
        element,
        type: "stat",
        data: { key: element.getAttribute("data-key") || "" },
      });
    });

    setPortalTargets(targets);
    // oxlint-disable-next-line
  }, [processedHtml, processedInfoboxHtml]);

  const { data: countryData } = api.countries.getByIdBasic.useQuery(heroCardInputs(title).country, {
    enabled: mayNameCountry(title),
    retry: false,
  });

  const themeColors = useMemo(() => {
    if (countryData?.name) {
      return getFlagColors(countryData.name);
    }

    const catStr = categories.join(" ").toLowerCase();
    const rule = HUE_RULES.find(([, keywords]) => keywords.some((k) => catStr.includes(k)));
    const titleHue = title.startsWith("File:") ? 142 : title.startsWith("Talk:") ? 262 : 217;
    const hue = rule?.[0] ?? titleHue;

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

  // Scroll spy — keeps WikiContext activeSectionId in sync (offsets cached, one pass per frame)
  const tocIds = useMemo(() => toc.map((entry) => entry.id), [toc]);
  useScrollSpy(tocIds, setActiveSectionId);

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

  // Lorewards and article awards belong to IxWiki pages: another wiki's page asks for none.
  const awardsQuery = api.lorewards.getArticleAwardsAndAchievements.useQuery(
    heroCardInputs(title).awards,
    { staleTime: 300000, enabled: source === "ixwiki" }
  );
  const awardsData = awardsQuery.data;

  // The lead image and the size of its file (the hero reserves its shape from it, before it loads)
  const featuredImage = useMemo(
    () => extractLeadImage(infoboxHtml) ?? extractLeadImage(contentHtml),
    [infoboxHtml, contentHtml]
  );
  const featuredImageUrl = featuredImage?.url ?? null;
  const featuredImageFile = useMemo(
    () =>
      featuredImage ? { width: featuredImage.fileWidth, height: featuredImage.fileHeight } : null,
    [featuredImage]
  );

  const containerStyle = {
    "--wikios-accent": themeColors.primary,
    "--wikios-accent-hover": themeColors.secondary,
    "--wikios-accent-bg": getRgbaColor(themeColors.primary, 0.08),
    "--wikios-link": themeColors.primary,
    "--wikios-link-hover": themeColors.secondary,
  } as React.CSSProperties;

  const narrator = useWikiNarrator(contentRef);

  const companion = (
    <ArticleCompanionHUD
      contentHtml={contentHtml}
      lastModified={lastModified}
      authorInfo={authors}
      authorsPending={!authorInfo && authorsQuery.isLoading}
      categories={categories}
      awardsData={awardsData}
      marginThreadsCount={(marginData?.totalOpenCount ?? 0) + (marginData?.totalResolvedCount ?? 0)}
      marginAnnotationsCount={(annotationsData as any)?.length ?? 0}
      onOpenMargin={(tab) => {
        setMarginTab(tab || "threads");
        setMarginOpen(true);
        setTocOpen(false);
      }}
      onOpenHistory={() => {
        setActiveModal("history");
        setTocOpen(false);
      }}
      onOpenBacklinks={() => {
        setActiveModal("backlinks");
        setTocOpen(false);
      }}
      narrator={narrator}
      readOnly={readOnly}
    />
  );

  return (
    <div
      className={cn(
        "wikios-article wikios-reader-container relative flex items-start justify-between transition-[margin-right,padding-right] duration-350 ease-[cubic-bezier(0.32,0.72,0,1)]",
        marginOpen && (marginExpanded ? "lg:mr-[400px]" : "lg:mr-80")
      )}
      style={containerStyle}
    >
      {/* Reading vessel: the header spans it, the body is centred at the reading width (layout.css) */}
      <div className="wikios-reading-vessel w-full min-w-0 flex-1">
        {/* Redesigned Custom WikiOSHeader */}
        <WikiOSHeader
          title={title}
          lastModified={lastModified}
          wikiSource={wikiSource}
          countryData={countryData}
          featuredImageUrl={featuredImageUrl}
          featuredImageFile={featuredImageFile}
          themeColors={themeColors}
          authorInfo={authors}
          awardsData={awardsData}
          tocLength={tocVisible ? toc.length : 0}
          onTocClick={showWikiToc ? () => setTocOpen(true) : undefined}
        />
        <SourceWikiNote title={title} wikiSource={source} />

        {/* Mobile Byline Strip (< XL screens where right Intel HUD is hidden) */}
        {(() => {
          const creatorName = authors?.creator ?? null;

          if (!creatorName && !lastModified) return null;

          return (
            <div className="text-label-secondary text-footnote mt-2 mb-3 flex flex-wrap items-center gap-x-2 gap-y-1 px-1 xl:hidden">
              {creatorName && (
                <span className="text-label font-medium">
                  By <span className="font-semibold">{creatorName}</span>
                </span>
              )}
              {lastModified && (
                <>
                  {creatorName && <span className="text-label-secondary select-none">•</span>}
                  <span>
                    {new Date(lastModified).toLocaleDateString("en-US", {
                      timeZone: "UTC",
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
        {noticesMarkup && (
          <div
            id={leanToken ? leanElementId(leanToken, "notices") : undefined}
            className={`wikios-notices ${ARTICLE_STYLE_ROOT_CLASS}`}
            dangerouslySetInnerHTML={noticesMarkup}
          />
        )}

        {/* Content layout */}
        <div className="wikios-article-main" ref={contentRef}>
          <div className="wikios-article-body wikios-article-content">
            {processedInfoboxHtml && (
              <InfoboxWithMap
                infoboxHtml={processedInfoboxHtml}
                articleTitle={title}
                markupId={leanToken ? leanElementId(leanToken, "infobox") : undefined}
              />
            )}
            <div
              id={leanToken ? leanElementId(leanToken, "body") : undefined}
              className={ARTICLE_STYLE_ROOT_CLASS}
              dangerouslySetInnerHTML={bodyMarkup}
            />
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

      {/* Contents and page info: a sticky aside in the article row from 1280px, a sheet below.
          Hiding the sidebar folds the page info away and keeps the contents inline in the row. Out
          of the margin drawer's way: while that is open the aside steps aside and the header's
          Contents button opens the sheet. It is in the server HTML (CSS shows it from xl, so it
          never pops in); after hydration only while wide, so the sheet is the one copy below xl. */}
      {asideShown && (wide || !hydrated) && (
        <aside
          aria-label="Contents"
          data-slot="wiki-contents-aside"
          className={cn(
            "sticky top-(--shell-top-offset) ml-8 hidden max-h-[calc(100vh-var(--shell-top-offset))] w-60 shrink-0 flex-col gap-3 self-start overflow-y-auto border-l pr-1 pb-6 pl-3 xl:flex 2xl:w-70",
            railCollapsed ? "border-transparent" : "border-separator"
          )}
        >
          <Button
            variant="ghost"
            size="xs"
            className="text-label-secondary self-end"
            aria-expanded={!railCollapsed}
            onClick={toggleRail}
          >
            {railCollapsed && <NavArrowLeft aria-hidden />}
            {railCollapsed ? "Page info" : "Hide"}
            {!railCollapsed && <NavArrowRight aria-hidden />}
          </Button>
          {tocVisible && <StickyToc entries={toc} contentRef={contentRef} />}
          {!railCollapsed && companion}
        </aside>
      )}
      {showWikiToc && !(wide && asideShown) && (
        <Sheet open={tocOpen} onOpenChange={setTocOpen}>
          <SheetContent>
            <SheetTitle>Contents</SheetTitle>
            <div className="flex flex-col gap-4">
              {tocVisible && (
                <StickyToc
                  entries={toc}
                  contentRef={contentRef}
                  onNavigate={() => setTocOpen(false)}
                />
              )}
              {companion}
            </div>
          </SheetContent>
        </Sheet>
      )}

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
            onSuggestEdit={handleOpenThreadDraft}
            onStashQuote={handleStashQuote}
            onShareQuote={setSharePayload}
          />

          {marginDrawerMounted && (
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
          )}

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
