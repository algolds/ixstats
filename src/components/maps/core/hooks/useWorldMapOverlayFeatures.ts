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
  selectedCountryId?: string | null;
}

export function useWorldMapOverlayFeatures({
  map,
  isLoaded,
  capitals,
  overlayFeatures,
  theme,
  selectedCountryId,
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

  // 2. Render subdivisions, cities, and POIs with dynamic zoom/focus filtering
  useEffect(() => {
    if (!map || !isLoaded || !overlayFeatures) return;

    const updateOverlayFeatures = () => {
      const currentZoom = map.getZoom();
      const hasFocus = selectedCountryId !== null && selectedCountryId !== undefined;

      // --- Subdivisions ---
      const subSource = "source-overlay-subdivisions";
      try {
        const existing = map.getSource(subSource);
        if (existing) {
          (existing as GeoJSONSource).setData(
            overlayFeatures.subdivisions as unknown as GeoJSON.GeoJSON
          );
        }
      } catch (err) {
        console.warn("[useWorldMapOverlayFeatures] overlay subdivisions error:", err);
      }

      // --- Cities (non-capital) ---
      const citySource = "source-overlay-cities";
      const rawCities = overlayFeatures.cities?.features || [];
      const filteredCitiesFeatures = rawCities.filter((f) => {
        if (f.properties?.isCapital) return false;
        const pop = f.properties?.population ?? 0;
        if (currentZoom >= 6.0) return true;
        if (currentZoom >= 4.5) return pop >= 100000;
        if (currentZoom >= 3.0) return pop >= 250000;
        return pop >= 500000;
      });

      const nonCapitalCities: FeatureCollection = {
        ...overlayFeatures.cities,
        features: filteredCitiesFeatures,
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
      const filteredPoisFeatures = (overlayFeatures.pois?.features || []).filter((f: any) => {
        if (currentZoom >= 4.0) return true;
        return (
          hasFocus &&
          (f.properties?.countryId === selectedCountryId ||
            f.properties?.countrySlug === selectedCountryId ||
            (f.properties?.countryName &&
              f.properties.countryName.toLowerCase() === selectedCountryId.toLowerCase()))
        );
      });

      const poisGeoJson: FeatureCollection = {
        ...overlayFeatures.pois,
        features: filteredPoisFeatures,
      };

      try {
        const existing = map.getSource(poiSource);
        if (existing) {
          (existing as GeoJSONSource).setData(poisGeoJson as unknown as GeoJSON.GeoJSON);
        }
      } catch (err) {
        console.warn("[useWorldMapOverlayFeatures] overlay POIs error:", err);
      }
    };

    try {
      updateOverlayFeatures();
    } catch (err) {
      console.warn("[useWorldMapOverlayFeatures] initial update overlay features error:", err);
    }

    map.on("zoom", updateOverlayFeatures);

    return () => {
      if (map) {
        map.off("zoom", updateOverlayFeatures);
      }
    };
  }, [map, isLoaded, overlayFeatures, selectedCountryId, theme]);
}
