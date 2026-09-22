"use client";

import { useState, useCallback } from "react";
import type { Polygon, MultiPolygon } from "geojson";
import { point } from "@turf/helpers";
import { booleanPointInPolygon } from "@turf/boolean-point-in-polygon";
import type { EditorFeature } from "./editor-types";

export interface EditorGuideLine {
  id: string;
  type: "h" | "v";
  value: number;
}

interface UseMapEditorSelectionProps {
  allFeatures: EditorFeature[];
  countryId?: string;
  onRefresh?: () => void;
}

export function useMapEditorSelection({
  allFeatures,
  countryId: _countryId,
  onRefresh: _onRefresh,
}: UseMapEditorSelectionProps) {
  // Multi-Select state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const toggleSelectId = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const clearMultiSelect = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  // Ruler state
  const [rulerPoints, setRulerPoints] = useState<[number, number][]>([]);

  const addRulerPoint = useCallback((coords: [number, number]) => {
    setRulerPoints((prev) => [...prev, coords]);
  }, []);

  const clearRuler = useCallback(() => {
    setRulerPoints([]);
  }, []);

  // Lasso tool state
  const [lassoTool, setLassoTool] = useState<"freehand" | "rect">("freehand");
  const [lassoGeometry, setLassoGeometry] = useState<Polygon | MultiPolygon | null>(null);

  const applyLassoSelection = useCallback(
    (
      coordsOrGeom: [number, number][] | Polygon | MultiPolygon | null,
      mode: "replace" | "add" | "subtract" = "replace"
    ) => {
      if (!coordsOrGeom) return;
      let poly: Polygon | MultiPolygon;
      if (Array.isArray(coordsOrGeom)) {
        if (coordsOrGeom.length < 3) return;
        poly = {
          type: "Polygon",
          coordinates: [[...coordsOrGeom, coordsOrGeom[0]!]],
        };
      } else {
        poly = coordsOrGeom;
      }
      const matchedIds = new Set<string>();
      for (const feat of allFeatures) {
        if (feat.coordinates) {
          const pt = point(feat.coordinates);
          try {
            if (booleanPointInPolygon(pt, poly)) {
              matchedIds.add(feat.id);
            }
          } catch {}
        }
      }
      setSelectedIds((prev) => {
        if (mode === "add") {
          const next = new Set(prev);
          for (const id of matchedIds) next.add(id);
          return next;
        }
        if (mode === "subtract") {
          const next = new Set(prev);
          for (const id of matchedIds) next.delete(id);
          return next;
        }
        return matchedIds;
      });
      setLassoGeometry(null);
    },
    [allFeatures]
  );

  const applyRectSelection = useCallback(
    (
      bounds:
        | { west: number; south: number; east: number; north: number }
        | [[number, number], [number, number]],
      mode: "replace" | "add" | "subtract" = "replace"
    ) => {
      let minLng: number, minLat: number, maxLng: number, maxLat: number;
      if (Array.isArray(bounds)) {
        [[minLng, minLat], [maxLng, maxLat]] = bounds;
      } else {
        minLng = bounds.west;
        minLat = bounds.south;
        maxLng = bounds.east;
        maxLat = bounds.north;
      }
      const matchedIds = new Set<string>();
      for (const feat of allFeatures) {
        if (feat.coordinates) {
          const [lng, lat] = feat.coordinates;
          if (lng >= minLng && lng <= maxLng && lat >= minLat && lat <= maxLat) {
            matchedIds.add(feat.id);
          }
        }
      }
      setSelectedIds((prev) => {
        if (mode === "add") {
          const next = new Set(prev);
          for (const id of matchedIds) next.add(id);
          return next;
        }
        if (mode === "subtract") {
          const next = new Set(prev);
          for (const id of matchedIds) next.delete(id);
          return next;
        }
        return matchedIds;
      });
    },
    [allFeatures]
  );

  const [guides, setGuides] = useState<EditorGuideLine[]>([]);

  return {
    selectedIds,
    setSelectedIds,
    toggleSelectId,
    clearMultiSelect,
    rulerPoints,
    setRulerPoints,
    addRulerPoint,
    clearRuler,
    lassoTool,
    setLassoTool,
    lassoGeometry,
    setLassoGeometry,
    applyLassoSelection,
    applyRectSelection,
    guides,
    setGuides,
  };
}
