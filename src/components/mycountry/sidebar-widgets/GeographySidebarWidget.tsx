"use client";

import { useMemo } from "react";
import { MapPin, Building2, Layers } from "lucide-react";
import { api } from "~/trpc/react";
import { SectionContextWidget, type ContextStat, type ContextActivityEntry } from "../primitives";

interface GeographySidebarWidgetProps {
  countryId: string;
}

/**
 * Geography context widget — quick stats + recent activity for the
 * MyCountry Geography section. Mirrors the pattern used by
 * IntelligenceSidebarWidget / ExecutiveSidebarWidget.
 */
export function GeographySidebarWidget({ countryId }: GeographySidebarWidgetProps) {
  const { data: bundle, isLoading } = api.countryGeo.getCountryGeoBundle.useQuery(
    { countryId },
    { enabled: !!countryId, staleTime: 30_000 }
  );

  const stats = useMemo<ContextStat[]>(() => {
    if (!bundle) return [];
    const { cities, subdivisions, pois, rollups } = bundle;
    const popPct = Math.round((rollups?.populationCoverage ?? 0) * 100);
    const gdpPct = Math.round((rollups?.gdpCoverage ?? 0) * 100);
    return [
      { label: "Cities", value: cities.length, accentText: true },
      { label: "Subs", value: subdivisions.length, accentText: true },
      { label: "POIs", value: pois.length, accentText: true },
      { label: "Pop", value: `${popPct}%`, accentText: popPct >= 100 ? true : false },
      { label: "GDP", value: `${gdpPct}%`, accentText: gdpPct >= 100 ? true : false },
    ];
  }, [bundle]);

  const activity = useMemo<ContextActivityEntry[]>(() => {
    if (!bundle) return [];
    const entries: ContextActivityEntry[] = [];
    const { subdivisions, cities } = bundle;
    for (const s of subdivisions.slice(0, 5)) {
      entries.push({
        id: `sub-${s.id}`,
        icon: Layers,
        iconColor: "text-emerald-500",
        text: `Subdivision: ${s.name}${s.governorName ? ` (Gov: ${s.governorName})` : ""}`,
        time: new Date(s.updatedAt ?? s.createdAt ?? Date.now()),
      });
    }
    for (const c of cities.slice(0, 5)) {
      entries.push({
        id: `city-${c.id}`,
        icon: Building2,
        iconColor: "text-amber-500",
        text: `City: ${c.name}${c.population ? ` (Pop: ${c.population.toLocaleString()})` : ""}`,
        time: new Date(c.updatedAt ?? c.createdAt ?? Date.now()),
      });
    }
    return entries.slice(0, 5);
  }, [bundle]);

  return (
    <SectionContextWidget
      accent="emerald"
      title="Geography Activity"
      icon={MapPin}
      stats={stats}
      activity={activity}
      emptyMessage={isLoading ? "Loading..." : "No geographic features yet."}
    />
  );
}
