"use client";
// src/app/admin/storyteller/_components/CountrySelector.tsx
// Shared country multi-select for world events

import { useState, useMemo } from "react";
import { api } from "~/trpc/react";
import { ALL_REALMS } from "~/lib/realms/realm-ids";
import { Input } from "~/components/ui/input";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { ScrollArea } from "~/components/ui/scroll-area";
import { UnifiedCountryFlag } from "~/components/shared/flags/UnifiedCountryFlag";
import { Search, Xmark as X, Globe, CheckCircle as CheckCircle2 } from "iconoir-react";

interface CountrySelectorProps {
  selectedIds: string[];
  onSelectionChange: (ids: string[]) => void;
  /** Show "Select All" button */
  allowSelectAll?: boolean;
}

export function CountrySelector({
  selectedIds,
  onSelectionChange,
  allowSelectAll = true,
}: CountrySelectorProps) {
  const [search, setSearch] = useState("");
  const { data } = api.countries.getSelectList.useQuery(
    { limit: 250, realm: ALL_REALMS },
    {
      refetchOnWindowFocus: false,
    }
  );

  const countries = useMemo(() => data ?? [], [data]);

  const filtered = useMemo(() => {
    if (!search) return countries;
    const q = search.toLowerCase();
    return countries.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.economicTier?.toLowerCase().includes(q) ||
        c.continent?.toLowerCase().includes(q)
    );
  }, [countries, search]);

  const toggle = (id: string) => {
    onSelectionChange(
      selectedIds.includes(id) ? selectedIds.filter((i) => i !== id) : [...selectedIds, id]
    );
  };

  const selectAll = () => onSelectionChange(countries.map((c) => c.id));
  const clearAll = () => onSelectionChange([]);

  return (
    <div className="space-y-3">
      {/* Search + bulk actions */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="text-label-secondary absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
          <Input
            placeholder="Search countries..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        {allowSelectAll && (
          <div className="flex gap-1">
            <Button variant="outline" size="sm" onClick={selectAll}>
              <Globe className="mr-1 h-3 w-3" />
              All
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={clearAll}
              disabled={selectedIds.length === 0}
            >
              Clear
            </Button>
          </div>
        )}
      </div>

      {/* Selected badges */}
      {selectedIds.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selectedIds.slice(0, 10).map((id) => {
            // oxlint-disable-next-line eslint/no-shadow -- shadowed 'c' is intentional in this scope
            const c = countries.find((c) => c.id === id);
            if (!c) return null;
            return (
              <Badge
                key={id}
                variant="outline"
                className="hover:bg-destructive/10 cursor-pointer gap-1 pr-1"
                onClick={() => toggle(id)}
              >
                <UnifiedCountryFlag countryName={c.name} flagUrl={c.flag} size="xs" />
                {c.name}
                <X className="h-3 w-3" />
              </Badge>
            );
          })}
          {selectedIds.length > 10 && (
            <Badge variant="outline">+{selectedIds.length - 10} more</Badge>
          )}
        </div>
      )}

      {/* Country list */}
      <ScrollArea className="border-separator rounded-control h-[280px] border">
        <div className="space-y-0.5 p-2">
          {filtered.map((c) => {
            const isSelected = selectedIds.includes(c.id);
            return (
              <button
                key={c.id}
                onClick={() => toggle(c.id)}
                className={`rounded-control text-body flex w-full items-center gap-3 px-3 py-2 text-left transition-colors ${
                  isSelected ? "border-tint/30 bg-tint-fill border" : "hover:bg-fill-4"
                }`}
              >
                <UnifiedCountryFlag countryName={c.name} flagUrl={c.flag} size="sm" />
                <div className="min-w-0 flex-1">
                  <span className="text-label font-medium">{c.name}</span>
                  <span className="text-label-secondary text-footnote ml-2">
                    {c.economicTier ?? "Unknown"}
                  </span>
                </div>
                {isSelected && <CheckCircle2 className="text-tint h-4 w-4 shrink-0" />}
              </button>
            );
          })}
          {filtered.length === 0 && (
            <p className="text-label-secondary text-body py-4 text-center">No countries found</p>
          )}
        </div>
      </ScrollArea>

      <p className="text-label-secondary text-footnote">
        {selectedIds.length} of {countries.length} countries selected
      </p>
    </div>
  );
}
