// @ts-nocheck
"use client";

import React, { useRef, useEffect, useCallback } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { Position, Polygon, MultiPolygon, Feature, FeatureCollection } from "geojson";
import type { VertexRef, EdgeRef } from "~/lib/border-editor";
import { getVertices, findNearestVertex, findNearestEdge, getAllRings } from "~/lib/border-editor";

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
}

const EMPTY_FC: FeatureCollection = { type: "FeatureCollection", features: [] };

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
}: BorderEditorMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const draggingVertex = useRef<VertexRef | null>(null);
  // Keep mode and callbacks in refs so event handlers always see current values
  const modeRef = useRef(mode);
  modeRef.current = mode;
  const onDragEndRef = useRef(onDragEnd);
  onDragEndRef.current = onDragEnd;
  const sourcesReady = useRef(false);

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
      projection: { type: "globe" } as any,
    });

    map.on("load", () => {
      sourcesReady.current = true;
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
    });

    map.on("click", (e) => {
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
    });

    map.on("mouseup", () => {
      if (draggingVertex.current) {
        draggingVertex.current = null;
        map.getCanvas().style.cursor = "";
        onDragEndRef.current?.();
      }
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

  // Update active feature geometry
  useEffect(() => {
    const fc = geometry
      ? {
          type: "FeatureCollection" as const,
          features: [{ type: "Feature" as const, geometry, properties: {} }],
        }
      : EMPTY_FC;
    if (safeSetData("active-feature", fc)) return;

    // Sources not ready — wait for load
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
      const midFeatures: Feature[] = [];
      for (let ri = 0; ri < rings.length; ri++) {
        const ring = rings[ri]!;
        for (let i = 0; i < ring.length - 1; i++) {
          const a = ring[i]!;
          const b = ring[i + 1]!;
          midFeatures.push({
            type: "Feature",
            geometry: {
              type: "Point",
              coordinates: [(a[0]! + b[0]!) / 2, (a[1]! + b[1]!) / 2],
            },
            properties: { ringIndex: ri, startIndex: i },
          });
        }
      }
      mFC = { type: "FeatureCollection", features: midFeatures };
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

  // Update neighbors
  useEffect(() => {
    let nFC: FeatureCollection = EMPTY_FC;
    let mtFC: FeatureCollection = EMPTY_FC;

    if (neighborGeometries) {
      const nFeatures: Feature[] = neighborGeometries.map((n) => ({
        type: "Feature",
        geometry: n.geometry as Polygon | MultiPolygon,
        properties: { featureId: n.featureId },
      }));
      nFC = { type: "FeatureCollection", features: nFeatures };

      const mtFeatures = nFeatures.filter((f) =>
        mergeTargets.includes(f.properties?.featureId as string)
      );
      mtFC = { type: "FeatureCollection", features: mtFeatures };
    }

    if (safeSetData("neighbors", nFC) && safeSetData("merge-targets", mtFC)) return;

    const map = mapRef.current;
    if (!map) return;
    const handler = () => {
      safeSetData("neighbors", nFC);
      safeSetData("merge-targets", mtFC);
    };
    map.on("load", handler);
    return () => {
      map.off("load", handler);
    };
  }, [neighborGeometries, mergeTargets, safeSetData]);

  // Update split line
  useEffect(() => {
    let fc: FeatureCollection = EMPTY_FC;

    if (splitLine.length > 0) {
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
  }, [splitLine, safeSetData]);

  // Fly to feature when loaded
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
    // Only fly on initial geometry load
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!geometry]);

  return <div ref={containerRef} className="h-full w-full rounded-lg" style={{ minHeight: 400 }} />;
});
