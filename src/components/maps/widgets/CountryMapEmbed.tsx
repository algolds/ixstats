"use client";

/**
 * CountryMapEmbed - Lightweight country-focused MapLibre map.
 *
 * Renders a single country's territory zoomed to its bounding box,
 * with dimmed neighbors, city markers, and capital stars.
 * Much lighter than MapContainer (2-4 sources vs 10+).
 */

import { MapPin, SystemRestart as Loader2 } from "iconoir-react";

// Extracted subcomponents, hooks, and helpers
import { useCountryMapEmbedState } from "~/components/maps/widgets/hooks/useCountryMapEmbedState";
import { useCountryMapEmbedLayers } from "~/components/maps/widgets/hooks/useCountryMapEmbedLayers";

/** A clicked map feature, identified by kind + record id. */
export interface CountryMapFeature {
  kind: "city" | "subdivision";
  id: string;
}

export interface CountryMapEmbedProps {
  countryId: string;
  height?: string;
  className?: string;
  showNeighbors?: boolean;
  showCities?: boolean;
  showSubdivisions?: boolean;
  interactive?: boolean;
  onCountryClick?: () => void;
  onNeighborClick?: (countryId: string) => void;
  /** Fired when a city/subdivision feature is clicked. Enables click-to-manage. */
  onFeatureClick?: (feature: CountryMapFeature) => void;
  boundsPadding?: number;
  highlightCountryIds?: string[];
  highlightCountryNames?: string[];
}

export function CountryMapEmbed({
  countryId,
  height = "h-64",
  className = "",
  showNeighbors = true,
  showCities = true,
  showSubdivisions = false,
  interactive = true,
  onCountryClick,
  onNeighborClick,
  onFeatureClick,
  boundsPadding = 40,
  highlightCountryIds,
  highlightCountryNames,
}: CountryMapEmbedProps) {
  const state = useCountryMapEmbedState({
    countryId,
    highlightCountryIds,
    highlightCountryNames,
  });

  useCountryMapEmbedLayers({
    state,
    countryId,
    showNeighbors,
    showCities,
    showSubdivisions,
    interactive,
    onCountryClick,
    onNeighborClick,
    onFeatureClick,
    boundsPadding,
  });

  // ── Loading state ──
  if (state.isLoading) {
    return (
      <div className={`bg-muted flex items-center justify-center ${height} ${className}`}>
        <Loader2 className="text-muted-foreground h-5 w-5 animate-spin" />
      </div>
    );
  }

  // ── No geometry fallback ──
  if (!state.hasGeometry) {
    return (
      <div
        className={`bg-muted flex flex-col items-center justify-center gap-2 ${height} ${className}`}
      >
        <MapPin className="text-muted-foreground h-6 w-6" />
        <span className="text-muted-foreground text-xs">No map data available</span>
      </div>
    );
  }

  return (
    <div className={`relative overflow-hidden ${height} ${className}`} style={{ minHeight: 200 }}>
      <div
        ref={state.containerRef}
        className="absolute inset-0"
        style={{ width: "100%", height: "100%" }}
      />
      {!state.mapReady && (
        <div className="bg-muted absolute inset-0 flex items-center justify-center">
          <Loader2 className="text-muted-foreground h-5 w-5 animate-spin" />
        </div>
      )}
    </div>
  );
}
