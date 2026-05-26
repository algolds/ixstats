"use client";

import React, { useState, useEffect, useRef } from "react";
import { api } from "~/trpc/react";
import { unifiedFlagService } from "~/lib/unified-flag-service";
import { WikiSourceSelector } from "../../import/_components/WikiSourceSelector";
import { DynamicIslandSearch } from "../../import/_components/DynamicIslandSearch";
import { ImportSidebar } from "../../import/_components/ImportSidebar";
import { BackButton } from "../../import/_components/BackButton";
import { InteractiveInfoboxPreview } from "../../import/_components/InteractiveInfoboxPreview";
import { EligibleCountryGrid } from "../../import/_components/EligibleCountryGrid";
import type { BuilderSection } from "../../lib/builder-theme";
import type { UnifiedInfoboxData } from "~/lib/unified-wiki-parser";
import { WikiDeepScanPanel } from "../../import/_components/WikiDeepScanPanel";
import type { ExtractedBuilderData } from "../../lib/wiki-data-extractor";
import { ScanCompleteToast } from "../../import/_components/ScanCompleteToast";
import type { WikiImportResult } from "~/app/builder/lib/wiki-builder-assembler";

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

interface ParsedCountryData extends UnifiedInfoboxData {
  wikiIntro?: string;
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
  onImportComplete?: (
    data: ParsedCountryData & { _wikiSource: string; _wikiSourceName: string }
  ) => void;
}

// ─── Component ───

export const ImportSection = React.memo(function ImportSection({
  onNavigate,
  onImportComplete,
}: ImportSectionProps) {
  const [selectedSite, setSelectedSite] = useState<WikiSite>(wikiSites[1]!);
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
  const [showDeepScan, setShowDeepScan] = useState(false);
  const [showScanToast, setShowScanToast] = useState(false);
  const [scanResult, setScanResult] = useState<WikiImportResult | null>(null);

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
        let results: SearchResult[];

        results = await searchWikiMutation.mutateAsync({
          query: currentSearchTerm,
          site: currentSite.name as "ixwiki" | "iiwiki" | "althistory",
          categoryFilter,
        });

        if (requestId !== searchRequestIdRef.current) return;

        if (
          categoryFilter.toLowerCase() === "countries" ||
          categoryFilter.toLowerCase() === "nations"
        ) {
          // Fetch infobox data for each result to show in search results
          const resultsWithFlags = await Promise.all(
            results.map(async (result) => {
              try {
                const flagUrl = await unifiedFlagService.getFlagUrl(result.title);
                let additionalData: Record<string, unknown> = {};
                try {
                  const countryData = await parseInfoboxMutation.mutateAsync({
                    pageName: result.title,
                    site: currentSite.name as "ixwiki" | "iiwiki" | "althistory",
                  });

                  if (countryData) {
                    const d = countryData as Record<string, unknown>;
                    const wikiIntro = d.wikiIntro as string | undefined;
                    additionalData = {
                      population: d.population ?? d.population_estimate ?? d.population_total,
                      gdpPerCapita:
                        d.gdpPerCapita ?? d.GDP_nominal_per_capita ?? d.GDP_PPP_per_capita,
                      capital: d.capital,
                      government: d.government_type ?? d.government,
                      snippet:
                        wikiIntro ||
                        d.conventional_long_name ||
                        d.official_name ||
                        d.common_name ||
                        result.snippet,
                    };
                  }
                } catch {
                  // Parsing failed - use wiki search snippet as fallback
                  additionalData = { snippet: result.snippet };
                }
                return { ...result, flagUrl, ...additionalData };
              } catch {
                return { ...result, flagUrl: null, snippet: result.snippet };
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
      let data: any;

      // All wikis use tRPC (server-side proxy)
      data = await parseInfoboxMutation.mutateAsync({
        pageName: result.title,
        site: selectedSite.name as "ixwiki" | "iiwiki" | "althistory",
      });

      if (data?.flagUrl) setSelectedCountryFlag(data.flagUrl as string);

      if (data) {
        setParsedData(data as unknown as ParsedCountryData);
      } else {
        setError("Could not parse data from this page.");
      }
    } catch (err) {
      setError(`Failed to parse data: ${err instanceof Error ? err.message : "Unknown error"}`);
    } finally {
      setIsLoading(false);
    }
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
    setShowDeepScan(false);
  };

  const handleContinueWithData = async () => {
    if (!parsedData) return;
    // Instead of immediately saving, move to the deep scan step
    setShowDeepScan(true);
  };

  const handleDeepScanComplete = async (enhancedData?: ExtractedBuilderData) => {
    if (!parsedData || !selectedResult) return;

    try {
      setIsLoading(true);
      setError(null);

      // Merge the deep scan data with the infobox data
      const finalData: ParsedCountryData = { ...parsedData };

      if (enhancedData) {
        if (enhancedData.government) {
          if (enhancedData.government.governmentType)
            finalData.government_type = enhancedData.government.governmentType;
          if (enhancedData.government.legislature)
            finalData.legislature = enhancedData.government.legislature;
          if (enhancedData.government.headOfState)
            finalData.head_of_state = enhancedData.government.headOfState;
          if (enhancedData.government.headOfGovernment)
            finalData.head_of_government = enhancedData.government.headOfGovernment;
        }
        if (enhancedData.economy) {
          if (enhancedData.economy.gdpNominal)
            (finalData as any).gdp_nominal = enhancedData.economy.gdpNominal.toString();
          if (enhancedData.economy.gdpPerCapita)
            (finalData as any).gdpPerCapita = enhancedData.economy.gdpPerCapita;
        }
        if (enhancedData.demographics) {
          if (enhancedData.demographics.population)
            (finalData as any).population = enhancedData.demographics.population;
        }
      }

      // Fetch wiki pages for deep parsing
      const pagesToScan = [
        selectedResult.title,
        `Government of ${selectedResult.title}`,
        `Politics of ${selectedResult.title}`,
        `Economy of ${selectedResult.title}`,
      ];

      const pages: { title: string; content: string }[] = [];
      for (const pageName of pagesToScan) {
        try {
          const article = await parseInfoboxMutation.mutateAsync({
            pageName,
            site: selectedSite.name as "ixwiki" | "iiwiki" | "althistory",
          });
          if (article?.rawInfobox) {
            pages.push({
              title: pageName,
              content: JSON.stringify(article.rawInfobox),
            });
          }
        } catch {
          // Page not found, continue
        }
      }

      // Run comprehensive wiki-to-builder assembly
      const { assembleWikiImport } = await import("~/app/builder/lib/wiki-builder-assembler");
      const importResult = await assembleWikiImport({
        infoboxData: finalData,
        pages,
      });

      setScanResult(importResult);

      const storageData = {
        ...finalData,
        _wikiSource: selectedSite.name.toLowerCase(),
        _wikiSourceName: selectedSite.name,
        _importResult: {
          selectedComponents: importResult.selectedComponents.map((c) => c.component),
          suggestedComponents: importResult.suggestedComponents.map((c) => c.component),
          parsedDepartments: importResult.parsedDepartments,
          revenueSources: importResult.revenueSources,
          conflicts: importResult.conflicts,
          sectionCompleteness: importResult.sectionCompleteness,
          overallCompleteness: importResult.overallCompleteness,
          warnings: importResult.warnings,
        },
      };

      // Store in localStorage for backward compat and call callback
      if (typeof window !== "undefined") {
        localStorage.setItem("builder_imported_data", JSON.stringify(storageData));
      }

      if (onImportComplete) {
        onImportComplete(storageData as any);
      }

      // Show non-blocking toast instead of immediate navigation
      setShowScanToast(true);
    } catch (err) {
      setError(
        `Failed to process wiki import: ${err instanceof Error ? err.message : "Unknown error"}`
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleProceedToBuilder = () => {
    setShowScanToast(false);
    onNavigate("foundation");
  };

  const formatNumber = (num: number | undefined, _decimals?: number): string => {
    if (!num) return "Unknown";
    if (num >= 1e9) return `${(num / 1e9).toFixed(1)}B`;
    if (num >= 1e6) return `${(num / 1e6).toFixed(1)}M`;
    if (num >= 1e3) return `${(num / 1e3).toFixed(1)}K`;
    return num.toLocaleString();
  };

  // When a grid card is clicked, construct a minimal SearchResult and feed it into the existing parse flow
  const handleGridCountryClick = (pageName: string) => {
    const result: SearchResult = {
      title: pageName,
      snippet: "",
      url: "",
    };
    handleSelectResult(result);
  };

  return (
    <div>
      {/* Wiki Site Selection */}
      <WikiSourceSelector
        wikiSites={wikiSites}
        selectedSite={selectedSite}
        onSelectSite={setSelectedSite}
      />

      {/* Main Content with Sidebar */}
      <div className="mt-4 grid gap-6 lg:grid-cols-[240px_1fr]">
        {/* Sidebar */}
        <div className="hidden lg:block">
          <ImportSidebar
            selectedSite={selectedSite}
            searchTerm={searchTerm}
            isSearching={isSearching}
            selectedResult={selectedResult}
            parsedData={parsedData}
            isLoading={isLoading}
          />
        </div>

        {/* Main Content */}
        <div className="space-y-6">
          {(selectedResult || parsedData) && (
            <div className="sticky top-4 z-20">
              <BackButton onClick={handleBackFromSelection} />
            </div>
          )}

          <div className="sticky top-0 z-10 pb-4">
            <DynamicIslandSearch
              selectedSite={selectedSite}
              wikiSites={wikiSites}
              onSelectSite={setSelectedSite}
              searchTerm={searchTerm}
              setSearchTerm={setSearchTerm}
              isSearching={isSearching}
              searchResults={searchResults}
              displayedResults={displayedResults}
              hasMoreResults={hasMoreResults}
              selectedResult={selectedResult}
              isLoading={isLoading}
              parsedData={parsedData}
              error={error}
              selectedCountryFlag={selectedCountryFlag}
              categoryFilter={categoryFilter}
              setCategoryFilter={setCategoryFilter}
              popularCategories={popularCategories}
              handleSelectResult={handleSelectResult}
              loadMoreResults={loadMoreResults}
              onContinueWithCountry={handleContinueWithCountry}
              formatNumber={formatNumber}
              onBackFromSelection={handleBackFromSelection}
            />
          </div>

          {isLoading && !parsedData && (
            <div className="border-border/50 bg-card/60 flex items-center justify-center gap-3 rounded-xl border px-6 py-8 backdrop-blur-md">
              <div className="border-muted-foreground/30 h-5 w-5 animate-spin rounded-full border-2 border-t-blue-500" />
              <span className="text-muted-foreground text-sm">
                Parsing {selectedResult?.title}...
              </span>
            </div>
          )}

          {!selectedResult &&
            !parsedData &&
            !isLoading &&
            (selectedSite.name === "iiwiki" || selectedSite.name === "althistory") && (
              <div className="mt-6">
                <EligibleCountryGrid
                  site={selectedSite.name as "iiwiki" | "althistory"}
                  searchFilter={searchTerm}
                  onCountryClick={handleGridCountryClick}
                />
              </div>
            )}

          {parsedData && !showDeepScan && (
            <InteractiveInfoboxPreview
              data={parsedData}
              onContinue={handleContinueWithData}
              isLoading={isLoading}
            />
          )}

          {parsedData && showDeepScan && selectedResult && (
            <WikiDeepScanPanel
              countryName={selectedResult.title}
              wikiSource={selectedSite.name as "ixwiki" | "iiwiki" | "althistory"}
              onDataExtracted={(enhancedData) => handleDeepScanComplete(enhancedData)}
              onSkip={() => handleDeepScanComplete(undefined)}
            />
          )}
        </div>
      </div>

      {showScanToast && scanResult && (
        <ScanCompleteToast
          result={scanResult}
          countryName={selectedResult?.title || ""}
          onProceed={handleProceedToBuilder}
          onClose={() => setShowScanToast(false)}
        />
      )}
    </div>
  );
});
