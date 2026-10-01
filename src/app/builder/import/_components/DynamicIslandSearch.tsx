"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  Search,
  SystemRestart as Loader2,
  Xmark as X,
  OpenNewWindow as ExternalLink,
  Globe,
  Group as Users,
  Dollar as DollarSign,
  FilterList,
} from "iconoir-react";
import {
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "~/components/ui/dropdown-menu";
import { MenuButton } from "~/components/ui/menu-button";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { SegmentedControl } from "~/components/ui/segmented-control";
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
            className="border-separator bg-surface shadow-floating flex items-center gap-3 rounded-full border px-4 py-3"
          >
            {selectedCountryFlag && !flagImgError ? (
              <img
                src={selectedCountryFlag}
                alt="Flag"
                className="border-separator shadow-card h-4 w-6 rounded-sm border object-cover"
                referrerPolicy="no-referrer"
                onError={() => setFlagImgError(true)}
              />
            ) : (
              <Globe className="text-label-secondary h-4 w-5" />
            )}
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
            >
              <Loader2 className="text-label-secondary h-4 w-4" />
            </motion.div>
            <span className="text-label text-body font-medium">
              Parsing {selectedResult?.title}...
            </span>
          </motion.div>
        )}

        {/* ─── Unified Search & Filter Island ─── */}
        {!isParsing && !isParsed && (
          <div className="border-separator bg-surface rounded-card shadow-card relative w-full border p-2 sm:p-3">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              {/* Left Group: Wiki Source Selector + Search Input */}
              <div className="flex min-w-0 flex-1 items-center gap-2">
                {/* Wiki source menu */}
                <MenuButton
                  size="sm"
                  variant="gray"
                  className="shrink-0"
                  title="Switch Wiki Source"
                  icon={
                    <img
                      src={withBasePath(logoMap[selectedSite.name]!)}
                      alt=""
                      className="size-4 object-contain"
                    />
                  }
                  label={selectedSite.displayName}
                  contentClassName="w-48"
                >
                  <DropdownMenuLabel>Wiki source</DropdownMenuLabel>
                  <DropdownMenuRadioGroup
                    value={selectedSite.name}
                    onValueChange={(name) => {
                      const site = wikiSites.find((w) => w.name === name);
                      if (!site) return;
                      soundEffects.press();
                      onSelectSite(site);
                    }}
                  >
                    {wikiSites.map((site) => (
                      <DropdownMenuRadioItem key={site.name} value={site.name}>
                        <img
                          src={withBasePath(logoMap[site.name]!)}
                          alt=""
                          className="size-4 object-contain"
                        />
                        <span>{site.displayName}</span>
                      </DropdownMenuRadioItem>
                    ))}
                  </DropdownMenuRadioGroup>
                </MenuButton>

                <div aria-hidden className="bg-separator-opaque h-4 w-px shrink-0" />

                {/* Search Input Field */}
                <div className="relative flex min-w-0 flex-1 items-center gap-2 px-1">
                  {isSearching ? (
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                      className="shrink-0"
                    >
                      <Loader2 className="text-label-secondary h-4 w-4" />
                    </motion.div>
                  ) : (
                    <Search className="text-label-secondary h-4 w-4 shrink-0 opacity-70" />
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
                    aria-label={`Search ${selectedSite.displayName}`}
                    className="placeholder:text-label-tertiary text-label text-body min-w-0 flex-1 bg-transparent outline-none"
                  />

                  {searchTerm && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSearchTerm("");
                        setShowResults(false);
                        inputRef.current?.focus();
                      }}
                      className="text-label-secondary shrink-0 rounded-full"
                      aria-label="Clear search"
                    >
                      <X aria-hidden />
                    </Button>
                  )}
                </div>
              </div>

              <div aria-hidden className="bg-separator-opaque hidden h-4 w-px shrink-0 md:block" />

              {/* Right Group: Government Segmented Control + Sort Dropdown + Count + Reset */}
              <div className="border-separator flex shrink-0 flex-wrap items-center justify-between gap-2 border-t pt-1 sm:flex-nowrap md:justify-end md:border-t-0 md:pt-0">
                {/* Segmented Government Filter */}
                <SegmentedControl
                  aria-label="Government type"
                  size="sm"
                  value={selectedGov}
                  onValueChange={(gov) => {
                    soundEffects.press();
                    onSelectGov(gov);
                  }}
                  options={GOV_PRESETS.map((preset) => ({ value: preset.id, label: preset.label }))}
                />

                {/* Sort menu */}
                <MenuButton
                  size="sm"
                  variant={sortOption !== "default" ? "tinted" : "gray"}
                  icon={<FilterList aria-hidden />}
                  aria-label="Sort nations"
                  label={
                    <span className="hidden whitespace-nowrap sm:inline">
                      {SORT_OPTIONS.find((s) => s.id === sortOption)?.label ?? "Sort"}
                    </span>
                  }
                  align="end"
                  contentClassName="w-48"
                >
                  <DropdownMenuLabel>Sort nations</DropdownMenuLabel>
                  <DropdownMenuRadioGroup
                    value={sortOption}
                    onValueChange={(id) => {
                      soundEffects.press();
                      onSelectSort(id);
                    }}
                  >
                    {SORT_OPTIONS.map((opt) => (
                      <DropdownMenuRadioItem key={opt.id} value={opt.id}>
                        {opt.label}
                      </DropdownMenuRadioItem>
                    ))}
                  </DropdownMenuRadioGroup>
                </MenuButton>

                {/* Nation Count Badge */}
                <Badge variant="neutral" className="tabular-nums">
                  {nationCount} {nationCount === 1 ? "nation" : "nations"}
                </Badge>

                {/* Reset Action */}
                {hasActiveFilters && (
                  <Button
                    type="button"
                    variant="plain"
                    size="sm"
                    onClick={() => {
                      soundEffects.press();
                      onClearFilters();
                    }}
                  >
                    Reset
                  </Button>
                )}
              </div>
            </div>

            {/* Dropdown Live Results Area (if searching via MediaWiki API) */}
            {showResults && searchTerm.trim().length > 0 && (
              <div className="material-thick rounded-row z-popover shadow-floating absolute top-full right-0 left-0 mt-2 max-h-72 overflow-y-auto p-2">
                {/* Searching Status */}
                {isSearching && searchResults.length === 0 && (
                  <div className="flex items-center justify-center gap-3 py-6">
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                    >
                      <Loader2 className="text-label-secondary h-4 w-4" />
                    </motion.div>
                    <span className="text-label-secondary text-footnote">
                      Searching {selectedSite.displayName}...
                    </span>
                  </div>
                )}

                {/* Error Status */}
                {error && (
                  <div className="px-4 py-4 text-center">
                    <p className="text-footnote text-red">{error}</p>
                  </div>
                )}

                {/* No Results */}
                {!isSearching && searchResults.length === 0 && !error && (
                  <div className="px-4 py-6 text-center">
                    <p className="text-label-secondary text-footnote">
                      No wiki articles found for "{searchTerm}"
                    </p>
                  </div>
                )}

                {/* Results List */}
                {searchResults.length > 0 && (
                  <div className="space-y-2">
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
        "group rounded-row flex cursor-pointer items-start gap-3 border p-3 text-left transition-[color,background-color,border-color,box-shadow,opacity,transform] duration-150 active:scale-[0.98]",
        isFocused && "ring-blue/50 ring-2",
        isSelected ? "border-blue/40 bg-blue/10" : "bg-surface hover:bg-fill-3 border-separator"
      )}
    >
      {/* Flag or Globe */}
      {result.flagUrl && !imgError ? (
        <img
          src={result.flagUrl}
          alt={`Flag of ${result.title}`}
          className="border-separator shadow-card mt-0.5 h-5 w-8 shrink-0 rounded-sm border object-cover"
          referrerPolicy="no-referrer"
          onError={() => setImgError(true)}
        />
      ) : (
        <div className="border-separator bg-fill-4 flex h-5 w-8 shrink-0 items-center justify-center rounded-sm border">
          <Globe className="text-label-secondary h-3 w-3" />
        </div>
      )}

      {/* Content */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <h4 className="text-label text-body truncate font-medium">{result.title}</h4>
          <ExternalLink className="text-label-secondary h-3 w-3 shrink-0 opacity-0 transition-opacity group-hover:opacity-100" />
        </div>

        {/* Key Indicators or Snippet */}
        {result.population || result.gdpPerCapita || result.capital || result.government ? (
          <div className="text-label-secondary text-footnote mt-1 flex flex-wrap gap-x-3 gap-y-1">
            {result.population && (
              <span className="flex items-center gap-1">
                <Users className="text-blue h-3 w-3" />
                {formatNumber(result.population, 0)}
              </span>
            )}
            {result.gdpPerCapita && (
              <span className="flex items-center gap-1">
                <DollarSign className="text-green h-3 w-3" />${formatNumber(result.gdpPerCapita)}
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
            className="text-label-secondary text-footnote mt-0.5 line-clamp-1 leading-relaxed"
            dangerouslySetInnerHTML={{ __html: sanitizeWikiContent(result.snippet) }}
          />
        )}
      </div>
    </div>
  );
}
