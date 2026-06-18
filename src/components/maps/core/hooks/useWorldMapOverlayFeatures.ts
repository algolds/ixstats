// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
import { useEffect } from "react";
import type { Map as MapLibreMap, GeoJSONSource } from "maplibre-gl";
import type { FeatureCollection } from "geojson";
import type { CapitalsGeoJson, MapOverlayFeatures } from "../IxWorldMap";
import { createStarImage } from "../utils/map-core-helpers";
import type { MapTheme } from "~/lib/map-styles/registry";

interface UseWorldMapOverlayFeaturesProps {
  map: MapLibreMap | null;
  isLoaded: boolean;
  capitals?: CapitalsGeoJson;
  overlayFeatures?: MapOverlayFeatures;
  theme?: MapTheme;
}

export function useWorldMapOverlayFeatures({
  map,
  isLoaded,
  capitals,
  overlayFeatures,
  theme,
}: UseWorldMapOverlayFeaturesProps) {
  // 1. Render capitals
  useEffect(() => {
    if (!map || !isLoaded || !capitals || capitals.features.length === 0) return;

    const sourceId = "source-capitals";

    try {
      if (!map.hasImage("capital-star")) {
        const starImg = createStarImage(24, "#d4a017", "#7a5c00");
        map.addImage("capital-star", starImg, { sdf: false });
      }

      const existing = map.getSource(sourceId);
      if (existing) {
        (existing as GeoJSONSource).setData(capitals as unknown as GeoJSON.GeoJSON);
      }
    } catch (err) {
      console.warn("[useWorldMapOverlayFeatures] capitals layer error:", err);
    }
  }, [map, isLoaded, capitals, theme]);

  // 2. Render subdivisions, cities, and POIs
  useEffect(() => {
    if (!map || !isLoaded || !overlayFeatures) return;

    // --- Subdivisions ---
    const subSource = "source-overlay-subdivisions";
    try {
      const existing = map.getSource(subSource);
      if (existing) {
        (existing as GeoJSONSource).setData(overlayFeatures.subdivisions as unknown as GeoJSON.GeoJSON);
      }
    } catch (err) {
      console.warn("[useWorldMapOverlayFeatures] overlay subdivisions error:", err);
    }

    // --- Cities (non-capital) ---
    const citySource = "source-overlay-cities";
    const nonCapitalCities: FeatureCollection = {
      ...overlayFeatures.cities,
      features: (overlayFeatures.cities?.features || []).filter((f) => !f.properties?.isCapital),
    };

    try {
      const existing = map.getSource(citySource);
      if (existing) {
        (existing as GeoJSONSource).setData(nonCapitalCities as unknown as GeoJSON.GeoJSON);
      }
    } catch (err) {
      console.warn("[useWorldMapOverlayFeatures] overlay cities error:", err);
    }

    // --- POIs ---
    const poiSource = "source-overlay-pois";
    try {
      const existing = map.getSource(poiSource);
      if (existing) {
        (existing as GeoJSONSource).setData(overlayFeatures.pois as unknown as GeoJSON.GeoJSON);
      }
    } catch (err) {
      console.warn("[useWorldMapOverlayFeatures] overlay POIs error:", err);
    }
  }, [map, isLoaded, overlayFeatures, theme]);
}
