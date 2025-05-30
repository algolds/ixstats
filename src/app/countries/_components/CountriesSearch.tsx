// src/app/countries/_components/CountriesSearch.tsx
"use client";

import { useState } from "react";
import { Search, Filter, X, SortAsc, SortDesc } from "lucide-react";

export type SortField = 'name' | 'population' | 'gdpPerCapita' | 'totalGdp' | 'economicTier' | 'continent' | 'region' | 'landArea' | 'populationDensity';
export type SortDirection = 'asc' | 'desc';
export type TierFilter = 'all' | 'Advanced' | 'Developed' | 'Emerging' | 'Developing';

interface CountriesSearchProps {
  searchTerm: string;
  onSearchChange: (term: string) => void;
  tierFilter: TierFilter;
  onTierFilterChange: (tier: TierFilter) => void;
  continentFilter: string;
  onContinentFilterChange: (continent: string) => void;
  regionFilter: string;
  onRegionFilterChange: (region: string) => void;
  sortField: SortField;
  sortDirection: SortDirection;
  onSortChange: (field: SortField, direction: SortDirection) => void;
  totalResults: number;
  filteredResults: number;
  availableContinents: string[];
  availableRegions: string[];
}

export function CountriesSearch({
  searchTerm,
  onSearchChange,
  tierFilter,
  onTierFilterChange,
  continentFilter,
  onContinentFilterChange,
  regionFilter,
  onRegionFilterChange,
  sortField,
  sortDirection,
  onSortChange,
  totalResults,
  filteredResults,
  availableContinents,
  availableRegions
}: CountriesSearchProps) {
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  const sortOptions = [
    { value: 'name', label: 'Country Name' },
    { value: 'population', label: 'Population' },
    { value: 'gdpPerCapita', label: 'GDP per Capita' },
    { value: 'totalGdp', label: 'Total GDP' },
    { value: 'economicTier', label: 'Economic Tier' },
    { value: 'continent', label: 'Continent' },
    { value: 'region', label: 'Region' },
    { value: 'landArea', label: 'Land Area' },
    { value: 'populationDensity', label: 'Population Density' },
  ] as const;

  const tierOptions = [
    { value: 'all', label: 'All Tiers' },
    { value: 'Advanced', label: 'Advanced' },
    { value: 'Developed', label: 'Developed' },
    { value: 'Emerging', label: 'Emerging' },
    { value: 'Developing', label: 'Developing' },
  ] as const;

  const handleClearFilters = () => {
    onSearchChange("");
    onTierFilterChange("all");
    onContinentFilterChange("all");
    onRegionFilterChange("all");
    onSortChange("name", "asc");
  };

  const hasActiveFilters = searchTerm !== "" || tierFilter !== "all" || continentFilter !== "all" || regionFilter !== "all" || sortField !== "name" || sortDirection !== "asc";

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
              className="form-input pl-10 pr-10" // Increased pr for clear button
            />
            {searchTerm && (
              <button
                onClick={() => onSearchChange("")}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
                aria-label="Clear search term"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
        
        <div className="flex gap-3">
          <button
            onClick={() => onSortChange(sortField, sortDirection === 'asc' ? 'desc' : 'asc')}
            className="btn-secondary flex items-center px-3 py-2"
            title={`Sort by ${sortOptions.find(o => o.value === sortField)?.label} ${sortDirection === 'asc' ? 'descending' : 'ascending'}`}
          >
            {sortDirection === 'asc' ? <SortAsc className="h-4 w-4" /> : <SortDesc className="h-4 w-4" />}
            <span className="ml-2 hidden sm:inline">{sortOptions.find(o => o.value === sortField)?.label}</span>
          </button>
          
          <button
            onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
            className={`btn-secondary flex items-center px-3 py-2 ${showAdvancedFilters ? 'bg-[var(--color-brand-primary)] text-white hover:bg-[var(--color-brand-dark)]' : ''}`}
          >
            <Filter className="h-4 w-4 mr-2" />
            Filters
          </button>
          
          {hasActiveFilters && (
            <button
              onClick={handleClearFilters}
              className="btn-secondary text-[var(--color-error)] hover:bg-[var(--color-error)] hover:text-white border-[var(--color-error)] hover:border-[var(--color-error-dark)] flex items-center px-3 py-2"
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
        <div className="bg-[var(--color-bg-tertiary)] border border-[var(--color-border-primary)] rounded-lg p-6 mb-4 animate-fade-in">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
            <div>
              <label htmlFor="tierFilter" className="form-label mb-1">Economic Tier</label>
              <select
                id="tierFilter"
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

            <div>
              <label htmlFor="continentFilter" className="form-label mb-1">Continent</label>
              <select
                id="continentFilter"
                value={continentFilter}
                onChange={(e) => onContinentFilterChange(e.target.value)}
                className="form-select"
              >
                <option value="all">All Continents</option>
                {availableContinents.map((continent) => (
                  <option key={continent} value={continent}>
                    {continent}
                  </option>
                ))}
              </select>
            </div>
            
            <div>
              <label htmlFor="regionFilter" className="form-label mb-1">Region</label>
              <select
                id="regionFilter"
                value={regionFilter}
                onChange={(e) => onRegionFilterChange(e.target.value)}
                className="form-select"
              >
                <option value="all">All Regions</option>
                {availableRegions.map((region) => (
                  <option key={region} value={region}>
                    {region}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="sortField" className="form-label mb-1">Sort By</label>
              <select
                id="sortField"
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

            <div>
              <label htmlFor="sortDirection" className="form-label mb-1">Sort Direction</label>
              <select
                id="sortDirection"
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
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium">Active:</span>
            {searchTerm && (
              <span className="filter-tag">
                Search: "{searchTerm.length > 15 ? searchTerm.substring(0,12) + '...' : searchTerm}"
              </span>
            )}
            {tierFilter !== 'all' && (
              <span className="filter-tag">
                Tier: {tierFilter}
              </span>
            )}
            {continentFilter !== 'all' && (
              <span className="filter-tag">
                Continent: {continentFilter}
              </span>
            )}
            {regionFilter !== 'all' && (
              <span className="filter-tag">
                Region: {regionFilter}
              </span>
            )}
            {(sortField !== 'name' || sortDirection !== 'asc') && (
              <span className="filter-tag">
                Sort: {sortOptions.find(o => o.value === sortField)?.label} ({sortDirection})
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}