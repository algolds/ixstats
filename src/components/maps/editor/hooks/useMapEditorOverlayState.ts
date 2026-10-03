"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useMapEditor } from "~/hooks/useMapEditor";
import { useMapData } from "~/hooks/useMapData";
import { useMapLiveSync } from "~/hooks/useMapLiveSync";
import { useProvinceImporter } from "~/hooks/useProvinceImporter";
import { useBorderEditor } from "~/hooks/useBorderEditor";
import { api } from "~/trpc/react";
import type { SelectedCountry } from "~/components/maps/core/IxWorldMap";
import { useMapRealm } from "~/components/maps/core/MapRealmContext";
import type { EditorMapRef } from "~/components/maps/editor/EditorMap";
import type { EditorMode } from "~/hooks/map-editor/editor-types";
import { useEditorDraft } from "./useEditorDraft";
import { useEditorKeyboardShortcuts } from "./useEditorKeyboardShortcuts";
import {
  getDisabledTools,
  useAutoSelectLinkedFeature,
  useAutoShowRouteLayer,
  useEditorMapInstance,
  useIsEditorAdmin,
  useFeatureCounts,
  useUnsavedChanges,
  useEditorServerMutations,
  useEditRoute,
  useRequestDeleteSelection,
  useTransportRouteData,
  useWikiLinking,
} from "./useEditorOverlayServices";
import {
  useEditorLayoutState,
  useEditorToolState,
  useEditorSelectionState,
  useEditorGeoDataState,
  useEditorBorderOperations,
} from "./state";

interface UseMapEditorOverlayStateProps {
  countryId?: string;
  onExit: () => void;
  isWorldMode?: boolean;
  mapRef: React.RefObject<EditorMapRef | null>;
}

export function useMapEditorOverlayState({
  countryId,
  onExit,
  isWorldMode = false,
  mapRef,
}: UseMapEditorOverlayStateProps) {
  // Real-time sync: invalidate map caches when any geo mutation succeeds
  useMapLiveSync();

  const [activeCountryId, setActiveCountryId] = useState<string | null>(countryId || null);
  const [activeEditorMode, setActiveEditorMode] = useState<"view" | "border_edit">("view");
  const [mapSelectedCountry, setMapSelectedCountry] = useState<SelectedCountry | null>(null);

  const [borderState, borderActions] = useBorderEditor();
  const realm = useMapRealm();
  // Background layers (coastline, rivers, relief) — also feed snapping and the coast-snap tool.
  const {
    mapLayers: editorMapLayers,
    toggleLayer: rawToggleEditorLayer,
    visibleLayers: editorVisibleLayers,
  } = useMapData(
    ["background", "altitudes", "rivers", "lakes", "political", "country_labels"],
    undefined,
    realm
  );
  const scopedCountryId = !isWorldMode || activeCountryId ? activeCountryId : undefined;
  const editor = useMapEditor(scopedCountryId || undefined, {
    skipLinkageGate: isWorldMode,
    worldMapLayers: editorMapLayers,
  });
  const importer = useProvinceImporter(scopedCountryId ?? "__none__");

  const { data: neighborGeoms } = api.geoCore.getNeighborGeometries.useQuery(
    { featureId: borderState.featureId!, realm },
    { enabled: !!borderState.featureId }
  );

  const isLinked = !!editor.linkage?.isLinked;
  const linkageLoading = editor.linkageLoading;
  const hasGeometry = !!editor.countryGeo;
  // World editor is selection-first — tools are enabled for ANY selected shape (claimed or unclaimed).
  const toolsDisabled = isWorldMode ? !mapSelectedCountry : !isLinked || !hasGeometry;
  // True when a shape is selected but has no linked Country record
  const isUnclaimed = !!mapSelectedCountry && !mapSelectedCountry.countryId;

  const disabledTools = useMemo(
    () => getDisabledTools(isWorldMode, mapSelectedCountry, hasGeometry),
    [isWorldMode, mapSelectedCountry, hasGeometry]
  );

  // Sub-hooks for decomposed concerns
  const layout = useEditorLayoutState({
    isWorldMode,
    activeEditorMode,
    editorMode: editor.mode,
    mapSelectedCountry,
  });

  const tools = useEditorToolState();

  const transportRouteData = useTransportRouteData(activeCountryId, isWorldMode);

  const selection = useEditorSelectionState({
    editor,
    mapRef,
    expandPropertiesPanel: layout.expandPropertiesPanel,
    transportRouteData,
  });

  const geo = useEditorGeoDataState({
    isWorldMode,
    activeCountryId,
    setActiveCountryId,
    mapSelectedCountry,
    setMapSelectedCountry,
  });

  const borderOps = useEditorBorderOperations({
    borderActions,
    borderState,
    mapSelectedCountry,
    setActiveEditorMode,
    refetchValidation: geo.refetchValidation,
  });

  const [showExitConfirm, setShowExitConfirm] = useState(false);

  const isAdmin = useIsEditorAdmin();

  const { utils, generateTransport, recalculateGeo, simplifyAll } =
    useEditorServerMutations(editor);

  useAutoSelectLinkedFeature({
    isWorldMode,
    activeCountryId,
    mapSelectedCountry,
    featureList: geo.featureList,
    setMapSelectedCountry,
    mapRef,
  });

  // Set by EditorMap while a region reshape has moves that are not saved yet.
  const [vertexEditDirty, setVertexEditDirty] = useState(false);

  const hasUnsavedChanges = useUnsavedChanges({
    borderState,
    importer,
    editor,
    geo,
    mapSelectedCountry,
    vertexEditDirty,
  });

  // Unsaved placements/drawings survive a reload (offered back on next open).
  useEditorDraft(editor, activeCountryId, !!editor.countryGeo && !editor.featuresLoading);

  const handleRequestExit = useCallback(() => {
    if (hasUnsavedChanges) {
      setShowExitConfirm(true);
    } else {
      onExit();
    }
  }, [hasUnsavedChanges, onExit]);

  const handleMapSelect = useCallback((country: SelectedCountry | null) => {
    setMapSelectedCountry(country);
    setActiveCountryId(country?.countryId ?? null);
  }, []);

  const { handleLinkFeature, wikiScanner } = useWikiLinking(editor, activeCountryId);

  const { data: countryInfo } = api.countries.getByIdBasic.useQuery(
    { id: activeCountryId ?? "" },
    { enabled: !!activeCountryId, staleTime: 5 * 60_000 }
  );

  const [mapInstance, setMapInstance] = useEditorMapInstance(mapRef);

  const toggleEditorLayer = useCallback(
    (layer: string) => rawToggleEditorLayer(layer as Parameters<typeof rawToggleEditorLayer>[0]),
    [rawToggleEditorLayer]
  );
  const worldMapLayers = editorMapLayers;

  // Keep border editor trace mode in sync with the latest river/coast layer data
  const setTraceLayerSource = borderActions.setTraceLayerSource;
  useEffect(() => {
    setTraceLayerSource(
      worldMapLayers as Parameters<typeof borderActions.setTraceLayerSource>[0],
      editorVisibleLayers
    );
  }, [worldMapLayers, editorVisibleLayers, setTraceLayerSource]);

  const handleEditRoute = useEditRoute(transportRouteData, editor);

  useAutoShowRouteLayer(editor.mode, selection.selectedRouteId, tools.setLayerStates);

  const handleSubmit = useCallback(() => {
    const submitters: Partial<Record<EditorMode, () => void>> = {
      "add-city": editor.submitCity,
      "add-subdivision": editor.submitSubdivision,
      "add-poi": editor.submitPOI,
      "edit-city": editor.submitEditCity,
      "edit-subdivision": editor.submitEditSubdivision,
      "edit-poi": editor.submitEditPOI,
    };
    submitters[editor.mode]?.();
  }, [editor]);

  const requestDeleteSelection = useRequestDeleteSelection(editor, selection.handleDeleteFeature);

  const toggleAllPanels = useCallback(() => {
    layout.setPanelConfigs((prev) => {
      const collapse = !(prev.panelA.collapsed && prev.panelB.collapsed);
      return {
        panelA: { ...prev.panelA, collapsed: collapse },
        panelB: { ...prev.panelB, collapsed: collapse },
      };
    });
  }, [layout]);

  useEditorKeyboardShortcuts({
    editor,
    importer,
    handleSubmit,
    handleRequestExit,
    activeEditorMode,
    borderActions,
    handleExitBorderEdit: borderOps.handleExitBorderEdit,
    contextMenu: selection.contextMenu,
    setContextMenu: selection.setContextMenu,
    requestDeleteSelection,
    toggleAllPanels,
    setShowGrid: tools.setShowGrid,
    setShowShortcuts: tools.setShowShortcuts,
    showShortcuts: tools.showShortcuts,
    toolsDisabled,
    vertexEditDirty,
  });

  const featureCounts = useFeatureCounts(editor.allFeatures);

  return {
    ...geo,
    ...borderOps,
    ...layout,
    ...tools,
    ...selection,
    isWorldMode,
    activeCountryId,
    setActiveCountryId,
    activeEditorMode,
    setActiveEditorMode,
    mapSelectedCountry,
    setMapSelectedCountry,
    borderState,
    borderActions,
    editor,
    importer,
    neighborGeoms,
    isLinked,
    linkageLoading,
    hasGeometry,
    toolsDisabled,
    disabledTools,
    isUnclaimed,
    createCountryFromShapePending: geo.createCountryFromShapeMutation.isPending,
    isAdmin,
    generateTransport,
    recalculateGeo,
    utils,
    showExitConfirm,
    setShowExitConfirm,
    hasUnsavedChanges,
    handleRequestExit,
    showRightPanel: isWorldMode
      ? true
      : editor.mode !== "view" && editor.mode !== "import-provinces",
    selectedCountryName:
      countryInfo?.name ||
      editor.countryGeo?.country?.name ||
      editor.countryGeo?.displayName ||
      geo.selectedCountryName,
    handleMapSelect,
    simplifyAll,
    handleLinkFeature,
    wikiScanner,
    countryInfo,
    mapInstance,
    setMapInstance,
    worldMapLayers,
    editorVisibleLayers,
    toggleEditorLayer,
    transportRouteData,
    requestDeleteSelection,
    toggleAllPanels,
    vertexEditDirty,
    setVertexEditDirty,
    handleEditRoute,
    handleSubmit,
    featureCounts,
  };
}
