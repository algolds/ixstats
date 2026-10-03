"use client";

/**
 * CountryMapEmbed - Lightweight country-focused MapLibre map.
 *
 * Renders a single country's territory zoomed to its bounding box,
 * with dimmed neighbors, city markers, and capital stars.
 * Much lighter than MapContainer (2-4 sources vs 10+).
 */

import { MapPin, SystemRestart as Loader2 } from "iconoir-react";

import { useCountryMapEmbedState } from "~/components/maps/widgets/hooks/useCountryMapEmbedState";
import { useCountryMapEmbedLayers } from "~/components/maps/widgets/hooks/useCountryMapEmbedLayers";

/** A clicked map feature, identified by kind + record id. */
interface CountryMapFeature {
  kind: "city" | "subdivision";
  id: string;
}

interface CountryMapEmbedProps {
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

  if (state.isLoading) {
    return (
      <div className={`bg-fill-3 flex items-center justify-center ${height} ${className}`}>
        <Loader2 className="text-label-secondary h-5 w-5 animate-spin" />
      </div>
    );
  }

  if (!state.hasGeometry) {
    return (
      <div
        className={`bg-fill-3 flex flex-col items-center justify-center gap-2 ${height} ${className}`}
      >
        <MapPin className="text-label-secondary h-6 w-6" />
        <span className="text-label-secondary text-footnote">No map data available</span>
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
        <div className="bg-fill-3 absolute inset-0 flex items-center justify-center">
          <Loader2 className="text-label-secondary h-5 w-5 animate-spin" />
        </div>
      )}
    </div>
  );
}
