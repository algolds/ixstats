"use client";

import { useState, useCallback } from "react";
import {
  getSnapEnabled,
  setSnapEnabled as persistSnapEnabled,
  getSnapTolerance,
  setSnapTolerance as persistSnapTolerance,
} from "~/lib/maps/editor-prefs";
import type { LayerStateRecord } from "~/components/maps/editor/types/editor-state";

export function useEditorToolState() {
  const [cursorZoom, setCursorZoom] = useState<number | undefined>(undefined);
  const [showGrid, setShowGrid] = useState(false);
  const [showGuides, setShowGuides] = useState(true);
  const [snapEnabled, setSnapEnabledState] = useState(getSnapEnabled());
  const [snapTolerance, setSnapToleranceState] = useState(getSnapTolerance());
  const [showShortcuts, setShowShortcuts] = useState(false);

  const setSnapEnabled = useCallback((v: boolean) => {
    setSnapEnabledState(v);
    persistSnapEnabled(v);
  }, []);

  const setSnapTolerance = useCallback((v: number) => {
    setSnapToleranceState(v);
    persistSnapTolerance(v);
  }, []);

  const [layerStates, setLayerStates] = useState<Record<string, LayerStateRecord>>({
    border: { visible: true, locked: false, opacity: 1 },
    regions: { visible: true, locked: false, opacity: 0.6 },
    cities: { visible: true, locked: false, opacity: 1 },
    pois: { visible: false, locked: false, opacity: 1 },
    stories: { visible: false, locked: false, opacity: 1 },
    labels: { visible: true, locked: false, opacity: 1 },
    routes: { visible: true, locked: false, opacity: 1 },
    rivers: { visible: true, locked: false, opacity: 1 },
    altitude: { visible: true, locked: false, opacity: 1 },
    grid: { visible: false, locked: false, opacity: 1 },
  });

  return {
    cursorZoom,
    setCursorZoom,
    showGrid,
    setShowGrid,
    showGuides,
    setShowGuides,
    snapEnabled,
    setSnapEnabled,
    snapTolerance,
    setSnapTolerance,
    showShortcuts,
    setShowShortcuts,
    layerStates,
    setLayerStates,
  };
}
