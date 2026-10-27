"use client";

import { useState } from "react";
import { Search } from "iconoir-react";
import { api } from "~/trpc/react";
import { useActingRealmId } from "~/hooks/useActingRealmId";
import { nationsInRealm } from "~/lib/realms/same-realm";
import { Input } from "~/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";

interface CountrySearchSelectProps {
  value: string;
  onSelect: (countryId: string, countryName: string) => void;
  /** Nations that cannot be picked (the viewer's own, an alliance's members). */
  excludeIds: readonly string[];
  label: string;
}

/**
 * Pick a nation of the acting nation's realm (nations of two realms do not interact): a name search reaches every
 * such nation, and the list shows the first 200 matches.
 */
export function CountrySearchSelect({
  value,
  onSelect,
  excludeIds,
  label,
}: CountrySearchSelectProps) {
  const [search, setSearch] = useState("");
  const { data } = api.countries.getAll.useQuery(
    { limit: 200, offset: 0, search: search.trim() || undefined },
    { staleTime: 5 * 60 * 1000 }
  );
  const realmId = useActingRealmId();
  const countries = nationsInRealm(data?.countries ?? [], realmId).filter(
    (c) => !excludeIds.includes(c.id)
  );

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="text-label-secondary absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search nations"
          aria-label={`Search: ${label}`}
          className="pl-10"
        />
      </div>
      <Select
        value={value || undefined}
        onValueChange={(id) => {
          const country = countries.find((c) => c.id === id);
          if (country) onSelect(country.id, country.name);
        }}
      >
        <SelectTrigger className="w-full" aria-label={label}>
          <SelectValue placeholder="Select a nation…" />
        </SelectTrigger>
        <SelectContent className="max-h-72">
          {countries.map((c) => (
            <SelectItem key={c.id} value={c.id}>
              {c.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
