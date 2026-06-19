// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
"use client";

/**
 * useMapEditor - State management hook for the MyCountry map editor.
 *
 * Handles editing mode, feature CRUD, and drawing state.
 */

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { union } from "@turf/union";
import { difference } from "@turf/difference";
import { featureCollection, point } from "@turf/helpers";
import { intersect } from "@turf/intersect";
import { simplify } from "@turf/simplify";
import { bbox } from "@turf/bbox";
import { centroid } from "@turf/centroid";
import { booleanPointInPolygon } from "@turf/boolean-point-in-polygon";
import { area } from "@turf/area";
import { buffer } from "@turf/buffer";
import { bezierSpline } from "@turf/bezier-spline";
import { transformRotate } from "@turf/transform-rotate";
import { transformScale } from "@turf/transform-scale";
import { api } from "~/trpc/react";
import { clampToGeometry, pointInGeometry } from "~/lib/border-editor";
import { buildRouteGeometry } from "~/lib/route-geometry";

// ── Pure duplicate transform (exported for unit testing) ──

const DUPLICATE_OFFSET_DEG = 0.05;

/**
 * Builds the create-input for a duplicated feature.
 * Pure function — no React, no tRPC.
 *
 * For point features: offsets coordinates by DUPLICATE_OFFSET_DEG.
 * For polygon features: offsets every coordinate in the geometry.
 * Appends " (copy)" to the name.
 *
 * Returns an object with the same shape as the relevant upsert input
 * (minus countryId, which the caller supplies).
 */
export function buildDuplicateInput(feature: EditorFeature): Record<string, unknown> {
  const name = `${feature.name} (copy)`;

  const offsetCoords = (coords: [number, number]): [number, number] => [
    coords[0] + DUPLICATE_OFFSET_DEG,
    coords[1] + DUPLICATE_OFFSET_DEG,
  ];

  const offsetGeometry = (geometry: object): object => {
    if (!geometry || typeof (geometry as any).type !== "string") return geometry;
    const geom = geometry as any;
    if (geom.type === "Polygon") {
      return {
        ...geom,
        coordinates: geom.coordinates.map((ring: [number, number][]) => ring.map(offsetCoords)),
      };
    }
    if (geom.type === "MultiPolygon") {
      return {
        ...geom,
        coordinates: geom.coordinates.map((polygon: [number, number][][]) =>
          polygon.map((ring) => ring.map(offsetCoords))
        ),
      };
    }
    return geom;
  };

  switch (feature.type) {
    case "city": {
      const p = feature.properties;
      return {
        name,
        type: (p.cityType as string) ?? "city",
        coordinates: feature.coordinates ? offsetCoords(feature.coordinates) : undefined,
        population: p.population ?? undefined,
        elevation: p.elevation ?? undefined,
        foundedYear: p.foundedYear ?? undefined,
        isNationalCapital: false, // capital is unique; copy is not a capital
        isSubdivisionCapital: false,
        wikiPageTitle: undefined,
      };
    }
    case "subdivision": {
      const p = feature.properties;
      return {
        name,
        type: (p.type as string) ?? "province",
        level: (p.level as number) ?? 1,
        color: (p.color as string) ?? undefined,
        geometry: feature.geometry ? offsetGeometry(feature.geometry) : undefined,
        population: p.population ?? undefined,
        areaSqKm: p.areaSqKm ?? undefined,
      };
    }
    case "poi": {
      const p = feature.properties;
      return {
        name,
        category: (p.category as string) ?? "landmark",
        coordinates: feature.coordinates ? offsetCoords(feature.coordinates) : undefined,
        description: (p.description as string) ?? undefined,
        icon: (p.icon as string) ?? undefined,
        wikiPageTitle: undefined,
      };
    }
    case "storyPin": {
      const p = feature.properties;
      return {
        title: name,
        content: (p.content as string) ?? "",
        category: (p.category as string) ?? "cultural",
        coordinates: feature.coordinates ? offsetCoords(feature.coordinates) : undefined,
        ixTimeYear: p.ixTimeYear ?? undefined,
      };
    }
    case "mapLabel": {
      const p = feature.properties;
      return {
        text: name,
        labelType: (p.labelType as string) ?? "mountain_range",
        coordinates: feature.coordinates ? offsetCoords(feature.coordinates) : undefined,
        fontSize: (p.fontSize as number) ?? 14,
        color: (p.color as string) ?? "#374151",
        rotation: (p.rotation as number) ?? 0,
        opacity: (p.opacity as number) ?? 1,
        letterSpacing: (p.letterSpacing as number) ?? 0,
        fontWeight: (p.fontWeight as string) ?? "normal",
        minZoom: (p.minZoom as number) ?? undefined,
        maxZoom: (p.maxZoom as number) ?? undefined,
      };
    }
    case "route": {
      const p = feature.properties;
      return {
        routeType: (p.routeType as string) ?? "road",
        name,
        geometry: feature.geometry ?? undefined,
        properties: p,
      };
    }
    default:
      return { name };
  }
}

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
  | "import-cities"
  | "add-route"
  | "edit-route"
  | "paint"
  | "add-peak"
  | "edit-peak"
  | "add-river"
  | "edit-river"
  | "add-lake"
  | "edit-lake"
  | "split-subdivision"
  | "lasso-select"
  | "ruler"
  | "eyedropper"
  | "magic-wand"
  | "paint-fill"
  | "pan";

export type FeatureType =
  | "city"
  | "subdivision"
  | "poi"
  | "storyPin"
  | "mapLabel"
  | "route"
  | "peak"
  | "river"
  | "lake";

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

export interface PeakFormData {
  name: string;
  elevation: number;
  prominence?: number;
  subdivisionId?: string;
  wikiPageTitle?: string;
  coordinates?: [number, number];
}

export interface NamedRiverFormData {
  name: string;
  wikiPageTitle?: string;
  geometry?: object;
}

export interface NamedLakeFormData {
  name: string;
  maxDepthM?: number;
  wikiPageTitle?: string;
  geometry?: object;
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

const DEFAULT_PEAK: PeakFormData = {
  name: "",
  elevation: 0,
  prominence: undefined,
};

const DEFAULT_RIVER: NamedRiverFormData = {
  name: "",
};

const DEFAULT_LAKE: NamedLakeFormData = {
  name: "",
  maxDepthM: undefined,
};

interface UseMapEditorOptions {
  /** Skip the linkage gate for geometry — used in admin Forge mode */
  skipLinkageGate?: boolean;
  worldMapLayers?: import("~/components/maps/core/IxWorldMap").MapLayerData[];
}

export function useMapEditor(countryId: string | undefined, options?: UseMapEditorOptions) {
  const worldMapLayers = options?.worldMapLayers;
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
    utils.countryGeo.getCountryGeoBundle.invalidate();
  }, [utils]);

  const [mode, setModeRaw] = useState<EditorMode>("view");
  const [previousMode, setPreviousMode] = useState<EditorMode>("view");
  const setMode = useCallback((newMode: EditorMode) => {
    setModeRaw((prev) => {
      if (prev !== "eyedropper" && prev !== "magic-wand") {
        setPreviousMode(prev);
      }
      return newMode;
    });
    setValidationErrors({});
  }, []);
  const [selectedFeature, setSelectedFeature] = useState<EditorFeature | null>(null);
  const [pendingCoordinates, setPendingCoordinates] = useState<[number, number] | null>(null);
  const [isPickingLocation, setIsPickingLocation] = useState(false);
  const [pendingGeometry, setPendingGeometry] = useState<object | null>(null);
  const [cityForm, setCityForm] = useState<CityFormData>(DEFAULT_CITY);
  const [subdivisionForm, setSubdivisionForm] = useState<SubdivisionFormData>(DEFAULT_SUBDIVISION);
  const [poiForm, setPOIForm] = useState<POIFormData>(DEFAULT_POI);
  const [storyPinForm, setStoryPinForm] = useState<StoryPinFormData>(DEFAULT_STORY_PIN);
  const [mapLabelForm, setMapLabelForm] = useState<MapLabelFormData>(DEFAULT_MAP_LABEL);
  const [peakForm, setPeakForm] = useState<PeakFormData>(DEFAULT_PEAK);
  const [riverForm, setRiverForm] = useState<NamedRiverFormData>(DEFAULT_RIVER);
  const [lakeForm, setLakeForm] = useState<NamedLakeFormData>(DEFAULT_LAKE);
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const lastSavedTimerRef = useRef<ReturnType<typeof setTimeout>>();

  // ── Route Drawing State ──
  const [routeWaypoints, setRouteWaypoints] = useState<[number, number][]>([]);

  useEffect(() => {
    if (mode !== "add-route" && mode !== "split-subdivision") {
      setRouteWaypoints([]);
    }
  }, [mode]);
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
  /** When false, addRouteWaypointWithSnap ignores nearby features and places the
   *  waypoint at the raw click coordinate. Defaults to true (snap on). */
  const [isSnapEnabled, setIsSnapEnabled] = useState(true);

  // ── Ruler & Lasso State ──
  const [rulerPoints, setRulerPoints] = useState<[number, number][]>([]);
  const [lassoGeometry, setLassoGeometry] = useState<object | null>(null);

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
            case "peak":
              await m.deletePeak?.mutateAsync({ countryId, peakId: action.featureId });
              break;
            case "river":
              await m.deleteRiver?.mutateAsync({ countryId, riverId: action.featureId });
              break;
            case "lake":
              await m.deleteLake?.mutateAsync({ countryId, lakeId: action.featureId });
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
              case "peak":
                await m.createPeak?.mutateAsync({
                  countryId,
                  name: d.name,
                  coordinates: d.coordinates,
                  elevation: p?.elevation,
                  prominence: p?.prominence,
                  subdivisionId: p?.subdivisionId,
                  wikiPageTitle: p?.wikiPageTitle,
                });
                break;
              case "river":
                await m.createRiver?.mutateAsync({
                  countryId,
                  name: d.name,
                  geometry: d.geometry,
                  wikiPageTitle: p?.wikiPageTitle,
                });
                break;
              case "lake":
                await m.createLake?.mutateAsync({
                  countryId,
                  name: d.name,
                  geometry: d.geometry,
                  maxDepthM: p?.maxDepthM,
                  wikiPageTitle: p?.wikiPageTitle,
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
                await m.updateCity?.mutateAsync(
                  cleanNulls({
                    countryId,
                    id: action.featureId,
                    name: d.name,
                    type: p?.cityType ?? (p?.type as string) ?? "city",
                    coordinates: d.coordinates,
                    population: p?.population,
                    isNationalCapital: !!p?.isNationalCapital,
                    isSubdivisionCapital: !!p?.isSubdivisionCapital,
                  })
                );
                break;
              case "subdivision":
                await m.updateSubdivision?.mutateAsync(
                  cleanNulls({
                    countryId,
                    id: action.featureId,
                    name: d.name,
                    type: p?.type,
                    level: p?.level,
                  })
                );
                break;
              case "poi":
                await m.updatePOI?.mutateAsync(
                  cleanNulls({
                    countryId,
                    id: action.featureId,
                    name: d.name,
                    category: p?.category ?? "landmark",
                    coordinates: d.coordinates,
                    description: p?.description,
                  })
                );
                break;
              case "storyPin":
                await m.updateStoryPin?.mutateAsync(
                  cleanNulls({
                    countryId,
                    id: action.featureId,
                    title: d.name,
                    content: p?.content,
                    category: p?.category,
                    coordinates: d.coordinates,
                  })
                );
                break;
              case "mapLabel":
                await m.updateMapLabel?.mutateAsync(
                  cleanNulls({
                    countryId,
                    id: action.featureId,
                    text: d.name,
                    labelType: p?.labelType,
                    fontSize: p?.fontSize,
                    color: p?.color,
                    coordinates: d.coordinates,
                  })
                );
                break;
              case "route":
                await m.updateRouteGeometry?.mutateAsync({
                  countryId,
                  id: action.featureId,
                  geometry: d.geometry,
                });
                break;
              case "peak":
                await m.updatePeak?.mutateAsync(
                  cleanNulls({
                    countryId,
                    peakId: action.featureId,
                    name: d.name,
                    coordinates: d.coordinates,
                    elevation: p?.elevation,
                    prominence: p?.prominence,
                    subdivisionId: p?.subdivisionId,
                    wikiPageTitle: p?.wikiPageTitle,
                  })
                );
                break;
              case "river":
                await m.updateRiver?.mutateAsync(
                  cleanNulls({
                    countryId,
                    riverId: action.featureId,
                    name: d.name,
                    geometry: d.geometry,
                    wikiPageTitle: p?.wikiPageTitle,
                  })
                );
                break;
              case "lake":
                await m.updateLake?.mutateAsync(
                  cleanNulls({
                    countryId,
                    lakeId: action.featureId,
                    name: d.name,
                    geometry: d.geometry,
                    maxDepthM: p?.maxDepthM,
                    wikiPageTitle: p?.wikiPageTitle,
                  })
                );
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
              case "peak":
                await m.createPeak?.mutateAsync({
                  countryId,
                  ...d,
                } as any);
                break;
              case "river":
                await m.createRiver?.mutateAsync({
                  countryId,
                  ...d,
                } as any);
                break;
              case "lake":
                await m.createLake?.mutateAsync({
                  countryId,
                  ...d,
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
            case "peak":
              await m.deletePeak?.mutateAsync({ countryId, peakId: action.featureId });
              break;
            case "river":
              await m.deleteRiver?.mutateAsync({ countryId, riverId: action.featureId });
              break;
            case "lake":
              await m.deleteLake?.mutateAsync({ countryId, lakeId: action.featureId });
              break;
          }
          break;
        case "update":
          if (action.newData) {
            const d = action.newData;
            const p = d.properties as Record<string, unknown> | undefined;
            switch (action.featureType) {
              case "city":
                await m.updateCity?.mutateAsync(
                  cleanNulls({
                    countryId,
                    id: action.featureId,
                    name: d.name,
                    type: p?.cityType ?? (p?.type as string) ?? "city",
                    coordinates: d.coordinates,
                    population: p?.population,
                    isNationalCapital: !!p?.isNationalCapital,
                    isSubdivisionCapital: !!p?.isSubdivisionCapital,
                  })
                );
                break;
              case "subdivision":
                await m.updateSubdivision?.mutateAsync(
                  cleanNulls({
                    countryId,
                    id: action.featureId,
                    name: d.name,
                    type: p?.type,
                    level: p?.level,
                  })
                );
                break;
              case "poi":
                await m.updatePOI?.mutateAsync(
                  cleanNulls({
                    countryId,
                    id: action.featureId,
                    name: d.name,
                    category: p?.category ?? "landmark",
                    coordinates: d.coordinates,
                    description: p?.description,
                  })
                );
                break;
              case "storyPin":
                await m.updateStoryPin?.mutateAsync(
                  cleanNulls({
                    countryId,
                    id: action.featureId,
                    title: d.name,
                    content: p?.content,
                    category: p?.category,
                    coordinates: d.coordinates,
                  })
                );
                break;
              case "mapLabel":
                await m.updateMapLabel?.mutateAsync(
                  cleanNulls({
                    countryId,
                    id: action.featureId,
                    text: d.name,
                    labelType: p?.labelType,
                    fontSize: p?.fontSize,
                    color: p?.color,
                    coordinates: d.coordinates,
                  })
                );
                break;
              case "route":
                await m.updateRouteGeometry?.mutateAsync({
                  countryId,
                  id: action.featureId,
                  geometry: d.geometry,
                });
                break;
              case "peak":
                await m.updatePeak?.mutateAsync(
                  cleanNulls({
                    countryId,
                    peakId: action.featureId,
                    name: d.name,
                    coordinates: d.coordinates,
                    elevation: p?.elevation,
                    prominence: p?.prominence,
                    subdivisionId: p?.subdivisionId,
                    wikiPageTitle: p?.wikiPageTitle,
                  })
                );
                break;
              case "river":
                await m.updateRiver?.mutateAsync(
                  cleanNulls({
                    countryId,
                    riverId: action.featureId,
                    name: d.name,
                    geometry: d.geometry,
                    wikiPageTitle: p?.wikiPageTitle,
                  })
                );
                break;
              case "lake":
                await m.updateLake?.mutateAsync(
                  cleanNulls({
                    countryId,
                    lakeId: action.featureId,
                    name: d.name,
                    geometry: d.geometry,
                    maxDepthM: p?.maxDepthM,
                    wikiPageTitle: p?.wikiPageTitle,
                  })
                );
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

  const [presetStyle, setPresetStyle] = useState<any | null>(null);
  const [guides, setGuides] = useState<{ id: string; type: "h" | "v"; value: number }[]>([]);

  const jumpToHistoryPosition = useCallback(
    async (targetPosition: number) => {
      if (targetPosition < -1 || targetPosition >= history.actions.length) return;
      const currentPos = history.position;
      if (targetPosition === currentPos) return;

      if (targetPosition < currentPos) {
        // Undo steps in reverse chronological order
        for (let i = currentPos; i > targetPosition; i--) {
          const action = history.actions[i];
          if (action) {
            await reverseAction(action);
          }
        }
      } else {
        // Redo steps in chronological order
        for (let i = currentPos + 1; i <= targetPosition; i++) {
          const action = history.actions[i];
          if (action) {
            await applyAction(action);
          }
        }
      }
      setHistory((prev) => ({ ...prev, position: targetPosition }));
    },
    [history, reverseAction, applyAction]
  );

  const [wandMatchColor, setWandMatchColor] = useState(true);
  const [wandMatchLevel, setWandMatchLevel] = useState(false);
  const [wandMatchParent, setWandMatchParent] = useState(false);


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

  // Dedicated mutation for geometry-only (vertex) edits. Unlike updateSubdivision
  // it does NOT resetForm() (which would tear down the active vertex-edit session),
  // and it reconciles the editor's feature cache with the server's AUTHORITATIVE
  // saved geometry from the mutation response. That makes the map update live and
  // show exactly what was persisted — including any server-side clip/snap — instead
  // of waiting on a refetch that could re-serve the 60s-cached old geometry.
  const updateSubdivisionGeom = api.countryGeo.upsertSubdivision.useMutation({
    onSuccess: (saved) => {
      if (saved?.id && countryId) {
        utils.geoCore.getCountryFeatures.setData({ countryId }, (old) =>
          old
            ? {
                ...old,
                subdivisions: old.subdivisions.map((s) =>
                  s.id === saved.id
                    ? { ...s, geometry: saved.geometry, areaSqKm: saved.areaSqKm }
                    : s
                ),
              }
            : old
        );
        utils.countryGeo.getCountryGeoBundle.setData({ countryId }, (old) =>
          old
            ? {
                ...old,
                subdivisions: old.subdivisions.map((s) =>
                  s.id === saved.id
                    ? { ...s, geometry: saved.geometry, areaSqKm: saved.areaSqKm }
                    : s
                ),
              }
            : old
        );
      }
      // Refresh the other world-map caches (other views), but intentionally do NOT
      // invalidate/refetch getCountryFeatures here — the setData patch above is the
      // authoritative source for the editor and a refetch could clobber it with a
      // stale cached response.
      void utils.geoCore.getMapBundle.invalidate();
      void utils.geoCore.getWorldMap.invalidate();
    },
    onError: (err) => {
      console.error("[useMapEditor] subdivision geometry save failed:", err);
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

  const createPeak = api.geoFeatures.createPeak.useMutation({
    onSuccess: () => {
      invalidateAllMapData();
      debouncedRefetch();
      continuePlacing("add-peak");
    },
  });

  const updatePeak = api.geoFeatures.updatePeak.useMutation({
    onSuccess: () => {
      invalidateAllMapData();
      debouncedRefetch();
      resetForm();
    },
  });

  const deletePeak = api.geoFeatures.deletePeak.useMutation({
    onSuccess: () => {
      invalidateAllMapData();
      debouncedRefetch();
      setSelectedFeature(null);
    },
  });

  const createRiver = api.geoFeatures.createNamedRiver.useMutation({
    onSuccess: () => {
      invalidateAllMapData();
      debouncedRefetch();
      continuePlacing("add-river");
    },
  });

  const updateRiver = api.geoFeatures.updateNamedRiver.useMutation({
    onSuccess: () => {
      invalidateAllMapData();
      debouncedRefetch();
      resetForm();
    },
  });

  const deleteRiver = api.geoFeatures.deleteNamedRiver.useMutation({
    onSuccess: () => {
      invalidateAllMapData();
      debouncedRefetch();
      setSelectedFeature(null);
    },
  });

  const createLake = api.geoFeatures.createNamedLake.useMutation({
    onSuccess: () => {
      invalidateAllMapData();
      debouncedRefetch();
      continuePlacing("add-lake");
    },
  });

  const updateLake = api.geoFeatures.updateNamedLake.useMutation({
    onSuccess: () => {
      invalidateAllMapData();
      debouncedRefetch();
      resetForm();
    },
  });

  const deleteLake = api.geoFeatures.deleteNamedLake.useMutation({
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
    createPeak,
    updatePeak,
    deletePeak,
    createRiver,
    updateRiver,
    deleteRiver,
    createLake,
    updateLake,
    deleteLake,
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

      // Only snap when isSnapEnabled and nearby features are provided
      if (isSnapEnabled && nearbyFeatures && nearbyFeatures.length > 0) {
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
    [snapTarget, isSnapEnabled]
  );

  const resetForm = useCallback(() => {
    setMode("view");
    setSelectedFeature(null);
    setPendingCoordinates(null);
    setIsPickingLocation(false);
    setPendingGeometry(null);
    setCityForm(DEFAULT_CITY);
    setSubdivisionForm(DEFAULT_SUBDIVISION);
    setPOIForm(DEFAULT_POI);
    setStoryPinForm(DEFAULT_STORY_PIN);
    setMapLabelForm(DEFAULT_MAP_LABEL);
    setPeakForm(DEFAULT_PEAK);
    setRiverForm(DEFAULT_RIVER);
    setLakeForm(DEFAULT_LAKE);
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
        case "peak": {
          if (!peakForm.name.trim()) errors.name = "Name is required";
          if (peakForm.elevation === undefined || isNaN(peakForm.elevation)) {
            errors.elevation = "Elevation is required";
          }
          if (!isEdit && !pendingCoordinates) {
            errors.coordinates = "Click on the map to set location";
          }
          break;
        }
        case "river": {
          if (!riverForm.name.trim()) errors.name = "Name is required";
          if (!isEdit && !pendingGeometry) {
            errors.geometry = "Draw a river line on the map";
          }
          break;
        }
        case "lake": {
          if (!lakeForm.name.trim()) errors.name = "Name is required";
          if (!isEdit && !pendingGeometry) {
            errors.geometry = "Draw a lake polygon on the map";
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
      peakForm,
      riverForm,
      lakeForm,
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
    } else if (currentMode === "add-peak") {
      setPeakForm((prev) => ({
        ...prev,
        name: "",
        elevation: 0,
        prominence: undefined,
        wikiPageTitle: undefined,
      }));
    } else if (currentMode === "add-river") {
      setRiverForm((prev) => ({
        ...prev,
        name: "",
        wikiPageTitle: undefined,
        geometry: undefined,
      }));
    } else if (currentMode === "add-lake") {
      setLakeForm((prev) => ({
        ...prev,
        name: "",
        maxDepthM: undefined,
        wikiPageTitle: undefined,
        geometry: undefined,
      }));
    }
    // Flash "saved" indicator
    setLastSavedAt(Date.now());
    if (lastSavedTimerRef.current) clearTimeout(lastSavedTimerRef.current);
    lastSavedTimerRef.current = setTimeout(() => setLastSavedAt(null), 2000);
  }, []);

  const handleMapClick = useCallback(
    (lng: number, lat: number) => {
      let point: [number, number] = [lng, lat];
      if (countryGeo?.geometry) {
        point = clampToGeometry(point, countryGeo.geometry) as [number, number];
      }

      if (isPickingLocation) {
        if (mode === "add-city" || mode === "edit-city") {
          setCityForm((prev) => ({ ...prev, coordinates: point }));
          if (mode === "add-city") setPendingCoordinates(point);
        } else if (mode === "add-poi" || mode === "edit-poi") {
          setPOIForm((prev) => ({ ...prev, coordinates: point }));
          if (mode === "add-poi") setPendingCoordinates(point);
        } else if (mode === "add-story-pin" || mode === "edit-story-pin") {
          setStoryPinForm((prev) => ({ ...prev, coordinates: point }));
          if (mode === "add-story-pin") setPendingCoordinates(point);
        } else if (mode === "add-label" || mode === "edit-label") {
          setMapLabelForm((prev) => ({ ...prev, coordinates: point }));
          if (mode === "add-label") setPendingCoordinates(point);
        } else if (mode === "add-peak" || mode === "edit-peak") {
          setPeakForm((prev) => ({ ...prev, coordinates: point }));
          if (mode === "add-peak") setPendingCoordinates(point);
        }
        setIsPickingLocation(false);
        return;
      }

      if (
        mode === "add-city" ||
        mode === "add-poi" ||
        mode === "add-story-pin" ||
        mode === "add-label" ||
        mode === "add-peak"
      ) {
        setPendingCoordinates(point);
      } else if (mode === "add-route" || mode === "split-subdivision") {
        setRouteWaypoints((prev) => [...prev, [lng, lat]]);
      }
    },
    [
      mode,
      countryGeo,
      isPickingLocation,
      setCityForm,
      setPOIForm,
      setStoryPinForm,
      setMapLabelForm,
      setPeakForm,
      setPendingCoordinates,
      setRouteWaypoints,
    ]
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
      } else if (mode === "add-river") {
        setPendingGeometry(geometry);
        setRiverForm((prev) => ({ ...prev, geometry }));
      } else if (mode === "add-lake") {
        if (countryGeo?.geometry && (geometry as any).type === "Polygon") {
          const outerRing = (geometry as any).coordinates?.[0] as [number, number][] | undefined;
          if (outerRing && outerRing.length > 0) {
            const anyInside = outerRing.some((pt: [number, number]) =>
              pointInGeometry(pt, countryGeo.geometry)
            );
            if (!anyInside) {
              alert("Lake must be inside the country boundary.");
              return;
            }
          }
        }
        setPendingGeometry(geometry);
        setLakeForm((prev) => ({ ...prev, geometry }));
      }
    },
    [mode, countryGeo, setSubdivisionForm, setRiverForm, setLakeForm]
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
      foundedYear: cityForm.foundedYear,
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
      color: subdivisionForm.color,
      capital: subdivisionForm.capital,
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
      rotation: mapLabelForm.rotation,
      opacity: mapLabelForm.opacity,
      letterSpacing: mapLabelForm.letterSpacing,
      fontWeight: mapLabelForm.fontWeight,
      minZoom: mapLabelForm.minZoom,
      maxZoom: mapLabelForm.maxZoom,
    });
  }, [countryId, pendingCoordinates, mapLabelForm, createMapLabel, validateFeature]);

  const submitPeak = useCallback(async () => {
    const errors = validateFeature("peak", false);
    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      return;
    }
    setValidationErrors({});
    const coords = pendingCoordinates || peakForm.coordinates;
    if (!countryId || !coords) return;
    await createPeak.mutateAsync({
      countryId,
      name: peakForm.name.trim(),
      coordinates: coords,
      elevation: peakForm.elevation,
      prominence: peakForm.prominence,
      subdivisionId: peakForm.subdivisionId,
      wikiPageTitle: peakForm.wikiPageTitle,
    });
  }, [countryId, pendingCoordinates, peakForm, createPeak, validateFeature]);

  const submitEditPeak = useCallback(async () => {
    const errors = validateFeature("peak", true);
    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      return;
    }
    setValidationErrors({});
    if (!countryId || !selectedFeature) return;
    await updatePeak.mutateAsync({
      countryId,
      peakId: selectedFeature.id,
      name: peakForm.name.trim(),
      coordinates: peakForm.coordinates,
      elevation: peakForm.elevation,
      prominence: peakForm.prominence,
      subdivisionId: peakForm.subdivisionId,
      wikiPageTitle: peakForm.wikiPageTitle,
    });
  }, [countryId, selectedFeature, peakForm, updatePeak, validateFeature]);

  const submitRiver = useCallback(async () => {
    const errors = validateFeature("river", false);
    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      return;
    }
    setValidationErrors({});
    const geometry = pendingGeometry || riverForm.geometry;
    if (!countryId || !geometry) return;
    await createRiver.mutateAsync({
      countryId,
      name: riverForm.name.trim(),
      geometry: geometry as Record<string, unknown>,
      wikiPageTitle: riverForm.wikiPageTitle,
    });
  }, [countryId, pendingGeometry, riverForm, createRiver, validateFeature]);

  const submitEditRiver = useCallback(async () => {
    const errors = validateFeature("river", true);
    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      return;
    }
    setValidationErrors({});
    if (!countryId || !selectedFeature) return;
    await updateRiver.mutateAsync({
      countryId,
      riverId: selectedFeature.id,
      name: riverForm.name.trim(),
      geometry: riverForm.geometry as Record<string, unknown>,
      wikiPageTitle: riverForm.wikiPageTitle,
    });
  }, [countryId, selectedFeature, riverForm, updateRiver, validateFeature]);

  const submitLake = useCallback(async () => {
    const errors = validateFeature("lake", false);
    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      return;
    }
    setValidationErrors({});
    const geometry = pendingGeometry || lakeForm.geometry;
    if (!countryId || !geometry) return;
    await createLake.mutateAsync({
      countryId,
      name: lakeForm.name.trim(),
      geometry: geometry as Record<string, unknown>,
      maxDepthM: lakeForm.maxDepthM,
      wikiPageTitle: lakeForm.wikiPageTitle,
    });
  }, [countryId, pendingGeometry, lakeForm, createLake, validateFeature]);

  const submitEditLake = useCallback(async () => {
    const errors = validateFeature("lake", true);
    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      return;
    }
    setValidationErrors({});
    if (!countryId || !selectedFeature) return;
    await updateLake.mutateAsync({
      countryId,
      lakeId: selectedFeature.id,
      name: lakeForm.name.trim(),
      geometry: lakeForm.geometry as Record<string, unknown>,
      maxDepthM: lakeForm.maxDepthM,
      wikiPageTitle: lakeForm.wikiPageTitle,
    });
  }, [countryId, selectedFeature, lakeForm, updateLake, validateFeature]);

  /** Enter edit mode for an existing feature, populating the appropriate form. */
  const startEditing = useCallback((feature: EditorFeature) => {
    setSelectedFeature(feature);
    setLastSavedAt(null);
    setIsPickingLocation(false);
    setRouteWaypoints([]);
    setPendingGeometry(null);
    setPendingCoordinates(null);

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
          elevation: (feature.properties.elevation as number | undefined) ?? undefined,
          foundedYear: (feature.properties.foundedYear as number | undefined) ?? undefined,
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
      case "peak":
        setMode("edit-peak");
        setPeakForm({
          name: feature.name,
          elevation: (feature.properties.elevation as number) ?? 0,
          prominence: (feature.properties.prominence as number | undefined) ?? undefined,
          subdivisionId: (feature.properties.subdivisionId as string | undefined) ?? undefined,
          wikiPageTitle: (feature.properties.wikiPageTitle as string | undefined) ?? undefined,
          coordinates: feature.coordinates,
        });
        break;
      case "river":
        setMode("edit-river");
        setRiverForm({
          name: feature.name,
          wikiPageTitle: (feature.properties.wikiPageTitle as string | undefined) ?? undefined,
          geometry: feature.geometry,
        });
        break;
      case "lake":
        setMode("edit-lake");
        setLakeForm({
          name: feature.name,
          maxDepthM: (feature.properties.maxDepthM as number | undefined) ?? undefined,
          wikiPageTitle: (feature.properties.wikiPageTitle as string | undefined) ?? undefined,
          geometry: feature.geometry,
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
      foundedYear: cityForm.foundedYear,
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
      color: subdivisionForm.color,
      capital: subdivisionForm.capital,
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
      rotation: mapLabelForm.rotation,
      opacity: mapLabelForm.opacity,
      letterSpacing: mapLabelForm.letterSpacing,
      fontWeight: mapLabelForm.fontWeight,
      minZoom: mapLabelForm.minZoom,
      maxZoom: mapLabelForm.maxZoom,
    });
  }, [countryId, selectedFeature, mapLabelForm, updateMapLabel, validateFeature]);

  const updateSubdivisionGeometry = useCallback(
    async (featureId: string, geometry: object) => {
      if (!countryId) return;
      try {
        await updateSubdivisionGeom.mutateAsync({
          countryId,
          id: featureId,
          geometry,
        });
      } catch (err) {
        // The vertex-edit handlers call this fire-and-forget; swallow here so the
        // rejection is logged (via the mutation's onError) rather than surfacing as
        // an unhandled promise rejection. The error is also exposed via mutationError.
        console.error("[useMapEditor] updateSubdivisionGeometry failed:", err);
      }
    },
    [countryId, updateSubdivisionGeom]
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
        case "peak":
          await deletePeak.mutateAsync({ countryId, peakId: feature.id });
          break;
        case "river":
          await deleteRiver.mutateAsync({ countryId, riverId: feature.id });
          break;
        case "lake":
          await deleteLake.mutateAsync({ countryId, lakeId: feature.id });
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
      deletePeak,
      deleteRiver,
      deleteLake,
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
          subdivisionId: city.subdivisionId,
          elevation: city.elevation,
          foundedYear: city.foundedYear,
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

    for (const peak of features.peaks ?? []) {
      list.push({
        id: peak.id,
        type: "peak",
        name: peak.name,
        coordinates: peak.coordinates as [number, number] | undefined,
        properties: {
          elevation: peak.elevation,
          prominence: peak.prominence,
          subdivisionId: peak.subdivisionId,
          wikiPageTitle: peak.wikiPageTitle,
        },
      });
    }

    for (const river of features.namedRivers ?? []) {
      list.push({
        id: river.id,
        type: "river",
        name: river.name,
        geometry: river.geometry as object | undefined,
        properties: {
          lengthKm: river.lengthKm,
          wikiPageTitle: river.wikiPageTitle,
        },
      });
    }

    for (const lake of features.namedLakes ?? []) {
      list.push({
        id: lake.id,
        type: "lake",
        name: lake.name,
        geometry: lake.geometry as object | undefined,
        properties: {
          areaSqKm: lake.areaSqKm,
          maxDepthM: lake.maxDepthM,
          wikiPageTitle: lake.wikiPageTitle,
        },
      });
    }

    return list;
  }, [features, countryRoutes]);

  const applyEyedropper = useCallback(
    (feature: EditorFeature) => {
      if (!feature) return;

      setPresetStyle({
        type: feature.type,
        properties: { ...feature.properties },
      });

      if (feature.type === "subdivision") {
        setSubdivisionForm({
          name: "",
          type: (feature.properties.type as string) ?? "province",
          level: (feature.properties.level as number) ?? 1,
          color: (feature.properties.color as string | undefined) ?? undefined,
        });
      } else if (feature.type === "city") {
        setCityForm({
          name: "",
          cityType: (feature.properties.cityType as string) ?? "city",
          population: (feature.properties.population as number | undefined) ?? undefined,
          isNationalCapital: false,
          isSubdivisionCapital: false,
          subdivisionId: (feature.properties.subdivisionId as string | undefined) ?? undefined,
        });
      } else if (feature.type === "poi") {
        setPOIForm({
          name: "",
          category: (feature.properties.category as string) ?? "landmark",
          description: (feature.properties.description as string | undefined) ?? undefined,
        });
      } else if (feature.type === "storyPin") {
        setStoryPinForm({
          title: "",
          content: "",
          contentFormat: "plain",
          category: (feature.properties.category as string) ?? "cultural",
          importance: (feature.properties.importance as number) ?? 0,
        });
      } else if (feature.type === "mapLabel") {
        setMapLabelForm({
          text: "",
          labelType: (feature.properties.labelType as string) ?? "mountain_range",
          fontSize: (feature.properties.fontSize as number) ?? 14,
          color: (feature.properties.color as string) ?? "#374151",
          rotation: (feature.properties.rotation as number) ?? 0,
          letterSpacing: (feature.properties.letterSpacing as number) ?? 0,
          fontWeight: (feature.properties.fontWeight as string) ?? "normal",
          opacity: (feature.properties.opacity as number) ?? 1,
        });
      }

      setModeRaw(previousMode);
    },
    [previousMode]
  );

  const applyMagicWand = useCallback(
    (feature: EditorFeature, isShift: boolean, isAlt: boolean) => {
      if (!feature) return;

      const matches = allFeatures.filter((f) => {
        if (f.type !== feature.type) return false;

        if (wandMatchColor) {
          const colA = feature.properties.color || feature.properties.fill;
          const colB = f.properties.color || f.properties.fill;
          if (colA !== colB) return false;
        }

        if (wandMatchLevel) {
          const levelA =
            feature.properties.level ||
            feature.properties.cityType ||
            feature.properties.category ||
            feature.properties.labelType;
          const levelB =
            f.properties.level ||
            f.properties.cityType ||
            f.properties.category ||
            f.properties.labelType;
          if (levelA !== levelB) return false;
        }

        if (wandMatchParent) {
          const parentA = feature.properties.countryId || feature.properties.subdivisionId;
          const parentB = f.properties.countryId || f.properties.subdivisionId;
          if (parentA !== parentB) return false;
        }

        return true;
      });

      setSelectedIds((prev) => {
        const next = new Set(prev);
        if (isAlt) {
          matches.forEach((f) => next.delete(f.id));
        } else if (isShift) {
          matches.forEach((f) => next.add(f.id));
        } else {
          next.clear();
          matches.forEach((f) => next.add(f.id));
        }
        return next;
      });
    },
    [allFeatures, wandMatchColor, wandMatchLevel, wandMatchParent]
  );

  const pathfinderOperation = useCallback(
    async (opType: "union" | "subtract" | "intersect") => {
      if (!countryId) return;

      const selectedSubdivisions = allFeatures.filter(
        (f) => f.type === "subdivision" && selectedIds.has(f.id)
      );
      if (selectedSubdivisions.length < 2) {
        alert("Please select at least 2 subdivisions to perform Pathfinder operations.");
        return;
      }

      const primary = selectedSubdivisions[0]!;
      if (!primary.geometry) return;

      let currentGeom = primary.geometry;
      const deletedFeatures: typeof selectedSubdivisions = [];

      for (let i = 1; i < selectedSubdivisions.length; i++) {
        const other = selectedSubdivisions[i]!;
        if (!currentGeom || !other.geometry) continue;

        let result: any = null;

        if (opType === "union") {
          result = union(
            featureCollection([
              { type: "Feature", geometry: currentGeom as any, properties: {} },
              { type: "Feature", geometry: other.geometry as any, properties: {} },
            ])
          );
        } else if (opType === "subtract") {
          result = difference(
            featureCollection([
              { type: "Feature", geometry: currentGeom as any, properties: {} },
              { type: "Feature", geometry: other.geometry as any, properties: {} },
            ])
          );
        } else if (opType === "intersect") {
          result = intersect(
            featureCollection([
              { type: "Feature", geometry: currentGeom as any, properties: {} },
              { type: "Feature", geometry: other.geometry as any, properties: {} },
            ])
          );
        }

        if (result && result.geometry) {
          currentGeom = cleanPolygonGeometry(result.geometry);
        } else if (opType === "subtract") {
          currentGeom = null;
        } else {
          currentGeom = null;
        }

        if (opType === "union" || opType === "intersect" || (opType === "subtract" && result)) {
          deletedFeatures.push(other);
        }
      }

      if (!currentGeom && opType !== "subtract") {
        alert(`Pathfinder ${opType} operation resulted in empty or invalid geometry.`);
        return;
      }

      // 1. Push history actions
      pushAction({
        type: "update",
        featureType: "subdivision",
        featureId: primary.id,
        previousData: {
          name: primary.name,
          geometry: primary.geometry,
          properties: primary.properties,
        },
        newData: {
          name: primary.name,
          geometry: currentGeom || undefined,
          properties: primary.properties,
        },
      });

      for (const other of deletedFeatures) {
        pushAction({
          type: "delete",
          featureType: "subdivision",
          featureId: other.id,
          previousData: {
            name: other.name,
            geometry: other.geometry,
            properties: other.properties,
          },
        });
      }

      // 2. Database mutations
      if (currentGeom) {
        await updateSubdivisionGeom.mutateAsync({
          countryId,
          id: primary.id,
          geometry: currentGeom,
        });
      } else {
        await deleteSubdivision.mutateAsync({
          countryId,
          subdivisionId: primary.id,
        });
      }

      for (const other of deletedFeatures) {
        await deleteSubdivision.mutateAsync({
          countryId,
          subdivisionId: other.id,
        });
      }

      clearMultiSelect();
      invalidateAllMapData();
      debouncedRefetch();
    },
    [
      countryId,
      allFeatures,
      selectedIds,
      updateSubdivisionGeom,
      deleteSubdivision,
      pushAction,
      clearMultiSelect,
      invalidateAllMapData,
      debouncedRefetch,
    ]
  );

  const updatePointCoordinates = useCallback(
    async (
      featureId: string,
      featureType: "city" | "poi" | "storyPin" | "mapLabel" | "peak",
      coordinates: [number, number]
    ) => {
      if (!countryId) return;

      const feature = allFeatures.find((f) => f.id === featureId);
      if (!feature) return;

      // Optimistically update tRPC react-query cache to prevent coordinate jumping
      const prevData = utils.geoCore.getCountryFeatures.getData({ countryId });
      if (prevData) {
        const newData = { ...prevData };
        if (featureType === "city" && newData.cities) {
          newData.cities = newData.cities.map((item) =>
            item.id === featureId ? { ...item, coordinates } : item
          );
        } else if (featureType === "poi" && newData.pois) {
          newData.pois = newData.pois.map((item) =>
            item.id === featureId ? { ...item, coordinates } : item
          );
        } else if (featureType === "storyPin" && newData.storyPins) {
          newData.storyPins = newData.storyPins.map((item) =>
            item.id === featureId ? { ...item, coordinates } : item
          );
        } else if (featureType === "mapLabel" && newData.mapLabels) {
          newData.mapLabels = newData.mapLabels.map((item) =>
            item.id === featureId ? { ...item, coordinates } : item
          );
        } else if (featureType === "peak" && newData.peaks) {
          newData.peaks = newData.peaks.map((item) =>
            item.id === featureId ? { ...item, coordinates } : item
          );
        }
        utils.geoCore.getCountryFeatures.setData({ countryId }, newData);
      }

      pushAction({
        type: "update",
        featureType,
        featureId,
        previousData: {
          name: feature.name,
          coordinates: feature.coordinates,
          properties: feature.properties,
        },
        newData: {
          name: feature.name,
          coordinates,
          properties: feature.properties,
        },
      });

      try {
        switch (featureType) {
          case "city":
            await updateCity.mutateAsync({
              countryId,
              id: featureId,
              name: feature.name,
              type: feature.properties.cityType || "city",
              coordinates,
              population: feature.properties.population ?? undefined,
              elevation: feature.properties.elevation ?? undefined,
              foundedYear: feature.properties.foundedYear ?? undefined,
              isNationalCapital: feature.properties.isNationalCapital ?? undefined,
              isSubdivisionCapital: feature.properties.isSubdivisionCapital ?? undefined,
              wikiPageTitle: feature.properties.wikiPageTitle ?? undefined,
            });
            if (selectedFeature?.id === featureId) {
              setCityForm((prev) => ({ ...prev, coordinates }));
            }
            break;

          case "poi":
            await updatePOI.mutateAsync({
              countryId,
              id: featureId,
              name: feature.name,
              category: feature.properties.category || "landmark",
              coordinates,
              description: feature.properties.description ?? undefined,
              icon: feature.properties.icon ?? undefined,
              wikiPageTitle: feature.properties.wikiPageTitle ?? undefined,
            });
            if (selectedFeature?.id === featureId) {
              setPOIForm((prev) => ({ ...prev, coordinates }));
            }
            break;

          case "storyPin":
            await updateStoryPin.mutateAsync({
              countryId,
              id: featureId,
              title: feature.name,
              content: feature.properties.content || "",
              category: feature.properties.category || "cultural",
              coordinates,
              ixTimeYear: feature.properties.ixTimeYear ?? undefined,
            });
            if (selectedFeature?.id === featureId) {
              setStoryPinForm((prev) => ({ ...prev, coordinates }));
            }
            break;

          case "mapLabel":
            await updateMapLabel.mutateAsync({
              countryId,
              id: featureId,
              text: feature.name,
              labelType: feature.properties.labelType || "mountain_range",
              coordinates,
              fontSize: feature.properties.fontSize || 14,
              color: feature.properties.color || "#374151",
              rotation: feature.properties.rotation || 0,
              opacity: feature.properties.opacity !== undefined ? feature.properties.opacity : 1,
              letterSpacing: feature.properties.letterSpacing || 0,
              fontWeight: feature.properties.fontWeight || "normal",
              minZoom: feature.properties.minZoom ?? undefined,
              maxZoom: feature.properties.maxZoom ?? undefined,
            });
            if (selectedFeature?.id === featureId) {
              setMapLabelForm((prev) => ({ ...prev, coordinates }));
            }
            break;

          case "peak":
            await updatePeak.mutateAsync({
              countryId,
              peakId: featureId,
              name: feature.name,
              coordinates,
              elevation: feature.properties.elevation ?? 0,
              prominence: feature.properties.prominence ?? null,
              subdivisionId: feature.properties.subdivisionId ?? null,
              wikiPageTitle: feature.properties.wikiPageTitle ?? null,
            });
            if (selectedFeature?.id === featureId) {
              setPeakForm((prev) => ({ ...prev, coordinates }));
            }
            break;
        }
      } catch (err) {
        console.error(`[useMapEditor] updatePointCoordinates failed for ${featureType}:`, err);
      }
    },
    [
      countryId,
      allFeatures,
      pushAction,
      updateCity,
      updatePOI,
      updateStoryPin,
      updateMapLabel,
      updatePeak,
      selectedFeature,
      utils,
    ]
  );

  // Duplicate a feature (clone + offset + rename)
  const duplicateFeature = useCallback(
    async (feature: EditorFeature | null) => {
      if (!countryId || !feature) return;
      const input = buildDuplicateInput(feature);
      let newId: string | undefined;

      switch (feature.type) {
        case "city": {
          const result = await createCity.mutateAsync({
            countryId,
            name: input.name as string,
            type: (input.type as string) ?? "city",
            coordinates: input.coordinates as [number, number] | undefined,
            population: input.population as number | undefined,
            elevation: input.elevation as number | undefined,
            foundedYear: input.foundedYear as number | undefined,
            isNationalCapital: false,
            isSubdivisionCapital: false,
          });
          newId = result?.id;
          break;
        }
        case "subdivision": {
          const result = await createSubdivision.mutateAsync({
            countryId,
            name: input.name as string,
            type: (input.type as string) ?? "province",
            level: (input.level as number) ?? 1,
            geometry: input.geometry as object | undefined,
            color: input.color as string | undefined,
            population: input.population as number | undefined,
            areaSqKm: input.areaSqKm as number | undefined,
          });
          newId = result?.id;
          break;
        }
        case "poi": {
          const result = await createPOI.mutateAsync({
            countryId,
            name: input.name as string,
            category: (input.category as string) ?? "landmark",
            coordinates: input.coordinates as [number, number] | undefined,
            description: input.description as string | undefined,
            icon: input.icon as string | undefined,
          });
          newId = result?.id;
          break;
        }
        case "storyPin": {
          const result = await createStoryPin.mutateAsync({
            countryId,
            title: input.title as string,
            content: (input.content as string) ?? "",
            category: (input.category as string) ?? "cultural",
            coordinates: input.coordinates as [number, number] | undefined,
            ixTimeYear: input.ixTimeYear as number | undefined,
          });
          newId = result?.id;
          break;
        }
        case "mapLabel": {
          const result = await createMapLabel.mutateAsync({
            countryId,
            text: input.text as string,
            labelType: (input.labelType as string) ?? "mountain_range",
            coordinates: input.coordinates as [number, number] | undefined,
            fontSize: (input.fontSize as number) ?? 14,
            color: (input.color as string) ?? "#374151",
            rotation: (input.rotation as number) ?? 0,
            opacity: (input.opacity as number) ?? 1,
            letterSpacing: (input.letterSpacing as number) ?? 0,
            fontWeight: (input.fontWeight as string) ?? "normal",
            minZoom: (input.minZoom as number) ?? undefined,
            maxZoom: (input.maxZoom as number) ?? undefined,
          });
          newId = result?.id;
          break;
        }
        case "peak": {
          const result = await createPeak.mutateAsync({
            countryId,
            name: input.name as string,
            coordinates: input.coordinates as [number, number],
            elevation: input.elevation as number,
            prominence: input.prominence as number | undefined,
            subdivisionId: input.subdivisionId as string | undefined,
          });
          newId = result?.id;
          break;
        }
        case "river": {
          const result = await createRiver.mutateAsync({
            countryId,
            name: input.name as string,
            geometry: input.geometry as Record<string, unknown>,
          });
          newId = result?.id;
          break;
        }
        case "lake": {
          const result = await createLake.mutateAsync({
            countryId,
            name: input.name as string,
            geometry: input.geometry as Record<string, unknown>,
            maxDepthM: input.maxDepthM as number | undefined,
          });
          newId = result?.id;
          break;
        }
        case "route": {
          const result = await createRoute.mutateAsync({
            countryId,
            routeType: (input.routeType as string) ?? "road",
            name: input.name as string,
            geometry: input.geometry as object | undefined,
          });
          newId = result?.id;
          break;
        }
      }

      if (newId) {
        pushAction({
          type: "create",
          featureType: feature.type,
          featureId: newId,
          newData: input,
        });
      }

      invalidateAllMapData();
      debouncedRefetch();
    },
    [
      countryId,
      createCity,
      createSubdivision,
      createPOI,
      createStoryPin,
      createMapLabel,
      createPeak,
      createRiver,
      createLake,
      createRoute,
      pushAction,
      invalidateAllMapData,
      debouncedRefetch,
    ]
  );

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

  // ── Gaps / Negative Space State & Recalculation ──
  const [showGaps, setShowGaps] = useState(false);
  const [gapFeatures, setGapFeatures] = useState<any>(null);

  const recalculateGaps = useCallback(() => {
    if (!countryGeo?.geometry) return;
    try {
      const gaps = computeGaps(countryGeo.geometry, features?.subdivisions ?? []);
      setGapFeatures(gaps);
    } catch (err) {
      console.error("Failed to recalculate gaps:", err);
    }
  }, [countryGeo, features]);

  useEffect(() => {
    if (!showGaps || !countryGeo?.geometry) {
      setGapFeatures(null);
      return;
    }
    recalculateGaps();
  }, [showGaps, countryGeo, features, recalculateGaps]);

  const createSubdivisionFromGap = useCallback(
    (gapPolygon: any) => {
      const colors = ["#7c3aed", "#3b82f6", "#10b981", "#ef4444", "#f59e0b", "#a855f7", "#ec4899"];
      const randomColor = colors[Math.floor(Math.random() * colors.length)] ?? "#7c3aed";

      setSubdivisionForm({
        name: "New Region",
        type: "province",
        level: 1,
        color: randomColor,
      });
      setPendingGeometry(gapPolygon);
      setMode("add-subdivision");
      setSelectedFeature(null);
    },
    [setMode]
  );

  // ── City Scatter ──
  const scatterCities = useCallback(
    async (subdivisionId: string, count: number, cityType: string, namePrefix: string) => {
      if (!countryId) return;
      const sub = allFeatures.find((f) => f.id === subdivisionId && f.type === "subdivision");
      if (!sub || !sub.geometry) return;

      const subGeom = sub.geometry;
      const bounds = bbox(subGeom);
      const minLng = bounds[0]!;
      const minLat = bounds[1]!;
      const maxLng = bounds[2]!;
      const maxLat = bounds[3]!;

      const points: [number, number][] = [];
      let attempts = 0;
      while (points.length < count && attempts < count * 200) {
        attempts++;
        const lng = minLng + Math.random() * (maxLng - minLng);
        const lat = minLat + Math.random() * (maxLat - minLat);
        const pt = point([lng, lat]);
        if (booleanPointInPolygon(pt, subGeom as any)) {
          points.push([lng, lat]);
        }
      }

      for (let i = 0; i < points.length; i++) {
        const coords = points[i]!;
        const cityName = `${namePrefix} ${i + 1}`;
        await createCity.mutateAsync({
          countryId,
          name: cityName,
          type: cityType,
          coordinates: coords,
          subdivisionId,
        });
      }

      invalidateAllMapData();
      debouncedRefetch();
    },
    [countryId, allFeatures, createCity, invalidateAllMapData, debouncedRefetch]
  );

  // ── City Snapping ──
  const snapCityToSubdivisionBorder = useCallback(
    async (cityId: string) => {
      if (!countryId) return;
      const city = allFeatures.find((f) => f.id === cityId && f.type === "city");
      if (!city || !city.coordinates) return;

      const subId = city.properties.subdivisionId as string | undefined;
      if (!subId) return;

      const sub = allFeatures.find((f) => f.id === subId && f.type === "subdivision");
      if (!sub || !sub.geometry) return;

      const nearestCoords = getNearestPointOnGeometryBoundary(city.coordinates, sub.geometry);

      await updateCity.mutateAsync({
        countryId,
        id: cityId,
        name: city.name,
        type: city.properties.cityType as string,
        coordinates: nearestCoords,
        subdivisionId: subId,
      });

      invalidateAllMapData();
      debouncedRefetch();
    },
    [countryId, allFeatures, updateCity, invalidateAllMapData, debouncedRefetch]
  );

  const snapCityToCoastline = useCallback(
    async (cityId: string) => {
      if (!countryId) return;
      const city = allFeatures.find((f) => f.id === cityId && f.type === "city");
      if (!city || !city.coordinates) return;

      let nearestCoords = city.coordinates;
      let minDistance = Infinity;

      if (countryGeo?.geometry) {
        const pt = getNearestPointOnGeometryBoundary(city.coordinates, countryGeo.geometry);
        const dist = Math.hypot(pt[0] - city.coordinates[0], pt[1] - city.coordinates[1]);
        if (dist < minDistance) {
          minDistance = dist;
          nearestCoords = pt;
        }
      }

      if (worldMapLayers) {
        for (const layer of worldMapLayers) {
          if (layer.type === "water" || layer.type === "lakes" || layer.type === "rivers") {
            const data = layer.data as any;
            if (data?.features) {
              for (const feat of data.features) {
                if (feat.geometry) {
                  const pt = getNearestPointOnGeometryBoundary(city.coordinates, feat.geometry);
                  const dist = Math.hypot(pt[0] - city.coordinates[0], pt[1] - city.coordinates[1]);
                  if (dist < minDistance) {
                    minDistance = dist;
                    nearestCoords = pt;
                  }
                }
              }
            }
          }
        }
      }

      await updateCity.mutateAsync({
        countryId,
        id: cityId,
        name: city.name,
        type: city.properties.cityType as string,
        coordinates: nearestCoords,
        subdivisionId: city.properties.subdivisionId as string | undefined,
      });

      invalidateAllMapData();
      debouncedRefetch();
    },
    [
      countryId,
      allFeatures,
      countryGeo,
      worldMapLayers,
      updateCity,
      invalidateAllMapData,
      debouncedRefetch,
    ]
  );

  // ── Split/Merge Subdivisions ──
  const executeSplitSubdivision = useCallback(async () => {
    if (!countryId || !selectedFeature || selectedFeature.type !== "subdivision") return;
    if (routeWaypoints.length < 2) return;

    const subGeom = selectedFeature.geometry;
    if (!subGeom) return;

    const pieces = splitPolygonByLine(subGeom, routeWaypoints);
    if (!pieces || pieces.length < 2) {
      console.warn("Polygon split resulted in fewer than 2 pieces.");
      return;
    }

    await deleteSubdivision.mutateAsync({
      countryId,
      subdivisionId: selectedFeature.id,
    });

    const name = selectedFeature.name;
    const props = selectedFeature.properties;

    for (let i = 0; i < pieces.length; i++) {
      const suffix = String.fromCharCode(65 + i);
      await createSubdivision.mutateAsync({
        countryId,
        name: `${name} ${suffix}`,
        type: (props.type as string) ?? "province",
        level: (props.level as number) ?? 1,
        geometry: pieces[i],
        population: props.population
          ? Math.round(Number(props.population) / pieces.length)
          : undefined,
        areaSqKm: props.areaSqKm ? Number(props.areaSqKm) / pieces.length : undefined,
        color: (props.color as string) ?? undefined,
      });
    }

    setRouteWaypoints([]);
    setMode("view");
    setSelectedFeature(null);
    invalidateAllMapData();
    debouncedRefetch();
  }, [
    countryId,
    selectedFeature,
    routeWaypoints,
    deleteSubdivision,
    createSubdivision,
    invalidateAllMapData,
    debouncedRefetch,
    setMode,
  ]);

  const mergeSelectedSubdivisions = useCallback(async () => {
    if (!countryId || selectedIds.size < 2) return;

    const subdivisionsToMerge = allFeatures.filter(
      (f) => selectedIds.has(f.id) && f.type === "subdivision" && f.geometry
    );

    if (subdivisionsToMerge.length < 2) return;

    const baseSub = subdivisionsToMerge[0]!;
    const baseGeom = cleanPolygonGeometry(baseSub.geometry);
    if (!baseGeom) return;

    let unionFeature = {
      type: "Feature" as const,
      geometry: baseGeom,
      properties: {},
    };

    for (let i = 1; i < subdivisionsToMerge.length; i++) {
      const nextSub = subdivisionsToMerge[i]!;
      const subGeom = cleanPolygonGeometry(nextSub.geometry);
      if (!subGeom) continue;

      const subFeature = {
        type: "Feature" as const,
        geometry: subGeom,
        properties: {},
      };
      try {
        const merged = union(featureCollection([unionFeature, subFeature]));
        if (merged) {
          const cleanedMerged = cleanPolygonGeometry(merged.geometry);
          if (cleanedMerged) {
            unionFeature = {
              ...merged,
              geometry: cleanedMerged,
            };
          }
        }
      } catch (err) {
        console.error("Error merging geometries:", err);
      }
    }

    const finalGeom = cleanPolygonGeometry(unionFeature.geometry);
    if (!finalGeom) return;

    await updateSubdivisionGeom.mutateAsync({
      countryId,
      id: baseSub.id,
      name: baseSub.name,
      geometry: finalGeom,
    });

    for (let i = 1; i < subdivisionsToMerge.length; i++) {
      const nextSub = subdivisionsToMerge[i]!;
      await deleteSubdivision.mutateAsync({
        countryId,
        subdivisionId: nextSub.id,
      });
    }

    clearMultiSelect();
    invalidateAllMapData();
    debouncedRefetch();
  }, [
    countryId,
    selectedIds,
    allFeatures,
    updateSubdivisionGeom,
    deleteSubdivision,
    clearMultiSelect,
    invalidateAllMapData,
    debouncedRefetch,
  ]);

  // ── Geometry Transformations (Simplify, Smooth, Rotate, Scale) ──
  const applyGeometryTransformation = useCallback(
    async (type: "simplify" | "smooth" | "rotate" | "scale", value: number) => {
      if (!countryId || !selectedFeature || selectedFeature.type !== "subdivision") return;
      const subGeom = selectedFeature.geometry;
      if (!subGeom) return;

      const feat = {
        type: "Feature" as const,
        geometry: subGeom,
        properties: {},
      };

      let newGeom: any = null;

      try {
        if (type === "simplify") {
          const result = simplify(feat, { tolerance: value, highQuality: false });
          newGeom = result?.geometry;
        } else if (type === "smooth") {
          const result = bezierSpline(feat, { resolution: 10000, sharpAngle: 120 });
          newGeom = result?.geometry;
        } else if (type === "rotate") {
          const result = transformRotate(feat, value);
          newGeom = result?.geometry;
        } else if (type === "scale") {
          const result = transformScale(feat, value);
          newGeom = result?.geometry;
        }
      } catch (err) {
        console.error(`Failed to apply geometry transformation ${type}:`, err);
        return;
      }

      if (newGeom) {
        const cleanedGeom = cleanPolygonGeometry(newGeom);
        if (!cleanedGeom) {
          console.error(`Transformation ${type} resulted in an invalid or empty geometry.`);
          return;
        }

        await updateSubdivisionGeom.mutateAsync({
          countryId,
          id: selectedFeature.id,
          name: selectedFeature.name,
          geometry: cleanedGeom,
        });

        setSelectedFeature((prev) => {
          if (!prev) return null;
          return {
            ...prev,
            geometry: cleanedGeom,
          };
        });

        invalidateAllMapData();
        debouncedRefetch();
      }
    },
    [countryId, selectedFeature, updateSubdivisionGeom, invalidateAllMapData, debouncedRefetch]
  );

  // ── Empty subdivisions / Auto-centroid state & detection ──
  const [emptyRegionsFeatures, setEmptyRegionsFeatures] = useState<any>(null);

  useEffect(() => {
    if (!showGaps || !features?.subdivisions) {
      setEmptyRegionsFeatures(null);
      return;
    }

    const subdivisions = features.subdivisions;
    const cities = features.cities ?? [];

    const emptySubs = subdivisions.filter((sub) => {
      if (!sub.geometry) return false;

      const hasCity = cities.some((city) => {
        if (!city.coordinates) return false;
        const pt = point(city.coordinates);
        try {
          return booleanPointInPolygon(pt, sub.geometry as any);
        } catch {
          return false;
        }
      });
      return !hasCity;
    });

    const fc = featureCollection(
      emptySubs.map((sub) => ({
        type: "Feature" as const,
        geometry: sub.geometry as any,
        properties: { id: sub.id, name: sub.name },
      }))
    );

    setEmptyRegionsFeatures(fc);
  }, [showGaps, features]);

  const createCentroidCities = useCallback(async () => {
    if (!countryId || !features?.subdivisions) return;
    const subdivisions = features.subdivisions;
    const cities = features.cities ?? [];

    const emptySubs = subdivisions.filter((sub) => {
      if (!sub.geometry) return false;
      const hasCity = cities.some((city) => {
        if (!city.coordinates) return false;
        const pt = point(city.coordinates);
        try {
          return booleanPointInPolygon(pt, sub.geometry as any);
        } catch {
          return false;
        }
      });
      return !hasCity;
    });

    for (const sub of emptySubs) {
      try {
        const feat = { type: "Feature" as const, geometry: sub.geometry as any, properties: {} };
        const center = centroid(feat);
        if (center?.geometry?.coordinates) {
          const coords = center.geometry.coordinates as [number, number];
          await createCity.mutateAsync({
            countryId,
            name: `City of ${sub.name}`,
            type: "city",
            coordinates: coords,
            subdivisionId: sub.id,
            population: 1000,
          });
        }
      } catch (err) {
        console.error(`Failed to create centroid city for ${sub.name}:`, err);
      }
    }

    setShowEmptyRegions(false);
    invalidateAllMapData();
    debouncedRefetch();
  }, [countryId, features, createCity, invalidateAllMapData, debouncedRefetch]);

  // ── City Merging & Splitting ──
  const mergeSelectedCities = useCallback(async () => {
    if (!countryId || selectedIds.size < 2) return;

    const citiesToMerge = allFeatures.filter(
      (f) => selectedIds.has(f.id) && f.type === "city" && f.coordinates
    );

    if (citiesToMerge.length < 2) return;

    const baseCity = citiesToMerge[0]!;

    let totalPopulation = Number(baseCity.properties.population) || 0;
    for (let i = 1; i < citiesToMerge.length; i++) {
      totalPopulation += Number(citiesToMerge[i]!.properties.population) || 0;
    }

    await updateCity.mutateAsync({
      countryId,
      id: baseCity.id,
      name: baseCity.name,
      type: baseCity.properties.cityType as string,
      coordinates: baseCity.coordinates!,
      population: totalPopulation,
      isNationalCapital: !!baseCity.properties.isNationalCapital,
      isSubdivisionCapital: !!baseCity.properties.isSubdivisionCapital,
      subdivisionId: baseCity.properties.subdivisionId as string | undefined,
    });

    for (let i = 1; i < citiesToMerge.length; i++) {
      await deleteCity.mutateAsync({
        countryId,
        cityId: citiesToMerge[i]!.id,
      });
    }

    clearMultiSelect();
    invalidateAllMapData();
    debouncedRefetch();
  }, [
    countryId,
    selectedIds,
    allFeatures,
    updateCity,
    deleteCity,
    clearMultiSelect,
    invalidateAllMapData,
    debouncedRefetch,
  ]);

  const splitCity = useCallback(
    async (cityId: string) => {
      if (!countryId) return;
      const city = allFeatures.find((f) => f.id === cityId && f.type === "city");
      if (!city || !city.coordinates) return;

      const name = city.name;
      const [lng, lat] = city.coordinates;
      const totalPop = Number(city.properties.population) || 0;
      const halvedPop = Math.round(totalPop / 2);

      await updateCity.mutateAsync({
        countryId,
        id: city.id,
        name: `${name} A`,
        type: city.properties.cityType as string,
        coordinates: [lng, lat],
        population: halvedPop,
        isNationalCapital: !!city.properties.isNationalCapital,
        isSubdivisionCapital: !!city.properties.isSubdivisionCapital,
        subdivisionId: city.properties.subdivisionId as string | undefined,
      });

      const newCityResult = await createCity.mutateAsync({
        countryId,
        name: `${name} B`,
        type: city.properties.cityType as string,
        coordinates: [lng + 0.02, lat + 0.02],
        population: halvedPop,
        subdivisionId: city.properties.subdivisionId as string | undefined,
      });

      invalidateAllMapData();
      await refetchFeatures();

      if (newCityResult?.id) {
        const newCityFeature: EditorFeature = {
          id: newCityResult.id,
          type: "city",
          name: `${name} B`,
          coordinates: [lng + 0.02, lat + 0.02],
          properties: {
            cityType: city.properties.cityType,
            population: halvedPop,
            subdivisionId: city.properties.subdivisionId,
          },
        };
        startEditing(newCityFeature);
      }
    },
    [
      countryId,
      allFeatures,
      updateCity,
      createCity,
      refetchFeatures,
      startEditing,
      invalidateAllMapData,
    ]
  );

  // ── Population Scaling & Orbit Rotation ──
  const scaleSelectedCitiesPopulation = useCallback(
    async (factor: number) => {
      if (!countryId || selectedIds.size === 0) return;

      const citiesToScale = allFeatures.filter((f) => selectedIds.has(f.id) && f.type === "city");

      for (const city of citiesToScale) {
        const currentPop = Number(city.properties.population) || 0;
        const newPop = Math.round(currentPop * factor);

        await updateCity.mutateAsync({
          countryId,
          id: city.id,
          name: city.name,
          type: city.properties.cityType as string,
          coordinates: city.coordinates!,
          population: newPop,
          isNationalCapital: !!city.properties.isNationalCapital,
          isSubdivisionCapital: !!city.properties.isSubdivisionCapital,
          subdivisionId: city.properties.subdivisionId as string | undefined,
        });
      }

      invalidateAllMapData();
      debouncedRefetch();
    },
    [countryId, selectedIds, allFeatures, updateCity, invalidateAllMapData, debouncedRefetch]
  );

  const rotateSelectedCities = useCallback(
    async (angle: number) => {
      if (!countryId || selectedIds.size < 2) return;

      const citiesToRotate = allFeatures.filter(
        (f) => selectedIds.has(f.id) && f.type === "city" && f.coordinates
      );

      if (citiesToRotate.length < 2) return;

      const pts = featureCollection(citiesToRotate.map((c) => point(c.coordinates!)));
      const collectiveCentroid = centroid(pts);
      if (!collectiveCentroid?.geometry?.coordinates) return;

      for (const city of citiesToRotate) {
        const pt = point(city.coordinates!);
        try {
          const rotated = transformRotate(pt, angle, { pivot: collectiveCentroid });
          if (rotated?.geometry?.coordinates) {
            const newCoords = rotated.geometry.coordinates as [number, number];
            await updateCity.mutateAsync({
              countryId,
              id: city.id,
              name: city.name,
              type: city.properties.cityType as string,
              coordinates: newCoords,
              population: Number(city.properties.population) || undefined,
              isNationalCapital: !!city.properties.isNationalCapital,
              isSubdivisionCapital: !!city.properties.isSubdivisionCapital,
              subdivisionId: city.properties.subdivisionId as string | undefined,
            });
          }
        } catch (err) {
          console.error(`Failed to rotate city ${city.name}:`, err);
        }
      }

      invalidateAllMapData();
      debouncedRefetch();
    },
    [countryId, selectedIds, allFeatures, updateCity, invalidateAllMapData, debouncedRefetch]
  );

  const addRulerPoint = useCallback((coords: [number, number]) => {
    setRulerPoints((prev) => [...prev, coords]);
  }, []);

  const clearRuler = useCallback(() => {
    setRulerPoints([]);
  }, []);

  const applyLassoSelection = useCallback(
    (polygonCoords: [number, number][]) => {
      if (polygonCoords.length < 3) return;
      const closedCoords = [...polygonCoords];
      if (
        closedCoords[0][0] !== closedCoords[closedCoords.length - 1][0] ||
        closedCoords[0][1] !== closedCoords[closedCoords.length - 1][1]
      ) {
        closedCoords.push(closedCoords[0]);
      }

      const lassoPoly = {
        type: "Feature" as const,
        geometry: {
          type: "Polygon" as const,
          coordinates: [closedCoords],
        },
        properties: {},
      };

      const newSelectedIds = new Set<string>();
      for (const feature of allFeatures) {
        if (feature.coordinates) {
          const pt = point(feature.coordinates);
          if (booleanPointInPolygon(pt, lassoPoly)) {
            newSelectedIds.add(feature.id);
          }
        }
      }
      setSelectedIds(newSelectedIds);
    },
    [allFeatures]
  );

  const applyPaintFill = useCallback(
    async (subdivisionId: string) => {
      if (!countryId) return;
      const sub = allFeatures.find((f) => f.id === subdivisionId && f.type === "subdivision");
      if (!sub) return;

      // Optimistically update local cache
      const prevData = utils.geoCore.getCountryFeatures.getData({ countryId });
      if (prevData && prevData.subdivisions) {
        const newData = { ...prevData };
        newData.subdivisions = newData.subdivisions.map((item) =>
          item.id === subdivisionId
            ? {
                ...item,
                color: subdivisionForm.color || item.color,
                type: subdivisionForm.type || item.type,
                level: subdivisionForm.level || item.level,
              }
            : item
        );
        utils.geoCore.getCountryFeatures.setData({ countryId }, newData);
      }

      await updateSubdivision.mutateAsync({
        countryId,
        id: subdivisionId,
        name: sub.name,
        type: subdivisionForm.type,
        level: subdivisionForm.level,
        color: subdivisionForm.color,
        population: Number(sub.properties.population) || undefined,
        areaSqKm: Number(sub.properties.areaSqKm) || undefined,
      });

      invalidateAllMapData();
      debouncedRefetch();
    },
    [
      countryId,
      allFeatures,
      subdivisionForm,
      updateSubdivision,
      utils,
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
    updateSubdivisionGeom.isPending ||
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
    createRiver.isPending ||
    updateRiver.isPending ||
    deleteRiver.isPending ||
    createLake.isPending ||
    updateLake.isPending ||
    deleteLake.isPending ||
    createRoute.isPending;

  const mutationError =
    createCity.error ||
    updateCity.error ||
    deleteCity.error ||
    createSubdivision.error ||
    updateSubdivision.error ||
    updateSubdivisionGeom.error ||
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
    createPeak.error ||
    updatePeak.error ||
    deletePeak.error ||
    createRiver.error ||
    updateRiver.error ||
    deleteRiver.error ||
    createLake.error ||
    updateLake.error ||
    deleteLake.error ||
    createRoute.error;

  return {
    // State
    mode,
    setMode,
    selectedFeature,
    setSelectedFeature,
    pendingCoordinates,
    pendingGeometry,
    isPickingLocation,
    setIsPickingLocation,

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
    peakForm,
    setPeakForm,
    riverForm,
    setRiverForm,
    lakeForm,
    setLakeForm,

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
    isSnapEnabled,
    setIsSnapEnabled,
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
    duplicateFeature,

    // Gaps / Negative Space
    showGaps,
    setShowGaps,
    gapFeatures,
    recalculateGaps,
    createSubdivisionFromGap,

    // City operations
    scatterCities,
    snapCityToSubdivisionBorder,
    snapCityToCoastline,
    mergeSelectedCities,
    splitCity,
    scaleSelectedCitiesPopulation,
    rotateSelectedCities,

    // Empty regions
    emptyRegionsFeatures,
    createCentroidCities,

    // Subdivision geometry split/merge/transforms
    executeSplitSubdivision,
    mergeSelectedSubdivisions,
    applyGeometryTransformation,

    // Ruler & Lasso Selection
    rulerPoints,
    setRulerPoints,
    lassoGeometry,
    setLassoGeometry,
    addRulerPoint,
    clearRuler,
    applyLassoSelection,
    applyPaintFill,

    // Eyedropper, Magic Wand & History Jump
    presetStyle,
    setPresetStyle,
    guides,
    setGuides,
    jumpToHistoryPosition,

    // Magic Wand / Eyedropper configs & callbacks
    wandMatchColor,
    setWandMatchColor,
    wandMatchLevel,
    setWandMatchLevel,
    wandMatchParent,
    setWandMatchParent,
    applyEyedropper,
    applyMagicWand,
    pathfinderOperation,
  };
}

function cleanPolygonGeometry(geometry: any): any {
  if (!geometry || typeof geometry !== "object") return null;
  const type = geometry.type;
  if (type === "Polygon") {
    const rings = geometry.coordinates;
    if (!Array.isArray(rings)) return null;
    const validRings = rings.filter((ring: any) => Array.isArray(ring) && ring.length >= 4);
    if (validRings.length === 0) return null;
    return {
      type: "Polygon" as const,
      coordinates: validRings,
    };
  }
  if (type === "MultiPolygon") {
    const polygons = geometry.coordinates;
    if (!Array.isArray(polygons)) return null;
    const validPolygons = polygons
      .map((rings: any) => {
        if (!Array.isArray(rings)) return [];
        return rings.filter((ring: any) => Array.isArray(ring) && ring.length >= 4);
      })
      .filter((rings: any) => rings.length > 0);
    if (validPolygons.length === 0) return null;
    return {
      type: "MultiPolygon" as const,
      coordinates: validPolygons,
    };
  }
  return geometry;
}

function computeGaps(countryGeometry: any, subdivisions: any[]) {
  if (!countryGeometry) return null;

  const cleanedCountryGeom = cleanPolygonGeometry(countryGeometry);
  if (!cleanedCountryGeom) return null;

  const countryFeature = {
    type: "Feature" as const,
    geometry: cleanedCountryGeom,
    properties: {},
  };

  const validSubdivisions = subdivisions
    .filter((sub) => sub.geometry)
    .map((sub) => ({
      ...sub,
      geometry: cleanPolygonGeometry(sub.geometry),
    }))
    .filter((sub) => sub.geometry !== null);

  if (validSubdivisions.length === 0) {
    return featureCollection([countryFeature]);
  }

  // Union all subdivisions sequentially
  let unionFeature: any = null;

  for (const sub of validSubdivisions) {
    const subFeature = {
      type: "Feature" as const,
      geometry: sub.geometry!,
      properties: {},
    };
    if (!unionFeature) {
      unionFeature = subFeature;
    } else {
      try {
        const merged = union(featureCollection([unionFeature, subFeature]));
        if (merged) {
          const cleanedMerged = cleanPolygonGeometry(merged.geometry);
          if (cleanedMerged) {
            unionFeature = {
              ...merged,
              geometry: cleanedMerged,
            };
          }
        }
      } catch (err) {
        console.warn("Error unioning subdivision geometry:", err);
      }
    }
  }

  if (!unionFeature) {
    return featureCollection([countryFeature]);
  }

  // Simplify unionFeature and countryFeature slightly to avoid heavy calculations
  let simplifiedCountry = countryFeature;
  let simplifiedUnion = unionFeature;

  try {
    const simplified = simplify(countryFeature, { tolerance: 0.0001, highQuality: false });
    const cleaned = cleanPolygonGeometry(simplified?.geometry);
    if (cleaned) {
      simplifiedCountry = { ...simplified, geometry: cleaned };
    }
  } catch (err) {
    console.warn("Failed to simplify country geometry:", err);
  }

  try {
    const simplified = simplify(unionFeature, { tolerance: 0.0001, highQuality: false });
    const cleaned = cleanPolygonGeometry(simplified?.geometry);
    if (cleaned) {
      simplifiedUnion = { ...simplified, geometry: cleaned };
    }
  } catch (err) {
    console.warn("Failed to simplify union geometry:", err);
  }

  // Now subtract unionFeature from countryFeature
  try {
    const gap = difference(featureCollection([simplifiedCountry, simplifiedUnion]));
    if (gap) {
      const cleanedGapGeom = cleanPolygonGeometry(gap.geometry);
      if (!cleanedGapGeom) return null;

      const cleanedGap = {
        ...gap,
        geometry: cleanedGapGeom,
      };

      // If gap is a MultiPolygon, split it into individual polygon features so right-click is easier to hit-test
      if (cleanedGap.geometry.type === "MultiPolygon") {
        const polys = cleanedGap.geometry.coordinates.map((coords: any) => ({
          type: "Feature" as const,
          geometry: {
            type: "Polygon" as const,
            coordinates: coords,
          },
          properties: {},
        }));
        return featureCollection(polys);
      }
      return featureCollection([cleanedGap]);
    }
  } catch (err) {
    console.warn("Error calculating difference gaps:", err);
  }

  return null;
}

function getNearestPointOnGeometryBoundary(pt: [number, number], geometry: any): [number, number] {
  if (!geometry) return pt;
  let minDistance = Infinity;
  let nearestPoint: [number, number] = pt;

  const checkRing = (ring: [number, number][]) => {
    for (let i = 0; i < ring.length; i++) {
      const coord = ring[i]!;
      // Simple Euclidean distance is fine for small distances
      const dist = Math.hypot(coord[0] - pt[0], coord[1] - pt[1]);
      if (dist < minDistance) {
        minDistance = dist;
        nearestPoint = coord;
      }
    }
  };

  if (geometry.type === "Polygon") {
    for (const ring of geometry.coordinates) {
      checkRing(ring);
    }
  } else if (geometry.type === "MultiPolygon") {
    for (const poly of geometry.coordinates) {
      for (const ring of poly) {
        checkRing(ring);
      }
    }
  }

  return nearestPoint;
}

function splitPolygonByLine(polygon: any, lineCoords: [number, number][]) {
  if (lineCoords.length < 2) return null;
  const lineFeature = {
    type: "Feature" as const,
    geometry: {
      type: "LineString" as const,
      coordinates: lineCoords,
    },
    properties: {},
  };

  // Buffer the line by 5 meters (0.005 kilometers)
  const lineBuffered = buffer(lineFeature, 0.005, { units: "kilometers" });
  if (!lineBuffered) return null;

  const polyFeature = {
    type: "Feature" as const,
    geometry: polygon,
    properties: {},
  };

  try {
    const diff = difference(featureCollection([polyFeature, lineBuffered]));
    if (!diff) return null;

    // Extract polygons
    const pieces: any[] = [];
    if (diff.geometry.type === "Polygon") {
      pieces.push(diff.geometry);
    } else if (diff.geometry.type === "MultiPolygon") {
      for (const coords of diff.geometry.coordinates) {
        const pieceGeom = { type: "Polygon" as const, coordinates: coords };
        const a = area(pieceGeom);
        if (a > 100) {
          // more than 100 square meters
          pieces.push(pieceGeom);
        }
      }
    }
    return pieces;
  } catch (err) {
    console.error("Error splitting polygon:", err);
    return null;
  }
}
