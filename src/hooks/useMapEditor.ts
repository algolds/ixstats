// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
"use client";

/**
 * useMapEditor - State management hook for the MyCountry map editor.
 *
 * Handles editing mode, feature CRUD, and drawing state.
 */

import { useState, useCallback, useMemo, useRef } from "react";
import { api } from "~/trpc/react";
import { clampToGeometry, pointInGeometry } from "~/lib/border-editor";
import { buildRouteGeometry } from "~/lib/route-geometry";

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
  | "edit-route"
  | "paint";

export type FeatureType = "city" | "subdivision" | "poi" | "storyPin" | "mapLabel" | "route";

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
  coordinates?: [number, number];
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
  geometry?: object;
}

export interface POIFormData {
  name: string;
  category: string;
  description?: string;
  icon?: string;
  wikiPageTitle?: string;
  subdivisionId?: string;
  coordinates?: [number, number];
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
  coordinates?: [number, number];
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
  coordinates?: [number, number];
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
    utils.transport.getCountryRoutes.invalidate();
    utils.transport.getAllRoutesGeoJSON.invalidate();
    utils.transport.getTransportStats.invalidate();
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
  const [routeDrawingHistory, setRouteDrawingHistory] = useState<[number, number][][]>([]);
  const [editingRouteId, setEditingRouteId] = useState<string | null>(null);
  const [editingRouteVertices, setEditingRouteVertices] = useState<[number, number][]>([]);
  const [draggingVertexIndex, setDraggingVertexIndex] = useState<number | null>(null);
  const [snapTarget, setSnapTarget] = useState<{
    type: "city" | "hub" | "border_crossing";
    id: string;
    coordinates: [number, number];
    name: string;
  } | null>(null);

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
            case "route":
              await m.deleteRoute?.mutateAsync({ countryId, id: action.featureId });
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
                  type: p?.cityType ?? (p?.type as string) ?? "city",
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
                });
                break;
              case "route":
                await m.createRoute?.mutateAsync({
                  countryId,
                  routeType: d.routeType,
                  name: d.name,
                  geometry: d.geometry,
                  properties: d.properties,
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
                  id: action.featureId,
                  name: d.name,
                  type: p?.cityType ?? (p?.type as string),
                  population: p?.population,
                  isNationalCapital: !!p?.isNationalCapital,
                  isSubdivisionCapital: !!p?.isSubdivisionCapital,
                });
                break;
              case "subdivision":
                await m.updateSubdivision?.mutateAsync({
                  countryId,
                  id: action.featureId,
                  name: d.name,
                  type: p?.type,
                  level: p?.level,
                });
                break;
              case "poi":
                await m.updatePOI?.mutateAsync({
                  countryId,
                  id: action.featureId,
                  name: d.name,
                  category: p?.category,
                  description: p?.description,
                });
                break;
              case "storyPin":
                await m.updateStoryPin?.mutateAsync({
                  countryId,
                  id: action.featureId,
                  title: d.name,
                  content: p?.content,
                  category: p?.category,
                });
                break;
              case "mapLabel":
                await m.updateMapLabel?.mutateAsync({
                  countryId,
                  id: action.featureId,
                  text: d.name,
                  labelType: p?.labelType,
                  fontSize: p?.fontSize,
                  color: p?.color,
                });
                break;
              case "route":
                await m.updateRouteGeometry?.mutateAsync({
                  countryId,
                  id: action.featureId,
                  geometry: d.geometry,
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
                await m.createCity?.mutateAsync({
                  countryId,
                  ...d,
                  type: d.cityType ?? d.type ?? "city",
                } as any);
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
              case "route":
                await m.createRoute?.mutateAsync({
                  countryId,
                  routeType: d.routeType,
                  name: d.name,
                  geometry: d.geometry,
                  properties: d.properties,
                } as any);
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
            case "route":
              await m.deleteRoute?.mutateAsync({ countryId, id: action.featureId });
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
                  id: action.featureId,
                  name: d.name,
                  type: p?.cityType ?? (p?.type as string),
                  population: p?.population,
                  isNationalCapital: !!p?.isNationalCapital,
                  isSubdivisionCapital: !!p?.isSubdivisionCapital,
                });
                break;
              case "subdivision":
                await m.updateSubdivision?.mutateAsync({
                  countryId,
                  id: action.featureId,
                  name: d.name,
                  type: p?.type,
                  level: p?.level,
                });
                break;
              case "poi":
                await m.updatePOI?.mutateAsync({
                  countryId,
                  id: action.featureId,
                  name: d.name,
                  category: p?.category,
                  description: p?.description,
                });
                break;
              case "storyPin":
                await m.updateStoryPin?.mutateAsync({
                  countryId,
                  id: action.featureId,
                  title: d.name,
                  content: p?.content,
                  category: p?.category,
                });
                break;
              case "mapLabel":
                await m.updateMapLabel?.mutateAsync({
                  countryId,
                  id: action.featureId,
                  text: d.name,
                  labelType: p?.labelType,
                  fontSize: p?.fontSize,
                  color: p?.color,
                });
                break;
              case "route":
                await m.updateRouteGeometry?.mutateAsync({
                  countryId,
                  id: action.featureId,
                  geometry: d.geometry,
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

  // Fetch country routes
  const {
    data: countryRoutes,
    isLoading: routesLoading,
    refetch: refetchRoutes,
  } = api.transport.getCountryRoutes.useQuery(
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
      refetchRoutes();
      pendingRefetchRef.current = null;
    }, 100);
  }, [refetchFeatures, refetchRoutes]);

  // Mutations
  const createCity = api.countryGeo.upsertCity.useMutation({
    onSuccess: () => {
      invalidateAllMapData();
      debouncedRefetch();
      continuePlacing("add-city");
    },
  });

  const updateCity = api.countryGeo.upsertCity.useMutation({
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

  const createSubdivision = api.countryGeo.upsertSubdivision.useMutation({
    onSuccess: () => {
      invalidateAllMapData();
      debouncedRefetch();
      continuePlacing("add-subdivision");
    },
  });

  const updateSubdivision = api.countryGeo.upsertSubdivision.useMutation({
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

  const createPOI = api.countryGeo.upsertPoi.useMutation({
    onSuccess: () => {
      invalidateAllMapData();
      debouncedRefetch();
      continuePlacing("add-poi");
    },
  });

  const updatePOI = api.countryGeo.upsertPoi.useMutation({
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
  const createStoryPin = api.countryGeo.upsertStoryPin.useMutation({
    onSuccess: () => {
      invalidateAllMapData();
      debouncedRefetch();
      continuePlacing("add-story-pin");
    },
  });
  const updateStoryPin = api.countryGeo.upsertStoryPin.useMutation({
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
  const createMapLabel = api.countryGeo.upsertMapLabel.useMutation({
    onSuccess: () => {
      invalidateAllMapData();
      debouncedRefetch();
      continuePlacing("add-label");
    },
  });
  const updateMapLabel = api.countryGeo.upsertMapLabel.useMutation({
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

  // Route mutations
  const createRoute = api.transport.createRoute.useMutation({
    onSuccess: (data) => {
      setRouteWaypoints([]);
      void utils.transport.getCountryRoutes.invalidate();
      void utils.transport.getAllRoutesGeoJSON.invalidate();
      void utils.transport.getTransportStats.invalidate();
      invalidateAllMapData();

      pushAction({
        type: "create",
        featureType: "route",
        featureId: data.id,
        newData: {
          routeType: data.routeType,
          name: data.name,
          geometry: data.geometry,
          properties: data.properties,
        },
      });
    },
  });

  const updateRouteGeometry = api.transport.updateRouteGeometry.useMutation({
    onSuccess: () => {
      void utils.transport.getCountryRoutes.invalidate();
      void utils.transport.getAllRoutesGeoJSON.invalidate();
      void utils.transport.getTransportStats.invalidate();
      invalidateAllMapData();
    },
  });

  const deleteRoute = api.transport.deleteRoute.useMutation({
    onSuccess: () => {
      void utils.transport.getCountryRoutes.invalidate();
      void utils.transport.getAllRoutesGeoJSON.invalidate();
      void utils.transport.getTransportStats.invalidate();
      invalidateAllMapData();
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
    createRoute,
    deleteRoute,
    updateRouteGeometry,
    refetchFeatures: debouncedRefetch,
  };

  // ── Route Drawing Functions ──
  const finishRoute = useCallback(
    async (routeType = "road", name?: string) => {
      if (!countryId || routeWaypoints.length < 2) return;
      const geometry = buildRouteGeometry(routeWaypoints, routeType);
      await createRoute.mutateAsync({
        countryId,
        routeType,
        name,
        geometry,
      });
      setRouteWaypoints([]);
      setRouteDrawingHistory([]);
      setSnapTarget(null);
    },
    [countryId, routeWaypoints, createRoute]
  );

  const undoLastWaypoint = useCallback(() => {
    setRouteWaypoints((prev) => {
      if (routeDrawingHistory.length === 0) return prev;
      const prevWaypoints = routeDrawingHistory[routeDrawingHistory.length - 1]!;
      setRouteDrawingHistory((history) => history.slice(0, -1));
      return prevWaypoints;
    });
  }, [routeDrawingHistory]);

  const clearRouteWaypoints = useCallback(() => {
    setRouteWaypoints([]);
    setRouteDrawingHistory([]);
    setSnapTarget(null);
  }, []);

  const startRouteEdit = useCallback(
    (routeId: string, geometry: any) => {
      setEditingRouteId(routeId);
      setEditingRouteVertices(geometry?.coordinates ? [...geometry.coordinates] : []);
      setMode("edit-route");
      setSelectedFeature({
        id: routeId,
        type: "route",
        name: "Route",
        geometry: geometry,
        properties: {},
      });
    },
    [setMode]
  );

  const commitRouteEdit = useCallback(async () => {
    if (!countryId || !editingRouteId || editingRouteVertices.length < 2) return;
    const geometry = {
      type: "LineString" as const,
      coordinates: editingRouteVertices,
    };

    pushAction({
      type: "update",
      featureType: "route",
      featureId: editingRouteId,
      previousData: {
        geometry: selectedFeature?.geometry,
      },
      newData: {
        geometry,
      },
    });

    await updateRouteGeometry.mutateAsync({
      countryId,
      id: editingRouteId,
      geometry,
    });

    setEditingRouteId(null);
    setEditingRouteVertices([]);
    setMode("view");
    setSelectedFeature(null);
  }, [
    countryId,
    editingRouteId,
    editingRouteVertices,
    selectedFeature,
    updateRouteGeometry,
    pushAction,
    setMode,
  ]);

  const cancelRouteEdit = useCallback(() => {
    setEditingRouteId(null);
    setEditingRouteVertices([]);
    setMode("view");
    setSelectedFeature(null);
  }, [setMode]);

  const addRouteWaypointWithSnap = useCallback(
    (coords: [number, number], nearbyFeatures?: any[]) => {
      let targetCoords = coords;
      let newSnap: typeof snapTarget = null;

      if (nearbyFeatures && nearbyFeatures.length > 0) {
        let minDistance = Infinity;
        let closestFeature: any = null;

        for (const feature of nearbyFeatures) {
          if (!feature.geometry || !feature.geometry.coordinates) continue;
          const [lng, lat] = feature.geometry.coordinates;
          const dist = Math.sqrt(Math.pow(lng - coords[0], 2) + Math.pow(lat - coords[1], 2));
          if (dist < minDistance) {
            minDistance = dist;
            closestFeature = feature;
          }
        }

        // Proximity threshold of ~0.03 degrees (~3km)
        if (closestFeature && minDistance < 0.03) {
          targetCoords = closestFeature.geometry.coordinates;
          newSnap = {
            type: closestFeature.properties?.type === "hub" ? "hub" : "city",
            id: closestFeature.id || closestFeature.properties?.id,
            coordinates: targetCoords,
            name: closestFeature.properties?.name || "City",
          };
        }
      }

      setSnapTarget(newSnap);
      setRouteWaypoints((prev) => {
        const next = [...prev, targetCoords];
        setRouteDrawingHistory((history) => [...history, prev]);
        return next;
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [snapTarget]
  );

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
    setRouteDrawingHistory([]);
    setEditingRouteId(null);
    setEditingRouteVertices([]);
    setSnapTarget(null);
    setLastSavedAt(null);
    setValidationErrors({});
  }, [setMode]);

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
      setSubdivisionForm((prev) => ({
        ...prev,
        name: "",
        population: undefined,
        areaSqKm: undefined,
        geometry: undefined,
      }));
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
        let point: [number, number] = [lng, lat];
        if (countryGeo?.geometry) {
          point = clampToGeometry(point, countryGeo.geometry) as [number, number];
        }
        setPendingCoordinates(point);
      } else if (mode === "add-route") {
        setRouteWaypoints((prev) => [...prev, [lng, lat]]);
      }
    },
    [mode, countryGeo]
  );

  const handleDrawComplete = useCallback(
    (geometry: object) => {
      if (mode === "add-subdivision") {
        if (countryGeo?.geometry && (geometry as any).type === "Polygon") {
          const outerRing = (geometry as any).coordinates?.[0] as [number, number][] | undefined;
          if (outerRing && outerRing.length > 0) {
            const anyInside = outerRing.some((pt: [number, number]) =>
              pointInGeometry(pt, countryGeo.geometry)
            );
            if (!anyInside) {
              alert("Region must be inside the country boundary.");
              return;
            }
          }
        }
        setPendingGeometry(geometry);
        setSubdivisionForm((prev) => ({ ...prev, geometry }));
      }
    },
    [mode, countryGeo, setSubdivisionForm]
  );

  // Submit handlers
  const submitCity = useCallback(async () => {
    const errors = validateFeature("city", false);
    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      return;
    }
    setValidationErrors({});
    const coords = pendingCoordinates || cityForm.coordinates;
    if (!countryId || !coords) return;
    await createCity.mutateAsync({
      countryId,
      name: cityForm.name.trim(),
      type: cityForm.cityType,
      coordinates: coords,
      population: cityForm.population,
      elevation: cityForm.elevation,
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
      population: subdivisionForm.population,
      areaSqKm: subdivisionForm.areaSqKm,
    });
  }, [countryId, pendingGeometry, subdivisionForm, createSubdivision, validateFeature]);

  const submitPOI = useCallback(async () => {
    const errors = validateFeature("poi", false);
    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      return;
    }
    setValidationErrors({});
    const coords = pendingCoordinates || poiForm.coordinates;
    if (!countryId || !coords) return;
    await createPOI.mutateAsync({
      countryId,
      name: poiForm.name.trim(),
      category: poiForm.category,
      coordinates: coords,
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
    const coords = pendingCoordinates || storyPinForm.coordinates;
    if (!countryId || !coords) return;
    await createStoryPin.mutateAsync({
      countryId,
      title: storyPinForm.title.trim(),
      content: storyPinForm.content,
      category: storyPinForm.category as any,
      coordinates: coords,
      ixTimeYear: storyPinForm.ixTimeYear,
    });
  }, [countryId, pendingCoordinates, storyPinForm, createStoryPin, validateFeature]);

  const submitMapLabel = useCallback(async () => {
    const errors = validateFeature("mapLabel", false);
    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      return;
    }
    setValidationErrors({});
    const coords = pendingCoordinates || mapLabelForm.coordinates;
    if (!countryId || !coords) return;
    await createMapLabel.mutateAsync({
      countryId,
      text: mapLabelForm.text.trim(),
      labelType: mapLabelForm.labelType as any,
      coordinates: coords,
      fontSize: mapLabelForm.fontSize,
      color: mapLabelForm.color,
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
          coordinates: feature.coordinates,
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
          areaSqKm: (feature.properties.areaSqKm as number | undefined) ?? undefined,
          color: (feature.properties.color as string | undefined) ?? undefined,
          geometry: feature.geometry,
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
          coordinates: feature.coordinates,
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
          coordinates: feature.coordinates,
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
          coordinates: feature.coordinates,
        });
        break;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      id: selectedFeature.id,
      name: cityForm.name.trim(),
      type: cityForm.cityType,
      coordinates: cityForm.coordinates,
      population: cityForm.population,
      elevation: cityForm.elevation,
      isNationalCapital: cityForm.isNationalCapital,
      isSubdivisionCapital: cityForm.isSubdivisionCapital,
      wikiPageTitle: cityForm.wikiPageTitle,
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
      id: selectedFeature.id,
      name: subdivisionForm.name.trim(),
      type: subdivisionForm.type,
      level: subdivisionForm.level,
      population: subdivisionForm.population,
      areaSqKm: subdivisionForm.areaSqKm,
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
      id: selectedFeature.id,
      name: poiForm.name.trim(),
      category: poiForm.category,
      coordinates: poiForm.coordinates,
      description: poiForm.description,
      icon: poiForm.icon,
      wikiPageTitle: poiForm.wikiPageTitle,
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
      id: selectedFeature.id,
      title: storyPinForm.title.trim(),
      content: storyPinForm.content,
      category: storyPinForm.category,
      coordinates: storyPinForm.coordinates,
      ixTimeYear: storyPinForm.ixTimeYear,
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
      id: selectedFeature.id,
      text: mapLabelForm.text.trim(),
      labelType: mapLabelForm.labelType,
      coordinates: mapLabelForm.coordinates,
      fontSize: mapLabelForm.fontSize,
      color: mapLabelForm.color,
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
        case "route":
          pushAction({
            type: "delete",
            featureType: "route",
            featureId: feature.id,
            previousData: {
              name: feature.name,
              routeType: feature.properties?.routeType || "road",
              geometry: feature.geometry,
              properties: feature.properties,
            },
          });
          await deleteRoute.mutateAsync({ countryId, id: feature.id });
          break;
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

    for (const r of countryRoutes?.features ?? []) {
      const props = r.properties ?? {};
      list.push({
        id: props.id,
        type: "route",
        name: props.name || `${props.routeType?.toUpperCase() || "ROAD"} Route`,
        geometry: r.geometry as object | undefined,
        properties: {
          routeType: props.routeType,
          lengthKm: props.lengthKm,
          status: props.status,
          builtYear: props.builtYear,
          capacity: props.capacity,
          properties: props,
        },
      });
    }

    return list;
  }, [features, countryRoutes]);

  // Bulk delete selected features
  const bulkDeleteSelected = useCallback(async () => {
    if (!countryId || selectedIds.size === 0) return;
    const toDelete = allFeatures.filter((f) => selectedIds.has(f.id));
    for (const feature of toDelete) {
      await handleDeleteFeature(feature);
    }
    clearMultiSelect();
  }, [countryId, selectedIds, allFeatures, handleDeleteFeature, clearMultiSelect]);

  /**
   * Bulk-edit a single attribute on all currently selected subdivisions.
   *
   * Strategy: per-row calls to countryGeo.upsertSubdivision (auth-checked,
   * atomic per feature). Selection is mixed-type so we scope to subdivisions
   * only — non-subdivision selections are silently skipped (consistent with
   * how the UI hides the bulk-edit bar when no subdivisions are selected).
   *
   * Returns { successCount, failCount } so callers can surface partial failures.
   */
  const bulkEditSelected = useCallback(
    async (
      field: "color" | "type" | "level" | "governmentType",
      value: string | number
    ): Promise<{ successCount: number; failCount: number }> => {
      if (!countryId || selectedIds.size === 0) return { successCount: 0, failCount: 0 };

      const toEdit = allFeatures.filter((f) => selectedIds.has(f.id) && f.type === "subdivision");

      if (toEdit.length === 0) return { successCount: 0, failCount: 0 };

      let successCount = 0;
      let failCount = 0;

      for (const feature of toEdit) {
        try {
          await updateSubdivision.mutateAsync({
            countryId,
            id: feature.id,
            name: feature.name ?? "",
            [field]: value,
          });
          successCount++;
        } catch {
          failCount++;
        }
      }

      // Push one consolidated history entry (mirrors the 50-cap in pushAction)
      if (successCount > 0) {
        pushAction({
          type: "update",
          featureType: "subdivision",
          featureId: `bulk:${Array.from(selectedIds).join(",")}`,
          newData: { field, value, count: successCount },
        });
        invalidateAllMapData();
        debouncedRefetch();
      }

      return { successCount, failCount };
    },
    [
      countryId,
      selectedIds,
      allFeatures,
      updateSubdivision,
      pushAction,
      invalidateAllMapData,
      debouncedRefetch,
    ]
  );

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
    featuresLoading: featuresLoading || routesLoading,
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

    // Route Drawing & Editing
    routeWaypoints,
    routeDrawingHistory,
    editingRouteId,
    editingRouteVertices,
    setEditingRouteVertices,
    draggingVertexIndex,
    setDraggingVertexIndex,
    snapTarget,
    setSnapTarget,
    finishRoute,
    undoLastWaypoint,
    clearRouteWaypoints,
    startRouteEdit,
    commitRouteEdit,
    cancelRouteEdit,
    addRouteWaypointWithSnap,

    // Multi-Select
    selectedIds,
    toggleSelectId,
    clearMultiSelect,
    bulkDeleteSelected,
    bulkEditSelected,
  };
}
