"use client";

/**
 * useMapEditor - State management orchestrator hook for the MyCountry map editor.
 * Decomposed into modular sub-hooks under src/hooks/map-editor/ (Plan 175).
 *
 * Every server write goes through the history executor so it lands on the undo
 * stack: creates, deletes, attribute edits, point drags, region reshapes,
 * duplicates, bulk operations and the city placement tools.
 */

import { useState, useCallback, useMemo, useRef } from "react";
import { useMapHistory, type EditorAction, type HistoryData } from "./map-editor/useMapHistory";
import { useMapEditorSync } from "./map-editor/useMapEditorSync";
import { useMapEditorSelection } from "./map-editor/useMapEditorSelection";
import { useMapEditorTransforms } from "./map-editor/useMapEditorTransforms";
import { useMapEditorBulkOps } from "./map-editor/useMapEditorBulkOps";
import { useMapEditorRoutes } from "./map-editor/useMapEditorRoutes";
import { useMapFeatureMutations } from "./map-editor/useMapFeatureMutations";
import { useHistoryReversalExecutor } from "./map-editor/useHistoryReversalExecutor";
import { mapFeatureToEditState } from "./map-editor/feature-form-mapper";
import { isPolygonal } from "./map-editor/editor-geo-ops";

export * from "./map-editor/editor-types";
import { buildDuplicateInput } from "./map-editor/editor-types";
import type {
  EditorMode,
  FeatureType,
  EditorFeature,
  CityFormData,
  SubdivisionFormData,
  POIFormData,
  StoryPinFormData,
  MapLabelFormData,
  PeakFormData,
  NamedRiverFormData,
  NamedLakeFormData,
} from "./map-editor/editor-types";

import {
  DEFAULT_CITY,
  DEFAULT_SUBDIVISION,
  DEFAULT_POI,
  DEFAULT_STORY_PIN,
  DEFAULT_MAP_LABEL,
  DEFAULT_PEAK,
  DEFAULT_RIVER,
  DEFAULT_LAKE,
} from "./map-editor/map-editor-defaults";

interface UseMapEditorOptions {
  skipLinkageGate?: boolean;
  worldMapLayers?: import("~/components/maps/core/IxWorldMap").MapLayerData[];
}

export type { BulkEditField } from "./map-editor/useMapEditorBulkOps";

/** In-progress work that has not reached the server yet (see useEditorDraft). */
export interface EditorDraft {
  mode: EditorMode;
  pendingCoordinates: [number, number] | null;
  pendingGeometry: object | null;
  routeWaypoints: [number, number][];
  riverPath: [number, number][];
  routeType: string;
  cityForm?: CityFormData;
  subdivisionForm?: SubdivisionFormData;
  poiForm?: POIFormData;
  peakForm?: PeakFormData;
  riverForm?: NamedRiverFormData;
  lakeForm?: NamedLakeFormData;
  savedAt: number;
}

/** Keeps the previous object when every value is identical, so consumers can memoize on it. */
function useShallowStable<T extends Record<string, unknown>>(next: T): T {
  const ref = useRef(next);
  const prev = ref.current;
  if (prev !== next) {
    const keys = Object.keys(next);
    const changed =
      keys.length !== Object.keys(prev).length || keys.some((k) => !Object.is(prev[k], next[k]));
    // oxlint-disable-next-line -- derived memo: identical inputs keep the previous identity
    if (changed) ref.current = next;
  }
  return ref.current;
}

function errMsg(e: unknown, fallback: string): string {
  return e instanceof Error && e.message ? e.message : fallback;
}

export function useMapEditor(countryId: string | undefined, options?: UseMapEditorOptions) {
  // ── Core Editor Mode & Selection ──
  const [mode, setModeState] = useState<EditorMode>("view");
  const [selectedFeature, setSelectedFeature] = useState<EditorFeature | null>(null);
  const [pendingCoordinates, setPendingCoordinates] = useState<[number, number] | null>(null);
  const [pendingGeometry, setPendingGeometry] = useState<object | null>(null);
  const [isPickingLocation, setIsPickingLocation] = useState(false);

  // ── Forms ──
  const [cityForm, setCityForm] = useState<CityFormData>(DEFAULT_CITY);
  const [subdivisionForm, setSubdivisionForm] = useState<SubdivisionFormData>(DEFAULT_SUBDIVISION);
  const [poiForm, setPOIForm] = useState<POIFormData>(DEFAULT_POI);
  const [storyPinForm, setStoryPinForm] = useState<StoryPinFormData>(DEFAULT_STORY_PIN);
  const [mapLabelForm, setMapLabelForm] = useState<MapLabelFormData>(DEFAULT_MAP_LABEL);
  const [peakForm, setPeakForm] = useState<PeakFormData>(DEFAULT_PEAK);
  const [riverForm, setRiverForm] = useState<NamedRiverFormData>(DEFAULT_RIVER);
  const [lakeForm, setLakeForm] = useState<NamedLakeFormData>(DEFAULT_LAKE);

  // ── Route / river / split-line drawing ──
  const [riverPath, setRiverPath] = useState<[number, number][]>([]);
  const [splitLine, setSplitLine] = useState<[number, number][]>([]);
  const [draggingVertexIndex, setDraggingVertexIndex] = useState<number | null>(null);
  const [snapTarget, setSnapTarget] = useState<[number, number] | null>(null);
  const [isSnapEnabled, setIsSnapEnabled] = useState(true);

  // ── Gaps & Negative Space ──
  const [showGaps, setShowGaps] = useState(false);

  const [mutationError, setMutationError] = useState<string | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [validationErrors] = useState<Record<string, string>>({});

  /** Mode switch that also clears the per-mode scratch state (river/split lines). */
  const modeRef = useRef(mode);
  // oxlint-disable-next-line -- latest-value ref read by the stable setMode below
  modeRef.current = mode;
  const setMode = useCallback((next: EditorMode | ((prev: EditorMode) => EditorMode)) => {
    const prev = modeRef.current;
    const resolved = typeof next === "function" ? next(prev) : next;
    if (resolved !== prev) {
      if (prev === "split-subdivision") setSplitLine([]);
      if (prev === "add-river") setRiverPath([]);
    }
    modeRef.current = resolved;
    setModeState(resolved);
  }, []);

  // ── Sub-Hooks ──
  const historyHook = useMapHistory();
  const {
    history,
    canUndo: historyCanUndo,
    canRedo: historyCanRedo,
    pushAction,
    stepUndo,
    stepRedo,
  } = historyHook;

  const sync = useMapEditorSync({
    countryId,
    skipLinkageGate: options?.skipLinkageGate,
  });

  const {
    countryGeo,
    geometryLoading,
    linkage,
    linkageLoading,
    features,
    featuresLoading,
    allFeatures,
    refetchFeatures,
    debouncedRefetch,
    invalidateAllMapData,
  } = sync;

  const selection = useMapEditorSelection({
    allFeatures,
    countryId,
    onRefresh: refetchFeatures,
  });

  const {
    selectedIds,
    setSelectedIds,
    toggleSelectId,
    clearMultiSelect,
    rulerPoints,
    setRulerPoints,
    addRulerPoint,
    clearRuler,
    lassoTool,
    setLassoTool,
    lassoGeometry,
    setLassoGeometry,
    applyLassoSelection,
    applyRectSelection,
    guides,
    setGuides,
  } = selection;

  const selectAll = useCallback(
    (predicate?: (f: EditorFeature) => boolean) => {
      setSelectedIds(
        new Set(
          allFeatures
            .filter((f) => f.type !== "gap" && (!predicate || predicate(f)))
            .map((f) => f.id)
        )
      );
    },
    [allFeatures, setSelectedIds]
  );

  const transforms = useMapEditorTransforms({
    countryId,
    allFeatures,
    selectedIds,
    clearMultiSelect,
    invalidateAllMapData,
    debouncedRefetch,
    pushAction,
    setMutationError,
    setLastSavedAt,
  });

  // ── Reset & Start Editing ──
  const resetForm = useCallback(() => {
    setCityForm(DEFAULT_CITY);
    setSubdivisionForm(DEFAULT_SUBDIVISION);
    setPOIForm(DEFAULT_POI);
    setStoryPinForm(DEFAULT_STORY_PIN);
    setMapLabelForm(DEFAULT_MAP_LABEL);
    setPeakForm(DEFAULT_PEAK);
    setRiverForm(DEFAULT_RIVER);
    setLakeForm(DEFAULT_LAKE);
    setPendingCoordinates(null);
    setPendingGeometry(null);
    setSelectedFeature(null);
    setMutationError(null);
    setRiverPath([]);
    setSplitLine([]);
  }, []);

  // ── Mutations Sub-Hook ──
  const mutations = useMapFeatureMutations({
    countryId,
    selectedFeature,
    pendingCoordinates,
    pendingGeometry,
    cityForm,
    subdivisionForm,
    poiForm,
    storyPinForm,
    mapLabelForm,
    peakForm,
    riverForm,
    lakeForm,
    resetForm,
    setMode,
    invalidateAllMapData,
    debouncedRefetch,
    setLastSavedAt,
    setMutationError,
    pushAction,
  });

  const historyExecutor = useHistoryReversalExecutor({
    countryId,
    invalidateAllMapData,
    debouncedRefetch,
  });

  const afterWrite = useCallback(() => {
    invalidateAllMapData();
    setLastSavedAt(new Date());
    setMutationError(null);
  }, [invalidateAllMapData]);

  /** Applies an action forward against the server and records it on the undo stack. */
  const commitAction = useCallback(
    async (action: Omit<EditorAction, "timestamp">) => {
      await historyExecutor.applyForwardAction({ ...action, timestamp: Date.now() });
      pushAction(action);
      afterWrite();
    },
    [historyExecutor, pushAction, afterWrite]
  );

  const routes = useMapEditorRoutes({
    countryId,
    allFeatures,
    selectedFeature,
    setMode,
    pushAction,
    afterWrite,
    setMutationError,
    commitAction,
  });
  const {
    routeWaypoints,
    setRouteWaypoints,
    routeType,
    setRouteType,
    editingRouteId,
    setEditingRouteId,
    editingRouteVertices,
    setEditingRouteVertices,
  } = routes;

  // Undo/redo run one at a time — a second Ctrl+Z while the first is in flight is ignored.
  const historyBusyRef = useRef(false);
  const [isHistoryBusy, setIsHistoryBusy] = useState(false);

  const runHistoryStep = useCallback(
    async (fn: () => Promise<void>, label: string) => {
      if (historyBusyRef.current) return;
      historyBusyRef.current = true;
      setIsHistoryBusy(true);
      // A shape open for vertex/path editing would show stale geometry after the
      // server state changes underneath it, so undo/redo closes it first.
      if (modeRef.current === "edit-subdivision" || modeRef.current === "edit-route") {
        setSelectedFeature(null);
        setMode("view");
      }
      historyHook.isUndoingRef.current = true;
      try {
        await fn();
        afterWrite();
      } catch (e) {
        console.error(`${label} failed`, e);
        setMutationError(errMsg(e, `${label} failed`));
        invalidateAllMapData();
      } finally {
        historyHook.isUndoingRef.current = false;
        historyBusyRef.current = false;
        setIsHistoryBusy(false);
      }
    },
    [historyHook.isUndoingRef, afterWrite, invalidateAllMapData, setMode]
  );

  const handleUndo = useCallback(async () => {
    const action = historyHook.getUndoAction();
    if (!action) return;
    await runHistoryStep(async () => {
      await historyExecutor.applyInverseAction(action);
      stepUndo();
    }, "Undo");
  }, [historyHook, historyExecutor, stepUndo, runHistoryStep]);

  const handleRedo = useCallback(async () => {
    const action = historyHook.getRedoAction();
    if (!action) return;
    await runHistoryStep(async () => {
      await historyExecutor.applyForwardAction(action);
      stepRedo();
    }, "Redo");
  }, [historyHook, historyExecutor, stepRedo, runHistoryStep]);

  const jumpToHistoryPosition = useCallback(
    async (targetPos: number) => {
      if (!countryId || targetPos === history.position) return;
      await runHistoryStep(async () => {
        if (targetPos < history.position) {
          for (let i = history.position; i > targetPos; i--) {
            const action = history.actions[i];
            if (action) await historyExecutor.applyInverseAction(action);
            historyHook.setPosition(i - 1);
          }
        } else {
          for (let i = history.position + 1; i <= targetPos; i++) {
            const action = history.actions[i];
            if (action) await historyExecutor.applyForwardAction(action);
            historyHook.setPosition(i);
          }
        }
      }, "History jump");
    },
    [countryId, history, historyHook, historyExecutor, runHistoryStep]
  );

  // ── Point moves (drag, nudge, typed coordinates, snap tools) ──
  const updatePointCoordinates = useCallback(
    async (type?: FeatureType, id?: string, coords?: [number, number]) => {
      if (!countryId || !type || !id || !coords || type === "gap") return;
      const target = allFeatures.find((f) => f.id === id);
      try {
        await commitAction({
          type: "update",
          featureType: type,
          featureId: id,
          description: `Moved ${type === "mapLabel" ? "label" : type} "${target?.name ?? "feature"}"`,
          previousData: { coordinates: target?.coordinates },
          newData: { coordinates: coords },
        });
      } catch (e) {
        setMutationError(errMsg(e, "Failed to update coordinates"));
        invalidateAllMapData();
      }
    },
    [countryId, allFeatures, commitAction, invalidateAllMapData]
  );

  /**
   * Saves a reshaped region. `cascaded` carries neighbours whose shared vertices
   * moved with it (topology cascade); they are written in the same request and
   * undone together.
   */
  const updateSubdivisionGeometry = useCallback(
    async (
      subdivisionId?: string,
      geom?: object,
      cascaded?: Array<{ id: string; geometry: object }>
    ) => {
      if (!countryId || !subdivisionId || !geom) return;
      const target = allFeatures.find((f) => f.id === subdivisionId);
      const byId = new Map(allFeatures.map((f) => [f.id, f]));
      try {
        await commitAction({
          type: "update",
          featureType: "subdivision",
          featureId: subdivisionId,
          description: `Reshaped Region "${target?.name ?? "region"}"${
            cascaded && cascaded.length > 0
              ? ` (+${cascaded.length} neighbour${cascaded.length === 1 ? "" : "s"})`
              : ""
          }`,
          previousData: { geometry: target?.geometry },
          newData: { geometry: geom },
          cascadedUpdates: (cascaded ?? []).map((c) => ({
            featureId: c.id,
            featureType: "subdivision" as const,
            previousData: { geometry: byId.get(c.id)?.geometry },
            newData: { geometry: c.geometry },
          })),
        });
      } catch (e) {
        setMutationError(errMsg(e, "Failed to save region shape"));
        invalidateAllMapData();
      }
    },
    [countryId, allFeatures, commitAction, invalidateAllMapData]
  );

  const duplicateFeature = useCallback(
    async (featureToDup?: EditorFeature) => {
      const target = featureToDup || selectedFeature;
      if (!target || !countryId || target.type === "gap") return;
      try {
        let data: HistoryData = buildDuplicateInput(target);
        if (target.type === "route") {
          const g = target.geometry as
            { type?: string; coordinates?: [number, number][] } | undefined;
          data = {
            name: `${target.name} (copy)`,
            routeType: (target.properties.routeType as string) ?? "road",
            geometry:
              g?.type === "LineString" && g.coordinates
                ? {
                    type: "LineString",
                    coordinates: g.coordinates.map(([x, y]) => [x + 0.05, y + 0.05]),
                  }
                : target.geometry,
          };
        }
        const newId = await historyExecutor.recreateFeature(target.type, data);
        if (newId) {
          pushAction({
            type: "create",
            featureType: target.type,
            featureId: newId,
            description: `Duplicated ${target.type === "subdivision" ? "Region" : target.type} "${target.name}"`,
            newData: data,
          });
        }
        afterWrite();
      } catch (e) {
        setMutationError(errMsg(e, "Failed to duplicate feature"));
      }
    },
    [selectedFeature, countryId, historyExecutor, pushAction, afterWrite]
  );

  const bulk = useMapEditorBulkOps({
    countryId,
    features,
    countryGeo,
    allFeatures,
    selectedIds,
    selectedFeature,
    showGaps,
    setShowGaps,
    historyExecutor,
    pushAction,
    afterWrite,
    setMutationError,
    resetForm,
    clearMultiSelect,
    updatePointCoordinates,
    worldMapLayers: options?.worldMapLayers,
  });
  const { isBulkBusy } = bulk;

  const {
    isMutating: isFormMutating,
    submitCity,
    submitEditCity,
    submitSubdivision,
    submitEditSubdivision,
    submitPOI,
    submitEditPOI,
    submitStoryPin,
    submitEditStoryPin,
    submitMapLabel,
    submitEditMapLabel,
    submitPeak,
    submitEditPeak,
    submitRiver,
    submitEditRiver,
    submitLake,
    submitEditLake,
    deleteFeature,
  } = mutations;

  const isMutating = isFormMutating || isHistoryBusy || isBulkBusy || routes.isRouteMutating;

  const startEditing = useCallback(
    (feature: EditorFeature) => {
      setSelectedFeature(feature);
      const state = mapFeatureToEditState(feature);
      if (state.cityForm) setCityForm(state.cityForm);
      if (state.subdivisionForm) setSubdivisionForm(state.subdivisionForm);
      if (state.poiForm) setPOIForm(state.poiForm);
      if (state.peakForm) setPeakForm(state.peakForm);
      if (state.riverForm) setRiverForm(state.riverForm);
      if (state.lakeForm) setLakeForm(state.lakeForm);
      if (state.editingRouteId) setEditingRouteId(state.editingRouteId);
      setMode(state.mode);
    },
    [setMode]
  );

  // ── Map Events & Drawing ──
  const handleMapClick = useCallback(
    (coords: [number, number]) => {
      if (mode === "split-subdivision") {
        setSplitLine((prev) => [...prev, coords]);
        return;
      }
      if (mode === "add-route") {
        setRouteWaypoints((prev) => [...prev, coords]);
        return;
      }
      if (mode === "add-river") {
        setRiverPath((prev) => {
          const next = [...prev, coords];
          setPendingGeometry(next.length >= 2 ? { type: "LineString", coordinates: next } : null);
          return next;
        });
        return;
      }
      if (mode.startsWith("add-")) {
        setPendingCoordinates(coords);
      }
    },
    [mode]
  );

  const undoLastRiverPoint = useCallback(() => {
    setRiverPath((prev) => {
      const next = prev.slice(0, -1);
      setPendingGeometry(next.length >= 2 ? { type: "LineString", coordinates: next } : null);
      return next;
    });
  }, []);

  const undoLastSplitPoint = useCallback(() => {
    setSplitLine((prev) => prev.slice(0, -1));
  }, []);

  const handleDrawComplete = useCallback((geometry: object) => {
    setPendingGeometry(geometry);
  }, []);

  const promoteCapital = useCallback(
    async (cityId?: string) => {
      const targetId = cityId || (selectedFeature?.type === "city" ? selectedFeature.id : null);
      if (!countryId || !targetId) return;
      const target = allFeatures.find((f) => f.id === targetId && f.type === "city");
      if (!target) return;
      try {
        await commitAction({
          type: "update",
          featureType: "city",
          featureId: targetId,
          description: `Made "${target.name}" the national capital`,
          previousData: { isNationalCapital: !!target.properties.isNationalCapital },
          newData: { isNationalCapital: true },
        });
      } catch (e) {
        setMutationError(errMsg(e, "Failed to set capital"));
      }
    },
    [countryId, selectedFeature, allFeatures, commitAction]
  );

  const createSubdivisionFromGap = useCallback(
    async (geometry?: object | null) => {
      if (!geometry || !isPolygonal(geometry)) return;
      resetForm();
      setMode("add-subdivision");
      setPendingGeometry(geometry);
    },
    [resetForm, setMode]
  );

  // ── Split-region tool ──
  const executeSplitSubdivision = useCallback(
    async (subdivisionId: string, lineCoords?: [number, number][]) => {
      const line = lineCoords && lineCoords.length >= 2 ? lineCoords : splitLine;
      const ok = await transforms.executeSplitSubdivision(subdivisionId, line);
      if (ok) {
        setSplitLine([]);
        setSelectedFeature(null);
        setMode("view");
      }
    },
    [transforms, splitLine, setMode]
  );

  const noopShowEmptyRegions = useCallback((v: boolean) => setShowGaps(v), []);

  // ── Draft (in-progress, unsaved placement/drawing) ──
  const draft = useMemo<EditorDraft | null>(() => {
    if (!mode.startsWith("add-")) return null;
    const hasWork =
      !!pendingCoordinates ||
      !!pendingGeometry ||
      routeWaypoints.length > 0 ||
      riverPath.length > 0;
    if (!hasWork) return null;
    return {
      mode,
      pendingCoordinates,
      pendingGeometry,
      routeWaypoints,
      riverPath,
      routeType,
      cityForm: mode === "add-city" ? cityForm : undefined,
      subdivisionForm: mode === "add-subdivision" ? subdivisionForm : undefined,
      poiForm: mode === "add-poi" ? poiForm : undefined,
      peakForm: mode === "add-peak" ? peakForm : undefined,
      riverForm: mode === "add-river" ? riverForm : undefined,
      lakeForm: mode === "add-lake" ? lakeForm : undefined,
      savedAt: Date.now(),
    };
  }, [
    mode,
    pendingCoordinates,
    pendingGeometry,
    routeWaypoints,
    riverPath,
    routeType,
    cityForm,
    subdivisionForm,
    poiForm,
    peakForm,
    riverForm,
    lakeForm,
  ]);

  const restoreDraft = useCallback(
    (d: EditorDraft) => {
      resetForm();
      setMode(d.mode);
      setPendingCoordinates(d.pendingCoordinates);
      setPendingGeometry(d.pendingGeometry);
      setRouteWaypoints(d.routeWaypoints ?? []);
      setRiverPath(d.riverPath ?? []);
      if (d.routeType) setRouteType(d.routeType);
      if (d.cityForm) setCityForm(d.cityForm);
      if (d.subdivisionForm) setSubdivisionForm(d.subdivisionForm);
      if (d.poiForm) setPOIForm(d.poiForm);
      if (d.peakForm) setPeakForm(d.peakForm);
      if (d.riverForm) setRiverForm(d.riverForm);
      if (d.lakeForm) setLakeForm(d.lakeForm);
    },
    [resetForm, setMode]
  );

  return useShallowStable({
    mode,
    setMode,
    selectedFeature,
    setSelectedFeature,
    pendingCoordinates,
    pendingGeometry,
    isPickingLocation,
    setIsPickingLocation,
    cityForm,
    setCityForm,
    subdivisionForm,
    setSubdivisionForm,
    poiForm,
    setPOIForm,
    storyPinForm,
    setStoryPinForm,
    mapLabelForm,
    setMapLabelForm,
    peakForm,
    setPeakForm,
    riverForm,
    setRiverForm,
    lakeForm,
    setLakeForm,
    features,
    allFeatures,
    countryGeo,
    geometryLoading,
    linkage,
    linkageLoading,
    featuresLoading,
    pendingPointInfo: null,
    isPendingPointInfoLoading: false,
    handleMapClick,
    handleDrawComplete,
    submitCity,
    submitSubdivision,
    submitPOI,
    submitPeak,
    submitRiver,
    submitLake,
    handleDeleteFeature: deleteFeature,
    resetForm,
    startEditing,
    submitEditCity,
    submitEditSubdivision,
    submitEditPOI,
    submitEditPeak,
    submitEditRiver,
    submitEditLake,
    submitStoryPin,
    submitMapLabel,
    submitEditStoryPin,
    submitEditMapLabel,
    updateSubdivisionGeometry,
    updatePointCoordinates,
    isMutating,
    mutationError,
    setMutationError,
    lastSavedAt,
    validationErrors,
    refetchFeatures,
    historyCanUndo,
    historyCanRedo,
    history,
    pushAction,
    undo: handleUndo,
    redo: handleRedo,
    routeWaypoints,
    setRouteWaypoints,
    riverPath,
    undoLastRiverPoint,
    splitLine,
    undoLastSplitPoint,
    routeType,
    setRouteType,
    editingRouteId,
    editingRouteVertices,
    setEditingRouteVertices,
    draggingVertexIndex,
    setDraggingVertexIndex,
    snapTarget,
    setSnapTarget,
    isSnapEnabled,
    setIsSnapEnabled,
    finishRoute: routes.finishRoute,
    undoLastWaypoint: routes.undoLastWaypoint,
    clearRouteWaypoints: routes.clearRouteWaypoints,
    startRouteEdit: routes.startRouteEdit,
    commitRouteEdit: routes.commitRouteEdit,
    cancelRouteEdit: routes.cancelRouteEdit,
    addRouteWaypointWithSnap: routes.addRouteWaypointWithSnap,
    selectedIds,
    setSelectedIds,
    toggleSelectId,
    clearMultiSelect,
    selectAll,
    bulkDeleteSelected: bulk.bulkDeleteSelected,
    bulkEditSelected: bulk.bulkEditSelected,
    duplicateFeature,
    showGaps,
    setShowGaps,
    gapFeatures: bulk.gapFeatures,
    recalculateGaps: bulk.recalculateGaps,
    createSubdivisionFromGap,
    scatterCities: bulk.scatterCities,
    snapCityToSubdivisionBorder: bulk.snapCityToSubdivisionBorder,
    snapCityToCoastline: bulk.snapCityToCoastline,
    mergeSelectedCities: transforms.mergeSelectedCities,
    splitCity: transforms.splitCity,
    scaleSelectedCitiesPopulation: transforms.scaleSelectedCitiesPopulation,
    rotateSelectedCities: transforms.rotateSelectedCities,
    emptyRegionsFeatures: bulk.emptyRegionsFeatures,
    showEmptyRegions: showGaps,
    setShowEmptyRegions: noopShowEmptyRegions,
    createCentroidCities: bulk.createCentroidCities,
    executeSplitSubdivision,
    mergeSelectedSubdivisions: transforms.mergeSelectedSubdivisions,
    pathfinderOperation: transforms.pathfinderOperation,
    applyGeometryTransformation: transforms.applyGeometryTransformation,
    rulerPoints,
    setRulerPoints,
    lassoGeometry,
    setLassoTool,
    lassoTool,
    setLassoGeometry,
    addRulerPoint,
    clearRuler,
    applyLassoSelection,
    applyRectSelection,
    guides,
    setGuides,
    jumpToHistoryPosition,
    reverseRoute: routes.reverseRoute,
    promoteCapital,
    importGeoJSON: bulk.importGeoJSON,
    draft,
    restoreDraft,
  });
}
