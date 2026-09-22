"use client";
// src/components/media-search/WikiRepositoryTab.tsx

import React, { useState, useEffect, useMemo, useRef } from "react";
import { withBasePath } from "~/lib/base-path";
import { cn } from "~/lib/utils";
import {
  Search,
  SystemRestart as Loader2,
  Xmark as X,
  Globe,
  Database,
  Bookmark,
  ZoomIn,
  ControlSlider as SlidersHorizontal,
} from "iconoir-react";
import { Input } from "~/components/ui/input";
import { Button } from "~/components/ui/button";
import { api } from "~/trpc/react";
import { CommonsCategoryBrowser } from "~/components/wiki-os/commons/CommonsCategoryBrowser";
import { CommonsDetailPanel } from "~/components/wiki-os/commons/CommonsDetailPanel";
import { TextureOverlay } from "~/components/ui/texture-overlay";
import type { CommonsImage } from "./types";
import { getImageType, getImageOrientation } from "./types";
import { MyStashTab } from "./MyStashTab";

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
  const localIsBrowseMode =
    wikiSource === "wiki" &&
    !debouncedWikiQuery &&
    !!browsingCategory;
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
      <div className="border-border/10 bg-card/5 flex flex-col gap-2 border-b p-3">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 flex-wrap">
            {/* Wiki Sub-tabs */}
            <div
              role="tablist"
              aria-label="Repository image sources"
              className="inline-flex items-center gap-1 p-1 rounded-lg bg-muted/60 border border-border/40 backdrop-blur-md"
            >
              <button
                role="tab"
                type="button"
                aria-selected={wikiSource === "commons"}
                onClick={() => setWikiSource("commons")}
                className={cn(
                  "px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-1.5 transition-all duration-150 active:scale-[0.97] select-none cursor-pointer",
                  wikiSource === "commons"
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
                aria-selected={wikiSource === "wiki"}
                onClick={() => setWikiSource("wiki")}
                className={cn(
                  "px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-1.5 transition-all duration-150 active:scale-[0.97] select-none cursor-pointer",
                  wikiSource === "wiki"
                    ? "bg-background text-foreground font-semibold shadow-xs border border-border/50"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
                )}
              >
                <Database className="h-3.5 w-3.5 shrink-0" />
                <span>Wiki</span>
              </button>
              <button
                role="tab"
                type="button"
                aria-selected={wikiSource === "stash"}
                onClick={() => setWikiSource("stash")}
                className={cn(
                  "px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-1.5 transition-all duration-150 active:scale-[0.97] select-none cursor-pointer",
                  wikiSource === "stash"
                    ? "bg-background text-foreground font-semibold shadow-xs border border-border/50"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
                )}
              >
                <Bookmark className="h-3.5 w-3.5 shrink-0" />
                <span>My Stash</span>
              </button>
            </div>

            {/* Apple Scope Toggle: IxWiki (Local) vs IIWiki (External) */}
            {wikiSource === "wiki" && (
              <div
                role="radiogroup"
                aria-label="Wiki source selection"
                className="inline-flex items-center gap-0.5 p-0.5 rounded-md bg-muted/60 border border-border/40 backdrop-blur-sm animate-in fade-in zoom-in-95 duration-150"
              >
                <button
                  type="button"
                  role="radio"
                  aria-checked={wikiSubSource === "ixwiki"}
                  onClick={() => setWikiSubSource("ixwiki")}
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
                  onClick={() => setWikiSubSource("iiwiki")}
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
          </div>

          {/* Filter toggle button */}
          {wikiSource !== "stash" && (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsCategoryExpanded((prev) => !prev)}
                className={cn(
                  "flex h-8 items-center gap-1.5 text-xs font-medium rounded-lg transition-all duration-150 active:scale-[0.97] cursor-pointer",
                  isCategoryExpanded
                    ? "border-primary/40 bg-primary/10 text-primary hover:bg-primary/15"
                    : "border-border/60 text-muted-foreground hover:text-foreground hover:bg-muted/40"
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
            <div className="relative">
              <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              <Input
                placeholder={
                  wikiSource === "commons"
                    ? 'Search Commons... e.g. "medieval castle", "royal portrait"'
                    : `Search ${wikiSubSource === "iiwiki" ? "IIWiki" : "IxWiki"} files...`
                }
                value={wikiSearchQuery}
                onChange={(e) => setWikiSearchQuery(e.target.value)}
                className="h-9 pl-9 pr-8 text-xs bg-muted/30 border-border/50 focus-visible:bg-background focus-visible:ring-1 focus-visible:ring-ring"
              />
              {wikiSearchQuery && (
                <button
                  type="button"
                  onClick={() => setWikiSearchQuery("")}
                  className="absolute top-1/2 right-2.5 -translate-y-1/2 p-1 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-all active:scale-[0.95] cursor-pointer"
                  title="Clear search"
                  aria-label="Clear search"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* Filters bar */}
            {isCategoryExpanded && (
              <div className="flex flex-wrap items-center justify-between gap-3 pt-1 text-[11px] transition-all">
                <div className="flex flex-wrap items-center gap-3">
                  {/* File Type Segmented Control */}
                  <div className="flex items-center gap-1.5">
                    <span className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase select-none">
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

                  {/* Orientation Segmented Control */}
                  <div className="flex items-center gap-1.5">
                    <span className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase select-none">
                      Orient:
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

                {(fileTypeFilter !== "all" || orientationFilter !== "all") && (
                  <button
                    type="button"
                    onClick={() => {
                      setFileTypeFilter("all");
                      setOrientationFilter("all");
                    }}
                    className="cursor-pointer text-[11px] font-medium text-muted-foreground hover:text-foreground active:scale-[0.97] transition-all underline underline-offset-2"
                  >
                    Reset Filters
                  </button>
                )}
              </div>
            )}

            {/* Active Category Chips */}
            {wikiSource === "commons" && activeCategories.length > 0 && (
              <div className="mt-1 flex flex-wrap gap-1.5">
                {activeCategories.map((cat) => (
                  <span
                    key={cat}
                    className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-muted/60 px-2.5 py-0.5 text-[10px] font-medium text-foreground backdrop-blur-sm shadow-2xs"
                  >
                    <span>{cat}</span>
                    <button
                      type="button"
                      onClick={() => handleToggleCategory(cat)}
                      className="rounded-full p-0.5 text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors active:scale-[0.95] cursor-pointer"
                      title={`Remove ${cat} filter`}
                      aria-label={`Remove ${cat} filter`}
                    >
                      <X className="h-2.5 w-2.5" />
                    </button>
                  </span>
                ))}
              </div>
            )}

            {browsingCategory && !isSearchMode && (
              <div className="mt-1 flex flex-wrap gap-1.5">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-border/50 bg-muted/40 px-2.5 py-0.5 text-[10px] font-medium text-foreground">
                  <span className="text-muted-foreground">Browsing:</span>
                  <span className="font-semibold">{browsingCategory}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setBrowsingCategory(null);
                      setWikiImages([]);
                    }}
                    className="rounded-full p-0.5 text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors active:scale-[0.95] cursor-pointer"
                    title="Clear folder filter"
                    aria-label="Clear folder filter"
                  >
                    <X className="h-2.5 w-2.5" />
                  </button>
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
              "border-border/10 bg-card/5 shrink-0 border-r transition-all duration-200",
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
                <Loader2 className="h-8 w-8 animate-spin text-blue-400" />
              </div>
            ) : filteredWikiImages.length > 0 ? (
              <div className="flex-1">
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
                  {filteredWikiImages.map((img, index) => {
                    const isSelected = selectedImageObj?.pageid === img.pageid;
                    const cleanTitle = img.title.replace(/^File:/, "").replace(/_/g, " ");

                    return (
                      <button
                        key={`${img.pageid}-${img.title}-${index}`}
                        type="button"
                        onClick={() => onSelectImage(img)}
                        onDoubleClick={onDoubleClickConfirm}
                        className={cn(
                          "group relative flex flex-col overflow-hidden rounded-lg border bg-card text-left select-none transition-all duration-200 active:scale-[0.98]",
                          isSelected
                            ? "border-blue-500 ring-2 ring-blue-500/30 shadow-sm"
                            : "border-border/50 hover:border-border hover:shadow-xs"
                        )}
                        style={{ contentVisibility: "auto", containIntrinsicSize: "auto 180px" }}
                      >
                        <TextureOverlay
                          texture="paperGrain"
                          opacity={0.05}
                          className="mix-blend-overlay"
                        />
                        <TextureOverlay
                          texture="dots"
                          opacity={0.03}
                          className="mix-blend-overlay"
                        />
                        <div className="relative aspect-[4/3] w-full overflow-hidden bg-muted/20">
                          <img
                            src={img.thumbUrl}
                            alt={cleanTitle}
                            loading="lazy"
                            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                            onContextMenu={(e) => e.preventDefault()}
                          />
                          <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 backdrop-blur-[2px] transition-opacity duration-200 group-hover:opacity-100">
                            <div className="rounded-full border border-white/20 bg-black/60 p-1.5 text-white shadow-md">
                              <ZoomIn className="h-4 w-4" />
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-col gap-0.5 p-2 text-left">
                          <span className="truncate text-[11px] font-medium text-foreground/90 group-hover:text-foreground">
                            {cleanTitle}
                          </span>
                          <span className="text-[9px] text-muted-foreground">
                            {img.width > 0 && img.height > 0 ? `${img.width}×${img.height}` : "Vector"}
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
                      className="h-8 text-xs"
                    >
                      Load More Images
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-muted-foreground py-12 text-center text-xs">
                {wikiSearchQuery || browsingCategory
                  ? "No images match filters/search."
                  : "Search or select a category sidebar folder to browse images."}
              </div>
            )}
          </div>

          {/* Right Side Detail Panel */}
          {selectedImageObj && (
            <div className="border-border/40 w-80 shrink-0 overflow-y-auto border-l bg-card/40 backdrop-blur-md">
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
