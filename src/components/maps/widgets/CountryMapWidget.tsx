"use client";

/**
 * CountryMapWidget - Sidebar card showing a country-focused map embed.
 *
 * Follows the sidebar widget pattern (ExecutiveSidebarWidget, etc.)
 * with header, map area, and stats footer.
 */

import { Globe } from "lucide-react";
import { Badge } from "~/components/ui/badge";
import { CountryMapEmbed } from "./CountryMapEmbed";
import { useCountryMapEmbed } from "~/hooks/useCountryMapEmbed";
import { createUrl } from "~/lib/url-utils";

interface CountryMapWidgetProps {
  countryId: string;
  countryName: string;
  borderColor?: string;
  mapHeight?: string;
  className?: string;
  fullMapUrl?: string;
}

export function CountryMapWidget({
  countryId,
  countryName,
  borderColor = "border-blue-500/15",
  mapHeight = "h-48",
  className = "",
  fullMapUrl,
}: CountryMapWidgetProps) {
  const { areaSqKm, cities, hasGeometry } = useCountryMapEmbed(countryId);

  const mapUrl = fullMapUrl || createUrl(`/maps?country=${countryId}`);

  return (
    <div
      className={`glass-hierarchy-child overflow-hidden rounded-xl border ${borderColor} ${className}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2">
        <div className="flex items-center gap-2">
          <Globe className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs font-medium text-foreground">
            Territory Map
          </span>
        </div>
        <Badge
          variant="outline"
          className="h-4 border-emerald-500/30 px-1.5 text-[9px] text-emerald-500"
        >
          LIVE
        </Badge>
      </div>

      {/* Map */}
      <CountryMapEmbed
        countryId={countryId}
        height={mapHeight}
        showNeighbors={true}
        showCities={true}
        interactive={true}
        boundsPadding={50}
      />

      {/* Footer stats */}
      <div className="flex items-center justify-between border-t border-border/50 px-3 py-1.5">
        <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
          {areaSqKm ? (
            <span>{Math.round(areaSqKm).toLocaleString()} km²</span>
          ) : null}
          {cities.length > 0 && (
            <span>
              {cities.length} {cities.length === 1 ? "city" : "cities"}
            </span>
          )}
          {!areaSqKm && cities.length === 0 && hasGeometry && (
            <span>{countryName}</span>
          )}
        </div>
        <a
          href={mapUrl}
          className="text-[10px] text-blue-500 hover:text-blue-600"
        >
          Full map →
        </a>
      </div>
    </div>
  );
}
