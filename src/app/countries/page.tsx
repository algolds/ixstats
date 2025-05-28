// src/app/countries/page.tsx
"use client";

import { useState, useMemo } from "react";
import { api } from "~/trpc/react";
import { 
  CountriesPageHeader,
  CountriesSearch,
  CountriesGrid,
  type SortField,
  type SortDirection,
  type TierFilter
} from "./_components";

export default function CountriesPage() {
  // Search and filter state
  const [searchTerm, setSearchTerm] = useState("");
  const [tierFilter, setTierFilter] = useState<TierFilter>("all");
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  // Data fetching
  const { data: countries, isLoading, error } = api.countries.getAll.useQuery();

  // Filter and sort countries
  const filteredAndSortedCountries = useMemo(() => {
    if (!countries) return [];

    let filtered = countries;

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter((country) =>
        country.name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Apply tier filter
    if (tierFilter !== "all") {
      filtered = filtered.filter((country) => country.economicTier === tierFilter);
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (sortField) {
        case 'name':
          aValue = a.name.toLowerCase();
          bValue = b.name.toLowerCase();
          break;
        case 'population':
          aValue = a.currentPopulation;
          bValue = b.currentPopulation;
          break;
        case 'gdpPerCapita':
          aValue = a.currentGdpPerCapita;
          bValue = b.currentGdpPerCapita;
          break;
        case 'totalGdp':
          aValue = a.currentTotalGdp;
          bValue = b.currentTotalGdp;
          break;
        case 'economicTier':
          // Sort by tier order: Advanced > Developed > Emerging > Developing
          const tierOrder = { 'Advanced': 4, 'Developed': 3, 'Emerging': 2, 'Developing': 1 };
          aValue = tierOrder[a.economicTier as keyof typeof tierOrder] || 0;
          bValue = tierOrder[b.economicTier as keyof typeof tierOrder] || 0;
          break;
        default:
          aValue = a.name.toLowerCase();
          bValue = b.name.toLowerCase();
      }

      // Handle null/undefined values
      if (aValue == null && bValue == null) return 0;
      if (aValue == null) return 1;
      if (bValue == null) return -1;

      // String comparison for name, number comparison for others
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        const comparison = aValue.localeCompare(bValue);
        return sortDirection === 'asc' ? comparison : -comparison;
      } else {
        const comparison = aValue - bValue;
        return sortDirection === 'asc' ? comparison : -comparison;
      }
    });

    return filtered;
  }, [countries, searchTerm, tierFilter, sortField, sortDirection]);

  const handleSortChange = (field: SortField, direction: SortDirection) => {
    setSortField(field);
    setSortDirection(direction);
  };

  if (error) {
    return (
      <div className="min-h-screen bg-[var(--color-bg-primary)] flex items-center justify-center">
        <div className="text-center p-6 bg-[var(--color-error)]20 border border-[var(--color-error)]40 rounded-lg max-w-md">
          <div className="text-[var(--color-error)] text-6xl mb-4">⚠️</div>
          <h3 className="text-xl font-medium text-[var(--color-text-primary)] mb-2">
            Error Loading Countries
          </h3>
          <p className="text-sm text-[var(--color-text-muted)] mb-4">
            {error.message}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="btn-primary"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--color-bg-primary)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page Header */}
        <CountriesPageHeader 
          totalCountries={countries?.length || 0}
          isLoading={isLoading}
        />

        {/* Search and Filters */}
        <CountriesSearch
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          tierFilter={tierFilter}
          onTierFilterChange={setTierFilter}
          sortField={sortField}
          sortDirection={sortDirection}
          onSortChange={handleSortChange}
          totalResults={countries?.length || 0}
          filteredResults={filteredAndSortedCountries.length}
        />

        {/* Countries Grid */}
        <CountriesGrid
          countries={filteredAndSortedCountries}
          isLoading={isLoading}
          searchTerm={searchTerm}
        />
      </div>
    </div>
  );
}