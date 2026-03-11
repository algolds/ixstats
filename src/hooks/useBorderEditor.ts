"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import type { Position, Polygon, MultiPolygon } from "geojson";
import { api } from "~/trpc/react";
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
} from "~/lib/border-editor";
import type {
  SharedVertexData,
  FeatureVertexRef,
} from "~/lib/shared-vertex-builder";

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

export type BorderEditMode =
  | "select"
  | "vertex_edit"
  | "freehand"
  | "split"
  | "merge";

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
  isDirty: boolean;
  isLoading: boolean;
  error: string | null;
  areaKm2: number | null;
  /** Shared vertices for the currently loaded feature */
  sharedVertices: SharedVertexData[];
  /** Active altitude snap indicator */
  altitudeSnap: AltitudeSnapResult | null;
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
  submitEdit: (applyDirectly?: boolean) => Promise<{ applied: boolean; editRequestId: string | null }>;
  executeSplit: (nameA: string, nameB: string) => Promise<void>;
  executeMerge: (newName: string) => Promise<void>;
  reset: () => void;
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
  isDirty: false,
  isLoading: false,
  error: null,
  areaKm2: null,
  sharedVertices: [],
  altitudeSnap: null,
};

export function useBorderEditor(): [BorderEditorState, BorderEditorActions] {
  const [state, setState] = useState<BorderEditorState>(INITIAL_STATE);
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const startSession = api.geo.startBorderEditSession.useMutation();
  const saveDraft = api.geo.saveBorderEditDraft.useMutation();
  const submitBorderEdit = api.geo.submitBorderEdit.useMutation();
  const splitCountry = api.geo.splitCountry.useMutation();
  const mergeCountries = api.geo.mergeCountries.useMutation();
  const utils = api.useUtils();
  const dragStartGeom = useRef<Polygon | MultiPolygon | null>(null);
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

  const loadFeature = useCallback((featureId: string) => {
    setState((s) => ({ ...s, isLoading: true, error: null }));
    startSession.mutate(
      { featureId },
      {
        onSuccess: (data) => {
          const geom = data.feature.geometry as Polygon | MultiPolygon;
          setState((s) => ({
            ...s,
            featureId,
            sessionId: data.session.id,
            geometry: geom,
            originalGeometry: geom,
            neighbors: data.neighbors,
            undoStackState: createUndoStack(),
            selectedVertex: null,
            splitLine: [],
            mergeTargets: [],
            isDirty: false,
            isLoading: false,
            error: null,
            areaKm2: calculateArea(geom),
            sharedVertices: (data as { sharedVertices?: SharedVertexData[] }).sharedVertices ?? [],
            altitudeSnap: null,
          }));
        },
        onError: (err) => {
          setState((s) => ({ ...s, isLoading: false, error: err.message }));
        },
      }
    );
  }, [startSession]);

  const setMode = useCallback((mode: BorderEditMode) => {
    setState((s) => ({
      ...s,
      mode,
      selectedVertex: null,
      splitLine: mode === "split" ? [] : s.splitLine,
      mergeTargets: mode === "merge" ? [] : s.mergeTargets,
    }));
  }, []);

  const updateGeometry = useCallback(
    (
      newGeom: Polygon | MultiPolygon,
      action: Parameters<typeof pushUndo>[1]
    ) => {
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
          const newStack = pushUndo(s.undoStackState, {
            type: "add_vertex",
            edge: nearestEdge.ref,
            at: point,
          }, s.geometry, newGeom);
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
      const newStack = pushUndo(
        s.undoStackState,
        { type: "move_vertex", ref: s.selectedVertex ?? { ringIndex: 0, vertexIndex: 0, coord: [0, 0] }, to: s.selectedVertex?.coord ?? [0, 0] },
        beforeDrag,
        s.geometry
      );
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

  const submitEditAction = useCallback(async (applyDirectly = false) => {
    if (!state.featureId || !state.geometry) {
      throw new Error("No feature loaded");
    }

    const validation = validateGeometry(state.geometry);
    if (!validation.valid) {
      throw new Error(`Invalid geometry: ${validation.errors.join(", ")}`);
    }

    const result = await submitBorderEdit.mutateAsync({
      featureId: state.featureId,
      editSubtype: "vertex_edit",
      proposedGeometry: state.geometry as unknown as Record<string, unknown>,
      applyDirectly,
    });

    if (result.applied) {
      await utils.geo.getWorldMap.invalidate();
      setState((s) => ({
        ...s,
        originalGeometry: s.geometry,
        isDirty: false,
        undoStackState: createUndoStack(),
      }));
    }

    return result;
  }, [state.featureId, state.geometry, submitBorderEdit, utils]);

  const executeSplitAction = useCallback(async (nameA: string, nameB: string) => {
    if (!state.featureId || state.splitLine.length < 2) {
      throw new Error("Need a feature and at least 2 split line points");
    }

    await splitCountry.mutateAsync({
      featureId: state.featureId,
      splitLine: state.splitLine as [number, number][],
      nameA,
      nameB,
    });

    await utils.geo.getWorldMap.invalidate();
    setState(INITIAL_STATE);
  }, [state.featureId, state.splitLine, splitCountry, utils]);

  const executeMergeAction = useCallback(async (newName: string) => {
    if (!state.featureId || state.mergeTargets.length === 0) {
      throw new Error("Select at least one neighbor to merge with");
    }

    await mergeCountries.mutateAsync({
      featureIds: [state.featureId, ...state.mergeTargets],
      newName,
    });

    await utils.geo.getWorldMap.invalidate();
    setState(INITIAL_STATE);
  }, [state.featureId, state.mergeTargets, mergeCountries, utils]);

  const reset = useCallback(() => {
    setState(INITIAL_STATE);
  }, []);

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
    reset,
  };

  return [state, actions];
}
