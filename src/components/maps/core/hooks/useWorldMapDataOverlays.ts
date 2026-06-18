// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
import { useEffect } from "react";
import type { Map as MapLibreMap, GeoJSONSource } from "maplibre-gl";
import type { MapOverlayFeatures, OverlayVisibility } from "../IxWorldMap";
import { registerStoryPinIcons } from "~/lib/story-pin-icons";
import type { MapTheme } from "~/lib/map-styles/registry";

interface UseWorldMapDataOverlaysProps {
  map: MapLibreMap | null;
  isLoaded: boolean;
  overlayFeatures?: MapOverlayFeatures;
  overlayVisibility?: OverlayVisibility;
  labelsVisible?: boolean;
  theme?: MapTheme;
}

export function useWorldMapDataOverlays({
  map,
  isLoaded,
  overlayFeatures,
  overlayVisibility,
  labelsVisible,
  theme,
}: UseWorldMapDataOverlaysProps) {
  // 1. Render story pins
  useEffect(() => {
    if (!map || !isLoaded || !overlayFeatures?.storyPins) return;

    const spSource = "source-story-pins";

    try {
      registerStoryPinIcons(map);

      const existing = map.getSource(spSource);
      if (existing) {
        (existing as GeoJSONSource).setData(
          overlayFeatures.storyPins as unknown as GeoJSON.GeoJSON
        );
      }
    } catch (err) {
      console.warn("[useWorldMapDataOverlays] story pins error:", err);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, isLoaded, overlayFeatures?.storyPins, theme]);

  // 1b. Render custom map labels with dynamic client-side zoom filtering
  useEffect(() => {
    if (!map || !isLoaded || !overlayFeatures?.mapLabels) return;

    const mlSource = "source-map-labels";

    const updateFilteredLabels = () => {
      const source = map.getSource(mlSource);
      if (!source) return;

      const currentZoom = map.getZoom();
      const rawFeatures = (overlayFeatures.mapLabels as any)?.features || [];

      const filteredFeatures = rawFeatures.filter((f: any) => {
        const minZ = f.properties?.minZoom ?? 4;
        const maxZ = f.properties?.maxZoom ?? 18;
        return currentZoom >= minZ && currentZoom <= maxZ;
      });

      (source as any).setData({
        type: "FeatureCollection",
        features: filteredFeatures,
      });
    };

    try {
      updateFilteredLabels();
    } catch (err) {
      console.warn("[useWorldMapDataOverlays] custom map labels error:", err);
    }

    map.on("zoom", updateFilteredLabels);

    return () => {
      if (map) {
        map.off("zoom", updateFilteredLabels);
      }
    };
  }, [map, isLoaded, overlayFeatures?.mapLabels, theme]);

  // 2. Toggle overlay groups visibility
  useEffect(() => {
    if (!map || !isLoaded || !overlayVisibility) return;

    const overlayLayers = {
      cities: [
        "overlay-cities-circle",
        "overlay-cities-label",
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
  }, [map, isLoaded, labelsVisible, theme]);
}
