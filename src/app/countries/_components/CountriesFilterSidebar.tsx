import React from "react";
import { Input } from "~/components/ui/input";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Search } from "iconoir-react";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "~/components/ui/select";
import { TIER_FILTER_OPTIONS, isTierFilter, type TierFilter } from "~/lib/economic-tier-filter";
import { Card } from "~/components/ui/card";
import type { PopulationRange } from "./filters";

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
  onClearAll,
}: {
  searchTerm: string;
  onSearchChange: (term: string) => void;
  tierFilter: TierFilter;
  onTierFilterChange: (tier: TierFilter) => void;
  continentFilter: string;
  onContinentFilterChange: (continent: string) => void;
  regionFilter: string;
  onRegionFilterChange: (region: string) => void;
  populationRange: PopulationRange;
  onPopulationRangeChange: (range: PopulationRange) => void;
  availableContinents: string[];
  availableRegions: string[];
  onClearAll: () => void;
}) {
  const hasFilters =
    searchTerm !== "" ||
    tierFilter !== "all" ||
    continentFilter !== "all" ||
    regionFilter !== "all" ||
    populationRange.min !== undefined ||
    populationRange.max !== undefined;

  return (
    <Card className="rounded-card space-y-4 p-4">
      {hasFilters && (
        <div className="mb-2 flex flex-wrap gap-1">
          {searchTerm && <Badge variant="default">Search: {searchTerm}</Badge>}
          {tierFilter !== "all" && <Badge variant="default">Tier: {tierFilter}</Badge>}
          {continentFilter !== "all" && (
            <Badge variant="default">Continent: {continentFilter}</Badge>
          )}
          {regionFilter !== "all" && <Badge variant="default">Region: {regionFilter}</Badge>}
          {(populationRange.min !== undefined || populationRange.max !== undefined) && (
            <Badge variant="default">
              Pop: {populationRange.min ?? 0}-{populationRange.max ?? "∞"}
            </Badge>
          )}
          <Button size="sm" variant="outline" onClick={onClearAll} className="ml-auto">
            Clear all
          </Button>
        </div>
      )}
      <div>
        <label className="text-label-secondary text-caption mb-1 block">Search</label>
        <div className="relative flex items-center">
          <Search
            aria-hidden="true"
            className="text-label-secondary pointer-events-none absolute top-1/2 left-3 z-10 h-4 w-4 -translate-y-1/2"
          />
          <Input
            type="text"
            placeholder="Search by country name"
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className="h-10 w-full pl-9"
            autoComplete="off"
          />
        </div>
      </div>
      <div>
        <label className="text-label-secondary text-caption mb-1 block">Economic tier</label>
        <Select
          value={tierFilter}
          onValueChange={(value) => {
            if (isTierFilter(value)) onTierFilterChange(value);
          }}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select tier" />
          </SelectTrigger>
          <SelectContent>
            {TIER_FILTER_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <label className="text-label-secondary text-caption mb-1 block">Continent</label>
        <Select value={continentFilter} onValueChange={onContinentFilterChange}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select continent" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All continents</SelectItem>
            {availableContinents.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <label className="text-label-secondary text-caption mb-1 block">Region</label>
        <Select
          value={regionFilter}
          onValueChange={onRegionFilterChange}
          disabled={continentFilter === "all" || availableRegions.length === 0}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select region" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All regions</SelectItem>
            {availableRegions.map((r) => (
              <SelectItem key={r} value={r}>
                {r}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <label className="text-label-secondary text-caption mb-1 block">Population range</label>
        <div className="flex space-x-2">
          <Input
            type="number"
            placeholder="Min"
            value={populationRange.min ?? ""}
            onChange={(e) =>
              onPopulationRangeChange({
                min: e.target.value ? parseInt(e.target.value, 10) : undefined,
                max: populationRange.max,
              })
            }
            className="flex-1"
          />
          <Input
            type="number"
            placeholder="Max"
            value={populationRange.max ?? ""}
            onChange={(e) =>
              onPopulationRangeChange({
                min: populationRange.min,
                max: e.target.value ? parseInt(e.target.value, 10) : undefined,
              })
            }
            className="flex-1"
          />
        </div>
      </div>
    </Card>
  );
}
