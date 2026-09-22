"use client";

import { useState, useEffect, useCallback } from "react";
import { transientMapStore } from "~/components/maps/editor/utils/transientStore";
import { api } from "~/trpc/react";
import type { FeatureCollection } from "geojson";
import type { EditorFeature, MapEditorInstance, EditorContextMenuData } from "~/components/maps/editor/types/editor-state";
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
  const [hoveredFeature, setHoveredFeature] = useState<{
    feature: (typeof editor.allFeatures)[number];
    screenPos: { x: number; y: number };
  } | null>(null);

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

  const [debouncedCoords, setDebouncedCoords] = useState<[number, number] | null>(null);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const unsubscribe = transientMapStore.subscribe(() => {
      const coords = transientMapStore.getSnapshot().cursorCoords;
      if (timer) clearTimeout(timer);
      if (!coords) {
        setDebouncedCoords(null);
        return;
      }
      timer = setTimeout(() => {
        setDebouncedCoords(coords);
      }, 250);
    });

    return () => {
      unsubscribe();
      if (timer) clearTimeout(timer);
    };
  }, []);

  const { data: cursorTerrainInfo } = api.geoCore.getPointInfo.useQuery(
    { lng: debouncedCoords?.[0] ?? 0, lat: debouncedCoords?.[1] ?? 0 },
    { enabled: !!debouncedCoords, staleTime: 30_000, gcTime: 60_000 }
  );

  useEffect(() => {
    if (cursorTerrainInfo) {
      const elev = cursorTerrainInfo.elevation as { elevationMeters?: number | null } | undefined;
      const clim = cursorTerrainInfo.climate as { color?: string | null } | undefined;
      transientMapStore.setTerrainInfo({
        elevation: cursorTerrainInfo.elevation?.zoneName ?? null,
        elevationMeters: elev?.elevationMeters ?? null,
        climate: cursorTerrainInfo.climate?.climateName ?? null,
        biomeColor: clim?.color ?? null,
      });
    }
  }, [cursorTerrainInfo]);

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
      if (mapRef.current) {
        if (feature.coordinates) {
          mapRef.current.flyTo(feature.coordinates[0], feature.coordinates[1], 8);
        } else if (feature.geometry) {
          const geo = feature.geometry as {
            type?: string;
            coordinates?: [number, number][][] | [number, number][][][];
          };
          const ring =
            geo.type === "Polygon"
              ? (geo.coordinates?.[0] as [number, number][])
              : (geo.coordinates?.[0]?.[0] as [number, number][]);
          if (ring && ring.length > 0) {
            let cx = 0;
            let cy = 0;
            for (const pt of ring) {
              cx += pt[0];
              cy += pt[1];
            }
            cx /= ring.length;
            cy /= ring.length;
            mapRef.current.flyTo(cx, cy, 7);
          }
        }
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [editor, mapRef, expandPropertiesPanel]
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
    (feature: EditorFeature) => {
      if (confirm(`Delete "${feature.name}"? This action cannot be undone.`)) {
        editor.handleDeleteFeature(feature);
      }
    },
    [editor]
  );

  return {
    hoveredFeature,
    setHoveredFeature,
    contextMenu,
    setContextMenu,
    selectedRouteId,
    setSelectedRouteId,
    handleRouteClick,
    debouncedCoords,
    setDebouncedCoords,
    cursorTerrainInfo,
    handleSelectFeature,
    handleEditFeature,
    handleDeleteFeature,
  };
}
