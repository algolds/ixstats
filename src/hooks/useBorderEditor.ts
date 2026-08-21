"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import type { Position, Polygon, MultiPolygon } from "geojson";
import { api } from "~/trpc/react";
import { applyBrushStroke } from "~/lib/maps/territory-brush";
import {
  type UndoStack,
  type VertexRef,
  type EdgeRef,
  type AltitudeSnapResult,
  createUndoStack,
  pushUndo,
  canUndo,
  canRedo,
  getUndoGeometry,
  getRedoGeometry,
  undo as undoStack,
  redo as redoStack,
  moveVertex,
  addVertex,
  removeVertex,
  findNearestVertex,
  findNearestEdge,
  findNearestAltitudeSnap,
  getVertices,
  calculateArea,
  calculateBBox,
  validateGeometry,
  distanceDeg,
  smoothGeometry,
  naturalizeGeometry,
  simplifyGeometry,
} from "~/lib/maps/border-editor";
import { buildSharedVertexIndex, moveSharedVertex } from "~/lib/maps/shared-vertex-builder";
import type { SharedVertexData } from "~/lib/maps/shared-vertex-builder";
import type { FeatureVertexRef } from "~/lib/maps/shared-vertex-builder";
import { traceAlongLayer } from "~/lib/maps/border-trace";
import type { TraceFeature } from "~/lib/maps/border-trace";

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

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
  isDirty: boolean;
  isLoading: boolean;
  error: string | null;
  areaKm2: number | null;
  /** Shared vertices for the currently loaded feature */
  sharedVertices: SharedVertexData[];
  /** Active altitude snap indicator */
  altitudeSnap: AltitudeSnapResult | null;
  traceStart: [number, number] | null;
}

export interface BorderEditorActions {
  loadFeature: (featureId: string) => void;
  setMode: (mode: BorderEditMode) => void;
  handleMapClick: (lng: number, lat: number) => void;
  handleVertexDrag: (ref: VertexRef, to: Position) => void;
  commitDrag: () => void;
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

// ──────────────────────────────────────────────
// Hook
// ──────────────────────────────────────────────

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
  isDirty: false,
  isLoading: false,
  error: null,
  areaKm2: null,
  sharedVertices: [],
  altitudeSnap: null,
  traceStart: null,
};

export function useBorderEditor(): [BorderEditorState, BorderEditorActions] {
  const [state, setState] = useState<BorderEditorState>(INITIAL_STATE);
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const startSession = api.geoEditor.startBorderEditSession.useMutation();
  const saveDraft = api.geoEditor.saveBorderEditDraft.useMutation();
  const submitBorderEdit = api.geoEditor.submitBorderEdit.useMutation();
  const splitCountry = api.geoEditor.splitCountry.useMutation();
  const mergeCountries = api.geoEditor.mergeCountries.useMutation();
  const repairGeometry = api.geoEditor.repairBorderGeometry.useMutation();
  const utils = api.useUtils();
  const dragStartGeom = useRef<Polygon | MultiPolygon | null>(null);

  // ── Trace mode state (mutable refs) ──
  /** River/coast layer data updated externally via setTraceLayerSource. */
  const traceLayersRef = useRef<
    Array<{ type: string; data: { features: TraceFeature[] } }> | undefined
  >(undefined);
  /** Currently visible layer IDs (used to filter to "rivers" etc.). */
  const traceVisibleLayersRef = useRef<Set<string>>(new Set());

  // Keep saveDraft in a ref to avoid resetting the auto-save timer on every render
  const saveDraftRef = useRef(saveDraft);
  saveDraftRef.current = saveDraft;

  // Ref to always have current auto-save data without resetting the timer
  const autoSaveDataRef = useRef({
    geometry: state.geometry,
    undoStack: state.undoStackState,
    mode: state.mode,
  });
  autoSaveDataRef.current = {
    geometry: state.geometry,
    undoStack: state.undoStackState,
    mode: state.mode,
  };

  // Auto-save draft every 30 seconds when dirty.
  // Only depends on isDirty, sessionId, and geometry identity so that mode
  // switches and undo/redo don't reset the timer. The callback reads current
  // state from autoSaveDataRef to always save the latest data.
  useEffect(() => {
    if (state.isDirty && state.sessionId && state.geometry) {
      autoSaveTimer.current = setTimeout(() => {
        const data = autoSaveDataRef.current;
        if (!data.geometry) return;
        saveDraftRef.current.mutate({
          sessionId: state.sessionId!,
          sessionData: {
            geometry: data.geometry,
            undoStack: data.undoStack,
            mode: data.mode,
          },
        });
      }, 30000);
    }
    return () => {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    };
  }, [state.isDirty, state.sessionId, state.geometry]);

  const loadFeature = useCallback(
    (featureId: string) => {
      setState((s) => ({ ...s, isLoading: true, error: null }));
      startSession.mutate(
        { featureId },
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
            const sharedVertices = buildSharedVertexIndex([
              { featureId, geometry: geom },
              ...Object.entries(neighborGeoms).map(([fid, g]) => ({
                featureId: fid,
                geometry: g,
              })),
            ]);
            setState((s) => ({
              ...s,
              featureId,
              sessionId: data.session.id,
              geometry: geom,
              originalGeometry: geom,
              neighbors: data.neighbors,
              neighborGeometries: neighborGeoms,
              dirtyNeighbors: {},
              undoStackState: createUndoStack(),
              selectedVertex: null,
              splitLine: [],
              mergeTargets: [],
              isDirty: false,
              isLoading: false,
              error: null,
              areaKm2: calculateArea(geom),
              sharedVertices,
              altitudeSnap: null,
              traceStart: null,
            }));
          },
          onError: (err) => {
            setState((s) => ({ ...s, isLoading: false, error: err.message }));
          },
        }
      );
    },
    [startSession]
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

  const updateGeometry = useCallback(
    (newGeom: Polygon | MultiPolygon, action: Parameters<typeof pushUndo>[1]) => {
      setState((s) => {
        if (!s.geometry) return s;
        const newStack = pushUndo(s.undoStackState, action, s.geometry, newGeom);
        return {
          ...s,
          geometry: newGeom,
          undoStackState: newStack,
          isDirty: true,
          areaKm2: calculateArea(newGeom),
        };
      });
    },
    []
  );

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

  // Drag moves geometry without pushing undo (called per mousemove)
  const handleVertexDrag = useCallback((ref: VertexRef, to: Position) => {
    setState((s) => {
      if (!s.geometry) return s;
      // Capture the pre-drag geometry on the first drag event
      if (!dragStartGeom.current) {
        dragStartGeom.current = s.geometry;
      }

      // Is the vertex being dragged a shared one? Match on its CURRENT coord.
      const here = ref.coord;
      const shared = s.sharedVertices.find((sv) => distanceDeg([sv.lng, sv.lat], here) < 0.001);

      if (shared) {
        const geomMap = new Map<string, Polygon | MultiPolygon>();
        geomMap.set(s.featureId!, s.geometry);
        for (const [fid, g] of Object.entries(s.neighborGeometries)) geomMap.set(fid, g);
        const updated = moveSharedVertex(shared, to, geomMap);

        const newSelf = updated.get(s.featureId!) ?? s.geometry;
        const newNeighbors: Record<string, Polygon | MultiPolygon> = { ...s.neighborGeometries };
        const newDirty: Record<string, Polygon | MultiPolygon> = { ...s.dirtyNeighbors };
        for (const [fid, g] of updated) {
          if (fid === s.featureId) continue;
          newNeighbors[fid] = g;
          newDirty[fid] = g;
        }
        // Update the shared-vertex's stored coord so the next drag event still matches.
        const newShared = s.sharedVertices.map((sv) =>
          sv === shared ? { ...sv, lng: to[0], lat: to[1] } : sv
        );
        return {
          ...s,
          geometry: newSelf,
          neighborGeometries: newNeighbors,
          dirtyNeighbors: newDirty,
          sharedVertices: newShared,
          isDirty: true,
          areaKm2: calculateArea(newSelf),
          selectedVertex: { ...ref, coord: to },
        };
      }

      // Not shared — original single-feature behavior.
      const newGeom = moveVertex(s.geometry, ref, to);
      return {
        ...s,
        geometry: newGeom,
        isDirty: true,
        areaKm2: calculateArea(newGeom),
        selectedVertex: { ...ref, coord: to },
      };
    });
  }, []);

  // Commit the drag as a single undo entry (called on mouseup)
  const commitDrag = useCallback(() => {
    setState((s) => {
      const beforeDrag = dragStartGeom.current;
      dragStartGeom.current = null;
      if (!beforeDrag || !s.geometry) return s;
      // Don't push if geometry didn't actually change
      if (beforeDrag === s.geometry) return s;
      const newStack = pushUndo(s.undoStackState, "move_vertex", beforeDrag, s.geometry);
      return { ...s, undoStackState: newStack };
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
      return {
        ...s,
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
      return {
        ...s,
        geometry: nextGeom,
        undoStackState: redoStack(s.undoStackState),
        isDirty: true,
        areaKm2: calculateArea(nextGeom),
      };
    });
  }, []);

  const save = useCallback(async () => {
    if (!state.sessionId || !state.geometry) return;
    await saveDraft.mutateAsync({
      sessionId: state.sessionId,
      sessionData: {
        geometry: state.geometry,
        undoStack: state.undoStackState,
        mode: state.mode,
      },
    });
  }, [state.sessionId, state.geometry, state.undoStackState, state.mode, saveDraft]);

  const submitEditAction = useCallback(
    async (applyDirectly = false, reason?: string) => {
      if (!state.featureId || !state.geometry) {
        throw new Error("No feature loaded");
      }

      const validation = validateGeometry(state.geometry);
      if (!validation.valid) {
        throw new Error(`Invalid geometry: ${validation.errors.join(", ")}`);
      }

      const neighborUpdates = Object.entries(state.dirtyNeighbors).map(
        ([nFeatureId, geometry]) => ({
          featureId: nFeatureId,
          geometry: geometry as unknown as Record<string, unknown>,
        })
      );

      const result = await submitBorderEdit.mutateAsync({
        featureId: state.featureId,
        editSubtype: "vertex_edit",
        proposedGeometry: state.geometry as unknown as Record<string, unknown>,
        neighborUpdates,
        applyDirectly,
        reason,
      });

      if (result.applied) {
        await utils.geoCore.getWorldMap.invalidate();
        await utils.geoCore.getMapBundle.invalidate();
        await utils.geoCore.getCountryGeometry.invalidate();
        await utils.countryGeo.getCountryGeoBundle.invalidate();
        await utils.geoCore.getNeighborGeometries.invalidate();
        setState((s) => ({
          ...s,
          originalGeometry: s.geometry,
          isDirty: false,
          dirtyNeighbors: {},
          undoStackState: createUndoStack(),
        }));
      }

      return result;
    },
    [state.featureId, state.geometry, state.dirtyNeighbors, submitBorderEdit, utils]
  );

  const executeSplitAction = useCallback(
    async (nameA: string, nameB: string) => {
      if (!state.featureId || state.splitLine.length < 2) {
        throw new Error("Need a feature and at least 2 split line points");
      }

      await splitCountry.mutateAsync({
        featureId: state.featureId,
        splitLine: state.splitLine as [number, number][],
        nameA,
        nameB,
      });

      await utils.geoCore.getWorldMap.invalidate();
      await utils.geoCore.getMapBundle.invalidate();
      await utils.geoCore.getCountryGeometry.invalidate();
      await utils.countryGeo.getCountryGeoBundle.invalidate();
      await utils.geoCore.getNeighborGeometries.invalidate();
      setState(INITIAL_STATE);
    },
    [state.featureId, state.splitLine, splitCountry, utils]
  );

  const executeMergeAction = useCallback(
    async (newName: string) => {
      if (!state.featureId || state.mergeTargets.length === 0) {
        throw new Error("Select at least one neighbor to merge with");
      }

      await mergeCountries.mutateAsync({
        featureIds: [state.featureId, ...state.mergeTargets],
        newName,
      });

      await utils.geoCore.getWorldMap.invalidate();
      await utils.geoCore.getMapBundle.invalidate();
      await utils.geoCore.getCountryGeometry.invalidate();
      await utils.countryGeo.getCountryGeoBundle.invalidate();
      await utils.geoCore.getNeighborGeometries.invalidate();
      setState(INITIAL_STATE);
    },
    [state.featureId, state.mergeTargets, mergeCountries, utils]
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

  const repairAction = useCallback(async () => {
    if (!state.geometry) return;
    const res = await repairGeometry.mutateAsync({
      geometry: state.geometry as unknown as Record<string, unknown>,
    });
    const repaired = res.geometry as Polygon | MultiPolygon;
    setState((s) => {
      if (!s.geometry) return s;
      const stack = pushUndo(s.undoStackState, "snap", s.geometry, repaired);
      return {
        ...s,
        geometry: repaired,
        undoStackState: stack,
        isDirty: true,
        areaKm2: calculateArea(repaired),
      };
    });
  }, [state.geometry, repairGeometry]);

  const smoothAction = useCallback(() => {
    setState((s) => {
      if (!s.geometry) return s;
      const newGeom = smoothGeometry(s.geometry, 1);
      const stack = pushUndo(s.undoStackState, "smooth", s.geometry, newGeom);
      return {
        ...s,
        geometry: newGeom,
        undoStackState: stack,
        isDirty: true,
        areaKm2: calculateArea(newGeom),
      };
    });
  }, []);

  const naturalizeAction = useCallback(() => {
    setState((s) => {
      if (!s.geometry) return s;
      const seed = Date.now() & 0xffff;
      const newGeom = naturalizeGeometry(s.geometry, 0.01, seed);
      const stack = pushUndo(s.undoStackState, "naturalize", s.geometry, newGeom);
      return {
        ...s,
        geometry: newGeom,
        undoStackState: stack,
        isDirty: true,
        areaKm2: calculateArea(newGeom),
      };
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
    setState((s) => {
      if (!s.geometry) return s;
      const newGeom = simplifyGeometry(s.geometry, 0.01);
      const stack = pushUndo(s.undoStackState, "simplify", s.geometry, newGeom);
      return {
        ...s,
        geometry: newGeom,
        undoStackState: stack,
        isDirty: true,
        areaKm2: calculateArea(newGeom),
      };
    });
  }, []);

  const brushResultRef = useRef<boolean>(false);

  const applyBrushTransferAction = useCallback(
    (strokePoints: [number, number][], radiusKm: number, targetFeatureId: string): boolean => {
      brushResultRef.current = false;
      setState((s) => {
        if (!s.geometry) return s;
        const targetGeom = s.neighborGeometries[targetFeatureId];
        if (!targetGeom) return s;

        const result = applyBrushStroke(strokePoints, radiusKm, s.geometry, targetGeom);
        if (!result) return s;

        const newDirty: Record<string, Polygon | MultiPolygon> = {
          ...s.neighborGeometries,
        };
        newDirty[targetFeatureId] = result.target;
        for (const [fid] of Object.entries(s.dirtyNeighbors)) {
          if (fid !== targetFeatureId) newDirty[fid] = s.dirtyNeighbors[fid]!;
        }

        const newStack = pushUndo(s.undoStackState, "brush", s.geometry, result.source);

        brushResultRef.current = true;

        return {
          ...s,
          geometry: result.source,
          dirtyNeighbors: newDirty,
          undoStackState: newStack,
          isDirty: true,
          areaKm2: calculateArea(result.source),
        };
      });
      return brushResultRef.current;
    },
    []
  );

  const actions: BorderEditorActions = {
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
    setTraceLayerSource: setTraceLayerSourceAction,
    applyBrushTransfer: applyBrushTransferAction,
  };

  return [state, actions];
}
