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
import { SORT_OPTIONS, type SortDirection, type SortField } from "./filters";
import { SortUp as SortAsc, SortDown as SortDesc, CheckCircle, Search } from "iconoir-react";

export default function CountriesSortBar({
  sortField,
  sortDirection,
  onSortChange,
  onCompare,
  searchTerm,
  onSearchChange,
}: {
  sortField: SortField;
  sortDirection: SortDirection;
  onSortChange: (field: SortField, direction: SortDirection) => void;
  onCompare?: () => void;
  searchTerm?: string;
  onSearchChange?: (value: string) => void;
}) {
  return (
    <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-wrap items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="h-10">
              {sortDirection === "asc" ? (
                <SortAsc aria-hidden="true" className="h-4 w-4" />
              ) : (
                <SortDesc aria-hidden="true" className="h-4 w-4" />
              )}
              <span>{SORT_OPTIONS.find((o) => o.value === sortField)?.label || "Sort"}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuGroup>
              <DropdownMenuGroupLabel>Sort by</DropdownMenuGroupLabel>
              <DropdownMenuSeparator />
              {SORT_OPTIONS.map((opt) => (
                <DropdownMenuItem
                  key={opt.value}
                  onClick={() => onSortChange(opt.value, sortDirection)}
                >
                  {opt.label}
                  {sortField === opt.value && <CheckCircle className="text-tint ml-auto h-4 w-4" />}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => onSortChange(sortField, "asc")}>
                Ascending{" "}
                {sortDirection === "asc" && <CheckCircle className="text-tint ml-auto h-4 w-4" />}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onSortChange(sortField, "desc")}>
                Descending{" "}
                {sortDirection === "desc" && <CheckCircle className="text-tint ml-auto h-4 w-4" />}
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Search input (optional) */}
        {onSearchChange && (
          <div className="relative flex items-center">
            <Search
              aria-hidden="true"
              className="text-label-secondary pointer-events-none absolute top-1/2 left-3 z-10 h-4 w-4 -translate-y-1/2"
            />
            <Input
              placeholder="Search countries"
              aria-label="Search countries"
              value={searchTerm || ""}
              onChange={(e) => onSearchChange(e.target.value)}
              className="h-10 w-full pl-9 sm:w-64"
              autoComplete="off"
            />
          </div>
        )}
      </div>
      <Button className="ml-auto" onClick={onCompare}>
        Compare countries
      </Button>
    </div>
  );
}
