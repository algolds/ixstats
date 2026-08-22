"use client";

/**
 * useMapEditor - State management orchestrator hook for the MyCountry map editor.
 * Decomposed into modular sub-hooks under src/hooks/map-editor/ (Plan 175).
 */

import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { api } from "~/trpc/react";
import { useMapHistory } from "./map-editor/useMapHistory";
import { useMapEditorSync } from "./map-editor/useMapEditorSync";
import { useMapEditorSelection } from "./map-editor/useMapEditorSelection";
import { useMapEditorTransforms } from "./map-editor/useMapEditorTransforms";
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

interface UseMapEditorOptions {
  skipLinkageGate?: boolean;
  worldMapLayers?: import("~/components/maps/core/IxWorldMap").MapLayerData[];
}

const DEFAULT_CITY: CityFormData = {
  name: "",
  cityType: "city",
  isNationalCapital: false,
  isSubdivisionCapital: false,
};

const DEFAULT_SUBDIVISION: SubdivisionFormData = {
  name: "",
  type: "province",
  level: 1,
};

const DEFAULT_POI: POIFormData = {
  name: "",
  category: "landmark",
  description: "",
};

const DEFAULT_STORY_PIN: StoryPinFormData = {
  title: "",
  content: "",
  contentFormat: "plain",
  category: "cultural",
  importance: 0,
};

const DEFAULT_MAP_LABEL: MapLabelFormData = {
  text: "",
  labelType: "mountain_range",
  fontSize: 14,
  color: "#374151",
  rotation: 0,
  letterSpacing: 0,
  fontWeight: "normal",
  opacity: 1,
  minZoom: 4,
  maxZoom: 18,
};

const DEFAULT_PEAK: PeakFormData = {
  name: "",
  elevation: 0,
};

const DEFAULT_RIVER: NamedRiverFormData = {
  name: "",
};

const DEFAULT_LAKE: NamedLakeFormData = {
  name: "",
  waterType: "freshwater",
};

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
  const [routeDrawingHistory, setRouteDrawingHistory] = useState<[number, number][][]>([]);
  const [editingRouteId, setEditingRouteId] = useState<string | null>(null);
  const [editingRouteVertices, setEditingRouteVertices] = useState<[number, number][]>([]);
  const [draggingVertexIndex, setDraggingVertexIndex] = useState<number | null>(null);
  const [snapTarget, setSnapTarget] = useState<any>(null);
  const [isSnapEnabled, setIsSnapEnabled] = useState(true);

  // ── Gaps & Negative Space ──
  const [showGaps, setShowGaps] = useState(false);
  const [gapFeatures, setGapFeatures] = useState<any>(null);
  const [showEmptyRegions, setShowEmptyRegions] = useState(false);
  const [emptyRegionsFeatures, setEmptyRegionsFeatures] = useState<any>(null);

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

  // ── Mutations ──
  const createCity = api.geoFeatures.createCity.useMutation();
  const updateCity = api.geoFeatures.updateCity.useMutation();
  const deleteCity = api.geoFeatures.deleteCity.useMutation();

  const createSubdivision = api.geoFeatures.createSubdivision.useMutation();
  const updateSubdivision = api.geoFeatures.updateSubdivision.useMutation();
  const deleteSubdivision = api.geoFeatures.deleteSubdivision.useMutation();

  const createPOI = api.geoFeatures.createPOI.useMutation();
  const updatePOI = api.geoFeatures.updatePOI.useMutation();
  const deletePOI = api.geoFeatures.deletePOI.useMutation();

  const createStoryPin = api.geoFeatures.createStoryPin.useMutation();
  const updateStoryPin = api.geoFeatures.updateStoryPin.useMutation();
  const deleteStoryPin = api.geoFeatures.deleteStoryPin.useMutation();

  const createMapLabel = api.geoFeatures.createMapLabel.useMutation();
  const updateMapLabel = api.geoFeatures.updateMapLabel.useMutation();
  const deleteMapLabel = api.geoFeatures.deleteMapLabel.useMutation();

  const createPeak = api.geoFeatures.createPeak.useMutation();
  const updatePeak = api.geoFeatures.updatePeak.useMutation();
  const deletePeak = api.geoFeatures.deletePeak.useMutation();

  const createNamedRiver = api.geoFeatures.createNamedRiver.useMutation();
  const updateNamedRiver = api.geoFeatures.updateNamedRiver.useMutation();
  const deleteNamedRiver = api.geoFeatures.deleteNamedRiver.useMutation();

  const createNamedLake = api.geoFeatures.createNamedLake.useMutation();
  const updateNamedLake = api.geoFeatures.updateNamedLake.useMutation();
  const deleteNamedLake = api.geoFeatures.deleteNamedLake.useMutation();

  const createRoute = api.transport.createRoute.useMutation();
  const updateRoute = api.transport.updateRoute.useMutation();
  const updateRouteGeometry = api.transport.updateRouteGeometry.useMutation();
  const deleteRoute = api.transport.deleteRoute.useMutation();

  const isMutating =
    createCity.isPending ||
    updateCity.isPending ||
    deleteCity.isPending ||
    createSubdivision.isPending ||
    updateSubdivision.isPending ||
    deleteSubdivision.isPending ||
    createPOI.isPending ||
    updatePOI.isPending ||
    deletePOI.isPending ||
    createStoryPin.isPending ||
    updateStoryPin.isPending ||
    deleteStoryPin.isPending ||
    createMapLabel.isPending ||
    updateMapLabel.isPending ||
    deleteMapLabel.isPending ||
    createPeak.isPending ||
    updatePeak.isPending ||
    deletePeak.isPending ||
    createNamedRiver.isPending ||
    updateNamedRiver.isPending ||
    deleteNamedRiver.isPending ||
    createNamedLake.isPending ||
    updateNamedLake.isPending ||
    deleteNamedLake.isPending ||
    createRoute.isPending ||
    updateRoute.isPending ||
    updateRouteGeometry.isPending ||
    deleteRoute.isPending;

  const [mutationError, setMutationError] = useState<string | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

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
    setValidationErrors({});
  }, []);

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

  // ── Feature Submission Actions ──
  const submitCity = useCallback(async () => {
    if (!countryId || !pendingCoordinates) return;
    try {
      await createCity.mutateAsync({
        countryId,
        name: cityForm.name,
        cityType: cityForm.cityType,
        coordinates: pendingCoordinates,
        population: cityForm.population,
        isNationalCapital: cityForm.isNationalCapital,
        isSubdivisionCapital: cityForm.isSubdivisionCapital,
        subdivisionId: cityForm.subdivisionId,
      });
      setLastSavedAt(new Date());
      resetForm();
      setMode("view");
      invalidateAllMapData();
      debouncedRefetch();
    } catch (e: any) {
      setMutationError(e.message || "Failed to create city");
    }
  }, [countryId, pendingCoordinates, cityForm, createCity, resetForm, invalidateAllMapData, debouncedRefetch]);

  const submitEditCity = useCallback(async () => {
    if (!countryId || !selectedFeature) return;
    try {
      await updateCity.mutateAsync({
        countryId,
        cityId: selectedFeature.id,
        name: cityForm.name,
        cityType: cityForm.cityType,
        coordinates: selectedFeature.coordinates!,
        population: cityForm.population,
        isNationalCapital: cityForm.isNationalCapital,
        isSubdivisionCapital: cityForm.isSubdivisionCapital,
      });
      setLastSavedAt(new Date());
      resetForm();
      setMode("view");
      invalidateAllMapData();
      debouncedRefetch();
    } catch (e: any) {
      setMutationError(e.message || "Failed to update city");
    }
  }, [countryId, selectedFeature, cityForm, updateCity, resetForm, invalidateAllMapData, debouncedRefetch]);

  const submitSubdivision = useCallback(async () => {
    if (!countryId || !pendingGeometry) return;
    try {
      await createSubdivision.mutateAsync({
        countryId,
        name: subdivisionForm.name,
        type: subdivisionForm.type,
        level: subdivisionForm.level,
        geometry: pendingGeometry as Record<string, unknown>,
        capital: subdivisionForm.capital,
        population: subdivisionForm.population,
      });
      setLastSavedAt(new Date());
      resetForm();
      setMode("view");
      invalidateAllMapData();
      debouncedRefetch();
    } catch (e: any) {
      setMutationError(e.message || "Failed to create subdivision");
    }
  }, [countryId, pendingGeometry, subdivisionForm, createSubdivision, resetForm, invalidateAllMapData, debouncedRefetch]);

  const submitEditSubdivision = useCallback(async () => {
    if (!countryId || !selectedFeature) return;
    try {
      await updateSubdivision.mutateAsync({
        countryId,
        subdivisionId: selectedFeature.id,
        name: subdivisionForm.name,
        type: subdivisionForm.type,
        level: subdivisionForm.level,
        geometry: (selectedFeature.geometry || subdivisionForm.geometry) as Record<string, unknown>,
        capital: subdivisionForm.capital,
        population: subdivisionForm.population,
      });
      setLastSavedAt(new Date());
      resetForm();
      setMode("view");
      invalidateAllMapData();
      debouncedRefetch();
    } catch (e: any) {
      setMutationError(e.message || "Failed to update subdivision");
    }
  }, [countryId, selectedFeature, subdivisionForm, updateSubdivision, resetForm, invalidateAllMapData, debouncedRefetch]);

  const submitPOI = useCallback(async () => {
    if (!countryId || !pendingCoordinates) return;
    try {
      await createPOI.mutateAsync({
        countryId,
        name: poiForm.name,
        category: poiForm.category,
        coordinates: pendingCoordinates,
        description: poiForm.description,
        icon: poiForm.icon,
        wikiPageTitle: poiForm.wikiPageTitle,
      });
      setLastSavedAt(new Date());
      resetForm();
      setMode("view");
      invalidateAllMapData();
      debouncedRefetch();
    } catch (e: any) {
      setMutationError(e.message || "Failed to create POI");
    }
  }, [countryId, pendingCoordinates, poiForm, createPOI, resetForm, invalidateAllMapData, debouncedRefetch]);

  const submitEditPOI = useCallback(async () => {
    if (!countryId || !selectedFeature) return;
    try {
      await updatePOI.mutateAsync({
        countryId,
        poiId: selectedFeature.id,
        name: poiForm.name,
        category: poiForm.category,
        coordinates: selectedFeature.coordinates!,
        description: poiForm.description,
        icon: poiForm.icon,
        wikiPageTitle: poiForm.wikiPageTitle,
      });
      setLastSavedAt(new Date());
      resetForm();
      setMode("view");
      invalidateAllMapData();
      debouncedRefetch();
    } catch (e: any) {
      setMutationError(e.message || "Failed to update POI");
    }
  }, [countryId, selectedFeature, poiForm, updatePOI, resetForm, invalidateAllMapData, debouncedRefetch]);

  const submitStoryPin = useCallback(async () => {
    if (!countryId || !pendingCoordinates) return;
    try {
      await createStoryPin.mutateAsync({
        countryId,
        title: storyPinForm.title,
        coordinates: pendingCoordinates,
        content: storyPinForm.content,
        ixTimeYear: storyPinForm.ixTimeYear,
        category: storyPinForm.category as any,
      });
      setLastSavedAt(new Date());
      resetForm();
      setMode("view");
      invalidateAllMapData();
      debouncedRefetch();
    } catch (e: any) {
      setMutationError(e.message || "Failed to create story pin");
    }
  }, [countryId, pendingCoordinates, storyPinForm, createStoryPin, resetForm, invalidateAllMapData, debouncedRefetch]);

  const submitEditStoryPin = useCallback(async () => {
    if (!countryId || !selectedFeature) return;
    try {
      await updateStoryPin.mutateAsync({
        countryId,
        pinId: selectedFeature.id,
        title: storyPinForm.title,
        coordinates: selectedFeature.coordinates!,
        content: storyPinForm.content,
        ixTimeYear: storyPinForm.ixTimeYear,
        category: storyPinForm.category as any,
      });
      setLastSavedAt(new Date());
      resetForm();
      setMode("view");
      invalidateAllMapData();
      debouncedRefetch();
    } catch (e: any) {
      setMutationError(e.message || "Failed to update story pin");
    }
  }, [countryId, selectedFeature, storyPinForm, updateStoryPin, resetForm, invalidateAllMapData, debouncedRefetch]);

  const submitMapLabel = useCallback(async () => {
    if (!countryId || !pendingCoordinates) return;
    try {
      await createMapLabel.mutateAsync({
        countryId,
        text: mapLabelForm.text,
        coordinates: pendingCoordinates,
        labelType: mapLabelForm.labelType as any,
        fontSize: mapLabelForm.fontSize,
      });
      setLastSavedAt(new Date());
      resetForm();
      setMode("view");
      invalidateAllMapData();
      debouncedRefetch();
    } catch (e: any) {
      setMutationError(e.message || "Failed to create map label");
    }
  }, [countryId, pendingCoordinates, mapLabelForm, createMapLabel, resetForm, invalidateAllMapData, debouncedRefetch]);

  const submitEditMapLabel = useCallback(async () => {
    if (!countryId || !selectedFeature) return;
    try {
      await updateMapLabel.mutateAsync({
        countryId,
        labelId: selectedFeature.id,
        text: mapLabelForm.text,
        coordinates: selectedFeature.coordinates!,
        labelType: mapLabelForm.labelType as any,
        fontSize: mapLabelForm.fontSize,
      });
      setLastSavedAt(new Date());
      resetForm();
      setMode("view");
      invalidateAllMapData();
      debouncedRefetch();
    } catch (e: any) {
      setMutationError(e.message || "Failed to update map label");
    }
  }, [countryId, selectedFeature, mapLabelForm, updateMapLabel, resetForm, invalidateAllMapData, debouncedRefetch]);

  const submitPeak = useCallback(async () => {
    if (!countryId || !pendingCoordinates) return;
    try {
      await createPeak.mutateAsync({
        countryId,
        name: peakForm.name,
        coordinates: pendingCoordinates,
        elevation: peakForm.elevation,
        prominence: peakForm.prominence,
      });
      setLastSavedAt(new Date());
      resetForm();
      setMode("view");
      invalidateAllMapData();
      debouncedRefetch();
    } catch (e: any) {
      setMutationError(e.message || "Failed to create peak");
    }
  }, [countryId, pendingCoordinates, peakForm, createPeak, resetForm, invalidateAllMapData, debouncedRefetch]);

  const submitEditPeak = useCallback(async () => {
    if (!countryId || !selectedFeature) return;
    try {
      await updatePeak.mutateAsync({
        countryId,
        peakId: selectedFeature.id,
        name: peakForm.name,
        coordinates: selectedFeature.coordinates!,
        elevation: peakForm.elevation,
        prominence: peakForm.prominence,
      });
      setLastSavedAt(new Date());
      resetForm();
      setMode("view");
      invalidateAllMapData();
      debouncedRefetch();
    } catch (e: any) {
      setMutationError(e.message || "Failed to update peak");
    }
  }, [countryId, selectedFeature, peakForm, updatePeak, resetForm, invalidateAllMapData, debouncedRefetch]);

  const submitRiver = useCallback(async () => {
    if (!countryId || !pendingGeometry) return;
    try {
      await createNamedRiver.mutateAsync({
        countryId,
        name: riverForm.name,
        geometry: pendingGeometry as Record<string, unknown>,
      });
      setLastSavedAt(new Date());
      resetForm();
      setMode("view");
      invalidateAllMapData();
      debouncedRefetch();
    } catch (e: any) {
      setMutationError(e.message || "Failed to create river");
    }
  }, [countryId, pendingGeometry, riverForm, createNamedRiver, resetForm, invalidateAllMapData, debouncedRefetch]);

  const submitEditRiver = useCallback(async () => {
    if (!countryId || !selectedFeature) return;
    try {
      await updateNamedRiver.mutateAsync({
        countryId,
        riverId: selectedFeature.id,
        name: riverForm.name,
        geometry: (selectedFeature.geometry || pendingGeometry) as Record<string, unknown>,
      });
      setLastSavedAt(new Date());
      resetForm();
      setMode("view");
      invalidateAllMapData();
      debouncedRefetch();
    } catch (e: any) {
      setMutationError(e.message || "Failed to update river");
    }
  }, [countryId, selectedFeature, riverForm, pendingGeometry, updateNamedRiver, resetForm, invalidateAllMapData, debouncedRefetch]);

  const submitLake = useCallback(async () => {
    if (!countryId || !pendingGeometry) return;
    try {
      await createNamedLake.mutateAsync({
        countryId,
        name: lakeForm.name,
        geometry: pendingGeometry as Record<string, unknown>,
        maxDepthM: lakeForm.maxDepthM,
      });
      setLastSavedAt(new Date());
      resetForm();
      setMode("view");
      invalidateAllMapData();
      debouncedRefetch();
    } catch (e: any) {
      setMutationError(e.message || "Failed to create lake");
    }
  }, [countryId, pendingGeometry, lakeForm, createNamedLake, resetForm, invalidateAllMapData, debouncedRefetch]);

  const submitEditLake = useCallback(async () => {
    if (!countryId || !selectedFeature) return;
    try {
      await updateNamedLake.mutateAsync({
        countryId,
        lakeId: selectedFeature.id,
        name: lakeForm.name,
        geometry: (selectedFeature.geometry || pendingGeometry) as Record<string, unknown>,
        maxDepthM: lakeForm.maxDepthM,
      });
      setLastSavedAt(new Date());
      resetForm();
      setMode("view");
      invalidateAllMapData();
      debouncedRefetch();
    } catch (e: any) {
      setMutationError(e.message || "Failed to update lake");
    }
  }, [countryId, selectedFeature, lakeForm, pendingGeometry, updateNamedLake, resetForm, invalidateAllMapData, debouncedRefetch]);

  // ── Delete Feature ──
  const handleDeleteFeature = useCallback(
    async (feature: EditorFeature) => {
      if (!countryId) return;
      try {
        switch (feature.type) {
          case "city":
            await deleteCity.mutateAsync({ countryId, cityId: feature.id });
            break;
          case "subdivision":
            await deleteSubdivision.mutateAsync({ countryId, subdivisionId: feature.id });
            break;
          case "poi":
            await deletePOI.mutateAsync({ countryId, poiId: feature.id });
            break;
          case "peak":
            await deletePeak.mutateAsync({ countryId, peakId: feature.id });
            break;
          case "storyPin":
            await deleteStoryPin.mutateAsync({ countryId, pinId: feature.id });
            break;
          case "mapLabel":
            await deleteMapLabel.mutateAsync({ countryId, labelId: feature.id });
            break;
          case "river":
            await deleteNamedRiver.mutateAsync({ countryId, riverId: feature.id });
            break;
          case "lake":
            await deleteNamedLake.mutateAsync({ countryId, lakeId: feature.id });
            break;
          case "route":
            await deleteRoute.mutateAsync({ countryId, id: feature.id });
            break;
        }
        resetForm();
        setMode("view");
        invalidateAllMapData();
        debouncedRefetch();
      } catch (e: any) {
        setMutationError(e.message || "Failed to delete feature");
      }
    },
    [countryId, deleteCity, deleteSubdivision, deletePOI, deletePeak, deleteStoryPin, deleteMapLabel, deleteNamedRiver, deleteNamedLake, deleteRoute, resetForm, invalidateAllMapData, debouncedRefetch]
  );

  // ── Map Events & Drawing ──
  const handleMapClick = useCallback(
    (coords: [number, number]) => {
      if (mode.startsWith("add-")) {
        setPendingCoordinates(coords);
      }
    },
    [mode]
  );

  const handleDrawComplete = useCallback(
    (geometry: object) => {
      setPendingGeometry(geometry);
    },
    []
  );

  const updateSubdivisionGeometry = useCallback(
    async (subdivisionId: string, geometry: object) => {
      if (!countryId) return;
      await updateSubdivision.mutateAsync({
        countryId,
        subdivisionId,
        geometry: geometry as Record<string, unknown>,
      });
      invalidateAllMapData();
      debouncedRefetch();
    },
    [countryId, updateSubdivision, invalidateAllMapData, debouncedRefetch]
  );

  const updatePointCoordinates = useCallback(
    async (featureType: string, id: string, coordinates: [number, number]) => {
      if (!countryId) return;
      if (featureType === "city") {
        await updateCity.mutateAsync({ countryId, cityId: id, coordinates });
      } else if (featureType === "poi") {
        await updatePOI.mutateAsync({ countryId, poiId: id, coordinates });
      } else if (featureType === "peak") {
        await updatePeak.mutateAsync({ countryId, peakId: id, coordinates });
      } else if (featureType === "storyPin") {
        await updateStoryPin.mutateAsync({ countryId, pinId: id, coordinates });
      } else if (featureType === "mapLabel") {
        await updateMapLabel.mutateAsync({ countryId, labelId: id, coordinates });
      }
      invalidateAllMapData();
      debouncedRefetch();
    },
    [countryId, updateCity, updatePOI, updatePeak, updateStoryPin, updateMapLabel, invalidateAllMapData, debouncedRefetch]
  );

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
  }, [countryId, editingRouteId, editingRouteVertices, updateRouteGeometry, invalidateAllMapData, debouncedRefetch]);

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
      await handleDeleteFeature(feat);
    }
    clearMultiSelect();
  }, [countryId, selectedIds, allFeatures, handleDeleteFeature, clearMultiSelect]);

  const bulkEditSelected = useCallback(
    async (updates: Record<string, any>) => {
      if (!countryId || selectedIds.size === 0) return;
      const toEdit = allFeatures.filter((f) => selectedIds.has(f.id));
      for (const feat of toEdit) {
        if (feat.type === "city") {
          await updateCity.mutateAsync({
            countryId,
            cityId: feat.id,
            name: feat.name,
            coordinates: feat.coordinates!,
            ...updates,
          });
        } else if (feat.type === "subdivision") {
          await updateSubdivision.mutateAsync({
            countryId,
            subdivisionId: feat.id,
            name: feat.name,
            geometry: feat.geometry as Record<string, unknown> | undefined,
            ...updates,
          });
        }
      }
      clearMultiSelect();
      invalidateAllMapData();
      debouncedRefetch();
    },
    [countryId, selectedIds, allFeatures, updateCity, updateSubdivision, clearMultiSelect, invalidateAllMapData, debouncedRefetch]
  );

  const duplicateFeature = useCallback(
    async (feature: EditorFeature) => {
      if (!countryId) return;
      const offset = 0.05;
      if (feature.coordinates) {
        const [lng, lat] = feature.coordinates;
        await updatePointCoordinates(feature.type, feature.id, [lng + offset, lat + offset]);
      }
    },
    [countryId, updatePointCoordinates]
  );

  // ── Gaps Calculation ──
  const recalculateGaps = useCallback(() => {
    if (!countryGeo || !features?.subdivisions) return;
    const gaps = calculateNegativeSpaceGaps(countryGeo, features.subdivisions);
    setGapFeatures(gaps);
  }, [countryGeo, features]);

  const createSubdivisionFromGap = useCallback(
    async (gapGeom: any) => {
      if (!countryId || !gapGeom) return;
      await createSubdivision.mutateAsync({
        countryId,
        name: "New Province",
        geometry: gapGeom as Record<string, unknown>,
        type: "province",
        level: 1,
      });
      invalidateAllMapData();
      debouncedRefetch();
    },
    [countryId, createSubdivision, invalidateAllMapData, debouncedRefetch]
  );

  // ── Undo / Redo Stubs ──
  const undo = useCallback(() => {
    stepUndo();
  }, [stepUndo]);

  const redo = useCallback(() => {
    stepRedo();
  }, [stepRedo]);

  const jumpToHistoryPosition = useCallback((_pos: number) => {}, []);

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
    handleDeleteFeature,
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
    lastSavedAt,
    validationErrors,
    refetchFeatures,
    historyCanUndo,
    historyCanRedo,
    history,
    pushAction,
    undo,
    redo,
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
    bulkEditSelected,
    duplicateFeature,
    showGaps,
    setShowGaps,
    gapFeatures,
    recalculateGaps,
    createSubdivisionFromGap,
    scatterCities: async (_count?: number, _type?: string, _prefix?: string) => {},
    snapCityToSubdivisionBorder: async () => {},
    snapCityToCoastline: async () => {},
    mergeSelectedCities: transforms.mergeSelectedCities,
    splitCity: transforms.splitCity,
    scaleSelectedCitiesPopulation: transforms.scaleSelectedCitiesPopulation,
    rotateSelectedCities: transforms.rotateSelectedCities,
    emptyRegionsFeatures,
    showEmptyRegions,
    setShowEmptyRegions,
    createCentroidCities: async () => {},
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
    jumpToHistoryPosition,
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
