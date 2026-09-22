"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { ArrowLeft } from "iconoir-react";
import { api } from "~/trpc/react";
import {
  DynamicIslandSearch,
  type SearchResult,
  type WikiSite,
} from "~/app/builder/import/_components/DynamicIslandSearch";
import { Button } from "~/components/ui/button";
import { formatNumber } from "~/lib/utils";
import { InteractiveInfoboxPreview } from "~/app/builder/import/_components/InteractiveInfoboxPreview";
import { EligibleCountryGrid } from "~/app/builder/import/_components/EligibleCountryGrid";
import type { BuilderSection } from "~/app/builder/lib/builder-theme";
import type { UnifiedInfoboxData } from "~/lib/wiki-os/adapters/ixstates/unified-parser";
import type { ExtractedBuilderData } from "~/lib/builder/wiki-data-extractor";
import { assembleWikiImport } from "~/app/builder/lib/wiki-builder-assembler";
import type { BuilderState } from "~/app/builder/hooks/builderStateTypes";
import type { GovernmentBuilderState } from "~/types/government";
import type { EconomyBuilderState } from "~/types/economy-builder";

// ─── Types ───

interface ParsedCountryData extends UnifiedInfoboxData {
  wikiIntro?: string;
}

const wikiSites: WikiSite[] = [

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

const searchCache = new Map<string, SearchResult[]>();

function setBoundedCache(key: string, value: SearchResult[]) {
  if (searchCache.size >= 50) {
    const firstKey = searchCache.keys().next().value;
    if (firstKey) searchCache.delete(firstKey);
  }
  searchCache.set(key, value);
}

// ─── Props ───

interface ImportSectionProps {
  onNavigate: (section: BuilderSection) => void;
  /** Called when import data is ready — populates builder state */
  onImportComplete?: (data: Partial<BuilderState>) => void;
}

// ─── Component ───

export const ImportSection = React.memo(function ImportSection({
  onNavigate,
  onImportComplete,
}: ImportSectionProps) {
  const utils = api.useUtils();
  const [selectedSite, setSelectedSite] = useState<WikiSite>(wikiSites[1]!);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedResult, setSelectedResult] = useState<SearchResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [parsedData, setParsedData] = useState<ParsedCountryData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedCountryFlag, setSelectedCountryFlag] = useState<string | null>(null);
  const [isDeepScanning, setIsDeepScanning] = useState(false);
  const [deepScanData, setDeepScanData] = useState<{
    pagesScanned: number;
    foundVariants: string[];
    categoryUsed: string | null;
    extractedData: ExtractedBuilderData;
    pages: Array<{ title: string; content: string }>;
  } | null>(null);
  const [isAssembling, setIsAssembling] = useState(false);
  const [selectedGov, setSelectedGov] = useState<string>("all");
  const [sortOption, setSortOption] = useState<string>("default");
  const [gridCount, setGridCount] = useState<number>(0);

  const deepScanPromiseRef = useRef<Promise<{
    pagesScanned: number;
    foundVariants: string[];
    categoryUsed: string | null;
    extractedData: ExtractedBuilderData;
    pages: Array<{ title: string; content: string }>;
  } | null> | null>(null);
  const activeSelectedResultRef = useRef<string | null>(null);

  const handleClearFilters = useCallback(() => {
    setSearchTerm("");
    setSelectedGov("all");
    setSortOption("default");
  }, []);

  const handleSelectSite = useCallback((site: WikiSite) => {
    setSelectedSite(site);
    setSearchTerm("");
    setSelectedGov("all");
    setSortOption("default");
  }, []);

  const hasActiveFilters =
    searchTerm.trim().length > 0 || selectedGov !== "all" || sortOption !== "default";

  const searchWikiMutation = api.countries.searchWiki.useMutation();
  const parseInfoboxMutation = api.countries.parseInfobox.useMutation();

  const searchTermRef = useRef(searchTerm);
  const selectedSiteRef = useRef(selectedSite);
  const searchRequestIdRef = useRef(0);

  searchTermRef.current = searchTerm;
  selectedSiteRef.current = selectedSite;

  // Debounced search (250ms for responsive typing)
  useEffect(() => {
    if (!searchTerm.trim()) {
      setSearchResults([]);
      return;
    }

    const timeoutId = setTimeout(async () => {
      const currentSearchTerm = searchTermRef.current;
      const currentSite = selectedSiteRef.current;
      if (!currentSearchTerm.trim()) return;

      const requestId = ++searchRequestIdRef.current;
      const cacheKey = `${currentSite.name}:${currentSearchTerm}:countries`;

      if (searchCache.has(cacheKey)) {
        setSearchResults(searchCache.get(cacheKey)!);
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
          categoryFilter: "Countries",
        });

        if (requestId !== searchRequestIdRef.current) return;

        // Batch fetch flag URLs via tRPC resolver
        let flagMap: Record<string, string | null> = {};
        try {
          flagMap = await utils.countries.flags.resolveBatch.fetch({
            countryNames: results.map((r) => r.title),
            fallbackPolicy: "fictional-wiki",
          });
        } catch {
          // Ignore flag batch failure
        }

        const resultsWithFlags = results.map((result) => ({
          ...result,
          flagUrl: flagMap[result.title] ?? null,
        }));

        if (requestId !== searchRequestIdRef.current) return;

        setBoundedCache(cacheKey, resultsWithFlags);
        setSearchResults(resultsWithFlags);
      } catch (err) {
        if (requestId === searchRequestIdRef.current) {
          setError(`Search failed: ${err instanceof Error ? err.message : "Unknown error"}`);
          setSearchResults([]);
        }
      } finally {
        if (requestId === searchRequestIdRef.current) {
          setIsSearching(false);
        }
      }
    }, 250);

    return () => clearTimeout(timeoutId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm, selectedSite.name]);

  const handleSelectResult = async (result: SearchResult) => {
    setSelectedResult(result);
    activeSelectedResultRef.current = result.title;
    setIsLoading(true);
    setError(null);
    setParsedData(null);
    setDeepScanData(null);
    setIsDeepScanning(false);
    deepScanPromiseRef.current = null;

    // Clear search suggestions to keep the view focused
    setSearchResults([]);

    try {
      const data = await parseInfoboxMutation.mutateAsync({
        pageName: result.title,
        site: selectedSite.name as "ixwiki" | "iiwiki" | "althistory",
      });

      if (data?.flagUrl) setSelectedCountryFlag(data.flagUrl as string);

      if (data) {
        const parsed = data as ParsedCountryData;
        setParsedData(parsed);

        // Instantly initiate background LoreScanner with country & category tags
        setIsDeepScanning(true);
        const scanPromise = utils.wikiCache.builderDeepScan
          .fetch({
            countryName: result.title,
            wikiSource: selectedSite.name as "ixwiki" | "iiwiki" | "althistory",
            officialName: parsed.official_name || parsed.conventional_long_name,
            categoryTags: parsed.categories ?? [],
            mainWikitext: parsed.rawWikitext,
          })
          .then((scanRes) => {
            if (activeSelectedResultRef.current === result.title) {
              setDeepScanData(scanRes);
              setIsDeepScanning(false);
            }
            return scanRes;
          })
          .catch((err) => {
            console.warn("[LoreScanner Background] Deep scan failed:", err);
            if (activeSelectedResultRef.current === result.title) {
              setIsDeepScanning(false);
            }
            return null;
          });

        deepScanPromiseRef.current = scanPromise;
      } else {
        setError("Could not parse data from this page.");
      }
    } catch (err) {
      setError(`Failed to parse data: ${err instanceof Error ? err.message : "Unknown error"}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleBackFromSelection = () => {
    activeSelectedResultRef.current = null;
    setSelectedResult(null);
    setParsedData(null);
    setSelectedCountryFlag(null);
    setError(null);
    setDeepScanData(null);
    setIsDeepScanning(false);
    deepScanPromiseRef.current = null;
  };

  const handleContinueWithData = async () => {
    if (!parsedData || !selectedResult) return;

    try {
      setIsAssembling(true);
      setError(null);

      // Await background deep scan if it is still in flight
      let scan = deepScanData;
      if (!scan && deepScanPromiseRef.current) {
        scan = await deepScanPromiseRef.current;
      }

      // Merge the deep scan data with the infobox data
      const finalData: ParsedCountryData = { ...parsedData };
      const enhancedData = scan?.extractedData;

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
            finalData.gdp_nominal = enhancedData.economy.gdpNominal;
          if (enhancedData.economy.gdpPerCapita)
            finalData.gdpPerCapita = enhancedData.economy.gdpPerCapita;
        }
        if (enhancedData.demographics) {
          if (enhancedData.demographics.population)
            finalData.population = enhancedData.demographics.population;
        }
      }

      // Use real article wikitext from background LoreScanner
      const scannedPages =
        scan?.pages && scan.pages.length > 0
          ? scan.pages
          : [{ title: selectedResult.title, content: finalData.wikiIntro || selectedResult.title }];

      // Run comprehensive wiki-to-builder assembly
      const importResult = await assembleWikiImport({
        infoboxData: finalData,
        pages: scannedPages,
      });

      const builderStateData: Partial<BuilderState> = {
        creationOrigin: "import",
        selectedCountry: {
          name: finalData.name || selectedResult.title,
          countryCode: finalData.iso_code || "",
          gdp: importResult.economicInputs.coreIndicators.nominalGDP,
          gdpPerCapita: importResult.economicInputs.coreIndicators.gdpPerCapita,
          population: importResult.economicInputs.coreIndicators.totalPopulation,
          unemploymentRate: importResult.economicInputs.laborEmployment.unemploymentRate,
          flagUrl: finalData.flagUrl || selectedCountryFlag || undefined,
          coatOfArmsUrl: finalData.coatOfArmsUrl || undefined,
          governmentType: finalData.government_type,
          continent: finalData.continent,
          religion: finalData.religion,
          foundationCountryName: finalData.name || selectedResult.title,
        },
        economicInputs: importResult.economicInputs,
        governmentStructure: importResult.governmentStructure as GovernmentBuilderState,
        economyBuilderState: importResult.economyBuilderState as EconomyBuilderState,
        governmentComponents: importResult.selectedComponents.map((c) => c.component),
        completedSteps: ["foundation"],
        step: "core",
        activeCoreTab: "identity",
      };


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

      // Store in localStorage for backward compat
      if (typeof window !== "undefined") {
        localStorage.setItem("builder_imported_data", JSON.stringify(storageData));
      }

      // Propagate directly to live builder state
      if (onImportComplete) {
        onImportComplete(builderStateData);
      }

      // Direct, single-action spring into Builder identity!
      onNavigate("identity");
    } catch (err) {
      setError(
        `Failed to process wiki import: ${err instanceof Error ? err.message : "Unknown error"}`
      );
    } finally {
      setIsAssembling(false);
    }
  };

  const formatNumberSafe = useCallback((num: number | undefined, decimals = 1): string => {
    if (num === undefined || num === null || Number.isNaN(num)) return "Unknown";
    return formatNumber(num, decimals);
  }, []);

  const handleGridCountryClick = (pageName: string) => {
    const result: SearchResult = {
      title: pageName,
      snippet: "",
      url: "",
    };
    handleSelectResult(result);
  };

  return (
    <div className="pt-1 sm:pt-2">
      {/* Main Content */}
      <div className="mt-4 space-y-6">
        {/* Loading State Back Button */}
        {selectedResult && !parsedData && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleBackFromSelection}
              data-cuelume-press
              className="rounded-xl border-border/60 text-xs active:scale-[0.97] cursor-pointer"
            >
              <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
              Back to Search
            </Button>
        )}

        {!parsedData && (
          <div className="relative pb-4 transition-all duration-200">
            {!selectedResult && (
              <div className="mb-2 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => onNavigate("foundation")}
                  className="flex items-center gap-1.5 rounded-xl border border-border/60 bg-muted/30 px-3 py-1.5 text-xs font-medium text-muted-foreground transition-all hover:bg-accent/40 hover:text-foreground active:scale-[0.97] cursor-pointer"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  <span>Back to Foundation</span>
                </button>
              </div>
            )}
            <DynamicIslandSearch
              selectedSite={selectedSite}
              wikiSites={wikiSites}
              onSelectSite={handleSelectSite}
              searchTerm={searchTerm}
              setSearchTerm={setSearchTerm}
              isSearching={isSearching}
              searchResults={searchResults}
              selectedResult={selectedResult}
              isLoading={isLoading}
              parsedData={parsedData}
              error={error}
              selectedCountryFlag={selectedCountryFlag}
              handleSelectResult={handleSelectResult}
              formatNumber={formatNumberSafe}
              onBackFromSelection={handleBackFromSelection}
              selectedGov={selectedGov}
              onSelectGov={setSelectedGov}
              sortOption={sortOption}
              onSelectSort={setSortOption}
              nationCount={gridCount}
              hasActiveFilters={hasActiveFilters}
              onClearFilters={handleClearFilters}
            />
          </div>
        )}

        {/* Loading Spinner */}
        {isLoading && !parsedData && (
          <div className="border-border/50 bg-card/60 flex items-center justify-center gap-3 rounded-xl border px-6 py-8 backdrop-blur-md">
            <div className="border-muted-foreground/30 h-5 w-5 animate-spin rounded-full border-2 border-t-blue-500" />
            <span className="text-muted-foreground text-sm">
              Parsing {selectedResult?.title}...
            </span>
          </div>
        )}

        {/* Browse Grid (when nothing selected) */}
        {!selectedResult &&
          !parsedData &&
          !isLoading &&
          (selectedSite.name === "iiwiki" || selectedSite.name === "althistory") && (
            <div className="mt-4">
              <EligibleCountryGrid
                site={selectedSite.name as "iiwiki" | "althistory"}
                searchFilter={searchTerm}
                selectedGov={selectedGov}
                sortOption={sortOption}
                onCountChange={setGridCount}
                onClearFilters={handleClearFilters}
                onCountryClick={handleGridCountryClick}
              />
            </div>
          )}

        {/* Staged Infobox Preview with Live Background LoreScanner */}
        {parsedData && (
          <InteractiveInfoboxPreview
            data={parsedData}
            onContinue={handleContinueWithData}
            onBack={handleBackFromSelection}
            isLoading={isLoading || isAssembling}
            loreScanStatus={{
              isScanning: isDeepScanning,
              pagesFound: deepScanData?.pagesScanned,
              categoryUsed: deepScanData?.categoryUsed,
              hasCompleted: !isDeepScanning && !!deepScanData,
            }}
          />
        )}
      </div>
    </div>
  );
});
