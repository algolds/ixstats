import { useState, useRef, useEffect, useCallback } from "react";
import type { Map as MapLibreMap } from "maplibre-gl";
import type { Polygon, MultiPolygon } from "geojson";
import type { EditorMode, EditorFeature } from "~/hooks/useMapEditor";
import {
  getAllRings,
  getVertices,
  simplifyGeometry,
  sanitizeRegionShape,
} from "~/lib/maps/border-editor";
import { clipGeometryToBorder } from "~/lib/maps/province-importer/topology";
import { buildTopologyIndex, vkey } from "~/lib/maps/topology-engine";
import {
  getGeoJSONSource,
  calculateOverlapGeoJson,
  EMPTY_FC,
  collection,
  pointFeature,
  snapGeometryToBackgroundLayers,
} from "../utils/map-helpers";
import type { MapLayerData } from "~/components/maps/core/IxWorldMap";
import { withoutDisabledSnapLayers } from "~/lib/maps/editor-prefs";
import {
  buildMidpointFeatures,
  snapToCountryBorderRing,
  snapToNeighbors,
} from "./vertex-edit-geometry";
import {
  createVertexEditState,
  useVertexEditPointer,
  type VertexEditState,
} from "./useVertexEditPointer";

interface UseSubdivisionVertexEditProps {
  map: MapLibreMap | null;
  isLoaded: boolean;
  mode: EditorMode;
  selectedFeature: EditorFeature | null;
  features: EditorFeature[];
  countryGeometry: Polygon | MultiPolygon | null;
  /** Saves the edited region; `cascaded` lists neighbours whose shared vertices moved with it. */
  onGeometryUpdate?: (
    featureId: string,
    geometry: object,
    cascaded?: Array<{ id: string; geometry: object }>
  ) => void;
  /** Reports whether the region has unsaved vertex changes (drives the leave warning). */
  onDirtyChange?: (dirty: boolean) => void;
  worldMapLayers?: MapLayerData[];
  editorVisibleLayers?: Set<string>;
  snapEnabled?: boolean;
  snapTolerance?: number;
  snapPoint?: (coords: [number, number]) => [number, number];
}

type RegionGeometry = Polygon | MultiPolygon;

/** Subdivision layers that are filtered (or reset) while a region is being reshaped. */
const REGION_LAYERS = [
  "editor-subdivisions-fill",
  "editor-subdivisions-stroke",
  "editor-subdivisions-labels",
  "editor-subdivisions-hover",
];

const clipToBorder = (geometry: RegionGeometry, border: RegionGeometry) =>
  clipGeometryToBorder(geometry, border).geometry;

/**
 * The regions that share a vertex with the one being edited, at the shapes the cascade left them in.
 * These are the only regions a reshape can newly overlap, so the overlap check looks at no others.
 */
function adjacentRegions(st: VertexEditState, features: EditorFeature[]): EditorFeature[] {
  const { edit, topology } = st;
  if (!edit || !topology) return [];

  const ids = new Set<string>();
  for (const ring of getAllRings(edit.currentGeometry)) {
    for (const vertex of ring) {
      for (const ref of topology.get(vkey(vertex)) ?? []) ids.add(ref.featureId);
    }
  }
  return features.flatMap((f) => {
    const geometry = ids.has(f.id) ? st.neighbors.get(f.id) : undefined;
    // A plain copy: the cascade's clones keep the `_bbox` the saved shape had cached
    return geometry
      ? [{ ...f, geometry: { type: geometry.type, coordinates: geometry.coordinates } }]
      : [];
  });
}

/** Cascade visuals are written to the subdivisions source at most once per frame. */
function useCascadeVisuals(map: MapLibreMap | null) {
  const pendingRef = useRef<Map<string, RegionGeometry>>(new Map());
  const frameRef = useRef<number | null>(null);

  const flush = useCallback(() => {
    frameRef.current = null;
    const pending = pendingRef.current;
    if (pending.size === 0) return;
    // Region ids are the source's feature ids (promoteId), so each neighbour moves on its own.
    void getGeoJSONSource(map, "editor-subdivisions")?.updateData({
      update: [...pending].map(([id, newGeometry]) => ({ id, newGeometry })),
    });
    pending.clear();
  }, [map]);

  const queueCascadeVisual = useCallback(
    (featureId: string, geometry: RegionGeometry) => {
      pendingRef.current.set(featureId, geometry);
      frameRef.current ??= requestAnimationFrame(flush);
    },
    [flush]
  );

  const cancelCascadeFrame = useCallback(() => {
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
  }, []);

  return { queueCascadeVisual, cancelCascadeFrame };
}

export function useSubdivisionVertexEdit(props: UseSubdivisionVertexEditProps) {
  const { map, isLoaded, mode, selectedFeature } = props;
  const [isVertexEditing, setIsVertexEditing] = useState(false);
  const st = useRef(createVertexEditState()).current;

  // Latest props for the stable event callbacks.
  const latest = useRef(props);
  // oxlint-disable-next-line
  latest.current = props;

  const lastUpdateRef = useRef(0);

  // Unsaved-change tracking: any visual update after entry marks the edit dirty.
  const dirtyRef = useRef(false);
  const suppressDirtyRef = useRef(false);
  const markDirty = useCallback((dirty: boolean) => {
    if (dirtyRef.current === dirty) return;
    dirtyRef.current = dirty;
    latest.current.onDirtyChange?.(dirty);
  }, []);

  const { queueCascadeVisual, cancelCascadeFrame } = useCascadeVisuals(map);

  const changedNeighborsPayload = useCallback(
    () =>
      [...st.changedNeighborIds].flatMap((id) => {
        const geometry = st.neighbors.get(id);
        return geometry ? [{ id, geometry }] : [];
      }),
    [st]
  );

  const updateMidpoints = useCallback(() => {
    if (!map || !st.edit) return;
    getGeoJSONSource(map, "editor-vedit-midpoints")?.setData(
      collection(buildMidpointFeatures(st.edit.currentGeometry))
    );
  }, [map, st]);

  const updateVertexEditVis = useCallback(
    (fastOnly = false) => {
      if (!map || !st.edit) return;
      if (!suppressDirtyRef.current) markDirty(true);

      const { featureId, currentGeometry: geo } = st.edit;
      const setSource = (id: string, features: Parameters<typeof collection>[0]) =>
        getGeoJSONSource(map, id)?.setData(collection(features));

      setSource("editor-vedit-polygon", [{ type: "Feature", geometry: geo, properties: {} }]);
      setSource(
        "editor-vedit-vertices",
        getVertices(geo).map((v) =>
          pointFeature(v.coord, { ringIndex: v.ringIndex, vertexIndex: v.vertexIndex })
        )
      );
      if (fastOnly) return;

      // Drag frames stop above; their midpoints follow on a throttle, the overlap check on mouse-up.
      updateMidpoints();
      getGeoJSONSource(map, "editor-overlap-highlight")?.setData(
        calculateOverlapGeoJson(geo, adjacentRegions(st, latest.current.features), featureId)
      );
    },
    [map, st, markDirty, updateMidpoints]
  );

  /** Add-vertex handles follow a drag at most every 100 ms; the overlap check waits for the drop. */
  const scheduleThrottledUpdate = useCallback(() => {
    if (st.throttleTimer) clearTimeout(st.throttleTimer);
    const sinceLast = Date.now() - lastUpdateRef.current;
    if (sinceLast >= 100) {
      updateMidpoints();
      lastUpdateRef.current = Date.now();
    } else {
      st.throttleTimer = setTimeout(() => {
        updateMidpoints();
        lastUpdateRef.current = Date.now();
      }, 100 - sinceLast);
    }
  }, [st, updateMidpoints]);

  useEffect(() => {
    return () => {
      if (st.throttleTimer) clearTimeout(st.throttleTimer);
      cancelCascadeFrame();
    };
  }, [st, cancelCascadeFrame]);

  const clearVertexEditVis = useCallback(() => {
    if (!map) return;
    for (const id of ["polygon", "vertices", "midpoints"]) {
      getGeoJSONSource(map, `editor-vedit-${id}`)?.setData(EMPTY_FC);
    }
    getGeoJSONSource(map, "editor-overlap-highlight")?.setData(EMPTY_FC);
  }, [map]);

  const setRegionLayerFilter = useCallback(
    (hiddenFeatureId: string | null) => {
      if (!map) return;
      const filter: Parameters<MapLibreMap["setFilter"]>[1] = hiddenFeatureId
        ? ["!=", ["get", "id"], hiddenFeatureId]
        : null;
      for (const layerId of REGION_LAYERS) {
        if (map.getLayer(layerId)) map.setFilter(layerId, filter);
      }
    },
    [map]
  );

  /** Leaves vertex editing without saving. */
  const endSession = useCallback(() => {
    st.edit = null;
    st.topology = null;
    st.changedNeighborIds = new Set();
    markDirty(false);
    setIsVertexEditing(false);
    clearVertexEditVis();
    setRegionLayerFilter(null);
  }, [st, markDirty, clearVertexEditVis, setRegionLayerFilter]);

  /** Hands the region (plus the neighbours the cascade actually moved) to the saver. */
  const saveEdit = useCallback(
    (featureId: string, geometry: RegionGeometry) => {
      latest.current.onGeometryUpdate?.(featureId, geometry, changedNeighborsPayload());
      st.changedNeighborIds = new Set();
      markDirty(false);
    },
    [st, changedNeighborsPayload, markDirty]
  );

  /** "Done": saves only when something changed, then leaves vertex editing. */
  const finishVertexEdit = useCallback(() => {
    if (st.edit && dirtyRef.current && latest.current.onGeometryUpdate) {
      const border = latest.current.countryGeometry;
      const geometry = border
        ? clipToBorder(st.edit.currentGeometry, border)
        : st.edit.currentGeometry;
      latest.current.onGeometryUpdate(st.edit.featureId, geometry, changedNeighborsPayload());
    }
    endSession();
  }, [st, changedNeighborsPayload, endSession]);

  const handleSimplifyAndSave = useCallback(() => {
    const {
      countryGeometry: border,
      worldMapLayers,
      editorVisibleLayers,
      features,
    } = latest.current;
    if (!st.edit || !border) return;

    let geo = sanitizeRegionShape(
      simplifyGeometry(st.edit.currentGeometry, 0.002),
      border
    ).geometry;
    if (worldMapLayers && editorVisibleLayers) {
      geo = snapGeometryToBackgroundLayers(
        geo,
        worldMapLayers,
        withoutDisabledSnapLayers(editorVisibleLayers),
        0.015
      );
    }
    geo = snapToNeighbors(clipToBorder(geo, border), features, st.edit.featureId, border);
    st.edit.currentGeometry = snapToCountryBorderRing(geo, border);
    updateVertexEditVis();

    if (latest.current.onGeometryUpdate) saveEdit(st.edit.featureId, st.edit.currentGeometry);
  }, [st, updateVertexEditVis, saveEdit]);

  /** "Save": writes the region plus only the neighbours the cascade actually moved. */
  const handleSave = useCallback(() => {
    if (!st.edit || !latest.current.onGeometryUpdate) return;
    const { countryGeometry: border, features } = latest.current;
    let geometry = st.edit.currentGeometry;
    if (border) {
      geometry = snapToNeighbors(
        clipToBorder(geometry, border),
        features,
        st.edit.featureId,
        border
      );
      st.edit.currentGeometry = geometry;
      suppressDirtyRef.current = true;
      updateVertexEditVis();
      suppressDirtyRef.current = false;
    }
    saveEdit(st.edit.featureId, geometry);
  }, [st, updateVertexEditVis, saveEdit]);

  const cancelVertexEdit = useCallback(() => {
    // Put cascaded neighbours back to their saved shapes.
    for (const id of st.changedNeighborIds) {
      const original = latest.current.features.find((f) => f.id === id)?.geometry;
      if (original) queueCascadeVisual(id, original as RegionGeometry);
    }
    st.neighbors = new Map();
    endSession();
  }, [st, queueCascadeVisual, endSession]);

  // Enter/exit vertex editing as the tool and selection change.
  useEffect(() => {
    if (!map || !isLoaded) return;
    if (mode !== "edit-subdivision" || !selectedFeature?.geometry) {
      if (st.edit) cancelVertexEdit();
      return;
    }

    let geo = structuredClone(selectedFeature.geometry) as RegionGeometry;
    const border = latest.current.countryGeometry;
    if (border) {
      const { geometry: clipped, wasClipped } = clipGeometryToBorder(geo, border);
      if (wasClipped) geo = clipped;
      geo = snapToCountryBorderRing(geo, border);
    }
    st.edit = { featureId: selectedFeature.id, currentGeometry: geo };

    // Topology index over every subdivision, for cascade editing of shared vertices.
    const subdivisions = latest.current.features.flatMap((f) =>
      f.type === "subdivision" && f.geometry
        ? [
            {
              id: f.id,
              geometry: (f.id === selectedFeature.id ? geo : f.geometry) as RegionGeometry,
            },
          ]
        : []
    );
    st.topology = buildTopologyIndex(subdivisions);
    st.neighbors = new Map(
      subdivisions
        .filter((f) => f.id !== selectedFeature.id)
        .map((f) => [f.id, structuredClone(f.geometry)] as const)
    );
    st.changedNeighborIds = new Set();

    // oxlint-disable-next-line
    setIsVertexEditing(true);
    suppressDirtyRef.current = true;
    updateVertexEditVis();
    suppressDirtyRef.current = false;
    markDirty(false);
    setRegionLayerFilter(selectedFeature.id);
  }, [
    map,
    isLoaded,
    mode,
    selectedFeature,
    st,
    updateVertexEditVis,
    cancelVertexEdit,
    markDirty,
    setRegionLayerFilter,
  ]);

  useVertexEditPointer({
    map,
    isLoaded,
    st,
    latest,
    updateVertexEditVis,
    scheduleThrottledUpdate,
    queueCascadeVisual,
  });

  return {
    isVertexEditing,
    handleSimplifyAndSave,
    handleSave,
    finishVertexEdit,
    cancelVertexEdit,
  };
}
