// src/components/media-search/WikiRepositoryTab.tsx
"use client";

import React, { useState, useEffect, useMemo } from "react";
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

interface WikiRepositoryTabProps {
  selectedImageObj: CommonsImage | null;
  onSelectImage: (img: CommonsImage) => void;
  onDoubleClickConfirm: () => void;
  isCategoryExpanded: boolean;
  setIsCategoryExpanded: React.Dispatch<React.SetStateAction<boolean>>;
}

type WikiSourceTab = "commons" | "ixwiki" | "iiwiki" | "stash";

export function WikiRepositoryTab({
  selectedImageObj,
  onSelectImage,
  onDoubleClickConfirm,
  isCategoryExpanded,
  setIsCategoryExpanded,
}: WikiRepositoryTabProps) {
  const [wikiSource, setWikiSource] = useState<WikiSourceTab>("commons");
  const [wikiSearchQuery, setWikiSearchQuery] = useState("");
  const [debouncedWikiQuery, setDebouncedWikiQuery] = useState("");
  const [activeCategories, setActiveCategories] = useState<string[]>([]);
  const [browsingCategory, setBrowsingCategory] = useState<string | null>(null);
  const [wikiImages, setWikiImages] = useState<CommonsImage[]>([]);
  const [searchOffset, setSearchOffset] = useState(0);
  const [catOffset, setCatOffset] = useState(0);

  // Filters state
  const [fileTypeFilter, setFileTypeFilter] = useState<"all" | "jpg" | "png" | "svg">("all");
  const [orientationFilter, setOrientationFilter] = useState<
    "all" | "landscape" | "portrait" | "square"
  >("all");

  // Reset selected image and query when source changes
  useEffect(() => {
    // oxlint-disable-next-line
    setWikiImages([]);
    setSearchOffset(0);
    setCatOffset(0);
    setBrowsingCategory(null);
    setActiveCategories([]);
    setWikiSearchQuery("");
    setDebouncedWikiQuery("");
    // oxlint-disable-next-line
  }, [wikiSource]);

  // Debounce wiki query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedWikiQuery(wikiSearchQuery);
      setWikiImages([]);
      setSearchOffset(0);
      setCatOffset(0);
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
    (wikiSource === "ixwiki" || wikiSource === "iiwiki") &&
    !debouncedWikiQuery &&
    !!browsingCategory;
  const { data: wikiFileData, isFetching: isFetchingWikiFiles } = api.wikios.searchFiles.useQuery(
    {
      query: debouncedWikiQuery || undefined,
      category: localIsBrowseMode ? (browsingCategory ?? undefined) : undefined,
      limit: 50,
      wiki: wikiSource === "iiwiki" ? "iiwiki" : "ixwiki",
    },
    {
      enabled:
        (wikiSource === "ixwiki" || wikiSource === "iiwiki") &&
        (debouncedWikiQuery.length >= 2 || localIsBrowseMode),
      staleTime: 60_000,
    }
  );

  // Merge Commons Search into wikiImages
  useEffect(() => {
    if (wikiSource === "commons" && isSearchMode && commonsSearchData?.images) {
      // oxlint-disable-next-line
      setWikiImages((prev) =>
        searchOffset === 0 ? commonsSearchData.images : [...prev, ...commonsSearchData.images]
      );
    }
  }, [commonsSearchData, searchOffset, isSearchMode, wikiSource]);

  // Merge Commons Browse into wikiImages
  useEffect(() => {
    if (wikiSource === "commons" && isBrowseMode && commonsCatData?.images) {
      // oxlint-disable-next-line
      setWikiImages((prev) =>
        catOffset === 0 ? commonsCatData.images : [...prev, ...commonsCatData.images]
      );
    }
  }, [commonsCatData, catOffset, isBrowseMode, wikiSource]);

  // Map and set ixwiki/iiwiki images
  useEffect(() => {
    if ((wikiSource === "ixwiki" || wikiSource === "iiwiki") && wikiFileData) {
      const isIiwiki = wikiSource === "iiwiki";
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
  }, [wikiFileData, wikiSource]);

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
  };

  const handleBrowseCategory = (cat: string) => {
    setBrowsingCategory(cat);
    setCatOffset(0);
    setWikiImages([]);
    setWikiSearchQuery("");
    setDebouncedWikiQuery("");
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
          {/* Wiki Sub-tabs */}
          <div className="wikios-commons-tabs">
            <button
              onClick={() => setWikiSource("commons")}
              className={cn(
                "wikios-commons-tab",
                wikiSource === "commons" && "wikios-commons-tab--active"
              )}
            >
              <Globe className="h-3 w-3" /> Commons
            </button>
            <button
              onClick={() => setWikiSource("ixwiki")}
              className={cn(
                "wikios-commons-tab",
                wikiSource === "ixwiki" && "wikios-commons-tab--active"
              )}
            >
              <Database className="h-3 w-3" /> IxWiki
            </button>
            <button
              onClick={() => setWikiSource("iiwiki")}
              className={cn(
                "wikios-commons-tab",
                wikiSource === "iiwiki" && "wikios-commons-tab--active"
              )}
            >
              <Database className="h-3 w-3" /> IIWiki
            </button>
            <button
              onClick={() => setWikiSource("stash")}
              className={cn(
                "wikios-commons-tab",
                wikiSource === "stash" && "wikios-commons-tab--active"
              )}
            >
              <Bookmark className="h-3 w-3" /> My Stash
            </button>
          </div>

          {/* Filter toggle button */}
          {wikiSource !== "stash" && (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsCategoryExpanded((prev) => !prev)}
                className={cn(
                  "flex h-8 items-center gap-1.5 text-xs",
                  isCategoryExpanded && "border-blue-500/50 bg-slate-100 dark:bg-white/5"
                )}
              >
                <SlidersHorizontal className="h-3.5 w-3.5" />
                Filters
              </Button>
            </div>
          )}
        </div>

        {wikiSource !== "stash" && (
          <>
            {/* Search input */}
            <div className="relative">
              <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <Input
                placeholder={
                  wikiSource === "commons"
                    ? 'Search Commons... e.g. "medieval castle", "royal portrait"'
                    : `Search ${wikiSource === "iiwiki" ? "IIWiki" : "IxWiki"} files...`
                }
                value={wikiSearchQuery}
                onChange={(e) => setWikiSearchQuery(e.target.value)}
                className="h-9 pl-9 text-xs"
              />
            </div>

            {/* Filters bar */}
            {isCategoryExpanded && (
              <div className="flex items-center justify-between gap-4 pt-1 text-[11px] transition-all">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1">
                    <span className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
                      Type:
                    </span>
                    <div className="flex gap-0.5 rounded bg-slate-100 p-0.5 dark:bg-white/5">
                      {(["all", "jpg", "png", "svg"] as const).map((type) => (
                        <button
                          key={type}
                          onClick={() => setFileTypeFilter(type)}
                          className={cn(
                            "rounded px-2 py-0.5 text-[10px] font-semibold transition-all",
                            fileTypeFilter === type
                              ? "bg-slate-200 text-slate-900 dark:bg-white/10 dark:text-white"
                              : "text-muted-foreground hover:text-foreground hover:bg-slate-200/50 dark:hover:bg-white/5"
                          )}
                        >
                          {type}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <span className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
                      Orient:
                    </span>
                    <div className="flex gap-0.5 rounded bg-slate-100 p-0.5 dark:bg-white/5">
                      {(["all", "landscape", "portrait", "square"] as const).map((orient) => (
                        <button
                          key={orient}
                          onClick={() => setOrientationFilter(orient)}
                          className={cn(
                            "rounded px-2 py-0.5 text-[10px] font-semibold transition-all",
                            orientationFilter === orient
                              ? "bg-slate-200 text-slate-900 dark:bg-white/10 dark:text-white"
                              : "text-muted-foreground hover:text-foreground hover:bg-slate-200/50 dark:hover:bg-white/5"
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
                    onClick={() => {
                      setFileTypeFilter("all");
                      setOrientationFilter("all");
                    }}
                    className="cursor-pointer font-semibold text-blue-400 hover:text-blue-300"
                  >
                    Clear Filters
                  </button>
                )}
              </div>
            )}

            {/* Active Category Chips */}
            {wikiSource === "commons" && activeCategories.length > 0 && (
              <div className="mt-1 flex flex-wrap gap-1">
                {activeCategories.map((cat) => (
                  <span
                    key={cat}
                    className="inline-flex items-center gap-1 rounded-full border border-blue-500/20 bg-blue-500/10 px-2 py-0.5 text-[10px] text-blue-400"
                  >
                    {cat}
                    <button
                      onClick={() => handleToggleCategory(cat)}
                      className="hover:text-blue-300"
                    >
                      <X className="h-2.5 w-2.5" />
                    </button>
                  </span>
                ))}
              </div>
            )}

            {browsingCategory && !isSearchMode && (
              <div className="mt-1 flex flex-wrap gap-1">
                <span className="border-border/10 text-muted-foreground inline-flex items-center gap-1 rounded-full border bg-white/5 px-2 py-0.5 text-[10px]">
                  Browsing: {browsingCategory}
                  <button
                    onClick={() => {
                      setBrowsingCategory(null);
                      setWikiImages([]);
                    }}
                    className="hover:text-white"
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
                wiki={wikiSource}
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
              <div className="wikios-commons-results flex-1">
                <div className="wikios-commons-grid">
                  {filteredWikiImages.map((img, index) => {
                    const isSelected = selectedImageObj?.pageid === img.pageid;
                    const cleanTitle = img.title.replace(/^File:/, "").replace(/_/g, " ");

                    return (
                      <button
                        key={`${img.pageid}-${img.title}-${index}`}
                        onClick={() => onSelectImage(img)}
                        onDoubleClick={onDoubleClickConfirm}
                        className={cn(
                          "wikios-commons-card relative overflow-hidden",
                          isSelected && "wikios-commons-card--selected"
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
                        <div className="wikios-commons-card-thumb">
                          <img
                            src={img.thumbUrl}
                            alt={cleanTitle}
                            loading="lazy"
                            onContextMenu={(e) => e.preventDefault()}
                          />
                          <div className="wikios-commons-card-overlay">
                            <ZoomIn className="h-5 w-5" />
                          </div>
                        </div>
                        <div className="wikios-commons-card-info text-left">
                          <span className="wikios-commons-card-title">{cleanTitle}</span>
                          <span className="wikios-commons-card-meta">
                            {img.width}×{img.height}
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
            <div className="border-border/10 w-80 shrink-0 overflow-y-auto border-l bg-slate-100/30 backdrop-blur-md dark:bg-zinc-950/20">
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
