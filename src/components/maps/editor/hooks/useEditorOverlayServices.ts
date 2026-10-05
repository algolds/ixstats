"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Map as MapLibreInstance } from "maplibre-gl";
import type { FeatureCollection } from "geojson";
import { api } from "~/trpc/react";
import { useUser } from "~/context/auth-context";
import { isSystemOwner } from "~/lib/auth";
import { useHasRoleLevel } from "~/hooks/usePermissions";
import type { useMapEditor } from "~/hooks/useMapEditor";
import { useWikiScanner } from "~/hooks/useWikiScanner";
import { notifyFromStore } from "~/hooks/useNotify";
import { confirmEditorAction } from "~/components/maps/editor/components/EditorConfirmDialog";
import { routeVertices } from "~/components/maps/editor/utils/map-helpers";
import { transientMapStore } from "~/components/maps/editor/utils/transientStore";
import type { EditorMode } from "~/hooks/map-editor/editor-types";
import type { EditorMapRef } from "~/components/maps/editor/EditorMap";
import type { useBorderEditor } from "~/hooks/useBorderEditor";
import type { useProvinceImporter } from "~/hooks/useProvinceImporter";
import type { SelectedCountry } from "~/components/maps/core/IxWorldMap";
import type { useEditorGeoDataState, useEditorSelectionState, useEditorToolState } from "./state";

type Editor = ReturnType<typeof useMapEditor>;

const ROUTE_QUERY_OPTIONS = { staleTime: 60_000, gcTime: 5 * 60_000 } as const;

/** Country routes when a country is open, the world route set otherwise. */
export function useTransportRouteData(activeCountryId: string | null, isWorldMode: boolean) {
  const { data: countryRoutesData } = api.transport.getCountryRoutes.useQuery(
    { countryId: activeCountryId ?? "" },
    { enabled: !!activeCountryId, ...ROUTE_QUERY_OPTIONS }
  );
  const { data: worldRoutesData } = api.transport.getAllRoutesGeoJSON.useQuery(
    {},
    { enabled: isWorldMode || !activeCountryId, ...ROUTE_QUERY_OPTIONS }
  );
  return (
    (activeCountryId ? countryRoutesData : worldRoutesData) ??
    countryRoutesData ??
    worldRoutesData ??
    null
  );
}

type TransportRouteData = FeatureCollection | null | undefined;

export function useEditRoute(transportRouteData: TransportRouteData, editor: Editor) {
  return useCallback(
    (routeId: string) => {
      const geometry = transportRouteData?.features.find(
        (f) => String(f.properties?.id) === routeId
      )?.geometry;
      const vertices = routeVertices(geometry);
      if (vertices.length > 0) {
        editor.startRouteEdit(routeId, vertices);
      }
    },
    [transportRouteData, editor]
  );
}

export function useEditorServerMutations(editor: Editor) {
  const utils = api.useUtils();
  const onError = (err: { message: string }) => {
    editor.setMutationError?.(err.message);
  };

  const generateTransport = api.transport.generateRoutes.useMutation({
    onSuccess: () => {
      utils.transport.getCountryRoutes.invalidate();
    },
    onError,
  });

  const recalculateGeo = api.geoCore.recalculateGeoProfiles.useMutation({
    onSuccess: () => {
      editor.refetchFeatures();
      utils.geoCore.getMapBundle.invalidate();
      utils.resources.getCountryResources.invalidate();
    },
    onError,
  });

  // Success/failure toasts are raised by the caller (EditorHeader) with the result counts.
  const simplifyAll = api.geoFeatures.simplifySubdivisions.useMutation({
    onSuccess: () => {
      editor.refetchFeatures();
    },
  });

  return { utils, generateTransport, recalculateGeo, simplifyAll };
}

export function useWikiLinking(editor: Editor, activeCountryId: string | null) {
  const wikiLinkMutation = { onSuccess: () => editor.refetchFeatures() };
  const updateCityWiki = api.geoFeatures.updateCity.useMutation(wikiLinkMutation);
  const updatePOIWiki = api.geoFeatures.updatePOI.useMutation(wikiLinkMutation);
  const updateStoryPinWiki = api.geoFeatures.updateStoryPin.useMutation(wikiLinkMutation);
  const updateMapLabelWiki = api.geoFeatures.updateMapLabel.useMutation(wikiLinkMutation);

  const handleLinkFeature = useCallback(
    async (featureId: string, featureType: string, wikiPageTitle: string) => {
      const countryId = activeCountryId;
      if (!countryId) return;
      const linkers: Partial<Record<string, () => Promise<unknown>>> = {
        city: () => updateCityWiki.mutateAsync({ countryId, cityId: featureId, wikiPageTitle }),
        poi: () => updatePOIWiki.mutateAsync({ countryId, poiId: featureId, wikiPageTitle }),
        storyPin: () =>
          updateStoryPinWiki.mutateAsync({ countryId, pinId: featureId, wikiPageTitle }),
        mapLabel: () =>
          updateMapLabelWiki.mutateAsync({ countryId, labelId: featureId, wikiPageTitle }),
      };
      await linkers[featureType]?.();
    },
    [activeCountryId, updateCityWiki, updatePOIWiki, updateStoryPinWiki, updateMapLabelWiki]
  );

  const wikiScanner = useWikiScanner({
    features: editor.allFeatures,
    onLinkFeature: handleLinkFeature,
  });

  return { handleLinkFeature, wikiScanner };
}

/**
 * The MapLibre instance, picked up once the map ref is populated (retried once after 500ms).
 * Its zoom level is mirrored to the transient store so the status bar needs no editor re-render.
 */
export function useEditorMapInstance(mapRef: React.RefObject<EditorMapRef | null>) {
  const [mapInstance, setMapInstance] = useState<MapLibreInstance | null>(null);
  useEffect(() => {
    const m = mapRef.current?.getMap() ?? null;
    if (m) {
      setMapInstance(m);
      return;
    }
    const timer = setTimeout(() => {
      const m2 = mapRef.current?.getMap() ?? null;
      if (m2) setMapInstance(m2);
    }, 500);
    return () => clearTimeout(timer);
  }, [mapRef]);

  useEffect(() => {
    const map = mapInstance;
    if (!map) return;
    const onZoomEnd = () => transientMapStore.setZoom(map.getZoom());
    onZoomEnd();
    map.on("zoomend", onZoomEnd);
    return () => {
      map.off("zoomend", onZoomEnd);
    };
  }, [mapInstance]);

  return [mapInstance, setMapInstance] as const;
}

/**
 * Deletes the multi-selection (or the single selected feature) after a themed
 * confirmation. Shared by the Delete key, the tool options bar and the header.
 */
export function useRequestDeleteSelection(
  editor: Editor,
  handleDeleteFeature: ReturnType<typeof useEditorSelectionState>["handleDeleteFeature"]
) {
  return useCallback(async () => {
    const ids = editor.selectedIds;
    if (ids.size > 0) {
      const ok = await confirmEditorAction({
        title: `Delete ${ids.size} selected feature${ids.size === 1 ? "" : "s"}?`,
        description: "You can bring them back with Undo (Ctrl+Z) while the editor is open.",
        confirmLabel: "Delete",
        destructive: true,
      });
      if (!ok) return;
      const count = ids.size;
      const result = await editor.bulkDeleteSelected();
      if (result && result.failCount > 0) {
        notifyFromStore({
          title: `Deleted ${result.successCount} of ${count}`,
          message: `${result.failCount} could not be deleted`,
          type: "warning",
          priority: "medium",
        });
      }
      return;
    }
    if (editor.selectedFeature) {
      await handleDeleteFeature(editor.selectedFeature);
    }
  }, [editor, handleDeleteFeature]);
}

interface UnsavedChangesInput {
  borderState: ReturnType<typeof useBorderEditor>[0];
  importer: ReturnType<typeof useProvinceImporter>;
  editor: Editor;
  geo: ReturnType<typeof useEditorGeoDataState>;
  mapSelectedCountry: SelectedCountry | null;
  vertexEditDirty: boolean;
}

/**
 * True when leaving would lose work: an unsaved border edit or import, an
 * in-progress drawing/placement, an unsaved region reshape, a write still in
 * flight, or unsaved world-mode attribute edits. Merely having a tool active
 * does not count. Also arms the browser-level leave warning (tab close, reload,
 * external navigation).
 */
export function useUnsavedChanges({
  borderState,
  importer,
  editor,
  geo,
  mapSelectedCountry,
  vertexEditDirty,
}: UnsavedChangesInput) {
  const featureFormDirty = useMemo(() => {
    if (!mapSelectedCountry) return false;
    const dbPropsJson = geo.featureDetails?.properties
      ? JSON.stringify(geo.featureDetails.properties, null, 2)
      : "";
    return (
      geo.editableFeatureName !== (mapSelectedCountry.displayName || "") ||
      geo.editableCountryLinkageId !== (mapSelectedCountry.countryId || "") ||
      geo.wikiPageTitle !== (geo.featureDetails?.wikiPageTitle || "") ||
      (!!geo.propertiesJsonString && geo.propertiesJsonString !== dbPropsJson)
    );
  }, [
    mapSelectedCountry,
    geo.editableFeatureName,
    geo.editableCountryLinkageId,
    geo.wikiPageTitle,
    geo.propertiesJsonString,
    geo.featureDetails,
  ]);

  const hasUnsavedChanges =
    borderState.isDirty ||
    importer.step !== "upload" ||
    editor.isMutating ||
    vertexEditDirty ||
    !!editor.pendingCoordinates ||
    !!editor.pendingGeometry ||
    editor.routeWaypoints.length > 0 ||
    editor.riverPath.length > 0 ||
    editor.splitLine.length > 0 ||
    editor.mode === "edit-route" ||
    featureFormDirty;

  useEffect(() => {
    if (!hasUnsavedChanges) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      // Legacy browsers need a returnValue to show the prompt.
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [hasUnsavedChanges]);

  return hasUnsavedChanges;
}

const FEATURE_COUNT_KEY: Partial<
  Record<string, "regions" | "cities" | "pois" | "stories" | "labels">
> = {
  subdivision: "regions",
  city: "cities",
  poi: "pois",
  storyPin: "stories",
  mapLabel: "labels",
};

export function useFeatureCounts(allFeatures: Editor["allFeatures"]) {
  return useMemo(() => {
    const counts = { regions: 0, cities: 0, pois: 0, stories: 0, labels: 0 };
    for (const f of allFeatures) {
      const bucket = FEATURE_COUNT_KEY[f.type];
      if (bucket) counts[bucket]++;
    }
    return counts;
  }, [allFeatures]);
}

/** Reveals the route layer when route mode is entered or a route is selected. */
export function useAutoShowRouteLayer(
  mode: Editor["mode"],
  selectedRouteId: string | null,
  setLayerStates: ReturnType<typeof useEditorToolState>["setLayerStates"]
) {
  useEffect(() => {
    if (mode !== "add-route" && mode !== "edit-route" && !selectedRouteId) return;
    setLayerStates((prev) => {
      if (prev.routes?.visible) return prev;
      return {
        ...prev,
        routes: {
          ...prev.routes,
          visible: true,
          locked: false,
          opacity: prev.routes?.opacity ?? 1,
        },
      };
    });
  }, [mode, selectedRouteId, setLayerStates]);
}

export function getDisabledTools(
  isWorldMode: boolean,
  mapSelectedCountry: SelectedCountry | null,
  hasGeometry: boolean
): EditorMode[] {
  if (!isWorldMode) return [];
  if (!mapSelectedCountry) {
    return ["add-city", "add-subdivision", "add-poi", "add-route", "import-provinces"];
  }
  return hasGeometry ? [] : ["add-city", "add-poi", "add-route"];
}

interface AutoSelectInput {
  isWorldMode: boolean;
  activeCountryId: string | null;
  mapSelectedCountry: SelectedCountry | null;
  featureList: ReturnType<typeof useEditorGeoDataState>["featureList"];
  setMapSelectedCountry: (country: SelectedCountry) => void;
  mapRef: React.RefObject<EditorMapRef | null>;
}

/** World mode: selects (and flies to) the shape linked to the active country. */
export function useAutoSelectLinkedFeature({
  isWorldMode,
  activeCountryId,
  mapSelectedCountry,
  featureList,
  setMapSelectedCountry,
  mapRef,
}: AutoSelectInput) {
  useEffect(() => {
    if (!isWorldMode || !activeCountryId || mapSelectedCountry || !featureList) return;
    const linkedFeature = featureList.find((f) => f.countryId === activeCountryId);
    if (!linkedFeature) return;
    setMapSelectedCountry(linkedFeature);
    if (mapRef.current && (linkedFeature.centroidLng || linkedFeature.centroidLat)) {
      mapRef.current.flyTo(linkedFeature.centroidLng, linkedFeature.centroidLat, 5);
    }
  }, [
    isWorldMode,
    activeCountryId,
    mapSelectedCountry,
    featureList,
    mapRef,
    setMapSelectedCountry,
  ]);
}

/**
 * Admin-role users (level <= 10, as in the main navigation) and system owners get the
 * admin tools; the server still authorises every admin procedure itself.
 */
export function useIsEditorAdmin() {
  const user = useUser();
  const hasAdminRole = useHasRoleLevel(10);
  return isSystemOwner(user.user?.id ?? "") || hasAdminRole;
}
