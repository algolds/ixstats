"use client";

import { Suspense, useState, useCallback, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useUser } from "~/context/auth-context";
import { SegmentedControl } from "~/components/ui/segmented-control";
import { WikiOSLayout } from "~/components/wiki-os/shared/WikiOSLayout";
import { CommonsCategoryBrowser } from "~/components/wiki-os/commons/CommonsCategoryBrowser";
import { CommonsResultsGrid } from "~/components/wiki-os/commons/CommonsResultsGrid";
import { CommonsDetailPanel } from "~/components/wiki-os/commons/CommonsDetailPanel";
import { usePageTitle } from "~/hooks/usePageTitle";
import { useDebounce } from "~/hooks/useDebounce";
import { useMediaQuery } from "~/hooks/useMediaQuery";
import { Xmark as X, Globe, Database, HelpCircle, Folder, Upload } from "iconoir-react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "~/components/ui/sheet";
import { cn } from "~/lib/utils";
import { RepositoryWelcomeModal } from "~/components/wiki-os/commons/RepositoryWelcomeModal";
import { SearchField } from "~/components/ui/search-field";
import {
  imageFromUrl,
  matchesImageFilters,
  type CommonsImage,
  type ImageOrientationFilter,
  type ImageTypeFilter,
  type WikiSubSource,
} from "~/components/wiki-os/media-search/types";
import { useRepositoryImages } from "~/components/wiki-os/media-search/useRepositoryImages";

type Tab = "commons" | "wiki";
type UrlSource = "commons" | WikiSubSource;

const URL_SOURCES: readonly UrlSource[] = ["commons", "ixwiki", "iiwiki", "forum", "mine"];
const URL_TYPES: readonly ImageTypeFilter[] = ["all", "jpg", "png", "svg"];
const URL_ORIENTATIONS: readonly ImageOrientationFilter[] = [
  "all",
  "landscape",
  "portrait",
  "square",
];

/** Query-string values that mean "not set": left out of the URL. */
const URL_DEFAULTS: Record<string, string> = { src: "commons", type: "all", orient: "all" };

function oneOf<T extends string>(allowed: readonly T[], value: string | null, fallback: T): T {
  return allowed.find((option) => option === value) ?? fallback;
}

/** What a shared link holds, read from a query string (unknown values fall back to the defaults). */
function readUrl(search: string) {
  const params = new URLSearchParams(search);
  return {
    source: oneOf(URL_SOURCES, params.get("src"), "commons"),
    query: params.get("q") ?? "",
    category: params.get("cat"),
    fileType: oneOf(URL_TYPES, params.get("type"), "all"),
    orientation: oneOf(URL_ORIENTATIONS, params.get("orient"), "all"),
    file: params.get("file"),
  };
}

/**
 * Puts `patch` into the address bar with the history API, which Next keeps in step with `useSearchParams` without a
 * server round trip. A null or default value is left out, so shared links stay short.
 */
function writeUrl(patch: Record<string, string | null>, how: "replace" | "push" = "replace") {
  const params = new URLSearchParams(window.location.search);
  for (const [key, value] of Object.entries(patch)) {
    if (value === null || value === "" || value === URL_DEFAULTS[key]) params.delete(key);
    else params.set(key, value);
  }
  const qs = params.toString();
  const url = `${window.location.pathname}${qs ? `?${qs}` : ""}`;
  if (url === `${window.location.pathname}${window.location.search}`) return;
  if (how === "push") window.history.pushState(null, "", url);
  else window.history.replaceState(null, "", url);
}

/** Forum and own uploads are lists, not category trees. */
function isListSource(source: UrlSource): boolean {
  return source === "forum" || source === "mine";
}

const EMPTY_TEXT: Partial<Record<UrlSource, string>> = {
  forum: "No images have been imported from the old forum yet.",
  mine: "You have not uploaded any images yet.",
};

const SEARCH_PLACEHOLDERS: Record<UrlSource, string> = {
  commons: 'Search Commons... e.g. "medieval castle", "15th century portrait"',
  ixwiki: 'Search IxWiki files... e.g. "map", "flag"',
  iiwiki: 'Search IIWiki files... e.g. "map", "flag"',
  forum: "Search images from the old forum...",
  mine: "Search your uploads...",
};

const STARTER_CATEGORIES = [
  { label: "Historical Maps", category: "Historical maps" },
  { label: "Coats of Arms", category: "Coats of arms by country" },
  { label: "Royal Residences", category: "Royal residences by country" },
  { label: "Castles", category: "Castles by country" },
  { label: "Military Flags", category: "Military flags" },
  { label: "Portrait Paintings", category: "Portrait paintings" },
];

export default function RepositoryPage() {
  return (
    <Suspense fallback={null}>
      <RepositoryPageBody />
    </Suspense>
  );
}

function RepositoryPageBody() {
  usePageTitle({ title: "Image repository" });

  const searchParams = useSearchParams();
  const { user } = useUser();
  const signedIn = !!user;

  // The page's state starts from the URL (a shared link) and is written back to it as it changes
  const [initial] = useState(() => readUrl(searchParams.toString()));
  const [urlSource, setSource] = useState<UrlSource>(initial.source);
  const [searchQuery, setSearchQuery] = useState(initial.query);
  const [activeCategories, setActiveCategories] = useState<string[]>([]);
  const [browsingCategory, setBrowsingCategory] = useState<string | null>(initial.category);
  const [fileTypeFilter, setFileTypeFilter] = useState<ImageTypeFilter>(initial.fileType);
  const [orientationFilter, setOrientationFilter] = useState<ImageOrientationFilter>(
    initial.orientation
  );
  const [selectedImage, setSelectedImage] = useState<CommonsImage | null>(null);
  const [mobileCategoriesOpen, setMobileCategoriesOpen] = useState(false);
  // undefined: the guide opens itself the first time; true: the help button opened it
  const [welcomeOpen, setWelcomeOpen] = useState<boolean | undefined>(undefined);
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  // True while the open panel is a history entry this page pushed, so Back (not a new entry) closes it
  const pushedRef = useRef(false);
  // The file the URL names that is not on screen yet: a shared link, or Back to a file not loaded now
  const wantedFileRef = useRef(initial.file);

  const currentWikiSource: UrlSource = urlSource === "mine" && !signedIn ? "ixwiki" : urlSource;
  const tab: Tab = currentWikiSource === "commons" ? "commons" : "wiki";
  const wikiSubSource: WikiSubSource =
    currentWikiSource === "commons" ? "ixwiki" : currentWikiSource;

  // An emptied field searches nothing at once; the debounce only delays typing.
  const debouncedQuery = useDebounce(searchQuery, 300);
  const query = searchQuery.trim() === "" ? "" : debouncedQuery;

  // The settled search goes to the address bar
  useEffect(() => {
    writeUrl({ q: query.trim() });
  }, [query]);

  const results = useRepositoryImages({
    source: currentWikiSource,
    query,
    categories: activeCategories,
    browsingCategory: isListSource(currentWikiSource) ? null : browsingCategory,
    fileType: fileTypeFilter,
    enabled: true,
    signedIn,
  });

  const imagesRef = useRef(results.images);
  imagesRef.current = results.images;

  // Back and forward: take the state of the entry that is now showing
  useEffect(() => {
    const onPopState = () => {
      const url = readUrl(window.location.search);
      setSource(url.source);
      setSearchQuery(url.query);
      setBrowsingCategory(url.category);
      setFileTypeFilter(url.fileType);
      setOrientationFilter(url.orientation);
      const loaded = imagesRef.current.find((img) => img.url === url.file);
      wantedFileRef.current = url.file && !loaded ? url.file : null;
      if (!url.file) pushedRef.current = false;
      setSelectedImage(loaded ?? null);
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  // The wanted file opens once it has loaded. When the first page is in and the file is not on it (it sits on a
  // later page, or the sort order changed), the panel opens on a minimal image built from the url instead.
  useEffect(() => {
    const wanted = wantedFileRef.current;
    if (!wanted) return;
    const match = results.images.find((img) => img.url === wanted);
    if (!match && (results.isLoading || results.error)) return;
    wantedFileRef.current = null;
    setSelectedImage(match ?? imageFromUrl(wanted));
  }, [results.images, results.isLoading, results.error]);

  const handleSelectImage = useCallback((img: CommonsImage) => {
    wantedFileRef.current = null;
    setSelectedImage(img);
    if (new URLSearchParams(window.location.search).has("file")) {
      writeUrl({ file: img.url });
    } else {
      pushedRef.current = true;
      writeUrl({ file: img.url }, "push");
    }
  }, []);

  const handleCloseImage = useCallback(() => {
    wantedFileRef.current = null;
    setSelectedImage(null);
    if (pushedRef.current) {
      pushedRef.current = false;
      window.history.back();
    } else {
      writeUrl({ file: null });
    }
  }, []);

  const changeSource = useCallback((src: UrlSource) => {
    setSource(src);
    setSearchQuery("");
    setActiveCategories([]);
    setBrowsingCategory(null);
    setSelectedImage(null);
    wantedFileRef.current = null;
    pushedRef.current = false;
    writeUrl({ src, q: null, cat: null, file: null });
  }, []);

  const handleTabChange = useCallback(
    (newTab: Tab) => changeSource(newTab === "commons" ? "commons" : "ixwiki"),
    [changeSource]
  );

  const handleToggleCategory = useCallback((cat: string) => {
    setActiveCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    );
  }, []);

  const handleBrowseCategory = useCallback((cat: string) => {
    setBrowsingCategory(cat);
    setSearchQuery("");
    setMobileCategoriesOpen(false);
    writeUrl({ cat, q: null });
  }, []);

  const handleStopBrowsing = useCallback(() => {
    setBrowsingCategory(null);
    writeUrl({ cat: null });
  }, []);
  const handleFileTypeChange = useCallback((type: ImageTypeFilter) => {
    setFileTypeFilter(type);
    writeUrl({ type });
  }, []);
  const handleOrientationChange = useCallback((orient: ImageOrientationFilter) => {
    setOrientationFilter(orient);
    writeUrl({ orient });
  }, []);

  const isFilterActive = fileTypeFilter !== "all" || orientationFilter !== "all";
  const handleClearFilters = useCallback(() => {
    setFileTypeFilter("all");
    setOrientationFilter("all");
    writeUrl({ type: null, orient: null });
  }, []);

  // Orientation is judged here; the file type is part of the search itself
  const filteredImages = useMemo(
    () => results.images.filter((img) => matchesImageFilters(img, "all", orientationFilter)),
    [results.images, orientationFilter]
  );

  const listSource = currentWikiSource === "forum" || currentWikiSource === "mine";
  // The category tree belongs to Commons and the two wikis
  const browserWiki =
    currentWikiSource === "forum" || currentWikiSource === "mine" ? null : currentWikiSource;

  const categoryBrowser = browserWiki && (
    <CommonsCategoryBrowser
      activeCategories={activeCategories}
      browsingCategory={browsingCategory}
      onToggleCategory={tab === "commons" ? handleToggleCategory : undefined}
      onBrowseCategory={handleBrowseCategory}
      wiki={browserWiki}
    />
  );

  return (
    <WikiOSLayout>
      <div className="wikios-commons-browser">
        {/* Header bar */}
        <div className="wikios-commons-header flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="wikios-commons-header-left flex flex-wrap items-center gap-2">
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Open welcome guide"
              onClick={() => setWelcomeOpen(true)}
              title="Open welcome guide"
              className="text-label-secondary hover:text-tint rounded-full"
            >
              <HelpCircle className="h-4 w-4" aria-hidden="true" />
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

            {/* Scope toggle: IxWiki, IIWiki, the old forum, and (signed in) your own uploads */}
            {tab === "wiki" && (
              <SegmentedControl
                aria-label="Wiki source selection"
                size="sm"
                value={wikiSubSource}
                onValueChange={changeSource}
                options={[
                  { value: "ixwiki", label: "IxWiki" },
                  { value: "iiwiki", label: "IIWiki" },
                  { value: "forum", label: "Forum" },
                  ...(signedIn ? [{ value: "mine" as const, label: "My uploads" }] : []),
                ]}
              />
            )}

            {/* Mobile Category Sheet Trigger (the forum and your uploads have no categories) */}
            {!listSource && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setMobileCategoriesOpen(true)}
                aria-expanded={mobileCategoriesOpen}
                className="text-footnote border-separator hover:bg-fill-3 flex h-8 items-center gap-2 px-3 lg:hidden"
                title="Browse categories"
              >
                <Folder className="text-tint h-3.5 w-3.5" aria-hidden="true" />
                <span className="text-caption">Categories</span>
              </Button>
            )}
          </div>

          <SearchField
            value={searchQuery}
            onValueChange={setSearchQuery}
            placeholder={SEARCH_PLACEHOLDERS[currentWikiSource]}
            aria-label="Search files"
            containerClassName="flex-1"
          />

          <Button asChild size="sm" className="h-8 shrink-0 gap-1.5 px-3 text-xs">
            <Link href="/util/upload">
              <Upload className="h-3.5 w-3.5" aria-hidden="true" />
              Upload
            </Link>
          </Button>
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
                onValueChange={handleFileTypeChange}
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
                onValueChange={handleOrientationChange}
                options={[
                  { value: "all", label: "All" },
                  { value: "landscape", label: "Landscape" },
                  { value: "portrait", label: "Portrait" },
                  { value: "square", label: "Square" },
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
              Clear filters
            </Button>
          )}
        </div>

        {/* Starter Category Exploration Chips when cold start */}
        {tab === "commons" && results.mode === "idle" && (
          <div className="mb-3 flex flex-wrap items-center gap-2 px-1 py-1">
            <span className="text-footnote text-label-secondary mr-1">Try:</span>
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
                <X className="h-3 w-3" aria-hidden="true" />
              </Button>
            ))}
          </div>
        )}

        {/* Browsing category label */}
        {browsingCategory && !listSource && (
          <div className="wikios-commons-chips">
            <Badge variant="default" className="gap-1 py-0 pr-0.5">
              Browsing: {browsingCategory}
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Stop browsing category"
                onClick={handleStopBrowsing}
                className="size-5 rounded-full"
              >
                <X className="h-3 w-3" aria-hidden="true" />
              </Button>
            </Badge>
          </div>
        )}

        {/* Main panels */}
        <div
          className={cn("wikios-commons-panels", selectedImage && "wikios-commons-panels--detail")}
        >
          {/* Desktop Category Browser Sidebar (not mounted on phones, where the sheet has it) */}
          {isDesktop && <div>{categoryBrowser}</div>}

          <CommonsResultsGrid
            images={filteredImages}
            selectedImage={selectedImage}
            onSelect={handleSelectImage}
            onLoadMore={results.loadMore}
            hasMore={results.hasMore}
            isLoading={results.isLoading || results.isLoadingMore}
            mode={results.mode}
            query={query}
            loadedCount={results.images.length}
            emptyText={EMPTY_TEXT[currentWikiSource]}
            totalHits={results.totalHits}
            error={results.error}
            onRetry={results.retry}
            isFilterActive={isFilterActive}
            onClearFilters={handleClearFilters}
          />

          {selectedImage && <CommonsDetailPanel image={selectedImage} onClose={handleCloseImage} />}
        </div>
      </div>

      {/* Mobile Category Sheet */}
      <Sheet open={mobileCategoriesOpen} onOpenChange={setMobileCategoriesOpen}>
        <SheetContent side="left" className="bg-surface flex w-[300px] flex-col p-0 sm:w-[360px]">
          <SheetHeader className="border-separator border-b p-4">
            <SheetTitle className="text-headline flex items-center gap-2">
              <Folder className="text-tint h-4 w-4" aria-hidden="true" />
              Browse categories
            </SheetTitle>
          </SheetHeader>
          <div className="min-h-0 flex-1 overflow-y-auto">{!isDesktop && categoryBrowser}</div>
        </SheetContent>
      </Sheet>

      <RepositoryWelcomeModal
        open={welcomeOpen}
        onOpenChangeAction={(open) => setWelcomeOpen(open ? true : undefined)}
      />
    </WikiOSLayout>
  );
}
