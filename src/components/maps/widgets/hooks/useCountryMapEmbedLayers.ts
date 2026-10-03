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
  const initMap = useCallback(async () => {
    if (!state.containerRef.current || !state.geometry) return () => {};

    const initialCenter: [number, number] = state.centroid
      ? [state.centroid.lng, state.centroid.lat]
      : [10, 5];

    let released = false;

    const maplibregl = await loadMaplibre();
    if (released || !state.containerRef.current) return () => {};

    // Each embed owns its own standalone MapLibre instance.
    const map = new maplibregl.Map({
      container: state.containerRef.current,
      style: buildBaseStyle("standard", "mercator") as any,
      center: initialCenter,
      zoom: 3,
      attributionControl: false,
      dragRotate: false,
      interactive,
    });

    map.on("load", () => {
      if (released) return;
      state.mapRef.current = map;
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
      state.setMapReady(true);
    });

    return () => {
      released = true;
      map.remove();
      state.mapRef.current = null;
      state.setMapReady(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
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
  ]);

  useEffect(() => {
    if (!state.geometry) return;
    let cleanup: (() => void) | undefined;
    const timer = setTimeout(async () => {
      cleanup = await initMap();
    }, 50);
    return () => {
      clearTimeout(timer);
      cleanup?.();
    };
  }, [initMap, state.geometry]);
}
