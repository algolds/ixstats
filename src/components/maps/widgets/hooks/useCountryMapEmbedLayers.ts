"use client";

import { useEffect, useCallback } from "react";
import { buildBaseStyle, getCountryColor, MAP_SYMBOL_FONTS } from "~/lib/map-config";
import { createStarImage } from "~/components/maps/core/utils/map-core-helpers";

interface UseCountryMapEmbedLayersProps {
  state: any;
  countryId: string;
  showNeighbors?: boolean;
  showCities?: boolean;
  showSubdivisions?: boolean;
  interactive?: boolean;
  onCountryClick?: () => void;
  onNeighborClick?: (countryId: string) => void;
  onFeatureClick?: (feature: any) => void;
  boundsPadding?: number;
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
    if (!state.containerRef.current || !state.geometry) return;

    const maplibregl = (await import("maplibre-gl")).default;
    await import("maplibre-gl/dist/maplibre-gl.css");

    // Clean up existing
    if (state.mapRef.current) {
      state.mapRef.current.remove();
      state.mapRef.current = null;
    }

    const baseStyle = buildBaseStyle() as any;
    // Force mercator for country embeds (no globe transition needed)
    delete baseStyle.projection;

    const initialCenter: [number, number] = state.centroid
      ? [state.centroid.lng, state.centroid.lat]
      : [10, 5];

    const map = new maplibregl.Map({
      container: state.containerRef.current,
      style: baseStyle,
      center: initialCenter,
      zoom: 3,
      attributionControl: false,
      interactive,
    });

    state.mapRef.current = map;

    map.on("load", () => {
      // ── World political layer (greyed-out neighbor countries) ──
      if (state.worldPolitical && state.worldPolitical.features.length > 0) {
        // Filter out the target country and any highlighted countries — render all others as grey
        const otherCountries: GeoJSON.FeatureCollection = {
          type: "FeatureCollection",
          features: state.worldPolitical.features.filter(
            (f: any) =>
              f.properties?._countryId !== countryId &&
              (state.featureId
                ? f.properties?._id !== state.featureId && f.properties?.id !== state.featureId
                : true) &&
              (state.displayName ? f.properties?._displayName !== state.displayName : true) &&
              !state.highlightIdsMemo.has(f.properties?._countryId) &&
              !state.highlightIdsMemo.has(f.properties?.countryId) &&
              !state.highlightNamesMemo.has(f.properties?._id) &&
              !state.highlightNamesMemo.has(f.properties?.id) &&
              !state.highlightNamesMemo.has(f.properties?._displayName)
          ),
        };

        map.addSource("source-world-political", {
          type: "geojson",
          data: otherCountries,
        });

        // Grey fill for all non-target countries
        map.addLayer({
          id: "world-political-fill",
          type: "fill",
          source: "source-world-political",
          paint: {
            "fill-color": "#94a3b8",
            "fill-opacity": 0.2,
          },
        });

        // Subtle border strokes
        map.addLayer({
          id: "world-political-stroke",
          type: "line",
          source: "source-world-political",
          paint: {
            "line-color": "#64748b",
            "line-width": 0.5,
            "line-opacity": 0.4,
          },
        });

        // Neighbor country name labels
        if (showNeighbors) {
          map.addLayer({
            id: "neighbor-labels",
            type: "symbol",
            source: "source-world-political",
            layout: {
              "text-field": ["coalesce", ["get", "_displayName"], ""] as unknown as string,
              "text-size": 10,
              "text-allow-overlap": false,
              "text-optional": true,
              "text-font": [...MAP_SYMBOL_FONTS.regular],
            },
            paint: {
              "text-color": "#64748b",
              "text-halo-color": "#ffffff",
              "text-halo-width": 1,
              "text-opacity": 0.7,
            },
            minzoom: 3,
          });
        }

        // Render highlighted (partner embassy) countries
        const highlightedCountries: GeoJSON.FeatureCollection = {
          type: "FeatureCollection",
          features: state.worldPolitical.features.filter(
            (f: any) =>
              f.properties?._countryId !== countryId &&
              (state.featureId
                ? f.properties?._id !== state.featureId && f.properties?.id !== state.featureId
                : true) &&
              (state.displayName ? f.properties?._displayName !== state.displayName : true) &&
              (state.highlightIdsMemo.has(f.properties?._countryId) ||
                state.highlightIdsMemo.has(f.properties?.countryId) ||
                state.highlightNamesMemo.has(f.properties?._id) ||
                state.highlightNamesMemo.has(f.properties?.id) ||
                state.highlightNamesMemo.has(f.properties?._displayName))
          ),
        };

        if (highlightedCountries.features.length > 0) {
          map.addSource("source-highlighted-countries", {
            type: "geojson",
            data: highlightedCountries,
          });

          // Render highlighted countries with their own color (or fallback cyan)
          map.addLayer({
            id: "highlighted-countries-fill",
            type: "fill",
            source: "source-highlighted-countries",
            paint: {
              "fill-color": ["coalesce", ["get", "_fillColor"], "#06b6d4"],
              "fill-opacity": 0.45,
            },
          });

          map.addLayer({
            id: "highlighted-countries-stroke",
            type: "line",
            source: "source-highlighted-countries",
            paint: {
              "line-color": "#333",
              "line-width": 1.2,
            },
          });

          if (showNeighbors) {
            map.addLayer({
              id: "highlighted-labels",
              type: "symbol",
              source: "source-highlighted-countries",
              layout: {
                "text-field": ["coalesce", ["get", "_displayName"], ""] as unknown as string,
                "text-size": 10.5,
                "text-allow-overlap": false,
                "text-optional": true,
                "text-font": [...MAP_SYMBOL_FONTS.bold],
              },
              paint: {
                "text-color": "#0e7490", // Cyan/Teal labels for partner countries
                "text-halo-color": "#ffffff",
                "text-halo-width": 1.5,
                "text-opacity": 0.95,
              },
              minzoom: 2,
            });

            if (onNeighborClick) {
              map.on("click", "highlighted-labels", (e) => {
                const cid =
                  e.features?.[0]?.properties?.countryId || e.features?.[0]?.properties?._countryId;
                if (cid) onNeighborClick(cid);
              });
              map.on("mouseenter", "highlighted-labels", () => {
                map.getCanvas().style.cursor = "pointer";
              });
              map.on("mouseleave", "highlighted-labels", () => {
                map.getCanvas().style.cursor = "";
              });
            }
          }

          if (onNeighborClick) {
            map.on("click", "highlighted-countries-fill", (e) => {
              const cid =
                e.features?.[0]?.properties?.countryId || e.features?.[0]?.properties?._countryId;
              if (cid) onNeighborClick(cid);
            });
            map.on("mouseenter", "highlighted-countries-fill", () => {
              map.getCanvas().style.cursor = "pointer";
            });
            map.on("mouseleave", "highlighted-countries-fill", () => {
              map.getCanvas().style.cursor = "";
            });
          }
        }
      }

      // ── Subdivision boundaries ──
      if (showSubdivisions && state.subdivisions && state.subdivisions.length > 0) {
        const subGeo: GeoJSON.FeatureCollection = {
          type: "FeatureCollection",
          features: state.subdivisions
            .filter((s: any) => s.geometry)
            .map((s: any) => ({
              type: "Feature" as const,
              properties: { name: s.name, _subId: s.id },
              geometry: s.geometry as GeoJSON.Geometry,
            })),
        };

        map.addSource("source-subdivisions", { type: "geojson", data: subGeo });

        // Invisible fill for click targeting (only when click-to-manage is active)
        if (onFeatureClick) {
          map.addLayer({
            id: "subdivision-fill",
            type: "fill",
            source: "source-subdivisions",
            paint: {
              "fill-color": "#666",
              "fill-opacity": 0.01,
            },
          });
        }

        map.addLayer({
          id: "subdivision-stroke",
          type: "line",
          source: "source-subdivisions",
          paint: {
            "line-color": "#666",
            "line-width": 0.5,
            "line-dasharray": [3, 2],
          },
        });
      }

      // ── Country fill ──
      const countryColor =
        state.fillColor || (state.featureId ? getCountryColor(state.featureId) : "#c5cae9");

      const countryGeo: GeoJSON.FeatureCollection = {
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            properties: { _fillColor: countryColor },
            geometry: state.geometry as GeoJSON.Geometry,
          },
        ],
      };

      map.addSource("source-country", { type: "geojson", data: countryGeo });

      map.addLayer({
        id: "country-fill",
        type: "fill",
        source: "source-country",
        paint: {
          "fill-color": countryColor,
          "fill-opacity": 0.45,
        },
      });

      map.addLayer({
        id: "country-stroke",
        type: "line",
        source: "source-country",
        paint: {
          "line-color": "#333",
          "line-width": 1.5,
        },
      });

      // ── City markers ──
      if (showCities && state.cities && state.cities.length > 0) {
        const cityFeatures: GeoJSON.Feature[] = [];

        for (const city of state.cities) {
          const coords = city.coordinates as [number, number] | null;
          if (!coords || !Array.isArray(coords) || coords.length < 2) continue;

          cityFeatures.push({
            type: "Feature",
            properties: {
              _cityId: city.id,
              name: city.name,
              isCapital: city.isNationalCapital,
              population: city.population,
            },
            geometry: {
              type: "Point",
              coordinates: coords,
            },
          });
        }

        if (cityFeatures.length > 0) {
          const cityGeo: GeoJSON.FeatureCollection = {
            type: "FeatureCollection",
            features: cityFeatures,
          };

          map.addSource("source-cities", { type: "geojson", data: cityGeo });

          // Capital star icon
          if (state.capital) {
            const starImg = createStarImage(24, "#d4a017", "#7a5c00");
            map.addImage("capital-star", starImg, { sdf: false });

            map.addLayer({
              id: "capital-star",
              type: "symbol",
              source: "source-cities",
              filter: ["==", ["get", "isCapital"], true],
              layout: {
                "icon-image": "capital-star",
                "icon-size": 0.7,
                "icon-allow-overlap": true,
                "icon-ignore-placement": true,
              },
            });
          }

          // Non-capital city dots
          map.addLayer({
            id: "city-circles",
            type: "circle",
            source: "source-cities",
            filter: ["!=", ["get", "isCapital"], true],
            paint: {
              "circle-radius": 3,
              "circle-color": "#555",
              "circle-stroke-color": "#fff",
              "circle-stroke-width": 1,
            },
          });

          // City name labels
          map.addLayer({
            id: "city-labels",
            type: "symbol",
            source: "source-cities",
            filter: ["==", ["get", "isCapital"], true],
            layout: {
              "text-field": ["get", "name"] as unknown as string,
              "text-size": 11,
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
          });

          // Apply Zoom-dependent Level of Detail (LOD) filter to non-capital cities
          const updateCityFilter = () => {
            const z = map.getZoom();
            let filterExpr: any;
            if (z >= 6.0) {
              filterExpr = ["!=", ["get", "isCapital"], true];
            } else if (z >= 4.5) {
              filterExpr = [
                "all",
                ["!=", ["get", "isCapital"], true],
                [">=", ["coalesce", ["get", "population"], 0], 100000],
              ];
            } else if (z >= 3.0) {
              filterExpr = [
                "all",
                ["!=", ["get", "isCapital"], true],
                [">=", ["coalesce", ["get", "population"], 0], 250000],
              ];
            } else {
              filterExpr = [
                "all",
                ["!=", ["get", "isCapital"], true],
                [">=", ["coalesce", ["get", "population"], 0], 500000],
              ];
            }
            if (map.getLayer("city-circles")) {
              map.setFilter("city-circles", filterExpr);
            }
          };

          map.on("zoom", updateCityFilter);
          updateCityFilter();

          // Show non-capital labels on hover of city markers
          let hoveredCityId: string | null = null;
          map.on("mousemove", "city-circles", (e) => {
            const features = e.features;
            if (features && features.length > 0) {
              const id = features[0].properties._cityId;
              if (id !== hoveredCityId) {
                hoveredCityId = id;
                map.getCanvas().style.cursor = "pointer";
                map.setFilter("city-labels", [
                  "any",
                  ["==", ["get", "isCapital"], true],
                  ["==", ["get", "_cityId"], id],
                ] as any);
              }
            }
          });

          map.on("mouseleave", "city-circles", () => {
            hoveredCityId = null;
            map.getCanvas().style.cursor = "";
            map.setFilter("city-labels", ["==", ["get", "isCapital"], true] as any);
          });
        }
      }

      // ── Fit to bounds ──
      let mapBbox = state.bbox
        ? {
            minLng: state.bbox.minLng,
            minLat: state.bbox.minLat,
            maxLng: state.bbox.maxLng,
            maxLat: state.bbox.maxLat,
          }
        : null;

      if (
        (state.highlightIdsMemo.size > 0 || state.highlightNamesMemo.size > 0) &&
        state.worldPolitical
      ) {
        const highlightedFeatures = state.worldPolitical.features.filter(
          (f: any) =>
            state.highlightIdsMemo.has(f.properties?._countryId) ||
            state.highlightIdsMemo.has(f.properties?.countryId) ||
            state.highlightNamesMemo.has(f.properties?._id) ||
            state.highlightNamesMemo.has(f.properties?.id) ||
            state.highlightNamesMemo.has(f.properties?._displayName)
        );

        if (highlightedFeatures.length > 0) {
          if (!mapBbox) {
            const firstCentroidLng = highlightedFeatures[0].properties?._centroidLng;
            const firstCentroidLat = highlightedFeatures[0].properties?._centroidLat;
            if (typeof firstCentroidLng === "number" && typeof firstCentroidLat === "number") {
              mapBbox = {
                minLng: firstCentroidLng,
                minLat: firstCentroidLat,
                maxLng: firstCentroidLng,
                maxLat: firstCentroidLat,
              };
            }
          }

          if (mapBbox) {
            for (const f of highlightedFeatures) {
              const cLng = f.properties?._centroidLng;
              const cLat = f.properties?._centroidLat;
              if (typeof cLng === "number" && typeof cLat === "number") {
                mapBbox.minLng = Math.min(mapBbox.minLng, cLng);
                mapBbox.maxLng = Math.max(mapBbox.maxLng, cLng);
                mapBbox.minLat = Math.min(mapBbox.minLat, cLat);
                mapBbox.maxLat = Math.max(mapBbox.maxLat, cLat);
              }
            }
          }
        }
      }

      if (mapBbox) {
        map.fitBounds(
          [
            [mapBbox.minLng, mapBbox.minLat],
            [mapBbox.maxLng, mapBbox.maxLat],
          ],
          { padding: boundsPadding, maxZoom: 10, duration: 0 }
        );
      }

      // ── Click handlers ──
      if (onCountryClick) {
        map.on("click", "country-fill", () => onCountryClick());
      }

      if (onNeighborClick && showNeighbors) {
        map.on("click", "neighbor-labels", (e) => {
          const cid = e.features?.[0]?.properties?.countryId;
          if (cid) onNeighborClick(cid);
        });
        map.on("mouseenter", "neighbor-labels", () => {
          map.getCanvas().style.cursor = "pointer";
        });
        map.on("mouseleave", "neighbor-labels", () => {
          map.getCanvas().style.cursor = "";
        });
      }

      // ── Click-to-manage: city + subdivision feature selection ──
      if (onFeatureClick) {
        const cityLayers = ["city-circles", "capital-star"];
        for (const layerId of cityLayers) {
          map.on("click", layerId, (e) => {
            const id = e.features?.[0]?.properties?._cityId;
            if (id) onFeatureClick({ kind: "city", id: String(id) });
          });
          map.on("mouseenter", layerId, () => {
            map.getCanvas().style.cursor = "pointer";
          });
          map.on("mouseleave", layerId, () => {
            map.getCanvas().style.cursor = "";
          });
        }

        if (showSubdivisions) {
          map.on("click", "subdivision-fill", (e) => {
            const id = e.features?.[0]?.properties?._subId;
            if (id) onFeatureClick({ kind: "subdivision", id: String(id) });
          });
          map.on("mouseenter", "subdivision-fill", () => {
            map.getCanvas().style.cursor = "pointer";
          });
          map.on("mouseleave", "subdivision-fill", () => {
            map.getCanvas().style.cursor = "";
          });
        }
      }

      state.setMapReady(true);
    });
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
    if (state.geometry) {
      // Small delay to ensure container has layout dimensions
      const timer = setTimeout(() => initMap(), 50);
      return () => {
        clearTimeout(timer);
        if (state.mapRef.current) {
          state.mapRef.current.remove();
          state.mapRef.current = null;
          state.setMapReady(false);
        }
      };
    }
    return () => {
      if (state.mapRef.current) {
        state.mapRef.current.remove();
        state.mapRef.current = null;
        state.setMapReady(false);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initMap, state.geometry]);
}
