"use client";

import React, { useState, useEffect, useRef } from "react";
import { AnimatePresence } from "motion/react";
import { api } from "~/trpc/react";
import type { CountryInfoboxWithDynamicProps } from "~/lib/mediawiki-service";
import { unifiedFlagService } from "~/lib/unified-flag-service";
import { ImportPageHeader } from "../../import/_components/ImportPageHeader";
import { WikiSourceSelector } from "../../import/_components/WikiSourceSelector";
import { CategoryFilterSidebar } from "../../import/_components/CategoryFilterSidebar";
import { SearchBar } from "../../import/_components/SearchBar";
import { BackButton } from "../../import/_components/BackButton";
import { DynamicIslandStatus } from "../../import/_components/DynamicIslandStatus";
import { StatusMessageDisplay } from "../../import/_components/StatusMessageDisplay";
import { ParsedDataPreview } from "../../import/_components/ParsedDataPreview";
import { SearchResultsDisplay } from "../../import/_components/SearchResultsDisplay";
import type { BuilderSection } from "../../lib/builder-theme";

// ─── Types ───

interface WikiSite {
  name: string;
  displayName: string;
  baseUrl: string;
  description: string;
  categoryFilter?: string;
  theme: "blue" | "indigo";
  gradient: string;
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
  name: string;
  population?: number;
  gdpPerCapita?: number;
  gdp?: number;
  capital?: string;
  area?: number;
  government?: string;
  currency?: string;
  languages?: string;
  flag?: string;
  coatOfArms?: string;
  flagUrl?: string;
  coatOfArmsUrl?: string;
  infobox: CountryInfoboxWithDynamicProps;
}

// ─── Constants ───

const wikiSites: WikiSite[] = [
  {
    name: "ixwiki",
    displayName: "IxWiki",
    baseUrl: "https://ixwiki.com",
    description: "Geopolitical worldbuilding community",
    theme: "blue",
    gradient: "from-blue-500/20 to-cyan-600/20",
  },
  {
    name: "iiwiki",
    displayName: "IIWiki",
    baseUrl: "https://iiwiki.com",
    description: "SimFic and Alt-History Encyclopedia",
    theme: "blue",
    gradient: "from-teal-500/20 to-green-600/20",
  },
  {
    name: "althistory",
    displayName: "AltHistory Wiki",
    baseUrl: "https://althistory.fandom.com",
    description: "Alternative History and Speculative Fiction Encyclopedia",
    theme: "indigo",
    gradient: "from-purple-500/20 to-indigo-600/20",
  },
];

const popularCategories = ["Countries", "Nations", "Cities", "Regions", "Organizations"];
const searchCache = new Map<string, SearchResult[]>();

// ─── Props ───

interface ImportSectionProps {
  onNavigate: (section: BuilderSection) => void;
  /** Called when import data is ready — populates builder state */
  onImportComplete?: (data: ParsedCountryData & { _wikiSource: string; _wikiSourceName: string }) => void;
}

// ─── Component ───

export const ImportSection = React.memo(function ImportSection({
  onNavigate,
  onImportComplete,
}: ImportSectionProps) {
  const [selectedSite, setSelectedSite] = useState<WikiSite>(wikiSites[0]!);
  const [categoryFilter, setCategoryFilter] = useState("Countries");
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedResult, setSelectedResult] = useState<SearchResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [parsedData, setParsedData] = useState<ParsedCountryData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedCountryFlag, setSelectedCountryFlag] = useState<string | null>(null);
  const [displayedResults, setDisplayedResults] = useState<SearchResult[]>([]);
  const [resultsPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  const searchWikiMutation = api.countries.searchWiki.useMutation();
  const parseInfoboxMutation = api.countries.parseInfobox.useMutation();

  const searchTermRef = useRef(searchTerm);
  const selectedSiteRef = useRef(selectedSite);
  const searchRequestIdRef = useRef(0);

  searchTermRef.current = searchTerm;
  selectedSiteRef.current = selectedSite;

  // Debounced search
  useEffect(() => {
    if (!searchTerm.trim()) {
      setSearchResults([]);
      setDisplayedResults([]);
      setCurrentPage(1);
      return;
    }

    const timeoutId = setTimeout(async () => {
      const currentSearchTerm = searchTermRef.current;
      const currentSite = selectedSiteRef.current;
      if (!currentSearchTerm.trim()) return;

      const requestId = ++searchRequestIdRef.current;
      const cacheKey = `${currentSite.name}:${currentSearchTerm}:${categoryFilter}`;

      if (searchCache.has(cacheKey)) {
        const cachedResults = searchCache.get(cacheKey)!;
        setSearchResults(cachedResults);
        setDisplayedResults(cachedResults.slice(0, resultsPerPage));
        setCurrentPage(1);
        return;
      }

      setIsSearching(true);
      setError(null);
      setSelectedResult(null);
      setParsedData(null);

      try {
        const results = await searchWikiMutation.mutateAsync({
          query: currentSearchTerm,
          site: currentSite.name as "ixwiki" | "iiwiki" | "althistory",
          categoryFilter,
        });

        if (requestId !== searchRequestIdRef.current) return;

        if (
          categoryFilter.toLowerCase() === "countries" ||
          categoryFilter.toLowerCase() === "nations"
        ) {
          const resultsWithFlags = await Promise.all(
            results.map(async (result) => {
              try {
                const flagUrl = await unifiedFlagService.getFlagUrl(result.title);
                let additionalData = {};
                try {
                  const countryData = await parseInfoboxMutation.mutateAsync({
                    pageName: result.title,
                    site: currentSite.name as "ixwiki" | "iiwiki" | "althistory",
                  });
                  additionalData = {
                    population: countryData?.population,
                    gdpPerCapita: countryData?.gdpPerCapita,
                    capital: countryData?.capital,
                    government: countryData?.government,
                  };
                } catch {
                  // Continue without additional data
                }
                return { ...result, flagUrl, ...additionalData };
              } catch {
                return { ...result, flagUrl: null };
              }
            })
          );

          if (requestId !== searchRequestIdRef.current) return;

          searchCache.set(cacheKey, resultsWithFlags);
          setSearchResults(resultsWithFlags);
          setDisplayedResults(resultsWithFlags.slice(0, resultsPerPage));
          setCurrentPage(1);
        } else {
          searchCache.set(cacheKey, results);
          setSearchResults(results);
          setDisplayedResults(results.slice(0, resultsPerPage));
          setCurrentPage(1);
        }
      } catch (err) {
        if (requestId === searchRequestIdRef.current) {
          setError(`Search failed: ${err instanceof Error ? err.message : "Unknown error"}`);
          setSearchResults([]);
          setDisplayedResults([]);
          setCurrentPage(1);
        }
      } finally {
        if (requestId === searchRequestIdRef.current) {
          setIsSearching(false);
        }
      }
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [searchTerm, selectedSite.name, categoryFilter]);

  const handleSelectResult = async (result: SearchResult) => {
    setSelectedResult(result);
    setIsLoading(true);
    setError(null);
    setParsedData(null);

    setTimeout(() => setSearchResults([]), 200);

    try {
      const data = await parseInfoboxMutation.mutateAsync({
        pageName: result.title,
        site: selectedSite.name as "ixwiki" | "iiwiki" | "althistory",
      });

      if (data?.flagUrl) setSelectedCountryFlag(data.flagUrl);

      if (data) {
        setParsedData(data);
      } else {
        setError("Could not parse data from this page.");
      }
    } catch (err) {
      setError(`Failed to parse data: ${err instanceof Error ? err.message : "Unknown error"}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCountryPreview = (_result: SearchResult) => {
    // Preview handled by rendering state
  };

  const handleContinueWithCountry = (result: SearchResult) => {
    handleSelectResult(result);
  };

  const loadMoreResults = () => {
    const nextPage = currentPage + 1;
    const startIndex = (nextPage - 1) * resultsPerPage;
    const endIndex = startIndex + resultsPerPage;
    setDisplayedResults((prev) => [...prev, ...searchResults.slice(startIndex, endIndex)]);
    setCurrentPage(nextPage);
  };

  const hasMoreResults = currentPage * resultsPerPage < searchResults.length;

  const handleBackFromSelection = () => {
    setSelectedResult(null);
    setParsedData(null);
    setSelectedCountryFlag(null);
    setError(null);
  };

  const handleContinueWithData = async () => {
    if (!parsedData) return;

    try {
      setIsLoading(true);
      setError(null);

      const enhancedData = {
        ...parsedData,
        _wikiSource: selectedSite.name.toLowerCase(),
        _wikiSourceName: selectedSite.name,
      };

      // Store in localStorage for backward compat and call callback
      if (typeof window !== "undefined") {
        localStorage.setItem("builder_imported_data", JSON.stringify(enhancedData));
      }

      if (onImportComplete) {
        onImportComplete(enhancedData);
      }

      // Navigate to foundation step to continue building
      onNavigate("foundation");
    } catch (err) {
      setError(`Failed to process wiki import: ${err instanceof Error ? err.message : "Unknown error"}`);
    } finally {
      setIsLoading(false);
    }
  };

  const formatNumber = (num: number | undefined): string => {
    if (!num) return "Unknown";
    if (num >= 1e9) return `${(num / 1e9).toFixed(1)}B`;
    if (num >= 1e6) return `${(num / 1e6).toFixed(1)}M`;
    if (num >= 1e3) return `${(num / 1e3).toFixed(1)}K`;
    return num.toLocaleString();
  };

  return (
    <div>
      {/* Header */}
      <ImportPageHeader onBackClick={() => onNavigate("welcome")} />

      {/* Wiki Site Selection */}
      <WikiSourceSelector
        wikiSites={wikiSites}
        selectedSite={selectedSite}
        onSelectSite={setSelectedSite}
      />

      {/* Main Content with Sidebar Layout */}
      <div className="grid gap-6 lg:grid-cols-4 mt-4">
        {/* Sidebar - Category Filter */}
        <div className="lg:col-span-1">
          <CategoryFilterSidebar
            categoryFilter={categoryFilter}
            setCategoryFilter={setCategoryFilter}
            popularCategories={popularCategories}
            selectedSite={selectedSite}
          />
        </div>

        {/* Main Content Area */}
        <div className="space-y-6 lg:col-span-3">
          {(selectedResult || parsedData) && (
            <div className="sticky top-4 z-20">
              <BackButton onClick={handleBackFromSelection} />
            </div>
          )}

          <div className="bg-background sticky top-0 z-10 pb-4">
            <SearchBar
              searchTerm={searchTerm}
              setSearchTerm={setSearchTerm}
              isSearching={isSearching}
              categoryFilter={categoryFilter}
              selectedSite={selectedSite}
            />
          </div>

          {selectedResult && !parsedData && (
            <DynamicIslandStatus
              selectedResultTitle={selectedResult?.title}
              selectedCountryFlag={selectedCountryFlag}
              isLoading={isLoading}
            />
          )}

          {isSearching && searchTerm.trim() && (
            <StatusMessageDisplay
              type="searching"
              searchTerm={searchTerm}
              categoryFilter={categoryFilter}
              selectedSiteDisplayName={selectedSite.displayName}
              isIiwiki={selectedSite.name === "iiwiki"}
            />
          )}

          <AnimatePresence>
            {!isSearching && displayedResults.length > 0 && (
              <SearchResultsDisplay
                searchResults={searchResults}
                displayedResults={displayedResults}
                selectedResult={selectedResult}
                handleSelectResult={handleSelectResult}
                categoryFilter={categoryFilter}
                selectedSite={selectedSite}
                loadMoreResults={loadMoreResults}
                hasMoreResults={hasMoreResults}
                formatNumber={formatNumber}
                onCountryPreview={handleCountryPreview}
                onContinueWithCountry={handleContinueWithCountry}
              />
            )}
          </AnimatePresence>

          {!isSearching && searchTerm.trim() && searchResults.length === 0 && (
            <StatusMessageDisplay
              type="no-results"
              searchTerm={searchTerm}
              categoryFilter={categoryFilter}
              selectedSiteDisplayName={selectedSite.displayName}
            />
          )}

          {isLoading && (
            <StatusMessageDisplay type="searching" searchTerm={selectedResult?.title} />
          )}

          {error && <StatusMessageDisplay type="error" error={error} />}

          {parsedData && (
            <ParsedDataPreview
              parsedData={parsedData}
              handleContinueWithData={handleContinueWithData}
              formatNumber={formatNumber}
            />
          )}
        </div>
      </div>
    </div>
  );
});
