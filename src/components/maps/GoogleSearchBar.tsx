'use client';

import { useState, useMemo } from 'react';
import { Search, Menu, MapPin, Flag, Building2 } from 'lucide-react';
import { api } from '~/trpc/react';

interface GoogleSearchBarProps {
  onCountrySelect: (countryId: string, countryName: string) => void;
}

type SearchResultType = 'country' | 'city' | 'poi';

interface SearchResult {
  id: string;
  name: string;
  type: SearchResultType;
  flag?: string;
  description?: string;
}

export default function GoogleSearchBar({ onCountrySelect }: GoogleSearchBarProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);

  // Fetch countries with search parameter for better performance
  const { data: countriesData } = api.countries.getAll.useQuery(
    { search: searchQuery, limit: 10 },
    { enabled: searchQuery.length > 1 }
  );

  // Transform and combine search results
  const searchResults = useMemo(() => {
    const results: SearchResult[] = [];

    // Add country results
    if (countriesData?.countries) {
      countriesData.countries.forEach((country) => {
        results.push({
          id: country.id,
          name: country.name,
          type: 'country',
          flag: country.flag ?? undefined,
          description: `${country.continent ?? 'Unknown'} • ${country.populationTier ?? 'Unknown'} population`,
        });
      });
    }

    // TODO: Add city results when cities table exists
    // if (citiesData?.cities) { ... }

    // TODO: Add POI results when POIs table exists
    // if (poisData?.pois) { ... }

    return results.slice(0, 8); // Limit to 8 results
  }, [countriesData]);

  const handleSelect = (result: SearchResult) => {
    if (result.type === 'country') {
      onCountrySelect(result.id, result.name);
    }
    // TODO: Handle city and POI selections
    setSearchQuery('');
    setIsOpen(false);
  };

  const getResultIcon = (type: SearchResultType) => {
    switch (type) {
      case 'country':
        return Flag;
      case 'city':
        return Building2;
      case 'poi':
        return MapPin;
    }
  };

  return (
    <div className="absolute top-4 left-4 z-20 w-full max-w-xl">
      {/* Search Bar */}
      <div className="bg-white rounded-lg shadow-lg flex items-center overflow-hidden">
        <button className="p-4 hover:bg-gray-100 transition-colors">
          <Menu className="h-5 w-5 text-gray-600" />
        </button>

        <input
          type="text"
          placeholder="Search countries, cities, points of interest..."
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            setIsOpen(e.target.value.length > 0);
          }}
          className="flex-1 px-2 py-4 text-base outline-none text-gray-900"
        />

        <button className="p-4 hover:bg-gray-100 transition-colors">
          <Search className="h-5 w-5 text-blue-600" />
        </button>
      </div>

      {/* Autocomplete Dropdown */}
      {isOpen && searchResults.length > 0 && (
        <div className="mt-2 bg-white rounded-lg shadow-lg overflow-hidden max-h-96 overflow-y-auto">
          {searchResults.map((result) => {
            const Icon = getResultIcon(result.type);
            return (
              <button
                key={`${result.type}-${result.id}`}
                onClick={() => handleSelect(result)}
                className="w-full px-4 py-3 text-left hover:bg-gray-100 transition-colors flex items-center gap-3"
              >
                {result.flag ? (
                  <img src={result.flag} alt="" className="h-5 w-7 object-cover rounded flex-shrink-0" />
                ) : (
                  <Icon className="h-5 w-5 text-gray-500 flex-shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="text-gray-900 font-medium">{result.name}</div>
                  {result.description && (
                    <div className="text-xs text-gray-500 truncate">{result.description}</div>
                  )}
                </div>
                <div className="text-xs text-gray-400 uppercase flex-shrink-0">{result.type}</div>
              </button>
            );
          })}
        </div>
      )}

      {/* No results message */}
      {isOpen && searchQuery.length > 1 && searchResults.length === 0 && (
        <div className="mt-2 bg-white rounded-lg shadow-lg p-4 text-center text-gray-500">
          No results found for &quot;{searchQuery}&quot;
        </div>
      )}
    </div>
  );
}
