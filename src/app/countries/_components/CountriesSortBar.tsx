import React from 'react';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuItem } from '~/components/ui/dropdown-menu';
import { SortAsc, SortDesc, CheckCircle } from 'lucide-react';

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
];

export default function CountriesSortBar({
  sortField,
  sortDirection,
  onSortChange,
  searchTerm,
  onSearchChange,
  onCompare
}: {
  sortField: 'name' | 'population' | 'gdpPerCapita' | 'totalGdp' | 'economicTier' | 'continent' | 'region' | 'landArea' | 'populationDensity';
  sortDirection: 'asc' | 'desc';
  onSortChange: (field: 'name' | 'population' | 'gdpPerCapita' | 'totalGdp' | 'economicTier' | 'continent' | 'region' | 'landArea' | 'populationDensity', direction: 'asc' | 'desc') => void;
  searchTerm?: string;
  onSearchChange?: (term: string) => void;
  onCompare?: () => void;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
      <div className="flex items-center gap-2 flex-wrap">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline">
              {sortDirection === 'asc' ? <SortAsc className="h-4 w-4" /> : <SortDesc className="h-4 w-4" />}
              <span className="ml-2">
                {sortOptions.find(o => o.value === sortField)?.label || 'Sort'}
              </span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuLabel>Sort By</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {sortOptions.map(opt => (
              <DropdownMenuItem key={opt.value} onClick={() => onSortChange(opt.value as any, sortDirection)}>
                {opt.label}
                {sortField === opt.value && <CheckCircle className="ml-auto h-4 w-4 text-primary" />}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => onSortChange(sortField, 'asc')}>
              Ascending {sortDirection === 'asc' && <CheckCircle className="ml-auto h-4 w-4 text-primary" />}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onSortChange(sortField, 'desc')}>
              Descending {sortDirection === 'desc' && <CheckCircle className="ml-auto h-4 w-4 text-primary" />}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        {onSearchChange && (
          <Input
            type="text"
            placeholder="Quick search..."
            value={searchTerm}
            onChange={e => onSearchChange(e.target.value)}
            className="w-40"
          />
        )}
      </div>
      <Button className="ml-auto" onClick={onCompare}>Compare Countries</Button>
    </div>
  );
} 