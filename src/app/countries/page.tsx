'use client';

import { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  CountriesPageHeader,
  CountriesSearch,
  CountriesGrid
} from './_components';
import type {
  SortField,
  SortDirection,
  TierFilter,
  PopulationRange
} from './_components';
import { api } from '~/trpc/react';
import CountriesFilterSidebar from './_components/CountriesFilterSidebar';
import CountriesSortBar from './_components/CountriesSortBar';
import { CountryComparisonModal } from './_components/CountryComparisonModal';
import { useCountryComparison } from '~/hooks/useCountryComparison';
import { createUrl } from '~/lib/url-utils';

export type PageCountryData = {
  id: string;
  name: string;
  continent: string | null;
  region: string | null;
  economicTier: string | null;
  populationTier: string | null;
  currentPopulation: number;
  currentGdpPerCapita: number;
  currentTotalGdp: number;
  landArea: number | null;
  populationDensity: number | null;
  gdpDensity: number | null;
  lastCalculated: string;
};

export default function CountriesPage() {
  useEffect(() => {
    document.title = "Countries - IxStats";
  }, []);

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

  const queryInput = useMemo(() => ({
    search: searchTerm || undefined,
    continent:
      continentFilter === 'all'
        ? undefined
        : continentFilter,
    economicTier:
      tierFilter === 'all' ? undefined : tierFilter,
    limit: 1000
  }), [
    searchTerm,
    continentFilter,
    tierFilter
  ]);

  const {
    data: countriesResult,
    isLoading,
    error
  } = api.countries.getAll.useQuery(queryInput, {
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
    );
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
    );
  }, [processed, continentFilter]);

  const filtered = useMemo(() => {
    let arr = [...processed];
    const term = searchTerm.toLowerCase();
    if (term) arr = arr.filter((c) =>
      c.name.toLowerCase().includes(term)
    );
    if (tierFilter !== 'all')
      arr = arr.filter((c) => c.economicTier === tierFilter);
    if (continentFilter !== 'all')
      arr = arr.filter((c) => c.continent === continentFilter);
    if (regionFilter !== 'all')
      arr = arr.filter((c) => c.region === regionFilter);
    const { min, max } = populationRange;
    if (min !== undefined)
      arr = arr.filter((c) => c.currentPopulation >= min);
    if (max !== undefined)
      arr = arr.filter((c) => c.currentPopulation <= max);
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

  // reset page when filters change
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
    router.push(createUrl(`/countries/${countryId}`));
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <CountriesPageHeader
          isLoading={isLoading}
          totalPopulation={totalPop}
          combinedGdp={totalGdp}
        />

        <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-8">
          {/* Sidebar: Filters */}
          <div className="order-last lg:order-first lg:block">
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

          {/* Main content: Sort bar, grid, pagination */}
          <div>

            {/* Sort bar and compare button */}
            <CountriesSortBar
              sortField={sortField}
              sortDirection={sortDirection}
              onSortChange={(f, d) => {
                setSortField(f);
                setSortDirection(d);
              }}
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
