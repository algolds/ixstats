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
import { Search, Xmark as X, Globe } from "iconoir-react";
import { FacetListSection, FacetRow } from "~/components/ui/facet-list";

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

      {selectedIds.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selectedIds.slice(0, 10).map((id) => {
            // oxlint-disable-next-line eslint/no-shadow -- shadowed 'c' is intentional in this scope
            const c = countries.find((c) => c.id === id);
            if (!c) return null;
            return (
              <Button
                key={id}
                size="sm"
                variant="outline"
                aria-label={`Remove ${c.name}`}
                className="hover:bg-destructive/10 gap-1 rounded-full pr-2 pl-2"
                onClick={() => toggle(id)}
              >
                <UnifiedCountryFlag countryName={c.name} flagUrl={c.flag} size="xs" />
                {c.name}
                <X aria-hidden className="size-3" />
              </Button>
            );
          })}
          {selectedIds.length > 10 && (
            <Badge variant="outline">+{selectedIds.length - 10} more</Badge>
          )}
        </div>
      )}

      <ScrollArea className="border-separator rounded-control h-[280px] border">
        <FacetListSection variant="plain" aria-label="Countries">
          {filtered.map((c) => (
            <FacetRow
              key={c.id}
              onClick={() => toggle(c.id)}
              selected={selectedIds.includes(c.id)}
              selectionStyle="tint"
              accessory="check"
              leading={<UnifiedCountryFlag countryName={c.name} flagUrl={c.flag} size="sm" />}
              title={c.name}
              subtitle={c.economicTier ?? "Unknown"}
            />
          ))}
        </FacetListSection>
        {filtered.length === 0 && (
          <p className="text-label-secondary text-body py-4 text-center">No countries found</p>
        )}
      </ScrollArea>

      <p className="text-label-secondary text-footnote">
        {selectedIds.length} of {countries.length} countries selected
      </p>
    </div>
  );
}
