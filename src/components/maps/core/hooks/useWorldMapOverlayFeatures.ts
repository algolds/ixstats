import { useEffect, useRef } from "react";
import type { Map as MapLibreMap, GeoJSONSource } from "maplibre-gl";
import type { Feature } from "geojson";
import type { CapitalsGeoJson, MapOverlayFeatures } from "../IxWorldMap";
import { createStarImage, matchesCountry, setFilteredSourceData } from "../utils/map-core-helpers";
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
    // oxlint-disable-next-line
  }, [map, isLoaded, capitals, theme]);

  // 2. Render subdivisions, cities, and POIs with dynamic zoom/focus filtering.
  // Subdivisions are pushed once per data change; cities/POIs are re-filtered on `zoom`
  // but only re-sent to the worker when the filtered list actually changes (a handful of
  // threshold crossings per zoom gesture instead of one full re-tile per animation frame).
  const lastCitiesRef = useRef<Feature[] | null>(null);
  const lastPoisRef = useRef<Feature[] | null>(null);

  useEffect(() => {
    if (!map || !isLoaded || !overlayFeatures) return;

    // A dependency changed (new data, focus or theme) — force one fresh push.
    lastCitiesRef.current = null;
    lastPoisRef.current = null;

    const focusKey = selectedCountryId ?? null;
    const rawCities = (overlayFeatures.cities?.features || []).filter(
      (f) => !f.properties?.isCapital
    );
    const rawPois = overlayFeatures.pois?.features || [];

    try {
      const existing = map.getSource("source-overlay-subdivisions");
      if (existing) {
        (existing as GeoJSONSource).setData(
          overlayFeatures.subdivisions as unknown as GeoJSON.GeoJSON
        );
      }
    } catch (err) {
      console.warn("[useWorldMapOverlayFeatures] overlay subdivisions error:", err);
    }

    const updateOverlayFeatures = () => {
      const currentZoom = map.getZoom();

      const minPop =
        currentZoom >= 6.0 ? 0 : currentZoom >= 4.5 ? 100000 : currentZoom >= 3.0 ? 250000 : 500000;
      const cities =
        minPop === 0
          ? rawCities
          : rawCities.filter((f) => (f.properties?.population ?? 0) >= minPop);
      try {
        setFilteredSourceData(
          map.getSource("source-overlay-cities") as GeoJSONSource | undefined,
          cities,
          lastCitiesRef,
          overlayFeatures.cities
        );
      } catch (err) {
        console.warn("[useWorldMapOverlayFeatures] overlay cities error:", err);
      }

      const pois =
        currentZoom >= 4.0
          ? rawPois
          : focusKey !== null
            ? rawPois.filter((f) => matchesCountry(f, focusKey))
            : [];
      try {
        setFilteredSourceData(
          map.getSource("source-overlay-pois") as GeoJSONSource | undefined,
          pois,
          lastPoisRef,
          overlayFeatures.pois
        );
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
      map.off("zoom", updateOverlayFeatures);
    };
    // oxlint-disable-next-line
  }, [map, isLoaded, overlayFeatures, selectedCountryId, theme]);
}
