// src/app/countries/_components/CountriesSearch.tsx
"use client";

import { useState } from "react";
import { Search, Filter, X, SortAsc, SortDesc, Settings2, CheckCircle } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Badge } from "~/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";

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
    setShowAdvancedFilters(false);
  };

  const hasActiveFilters = searchTerm !== "" || tierFilter !== "all" || continentFilter !== "all" || regionFilter !== "all" || sortField !== "name" || sortDirection !== "asc";

  return (
    <div className="mb-8 p-4 sm:p-6 bg-card border rounded-lg shadow-sm">
      {/* Main Search and Basic Controls */}
      <div className="flex flex-col sm:flex-row gap-3 items-center">
        <div className="relative flex-grow w-full sm:w-auto">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            type="text"
            placeholder="Search by country name..."
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-10 pr-10 w-full" // Added w-full
          />
          {searchTerm && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onSearchChange("")}
              className="absolute inset-y-0 right-0 h-full px-3 text-muted-foreground hover:text-foreground"
              aria-label="Clear search term"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>

        <div className="flex gap-2 w-full sm:w-auto justify-between sm:justify-start">
           <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="flex-1 sm:flex-none">
                {sortDirection === 'asc' ? <SortAsc className="h-4 w-4 mr-0 sm:mr-2" /> : <SortDesc className="h-4 w-4 mr-0 sm:mr-2" />}
                <span className="hidden sm:inline">{sortOptions.find(o => o.value === sortField)?.label}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Sort By</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {sortOptions.map(option => (
                <DropdownMenuItem key={option.value} onClick={() => onSortChange(option.value, sortDirection)}>
                  {option.label}
                  {sortField === option.value && <CheckCircle className="ml-auto h-4 w-4 text-primary" />}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
               <DropdownMenuItem onClick={() => onSortChange(sortField, 'asc')}>
                Ascending
                {sortDirection === 'asc' && <CheckCircle className="ml-auto h-4 w-4 text-primary" />}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onSortChange(sortField, 'desc')}>
                Descending
                {sortDirection === 'desc' && <CheckCircle className="ml-auto h-4 w-4 text-primary" />}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            variant="outline"
            onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
            className={`flex-1 sm:flex-none ${showAdvancedFilters ? 'bg-primary text-primary-foreground hover:bg-primary/90' : ''}`}
          >
            <Filter className="h-4 w-4 mr-0 sm:mr-2" />
            <span className="hidden sm:inline">Filters</span>
          </Button>

          {hasActiveFilters && (
            <Button
              variant="destructive"
              onClick={handleClearFilters}
              className="flex-1 sm:flex-none"
              title="Clear all filters"
            >
              <X className="h-4 w-4 mr-0 sm:mr-1" />
              <span className="hidden sm:inline">Clear</span>
            </Button>
          )}
        </div>
      </div>

      {/* Advanced Filters Panel */}
      {showAdvancedFilters && (
        <div className="mt-4 pt-4 border-t border-border animate-fade-in">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            <div>
              <label htmlFor="tierFilter" className="text-sm font-medium text-muted-foreground mb-1 block">Economic Tier</label>
              <Select value={tierFilter} onValueChange={(value) => onTierFilterChange(value as TierFilter)}>
                <SelectTrigger id="tierFilter">
                  <SelectValue placeholder="Select tier" />
                </SelectTrigger>
                <SelectContent>
                  {tierOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label htmlFor="continentFilter" className="text-sm font-medium text-muted-foreground mb-1 block">Continent</label>
              <Select value={continentFilter} onValueChange={onContinentFilterChange}>
                <SelectTrigger id="continentFilter">
                  <SelectValue placeholder="Select continent" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Continents</SelectItem>
                  {availableContinents.map((continent) => (
                    <SelectItem key={continent} value={continent}>
                      {continent}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label htmlFor="regionFilter" className="text-sm font-medium text-muted-foreground mb-1 block">Region</label>
              <Select value={regionFilter} onValueChange={onRegionFilterChange} disabled={continentFilter === "all" && availableRegions.length === 0}>
                <SelectTrigger id="regionFilter">
                  <SelectValue placeholder="Select region" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Regions</SelectItem>
                  {availableRegions.map((region) => (
                    <SelectItem key={region} value={region}>
                      {region}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      )}

      {/* Results Summary */}
      <div className="mt-4 text-sm text-muted-foreground">
        <span>
          Showing {filteredResults.toLocaleString()} of {totalResults.toLocaleString()} countries
        </span>
        {hasActiveFilters && (
          <div className="mt-2 flex flex-wrap gap-1 items-center">
            <span className="font-medium mr-1">Active Filters:</span>
            {searchTerm && <Badge variant="secondary">Search: "{searchTerm.length > 15 ? searchTerm.substring(0,12) + '...' : searchTerm}"</Badge>}
            {tierFilter !== 'all' && <Badge variant="secondary">Tier: {tierFilter}</Badge>}
            {continentFilter !== 'all' && <Badge variant="secondary">Continent: {continentFilter}</Badge>}
            {regionFilter !== 'all' && <Badge variant="secondary">Region: {regionFilter}</Badge>}
            {(sortField !== 'name' || sortDirection !== 'asc') && (
              <Badge variant="secondary">
                Sort: {sortOptions.find(o => o.value === sortField)?.label} ({sortDirection})
              </Badge>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
