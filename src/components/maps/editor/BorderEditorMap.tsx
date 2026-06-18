// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
"use client";

import React, { useRef, useEffect, useCallback, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { Position, Polygon, MultiPolygon, Feature, FeatureCollection } from "geojson";
import type { VertexRef } from "~/lib/border-editor";
import { getVertices, getAllRings } from "~/lib/border-editor";
import { useMapLayers } from "~/components/maps/editor/hooks/useMapLayers";

interface BorderEditorMapProps {
  geometry: Polygon | MultiPolygon | null;
  neighborGeometries?: Array<{ featureId: string; geometry: unknown }>;
  mode: string;
  splitLine: Position[];
  mergeTargets: string[];
  selectedVertex: VertexRef | null;
  onMapClick: (lng: number, lat: number) => void;
  onVertexDrag: (ref: VertexRef, to: Position) => void;
  onDragEnd?: () => void;
  center?: [number, number];
  zoom?: number;
  worldMapLayers?: import("~/components/maps/core/IxWorldMap").MapLayerData[];
  brushRadius?: number;
  brushTargetId?: string | null;
  onBrushStroke?: (
    strokePoints: [number, number][],
    radiusKm: number,
    targetFeatureId: string
  ) => boolean;
  traceStart?: [number, number] | null;
}

const EMPTY_FC: FeatureCollection = { type: "FeatureCollection", features: [] };

function getCircleCoords(center: [number, number], radiusKm: number): number[][] {
  const coords: number[][] = [];
  const steps = 64;
  const kmPerDegreeLng = 111.32 * Math.cos((center[1] * Math.PI) / 180);
  const kmPerDegreeLat = 110.574;

  for (let i = 0; i <= steps; i++) {
    const angle = (i * 2 * Math.PI) / steps;
    const dx = radiusKm * Math.cos(angle);
    const dy = radiusKm * Math.sin(angle);
    const lng = center[0] + dx / kmPerDegreeLng;
    const lat = center[1] + dy / kmPerDegreeLat;
    coords.push([lng, lat]);
  }
  return coords;
}

export const BorderEditorMap = React.memo(function BorderEditorMap({
  geometry,
  neighborGeometries,
  mode,
  splitLine,
  mergeTargets,
  selectedVertex,
  onMapClick,
  onVertexDrag,
  onDragEnd,
  center = [0, 20],
  zoom = 3,
  worldMapLayers,
  brushRadius = 20,
  brushTargetId = null,
  onBrushStroke,
  traceStart = null,
}: BorderEditorMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const draggingVertex = useRef<VertexRef | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  // Brush stroke state
  const isBrushing = useRef(false);
  const brushStrokePoints = useRef<[number, number][]>([]);

  // Keep mode, brush params, and callbacks in refs so event handlers always see current values
  const modeRef = useRef(mode);
  modeRef.current = mode;
  const brushRadiusRef = useRef(brushRadius);
  brushRadiusRef.current = brushRadius;
  const brushTargetIdRef = useRef(brushTargetId);
  brushTargetIdRef.current = brushTargetId;
  const onBrushStrokeRef = useRef(onBrushStroke);
  onBrushStrokeRef.current = onBrushStroke;
  const onDragEndRef = useRef(onDragEnd);
  onDragEndRef.current = onDragEnd;
  const sourcesReady = useRef(false);

  // Initialize map context layers
  useMapLayers({
    map: mapRef.current,
    isLoaded,
    countryGeometry: null,
    countryBbox: null,
    features: [],
    layerVisibility: {
      rivers: true,
      lakes: true,
      altitudes: true,
      regions: false,
      cities: false,
      pois: false,
      stories: false,
      labels: false,
      routes: false,
    },
    pendingCoordinates: null,
    worldMapLayers,
    gridZoomBucket: 0,
  });

  // Initialize map
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: {
        version: 8,
        sources: {},
        layers: [
          {
            id: "background",
            type: "background",
            paint: { "background-color": "#0a1628" },
          },
        ],
      },
      center,
      zoom,
      projection: { type: "mercator" } as any,
    });

    map.on("load", () => {
      sourcesReady.current = true;
      setIsLoaded(true);

      // Neighbor features (light gray)
      map.addSource("neighbors", { type: "geojson", data: EMPTY_FC });
      map.addLayer({
        id: "neighbors-fill",
        type: "fill",
        source: "neighbors",
        paint: { "fill-color": "#4a5568", "fill-opacity": 0.3 },
      });
      map.addLayer({
        id: "neighbors-line",
        type: "line",
        source: "neighbors",
        paint: { "line-color": "#718096", "line-width": 0.5 },
      });

      // Merge targets (highlighted)
      map.addSource("merge-targets", { type: "geojson", data: EMPTY_FC });
      map.addLayer({
        id: "merge-targets-fill",
        type: "fill",
        source: "merge-targets",
        paint: { "fill-color": "#4299e1", "fill-opacity": 0.3 },
      });

      // Active feature (the one being edited)
      map.addSource("active-feature", { type: "geojson", data: EMPTY_FC });
      map.addLayer({
        id: "active-fill",
        type: "fill",
        source: "active-feature",
        paint: { "fill-color": "#48bb78", "fill-opacity": 0.25 },
      });
      map.addLayer({
        id: "active-line",
        type: "line",
        source: "active-feature",
        paint: { "line-color": "#48bb78", "line-width": 2 },
      });

      // Vertices
      map.addSource("vertices", { type: "geojson", data: EMPTY_FC });
      map.addLayer({
        id: "vertices-circles",
        type: "circle",
        source: "vertices",
        paint: {
          "circle-radius": ["case", ["==", ["get", "selected"], true], 7, 4],
          "circle-color": ["case", ["==", ["get", "selected"], true], "#f6e05e", "#fff"],
          "circle-stroke-color": "#000",
          "circle-stroke-width": 1,
        },
      });

      // Edge midpoints (for adding vertices)
      map.addSource("midpoints", { type: "geojson", data: EMPTY_FC });
      map.addLayer({
        id: "midpoints-circles",
        type: "circle",
        source: "midpoints",
        paint: {
          "circle-radius": 3,
          "circle-color": "#a0aec0",
          "circle-stroke-color": "#000",
          "circle-stroke-width": 0.5,
          "circle-opacity": 0.6,
        },
      });

      // Split line
      map.addSource("split-line", { type: "geojson", data: EMPTY_FC });
      map.addLayer({
        id: "split-line-layer",
        type: "line",
        source: "split-line",
        paint: {
          "line-color": "#f56565",
          "line-width": 2,
          "line-dasharray": [4, 2],
        },
      });
      map.addLayer({
        id: "split-points",
        type: "circle",
        source: "split-line",
        filter: ["==", "$type", "Point"],
        paint: {
          "circle-radius": 5,
          "circle-color": "#f56565",
          "circle-stroke-color": "#fff",
          "circle-stroke-width": 1,
        },
      });

      // Trace start point layer
      map.addSource("trace-start", { type: "geojson", data: EMPTY_FC });
      map.addLayer({
        id: "trace-start-circle",
        type: "circle",
        source: "trace-start",
        paint: {
          "circle-radius": 7,
          "circle-color": "#3b82f6",
          "circle-stroke-color": "#fff",
          "circle-stroke-width": 1.5,
        },
      });

      // Brush cursor source and layers
      map.addSource("brush-cursor", { type: "geojson", data: EMPTY_FC });
      map.addLayer({
        id: "brush-cursor-layer",
        type: "line",
        source: "brush-cursor",
        paint: {
          "line-color": "#a855f7",
          "line-width": 1.5,
          "line-dasharray": [2, 2],
        },
      });
      map.addLayer({
        id: "brush-cursor-fill",
        type: "fill",
        source: "brush-cursor",
        paint: {
          "fill-color": "#a855f7",
          "fill-opacity": 0.1,
        },
      });
    });

    map.on("click", (e) => {
      if (modeRef.current === "brush") return;
      onMapClick(e.lngLat.lng, e.lngLat.lat);
    });

    // Vertex dragging
    map.on("mousedown", "vertices-circles", (e) => {
      if (modeRef.current !== "vertex_edit") return;
      e.preventDefault();
      const feat = e.features?.[0];
      if (!feat?.properties) return;
      draggingVertex.current = {
        ringIndex: feat.properties.ringIndex as number,
        vertexIndex: feat.properties.vertexIndex as number,
        coord: [e.lngLat.lng, e.lngLat.lat],
      };
      map.getCanvas().style.cursor = "grabbing";
    });

    map.on("mousedown", (e) => {
      if (modeRef.current === "brush" && brushTargetIdRef.current) {
        isBrushing.current = true;
        brushStrokePoints.current = [[e.lngLat.lng, e.lngLat.lat]];
        map.dragPan.disable();
      }
    });

    map.on("mousemove", (e) => {
      if (draggingVertex.current) {
        let to: Position = [e.lngLat.lng, e.lngLat.lat];

        // Magnetic snap: Snap to nearest vertex of any neighbor geometry within a small tolerance
        if (neighborGeometries && neighborGeometries.length > 0) {
          const snapTolerance = 0.05; // Snapping tolerance in degrees (~5.5km at equator, fits precision)
          let bestSnapDist = Infinity;
          let bestSnapPos: Position | null = null;

          for (const neighbor of neighborGeometries) {
            const geom = neighbor.geometry as Polygon | MultiPolygon;
            if (!geom) continue;
            const rings = geom.type === "Polygon" ? geom.coordinates : geom.coordinates.flat();
            for (const ring of rings) {
              for (const coord of ring) {
                const dx = coord[0] - to[0];
                const dy = coord[1] - to[1];
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < snapTolerance && dist < bestSnapDist) {
                  bestSnapDist = dist;
                  bestSnapPos = [...coord];
                }
              }
            }
          }
          if (bestSnapPos) {
            to = bestSnapPos;
          }
        }

        onVertexDrag(draggingVertex.current, to);
      }

      if (modeRef.current === "brush") {
        map.getCanvas().style.cursor = "crosshair";
        const center: [number, number] = [e.lngLat.lng, e.lngLat.lat];
        const circleCoords = getCircleCoords(center, brushRadiusRef.current);
        const circleFC: FeatureCollection = {
          type: "FeatureCollection",
          features: [
            {
              type: "Feature",
              geometry: {
                type: "Polygon",
                coordinates: [circleCoords],
              },
              properties: {},
            },
          ],
        };
        safeSetData("brush-cursor", circleFC);

        if (isBrushing.current && brushTargetIdRef.current) {
          brushStrokePoints.current.push(center);
        }
      } else {
        if (!draggingVertex.current) {
          map.getCanvas().style.cursor = "";
        }
      }
    });

    const finishBrushing = () => {
      if (isBrushing.current) {
        isBrushing.current = false;
        map.dragPan.enable();
        if (
          brushStrokePoints.current.length > 0 &&
          onBrushStrokeRef.current &&
          brushTargetIdRef.current
        ) {
          onBrushStrokeRef.current(
            brushStrokePoints.current,
            brushRadiusRef.current,
            brushTargetIdRef.current
          );
        }
        brushStrokePoints.current = [];
      }
    };

    map.on("mouseup", () => {
      if (draggingVertex.current) {
        draggingVertex.current = null;
        map.getCanvas().style.cursor = "";
        onDragEndRef.current?.();
      }
      finishBrushing();
    });

    map.on("mouseleave", () => {
      finishBrushing();
    });

    map.on("mouseenter", "vertices-circles", () => {
      if (modeRef.current === "vertex_edit") map.getCanvas().style.cursor = "grab";
    });
    map.on("mouseleave", "vertices-circles", () => {
      if (!draggingVertex.current) map.getCanvas().style.cursor = "";
    });

    mapRef.current = map;

    return () => {
      sourcesReady.current = false;
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Helper: safely set data on a source, handling the case where sources aren't ready yet
  const safeSetData = useCallback((sourceId: string, data: FeatureCollection) => {
    const map = mapRef.current;
    if (!map || !sourcesReady.current) return false;
    const source = map.getSource(sourceId) as maplibregl.GeoJSONSource | undefined;
    if (!source) return false;
    source.setData(data);
    return true;
  }, []);

  // Clear brush cursor when leaving brush mode
  useEffect(() => {
    if (mode !== "brush") {
      safeSetData("brush-cursor", EMPTY_FC);
    }
  }, [mode, safeSetData]);

  // Update active feature geometry
  useEffect(() => {
    const fc = geometry
      ? {
          type: "FeatureCollection" as const,
          features: [{ type: "Feature" as const, geometry, properties: {} }],
        }
      : EMPTY_FC;
    if (safeSetData("active-feature", fc)) return;

    const map = mapRef.current;
    if (!map) return;
    const handler = () => safeSetData("active-feature", fc);
    map.on("load", handler);
    return () => {
      map.off("load", handler);
    };
  }, [geometry, safeSetData]);

  // Update vertices
  useEffect(() => {
    let vFC: FeatureCollection = EMPTY_FC;
    let mFC: FeatureCollection = EMPTY_FC;

    if (geometry && mode === "vertex_edit") {
      const vertices = getVertices(geometry);
      const vFeatures: Feature[] = vertices.map((v) => ({
        type: "Feature",
        geometry: { type: "Point", coordinates: v.coord },
        properties: {
          ringIndex: v.ringIndex,
          vertexIndex: v.vertexIndex,
          selected:
            selectedVertex?.ringIndex === v.ringIndex &&
            selectedVertex?.vertexIndex === v.vertexIndex,
        },
      }));
      vFC = { type: "FeatureCollection", features: vFeatures };

      // Edge midpoints
      const rings = getAllRings(geometry);
      const mFeatures: Feature[] = [];
      for (let rIdx = 0; rIdx < rings.length; rIdx++) {
        const ring = rings[rIdx]!;
        for (let vIdx = 0; vIdx < ring.length - 1; vIdx++) {
          const p1 = ring[vIdx]!;
          const p2 = ring[vIdx + 1]!;
          const mid: Position = [(p1[0] + p2[0]) / 2, (p1[1] + p2[1]) / 2];
          mFeatures.push({
            type: "Feature",
            geometry: { type: "Point", coordinates: mid },
            properties: { ringIndex: rIdx, edgeIndex: vIdx },
          });
        }
      }
      mFC = { type: "FeatureCollection", features: mFeatures };
    }

    if (safeSetData("vertices", vFC) && safeSetData("midpoints", mFC)) return;

    const map = mapRef.current;
    if (!map) return;
    const handler = () => {
      safeSetData("vertices", vFC);
      safeSetData("midpoints", mFC);
    };
    map.on("load", handler);
    return () => {
      map.off("load", handler);
    };
  }, [geometry, mode, selectedVertex, safeSetData]);

  // Update neighbor geometries
  useEffect(() => {
    const features: Feature[] = [];
    if (neighborGeometries) {
      for (const geom of neighborGeometries) {
        if (geom.geometry) {
          features.push({
            type: "Feature",
            geometry: geom.geometry as Polygon | MultiPolygon,
            properties: { id: geom.featureId },
          });
        }
      }
    }
    const fc = { type: "FeatureCollection" as const, features };
    if (safeSetData("neighbors", fc)) return;

    const map = mapRef.current;
    if (!map) return;
    const handler = () => safeSetData("neighbors", fc);
    map.on("load", handler);
    return () => {
      map.off("load", handler);
    };
  }, [neighborGeometries, safeSetData]);

  // Update merge targets
  useEffect(() => {
    const features: Feature[] = [];
    if (neighborGeometries && mergeTargets.length > 0) {
      for (const geom of neighborGeometries) {
        if (geom.geometry && mergeTargets.includes(geom.featureId)) {
          features.push({
            type: "Feature",
            geometry: geom.geometry as Polygon | MultiPolygon,
            properties: {},
          });
        }
      }
    }
    const fc = { type: "FeatureCollection" as const, features };
    if (safeSetData("merge-targets", fc)) return;

    const map = mapRef.current;
    if (!map) return;
    const handler = () => safeSetData("merge-targets", fc);
    map.on("load", handler);
    return () => {
      map.off("load", handler);
    };
  }, [neighborGeometries, mergeTargets, safeSetData]);

  // Update split line
  useEffect(() => {
    let fc = EMPTY_FC;
    if (mode === "split" && splitLine.length > 0) {
      const features: Feature[] = [];
      if (splitLine.length >= 2) {
        features.push({
          type: "Feature",
          geometry: { type: "LineString", coordinates: splitLine },
          properties: {},
        });
      }
      for (const pt of splitLine) {
        features.push({
          type: "Feature",
          geometry: { type: "Point", coordinates: pt },
          properties: {},
        });
      }
      fc = { type: "FeatureCollection", features };
    }

    if (safeSetData("split-line", fc)) return;

    const map = mapRef.current;
    if (!map) return;
    const handler = () => safeSetData("split-line", fc);
    map.on("load", handler);
    return () => {
      map.off("load", handler);
    };
  }, [splitLine, mode, safeSetData]);

  // Update trace start point
  useEffect(() => {
    const fc = traceStart
      ? {
          type: "FeatureCollection" as const,
          features: [
            {
              type: "Feature" as const,
              geometry: { type: "Point" as const, coordinates: traceStart },
              properties: {},
            },
          ],
        }
      : EMPTY_FC;

    if (safeSetData("trace-start", fc)) return;

    const map = mapRef.current;
    if (!map) return;
    const handler = () => safeSetData("trace-start", fc);
    map.on("load", handler);
    return () => {
      map.off("load", handler);
    };
  }, [traceStart, safeSetData]);

  // Fly to feature when loaded
  const hasGeometry = !!geometry;
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !geometry) return;

    const rings = getAllRings(geometry);
    let minLng = Infinity,
      maxLng = -Infinity,
      minLat = Infinity,
      maxLat = -Infinity;
    for (const ring of rings) {
      for (const coord of ring) {
        if (coord[0]! < minLng) minLng = coord[0]!;
        if (coord[0]! > maxLng) maxLng = coord[0]!;
        if (coord[1]! < minLat) minLat = coord[1]!;
        if (coord[1]! > maxLat) maxLat = coord[1]!;
      }
    }

    map.fitBounds(
      [
        [minLng, minLat],
        [maxLng, maxLat],
      ],
      { padding: 60, duration: 1000 }
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasGeometry]);

  return <div ref={containerRef} className="h-full w-full rounded-lg" style={{ minHeight: 400 }} />;
});
