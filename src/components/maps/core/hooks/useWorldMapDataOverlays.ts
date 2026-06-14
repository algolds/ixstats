// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
import { useEffect } from "react";
import type { Map as MapLibreMap, GeoJSONSource } from "maplibre-gl";
import type { MapOverlayFeatures, OverlayVisibility } from "../IxWorldMap";
import { registerStoryPinIcons } from "~/lib/story-pin-icons";
import { MAP_SYMBOL_FONTS } from "~/lib/map-config";

interface UseWorldMapDataOverlaysProps {
  map: MapLibreMap | null;
  isLoaded: boolean;
  overlayFeatures?: MapOverlayFeatures;
  overlayVisibility?: OverlayVisibility;
  labelsVisible?: boolean;
}

export function useWorldMapDataOverlays({
  map,
  isLoaded,
  overlayFeatures,
  overlayVisibility,
  labelsVisible,
}: UseWorldMapDataOverlaysProps) {
  // 1. Render custom text labels and story pins
  useEffect(() => {
    if (!map || !isLoaded || !overlayFeatures) return;

    // --- Story Pins ---
    if (overlayFeatures.storyPins) {
      const spSource = "source-story-pins";
      const spIconId = "story-pins-icon";
      const spGlowId = "story-pins-glow";
      const spLabelId = "story-pins-label";
      const spClusterId = "story-pins-cluster";
      const spClusterCountId = "story-pins-cluster-count";

      try {
        registerStoryPinIcons(map);

        const SP_COLORS: Record<string, string> = {
          battle: "#dc2626",
          founding: "#2563eb",
          treaty: "#16a34a",
          cultural: "#9333ea",
          religious: "#ca8a04",
          natural: "#059669",
          trade: "#ea580c",
          exploration: "#0891b2",
          disaster: "#6b7280",
        };
        const colorExpr: unknown[] = ["match", ["get", "category"]];
        for (const [cat, color] of Object.entries(SP_COLORS)) {
          colorExpr.push(cat, color);
        }
        colorExpr.push("#6b7280");

        if (map.getSource(spSource)) {
          (map.getSource(spSource) as GeoJSONSource).setData(
            overlayFeatures.storyPins as unknown as GeoJSON.GeoJSON
          );
        } else {
          map.addSource(spSource, {
            type: "geojson",
            data: overlayFeatures.storyPins as unknown as GeoJSON.GeoJSON,
            cluster: true,
            clusterMaxZoom: 8,
            clusterRadius: 50,
          });

          map.addLayer({
            id: spClusterId,
            type: "circle",
            source: spSource,
            filter: ["has", "point_count"],
            paint: {
              "circle-radius": [
                "step",
                ["get", "point_count"],
                16,
                10,
                22,
                30,
                28,
              ] as unknown as number,
              "circle-color": "#7c3aed",
              "circle-stroke-color": "#fff",
              "circle-stroke-width": 2,
              "circle-opacity": 0.85,
            },
            minzoom: 3,
          });

          map.addLayer({
            id: spClusterCountId,
            type: "symbol",
            source: spSource,
            filter: ["has", "point_count"],
            layout: {
              "text-field": ["get", "point_count_abbreviated"] as unknown as string,
              "text-size": 12,
              "text-font": [...MAP_SYMBOL_FONTS.regular],
            },
            paint: {
              "text-color": "#ffffff",
            },
          });

          map.addLayer({
            id: spGlowId,
            type: "circle",
            source: spSource,
            filter: ["all", ["!", ["has", "point_count"]], [">=", ["get", "importance"], 1]],
            paint: {
              "circle-radius": [
                "interpolate",
                ["linear"],
                ["zoom"],
                4,
                ["case", [">=", ["get", "importance"], 2], 18, 14],
                8,
                ["case", [">=", ["get", "importance"], 2], 28, 22],
                12,
                ["case", [">=", ["get", "importance"], 2], 36, 28],
              ] as unknown as number,
              "circle-color": colorExpr as unknown as string,
              "circle-opacity": [
                "case",
                [">=", ["get", "importance"], 2],
                0.25,
                0.15,
              ] as unknown as number,
              "circle-blur": 0.6,
            },
            minzoom: 3,
          });

          map.addLayer({
            id: spIconId,
            type: "symbol",
            source: spSource,
            filter: ["!", ["has", "point_count"]],
            layout: {
              "icon-image": [
                "concat",
                "story-pin-",
                ["get", "category"],
                "-",
                ["to-string", ["coalesce", ["get", "importance"], 0]],
              ] as unknown as string,
              "icon-size": [
                "interpolate",
                ["linear"],
                ["zoom"],
                3,
                0.5,
                6,
                0.75,
                10,
                1,
              ] as unknown as number,
              "icon-allow-overlap": true,
              "icon-anchor": "center",
            },
            minzoom: 3,
          });

          map.addLayer({
            id: spLabelId,
            type: "symbol",
            source: spSource,
            filter: ["!", ["has", "point_count"]],
            layout: {
              "text-field": ["get", "title"] as unknown as string,
              "text-size": ["interpolate", ["linear"], ["zoom"], 5, 8, 10, 11] as unknown as number,
              "text-offset": [0, 1.8],
              "text-anchor": "top",
              "text-allow-overlap": false,
              "text-optional": true,
              "text-max-width": 12,
              "text-font": [
                "case",
                [">=", ["coalesce", ["get", "importance"], 0], 1],
                ["literal", [...MAP_SYMBOL_FONTS.bold]],
                ["literal", [...MAP_SYMBOL_FONTS.sans]],
              ] as unknown as string[],
            },
            paint: {
              "text-color": colorExpr as unknown as string,
              "text-halo-color": "#fff",
              "text-halo-width": 1.5,
            },
            minzoom: 5,
          });
        }
      } catch (err) {
        console.warn("[useWorldMapDataOverlays] story pins error:", err);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, isLoaded, overlayFeatures?.storyPins]);

  // 1b. Render custom map labels with dynamic client-side zoom filtering
  useEffect(() => {
    if (!map || !isLoaded || !overlayFeatures?.mapLabels) return;

    const mlSource = "source-map-labels";
    const mlLayerId = "custom-map-labels";

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
      if (map.getSource(mlSource)) {
        updateFilteredLabels();
      } else {
        const currentZoom = map.getZoom();
        const rawFeatures = (overlayFeatures.mapLabels as any)?.features || [];
        const filteredFeatures = rawFeatures.filter((f: any) => {
          const minZ = f.properties?.minZoom ?? 4;
          const maxZ = f.properties?.maxZoom ?? 18;
          return currentZoom >= minZ && currentZoom <= maxZ;
        });

        map.addSource(mlSource, {
          type: "geojson",
          data: {
            type: "FeatureCollection",
            features: filteredFeatures,
          },
        });

        map.addLayer({
          id: mlLayerId,
          type: "symbol",
          source: mlSource,
          layout: {
            "text-field": ["get", "text"] as unknown as string,
            "text-size": ["coalesce", ["get", "fontSize"], 12] as unknown as number,
            "text-rotate": ["coalesce", ["get", "rotation"], 0] as unknown as number,
            "text-letter-spacing": ["coalesce", ["get", "letterSpacing"], 0] as unknown as number,
            "text-font": [
              "case",
              ["==", ["coalesce", ["get", "fontWeight"], "normal"], "bold"],
              ["literal", [...MAP_SYMBOL_FONTS.bold]],
              ["literal", [...MAP_SYMBOL_FONTS.regular]],
            ] as unknown as string[],
            "text-allow-overlap": true,
          },
          paint: {
            "text-color": ["coalesce", ["get", "color"], "#374151"] as unknown as string,
            "text-opacity": ["coalesce", ["get", "opacity"], 1] as unknown as number,
            "text-halo-color": "#ffffff",
            "text-halo-width": 1.2,
          },
        });
      }
    } catch (err) {
      console.warn("[useWorldMapDataOverlays] custom map labels error:", err);
    }

    map.on("zoom", updateFilteredLabels);

    return () => {
      if (map) {
        map.off("zoom", updateFilteredLabels);
      }
    };
  }, [map, isLoaded, overlayFeatures?.mapLabels]);

  // 2. Toggle overlay groups visibility
  useEffect(() => {
    if (!map || !isLoaded || !overlayVisibility) return;

    const overlayLayers = {
      cities: [
        "overlay-cities-circle",
        "overlay-cities-circle-cluster",
        "overlay-cities-circle-cluster-count",
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
  }, [map, isLoaded, overlayVisibility]);

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
  }, [map, isLoaded, labelsVisible]);
}
