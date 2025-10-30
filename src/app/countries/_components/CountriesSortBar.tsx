import React from "react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuGroupLabel,
  DropdownMenuSeparator,
  DropdownMenuItem,
} from "~/components/ui/dropdown-menu";
import { SortAsc, SortDesc, CheckCircle } from "lucide-react";

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
];

export default function CountriesSortBar({
  sortField,
  sortDirection,
  onSortChange,
  onCompare,
  searchTerm,
  onSearchChange,
}: {
  sortField:
    | "name"
    | "population"
    | "gdpPerCapita"
    | "totalGdp"
    | "economicTier"
    | "continent"
    | "region"
    | "landArea"
    | "populationDensity";
  sortDirection: "asc" | "desc";
  onSortChange: (
    field:
      | "name"
      | "population"
      | "gdpPerCapita"
      | "totalGdp"
      | "economicTier"
      | "continent"
      | "region"
      | "landArea"
      | "populationDensity",
    direction: "asc" | "desc"
  ) => void;
  onCompare?: () => void;
  searchTerm?: string;
  onSearchChange?: (value: string) => void;
}) {
  return (
    <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-wrap items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger className="ring-offset-background focus-visible:ring-ring border-border-input bg-background hover:bg-accent hover:text-accent-foreground inline-flex h-10 items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50">
            {sortDirection === "asc" ? (
              <SortAsc className="h-4 w-4" />
            ) : (
              <SortDesc className="h-4 w-4" />
            )}
            <span className="ml-2">
              {sortOptions.find((o) => o.value === sortField)?.label || "Sort"}
            </span>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            className="bg-background/90 border-border/50 backdrop-blur-md"
          >
            <DropdownMenuGroup>
              <DropdownMenuGroupLabel>Sort By</DropdownMenuGroupLabel>
              <DropdownMenuSeparator />
              {sortOptions.map((opt) => (
                <DropdownMenuItem
                  key={opt.value}
                  onClick={() => onSortChange(opt.value as any, sortDirection)}
                >
                  {opt.label}
                  {sortField === opt.value && (
                    <CheckCircle className="text-primary ml-auto h-4 w-4" />
                  )}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => onSortChange(sortField, "asc")}>
                Ascending{" "}
                {sortDirection === "asc" && (
                  <CheckCircle className="text-primary ml-auto h-4 w-4" />
                )}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onSortChange(sortField, "desc")}>
                Descending{" "}
                {sortDirection === "desc" && (
                  <CheckCircle className="text-primary ml-auto h-4 w-4" />
                )}
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Search input (optional) */}
        {onSearchChange && (
          <Input
            placeholder="Search countries..."
            value={searchTerm || ""}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-64"
          />
        )}
      </div>
      <Button className="ml-auto" onClick={onCompare}>
        Compare Countries
      </Button>
    </div>
  );
}
