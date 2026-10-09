"use client";

import { useState, useCallback, useMemo } from "react";
import Link from "next/link";
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

const STARTER_CATEGORIES = [
  { label: "Historical Maps", category: "Historical maps" },
  { label: "Coats of Arms", category: "Coats of arms by country" },
  { label: "Royal Residences", category: "Royal residences by country" },
  { label: "Castles", category: "Castles by country" },
  { label: "Military Flags", category: "Military flags" },
  { label: "Portrait Paintings", category: "Portrait paintings" },
];

export default function RepositoryPage() {
  usePageTitle({ title: "Image repository" });

  const [tab, setTab] = useState<Tab>("commons");
  const [wikiSubSource, setWikiSubSource] = useState<WikiSubSource>("ixwiki");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategories, setActiveCategories] = useState<string[]>([]);
  const [browsingCategory, setBrowsingCategory] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<CommonsImage | null>(null);
  const [mobileCategoriesOpen, setMobileCategoriesOpen] = useState(false);
  const [fileTypeFilter, setFileTypeFilter] = useState<ImageTypeFilter>("all");
  const [orientationFilter, setOrientationFilter] = useState<ImageOrientationFilter>("all");
  // undefined: the guide opens itself the first time; true: the help button opened it
  const [welcomeOpen, setWelcomeOpen] = useState<boolean | undefined>(undefined);
  const isDesktop = useMediaQuery("(min-width: 1024px)");

  const currentWikiSource = tab === "commons" ? "commons" : wikiSubSource;

  // An emptied field searches nothing at once; the debounce only delays typing.
  const debouncedQuery = useDebounce(searchQuery, 300);
  const query = searchQuery.trim() === "" ? "" : debouncedQuery;

  const results = useRepositoryImages({
    source: currentWikiSource,
    query,
    categories: activeCategories,
    browsingCategory,
    fileType: fileTypeFilter,
    enabled: true,
  });

  const resetBrowsing = useCallback(() => {
    setSearchQuery("");
    setBrowsingCategory(null);
    setSelectedImage(null);
    setActiveCategories([]);
  }, []);

  const handleTabChange = useCallback(
    (newTab: Tab) => {
      setTab(newTab);
      resetBrowsing();
    },
    [resetBrowsing]
  );

  const handleWikiSubSourceChange = useCallback(
    (sub: WikiSubSource) => {
      setWikiSubSource(sub);
      resetBrowsing();
    },
    [resetBrowsing]
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
  }, []);

  const isFilterActive = fileTypeFilter !== "all" || orientationFilter !== "all";
  const handleClearFilters = useCallback(() => {
    setFileTypeFilter("all");
    setOrientationFilter("all");
  }, []);

  // Orientation is judged here; the file type is part of the search itself
  const filteredImages = useMemo(
    () => results.images.filter((img) => matchesImageFilters(img, "all", orientationFilter)),
    [results.images, orientationFilter]
  );

  const categoryBrowser = (
    <CommonsCategoryBrowser
      activeCategories={activeCategories}
      browsingCategory={browsingCategory}
      onToggleCategory={tab === "commons" ? handleToggleCategory : undefined}
      onBrowseCategory={handleBrowseCategory}
      wiki={currentWikiSource}
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

            {/* Scope toggle: IxWiki vs IIWiki */}
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
              aria-expanded={mobileCategoriesOpen}
              className="text-footnote border-separator hover:bg-fill-3 flex h-8 items-center gap-2 px-3 lg:hidden"
              title="Browse categories"
            >
              <Folder className="text-tint h-3.5 w-3.5" aria-hidden="true" />
              <span className="text-caption">Categories</span>
            </Button>
          </div>

          <SearchField
            value={searchQuery}
            onValueChange={setSearchQuery}
            placeholder={
              tab === "commons"
                ? 'Search Commons... e.g. "medieval castle", "15th century portrait"'
                : `Search ${wikiSubSource === "iiwiki" ? "IIWiki" : "IxWiki"} files... e.g. "map", "flag"`
            }
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
        {browsingCategory && (
          <div className="wikios-commons-chips">
            <Badge variant="default" className="gap-1 py-0 pr-0.5">
              Browsing: {browsingCategory}
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Stop browsing category"
                onClick={() => setBrowsingCategory(null)}
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
            onSelect={setSelectedImage}
            onLoadMore={results.loadMore}
            hasMore={results.hasMore}
            isLoading={results.isLoading || results.isLoadingMore}
            mode={results.mode}
            query={query}
            loadedCount={results.images.length}
            truncated={results.truncated}
            totalHits={results.totalHits}
            error={results.error}
            onRetry={results.retry}
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
