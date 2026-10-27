"use client";

import { useState, useCallback } from "react";
import type { FeatureCollection } from "geojson";
import { confirmEditorAction } from "~/components/maps/editor/components/EditorConfirmDialog";
import type {
  EditorFeature,
  MapEditorInstance,
  EditorContextMenuData,
} from "~/components/maps/editor/types/editor-state";
import type { EditorMapRef } from "~/components/maps/editor/EditorMap";
import { routeVertices } from "~/components/maps/editor/utils/map-helpers";

interface UseEditorSelectionStateProps {
  editor: MapEditorInstance;
  mapRef: React.RefObject<EditorMapRef | null>;
  expandPropertiesPanel: () => void;
  transportRouteData?: FeatureCollection | null;
}

type Bounds = { minLng: number; minLat: number; maxLng: number; maxLat: number };

const emptyBounds = (): Bounds => ({
  minLng: Infinity,
  minLat: Infinity,
  maxLng: -Infinity,
  maxLat: -Infinity,
});

function extendBounds(b: Bounds, lng: number, lat: number) {
  b.minLng = Math.min(b.minLng, lng);
  b.maxLng = Math.max(b.maxLng, lng);
  b.minLat = Math.min(b.minLat, lat);
  b.maxLat = Math.max(b.maxLat, lat);
}

/** Frames a route: tiny routes fly in, others fit their bounds. */
function frameRoute(mapRef: UseEditorSelectionStateProps["mapRef"], coords: [number, number][]) {
  const bounds = emptyBounds();
  for (const [lng, lat] of coords) extendBounds(bounds, lng, lat);
  const { minLng, minLat, maxLng, maxLat } = bounds;

  const map = mapRef.current?.getMap();
  if (!map) {
    mapRef.current?.flyTo((minLng + maxLng) / 2, (minLat + maxLat) / 2, 9);
  } else if (Math.abs(maxLng - minLng) < 0.001 && Math.abs(maxLat - minLat) < 0.001) {
    mapRef.current?.flyTo(minLng, minLat, 11);
  } else {
    map.fitBounds(
      [
        [minLng, minLat],
        [maxLng, maxLat],
      ],
      { padding: 80, duration: 1000, maxZoom: 13 }
    );
  }
}

export function useEditorSelectionState({
  editor,
  mapRef,
  expandPropertiesPanel,
  transportRouteData,
}: UseEditorSelectionStateProps) {
  const [contextMenu, setContextMenu] = useState<EditorContextMenuData | null>(null);

  const [selectedRouteId, setSelectedRouteIdState] = useState<string | null>(null);

  const setSelectedRouteId = useCallback(
    (routeId: string | null) => {
      setSelectedRouteIdState(routeId);
      if (!routeId) {
        if (editor.selectedFeature?.type === "route") {
          editor.setSelectedFeature(null);
        }
        if (editor.mode === "edit-route") {
          editor.cancelRouteEdit();
        }
        return;
      }

      const routeFeature = transportRouteData?.features?.find(
        (f) => String(f.properties?.id) === routeId
      );
      if (!routeFeature?.geometry) return;

      const props = (routeFeature.properties ?? {}) as Record<string, unknown>;
      const routeName = String(props.name || "Route");
      editor.setSelectedFeature({
        id: routeId,
        type: "route",
        name: routeName,
        geometry: routeFeature.geometry,
        properties: {
          ...props,
          id: routeId,
          name: routeName,
          routeType: String(props.routeType || "road"),
        },
      });
      expandPropertiesPanel();

      const coords = routeVertices(routeFeature.geometry);
      if (coords.length > 0) {
        // Start route node editing right away so vertex pins and midpoint handles appear.
        editor.startRouteEdit(routeId, coords);
        frameRoute(mapRef, coords);
      }
    },
    [editor, expandPropertiesPanel, mapRef, transportRouteData]
  );

  const handleRouteClick = useCallback(
    (routeId: string) => {
      setSelectedRouteId(routeId);
    },
    [setSelectedRouteId]
  );

  /** Frames a feature: points fly in, shapes fit their bounding box. */
  const zoomToFeature = useCallback(
    (feature: EditorFeature) => {
      const ref = mapRef.current;
      if (!ref) return;
      if (feature.coordinates) {
        const map = ref.getMap();
        ref.flyTo(feature.coordinates[0], feature.coordinates[1], Math.max(map?.getZoom() ?? 0, 8));
        return;
      }
      if (!feature.geometry) return;
      const bounds = emptyBounds();
      const visit = (c: unknown): void => {
        if (!Array.isArray(c)) return;
        if (typeof c[0] === "number" && typeof c[1] === "number") {
          extendBounds(bounds, c[0], c[1]);
        } else {
          for (const inner of c) visit(inner);
        }
      };
      visit((feature.geometry as { coordinates?: unknown }).coordinates);
      const { minLng, minLat, maxLng, maxLat } = bounds;
      if (!Number.isFinite(minLng)) return;
      const map = ref.getMap();
      if (map) {
        map.fitBounds(
          [
            [minLng, minLat],
            [maxLng, maxLat],
          ],
          { padding: 80, duration: 700, maxZoom: 11 }
        );
      } else {
        ref.flyTo((minLng + maxLng) / 2, (minLat + maxLat) / 2, 7);
      }
    },
    [mapRef]
  );

  const handleSelectFeature = useCallback(
    (feature: EditorFeature | null) => {
      if (feature?.type === "route") {
        setSelectedRouteId(feature.id);
        return;
      }
      setSelectedRouteIdState(null);
      editor.setSelectedFeature(feature);
      if (!feature) {
        editor.resetForm();
        return;
      }
      editor.startEditing(feature);
      expandPropertiesPanel();
      zoomToFeature(feature);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [editor, zoomToFeature, expandPropertiesPanel]
  );

  const handleEditFeature = useCallback(
    (feature: EditorFeature) => {
      editor.startEditing(feature);
      expandPropertiesPanel();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [editor, expandPropertiesPanel]
  );

  const handleDeleteFeature = useCallback(
    async (feature: EditorFeature) => {
      const ok = await confirmEditorAction({
        title: `Delete "${feature.name}"?`,
        description: "You can bring it back with Undo (Ctrl+Z) while the editor is open.",
        confirmLabel: "Delete",
        destructive: true,
      });
      if (ok) await editor.handleDeleteFeature(feature);
    },
    [editor]
  );

  return {
    contextMenu,
    setContextMenu,
    selectedRouteId,
    setSelectedRouteId,
    handleRouteClick,
    zoomToFeature,
    handleSelectFeature,
    handleEditFeature,
    handleDeleteFeature,
  };
}
