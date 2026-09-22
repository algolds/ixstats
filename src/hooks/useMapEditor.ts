"use client";

/**
 * useMapEditor - State management orchestrator hook for the MyCountry map editor.
 * Decomposed into modular sub-hooks under src/hooks/map-editor/ (Plan 175).
 */

import { useState, useCallback } from "react";
import { useMapHistory } from "./map-editor/useMapHistory";
import { useMapEditorSync } from "./map-editor/useMapEditorSync";
import { useMapEditorSelection } from "./map-editor/useMapEditorSelection";
import { useMapEditorTransforms } from "./map-editor/useMapEditorTransforms";
import { useMapFeatureMutations } from "./map-editor/useMapFeatureMutations";
import { useHistoryReversalExecutor } from "./map-editor/useHistoryReversalExecutor";
import { calculateNegativeSpaceGaps } from "~/lib/maps/map-editor-geom";
import type { FeatureCollection } from "geojson";
import { mapFeatureToEditState } from "./map-editor/feature-form-mapper";

export * from "./map-editor/editor-types";
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

export function useMapEditor(countryId: string | undefined, options?: UseMapEditorOptions) {
  // ── Core Editor Mode & Selection ──
  const [mode, setMode] = useState<EditorMode>("view");
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

  // ── Route Editor State ──
  const [routeWaypoints, setRouteWaypoints] = useState<[number, number][]>([]);
  const [routeDrawingHistory] = useState<[number, number][][]>([]);
  const [routeType, setRouteType] = useState<string>("road");
  const [editingRouteId, setEditingRouteId] = useState<string | null>(null);
  const [editingRouteVertices, setEditingRouteVertices] = useState<[number, number][]>([]);
  const [draggingVertexIndex, setDraggingVertexIndex] = useState<number | null>(null);
  const [snapTarget, setSnapTarget] = useState<[number, number] | null>(null);
  const [isSnapEnabled, setIsSnapEnabled] = useState(true);

  // ── Gaps & Negative Space ──
  const [showGaps, setShowGaps] = useState(false);
  const [gapFeatures, setGapFeatures] = useState<FeatureCollection | null>(null);
  const [showEmptyRegions, setShowEmptyRegions] = useState(false);
  const [emptyRegionsFeatures] = useState<FeatureCollection | null>(null);

  const [mutationError, setMutationError] = useState<string | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [validationErrors] = useState<Record<string, string>>({});

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

  const transforms = useMapEditorTransforms({
    countryId,
    allFeatures,
    selectedIds,
    clearMultiSelect,
    invalidateAllMapData,
    debouncedRefetch,
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
    editingRouteId,
    editingRouteVertices,
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

  const handleUndo = useCallback(async () => {
    const action = historyHook.getUndoAction();
    if (!action) return;
    historyHook.isUndoingRef.current = true;
    try {
      await historyExecutor.applyInverseAction(action);
      stepUndo();
      invalidateAllMapData();
      debouncedRefetch();
    } catch (e) {
      console.error("Undo failed", e);
    } finally {
      historyHook.isUndoingRef.current = false;
    }
  }, [historyHook, historyExecutor, stepUndo, invalidateAllMapData, debouncedRefetch]);

  const handleRedo = useCallback(async () => {
    const action = historyHook.getRedoAction();
    if (!action) return;
    historyHook.isUndoingRef.current = true;
    try {
      await historyExecutor.applyForwardAction(action);
      stepRedo();
      invalidateAllMapData();
      debouncedRefetch();
    } catch (e) {
      console.error("Redo failed", e);
    } finally {
      historyHook.isUndoingRef.current = false;
    }
  }, [historyHook, historyExecutor, stepRedo, invalidateAllMapData, debouncedRefetch]);

  const jumpToHistoryPosition = useCallback(
    async (targetPos: number) => {
      if (!countryId || targetPos === history.position) return;
      const isSteppingBack = targetPos < history.position;
      historyHook.isUndoingRef.current = true;
      try {
        if (isSteppingBack) {
          for (let i = history.position; i > targetPos; i--) {
            const action = history.actions[i];
            if (action) {
              await historyExecutor.applyInverseAction(action);
            }
          }
        } else {
          for (let i = history.position + 1; i <= targetPos; i++) {
            const action = history.actions[i];
            if (action) {
              await historyExecutor.applyForwardAction(action);
            }
          }
        }
        historyHook.setPosition(targetPos);
        invalidateAllMapData();
        debouncedRefetch();
      } catch (e) {
        console.error("Jump to history position failed", e);
      } finally {
        historyHook.isUndoingRef.current = false;
      }
    },
    [countryId, history, historyHook, historyExecutor, invalidateAllMapData, debouncedRefetch]
  );

  const updatePointCoordinates = useCallback(
    async (type?: FeatureType, id?: string, coords?: [number, number]) => {
      if (!countryId || !type || !id || !coords || type === "gap") return;
      try {
        await historyExecutor.restoreFeatureData(type, id, { coordinates: coords });
        invalidateAllMapData();
        debouncedRefetch();
      } catch (e) {
        setMutationError(e instanceof Error ? e.message : "Failed to update coordinates");
      }
    },
    [countryId, historyExecutor, invalidateAllMapData, debouncedRefetch, setMutationError]
  );

  const duplicateFeature = useCallback(
    async (featureToDup?: EditorFeature) => {
      const target = featureToDup || selectedFeature;
      if (!target || !countryId || target.type === "gap") return;
      try {
        const offset = 0.02;
        const dupName = `${target.name || "Feature"} (Copy)`;
        const newCoords: [number, number] = target.coordinates
          ? [target.coordinates[0] + offset, target.coordinates[1] + offset]
          : [0, 0];

        await historyExecutor.recreateFeature(target.type, {
          ...target.properties,
          name: dupName,
          coordinates: newCoords,
          geometry: target.geometry,
        });
        invalidateAllMapData();
        debouncedRefetch();
      } catch (e) {
        setMutationError(e instanceof Error ? e.message : "Failed to duplicate feature");
      }
    },
    [selectedFeature, countryId, historyExecutor, invalidateAllMapData, debouncedRefetch, setMutationError]
  );

  const {
    isMutating,
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
    createRoute,
    updateRouteGeometry,
  } = mutations;

  const startEditing = useCallback((feature: EditorFeature) => {
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
  }, []);

  // ── Map Events & Drawing ──
  const handleMapClick = useCallback(
    (coords: [number, number]) => {
      if (mode.startsWith("add-")) {
        setPendingCoordinates(coords);
      }
    },
    [mode]
  );

  const handleDrawComplete = useCallback((geometry: object) => {
    setPendingGeometry(geometry);
  }, []);

  // ── Route Actions ──
  const finishRoute = useCallback(async () => {
    if (!countryId || routeWaypoints.length < 2) return;
    try {
      const typeLabel = routeType.replace(/_/g, " ");
      const formattedType = typeLabel.charAt(0).toUpperCase() + typeLabel.slice(1);
      await createRoute.mutateAsync({
        countryId,
        name: `New ${formattedType}`,
        routeType,
        geometry: { type: "LineString", coordinates: routeWaypoints },
      });
      setRouteWaypoints([]);
      setMode("view");
      invalidateAllMapData();
      debouncedRefetch();
    } catch (e) {
      setMutationError(e instanceof Error ? e.message : "Failed to create route");
    }
  }, [countryId, routeWaypoints, routeType, createRoute, invalidateAllMapData, debouncedRefetch]);

  const undoLastWaypoint = useCallback(() => {
    setRouteWaypoints((prev) => prev.slice(0, -1));
  }, []);

  const clearRouteWaypoints = useCallback(() => {
    setRouteWaypoints([]);
  }, []);

  const startRouteEdit = useCallback((routeId: string, vertices: [number, number][]) => {
    setEditingRouteId(routeId);
    setEditingRouteVertices(vertices);
    setMode("edit-route");
  }, []);

  const commitRouteEdit = useCallback(async () => {
    if (!countryId || !editingRouteId || editingRouteVertices.length < 2) return;
    try {
      await updateRouteGeometry.mutateAsync({
        countryId,
        id: editingRouteId,
        geometry: { type: "LineString", coordinates: editingRouteVertices },
      });
      setEditingRouteId(null);
      setEditingRouteVertices([]);
      setMode("view");
      invalidateAllMapData();
      debouncedRefetch();
    } catch (e) {
      setMutationError(e instanceof Error ? e.message : "Failed to update route");
    }
  }, [
    countryId,
    editingRouteId,
    editingRouteVertices,
    updateRouteGeometry,
    invalidateAllMapData,
    debouncedRefetch,
  ]);

  const cancelRouteEdit = useCallback(() => {
    setEditingRouteId(null);
    setEditingRouteVertices([]);
    setMode("view");
  }, []);

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
      if (geo.type !== "LineString" || !Array.isArray(geo.coordinates) || geo.coordinates.length < 2)
        return;
      const reversed = [...geo.coordinates].reverse();
      try {
        await updateRouteGeometry.mutateAsync({
          countryId,
          id: targetId,
          geometry: { type: "LineString", coordinates: reversed },
        });
        pushAction({
          type: "update",
          featureType: "route",
          featureId: targetId,
          description: `Reversed direction of Route "${target.name}"`,
          previousData: { geometry: target.geometry },
          newData: { geometry: { type: "LineString", coordinates: reversed } },
        });
        invalidateAllMapData();
        debouncedRefetch();
      } catch (e) {
        setMutationError(e instanceof Error ? e.message : "Failed to reverse route");
      }
    },
    [
      countryId,
      selectedFeature,
      allFeatures,
      updateRouteGeometry,
      pushAction,
      invalidateAllMapData,
      debouncedRefetch,
      setMutationError,
    ]
  );

  const promoteCapital = useCallback(
    async (cityId?: string) => {
      const targetId = cityId || (selectedFeature?.type === "city" ? selectedFeature.id : null);
      if (!countryId || !targetId) return;
      const target = allFeatures.find((f) => f.id === targetId && f.type === "city");
      if (!target) return;
      await submitEditCity({
        name: target.name,
        isNationalCapital: true,
      });
    },
    [countryId, selectedFeature, allFeatures, submitEditCity]
  );

  // ── Bulk & Duplicate Actions ──
  const bulkDeleteSelected = useCallback(async () => {
    if (!countryId || selectedIds.size === 0) return;
    const toDelete = allFeatures.filter((f) => selectedIds.has(f.id));
    for (const feat of toDelete) {
      await deleteFeature(feat);
    }
    clearMultiSelect();
  }, [countryId, selectedIds, allFeatures, deleteFeature, clearMultiSelect]);

  // ── Gaps Calculation ──
  const recalculateGaps = useCallback(() => {
    if (!countryGeo || !features?.subdivisions) return;
    const gaps = calculateNegativeSpaceGaps(countryGeo, features.subdivisions);
    setGapFeatures(gaps);
  }, [countryGeo, features]);

  return {
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
    updateSubdivisionGeometry: async (_subdivisionId?: string, _geom?: object) => {},
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
    routeDrawingHistory,
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
    finishRoute,
    undoLastWaypoint,
    clearRouteWaypoints,
    startRouteEdit,
    commitRouteEdit,
    cancelRouteEdit,
    addRouteWaypointWithSnap,
    selectedIds,
    toggleSelectId,
    clearMultiSelect,
    bulkDeleteSelected,
    bulkEditSelected: async (
      _featureIds?: string[] | string,
      _updates?: Record<string, string | number | boolean | null> | string | number | boolean | null
    ) => ({ successCount: 0, failCount: 0 }),
    duplicateFeature,
    showGaps,
    setShowGaps,
    gapFeatures,
    recalculateGaps,
    createSubdivisionFromGap: async (_geometry?: object | null) => {},
    scatterCities: async (_count?: number, _type?: string, _prefix?: string) => {},
    snapCityToSubdivisionBorder: async (_cityId?: string) => {},
    snapCityToCoastline: async (_cityId?: string) => {},
    mergeSelectedCities: transforms.mergeSelectedCities,
    splitCity: transforms.splitCity,
    scaleSelectedCitiesPopulation: transforms.scaleSelectedCitiesPopulation,
    rotateSelectedCities: transforms.rotateSelectedCities,
    emptyRegionsFeatures,
    showEmptyRegions,
    setShowEmptyRegions,
    createCentroidCities: async (_countryId?: string) => {},
    executeSplitSubdivision: transforms.executeSplitSubdivision,
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
    reverseRoute,
    promoteCapital,
  };
}
