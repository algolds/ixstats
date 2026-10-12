"use client";

import { useState, useCallback, useMemo, useRef } from "react";
import type { Position, Polygon, MultiPolygon } from "geojson";
import { api } from "~/trpc/react";
import { useMapRealm } from "~/components/maps/core/MapRealmContext";
import { applyBrushStroke } from "~/lib/maps/territory-brush";
import type { BorderDraft } from "~/lib/maps/border-draft";
import type { BorderDragFrame } from "~/lib/maps/border-drag";
import { invalidateMapViews } from "~/components/maps/editor/hooks/state/geo-invalidation";
import { useBorderDrag } from "./useBorderDrag";
import { useBorderAutosave } from "./useBorderAutosave";
import {
  type UndoStack,
  type VertexRef,
  type AltitudeSnapResult,
  type NeighborChanges,
  createUndoStack,
  pushUndo,
  canUndo,
  canRedo,
  getUndoGeometry,
  getRedoGeometry,
  undo as undoStack,
  redo as redoStack,
  addVertex,
  findNearestVertex,
  findNearestEdge,
  calculateArea,
  validateGeometry,
  smoothGeometry,
  naturalizeGeometry,
  simplifyGeometry,
} from "~/lib/maps/border-editor";
import { traceAlongLayer } from "~/lib/maps/border-trace";
import type { TraceFeature } from "~/lib/maps/border-trace";

export type BorderEditMode =
  "select" | "vertex_edit" | "freehand" | "split" | "merge" | "trace" | "brush";

export interface BorderEditorState {
  mode: BorderEditMode;
  featureId: string | null;
  sessionId: string | null;
  geometry: Polygon | MultiPolygon | null;
  originalGeometry: Polygon | MultiPolygon | null;
  undoStackState: UndoStack;
  selectedVertex: VertexRef | null;
  splitLine: Position[];
  mergeTargets: string[];
  neighbors: Array<{ featureId: string; displayName: string | null }>;
  /** Geometries of neighbor features, indexed by neighbor featureId. */
  neighborGeometries: Record<string, Polygon | MultiPolygon>;
  /** Geometries of neighbors changed during this session (sent on submit). */
  dirtyNeighbors: Record<string, Polygon | MultiPolygon>;
  /** Neighbor geometries as loaded (what revert restores). */
  originalNeighborGeometries: Record<string, Polygon | MultiPolygon>;
  isDirty: boolean;
  isLoading: boolean;
  error: string | null;
  areaKm2: number | null;
  /** Active altitude snap indicator */
  altitudeSnap: AltitudeSnapResult | null;
  traceStart: [number, number] | null;
  /** An unsaved draft of this feature found on load, waiting to be restored or discarded. */
  pendingDraft: BorderDraft | null;
}

export interface BorderEditorActions {
  loadFeature: (featureId: string) => void;
  setMode: (mode: BorderEditMode) => void;
  handleMapClick: (lng: number, lat: number) => void;
  /** Moves the dragged vertex to the pointer; returns what to draw, no React state changes. */
  handleVertexDrag: (ref: VertexRef, pointer: Position) => BorderDragFrame | null;
  /** Ends a drag as one undo step; true when the vertex ended somewhere new. */
  commitDrag: () => boolean;
  addSplitPoint: (lng: number, lat: number) => void;
  clearSplitLine: () => void;
  toggleMergeTarget: (featureId: string) => void;
  undo: () => void;
  redo: () => void;
  save: () => Promise<void>;
  submitEdit: (
    applyDirectly?: boolean,
    reason?: string
  ) => Promise<{ applied: boolean; editRequestId: string | null }>;
  executeSplit: (nameA: string, nameB: string) => Promise<void>;
  executeMerge: (newName: string) => Promise<void>;
  repair: () => Promise<void>;
  smooth: () => void;
  naturalize: () => void;
  simplify: () => void;
  reset: () => void;
  revert: () => void;
  /** Apply the draft offered on load as unsaved changes. */
  restoreDraft: (draft: BorderDraft) => void;
  /** Drop the draft offered on load, and the saved copy; the loaded border stays as it is. */
  discardDraft: (draft: BorderDraft) => void;
  /** Provide the river/coast layer data used by "trace" mode. */
  setTraceLayerSource: (
    layers: Array<{ type: string; data: { features: TraceFeature[] } }> | undefined,
    visibleLayers: Set<string>
  ) => void;
  /** Apply a territory brush stroke: transfers area from the loaded feature (source)
   *  into the named neighbour (target). Returns true on success, false if stroke
   *  doesn't overlap / would fully consume source / geometry is invalid. */
  applyBrushTransfer: (
    strokePoints: [number, number][],
    radiusKm: number,
    targetFeatureId: string
  ) => boolean;
}

const INITIAL_STATE: BorderEditorState = {
  mode: "select",
  featureId: null,
  sessionId: null,
  geometry: null,
  originalGeometry: null,
  undoStackState: createUndoStack(),
  selectedVertex: null,
  splitLine: [],
  mergeTargets: [],
  neighbors: [],
  neighborGeometries: {},
  dirtyNeighbors: {},
  originalNeighborGeometries: {},
  isDirty: false,
  isLoading: false,
  error: null,
  areaKm2: null,
  altitudeSnap: null,
  traceStart: null,
  pendingDraft: null,
};

/**
 * Neighbour outlines with one undo entry's neighbour changes rolled back ("before") or replayed ("after").
 * A neighbour back on its loaded outline is no longer dirty.
 */
function withNeighborChanges(
  s: BorderEditorState,
  changes: NeighborChanges | undefined,
  side: "before" | "after"
): Pick<BorderEditorState, "neighborGeometries" | "dirtyNeighbors"> {
  const moved = Object.fromEntries(
    Object.entries(changes ?? {}).map(([fid, change]) => [fid, change[side]])
  );
  const dirty = Object.entries({ ...s.dirtyNeighbors, ...moved }).filter(
    ([fid, g]) => g !== s.originalNeighborGeometries[fid]
  );
  return {
    neighborGeometries: { ...s.neighborGeometries, ...moved },
    dirtyNeighbors: Object.fromEntries(dirty),
  };
}

/** The editor state with `geometry` as the new outline, one undo step on. */
function withEdit(
  s: BorderEditorState,
  action: Parameters<typeof pushUndo>[1],
  geometry: Polygon | MultiPolygon
): BorderEditorState {
  if (!s.geometry) return s;
  return {
    ...s,
    geometry,
    undoStackState: pushUndo(s.undoStackState, action, s.geometry, geometry),
    isDirty: true,
    areaKm2: calculateArea(geometry),
  };
}

/** Reloads what the map and the country views show after a border change. */
async function refreshMapViews(utils: ReturnType<typeof api.useUtils>) {
  invalidateMapViews(utils);
  await Promise.all([
    utils.geoCore.getCountryGeometry.invalidate(),
    utils.countryGeo.getCountryGeoBundle.invalidate(),
  ]);
}

export function useBorderEditor(): [BorderEditorState, BorderEditorActions] {
  const [state, setState] = useState<BorderEditorState>(INITIAL_STATE);
  // The latest committed state, for actions that must not change identity with it
  const stateRef = useRef(state);
  stateRef.current = state;
  // Feature ids are unique only within a realm: every lookup names the realm being edited
  const realm = useMapRealm();

  const { mutate: startSession } = api.geoEditor.startBorderEditSession.useMutation();
  const { mutateAsync: submitBorderEdit } = api.geoEditor.submitBorderEdit.useMutation();
  const { mutateAsync: splitCountry } = api.geoEditor.splitCountry.useMutation();
  const { mutateAsync: mergeCountries } = api.geoEditor.mergeCountries.useMutation();
  const { mutateAsync: repairGeometry } = api.geoEditor.repairBorderGeometry.useMutation();
  const utils = api.useUtils();
  const { handleVertexDrag, commitDrag } = useBorderDrag(stateRef, setState);
  const { save, clearDraft } = useBorderAutosave(state);

  // Trace mode state (mutable refs)
  /** River/coast layer data updated externally via setTraceLayerSource. */
  const traceLayersRef = useRef<
    Array<{ type: string; data: { features: TraceFeature[] } }> | undefined
  >(undefined);
  /** Currently visible layer IDs (used to filter to "rivers" etc.). */
  const traceVisibleLayersRef = useRef<Set<string>>(new Set());

  const loadFeature = useCallback(
    (featureId: string) => {
      setState((s) => ({ ...s, isLoading: true, error: null }));
      startSession(
        { featureId, realm },
        {
          onSuccess: (data) => {
            const geom = data.feature.geometry as unknown as Polygon | MultiPolygon;
            const neighborGeoms: Record<string, Polygon | MultiPolygon> = {};
            const rawNeighbors = data.neighbors as Array<{
              featureId: string;
              displayName: string | null;
              geometry?: unknown;
            }>;
            for (const n of rawNeighbors) {
              if (n.geometry) {
                neighborGeoms[n.featureId] = n.geometry as Polygon | MultiPolygon;
              }
            }
            setState((s) => ({
              ...s,
              featureId,
              sessionId: data.session.id,
              geometry: geom,
              originalGeometry: geom,
              neighbors: data.neighbors,
              neighborGeometries: neighborGeoms,
              dirtyNeighbors: {},
              originalNeighborGeometries: neighborGeoms,
              undoStackState: createUndoStack(),
              selectedVertex: null,
              splitLine: [],
              mergeTargets: [],
              isDirty: false,
              isLoading: false,
              error: null,
              areaKm2: calculateArea(geom),
              altitudeSnap: null,
              traceStart: null,
              pendingDraft: data.draft,
            }));
          },
          onError: (err) => {
            setState((s) => ({ ...s, isLoading: false, error: err.message }));
          },
        }
      );
    },
    [startSession, realm]
  );

  const setMode = useCallback((mode: BorderEditMode) => {
    setState((s) => ({
      ...s,
      mode,
      selectedVertex: null,
      splitLine: mode === "split" ? [] : s.splitLine,
      mergeTargets: mode === "merge" ? [] : s.mergeTargets,
      traceStart: mode === "trace" ? s.traceStart : null,
    }));
  }, []);

  const handleMapClick = useCallback((lng: number, lat: number) => {
    setState((s) => {
      if (!s.geometry) return s;
      const point: Position = [lng, lat];

      if (s.mode === "vertex_edit") {
        // Select nearest vertex
        const nearest = findNearestVertex(s.geometry, point);
        if (nearest && nearest.distance < 0.5) {
          return { ...s, selectedVertex: nearest.ref };
        }

        // If no vertex nearby, try adding one on nearest edge
        const nearestEdge = findNearestEdge(s.geometry, point);
        if (nearestEdge && nearestEdge.distance < 0.3) {
          const newGeom = addVertex(s.geometry, nearestEdge.ref, point);
          const newStack = pushUndo(s.undoStackState, "add_vertex", s.geometry, newGeom);
          return {
            ...s,
            geometry: newGeom,
            undoStackState: newStack,
            isDirty: true,
            areaKm2: calculateArea(newGeom),
          };
        }
        return s;
      }

      if (s.mode === "split") {
        return { ...s, splitLine: [...s.splitLine, point] };
      }

      if (s.mode === "trace") {
        const prev = s.traceStart;
        if (!prev) {
          // First click — store the trace start; wait for second click
          return { ...s, traceStart: [lng, lat] };
        }

        const traceLayers = traceLayersRef.current;
        const visibleLayers = traceVisibleLayersRef.current;
        const traceLayerTypes = ["rivers", "lakes"];
        const features: TraceFeature[] = [];
        if (traceLayers) {
          for (const layerType of traceLayerTypes) {
            if (!visibleLayers.has(layerType)) continue;
            const layer = traceLayers.find((l) => l.type === layerType);
            if (layer?.data?.features) {
              for (const f of layer.data.features) {
                if (
                  f.geometry &&
                  (f.geometry.type === "LineString" || f.geometry.type === "MultiLineString")
                ) {
                  features.push(f as TraceFeature);
                }
              }
            }
          }
        }

        const traced = traceAlongLayer(prev, [lng, lat], features, 0.05);
        if (traced.length === 0) {
          return s;
        }

        // Find the edge nearest to the first trace point and splice the run in
        const nearestEdge = findNearestEdge(s.geometry, prev);
        if (!nearestEdge) {
          return { ...s, traceStart: null };
        }

        // Insert all traced vertices one by one starting after the nearest edge
        let newGeom = s.geometry;
        for (let i = 0; i < traced.length; i++) {
          const currentEdge = findNearestEdge(newGeom, traced[i]!);
          if (currentEdge) {
            newGeom = addVertex(newGeom, currentEdge.ref, traced[i]!);
          }
        }

        const newStack = pushUndo(s.undoStackState, "snap", s.geometry, newGeom);
        return {
          ...s,
          geometry: newGeom,
          undoStackState: newStack,
          traceStart: null,
          isDirty: true,
          areaKm2: calculateArea(newGeom),
        };
      }

      // "freehand" mode is declared in BorderEditMode for future use.
      // It currently has no click handler and falls through to this no-op return.

      return s;
    });
  }, []);

  const addSplitPoint = useCallback((lng: number, lat: number) => {
    setState((s) => ({
      ...s,
      splitLine: [...s.splitLine, [lng, lat]],
    }));
  }, []);

  const clearSplitLine = useCallback(() => {
    setState((s) => ({ ...s, splitLine: [] }));
  }, []);

  const toggleMergeTarget = useCallback((featureId: string) => {
    setState((s) => ({
      ...s,
      mergeTargets: s.mergeTargets.includes(featureId)
        ? s.mergeTargets.filter((id) => id !== featureId)
        : [...s.mergeTargets, featureId],
    }));
  }, []);

  const undoAction = useCallback(() => {
    setState((s) => {
      if (!canUndo(s.undoStackState)) return s;
      const prevGeom = getUndoGeometry(s.undoStackState);
      if (!prevGeom) return s;
      const entry = s.undoStackState.entries[s.undoStackState.position];
      return {
        ...s,
        ...withNeighborChanges(s, entry?.neighbors, "before"),
        geometry: prevGeom,
        undoStackState: undoStack(s.undoStackState),
        isDirty: true,
        areaKm2: calculateArea(prevGeom),
      };
    });
  }, []);

  const redoAction = useCallback(() => {
    setState((s) => {
      if (!canRedo(s.undoStackState)) return s;
      const nextGeom = getRedoGeometry(s.undoStackState);
      if (!nextGeom) return s;
      const entry = s.undoStackState.entries[s.undoStackState.position + 1];
      return {
        ...s,
        ...withNeighborChanges(s, entry?.neighbors, "after"),
        geometry: nextGeom,
        undoStackState: redoStack(s.undoStackState),
        isDirty: true,
        areaKm2: calculateArea(nextGeom),
      };
    });
  }, []);

  const submitEditAction = useCallback(
    async (applyDirectly = false, reason?: string) => {
      const { featureId, geometry, dirtyNeighbors } = stateRef.current;
      if (!featureId || !geometry) {
        throw new Error("No feature loaded");
      }

      const validation = validateGeometry(geometry);
      if (!validation.valid) {
        throw new Error(`Invalid geometry: ${validation.errors.join(", ")}`);
      }

      const neighborUpdates = Object.entries(dirtyNeighbors).map(([nFeatureId, shape]) => ({
        featureId: nFeatureId,
        geometry: { ...shape },
      }));

      const result = await submitBorderEdit({
        featureId,
        editSubtype: "vertex_edit",
        proposedGeometry: { ...geometry },
        neighborUpdates,
        applyDirectly,
        reason,
        realm,
      });

      if (result.applied) {
        await refreshMapViews(utils);
        setState((s) => ({
          ...s,
          originalGeometry: s.geometry,
          isDirty: false,
          dirtyNeighbors: {},
          originalNeighborGeometries: s.neighborGeometries,
          undoStackState: createUndoStack(),
        }));
      }

      return result;
    },
    [submitBorderEdit, utils, realm]
  );

  const executeSplitAction = useCallback(
    async (nameA: string, nameB: string) => {
      const { featureId, splitLine } = stateRef.current;
      if (!featureId || splitLine.length < 2) {
        throw new Error("Need a feature and at least 2 split line points");
      }

      await splitCountry({
        featureId,
        splitLine: splitLine as [number, number][],
        nameA,
        nameB,
        realm,
      });

      await refreshMapViews(utils);
      setState(INITIAL_STATE);
    },
    [splitCountry, utils, realm]
  );

  const executeMergeAction = useCallback(
    async (newName: string) => {
      const { featureId, mergeTargets } = stateRef.current;
      if (!featureId || mergeTargets.length === 0) {
        throw new Error("Select at least one neighbor to merge with");
      }

      await mergeCountries({ featureIds: [featureId, ...mergeTargets], newName, realm });

      await refreshMapViews(utils);
      setState(INITIAL_STATE);
    },
    [mergeCountries, utils, realm]
  );

  const reset = useCallback(() => {
    setState(INITIAL_STATE);
  }, []);

  const revert = useCallback(() => {
    setState((s) => {
      if (!s.featureId) return s;
      return {
        ...s,
        geometry: s.originalGeometry,
        neighborGeometries: s.originalNeighborGeometries,
        dirtyNeighbors: {},
        undoStackState: createUndoStack(),
        selectedVertex: null,
        splitLine: [],
        mergeTargets: [],
        traceStart: null,
        isDirty: false,
        areaKm2: s.originalGeometry ? calculateArea(s.originalGeometry) : null,
      };
    });
  }, []);

  const restoreDraft = useCallback((draft: BorderDraft) => {
    setState((s) => {
      if (s.pendingDraft !== draft || !s.geometry) return s;
      // Only neighbours of this feature can have moved with it
      const moved = Object.fromEntries(
        Object.entries(draft.dirtyNeighbors).filter(([id]) =>
          Object.hasOwn(s.neighborGeometries, id)
        )
      );
      return {
        ...s,
        pendingDraft: null,
        geometry: draft.geometry,
        neighborGeometries: { ...s.neighborGeometries, ...moved },
        dirtyNeighbors: moved,
        selectedVertex: null,
        isDirty: true,
        areaKm2: calculateArea(draft.geometry),
      };
    });
  }, []);

  const discardDraft = useCallback(
    (draft: BorderDraft) => {
      // Only the draft on offer: a late answer for a feature since replaced must not reset another's
      if (stateRef.current.pendingDraft !== draft) return;
      setState((s) => (s.pendingDraft === draft ? { ...s, pendingDraft: null } : s));
      clearDraft();
    },
    [clearDraft]
  );

  const repairAction = useCallback(async () => {
    const { geometry } = stateRef.current;
    if (!geometry) return;
    const res = await repairGeometry({ geometry: { ...geometry } });
    setState((s) => withEdit(s, "snap", res.geometry as Polygon | MultiPolygon));
  }, [repairGeometry]);

  const smoothAction = useCallback(() => {
    setState((s) => (s.geometry ? withEdit(s, "smooth", smoothGeometry(s.geometry, 1)) : s));
  }, []);

  const naturalizeAction = useCallback(() => {
    setState((s) => {
      const seed = Date.now() & 0xffff;
      return s.geometry ? withEdit(s, "naturalize", naturalizeGeometry(s.geometry, 0.01, seed)) : s;
    });
  }, []);

  const setTraceLayerSourceAction = useCallback(
    (
      layers: Array<{ type: string; data: { features: TraceFeature[] } }> | undefined,
      visibleLayers: Set<string>
    ) => {
      traceLayersRef.current = layers;
      traceVisibleLayersRef.current = visibleLayers;
    },
    []
  );

  const simplifyAction = useCallback(() => {
    setState((s) => (s.geometry ? withEdit(s, "simplify", simplifyGeometry(s.geometry, 0.01)) : s));
  }, []);

  const applyBrushTransferAction = useCallback(
    (strokePoints: [number, number][], radiusKm: number, targetFeatureId: string): boolean => {
      // The stroke's boolean ops (70-130 ms) run here, from the latest state, not inside an updater
      const { geometry, neighborGeometries } = stateRef.current;
      const targetGeom = neighborGeometries[targetFeatureId];
      const result =
        geometry && targetGeom && applyBrushStroke(strokePoints, radiusKm, geometry, targetGeom);
      if (!result || !targetGeom) return false;

      setState((s) => {
        if (!s.geometry) return s;
        const newStack = pushUndo(s.undoStackState, "brush", s.geometry, result.source, {
          [targetFeatureId]: { before: targetGeom, after: result.target },
        });
        return {
          ...s,
          geometry: result.source,
          neighborGeometries: { ...s.neighborGeometries, [targetFeatureId]: result.target },
          dirtyNeighbors: { ...s.dirtyNeighbors, [targetFeatureId]: result.target },
          undoStackState: newStack,
          isDirty: true,
          areaKm2: calculateArea(result.source),
        };
      });
      return true;
    },
    []
  );

  const actions = useMemo<BorderEditorActions>(
    () => ({
      loadFeature,
      setMode,
      handleMapClick,
      handleVertexDrag,
      commitDrag,
      addSplitPoint,
      clearSplitLine,
      toggleMergeTarget,
      undo: undoAction,
      redo: redoAction,
      save,
      submitEdit: submitEditAction,
      executeSplit: executeSplitAction,
      executeMerge: executeMergeAction,
      repair: repairAction,
      smooth: smoothAction,
      naturalize: naturalizeAction,
      simplify: simplifyAction,
      reset,
      revert,
      restoreDraft,
      discardDraft,
      setTraceLayerSource: setTraceLayerSourceAction,
      applyBrushTransfer: applyBrushTransferAction,
    }),
    [
      loadFeature,
      setMode,
      handleMapClick,
      handleVertexDrag,
      commitDrag,
      addSplitPoint,
      clearSplitLine,
      toggleMergeTarget,
      undoAction,
      redoAction,
      save,
      submitEditAction,
      executeSplitAction,
      executeMergeAction,
      repairAction,
      smoothAction,
      naturalizeAction,
      simplifyAction,
      reset,
      revert,
      restoreDraft,
      discardDraft,
      setTraceLayerSourceAction,
      applyBrushTransferAction,
    ]
  );

  return [state, actions];
}
