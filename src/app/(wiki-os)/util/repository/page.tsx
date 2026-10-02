"use client";
// src/app/(wiki-os)/wiki/repository/page.tsx
// WikiOS Commons Explorer — category browsing, full-text search, stash integration.

import { useState, useCallback, useRef, useEffect, useMemo, useDeferredValue } from "react";
import { SegmentedControl } from "~/components/ui/segmented-control";
import { WikiOSLayout } from "~/components/wiki-os/shared/WikiOSLayout";
import { CommonsCategoryBrowser } from "~/components/wiki-os/commons/CommonsCategoryBrowser";
import { CommonsResultsGrid } from "~/components/wiki-os/commons/CommonsResultsGrid";
import { CommonsDetailPanel } from "~/components/wiki-os/commons/CommonsDetailPanel";
import { usePageTitle } from "~/hooks/usePageTitle";
import { api } from "~/trpc/react";
import { Xmark as X, Globe, Database, HelpCircle, Folder, Sparks as Sparkles } from "iconoir-react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "~/components/ui/sheet";
import { cn } from "~/lib/utils";
import { withBasePath } from "~/lib/base-path";
import { RepositoryWelcomeModal } from "~/components/wiki-os/commons/RepositoryWelcomeModal";
import { SearchField } from "~/components/ui/search-field";

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

  const localIsBrowseMode = tab === "wiki" && !debouncedQuery && !!browsingCategory;

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

  const currentWikiSource = tab === "commons" ? "commons" : wikiSubSource;

  return (
    <WikiOSLayout>
      <div className="wikios-commons-browser">
        {/* Header bar */}
        <div className="wikios-commons-header flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="wikios-commons-header-left flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Open Welcome Guide"
              onClick={() => setWelcomeOpen(true)}
              title="Open Welcome Guide"
              className="text-label-secondary hover:text-tint rounded-full"
            >
              <HelpCircle className="h-4 w-4" />
            </Button>
            <SegmentedControl
              asTabs
              aria-label="Repository sources"
              size="sm"
              value={tab}
              onValueChange={handleTabChange}
              options={[
                { value: "commons", label: "Commons", icon: <Globe aria-hidden="true" /> },
                { value: "wiki", label: "Wiki", icon: <Database aria-hidden="true" /> },
              ]}
            />

            {/* Apple Scope Toggle: IxWiki vs IIWiki */}
            {tab === "wiki" && (
              <SegmentedControl
                aria-label="Wiki source selection"
                size="sm"
                value={wikiSubSource}
                onValueChange={handleWikiSubSourceChange}
                options={[
                  { value: "ixwiki", label: "IxWiki" },
                  { value: "iiwiki", label: "IIWiki" },
                ]}
              />
            )}

            {/* Mobile Category Sheet Trigger */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setMobileCategoriesOpen(true)}
              className="text-footnote border-separator hover:bg-fill-3 flex h-8 items-center gap-2 px-3 active:scale-[0.98] lg:hidden"
              title="Browse Categories"
            >
              <Folder className="text-tint h-3.5 w-3.5" />
              <span className="text-caption">Categories</span>
            </Button>
          </div>

          <SearchField
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            onClear={() => setAllImages([])}
            placeholder={
              tab === "commons"
                ? 'Search Commons... e.g. "medieval castle", "15th century portrait"'
                : `Search ${wikiSubSource === "iiwiki" ? "IIWiki" : "IxWiki"} files... e.g. "map", "flag"`
            }
            aria-label="Search files"
            containerClassName="flex-1"
          />
        </div>

        {/* Filter controls */}
        <div className="border-separator text-footnote mb-3 flex flex-wrap items-center justify-between gap-4 border-b px-1 pb-3">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            {/* File Type Filter */}
            <div className="flex items-center gap-2">
              <span className="text-footnote text-label-secondary select-none">Type:</span>
              <SegmentedControl
                aria-label="Filter by file type"
                size="sm"
                value={fileTypeFilter}
                onValueChange={setFileTypeFilter}
                options={[
                  { value: "all", label: "All" },
                  { value: "jpg", label: "JPG" },
                  { value: "png", label: "PNG" },
                  { value: "svg", label: "SVG" },
                ]}
              />
            </div>

            {/* Orientation Filter */}
            <div className="flex items-center gap-2">
              <span className="text-footnote text-label-secondary select-none">Orientation:</span>
              <SegmentedControl
                aria-label="Filter by orientation"
                size="sm"
                value={orientationFilter}
                onValueChange={setOrientationFilter}
                options={[
                  { value: "all", label: "All" },
                  { value: "landscape", label: "Land" },
                  { value: "portrait", label: "Port" },
                  { value: "square", label: "Sq" },
                ]}
              />
            </div>
          </div>

          {/* Clear filters trigger */}
          {isFilterActive && (
            <Button
              variant="link"
              size="sm"
              onClick={handleClearFilters}
              className="text-label-secondary h-auto px-0"
            >
              Clear Filters
            </Button>
          )}
        </div>

        {/* Starter Category Exploration Chips when cold start */}
        {tab === "commons" && !isSearchMode && !browsingCategory && (
          <div className="mb-3 flex flex-wrap items-center gap-2 px-1 py-1">
            <span className="text-eyebrow text-label-secondary mr-1 flex items-center gap-1">
              <Sparkles className="text-yellow h-3 w-3" />
              Quick Explore:
            </span>
            {STARTER_CATEGORIES.map((cat) => (
              <Button
                variant="outline"
                size="sm"
                key={cat.category}
                onClick={() => handleBrowseCategory(cat.category)}
                className="text-label-secondary hover:text-tint rounded-full"
              >
                {cat.label}
              </Button>
            ))}
          </div>
        )}

        {/* Active category chips */}
        {tab === "commons" && activeCategories.length > 0 && (
          <div className="wikios-commons-chips">
            {activeCategories.map((cat) => (
              <Button
                variant="secondary"
                size="sm"
                aria-label={`Remove ${cat}`}
                key={cat}
                onClick={() => handleToggleCategory(cat)}
                className="rounded-full"
              >
                {cat}
                <X className="h-3 w-3" />
              </Button>
            ))}
          </div>
        )}

        {/* Browsing category label */}
        {browsingCategory && !isSearchMode && (
          <div className="wikios-commons-chips">
            <Badge variant="default" className="gap-1 py-0 pr-0.5">
              Browsing: {browsingCategory}
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Stop browsing category"
                onClick={() => {
                  setBrowsingCategory(null);
                  setAllImages([]);
                }}
                className="size-5 rounded-full"
              >
                <X className="h-3 w-3" />
              </Button>
            </Badge>
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
        <SheetContent side="left" className="bg-surface w-[300px] p-0 sm:w-[360px]">
          <SheetHeader className="border-separator border-b p-4">
            <SheetTitle className="text-headline flex items-center gap-2">
              <Folder className="text-tint h-4 w-4" />
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
