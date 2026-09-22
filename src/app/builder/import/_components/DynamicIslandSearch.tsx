"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  Search,
  SystemRestart as Loader2,
  Xmark as X,
  NavArrowDown as ChevronDown,
  OpenNewWindow as ExternalLink,
  Globe,
  Group as Users,
  Dollar as DollarSign,
  Check,
  FilterList,
} from "iconoir-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
} from "~/components/ui/dropdown-menu";
import { soundEffects } from "~/lib/sound/cuelume";
import { cn, sanitizeWikiContent } from "~/lib/utils";
import { withBasePath } from "~/lib/base-path";
import type { UnifiedInfoboxData } from "~/lib/wiki-os/adapters/ixstates/unified-parser";
import { GOV_PRESETS, SORT_OPTIONS } from "./EligibleCountryGrid";

// ─── Types ───

export interface WikiSite {
  name: string;
  displayName: string;
  baseUrl: string;
  description: string;
  categoryFilter?: string;
  theme: "blue" | "indigo";
  gradient: string;
}

export interface SearchResult {
  title: string;
  snippet: string;
  url?: string;
  namespace?: number;
  flagUrl?: string | null;
  population?: number;
  gdpPerCapita?: number;
  capital?: string;
  government?: string;
}

export type ParsedCountryData = UnifiedInfoboxData;
export type PreviewCountryData = SearchResult & Partial<ParsedCountryData>;

const logoMap: Record<string, string> = {
  ixwiki: "/images/ix-logo.svg",
  iiwiki: "/images/IIWikiLogo.png",
  althistory: "/images/althistory-logo.webp",
};

// ─── Props ───

export interface DynamicIslandSearchProps {
  selectedSite: WikiSite;
  wikiSites: WikiSite[];
  onSelectSite: (site: WikiSite) => void;
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  isSearching: boolean;
  searchResults: SearchResult[];
  selectedResult: SearchResult | null;
  isLoading: boolean;
  parsedData: ParsedCountryData | null;
  error: string | null;
  selectedCountryFlag: string | null;
  handleSelectResult: (result: SearchResult) => void;
  formatNumber: (num: number | undefined, decimals?: number) => string;
  onBackFromSelection?: () => void;
  selectedGov: string;
  onSelectGov: (gov: string) => void;
  sortOption: string;
  onSelectSort: (sort: string) => void;
  nationCount: number;
  hasActiveFilters: boolean;
  onClearFilters: () => void;
}

// ─── Component ───

export const DynamicIslandSearch: React.FC<DynamicIslandSearchProps> = ({
  selectedSite,
  wikiSites,
  onSelectSite,
  searchTerm,
  setSearchTerm,
  isSearching,
  searchResults,
  selectedResult,
  parsedData,
  error,
  selectedCountryFlag,
  handleSelectResult,
  formatNumber,
  selectedGov,
  onSelectGov,
  sortOption,
  onSelectSort,
  nationCount,
  hasActiveFilters,
  onClearFilters,
}) => {
  const [showResults, setShowResults] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const [flagImgError, setFlagImgError] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const resultRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    setFlagImgError(false);
  }, [selectedCountryFlag]);

  // Reset focus when results change
  useEffect(() => {
    setFocusedIndex(-1);
    if (searchResults.length > 0) {
      setShowResults(true);
    }
  }, [searchResults.length]);

  // Scroll focused item into view
  useEffect(() => {
    if (focusedIndex >= 0 && resultRefs.current[focusedIndex]) {
      resultRefs.current[focusedIndex]?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [focusedIndex]);

  // Collapse results when country is parsed or selected
  useEffect(() => {
    if (parsedData || selectedResult) {
      setShowResults(false);
    }
  }, [parsedData, selectedResult]);

  // Click outside to collapse results dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowResults(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      switch (e.key) {
        case "ArrowDown":
          if (showResults && searchResults.length > 0) {
            e.preventDefault();
            setFocusedIndex((i) => Math.min(i + 1, searchResults.length - 1));
          }
          break;
        case "ArrowUp":
          if (showResults && searchResults.length > 0) {
            e.preventDefault();
            setFocusedIndex((i) => Math.max(i - 1, 0));
          }
          break;
        case "Enter":
          if (showResults && focusedIndex >= 0 && searchResults[focusedIndex]) {
            e.preventDefault();
            handleSelectResult(searchResults[focusedIndex]!);
            setShowResults(false);
          }
          break;
        case "Escape":
          e.preventDefault();
          setShowResults(false);
          setFocusedIndex(-1);
          break;
      }
    },
    [showResults, searchResults, focusedIndex, handleSelectResult]
  );

  const isParsing = Boolean(selectedResult && !parsedData);
  const isParsed = Boolean(parsedData);

  return (
    <div ref={containerRef} className="relative" onKeyDown={handleKeyDown}>
      <AnimatePresence mode="popLayout">
        {/* ─── Parsing Pill ─── */}
        {isParsing && (
          <motion.div
            key="parsing"
            initial={{ opacity: 0, scale: 0.95, y: -6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -6 }}
            transition={{ type: "spring", bounce: 0, duration: 0.25 }}
            className="border-border bg-card/85 flex items-center gap-3 rounded-full border px-4 py-2.5 shadow-lg backdrop-blur-md"
          >
            {selectedCountryFlag && !flagImgError ? (
              <img
                src={selectedCountryFlag}
                alt="Flag"
                className="border-border h-4 w-6 rounded-sm border object-cover shadow-sm"
                referrerPolicy="no-referrer"
                onError={() => setFlagImgError(true)}
              />
            ) : (
              <Globe className="text-muted-foreground h-4 w-5" />
            )}
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
            >
              <Loader2 className="text-muted-foreground h-4 w-4" />
            </motion.div>
            <span className="text-foreground text-sm font-medium">
              Parsing {selectedResult?.title}...
            </span>
          </motion.div>
        )}

        {/* ─── Unified Search & Filter Island ─── */}
        {!isParsing && !isParsed && (
          <div className="border-border/70 bg-card/85 relative w-full rounded-2xl border p-2 sm:p-2.5 shadow-lg backdrop-blur-md transition-all">
            <div className="flex flex-col gap-2.5 md:flex-row md:items-center md:justify-between">
              {/* Left Group: Wiki Source Selector + Search Input */}
              <div className="flex min-w-0 flex-1 items-center gap-2">
                {/* Wiki Switcher Dropdown */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      data-cuelume-press
                      className="hover:bg-accent/50 flex shrink-0 cursor-pointer items-center gap-1.5 rounded-xl border border-border/50 bg-background/60 px-2.5 py-1.5 text-xs font-semibold text-foreground transition-all active:scale-[0.97] shadow-xs"
                      title="Switch Wiki Source"
                    >
                      <img
                        src={withBasePath(logoMap[selectedSite.name]!)}
                        alt={selectedSite.displayName}
                        className="h-4 w-4 object-contain"
                      />
                      <span>{selectedSite.displayName}</span>
                      <ChevronDown className="text-muted-foreground h-3 w-3 opacity-60" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-48 p-1.5 backdrop-blur-xl">
                    <DropdownMenuLabel className="px-2 py-1 text-[11px] font-semibold text-muted-foreground">
                      Wiki Source
                    </DropdownMenuLabel>
                    {wikiSites.map((site) => (
                      <DropdownMenuItem
                        key={site.name}
                        onClick={() => {
                          soundEffects.press();
                          onSelectSite(site);
                        }}
                        className={cn(
                          "flex items-center justify-between rounded-md px-2 py-1.5 text-xs cursor-pointer",
                          selectedSite.name === site.name && "font-semibold text-blue-500 bg-blue-500/10"
                        )}
                      >
                        <div className="flex items-center gap-2">
                          <img
                            src={withBasePath(logoMap[site.name]!)}
                            alt={site.displayName}
                            className="h-4 w-4 object-contain"
                          />
                          <span>{site.displayName}</span>
                        </div>
                        {selectedSite.name === site.name && <Check className="h-3.5 w-3.5 text-blue-500" />}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>

                <div className="h-4 w-px bg-border/60 shrink-0" />

                {/* Search Input Field */}
                <div className="relative flex min-w-0 flex-1 items-center gap-2 px-1">
                  {isSearching ? (
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                      className="shrink-0"
                    >
                      <Loader2 className="text-muted-foreground h-4 w-4" />
                    </motion.div>
                  ) : (
                    <Search className="text-muted-foreground h-4 w-4 shrink-0 opacity-70" />
                  )}

                  <input
                    ref={inputRef}
                    type="text"
                    placeholder={`Search ${selectedSite.displayName} nations, capitals, regimes...`}
                    value={searchTerm}
                    onChange={(e) => {
                      setSearchTerm(e.target.value);
                      if (!showResults) setShowResults(true);
                    }}
                    onFocus={() => {
                      if (searchTerm.trim()) setShowResults(true);
                    }}
                    className="placeholder:text-muted-foreground/70 text-foreground flex-1 bg-transparent text-xs sm:text-sm outline-none font-medium min-w-0"
                  />

                  {searchTerm && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSearchTerm("");
                        setShowResults(false);
                        inputRef.current?.focus();
                      }}
                      className="hover:bg-accent/60 flex h-5 w-5 shrink-0 items-center justify-center rounded-full transition-colors active:scale-90 cursor-pointer"
                      aria-label="Clear search"
                    >
                      <X className="text-muted-foreground h-3 w-3" />
                    </button>
                  )}
                </div>
              </div>

              <div className="hidden md:block h-4 w-px bg-border/60 shrink-0" />

              {/* Right Group: Government Segmented Control + Sort Dropdown + Count + Reset */}
              <div className="flex items-center justify-between md:justify-end gap-2 shrink-0 flex-wrap sm:flex-nowrap pt-1 md:pt-0 border-t border-border/30 md:border-t-0">
                {/* Segmented Government Filter */}
                <div className="flex items-center rounded-lg border border-border/50 bg-background/50 p-0.5 shadow-xs">
                  {GOV_PRESETS.map((preset) => {
                    const isSelected = selectedGov === preset.id;
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => {
                          soundEffects.press();
                          onSelectGov(preset.id);
                        }}
                        data-cuelume-press
                        className={cn(
                          "relative rounded-md px-2.5 py-1 text-xs font-medium transition-all duration-150 active:scale-[0.97] cursor-pointer",
                          isSelected
                            ? "bg-card text-foreground font-semibold shadow-xs border border-border/60"
                            : "text-muted-foreground hover:text-foreground"
                        )}
                      >
                        {preset.label}
                      </button>
                    );
                  })}
                </div>

                {/* Sort Dropdown */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      data-cuelume-press
                      className={cn(
                        "flex h-7 sm:h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-medium transition-all duration-150 active:scale-95 cursor-pointer shadow-xs",
                        sortOption !== "default"
                          ? "border-amber-500/40 bg-amber-500/15 text-amber-400 font-semibold"
                          : "border-border/50 bg-background/50 text-muted-foreground hover:border-border/70 hover:bg-background/80 hover:text-foreground"
                      )}
                    >
                      <FilterList className="h-3.5 w-3.5 opacity-70" />
                      <span className="hidden sm:inline whitespace-nowrap">
                        {SORT_OPTIONS.find((s) => s.id === sortOption)?.label ?? "Sort"}
                      </span>
                      <ChevronDown className="h-3 w-3 opacity-60" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48 p-1.5 backdrop-blur-xl">
                    <DropdownMenuLabel className="px-2 py-1 text-[11px] font-semibold text-muted-foreground">
                      Sort Nations
                    </DropdownMenuLabel>
                    {SORT_OPTIONS.map((opt) => (
                      <DropdownMenuItem
                        key={opt.id}
                        onClick={() => {
                          soundEffects.press();
                          onSelectSort(opt.id);
                        }}
                        className={cn(
                          "flex items-center justify-between rounded-md px-2 py-1.5 text-xs cursor-pointer",
                          sortOption === opt.id && "font-semibold text-amber-500 bg-amber-500/10"
                        )}
                      >
                        <span>{opt.label}</span>
                        {sortOption === opt.id && <Check className="h-3.5 w-3.5 text-amber-500" />}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>

                {/* Nation Count Badge */}
                <span className="rounded-full border border-border/50 bg-background/60 px-2.5 py-0.5 text-[11px] font-medium tabular-nums text-muted-foreground shadow-xs whitespace-nowrap">
                  {nationCount} {nationCount === 1 ? "nation" : "nations"}
                </span>

                {/* Reset Action */}
                {hasActiveFilters && (
                  <button
                    type="button"
                    onClick={() => {
                      soundEffects.press();
                      onClearFilters();
                    }}
                    data-cuelume-press
                    className="text-xs font-medium text-amber-500 hover:text-amber-400 transition-colors active:scale-95 cursor-pointer ml-0.5"
                  >
                    Reset
                  </button>
                )}
              </div>
            </div>

            {/* Dropdown Live Results Area (if searching via MediaWiki API) */}
            {showResults && searchTerm.trim().length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-2 z-30 max-h-72 overflow-y-auto rounded-xl border border-border/70 bg-card/95 p-2 shadow-2xl backdrop-blur-xl">
                {/* Searching Status */}
                {isSearching && searchResults.length === 0 && (
                  <div className="flex items-center justify-center gap-3 py-6">
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                    >
                      <Loader2 className="text-muted-foreground h-4 w-4" />
                    </motion.div>
                    <span className="text-muted-foreground text-xs">
                      Searching {selectedSite.displayName}...
                    </span>
                  </div>
                )}

                {/* Error Status */}
                {error && (
                  <div className="px-4 py-4 text-center">
                    <p className="text-xs text-red-400">{error}</p>
                  </div>
                )}

                {/* No Results */}
                {!isSearching && searchResults.length === 0 && !error && (
                  <div className="px-4 py-6 text-center">
                    <p className="text-muted-foreground text-xs">
                      No wiki articles found for "{searchTerm}"
                    </p>
                  </div>
                )}

                {/* Results List */}
                {searchResults.length > 0 && (
                  <div className="space-y-1.5">
                    {searchResults.slice(0, 10).map((result, index) => (
                      <div
                        key={result.title}
                        ref={(el) => {
                          resultRefs.current[index] = el;
                        }}
                      >
                        <SearchResultItemInline
                          result={result}
                          isSelected={selectedResult?.title === result.title}
                          isFocused={focusedIndex === index}
                          onSelect={() => handleSelectResult(result)}
                          onFocus={() => setFocusedIndex(index)}
                          formatNumber={formatNumber}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ─── Inline Result Item with Apple Tactile Physics ───

interface SearchResultItemInlineProps {
  result: SearchResult;
  isSelected: boolean;
  isFocused: boolean;
  onSelect: () => void;
  onFocus: () => void;
  formatNumber: (num: number | undefined, decimals?: number) => string;
}

function SearchResultItemInline({
  result,
  isSelected,
  isFocused,
  onSelect,
  onFocus,
  formatNumber,
}: SearchResultItemInlineProps) {
  const [imgError, setImgError] = useState(false);

  return (
    <div
      onClick={onSelect}
      onFocus={onFocus}
      className={cn(
        "group flex cursor-pointer items-start gap-3 rounded-xl border p-2.5 text-left transition-all duration-150 active:scale-[0.98]",
        isFocused && "ring-2 ring-blue-500/50",
        isSelected
          ? "border-blue-500/40 bg-blue-500/10"
          : "bg-card/60 hover:bg-accent/40 border-border/60"
      )}
    >
      {/* Flag or Globe */}
      {result.flagUrl && !imgError ? (
        <img
          src={result.flagUrl}
          alt={`Flag of ${result.title}`}
          className="border-border/60 mt-0.5 h-5 w-8 shrink-0 rounded-sm border object-cover shadow-sm"
          referrerPolicy="no-referrer"
          onError={() => setImgError(true)}
        />
      ) : (
        <div className="border-border/60 flex h-5 w-8 shrink-0 items-center justify-center rounded-sm border bg-muted/30">
          <Globe className="text-muted-foreground h-3 w-3" />
        </div>
      )}

      {/* Content */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <h4 className="text-foreground truncate text-sm font-medium">{result.title}</h4>
          <ExternalLink className="text-muted-foreground h-3 w-3 shrink-0 opacity-0 transition-opacity group-hover:opacity-100" />
        </div>

        {/* Key Indicators or Snippet */}
        {result.population || result.gdpPerCapita || result.capital || result.government ? (
          <div className="text-muted-foreground mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs">
            {result.population && (
              <span className="flex items-center gap-1">
                <Users className="text-blue-500 h-3 w-3" />
                {formatNumber(result.population, 0)}
              </span>
            )}
            {result.gdpPerCapita && (
              <span className="flex items-center gap-1">
                <DollarSign className="text-emerald-500 h-3 w-3" />$
                {formatNumber(result.gdpPerCapita)}
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
            className="text-muted-foreground mt-0.5 line-clamp-1 text-xs leading-relaxed"
            dangerouslySetInnerHTML={{ __html: sanitizeWikiContent(result.snippet) }}
          />
        )}
      </div>
    </div>
  );
}
