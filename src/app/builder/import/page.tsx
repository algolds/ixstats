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
import { MyCountryLogo } from "~/components/ui/mycountry-logo";
import { GlassCard, GlassCardContent, GlassCardHeader } from "../components/glass/GlassCard";
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
    description: "The bespoke two-decades old geopolitical worldbuilding community & fictional encyclopedia",
    theme: "blue",
    gradient: "from-blue-500/20 to-cyan-600/20"
  },
  {
    name: "iiwiki", 
    displayName: "IIWiki",
    baseUrl: "https://iiwiki.com",
    description: "SimFic and Alt-History Encyclopedia",
    theme: "indigo",
    gradient: "from-indigo-500/20 to-purple-600/20"
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
  "Countries", "Nations", "Cities", "People", 
  "Organizations", "Companies", "Political parties"
];

// Simple cache for search results and flags
const searchCache = new Map<string, SearchResult[]>();
const flagCache = new Map<string, string>();

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
          site: currentSite.name as "ixwiki" | "iiwiki",
          categoryFilter: categoryFilter
        });
        
        console.log('Search results:', results);
        
        // Cache the search results
        searchCache.set(cacheKey, results);
        
        // For countries, try to fetch flags and additional data in the background
        if (categoryFilter.toLowerCase() === 'countries') {
          const resultsWithData = await Promise.all(
            results.map(async (result) => {
              try {
                // Parse full country data to get flag and basic info
                const countryData = await parseInfoboxMutation.mutateAsync({
                  pageName: result.title,
                  site: currentSite.name as "ixwiki" | "iiwiki"
                });
                
                return { 
                  ...result, 
                  flagUrl: countryData?.flagUrl || null,
                  population: countryData?.population,
                  gdpPerCapita: countryData?.gdpPerCapita,
                  capital: countryData?.capital,
                  government: countryData?.government
                };
              } catch (error) {
                console.error(`Failed to parse data for ${result.title}:`, error);
                return { ...result, flagUrl: null };
              }
            })
          );
          
          // Update cache with enhanced data
          searchCache.set(cacheKey, resultsWithData);
          setSearchResults(resultsWithData);
          setDisplayedResults(resultsWithData.slice(0, resultsPerPage));
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
        site: selectedSite.name as "ixwiki" | "iiwiki"
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
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-6 mb-24"
          >
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => router.push(createUrl('/builder'))}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg",
                "border transition-all duration-200 backdrop-blur-sm"
              )}
              style={{
                backgroundColor: 'var(--color-bg-secondary)',
                borderColor: 'var(--color-border-primary)',
                color: 'var(--color-text-muted)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = 'var(--color-text-primary)';
                e.currentTarget.style.backgroundColor = 'var(--color-bg-elevated)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = 'var(--color-text-muted)';
                e.currentTarget.style.backgroundColor = 'var(--color-bg-secondary)';
              }}
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Builder
            </motion.button>
            
            <div 
              className="h-8 w-px" 
              style={{ backgroundColor: 'var(--color-border-primary)' }}
            />
            
            <div className="flex items-center gap-4">
              <MyCountryLogo size="lg" animated />
              <div>
                <div className="flex items-center gap-2">
                  <h1 
                    className="text-3xl font-bold bg-gradient-to-r from-amber-400 to-amber-600 bg-clip-text text-transparent"
                  >
                    Wiki Import
                  </h1>
                  <Sparkles className="h-6 w-6 text-text-secondary" />
                </div>
                <p 
                  className="mt-1"
                  style={{ color: 'var(--color-text-muted)' }}
                >
                  Import country data from wiki encyclopedias
                </p>
              </div>
            </div>
          </motion.div>

          {/* Wiki Site Selection */}
          <GlassCard 
            depth="elevated" 
            blur="medium" 
            theme="neutral" 
            motionPreset="slide"
            className="mb-8"
          >
            <GlassCardHeader>
              <div className="flex items-center gap-3">
                <div 
                  className="p-2 rounded-lg"
                  style={{ 
                    backgroundColor: 'var(--color-bg-accent)',
                    borderColor: 'var(--color-border-secondary)'
                  }}
                >
                  <Globe className="h-5 w-5" style={{ color: 'var(--color-text-secondary)' }} />
                </div>
                <div>
                  <h2 
                    className="text-lg font-semibold"
                    style={{ color: 'var(--color-text-primary)' }}
                  >
                    Choose Wiki Source
                  </h2>
                  <p 
                    className="text-sm"
                    style={{ color: 'var(--color-text-muted)' }}
                  >
                    Select your preferred wiki encyclopedia
                  </p>
                </div>
              </div>
            </GlassCardHeader>
            <GlassCardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {wikiSites.map((site) => (
                  <motion.div
                    key={site.name}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="relative"
                  >
                    <button
                      onClick={() => setSelectedSite(site)}
                      className={cn(
                        "w-full p-6 rounded-xl border text-left transition-all duration-300 relative overflow-hidden",
                        "bg-gradient-to-br",
                        site.gradient,
                        selectedSite.name === site.name
                          ? `border-${site.theme}-400/50 shadow-lg`
                          : 'hover:shadow-md'
                      )}
                      style={{
                        backgroundColor: selectedSite.name === site.name 
                          ? `rgba(${site.theme === 'blue' ? '59, 130, 246' : '99, 102, 241'}, 0.1)`
                          : 'var(--color-bg-secondary)',
                        borderColor: selectedSite.name === site.name
                          ? `rgba(${site.theme === 'blue' ? '59, 130, 246' : '99, 102, 241'}, 0.5)`
                          : 'var(--color-border-primary)',
                        boxShadow: selectedSite.name === site.name
                          ? `0 8px 25px rgba(${site.theme === 'blue' ? '59, 130, 246' : '99, 102, 241'}, 0.2)`
                          : undefined
                      }}
                      onMouseEnter={(e) => {
                        if (selectedSite.name !== site.name) {
                          e.currentTarget.style.backgroundColor = 'var(--color-bg-elevated)';
                          e.currentTarget.style.borderColor = 'var(--color-border-secondary)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (selectedSite.name !== site.name) {
                          e.currentTarget.style.backgroundColor = 'var(--color-bg-secondary)';
                          e.currentTarget.style.borderColor = 'var(--color-border-primary)';
                        }
                      }}
                    >
                      {/* Fandom Logo Background for AltHistory Wiki */}
                      {site.name === 'althistory' && (
                        <div className="absolute top-2 right-2 opacity-10">
                          <img 
                            src="/fandom-logo.svg"
                            alt="Fandom"
                            className="w-12 h-6 object-contain"
                          />
                        </div>
                      )}
                      
                      <div className="flex items-center justify-between mb-3 relative z-10">
                        <h3 
                          className="font-semibold"
                          style={{ color: 'var(--color-text-primary)' }}
                        >
                          {site.displayName}
                        </h3>
                        <ExternalLink 
                          className="h-4 w-4" 
                          style={{ color: 'var(--color-text-muted)' }}
                        />
                      </div>
                      <p 
                        className="text-sm leading-relaxed relative z-10"
                        style={{ color: 'var(--color-text-muted)' }}
                      >
                        {site.description}
                      </p>
                      
                      {selectedSite.name === site.name && (
                        <motion.div
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="absolute -inset-px rounded-xl"
                        >
                          <BorderBeam size={120} duration={8} />
                        </motion.div>
                      )}
                    </button>
                  </motion.div>
                ))}
              </div>
            </GlassCardContent>
          </GlassCard>

          {/* Main Content with Sidebar Layout */}
          <div className="grid lg:grid-cols-4 gap-8">
            {/* Sidebar - Category Filter */}
            <div className="lg:col-span-1">
              <GlassCard 
                depth="elevated" 
                blur="medium" 
                theme="neutral" 
                motionPreset="slide"
                className="sticky top-6"
              >
                <GlassCardHeader>
                  <div className="flex items-center gap-3">
                    <div 
                      className="p-2 rounded-lg"
                      style={{ 
                        backgroundColor: 'var(--color-bg-accent)',
                        borderColor: 'var(--color-border-secondary)'
                      }}
                    >
                      <Filter className="h-5 w-5" style={{ color: 'var(--color-text-secondary)' }} />
                    </div>
                    <div>
                      <h2 
                        className="text-lg font-semibold"
                        style={{ color: 'var(--color-text-primary)' }}
                      >
                        Category Filter
                      </h2>
                      <p 
                        className="text-sm"
                        style={{ color: 'var(--color-text-muted)' }}
                      >
                       Search any wiki category to find your page
                      </p>
                    </div>
                  </div>
                </GlassCardHeader>
                <GlassCardContent>
                  <div className="space-y-4">
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="e.g., Countries, Nations, Cities..."
                        value={categoryFilter}
                        onChange={(e) => setCategoryFilter(e.target.value)}
                        className={cn(
                          "w-full px-4 py-3 rounded-lg border transition-all duration-200",
                          "focus:outline-none focus:ring-2 focus:ring-brand-primary/50 focus:border-brand-primary/50"
                        )}
                        style={{
                          backgroundColor: 'var(--color-bg-secondary)',
                          borderColor: 'var(--color-border-primary)',
                          color: 'var(--color-text-primary)'
                        }}
                      />
                    </div>
                    
                    <div className="space-y-3">
                      <span 
                        className="text-sm font-medium"
                        style={{ color: 'var(--color-text-muted)' }}
                      >
                        Popular:
                      </span>
                      <div className="flex flex-col gap-2">
                        {popularCategories.map((category) => (
                          <motion.button
                            key={category}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => setCategoryFilter(category)}
                            className={cn(
                              "px-3 py-2 text-sm rounded-lg transition-all duration-200",
                              "border font-medium text-left",
                              categoryFilter === category
                                ? 'border-border-secondary'
                                : 'border-transparent hover:border-border-secondary'
                            )}
                            style={{
                              color: categoryFilter === category ? 'var(--color-text-primary)' : 'var(--color-text-muted)',
                              backgroundColor: categoryFilter === category ? 'var(--color-bg-accent)' : 'var(--color-bg-secondary)'
                            }}
                          >
                            {category}
                          </motion.button>
                        ))}
                      </div>
                    </div>
                    
                    <div className="pt-4 border-t" style={{ borderColor: 'var(--color-border-primary)' }}>
                      <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--color-text-muted)' }}>
                        <Crown className="h-3 w-3" />
                        <span>
                          Searching in <strong>Category:{categoryFilter}</strong> on {selectedSite.displayName}
                          {selectedSite.name === 'iiwiki' && <span> (including subcategories)</span>}
                        </span>
                      </div>
                    </div>
                  </div>
                </GlassCardContent>
              </GlassCard>
            </div>

            {/* Main Content Area */}
            <div className="lg:col-span-3 space-y-6">
              {/* Back Button - Sticky when country selected */}
              {(selectedResult || parsedData) && (
                <div className="sticky top-4 z-20">
                  <motion.button
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={handleBackFromSelection}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg border backdrop-blur-md transition-all duration-200"
                    style={{
                      backgroundColor: 'var(--color-bg-surface)/90',
                      borderColor: 'var(--color-border-primary)',
                      color: 'var(--color-text-primary)'
                    }}
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Back to Search
                  </motion.button>
                </div>
              )}

              {/* Search - Sticky */}
              <div className="sticky top-20 z-10">
                <GlassCard 
                  depth="elevated" 
                  blur="medium" 
                  theme="neutral" 
                  motionPreset="slide"
                >
                <GlassCardHeader>
                  <div className="flex items-center gap-3">
                    <div 
                      className="p-2 rounded-lg"
                      style={{ 
                        backgroundColor: 'var(--color-bg-accent)',
                        borderColor: 'var(--color-border-secondary)'
                      }}
                    >
                      <Search className="h-5 w-5" style={{ color: 'var(--color-text-secondary)' }} />
                    </div>
                    <div>
                      <h2 className="text-lg font-semibold text-text-primary">
                        Search for Pages
                      </h2>
                      <p className="text-sm text-text-muted">
                        Find countries and entities to import
                      </p>
                    </div>
                  </div>
                </GlassCardHeader>
                <GlassCardContent>
                  <div className="relative">
                    <div className="absolute left-3 top-1/2 transform -translate-y-1/2 flex items-center">
                      {isSearching ? (
                        <Loader2 className="h-4 w-4 animate-spin text-text-secondary" />
                      ) : (
                        <Search className="h-4 w-4 text-text-muted" />
                      )}
                    </div>
                    <input
                      type="text"
                      placeholder={`Type to search ${categoryFilter} on ${selectedSite.displayName}...`}
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className={cn(
                        "w-full pl-10 pr-4 py-3 rounded-lg border transition-all duration-200",
                        "focus:outline-none focus:ring-2 focus:ring-brand-primary/50 focus:border-brand-primary/50"
                      )}
                      style={{
                        backgroundColor: 'var(--color-bg-secondary)',
                        borderColor: 'var(--color-border-primary)',
                        color: 'var(--color-text-primary)'
                      }}
                    />
                    {searchTerm && (
                      <motion.button
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => setSearchTerm('')}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 w-6 h-6 rounded-full flex items-center justify-center transition-colors"
                        style={{
                          backgroundColor: 'var(--color-bg-accent)',
                          color: 'var(--color-text-muted)'
                        }}
                        title="Clear search"
                        onMouseEnter={(e) => {
                          e.currentTarget.style.color = 'var(--color-text-primary)';
                          e.currentTarget.style.backgroundColor = 'var(--color-bg-hover)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.color = 'var(--color-text-muted)';
                          e.currentTarget.style.backgroundColor = 'var(--color-bg-accent)';
                        }}
                      >
                        ×
                      </motion.button>
                    )}
                  </div>
                </GlassCardContent>
              </GlassCard>

              {/* Dynamic Island - Selected Country */}
              {selectedResult && !parsedData && (
                <div className="fixed top-20 left-1/2 transform -translate-x-1/2 z-50">
                  <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className="backdrop-blur-md rounded-full px-6 py-3 shadow-lg border"
                    style={{
                      backgroundColor: 'rgba(245, 158, 11, 0.2)',
                      borderColor: 'rgba(245, 158, 11, 0.3)'
                    }}
                  >
                    <div className="flex items-center space-x-3">
                      {selectedCountryFlag && (
                        <motion.img 
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          src={selectedCountryFlag} 
                          alt={`Flag of ${selectedResult.title}`}
                          className="w-6 h-4 object-cover rounded-sm border border-border-secondary/30"
                        />
                      )}
                      <span className="text-sm font-medium text-text-primary">
                        Processing {selectedResult.title}...
                      </span>
                      {isLoading && (
                        <Loader2 className="h-4 w-4 animate-spin text-text-secondary" />
                      )}
                    </div>
                  </motion.div>
                </div>
              )}

              {/* Search Status */}
              {isSearching && searchTerm.trim() && (
                <GlassCard
                  depth="base"
                  blur="light"
                  theme="neutral"
                  motionPreset="fade"
                >
                  <GlassCardContent className="text-center">
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                      className="inline-block mb-3"
                    >
                      <Loader2 className="h-6 w-6 text-text-secondary" />
                    </motion.div>
                    <p className="text-text-muted">
                      Searching for "{searchTerm}" in Category:{categoryFilter} on {selectedSite.displayName}
                      {selectedSite.name === 'iiwiki' && (
                        <span className="block text-xs mt-1 opacity-75">
                          Including subcategories for comprehensive results
                        </span>
                      )}
                      ...
                    </p>
                  </GlassCardContent>
                </GlassCard>
              </div>

              {/* Search Results */}
              <AnimatePresence>
                {!isSearching && displayedResults.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                  >
                    <GlassCard
                      depth="elevated"
                      blur="medium"
                      theme="neutral"
                      motionPreset="slide"
                    >
                      <GlassCardHeader>
                        <div className="flex items-center gap-3">
                          <div 
                            className="p-2 rounded-lg border border-border-secondary/30"
                            style={{ backgroundColor: 'rgba(245, 158, 11, 0.2)' }}
                          >
                            <Search className="h-5 w-5 text-text-secondary" />
                          </div>
                          <div>
                            <h2 className="text-lg font-semibold text-text-primary">
                              Search Results ({searchResults.length})
                            </h2>
                            {selectedSite.name === 'iiwiki' && searchResults.some(r => r.snippet.includes('subcategory')) && (
                              <p className="text-sm text-text-muted mt-1">
                                Results include pages from subcategories
                              </p>
                            )}
                          </div>
                        </div>
                      </GlassCardHeader>
                      <GlassCardContent className="relative">
                        <div className="space-y-3 max-h-96 overflow-y-auto">
                          {displayedResults.map((result, index) => (
                            <motion.button
                              key={index}
                              initial={{ opacity: 0, x: -20 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: index * 0.05 }}
                              whileHover={{ scale: 1.02 }}
                              whileTap={{ scale: 0.98 }}
                              onClick={() => handleSelectResult(result)}
                              className={cn(
                                "w-full p-4 rounded-lg border text-left transition-all duration-200",
                                selectedResult?.title === result.title
                                  ? 'border-border-secondary/50 bg-bg-accent/200/20'
                                  : 'hover:border-border-secondary/30 hover:bg-bg-accent/200/10'
                              )}
                              style={{
                                backgroundColor: selectedResult?.title === result.title 
                                  ? undefined 
                                  : 'var(--color-bg-secondary)',
                                borderColor: selectedResult?.title === result.title 
                                  ? undefined 
                                  : 'var(--color-border-primary)'
                              }}
                            >
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center space-x-3">
                                  {result.flagUrl ? (
                                    <img 
                                      src={result.flagUrl} 
                                      alt={`Flag of ${result.title}`}
                                      className="w-6 h-4 object-cover rounded-sm border border-border-secondary shadow-sm"
                                      onError={(e) => {
                                        // Fallback to globe icon if flag fails to load
                                        const target = e.target as HTMLImageElement;
                                        const container = target.parentElement;
                                        if (container) {
                                          container.innerHTML = '<div class="w-6 h-4 bg-gradient-to-r from-bg-accent/20 to-bg-accent/30 rounded-sm flex items-center justify-center border border-border-secondary/30"><svg class="h-3 w-3 text-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg></div>';
                                        }
                                      }}
                                    />
                                  ) : (
                                    <div className="w-6 h-4 bg-gradient-to-r from-bg-accent/20 to-bg-accent/30 rounded-sm flex items-center justify-center border border-border-secondary/30">
                                      <Globe className="h-3 w-3 text-text-secondary" />
                                    </div>
                                  )}
                                  <h3 className="font-medium text-text-primary">{result.title}</h3>
                                </div>
                                <ExternalLink className="h-4 w-4 text-text-muted" />
                              </div>
                              {/* Country Info Display */}
                              {categoryFilter.toLowerCase() === 'countries' && (result.population || result.gdpPerCapita || result.capital || result.government) ? (
                                <div className="ml-9 mt-3 grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                                  {result.population && (
                                    <div className="flex items-center gap-1">
                                      <Users className="h-3 w-3" style={{ color: 'var(--color-info)' }} />
                                      <span style={{ color: 'var(--color-text-muted)' }}>
                                        {formatNumber(result.population)}
                                      </span>
                                    </div>
                                  )}
                                  {result.gdpPerCapita && (
                                    <div className="flex items-center gap-1">
                                      <DollarSign className="h-3 w-3" style={{ color: 'var(--color-success)' }} />
                                      <span style={{ color: 'var(--color-text-muted)' }}>
                                        ${formatNumber(result.gdpPerCapita)}
                                      </span>
                                    </div>
                                  )}
                                  {result.capital && (
                                    <div className="flex items-center gap-1">
                                      <MapPin className="h-3 w-3" style={{ color: 'var(--color-error)' }} />
                                      <span 
                                        className="truncate"
                                        style={{ color: 'var(--color-text-muted)' }}
                                        dangerouslySetInnerHTML={{ __html: result.capital }}
                                      />
                                    </div>
                                  )}
                                  {result.government && (
                                    <div className="flex items-center gap-1">
                                      <Building className="h-3 w-3" style={{ color: 'var(--color-brand-secondary)' }} />
                                      <span 
                                        className="truncate"
                                        style={{ color: 'var(--color-text-muted)' }}
                                        dangerouslySetInnerHTML={{ __html: result.government }}
                                      />
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <p 
                                  className="text-sm text-text-muted ml-9" 
                                  dangerouslySetInnerHTML={{ __html: result.snippet }} 
                                />
                              )}
                            </motion.button>
                          ))}
                        </div>

                        {/* Progressive Blur for scroll fade */}
                        <ProgressiveBlur 
                          className="bottom-0"
                          position="bottom"
                          height="20%"
                        />

                        {/* Load More Button */}
                        {hasMoreResults && (
                          <div className="mt-6 text-center">
                            <motion.button
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                              onClick={loadMoreResults}
                              className="px-6 py-3 rounded-lg border transition-all duration-200"
                              style={{
                                backgroundColor: 'var(--color-bg-secondary)',
                                borderColor: 'var(--color-border-primary)',
                                color: 'var(--color-text-primary)'
                              }}
                            >
                              Load More Results ({searchResults.length - displayedResults.length} remaining)
                            </motion.button>
                          </div>
                        )}
                      </GlassCardContent>
                    </GlassCard>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* No Results */}
              {!isSearching && searchTerm.trim() && searchResults.length === 0 && (
                <GlassCard
                  depth="base"
                  blur="light"
                  theme="neutral"
                  motionPreset="fade"
                >
                  <GlassCardContent className="text-center">
                    <AlertCircle className="h-6 w-6 mx-auto mb-2 text-text-muted" />
                    <p className="text-text-muted">
                      No pages found for "{searchTerm}" in Category:{categoryFilter} on {selectedSite.displayName}
                    </p>
                    <p className="text-sm text-text-muted mt-1">
                      Try a different search term or check the other wiki source.
                    </p>
                  </GlassCardContent>
                </GlassCard>
              )}

              {/* Loading State */}
              {isLoading && (
                <GlassCard
                  depth="elevated"
                  blur="medium"
                  theme="neutral"
                  motionPreset="scale"
                >
                  <GlassCardContent className="text-center py-12">
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                      className="inline-block mb-4"
                    >
                      <Loader2 className="h-8 w-8 text-text-secondary" />
                    </motion.div>
                    <p className="text-text-muted">
                      Parsing page data from {selectedResult?.title}...
                    </p>
                  </GlassCardContent>
                </GlassCard>
              )}

              {/* Error State */}
              {error && (
                <GlassCard
                  depth="elevated"
                  blur="medium"
                  theme="red"
                  motionPreset="slide"
                >
                  <GlassCardContent>
                    <div className="flex items-center gap-3">
                      <AlertCircle className="h-5 w-5 text-var(--color-error) flex-shrink-0" />
                      <p className="text-red-200">{error}</p>
                    </div>
                  </GlassCardContent>
                </GlassCard>
              )}

              {/* Parsed Data Preview */}
              {parsedData && (
                <GlassCard
                  depth="modal"
                  blur="heavy"
                  gradient="dynamic"
                  theme="neutral"
                  motionPreset="scale"
                  className="relative overflow-hidden"
                >
                  {/* Flag Background */}
                  {parsedData.flagUrl && (
                    <div className="absolute inset-0 overflow-hidden">
                      <img 
                        src={parsedData.flagUrl}
                        alt={`Flag of ${parsedData.name}`}
                        className="absolute inset-0 w-full h-full object-cover opacity-10 blur-3xl scale-110"
                        style={{
                          filter: 'blur(24px) saturate(0.7) brightness(0.5)',
                          transform: 'scale(1.2)'
                        }}
                      />
                      <div 
                        className="absolute inset-0"
                        style={{
                          background: 'linear-gradient(135deg, var(--color-bg-primary)/90 0%, var(--color-bg-secondary)/95 50%, var(--color-bg-primary)/90 100%)',
                          backdropFilter: 'blur(8px)'
                        }}
                      />
                    </div>
                  )}
                  <GlassCardHeader className="relative z-10">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div 
                          className="p-2 rounded-lg border"
                          style={{ 
                            backgroundColor: 'var(--color-success)/20',
                            borderColor: 'var(--color-success)/30'
                          }}
                        >
                          <CheckCircle className="h-5 w-5" style={{ color: 'var(--color-success)' }} />
                        </div>
                        <div>
                          <h2 className="text-lg font-semibold text-text-primary">
                            Successfully Parsed: {parsedData.name}
                          </h2>
                          <p className="text-sm text-text-muted">
                            Ready for import and customization
                          </p>
                        </div>
                      </div>
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={handleContinueWithData}
                        className={cn(
                          "flex items-center gap-2 px-6 py-3 rounded-lg font-medium",
                          "transition-all duration-200 border"
                        )}
                        style={{
                          backgroundColor: 'var(--color-brand-primary)',
                          borderColor: 'var(--color-brand-primary)',
                          color: 'white'
                        }}
                      >
                        <Import className="h-4 w-4" />
                        Continue with Data
                      </motion.button>
                    </div>
                  </GlassCardHeader>
                  <GlassCardContent className="relative z-10">
                    <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
                      <div 
                        className="p-4 rounded-lg border transition-all duration-200 hover:shadow-md backdrop-blur-sm"
                        style={{ 
                          backgroundColor: 'var(--color-bg-surface)/80',
                          borderColor: 'var(--color-border-primary)'
                        }}
                        title="Total population of the country"
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <Users className="h-4 w-4" style={{ color: 'var(--color-info)' }} />
                          <span className="text-sm font-medium" style={{ color: 'var(--color-text-muted)' }}>Population</span>
                        </div>
                        <p className="text-lg font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                          {formatNumber(parsedData.population)}
                        </p>
                      </div>

                      <div 
                        className="p-4 rounded-lg border transition-all duration-200 hover:shadow-md backdrop-blur-sm"
                        style={{ 
                          backgroundColor: 'var(--color-bg-surface)/80',
                          borderColor: 'var(--color-border-primary)'
                        }}
                        title="Gross Domestic Product per capita"
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <DollarSign className="h-4 w-4" style={{ color: 'var(--color-success)' }} />
                          <span className="text-sm font-medium" style={{ color: 'var(--color-text-muted)' }}>GDP per Capita</span>
                        </div>
                        <p className="text-lg font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                          ${formatNumber(parsedData.gdpPerCapita)}
                        </p>
                      </div>

                      <div 
                        className="p-4 rounded-lg border transition-all duration-200 hover:shadow-md backdrop-blur-sm"
                        style={{ 
                          backgroundColor: 'var(--color-bg-surface)/80',
                          borderColor: 'var(--color-border-primary)'
                        }}
                        title="Capital city of the country"
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <MapPin className="h-4 w-4" style={{ color: 'var(--color-error)' }} />
                          <span className="text-sm font-medium" style={{ color: 'var(--color-text-muted)' }}>Capital</span>
                        </div>
                        <div 
                          className="text-lg font-semibold [&_a]:text-brand-primary [&_a]:hover:underline"
                          style={{ color: 'var(--color-text-primary)' }}
                          dangerouslySetInnerHTML={{ __html: parsedData.capital || 'Unknown' }}
                        />
                      </div>

                      <div 
                        className="p-4 rounded-lg border transition-all duration-200 hover:shadow-md backdrop-blur-sm"
                        style={{ 
                          backgroundColor: 'var(--color-bg-surface)/80',
                          borderColor: 'var(--color-border-primary)'
                        }}
                        title="Type of government system"
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <Building className="h-4 w-4" style={{ color: 'var(--color-brand-secondary)' }} />
                          <span className="text-sm font-medium" style={{ color: 'var(--color-text-muted)' }}>Government</span>
                        </div>
                        <div 
                          className="text-lg font-semibold [&_a]:text-brand-primary [&_a]:hover:underline"
                          style={{ color: 'var(--color-text-primary)' }}
                          dangerouslySetInnerHTML={{ __html: parsedData.government || 'Unknown' }}
                        />
                      </div>
                    </div>

                    {/* Additional Info */}
                    <div className="mt-6 pt-6 border-t border-border-primary">
                      <h3 className="text-md font-medium text-text-primary mb-3">Additional Information</h3>
                      <div className="grid md:grid-cols-2 gap-4 text-sm">
                        {parsedData.currency && (
                          <div>
                            <span className="font-medium text-text-primary">Currency:</span>
                            <span 
                              className="ml-2 text-text-muted [&_a]:text-text-secondary [&_a]:hover:underline"
                              dangerouslySetInnerHTML={{ __html: parsedData.currency }}
                            />
                          </div>
                        )}
                        {parsedData.languages && (
                          <div>
                            <span className="font-medium text-text-primary">Languages:</span>
                            <span 
                              className="ml-2 text-text-muted [&_a]:text-text-secondary [&_a]:hover:underline"
                              dangerouslySetInnerHTML={{ __html: parsedData.languages }}
                            />
                          </div>
                        )}
                        {parsedData.area && (
                          <div>
                            <span className="font-medium text-text-primary">Area:</span>
                            <span className="ml-2 text-text-muted">{formatNumber(parsedData.area)} km²</span>
                          </div>
                        )}
                      </div>
                      
                      {/* Symbols Section - Flag and Coat of Arms */}
                      {((parsedData.flag || parsedData.flagUrl) || (parsedData.coatOfArms || parsedData.coatOfArmsUrl)) && (
                        <div className="mt-6 pt-6 border-t border-border-primary">
                          <h3 className="text-md font-medium text-text-primary mb-4">National Symbols</h3>
                          <div className="flex flex-wrap gap-6">
                            {(parsedData.flag || parsedData.flagUrl) && (
                              <div className="flex flex-col items-center">
                                <div 
                                  className="p-3 rounded-lg border shadow-sm backdrop-blur-sm"
                                  style={{ 
                                    backgroundColor: 'var(--color-bg-surface)/80',
                                    borderColor: 'var(--color-border-primary)'
                                  }}
                                >
                                  {parsedData.flagUrl ? (
                                    <img 
                                      src={parsedData.flagUrl} 
                                      alt={`Flag of ${parsedData.name}`}
                                      className="w-24 h-16 object-cover rounded border border-border-primary shadow-sm"
                                      onError={(e) => {
                                        const target = e.target as HTMLImageElement;
                                        const container = target.parentElement;
                                        if (container) {
                                          container.innerHTML = `<div class="w-24 h-16 bg-gradient-to-br from-[var(--color-bg-secondary)] to-[var(--color-bg-tertiary)] rounded border border-[var(--color-border-primary)] flex items-center justify-center"><span class="text-xs text-[var(--color-text-muted)] text-center px-2">${parsedData.flag}</span></div>`;
                                        }
                                      }}
                                    />
                                  ) : (
                                    <div className="w-24 h-16 bg-gradient-to-br from-bg-secondary to-bg-tertiary rounded border border-border-primary flex items-center justify-center">
                                      <span className="text-xs text-text-muted text-center px-2">{parsedData.flag}</span>
                                    </div>
                                  )}
                                </div>
                                <span className="text-sm font-medium text-text-primary mt-2">Flag</span>
                              </div>
                            )}
                            
                            {(parsedData.coatOfArms || parsedData.coatOfArmsUrl) && (
                              <div className="flex flex-col items-center">
                                <div 
                                  className="p-3 rounded-lg border shadow-sm backdrop-blur-sm"
                                  style={{ 
                                    backgroundColor: 'var(--color-bg-surface)/80',
                                    borderColor: 'var(--color-border-primary)'
                                  }}
                                >
                                  {parsedData.coatOfArmsUrl ? (
                                    <img 
                                      src={parsedData.coatOfArmsUrl} 
                                      alt={`Coat of Arms of ${parsedData.name}`}
                                      className="w-16 h-16 object-contain rounded border border-border-primary shadow-sm"
                                      onError={(e) => {
                                        const target = e.target as HTMLImageElement;
                                        const container = target.parentElement;
                                        if (container) {
                                          container.innerHTML = `<div class="w-16 h-16 bg-gradient-to-br from-[var(--color-bg-secondary)] to-[var(--color-bg-tertiary)] rounded border border-[var(--color-border-primary)] flex items-center justify-center"><span class="text-xs text-[var(--color-text-muted)] text-center px-1">${parsedData.coatOfArms}</span></div>`;
                                        }
                                      }}
                                    />
                                  ) : (
                                    <div className="w-16 h-16 bg-gradient-to-br from-bg-secondary to-bg-tertiary rounded border border-border-primary flex items-center justify-center">
                                      <span className="text-xs text-text-muted text-center px-1">{parsedData.coatOfArms}</span>
                                    </div>
                                  )}
                                </div>
                                <span className="text-sm font-medium text-text-primary mt-2">Coat of Arms</span>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </GlassCardContent>
                </GlassCard>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}