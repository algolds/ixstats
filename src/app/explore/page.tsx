'use client';

import { useState, useMemo, useEffect } from 'react';
import { usePageTitle } from '~/hooks/usePageTitle';
import { useRouter } from 'next/navigation';
import {
  CountriesPageHeader,
  CountriesSearch,
  CountriesGrid
} from '../countries/_components';
import type {
  SortField,
  SortDirection,
  TierFilter,
  PopulationRange
} from '../countries/_components/CountriesSearch';
import { api } from '~/trpc/react';
import CountriesFilterSidebar from '../countries/_components/CountriesFilterSidebar';
import CountriesSortBar from '../countries/_components/CountriesSortBar';
import { CountryComparisonModal } from '../countries/_components/CountryComparisonModal';
import { useCountryComparison } from '~/hooks/useCountryComparison';
import { createUrl } from '~/lib/url-utils';

import type { PageCountryData } from '../countries/_components/CountriesGrid';

export default function ExplorePage() {
  usePageTitle({ title: "Explore" });
  
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState('');
  const [tierFilter, setTierFilter] =
    useState<TierFilter>('all');
  const [continentFilter, setContinentFilter] =
    useState<string>('all');
  const [regionFilter, setRegionFilter] =
    useState<string>('all');
  const [populationRange, setPopulationRange] =
    useState<PopulationRange>({});
  const [sortField, setSortField] =
    useState<SortField>('name');
  const [sortDirection, setSortDirection] =
    useState<SortDirection>('asc');
  const [page, setPage] = useState(1);
  const pageSize = 9;
  
  // Comparison functionality
  const [isComparisonModalOpen, setIsComparisonModalOpen] = useState(false);
  const { comparisonCountries, addCountryToComparison, removeCountryFromComparison, clearComparison, getAvailableCountries, isLoading: isLoadingComparison } = useCountryComparison();

  // Get all countries without filtering at the API level to enable client-side filtering
  const {
    data: countriesResult,
    isLoading,
    error
  } = api.countries.getAll.useQuery({
    limit: 1000 // Get all countries for client-side filtering
  }, {
    refetchOnWindowFocus: false,
    staleTime: 30 * 1000
  });

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600">
            Error Loading Countries
          </h1>
          <p className="text-muted-foreground mt-2">
            {error.message}
          </p>
        </div>
      </div>
    );
  }

  const raw = countriesResult?.countries || [];
  const processed: PageCountryData[] = raw.map((c: any) => ({
    id: c.id,
    name: c.name,
    continent: c.continent,
    region: c.region,
    economicTier: c.economicTier,
    populationTier: c.populationTier,
    currentPopulation: c.currentPopulation,
    currentGdpPerCapita: c.currentGdpPerCapita,
    currentTotalGdp: c.currentTotalGdp,
    landArea: c.landArea,
    populationDensity: c.populationDensity,
    gdpDensity: c.gdpDensity,
    lastCalculated: c.lastCalculated
  }));

  const availableContinents = useMemo(() => {
    return Array.from(
      new Set(
        processed
          .map((c) => c.continent)
          .filter((x): x is string => !!x)
      )
    ).sort();
  }, [processed]);

  const availableRegions = useMemo(() => {
    if (continentFilter === 'all') return [];
    return Array.from(
      new Set(
        processed
          .filter((c) => c.continent === continentFilter)
          .map((c) => c.region)
          .filter((x): x is string => !!x)
      )
    ).sort();
  }, [processed, continentFilter]);

  const filtered = useMemo(() => {
    let arr = [...processed];
    
    // Search filter
    const term = searchTerm.toLowerCase().trim();
    if (term) {
      arr = arr.filter((c) =>
        c.name.toLowerCase().includes(term) ||
        c.continent?.toLowerCase().includes(term) ||
        c.region?.toLowerCase().includes(term)
      );
    }
    
    // Tier filter
    if (tierFilter !== 'all') {
      arr = arr.filter((c) => c.economicTier === tierFilter);
    }
    
    // Continent filter
    if (continentFilter !== 'all') {
      arr = arr.filter((c) => c.continent === continentFilter);
    }
    
    // Region filter
    if (regionFilter !== 'all') {
      arr = arr.filter((c) => c.region === regionFilter);
    }
    
    // Population range filter
    const { min, max } = populationRange;
    if (min !== undefined) {
      arr = arr.filter((c) => c.currentPopulation >= min);
    }
    if (max !== undefined) {
      arr = arr.filter((c) => c.currentPopulation <= max);
    }
    
    // Sorting
    const m = sortDirection === 'asc' ? 1 : -1;
    arr = arr.sort((a, b) => {
      if (sortField === 'name') {
        return m * a.name.localeCompare(b.name);
      }
      let va, vb;
      switch (sortField) {
        case 'population':
          va = a.currentPopulation ?? 0;
          vb = b.currentPopulation ?? 0;
          break;
        case 'gdpPerCapita':
          va = a.currentGdpPerCapita ?? 0;
          vb = b.currentGdpPerCapita ?? 0;
          break;
        case 'totalGdp':
          va = a.currentTotalGdp ?? 0;
          vb = b.currentTotalGdp ?? 0;
          break;
        case 'economicTier':
          va = a.economicTier ?? '';
          vb = b.economicTier ?? '';
          return m * va.localeCompare(vb);
        case 'continent':
          va = a.continent ?? '';
          vb = b.continent ?? '';
          return m * va.localeCompare(vb);
        case 'region':
          va = a.region ?? '';
          vb = b.region ?? '';
          return m * va.localeCompare(vb);
        case 'landArea':
          va = a.landArea ?? 0;
          vb = b.landArea ?? 0;
          break;
        case 'populationDensity':
          va = a.populationDensity ?? 0;
          vb = b.populationDensity ?? 0;
          break;
        default:
          va = (a as any)[sortField] ?? 0;
          vb = (b as any)[sortField] ?? 0;
          break;
      }
      return m * (va - vb);
    });
    return arr;
  }, [
    processed,
    searchTerm,
    tierFilter,
    continentFilter,
    regionFilter,
    populationRange,
    sortField,
    sortDirection
  ]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [
    searchTerm,
    tierFilter,
    continentFilter,
    regionFilter,
    populationRange,
    sortField,
    sortDirection
  ]);

  const pageCount = Math.ceil(filtered.length / pageSize);
  const paged = filtered.slice(
    (page - 1) * pageSize,
    page * pageSize
  );

  const totalPop = filtered.reduce(
    (sum, c) => sum + c.currentPopulation,
    0
  );
  const totalGdp = filtered.reduce(
    (sum, c) => sum + c.currentTotalGdp,
    0
  );

  // Handler to clear all filters
  const handleClearAll = () => {
    setSearchTerm('');
    setTierFilter('all');
    setContinentFilter('all');
    setRegionFilter('all');
    setPopulationRange({});
    setSortField('name');
    setSortDirection('asc');
  };

  // Wrapper function to handle tier filter changes
  const handleTierFilterChange = (tier: string | 'all' | 'Advanced' | 'Developed' | 'Emerging' | 'Developing') => {
    setTierFilter(tier as TierFilter);
  };

  // Handler for compare button
  const handleCompare = () => {
    setIsComparisonModalOpen(true);
  };

  // Handle country selection from comparison modal
  const handleCountrySelect = (countryId: string) => {
    // Navigate to country detail page
    // Find country by ID to get slug, then navigate
    const country = processed.find(c => c.id === countryId);
    if (country?.slug) {
      router.push(createUrl(`/countries/${country.slug}`));
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <CountriesPageHeader
          isLoading={isLoading}
          totalPopulation={totalPop}
          combinedGdp={totalGdp}
          filteredCountries={filtered}
        />

        <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-8">
          {/* Sidebar: Filters (sticky on desktop) */}
          <div className="hidden lg:block">
            <CountriesFilterSidebar
              searchTerm={searchTerm}
              onSearchChange={setSearchTerm}
              tierFilter={tierFilter}
              onTierFilterChange={handleTierFilterChange}
              continentFilter={continentFilter}
              onContinentFilterChange={setContinentFilter}
              regionFilter={regionFilter}
              onRegionFilterChange={setRegionFilter}
              populationRange={populationRange}
              onPopulationRangeChange={setPopulationRange}
              availableContinents={availableContinents}
              availableRegions={availableRegions}
              onClearAll={handleClearAll}
            />
          </div>

          {/* Main content: Sort/search bar, grid, pagination */}
          <div>
            {/* On mobile, show filter button to open modal (not implemented yet) */}
            <div className="lg:hidden mb-4">
              <button className="btn-secondary w-full py-2 rounded-md">Show Filters</button>
            </div>

            {/* Sort/search bar and compare button */}
            <CountriesSortBar
              sortField={sortField}
              sortDirection={sortDirection}
              onSortChange={(f, d) => {
                setSortField(f);
                setSortDirection(d);
              }}
              searchTerm={searchTerm}
              onSearchChange={setSearchTerm}
              onCompare={handleCompare}
            />

            {/* Country grid */}
            <CountriesGrid
              countries={paged}
              isLoading={isLoading}
              searchTerm={searchTerm}
              page={page}
              pageCount={pageCount}
              onPageChangeAction={setPage}
            />
          </div>
        </div>
      </div>

      {/* Country Comparison Modal */}
      <CountryComparisonModal
        isOpen={isComparisonModalOpen}
        onClose={() => setIsComparisonModalOpen(false)}
        availableCountries={getAvailableCountries()}
        onCountrySelect={handleCountrySelect}
      />
    </div>
  );
} 