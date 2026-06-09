// src/app/(wikios)/w/repository/page.tsx
// WikiOS Commons Explorer — category browsing, full-text search, stash integration.

"use client";

import { useState, useCallback, useRef, useEffect, useMemo, useDeferredValue } from "react";
import { WikiOSLayout } from "~/components/wikios/shared/WikiOSLayout";
import { CommonsCategoryBrowser } from "~/components/wikios/commons/CommonsCategoryBrowser";
import { CommonsResultsGrid } from "~/components/wikios/commons/CommonsResultsGrid";
import { CommonsDetailPanel } from "~/components/wikios/commons/CommonsDetailPanel";
import { usePageTitle } from "~/hooks/usePageTitle";
import { api } from "~/trpc/react";
import { Search, X, Globe, Database, HelpCircle } from "lucide-react";
import { cn } from "~/lib/utils";
import { RepositoryWelcomeModal } from "~/components/wikios/commons/RepositoryWelcomeModal";

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

type Tab = "commons" | "ixwiki" | "iiwiki";

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

export default function RepositoryPage() {
  usePageTitle({ title: "Image Repository" });

  const [tab, setTab] = useState<Tab>("commons");
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [activeCategories, setActiveCategories] = useState<string[]>([]);
  const [browsingCategory, setBrowsingCategory] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<CommonsImage | null>(null);
  const [allImages, setAllImages] = useState<CommonsImage[]>([]);
  const [searchOffset, setSearchOffset] = useState(0);
  const [catOffset, setCatOffset] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    }, 300);
  }, []);

  // Build the effective search query with category filters
  const effectiveQuery = (() => {
    const parts = activeCategories.map((c) => `deepcat:"${c}"`);
    if (debouncedQuery) parts.push(debouncedQuery);
    return parts.join(" ");
  })();

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

  // Map category to local equivalent for IxWiki/IIWiki
  const localCategoryName = useMemo(() => {
    if (!browsingCategory) return null;
    const cat = browsingCategory.toLowerCase();
    if (cat.includes("flag")) return "Flags";
    if (cat.includes("map")) return "Maps";
    if (cat.includes("castle")) return "Castles";
    if (
      cat.includes("cathedral") ||
      cat.includes("church") ||
      cat.includes("mosque") ||
      cat.includes("monastery") ||
      cat.includes("religious building")
    )
      return "Churches";
    if (cat.includes("coat of arm") || cat.includes("heraldry")) return "Coats of arms";
    if (
      cat.includes("palace") ||
      cat.includes("royal residence") ||
      cat.includes("government building")
    )
      return "Buildings";
    if (cat.includes("uniform") || cat.includes("military")) return "Military";
    if (cat.includes("portrait") || cat.includes("painting")) return "Images";
    return browsingCategory;
  }, [browsingCategory]);

  const localIsBrowseMode =
    (tab === "ixwiki" || tab === "iiwiki") && !debouncedQuery && !!localCategoryName;

  // Search local or external wiki files query
  const { data: wikiFileData, isFetching: wikiFileFetching } = api.wiki.searchFiles.useQuery(
    {
      query: debouncedQuery || undefined,
      category: localIsBrowseMode ? (localCategoryName ?? undefined) : undefined,
      limit: 50,
      wiki: tab === "iiwiki" ? "iiwiki" : "ixwiki",
    },
    {
      enabled:
        (tab === "ixwiki" || tab === "iiwiki") && (debouncedQuery.length >= 2 || localIsBrowseMode),
      staleTime: 60_000,
    }
  );

  // Merge incoming data into allImages
  useEffect(() => {
    if (tab === "commons") {
      if (searchData?.images && isSearchMode) {
        setAllImages((prev) =>
          searchOffset === 0 ? searchData.images : [...prev, ...searchData.images]
        );
      }
    }
  }, [searchData, searchOffset, isSearchMode, tab]);

  useEffect(() => {
    if (tab === "commons") {
      if (catData?.images && isBrowseMode) {
        setAllImages((prev) => (catOffset === 0 ? catData.images : [...prev, ...catData.images]));
      }
    }
  }, [catData, catOffset, isBrowseMode, tab]);

  // Map and set ixwiki/iiwiki images
  useEffect(() => {
    if (tab === "ixwiki" || tab === "iiwiki") {
      if (debouncedQuery.length < 2 && !localIsBrowseMode) {
        setAllImages([]);
        return;
      }
      if (wikiFileData) {
        const isIiwiki = tab === "iiwiki";
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
          ) => ({
            pageid: index + offset,
            title: img.name.startsWith("File:") ? img.name : `File:${img.name}`,
            thumbUrl: img.url,
            url: img.url,
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
          })
        );
        setAllImages(mapped);
      }
    }
  }, [wikiFileData, tab, debouncedQuery, localIsBrowseMode]);

  const handleLoadMore = () => {
    if (tab === "commons") {
      if (isSearchMode && searchData?.nextOffset != null) {
        setSearchOffset(searchData.nextOffset);
      } else if (isBrowseMode && catData?.nextOffset != null) {
        setCatOffset(catData.nextOffset);
      }
    }
  };

  const hasMore =
    tab === "commons"
      ? isSearchMode
        ? searchData?.nextOffset != null
        : isBrowseMode
          ? catData?.nextOffset != null
          : false
      : false;

  const handleToggleCategory = (cat: string) => {
    setActiveCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    );
    setAllImages([]);
    setSearchOffset(0);
  };

  const handleBrowseCategory = (cat: string) => {
    setBrowsingCategory(cat);
    setCatOffset(0);
    setAllImages([]);
    setDebouncedQuery("");
    setSearchQuery("");
  };

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

  return (
    <WikiOSLayout>
      <div className="wikios-commons-browser">
        {/* Header bar */}
        <div className="wikios-commons-header">
          <div className="wikios-commons-header-left flex items-center gap-2">
            <button
              onClick={() => setWelcomeOpen(true)}
              className="cursor-pointer rounded-full p-1 text-[var(--wikios-text-dim)] transition-colors hover:bg-white/5 hover:text-blue-500"
              title="Open Welcome Guide"
              type="button"
            >
              <HelpCircle className="h-4 w-4" />
            </button>
            <div className="wikios-commons-tabs">
              <button
                onClick={() => handleTabChange("commons")}
                className={`wikios-commons-tab ${tab === "commons" ? "wikios-commons-tab--active" : ""}`}
              >
                <Globe className="h-3.5 w-3.5" />
                Commons
              </button>
              <button
                onClick={() => handleTabChange("ixwiki")}
                className={`wikios-commons-tab ${tab === "ixwiki" ? "wikios-commons-tab--active" : ""}`}
              >
                <Database className="h-3.5 w-3.5" />
                IxWiki
              </button>
              <button
                onClick={() => handleTabChange("iiwiki")}
                className={`wikios-commons-tab ${tab === "iiwiki" ? "wikios-commons-tab--active" : ""}`}
              >
                <Database className="h-3.5 w-3.5" />
                IIWiki
              </button>
            </div>
          </div>

          {(tab === "commons" || tab === "ixwiki" || tab === "iiwiki") && (
            <div className="wikios-commons-search">
              <Search className="h-4 w-4 shrink-0 text-[var(--wikios-text-dim)]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                placeholder={
                  tab === "commons"
                    ? 'Search Commons... e.g. "medieval castle", "15th century portrait"'
                    : tab === "iiwiki"
                      ? 'Search IIWiki files... e.g. "map", "flag"'
                      : 'Search IxWiki files... e.g. "map", "flag"'
                }
                className="wikios-commons-search-input"
              />
              {searchQuery && (
                <button
                  onClick={() => {
                    handleSearch("");
                    setAllImages([]);
                  }}
                  className="text-[var(--wikios-text-dim)] hover:text-[var(--wikios-text)]"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          )}
        </div>

        {/* Filter controls */}
        {(tab === "commons" || tab === "ixwiki" || tab === "iiwiki") && (
          <div className="mb-3 flex flex-wrap items-center justify-between gap-4 border-b border-white/5 px-1 pb-3 text-xs">
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
              {/* File Type Filter */}
              <div className="flex items-center gap-1.5">
                <span className="text-[9px] font-semibold tracking-wider text-[var(--wikios-text-dim)] uppercase">
                  Type:
                </span>
                <div className="wikios-filter-group">
                  {(["all", "jpg", "png", "svg"] as const).map((type) => (
                    <button
                      key={type}
                      onClick={() => setFileTypeFilter(type)}
                      className={cn(
                        "wikios-filter-btn",
                        fileTypeFilter === type && "wikios-filter-btn--active"
                      )}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>

              {/* Orientation Filter */}
              <div className="flex items-center gap-1.5">
                <span className="text-[9px] font-semibold tracking-wider text-[var(--wikios-text-dim)] uppercase">
                  Orientation:
                </span>
                <div className="wikios-filter-group">
                  {(["all", "landscape", "portrait", "square"] as const).map((orient) => (
                    <button
                      key={orient}
                      onClick={() => setOrientationFilter(orient)}
                      className={cn(
                        "wikios-filter-btn",
                        orientationFilter === orient && "wikios-filter-btn--active"
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
            {(fileTypeFilter !== "all" || orientationFilter !== "all") && (
              <button
                onClick={() => {
                  setFileTypeFilter("all");
                  setOrientationFilter("all");
                }}
                className="cursor-pointer text-[9px] font-bold tracking-wider text-[var(--wikios-accent)] uppercase select-none hover:underline"
              >
                Clear Filters
              </button>
            )}
          </div>
        )}

        {/* Active category chips */}
        {tab === "commons" && activeCategories.length > 0 && (
          <div className="wikios-commons-chips">
            {activeCategories.map((cat) => (
              <button
                key={cat}
                onClick={() => handleToggleCategory(cat)}
                className="wikios-commons-chip"
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
              Browsing: {browsingCategory} {localIsBrowseMode && `(${localCategoryName})`}
              <button
                onClick={() => {
                  setBrowsingCategory(null);
                  setAllImages([]);
                }}
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
          <CommonsCategoryBrowser
            activeCategories={activeCategories}
            browsingCategory={browsingCategory}
            onToggleCategory={handleToggleCategory}
            onBrowseCategory={handleBrowseCategory}
            wiki={tab === "commons" ? "commons" : tab === "iiwiki" ? "iiwiki" : "ixwiki"}
          />

          <CommonsResultsGrid
            images={filteredImages}
            selectedImage={selectedImage}
            onSelect={setSelectedImage}
            onLoadMore={handleLoadMore}
            hasMore={hasMore}
            isLoading={tab === "commons" ? searchFetching || catFetching : wikiFileFetching}
            totalHits={tab === "commons" ? searchData?.totalHits : wikiFileData?.length}
          />

          {selectedImage && (
            <CommonsDetailPanel image={selectedImage} onClose={() => setSelectedImage(null)} />
          )}
        </div>
      </div>
      <RepositoryWelcomeModal open={welcomeOpen} onOpenChangeAction={setWelcomeOpen} />
    </WikiOSLayout>
  );
}
