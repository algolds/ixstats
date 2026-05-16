"use client";

/**
 * EditorMap - MapLibre map component for the country map editor.
 *
 * Renders the user's country focused with:
 * - Country boundary highlight
 * - Existing cities/POIs as markers
 * - Existing subdivisions as filled polygons
 * - Click handler for placing points (city/POI modes)
 * - Polygon draw mode for subdivisions
 * - Vertex editing mode for existing subdivision polygons
 */

import {
  useRef,
  useEffect,
  useCallback,
  useState,
  forwardRef,
  useImperativeHandle,
  memo,
} from "react";
import "maplibre-gl/dist/maplibre-gl.css";
import type { EditorMode, EditorFeature } from "~/hooks/useMapEditor";
import type { Polygon, MultiPolygon, Position, Feature, FeatureCollection, Geometry } from "geojson";
import type { GeoJSONSource } from "maplibre-gl";

// Helper to get a typed GeoJSON source from the map
function getGeoJSONSource(map: MapLibreMap | null, id: string): GeoJSONSource | undefined {
  if (!map) return;
  try {
    return map.getSource(id) as GeoJSONSource;
  } catch {
    return undefined;
  }
}

// Helper to safely extract coordinates from a feature's geometry
function getFeatureCoords(geometry: Geometry): Position | undefined {
  if (geometry.type === "Point") return geometry.coordinates;
  if (geometry.type === "MultiPoint") return geometry.coordinates[0];
  return undefined;
}
import {
  getVertices,
  getAllRings,
  moveVertex,
  addVertex,
  removeVertex,
  clampToGeometry,
  simplifyGeometry,
  snapToBorderEdge,
  snapToNeighborBorders,
  sanitizeRegionShape,
} from "~/lib/border-editor";
import type { VertexRef } from "~/lib/border-editor";
import {
  findNearestBorderRing,
  snapGeometryToBorder,
} from "~/lib/province-importer/alignment";
import { clipGeometryToBorder } from "~/lib/province-importer/topology";
import {
  MAP_DEFAULTS,
  OCEAN_COLOR,
  LAYER_CONFIGS,
  MAP_SYMBOL_FONTS,
} from "~/lib/map-config";
import { getMapGlyphsUrl } from "~/lib/base-path";

type MapLibreMap = import("maplibre-gl").Map;

export interface EditorMapRef {
  flyTo: (lng: number, lat: number, zoom?: number) => void;
  getMap: () => MapLibreMap | null;
}

interface EditorMapProps {
  /** Country boundary GeoJSON geometry */
  countryGeometry: object | null;
  /** Country centroid for initial view */
  countryCentroid: { lng: number; lat: number } | null;
  /** Country bounding box */
  countryBbox: { minLng: number; minLat: number; maxLng: number; maxLat: number } | null;
  /** Country fill color */
  countryColor?: string;
  /** Existing features to render */
  features: EditorFeature[];
  /** Currently active editing mode */
  mode: EditorMode;
  /** Pending click coordinate (shown as marker preview) */
  pendingCoordinates: [number, number] | null;
  /** Called when user clicks on the map */
  onMapClick: (lng: number, lat: number) => void;
  /** Called when user finishes drawing a polygon */
  onDrawComplete: (geometry: object) => void;
  /** Selected feature to highlight */
  selectedFeature: EditorFeature | null;
  /** Called when user hovers/clicks a feature on the map */
  onFeatureSelect?: (feature: EditorFeature | null) => void;
  /** Called when user finishes editing polygon vertices */
  onGeometryUpdate?: (featureId: string, geometry: object) => void;
  /** Background map layers (world map context) */
  worldMapLayers?: import("~/components/maps/core/IxWorldMap").MapLayerData[];
  /** Show coordinate grid lines */
  showGrid?: boolean;
  /** Called when map zoom changes */
  onZoomChange?: (zoom: number) => void;
  /** Paint mode: per-subdivision color map (id → hex color) */
  paintColors?: Record<string, string>;
  /** In-progress route waypoints for visual rendering */
  routeWaypoints?: [number, number][];
  /** Layer visibility state — controls which feature types are rendered */
  layerVisibility?: Record<string, boolean>;
}

const EMPTY_FC = { type: "FeatureCollection" as const, features: [] as Feature[] };

const SNAP_GUIDE_SOURCE = "editor-snap-guide";
const SNAP_GUIDE_LAYER = "editor-snap-guide-line";
const SNAP_GUIDE_POINT_LAYER = "editor-snap-guide-point";

/** Show/hide a snap guide line between drag origin and snap target */
function updateSnapGuide(
  map: MapLibreMap,
  from: Position | null,
  to: Position | null,
) {
  const fc: GeoJSON.FeatureCollection = {
    type: "FeatureCollection",
    features: from && to
      ? [
          {
            type: "Feature",
            geometry: { type: "LineString", coordinates: [from, to] },
            properties: {},
          },
          {
            type: "Feature",
            geometry: { type: "Point", coordinates: to },
            properties: {},
          },
        ]
      : [],
  };

  const source = map.getSource(SNAP_GUIDE_SOURCE);
  if (source && "setData" in source) {
    (source as GeoJSONSource).setData(fc);
  } else {
    map.addSource(SNAP_GUIDE_SOURCE, { type: "geojson", data: fc });
    map.addLayer({
      id: SNAP_GUIDE_LAYER,
      type: "line",
      source: SNAP_GUIDE_SOURCE,
      paint: {
        "line-color": "#06b6d4",
        "line-width": 1.5,
        "line-dasharray": [3, 3],
        "line-opacity": 0.8,
      },
    });
    map.addLayer({
      id: SNAP_GUIDE_POINT_LAYER,
      type: "circle",
      source: SNAP_GUIDE_SOURCE,
      filter: ["==", "$type", "Point"],
      paint: {
        "circle-radius": 5,
        "circle-color": "#06b6d4",
        "circle-stroke-color": "#ffffff",
        "circle-stroke-width": 1.5,
        "circle-opacity": 0.9,
      },
    });
  }
}

const EditorMap = memo(forwardRef<EditorMapRef, EditorMapProps>(
  function EditorMap(
    {
      countryGeometry,
      countryCentroid,
      countryBbox,
      countryColor,
      features,
      mode,
      pendingCoordinates,
      onMapClick,
      onDrawComplete,
      selectedFeature,
      onFeatureSelect,
      onGeometryUpdate,
      worldMapLayers,
      showGrid,
      onZoomChange,
      paintColors,
      routeWaypoints,
      layerVisibility,
    },
    ref
  ) {
    const containerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<MapLibreMap | null>(null);
    const [isLoaded, setIsLoaded] = useState(false);
    const drawVerticesRef = useRef<[number, number][]>([]);
    const modeRef = useRef(mode);
    modeRef.current = mode;
    const featuresRef = useRef(features);
    featuresRef.current = features;
    const onFeatureSelectRef = useRef(onFeatureSelect);
    onFeatureSelectRef.current = onFeatureSelect;
    const onGeometryUpdateRef = useRef(onGeometryUpdate);
    onGeometryUpdateRef.current = onGeometryUpdate;
    const countryGeometryRef = useRef(countryGeometry);
    countryGeometryRef.current = countryGeometry;

    // Vertex editing internal state
    const [isVertexEditing, setIsVertexEditing] = useState(false);
    const vertexEditRef = useRef<{
      featureId: string;
      currentGeometry: Polygon | MultiPolygon;
    } | null>(null);
    const draggingRef = useRef<VertexRef | null>(null);
    const hoveredVertexRef = useRef<VertexRef | null>(null);
    const lastMousePointRef = useRef<{ x: number; y: number } | null>(null);

    useImperativeHandle(ref, () => ({
      flyTo: (lng: number, lat: number, zoom = 6) => {
        mapRef.current?.flyTo({ center: [lng, lat], zoom, duration: 1000 });
      },
      getMap: () => mapRef.current,
    }));

    // ── Vertex edit visualization helpers ──

    const updateVertexEditVis = useCallback(() => {
      const map = mapRef.current;
      const state = vertexEditRef.current;
      if (!map || !state) return;

      const geo = state.currentGeometry;

      // Polygon fill + stroke
      const polyFc = {
        type: "FeatureCollection" as const,
        features: [{
          type: "Feature" as const,
          geometry: geo,
          properties: {},
        }],
      };
      getGeoJSONSource(map, "editor-vedit-polygon")?.setData(polyFc);

      // Vertices
      const verts = getVertices(geo);
      const vertFc = {
        type: "FeatureCollection" as const,
        features: verts.map((v) => ({
          type: "Feature" as const,
          geometry: { type: "Point" as const, coordinates: v.coord },
          properties: { ringIndex: v.ringIndex, vertexIndex: v.vertexIndex },
        })),
      };
      getGeoJSONSource(map, "editor-vedit-vertices")?.setData(vertFc);

      // Midpoints (for adding new vertices)
      const rings = getAllRings(geo);
      const midFeatures: any[] = [];
      for (let ri = 0; ri < rings.length; ri++) {
        const ring = rings[ri]!;
        const len = ring.length;
        for (let i = 0; i < len - 1; i++) {
          const a = ring[i]!;
          const b = ring[i + 1]!;
          midFeatures.push({
            type: "Feature",
            geometry: {
              type: "Point",
              coordinates: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2],
            },
            properties: { ringIndex: ri, startIndex: i },
          });
        }
      }
      getGeoJSONSource(map, "editor-vedit-midpoints")?.setData({
        type: "FeatureCollection",
        features: midFeatures,
      });
    }, []);

    const clearVertexEditVis = useCallback(() => {
      const map = mapRef.current;
      if (!map) return;
      getGeoJSONSource(map, "editor-vedit-polygon")?.setData(EMPTY_FC);
      getGeoJSONSource(map, "editor-vedit-vertices")?.setData(EMPTY_FC);
      getGeoJSONSource(map, "editor-vedit-midpoints")?.setData(EMPTY_FC);
    }, []);

    const finishVertexEdit = useCallback(() => {
      const state = vertexEditRef.current;
      if (state && onGeometryUpdateRef.current) {
        let finalGeo = state.currentGeometry;
        // Final conformance clip — ensure geometry fits within country border
        const border = countryGeometryRef.current as Polygon | MultiPolygon | null;
        if (border) {
          const { geometry } = clipGeometryToBorder(finalGeo, border);
          finalGeo = geometry as Polygon | MultiPolygon;
        }
        onGeometryUpdateRef.current(state.featureId, finalGeo);
      }
      vertexEditRef.current = null;
      setIsVertexEditing(false);
      clearVertexEditVis();
      // Reset subdivision filters
      const map = mapRef.current;
      if (map) {
        for (const lid of ["editor-subdivisions-fill", "editor-subdivisions-stroke", "editor-subdivisions-labels", "editor-subdivisions-hover"]) {
          if (map.getLayer(lid)) map.setFilter(lid, null);
        }
      }
    }, [clearVertexEditVis]);

    const handleSimplifyAndSave = useCallback(() => {
      const state = vertexEditRef.current;
      const border = countryGeometryRef.current as Polygon | MultiPolygon | null;
      if (!state || !border) return;

      // Step 0: Douglas-Peucker simplification to reduce vertex noise
      let geo = simplifyGeometry(state.currentGeometry, 0.002);

      // Step 1: Sanitize shape — remove spikes, self-intersections, degenerate vertices
      const { geometry: sanitized } = sanitizeRegionShape(geo, border);
      geo = sanitized;

      // Step 2: Clip geometry to country border (handles islands, overflow)
      const { geometry: clipped } = clipGeometryToBorder(geo, border);
      geo = clipped as Polygon | MultiPolygon;

      // Step 3: Snap to neighboring region borders to fill gaps
      const neighborGeometries: Array<{ id: string; geometry: Polygon | MultiPolygon }> = [];
      for (const feat of featuresRef.current) {
        if (
          feat.type === "subdivision" &&
          feat.id !== state.featureId &&
          feat.geometry
        ) {
          neighborGeometries.push({
            id: feat.id,
            geometry: feat.geometry as Polygon | MultiPolygon,
          });
        }
      }
      if (neighborGeometries.length > 0) {
        geo = snapToNeighborBorders(geo, neighborGeometries, border, 0.02);
      }

      // Step 4: Snap remaining vertices to country border ring
      const nearestRing = findNearestBorderRing(geo, border);
      const borderEdges: Array<[Position, Position]> = [];
      for (let i = 0; i < nearestRing.length - 1; i++) {
        borderEdges.push([nearestRing[i]!, nearestRing[i + 1]!]);
      }

      const snapped = snapGeometryToBorder(
        geo,
        borderEdges,
        nearestRing,
        2.0
      );
      state.currentGeometry = snapped as Polygon | MultiPolygon;
      updateVertexEditVis();

      // Auto-save the simplified geometry
      if (onGeometryUpdateRef.current) {
        onGeometryUpdateRef.current(state.featureId, state.currentGeometry);
      }
    }, [updateVertexEditVis]);

    const handleSave = useCallback(() => {
      const state = vertexEditRef.current;
      if (!state || !onGeometryUpdateRef.current) return;
      let finalGeo = state.currentGeometry;
      const border = countryGeometryRef.current as Polygon | MultiPolygon | null;
      if (border) {
        // Conformance clip before save
        const { geometry } = clipGeometryToBorder(finalGeo, border);
        finalGeo = geometry as Polygon | MultiPolygon;

        // Snap to neighbor borders to close gaps
        const neighborGeometries: Array<{ id: string; geometry: Polygon | MultiPolygon }> = [];
        for (const feat of featuresRef.current) {
          if (feat.type === "subdivision" && feat.id !== state.featureId && feat.geometry) {
            neighborGeometries.push({ id: feat.id, geometry: feat.geometry as Polygon | MultiPolygon });
          }
        }
        if (neighborGeometries.length > 0) {
          finalGeo = snapToNeighborBorders(finalGeo, neighborGeometries, border, 0.015);
        }

        state.currentGeometry = finalGeo as Polygon | MultiPolygon;
        updateVertexEditVis();
      }
      onGeometryUpdateRef.current(state.featureId, finalGeo);
    }, [updateVertexEditVis]);

    const cancelVertexEdit = useCallback(() => {
      vertexEditRef.current = null;
      setIsVertexEditing(false);
      clearVertexEditVis();
      const map = mapRef.current;
      if (map) {
        for (const lid of ["editor-subdivisions-fill", "editor-subdivisions-stroke", "editor-subdivisions-labels", "editor-subdivisions-hover"]) {
          if (map.getLayer(lid)) map.setFilter(lid, null);
        }
      }
    }, [clearVertexEditVis]);

    // ── Initialize map ──
    useEffect(() => {
      if (!containerRef.current || mapRef.current) return;
      let cancelled = false;

      async function initMap() {
        const mod = await import("maplibre-gl");
        const maplibregl = ("Map" in mod ? mod : (mod as Record<string, unknown>).default) as typeof mod;

        if (cancelled || !containerRef.current) return;

        const center: [number, number] = countryCentroid
          ? [countryCentroid.lng, countryCentroid.lat]
          : MAP_DEFAULTS.center;

        const map = new maplibregl.Map({
          container: containerRef.current,
          style: {
            version: 8,
            name: "IxEarth-Editor",
            glyphs: getMapGlyphsUrl(),
            sources: {},
            layers: [
              {
                id: "ocean-background",
                type: "background",
                paint: { "background-color": OCEAN_COLOR },
              },
            ],
          } as maplibregl.StyleSpecification,
          center,
          zoom: 4,
          minZoom: 1,
          maxZoom: 14,
          attributionControl: false,
        });

        // Zoom/compass control — single instance, compact position
        map.addControl(
          new maplibregl.NavigationControl({ showCompass: false, visualizePitch: false }),
          "top-right"
        );

        mapRef.current = map;

        map.on("load", () => {
          if (cancelled) return;
          setIsLoaded(true);
        });
      }

      initMap();

      return () => {
        cancelled = true;
        if (mapRef.current) {
          mapRef.current.remove();
          mapRef.current = null;
        }
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Fit to country bounds when loaded
    useEffect(() => {
      const map = mapRef.current;
      if (!map || !isLoaded) return;

      if (countryBbox) {
        map.fitBounds(
          [
            [countryBbox.minLng, countryBbox.minLat],
            [countryBbox.maxLng, countryBbox.maxLat],
          ],
          { padding: 60, duration: 1000 }
        );
      } else if (countryCentroid) {
        map.flyTo({ center: [countryCentroid.lng, countryCentroid.lat], zoom: 5, duration: 1000 });
      }
    }, [isLoaded, countryBbox, countryCentroid]);

    // Render world map context layers (altitudes, rivers, lakes) as background
    useEffect(() => {
      const map = mapRef.current;
      if (!map || !isLoaded || !worldMapLayers || worldMapLayers.length === 0) return;

      const sorted = [...worldMapLayers].sort(
        (a, b) => (LAYER_CONFIGS[a.type]?.zIndex ?? 0) - (LAYER_CONFIGS[b.type]?.zIndex ?? 0)
      );

      for (const layer of sorted) {
        // Skip political in editor — country border stroke is sufficient
        if (layer.type === "political") continue;

        const sourceId = `editor-ctx-${layer.type}`;
        const fillLayerId = `editor-ctx-fill-${layer.type}`;
        const strokeLayerId = `editor-ctx-stroke-${layer.type}`;
        const config = LAYER_CONFIGS[layer.type];
        if (!config) continue;

        try {
          // Add or update source — same pattern as IxWorldMap
          const existingSource = map.getSource(sourceId);
          if (existingSource) {
            (existingSource as GeoJSONSource).setData(layer.data as FeatureCollection);
          } else {
            map.addSource(sourceId, {
              type: "geojson",
              data: layer.data as FeatureCollection,
              generateId: true,
            });

            // Line-type layers (rivers)
            if (config.type === "line") {
              map.addLayer({
                id: fillLayerId,
                type: "line",
                source: sourceId,
                paint: {
                  "line-color": config.strokeColor ?? "#7cb5d2",
                  "line-width": ["interpolate", ["linear"], ["zoom"],
                  0, config.strokeWidth ?? 1,
                  6, (config.strokeWidth ?? 1) * 3,
                ] as [string, ...unknown[]],
                  "line-opacity": layer.visible ? 0.7 : 0,
                },
                layout: { "line-cap": "round", "line-join": "round" },
              });
            }

            // Fill-type layers (background, altitudes, lakes)
            if (config.type === "fill") {
              const fillPaint: Record<string, unknown> = {
                "fill-opacity": layer.visible ? config.fillOpacity : 0,
              };
              if (config.fillColor === "from-property") {
                fillPaint["fill-color"] = ["coalesce", ["get", "_fillColor"], "#e8e5da"];
              } else {
                fillPaint["fill-color"] = config.fillColor;
              }

              map.addLayer({
                id: fillLayerId,
                type: "fill",
                source: sourceId,
                paint: fillPaint as Record<string, unknown>,
              });

              if (config.strokeColor) {
                map.addLayer({
                  id: strokeLayerId,
                  type: "line",
                  source: sourceId,
                  paint: {
                    "line-color": config.strokeColor,
                    "line-width": config.strokeWidth ?? 1,
                    "line-opacity": layer.visible ? 0.8 : 0,
                  },
                });
              }
            }
          }

          // Update visibility via paint opacity — same as IxWorldMap
          if (config.type === "line") {
            if (map.getLayer(fillLayerId)) {
              map.setPaintProperty(fillLayerId, "line-opacity", layer.visible ? 0.7 : 0);
            }
          } else if (config.type === "fill") {
            if (map.getLayer(fillLayerId)) {
              map.setPaintProperty(fillLayerId, "fill-opacity", layer.visible ? config.fillOpacity : 0);
            }
            if (map.getLayer(strokeLayerId)) {
              map.setPaintProperty(strokeLayerId, "line-opacity", layer.visible ? 0.8 : 0);
            }
          }
        } catch (err) {
          console.warn(`[EditorMap] context layer ${layer.type} error:`, err);
        }
      }
    }, [isLoaded, worldMapLayers]);

    // Render country boundary
    useEffect(() => {
      const map = mapRef.current;
      if (!map || !isLoaded || !countryGeometry) return;

      const sourceId = "editor-country-boundary";
      const fillId = "editor-country-fill";
      const strokeId = "editor-country-stroke";

      const geojson = {
        type: "FeatureCollection" as const,
        features: [
          {
            type: "Feature" as const,
            geometry: countryGeometry,
            properties: {},
          },
        ],
      };

      if (map.getSource(sourceId)) {
        getGeoJSONSource(map, sourceId)?.setData(geojson);
      } else {
        map.addSource(sourceId, { type: "geojson", data: geojson });
        // Subtle brightening fill — makes the country stand out from the darkened non-player areas
        // while keeping altitude/topo fully visible underneath
        map.addLayer({
          id: fillId,
          type: "fill",
          source: sourceId,
          paint: {
            "fill-color": "#ffffff",
            "fill-opacity": 0.12,
          },
        });
        map.addLayer({
          id: strokeId,
          type: "line",
          source: sourceId,
          paint: {
            "line-color": "#10b981",
            "line-width": 2,
            "line-dasharray": [2, 2],
          },
        });

        // Non-player territory mask — grey overlay outside country border
        const maskSourceId = "editor-nonplayer-mask";
        const maskFillId = "editor-nonplayer-mask-fill";
        if (!map.getSource(maskSourceId)) {
          // Create world polygon with country cut out as a hole
          const geo = countryGeometry as Polygon | MultiPolygon;
          const worldOuter: Position[] = [[-180, -90], [180, -90], [180, 90], [-180, 90], [-180, -90]];
          const holes: Position[][] = geo.type === "Polygon"
            ? [geo.coordinates[0] as Position[]]
            : (geo.coordinates as Position[][][]).map(poly => poly[0] as Position[]);

          map.addSource(maskSourceId, {
            type: "geojson",
            data: {
              type: "Feature",
              geometry: { type: "Polygon", coordinates: [worldOuter, ...holes] },
              properties: {},
            },
          });
          map.addLayer({
            id: maskFillId,
            type: "fill",
            source: maskSourceId,
            paint: {
              "fill-color": "#0f172a",
              "fill-opacity": 0.4,
            },
          });
        }
      }
    }, [isLoaded, countryGeometry, countryColor]);

    // Track zoom for grid spacing updates
    const [gridZoomBucket, setGridZoomBucket] = useState(0);
    useEffect(() => {
      const map = mapRef.current;
      if (!map || !isLoaded) return;
      const updateBucket = () => {
        const z = map.getZoom();
        setGridZoomBucket(z < 4 ? 0 : z < 6 ? 1 : z < 8 ? 2 : 3);
      };
      updateBucket();
      map.on("zoomend", updateBucket);
      if (onZoomChange) {
        const reportZoom = () => onZoomChange(map.getZoom());
        map.on("zoomend", reportZoom);
        return () => { map.off("zoomend", updateBucket); map.off("zoomend", reportZoom); };
      }
      return () => { map.off("zoomend", updateBucket); };
    }, [isLoaded, onZoomChange]);

    // Coordinate grid overlay — focused on country bbox, rebuilds on zoom bucket change
    useEffect(() => {
      const map = mapRef.current;
      if (!map || !isLoaded) return;

      const gridSourceId = "editor-grid";
      const gridLayerId = "editor-grid-lines";
      const gridLabelId = "editor-grid-labels";

      if (!showGrid) {
        if (map.getLayer(gridLayerId)) map.setLayoutProperty(gridLayerId, "visibility", "none");
        if (map.getLayer(gridLabelId)) map.setLayoutProperty(gridLabelId, "visibility", "none");
        return;
      }

      // Use country bbox to focus the grid, with margin
      const bbox = countryBbox;
      const margin = 5;
      const minLng = bbox ? Math.floor((bbox.minLng - margin) / 5) * 5 : -180;
      const maxLng = bbox ? Math.ceil((bbox.maxLng + margin) / 5) * 5 : 180;
      const minLat = bbox ? Math.max(-85, Math.floor((bbox.minLat - margin) / 5) * 5) : -85;
      const maxLat = bbox ? Math.min(85, Math.ceil((bbox.maxLat + margin) / 5) * 5) : 85;

      const spacing = [10, 5, 1, 0.5][gridZoomBucket] ?? 5;

      const lines: GeoJSON.Feature[] = [];
      for (let lng = minLng; lng <= maxLng; lng += spacing) {
        lines.push({
          type: "Feature",
          geometry: { type: "LineString", coordinates: [[lng, minLat], [lng, maxLat]] },
          properties: { label: `${Math.abs(lng)}°${lng >= 0 ? "E" : "W"}` },
        });
      }
      for (let lat = minLat; lat <= maxLat; lat += spacing) {
        lines.push({
          type: "Feature",
          geometry: { type: "LineString", coordinates: [[minLng, lat], [maxLng, lat]] },
          properties: { label: `${Math.abs(lat)}°${lat >= 0 ? "N" : "S"}` },
        });
      }

      const gridFc: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: lines };

      if (map.getSource(gridSourceId)) {
        getGeoJSONSource(map, gridSourceId)?.setData(gridFc);
        if (map.getLayer(gridLayerId)) map.setLayoutProperty(gridLayerId, "visibility", "visible");
        if (map.getLayer(gridLabelId)) map.setLayoutProperty(gridLabelId, "visibility", "visible");
      } else {
        map.addSource(gridSourceId, { type: "geojson", data: gridFc });
        map.addLayer({
          id: gridLayerId,
          type: "line",
          source: gridSourceId,
          paint: {
            "line-color": "#64748b",
            "line-width": 0.8,
            "line-opacity": 0.4,
            "line-dasharray": [4, 4],
          },
        });
        // Grid labels at line endpoints
        map.addLayer({
          id: gridLabelId,
          type: "symbol",
          source: gridSourceId,
          layout: {
            "symbol-placement": "line",
            "text-field": ["get", "label"],
            "text-size": 9,
            "text-allow-overlap": false,
            "text-ignore-placement": false,
            "text-max-angle": 90,
            "text-offset": [0, -0.6],
            "text-font": [...MAP_SYMBOL_FONTS.regular],
          },
          paint: {
            "text-color": "#64748b",
            "text-opacity": 0.5,
            "text-halo-color": "#0f172a",
            "text-halo-width": 1,
          },
        });
      }
    }, [isLoaded, showGrid, gridZoomBucket, countryBbox]);

    // Render existing features (cities, subdivisions, POIs)
    useEffect(() => {
      const map = mapRef.current;
      if (!map || !isLoaded) return;

      // Filter features by layer visibility
      const lv = layerVisibility ?? {};
      const visibleFeatures = features.filter((f) => {
        if (f.type === "city" && lv.cities === false) return false;
        if (f.type === "poi" && lv.pois === false) return false;
        if (f.type === "storyPin" && lv.stories === false) return false;
        if (f.type === "mapLabel" && lv.labels === false) return false;
        if (f.type === "subdivision" && lv.regions === false) return false;
        return true;
      });

      // Cities + POIs as points
      const pointFeatures = visibleFeatures
        .filter((f) => f.coordinates)
        .map((f) => ({
          type: "Feature" as const,
          geometry: {
            type: "Point" as const,
            coordinates: f.coordinates!,
          },
          properties: {
            id: f.id,
            name: f.name,
            featureType: f.type,
            isCapital: f.properties.isNationalCapital ?? false,
          },
        }));

      const pointsGeoJson = { type: "FeatureCollection" as const, features: pointFeatures };

      if (map.getSource("editor-points")) {
        getGeoJSONSource(map, "editor-points")?.setData(pointsGeoJson);
      } else {
        map.addSource("editor-points", { type: "geojson", data: pointsGeoJson });
        map.addLayer({
          id: "editor-points-capital",
          type: "circle",
          source: "editor-points",
          filter: ["==", ["get", "isCapital"], true],
          paint: {
            "circle-radius": 7,
            "circle-color": "#f59e0b",
            "circle-stroke-color": "#ffffff",
            "circle-stroke-width": 2,
          },
        });
        map.addLayer({
          id: "editor-points-city",
          type: "circle",
          source: "editor-points",
          filter: ["all", ["==", ["get", "featureType"], "city"], ["!=", ["get", "isCapital"], true]],
          paint: {
            "circle-radius": 5,
            "circle-color": "#3b82f6",
            "circle-stroke-color": "#ffffff",
            "circle-stroke-width": 1.5,
          },
        });
        map.addLayer({
          id: "editor-points-poi",
          type: "circle",
          source: "editor-points",
          filter: ["==", ["get", "featureType"], "poi"],
          paint: {
            "circle-radius": 4,
            "circle-color": "#f59e0b",
            "circle-stroke-color": "#ffffff",
            "circle-stroke-width": 1,
          },
        });
        map.addLayer({
          id: "editor-points-labels",
          type: "symbol",
          source: "editor-points",
          layout: {
            "text-field": ["get", "name"],
            "text-size": 11,
            "text-offset": [0, 1.2],
            "text-anchor": "top",
            "text-allow-overlap": false,
            "text-font": [...MAP_SYMBOL_FONTS.regular],
          },
          paint: {
            "text-color": "#374151",
            "text-halo-color": "#ffffff",
            "text-halo-width": 1.5,
          },
        });
      }

      // Subdivisions as polygons
      const polyFeatures = visibleFeatures
        .filter((f) => f.geometry)
        .map((f) => ({
          type: "Feature" as const,
          geometry: f.geometry as Geometry,
          properties: { id: f.id, name: f.name, color: f.properties.color },
        }));

      const polysGeoJson = { type: "FeatureCollection" as const, features: polyFeatures };

      if (map.getSource("editor-subdivisions")) {
        getGeoJSONSource(map, "editor-subdivisions")?.setData(polysGeoJson);
      } else {
        map.addSource("editor-subdivisions", { type: "geojson", data: polysGeoJson });
        map.addLayer({
          id: "editor-subdivisions-fill",
          type: "fill",
          source: "editor-subdivisions",
          paint: {
            "fill-color": "transparent",
            "fill-opacity": 0,
          },
        });
        map.addLayer({
          id: "editor-subdivisions-stroke",
          type: "line",
          source: "editor-subdivisions",
          paint: {
            "line-color": "#7c3aed",
            "line-width": 1.5,
            "line-dasharray": [3, 2],
          },
        });
        map.addLayer({
          id: "editor-subdivisions-labels",
          type: "symbol",
          source: "editor-subdivisions",
          layout: {
            "text-field": ["get", "name"],
            "text-size": 11,
            "text-allow-overlap": false,
            "text-ignore-placement": false,
            "text-optional": true,
            "symbol-sort-key": 1,
            "text-font": [...MAP_SYMBOL_FONTS.regular],
          },
          paint: {
            "text-color": "#6d28d9",
            "text-halo-color": "#ffffff",
            "text-halo-width": 1.5,
          },
        });

        // Hover highlight layer for subdivisions
        map.addLayer({
          id: "editor-subdivisions-hover",
          type: "line",
          source: "editor-subdivisions",
          paint: {
            "line-color": "#2563eb",
            "line-width": 3,
          },
          filter: ["==", ["get", "id"], ""],
        });
      }
    }, [isLoaded, features, layerVisibility]);

    // Render pending marker
    useEffect(() => {
      const map = mapRef.current;
      if (!map || !isLoaded) return;

      const geojson = pendingCoordinates
        ? {
            type: "FeatureCollection" as const,
            features: [
              {
                type: "Feature" as const,
                geometry: { type: "Point" as const, coordinates: pendingCoordinates },
                properties: {},
              },
            ],
          }
        : EMPTY_FC;

      if (map.getSource("editor-pending-point")) {
        getGeoJSONSource(map, "editor-pending-point")?.setData(geojson);
      } else {
        map.addSource("editor-pending-point", { type: "geojson", data: geojson });
        map.addLayer({
          id: "editor-pending-point-layer",
          type: "circle",
          source: "editor-pending-point",
          paint: {
            "circle-radius": 8,
            "circle-color": "#10b981",
            "circle-stroke-color": "#ffffff",
            "circle-stroke-width": 2,
            "circle-opacity": 0.8,
          },
        });
      }
    }, [isLoaded, pendingCoordinates]);

    // ── Render in-progress route waypoints ──
    useEffect(() => {
      const map = mapRef.current;
      if (!map || !isLoaded) return;

      const lineGeoJson: GeoJSON.FeatureCollection = {
        type: "FeatureCollection",
        features:
          routeWaypoints && routeWaypoints.length >= 2
            ? [
                {
                  type: "Feature",
                  geometry: {
                    type: "LineString",
                    coordinates: routeWaypoints,
                  },
                  properties: {},
                },
              ]
            : [],
      };

      const pointGeoJson: GeoJSON.FeatureCollection = {
        type: "FeatureCollection",
        features:
          routeWaypoints
            ? routeWaypoints.map((wp) => ({
                type: "Feature" as const,
                geometry: { type: "Point" as const, coordinates: wp },
                properties: {},
              }))
            : [],
      };

      if (map.getSource("editor-route-line")) {
        getGeoJSONSource(map, "editor-route-line")?.setData(lineGeoJson);
      } else {
        map.addSource("editor-route-line", { type: "geojson", data: lineGeoJson });
        map.addLayer({
          id: "editor-route-line-layer",
          type: "line",
          source: "editor-route-line",
          paint: {
            "line-color": "#6366f1",
            "line-width": 3,
            "line-opacity": 0.9,
          },
        });
      }

      if (map.getSource("editor-route-points")) {
        getGeoJSONSource(map, "editor-route-points")?.setData(pointGeoJson);
      } else {
        map.addSource("editor-route-points", { type: "geojson", data: pointGeoJson });
        map.addLayer({
          id: "editor-route-points-layer",
          type: "circle",
          source: "editor-route-points",
          paint: {
            "circle-radius": 5,
            "circle-color": "#ffffff",
            "circle-stroke-color": "#6366f1",
            "circle-stroke-width": 2,
          },
        });
      }
    }, [isLoaded, routeWaypoints]);

    // Draw mode for subdivisions — simple click-to-draw polygon
    useEffect(() => {
      const map = mapRef.current;
      if (!map || !isLoaded) return;

      if (!map.getSource("editor-draw-polygon")) {
        map.addSource("editor-draw-polygon", {
          type: "geojson",
          data: EMPTY_FC,
        });
        map.addLayer({
          id: "editor-draw-polygon-fill",
          type: "fill",
          source: "editor-draw-polygon",
          paint: { "fill-color": "#10b981", "fill-opacity": 0.2 },
        });
        map.addLayer({
          id: "editor-draw-polygon-stroke",
          type: "line",
          source: "editor-draw-polygon",
          paint: { "line-color": "#10b981", "line-width": 2 },
        });
        map.addSource("editor-draw-vertices", {
          type: "geojson",
          data: EMPTY_FC,
        });
        map.addLayer({
          id: "editor-draw-vertices-layer",
          type: "circle",
          source: "editor-draw-vertices",
          paint: {
            "circle-radius": 5,
            "circle-color": "#10b981",
            "circle-stroke-color": "#ffffff",
            "circle-stroke-width": 2,
          },
        });
      }

      // ── Vertex editing sources/layers ──
      if (!map.getSource("editor-vedit-polygon")) {
        map.addSource("editor-vedit-polygon", { type: "geojson", data: EMPTY_FC });
        map.addLayer({
          id: "editor-vedit-polygon-fill",
          type: "fill",
          source: "editor-vedit-polygon",
          paint: { "fill-color": "#10b981", "fill-opacity": 0.15 },
        });
        map.addLayer({
          id: "editor-vedit-polygon-stroke",
          type: "line",
          source: "editor-vedit-polygon",
          paint: { "line-color": "#10b981", "line-width": 2.5 },
        });

        map.addSource("editor-vedit-midpoints", { type: "geojson", data: EMPTY_FC });
        map.addLayer({
          id: "editor-vedit-midpoints-layer",
          type: "circle",
          source: "editor-vedit-midpoints",
          paint: {
            "circle-radius": 4,
            "circle-color": "#10b981",
            "circle-opacity": 0.5,
            "circle-stroke-color": "#ffffff",
            "circle-stroke-width": 1,
          },
        });

        map.addSource("editor-vedit-vertices", { type: "geojson", data: EMPTY_FC });
        // Use larger vertex circles on touch devices for easier finger targeting
        const isTouchDevice = "ontouchstart" in window || navigator.maxTouchPoints > 0;
        map.addLayer({
          id: "editor-vedit-vertices-layer",
          type: "circle",
          source: "editor-vedit-vertices",
          paint: {
            "circle-radius": isTouchDevice ? 10 : 6,
            "circle-color": "#ffffff",
            "circle-stroke-color": "#10b981",
            "circle-stroke-width": isTouchDevice ? 3 : 2.5,
          },
        });
      }
    }, [isLoaded]);

    // Update draw polygon visualization
    const updateDrawVisualization = useCallback(() => {
      const map = mapRef.current;
      if (!map) return;

      const vertices = drawVerticesRef.current;

      const verticesGeoJson = {
        type: "FeatureCollection" as const,
        features: vertices.map((v) => ({
          type: "Feature" as const,
          geometry: { type: "Point" as const, coordinates: v },
          properties: {},
        })),
      };
      getGeoJSONSource(map, "editor-draw-vertices")?.setData(verticesGeoJson);

      if (vertices.length >= 3) {
        const polyGeoJson = {
          type: "FeatureCollection" as const,
          features: [
            {
              type: "Feature" as const,
              geometry: {
                type: "Polygon" as const,
                coordinates: [[...vertices, vertices[0]]],
              },
              properties: {},
            },
          ],
        };
        getGeoJSONSource(map, "editor-draw-polygon")?.setData(polyGeoJson);
      } else if (vertices.length >= 2) {
        const lineGeoJson = {
          type: "FeatureCollection" as const,
          features: [
            {
              type: "Feature" as const,
              geometry: {
                type: "LineString" as const,
                coordinates: vertices,
              },
              properties: {},
            },
          ],
        };
        getGeoJSONSource(map, "editor-draw-polygon")?.setData(lineGeoJson);
      } else {
        getGeoJSONSource(map, "editor-draw-polygon")?.setData(EMPTY_FC);
      }
    }, []);

    // Handle map clicks
    useEffect(() => {
      const map = mapRef.current;
      if (!map || !isLoaded) return;

      const onClick = (e: any) => {
        // Skip if vertex editing is active
        if (vertexEditRef.current) return;

        const currentMode = modeRef.current;

        if (currentMode === "add-city" || currentMode === "add-poi" || currentMode === "add-story-pin" || currentMode === "add-label" || currentMode === "add-route") {
          onMapClick(e.lngLat.lng, e.lngLat.lat);
        } else if (currentMode === "add-subdivision") {
          drawVerticesRef.current.push([e.lngLat.lng, e.lngLat.lat]);
          updateDrawVisualization();
        }
      };

      const onDblClick = (e: any) => {
        if (vertexEditRef.current) return;
        const currentMode = modeRef.current;
        if (currentMode === "add-subdivision" && drawVerticesRef.current.length >= 3) {
          e.preventDefault();
          const vertices = drawVerticesRef.current;
          let geometry: Polygon | MultiPolygon = {
            type: "Polygon" as const,
            coordinates: [[...vertices, vertices[0]]],
          };

          // Clip drawn polygon to country border
          const border = countryGeometryRef.current as Polygon | MultiPolygon | null;
          if (border) {
            const { geometry: clipped } = clipGeometryToBorder(geometry, border);
            geometry = clipped as Polygon | MultiPolygon;
          }

          onDrawComplete(geometry);
          drawVerticesRef.current = [];
          updateDrawVisualization();
        }
      };

      map.on("click", onClick);
      map.on("dblclick", onDblClick);

      return () => {
        map.off("click", onClick);
        map.off("dblclick", onDblClick);
      };
    }, [isLoaded, onMapClick, onDrawComplete, updateDrawVisualization]);

    // Keyboard: undo last draw vertex (Backspace/Delete/Ctrl+Z during polygon draw)
    useEffect(() => {
      const handler = (e: KeyboardEvent) => {
        if (modeRef.current !== "add-subdivision") return;
        if (vertexEditRef.current) return;
        const tag = (e.target as HTMLElement)?.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

        const isUndo =
          e.key === "Backspace" ||
          e.key === "Delete" ||
          (e.key === "z" && (e.ctrlKey || e.metaKey));

        if (isUndo && drawVerticesRef.current.length > 0) {
          e.preventDefault();
          drawVerticesRef.current.pop();
          updateDrawVisualization();
        }
      };
      window.addEventListener("keydown", handler);
      return () => window.removeEventListener("keydown", handler);
    }, [updateDrawVisualization]);

    // Keyboard: Delete/Backspace removes hovered vertex during vertex editing
    useEffect(() => {
      const handler = (e: KeyboardEvent) => {
        if (!vertexEditRef.current) return;
        const tag = (e.target as HTMLElement)?.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

        if (e.key === "Delete" || e.key === "Backspace") {
          e.preventDefault();
          // Try hoveredVertexRef first, then query features at last mouse position
          let target = hoveredVertexRef.current;
          if (!target && lastMousePointRef.current && mapRef.current) {
            const pt = lastMousePointRef.current;
            const bbox: [[number, number], [number, number]] = [
              [pt.x - 12, pt.y - 12],
              [pt.x + 12, pt.y + 12],
            ];
            const hits = mapRef.current.queryRenderedFeatures(bbox, {
              layers: ["editor-vedit-vertices-layer"],
            });
            if (hits.length > 0) {
              const f = hits[0]!;
              target = {
                ringIndex: f.properties!.ringIndex as number,
                vertexIndex: f.properties!.vertexIndex as number,
                coord: getFeatureCoords(f.geometry) as Position,
              };
            }
          }
          if (!target) return;
          const result = removeVertex(vertexEditRef.current.currentGeometry, target);
          if (result) {
            vertexEditRef.current.currentGeometry = result as Polygon | MultiPolygon;
            hoveredVertexRef.current = null;
            updateVertexEditVis();
          }
        }
      };
      window.addEventListener("keydown", handler);
      return () => window.removeEventListener("keydown", handler);
    }, [updateVertexEditVis]);

    // Update cursor based on mode
    useEffect(() => {
      const map = mapRef.current;
      if (!map || !isLoaded) return;

      if (mode === "view" || mode === "import-provinces" || mode === "edit-subdivision") {
        map.getCanvas().style.cursor = "";
      } else {
        map.getCanvas().style.cursor = "crosshair";
      }
    }, [mode, isLoaded]);

    // Hover highlight and click-to-select on features in view mode
    useEffect(() => {
      const map = mapRef.current;
      if (!map || !isLoaded) return;

      const interactiveLayers = [
        "editor-subdivisions-fill",
        "editor-points-capital",
        "editor-points-city",
        "editor-points-poi",
      ];

      const onMouseMove = (e: any) => {
        if ((modeRef.current !== "view" && modeRef.current !== "paint") || vertexEditRef.current) return;

        const hits = map.queryRenderedFeatures(e.point, { layers: interactiveLayers });
        if (hits.length > 0) {
          map.getCanvas().style.cursor = "pointer";
          const hitId = hits[0]!.properties?.id as string | undefined;
          if (map.getLayer("editor-subdivisions-hover") && hitId) {
            map.setFilter("editor-subdivisions-hover", ["==", ["get", "id"], hitId]);
          }
        } else {
          map.getCanvas().style.cursor = "";
          if (map.getLayer("editor-subdivisions-hover")) {
            map.setFilter("editor-subdivisions-hover", ["==", ["get", "id"], ""]);
          }
        }
      };

      const onMouseLeave = () => {
        if ((modeRef.current !== "view" && modeRef.current !== "paint") || vertexEditRef.current) return;
        map.getCanvas().style.cursor = "";
        if (map.getLayer("editor-subdivisions-hover")) {
          map.setFilter("editor-subdivisions-hover", ["==", ["get", "id"], ""]);
        }
      };

      const onClickFeature = (e: any) => {
        if ((modeRef.current !== "view" && modeRef.current !== "paint") || vertexEditRef.current) return;
        const hits = map.queryRenderedFeatures(e.point, { layers: interactiveLayers });
        if (hits.length > 0) {
          const hitId = hits[0]!.properties?.id as string | undefined;
          if (hitId && onFeatureSelectRef.current) {
            const match = featuresRef.current.find((f) => f.id === hitId);
            if (match) {
              onFeatureSelectRef.current(match);
              e.preventDefault?.();
            }
          }
        }
      };

      map.on("mousemove", onMouseMove);
      map.on("mouseleave", "editor-subdivisions-fill", onMouseLeave);
      map.on("click", onClickFeature);

      return () => {
        map.off("mousemove", onMouseMove);
        map.off("mouseleave", "editor-subdivisions-fill", onMouseLeave);
        map.off("click", onClickFeature);
      };
    }, [isLoaded]);

    // Highlight selected feature
    useEffect(() => {
      const map = mapRef.current;
      if (!map || !isLoaded) return;

      if (map.getLayer("editor-subdivisions-hover")) {
        if (selectedFeature && selectedFeature.geometry) {
          map.setFilter("editor-subdivisions-hover", ["==", ["get", "id"], selectedFeature.id]);
        } else if (!selectedFeature) {
          map.setFilter("editor-subdivisions-hover", ["==", ["get", "id"], ""]);
        }
      }
    }, [isLoaded, selectedFeature]);

    // ── Paint mode: update subdivision fill colors ──
    useEffect(() => {
      const map = mapRef.current;
      if (!map || !isLoaded || !map.getLayer("editor-subdivisions-fill")) return;

      if (paintColors && Object.keys(paintColors).length > 0) {
        // Build a match expression: ["match", ["get", "id"], id1, color1, id2, color2, ..., fallback]
        const matchExpr: any[] = ["match", ["get", "id"]];
        for (const [id, color] of Object.entries(paintColors)) {
          matchExpr.push(id, color);
        }
        matchExpr.push("transparent"); // fallback
        map.setPaintProperty("editor-subdivisions-fill", "fill-color", matchExpr);
        map.setPaintProperty("editor-subdivisions-fill", "fill-opacity", 0.5);
      } else {
        // Reset to transparent when paint mode is off
        map.setPaintProperty("editor-subdivisions-fill", "fill-color", "transparent");
        map.setPaintProperty("editor-subdivisions-fill", "fill-opacity", 0);
      }
    }, [isLoaded, paintColors]);

    // ── Enter/exit vertex editing when mode === "edit-subdivision" ──
    useEffect(() => {
      const map = mapRef.current;
      if (!map || !isLoaded) return;

      if (mode === "edit-subdivision" && selectedFeature?.geometry) {
        let geo = JSON.parse(JSON.stringify(selectedFeature.geometry)) as Polygon | MultiPolygon;

        // Auto-conform: clip + snap if geometry extends beyond border
        const border = countryGeometryRef.current as Polygon | MultiPolygon | null;
        if (border) {
          const { geometry: clipped, wasClipped } = clipGeometryToBorder(geo, border);
          if (wasClipped) {
            geo = clipped as Polygon | MultiPolygon;
          }
          // Always snap vertices near border for clean alignment
          const nearestRing = findNearestBorderRing(geo, border);
          const edges: Array<[Position, Position]> = [];
          for (let i = 0; i < nearestRing.length - 1; i++) {
            edges.push([nearestRing[i]!, nearestRing[i + 1]!]);
          }
          geo = snapGeometryToBorder(geo, edges, nearestRing, 2.0) as Polygon | MultiPolygon;
        }

        vertexEditRef.current = {
          featureId: selectedFeature.id,
          currentGeometry: geo,
        };
        setIsVertexEditing(true);
        updateVertexEditVis();

        // Hide the editing feature from the normal layer
        for (const lid of ["editor-subdivisions-fill", "editor-subdivisions-stroke", "editor-subdivisions-labels", "editor-subdivisions-hover"]) {
          if (map.getLayer(lid)) map.setFilter(lid, ["!=", ["get", "id"], selectedFeature.id]);
        }
      } else if (vertexEditRef.current) {
        // Exiting vertex edit mode without explicit finish — cancel
        cancelVertexEdit();
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [mode, selectedFeature, isLoaded]);

    // ── Vertex drag interaction ──
    useEffect(() => {
      const map = mapRef.current;
      if (!map || !isLoaded) return;

      const onVertexMouseDown = (e: any) => {
        if (!vertexEditRef.current) return;
        e.preventDefault();
        const f = e.features?.[0];
        if (!f) return;

        const ri = f.properties.ringIndex as number;
        const vi = f.properties.vertexIndex as number;
        const coord = getFeatureCoords(f.geometry) as Position;
        draggingRef.current = { ringIndex: ri, vertexIndex: vi, coord };
        map.dragPan.disable();
        map.getCanvas().style.cursor = "grabbing";
      };

      const onMidpointClick = (e: any) => {
        if (!vertexEditRef.current) return;
        e.preventDefault();
        const f = e.features?.[0];
        if (!f) return;

        const ri = f.properties.ringIndex as number;
        const si = f.properties.startIndex as number;
        const midCoord = getFeatureCoords(f.geometry) as Position;

        const rings = getAllRings(vertexEditRef.current.currentGeometry);
        const ring = rings[ri];
        if (!ring) return;
        const ei = (si + 1) % ring.length;

        const newGeo = addVertex(
          vertexEditRef.current.currentGeometry,
          { ringIndex: ri, startIndex: si, endIndex: ei, midpoint: midCoord },
          midCoord
        );
        vertexEditRef.current.currentGeometry = newGeo as Polygon | MultiPolygon;
        updateVertexEditVis();
      };

      const onMouseMove = (e: any) => {
        // Always track mouse position for keyboard vertex deletion
        lastMousePointRef.current = { x: e.point.x, y: e.point.y };

        if (!draggingRef.current || !vertexEditRef.current) return;
        const lngLat = e.lngLat;
        let target: Position = [lngLat.lng, lngLat.lat];

        // Clamp vertex within country border
        const border = countryGeometryRef.current as Polygon | MultiPolygon | null;
        if (border) {
          target = clampToGeometry(target, border);
          // Magnetic snap to country border edge
          target = snapToBorderEdge(target, border, 0.015);
        }

        // Magnetic snap to other subdivision borders (higher tolerance for gap prevention)
        const editingId = vertexEditRef.current.featureId;
        for (const feat of featuresRef.current) {
          if (feat.type !== "subdivision" || feat.id === editingId || !feat.geometry) continue;
          const snapped = snapToBorderEdge(target, feat.geometry as Polygon | MultiPolygon, 0.02);
          if (snapped !== target) {
            target = snapped;
            break;
          }
        }

        // Show snap guide line from original position to snap target
        const origTarget: Position = [lngLat.lng, lngLat.lat];
        const didSnap = target[0] !== origTarget[0] || target[1] !== origTarget[1];
        updateSnapGuide(map, didSnap ? origTarget : null, didSnap ? target : null);

        const newGeo = moveVertex(
          vertexEditRef.current.currentGeometry,
          draggingRef.current,
          target
        );
        vertexEditRef.current.currentGeometry = newGeo as Polygon | MultiPolygon;
        updateVertexEditVis();
      };

      const onMouseUp = () => {
        if (!draggingRef.current) return;
        draggingRef.current = null;
        map.dragPan.enable();
        map.getCanvas().style.cursor = "";
        // Clear snap guide
        updateSnapGuide(map, null, null);
      };

      const onContextMenu = (e: any) => {
        if (!vertexEditRef.current) return;
        // Check if right-click is on or near a vertex (generous bbox for hit detection)
        const bbox: [any, any] = [
          [e.point.x - 10, e.point.y - 10],
          [e.point.x + 10, e.point.y + 10],
        ];
        const hits = map.queryRenderedFeatures(bbox, { layers: ["editor-vedit-vertices-layer"] });
        if (hits.length === 0) return;

        e.preventDefault();
        if (e.originalEvent) e.originalEvent.preventDefault();
        const f = hits[0]!;
        const ri = f.properties!.ringIndex as number;
        const vi = f.properties!.vertexIndex as number;
        const coord = getFeatureCoords(f.geometry) as Position;

        const result = removeVertex(
          vertexEditRef.current.currentGeometry,
          { ringIndex: ri, vertexIndex: vi, coord }
        );
        if (result) {
          vertexEditRef.current.currentGeometry = result as Polygon | MultiPolygon;
          hoveredVertexRef.current = null;
          updateVertexEditVis();
        }
      };

      const onVertexEnter = (e: any) => {
        if (vertexEditRef.current && !draggingRef.current) {
          map.getCanvas().style.cursor = "grab";
          const f = e.features?.[0];
          if (f) {
            hoveredVertexRef.current = {
              ringIndex: f.properties.ringIndex as number,
              vertexIndex: f.properties.vertexIndex as number,
              coord: getFeatureCoords(f.geometry) as Position,
            };
          }
        }
      };

      const onVertexLeave = () => {
        if (vertexEditRef.current && !draggingRef.current) {
          map.getCanvas().style.cursor = "";
          hoveredVertexRef.current = null;
        }
      };

      const onMidpointEnter = () => {
        if (vertexEditRef.current) {
          map.getCanvas().style.cursor = "copy";
        }
      };

      const onMidpointLeave = () => {
        if (vertexEditRef.current && !draggingRef.current) {
          map.getCanvas().style.cursor = "";
        }
      };

      // Canvas-level right-click handler (more reliable than MapLibre contextmenu)
      const canvas = map.getCanvas();
      const onCanvasContextMenu = (ev: MouseEvent) => {
        if (!vertexEditRef.current) return;
        const rect = canvas.getBoundingClientRect();
        const x = ev.clientX - rect.left;
        const y = ev.clientY - rect.top;
        const bbox: [[number, number], [number, number]] = [
          [x - 12, y - 12],
          [x + 12, y + 12],
        ];
        const hits = map.queryRenderedFeatures(bbox, { layers: ["editor-vedit-vertices-layer"] });
        if (hits.length === 0) return;

        ev.preventDefault();
        ev.stopPropagation();
        const f = hits[0]!;
        const ri = f.properties!.ringIndex as number;
        const vi = f.properties!.vertexIndex as number;
        const coord = getFeatureCoords(f.geometry) as Position;

        const result = removeVertex(
          vertexEditRef.current.currentGeometry,
          { ringIndex: ri, vertexIndex: vi, coord }
        );
        if (result) {
          vertexEditRef.current.currentGeometry = result as Polygon | MultiPolygon;
          hoveredVertexRef.current = null;
          updateVertexEditVis();
        }
      };

      // ── Touch support for vertex editing ──
      // Long-press on a vertex to delete it (replaces right-click on mobile)
      let longPressTimer: ReturnType<typeof setTimeout> | null = null;
      let touchStartPoint: { x: number; y: number } | null = null;

      const onTouchStart = (e: TouchEvent) => {
        if (!vertexEditRef.current) return;
        const touch = e.touches[0];
        if (!touch) return;
        const rect = canvas.getBoundingClientRect();
        const x = touch.clientX - rect.left;
        const y = touch.clientY - rect.top;
        touchStartPoint = { x, y };

        // Check if touching a vertex (larger bbox for fat fingers)
        const bbox: [[number, number], [number, number]] = [
          [x - 20, y - 20],
          [x + 20, y + 20],
        ];
        const hits = map.queryRenderedFeatures(bbox, {
          layers: ["editor-vedit-vertices-layer"],
        });

        if (hits.length > 0) {
          // Start drag immediately + set up long-press for deletion
          const f = hits[0]!;
          const ri = f.properties!.ringIndex as number;
          const vi = f.properties!.vertexIndex as number;
          const coord = getFeatureCoords(f.geometry) as Position;
          draggingRef.current = { ringIndex: ri, vertexIndex: vi, coord };
          map.dragPan.disable();

          longPressTimer = setTimeout(() => {
            // Long-press (500ms) → delete vertex
            if (!vertexEditRef.current) return;
            draggingRef.current = null;
            map.dragPan.enable();
            const result = removeVertex(
              vertexEditRef.current.currentGeometry,
              { ringIndex: ri, vertexIndex: vi, coord }
            );
            if (result) {
              vertexEditRef.current.currentGeometry = result as Polygon | MultiPolygon;
              hoveredVertexRef.current = null;
              updateVertexEditVis();
            }
          }, 500);
        }
      };

      const onTouchMove = (e: TouchEvent) => {
        if (!draggingRef.current || !vertexEditRef.current) return;
        const touch = e.touches[0];
        if (!touch) return;

        // Cancel long-press if finger moved (drag, not hold)
        if (longPressTimer && touchStartPoint) {
          const rect = canvas.getBoundingClientRect();
          const dx = touch.clientX - rect.left - touchStartPoint.x;
          const dy = touch.clientY - rect.top - touchStartPoint.y;
          if (Math.sqrt(dx * dx + dy * dy) > 8) {
            clearTimeout(longPressTimer);
            longPressTimer = null;
          }
        }

        // Convert touch to map coordinates and move vertex
        const lngLat = map.unproject([
          touch.clientX - canvas.getBoundingClientRect().left,
          touch.clientY - canvas.getBoundingClientRect().top,
        ]);
        let target: Position = [lngLat.lng, lngLat.lat];

        const border = countryGeometryRef.current as Polygon | MultiPolygon | null;
        if (border) {
          target = clampToGeometry(target, border);
          target = snapToBorderEdge(target, border, 0.015);
        }

        const editingId = vertexEditRef.current.featureId;
        for (const feat of featuresRef.current) {
          if (feat.type !== "subdivision" || feat.id === editingId || !feat.geometry) continue;
          const snapped = snapToBorderEdge(target, feat.geometry as Polygon | MultiPolygon, 0.01);
          if (snapped !== target) {
            target = snapped;
            break;
          }
        }

        const newGeo = moveVertex(
          vertexEditRef.current.currentGeometry,
          draggingRef.current,
          target
        );
        vertexEditRef.current.currentGeometry = newGeo as Polygon | MultiPolygon;
        updateVertexEditVis();
        e.preventDefault();
      };

      const onTouchEnd = () => {
        if (longPressTimer) {
          clearTimeout(longPressTimer);
          longPressTimer = null;
        }
        touchStartPoint = null;
        if (draggingRef.current) {
          draggingRef.current = null;
          map.dragPan.enable();
        }
      };

      // Bind mouse events
      map.on("mousedown", "editor-vedit-vertices-layer", onVertexMouseDown);
      map.on("click", "editor-vedit-midpoints-layer", onMidpointClick);
      map.on("mousemove", onMouseMove);
      map.on("mouseup", onMouseUp);
      map.on("contextmenu", onContextMenu);
      canvas.addEventListener("contextmenu", onCanvasContextMenu);
      map.on("mouseenter", "editor-vedit-vertices-layer", onVertexEnter);
      map.on("mouseleave", "editor-vedit-vertices-layer", onVertexLeave);
      map.on("mouseenter", "editor-vedit-midpoints-layer", onMidpointEnter);
      map.on("mouseleave", "editor-vedit-midpoints-layer", onMidpointLeave);

      // Bind touch events
      canvas.addEventListener("touchstart", onTouchStart, { passive: false });
      canvas.addEventListener("touchmove", onTouchMove, { passive: false });
      canvas.addEventListener("touchend", onTouchEnd);

      return () => {
        if (longPressTimer) clearTimeout(longPressTimer);
        map.off("mousedown", "editor-vedit-vertices-layer", onVertexMouseDown);
        map.off("click", "editor-vedit-midpoints-layer", onMidpointClick);
        map.off("mousemove", onMouseMove);
        map.off("mouseup", onMouseUp);
        map.off("contextmenu", onContextMenu);
        canvas.removeEventListener("contextmenu", onCanvasContextMenu);
        map.off("mouseenter", "editor-vedit-vertices-layer", onVertexEnter);
        map.off("mouseleave", "editor-vedit-vertices-layer", onVertexLeave);
        map.off("mouseenter", "editor-vedit-midpoints-layer", onMidpointEnter);
        map.off("mouseleave", "editor-vedit-midpoints-layer", onMidpointLeave);
        canvas.removeEventListener("touchstart", onTouchStart);
        canvas.removeEventListener("touchmove", onTouchMove);
        canvas.removeEventListener("touchend", onTouchEnd);
      };
    }, [isLoaded, updateVertexEditVis]);

    // Clear draw state when mode changes away from subdivision
    useEffect(() => {
      if (mode !== "add-subdivision") {
        drawVerticesRef.current = [];
        updateDrawVisualization();
      }
    }, [mode, updateDrawVisualization]);

    return (
      <div className="relative h-full w-full" style={{ minHeight: 400 }}>
        <div
          ref={containerRef}
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
        />
        {!isLoaded && (
          <div className="absolute inset-0 flex items-center justify-center bg-muted">
            <div className="flex flex-col items-center gap-3">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-muted-foreground/20 border-t-emerald-500" />
              <p className="text-sm text-muted-foreground">Loading map editor...</p>
            </div>
          </div>
        )}

        {/* Vertex editing controls */}
        {isVertexEditing && (
          <div className="absolute bottom-3 left-1/2 z-20 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-card/95 p-1 shadow-lg ring-1 ring-border backdrop-blur-sm">
            <span className="hidden px-2 text-[11px] text-muted-foreground sm:inline">
              Drag vertices · Midpoints to add · Right-click to remove
            </span>
            <div className="hidden h-4 w-px bg-border sm:block" />
            <button
              onClick={handleSimplifyAndSave}
              className="flex items-center gap-1.5 rounded-full bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700"
              title="Simplify vertices, snap to country border, and save"
            >
              <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 20L8 4" />
                <path d="M20 20L16 4" />
                <path d="M6 12h12" />
              </svg>
              <span className="hidden sm:inline">Simplify</span>
            </button>
            <button
              onClick={handleSave}
              className="rounded-full bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
              title="Save current geometry"
            >
              Save
            </button>
            <button
              onClick={finishVertexEdit}
              className="rounded-full bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700"
            >
              Done
            </button>
            <button
              onClick={cancelVertexEdit}
              className="rounded-full px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              Cancel
            </button>
          </div>
        )}

        {/* Mode hint pill */}
        {!isVertexEditing && mode !== "view" && mode !== "import-provinces" && mode !== "edit-subdivision" && (
          <div className="absolute bottom-3 left-1/2 z-10 -translate-x-1/2 rounded-full bg-card/95 px-3 py-1 text-[11px] text-muted-foreground shadow-md ring-1 ring-border backdrop-blur-sm">
            {mode === "add-city" && "Click map to place city"}
            {mode === "add-subdivision" && (
              drawVerticesRef.current.length >= 3
                ? "Double-click to finish polygon"
                : "Click to add polygon vertices"
            )}
            {mode === "add-poi" && "Click map to place POI"}
          </div>
        )}
      </div>
    );
  }
));

export default EditorMap;
