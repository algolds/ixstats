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
import { calculateNegativeSpaceGaps } from "~/lib/maps/map-editor-geom";

export * from "./map-editor/editor-types";
import type {
  EditorMode,
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
  const [editingRouteId, setEditingRouteId] = useState<string | null>(null);
  const [editingRouteVertices, setEditingRouteVertices] = useState<[number, number][]>([]);
  const [draggingVertexIndex, setDraggingVertexIndex] = useState<number | null>(null);
  const [snapTarget, setSnapTarget] = useState<any>(null);
  const [isSnapEnabled, setIsSnapEnabled] = useState(true);

  // ── Gaps & Negative Space ──
  const [showGaps, setShowGaps] = useState(false);
  const [gapFeatures, setGapFeatures] = useState<any>(null);
  const [showEmptyRegions, setShowEmptyRegions] = useState(false);
  const [emptyRegionsFeatures] = useState<any>(null);

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
    wandMatchColor,
    setWandMatchColor,
    wandMatchLevel,
    setWandMatchLevel,
    wandMatchParent,
    setWandMatchParent,
    presetStyle,
    setPresetStyle,
    guides,
    setGuides,
    applyMagicWand,
    applyEyedropper,
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
  });

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
    const p = feature.properties || {};

    switch (feature.type) {
      case "city":
        setCityForm({
          name: feature.name,
          cityType: p.cityType || "city",
          population: p.population,
          isNationalCapital: !!p.isNationalCapital,
          isSubdivisionCapital: !!p.isSubdivisionCapital,
          subdivisionId: p.subdivisionId,
          wikiPageTitle: p.wikiPageTitle,
          elevation: p.elevation,
          foundedYear: p.foundedYear,
          coordinates: feature.coordinates,
        });
        setMode("edit-city");
        break;
      case "subdivision":
        setSubdivisionForm({
          name: feature.name,
          type: p.type || "province",
          level: p.level || 1,
          capital: p.capital,
          population: p.population,
          areaSqKm: p.areaSqKm,
          color: p.color,
          wikiPageTitle: p.wikiPageTitle,
          geometry: feature.geometry,
        });
        setMode("edit-subdivision");
        break;
      case "poi":
        setPOIForm({
          name: feature.name,
          category: p.category || "landmark",
          description: p.description,
          icon: p.icon,
          wikiPageTitle: p.wikiPageTitle,
          subdivisionId: p.subdivisionId,
          coordinates: feature.coordinates,
        });
        setMode("edit-poi");
        break;
      case "storyPin":
        setStoryPinForm({
          title: feature.name,
          content: p.content || "",
          contentFormat: p.contentFormat || "plain",
          category: p.category || "cultural",
          importance: p.importance || 0,
          ixTimeYear: p.ixTimeYear,
          eraLabel: p.eraLabel,
          wikiPageTitle: p.wikiPageTitle,
          photos: p.photos,
          thumbnailUrl: p.thumbnailUrl,
          storylineId: p.storylineId,
          storylineOrder: p.storylineOrder,
          coordinates: feature.coordinates,
        });
        setMode("edit-story-pin");
        break;
      case "mapLabel":
        setMapLabelForm({
          text: feature.name,
          labelType: p.labelType || "mountain_range",
          fontSize: p.fontSize || 14,
          color: p.color || "#374151",
          rotation: p.rotation || 0,
          letterSpacing: p.letterSpacing || 0,
          fontWeight: p.fontWeight || "normal",
          opacity: p.opacity ?? 1,
          minZoom: p.minZoom ?? 4,
          maxZoom: p.maxZoom ?? 18,
          wikiPageTitle: p.wikiPageTitle,
          coordinates: feature.coordinates,
        });
        setMode("edit-label");
        break;
      case "peak":
        setPeakForm({
          name: feature.name,
          elevation: p.elevation || 0,
          prominence: p.prominence,
          subdivisionId: p.subdivisionId,
          wikiPageTitle: p.wikiPageTitle,
          coordinates: feature.coordinates,
        });
        setMode("edit-peak");
        break;
      case "river":
        setRiverForm({
          name: feature.name,
          wikiPageTitle: p.wikiPageTitle,
          geometry: feature.geometry,
        });
        setMode("edit-river");
        break;
      case "lake":
        setLakeForm({
          name: feature.name,
          waterType: p.waterType || "freshwater",
          wikiPageTitle: p.wikiPageTitle,
          geometry: feature.geometry,
        });
        setMode("edit-lake");
        break;
      case "route":
        setEditingRouteId(feature.id);
        setMode("edit-route");
        break;
    }
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
      await createRoute.mutateAsync({
        countryId,
        name: "New Route",
        routeType: "road",
        geometry: { type: "LineString", coordinates: routeWaypoints },
      });
      setRouteWaypoints([]);
      setMode("view");
      invalidateAllMapData();
      debouncedRefetch();
    } catch (e: any) {
      setMutationError(e.message || "Failed to create route");
    }
  }, [countryId, routeWaypoints, createRoute, invalidateAllMapData, debouncedRefetch]);

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
    } catch (e: any) {
      setMutationError(e.message || "Failed to update route");
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
    updateSubdivisionGeometry: async (_subdivisionId?: any, _geom?: any) => {},
    updatePointCoordinates: async (_type?: any, _id?: any, _coords?: any) => {},
    isMutating,
    mutationError,
    lastSavedAt,
    validationErrors,
    refetchFeatures,
    historyCanUndo,
    historyCanRedo,
    history,
    pushAction,
    undo: stepUndo,
    redo: stepRedo,
    routeWaypoints,
    routeDrawingHistory,
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
    bulkEditSelected: async (_featureIds?: any, _updates?: any) => {},
    duplicateFeature: async (_feature?: any) => {},
    showGaps,
    setShowGaps,
    gapFeatures,
    recalculateGaps,
    createSubdivisionFromGap: async () => {},
    scatterCities: async (_count?: any, _type?: any, _prefix?: any) => {},
    snapCityToSubdivisionBorder: async () => {},
    snapCityToCoastline: async () => {},
    mergeSelectedCities: transforms.mergeSelectedCities,
    splitCity: transforms.splitCity,
    scaleSelectedCitiesPopulation: transforms.scaleSelectedCitiesPopulation,
    rotateSelectedCities: transforms.rotateSelectedCities,
    emptyRegionsFeatures,
    showEmptyRegions,
    setShowEmptyRegions,
    createCentroidCities: async (_countryId?: any) => {},
    executeSplitSubdivision: transforms.executeSplitSubdivision,
    mergeSelectedSubdivisions: transforms.mergeSelectedSubdivisions,
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
    applyPaintFill: async () => {},
    presetStyle,
    setPresetStyle,
    guides,
    setGuides,
    jumpToHistoryPosition: () => {},
    wandMatchColor,
    setWandMatchColor,
    wandMatchLevel,
    setWandMatchLevel,
    wandMatchParent,
    setWandMatchParent,
    applyEyedropper,
    applyMagicWand,
    pathfinderOperation: async () => {},
  };
}
