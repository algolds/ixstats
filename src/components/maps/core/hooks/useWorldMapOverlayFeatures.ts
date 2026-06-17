// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
import { useEffect } from "react";
import type { Map as MapLibreMap, GeoJSONSource } from "maplibre-gl";
import type { FeatureCollection } from "geojson";
import type { CapitalsGeoJson, MapOverlayFeatures } from "../IxWorldMap";
import { MAP_SYMBOL_FONTS } from "~/lib/map-config";
import { createStarImage } from "../utils/map-core-helpers";

interface UseWorldMapOverlayFeaturesProps {
  map: MapLibreMap | null;
  isLoaded: boolean;
  capitals?: CapitalsGeoJson;
  overlayFeatures?: MapOverlayFeatures;
}

export function useWorldMapOverlayFeatures({
  map,
  isLoaded,
  capitals,
  overlayFeatures,
}: UseWorldMapOverlayFeaturesProps) {
  // 1. Render capitals
  useEffect(() => {
    if (!map || !isLoaded || !capitals || capitals.features.length === 0) return;

    const sourceId = "source-capitals";
    const starLayerId = "capitals-star";
    const labelLayerId = "capitals-label";

    try {
      if (!map.hasImage("capital-star")) {
        const starImg = createStarImage(24, "#d4a017", "#7a5c00");
        map.addImage("capital-star", starImg, { sdf: false });
      }

      const existing = map.getSource(sourceId);
      if (existing) {
        (existing as GeoJSONSource).setData(capitals as unknown as GeoJSON.GeoJSON);
      } else {
        map.addSource(sourceId, {
          type: "geojson",
          data: capitals as unknown as GeoJSON.GeoJSON,
        });

        map.addLayer({
          id: starLayerId,
          type: "symbol",
          source: sourceId,
          layout: {
            "icon-image": "capital-star",
            "icon-size": [
              "interpolate",
              ["linear"],
              ["zoom"],
              2,
              0.45,
              5,
              0.7,
              8,
              0.9,
            ] as unknown as number,
            "icon-allow-overlap": true,
            "icon-ignore-placement": true,
          },
          paint: {
            "icon-opacity": [
              "interpolate",
              ["linear"],
              ["zoom"],
              3,
              0.7,
              4,
              1,
            ] as unknown as number,
          },
          minzoom: 3,
        });

        map.addLayer({
          id: labelLayerId,
          type: "symbol",
          source: sourceId,
          layout: {
            "text-field": ["get", "name"] as unknown as string,
            "text-size": ["interpolate", ["linear"], ["zoom"], 4, 10, 8, 13] as unknown as number,
            "text-offset": [0, 1.2],
            "text-anchor": "top",
            "text-allow-overlap": false,
            "text-optional": true,
            "text-font": [...MAP_SYMBOL_FONTS.regular],
          },
          paint: {
            "text-color": "#333",
            "text-halo-color": "#fff",
            "text-halo-width": 1.5,
          },
          minzoom: 4,
        });
      }
    } catch (err) {
      console.warn("[useWorldMapOverlayFeatures] capitals layer error:", err);
    }
  }, [map, isLoaded, capitals]);

  // 2. Render subdivisions, cities, and POIs
  useEffect(() => {
    if (!map || !isLoaded || !overlayFeatures) return;

    // --- Subdivisions ---
    const subSource = "source-overlay-subdivisions";
    const subFillId = "overlay-subdivisions-fill";
    const subStrokeId = "overlay-subdivisions-stroke";
    const subLabelId = "overlay-subdivisions-label";

    try {
      if (map.getSource(subSource)) {
        (map.getSource(subSource) as GeoJSONSource).setData(
          overlayFeatures.subdivisions as unknown as GeoJSON.GeoJSON
        );
      } else {
        map.addSource(subSource, {
          type: "geojson",
          data: overlayFeatures.subdivisions as unknown as GeoJSON.GeoJSON,
          generateId: true,
        });
        map.addLayer({
          id: subFillId,
          type: "fill",
          source: subSource,
          paint: {
            "fill-color": "#a78bfa",
            "fill-opacity": [
              "interpolate",
              ["linear"],
              ["zoom"],
              4,
              ["case", ["boolean", ["feature-state", "hover"], false], 0.15, 0.04],
              7,
              ["case", ["boolean", ["feature-state", "hover"], false], 0.25, 0.1],
            ] as unknown as number,
          },
          minzoom: 4,
        });
        map.addLayer({
          id: subStrokeId,
          type: "line",
          source: subSource,
          paint: {
            "line-color": "#7c3aed",
            "line-width": [
              "interpolate",
              ["linear"],
              ["zoom"],
              4,
              ["case", ["boolean", ["feature-state", "hover"], false], 1.5, 0.6],
              8,
              ["case", ["boolean", ["feature-state", "hover"], false], 2.5, 1.4],
            ] as unknown as number,
            "line-dasharray": [3, 2] as unknown as number[],
            "line-opacity": [
              "interpolate",
              ["linear"],
              ["zoom"],
              4,
              0.5,
              6,
              0.8,
              8,
              1.0,
            ] as unknown as number,
          },
          minzoom: 4,
        });
        map.addLayer({
          id: subLabelId,
          type: "symbol",
          source: subSource,
          layout: {
            "text-field": ["get", "name"] as unknown as string,
            "text-size": [
              "interpolate",
              ["linear"],
              ["zoom"],
              4,
              8,
              7,
              11,
              10,
              14,
            ] as unknown as number,
            "text-allow-overlap": false,
            "text-optional": true,
            "text-padding": 8 as unknown as number,
            "text-font": [...MAP_SYMBOL_FONTS.regular],
            "symbol-sort-key": ["-", ["coalesce", ["get", "areaSqKm"], 0]] as unknown as number,
          },
          paint: {
            "text-color": "#6d28d9",
            "text-halo-color": "#fff",
            "text-halo-width": 1.5,
            "text-opacity": [
              "interpolate",
              ["linear"],
              ["zoom"],
              4,
              0,
              5,
              0.7,
              7,
              1,
            ] as unknown as number,
          },
          minzoom: 4.5,
        });
      }
    } catch (err) {
      console.warn("[useWorldMapOverlayFeatures] overlay subdivisions error:", err);
    }

    // --- Cities (non-capital) ---
    const citySource = "source-overlay-cities";
    const cityCircleId = "overlay-cities-circle";
    const cityLabelId = "overlay-cities-label";

    const nonCapitalCities: FeatureCollection = {
      ...overlayFeatures.cities,
      features: overlayFeatures.cities.features.filter((f) => !f.properties?.isCapital),
    };

    try {
      const enableCityClustering = nonCapitalCities.features.length > 50;
      if (map.getSource(citySource)) {
        (map.getSource(citySource) as GeoJSONSource).setData(
          nonCapitalCities as unknown as GeoJSON.GeoJSON
        );
      } else {
        map.addSource(citySource, {
          type: "geojson",
          data: nonCapitalCities as unknown as GeoJSON.GeoJSON,
          ...(enableCityClustering
            ? {
                cluster: true,
                clusterMaxZoom: 8,
                clusterRadius: 40,
              }
            : {}),
        });

        if (enableCityClustering) {
          map.addLayer({
            id: `${cityCircleId}-cluster`,
            type: "circle",
            source: citySource,
            filter: ["has", "point_count"],
            paint: {
              "circle-radius": [
                "step",
                ["get", "point_count"],
                12,
                10,
                16,
                50,
                22,
              ] as unknown as number,
              "circle-color": [
                "step",
                ["get", "point_count"],
                "#93c5fd",
                10,
                "#3b82f6",
                50,
                "#1e40af",
              ] as unknown as string,
              "circle-stroke-color": "#fff",
              "circle-stroke-width": 1.5,
            },
            minzoom: 3,
          });
          map.addLayer({
            id: `${cityCircleId}-cluster-count`,
            type: "symbol",
            source: citySource,
            filter: ["has", "point_count"],
            layout: {
              "text-field": "{point_count_abbreviated}",
              "text-size": 11,
              "text-font": [...MAP_SYMBOL_FONTS.regular],
            },
            paint: { "text-color": "#fff" },
            minzoom: 3,
          });
        }

        map.addLayer({
          id: cityCircleId,
          type: "circle",
          source: citySource,
          ...(enableCityClustering ? { filter: ["!", ["has", "point_count"]] } : {}),
          paint: {
            "circle-radius": [
              "interpolate",
              ["linear"],
              ["zoom"],
              4,
              ["case", ["==", ["get", "cityType"], "major"], 4.5, 3],
              8,
              ["case", ["==", ["get", "cityType"], "major"], 8, 6],
            ] as unknown as number,
            "circle-color": "#3b82f6",
            "circle-stroke-color": "#fff",
            "circle-stroke-width": 1.2,
          },
          minzoom: 4,
        });
        map.addLayer({
          id: cityLabelId,
          type: "symbol",
          source: citySource,
          ...(enableCityClustering ? { filter: ["!", ["has", "point_count"]] } : {}),
          layout: {
            "text-field": ["get", "name"] as unknown as string,
            "text-size": ["interpolate", ["linear"], ["zoom"], 6, 9, 10, 12] as unknown as number,
            "text-offset": [0, 1.2],
            "text-anchor": "top",
            "text-allow-overlap": false,
            "text-optional": true,
            "text-font": [...MAP_SYMBOL_FONTS.regular],
            "symbol-sort-key": ["-", ["coalesce", ["get", "population"], 0]] as unknown as number,
          },
          paint: { "text-color": "#1e40af", "text-halo-color": "#fff", "text-halo-width": 1.5 },
          minzoom: 6,
        });
      }
    } catch (err) {
      console.warn("[useWorldMapOverlayFeatures] overlay cities error:", err);
    }

    // --- POIs ---
    const poiSource = "source-overlay-pois";
    const poiCircleId = "overlay-pois-circle";
    const poiLabelId = "overlay-pois-label";

    try {
      const enablePoiClustering = overlayFeatures.pois.features.length > 30;
      if (map.getSource(poiSource)) {
        (map.getSource(poiSource) as GeoJSONSource).setData(
          overlayFeatures.pois as unknown as GeoJSON.GeoJSON
        );
      } else {
        map.addSource(poiSource, {
          type: "geojson",
          data: overlayFeatures.pois as unknown as GeoJSON.GeoJSON,
          ...(enablePoiClustering
            ? {
                cluster: true,
                clusterMaxZoom: 10,
                clusterRadius: 35,
              }
            : {}),
        });

        if (enablePoiClustering) {
          map.addLayer({
            id: `${poiCircleId}-cluster`,
            type: "circle",
            source: poiSource,
            filter: ["has", "point_count"],
            paint: {
              "circle-radius": [
                "step",
                ["get", "point_count"],
                10,
                5,
                14,
                20,
                18,
              ] as unknown as number,
              "circle-color": [
                "step",
                ["get", "point_count"],
                "#fcd34d",
                5,
                "#f59e0b",
                20,
                "#d97706",
              ] as unknown as string,
              "circle-stroke-color": "#fff",
              "circle-stroke-width": 1,
            },
            minzoom: 5,
          });
          map.addLayer({
            id: `${poiCircleId}-cluster-count`,
            type: "symbol",
            source: poiSource,
            filter: ["has", "point_count"],
            layout: {
              "text-field": "{point_count_abbreviated}",
              "text-size": 10,
              "text-font": [...MAP_SYMBOL_FONTS.regular],
            },
            paint: { "text-color": "#78350f" },
            minzoom: 5,
          });
        }

        map.addLayer({
          id: poiCircleId,
          type: "circle",
          source: poiSource,
          ...(enablePoiClustering ? { filter: ["!", ["has", "point_count"]] } : {}),
          paint: {
            "circle-radius": [
              "interpolate",
              ["linear"],
              ["zoom"],
              6,
              2.5,
              10,
              5,
            ] as unknown as number,
            "circle-color": "#f59e0b",
            "circle-stroke-color": "#fff",
            "circle-stroke-width": 1,
          },
          minzoom: 6,
        });
        map.addLayer({
          id: poiLabelId,
          type: "symbol",
          source: poiSource,
          ...(enablePoiClustering ? { filter: ["!", ["has", "point_count"]] } : {}),
          layout: {
            "text-field": ["get", "name"] as unknown as string,
            "text-size": ["interpolate", ["linear"], ["zoom"], 8, 8, 12, 11] as unknown as number,
            "text-offset": [0, 1.1],
            "text-anchor": "top",
            "text-allow-overlap": false,
            "text-optional": true,
            "text-font": [...MAP_SYMBOL_FONTS.regular],
          },
          paint: { "text-color": "#92400e", "text-halo-color": "#fff", "text-halo-width": 1.2 },
          minzoom: 8,
        });
      }
    } catch (err) {
      console.warn("[useWorldMapOverlayFeatures] overlay POIs error:", err);
    }
  }, [map, isLoaded, overlayFeatures]);
}
