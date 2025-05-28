// src/app/countries/_components/CountriesSearch.tsx
"use client";

import { useState } from "react";
import { Search, Filter, X, SortAsc, SortDesc } from "lucide-react";

export type SortField = 'name' | 'population' | 'gdpPerCapita' | 'totalGdp' | 'economicTier';
export type SortDirection = 'asc' | 'desc';
export type TierFilter = 'all' | 'Advanced' | 'Developed' | 'Emerging' | 'Developing';

interface CountriesSearchProps {
  searchTerm: string;
  onSearchChange: (term: string) => void;
  tierFilter: TierFilter;
  onTierFilterChange: (tier: TierFilter) => void;
  sortField: SortField;
  sortDirection: SortDirection;
  onSortChange: (field: SortField, direction: SortDirection) => void;
  totalResults: number;
  filteredResults: number;
}

export function CountriesSearch({
  searchTerm,
  onSearchChange,
  tierFilter,
  onTierFilterChange,
  sortField,
  sortDirection,
  onSortChange,
  totalResults,
  filteredResults
}: CountriesSearchProps) {
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  const sortOptions = [
    { value: 'name', label: 'Country Name' },
    { value: 'population', label: 'Population' },
    { value: 'gdpPerCapita', label: 'GDP per Capita' },
    { value: 'totalGdp', label: 'Total GDP' },
    { value: 'economicTier', label: 'Economic Tier' },
  ] as const;

  const tierOptions = [
    { value: 'all', label: 'All Tiers', color: 'text-[var(--color-text-primary)]' },
    { value: 'Advanced', label: 'Advanced', color: 'text-[var(--color-tier-advanced)]' },
    { value: 'Developed', label: 'Developed', color: 'text-[var(--color-tier-developed)]' },
    { value: 'Emerging', label: 'Emerging', color: 'text-[var(--color-tier-emerging)]' },
    { value: 'Developing', label: 'Developing', color: 'text-[var(--color-tier-developing)]' },
  ] as const;

  const handleClearFilters = () => {
    onSearchChange("");
    onTierFilterChange("all");
    onSortChange("name", "asc");
  };

  const hasActiveFilters = searchTerm !== "" || tierFilter !== "all" || sortField !== "name" || sortDirection !== "asc";

  return (
    <div className="mb-8">
      {/* Main Search Bar */}
      <div className="flex flex-col lg:flex-row gap-4 mb-4">
        <div className="flex-1">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="text-[var(--color-text-muted)] h-5 w-5" />
            </div>
            <input
              type="text"
              placeholder="Search by country name..."
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
              className="form-input pl-10 pr-4"
            />
            {searchTerm && (
              <button
                onClick={() => onSearchChange("")}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
        
        <div className="flex gap-3">
          {/* Quick Sort Toggle */}
          <button
            onClick={() => onSortChange(sortField, sortDirection === 'asc' ? 'desc' : 'asc')}
            className="btn-secondary flex items-center px-3 py-2"
            title={`Sort ${sortDirection === 'asc' ? 'descending' : 'ascending'}`}
          >
            {sortDirection === 'asc' ? <SortAsc className="h-4 w-4" /> : <SortDesc className="h-4 w-4" />}
          </button>
          
          {/* Advanced Filters Toggle */}
          <button
            onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
            className={`btn-secondary flex items-center px-3 py-2 ${showAdvancedFilters ? 'bg-[var(--color-brand-primary)] text-white' : ''}`}
          >
            <Filter className="h-4 w-4 mr-2" />
            Filters
          </button>
          
          {hasActiveFilters && (
            <button
              onClick={handleClearFilters}
              className="btn-secondary text-[var(--color-error)] hover:bg-[var(--color-error)] hover:text-white flex items-center px-3 py-2"
              title="Clear all filters"
            >
              <X className="h-4 w-4 mr-1" />
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Advanced Filters Panel */}
      {showAdvancedFilters && (
        <div className="bg-[var(--color-bg-tertiary)] border border-[var(--color-border-primary)] rounded-lg p-4 mb-4 animate-fade-in">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Economic Tier Filter */}
            <div>
              <label className="form-label mb-2">Economic Tier</label>
              <select
                value={tierFilter}
                onChange={(e) => onTierFilterChange(e.target.value as TierFilter)}
                className="form-select"
              >
                {tierOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Sort Field */}
            <div>
              <label className="form-label mb-2">Sort By</label>
              <select
                value={sortField}
                onChange={(e) => onSortChange(e.target.value as SortField, sortDirection)}
                className="form-select"
              >
                {sortOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Sort Direction */}
            <div>
              <label className="form-label mb-2">Sort Direction</label>
              <select
                value={sortDirection}
                onChange={(e) => onSortChange(sortField, e.target.value as SortDirection)}
                className="form-select"
              >
                <option value="asc">Ascending</option>
                <option value="desc">Descending</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Results Summary */}
      <div className="flex items-center justify-between text-sm text-[var(--color-text-muted)]">
        <span>
          Showing {filteredResults.toLocaleString()} of {totalResults.toLocaleString()} countries
          {hasActiveFilters && (
            <span className="ml-2 text-[var(--color-brand-primary)]">
              (filtered)
            </span>
          )}
        </span>
        
        {hasActiveFilters && (
          <div className="flex items-center gap-2">
            <span>Active filters:</span>
            {searchTerm && (
              <span className="px-2 py-1 bg-[var(--color-brand-primary)] text-white text-xs rounded-full">
                Search: "{searchTerm}"
              </span>
            )}
            {tierFilter !== 'all' && (
              <span className="px-2 py-1 bg-[var(--color-info)] text-white text-xs rounded-full">
                Tier: {tierFilter}
              </span>
            )}
            {(sortField !== 'name' || sortDirection !== 'asc') && (
              <span className="px-2 py-1 bg-[var(--color-success)] text-white text-xs rounded-full">
                Sort: {sortOptions.find(o => o.value === sortField)?.label} ({sortDirection})
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}