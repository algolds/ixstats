"use client";

import React, { useState, useMemo } from "react";
import { SegmentedControl } from "~/components/ui/segmented-control";
import { cn } from "~/lib/utils";
import {
  Xmark as X,
  Globe,
  Database,
  Bookmark,
  ControlSlider as SlidersHorizontal,
} from "iconoir-react";
import { Button } from "~/components/ui/button";
import { useDebounce } from "~/hooks/useDebounce";
import { CommonsCategoryBrowser } from "~/components/wiki-os/commons/CommonsCategoryBrowser";
import { CommonsDetailPanel } from "~/components/wiki-os/commons/CommonsDetailPanel";
import { CommonsResultsGrid } from "~/components/wiki-os/commons/CommonsResultsGrid";
import {
  matchesImageFilters,
  type CommonsImage,
  type ImageOrientationFilter,
  type ImageTypeFilter,
  type WikiSubSource,
} from "./types";
import { useRepositoryImages } from "./useRepositoryImages";
import { MyStashTab } from "./MyStashTab";
import { SearchField } from "~/components/ui/search-field";

interface WikiRepositoryTabProps {
  selectedImageObj: CommonsImage | null;
  onSelectImage: (img: CommonsImage | null) => void;
  onDoubleClickConfirm: () => void;
  isCategoryExpanded: boolean;
  setIsCategoryExpanded: React.Dispatch<React.SetStateAction<boolean>>;
}

type WikiSourceTab = "commons" | "wiki" | "stash";

/** Results per Commons page in the picker. */
const PICKER_PAGE_SIZE = 30;

export function WikiRepositoryTab({
  selectedImageObj,
  onSelectImage,
  onDoubleClickConfirm,
  isCategoryExpanded,
  setIsCategoryExpanded,
}: WikiRepositoryTabProps) {
  const [wikiSource, setWikiSource] = useState<WikiSourceTab>("commons");
  const [wikiSubSource, setWikiSubSource] = useState<WikiSubSource>("ixwiki");
  const [wikiSearchQuery, setWikiSearchQuery] = useState("");
  const [activeCategories, setActiveCategories] = useState<string[]>([]);
  const [browsingCategory, setBrowsingCategory] = useState<string | null>(null);
  const [fileTypeFilter, setFileTypeFilter] = useState<ImageTypeFilter>("all");
  const [orientationFilter, setOrientationFilter] = useState<ImageOrientationFilter>("all");

  // An emptied field searches nothing at once; the debounce only delays typing.
  const debouncedWikiQuery = useDebounce(wikiSearchQuery, 400);
  const query = wikiSearchQuery.trim() === "" ? "" : debouncedWikiQuery;

  const results = useRepositoryImages({
    source: wikiSource === "wiki" ? wikiSubSource : "commons",
    query,
    categories: activeCategories,
    browsingCategory,
    fileType: fileTypeFilter,
    enabled: wikiSource !== "stash",
    pageSize: PICKER_PAGE_SIZE,
  });

  const handleSourceChange = (next: WikiSourceTab) => {
    setWikiSource(next);
    setWikiSearchQuery("");
    setBrowsingCategory(null);
    setActiveCategories([]);
    onSelectImage(null);
  };

  // Between IxWiki and IIWiki the search stays; the category and the selection do not carry over
  const handleSubSourceChange = (next: WikiSubSource) => {
    setWikiSubSource(next);
    setBrowsingCategory(null);
    setActiveCategories([]);
    onSelectImage(null);
  };

  const handleToggleCategory = (cat: string) => {
    setActiveCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    );
  };

  const handleBrowseCategory = (cat: string) => {
    setBrowsingCategory(cat);
    setWikiSearchQuery("");
  };

  const isFilterActive = fileTypeFilter !== "all" || orientationFilter !== "all";
  const handleClearFilters = () => {
    setFileTypeFilter("all");
    setOrientationFilter("all");
  };

  // Orientation is judged here; the file type is part of the search itself
  const filteredImages = useMemo(
    () => results.images.filter((img) => matchesImageFilters(img, "all", orientationFilter)),
    [results.images, orientationFilter]
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Header controls & tabs */}
      <div className="border-separator bg-surface flex flex-col gap-2 border-b p-3">
        <div className="flex items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2">
            {/* Wiki Sub-tabs */}
            <SegmentedControl
              asTabs
              aria-label="Repository image sources"
              size="sm"
              value={wikiSource}
              onValueChange={handleSourceChange}
              options={[
                { value: "commons", label: "Commons", icon: <Globe aria-hidden="true" /> },
                { value: "wiki", label: "Wiki", icon: <Database aria-hidden="true" /> },
                { value: "stash", label: "My stash", icon: <Bookmark aria-hidden="true" /> },
              ]}
            />

            {/* Scope toggle: IxWiki (Local) vs IIWiki (External) */}
            {wikiSource === "wiki" && (
              <SegmentedControl
                aria-label="Wiki source selection"
                size="sm"
                value={wikiSubSource}
                onValueChange={handleSubSourceChange}
                options={[
                  { value: "ixwiki", label: "IxWiki" },
                  { value: "iiwiki", label: "IIWiki" },
                ]}
              />
            )}
          </div>

          {/* Filter toggle button */}
          {wikiSource !== "stash" && (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsCategoryExpanded((prev) => !prev)}
                className={cn(
                  "text-caption rounded-control flex h-8 cursor-pointer items-center gap-2 transition-[color,background-color,border-color,box-shadow,opacity,transform] duration-150",
                  isCategoryExpanded
                    ? "border-tint/40 bg-tint-fill text-tint hover:bg-tint-fill"
                    : "border-separator text-label-secondary hover:text-label hover:bg-fill-3"
                )}
              >
                <SlidersHorizontal className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span>Filters</span>
              </Button>
            </div>
          )}
        </div>

        {wikiSource !== "stash" && (
          <>
            {/* Search input with 1-tap clear */}
            <SearchField
              placeholder={
                wikiSource === "commons"
                  ? 'Search Commons... e.g. "medieval castle", "royal portrait"'
                  : `Search ${wikiSubSource === "iiwiki" ? "IIWiki" : "IxWiki"} files...`
              }
              aria-label="Search files"
              value={wikiSearchQuery}
              onValueChange={setWikiSearchQuery}
            />

            {/* Filters bar */}
            {isCategoryExpanded && (
              <div className="text-footnote flex flex-wrap items-center justify-between gap-3 pt-1 transition-[color,background-color,border-color,box-shadow,opacity,transform]">
                <div className="flex flex-wrap items-center gap-3">
                  {/* File Type Segmented Control */}
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

                  {/* Orientation Segmented Control */}
                  <div className="flex items-center gap-2">
                    <span className="text-footnote text-label-secondary select-none">
                      Orientation:
                    </span>
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

                {isFilterActive && (
                  <Button
                    variant="link"
                    size="sm"
                    onClick={handleClearFilters}
                    className="text-label-secondary h-auto px-0"
                  >
                    Reset filters
                  </Button>
                )}
              </div>
            )}

            {/* Active Category Chips */}
            {wikiSource === "commons" && activeCategories.length > 0 && (
              <div className="mt-1 flex flex-wrap gap-2">
                {activeCategories.map((cat) => (
                  <span
                    key={cat}
                    className="border-separator bg-fill-3 text-caption text-label inline-flex items-center gap-1 rounded-full border px-3 py-0.5"
                  >
                    <span>{cat}</span>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => handleToggleCategory(cat)}
                      title={`Remove ${cat} filter`}
                      aria-label={`Remove ${cat} filter`}
                      className="text-label-secondary size-5 rounded-full"
                    >
                      <X className="h-2.5 w-2.5" aria-hidden="true" />
                    </Button>
                  </span>
                ))}
              </div>
            )}

            {browsingCategory && (
              <div className="mt-1 flex flex-wrap gap-2">
                <span className="border-separator bg-fill-3 text-caption text-label inline-flex items-center gap-2 rounded-full border px-3 py-0.5">
                  <span className="text-label-secondary">Browsing:</span>
                  <span className="font-semibold">{browsingCategory}</span>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => setBrowsingCategory(null)}
                    title="Clear folder filter"
                    aria-label="Clear folder filter"
                    className="text-label-secondary size-5 rounded-full"
                  >
                    <X className="h-2.5 w-2.5" aria-hidden="true" />
                  </Button>
                </span>
              </div>
            )}
          </>
        )}
      </div>

      {/* Content body */}
      {wikiSource === "stash" ? (
        <MyStashTab
          selectedImageObj={selectedImageObj}
          onSelectImage={onSelectImage}
          onDoubleClickConfirm={onDoubleClickConfirm}
        />
      ) : (
        /* Split layout: Category Browser + Grid + Detail Panel */
        <div className="flex min-h-0 flex-1 overflow-hidden">
          {/* Category Browser sidebar (mounted only while the filters are open) */}
          {isCategoryExpanded && (
            <div className="border-separator bg-surface w-60 shrink-0 border-r">
              <div className="h-full overflow-y-auto">
                <CommonsCategoryBrowser
                  activeCategories={activeCategories}
                  browsingCategory={browsingCategory}
                  onToggleCategory={wikiSource === "commons" ? handleToggleCategory : undefined}
                  onBrowseCategory={handleBrowseCategory}
                  wiki={wikiSource === "wiki" ? wikiSubSource : "commons"}
                />
              </div>
            </div>
          )}

          {/* Grid panel */}
          <div className="flex min-w-0 flex-1 flex-col overflow-y-auto p-2">
            <CommonsResultsGrid
              images={filteredImages}
              selectedImage={selectedImageObj}
              onSelect={onSelectImage}
              onConfirm={() => onDoubleClickConfirm()}
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
          </div>

          {/* Right Side Detail Panel */}
          {selectedImageObj && (
            <div className="border-separator bg-surface w-80 shrink-0 overflow-y-auto border-l">
              <CommonsDetailPanel image={selectedImageObj} onClose={() => onSelectImage(null)} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
