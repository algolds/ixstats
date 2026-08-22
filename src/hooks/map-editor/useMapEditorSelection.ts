"use client";

import { useState, useCallback } from "react";
import { point } from "@turf/helpers";
import { booleanPointInPolygon } from "@turf/boolean-point-in-polygon";
import type { EditorFeature } from "./editor-types";

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
  const [lassoGeometry, setLassoGeometry] = useState<any>(null);

  const applyLassoSelection = useCallback(
    (polygonGeom: any) => {
      if (!polygonGeom) return;
      const newSelected = new Set<string>();
      for (const feat of allFeatures) {
        if (feat.coordinates) {
          const pt = point(feat.coordinates);
          try {
            if (booleanPointInPolygon(pt, polygonGeom)) {
              newSelected.add(feat.id);
            }
          } catch {}
        }
      }
      setSelectedIds(newSelected);
      setLassoGeometry(null);
    },
    [allFeatures]
  );

  const applyRectSelection = useCallback(
    (bounds: { west: number; south: number; east: number; north: number } | [[number, number], [number, number]]) => {
      let minLng: number, minLat: number, maxLng: number, maxLat: number;
      if (Array.isArray(bounds)) {
        [[minLng, minLat], [maxLng, maxLat]] = bounds;
      } else {
        minLng = bounds.west;
        minLat = bounds.south;
        maxLng = bounds.east;
        maxLat = bounds.north;
      }
      const newSelected = new Set<string>();
      for (const feat of allFeatures) {
        if (feat.coordinates) {
          const [lng, lat] = feat.coordinates;
          if (lng >= minLng && lng <= maxLng && lat >= minLat && lat <= maxLat) {
            newSelected.add(feat.id);
          }
        }
      }
      setSelectedIds(newSelected);
    },
    [allFeatures]
  );

  // Magic Wand and Eyedropper configs
  const [wandMatchColor, setWandMatchColor] = useState(true);
  const [wandMatchLevel, setWandMatchLevel] = useState(false);
  const [wandMatchParent, setWandMatchParent] = useState(false);
  const [presetStyle, setPresetStyle] = useState<any>(null);
  const [guides, setGuides] = useState<any[]>([]);

  const applyMagicWand = useCallback(
    (targetFeature: EditorFeature) => {
      if (!targetFeature) return;
      const matched = new Set<string>([targetFeature.id]);
      const targetColor = targetFeature.properties?.color;
      const targetLevel = targetFeature.properties?.level;
      const targetParent = targetFeature.properties?.subdivisionId;

      for (const f of allFeatures) {
        if (f.type !== targetFeature.type) continue;
        let match = true;
        if (wandMatchColor && f.properties?.color !== targetColor) match = false;
        if (wandMatchLevel && f.properties?.level !== targetLevel) match = false;
        if (wandMatchParent && f.properties?.subdivisionId !== targetParent) match = false;
        if (match) {
          matched.add(f.id);
        }
      }
      setSelectedIds(matched);
    },
    [allFeatures, wandMatchColor, wandMatchLevel, wandMatchParent]
  );

  const applyEyedropper = useCallback((targetFeature: EditorFeature) => {
    if (!targetFeature) return;
    setPresetStyle({
      color: targetFeature.properties?.color,
      type: targetFeature.properties?.type,
      fontSize: targetFeature.properties?.fontSize,
      fontWeight: targetFeature.properties?.fontWeight,
    });
  }, []);

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
    wandMatchColor,
    setWandMatchColor,
    wandMatchLevel,
    setWandMatchLevel,
    wandMatchParent,
    setWandMatchParent,
    presetStyle,
    setPresetStyle,
    guides,
    setGuides,
    applyMagicWand,
    applyEyedropper,
  };
}
