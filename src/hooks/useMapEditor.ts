// @ts-nocheck
"use client";

/**
 * useMapEditor - State management hook for the MyCountry map editor.
 *
 * Handles editing mode, feature CRUD, and drawing state.
 */

import { useState, useCallback, useMemo, useRef } from "react";
import { api } from "~/trpc/react";

// ── Undo/Redo Types ──

interface EditorAction {
  type: "create" | "delete" | "update";
  featureType: FeatureType;
  featureId: string;
  /** Data needed to undo (previous state for update/delete, or id for create) */
  previousData?: Record<string, unknown>;
  /** Data needed to redo (new state for update/create) */
  newData?: Record<string, unknown>;
}

interface EditorHistory {
  actions: EditorAction[];
  position: number; // -1 = at base, 0+ = index of last applied action
}

export type EditorMode =
  | "view"
  | "add-city"
  | "add-subdivision"
  | "add-poi"
  | "add-story-pin"
  | "add-label"
  | "edit-city"
  | "edit-subdivision"
  | "edit-poi"
  | "edit-story-pin"
  | "edit-label"
  | "import-provinces"
  | "add-route"
  | "paint";

export type FeatureType = "city" | "subdivision" | "poi" | "storyPin" | "mapLabel";

export interface EditorFeature {
  id: string;
  type: FeatureType;
  name: string;
  coordinates?: [number, number];
  geometry?: object;
  properties: Record<string, unknown>;
}

export interface CityFormData {
  name: string;
  cityType: string;
  population?: number;
  isNationalCapital: boolean;
  isSubdivisionCapital: boolean;
  subdivisionId?: string;
  wikiPageTitle?: string;
  elevation?: number;
  foundedYear?: number;
}

export interface SubdivisionFormData {
  name: string;
  type: string;
  level: number;
  capital?: string;
  population?: number;
  areaSqKm?: number;
  color?: string;
  wikiPageTitle?: string;
}

export interface POIFormData {
  name: string;
  category: string;
  description?: string;
  icon?: string;
  wikiPageTitle?: string;
  subdivisionId?: string;
}

export interface StoryPinFormData {
  title: string;
  content: string;
  contentFormat: "plain" | "markdown";
  category: string;
  importance: number;
  ixTimeYear?: number;
  eraLabel?: string;
  wikiPageTitle?: string;
  photos?: string[];
  thumbnailUrl?: string;
  storylineId?: string;
  storylineOrder?: number;
}

export interface MapLabelFormData {
  text: string;
  labelType: string;
  fontSize: number;
  color: string;
  rotation: number;
  letterSpacing: number;
  fontWeight: string;
  opacity: number;
  minZoom: number;
  maxZoom: number;
  wikiPageTitle?: string;
}

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

const DEFAULT_CITY: CityFormData = {
  name: "",
  cityType: "city",
  population: undefined,
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

interface UseMapEditorOptions {
  /** Skip the linkage gate for geometry — used in admin Forge mode */
  skipLinkageGate?: boolean;
}

export function useMapEditor(countryId: string | undefined, options?: UseMapEditorOptions) {
  const utils = api.useUtils();

  /** Invalidate ALL client-side map data caches after a mutation.
   *  Server-side caches (Redis/memory) are cleared by invalidateCache() in geo.ts.
   *  This covers React Query cache entries used by the main map and editor. */
  const invalidateAllMapData = useCallback(() => {
    utils.geoCore.getMapBundle.invalidate();
    utils.geoCore.getWorldMap.invalidate();
    utils.geoCore.getCountryFeatures.invalidate();
    utils.geoFeatures.getAllStoryPins.invalidate();
    utils.geoFeatures.getAllMapLabels.invalidate();
    utils.geoCore.getCapitalCities.invalidate();
    utils.geoCore.getCountryGeometry.invalidate();
    utils.geoCore.getCountryLinkage.invalidate();
  }, [utils]);

  const [mode, setModeRaw] = useState<EditorMode>("view");
  const setMode = useCallback((newMode: EditorMode) => {
    setModeRaw(newMode);
    setValidationErrors({});
  }, []);
  const [selectedFeature, setSelectedFeature] = useState<EditorFeature | null>(null);
  const [pendingCoordinates, setPendingCoordinates] = useState<[number, number] | null>(null);
  const [pendingGeometry, setPendingGeometry] = useState<object | null>(null);
  const [cityForm, setCityForm] = useState<CityFormData>(DEFAULT_CITY);
  const [subdivisionForm, setSubdivisionForm] = useState<SubdivisionFormData>(DEFAULT_SUBDIVISION);
  const [poiForm, setPOIForm] = useState<POIFormData>(DEFAULT_POI);
  const [storyPinForm, setStoryPinForm] = useState<StoryPinFormData>(DEFAULT_STORY_PIN);
  const [mapLabelForm, setMapLabelForm] = useState<MapLabelFormData>(DEFAULT_MAP_LABEL);
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const lastSavedTimerRef = useRef<ReturnType<typeof setTimeout>>();

  // ── Route Drawing State ──
  const [routeWaypoints, setRouteWaypoints] = useState<[number, number][]>([]);

  // ── Multi-Select ──
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const toggleSelectId = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);
  const clearMultiSelect = useCallback(() => setSelectedIds(new Set()), []);

  // ── Undo/Redo History ──
  const [history, setHistory] = useState<EditorHistory>({ actions: [], position: -1 });

  const pushAction = useCallback((action: EditorAction) => {
    setHistory((prev) => {
      // Truncate any redo entries
      const actions = prev.actions.slice(0, prev.position + 1);
      actions.push(action);
      // Keep max 50 actions
      if (actions.length > 50) actions.shift();
      return { actions, position: actions.length - 1 };
    });
  }, []);

  const historyCanUndo = history.position >= 0;
  const historyCanRedo = history.position < history.actions.length - 1;

  // Undo/redo mutation refs — populated after mutations are declared (avoids TDZ)
  const mutationRefs = useRef<Record<string, any>>({});

  /** Reverse an action for undo. Uses mutationRefs to avoid circular init. */
  const reverseAction = useCallback(
    async (action: EditorAction) => {
      if (!countryId) return;
      const m = mutationRefs.current;
      switch (action.type) {
        case "create":
          switch (action.featureType) {
            case "city":
              await m.deleteCity?.mutateAsync({ countryId, cityId: action.featureId });
              break;
            case "subdivision":
              await m.deleteSubdivision?.mutateAsync({
                countryId,
                subdivisionId: action.featureId,
              });
              break;
            case "poi":
              await m.deletePOI?.mutateAsync({ countryId, poiId: action.featureId });
              break;
            case "storyPin":
              await m.deleteStoryPin?.mutateAsync({ countryId, pinId: action.featureId });
              break;
            case "mapLabel":
              await m.deleteMapLabel?.mutateAsync({ countryId, labelId: action.featureId });
              break;
          }
          break;
        case "delete":
          if (action.previousData) {
            const d = action.previousData;
            const p = d.properties as Record<string, unknown> | undefined;
            switch (action.featureType) {
              case "city":
                await m.createCity?.mutateAsync({
                  countryId,
                  name: d.name,
                  cityType: p?.cityType ?? "city",
                  coordinates: d.coordinates,
                  population: p?.population,
                  isNationalCapital: !!p?.isNationalCapital,
                  isSubdivisionCapital: !!p?.isSubdivisionCapital,
                });
                break;
              case "poi":
                await m.createPOI?.mutateAsync({
                  countryId,
                  name: d.name,
                  category: p?.category ?? "landmark",
                  coordinates: d.coordinates,
                  description: p?.description,
                });
                break;
              case "subdivision":
                await m.createSubdivision?.mutateAsync({
                  countryId,
                  name: d.name,
                  type: p?.type ?? "province",
                  level: p?.level ?? 1,
                  geometry: d.geometry,
                });
                break;
              case "storyPin":
                await m.createStoryPin?.mutateAsync({
                  countryId,
                  title: d.name,
                  content: p?.content ?? "",
                  category: p?.category ?? "cultural",
                  coordinates: d.coordinates,
                });
                break;
              case "mapLabel":
                await m.createMapLabel?.mutateAsync({
                  countryId,
                  text: d.name,
                  labelType: p?.labelType ?? "mountain_range",
                  coordinates: d.coordinates,
                  fontSize: p?.fontSize ?? 14,
                  color: p?.color ?? "#374151",
                  rotation: p?.rotation ?? 0,
                  letterSpacing: p?.letterSpacing ?? 0,
                  fontWeight: p?.fontWeight ?? "normal",
                  opacity: p?.opacity ?? 1,
                  minZoom: p?.minZoom ?? 4,
                  maxZoom: p?.maxZoom ?? 18,
                });
                break;
            }
          }
          break;
        case "update":
          if (action.previousData) {
            const d = action.previousData;
            const p = d.properties as Record<string, unknown> | undefined;
            switch (action.featureType) {
              case "city":
                await m.updateCity?.mutateAsync({
                  countryId,
                  cityId: action.featureId,
                  name: d.name,
                  cityType: p?.cityType,
                  population: p?.population,
                  isNationalCapital: !!p?.isNationalCapital,
                  isSubdivisionCapital: !!p?.isSubdivisionCapital,
                });
                break;
              case "subdivision":
                await m.updateSubdivision?.mutateAsync({
                  countryId,
                  subdivisionId: action.featureId,
                  name: d.name,
                  type: p?.type,
                  level: p?.level,
                });
                break;
              case "poi":
                await m.updatePOI?.mutateAsync({
                  countryId,
                  poiId: action.featureId,
                  name: d.name,
                  category: p?.category,
                  description: p?.description,
                });
                break;
              case "storyPin":
                await m.updateStoryPin?.mutateAsync({
                  countryId,
                  pinId: action.featureId,
                  title: d.name,
                  content: p?.content,
                  category: p?.category,
                });
                break;
              case "mapLabel":
                await m.updateMapLabel?.mutateAsync({
                  countryId,
                  labelId: action.featureId,
                  text: d.name,
                  labelType: p?.labelType,
                  fontSize: p?.fontSize,
                  color: p?.color,
                  rotation: p?.rotation,
                  letterSpacing: p?.letterSpacing,
                  fontWeight: p?.fontWeight,
                  opacity: p?.opacity,
                  minZoom: p?.minZoom,
                  maxZoom: p?.maxZoom,
                });
                break;
            }
          }
          break;
      }
      m.refetchFeatures?.();
    },
    [countryId]
  );

  /** Apply an action forward for redo. Uses mutationRefs. */
  const applyAction = useCallback(
    async (action: EditorAction) => {
      if (!countryId) return;
      const m = mutationRefs.current;
      switch (action.type) {
        case "create":
          if (action.newData) {
            const d = action.newData;
            switch (action.featureType) {
              case "city":
                await m.createCity?.mutateAsync({ countryId, ...d });
                break;
              case "subdivision":
                await m.createSubdivision?.mutateAsync({ countryId, ...d });
                break;
              case "poi":
                await m.createPOI?.mutateAsync({ countryId, ...d });
                break;
              case "storyPin":
                await m.createStoryPin?.mutateAsync({ countryId, ...d });
                break;
              case "mapLabel":
                await m.createMapLabel?.mutateAsync({ countryId, ...d });
                break;
            }
          }
          break;
        case "delete":
          switch (action.featureType) {
            case "city":
              await m.deleteCity?.mutateAsync({ countryId, cityId: action.featureId });
              break;
            case "subdivision":
              await m.deleteSubdivision?.mutateAsync({
                countryId,
                subdivisionId: action.featureId,
              });
              break;
            case "poi":
              await m.deletePOI?.mutateAsync({ countryId, poiId: action.featureId });
              break;
            case "storyPin":
              await m.deleteStoryPin?.mutateAsync({ countryId, pinId: action.featureId });
              break;
            case "mapLabel":
              await m.deleteMapLabel?.mutateAsync({ countryId, labelId: action.featureId });
              break;
          }
          break;
        case "update":
          if (action.newData) {
            const d = action.newData;
            const p = d.properties as Record<string, unknown> | undefined;
            switch (action.featureType) {
              case "city":
                await m.updateCity?.mutateAsync({
                  countryId,
                  cityId: action.featureId,
                  name: d.name,
                  cityType: p?.cityType,
                  population: p?.population,
                  isNationalCapital: !!p?.isNationalCapital,
                  isSubdivisionCapital: !!p?.isSubdivisionCapital,
                });
                break;
              case "subdivision":
                await m.updateSubdivision?.mutateAsync({
                  countryId,
                  subdivisionId: action.featureId,
                  name: d.name,
                  type: p?.type,
                  level: p?.level,
                });
                break;
              case "poi":
                await m.updatePOI?.mutateAsync({
                  countryId,
                  poiId: action.featureId,
                  name: d.name,
                  category: p?.category,
                  description: p?.description,
                });
                break;
              case "storyPin":
                await m.updateStoryPin?.mutateAsync({
                  countryId,
                  pinId: action.featureId,
                  title: d.name,
                  content: p?.content,
                  category: p?.category,
                });
                break;
              case "mapLabel":
                await m.updateMapLabel?.mutateAsync({
                  countryId,
                  labelId: action.featureId,
                  text: d.name,
                  labelType: p?.labelType,
                  fontSize: p?.fontSize,
                  color: p?.color,
                  rotation: p?.rotation,
                  letterSpacing: p?.letterSpacing,
                  fontWeight: p?.fontWeight,
                  opacity: p?.opacity,
                  minZoom: p?.minZoom,
                  maxZoom: p?.maxZoom,
                });
                break;
            }
          }
          break;
      }
      m.refetchFeatures?.();
    },
    [countryId]
  );

  const undo = useCallback(async () => {
    if (!historyCanUndo) return;
    const action = history.actions[history.position];
    if (!action) return;
    await reverseAction(action);
    setHistory((prev) => ({ ...prev, position: prev.position - 1 }));
  }, [history, historyCanUndo, reverseAction]);

  const redo = useCallback(async () => {
    if (!historyCanRedo) return;
    const action = history.actions[history.position + 1];
    if (!action) return;
    await applyAction(action);
    setHistory((prev) => ({ ...prev, position: prev.position + 1 }));
  }, [history, historyCanRedo, applyAction]);

  // Fetch country features
  const {
    data: features,
    isLoading: featuresLoading,
    refetch: refetchFeatures,
  } = api.geoCore.getCountryFeatures.useQuery(
    { countryId: countryId ?? "" },
    { enabled: !!countryId, staleTime: 60_000 }
  );

  // Check if country is linked to a map feature (non-throwing)
  const { data: linkage, isLoading: linkageLoading } = api.geoCore.getCountryLinkage.useQuery(
    { countryId: countryId ?? "" },
    { enabled: !!countryId, staleTime: 5 * 60_000 }
  );

  // Fetch country geometry (boundary for display + validation) — only if linked (or skipLinkageGate for admin Forge)
  const { data: countryGeo, isLoading: geometryLoading } = api.geoCore.getCountryGeometry.useQuery(
    { countryId: countryId ?? "" },
    {
      enabled: !!countryId && (!!linkage?.isLinked || !!options?.skipLinkageGate),
      staleTime: 5 * 60_000,
    }
  );

  // Fetch terrain info at the pending click point
  const { data: pendingPointInfo, isLoading: isPendingPointInfoLoading } =
    api.geoCore.getPointInfo.useQuery(
      { lng: pendingCoordinates?.[0] ?? 0, lat: pendingCoordinates?.[1] ?? 0 },
      { enabled: !!pendingCoordinates, staleTime: 60_000 }
    );

  // Debounced refetch — prevents cascading refetches from undo/redo
  const pendingRefetchRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const debouncedRefetch = useCallback(() => {
    if (pendingRefetchRef.current) clearTimeout(pendingRefetchRef.current);
    pendingRefetchRef.current = setTimeout(() => {
      refetchFeatures();
      pendingRefetchRef.current = null;
    }, 100);
  }, [refetchFeatures]);

  // Mutations
  const createCity = api.geoFeatures.createCity.useMutation({
    onSuccess: () => {
      invalidateAllMapData();
      debouncedRefetch();
      continuePlacing("add-city");
    },
  });

  const updateCity = api.geoFeatures.updateCity.useMutation({
    onSuccess: () => {
      invalidateAllMapData();
      debouncedRefetch();
      resetForm();
    },
  });

  const deleteCity = api.geoFeatures.deleteCity.useMutation({
    onSuccess: () => {
      invalidateAllMapData();
      debouncedRefetch();
      setSelectedFeature(null);
    },
  });

  const createSubdivision = api.geoFeatures.createSubdivision.useMutation({
    onSuccess: () => {
      invalidateAllMapData();
      debouncedRefetch();
      continuePlacing("add-subdivision");
    },
  });

  const updateSubdivision = api.geoFeatures.updateSubdivision.useMutation({
    onSuccess: () => {
      invalidateAllMapData();
      debouncedRefetch();
      resetForm();
    },
  });

  const deleteSubdivision = api.geoFeatures.deleteSubdivision.useMutation({
    onSuccess: () => {
      invalidateAllMapData();
      debouncedRefetch();
      setSelectedFeature(null);
    },
  });

  const createPOI = api.geoFeatures.createPOI.useMutation({
    onSuccess: () => {
      invalidateAllMapData();
      debouncedRefetch();
      continuePlacing("add-poi");
    },
  });

  const updatePOI = api.geoFeatures.updatePOI.useMutation({
    onSuccess: () => {
      invalidateAllMapData();
      debouncedRefetch();
      resetForm();
    },
  });

  const deletePOI = api.geoFeatures.deletePOI.useMutation({
    onSuccess: () => {
      invalidateAllMapData();
      debouncedRefetch();
      setSelectedFeature(null);
    },
  });

  // Story Pin mutations
  const createStoryPin = api.geoFeatures.createStoryPin.useMutation({
    onSuccess: () => {
      invalidateAllMapData();
      debouncedRefetch();
      continuePlacing("add-story-pin");
    },
  });
  const updateStoryPin = api.geoFeatures.updateStoryPin.useMutation({
    onSuccess: () => {
      invalidateAllMapData();
      debouncedRefetch();
      resetForm();
    },
  });
  const deleteStoryPin = api.geoFeatures.deleteStoryPin.useMutation({
    onSuccess: () => {
      invalidateAllMapData();
      debouncedRefetch();
      setSelectedFeature(null);
    },
  });

  // Map Label mutations
  const createMapLabel = api.geoFeatures.createMapLabel.useMutation({
    onSuccess: () => {
      invalidateAllMapData();
      debouncedRefetch();
      continuePlacing("add-label");
    },
  });
  const updateMapLabel = api.geoFeatures.updateMapLabel.useMutation({
    onSuccess: () => {
      invalidateAllMapData();
      debouncedRefetch();
      resetForm();
    },
  });
  const deleteMapLabel = api.geoFeatures.deleteMapLabel.useMutation({
    onSuccess: () => {
      invalidateAllMapData();
      debouncedRefetch();
      setSelectedFeature(null);
    },
  });

  // Route mutation
  const createRoute = api.transport.createRoute.useMutation({
    onSuccess: () => {
      setRouteWaypoints([]);
    },
  });

  // Populate mutation refs for undo/redo (avoids TDZ circular dependency)
  mutationRefs.current = {
    createCity,
    updateCity,
    deleteCity,
    createSubdivision,
    updateSubdivision,
    deleteSubdivision,
    createPOI,
    updatePOI,
    deletePOI,
    createStoryPin,
    updateStoryPin,
    deleteStoryPin,
    createMapLabel,
    updateMapLabel,
    deleteMapLabel,
    refetchFeatures: debouncedRefetch,
  };

  // ── Route Drawing Functions ──
  const finishRoute = useCallback(
    async (routeType = "road", name?: string) => {
      if (!countryId || routeWaypoints.length < 2) return;
      const geometry = {
        type: "LineString" as const,
        coordinates: routeWaypoints,
      };
      await createRoute.mutateAsync({
        countryId,
        routeType,
        name,
        geometry,
      });
    },
    [countryId, routeWaypoints, createRoute]
  );

  const undoLastWaypoint = useCallback(() => {
    setRouteWaypoints((prev) => prev.slice(0, -1));
  }, []);

  const clearRouteWaypoints = useCallback(() => {
    setRouteWaypoints([]);
  }, []);

  const resetForm = useCallback(() => {
    setMode("view");
    setSelectedFeature(null);
    setPendingCoordinates(null);
    setPendingGeometry(null);
    setCityForm(DEFAULT_CITY);
    setSubdivisionForm(DEFAULT_SUBDIVISION);
    setPOIForm(DEFAULT_POI);
    setStoryPinForm(DEFAULT_STORY_PIN);
    setMapLabelForm(DEFAULT_MAP_LABEL);
    setRouteWaypoints([]);
    setLastSavedAt(null);
    setValidationErrors({});
  }, []);

  /** Validate feature data before submit. Returns errors record (empty = valid). */
  const validateFeature = useCallback(
    (featureType: FeatureType, isEdit: boolean): Record<string, string> => {
      const errors: Record<string, string> = {};

      switch (featureType) {
        case "city": {
          if (!cityForm.name.trim()) errors.name = "Name is required";
          if (cityForm.population !== undefined && cityForm.population <= 0) {
            errors.population = "Population must be positive";
          }
          if (!isEdit && !pendingCoordinates) {
            errors.coordinates = "Click on the map to set location";
          }
          break;
        }
        case "subdivision": {
          if (!subdivisionForm.name.trim()) errors.name = "Name is required";
          if (!isEdit && !pendingGeometry) {
            errors.geometry = "Draw a polygon on the map";
          }
          break;
        }
        case "poi": {
          if (!poiForm.name.trim()) errors.name = "Name is required";
          if (!isEdit && !pendingCoordinates) {
            errors.coordinates = "Click on the map to set location";
          }
          break;
        }
        case "storyPin": {
          if (!storyPinForm.title.trim()) errors.title = "Title is required";
          if (!storyPinForm.content.trim()) errors.content = "Content is required";
          if (!isEdit && !pendingCoordinates) {
            errors.coordinates = "Click on the map to set location";
          }
          break;
        }
        case "mapLabel": {
          if (!mapLabelForm.text.trim()) errors.text = "Text is required";
          if (mapLabelForm.fontSize < 8 || mapLabelForm.fontSize > 48) {
            errors.fontSize = "Font size must be between 8 and 48";
          }
          if (!isEdit && !pendingCoordinates) {
            errors.coordinates = "Click on the map to set location";
          }
          break;
        }
      }

      return errors;
    },
    [
      cityForm,
      subdivisionForm,
      poiForm,
      storyPinForm,
      mapLabelForm,
      pendingCoordinates,
      pendingGeometry,
    ]
  );

  /** After a successful save, stay in the same add mode and clear only location + name. */
  const continuePlacing = useCallback((currentMode: EditorMode) => {
    setPendingCoordinates(null);
    setPendingGeometry(null);
    setSelectedFeature(null);
    // Clear name but preserve type/category settings
    if (currentMode === "add-city") {
      setCityForm((prev) => ({
        ...prev,
        name: "",
        population: undefined,
        wikiPageTitle: undefined,
      }));
    } else if (currentMode === "add-subdivision") {
      setSubdivisionForm((prev) => ({ ...prev, name: "", population: undefined }));
    } else if (currentMode === "add-poi") {
      setPOIForm((prev) => ({ ...prev, name: "", description: "", wikiPageTitle: undefined }));
    } else if (currentMode === "add-story-pin") {
      setStoryPinForm((prev) => ({
        ...prev,
        title: "",
        content: "",
        wikiPageTitle: undefined,
        photos: undefined,
      }));
    } else if (currentMode === "add-label") {
      setMapLabelForm((prev) => ({ ...prev, text: "", wikiPageTitle: undefined }));
    }
    // Flash "saved" indicator
    setLastSavedAt(Date.now());
    if (lastSavedTimerRef.current) clearTimeout(lastSavedTimerRef.current);
    lastSavedTimerRef.current = setTimeout(() => setLastSavedAt(null), 2000);
  }, []);

  const handleMapClick = useCallback(
    (lng: number, lat: number) => {
      if (
        mode === "add-city" ||
        mode === "add-poi" ||
        mode === "add-story-pin" ||
        mode === "add-label"
      ) {
        setPendingCoordinates([lng, lat]);
      } else if (mode === "add-route") {
        setRouteWaypoints((prev) => [...prev, [lng, lat]]);
      }
    },
    [mode]
  );

  const handleDrawComplete = useCallback(
    (geometry: object) => {
      if (mode === "add-subdivision") {
        setPendingGeometry(geometry);
      }
    },
    [mode]
  );

  // Submit handlers
  const submitCity = useCallback(async () => {
    const errors = validateFeature("city", false);
    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      return;
    }
    setValidationErrors({});
    if (!countryId || !pendingCoordinates) return;
    await createCity.mutateAsync({
      countryId,
      name: cityForm.name.trim(),
      cityType: cityForm.cityType,
      coordinates: pendingCoordinates,
      population: cityForm.population,
      isNationalCapital: cityForm.isNationalCapital,
      isSubdivisionCapital: cityForm.isSubdivisionCapital,
      subdivisionId: cityForm.subdivisionId,
      wikiPageTitle: cityForm.wikiPageTitle,
    });
  }, [countryId, pendingCoordinates, cityForm, createCity, validateFeature]);

  const submitSubdivision = useCallback(async () => {
    const errors = validateFeature("subdivision", false);
    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      return;
    }
    setValidationErrors({});
    if (!countryId || !pendingGeometry) return;
    await createSubdivision.mutateAsync({
      countryId,
      name: subdivisionForm.name.trim(),
      type: subdivisionForm.type,
      level: subdivisionForm.level,
      geometry: pendingGeometry,
      capital: subdivisionForm.capital,
      population: subdivisionForm.population,
    });
  }, [countryId, pendingGeometry, subdivisionForm, createSubdivision, validateFeature]);

  const submitPOI = useCallback(async () => {
    const errors = validateFeature("poi", false);
    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      return;
    }
    setValidationErrors({});
    if (!countryId || !pendingCoordinates) return;
    await createPOI.mutateAsync({
      countryId,
      name: poiForm.name.trim(),
      category: poiForm.category,
      coordinates: pendingCoordinates,
      description: poiForm.description,
      icon: poiForm.icon,
      wikiPageTitle: poiForm.wikiPageTitle,
    });
  }, [countryId, pendingCoordinates, poiForm, createPOI, validateFeature]);

  const submitStoryPin = useCallback(async () => {
    const errors = validateFeature("storyPin", false);
    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      return;
    }
    setValidationErrors({});
    if (!countryId || !pendingCoordinates) return;
    await createStoryPin.mutateAsync({
      countryId,
      title: storyPinForm.title.trim(),
      content: storyPinForm.content,
      contentFormat: storyPinForm.contentFormat,
      category: storyPinForm.category as any,
      importance: storyPinForm.importance,
      coordinates: pendingCoordinates,
      ixTimeYear: storyPinForm.ixTimeYear,
      eraLabel: storyPinForm.eraLabel,
      wikiPageTitle: storyPinForm.wikiPageTitle,
      photos: storyPinForm.photos,
      thumbnailUrl: storyPinForm.thumbnailUrl,
      storylineId: storyPinForm.storylineId,
      storylineOrder: storyPinForm.storylineOrder,
    });
  }, [countryId, pendingCoordinates, storyPinForm, createStoryPin, validateFeature]);

  const submitMapLabel = useCallback(async () => {
    const errors = validateFeature("mapLabel", false);
    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      return;
    }
    setValidationErrors({});
    if (!countryId || !pendingCoordinates) return;
    await createMapLabel.mutateAsync({
      countryId,
      text: mapLabelForm.text.trim(),
      labelType: mapLabelForm.labelType as any,
      coordinates: pendingCoordinates,
      fontSize: mapLabelForm.fontSize,
      color: mapLabelForm.color,
      rotation: mapLabelForm.rotation,
      letterSpacing: mapLabelForm.letterSpacing,
      fontWeight: mapLabelForm.fontWeight as any,
      opacity: mapLabelForm.opacity,
      minZoom: mapLabelForm.minZoom,
      maxZoom: mapLabelForm.maxZoom,
      wikiPageTitle: mapLabelForm.wikiPageTitle,
    });
  }, [countryId, pendingCoordinates, mapLabelForm, createMapLabel, validateFeature]);

  /** Enter edit mode for an existing feature, populating the appropriate form. */
  const startEditing = useCallback((feature: EditorFeature) => {
    setSelectedFeature(feature);
    setLastSavedAt(null);

    switch (feature.type) {
      case "city":
        setMode("edit-city");
        setCityForm({
          name: feature.name,
          cityType: (feature.properties.cityType as string) ?? "city",
          population: (feature.properties.population as number | undefined) ?? undefined,
          isNationalCapital: !!feature.properties.isNationalCapital,
          isSubdivisionCapital: !!feature.properties.isSubdivisionCapital,
          subdivisionId: (feature.properties.subdivisionId as string | undefined) ?? undefined,
          wikiPageTitle: (feature.properties.wikiPageTitle as string | undefined) ?? undefined,
        });
        break;
      case "subdivision":
        setMode("edit-subdivision");
        setSubdivisionForm({
          name: feature.name,
          type: (feature.properties.type as string) ?? "province",
          level: (feature.properties.level as number) ?? 1,
          capital: (feature.properties.capital as string | undefined) ?? undefined,
          population: (feature.properties.population as number | undefined) ?? undefined,
        });
        break;
      case "poi":
        setMode("edit-poi");
        setPOIForm({
          name: feature.name,
          category: (feature.properties.category as string) ?? "landmark",
          description: (feature.properties.description as string | undefined) ?? undefined,
          icon: (feature.properties.icon as string | undefined) ?? undefined,
          wikiPageTitle: (feature.properties.wikiPageTitle as string | undefined) ?? undefined,
        });
        break;
      case "storyPin":
        setMode("edit-story-pin");
        setStoryPinForm({
          title: feature.name,
          content: (feature.properties.content as string) ?? "",
          contentFormat: ((feature.properties.contentFormat as string) ?? "plain") as
            | "plain"
            | "markdown",
          category: (feature.properties.category as string) ?? "cultural",
          importance: (feature.properties.importance as number) ?? 0,
          ixTimeYear: (feature.properties.ixTimeYear as number | undefined) ?? undefined,
          eraLabel: (feature.properties.eraLabel as string | undefined) ?? undefined,
          wikiPageTitle: (feature.properties.wikiPageTitle as string | undefined) ?? undefined,
          photos: (feature.properties.photos as string[] | undefined) ?? undefined,
          thumbnailUrl: (feature.properties.thumbnailUrl as string | undefined) ?? undefined,
          storylineId: (feature.properties.storylineId as string | undefined) ?? undefined,
          storylineOrder: (feature.properties.storylineOrder as number | undefined) ?? undefined,
        });
        break;
      case "mapLabel":
        setMode("edit-label");
        setMapLabelForm({
          text: feature.name,
          labelType: (feature.properties.labelType as string) ?? "mountain_range",
          fontSize: (feature.properties.fontSize as number) ?? 14,
          color: (feature.properties.color as string) ?? "#374151",
          rotation: (feature.properties.rotation as number) ?? 0,
          letterSpacing: (feature.properties.letterSpacing as number) ?? 0,
          fontWeight: (feature.properties.fontWeight as string) ?? "normal",
          opacity: (feature.properties.opacity as number) ?? 1,
          minZoom: (feature.properties.minZoom as number) ?? 4,
          maxZoom: (feature.properties.maxZoom as number) ?? 18,
          wikiPageTitle: (feature.properties.wikiPageTitle as string | undefined) ?? undefined,
        });
        break;
    }
  }, []);

  const submitEditCity = useCallback(async () => {
    const errors = validateFeature("city", true);
    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      return;
    }
    setValidationErrors({});
    if (!countryId || !selectedFeature) return;
    await updateCity.mutateAsync({
      countryId,
      cityId: selectedFeature.id,
      name: cityForm.name.trim(),
      cityType: cityForm.cityType,
      population: cityForm.population,
      isNationalCapital: cityForm.isNationalCapital,
      isSubdivisionCapital: cityForm.isSubdivisionCapital,
      wikiPageTitle: cityForm.wikiPageTitle ?? null,
    });
  }, [countryId, selectedFeature, cityForm, updateCity, validateFeature]);

  const submitEditSubdivision = useCallback(async () => {
    const errors = validateFeature("subdivision", true);
    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      return;
    }
    setValidationErrors({});
    if (!countryId || !selectedFeature) return;
    await updateSubdivision.mutateAsync({
      countryId,
      subdivisionId: selectedFeature.id,
      name: subdivisionForm.name.trim(),
      type: subdivisionForm.type,
      level: subdivisionForm.level,
      capital: subdivisionForm.capital,
      population: subdivisionForm.population,
    });
  }, [countryId, selectedFeature, subdivisionForm, updateSubdivision, validateFeature]);

  const submitEditPOI = useCallback(async () => {
    const errors = validateFeature("poi", true);
    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      return;
    }
    setValidationErrors({});
    if (!countryId || !selectedFeature) return;
    await updatePOI.mutateAsync({
      countryId,
      poiId: selectedFeature.id,
      name: poiForm.name.trim(),
      category: poiForm.category,
      description: poiForm.description,
      icon: poiForm.icon,
      wikiPageTitle: poiForm.wikiPageTitle ?? null,
    });
  }, [countryId, selectedFeature, poiForm, updatePOI, validateFeature]);

  const submitEditStoryPin = useCallback(async () => {
    const errors = validateFeature("storyPin", true);
    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      return;
    }
    setValidationErrors({});
    if (!countryId || !selectedFeature) return;
    await updateStoryPin.mutateAsync({
      countryId,
      pinId: selectedFeature.id,
      title: storyPinForm.title.trim(),
      content: storyPinForm.content,
      contentFormat: storyPinForm.contentFormat,
      category: storyPinForm.category as any,
      importance: storyPinForm.importance,
      ixTimeYear: storyPinForm.ixTimeYear ?? null,
      eraLabel: storyPinForm.eraLabel ?? null,
      wikiPageTitle: storyPinForm.wikiPageTitle ?? null,
      photos: storyPinForm.photos,
      thumbnailUrl: storyPinForm.thumbnailUrl ?? null,
      storylineId: storyPinForm.storylineId ?? null,
      storylineOrder: storyPinForm.storylineOrder ?? null,
    });
  }, [countryId, selectedFeature, storyPinForm, updateStoryPin, validateFeature]);

  const submitEditMapLabel = useCallback(async () => {
    const errors = validateFeature("mapLabel", true);
    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      return;
    }
    setValidationErrors({});
    if (!countryId || !selectedFeature) return;
    await updateMapLabel.mutateAsync({
      countryId,
      labelId: selectedFeature.id,
      text: mapLabelForm.text.trim(),
      labelType: mapLabelForm.labelType as any,
      fontSize: mapLabelForm.fontSize,
      color: mapLabelForm.color,
      rotation: mapLabelForm.rotation,
      letterSpacing: mapLabelForm.letterSpacing,
      fontWeight: mapLabelForm.fontWeight as any,
      opacity: mapLabelForm.opacity,
      minZoom: mapLabelForm.minZoom,
      maxZoom: mapLabelForm.maxZoom,
      wikiPageTitle: mapLabelForm.wikiPageTitle ?? null,
    });
  }, [countryId, selectedFeature, mapLabelForm, updateMapLabel, validateFeature]);

  const updateSubdivisionGeometry = useCallback(
    async (featureId: string, geometry: object) => {
      if (!countryId) return;
      await updateSubdivision.mutateAsync({
        countryId,
        subdivisionId: featureId,
        geometry,
      });
    },
    [countryId, updateSubdivision]
  );

  const handleDeleteFeature = useCallback(
    async (feature: EditorFeature) => {
      if (!countryId) return;

      // Record for undo before deleting
      pushAction({
        type: "delete",
        featureType: feature.type,
        featureId: feature.id,
        previousData: {
          name: feature.name,
          coordinates: feature.coordinates,
          geometry: feature.geometry,
          properties: feature.properties,
        },
      });

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
        case "storyPin":
          await deleteStoryPin.mutateAsync({ countryId, pinId: feature.id });
          break;
        case "mapLabel":
          await deleteMapLabel.mutateAsync({ countryId, labelId: feature.id });
          break;
      }
    },
    [
      countryId,
      deleteCity,
      deleteSubdivision,
      deletePOI,
      deleteStoryPin,
      deleteMapLabel,
      pushAction,
    ]
  );

  // Combined feature list for display
  const allFeatures: EditorFeature[] = useMemo(() => {
    if (!features) return [];
    const list: EditorFeature[] = [];

    for (const city of features.cities ?? []) {
      list.push({
        id: city.id,
        type: "city",
        name: city.name,
        coordinates: city.coordinates as [number, number] | undefined,
        properties: {
          cityType: city.type,
          population: city.population,
          isNationalCapital: city.isNationalCapital,
          isSubdivisionCapital: city.isSubdivisionCapital,
          wikiPageTitle: city.wikiPageTitle,
        },
      });
    }

    for (const sub of features.subdivisions ?? []) {
      list.push({
        id: sub.id,
        type: "subdivision",
        name: sub.name,
        geometry: sub.geometry as object | undefined,
        properties: {
          type: sub.type,
          level: sub.level,
          capital: sub.capital,
          population: sub.population,
          areaSqKm: sub.areaSqKm,
          color: sub.color,
        },
      });
    }

    for (const poi of features.pois ?? []) {
      list.push({
        id: poi.id,
        type: "poi",
        name: poi.name,
        coordinates: poi.coordinates as [number, number] | undefined,
        properties: {
          category: poi.category,
          description: poi.description,
          icon: poi.icon,
          wikiPageTitle: poi.wikiPageTitle,
        },
      });
    }

    for (const pin of (features as any).storyPins ?? []) {
      list.push({
        id: pin.id,
        type: "storyPin",
        name: pin.title,
        coordinates: pin.coordinates as [number, number] | undefined,
        properties: {
          content: pin.content,
          category: pin.category,
          ixTimeYear: pin.ixTimeYear,
          eraLabel: pin.eraLabel,
          wikiPageTitle: pin.wikiPageTitle,
          photos: pin.photos,
          icon: pin.icon,
        },
      });
    }

    for (const label of (features as any).mapLabels ?? []) {
      list.push({
        id: label.id,
        type: "mapLabel",
        name: label.text,
        coordinates: label.coordinates as [number, number] | undefined,
        properties: {
          labelType: label.labelType,
          fontSize: label.fontSize,
          color: label.color,
          rotation: label.rotation,
          letterSpacing: label.letterSpacing,
          fontWeight: label.fontWeight,
          opacity: label.opacity,
          minZoom: label.minZoom,
          maxZoom: label.maxZoom,
          wikiPageTitle: label.wikiPageTitle,
        },
      });
    }

    return list;
  }, [features]);

  // Bulk delete selected features
  const bulkDeleteSelected = useCallback(async () => {
    if (!countryId || selectedIds.size === 0) return;
    const toDelete = allFeatures.filter((f) => selectedIds.has(f.id));
    for (const feature of toDelete) {
      await handleDeleteFeature(feature);
    }
    clearMultiSelect();
  }, [countryId, selectedIds, allFeatures, handleDeleteFeature, clearMultiSelect]);

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
    createRoute.isPending;

  const mutationError =
    createCity.error ||
    updateCity.error ||
    deleteCity.error ||
    createSubdivision.error ||
    updateSubdivision.error ||
    deleteSubdivision.error ||
    createPOI.error ||
    updatePOI.error ||
    deletePOI.error ||
    createStoryPin.error ||
    updateStoryPin.error ||
    deleteStoryPin.error ||
    createMapLabel.error ||
    updateMapLabel.error ||
    deleteMapLabel.error ||
    createRoute.error;

  return {
    // State
    mode,
    setMode,
    selectedFeature,
    setSelectedFeature,
    pendingCoordinates,
    pendingGeometry,

    // Forms
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

    // Data
    features,
    allFeatures,
    countryGeo,
    geometryLoading,
    linkage,
    linkageLoading,
    featuresLoading,
    pendingPointInfo,
    isPendingPointInfoLoading,

    // Actions
    handleMapClick,
    handleDrawComplete,
    submitCity,
    submitSubdivision,
    submitPOI,
    handleDeleteFeature,
    resetForm,
    startEditing,
    submitEditCity,
    submitEditSubdivision,
    submitEditPOI,
    submitStoryPin,
    submitMapLabel,
    submitEditStoryPin,
    submitEditMapLabel,
    updateSubdivisionGeometry,

    // Mutation state
    isMutating,
    mutationError,
    lastSavedAt,
    validationErrors,

    // Refresh
    refetchFeatures,

    // Undo/Redo
    historyCanUndo,
    historyCanRedo,
    history,
    pushAction,
    undo,
    redo,

    // Route Drawing
    routeWaypoints,
    finishRoute,
    undoLastWaypoint,
    clearRouteWaypoints,

    // Multi-Select
    selectedIds,
    toggleSelectId,
    clearMultiSelect,
    bulkDeleteSelected,
  };
}
