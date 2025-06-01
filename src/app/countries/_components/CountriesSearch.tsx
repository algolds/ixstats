'use client';

import { useState } from 'react';
import {
  Search,
  Filter as FilterIcon,
  X,
  SortAsc,
  SortDesc,
  CheckCircle
} from 'lucide-react';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem
} from '~/components/ui/select';
import { Badge } from '~/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuItem
} from '~/components/ui/dropdown-menu';

export type SortField =
  | 'name'
  | 'population'
  | 'gdpPerCapita'
  | 'totalGdp'
  | 'economicTier'
  | 'continent'
  | 'region'
  | 'landArea'
  | 'populationDensity';
export type SortDirection = 'asc' | 'desc';
export type TierFilter =
  | 'all'
  | 'Advanced'
  | 'Developed'
  | 'Emerging'
  | 'Developing';

export interface PopulationRange {
  min?: number;
  max?: number;
}

interface CountriesSearchProps {
  searchTerm: string;
  onSearchChangeAction: (term: string) => void;
  tierFilter: TierFilter;
  onTierFilterChangeAction: (tier: TierFilter) => void;
  continentFilter: string;
  onContinentFilterChangeAction: (continent: string) => void;
  regionFilter: string;
  onRegionFilterChangeAction: (region: string) => void;
  populationRange: PopulationRange;
  onPopulationRangeChangeAction: (range: PopulationRange) => void;
  sortField: SortField;
  sortDirection: SortDirection;
  onSortChangeAction: (field: SortField, direction: SortDirection) => void;
  totalResults: number;
  filteredResults: number;
  availableContinents: string[];
  availableRegions: string[];
}

export function CountriesSearch({
  searchTerm,
  onSearchChangeAction,
  tierFilter,
  onTierFilterChangeAction,
  continentFilter,
  onContinentFilterChangeAction,
  regionFilter,
  onRegionFilterChangeAction,
  populationRange,
  onPopulationRangeChangeAction,
  sortField,
  sortDirection,
  onSortChangeAction,
  totalResults,
  filteredResults,
  availableContinents,
  availableRegions
}: CountriesSearchProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);

  const sortOptions = [
    { value: 'name', label: 'Country Name' },
    { value: 'population', label: 'Population' },
    { value: 'gdpPerCapita', label: 'GDP per Capita' },
    { value: 'totalGdp', label: 'Total GDP' },
    { value: 'economicTier', label: 'Economic Tier' },
    { value: 'continent', label: 'Continent' },
    { value: 'region', label: 'Region' },
    { value: 'landArea', label: 'Land Area' },
    { value: 'populationDensity', label: 'Population Density' }
  ] as const;

  const tierOptions = [
    { value: 'all', label: 'All Tiers' },
    { value: 'Advanced', label: 'Advanced' },
    { value: 'Developed', label: 'Developed' },
    { value: 'Emerging', label: 'Emerging' },
    { value: 'Developing', label: 'Developing' }
  ] as const;

  const handleClear = () => {
    onSearchChangeAction('');
    onTierFilterChangeAction('all');
    onContinentFilterChangeAction('all');
    onRegionFilterChangeAction('all');
    onPopulationRangeChangeAction({});
    onSortChangeAction('name', 'asc');
    setShowAdvanced(false);
  };

  const hasFilters =
    searchTerm !== '' ||
    tierFilter !== 'all' ||
    continentFilter !== 'all' ||
    regionFilter !== 'all' ||
    populationRange.min !== undefined ||
    populationRange.max !== undefined ||
    sortField !== 'name' ||
    sortDirection !== 'asc';

  return (
    <div className="mb-8 p-4 sm:p-6 bg-card border rounded-lg shadow-sm">
      <div className="flex flex-col sm:flex-row gap-3 items-center">
        <div className="relative flex-grow w-full sm:w-auto">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            type="text"
            placeholder="Search by country name..."
            value={searchTerm}
            onChange={(e) => onSearchChangeAction(e.target.value)}
            className="pl-10 pr-10 w-full"
          />
          {searchTerm && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onSearchChangeAction('')}
              className="absolute inset-y-0 right-0 h-full px-3 text-muted-foreground hover:text-foreground"
              aria-label="Clear search"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>

        <div className="flex gap-2 w-full sm:w-auto justify-between sm:justify-start">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">
                {sortDirection === 'asc' ? (
                  <SortAsc className="h-4 w-4" />
                ) : (
                  <SortDesc className="h-4 w-4" />
                )}
                <span className="ml-2 hidden sm:inline">
                  {
                    sortOptions.find((o) => o.value === sortField)
                      ?.label
                  }
                </span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Sort By</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {sortOptions.map((opt) => (
                <DropdownMenuItem
                  key={opt.value}
                  onClick={() =>
                    onSortChangeAction(opt.value, sortDirection)
                  }
                >
                  {opt.label}
                  {sortField === opt.value && (
                    <CheckCircle className="ml-auto h-4 w-4 text-primary" />
                  )}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => onSortChangeAction(sortField, 'asc')}
              >
                Ascending
                {sortDirection === 'asc' && (
                  <CheckCircle className="ml-auto h-4 w-4 text-primary" />
                )}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => onSortChangeAction(sortField, 'desc')}
              >
                Descending
                {sortDirection === 'desc' && (
                  <CheckCircle className="ml-auto h-4 w-4 text-primary" />
                )}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            variant={showAdvanced ? 'secondary' : 'outline'}
            onClick={() => setShowAdvanced(!showAdvanced)}
          >
            <FilterIcon className="h-4 w-4 mr-2" />
            <span className="hidden sm:inline">Filters</span>
          </Button>

          {hasFilters && (
            <Button variant="destructive" onClick={handleClear}>
              <X className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">Clear</span>
            </Button>
          )}
        </div>
      </div>

      {showAdvanced && (
        <div className="mt-4 pt-4 border-t border-border animate-fade-in">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label
                htmlFor="tierFilter"
                className="text-sm font-medium text-muted-foreground mb-1 block"
              >
                Economic Tier
              </label>
              <Select
                value={tierFilter}
                onValueChange={(v) =>
                  onTierFilterChangeAction(v as TierFilter)
                }
              >
                <SelectTrigger id="tierFilter">
                  <SelectValue placeholder="Select tier" />
                </SelectTrigger>
                <SelectContent>
                  {tierOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label
                htmlFor="continentFilter"
                className="text-sm font-medium text-muted-foreground mb-1 block"
              >
                Continent
              </label>
              <Select
                value={continentFilter}
                onValueChange={onContinentFilterChangeAction}
              >
                <SelectTrigger id="continentFilter">
                  <SelectValue placeholder="Select continent" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Continents</SelectItem>
                  {availableContinents.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label
                htmlFor="regionFilter"
                className="text-sm font-medium text-muted-foreground mb-1 block"
              >
                Region
              </label>
              <Select
                value={regionFilter}
                onValueChange={onRegionFilterChangeAction}
                disabled={
                  continentFilter === 'all' ||
                  availableRegions.length === 0
                }
              >
                <SelectTrigger id="regionFilter">
                  <SelectValue placeholder="Select region" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Regions</SelectItem>
                  {availableRegions.map((r) => (
                    <SelectItem key={r} value={r}>
                      {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium text-muted-foreground mb-1 block">
                Population Range
              </label>
              <div className="flex space-x-2">
                <Input
                  type="number"
                  placeholder="Min"
                  value={populationRange.min ?? ''}
                  onChange={(e) =>
                    onPopulationRangeChangeAction({
                      min: e.target.value
                        ? parseInt(e.target.value, 10)
                        : undefined,
                      max: populationRange.max
                    })
                  }
                  className="flex-1"
                />
                <Input
                  type="number"
                  placeholder="Max"
                  value={populationRange.max ?? ''}
                  onChange={(e) =>
                    onPopulationRangeChangeAction({
                      min: populationRange.min,
                      max: e.target.value
                        ? parseInt(e.target.value, 10)
                        : undefined
                    })
                  }
                  className="flex-1"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="mt-4 text-sm text-muted-foreground">
        Showing {filteredResults.toLocaleString()} of{' '}
        {totalResults.toLocaleString()} countries
        {hasFilters && (
          <div className="mt-2 flex flex-wrap gap-1 items-center">
            <span className="font-medium mr-1">Active Filters:</span>
            {searchTerm && (
              <Badge variant="secondary">
                Search: "{`${
                  searchTerm.length > 15
                    ? `${searchTerm.substring(0, 12)}...`
                    : searchTerm
                }`}"
              </Badge>
            )}
            {tierFilter !== 'all' && (
              <Badge variant="secondary">Tier: {tierFilter}</Badge>
            )}
            {continentFilter !== 'all' && (
              <Badge variant="secondary">
                Continent: {continentFilter}
              </Badge>
            )}
            {regionFilter !== 'all' && (
              <Badge variant="secondary">Region: {regionFilter}</Badge>
            )}
            {(populationRange.min !== undefined ||
              populationRange.max !== undefined) && (
              <Badge variant="secondary">
                Pop:{populationRange.min ?? 0}-
                {populationRange.max ?? '∞'}
              </Badge>
            )}
            {(sortField !== 'name' || sortDirection !== 'asc') && (
              <Badge variant="secondary">
                Sort:{' '}
                {
                  sortOptions.find((o) => o.value === sortField)
                    ?.label
                }{' '}
                ({sortDirection})
              </Badge>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
