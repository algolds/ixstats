"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import type { Map as MapLibreInstance, MapLayerMouseEvent } from "maplibre-gl";
import { useUser } from "~/context/auth-context";
import { isSystemOwner } from "~/lib/auth";
import { useMapEditor } from "~/hooks/useMapEditor";
import { useMapData } from "~/hooks/useMapData";
import { useMapLiveSync } from "~/hooks/useMapLiveSync";
import { useProvinceImporter } from "~/hooks/useProvinceImporter";
import { useBorderEditor } from "~/hooks/useBorderEditor";
import { useWikiScanner } from "~/hooks/useWikiScanner";
import { api } from "~/trpc/react";
import type { SelectedCountry } from "~/components/maps/core/IxWorldMap";
import type { EditorMapRef } from "~/components/maps/editor/EditorMap";
import type { EditorMode } from "~/hooks/map-editor/editor-types";
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

  // --- Map Editor & Border Editor Hooks ---
  const [borderState, borderActions] = useBorderEditor();
  const editor = useMapEditor(
    !isWorldMode || activeCountryId ? activeCountryId || undefined : undefined,
    { skipLinkageGate: isWorldMode }
  );
  const importer = useProvinceImporter(
    (!isWorldMode || activeCountryId ? activeCountryId : undefined) ?? "__none__"
  );

  const { data: neighborGeoms } = api.geoCore.getNeighborGeometries.useQuery(
    { featureId: borderState.featureId! },
    { enabled: !!borderState.featureId }
  );

  // ── Derived State & Tools ──
  const isLinked = !!editor.linkage?.isLinked;
  const linkageLoading = editor.linkageLoading;
  const hasGeometry = !!editor.countryGeo;
  // World editor is selection-first — tools are enabled for ANY selected shape (claimed or unclaimed).
  const toolsDisabled = isWorldMode ? !mapSelectedCountry : !isLinked || !hasGeometry;
  // True when a shape is selected but has no linked Country record
  const isUnclaimed = !!mapSelectedCountry && !mapSelectedCountry.countryId;

  const disabledTools = useMemo<EditorMode[]>(() => {
    if (!isWorldMode) return [];
    if (!mapSelectedCountry) {
      return [
        "add-city",
        "add-subdivision",
        "add-poi",
        "add-route",
        "import-provinces",
      ];
    }
    if (!hasGeometry) {
      return ["add-city", "add-poi", "add-route"];
    }
    return [];
  }, [isWorldMode, mapSelectedCountry, hasGeometry]);

  // Sub-hooks for decomposed concerns
  const layout = useEditorLayoutState({
    isWorldMode,
    activeEditorMode,
    editorMode: editor.mode,
    mapSelectedCountry,
  });

  const tools = useEditorToolState();

  const { data: countryRoutesData } = api.transport.getCountryRoutes.useQuery(
    { countryId: activeCountryId ?? "" },
    { enabled: !!activeCountryId, staleTime: 60_000, gcTime: 5 * 60_000 }
  );

  const { data: worldRoutesData } = api.transport.getAllRoutesGeoJSON.useQuery(
    {},
    { enabled: isWorldMode || !activeCountryId, staleTime: 60_000, gcTime: 5 * 60_000 }
  );

  const transportRouteData =
    (activeCountryId ? countryRoutesData : worldRoutesData) ??
    countryRoutesData ??
    worldRoutesData ??
    null;

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

  const user = useUser();
  const isAdmin = isSystemOwner(user.user?.id ?? "");
  const utils = api.useUtils();

  const generateTransport = api.transport.generateRoutes.useMutation({
    onSuccess: () => {
      utils.transport.getCountryRoutes.invalidate();
    },
    onError: (err: { message: string }) => {
      editor.setMutationError?.(err.message);
    },
  });

  const recalculateGeo = api.geoCore.recalculateGeoProfiles.useMutation({
    onSuccess: () => {
      editor.refetchFeatures();
      utils.geoCore.getMapBundle.invalidate();
    },
    onError: (err: { message: string }) => {
      editor.setMutationError?.(err.message);
    },
  });

  // Auto-select map feature when activeCountryId changes
  useEffect(() => {
    if (!isWorldMode || !activeCountryId || mapSelectedCountry) return;
    if (!geo.featureList) return;

    const linkedFeature = geo.featureList.find((f) => f.countryId === activeCountryId);
    if (linkedFeature) {
      setMapSelectedCountry(linkedFeature);
      if (mapRef.current && (linkedFeature.centroidLng || linkedFeature.centroidLat)) {
        mapRef.current.flyTo(linkedFeature.centroidLng, linkedFeature.centroidLat, 5);
      }
    }
  }, [isWorldMode, activeCountryId, mapSelectedCountry, geo.featureList, mapRef]);

  const hasUnsavedChanges = useMemo(() => {
    if (borderState.isDirty) return true;
    if (importer.step !== "upload") return true;
    if (editor.mode !== "view") return true;

    if (mapSelectedCountry) {
      const dbFeatureName = mapSelectedCountry.displayName || "";
      const dbCountryId = mapSelectedCountry.countryId || "";
      const dbWikiTitle = geo.featureDetails?.wikiPageTitle || "";
      const dbPropsJson = geo.featureDetails?.properties
        ? JSON.stringify(geo.featureDetails.properties, null, 2)
        : "";

      if (geo.editableFeatureName !== dbFeatureName) return true;
      if (geo.editableCountryLinkageId !== dbCountryId) return true;
      if (geo.wikiPageTitle !== dbWikiTitle) return true;
      if (geo.propertiesJsonString && geo.propertiesJsonString !== dbPropsJson) return true;
    }
    return false;
  }, [
    borderState.isDirty,
    importer.step,
    editor.mode,
    mapSelectedCountry,
    geo.editableFeatureName,
    geo.editableCountryLinkageId,
    geo.wikiPageTitle,
    geo.propertiesJsonString,
    geo.featureDetails,
  ]);

  const handleRequestExit = useCallback(() => {
    if (hasUnsavedChanges) {
      setShowExitConfirm(true);
    } else {
      onExit();
    }
  }, [hasUnsavedChanges, onExit]);

  const handleMapSelect = useCallback((country: SelectedCountry | null) => {
    setMapSelectedCountry(country);
    if (country) {
      setActiveCountryId(country.countryId);
    } else {
      setActiveCountryId(null);
    }
  }, []);

  const simplifyAll = api.geoFeatures.simplifySubdivisions.useMutation({
    onSuccess: () => {
      editor.refetchFeatures();
      alert("All subdivisions simplified successfully.");
    },
  });

  const updateCityWiki = api.geoFeatures.updateCity.useMutation({
    onSuccess: () => editor.refetchFeatures(),
  });
  const updatePOIWiki = api.geoFeatures.updatePOI.useMutation({
    onSuccess: () => editor.refetchFeatures(),
  });
  const updateStoryPinWiki = api.geoFeatures.updateStoryPin.useMutation({
    onSuccess: () => editor.refetchFeatures(),
  });
  const updateMapLabelWiki = api.geoFeatures.updateMapLabel.useMutation({
    onSuccess: () => editor.refetchFeatures(),
  });

  const handleLinkFeature = useCallback(
    async (featureId: string, featureType: string, wikiTitle: string) => {
      const targetCountryId = activeCountryId;
      if (!targetCountryId) return;
      switch (featureType) {
        case "city":
          await updateCityWiki.mutateAsync({
            countryId: targetCountryId,
            cityId: featureId,
            wikiPageTitle: wikiTitle,
          });
          break;
        case "poi":
          await updatePOIWiki.mutateAsync({
            countryId: targetCountryId,
            poiId: featureId,
            wikiPageTitle: wikiTitle,
          });
          break;
        case "storyPin":
          await updateStoryPinWiki.mutateAsync({
            countryId: targetCountryId,
            pinId: featureId,
            wikiPageTitle: wikiTitle,
          });
          break;
        case "mapLabel":
          await updateMapLabelWiki.mutateAsync({
            countryId: targetCountryId,
            labelId: featureId,
            wikiPageTitle: wikiTitle,
          });
          break;
      }
    },
    [activeCountryId, updateCityWiki, updatePOIWiki, updateStoryPinWiki, updateMapLabelWiki]
  );

  const wikiScanner = useWikiScanner({
    features: editor.allFeatures,
    onLinkFeature: handleLinkFeature,
  });

  const { data: countryInfo } = api.countries.getByIdBasic.useQuery(
    { id: activeCountryId ?? "" },
    { enabled: !!activeCountryId, staleTime: 5 * 60_000 }
  );

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

  const {
    mapLayers: editorMapLayers,
    toggleLayer: rawToggleEditorLayer,
    visibleLayers: editorVisibleLayers,
  } = useMapData(["background", "altitudes", "rivers", "lakes", "political", "country_labels"]);
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

  const handleEditRoute = useCallback(
    (routeId: string) => {
      if (!transportRouteData?.features) return;
      const feature = transportRouteData.features.find(
        (f) => String(f.properties?.id) === routeId
      );
      if (!feature || !feature.geometry) return;
      let vertices: [number, number][] = [];
      if (feature.geometry.type === "LineString") {
        vertices = feature.geometry.coordinates as [number, number][];
      } else if (feature.geometry.type === "MultiLineString") {
        vertices = (feature.geometry.coordinates as [number, number][][]).flat();
      }
      if (vertices.length > 0) {
        editor.startRouteEdit(routeId, vertices);
      }
    },
    [transportRouteData, editor]
  );

  // Auto-enable route layer visibility when route mode is entered or route is selected
  useEffect(() => {
    if (editor.mode === "add-route" || editor.mode === "edit-route" || selection.selectedRouteId) {
      tools.setLayerStates((prev) => {
        if (prev.routes?.visible) return prev;
        return {
          ...prev,
          routes: { ...prev.routes, visible: true, locked: false, opacity: prev.routes?.opacity ?? 1 },
        };
      });
    }
  }, [editor.mode, selection.selectedRouteId, tools.setLayerStates]);

  const handleSubmit = useCallback(() => {
    switch (editor.mode) {
      case "add-city":
        editor.submitCity();
        break;
      case "add-subdivision":
        editor.submitSubdivision();
        break;
      case "add-poi":
        editor.submitPOI();
        break;
      case "edit-city":
        editor.submitEditCity();
        break;
      case "edit-subdivision":
        editor.submitEditSubdivision();
        break;
      case "edit-poi":
        editor.submitEditPOI();
        break;
    }
  }, [editor]);

  // Keyboard shortcuts and mouse mousemove listeners
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      const inInput =
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT" ||
        (e.target as HTMLElement)?.getAttribute("contenteditable") === "true";

      if (!inInput && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const key = e.key.toLowerCase();
        if (key === "v") {
          e.preventDefault();
          editor.setMode("view");
        } else if (key === "c" || key === "1") {
          e.preventDefault();
          editor.setMode("add-city");
        } else if (key === "r" || key === "2") {
          e.preventDefault();
          editor.setMode("add-subdivision");
        } else if (key === "p" || key === "3") {
          e.preventDefault();
          editor.setMode("add-poi");
        } else if (key === "t" || key === "4") {
          e.preventDefault();
          editor.setMode("add-route");
        }
      }

      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        editor.undo();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && e.shiftKey) {
        e.preventDefault();
        editor.redo();
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        if (editor.mode.startsWith("add-") || editor.mode.startsWith("edit-")) {
          handleSubmit();
        }
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key === "a" && !inInput) {
        e.preventDefault();
        editor.allFeatures.forEach((f) => {
          if (!editor.selectedIds.has(f.id)) {
            editor.toggleSelectId(f.id);
          }
        });
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key === "d" && !inInput) {
        e.preventDefault();
        editor.clearMultiSelect();
        return;
      }

      if (e.key === "Escape") {
        if (editor.mode === "import-provinces") {
          importer.reset();
          editor.setMode("view");
        } else if (editor.mode !== "view") {
          editor.resetForm();
        } else if (activeEditorMode === "border_edit") {
          borderOps.handleExitBorderEdit();
        } else {
          handleRequestExit();
        }
        return;
      }

      if ((e.key === "Delete" || e.key === "Backspace") && !inInput) {
        if (editor.selectedFeature && editor.mode === "view") {
          e.preventDefault();
          selection.handleDeleteFeature(editor.selectedFeature);
        }
        return;
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [
    editor,
    importer,
    handleSubmit,
    selection,
    handleRequestExit,
    activeEditorMode,
    borderOps.handleExitBorderEdit,
  ]);

  const selectionRef = useRef(selection);
  selectionRef.current = selection;

  const handleMapMouseMove = useCallback(
    (e: MapLayerMouseEvent) => {
      if (!mapInstance) return;

      if (activeEditorMode !== "view" || editor.mode !== "view") {
        if (selectionRef.current.hoveredFeature) {
          selectionRef.current.setHoveredFeature(null);
        }
        return;
      }

      const hits = mapInstance.queryRenderedFeatures(e.point, {
        layers: ["editor-subdivisions-fill"],
      });

      const currentSelection = selectionRef.current;
      if (hits.length > 0) {
        const hitId = hits[0]?.properties?.id as string | undefined;
        if (hitId && hitId !== currentSelection.hoveredFeature?.feature.id) {
          const match = editor.allFeatures.find((f) => f.id === hitId);
          if (match) {
            currentSelection.setHoveredFeature({ feature: match, screenPos: { x: e.point.x, y: e.point.y } });
          }
        }
      } else if (currentSelection.hoveredFeature) {
        currentSelection.setHoveredFeature(null);
      }
    },
    [mapInstance, editor.mode, editor.allFeatures, activeEditorMode]
  );

  useEffect(() => {
    const map = mapInstance;
    if (!map) return;
    map.on("mousemove", handleMapMouseMove);
    const onZoomEnd = () => tools.setCursorZoom(map.getZoom());
    map.on("zoomend", onZoomEnd);
    return () => {
      map.off("mousemove", handleMapMouseMove);
      map.off("zoomend", onZoomEnd);
    };
  }, [mapInstance, handleMapMouseMove, tools.setCursorZoom]);

  const featureCounts = useMemo(
    () => ({
      regions: editor.allFeatures.filter((f) => f.type === "subdivision").length,
      cities: editor.allFeatures.filter((f) => f.type === "city").length,
      pois: editor.allFeatures.filter((f) => f.type === "poi").length,
      stories: editor.allFeatures.filter((f) => f.type === "storyPin").length,
      labels: editor.allFeatures.filter((f) => f.type === "mapLabel").length,
    }),
    [editor.allFeatures]
  );

  return {
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
    createCountryFromShapeAction: geo.createCountryFromShapeAction,
    createCountryFromShapePending: geo.createCountryFromShapeMutation.isPending,
    activeSidebarTab: geo.activeSidebarTab,
    setActiveSidebarTab: geo.setActiveSidebarTab,
    featureSearch: geo.featureSearch,
    setFeatureSearch: geo.setFeatureSearch,
    featureFilter: geo.featureFilter,
    setFeatureFilter: geo.setFeatureFilter,
    assigningFeatureId: geo.assigningFeatureId,
    setAssigningFeatureId: geo.setAssigningFeatureId,
    assignCountryId: geo.assignCountryId,
    setAssignCountryId: geo.setAssignCountryId,
    unlinkedFeatureIdToAssign: geo.unlinkedFeatureIdToAssign,
    setUnlinkedFeatureIdToAssign: geo.setUnlinkedFeatureIdToAssign,
    validationTab: geo.validationTab,
    setValidationTab: geo.setValidationTab,
    editableFeatureName: geo.editableFeatureName,
    setEditableFeatureName: geo.setEditableFeatureName,
    editableCountryLinkageId: geo.editableCountryLinkageId,
    setEditableCountryLinkageId: geo.setEditableCountryLinkageId,
    wikiPageTitle: geo.wikiPageTitle,
    setWikiPageTitle: geo.setWikiPageTitle,
    propertiesJsonString: geo.propertiesJsonString,
    setPropertiesJsonString: geo.setPropertiesJsonString,
    isEditingJson: geo.isEditingJson,
    setIsEditingJson: geo.setIsEditingJson,
    jsonError: geo.jsonError,
    setJsonError: geo.setJsonError,
    parsedProperties: geo.parsedProperties,
    featureDetails: geo.featureDetails,
    refetchFeatureDetails: geo.refetchFeatureDetails,
    isAdmin,
    generateTransport,
    recalculateGeo,
    utils,
    featureList: geo.featureList,
    recalculateAreaMutation: geo.recalculateAreaMutation,
    dbCountries: geo.dbCountries,
    relations: geo.relations,
    relationsLoading: geo.relationsLoading,
    validationData: geo.validationData,
    refetchValidation: geo.refetchValidation,
    assignMutation: geo.assignMutation,
    unlinkMutation: geo.unlinkMutation,
    syncMutation: geo.syncMutation,
    autoMatchMutation: geo.autoMatchMutation,
    createSovereignty: geo.createSovereignty,
    updateSovereignty: geo.updateSovereignty,
    deleteSovereignty: geo.deleteSovereignty,
    updatePropertiesMutation: geo.updatePropertiesMutation,
    showExitConfirm,
    setShowExitConfirm,
    hasUnsavedChanges,
    handleRequestExit,
    sovereigntySearch: geo.sovereigntySearch,
    setSovereigntySearch: geo.setSovereigntySearch,
    sovereigntyTypeFilter: geo.sovereigntyTypeFilter,
    setSovereigntyTypeFilter: geo.setSovereigntyTypeFilter,
    showSovereigntyForm: geo.showSovereigntyForm,
    setShowSovereigntyForm: geo.setShowSovereigntyForm,
    editingSovereigntyId: geo.editingSovereigntyId,
    setEditingSovereigntyId: geo.setEditingSovereigntyId,
    sovereigntyForm: geo.sovereigntyForm,
    setSovereigntyForm: geo.setSovereigntyForm,
    displayName: borderOps.displayName,
    setDisplayName: borderOps.setDisplayName,
    showSplitDialog: borderOps.showSplitDialog,
    setShowSplitDialog: borderOps.setShowSplitDialog,
    showMergeDialog: borderOps.showMergeDialog,
    setShowMergeDialog: borderOps.setShowMergeDialog,
    isSubmitting: borderOps.isSubmitting,
    setIsSubmitting: borderOps.setIsSubmitting,
    showConfirmSaveModal: borderOps.showConfirmSaveModal,
    setShowConfirmSaveModal: borderOps.setShowConfirmSaveModal,
    saveReason: borderOps.saveReason,
    setSaveReason: borderOps.setSaveReason,
    panelConfigs: layout.panelConfigs,
    setPanelConfigs: layout.setPanelConfigs,
    handleMoveTab: layout.handleMoveTab,
    handleChangePanelPlacement: layout.handleChangePanelPlacement,
    showRightPanel: isWorldMode
      ? true
      : editor.mode !== "view" && editor.mode !== "import-provinces",
    cursorTerrainInfo: selection.cursorTerrainInfo,
    cursorZoom: tools.cursorZoom,
    setCursorZoom: tools.setCursorZoom,
    showGrid: tools.showGrid,
    setShowGrid: tools.setShowGrid,
    showGuides: tools.showGuides,
    setShowGuides: tools.setShowGuides,
    snapEnabled: tools.snapEnabled,
    setSnapEnabled: tools.setSnapEnabled,
    snapTolerance: tools.snapTolerance,
    setSnapTolerance: tools.setSnapTolerance,
    hoveredFeature: selection.hoveredFeature,
    setHoveredFeature: selection.setHoveredFeature,
    showShortcuts: tools.showShortcuts,
    setShowShortcuts: tools.setShowShortcuts,
    contextMenu: selection.contextMenu,
    setContextMenu: selection.setContextMenu,
    layerStates: tools.layerStates,
    setLayerStates: tools.setLayerStates,
    countries: geo.countries,
    availableCountries: geo.availableCountries,
    filteredFeatures: geo.filteredFeatures,
    filteredRelations: geo.filteredRelations,
    selectedCountryName:
      countryInfo?.name ||
      editor.countryGeo?.country?.name ||
      editor.countryGeo?.displayName ||
      geo.selectedCountryName,
    countryRelations: geo.countryRelations,
    handleMapSelect,
    handleAssignLink: geo.handleAssignLink,
    handleUnlink: geo.handleUnlink,
    resetSovereigntyForm: geo.resetSovereigntyForm,
    handleCreateSovereignty: geo.handleCreateSovereignty,
    handleUpdateSovereignty: geo.handleUpdateSovereignty,
    handleDeleteSovereignty: geo.handleDeleteSovereignty,
    handleEditSovereignty: geo.handleEditSovereignty,
    handleSaveFeatureProperties: geo.handleSaveFeatureProperties,
    handleConfirmBorderSave: borderOps.handleConfirmBorderSave,
    enterBorderEdit: borderOps.enterBorderEdit,
    handleExitBorderEdit: borderOps.handleExitBorderEdit,
    handleSplitConfirm: borderOps.handleSplitConfirm,
    handleMergeConfirm: borderOps.handleMergeConfirm,
    handleBorderToolbarSubmit: borderOps.handleBorderToolbarSubmit,
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
    selectedRouteId: selection.selectedRouteId,
    setSelectedRouteId: selection.setSelectedRouteId,
    handleRouteClick: selection.handleRouteClick,
    handleSelectFeature: selection.handleSelectFeature,
    handleEditFeature: selection.handleEditFeature,
    handleDeleteFeature: selection.handleDeleteFeature,
    handleEditRoute,
    handleSubmit,
    featureCounts,
    panelsLocked: layout.panelsLocked,
    setPanelsLocked: layout.setPanelsLocked,
  };
}
