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

interface UseEditorSelectionStateProps {
  editor: MapEditorInstance;
  mapRef: React.RefObject<EditorMapRef | null>;
  expandPropertiesPanel: () => void;
  transportRouteData?: FeatureCollection | null;
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

      // Find route in transportRouteData
      const routeFeature = transportRouteData?.features?.find(
        (f) => String(f.properties?.id) === routeId
      );

      if (routeFeature && routeFeature.geometry) {
        const props = (routeFeature.properties ?? {}) as Record<string, unknown>;
        const routeName = String(props.name || "Route");
        const routeType = String(props.routeType || "road");

        editor.setSelectedFeature({
          id: routeId,
          type: "route",
          name: routeName,
          geometry: routeFeature.geometry,
          properties: {
            ...props,
            id: routeId,
            name: routeName,
            routeType,
          },
        });
        expandPropertiesPanel();

        // Frame route in map viewport
        let coords: [number, number][] = [];
        if (routeFeature.geometry.type === "LineString") {
          coords = routeFeature.geometry.coordinates as [number, number][];
        } else if (routeFeature.geometry.type === "MultiLineString") {
          coords = (routeFeature.geometry.coordinates as [number, number][][]).flat();
        }

        if (coords.length > 0) {
          // ponytail: Immediately start route node editing mode so vertex pins and midpoint handles appear
          editor.startRouteEdit(routeId, coords);

          let minLng = Infinity;
          let minLat = Infinity;
          let maxLng = -Infinity;
          let maxLat = -Infinity;

          for (const [lng, lat] of coords) {
            if (lng < minLng) minLng = lng;
            if (lng > maxLng) maxLng = lng;
            if (lat < minLat) minLat = lat;
            if (lat > maxLat) maxLat = lat;
          }

          const map = mapRef.current?.getMap();
          if (map && minLng !== Infinity) {
            if (Math.abs(maxLng - minLng) < 0.001 && Math.abs(maxLat - minLat) < 0.001) {
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
          } else if (mapRef.current && minLng !== Infinity) {
            mapRef.current.flyTo((minLng + maxLng) / 2, (minLat + maxLat) / 2, 9);
          }
        }
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
      let minLng = Infinity;
      let minLat = Infinity;
      let maxLng = -Infinity;
      let maxLat = -Infinity;
      const visit = (c: unknown): void => {
        if (Array.isArray(c) && typeof c[0] === "number" && typeof c[1] === "number") {
          const [lng, lat] = c as [number, number];
          if (lng < minLng) minLng = lng;
          if (lng > maxLng) maxLng = lng;
          if (lat < minLat) minLat = lat;
          if (lat > maxLat) maxLat = lat;
        } else if (Array.isArray(c)) {
          for (const inner of c) visit(inner);
        }
      };
      visit((feature.geometry as { coordinates?: unknown }).coordinates);
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
