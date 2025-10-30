"use client";

import { useState } from "react";
import { Search, Filter as FilterIcon, X, SortAsc, SortDesc, CheckCircle } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "~/components/ui/select";
import { Badge } from "~/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuGroupLabel,
  DropdownMenuSeparator,
  DropdownMenuItem,
} from "~/components/ui/dropdown-menu";

export type SortField =
  | "name"
  | "population"
  | "gdpPerCapita"
  | "totalGdp"
  | "economicTier"
  | "continent"
  | "region"
  | "landArea"
  | "populationDensity";
export type SortDirection = "asc" | "desc";
export type TierFilter = "all" | "Advanced" | "Developed" | "Emerging" | "Developing";

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
  availableRegions,
}: CountriesSearchProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);

  const sortOptions = [
    { value: "name", label: "Country Name" },
    { value: "population", label: "Population" },
    { value: "gdpPerCapita", label: "GDP per Capita" },
    { value: "totalGdp", label: "Total GDP" },
    { value: "economicTier", label: "Economic Tier" },
    { value: "continent", label: "Continent" },
    { value: "region", label: "Region" },
    { value: "landArea", label: "Land Area" },
    { value: "populationDensity", label: "Population Density" },
  ] as const;

  const tierOptions = [
    { value: "all", label: "All Tiers" },
    { value: "Advanced", label: "Advanced" },
    { value: "Developed", label: "Developed" },
    { value: "Emerging", label: "Emerging" },
    { value: "Developing", label: "Developing" },
  ] as const;

  const handleClear = () => {
    onSearchChangeAction("");
    onTierFilterChangeAction("all");
    onContinentFilterChangeAction("all");
    onRegionFilterChangeAction("all");
    onPopulationRangeChangeAction({});
    onSortChangeAction("name", "asc");
    setShowAdvanced(false);
  };

  const hasFilters =
    searchTerm !== "" ||
    tierFilter !== "all" ||
    continentFilter !== "all" ||
    regionFilter !== "all" ||
    populationRange.min !== undefined ||
    populationRange.max !== undefined ||
    sortField !== "name" ||
    sortDirection !== "asc";

  return (
    <div className="bg-card text-card-foreground border-border mb-8 rounded-lg p-4 shadow-sm sm:p-6">
      <div className="flex flex-col items-center gap-3 sm:flex-row">
        <div className="relative w-full flex-grow sm:w-auto">
          <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 transform" />
          <Input
            type="text"
            placeholder="Search by country name..."
            value={searchTerm}
            onChange={(e) => onSearchChangeAction(e.target.value)}
            className="bg-background text-foreground hover:border/80 hover:bg-accent/20 focus:bg-background focus:border-primary placeholder:text-muted-foreground w-full border pr-10 pl-10 transition-all duration-200"
          />
          {searchTerm && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onSearchChangeAction("")}
              className="text-muted-foreground hover:text-foreground absolute inset-y-0 right-0 h-full px-3"
              aria-label="Clear search"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>

        <div className="flex w-full justify-between gap-2 sm:w-auto sm:justify-start">
          <DropdownMenu>
            <DropdownMenuTrigger className="text-foreground ring-offset-background focus-visible:ring-ring border-border bg-background hover:bg-accent hover:text-accent-foreground inline-flex h-10 items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50">
              {sortDirection === "asc" ? (
                <SortAsc className="h-4 w-4" />
              ) : (
                <SortDesc className="h-4 w-4" />
              )}
              <span className="ml-2 hidden sm:inline">
                {sortOptions.find((o) => o.value === sortField)?.label}
              </span>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="bg-background border-border backdrop-blur-md"
            >
              <DropdownMenuGroup>
                <DropdownMenuGroupLabel className="text-muted-foreground">
                  Sort By
                </DropdownMenuGroupLabel>
                <DropdownMenuSeparator className="bg-border" />
                {sortOptions.map((opt) => (
                  <DropdownMenuItem
                    key={opt.value}
                    onClick={() => onSortChangeAction(opt.value, sortDirection)}
                  >
                    {opt.label}
                    {sortField === opt.value && (
                      <CheckCircle className="text-primary ml-auto h-4 w-4" />
                    )}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => onSortChangeAction(sortField, "asc")}>
                  Ascending
                  {sortDirection === "asc" && (
                    <CheckCircle className="text-primary ml-auto h-4 w-4" />
                  )}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onSortChangeAction(sortField, "desc")}>
                  Descending
                  {sortDirection === "desc" && (
                    <CheckCircle className="text-primary ml-auto h-4 w-4" />
                  )}
                </DropdownMenuItem>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            variant={showAdvanced ? "secondary" : "outline"}
            onClick={() => setShowAdvanced(!showAdvanced)}
          >
            <FilterIcon className="mr-2 h-4 w-4" />
            <span className="hidden sm:inline">Filters</span>
          </Button>

          {hasFilters && (
            <Button variant="destructive" onClick={handleClear}>
              <X className="mr-2 h-4 w-4" />
              <span className="hidden sm:inline">Clear</span>
            </Button>
          )}
        </div>
      </div>

      {showAdvanced && (
        <div className="animate-fade-in bg-card/50 mt-4 rounded-md border border-t p-4 pt-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-4">
            <div>
              <label
                htmlFor="tierFilter"
                className="text-muted-foreground mb-1 block text-sm font-medium"
              >
                Economic Tier
              </label>
              <Select
                value={tierFilter}
                onValueChange={(v) => onTierFilterChangeAction(v as TierFilter)}
              >
                <SelectTrigger id="tierFilter">
                  <SelectValue placeholder="Select tier" />
                </SelectTrigger>
                <SelectContent className="bg-background border-border backdrop-blur-md">
                  {tierOptions.map((opt) => (
                    <SelectItem
                      key={opt.value}
                      value={opt.value}
                      className="text-foreground hover:bg-accent hover:text-accent-foreground"
                    >
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label
                htmlFor="continentFilter"
                className="text-muted-foreground mb-1 block text-sm font-medium"
              >
                Continent
              </label>
              <Select value={continentFilter} onValueChange={onContinentFilterChangeAction}>
                <SelectTrigger id="continentFilter">
                  <SelectValue placeholder="Select continent" />
                </SelectTrigger>
                <SelectContent className="bg-background border-border backdrop-blur-md">
                  <SelectItem
                    value="all"
                    className="text-foreground hover:bg-accent hover:text-accent-foreground"
                  >
                    All Continents
                  </SelectItem>
                  {availableContinents.map((c) => (
                    <SelectItem
                      key={c}
                      value={c}
                      className="text-foreground hover:bg-accent hover:text-accent-foreground"
                    >
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label
                htmlFor="regionFilter"
                className="text-muted-foreground mb-1 block text-sm font-medium"
              >
                Region
              </label>
              <Select
                value={regionFilter}
                onValueChange={onRegionFilterChangeAction}
                disabled={continentFilter === "all" || availableRegions.length === 0}
              >
                <SelectTrigger id="regionFilter">
                  <SelectValue placeholder="Select region" />
                </SelectTrigger>
                <SelectContent className="bg-background border-border backdrop-blur-md">
                  <SelectItem
                    value="all"
                    className="text-foreground hover:bg-accent hover:text-accent-foreground"
                  >
                    All Regions
                  </SelectItem>
                  {availableRegions.map((r) => (
                    <SelectItem
                      key={r}
                      value={r}
                      className="text-foreground hover:bg-accent hover:text-accent-foreground"
                    >
                      {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-muted-foreground mb-1 block text-sm font-medium">
                Population Range
              </label>
              <div className="flex space-x-2">
                <Input
                  type="number"
                  placeholder="Min"
                  value={populationRange.min ?? ""}
                  onChange={(e) =>
                    onPopulationRangeChangeAction({
                      min: e.target.value ? parseInt(e.target.value, 10) : undefined,
                      max: populationRange.max,
                    })
                  }
                  className="bg-background text-foreground hover:border/80 hover:bg-accent/20 focus:bg-background focus:border-primary placeholder:text-muted-foreground flex-1 border transition-all duration-200"
                />
                <Input
                  type="number"
                  placeholder="Max"
                  value={populationRange.max ?? ""}
                  onChange={(e) =>
                    onPopulationRangeChangeAction({
                      min: populationRange.min,
                      max: e.target.value ? parseInt(e.target.value, 10) : undefined,
                    })
                  }
                  className="bg-background text-foreground hover:border/80 hover:bg-accent/20 focus:bg-background focus:border-primary placeholder:text-muted-foreground flex-1 border transition-all duration-200"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="text-muted-foreground mt-4 text-sm">
        Showing {filteredResults.toLocaleString()} of {totalResults.toLocaleString()} countries
        {hasFilters && (
          <div className="mt-2 flex flex-wrap items-center gap-1">
            <span className="mr-1 font-medium">Active Filters:</span>
            {searchTerm && (
              <Badge variant="secondary">
                Search: "
                {`${searchTerm.length > 15 ? `${searchTerm.substring(0, 12)}...` : searchTerm}`}"
              </Badge>
            )}
            {tierFilter !== "all" && <Badge variant="secondary">Tier: {tierFilter}</Badge>}
            {continentFilter !== "all" && (
              <Badge variant="secondary">Continent: {continentFilter}</Badge>
            )}
            {regionFilter !== "all" && <Badge variant="secondary">Region: {regionFilter}</Badge>}
            {(populationRange.min !== undefined || populationRange.max !== undefined) && (
              <Badge variant="secondary">
                Pop:{populationRange.min ?? 0}-{populationRange.max ?? "∞"}
              </Badge>
            )}
            {(sortField !== "name" || sortDirection !== "asc") && (
              <Badge variant="secondary">
                Sort: {sortOptions.find((o) => o.value === sortField)?.label} ({sortDirection})
              </Badge>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
