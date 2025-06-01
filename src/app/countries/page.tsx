'use client';

import { useState, useMemo, useEffect } from 'react';
import {
  CountriesPageHeader,
  CountriesSearch,
  CountriesStats,
  CountriesGrid
} from './_components';
import type {
  SortField,
  SortDirection,
  TierFilter,
  PopulationRange
} from './_components';
import { api } from '~/trpc/react';

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
      const va = (a as any)[sortField] ?? 0;
      const vb = (b as any)[sortField] ?? 0;
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

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <CountriesPageHeader
          totalCountries={processed.length}
          isLoading={isLoading}
        />

        <CountriesSearch
          searchTerm={searchTerm}
          onSearchChangeAction={setSearchTerm}
          tierFilter={tierFilter}
          onTierFilterChangeAction={setTierFilter}
          continentFilter={continentFilter}
          onContinentFilterChangeAction={setContinentFilter}
          regionFilter={regionFilter}
          onRegionFilterChangeAction={setRegionFilter}
          populationRange={populationRange}
          onPopulationRangeChangeAction={setPopulationRange}
          sortField={sortField}
          sortDirection={sortDirection}
          onSortChangeAction={(f, d) => {
            setSortField(f);
            setSortDirection(d);
          }}
          totalResults={processed.length}
          filteredResults={filtered.length}
          availableContinents={availableContinents}
          availableRegions={availableRegions}
        />

        <CountriesStats
          totalCountries={processed.length}
          showing={filtered.length}
          totalPopulation={totalPop}
          combinedGdp={totalGdp}
        />

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
  );
}
