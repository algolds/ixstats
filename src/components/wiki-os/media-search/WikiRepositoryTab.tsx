"use client";
// src/components/media-search/WikiRepositoryTab.tsx

import React, { useState, useEffect, useMemo, useRef } from "react";
import { SegmentedControl } from "~/components/ui/segmented-control";
import { withBasePath } from "~/lib/base-path";
import { cn } from "~/lib/utils";
import {
  SystemRestart as Loader2,
  Xmark as X,
  Globe,
  Database,
  Bookmark,
  ZoomIn,
  ControlSlider as SlidersHorizontal,
} from "iconoir-react";
import { Button } from "~/components/ui/button";
import { api } from "~/trpc/react";
import { CommonsCategoryBrowser } from "~/components/wiki-os/commons/CommonsCategoryBrowser";
import { CommonsDetailPanel } from "~/components/wiki-os/commons/CommonsDetailPanel";
import type { CommonsImage } from "./types";
import { getImageType, getImageOrientation } from "./types";
import { MyStashTab } from "./MyStashTab";
import { SearchField } from "~/components/ui/search-field";

function dedupeImages(existing: CommonsImage[], incoming: CommonsImage[]): CommonsImage[] {
  const seen = new Set(existing.map((img) => img.pageid));
  const newOnes = incoming.filter((img) => !seen.has(img.pageid));
  return [...existing, ...newOnes];
}

interface WikiRepositoryTabProps {
  selectedImageObj: CommonsImage | null;
  onSelectImage: (img: CommonsImage) => void;
  onDoubleClickConfirm: () => void;
  isCategoryExpanded: boolean;
  setIsCategoryExpanded: React.Dispatch<React.SetStateAction<boolean>>;
}

type WikiSourceTab = "commons" | "wiki" | "stash";
type WikiSubSource = "ixwiki" | "iiwiki";

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
  const [debouncedWikiQuery, setDebouncedWikiQuery] = useState("");
  const [activeCategories, setActiveCategories] = useState<string[]>([]);
  const [browsingCategory, setBrowsingCategory] = useState<string | null>(null);
  const [wikiImages, setWikiImages] = useState<CommonsImage[]>([]);
  const [searchOffset, setSearchOffset] = useState(0);
  const [catOffset, setCatOffset] = useState(0);

  const lastMergedSearchDataRef = useRef<unknown>(null);
  const lastMergedCatDataRef = useRef<unknown>(null);

  // Filters state
  const [fileTypeFilter, setFileTypeFilter] = useState<"all" | "jpg" | "png" | "svg">("all");
  const [orientationFilter, setOrientationFilter] = useState<
    "all" | "landscape" | "portrait" | "square"
  >("all");

  // Reset state when switching primary source
  useEffect(() => {
    // oxlint-disable-next-line
    setWikiImages([]);
    setSearchOffset(0);
    setCatOffset(0);
    setBrowsingCategory(null);
    setActiveCategories([]);
    setWikiSearchQuery("");
    setDebouncedWikiQuery("");
    lastMergedSearchDataRef.current = null;
    lastMergedCatDataRef.current = null;
    onSelectImage(null as any);
    // oxlint-disable-next-line
  }, [wikiSource]);

  // When switching between IxWiki and IIWiki, keep search query but refresh images and clear category/selection
  useEffect(() => {
    // oxlint-disable-next-line
    setWikiImages([]);
    setSearchOffset(0);
    setCatOffset(0);
    setBrowsingCategory(null);
    setActiveCategories([]);
    lastMergedSearchDataRef.current = null;
    lastMergedCatDataRef.current = null;
    onSelectImage(null as any);
    // oxlint-disable-next-line
  }, [wikiSubSource]);

  // Debounce wiki query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedWikiQuery(wikiSearchQuery);
      setWikiImages([]);
      setSearchOffset(0);
      setCatOffset(0);
      lastMergedSearchDataRef.current = null;
      lastMergedCatDataRef.current = null;
    }, 400);
    return () => clearTimeout(timer);
  }, [wikiSearchQuery]);

  const effectiveQuery = useMemo(() => {
    const parts = activeCategories.map((c) => `deepcat:"${c}"`);
    if (debouncedWikiQuery) parts.push(debouncedWikiQuery);
    return parts.join(" ");
  }, [activeCategories, debouncedWikiQuery]);

  const isSearchMode = effectiveQuery.length >= 2;
  const isBrowseMode = !isSearchMode && !!browsingCategory;

  // 1. Commons search query
  const { data: commonsSearchData, isFetching: isFetchingCommonsSearch } =
    api.commons.search.useQuery(
      { query: effectiveQuery, limit: 30, offset: searchOffset },
      { enabled: wikiSource === "commons" && isSearchMode, staleTime: 60_000 }
    );

  // 2. Commons category browsing query
  const { data: commonsCatData, isFetching: isFetchingCommonsCat } =
    api.commons.getCategoryFiles.useQuery(
      { category: browsingCategory ?? "", limit: 30, offset: catOffset },
      { enabled: wikiSource === "commons" && isBrowseMode, staleTime: 60_000 }
    );

  // 3. Local/External Wiki files query (ixwiki / iiwiki)
  const localIsBrowseMode = wikiSource === "wiki" && !debouncedWikiQuery && !!browsingCategory;
  const { data: wikiFileData, isFetching: isFetchingWikiFiles } = api.wikios.searchFiles.useQuery(
    {
      query: debouncedWikiQuery || undefined,
      category: localIsBrowseMode ? (browsingCategory ?? undefined) : undefined,
      limit: 50,
      wiki: wikiSubSource,
    },
    {
      enabled: wikiSource === "wiki",
      staleTime: 60_000,
    }
  );

  // Merge Commons Search into wikiImages cleanly with deduplication
  useEffect(() => {
    if (wikiSource === "commons" && isSearchMode && commonsSearchData?.images) {
      if (lastMergedSearchDataRef.current === commonsSearchData) return;
      lastMergedSearchDataRef.current = commonsSearchData;

      // oxlint-disable-next-line
      setWikiImages((prev) => {
        if (searchOffset === 0) return commonsSearchData.images;
        return dedupeImages(prev, commonsSearchData.images);
      });
    }
  }, [commonsSearchData, searchOffset, isSearchMode, wikiSource]);

  // Merge Commons Browse into wikiImages cleanly with deduplication
  useEffect(() => {
    if (wikiSource === "commons" && isBrowseMode && commonsCatData?.images) {
      if (lastMergedCatDataRef.current === commonsCatData) return;
      lastMergedCatDataRef.current = commonsCatData;

      // oxlint-disable-next-line
      setWikiImages((prev) => {
        if (catOffset === 0) return commonsCatData.images;
        return dedupeImages(prev, commonsCatData.images);
      });
    }
  }, [commonsCatData, catOffset, isBrowseMode, wikiSource]);

  // Map and set ixwiki/iiwiki images
  useEffect(() => {
    if (wikiSource === "wiki" && wikiFileData) {
      const isIiwiki = wikiSubSource === "iiwiki";
      const offset = isIiwiki ? 2000000 : 1000000;
      const mapped = wikiFileData.map((img: any, index: number) => {
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
      });
      // oxlint-disable-next-line
      setWikiImages(mapped);
    }
  }, [wikiFileData, wikiSource, wikiSubSource]);

  const handleWikiLoadMore = () => {
    if (wikiSource === "commons") {
      if (isSearchMode && commonsSearchData?.nextOffset != null) {
        setSearchOffset(commonsSearchData.nextOffset);
      } else if (isBrowseMode && commonsCatData?.nextOffset != null) {
        setCatOffset(commonsCatData.nextOffset);
      }
    }
  };

  const hasMoreWikiImages =
    wikiSource === "commons"
      ? isSearchMode
        ? commonsSearchData?.nextOffset != null
        : isBrowseMode
          ? commonsCatData?.nextOffset != null
          : false
      : false;

  const handleToggleCategory = (cat: string) => {
    setActiveCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    );
    setWikiImages([]);
    setSearchOffset(0);
    lastMergedSearchDataRef.current = null;
  };

  const handleBrowseCategory = (cat: string) => {
    setBrowsingCategory(cat);
    setCatOffset(0);
    setWikiImages([]);
    setWikiSearchQuery("");
    setDebouncedWikiQuery("");
    lastMergedCatDataRef.current = null;
  };

  // Client-side dynamic filtering of wiki results
  const filteredWikiImages = useMemo(() => {
    const seenKeys = new Set<string>();
    return wikiImages.filter((img) => {
      const uniqueKey = `${img.pageid}-${img.title}`;
      if (seenKeys.has(uniqueKey)) return false;
      seenKeys.add(uniqueKey);

      if (fileTypeFilter !== "all") {
        const type = getImageType(img.mime ?? "", img.title);
        if (type !== fileTypeFilter) return false;
      }
      if (orientationFilter !== "all") {
        const orient = getImageOrientation(img.width, img.height);
        if (orient !== orientationFilter) return false;
      }
      return true;
    });
  }, [wikiImages, fileTypeFilter, orientationFilter]);

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
              onValueChange={setWikiSource}
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
                onValueChange={setWikiSubSource}
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
                <SlidersHorizontal className="h-3.5 w-3.5 shrink-0" />
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
                    <span className="text-footnote text-label-secondary select-none">Orient:</span>
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

                {(fileTypeFilter !== "all" || orientationFilter !== "all") && (
                  <Button
                    variant="link"
                    size="sm"
                    onClick={() => {
                      setFileTypeFilter("all");
                      setOrientationFilter("all");
                    }}
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
                      <X className="h-2.5 w-2.5" />
                    </Button>
                  </span>
                ))}
              </div>
            )}

            {browsingCategory && !isSearchMode && (
              <div className="mt-1 flex flex-wrap gap-2">
                <span className="border-separator bg-fill-3 text-caption text-label inline-flex items-center gap-2 rounded-full border px-3 py-0.5">
                  <span className="text-label-secondary">Browsing:</span>
                  <span className="font-semibold">{browsingCategory}</span>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => {
                      setBrowsingCategory(null);
                      setWikiImages([]);
                    }}
                    title="Clear folder filter"
                    aria-label="Clear folder filter"
                    className="text-label-secondary size-5 rounded-full"
                  >
                    <X className="h-2.5 w-2.5" />
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
          {/* Category Browser sidebar */}
          <div
            className={cn(
              "border-separator bg-surface shrink-0 border-r transition-[color,background-color,border-color,box-shadow,opacity,transform] duration-200",
              isCategoryExpanded ? "w-60" : "w-0 overflow-hidden"
            )}
          >
            <div className="h-full overflow-y-auto">
              <CommonsCategoryBrowser
                activeCategories={activeCategories}
                browsingCategory={browsingCategory}
                onToggleCategory={handleToggleCategory}
                onBrowseCategory={handleBrowseCategory}
                wiki={wikiSource === "wiki" ? wikiSubSource : "commons"}
              />
            </div>
          </div>

          {/* Grid panel */}
          <div className="flex min-w-0 flex-1 flex-col overflow-y-auto p-4">
            {(isFetchingCommonsSearch || isFetchingCommonsCat || isFetchingWikiFiles) &&
            wikiImages.length === 0 ? (
              <div className="flex h-48 items-center justify-center">
                <Loader2 className="text-tint h-8 w-8 animate-spin" />
              </div>
            ) : filteredWikiImages.length > 0 ? (
              <div className="flex-1">
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
                  {filteredWikiImages.map((img, index) => {
                    const isSelected = selectedImageObj?.pageid === img.pageid;
                    const cleanTitle = img.title.replace(/^File:/, "").replace(/_/g, " ");

                    return (
                      <button
                        key={`${img.pageid}-${img.title}-${index}`}
                        type="button"
                        aria-pressed={isSelected}
                        onClick={() => onSelectImage(img)}
                        onDoubleClick={onDoubleClickConfirm}
                        className={cn(
                          "group rounded-control bg-surface relative flex flex-col overflow-hidden border text-left transition-[color,background-color,border-color,box-shadow,opacity,transform] duration-200 select-none active:scale-[0.98]",
                          isSelected
                            ? "border-tint ring-tint/30 shadow-card ring-2"
                            : "border-separator hover:border-separator"
                        )}
                        style={{ contentVisibility: "auto", containIntrinsicSize: "auto 180px" }}
                      >
                        <div className="bg-fill-4 relative aspect-[4/3] w-full overflow-hidden">
                          <img
                            src={img.thumbUrl}
                            alt={cleanTitle}
                            loading="lazy"
                            className="h-full w-full object-cover transition-transform duration-300"
                            onContextMenu={(e) => e.preventDefault()}
                          />
                          <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                            <div className="border-separator shadow-card rounded-full border bg-black/60 p-2 text-white">
                              <ZoomIn className="h-4 w-4" />
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-col gap-0.5 p-2 text-left">
                          <span className="text-caption text-label group-hover:text-label truncate">
                            {cleanTitle}
                          </span>
                          <span className="text-footnote text-label-secondary">
                            {img.width > 0 && img.height > 0
                              ? `${img.width}×${img.height}`
                              : "Vector"}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {hasMoreWikiImages && (
                  <div className="mt-2 py-4 text-center">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleWikiLoadMore}
                      className="text-footnote h-8"
                    >
                      Load more images
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-label-secondary text-footnote py-12 text-center">
                {wikiSearchQuery || browsingCategory
                  ? "No images match filters/search."
                  : "Search or select a category sidebar folder to browse images."}
              </div>
            )}
          </div>

          {/* Right Side Detail Panel */}
          {selectedImageObj && (
            <div className="border-separator bg-surface w-80 shrink-0 overflow-y-auto border-l">
              <CommonsDetailPanel
                image={selectedImageObj}
                onClose={() => {
                  onSelectImage(null as any);
                }}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
