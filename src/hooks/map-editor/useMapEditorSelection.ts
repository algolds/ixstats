"use client";

import { useState, useCallback } from "react";
import type { Polygon, MultiPolygon } from "geojson";
import { point } from "@turf/helpers";
import { booleanPointInPolygon } from "@turf/boolean-point-in-polygon";
import type { EditorFeature } from "./editor-types";

interface EditorGuideLine {
  id: string;
  type: "h" | "v";
  value: number;
}

interface UseMapEditorSelectionProps {
  allFeatures: EditorFeature[];
  countryId?: string;
  onRefresh?: () => void;
}

/** Apply a lasso / rectangle match to the current selection. */
function combineSelection(
  prev: Set<string>,
  matched: Set<string>,
  mode: "replace" | "add" | "subtract"
): Set<string> {
  if (mode === "replace") return matched;
  const next = new Set(prev);
  for (const id of matched) {
    if (mode === "add") next.add(id);
    else next.delete(id);
  }
  return next;
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
      if (Array.isArray(coordsOrGeom) && coordsOrGeom.length < 3) return;
      const poly: Polygon | MultiPolygon = Array.isArray(coordsOrGeom)
        ? { type: "Polygon", coordinates: [[...coordsOrGeom, coordsOrGeom[0]!]] }
        : coordsOrGeom;
      const matchedIds = new Set<string>();
      for (const feat of allFeatures) {
        if (!feat.coordinates) continue;
        try {
          if (booleanPointInPolygon(point(feat.coordinates), poly)) matchedIds.add(feat.id);
        } catch {
          // degenerate lasso polygon or feature point — feature left unselected
        }
      }
      setSelectedIds((prev) => combineSelection(prev, matchedIds, mode));
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
      const [[minLng, minLat], [maxLng, maxLat]] = Array.isArray(bounds)
        ? bounds
        : [
            [bounds.west, bounds.south],
            [bounds.east, bounds.north],
          ];
      const matchedIds = new Set(
        allFeatures
          .filter(
            ({ coordinates: c }) =>
              c && c[0] >= minLng && c[0] <= maxLng && c[1] >= minLat && c[1] <= maxLat
          )
          .map((f) => f.id)
      );
      setSelectedIds((prev) => combineSelection(prev, matchedIds, mode));
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
