"use client";

import { Suspense, useState, useCallback, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
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

/** The URL's params with `patch` applied: a null or default value is removed, so shared links stay short. */
function withParams(current: string, patch: Record<string, string | null>): string {
  const next = new URLSearchParams(current);
  for (const [key, value] of Object.entries(patch)) {
    if (value === null || value === "" || value === URL_DEFAULTS[key]) next.delete(key);
    else next.set(key, value);
  }
  return next.toString();
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

  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useUser();
  const signedIn = !!user;

  // The URL holds what a shared link needs: source, search, browsed category, filters, open file.
  const paramsString = searchParams.toString();
  // The params a write builds on: the URL's, or what this page has just written and the URL has not shown yet
  const paramsRef = useRef(paramsString);
  const seenParamsRef = useRef(paramsString);
  if (seenParamsRef.current !== paramsString) {
    seenParamsRef.current = paramsString;
    paramsRef.current = paramsString;
  }
  const urlSource = oneOf(URL_SOURCES, searchParams.get("src"), "commons");
  const currentWikiSource: UrlSource = urlSource === "mine" && !signedIn ? "ixwiki" : urlSource;
  const tab: Tab = currentWikiSource === "commons" ? "commons" : "wiki";
  const wikiSubSource: WikiSubSource =
    currentWikiSource === "commons" ? "ixwiki" : currentWikiSource;
  const browsingCategory = searchParams.get("cat");
  const fileTypeFilter = oneOf(URL_TYPES, searchParams.get("type"), "all");
  const orientationFilter = oneOf(URL_ORIENTATIONS, searchParams.get("orient"), "all");
  const fileParam = searchParams.get("file");
  const urlQuery = searchParams.get("q") ?? "";

  const [searchQuery, setSearchQuery] = useState(urlQuery);
  const [activeCategories, setActiveCategories] = useState<string[]>([]);
  const [selectedImage, setSelectedImage] = useState<CommonsImage | null>(null);
  const [mobileCategoriesOpen, setMobileCategoriesOpen] = useState(false);
  // undefined: the guide opens itself the first time; true: the help button opened it
  const [welcomeOpen, setWelcomeOpen] = useState<boolean | undefined>(undefined);
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  // True while the open panel is a history entry this page pushed, so Back (not a new entry) closes it
  const openedHereRef = useRef(false);

  // An emptied field searches nothing at once; the debounce only delays typing.
  const debouncedQuery = useDebounce(searchQuery, 300);
  const query = searchQuery.trim() === "" ? "" : debouncedQuery;

  const updateUrl = useCallback(
    (patch: Record<string, string | null>, how: "replace" | "push" = "replace") => {
      const next = withParams(paramsRef.current, patch);
      paramsRef.current = next;
      const href = next ? `?${next}` : "?";
      if (how === "push") router.push(href, { scroll: false });
      else router.replace(href, { scroll: false });
    },
    [router]
  );

  // The settled search goes to the URL. The URL echoes it back later, perhaps after the next keystroke, so searches
  // written but not yet echoed are remembered; any other change of `q` (Back, a link) comes back into the field.
  const writtenQueriesRef = useRef(new Set<string>());
  useEffect(() => {
    const settled = query.trim();
    if (settled !== (new URLSearchParams(paramsRef.current).get("q") ?? "")) {
      writtenQueriesRef.current.add(settled);
      updateUrl({ q: settled });
    }
  }, [query, updateUrl]);
  const settledQueryRef = useRef(query.trim());
  settledQueryRef.current = query.trim();
  useEffect(() => {
    if (urlQuery === settledQueryRef.current) {
      writtenQueriesRef.current.clear();
    } else if (!writtenQueriesRef.current.has(urlQuery)) {
      // oxlint-disable-next-line
      setSearchQuery(urlQuery);
    }
  }, [urlQuery]);

  const results = useRepositoryImages({
    source: currentWikiSource,
    query,
    categories: activeCategories,
    browsingCategory: isListSource(currentWikiSource) ? null : browsingCategory,
    fileType: fileTypeFilter,
    enabled: true,
    signedIn,
  });

  // The file the URL names that is not on screen yet: a shared link, or Back to a file not loaded now
  const wantedFileRef = useRef(fileParam);
  const imagesRef = useRef(results.images);
  imagesRef.current = results.images;
  // Back and forward move `file`: close the panel when it goes, show the file when it changes
  useEffect(() => {
    const loaded = fileParam ? imagesRef.current.find((img) => img.url === fileParam) : undefined;
    wantedFileRef.current = fileParam && !loaded ? fileParam : null;
    // oxlint-disable-next-line
    setSelectedImage((current) => {
      if (!fileParam) return null;
      return current?.url === fileParam ? current : (loaded ?? null);
    });
  }, [fileParam]);
  // ...and the wanted file opens once it has loaded
  useEffect(() => {
    const wanted = wantedFileRef.current;
    const match = wanted ? results.images.find((img) => img.url === wanted) : undefined;
    if (match) {
      wantedFileRef.current = null;
      // oxlint-disable-next-line
      setSelectedImage(match);
    }
  }, [results.images]);

  const handleSelectImage = useCallback(
    (img: CommonsImage) => {
      wantedFileRef.current = null;
      setSelectedImage(img);
      if (new URLSearchParams(paramsRef.current).has("file")) {
        updateUrl({ file: img.url });
      } else {
        openedHereRef.current = true;
        updateUrl({ file: img.url }, "push");
      }
    },
    [updateUrl]
  );

  const handleCloseImage = useCallback(() => {
    wantedFileRef.current = null;
    setSelectedImage(null);
    if (openedHereRef.current) {
      openedHereRef.current = false;
      paramsRef.current = withParams(paramsRef.current, { file: null });
      router.back();
    } else {
      updateUrl({ file: null });
    }
  }, [router, updateUrl]);

  const changeSource = useCallback(
    (src: UrlSource) => {
      setSearchQuery("");
      setActiveCategories([]);
      setSelectedImage(null);
      wantedFileRef.current = null;
      openedHereRef.current = false;
      updateUrl({ src, q: null, cat: null, file: null });
    },
    [updateUrl]
  );

  const handleTabChange = useCallback(
    (newTab: Tab) => changeSource(newTab === "commons" ? "commons" : "ixwiki"),
    [changeSource]
  );

  const handleToggleCategory = useCallback((cat: string) => {
    setActiveCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    );
  }, []);

  const handleBrowseCategory = useCallback(
    (cat: string) => {
      setSearchQuery("");
      setMobileCategoriesOpen(false);
      updateUrl({ cat, q: null });
    },
    [updateUrl]
  );

  const handleStopBrowsing = useCallback(() => updateUrl({ cat: null }), [updateUrl]);
  const handleFileTypeChange = useCallback(
    (type: ImageTypeFilter) => updateUrl({ type }),
    [updateUrl]
  );
  const handleOrientationChange = useCallback(
    (orient: ImageOrientationFilter) => updateUrl({ orient }),
    [updateUrl]
  );

  const isFilterActive = fileTypeFilter !== "all" || orientationFilter !== "all";
  const handleClearFilters = useCallback(
    () => updateUrl({ type: null, orient: null }),
    [updateUrl]
  );

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
