"use client";

/**
 * useMapEditorRoutes — transport-route drawing and path editing for the map
 * editor: waypoint collection, create, path edit/commit/cancel and reverse.
 * Every write lands on the editor's undo stack.
 */

import { useCallback, useState } from "react";
import { api } from "~/trpc/react";
import type { EditorFeature, EditorMode } from "./editor-types";
import type { EditorAction, PushableEditorAction } from "./useMapHistory";

function errMsg(e: unknown, fallback: string): string {
  return e instanceof Error && e.message ? e.message : fallback;
}

interface UseMapEditorRoutesProps {
  countryId?: string;
  allFeatures: EditorFeature[];
  selectedFeature: EditorFeature | null;
  setMode: (mode: EditorMode) => void;
  pushAction: (action: PushableEditorAction) => void;
  afterWrite: () => void;
  setMutationError: (err: string | null) => void;
  commitAction: (action: Omit<EditorAction, "timestamp">) => Promise<void>;
}

export function useMapEditorRoutes({
  countryId,
  allFeatures,
  selectedFeature,
  setMode,
  pushAction,
  afterWrite,
  setMutationError,
  commitAction,
}: UseMapEditorRoutesProps) {
  const [routeWaypoints, setRouteWaypoints] = useState<[number, number][]>([]);
  const [routeType, setRouteType] = useState<string>("road");
  const [editingRouteId, setEditingRouteId] = useState<string | null>(null);
  const [editingRouteVertices, setEditingRouteVertices] = useState<[number, number][]>([]);

  const createRoute = api.transport.createRoute.useMutation();
  const updateRouteGeometry = api.transport.updateRouteGeometry.useMutation();

  const finishRoute = useCallback(
    async (typeOverride?: string, nameOverride?: string) => {
      if (!countryId || routeWaypoints.length < 2) return;
      const type = typeOverride || routeType;
      try {
        const typeLabel = type.replace(/_/g, " ");
        const formattedType = typeLabel.charAt(0).toUpperCase() + typeLabel.slice(1);
        const name = nameOverride?.trim() || `New ${formattedType}`;
        const geometry = { type: "LineString" as const, coordinates: routeWaypoints };
        const res = await createRoute.mutateAsync({ countryId, name, routeType: type, geometry });
        const newId = (res as { id?: string } | null)?.id;
        if (newId) {
          pushAction({
            type: "create",
            featureType: "route",
            featureId: newId,
            description: `Created Route "${name}"`,
            newData: { name, routeType: type, geometry },
          });
        }
        setRouteWaypoints([]);
        setMode("view");
        afterWrite();
      } catch (e) {
        setMutationError(errMsg(e, "Failed to create route"));
        throw e;
      }
    },
    [
      countryId,
      routeWaypoints,
      routeType,
      createRoute,
      pushAction,
      setMode,
      afterWrite,
      setMutationError,
    ]
  );

  const undoLastWaypoint = useCallback(() => {
    setRouteWaypoints((prev) => prev.slice(0, -1));
  }, []);

  const clearRouteWaypoints = useCallback(() => {
    setRouteWaypoints([]);
  }, []);

  const startRouteEdit = useCallback(
    (routeId: string, vertices: [number, number][]) => {
      setEditingRouteId(routeId);
      setEditingRouteVertices(vertices);
      setMode("edit-route");
    },
    [setMode]
  );

  const commitRouteEdit = useCallback(async () => {
    if (!countryId || !editingRouteId || editingRouteVertices.length < 2) return;
    const target = allFeatures.find((f) => f.id === editingRouteId && f.type === "route");
    const geometry = { type: "LineString" as const, coordinates: editingRouteVertices };
    try {
      await updateRouteGeometry.mutateAsync({ countryId, id: editingRouteId, geometry });
      pushAction({
        type: "update",
        featureType: "route",
        featureId: editingRouteId,
        description: `Edited path of Route "${target?.name ?? "route"}"`,
        previousData: { geometry: target?.geometry },
        newData: { geometry },
      });
      setEditingRouteId(null);
      setEditingRouteVertices([]);
      setMode("view");
      afterWrite();
    } catch (e) {
      setMutationError(errMsg(e, "Failed to update route"));
    }
  }, [
    countryId,
    editingRouteId,
    editingRouteVertices,
    allFeatures,
    updateRouteGeometry,
    pushAction,
    setMode,
    afterWrite,
    setMutationError,
  ]);

  const cancelRouteEdit = useCallback(() => {
    setEditingRouteId(null);
    setEditingRouteVertices([]);
    setMode("view");
  }, [setMode]);

  const addRouteWaypointWithSnap = useCallback((coord: [number, number]) => {
    setRouteWaypoints((prev) => [...prev, coord]);
  }, []);

  const reverseRoute = useCallback(
    async (routeId?: string) => {
      const targetId = routeId || (selectedFeature?.type === "route" ? selectedFeature.id : null);
      if (!countryId || !targetId) return;
      const target = allFeatures.find((f) => f.id === targetId && f.type === "route");
      if (!target || !target.geometry) return;
      const geo = target.geometry as { type?: string; coordinates?: [number, number][] };
      if (
        geo.type !== "LineString" ||
        !Array.isArray(geo.coordinates) ||
        geo.coordinates.length < 2
      )
        return;
      try {
        await commitAction({
          type: "update",
          featureType: "route",
          featureId: targetId,
          description: `Reversed direction of Route "${target.name}"`,
          previousData: { geometry: target.geometry },
          newData: {
            geometry: { type: "LineString", coordinates: [...geo.coordinates].reverse() },
          },
        });
      } catch (e) {
        setMutationError(errMsg(e, "Failed to reverse route"));
      }
    },
    [countryId, selectedFeature, allFeatures, commitAction, setMutationError]
  );

  return {
    routeWaypoints,
    setRouteWaypoints,
    routeType,
    setRouteType,
    editingRouteId,
    setEditingRouteId,
    editingRouteVertices,
    setEditingRouteVertices,
    isRouteMutating: createRoute.isPending || updateRouteGeometry.isPending,
    finishRoute,
    undoLastWaypoint,
    clearRouteWaypoints,
    startRouteEdit,
    commitRouteEdit,
    cancelRouteEdit,
    addRouteWaypointWithSnap,
    reverseRoute,
  };
}
