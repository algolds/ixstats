"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { 
  ArrowLeft, 
  Search, 
  Globe, 
  ExternalLink, 
  Loader2, 
  CheckCircle, 
  AlertCircle, 
  Users, 
  DollarSign, 
  Building, 
  MapPin,
  Sparkles,
  Crown,
  Filter,
  Import
} from "lucide-react";
import { createUrl } from "~/lib/url-utils";
import { api } from "~/trpc/react";
import type { CountryInfoboxWithDynamicProps } from "~/lib/mediawiki-service";
import { unifiedFlagService } from "~/lib/unified-flag-service";
import { MyCountryLogo } from "~/components/ui/mycountry-logo";
import { ImportPageHeader } from "./_components/ImportPageHeader";
import { WikiSourceSelector } from "./_components/WikiSourceSelector";
import { CategoryFilterSidebar } from "./_components/CategoryFilterSidebar";
import { SearchBar } from "./_components/SearchBar";
import { BackButton } from "./_components/BackButton";
import { GlassCard, GlassCardContent, GlassCardHeader } from "../components/glass/GlassCard";
import { DynamicIslandStatus } from "./_components/DynamicIslandStatus";
import { StatusMessageDisplay } from "./_components/StatusMessageDisplay";
import { ParsedDataPreview } from "./_components/ParsedDataPreview";
import { SearchResultsDisplay } from "./_components/SearchResultsDisplay";
import { InteractiveGridPattern } from "~/components/magicui/interactive-grid-pattern";
import { BorderBeam } from "~/components/magicui/border-beam";
import { ProgressiveBlur } from "~/components/magicui/progressive-blur";
import { cn } from "~/lib/utils";

interface WikiSite {
  name: string;
  displayName: string;
  baseUrl: string;
  description: string;
  categoryFilter?: string;
  theme: 'blue' | 'indigo';
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

const wikiSites: WikiSite[] = [
  {
    name: "ixwiki",
    displayName: "IxWiki",
    baseUrl: "https://ixwiki.com",
    description: "Geopolitical worldbuilding community",
    theme: "blue",
    gradient: "from-blue-500/20 to-cyan-600/20"
  },
  {
    name: "iiwiki", 
    displayName: "IIWiki",
    baseUrl: "https://iiwiki.com",
    description: "SimFic and Alt-History Encyclopedia",
    theme: "blue",
    gradient: "from-teal-500/20 to-green-600/20"
  },
  {
    name: "althistory",
    displayName: "AltHistory Wiki",
    baseUrl: "https://althistory.fandom.com",
    description: "Alternative History and Speculative Fiction Encyclopedia",
    theme: "indigo",
    gradient: "from-purple-500/20 to-indigo-600/20"
  }
];

const popularCategories = [
  "Countries", "Nations", "Cities", "Regions", "Organizations"
];

// Simple cache for search results
const searchCache = new Map<string, SearchResult[]>();

export default function ImportFromWikiPage() {
  const router = useRouter(); 
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

  // API mutations
  const searchWikiMutation = api.countries.searchWiki.useMutation();
  const parseInfoboxMutation = api.countries.parseInfobox.useMutation();

  // Use refs to store the latest values without causing re-renders
  const searchTermRef = useRef(searchTerm);
  const selectedSiteRef = useRef(selectedSite);
  
  searchTermRef.current = searchTerm;
  selectedSiteRef.current = selectedSite;


  // Debounced search effect
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
      
      // Check cache first
      const cacheKey = `${currentSite.name}:${currentSearchTerm}:${categoryFilter}`;
      if (searchCache.has(cacheKey)) {
        console.log('Using cached search results');
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
        console.log('Searching with:', {
          query: currentSearchTerm,
          site: currentSite.name,
          categoryFilter: categoryFilter
        });
        
        const results = await searchWikiMutation.mutateAsync({
          query: currentSearchTerm,
          // Fix: site must be one of the allowed string literals
          site: currentSite.name as "ixwiki" | "iiwiki" | "althistory",
          categoryFilter: categoryFilter
        });

        console.log('Search results:', results);
        
        // Cache the search results
        searchCache.set(cacheKey, results);
        
        // For countries, try to fetch flags using the unified flag service
        if (categoryFilter.toLowerCase() === 'countries' || categoryFilter.toLowerCase() === 'nations') {
          const resultsWithFlags = await Promise.all(
            results.map(async (result) => {
              try {
                // Get flag from unified flag service
                const flagUrl = await unifiedFlagService.getFlagUrl(result.title);
                
                // Parse additional country data in background (optional)
                let additionalData = {};
                try {
                  const countryData = await parseInfoboxMutation.mutateAsync({
                    pageName: result.title,
                    site: currentSite.name as "ixwiki" | "iiwiki" | "althistory"
                  });
                  
                  additionalData = {
                    population: countryData?.population,
                    gdpPerCapita: countryData?.gdpPerCapita,
                    capital: countryData?.capital,
                    government: countryData?.government
                  };
                } catch (parseError) {
                  console.warn(`Failed to parse additional data for ${result.title}:`, parseError);
                }
                
                return { 
                  ...result, 
                  flagUrl,
                  ...additionalData
                };
              } catch (error) {
                console.error(`Failed to get flag for ${result.title}:`, error);
                return { ...result, flagUrl: null };
              }
            })
          );
          
          // Update cache with enhanced data
          searchCache.set(cacheKey, resultsWithFlags);
          setSearchResults(resultsWithFlags);
          setDisplayedResults(resultsWithFlags.slice(0, resultsPerPage));
          setCurrentPage(1);
        } else {
          setSearchResults(results);
          setDisplayedResults(results.slice(0, resultsPerPage));
          setCurrentPage(1);
        }
      } catch (error) {
        console.error('Search failed:', error);
        setError(`Search failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        setSearchResults([]);
        setDisplayedResults([]);
        setCurrentPage(1);
      } finally {
        setIsSearching(false);
      }
    }, 500); // 500ms debounce

    return () => clearTimeout(timeoutId);
  }, [searchTerm, selectedSite.name, categoryFilter]);

  const handleSelectResult = async (result: SearchResult) => {
    setSelectedResult(result);
    setIsLoading(true);
    setError(null);
    setParsedData(null);

    // Short delay to start animation before hiding results
    setTimeout(() => {
      setSearchResults([]);
    }, 200);

    try {
      console.log('Parsing infobox for:', {
        pageName: result.title,
        site: selectedSite.name
      });
      
      const data = await parseInfoboxMutation.mutateAsync({
        pageName: result.title,
        site: selectedSite.name as "ixwiki" | "iiwiki" | "althistory"
      });

      console.log('Parsed data:', data);
      
      // Store flag URL for dynamic island
      if (data?.flagUrl) {
        setSelectedCountryFlag(data.flagUrl);
      }

      if (data) {
        setParsedData(data);
      } else {
        setError('Could not parse data from this page.');
      }
    } catch (error) {
      console.error('Parse failed:', error);
      setError(`Failed to parse data: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCountryPreview = (result: SearchResult) => {
    // This is called when a country is selected for preview
    console.log('Country preview requested for:', result.title);
  };

  const handleContinueWithCountry = (result: SearchResult) => {
    // This is called when user confirms they want to import the country
    handleSelectResult(result);
  };

  const loadMoreResults = () => {
    const nextPage = currentPage + 1;
    const startIndex = (nextPage - 1) * resultsPerPage;
    const endIndex = startIndex + resultsPerPage;
    const newResults = searchResults.slice(startIndex, endIndex);
    
    setDisplayedResults(prev => [...prev, ...newResults]);
    setCurrentPage(nextPage);
  };

  const hasMoreResults = currentPage * resultsPerPage < searchResults.length;

  const handleBackFromSelection = () => {
    setSelectedResult(null);
    setParsedData(null);
    setSelectedCountryFlag(null);
    setError(null);
  };

  const handleContinueWithData = () => {
    if (parsedData) {
      // Store the parsed data and navigate to the customizer
      localStorage.setItem('builder_imported_data', JSON.stringify(parsedData));
      router.push(createUrl('/builder?import=true'));
    }
  };

  const formatNumber = (num: number | undefined): string => {
    if (!num) return 'Unknown';
    if (num >= 1e9) return `${(num / 1e9).toFixed(1)}B`;
    if (num >= 1e6) return `${(num / 1e6).toFixed(1)}M`;
    if (num >= 1e3) return `${(num / 1e3).toFixed(1)}K`;
    return num.toLocaleString();
  };


  return (
    <>
      {/* Background Pattern - Full viewport */}
      <div className="fixed inset-0 overflow-hidden z-0">
        <InteractiveGridPattern
          width={40}
          height={40}
          squares={[50, 40]}
          className="absolute inset-0 w-full h-full opacity-40 dark:opacity-25"
          squaresClassName="fill-slate-200/30 dark:fill-slate-700/30 stroke-slate-300/40 dark:stroke-slate-600/40 [&:nth-child(4n+1):hover]:fill-amber-600/50 [&:nth-child(4n+1):hover]:stroke-amber-600/70 [&:nth-child(4n+2):hover]:fill-blue-600/50 [&:nth-child(4n+2):hover]:stroke-blue-600/70 transition-all duration-200"
        />
      </div>

      <div className="min-h-screen relative z-10" style={{ backgroundColor: 'var(--color-bg-primary)' }}>
        <div className="container mx-auto p-6 max-w-6xl pt-12">
          {/* Header */}
          <ImportPageHeader onBackClick={() => router.push(createUrl('/builder'))} />

          {/* Wiki Site Selection */}
          <WikiSourceSelector
            wikiSites={wikiSites}
            selectedSite={selectedSite}
            onSelectSite={setSelectedSite}
          />

          {/* Main Content with Sidebar Layout */}
          <div className="grid lg:grid-cols-4 gap-8">
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
            <div className="lg:col-span-3 space-y-6">
              {/* Back Button - Sticky when country selected */}
              {(selectedResult || parsedData) && (
                <div className="sticky top-4 z-20">
                  <BackButton onClick={handleBackFromSelection} />
                </div>
              )}

              <div className="sticky top-0 z-10 bg-background pb-4"> {/* Added sticky, top-0, z-10, bg-background, pb-4 */}
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
                  isIiwiki={selectedSite.name === 'iiwiki'}
                />
              )}

              {/* Search Results */}
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

              {/* No Results */}
              {!isSearching && searchTerm.trim() && searchResults.length === 0 && (
                <StatusMessageDisplay
                  type="no-results"
                  searchTerm={searchTerm}
                  categoryFilter={categoryFilter}
                  selectedSiteDisplayName={selectedSite.displayName}
                />
              )}

              {/* Loading State */}
              {isLoading && (
                <StatusMessageDisplay
                  type="searching" // Re-using 'searching' type for loading, can be refined
                  searchTerm={selectedResult?.title} // Displaying the title being parsed
                />
              )}

              {/* Error State */}
              {error && (
                <StatusMessageDisplay
                  type="error"
                  error={error}
                />
              )}

              {/* Parsed Data Preview */}
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
      </div>
    </>
  );
}