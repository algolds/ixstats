"use client";

import { useState, useCallback } from "react";
import type { Map as MapLibreMap } from "maplibre-gl";
import type { EditorMode } from "~/hooks/useMapEditor";

interface UseEditorSnapGuideProps {
  map: MapLibreMap | null;
  mode: EditorMode;
  guides?: { id: string; type: "h" | "v"; value: number }[];
  setGuides?: React.Dispatch<
    React.SetStateAction<{ id: string; type: "h" | "v"; value: number }[]>
  >;
  showGuides?: boolean;
  snapEnabled?: boolean;
  snapTolerance?: number;
}

export function useEditorSnapGuide({
  map,
  mode,
  guides = [],
  setGuides,
  showGuides = true,
  snapEnabled = true,
  snapTolerance = 10,
}: UseEditorSnapGuideProps) {
  const [activeDragGuide, setActiveDragGuide] = useState<{
    type: "h" | "v";
    currentVal: number;
    screenPos: number;
  } | null>(null);

  const getCursorForMode = useCallback((activeMode: EditorMode): string => {
    switch (activeMode) {
      case "pan":
        return "grab";
      case "add-city":
      case "add-poi":
      case "add-peak":
      case "add-label":
      case "add-story-pin":
      case "ruler":
        return "crosshair";
      case "eyedropper":
        return "crosshair";
      case "magic-wand":
      case "paint-fill":
        return "pointer";
      case "lasso-select":
        return "crosshair";
      default:
        return "";
    }
  }, []);

  return {
    activeDragGuide,
    setActiveDragGuide,
    getCursorForMode,
  };
}
