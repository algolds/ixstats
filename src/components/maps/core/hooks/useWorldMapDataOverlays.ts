import { useEffect, useRef } from "react";
import type { Feature } from "geojson";
import type { Map as MapLibreMap, GeoJSONSource } from "maplibre-gl";
import type { MapOverlayFeatures, OverlayVisibility } from "../IxWorldMap";
import { registerStoryPinIcons } from "~/lib/maps/story-pin-icons";
import type { MapTheme } from "~/lib/map-styles/registry";
import { setFilteredSourceData } from "../utils/map-core-helpers";

/** Whether a feature belongs to the focused country (matched by id, slug or name). */
function matchesCountry(f: Feature, countryKey: string): boolean {
  const p = f.properties;
  if (!p) return false;
  return (
    p.countryId === countryKey ||
    p.countrySlug === countryKey ||
    (typeof p.countryName === "string" && p.countryName.toLowerCase() === countryKey.toLowerCase())
  );
}

interface UseWorldMapDataOverlaysProps {
  map: MapLibreMap | null;
  isLoaded: boolean;
  overlayFeatures?: MapOverlayFeatures;
  overlayVisibility?: OverlayVisibility;
  labelsVisible?: boolean;
  theme?: MapTheme;
  selectedCountryId?: string | null;
}

export function useWorldMapDataOverlays({
  map,
  isLoaded,
  overlayFeatures,
  overlayVisibility,
  labelsVisible,
  theme,
  selectedCountryId,
}: UseWorldMapDataOverlaysProps) {
  // Last feature lists pushed to each source: zoom handlers only re-send data when the
  // filtered list changes, not on every animation frame of a zoom.
  const lastStoryPinsRef = useRef<Feature[] | null>(null);
  const lastMapLabelsRef = useRef<Feature[] | null>(null);

  // 1. Render story pins with dynamic zoom/focus filtering
  useEffect(() => {
    if (!map || !isLoaded || !overlayFeatures?.storyPins) return;

    lastStoryPinsRef.current = null;
    const rawFeatures = overlayFeatures.storyPins.features || [];
    const focusKey = selectedCountryId || null;
    const focused = focusKey ? rawFeatures.filter((f) => matchesCountry(f, focusKey)) : [];

    try {
      registerStoryPinIcons(map);
    } catch (err) {
      console.warn("[useWorldMapDataOverlays] story pin icons error:", err);
    }

    const updateStoryPins = () => {
      const source = map.getSource("source-story-pins") as GeoJSONSource | undefined;
      const features = map.getZoom() >= 4.0 ? rawFeatures : focused;
      setFilteredSourceData(source, features, lastStoryPinsRef);
    };

    try {
      updateStoryPins();
    } catch (err) {
      console.warn("[useWorldMapDataOverlays] story pins error:", err);
    }

    map.on("zoom", updateStoryPins);

    return () => {
      map.off("zoom", updateStoryPins);
    };
    // oxlint-disable-next-line
  }, [map, isLoaded, overlayFeatures?.storyPins, selectedCountryId, theme]);

  // 1b. Render custom map labels with dynamic client-side zoom/focus filtering
  useEffect(() => {
    if (!map || !isLoaded || !overlayFeatures?.mapLabels) return;

    lastMapLabelsRef.current = null;
    const rawFeatures: Feature[] = overlayFeatures.mapLabels.features || [];
    const focusKey = selectedCountryId || null;

    const updateFilteredLabels = () => {
      const source = map.getSource("source-map-labels") as GeoJSONSource | undefined;
      const currentZoom = map.getZoom();

      const features = rawFeatures.filter((f) => {
        if (currentZoom >= 4.0) {
          const minZ = f.properties?.minZoom ?? 4;
          const maxZ = f.properties?.maxZoom ?? 18;
          if (currentZoom >= minZ && currentZoom <= maxZ) return true;
        }
        return focusKey !== null && matchesCountry(f, focusKey);
      });

      setFilteredSourceData(source, features, lastMapLabelsRef);
    };

    try {
      updateFilteredLabels();
    } catch (err) {
      console.warn("[useWorldMapDataOverlays] custom map labels error:", err);
    }

    map.on("zoom", updateFilteredLabels);

    return () => {
      map.off("zoom", updateFilteredLabels);
    };
    // oxlint-disable-next-line
  }, [map, isLoaded, overlayFeatures?.mapLabels, selectedCountryId, theme]);

  // 2. Toggle overlay groups visibility
  useEffect(() => {
    if (!map || !isLoaded || !overlayVisibility) return;

    const overlayLayers = {
      cities: [
        "overlay-cities-major-circle",
        "overlay-cities-major-label",
        "overlay-cities-medium-circle",
        "overlay-cities-medium-label",
        "overlay-cities-minor-circle",
        "overlay-cities-minor-label",
      ],
      pois: [
        "overlay-pois-circle",
        "overlay-pois-circle-cluster",
        "overlay-pois-circle-cluster-count",
        "overlay-pois-label",
      ],
      subdivisions: [
        "overlay-subdivisions-fill",
        "overlay-subdivisions-stroke",
        "overlay-subdivisions-label",
      ],
      storyPins: [
        "story-pins-icon",
        "story-pins-glow",
        "story-pins-label",
        "story-pins-cluster",
        "story-pins-cluster-count",
      ],
      mapLabels: ["custom-map-labels"],
    };

    for (const [key, layerIds] of Object.entries(overlayLayers)) {
      const visible = overlayVisibility[key];
      for (const id of layerIds) {
        if (map.getLayer(id)) {
          map.setLayoutProperty(id, "visibility", visible ? "visible" : "none");
        }
      }
    }
    // oxlint-disable-next-line
  }, [map, isLoaded, overlayVisibility, theme]);

  // 3. Toggle all text label layers visibility on/off
  useEffect(() => {
    if (!map || !isLoaded) return;

    const labelLayerIds = [
      "country-name-labels",
      "sovereignty-labels",
      "ocean-labels",
      "capitals-label",
      "capitals-star",
      "overlay-subdivisions-label",
      "overlay-cities-label",
      "overlay-pois-label",
    ];

    for (const id of labelLayerIds) {
      if (map.getLayer(id)) {
        map.setLayoutProperty(id, "visibility", labelsVisible ? "visible" : "none");
      }
    }
    // oxlint-disable-next-line
  }, [map, isLoaded, labelsVisible, theme]);
}
