// src/app/admin/storyteller/_components/CountrySelector.tsx
// Shared country multi-select for world events
"use client";

import { useState, useMemo } from "react";
import { api } from "~/trpc/react";
import { Input } from "~/components/ui/input";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { ScrollArea } from "~/components/ui/scroll-area";
import { UnifiedCountryFlag } from "~/components/UnifiedCountryFlag";
import { Search, X, Globe, CheckCircle2 } from "lucide-react";

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
  const { data } = api.countries.getAll.useQuery(undefined, {
    refetchOnWindowFocus: false,
  });

  const countries = useMemo(() => data?.countries ?? [], [data]);

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
          <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
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
      <ScrollArea className="border-border/50 h-[280px] rounded-lg border">
        <div className="space-y-0.5 p-2">
          {filtered.map((c) => {
            const isSelected = selectedIds.includes(c.id);
            return (
              <button
                key={c.id}
                onClick={() => toggle(c.id)}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                  isSelected ? "border-primary/30 bg-primary/10 border" : "hover:bg-muted/30"
                }`}
              >
                <UnifiedCountryFlag countryName={c.name} flagUrl={c.flag} size="sm" />
                <div className="min-w-0 flex-1">
                  <span className="text-foreground font-medium">{c.name}</span>
                  <span className="text-muted-foreground ml-2 text-xs">
                    {c.economicTier ?? "Unknown"}
                  </span>
                </div>
                {isSelected && <CheckCircle2 className="text-primary h-4 w-4 flex-shrink-0" />}
              </button>
            );
          })}
          {filtered.length === 0 && (
            <p className="text-muted-foreground py-4 text-center text-sm">No countries found</p>
          )}
        </div>
      </ScrollArea>

      <p className="text-muted-foreground text-xs">
        {selectedIds.length} of {countries.length} countries selected
      </p>
    </div>
  );
}
