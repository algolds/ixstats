"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Search, Globe, ExternalLink, Loader2, CheckCircle, AlertCircle, Download, Users, DollarSign, Building, MapPin } from "lucide-react";
import { createUrl } from "~/lib/url-utils";
import { api } from "~/trpc/react";
import type { CountryInfoboxWithDynamicProps } from "~/lib/mediawiki-service";
import { Button } from "~/components/ui/button";

interface WikiSite {
  name: string;
  displayName: string;
  baseUrl: string;
  description: string;
  categoryFilter?: string;
}

interface SearchResult {
  title: string;
  snippet: string;
  url: string;
  namespace?: number;
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
    categoryFilter: "Countries"
  },
  {
    name: "iiwiki", 
    displayName: "IIWiki",
    baseUrl: "https://iiwiki.com",
    description: "SimFic and Alt-History Encyclopedia",
    categoryFilter: "Countries"
  }
];

export default function ImportFromWikiPage() {
  const router = useRouter(); 
  const [selectedSite, setSelectedSite] = useState<WikiSite>(wikiSites[0]!);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedResult, setSelectedResult] = useState<SearchResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [parsedData, setParsedData] = useState<ParsedCountryData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isAnimatingResults, setIsAnimatingResults] = useState(false);
  const [selectedCountryFlag, setSelectedCountryFlag] = useState<string | null>(null);

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
      return;
    }

    const timeoutId = setTimeout(async () => {
      const currentSearchTerm = searchTermRef.current;
      const currentSite = selectedSiteRef.current;
      
      if (!currentSearchTerm.trim()) return;
      
      setIsSearching(true);
      setError(null);
      setSelectedResult(null);
      setParsedData(null);
      
      try {
        console.log('Searching with:', {
          query: currentSearchTerm,
          site: currentSite.name,
          categoryFilter: currentSite.categoryFilter
        });
        
        const results = await searchWikiMutation.mutateAsync({
          query: currentSearchTerm,
          site: currentSite.name as "ixwiki" | "iiwiki",
          categoryFilter: currentSite.categoryFilter
        });
        
        console.log('Search results:', results);
        setSearchResults(results);
      } catch (error) {
        console.error('Search failed:', error);
        setError(`Search failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 500); // 500ms debounce

    return () => clearTimeout(timeoutId);
  }, [searchTerm, selectedSite.name]);

  const handleSelectResult = async (result: SearchResult) => {
    setSelectedResult(result);
    setIsAnimatingResults(true);
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
        setError('Could not parse country data from this page.');
      }
    } catch (error) {
      console.error('Parse failed:', error);
      setError(`Failed to parse country data: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
      setIsAnimatingResults(false);
    }
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
    <div className="min-h-screen bg-[var(--color-bg-primary)]">
      <div className="container mx-auto p-6 max-w-4xl">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <button
            onClick={() => router.push(createUrl('/builder'))}
            className="flex items-center gap-2 px-3 py-2 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Builder
          </button>
          <div className="h-6 w-px bg-[var(--color-border-primary)]" />
          <div>
            <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">Import from Wiki</h1>
            <p className="text-[var(--color-text-muted)]">Search and import country data from wiki sources</p>
          </div>
        </div>

        {/* Wiki Site Selection */}
        <div className="bg-[var(--color-bg-secondary)] rounded-lg p-6 mb-6">
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-4 flex items-center">
            <Globe className="h-5 w-5 mr-2" />
            Choose Wiki Source
          </h2>
          <div className="grid md:grid-cols-2 gap-4">
            {wikiSites.map((site) => (
              <div key={site.name} className="relative">
                <button
                  onClick={() => setSelectedSite(site)}
                  className={`w-full p-4 rounded-lg border text-left transition-all duration-200 ${
                    selectedSite.name === site.name
                      ? 'border-[var(--color-brand-primary)] bg-[var(--color-brand-primary)] bg-opacity-10'
                      : 'border-[var(--color-border-primary)] hover:bg-[var(--color-bg-tertiary)]'
                  }`}
                  title={site.description}
                >
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-medium text-[var(--color-text-primary)]">{site.displayName}</h3>
                    <ExternalLink className="h-4 w-4 text-[var(--color-text-muted)]" />
                  </div>
                  <p className="text-sm text-[var(--color-text-muted)]">{site.description}</p>
                  <p className="text-xs text-[var(--color-brand-primary)] mt-1">
                    Filtered to Category: {site.categoryFilter}
                  </p>
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Search */}
        <div className="bg-[var(--color-bg-secondary)] rounded-lg p-6 mb-6">
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-4 flex items-center">
            <Search className="h-5 w-5 mr-2" />
            Search for Country
          </h2>
          <div className="relative">
            <div className="absolute left-3 top-1/2 transform -translate-y-1/2 flex items-center">
              {isSearching ? (
                <Loader2 className="h-4 w-4 animate-spin text-[var(--color-brand-primary)]" />
              ) : (
                <Search className="h-4 w-4 text-[var(--color-text-muted)]" />
              )}
            </div>
            <input
              type="text"
              placeholder={`Type to search countries on ${selectedSite.displayName}...`}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-[var(--color-bg-primary)] border border-[var(--color-border-primary)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-primary)] focus:border-transparent"
            />
            {searchTerm && (
              <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                <button
                  onClick={() => setSearchTerm('')}
                  className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
                  title="Clear search"
                >
                  ×
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Dynamic Island - Selected Country */}
        {selectedResult && !parsedData && (
          <div className="fixed top-20 left-1/2 transform -translate-x-1/2 z-50 animate-in slide-in-from-top-2 duration-500">
            <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border-primary)] rounded-full px-6 py-3 shadow-lg backdrop-blur-md bg-opacity-95">
              <div className="flex items-center space-x-3">
                {selectedCountryFlag && (
                  <img 
                    src={selectedCountryFlag} 
                    alt={`Flag of ${selectedResult.title}`}
                    className="w-6 h-4 object-cover rounded-sm border border-[var(--color-border)] animate-in zoom-in-95 duration-300"
                  />
                )}
                <span className="text-sm font-medium text-[var(--color-text-primary)]">
                  Processing {selectedResult.title}...
                </span>
                {isLoading && (
                  <Loader2 className="h-4 w-4 animate-spin text-[var(--color-brand-primary)]" />
                )}
              </div>
            </div>
          </div>
        )}

        {/* Search Status */}
        {isSearching && searchTerm.trim() && (
          <div className="bg-[var(--color-bg-secondary)] rounded-lg p-6 mb-6 text-center">
            <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-[var(--color-brand-primary)]" />
            <p className="text-[var(--color-text-muted)]">
              Searching for "{searchTerm}" in Category:Countries on {selectedSite.displayName}
              {selectedSite.name === 'iiwiki' && <span className="block text-xs mt-1 opacity-75">Including subcategories for comprehensive results</span>}
              ...
            </p>
          </div>
        )}

        {/* Search Results */}
        {!isSearching && searchResults.length > 0 && (
          <div className={`bg-[var(--color-bg-secondary)] rounded-lg p-6 mb-6 transition-all duration-300 ${
            isAnimatingResults ? 'opacity-0 scale-95' : 'opacity-100 scale-100'
          }`}>
            <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-4">
              Search Results ({searchResults.length})
              {selectedSite.name === 'iiwiki' && searchResults.some(r => r.snippet.includes('subcategory')) && (
                <span className="block text-sm font-normal text-[var(--color-text-muted)] mt-1">
                  Results include countries from subcategories
                </span>
              )}
            </h2>
            <div className="space-y-3">
              {searchResults.map((result, index) => (
                <button
                  key={index}
                  onClick={() => handleSelectResult(result)}
                  className={`w-full p-4 rounded-lg border text-left transition-all duration-200 transform hover:scale-[1.02] ${
                    selectedResult?.title === result.title
                      ? 'border-[var(--color-brand-primary)] bg-[var(--color-brand-primary)] bg-opacity-10 scale-[1.02]'
                      : 'border-[var(--color-border-primary)] hover:bg-[var(--color-bg-tertiary)] hover:border-[var(--color-brand-primary)] hover:border-opacity-50'
                  }`}
                  style={{ 
                    animationDelay: `${index * 50}ms`,
                    animation: selectedResult?.title === result.title ? 'pulse 0.3s ease-in-out' : undefined
                  }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-3">
                      <div className="w-6 h-4 bg-gradient-to-r from-[var(--color-border)] to-[var(--color-border-primary)] rounded-sm flex items-center justify-center">
                        <Globe className="h-3 w-3 text-[var(--color-text-muted)]" />
                      </div>
                      <h3 className="font-medium text-[var(--color-text-primary)]">{result.title}</h3>
                    </div>
                    <ExternalLink className="h-4 w-4 text-[var(--color-text-muted)]" />
                  </div>
                  <p className="text-sm text-[var(--color-text-muted)] ml-9" dangerouslySetInnerHTML={{ __html: result.snippet }} />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* No Results */}
        {!isSearching && searchTerm.trim() && searchResults.length === 0 && (
          <div className="bg-[var(--color-bg-secondary)] rounded-lg p-6 mb-6 text-center">
            <AlertCircle className="h-6 w-6 mx-auto mb-2 text-[var(--color-text-muted)]" />
            <p className="text-[var(--color-text-muted)]">No countries found for "{searchTerm}" in Category:Countries on {selectedSite.displayName}</p>
            <p className="text-sm text-[var(--color-text-muted)] mt-1">Try a different search term or check the other wiki source.</p>
          </div>
        )}

        {/* Loading State */}
        {isLoading && (
          <div className="bg-[var(--color-bg-secondary)] rounded-lg p-8 text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-[var(--color-brand-primary)]" />
            <p className="text-[var(--color-text-muted)]">Parsing country data from {selectedResult?.title}...</p>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6 mb-6">
            <div className="flex items-center gap-3">
              <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
              <p className="text-red-800 dark:text-red-200">{error}</p>
            </div>
          </div>
        )}

        {/* Parsed Data Preview */}
        {parsedData && (
          <div className="bg-[var(--color-bg-secondary)] rounded-lg p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-[var(--color-text-primary)] flex items-center">
                <CheckCircle className="h-5 w-5 mr-2 text-green-600" />
                Successfully Parsed: {parsedData.name}
              </h2>
              <Button onClick={handleContinueWithData} className="gap-2">
                <Download className="h-4 w-4" />
                Continue with This Data
              </Button>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-[var(--color-bg-primary)] p-4 rounded-lg" title="Total population of the country">
                <div className="flex items-center gap-2 mb-2">
                  <Users className="h-4 w-4 text-blue-600" />
                  <span className="text-sm font-medium text-[var(--color-text-muted)]">Population</span>
                </div>
                <p className="text-lg font-semibold text-[var(--color-text-primary)]">
                  {formatNumber(parsedData.population)}
                </p>
              </div>

              <div className="bg-[var(--color-bg-primary)] p-4 rounded-lg" title="Gross Domestic Product per capita">
                <div className="flex items-center gap-2 mb-2">
                  <DollarSign className="h-4 w-4 text-green-600" />
                  <span className="text-sm font-medium text-[var(--color-text-muted)]">GDP per Capita</span>
                </div>
                <p className="text-lg font-semibold text-[var(--color-text-primary)]">
                  ${formatNumber(parsedData.gdpPerCapita)}
                </p>
              </div>

              <div className="bg-[var(--color-bg-primary)] p-4 rounded-lg" title="Capital city of the country">
                <div className="flex items-center gap-2 mb-2">
                  <MapPin className="h-4 w-4 text-red-600" />
                  <span className="text-sm font-medium text-[var(--color-text-muted)]">Capital</span>
                </div>
                <div 
                  className="text-lg font-semibold text-[var(--color-text-primary)] [&_a]:text-[var(--color-brand-primary)] [&_a]:hover:underline"
                  dangerouslySetInnerHTML={{ __html: parsedData.capital || 'Unknown' }}
                />
              </div>

              <div className="bg-[var(--color-bg-primary)] p-4 rounded-lg" title="Type of government system">
                <div className="flex items-center gap-2 mb-2">
                  <Building className="h-4 w-4 text-purple-600" />
                  <span className="text-sm font-medium text-[var(--color-text-muted)]">Government</span>
                </div>
                <div 
                  className="text-lg font-semibold text-[var(--color-text-primary)] [&_a]:text-[var(--color-brand-primary)] [&_a]:hover:underline"
                  dangerouslySetInnerHTML={{ __html: parsedData.government || 'Unknown' }}
                />
              </div>
            </div>

            {/* Additional Info */}
            <div className="mt-6 pt-6 border-t border-[var(--color-border-primary)]">
              <h3 className="text-md font-medium text-[var(--color-text-primary)] mb-3">Additional Information</h3>
              <div className="grid md:grid-cols-2 gap-4 text-sm">
                {parsedData.currency && (
                  <div>
                    <span className="font-medium text-[var(--color-text-primary)]">Currency:</span>
                    <span 
                      className="ml-2 text-[var(--color-text-muted)] [&_a]:text-[var(--color-brand-primary)] [&_a]:hover:underline"
                      dangerouslySetInnerHTML={{ __html: parsedData.currency }}
                    />
                  </div>
                )}
                {parsedData.languages && (
                  <div>
                    <span className="font-medium text-[var(--color-text-primary)]">Languages:</span>
                    <span 
                      className="ml-2 text-[var(--color-text-muted)] [&_a]:text-[var(--color-brand-primary)] [&_a]:hover:underline"
                      dangerouslySetInnerHTML={{ __html: parsedData.languages }}
                    />
                  </div>
                )}
                {parsedData.area && (
                  <div>
                    <span className="font-medium text-[var(--color-text-primary)]">Area:</span>
                    <span className="ml-2 text-[var(--color-text-muted)]">{formatNumber(parsedData.area)} km²</span>
                  </div>
                )}
              </div>
              
              {/* Symbols Section - Flag and Coat of Arms */}
              {((parsedData.flag || parsedData.flagUrl) || (parsedData.coatOfArms || parsedData.coatOfArmsUrl)) && (
                <div className="mt-6 pt-6 border-t border-[var(--color-border-primary)]">
                  <h3 className="text-md font-medium text-[var(--color-text-primary)] mb-4">National Symbols</h3>
                  <div className="flex flex-wrap gap-6">
                    {(parsedData.flag || parsedData.flagUrl) && (
                      <div className="flex flex-col items-center">
                        <div className="bg-[var(--color-bg-primary)] p-3 rounded-lg border border-[var(--color-border)] shadow-sm">
                          {parsedData.flagUrl ? (
                            <img 
                              src={parsedData.flagUrl} 
                              alt={`Flag of ${parsedData.name}`}
                              className="w-24 h-16 object-cover rounded border border-[var(--color-border-primary)] shadow-sm"
                              onError={(e) => {
                                // Fallback to filename if image fails to load
                                const target = e.target as HTMLImageElement;
                                const container = target.parentElement;
                                if (container) {
                                  container.innerHTML = `<div class="w-24 h-16 bg-gradient-to-br from-[var(--color-bg-secondary)] to-[var(--color-bg-tertiary)] rounded border border-[var(--color-border-primary)] flex items-center justify-center"><span class="text-xs text-[var(--color-text-muted)] text-center px-2">${parsedData.flag}</span></div>`;
                                }
                              }}
                            />
                          ) : (
                            <div className="w-24 h-16 bg-gradient-to-br from-[var(--color-bg-secondary)] to-[var(--color-bg-tertiary)] rounded border border-[var(--color-border-primary)] flex items-center justify-center">
                              <span className="text-xs text-[var(--color-text-muted)] text-center px-2">{parsedData.flag}</span>
                            </div>
                          )}
                        </div>
                        <span className="text-sm font-medium text-[var(--color-text-primary)] mt-2">Flag</span>
                      </div>
                    )}
                    
                    {(parsedData.coatOfArms || parsedData.coatOfArmsUrl) && (
                      <div className="flex flex-col items-center">
                        <div className="bg-[var(--color-bg-primary)] p-3 rounded-lg border border-[var(--color-border)] shadow-sm">
                          {parsedData.coatOfArmsUrl ? (
                            <img 
                              src={parsedData.coatOfArmsUrl} 
                              alt={`Coat of Arms of ${parsedData.name}`}
                              className="w-16 h-16 object-contain rounded border border-[var(--color-border-primary)] shadow-sm"
                              onError={(e) => {
                                // Fallback to filename if image fails to load
                                const target = e.target as HTMLImageElement;
                                const container = target.parentElement;
                                if (container) {
                                  container.innerHTML = `<div class="w-16 h-16 bg-gradient-to-br from-[var(--color-bg-secondary)] to-[var(--color-bg-tertiary)] rounded border border-[var(--color-border-primary)] flex items-center justify-center"><span class="text-xs text-[var(--color-text-muted)] text-center px-1">${parsedData.coatOfArms}</span></div>`;
                                }
                              }}
                            />
                          ) : (
                            <div className="w-16 h-16 bg-gradient-to-br from-[var(--color-bg-secondary)] to-[var(--color-bg-tertiary)] rounded border border-[var(--color-border-primary)] flex items-center justify-center">
                              <span className="text-xs text-[var(--color-text-muted)] text-center px-1">{parsedData.coatOfArms}</span>
                            </div>
                          )}
                        </div>
                        <span className="text-sm font-medium text-[var(--color-text-primary)] mt-2">Coat of Arms</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Actions */}
        {parsedData && (
          <div className="bg-[var(--color-bg-secondary)] rounded-lg p-6">
            <div className="flex flex-col sm:flex-row gap-4 justify-between items-center">
              <div className="text-center sm:text-left">
                <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">Ready to Import</h3>
                <p className="text-sm text-[var(--color-text-muted)]">
                  This data will be used as the foundation for your custom country
                </p>
              </div>
              <button
                onClick={handleContinueWithData}
                className="bg-[var(--color-brand-primary)] hover:bg-[var(--color-brand-secondary)] text-white px-6 py-3 rounded-lg font-medium transition-colors duration-200 min-w-[160px]"
              >
                Continue with Data
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}