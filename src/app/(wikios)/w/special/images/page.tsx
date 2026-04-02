// src/app/(wikios)/w/special/images/page.tsx
// WikiOS Commons Explorer — category browsing, full-text search, stash integration.

"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { WikiOSLayout } from "~/components/wikios/shared/WikiOSLayout";
import { CommonsCategoryBrowser } from "~/components/wikios/commons/CommonsCategoryBrowser";
import { CommonsResultsGrid } from "~/components/wikios/commons/CommonsResultsGrid";
import { CommonsDetailPanel } from "~/components/wikios/commons/CommonsDetailPanel";
import { ImageSearchGrid } from "~/components/wikios/editor/ImageSearchGrid";
import { usePageTitle } from "~/hooks/usePageTitle";
import { api } from "~/trpc/react";
import { Search, X, Globe, Database } from "lucide-react";

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

type Tab = "commons" | "ixwiki";

export default function ImagesPage() {
  usePageTitle({ title: "Image Browser" });

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

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

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

  // Merge incoming data into allImages
  useEffect(() => {
    if (searchData?.images && isSearchMode) {
      setAllImages((prev) =>
        searchOffset === 0 ? searchData.images : [...prev, ...searchData.images]
      );
    }
  }, [searchData, searchOffset, isSearchMode]);

  useEffect(() => {
    if (catData?.images && isBrowseMode) {
      setAllImages((prev) =>
        catOffset === 0 ? catData.images : [...prev, ...catData.images]
      );
    }
  }, [catData, catOffset, isBrowseMode]);

  const handleLoadMore = () => {
    if (isSearchMode && searchData?.nextOffset != null) {
      setSearchOffset(searchData.nextOffset);
    } else if (isBrowseMode && catData?.nextOffset != null) {
      setCatOffset(catData.nextOffset);
    }
  };

  const hasMore = isSearchMode
    ? searchData?.nextOffset != null
    : isBrowseMode
      ? catData?.nextOffset != null
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

  return (
    <WikiOSLayout>
      <div className="wikios-commons-browser">
        {/* Header bar */}
        <div className="wikios-commons-header">
          <div className="wikios-commons-header-left">
            <div className="wikios-commons-tabs">
              <button
                onClick={() => setTab("commons")}
                className={`wikios-commons-tab ${tab === "commons" ? "wikios-commons-tab--active" : ""}`}
              >
                <Globe className="h-3.5 w-3.5" />
                Commons
              </button>
              <button
                onClick={() => setTab("ixwiki")}
                className={`wikios-commons-tab ${tab === "ixwiki" ? "wikios-commons-tab--active" : ""}`}
              >
                <Database className="h-3.5 w-3.5" />
                IxWiki
              </button>
            </div>
          </div>

          {tab === "commons" && (
            <div className="wikios-commons-search">
              <Search className="h-4 w-4 shrink-0 text-[var(--wikios-text-dim)]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                placeholder="Search images... e.g. &quot;medieval castle&quot;, &quot;15th century portrait&quot;"
                className="wikios-commons-search-input"
              />
              {searchQuery && (
                <button onClick={() => { handleSearch(""); setAllImages([]); }} className="text-[var(--wikios-text-dim)] hover:text-[var(--wikios-text)]">
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          )}
        </div>

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
        {tab === "commons" && browsingCategory && !isSearchMode && (
          <div className="wikios-commons-chips">
            <span className="wikios-commons-chip wikios-commons-chip--browse">
              Browsing: {browsingCategory}
              <button onClick={() => { setBrowsingCategory(null); setAllImages([]); }}>
                <X className="h-3 w-3" />
              </button>
            </span>
          </div>
        )}

        {/* Main panels */}
        {tab === "commons" ? (
          <div className={`wikios-commons-panels ${selectedImage ? "wikios-commons-panels--detail" : ""}`}>
            <CommonsCategoryBrowser
              activeCategories={activeCategories}
              onToggleCategory={handleToggleCategory}
              onBrowseCategory={handleBrowseCategory}
            />
            <CommonsResultsGrid
              images={allImages}
              selectedImage={selectedImage}
              onSelect={setSelectedImage}
              onLoadMore={handleLoadMore}
              hasMore={hasMore}
              isLoading={searchFetching || catFetching}
              totalHits={searchData?.totalHits}
            />
            {selectedImage && (
              <CommonsDetailPanel
                image={selectedImage}
                onClose={() => setSelectedImage(null)}
              />
            )}
          </div>
        ) : (
          <div className="wikios-commons-ixwiki">
            <ImageSearchGrid />
          </div>
        )}
      </div>
    </WikiOSLayout>
  );
}
