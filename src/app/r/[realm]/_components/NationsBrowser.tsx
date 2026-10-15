"use client";

import React, { useDeferredValue, useMemo, useState } from "react";
import { DiceSix } from "iconoir-react";
import type { CountryCardData } from "~/components/mycountry/dossier/CountryFocusCard";
import {
  TIER_FILTER_OPTIONS,
  matchesTierFilter,
  type TierFilter,
} from "~/lib/economic-tier-filter";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { SearchField } from "~/components/ui/search-field";
import { SegmentedControl } from "~/components/ui/segmented-control";
import { NationsGrid, type RealmNation } from "./NationsGrid";
import { NationsStats } from "./NationsStats";

/** Search (name, tier, continent, region), tier and continent filters over the realm's ordered nations. */
function useNationFilters(nations: RealmNation[]) {
  const [search, setSearch] = useState("");
  const [tier, setTier] = useState<TierFilter>("all");
  const [continent, setContinent] = useState<string | null>(null);
  const query = useDeferredValue(search).trim().toLowerCase();
  const filtered = useMemo(
    () =>
      nations.filter(
        (n) =>
          (!continent || (n.continent || "Unknown") === continent) &&
          (tier === "all" || matchesTierFilter(n.economicTier, tier)) &&
          (!query ||
            [n.name, n.economicTier, n.continent, n.region].some((f) =>
              f?.toLowerCase().includes(query)
            ))
      ),
    [nations, continent, tier, query]
  );
  const clear = () => {
    setSearch("");
    setTier("all");
    setContinent(null);
  };
  return { search, setSearch, tier, setTier, continent, setContinent, filtered, clear };
}

/** The realm's nations as the old card grid: search, tier filter, Feeling lucky, the stats strip and the cards. */
export function NationsBrowser({
  nations,
  isLoading,
  onCountryClick,
  viewerCountryId,
  corner,
}: {
  nations: RealmNation[];
  isLoading: boolean;
  onCountryClick: (country: CountryCardData) => void;
  viewerCountryId?: string;
  corner: (nation: RealmNation) => React.ReactNode;
}) {
  const f = useNationFilters(nations);
  const feelingLucky = () => {
    const pick = f.filtered[Math.floor(Math.random() * f.filtered.length)];
    if (pick) onCountryClick(pick);
  };

  return (
    <div className="flex flex-col gap-6">
      <Card padding="md" className="flex flex-col gap-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <SearchField
            size="lg"
            value={f.search}
            onValueChange={f.setSearch}
            aria-label="Search nations"
            placeholder="Search by name, economic tier, region or continent"
            containerClassName="flex-1"
          />
          <Button type="button" variant="outline" onClick={feelingLucky}>
            <DiceSix aria-hidden="true" />
            Feeling lucky
          </Button>
        </div>
        <SegmentedControl
          aria-label="Filter by economic tier"
          size="sm"
          value={f.tier}
          onValueChange={f.setTier}
          options={TIER_FILTER_OPTIONS}
        />
        <NationsStats
          countries={f.filtered}
          allCountries={nations}
          continentFilter={f.continent}
          onContinentFilter={f.setContinent}
          onCountryClick={onCountryClick}
        />
      </Card>
      <NationsGrid
        nations={f.filtered}
        isLoading={isLoading}
        onCountryClick={onCountryClick}
        onClearFilters={f.clear}
        viewerCountryId={viewerCountryId}
        corner={corner}
      />
    </div>
  );
}
