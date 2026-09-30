"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import type { Map as MapLibreInstance } from "maplibre-gl";
import { useUser } from "~/context/auth-context";
import { isSystemOwner } from "~/lib/auth";
import { useHasRoleLevel } from "~/hooks/usePermissions";
import { useMapEditor } from "~/hooks/useMapEditor";
import { useMapData } from "~/hooks/useMapData";
import { useMapLiveSync } from "~/hooks/useMapLiveSync";
import { useProvinceImporter } from "~/hooks/useProvinceImporter";
import { useBorderEditor } from "~/hooks/useBorderEditor";
import { useWikiScanner } from "~/hooks/useWikiScanner";
import { api } from "~/trpc/react";
import type { SelectedCountry } from "~/components/maps/core/IxWorldMap";
import { useMapRealm } from "~/components/maps/core/MapRealmContext";
import type { EditorMapRef } from "~/components/maps/editor/EditorMap";
import type { EditorMode } from "~/hooks/map-editor/editor-types";
import { notifyFromStore } from "~/hooks/useNotify";
import {
  confirmEditorAction,
  isEditorConfirmOpen,
} from "~/components/maps/editor/components/EditorConfirmDialog";
import { isKeyboardInputTarget } from "~/components/maps/editor/hooks/drag-utils";
import { transientMapStore } from "~/components/maps/editor/utils/transientStore";
import { useEditorDraft } from "./useEditorDraft";
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
  const editor = useMapEditor(
    !isWorldMode || activeCountryId ? activeCountryId || undefined : undefined,
    { skipLinkageGate: isWorldMode, worldMapLayers: editorMapLayers }
  );
  const importer = useProvinceImporter(
    (!isWorldMode || activeCountryId ? activeCountryId : undefined) ?? "__none__"
  );

  const { data: neighborGeoms } = api.geoCore.getNeighborGeometries.useQuery(
    { featureId: borderState.featureId!, realm },
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
      return ["add-city", "add-subdivision", "add-poi", "add-route", "import-provinces"];
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
  // Admin-role users (level ≤ 10, as in the main navigation) and system owners get the
  // admin tools; the server still authorises every admin procedure itself.
  const hasAdminRole = useHasRoleLevel(10);
  const isAdmin = isSystemOwner(user.user?.id ?? "") || hasAdminRole;
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

  // Set by EditorMap while a region reshape has moves that are not saved yet.
  const [vertexEditDirty, setVertexEditDirty] = useState(false);

  /**
   * True when leaving would lose work: an unsaved border edit or import, an
   * in-progress drawing/placement, an unsaved region reshape, a write still in
   * flight, or unsaved world-mode attribute edits. Merely having a tool active
   * does not count.
   */
  const hasUnsavedChanges = useMemo(() => {
    if (borderState.isDirty) return true;
    if (importer.step !== "upload") return true;
    if (editor.isMutating) return true;
    if (vertexEditDirty) return true;
    if (editor.pendingCoordinates || editor.pendingGeometry) return true;
    if (
      editor.routeWaypoints.length > 0 ||
      editor.riverPath.length > 0 ||
      editor.splitLine.length > 0
    )
      return true;
    if (editor.mode === "edit-route") return true;

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
    editor.isMutating,
    vertexEditDirty,
    editor.pendingCoordinates,
    editor.pendingGeometry,
    editor.routeWaypoints.length,
    editor.riverPath.length,
    editor.splitLine.length,
    editor.mode,
    mapSelectedCountry,
    geo.editableFeatureName,
    geo.editableCountryLinkageId,
    geo.wikiPageTitle,
    geo.propertiesJsonString,
    geo.featureDetails,
  ]);

  // Unsaved placements/drawings survive a reload (offered back on next open).
  useEditorDraft(editor, activeCountryId, !!editor.countryGeo && !editor.featuresLoading);

  // Browser-level leave warning (tab close, reload, external navigation).
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

  // Success/failure toasts are raised by the caller (EditorHeader) with the result counts.
  const simplifyAll = api.geoFeatures.simplifySubdivisions.useMutation({
    onSuccess: () => {
      editor.refetchFeatures();
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
      const feature = transportRouteData.features.find((f) => String(f.properties?.id) === routeId);
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
          routes: {
            ...prev.routes,
            visible: true,
            locked: false,
            opacity: prev.routes?.opacity ?? 1,
          },
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

  /**
   * Deletes the multi-selection (or the single selected feature) after a themed
   * confirmation. Shared by the Delete key, the tool options bar and the header.
   */
  const requestDeleteSelection = useCallback(async () => {
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
      await selection.handleDeleteFeature(editor.selectedFeature);
    }
  }, [editor, selection]);

  const toggleAllPanels = useCallback(() => {
    layout.setPanelConfigs((prev) => {
      const collapse = !(prev.panelA.collapsed && prev.panelB.collapsed);
      return {
        panelA: { ...prev.panelA, collapsed: collapse },
        panelB: { ...prev.panelB, collapsed: collapse },
      };
    });
  }, [layout]);

  // ── Keyboard shortcuts ──
  // One window listener, registered once; it reads the latest state through a ref.
  // Tool letters (V M C P K T Y R J U) are routed by the plugin provider; this
  // handler owns undo/redo, selection, delete, save, escape, view toggles and the
  // world editor's border-edit tools.
  const keyStateRef = useRef({
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
    toolsDisabled: isWorldMode ? !mapSelectedCountry : !isLinked || !hasGeometry,
    vertexEditDirty,
  });
  // oxlint-disable-next-line -- latest-value ref read by the stable key listener
  keyStateRef.current = {
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
    toolsDisabled: isWorldMode ? !mapSelectedCountry : !isLinked || !hasGeometry,
    vertexEditDirty,
  };

  useEffect(() => {
    const LOCAL_UNDO_MODES = new Set<EditorMode>([
      "add-subdivision",
      "add-lake",
      "edit-subdivision",
    ]);

    const handleEscape = () => {
      const k = keyStateRef.current;
      const ed = k.editor;
      if (ed.mode === "import-provinces") {
        k.importer.reset();
        ed.setMode("view");
      } else if (ed.mode === "edit-route") {
        ed.cancelRouteEdit();
      } else if (ed.mode !== "view") {
        ed.resetForm();
        ed.clearRouteWaypoints();
        ed.setMode("view");
      } else if (ed.selectedIds.size > 0) {
        ed.clearMultiSelect();
      } else if (ed.selectedFeature) {
        ed.resetForm();
      } else {
        k.handleRequestExit();
      }
    };

    const handler = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.isComposing) return;
      // A confirmation dialog or the shortcut sheet owns the keyboard while open.
      if (isEditorConfirmOpen()) return;
      // Focus inside a popover/menu/dialog: that surface owns the keys (Esc closes it, not the tool).
      const focused = document.activeElement as HTMLElement | null;
      if (
        focused?.closest?.(
          '[role="dialog"],[role="alertdialog"],[role="menu"],[role="listbox"],[data-radix-popper-content-wrapper]'
        )
      ) {
        return;
      }
      const k = keyStateRef.current;
      const { editor: ed } = k;
      const inInput =
        isKeyboardInputTarget(e.target) || isKeyboardInputTarget(document.activeElement);
      const mod = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();

      if (k.showShortcuts) {
        if (e.key === "Escape" || e.key === "?") {
          e.preventDefault();
          k.setShowShortcuts(false);
        }
        return;
      }

      // ── Border editor (world mode) ──
      if (k.activeEditorMode === "border_edit") {
        if (inInput) return;
        if (mod && key === "z") {
          e.preventDefault();
          if (e.shiftKey) k.borderActions.redo();
          else k.borderActions.undo();
          return;
        }
        if (mod && key === "y") {
          e.preventDefault();
          k.borderActions.redo();
          return;
        }
        if (!mod && !e.altKey) {
          const borderTool = (
            {
              v: "select",
              p: "vertex_edit",
              x: "split",
              m: "merge",
              t: "trace",
              b: "brush",
            } as const
          )[key as "v" | "p" | "x" | "m" | "t" | "b"];
          if (borderTool) {
            e.preventDefault();
            k.borderActions.setMode(borderTool);
            return;
          }
        }
        if (e.key === "Escape") {
          e.preventDefault();
          k.handleExitBorderEdit();
        }
        return;
      }

      // ── Save (works inside form fields too) ──
      if (mod && key === "s") {
        e.preventDefault();
        if (ed.mode.startsWith("add-") || ed.mode.startsWith("edit-")) k.handleSubmit();
        return;
      }

      if (inInput) return;

      // ── Undo / Redo ──
      if (mod && (key === "z" || key === "y")) {
        const isRedo = key === "y" || e.shiftKey;
        // An unsaved region reshape: Ctrl+Z must not undo an older server edit underneath it.
        if (ed.mode === "edit-subdivision" && k.vertexEditDirty) return;
        // Region/lake drawing removes its last vertex on Ctrl+Z; only fall through to the
        // editor undo when the drawing tool did not claim the key (nothing drawn yet).
        if (!isRedo && LOCAL_UNDO_MODES.has(ed.mode) && ed.mode !== "edit-subdivision") {
          window.setTimeout(() => {
            if (!e.defaultPrevented) void keyStateRef.current.editor.undo();
          }, 0);
          return;
        }
        e.preventDefault();
        if (!isRedo) {
          if (ed.mode === "add-route" && ed.routeWaypoints.length > 0) return ed.undoLastWaypoint();
          if (ed.mode === "add-river" && ed.riverPath.length > 0) return ed.undoLastRiverPoint();
          if (ed.mode === "split-subdivision" && ed.splitLine.length > 0)
            return ed.undoLastSplitPoint();
          void ed.undo();
        } else {
          void ed.redo();
        }
        return;
      }

      // ── Selection ──
      if (mod && key === "a") {
        e.preventDefault();
        ed.selectAll();
        return;
      }
      if (mod && key === "d") {
        e.preventDefault();
        ed.clearMultiSelect();
        return;
      }
      if (mod && key === "j") {
        e.preventDefault();
        if (ed.selectedFeature) void ed.duplicateFeature(ed.selectedFeature);
        return;
      }

      // ── Finish / delete ──
      if (e.key === "Enter" && !mod) {
        if (ed.mode === "add-route" && ed.routeWaypoints.length >= 2) {
          e.preventDefault();
          void ed.finishRoute().catch(() => undefined);
        } else if (
          ed.mode === "split-subdivision" &&
          ed.selectedFeature &&
          ed.splitLine.length >= 2
        ) {
          e.preventDefault();
          void ed.executeSplitSubdivision(ed.selectedFeature.id);
        }
        return;
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        // In drawing/reshaping modes these keys remove the last/hovered vertex instead.
        if (ed.mode !== "view" && !ed.mode.startsWith("edit-")) return;
        if (ed.mode === "edit-subdivision" || ed.mode === "edit-route") return;
        if (ed.selectedIds.size > 0 || ed.selectedFeature) {
          e.preventDefault();
          void k.requestDeleteSelection();
        }
        return;
      }

      // ── Escape: close menu → cancel drawing → clear selection → leave tool → exit ──
      if (e.key === "Escape") {
        if (k.contextMenu) {
          k.setContextMenu(null);
          return;
        }
        // Tool-local handlers (cancel a drag, clear an in-progress polygon) run on the
        // same event; let them go first and only act if none of them claimed it.
        window.setTimeout(() => {
          if (!e.defaultPrevented) handleEscape();
        }, 0);
        return;
      }

      if (mod || e.altKey) return;

      // ── View toggles & quick tools ──
      if (e.key === "?") {
        e.preventDefault();
        k.setShowShortcuts(true);
        return;
      }
      if (key === "g") {
        e.preventDefault();
        k.setShowGrid((v) => !v);
        return;
      }
      if (key === "f") {
        e.preventDefault();
        k.toggleAllPanels();
        return;
      }
      if (key === "h") {
        e.preventDefault();
        ed.setShowGaps(!ed.showGaps);
        return;
      }
      if (k.toolsDisabled) return;
      if (key === "i") {
        e.preventDefault();
        ed.setMode("import-provinces");
        return;
      }
      const digitMode = (
        { "1": "add-city", "2": "add-subdivision", "3": "add-poi", "4": "add-route" } as const
      )[e.key as "1" | "2" | "3" | "4"];
      if (digitMode) {
        e.preventDefault();
        ed.setMode(digitMode);
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Zoom level for the status bar lives in the transient store (no editor re-render).
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
    showGrid: tools.showGrid,
    setShowGrid: tools.setShowGrid,
    showGuides: tools.showGuides,
    setShowGuides: tools.setShowGuides,
    snapEnabled: tools.snapEnabled,
    setSnapEnabled: tools.setSnapEnabled,
    snapTolerance: tools.snapTolerance,
    setSnapTolerance: tools.setSnapTolerance,
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
    zoomToFeature: selection.zoomToFeature,
    requestDeleteSelection,
    toggleAllPanels,
    vertexEditDirty,
    setVertexEditDirty,
    handleEditRoute,
    handleSubmit,
    featureCounts,
    panelsLocked: layout.panelsLocked,
    setPanelsLocked: layout.setPanelsLocked,
  };
}
