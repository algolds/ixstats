'use client';

import { useState, useMemo, useEffect, useRef, useCallback, memo } from 'react';
import { Search, Menu, MapPin, Flag, Building2, Map, Loader2, X } from 'lucide-react';
import { api } from '~/trpc/react';

interface GoogleSearchBarProps {
  onCountrySelect: (countryId: string, countryName: string) => void;
  onMenuClick?: () => void;
}

type SearchResultType = 'country' | 'subdivision' | 'city' | 'poi';

interface SearchResult {
  id: string;
  name: string;
  type: SearchResultType;
  icon: React.ComponentType<{ className?: string }>;
  primaryText: string;
  secondaryText: string;
  coordinates?: [number, number];
  bounds?: { minLng: number; minLat: number; maxLng: number; maxLat: number };
  countryName?: string;
  subdivisionName?: string;
  category?: string;
  flag?: string;
}
  
interface RecentSearch {
  id: string;
  name: string;
  type: SearchResultType;
  timestamp: number;
}

const RECENT_SEARCHES_KEY = 'ixstats_map_recent_searches';
const MAX_RECENT_SEARCHES = 5;

function GoogleSearchBar({ onCountrySelect, onMenuClick }: GoogleSearchBarProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [recentSearches, setRecentSearches] = useState<RecentSearch[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Load recent searches from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(RECENT_SEARCHES_KEY);
      if (stored) {
        setRecentSearches(JSON.parse(stored));
      }
    } catch (error) {
      console.error('Failed to load recent searches:', error);
    }
  }, []);

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Unified search query (replaces 4 separate queries)
  const { data: searchData, isLoading } = api.mapEditor.unifiedSearch.useQuery(
    { search: debouncedQuery, limit: 10 },
    {
      enabled: debouncedQuery.length > 1,
      staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    }
  );

  // Extract data for compatibility with existing code
  const countriesData = searchData ? { countries: searchData.countries } : undefined;
  const subdivisionsData = searchData ? { subdivisions: searchData.subdivisions } : undefined;
  const citiesData = searchData ? { cities: searchData.cities } : undefined;
  const poisData = searchData ? { pois: searchData.pois } : undefined;

  // Transform and combine search results
  const searchResults = useMemo(() => {
    const results: SearchResult[] = [];

    // Add country results
    if (countriesData?.countries) {
      countriesData.countries.forEach((country: any) => {
        results.push({
          id: country.id,
          name: country.name,
          type: 'country',
          icon: Flag,
          primaryText: country.name,
          secondaryText: `Country in ${country.continent ?? 'Unknown'}`,
          // Use centroid for navigation (primary)
          coordinates: (country as any).centerLng && (country as any).centerLat
            ? [(country as any).centerLng, (country as any).centerLat]
            : undefined,
          // Keep bounds as fallback
          bounds: country.minLng && country.minLat && country.maxLng && country.maxLat
            ? {
                minLng: country.minLng,
                minLat: country.minLat,
                maxLng: country.maxLng,
                maxLat: country.maxLat,
              }
            : undefined,
          countryName: country.name,
          flag: country.flag ?? undefined,
        });
      });
    }

    // Add subdivision results
    if (subdivisionsData?.subdivisions) {
      subdivisionsData.subdivisions.forEach((subdivision: any) => {
        const typeLabel = subdivision.type.charAt(0).toUpperCase() + subdivision.type.slice(1);
        results.push({
          id: subdivision.id,
          name: subdivision.name,
          type: 'subdivision',
          icon: Map,
          primaryText: subdivision.name,
          secondaryText: `${typeLabel} in ${subdivision.country?.name ?? 'Unknown'}`,
          countryName: subdivision.country?.name,
        });
      });
    }

    // Add city results
    if (citiesData?.cities) {
      citiesData.cities.forEach((city: any) => {
        const coordinates = city.coordinates as any;
        const location = city.subdivision?.name
          ? `${city.subdivision.name}, ${city.country?.name ?? 'Unknown'}`
          : city.country?.name ?? 'Unknown';

        results.push({
          id: city.id,
          name: city.name,
          type: 'city',
          icon: Building2,
          primaryText: city.name,
          secondaryText: `City in ${location}`,
          coordinates: coordinates?.coordinates ? [coordinates.coordinates[0], coordinates.coordinates[1]] : undefined,
          countryName: city.country?.name,
          subdivisionName: city.subdivision?.name,
        });
      });
    }

    // Add POI results
    if (poisData?.pois) {
      poisData.pois.forEach((poi: any) => {
        const coordinates = poi.coordinates as any;
        const categoryLabel = poi.category.charAt(0).toUpperCase() + poi.category.slice(1);
        const location = poi.subdivision?.name
          ? `${poi.subdivision.name}, ${poi.country?.name ?? 'Unknown'}`
          : poi.country?.name ?? 'Unknown';

        results.push({
          id: poi.id,
          name: poi.name,
          type: 'poi',
          icon: MapPin,
          primaryText: poi.name,
          secondaryText: `${categoryLabel} in ${location}`,
          coordinates: coordinates?.coordinates ? [coordinates.coordinates[0], coordinates.coordinates[1]] : undefined,
          category: poi.category,
          countryName: poi.country?.name,
          subdivisionName: poi.subdivision?.name,
        });
      });
    }

    return results.slice(0, 10); // Limit to 10 total results
  }, [countriesData, subdivisionsData, citiesData, poisData]);

  // Group results by type
  const groupedResults = useMemo(() => {
    return {
      countries: searchResults.filter(r => r.type === 'country'),
      subdivisions: searchResults.filter(r => r.type === 'subdivision'),
      cities: searchResults.filter(r => r.type === 'city'),
      pois: searchResults.filter(r => r.type === 'poi'),
    };
  }, [searchResults]);

  // Save to recent searches
  const saveRecentSearch = useCallback((result: SearchResult) => {
    try {
      const newSearch: RecentSearch = {
        id: result.id,
        name: result.primaryText,
        type: result.type,
        timestamp: Date.now(),
      };

      const updated = [
        newSearch,
        ...recentSearches.filter(r => r.id !== result.id),
      ].slice(0, MAX_RECENT_SEARCHES);

      setRecentSearches(updated);
      localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
    } catch (error) {
      console.error('Failed to save recent search:', error);
    }
  }, [recentSearches]);

  // Clear recent searches
  const clearRecentSearches = useCallback(() => {
    setRecentSearches([]);
    localStorage.removeItem(RECENT_SEARCHES_KEY);
  }, []);

  // Handle selection
  const handleSelect = useCallback((result: SearchResult) => {
    saveRecentSearch(result);

    // Get map instance from window (if available)
    const mapInstance = (window as any).__mainMapInstance;

    if (!mapInstance) {
      console.warn('Map instance not available');
      if (result.type === 'country') {
        onCountrySelect(result.id, result.name);
      }
      setSearchQuery('');
      setIsOpen(false);
      return;
    }

    if (result.type === 'country') {
      // Fly to country center using centroid coordinates
      if (result.coordinates) {
        mapInstance.flyTo({
          center: result.coordinates,
          zoom: 4, // Good zoom level for country overview
          duration: 2000
        });
      } else if (result.bounds) {
        // Fallback to bounds if centroid not available
        mapInstance.fitBounds([
          [result.bounds.minLng, result.bounds.minLat],
          [result.bounds.maxLng, result.bounds.maxLat]
        ], { padding: 50 });
      }
      onCountrySelect(result.id, result.name);
    } else if (result.type === 'subdivision' && result.bounds) {
      // Zoom to subdivision bounds
      mapInstance.fitBounds([
        [result.bounds.minLng, result.bounds.minLat],
        [result.bounds.maxLng, result.bounds.maxLat]
      ], { padding: 50, maxZoom: 10 });
    } else if ((result.type === 'city' || result.type === 'poi') && result.coordinates) {
      // Fly to coordinates
      mapInstance.flyTo({
        center: result.coordinates,
        zoom: result.type === 'city' ? 12 : 14,
        duration: 2000
      });
    }

    setSearchQuery(result.primaryText);
    setIsOpen(false);
    setSelectedIndex(-1);
  }, [onCountrySelect, saveRecentSearch]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex(prev =>
            prev < searchResults.length - 1 ? prev + 1 : prev
          );
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex(prev => prev > 0 ? prev - 1 : -1);
          break;
        case 'Enter':
          e.preventDefault();
          if (selectedIndex >= 0 && searchResults[selectedIndex]) {
            handleSelect(searchResults[selectedIndex]);
          }
          break;
        case 'Escape':
          e.preventDefault();
          setIsOpen(false);
          setSelectedIndex(-1);
          inputRef.current?.blur();
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, selectedIndex, searchResults, handleSelect]);

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        !inputRef.current?.contains(e.target as Node)
      ) {
        setIsOpen(false);
        setSelectedIndex(-1);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Highlight matching text
  const highlightMatch = (text: string, query: string) => {
    if (!query) return text;

    const parts = text.split(new RegExp(`(${query})`, 'gi'));
    return (
      <>
        {parts.map((part, i) =>
          part.toLowerCase() === query.toLowerCase() ? (
            <span key={i} className="font-semibold text-blue-600">{part}</span>
          ) : (
            <span key={i}>{part}</span>
          )
        )}
      </>
    );
  };

  const showRecentSearches = isOpen && searchQuery.length === 0 && recentSearches.length > 0;
  const showResults = isOpen && debouncedQuery.length > 1 && searchResults.length > 0;
  const showNoResults = isOpen && debouncedQuery.length > 1 && searchResults.length === 0 && !isLoading;
  const showLoading = isOpen && debouncedQuery.length > 1 && isLoading;

  return (
    <div className="absolute top-4 left-4 z-20 w-full max-w-xl">
      {/* Search Bar */}
      <div className="bg-white rounded-lg shadow-lg flex items-center overflow-hidden">
        <button
          onClick={onMenuClick}
          className="p-4 hover:bg-gray-100 transition-colors"
          title="Menu"
        >
          <Menu className="h-5 w-5 text-gray-600" />
        </button>

        <input
          ref={inputRef}
          type="text"
          placeholder="Search countries, cities, points of interest..."
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            setIsOpen(true);
            setSelectedIndex(-1);
          }}
          onFocus={() => setIsOpen(true)}
          className="flex-1 px-2 py-4 text-base outline-none text-gray-900"
        />

        {searchQuery && (
          <button
            className="p-2 hover:bg-gray-100 transition-colors"
            onClick={() => {
              setSearchQuery('');
              setDebouncedQuery('');
              setIsOpen(false);
              inputRef.current?.focus();
            }}
          >
            <X className="h-4 w-4 text-gray-500" />
          </button>
        )}

        <button className="p-4 hover:bg-gray-100 transition-colors">
          <Search className="h-5 w-5 text-blue-600" />
        </button>
      </div>

      {/* Dropdown Panel */}
      {(showRecentSearches || showResults || showNoResults || showLoading) && (
        <div
          ref={dropdownRef}
          className="mt-2 bg-white rounded-lg shadow-lg overflow-hidden max-h-96 overflow-y-auto"
        >
          {/* Recent Searches */}
          {showRecentSearches && (
            <div>
              <div className="flex items-center justify-between px-4 py-2 bg-gray-50 border-b">
                <span className="text-xs font-semibold text-gray-600 uppercase">Recent Searches</span>
                <button
                  onClick={clearRecentSearches}
                  className="text-xs text-blue-600 hover:text-blue-700"
                >
                  Clear
                </button>
              </div>
              {recentSearches.map((recent) => (
                <button
                  key={`recent-${recent.id}`}
                  onClick={() => {
                    setSearchQuery(recent.name);
                    setDebouncedQuery(recent.name);
                  }}
                  className="w-full px-4 py-3 text-left hover:bg-gray-100 transition-colors flex items-center gap-3"
                >
                  <div className="h-5 w-5 text-gray-400">
                    {recent.type === 'country' && <Flag className="h-5 w-5" />}
                    {recent.type === 'subdivision' && <Map className="h-5 w-5" />}
                    {recent.type === 'city' && <Building2 className="h-5 w-5" />}
                    {recent.type === 'poi' && <MapPin className="h-5 w-5" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-gray-900">{recent.name}</div>
                  </div>
                  <div className="text-xs text-gray-400 uppercase flex-shrink-0">{recent.type}</div>
                </button>
              ))}
            </div>
          )}

          {/* Loading State */}
          {showLoading && (
            <div className="px-4 py-8 text-center text-gray-500">
              <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
              <div className="text-sm">Searching...</div>
            </div>
          )}

          {/* Search Results */}
          {showResults && (
            <>
              {/* Countries Section */}
              {groupedResults.countries.length > 0 && (
                <div>
                  <div className="px-4 py-2 bg-gray-50 border-b">
                    <span className="text-xs font-semibold text-gray-600 uppercase">Countries</span>
                  </div>
                  {groupedResults.countries.map((result, index) => {
                    const Icon = result.icon;
                    const globalIndex = searchResults.findIndex(r => r.id === result.id);
                    return (
                      <button
                        key={`country-${result.id}`}
                        onClick={() => handleSelect(result)}
                        className={`w-full px-4 py-3 text-left transition-colors flex items-center gap-3 ${
                          globalIndex === selectedIndex ? 'bg-blue-100' : 'hover:bg-gray-100'
                        }`}
                      >
                        {result.flag ? (
                          <img src={result.flag} alt="" className="h-5 w-7 object-cover rounded flex-shrink-0" />
                        ) : (
                          <Icon className="h-5 w-5 text-gray-500 flex-shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="text-gray-900 font-medium">
                            {highlightMatch(result.primaryText, debouncedQuery)}
                          </div>
                          <div className="text-xs text-gray-500 truncate">{result.secondaryText}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Subdivisions Section */}
              {groupedResults.subdivisions.length > 0 && (
                <div>
                  <div className="px-4 py-2 bg-gray-50 border-b">
                    <span className="text-xs font-semibold text-gray-600 uppercase">Regions</span>
                  </div>
                  {groupedResults.subdivisions.map((result) => {
                    const Icon = result.icon;
                    const globalIndex = searchResults.findIndex(r => r.id === result.id);
                    return (
                      <button
                        key={`subdivision-${result.id}`}
                        onClick={() => handleSelect(result)}
                        className={`w-full px-4 py-3 text-left transition-colors flex items-center gap-3 ${
                          globalIndex === selectedIndex ? 'bg-blue-100' : 'hover:bg-gray-100'
                        }`}
                      >
                        <Icon className="h-5 w-5 text-gray-500 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="text-gray-900 font-medium">
                            {highlightMatch(result.primaryText, debouncedQuery)}
                          </div>
                          <div className="text-xs text-gray-500 truncate">{result.secondaryText}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Cities Section */}
              {groupedResults.cities.length > 0 && (
                <div>
                  <div className="px-4 py-2 bg-gray-50 border-b">
                    <span className="text-xs font-semibold text-gray-600 uppercase">Cities</span>
                  </div>
                  {groupedResults.cities.map((result) => {
                    const Icon = result.icon;
                    const globalIndex = searchResults.findIndex(r => r.id === result.id);
                    return (
                      <button
                        key={`city-${result.id}`}
                        onClick={() => handleSelect(result)}
                        className={`w-full px-4 py-3 text-left transition-colors flex items-center gap-3 ${
                          globalIndex === selectedIndex ? 'bg-blue-100' : 'hover:bg-gray-100'
                        }`}
                      >
                        <Icon className="h-5 w-5 text-gray-500 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="text-gray-900 font-medium">
                            {highlightMatch(result.primaryText, debouncedQuery)}
                          </div>
                          <div className="text-xs text-gray-500 truncate">{result.secondaryText}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* POIs Section */}
              {groupedResults.pois.length > 0 && (
                <div>
                  <div className="px-4 py-2 bg-gray-50 border-b">
                    <span className="text-xs font-semibold text-gray-600 uppercase">Points of Interest</span>
                  </div>
                  {groupedResults.pois.map((result) => {
                    const Icon = result.icon;
                    const globalIndex = searchResults.findIndex(r => r.id === result.id);
                    return (
                      <button
                        key={`poi-${result.id}`}
                        onClick={() => handleSelect(result)}
                        className={`w-full px-4 py-3 text-left transition-colors flex items-center gap-3 ${
                          globalIndex === selectedIndex ? 'bg-blue-100' : 'hover:bg-gray-100'
                        }`}
                      >
                        <Icon className="h-5 w-5 text-gray-500 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="text-gray-900 font-medium">
                            {highlightMatch(result.primaryText, debouncedQuery)}
                          </div>
                          <div className="text-xs text-gray-500 truncate">{result.secondaryText}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </>
          )}

          {/* No results message */}
          {showNoResults && (
            <div className="px-4 py-8 text-center text-gray-500">
              <div className="text-sm mb-2">No results found for &quot;{debouncedQuery}&quot;</div>
              <div className="text-xs text-gray-400">
                Try searching for a country, city, or landmark
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

GoogleSearchBar.displayName = 'GoogleSearchBar';

export default memo(GoogleSearchBar);
