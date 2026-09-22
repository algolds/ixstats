"use client";
// src/app/(wiki-os)/wiki/repository/page.tsx
// WikiOS Commons Explorer — category browsing, full-text search, stash integration.

import { useState, useCallback, useRef, useEffect, useMemo, useDeferredValue } from "react";
import { WikiOSLayout } from "~/components/wiki-os/shared/WikiOSLayout";
import { CommonsCategoryBrowser } from "~/components/wiki-os/commons/CommonsCategoryBrowser";
import { CommonsResultsGrid } from "~/components/wiki-os/commons/CommonsResultsGrid";
import { CommonsDetailPanel } from "~/components/wiki-os/commons/CommonsDetailPanel";
import { usePageTitle } from "~/hooks/usePageTitle";
import { api } from "~/trpc/react";
import {
  Search,
  Xmark as X,
  Globe,
  Database,
  HelpCircle,
  Folder,
  Sparks as Sparkles,
} from "iconoir-react";
import { Button } from "~/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "~/components/ui/sheet";
import { cn } from "~/lib/utils";
import { withBasePath } from "~/lib/base-path";
import { RepositoryWelcomeModal } from "~/components/wiki-os/commons/RepositoryWelcomeModal";

interface CommonsImage {
  pageid: number;
  title: string;
  thumbUrl: string;
  url: string;
  descriptionUrl: string;
  width: number;
  height: number;
  mime: string;
  description: string;
  artist: string;
  license: string;
}

type Tab = "commons" | "wiki";
type WikiSubSource = "ixwiki" | "iiwiki";

const STARTER_CATEGORIES = [
  { label: "Historical Maps", category: "Historical maps" },
  { label: "Coats of Arms", category: "Coats of arms by country" },
  { label: "Royal Residences", category: "Royal residences by country" },
  { label: "Castles", category: "Castles by country" },
  { label: "Military Flags", category: "Military flags" },
  { label: "Portrait Paintings", category: "Portrait paintings" },
];

function getImageType(mime: string, title: string): "jpg" | "png" | "svg" | "other" {
  const m = (mime || "").toLowerCase();
  const t = (title || "").toLowerCase();
  if (m.includes("jpeg") || m.includes("jpg") || t.endsWith(".jpg") || t.endsWith(".jpeg"))
    return "jpg";
  if (m.includes("png") || t.endsWith(".png")) return "png";
  if (m.includes("svg") || t.endsWith(".svg")) return "svg";
  return "other";
}

function getImageOrientation(width: number, height: number): "landscape" | "portrait" | "square" {
  if (!width || !height) return "landscape";
  const ratio = width / height;
  if (ratio > 1.1) return "landscape";
  if (ratio < 0.9) return "portrait";
  return "square";
}

function dedupeImages(existing: CommonsImage[], incoming: CommonsImage[]): CommonsImage[] {
  const seen = new Set(existing.map((img) => img.pageid));
  const newOnes = incoming.filter((img) => !seen.has(img.pageid));
  return [...existing, ...newOnes];
}

export default function RepositoryPage() {
  usePageTitle({ title: "Image Repository" });

  const [tab, setTab] = useState<Tab>("commons");
  const [wikiSubSource, setWikiSubSource] = useState<WikiSubSource>("ixwiki");
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [activeCategories, setActiveCategories] = useState<string[]>([]);
  const [browsingCategory, setBrowsingCategory] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<CommonsImage | null>(null);
  const [allImages, setAllImages] = useState<CommonsImage[]>([]);
  const [searchOffset, setSearchOffset] = useState(0);
  const [catOffset, setCatOffset] = useState(0);
  const [mobileCategoriesOpen, setMobileCategoriesOpen] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const lastMergedSearchDataRef = useRef<unknown>(null);
  const lastMergedCatDataRef = useRef<unknown>(null);

  const handleTabChange = useCallback((newTab: Tab) => {
    setTab(newTab);
    setSearchQuery("");
    setDebouncedQuery("");
    setAllImages([]);
    setSearchOffset(0);
    setCatOffset(0);
    setBrowsingCategory(null);
    setSelectedImage(null);
    setActiveCategories([]);
    lastMergedSearchDataRef.current = null;
    lastMergedCatDataRef.current = null;
  }, []);

  const handleWikiSubSourceChange = useCallback((sub: WikiSubSource) => {
    setWikiSubSource(sub);
    setAllImages([]);
    setSearchOffset(0);
    setCatOffset(0);
    setBrowsingCategory(null);
    setSelectedImage(null);
    setActiveCategories([]);
    lastMergedSearchDataRef.current = null;
    lastMergedCatDataRef.current = null;
  }, []);

  // Filters state
  const [fileTypeFilter, setFileTypeFilter] = useState<"all" | "jpg" | "png" | "svg">("all");
  const [orientationFilter, setOrientationFilter] = useState<
    "all" | "landscape" | "portrait" | "square"
  >("all");
  const [welcomeOpen, setWelcomeOpen] = useState(false);

  const deferredFileTypeFilter = useDeferredValue(fileTypeFilter);
  const deferredOrientationFilter = useDeferredValue(orientationFilter);

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    []
  );

  const handleSearch = useCallback((val: string) => {
    setSearchQuery(val);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setDebouncedQuery(val);
      setAllImages([]);
      setSearchOffset(0);
      setBrowsingCategory(null);
      lastMergedSearchDataRef.current = null;
      lastMergedCatDataRef.current = null;
    }, 300);
  }, []);

  // Build the effective search query with category filters
  const effectiveQuery = useMemo(() => {
    const parts = activeCategories.map((c) => `deepcat:"${c}"`);
    if (debouncedQuery) parts.push(debouncedQuery);
    return parts.join(" ");
  }, [activeCategories, debouncedQuery]);

  const isSearchMode = effectiveQuery.length >= 2;
  const isBrowseMode = !isSearchMode && !!browsingCategory;

  // Search query
  const { data: searchData, isFetching: searchFetching } = api.commons.search.useQuery(
    { query: effectiveQuery, limit: 40, offset: searchOffset },
    { enabled: tab === "commons" && isSearchMode, staleTime: 60_000 }
  );

  // Category browsing query (uses deepcat: for recursive results)
  const { data: catData, isFetching: catFetching } = api.commons.getCategoryFiles.useQuery(
    { category: browsingCategory ?? "", limit: 40, offset: catOffset },
    { enabled: tab === "commons" && isBrowseMode, staleTime: 60_000 }
  );

  const localIsBrowseMode =
    tab === "wiki" && !debouncedQuery && !!browsingCategory;

  // Search local or external wiki files query
  const { data: wikiFileData, isFetching: wikiFileFetching } = api.wikios.searchFiles.useQuery(
    {
      query: debouncedQuery || undefined,
      category: localIsBrowseMode ? (browsingCategory ?? undefined) : undefined,
      limit: 50,
      wiki: wikiSubSource,
    },
    {
      enabled: tab === "wiki",
      staleTime: 60_000,
    }
  );

  // Merge incoming search data cleanly with deduplication
  useEffect(() => {
    if (tab === "commons" && isSearchMode && searchData?.images) {
      if (lastMergedSearchDataRef.current === searchData) return;
      lastMergedSearchDataRef.current = searchData;

      setAllImages((prev) => {
        if (searchOffset === 0) {
          return searchData.images;
        }
        return dedupeImages(prev, searchData.images);
      });
    }
  }, [searchData, searchOffset, isSearchMode, tab]);

  // Merge incoming category browsing data cleanly with deduplication
  useEffect(() => {
    if (tab === "commons" && isBrowseMode && catData?.images) {
      if (lastMergedCatDataRef.current === catData) return;
      lastMergedCatDataRef.current = catData;

      setAllImages((prev) => {
        if (catOffset === 0) {
          return catData.images;
        }
        return dedupeImages(prev, catData.images);
      });
    }
  }, [catData, catOffset, isBrowseMode, tab]);

  // Map and set ixwiki/iiwiki images
  useEffect(() => {
    if (tab === "wiki") {
      if (debouncedQuery.length < 2 && !localIsBrowseMode) {
        setAllImages([]);
        return;
      }
      if (wikiFileData) {
        const isIiwiki = wikiSubSource === "iiwiki";
        const offset = isIiwiki ? 2000000 : 1000000;
        const mapped = wikiFileData.map(
          (
            img: {
              name: string;
              size: number;
              width: number;
              height: number;
              mime?: string;
              url?: string;
            },
            index: number
          ) => {
            const rawUrl = img.url || "";
            const proxiedUrl = rawUrl.includes("iiwiki.com/")
              ? withBasePath(
                  rawUrl.replace(/^https?:\/\/(www\.)?iiwiki\.com\//, "/api/mediawiki/iiwiki/")
                )
              : rawUrl.includes("ixwiki.com/")
                ? withBasePath(
                    rawUrl.replace(/^https?:\/\/(www\.)?ixwiki\.com\//, "/api/mediawiki/ixwiki/")
                  )
                : rawUrl;

            return {
              pageid: index + offset,
              title: img.name.startsWith("File:") ? img.name : `File:${img.name}`,
              thumbUrl: proxiedUrl,
              url: proxiedUrl,
              descriptionUrl: isIiwiki
                ? `https://iiwiki.com/wiki/File:${encodeURIComponent(img.name)}`
                : `https://ixwiki.com/wiki/File:${encodeURIComponent(img.name)}`,
              width: img.width || 0,
              height: img.height || 0,
              mime: img.mime || "image/png",
              description: isIiwiki
                ? `External upload on IIWiki. Size: ${(img.size / 1024).toFixed(1)} KB`
                : `Local upload on IxWiki. Size: ${(img.size / 1024).toFixed(1)} KB`,
              artist: isIiwiki ? "IIWiki Contributor" : "IxWiki Contributor",
              license: "CC BY-SA 3.0",
            };
          }
        );
        setAllImages(mapped);
      }
    }
  }, [tab, debouncedQuery, localIsBrowseMode, wikiFileData, wikiSubSource]);

  const handleLoadMore = useCallback(() => {
    if (tab === "commons") {
      if (isSearchMode && searchData?.nextOffset != null) {
        setSearchOffset(searchData.nextOffset);
      } else if (isBrowseMode && catData?.nextOffset != null) {
        setCatOffset(catData.nextOffset);
      }
    }
  }, [tab, isSearchMode, isBrowseMode, searchData?.nextOffset, catData?.nextOffset]);

  const hasMore =
    tab === "commons"
      ? isSearchMode
        ? searchData?.nextOffset != null
        : isBrowseMode
          ? catData?.nextOffset != null
          : false
      : false;

  const handleToggleCategory = useCallback((cat: string) => {
    setActiveCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    );
    setAllImages([]);
    setSearchOffset(0);
    lastMergedSearchDataRef.current = null;
  }, []);

  const handleBrowseCategory = useCallback((cat: string) => {
    setBrowsingCategory(cat);
    setCatOffset(0);
    setAllImages([]);
    setDebouncedQuery("");
    setSearchQuery("");
    setMobileCategoriesOpen(false);
    lastMergedCatDataRef.current = null;
  }, []);

  const isFilterActive = fileTypeFilter !== "all" || orientationFilter !== "all";
  const handleClearFilters = useCallback(() => {
    setFileTypeFilter("all");
    setOrientationFilter("all");
  }, []);

  // Client-side dynamic filtering of results
  const filteredImages = useMemo(() => {
    return allImages.filter((img) => {
      if (deferredFileTypeFilter !== "all") {
        const type = getImageType(img.mime ?? "", img.title);
        if (type !== deferredFileTypeFilter) return false;
      }
      if (deferredOrientationFilter !== "all") {
        const orient = getImageOrientation(img.width, img.height);
        if (orient !== deferredOrientationFilter) return false;
      }
      return true;
    });
  }, [allImages, deferredFileTypeFilter, deferredOrientationFilter]);

  const currentWikiSource =
    tab === "commons" ? "commons" : wikiSubSource;

  return (
    <WikiOSLayout>
      <div className="wikios-commons-browser">
        {/* Header bar */}
        <div className="wikios-commons-header flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="wikios-commons-header-left flex items-center gap-2">
            <button
              onClick={() => setWelcomeOpen(true)}
              className="cursor-pointer rounded-full p-1 text-[var(--wikios-text-dim)] transition-colors hover:bg-white/5 hover:text-blue-500 active:scale-95"
              title="Open Welcome Guide"
              type="button"
            >
              <HelpCircle className="h-4 w-4" />
            </button>
            <div
              role="tablist"
              aria-label="Repository sources"
              className="inline-flex items-center gap-1 p-1 rounded-lg bg-muted/60 border border-border/40 backdrop-blur-md"
            >
              <button
                role="tab"
                type="button"
                aria-selected={tab === "commons"}
                onClick={() => handleTabChange("commons")}
                className={cn(
                  "px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-1.5 transition-all duration-150 active:scale-[0.97] select-none cursor-pointer",
                  tab === "commons"
                    ? "bg-background text-foreground font-semibold shadow-xs border border-border/50"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
                )}
              >
                <Globe className="h-3.5 w-3.5 shrink-0" />
                <span>Commons</span>
              </button>
              <button
                role="tab"
                type="button"
                aria-selected={tab === "wiki"}
                onClick={() => handleTabChange("wiki")}
                className={cn(
                  "px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-1.5 transition-all duration-150 active:scale-[0.97] select-none cursor-pointer",
                  tab === "wiki"
                    ? "bg-background text-foreground font-semibold shadow-xs border border-border/50"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
                )}
              >
                <Database className="h-3.5 w-3.5 shrink-0" />
                <span>Wiki</span>
              </button>
            </div>

            {/* Apple Scope Toggle: IxWiki vs IIWiki */}
            {tab === "wiki" && (
              <div
                role="radiogroup"
                aria-label="Wiki source selection"
                className="inline-flex items-center gap-0.5 p-0.5 rounded-md bg-muted/60 border border-border/40 backdrop-blur-sm animate-in fade-in zoom-in-95 duration-150"
              >
                <button
                  type="button"
                  role="radio"
                  aria-checked={wikiSubSource === "ixwiki"}
                  onClick={() => handleWikiSubSourceChange("ixwiki")}
                  className={cn(
                    "px-2.5 py-1 rounded text-xs font-medium transition-all duration-150 active:scale-[0.97] cursor-pointer select-none",
                    wikiSubSource === "ixwiki"
                      ? "bg-background text-foreground font-semibold shadow-2xs border border-border/50"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
                  )}
                >
                  IxWiki
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={wikiSubSource === "iiwiki"}
                  onClick={() => handleWikiSubSourceChange("iiwiki")}
                  className={cn(
                    "px-2.5 py-1 rounded text-xs font-medium transition-all duration-150 active:scale-[0.97] cursor-pointer select-none",
                    wikiSubSource === "iiwiki"
                      ? "bg-background text-foreground font-semibold shadow-2xs border border-border/50"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
                  )}
                >
                  IIWiki
                </button>
              </div>
            )}

            {/* Mobile Category Sheet Trigger */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setMobileCategoriesOpen(true)}
              className="lg:hidden flex items-center gap-1.5 h-8 px-2.5 text-xs border-border/40 hover:bg-muted/40 active:scale-95"
              title="Browse Categories"
            >
              <Folder className="h-3.5 w-3.5 text-primary" />
              <span className="text-xs font-medium">Categories</span>
            </Button>
          </div>

          <div className="flex flex-1 items-center gap-2 rounded-lg border border-border/40 bg-muted/40 px-3 py-1.5 focus-within:border-border transition-colors">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder={
                tab === "commons"
                  ? 'Search Commons... e.g. "medieval castle", "15th century portrait"'
                  : `Search ${wikiSubSource === "iiwiki" ? "IIWiki" : "IxWiki"} files... e.g. "map", "flag"`
              }
              className="flex-1 bg-transparent border-none outline-none text-xs text-foreground placeholder:text-muted-foreground"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  handleSearch("");
                  setAllImages([]);
                }}
                className="p-0.5 text-muted-foreground hover:text-foreground hover:bg-muted/60 rounded-full active:scale-95 transition-all cursor-pointer"
                title="Clear search"
                aria-label="Clear search"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Filter controls */}
        <div className="mb-3 flex flex-wrap items-center justify-between gap-4 border-b border-border/30 px-1 pb-3 text-xs">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            {/* File Type Filter */}
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase select-none">
                Type:
              </span>
              <div
                role="radiogroup"
                aria-label="Filter by file type"
                className="inline-flex items-center gap-0.5 p-0.5 rounded-md bg-muted/60 border border-border/40 backdrop-blur-sm"
              >
                {(["all", "jpg", "png", "svg"] as const).map((type) => (
                  <button
                    key={type}
                    type="button"
                    role="radio"
                    aria-checked={fileTypeFilter === type}
                    onClick={() => setFileTypeFilter(type)}
                    className={cn(
                      "rounded px-2 py-0.5 text-[10px] font-medium transition-all duration-150 active:scale-[0.97] select-none cursor-pointer uppercase",
                      fileTypeFilter === type
                        ? "bg-background text-foreground font-semibold shadow-2xs border border-border/50"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
                    )}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>

            {/* Orientation Filter */}
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase select-none">
                Orientation:
              </span>
              <div
                role="radiogroup"
                aria-label="Filter by orientation"
                className="inline-flex items-center gap-0.5 p-0.5 rounded-md bg-muted/60 border border-border/40 backdrop-blur-sm"
              >
                {(["all", "landscape", "portrait", "square"] as const).map((orient) => (
                  <button
                    key={orient}
                    type="button"
                    role="radio"
                    aria-checked={orientationFilter === orient}
                    onClick={() => setOrientationFilter(orient)}
                    className={cn(
                      "rounded px-2 py-0.5 text-[10px] font-medium transition-all duration-150 active:scale-[0.97] select-none cursor-pointer",
                      orientationFilter === orient
                        ? "bg-background text-foreground font-semibold shadow-2xs border border-border/50"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
                    )}
                  >
                    {orient === "landscape"
                      ? "Land"
                      : orient === "portrait"
                        ? "Port"
                        : orient === "square"
                          ? "Sq"
                          : "All"}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Clear filters trigger */}
          {isFilterActive && (
            <button
              type="button"
              onClick={handleClearFilters}
              className="cursor-pointer text-[11px] font-medium text-muted-foreground hover:text-foreground active:scale-[0.97] transition-all underline underline-offset-2"
            >
              Clear Filters
            </button>
          )}
        </div>

        {/* Starter Category Exploration Chips when cold start */}
        {tab === "commons" && !isSearchMode && !browsingCategory && (
          <div className="mb-3 flex flex-wrap items-center gap-1.5 px-1 py-1">
            <span className="flex items-center gap-1 text-[10px] font-semibold tracking-wider text-[var(--wikios-text-dim)] uppercase mr-1">
              <Sparkles className="h-3 w-3 text-amber-400" />
              Quick Explore:
            </span>
            {STARTER_CATEGORIES.map((cat) => (
              <button
                key={cat.category}
                onClick={() => handleBrowseCategory(cat.category)}
                className="inline-flex items-center rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[10px] font-medium text-[var(--wikios-text-muted)] hover:border-blue-500/30 hover:bg-blue-500/10 hover:text-blue-400 active:scale-95 transition-all"
              >
                {cat.label}
              </button>
            ))}
          </div>
        )}

        {/* Active category chips */}
        {tab === "commons" && activeCategories.length > 0 && (
          <div className="wikios-commons-chips">
            {activeCategories.map((cat) => (
              <button
                key={cat}
                onClick={() => handleToggleCategory(cat)}
                className="wikios-commons-chip active:scale-95 transition-transform"
              >
                {cat}
                <X className="h-3 w-3" />
              </button>
            ))}
          </div>
        )}

        {/* Browsing category label */}
        {browsingCategory && !isSearchMode && (
          <div className="wikios-commons-chips">
            <span className="wikios-commons-chip wikios-commons-chip--browse">
              Browsing: {browsingCategory}
              <button
                onClick={() => {
                  setBrowsingCategory(null);
                  setAllImages([]);
                }}
                className="active:scale-90 transition-transform"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          </div>
        )}

        {/* Main panels */}
        <div
          className={cn("wikios-commons-panels", selectedImage && "wikios-commons-panels--detail")}
        >
          {/* Desktop Category Browser Sidebar */}
          <div className="hidden lg:block">
            <CommonsCategoryBrowser
              activeCategories={activeCategories}
              browsingCategory={browsingCategory}
              onToggleCategory={handleToggleCategory}
              onBrowseCategory={handleBrowseCategory}
              wiki={currentWikiSource}
            />
          </div>

          <CommonsResultsGrid
            images={filteredImages}
            selectedImage={selectedImage}
            onSelect={setSelectedImage}
            onLoadMore={handleLoadMore}
            hasMore={hasMore}
            isLoading={tab === "commons" ? searchFetching || catFetching : wikiFileFetching}
            totalHits={tab === "commons" ? searchData?.totalHits : wikiFileData?.length}
            isFilterActive={isFilterActive}
            onClearFilters={handleClearFilters}
          />

          {selectedImage && (
            <CommonsDetailPanel image={selectedImage} onClose={() => setSelectedImage(null)} />
          )}
        </div>
      </div>

      {/* Mobile Category Sheet */}
      <Sheet open={mobileCategoriesOpen} onOpenChange={setMobileCategoriesOpen}>
        <SheetContent side="left" className="w-[300px] p-0 sm:w-[360px] bg-[var(--wikios-surface)]">
          <SheetHeader className="p-4 border-b border-[var(--wikios-border)]">
            <SheetTitle className="text-sm font-semibold flex items-center gap-2">
              <Folder className="h-4 w-4 text-blue-400" />
              Browse Categories
            </SheetTitle>
          </SheetHeader>
          <div className="h-[calc(100vh-64px)] overflow-y-auto">
            <CommonsCategoryBrowser
              activeCategories={activeCategories}
              browsingCategory={browsingCategory}
              onToggleCategory={handleToggleCategory}
              onBrowseCategory={handleBrowseCategory}
              wiki={currentWikiSource}
            />
          </div>
        </SheetContent>
      </Sheet>

      <RepositoryWelcomeModal open={welcomeOpen} onOpenChangeAction={setWelcomeOpen} />
    </WikiOSLayout>
  );
}
