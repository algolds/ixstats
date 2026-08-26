"use client";

import { useCallback, useRef } from "react";
import type { Map as MapLibreMap, MapMouseEvent } from "maplibre-gl";
import type { EditorFeature, EditorMode } from "~/hooks/useMapEditor";
import { getPlugins } from "~/components/maps/editor/plugins/registry";
import { hitTestFeatures } from "~/components/maps/editor/utils/hit-test";
import { transientMapStore } from "~/components/maps/editor/utils/transientStore";

const INTERACTIVE_LAYERS = [
  "editor-subdivisions-fill",
  "editor-points-capital",
  "editor-points-city",
  "editor-points-poi",
  "editor-points-story-pin",
  "editor-points-map-label",
  "editor-points-labels",
  "editor-map-labels",
  "editor-gaps-fill",
] as const;

interface UseEditorMapEventsProps {
  map: MapLibreMap | null;
  mode: EditorMode;
  features: EditorFeature[];
  selectedFeature: EditorFeature | null;
  onFeatureSelect?: (feature: EditorFeature | null) => void;
  onMapClick: (lng: number, lat: number) => void;
  onFeatureContextMenu?: (feature: EditorFeature, screenPos: { x: number; y: number }) => void;
  onApplyPaintFill?: (subdivisionId: string) => void;
  onApplyEyedropper?: (feature: any) => void;
  onApplyMagicWand?: (feature: any, isShift: boolean, isAlt: boolean) => void;
  lockedLayers?: Record<string, boolean>;
  context: any;
}

export function useEditorMapEvents({
  map,
  mode,
  features,
  // oxlint-disable-next-line eslint/no-unused-vars
  selectedFeature,
  onFeatureSelect,
  onMapClick,
  // oxlint-disable-next-line eslint/no-unused-vars
  onFeatureContextMenu,
  onApplyPaintFill,
  onApplyEyedropper,
  onApplyMagicWand,
  // oxlint-disable-next-line eslint/no-unused-vars
  lockedLayers,
  context,
}: UseEditorMapEventsProps) {
  const modeRef = useRef(mode);
  modeRef.current = mode;

  const routePluginEvent = useCallback(
    (eventName: string, e: any) => {
      const activeMode = modeRef.current;
      const plugins = getPlugins();
      for (const plugin of plugins) {
        const isTargetMode = plugin.global || (plugin.modes && plugin.modes.includes(activeMode));
        if (isTargetMode && plugin.mapEvents?.[eventName]) {
          plugin.mapEvents[eventName](e, context);
        }
      }
    },
    [context]
  );

  const handleMapMouseMove = useCallback(
    (e: MapMouseEvent) => {
      if (!map) return;
      const { lng, lat } = e.lngLat;
      transientMapStore.setCursorCoords([lng, lat]);
      routePluginEvent("mousemove", e);
    },
    [map, routePluginEvent]
  );

  const handleMapClickInternal = useCallback(
    (e: MapMouseEvent) => {
      if (!map) return;
      routePluginEvent("click", e);

      const activeMode = modeRef.current;

      // Handle direct point placing modes
      if (
        activeMode === "add-city" ||
        activeMode === "add-poi" ||
        activeMode === "add-story-pin" ||
        activeMode === "add-label" ||
        activeMode === "add-peak"
      ) {
        onMapClick(e.lngLat.lng, e.lngLat.lat);
        return;
      }

      // Hit-test interactive features
      const hitResult = hitTestFeatures(map, e.point, { layers: INTERACTIVE_LAYERS as any });
      if (hitResult.hit?.featureId) {
        const feat = features.find((f) => f.id === hitResult.hit!.featureId);
        if (feat) {
          if (activeMode === "paint-fill" && onApplyPaintFill) {
            onApplyPaintFill(feat.id);
            return;
          }
          if (activeMode === "eyedropper" && onApplyEyedropper) {
            onApplyEyedropper(feat);
            return;
          }
          if (activeMode === "magic-wand" && onApplyMagicWand) {
            const isShift = (e.originalEvent as MouseEvent).shiftKey;
            const isAlt = (e.originalEvent as MouseEvent).altKey;
            onApplyMagicWand(feat, isShift, isAlt);
            return;
          }
          onFeatureSelect?.(feat);
          return;
        }
      }

      if (activeMode === "view") {
        onFeatureSelect?.(null);
      }
    },
    [
      map,
      features,
      onMapClick,
      onFeatureSelect,
      onApplyPaintFill,
      onApplyEyedropper,
      onApplyMagicWand,
      routePluginEvent,
    ]
  );

  return {
    handleMapMouseMove,
    handleMapClickInternal,
    routePluginEvent,
  };
}
