"use client";

import { useEffect, useCallback } from "react";
import { buildBaseStyle } from "~/lib/maps/map-config";
import { loadMaplibre } from "~/lib/maps/load-maplibre";
import { populateEmbedMap, type EmbedLayerOptions } from "../embed-map-layers";

interface UseCountryMapEmbedLayersProps extends Partial<EmbedLayerOptions> {
  state: EmbedLayerOptions["state"];
  countryId: string;
  interactive?: boolean;
}

export function useCountryMapEmbedLayers({
  state,
  countryId,
  showNeighbors = true,
  showCities = true,
  showSubdivisions = false,
  interactive = true,
  onCountryClick,
  onNeighborClick,
  onFeatureClick,
  boundsPadding = 40,
}: UseCountryMapEmbedLayersProps) {
  const { mapRef, setMapReady } = state;

  /** `isCancelled` turns true when the effect that started this run is cleaned up, at whatever stage the run is. */
  const initMap = useCallback(
    async (isCancelled: () => boolean) => {
      if (!state.containerRef.current || !state.geometry) return;

      const initialCenter: [number, number] = state.centroid
        ? [state.centroid.lng, state.centroid.lat]
        : [10, 5];

      const maplibregl = await loadMaplibre();
      if (isCancelled() || !state.containerRef.current) return;

      // Each embed owns its own standalone MapLibre instance. The ref holds it from here on, so the
      // effect's cleanup removes it whether or not it has loaded.
      const map = new maplibregl.Map({
        container: state.containerRef.current,
        style: buildBaseStyle("standard", "mercator") as any,
        center: initialCenter,
        zoom: 3,
        attributionControl: false,
        dragRotate: false,
        interactive,
      });
      mapRef.current = map;

      map.on("load", () => {
        if (isCancelled()) return;
        populateEmbedMap(map, {
          state,
          countryId,
          showNeighbors,
          showCities,
          showSubdivisions,
          boundsPadding,
          onCountryClick,
          onNeighborClick,
          onFeatureClick,
        });
        setMapReady(true);
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      state.geometry,
      state.centroid,
      state.bbox,
      state.featureId,
      state.displayName,
      state.fillColor,
      state.neighbors,
      state.cities,
      state.capital,
      state.subdivisions,
      state.worldPolitical,
      showNeighbors,
      showCities,
      showSubdivisions,
      interactive,
      onCountryClick,
      onNeighborClick,
      onFeatureClick,
      boundsPadding,
      countryId,
      mapRef,
      setMapReady,
    ]
  );

  useEffect(() => {
    if (!state.geometry) return;
    let cancelled = false;
    const timer = setTimeout(() => void initMap(() => cancelled), 50);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      mapRef.current?.remove();
      mapRef.current = null;
      setMapReady(false);
    };
  }, [initMap, state.geometry, mapRef, setMapReady]);
}
