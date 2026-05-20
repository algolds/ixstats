import React, { useState, useRef, useEffect, useCallback } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Search, Loader2, X, CheckCircle, ChevronDown, ExternalLink, Globe, Users, DollarSign, MapPin, Building, Filter } from "lucide-react";
import { cn } from "~/lib/utils";
import { withBasePath } from "~/lib/base-path";
import { sanitizeWikiContent } from "~/lib/sanitize-html";
import { IconSwap, IconSwapItem } from "~/components/icon-swap";

// ─── Types ───

interface WikiSite {
  name: string;
  displayName: string;
  baseUrl: string;
  theme: "blue" | "indigo";
}

interface SearchResult {
  title: string;
  snippet: string;
  url: string;
  namespace?: number;
  flagUrl?: string | null;
  population?: number;
  gdpPerCapita?: number;
  capital?: string;
  government?: string;
}

interface ParsedCountryData {
  wikiIntro?: string;
  flagUrl?: string | null;
  [key: string]: unknown;
}

const logoMap: Record<string, string> = {
  ixwiki: "/images/ix-logo.svg",
  iiwiki: "/images/IIWikiLogo.png",
  althistory: "/images/althistory-logo.webp",
};

// ─── Props ───

interface DynamicIslandSearchProps {
  selectedSite: WikiSite;
  wikiSites: WikiSite[];
  onSelectSite: (site: WikiSite) => void;
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  isSearching: boolean;
  searchResults: SearchResult[];
  displayedResults: SearchResult[];
  hasMoreResults: boolean;
  selectedResult: SearchResult | null;
  isLoading: boolean;
  parsedData: ParsedCountryData | null;
  error: string | null;
  selectedCountryFlag: string | null;
  categoryFilter: string;
  setCategoryFilter: (filter: string) => void;
  popularCategories: string[];
  handleSelectResult: (result: SearchResult) => void;
  loadMoreResults: () => void;
  onCountryPreview?: (result: SearchResult) => void;
  onContinueWithCountry?: (result: SearchResult) => void;
  formatNumber: (num: number | undefined, decimals?: number) => string;
  onBackFromSelection: () => void;
}

// ─── Component ───

export const DynamicIslandSearch: React.FC<DynamicIslandSearchProps> = ({
  selectedSite,
  searchTerm,
  setSearchTerm,
  isSearching,
  displayedResults,
  hasMoreResults,
  selectedResult,
  isLoading,
  parsedData,
  error,
  selectedCountryFlag,
  categoryFilter,
  setCategoryFilter,
  popularCategories,
  handleSelectResult,
  loadMoreResults,
  onContinueWithCountry,
  formatNumber,
  onBackFromSelection,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [showCategories, setShowCategories] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const [previewingCountry, setPreviewingCountry] = useState<SearchResult | null>(null);
  const [previewImgError, setPreviewImgError] = useState(false);
  const [flagImgError, setFlagImgError] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const resultRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Reset errors when country selection changes
  useEffect(() => {
    setPreviewImgError(false);
  }, [previewingCountry]);

  useEffect(() => {
    setFlagImgError(false);
  }, [selectedCountryFlag]);

  // Auto-focus input and show results when expanded
  useEffect(() => {
    if (isExpanded && inputRef.current) {
      inputRef.current.focus();
      setShowResults(true);
    }
  }, [isExpanded]);

  // Reset focus and show results when results change
  useEffect(() => {
    setFocusedIndex(-1);
    if (displayedResults.length > 0) {
      setShowResults(true);
    }
  }, [displayedResults.length]);

  // Scroll focused item into view
  useEffect(() => {
    if (focusedIndex >= 0 && resultRefs.current[focusedIndex]) {
      resultRefs.current[focusedIndex]?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [focusedIndex]);

  // Collapse when parsed
  useEffect(() => {
    if (parsedData) {
      setIsExpanded(false);
      setPreviewingCountry(null);
      setShowCategories(false);
    }
  }, [parsedData]);

  // Reset when backing out
  useEffect(() => {
    if (!selectedResult && !parsedData) {
      setPreviewingCountry(null);
      setFocusedIndex(-1);
    }
  }, [selectedResult, parsedData]);

  // Click outside to collapse results dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (isExpanded && containerRef.current && !containerRef.current.contains(e.target as Node)) {
        // Always hide results and categories on outside click
        setShowResults(false);
        setShowCategories(false);
        // Only fully collapse if there's no search term
        if (!searchTerm.trim()) {
          setIsExpanded(false);
        }
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isExpanded, searchTerm]);

  const handleExpand = useCallback(() => {
    setIsExpanded(true);
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (showCategories) {
        if (e.key === "Escape") {
          setShowCategories(false);
          inputRef.current?.focus();
        }
        return;
      }

      if (previewingCountry) {
        if (e.key === "Escape") {
          setPreviewingCountry(null);
          setFocusedIndex(-1);
        }
        return;
      }

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setFocusedIndex((i) => Math.min(i + 1, displayedResults.length - 1));
          break;
        case "ArrowUp":
          e.preventDefault();
          setFocusedIndex((i) => Math.max(i - 1, 0));
          break;
        case "Enter":
          e.preventDefault();
          if (focusedIndex >= 0 && displayedResults[focusedIndex]) {
            handleCountrySelect(displayedResults[focusedIndex]);
          }
          break;
        case "Escape":
          e.preventDefault();
          if (previewingCountry) {
            setPreviewingCountry(null);
          } else if (!searchTerm.trim()) {
            setIsExpanded(false);
          } else {
            setFocusedIndex(-1);
          }
          break;
      }
    },
    [displayedResults, focusedIndex, previewingCountry, searchTerm, handleSelectResult, showCategories]
  );

  const handleCountrySelect = useCallback(
    (result: SearchResult) => {
      if (categoryFilter.toLowerCase() === "countries" || categoryFilter.toLowerCase() === "nations") {
        setPreviewingCountry(result);
      } else {
        handleSelectResult(result);
      }
    },
    [categoryFilter, handleSelectResult]
  );

  const handleCancelPreview = useCallback(() => {
    setPreviewingCountry(null);
    setFocusedIndex(-1);
  }, []);

  const handleContinueWithPreview = useCallback(() => {
    if (previewingCountry && onContinueWithCountry) {
      onContinueWithCountry(previewingCountry);
    }
    setPreviewingCountry(null);
  }, [previewingCountry, onContinueWithCountry]);

  const isParsing = !!selectedResult && !parsedData;
  const isParsed = !!parsedData;

  const guaranteedCategories = ["Countries", "Nations"];
  const allCategories = [
    ...guaranteedCategories,
    ...popularCategories.filter((cat) => !guaranteedCategories.includes(cat)),
  ];

  return (
    <div ref={containerRef} className="relative" onKeyDown={handleKeyDown}>
      <AnimatePresence mode="popLayout">
        {/* ─── Parsing Pill ─── */}
        {isParsing && (
          <motion.div
            key="parsing"
            initial={{ opacity: 0, scale: 0.8, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: -10 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            className="flex items-center gap-3 rounded-full border px-4 py-2.5 shadow-lg backdrop-blur-md"
            style={{
              backgroundColor: "var(--color-bg-surface)/80",
              borderColor: "var(--color-border-primary)",
            }}
          >
            {selectedCountryFlag && !flagImgError ? (
              <img
                src={selectedCountryFlag}
                alt="Flag"
                className="h-4 w-6 rounded-sm border object-cover shadow-sm"
                style={{ borderColor: "var(--color-border-primary)" }}
                referrerPolicy="no-referrer"
                onError={() => setFlagImgError(true)}
              />
            ) : (
              <Globe className="h-4 w-5" style={{ color: "var(--color-text-muted)" }} />
            )}
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
            >
              <Loader2 className="h-4 w-4" style={{ color: "var(--color-text-muted)" }} />
            </motion.div>
            <span className="text-sm font-medium" style={{ color: "var(--color-text-primary)" }}>
              Parsing {selectedResult.title}...
            </span>
          </motion.div>
        )}

        {/* ─── Parsed Pill ─── */}
        {isParsed && (
          <motion.div
            key="parsed"
            initial={{ opacity: 0, scale: 0.8, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: -10 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            className="flex items-center gap-3 rounded-full border px-4 py-2.5 shadow-lg backdrop-blur-md"
            style={{
              backgroundColor: "var(--color-bg-surface)/80",
              borderColor: "var(--color-border-primary)",
            }}
          >
            {selectedCountryFlag && !flagImgError ? (
              <img
                src={selectedCountryFlag}
                alt="Flag"
                className="h-4 w-6 rounded-sm border object-cover shadow-sm"
                style={{ borderColor: "var(--color-border-primary)" }}
                referrerPolicy="no-referrer"
                onError={() => setFlagImgError(true)}
              />
            ) : (
              <Globe className="h-4 w-5" style={{ color: "var(--color-text-muted)" }} />
            )}
            <CheckCircle className="h-4 w-4 text-green-500" />
            <span className="text-sm font-medium" style={{ color: "var(--color-text-primary)" }}>
              Parsed {(parsedData?.common_name as string) || (parsedData?.official_name as string) || selectedResult?.title || "country"}
            </span>
          </motion.div>
        )}

        {/* ─── Search Island ─── */}
        {!isParsing && !isParsed && (
          <motion.div
            key="search"
            layout
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            className={cn(
              "overflow-hidden rounded-2xl border shadow-lg backdrop-blur-md",
              isExpanded ? "p-0" : "cursor-pointer"
            )}
            style={{
              backgroundColor: "var(--color-bg-surface)/80",
              borderColor: isExpanded
                ? "rgba(59, 130, 246, 0.3)"
                : "var(--color-border-primary)",
            }}
            onClick={!isExpanded ? handleExpand : undefined}
          >
            {/* ─── Collapsed State ─── */}
            {!isExpanded && (
              <motion.div
                initial={false}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex items-center gap-3 px-4 py-2.5"
              >
                <Search className="h-4 w-4 flex-shrink-0" style={{ color: "var(--color-text-muted)" }} />
                <span className="text-sm" style={{ color: "var(--color-text-muted)" }}>
                  Search {selectedSite.displayName}...
                </span>
                <div className="ml-auto flex items-center gap-2">
                  <img
                    src={withBasePath(logoMap[selectedSite.name]!)}
                    alt={selectedSite.displayName}
                    className="h-4 w-4 object-contain opacity-60"
                  />
                  <ChevronDown className="h-3 w-3" style={{ color: "var(--color-text-muted)" }} />
                </div>
              </motion.div>
            )}

            {/* ─── Expanded State ─── */}
            {isExpanded && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
              >
                {/* Search Input Row */}
                <div className="flex items-center gap-2 border-b px-3 py-2.5" style={{ borderColor: "var(--color-border-primary)" }}>
                  {/* Category Filter Icon */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowCategories((prev) => !prev);
                    }}
                    className={cn(
                      "flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md transition-colors",
                      showCategories
                        ? "bg-blue-500/15 text-blue-400"
                        : "hover:bg-accent/50 text-muted-foreground"
                    )}
                    title="Filter by category"
                  >
                    <Filter className="h-4 w-4" />
                  </button>

                  {/* Search Icon */}
                  {isSearching ? (
                    <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: "linear" }}>
                      <Loader2 className="h-4 w-4 flex-shrink-0" style={{ color: "var(--color-text-muted)" }} />
                    </motion.div>
                  ) : (
                    <Search className="h-4 w-4 flex-shrink-0" style={{ color: "var(--color-text-muted)" }} />
                  )}

                  {/* Search Input */}
                  <input
                    ref={inputRef}
                    type="text"
                    placeholder={`Search ${categoryFilter} on ${selectedSite.displayName}...`}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    onFocus={() => setShowResults(true)}
                    className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                    style={{ color: "var(--color-text-primary)" }}
                  />

                  {/* Clear Button */}
                  {searchTerm && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSearchTerm("");
                        inputRef.current?.focus();
                      }}
                      className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full transition-colors hover:bg-accent"
                    >
                      <X className="h-3 w-3" style={{ color: "var(--color-text-muted)" }} />
                    </button>
                  )}

                  {/* Wiki Logo */}
                  <div className="flex flex-shrink-0 items-center gap-1.5">
                    <IconSwap>
                      <IconSwapItem key={selectedSite.name}>
                        <img
                          src={withBasePath(logoMap[selectedSite.name]!)}
                          alt={selectedSite.displayName}
                          className="h-4 w-4 object-contain opacity-60"
                        />
                      </IconSwapItem>
                    </IconSwap>
                  </div>
                </div>

                {/* Category Selector Panel */}
                <AnimatePresence>
                  {showCategories && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2, ease: "easeInOut" }}
                      className="overflow-hidden border-b"
                      style={{ borderColor: "var(--color-border-primary)" }}
                    >
                      <div className="px-3 py-3">
                        <div className="mb-2 text-xs font-medium" style={{ color: "var(--color-text-muted)" }}>
                          Category: {categoryFilter}
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {allCategories.map((cat) => (
                            <button
                              key={cat}
                              onClick={(e) => {
                                e.stopPropagation();
                                setCategoryFilter(cat);
                                if (searchTerm.trim()) {
                                  // Re-trigger search with new category
                                  setSearchTerm(searchTerm);
                                }
                              }}
                              className={cn(
                                "rounded-md border px-2.5 py-1 text-xs font-medium transition-all",
                                categoryFilter === cat
                                  ? "border-blue-400/50 bg-blue-500/15 text-foreground"
                                  : "border-border/50 bg-transparent text-muted-foreground hover:border-blue-400/30"
                              )}
                            >
                              {cat}
                            </button>
                          ))}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Content Area — inline scroll, hides on blur */}
                {showResults && (
                <div className="scrollbar-thin relative max-h-56 overflow-y-auto">
                  {/* Searching Status */}
                  {isSearching && searchTerm.trim() && displayedResults.length === 0 && (
                    <div className="flex items-center justify-center gap-3 py-8">
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                      >
                        <Loader2 className="h-5 w-5" style={{ color: "var(--color-text-muted)" }} />
                      </motion.div>
                      <span className="text-sm" style={{ color: "var(--color-text-muted)" }}>
                        Searching {categoryFilter} on {selectedSite.displayName}...
                      </span>
                    </div>
                  )}

                  {/* Error Status */}
                  {error && (
                    <div className="px-4 py-6 text-center">
                      <p className="text-sm text-red-400">{error}</p>
                    </div>
                  )}

                  {/* No Results */}
                  {!isSearching && searchTerm.trim() && displayedResults.length === 0 && !error && (
                    <div className="px-4 py-8 text-center">
                      <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
                        No results found for "{searchTerm}"
                      </p>
                    </div>
                  )}

                  {/* Results List */}
                  {displayedResults.length > 0 && (
                    <div className="p-3">
                      <div className="space-y-2">
                        {displayedResults.map((result, index) => (
                          <div
                            key={index}
                            ref={(el) => {
                              resultRefs.current[index] = el;
                            }}
                          >
                            <SearchResultItemInline
                              result={result}
                              index={index}
                              isSelected={selectedResult?.title === result.title}
                              isFocused={focusedIndex === index}
                              onSelect={() => handleCountrySelect(result)}
                              onFocus={() => setFocusedIndex(index)}
                              categoryFilter={categoryFilter}
                              formatNumber={formatNumber}
                            />
                          </div>
                        ))}
                      </div>

                      {hasMoreResults && (
                        <div className="mt-4 text-center">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              loadMoreResults();
                            }}
                            className="rounded-lg border px-4 py-2 text-sm transition-colors hover:bg-accent/50"
                            style={{
                              borderColor: "var(--color-border-primary)",
                              color: "var(--color-text-muted)",
                            }}
                          >
                            Load more ({displayedResults.length} of {displayedResults.length + (hasMoreResults ? 10 : 0)})
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Country Preview Overlay */}
                  <AnimatePresence>
                    {previewingCountry && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 10 }}
                        transition={{ type: "spring", stiffness: 400, damping: 30 }}
                        className="scrollbar-thin absolute inset-0 z-10 overflow-y-auto bg-background/95 backdrop-blur-md"
                      >
                        <div className="p-4">
                          <button
                            onClick={handleCancelPreview}
                            className="mb-4 flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-accent/50"
                            style={{
                              borderColor: "var(--color-border-primary)",
                              color: "var(--color-text-primary)",
                            }}
                          >
                            <X className="h-3.5 w-3.5" />
                            Back to results
                          </button>

                          <div className="mb-4 flex items-center gap-3">
                            {previewingCountry.flagUrl && !previewImgError ? (
                              <img
                                src={previewingCountry.flagUrl}
                                alt="Flag"
                                className="h-8 w-12 rounded border object-cover shadow-sm"
                                style={{ borderColor: "var(--color-border-primary)" }}
                                referrerPolicy="no-referrer"
                                onError={() => setPreviewImgError(true)}
                              />
                            ) : (
                              <div
                                className="flex h-8 w-12 items-center justify-center rounded border"
                                style={{ borderColor: "var(--color-border-primary)" }}
                              >
                                <Globe className="h-5 w-5" style={{ color: "var(--color-text-muted)" }} />
                              </div>
                            )}
                            <div>
                              <h3 className="text-lg font-semibold" style={{ color: "var(--color-text-primary)" }}>
                                {previewingCountry.title}
                              </h3>
                              <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                                Country Preview
                              </p>
                            </div>
                          </div>

                          {(previewingCountry.population || previewingCountry.gdpPerCapita || previewingCountry.capital || previewingCountry.government) && (
                            <div className="mb-4 grid grid-cols-2 gap-2 md:grid-cols-4">
                              {previewingCountry.population && (
                                <div className="rounded-lg border p-3" style={{ borderColor: "var(--color-border-primary)" }}>
                                  <div className="mb-1 flex items-center gap-1.5">
                                    <Users className="h-3 w-3" style={{ color: "var(--color-info)" }} />
                                    <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>Population</span>
                                  </div>
                                  <p className="text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>
                                    {formatNumber(previewingCountry.population, 0)}
                                  </p>
                                </div>
                              )}
                              {previewingCountry.gdpPerCapita && (
                                <div className="rounded-lg border p-3" style={{ borderColor: "var(--color-border-primary)" }}>
                                  <div className="mb-1 flex items-center gap-1.5">
                                    <DollarSign className="h-3 w-3" style={{ color: "var(--color-success)" }} />
                                    <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>GDP/Capita</span>
                                  </div>
                                  <p className="text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>
                                    ${formatNumber(previewingCountry.gdpPerCapita)}
                                  </p>
                                </div>
                              )}
                              {previewingCountry.capital && (
                                <div className="rounded-lg border p-3" style={{ borderColor: "var(--color-border-primary)" }}>
                                  <div className="mb-1 flex items-center gap-1.5">
                                    <MapPin className="h-3 w-3" style={{ color: "var(--color-error)" }} />
                                    <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>Capital</span>
                                  </div>
                                  <p
                                    className="truncate text-sm font-semibold"
                                    style={{ color: "var(--color-text-primary)" }}
                                    dangerouslySetInnerHTML={{ __html: sanitizeWikiContent(previewingCountry.capital) }}
                                  />
                                </div>
                              )}
                              {previewingCountry.government && (
                                <div className="rounded-lg border p-3" style={{ borderColor: "var(--color-border-primary)" }}>
                                  <div className="mb-1 flex items-center gap-1.5">
                                    <Building className="h-3 w-3" style={{ color: "var(--color-brand-secondary)" }} />
                                    <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>Government</span>
                                  </div>
                                  <p
                                    className="truncate text-sm font-semibold"
                                    style={{ color: "var(--color-text-primary)" }}
                                    dangerouslySetInnerHTML={{ __html: sanitizeWikiContent(previewingCountry.government) }}
                                  />
                                </div>
                              )}
                            </div>
                          )}

                          <p
                            className="mb-4 text-sm leading-relaxed"
                            style={{ color: "var(--color-text-secondary)" }}
                            dangerouslySetInnerHTML={{ __html: sanitizeWikiContent(previewingCountry.snippet) }}
                          />

                          <div className="flex gap-3">
                            <button
                              onClick={handleCancelPreview}
                              className="flex-1 rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors hover:bg-accent/50"
                              style={{
                                borderColor: "var(--color-border-primary)",
                                color: "var(--color-text-primary)",
                              }}
                            >
                              Cancel
                            </button>
                            <button
                              onClick={handleContinueWithPreview}
                              className="flex-1 rounded-lg bg-blue-500 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-600"
                            >
                              Import Country
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
                )}
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ─── Inline Result Item (simplified for island) ───

interface SearchResultItemInlineProps {
  result: SearchResult;
  index: number;
  isSelected: boolean;
  isFocused: boolean;
  onSelect: () => void;
  onFocus: () => void;
  categoryFilter: string;
  formatNumber: (num: number | undefined, decimals?: number) => string;
}

function SearchResultItemInline({
  result,
  index,
  isSelected,
  isFocused,
  onSelect,
  onFocus,
  categoryFilter,
  formatNumber,
}: SearchResultItemInlineProps) {
  const [imgError, setImgError] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03 }}
      onClick={onSelect}
      onFocus={onFocus}
      className={cn(
        "group flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-left transition-all duration-150",
        isFocused && "ring-2 ring-blue-500/50",
        isSelected && "bg-blue-500/10"
      )}
      style={{
        backgroundColor: isSelected ? undefined : "var(--color-bg-secondary)",
        borderColor: isSelected ? "rgba(59, 130, 246, 0.3)" : "var(--color-border-primary)",
      }}
    >
      {/* Flag */}
      {result.flagUrl && !imgError ? (
        <img
          src={result.flagUrl}
          alt={`Flag of ${result.title}`}
          className="mt-0.5 h-5 w-8 flex-shrink-0 rounded-sm border object-cover shadow-sm"
          style={{ borderColor: "var(--color-border-primary)" }}
          referrerPolicy="no-referrer"
          onError={() => setImgError(true)}
        />
      ) : (
        <div
          className="flex h-5 w-8 flex-shrink-0 items-center justify-center rounded-sm border"
          style={{ borderColor: "var(--color-border-primary)" }}
        >
          <Globe className="h-3 w-3" style={{ color: "var(--color-text-muted)" }} />
        </div>
      )}

      {/* Content */}
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex items-center justify-between gap-2">
          <h4 className="truncate text-sm font-medium" style={{ color: "var(--color-text-primary)" }}>
            {result.title}
          </h4>
          <ExternalLink className="h-3 w-3 flex-shrink-0 opacity-0 transition-opacity group-hover:opacity-100" style={{ color: "var(--color-text-muted)" }} />
        </div>

        {/* Country info or snippet */}
        {(categoryFilter.toLowerCase() === "countries" || categoryFilter.toLowerCase() === "nations") &&
        (result.population || result.gdpPerCapita || result.capital || result.government) ? (
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs" style={{ color: "var(--color-text-muted)" }}>
            {result.population && (
              <span className="flex items-center gap-1">
                <Users className="h-3 w-3" style={{ color: "var(--color-info)" }} />
                {formatNumber(result.population, 0)}
              </span>
            )}
            {result.gdpPerCapita && (
              <span className="flex items-center gap-1">
                <DollarSign className="h-3 w-3" style={{ color: "var(--color-success)" }} />
                ${formatNumber(result.gdpPerCapita)}
              </span>
            )}
            {result.capital && (
              <span
                className="flex items-center gap-1 truncate"
                dangerouslySetInnerHTML={{ __html: sanitizeWikiContent(result.capital) }}
              />
            )}
            {result.government && (
              <span
                className="flex items-center gap-1 truncate"
                dangerouslySetInnerHTML={{ __html: sanitizeWikiContent(result.government) }}
              />
            )}
          </div>
        ) : (
          <p
            className="line-clamp-2 text-xs leading-relaxed"
            style={{ color: "var(--color-text-muted)" }}
            dangerouslySetInnerHTML={{ __html: sanitizeWikiContent(result.snippet) }}
          />
        )}
      </div>
    </motion.div>
  );
}
