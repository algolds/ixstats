import React from 'react';
import { Input } from '~/components/ui/input';
import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '~/components/ui/select';
// import { Slider } from '~/components/ui/slider'; // Uncomment if you have a slider component

export default function CountriesFilterSidebar({
  searchTerm,
  onSearchChange,
  tierFilter,
  onTierFilterChange,
  continentFilter,
  onContinentFilterChange,
  regionFilter,
  onRegionFilterChange,
  populationRange,
  onPopulationRangeChange,
  availableContinents,
  availableRegions,
  onClearAll
}: {
  searchTerm: string;
  onSearchChange: (term: string) => void;
  tierFilter: string;
  onTierFilterChange: (tier: string | 'all' | 'Advanced' | 'Developed' | 'Emerging' | 'Developing') => void;
  continentFilter: string;
  onContinentFilterChange: (continent: string) => void;
  regionFilter: string;
  onRegionFilterChange: (region: string) => void;
  populationRange: { min?: number; max?: number };
  onPopulationRangeChange: (range: { min?: number; max?: number }) => void;
  availableContinents: string[];
  availableRegions: string[];
  onClearAll: () => void;
}) {
  const hasFilters =
    searchTerm !== '' ||
    tierFilter !== 'all' ||
    continentFilter !== 'all' ||
    regionFilter !== 'all' ||
    populationRange.min !== undefined ||
    populationRange.max !== undefined;

  const tierOptions = [
    { value: 'all', label: 'All Tiers' },
    { value: 'Advanced', label: 'Advanced' },
    { value: 'Developed', label: 'Developed' },
    { value: 'Emerging', label: 'Emerging' },
    { value: 'Developing', label: 'Developing' }
  ];

  return (
    <aside className="space-y-4">
      {hasFilters && (
        <div className="flex flex-wrap gap-1 mb-2">
          {searchTerm && <Badge variant="secondary">Search: {searchTerm}</Badge>}
          {tierFilter !== 'all' && <Badge variant="secondary">Tier: {tierFilter}</Badge>}
          {continentFilter !== 'all' && <Badge variant="secondary">Continent: {continentFilter}</Badge>}
          {regionFilter !== 'all' && <Badge variant="secondary">Region: {regionFilter}</Badge>}
          {(populationRange.min !== undefined || populationRange.max !== undefined) && (
            <Badge variant="secondary">Pop: {populationRange.min ?? 0}-{populationRange.max ?? '∞'}</Badge>
          )}
          <Button size="sm" variant="destructive" onClick={onClearAll} className="ml-auto">Clear All</Button>
        </div>
      )}
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1 block">Search</label>
        <Input
          type="text"
          placeholder="Search by country name..."
          value={searchTerm}
          onChange={e => onSearchChange(e.target.value)}
          className="w-full"
        />
      </div>
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1 block">Economic Tier</label>
        <Select value={tierFilter} onValueChange={onTierFilterChange}>
          <SelectTrigger>
            <SelectValue placeholder="Select tier" />
          </SelectTrigger>
          <SelectContent>
            {tierOptions.map(opt => (
              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1 block">Continent</label>
        <Select value={continentFilter} onValueChange={onContinentFilterChange}>
          <SelectTrigger>
            <SelectValue placeholder="Select continent" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Continents</SelectItem>
            {availableContinents.map(c => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1 block">Region</label>
        <Select
          value={regionFilter}
          onValueChange={onRegionFilterChange}
          disabled={continentFilter === 'all' || availableRegions.length === 0}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select region" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Regions</SelectItem>
            {availableRegions.map(r => (
              <SelectItem key={r} value={r}>{r}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <label className="text-xs font-medium text-muted-foreground mb-1 block">Population Range</label>
        <div className="flex space-x-2">
          <Input
            type="number"
            placeholder="Min"
            value={populationRange.min ?? ''}
            onChange={e => onPopulationRangeChange({ min: e.target.value ? parseInt(e.target.value, 10) : undefined, max: populationRange.max })}
            className="flex-1"
          />
          <Input
            type="number"
            placeholder="Max"
            value={populationRange.max ?? ''}
            onChange={e => onPopulationRangeChange({ min: populationRange.min, max: e.target.value ? parseInt(e.target.value, 10) : undefined })}
            className="flex-1"
          />
        </div>
        {/*
        <Slider ... />
        */}
      </div>
    </aside>
  );
} 