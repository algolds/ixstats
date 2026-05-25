"use client";

/**
 * MapEditorOverlay — Full-screen map editor with Adobe-style layout.
 *
 * Layout:
 * ┌─── Title Bar ────────────────────────────────────┐
 * ├──┬──────────────────────────────────────┬─────────┤
 * │  │                                      │ Editor  │
 * │T │           MAP CANVAS                 │ Panel   │
 * │R │                                      │ (right) │
 * ├──┴──────────────────────────────────────┴─────────┤
 * │ Status Bar                                        │
 * └───────────────────────────────────────────────────┘
 */

import React, { useRef, useCallback, useState, useEffect, useMemo, Component } from "react";
import dynamic from "next/dynamic";
import {
  ArrowLeft,
  AlertCircle,
  Map,
  ChevronRight,
  Sparkles,
  Train,
  RefreshCw,
  Minimize2,
  Grid3X3,
  Crosshair,
  Droplets,
  Mountain as MountainIcon,
  Undo2,
  Redo2,
} from "lucide-react";
import { useUser } from "~/context/auth-context";
import { isSystemOwner } from "~/lib/system-owner-constants";
import { useMapEditor } from "~/hooks/useMapEditor";
import { useMapData } from "~/hooks/useMapData";
import { useMapLiveSync } from "~/hooks/useMapLiveSync";
import { useProvinceImporter } from "~/hooks/useProvinceImporter";
import { MapEditorToolbar } from "~/components/maps/editor/MapEditorToolbar";
import { FeaturePropertyPanel } from "~/components/maps/editor/FeaturePropertyPanel";
import { FeatureList } from "~/components/maps/editor/FeatureList";
import { EditorPanel } from "~/components/maps/editor/EditorPanel";
import { EditorStatusBar } from "~/components/maps/editor/EditorStatusBar";
import { ToolOptionsBar } from "~/components/maps/editor/ToolOptionsBar";
import { BatchActionsBar } from "~/components/maps/editor/BatchActionsBar";
import { LayerPanel, type LayerState } from "~/components/maps/editor/LayerPanel";
import { FeatureContextMenu } from "~/components/maps/editor/FeatureContextMenu";
import { MobileEditorSheet } from "~/components/maps/editor/MobileEditorSheet";
import { WikiScannerPanel } from "~/components/maps/editor/WikiScannerPanel";
import { useWikiScanner } from "~/hooks/useWikiScanner";
import {
  MapPin,
  Hexagon,
  Landmark,
  BookMarked,
  Type as TypeIcon,
  Route,
  Globe,
} from "lucide-react";
import {
  ProvinceImportWizard,
  ProvincePreviewLayer,
} from "~/components/maps/editor/province-importer";
import { TransportOverlay } from "~/components/maps/overlays/TransportOverlay";
import type { EditorMapRef } from "~/components/maps/editor/EditorMap";
import type { MapLayerData } from "~/components/maps/core/IxWorldMap";
import { KeyboardShortcutSheet } from "~/components/maps/editor/KeyboardShortcutSheet";
import { api } from "~/trpc/react";

const EditorMap = dynamic(() => import("~/components/maps/editor/EditorMap"), {
  ssr: false,
  loading: () => (
    <div className="bg-muted flex h-full items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="border-muted-foreground/20 h-8 w-8 animate-spin rounded-full border-4 border-t-emerald-500" />
        <p className="text-muted-foreground text-sm">Loading map editor...</p>
      </div>
    </div>
  ),
});

interface MapEditorOverlayProps {
  countryId: string;
  mapLayers: MapLayerData[];
  onExit: () => void;
}

export default function MapEditorOverlay({
  countryId,
  mapLayers: parentMapLayers,
  onExit,
}: MapEditorOverlayProps) {
  const mapRef = useRef<EditorMapRef>(null);

  // Real-time sync: invalidate map caches when any geo mutation succeeds
  useMapLiveSync();

  const [panelCollapsed, setPanelCollapsed] = useState(false);
  const [cursorCoords, setCursorCoords] = useState<[number, number] | null>(null);
  const [cursorZoom, setCursorZoom] = useState<number | undefined>(undefined);
  const [forgeMode, setForgeMode] = useState(false);
  const [showGrid, setShowGrid] = useState(false);
  const [paintMapMode, setPaintMapMode] = useState<
    "population" | "development" | "resources" | "wiki"
  >("population");
  const [paintSelectedRegion, setPaintSelectedRegion] = useState<string | null>(null);
  const [paintCompareRegion, setPaintCompareRegion] = useState<string | null>(null);
  const [hoveredFeature, setHoveredFeature] = useState<{
    feature: (typeof editor.allFeatures)[number];
    screenPos: { x: number; y: number };
  } | null>(null);

  // Keyboard shortcut sheet
  const [showShortcuts, setShowShortcuts] = useState(false);

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    feature: { id: string; name: string; type: string; wikiPageTitle?: string | null };
  } | null>(null);

  // Layer panel state
  const [layerStates, setLayerStates] = useState<
    Record<string, { visible: boolean; locked: boolean; opacity?: number }>
  >({
    border: { visible: true, locked: false },
    regions: { visible: true, locked: false, opacity: 0.6 },
    cities: { visible: true, locked: false },
    pois: { visible: true, locked: false },
    stories: { visible: true, locked: false },
    labels: { visible: true, locked: false },
    routes: { visible: true, locked: false },
    rivers: { visible: true, locked: false },
    altitude: { visible: true, locked: false },
    grid: { visible: false, locked: false },
  });

  // Admin detection for Forge Mode access
  const { user: authUser } = useUser();
  const isAdmin =
    !!authUser &&
    (isSystemOwner(authUser.id) ||
      (typeof authUser.publicMetadata?.role === "string" &&
        ["admin", "owner", "staff"].includes(authUser.publicMetadata.role)));

  // Admin mutations (only used in forge mode)
  const generateTransport = api.transport.generateRoutes.useMutation();
  const recalculateGeo = api.geo.recalculateGeoProfiles.useMutation();

  // Simplify all regions (available to country owner)
  const simplifyAll = api.geo.simplifySubdivisions.useMutation({
    onSuccess: () => {
      editor.refetchFeatures();
    },
  });

  const editor = useMapEditor(countryId);
  const importer = useProvinceImporter(countryId);

  // Wiki scanner — link features to wiki pages
  const updateCityWiki = api.geo.updateCity.useMutation({
    onSuccess: () => editor.refetchFeatures(),
  });
  const updatePOIWiki = api.geo.updatePOI.useMutation({
    onSuccess: () => editor.refetchFeatures(),
  });
  const updateStoryPinWiki = api.geo.updateStoryPin.useMutation({
    onSuccess: () => editor.refetchFeatures(),
  });
  const updateMapLabelWiki = api.geo.updateMapLabel.useMutation({
    onSuccess: () => editor.refetchFeatures(),
  });

  const handleLinkFeature = useCallback(
    async (featureId: string, featureType: string, wikiTitle: string) => {
      if (!countryId) return;
      switch (featureType) {
        case "city":
          await updateCityWiki.mutateAsync({
            countryId,
            cityId: featureId,
            wikiPageTitle: wikiTitle,
          });
          break;
        case "poi":
          await updatePOIWiki.mutateAsync({
            countryId,
            poiId: featureId,
            wikiPageTitle: wikiTitle,
          });
          break;
        case "storyPin":
          await updateStoryPinWiki.mutateAsync({
            countryId,
            pinId: featureId,
            wikiPageTitle: wikiTitle,
          });
          break;
        case "mapLabel":
          await updateMapLabelWiki.mutateAsync({
            countryId,
            labelId: featureId,
            wikiPageTitle: wikiTitle,
          });
          break;
        // subdivision doesn't support wikiPageTitle in its update mutation
      }
    },
    [countryId, updateCityWiki, updatePOIWiki, updateStoryPinWiki, updateMapLabelWiki]
  );

  const wikiScanner = useWikiScanner({
    features: editor.allFeatures,
    onLinkFeature: handleLinkFeature,
  });

  // Fetch country name for display
  const { data: countryInfo } = api.countries.getByIdBasic.useQuery(
    { id: countryId },
    { staleTime: 5 * 60_000 }
  );

  // Track live map instance for province preview layer (one-shot, no polling)
  const [mapInstance, setMapInstance] = useState<import("maplibre-gl").Map | null>(null);
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
  }, []);

  // Editor's own layer data — same layers as main map, independent visibility
  const {
    mapLayers: editorMapLayers,
    toggleLayer: toggleEditorLayer,
    visibleLayers: editorVisibleLayers,
  } = useMapData(["background", "altitudes", "rivers", "lakes"]);
  const worldMapLayers = editorMapLayers;

  // Transport routes for this country (shown as overlay lines)
  const { data: transportRouteData } = api.transport.getCountryRoutes.useQuery(
    { countryId },
    { staleTime: 60_000, gcTime: 5 * 60_000 }
  );

  // Paint mode: fetch subdivision stats
  const { data: subdivisionStats } = api.geo.getSubdivisionStats.useQuery(
    { countryId },
    { enabled: editor.mode === "paint", staleTime: 60_000 }
  );

  // Paint mode: compute color map from stats + selected mode
  const paintColors = useMemo(() => {
    if (editor.mode !== "paint" || !subdivisionStats || subdivisionStats.length === 0)
      return undefined;

    const colors: Record<string, string> = {};
    const stats = subdivisionStats;

    // Get max values for normalization
    const maxPop = Math.max(1, ...stats.map((s) => s.population ?? 0));
    const maxDev = Math.max(1, ...stats.map((s) => s.developmentScore));
    const maxRes = Math.max(1, ...stats.map((s) => s.resourceCount));

    for (const s of stats) {
      let t = 0; // normalized 0-1
      switch (paintMapMode) {
        case "population":
          t = (s.population ?? 0) / maxPop;
          break;
        case "development":
          t = s.developmentScore / maxDev;
          break;
        case "resources":
          t = s.resourceCount / maxRes;
          break;
        case "wiki":
          t = s.totalFeatures > 0 ? s.wikiLinked / s.totalFeatures : 0;
          break;
      }
      // Color gradient: low=cool, high=warm
      colors[s.id] =
        paintMapMode === "wiki"
          ? `hsl(${Math.round(t * 120)}, 70%, 50%)` // red(0) → green(120)
          : `hsl(${Math.round((1 - t) * 60)}, 80%, ${55 - t * 15}%)`; // yellow(60) → red(0), darker for high
    }

    return colors;
  }, [editor.mode, subdivisionStats, paintMapMode]);

  // Debounced cursor terrain query — fires 300ms after cursor stops moving
  const [debouncedCoords, setDebouncedCoords] = useState<[number, number] | null>(null);
  useEffect(() => {
    if (!cursorCoords) {
      setDebouncedCoords(null);
      return;
    }
    const timer = setTimeout(() => setDebouncedCoords(cursorCoords), 300);
    return () => clearTimeout(timer);
  }, [cursorCoords]);

  const { data: cursorTerrainInfo } = api.geo.getPointInfo.useQuery(
    { lng: debouncedCoords?.[0] ?? 0, lat: debouncedCoords?.[1] ?? 0 },
    { enabled: !!debouncedCoords, staleTime: 30_000, gcTime: 60_000 }
  );

  // Feature interaction callbacks
  const handleSelectFeature = useCallback(
    (feature: (typeof editor.allFeatures)[number]) => {
      editor.setSelectedFeature(feature);
      // In paint mode, just select — don't open edit form
      if (editor.mode !== "paint") {
        editor.startEditing(feature);
      }
      if (mapRef.current) {
        if (feature.coordinates) {
          // Point feature (city/POI) — fly to coordinates
          mapRef.current.flyTo(feature.coordinates[0], feature.coordinates[1], 8);
        } else if (feature.geometry) {
          // Polygon feature (subdivision) — fly to geometry centroid
          const geo = feature.geometry as
            | import("geojson").Polygon
            | import("geojson").MultiPolygon;
          const ring = geo.type === "Polygon" ? geo.coordinates[0] : geo.coordinates[0]?.[0];
          if (ring && ring.length > 0) {
            let cx = 0,
              cy = 0;
            for (const pt of ring) {
              cx += pt[0]!;
              cy += pt[1]!;
            }
            cx /= ring.length;
            cy /= ring.length;
            mapRef.current.flyTo(cx, cy, 7);
          }
        }
      }
    },
    [editor]
  );

  const handleEditFeature = useCallback(
    (feature: (typeof editor.allFeatures)[number]) => {
      editor.startEditing(feature);
    },
    [editor]
  );

  const handleDeleteFeature = useCallback(
    (feature: (typeof editor.allFeatures)[number]) => {
      if (confirm(`Delete "${feature.name}"? This action cannot be undone.`)) {
        editor.handleDeleteFeature(feature);
      }
    },
    [editor]
  );

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
      case "add-story-pin":
        editor.submitStoryPin();
        break;
      case "add-label":
        editor.submitMapLabel();
        break;
      case "edit-story-pin":
        editor.submitEditStoryPin();
        break;
      case "edit-label":
        editor.submitEditMapLabel();
        break;
    }
  }, [editor]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      const inInput = tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";

      // Undo/Redo (works even in input fields)
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

      // Ctrl+S: force save
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        if (editor.mode.startsWith("add-") || editor.mode.startsWith("edit-")) {
          handleSubmit();
        }
        return;
      }

      // Ctrl+A: select all visible features
      if ((e.ctrlKey || e.metaKey) && e.key === "a" && !inInput) {
        e.preventDefault();
        editor.allFeatures.forEach((f) => {
          if (!editor.selectedIds.has(f.id)) {
            editor.toggleSelectId(f.id);
          }
        });
        return;
      }

      // Ctrl+D: deselect all
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
        } else {
          onExit();
        }
        return;
      }

      if ((e.key === "Delete" || e.key === "Backspace") && !inInput) {
        if (editor.selectedFeature && editor.mode === "view") {
          e.preventDefault();
          handleDeleteFeature(editor.selectedFeature);
        }
        return;
      }

      // ? — show keyboard shortcut sheet
      if (e.key === "?" && !inInput) {
        e.preventDefault();
        setShowShortcuts((v) => !v);
        return;
      }

      const toolsDisabled = !editor.linkage?.isLinked || !editor.countryGeo;
      if (inInput || toolsDisabled) return;

      switch (e.key.toLowerCase()) {
        case "v":
          e.preventDefault();
          editor.setMode("view");
          break;
        case "1":
        case "c":
          e.preventDefault();
          editor.setMode(editor.mode === "add-city" ? "view" : "add-city");
          break;
        case "2":
        case "r":
          e.preventDefault();
          editor.setMode(editor.mode === "add-subdivision" ? "view" : "add-subdivision");
          break;
        case "3":
        case "p":
          e.preventDefault();
          editor.setMode(editor.mode === "add-poi" ? "view" : "add-poi");
          break;
        case "4":
        case "t":
          e.preventDefault();
          editor.setMode(editor.mode === "add-route" ? "view" : "add-route");
          break;
        case "i":
          e.preventDefault();
          editor.setMode(editor.mode === "import-provinces" ? "view" : "import-provinces");
          break;
        case "f":
          e.preventDefault();
          setPanelCollapsed((v) => !v);
          break;
        case "g":
          e.preventDefault();
          setShowGrid((v) => !v);
          break;
        case "b":
          e.preventDefault();
          editor.setMode(editor.mode === "paint" ? "view" : "paint");
          break;
        case "s":
          e.preventDefault();
          editor.setMode(editor.mode === "add-story-pin" ? "view" : "add-story-pin");
          break;
        case "l":
          e.preventDefault();
          editor.setMode(editor.mode === "add-label" ? "view" : "add-label");
          break;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [editor, importer, onExit, handleDeleteFeature, handleSubmit]);

  // Track map cursor position + hovered features for status bar & tooltip
  const handleMapMouseMove = useCallback(
    (e: any) => {
      setCursorCoords([e.lngLat.lng, e.lngLat.lat]);

      // Detect hovered subdivision for stats overlay
      const map = mapInstance;
      if (!map || (editor.mode !== "view" && editor.mode !== "paint")) {
        if (hoveredFeature) setHoveredFeature(null);
        return;
      }

      const hits = map.queryRenderedFeatures(e.point, {
        layers: ["editor-subdivisions-fill"],
      });

      if (hits.length > 0) {
        const hitId = hits[0]?.properties?.id as string | undefined;
        if (hitId && hitId !== hoveredFeature?.feature.id) {
          const match = editor.allFeatures.find((f) => f.id === hitId);
          if (match) {
            setHoveredFeature({ feature: match, screenPos: { x: e.point.x, y: e.point.y } });
          }
        }
      } else if (hoveredFeature) {
        setHoveredFeature(null);
      }
    },
    [mapInstance, editor.mode, editor.allFeatures, hoveredFeature]
  );

  useEffect(() => {
    const map = mapInstance;
    if (!map) return;
    map.on("mousemove", handleMapMouseMove);
    map.on("zoomend", () => setCursorZoom(map.getZoom()));
    setCursorZoom(map.getZoom());
    return () => {
      map.off("mousemove", handleMapMouseMove);
    };
  }, [mapInstance, handleMapMouseMove]);

  // ── Derived State & Tools ──
  const isLinked = !!editor.linkage?.isLinked;
  const linkageLoading = editor.linkageLoading;
  const hasGeometry = !!editor.countryGeo;
  const toolsDisabled = !isLinked || !hasGeometry;

  // featureCounts - extracted from inline to top-level to ensure hook stability
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

  // ── Loading & Initialization States ──
  const showLoadingScreen =
    linkageLoading || (isLinked && (!hasGeometry || editor.featuresLoading));

  // ── Not linked warning ──
  // IMPORTANT: This early return must happen AFTER all hooks have been called
  if (!linkageLoading && !isLinked) {
    return (
      <div className="bg-background absolute inset-0 z-30 flex flex-col">
        <div className="border-border bg-card flex h-10 items-center gap-2 border-b px-3">
          <button
            onClick={onExit}
            className="text-muted-foreground hover:bg-accent hover:text-foreground rounded-md p-1.5"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <span className="text-sm font-semibold">{countryInfo?.name ?? "Country"}</span>
        </div>
        <div className="flex flex-1 items-center justify-center p-6">
          <div className="mx-auto max-w-sm text-center">
            <AlertCircle className="mx-auto mb-3 h-10 w-10 text-amber-500" />
            <h3 className="text-foreground font-semibold">Country Not Linked to Map</h3>
            <p className="text-muted-foreground mt-1 text-sm">
              This country needs to be linked to a political map feature before editing. Contact an
              admin to link it.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ── Editor Render ──
  return (
    <div className="bg-background absolute inset-0 z-30 flex flex-col">
      {/* Loading splash — fades out when data is ready */}
      {showLoadingScreen && <EditorLoadingScreen countryName={countryInfo?.name} />}

      {/* ── Title Bar ── */}
      <div className="border-border bg-card flex h-10 shrink-0 items-center gap-2 border-b px-3">
        <button
          onClick={onExit}
          className="text-muted-foreground hover:bg-accent hover:text-foreground rounded-md p-1.5 transition-colors"
          title="Close Editor (Esc)"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="text-muted-foreground flex items-center gap-1.5 text-xs">
          <Map className="h-3.5 w-3.5 text-emerald-500" />
          <span className="text-foreground font-semibold">{countryInfo?.name ?? "…"}</span>
          <ChevronRight className="h-3 w-3" />
          <span>{forgeMode ? "Forge Mode" : "Map Editor"}</span>
        </div>

        {/* Undo/Redo — left side after breadcrumb */}
        <div className="ml-2 flex items-center gap-0.5">
          <button
            disabled={!editor.historyCanUndo}
            onClick={() => editor.undo()}
            className="text-muted-foreground hover:bg-accent hover:text-foreground flex h-6 w-6 items-center justify-center rounded-md transition-colors disabled:pointer-events-none disabled:opacity-30"
            title="Undo (Ctrl+Z)"
          >
            <Undo2 className="h-3.5 w-3.5" />
          </button>
          <button
            disabled={!editor.historyCanRedo}
            onClick={() => editor.redo()}
            className="text-muted-foreground hover:bg-accent hover:text-foreground flex h-6 w-6 items-center justify-center rounded-md transition-colors disabled:pointer-events-none disabled:opacity-30"
            title="Redo (Ctrl+Shift+Z)"
          >
            <Redo2 className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Save indicator */}
        {editor.isMutating && (
          <span className="animate-pulse text-[10px] text-amber-500">Saving…</span>
        )}
        {!editor.isMutating && editor.lastSavedAt && (
          <span className="text-[10px] text-emerald-500">Saved</span>
        )}

        <div className="ml-auto" />

        <div className="bg-border h-4 w-px" />

        {/* Map controls in header — layers, grid, center */}
        <div className="ml-1 flex items-center gap-0.5">
          {/* Layer toggles */}
          <button
            onClick={() => toggleEditorLayer("rivers")}
            className={`flex h-6 w-6 items-center justify-center rounded-md transition-colors ${
              editorVisibleLayers.has("rivers")
                ? "bg-blue-500/15 text-blue-500"
                : "text-muted-foreground hover:bg-accent hover:text-foreground"
            }`}
            title="Rivers"
          >
            <Droplets className="h-3 w-3" />
          </button>
          <button
            onClick={() => toggleEditorLayer("altitudes")}
            className={`flex h-6 w-6 items-center justify-center rounded-md transition-colors ${
              editorVisibleLayers.has("altitudes")
                ? "bg-amber-500/15 text-amber-500"
                : "text-muted-foreground hover:bg-accent hover:text-foreground"
            }`}
            title="Altitude/Elevation"
          >
            <MountainIcon className="h-3 w-3" />
          </button>

          <div className="bg-border mx-0.5 h-4 w-px" />

          {/* Grid + Center */}
          <button
            onClick={() => setShowGrid((v) => !v)}
            className={`flex h-6 w-6 items-center justify-center rounded-md transition-colors ${
              showGrid
                ? "bg-primary/15 text-primary"
                : "text-muted-foreground hover:bg-accent hover:text-foreground"
            }`}
            title="Toggle Grid (G)"
          >
            <Grid3X3 className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => {
              const geo = editor.countryGeo;
              if (geo?.centroid) {
                mapRef.current?.flyTo(geo.centroid.lng, geo.centroid.lat, 5);
              }
            }}
            className="text-muted-foreground hover:bg-accent hover:text-foreground flex h-6 w-6 items-center justify-center rounded-md transition-colors"
            title="Center on Country"
          >
            <Crosshair className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Bulk delete — shown when multi-select has items */}
        {editor.selectedIds.size > 0 && (
          <button
            onClick={async () => {
              if (!confirm(`Delete ${editor.selectedIds.size} selected features?`)) return;
              await editor.bulkDeleteSelected();
            }}
            className="flex items-center gap-1 rounded-md bg-red-500/10 px-2 py-1 text-[11px] font-medium text-red-600 hover:bg-red-500/20 dark:text-red-400"
          >
            Delete {editor.selectedIds.size} Selected
          </button>
        )}

        {/* Simplify All Regions — available to all users with regions */}
        {editor.allFeatures.some((f) => f.type === "subdivision") && (
          <div className="mr-1">
            <button
              onClick={async () => {
                try {
                  const result = await simplifyAll.mutateAsync({
                    countryId,
                    targetVerticesPerProvince: 100,
                  });
                  alert(
                    `Simplified ${result.updated}/${result.total} regions\n` +
                      `Vertices: ${result.verticesBefore.toLocaleString()} → ${result.verticesAfter.toLocaleString()} (${result.reduction}% reduction)`
                  );
                } catch (e) {
                  alert(`Error: ${e instanceof Error ? e.message : "Unknown"}`);
                }
              }}
              disabled={simplifyAll.isPending}
              className="flex items-center gap-1 rounded-md bg-violet-500/10 px-2 py-1 text-[11px] font-medium text-violet-600 hover:bg-violet-500/20 disabled:opacity-50 dark:text-violet-400"
              title="Simplify all regions — reduce vertices while preserving shape"
            >
              <Minimize2 className={`h-3 w-3 ${simplifyAll.isPending ? "animate-pulse" : ""}`} />
              {simplifyAll.isPending ? "Simplifying..." : "Simplify All"}
            </button>
          </div>
        )}

        {/* Admin: Forge Mode toggle + actions */}
        {isAdmin && (
          <div
            className={`${editor.allFeatures.some((f) => f.type === "subdivision") ? "" : "ml-auto"} flex items-center gap-1`}
          >
            <button
              onClick={() => setForgeMode((v) => !v)}
              className={`flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium transition-colors ${
                forgeMode
                  ? "bg-amber-500/20 text-amber-600 dark:text-amber-400"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              }`}
              title="Toggle Forge Mode (admin superpowers)"
            >
              <Sparkles className="h-3 w-3" />
              Forge
            </button>
            {forgeMode && (
              <>
                <button
                  onClick={async () => {
                    try {
                      const result = await generateTransport.mutateAsync({
                        countryId,
                        routeTypes: ["rail", "highway"],
                        clearExisting: true,
                      });
                      alert(
                        `Generated ${result.routesCreated} routes (${result.totalLengthKm} km)`
                      );
                    } catch (e) {
                      alert(`Error: ${e instanceof Error ? e.message : "Unknown"}`);
                    }
                  }}
                  disabled={generateTransport.isPending}
                  className="flex items-center gap-1 rounded-md bg-indigo-500/10 px-2 py-1 text-[11px] font-medium text-indigo-600 hover:bg-indigo-500/20 disabled:opacity-50 dark:text-indigo-400"
                >
                  <Train className="h-3 w-3" />
                  {generateTransport.isPending ? "..." : "Gen Transport"}
                </button>
                <button
                  onClick={async () => {
                    try {
                      await recalculateGeo.mutateAsync({ countryId });
                      alert("Geographic profile recalculated");
                    } catch (e) {
                      alert(`Error: ${e instanceof Error ? e.message : "Unknown"}`);
                    }
                  }}
                  disabled={recalculateGeo.isPending}
                  className="flex items-center gap-1 rounded-md bg-emerald-500/10 px-2 py-1 text-[11px] font-medium text-emerald-600 hover:bg-emerald-500/20 disabled:opacity-50 dark:text-emerald-400"
                >
                  <RefreshCw
                    className={`h-3 w-3 ${recalculateGeo.isPending ? "animate-spin" : ""}`}
                  />
                  Recalc
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* ── Tool Options Bar (Photoshop-style context bar) ── */}
      <EditorErrorBoundary name="ToolOptions">
        <ToolOptionsBar
          mode={editor.mode}
          cityType={editor.cityForm.cityType}
          onCityTypeChange={(type) => editor.setCityForm((f) => ({ ...f, cityType: type }))}
          isNationalCapital={editor.cityForm.isNationalCapital}
          onCapitalChange={(val) => editor.setCityForm((f) => ({ ...f, isNationalCapital: val }))}
          subdivisionType={editor.subdivisionForm.type}
          onSubdivisionTypeChange={(type) => editor.setSubdivisionForm((f) => ({ ...f, type }))}
          subdivisionLevel={editor.subdivisionForm.level}
          onSubdivisionLevelChange={(level) => editor.setSubdivisionForm((f) => ({ ...f, level }))}
          poiCategory={editor.poiForm.category}
          onPoiCategoryChange={(cat) => editor.setPOIForm((f) => ({ ...f, category: cat }))}
          storyCategory={editor.storyPinForm.category}
          onStoryCategoryChange={(cat) => editor.setStoryPinForm((f) => ({ ...f, category: cat }))}
          labelFontSize={editor.mapLabelForm.fontSize}
          onLabelFontSizeChange={(size) =>
            editor.setMapLabelForm((f) => ({ ...f, fontSize: size }))
          }
          labelColor={editor.mapLabelForm.color}
          onLabelColorChange={(color) => editor.setMapLabelForm((f) => ({ ...f, color }))}
          labelBold={editor.mapLabelForm.fontWeight === "bold"}
          onLabelBoldChange={(bold) =>
            editor.setMapLabelForm((f) => ({ ...f, fontWeight: bold ? "bold" : "normal" }))
          }
          paintMode={paintMapMode}
          onPaintModeChange={(m) => setPaintMapMode(m as any)}
          selectedCount={editor.selectedIds.size}
          onDelete={
            editor.selectedIds.size > 0
              ? async () => {
                  if (!confirm(`Delete ${editor.selectedIds.size} selected features?`)) return;
                  await editor.bulkDeleteSelected();
                }
              : undefined
          }
        />
      </EditorErrorBoundary>

      {/* ── Main content: Rail + Canvas + Panel ── */}
      <div className="flex min-h-0 flex-1">
        {/* Left tool rail — desktop only */}
        <div className="hidden sm:block">
          <MapEditorToolbar
            mode={editor.mode}
            onModeChange={editor.setMode}
            disabled={toolsDisabled}
          />
        </div>

        {/* Map canvas */}
        <div className="relative min-w-0 flex-1">
          <EditorErrorBoundary name="Map">
            <EditorMap
              ref={mapRef}
              countryGeometry={editor.countryGeo?.geometry ?? null}
              countryCentroid={editor.countryGeo?.centroid ?? null}
              countryBbox={editor.countryGeo?.bbox ?? null}
              features={editor.allFeatures}
              mode={editor.mode}
              pendingCoordinates={editor.pendingCoordinates}
              pendingGeometry={editor.pendingGeometry}
              selectedFeature={editor.selectedFeature}
              onMapClick={editor.handleMapClick}
              onDrawComplete={editor.handleDrawComplete}
              onFeatureSelect={handleSelectFeature}
              onGeometryUpdate={editor.updateSubdivisionGeometry}
              worldMapLayers={worldMapLayers}
              showGrid={showGrid}
              paintColors={paintColors}
              routeWaypoints={editor.routeWaypoints}
              layerVisibility={{
                regions: layerStates.regions?.visible ?? true,
                cities: layerStates.cities?.visible ?? true,
                pois: layerStates.pois?.visible ?? true,
                stories: layerStates.stories?.visible ?? true,
                labels: layerStates.labels?.visible ?? true,
                routes: layerStates.routes?.visible ?? true,
              }}
            />

            {/* Paint mode legend */}
            {editor.mode === "paint" && (
              <div className="border-border bg-card/90 absolute bottom-8 left-3 z-20 rounded-lg border px-3 py-2 shadow-md backdrop-blur-sm">
                <div className="text-muted-foreground mb-1 text-[10px] font-semibold tracking-wider uppercase">
                  {paintMapMode === "wiki"
                    ? "Wiki Coverage"
                    : paintMapMode.charAt(0).toUpperCase() + paintMapMode.slice(1)}
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-muted-foreground text-[9px]">Low</span>
                  <div
                    className="h-2.5 w-24 rounded-sm"
                    style={{
                      background:
                        paintMapMode === "wiki"
                          ? "linear-gradient(to right, hsl(0,70%,50%), hsl(60,70%,50%), hsl(120,70%,50%))"
                          : "linear-gradient(to right, hsl(60,80%,50%), hsl(30,80%,45%), hsl(0,80%,40%))",
                    }}
                  />
                  <span className="text-muted-foreground text-[9px]">High</span>
                </div>
              </div>
            )}

            {/* Region stats tooltip — hover over subdivisions in view mode */}
            {hoveredFeature && (editor.mode === "view" || editor.mode === "paint") && (
              <div
                className="border-border bg-card/95 pointer-events-none absolute z-20 rounded-lg border px-3 py-2 shadow-lg backdrop-blur-sm"
                style={{
                  left: hoveredFeature.screenPos.x + 12,
                  top: hoveredFeature.screenPos.y - 8,
                  maxWidth: 220,
                }}
              >
                <div className="text-foreground text-xs font-semibold">
                  {hoveredFeature.feature.name}
                </div>
                <div className="text-muted-foreground mt-1 space-y-0.5 text-[10px]">
                  <div className="flex justify-between gap-3">
                    <span>Type</span>
                    <span className="text-foreground font-medium">
                      {hoveredFeature.feature.properties.subdivisionType ??
                        hoveredFeature.feature.type}
                    </span>
                  </div>
                  {hoveredFeature.feature.properties.areaSqKm != null && (
                    <div className="flex justify-between gap-3">
                      <span>Area</span>
                      <span className="text-foreground font-medium tabular-nums">
                        {Number(hoveredFeature.feature.properties.areaSqKm).toLocaleString()} km²
                      </span>
                    </div>
                  )}
                  {hoveredFeature.feature.properties.population != null && (
                    <div className="flex justify-between gap-3">
                      <span>Population</span>
                      <span className="text-foreground font-medium tabular-nums">
                        {Number(hoveredFeature.feature.properties.population).toLocaleString()}
                      </span>
                    </div>
                  )}
                  {hoveredFeature.feature.geometry && (
                    <div className="flex justify-between gap-3">
                      <span>Vertices</span>
                      <span className="text-foreground font-medium tabular-nums">
                        {countGeometryVertices(hoveredFeature.feature.geometry)}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Province import preview overlay — only shown during import wizard */}
            {editor.mode === "import-provinces" &&
              importer.currentProvinces.length > 0 &&
              mapInstance && (
                <ProvincePreviewLayer
                  map={mapInstance}
                  provinces={importer.currentProvinces}
                  countryBorder={importer.countryBorder}
                  visible
                />
              )}

            {/* Transport routes overlay */}
            {transportRouteData && transportRouteData.features.length > 0 && mapInstance && (
              <TransportOverlay map={mapInstance} routeData={transportRouteData} visible />
            )}
          </EditorErrorBoundary>
        </div>

        {/* Right panel — desktop only */}
        <div className="hidden sm:flex">
          <EditorErrorBoundary name="Panel">
            <EditorPanel
              mode={editor.mode}
              collapsed={panelCollapsed}
              onToggleCollapse={() => setPanelCollapsed((v) => !v)}
              featureCount={editor.allFeatures.length}
              featuresLoading={editor.featuresLoading}
              propertiesContent={
                <FeaturePropertyPanel
                  mode={editor.mode}
                  cityForm={editor.cityForm}
                  subdivisionForm={editor.subdivisionForm}
                  poiForm={editor.poiForm}
                  onCityFormChange={editor.setCityForm}
                  onSubdivisionFormChange={editor.setSubdivisionForm}
                  onPOIFormChange={editor.setPOIForm}
                  storyPinForm={editor.storyPinForm}
                  onStoryPinFormChange={editor.setStoryPinForm}
                  mapLabelForm={editor.mapLabelForm}
                  onMapLabelFormChange={editor.setMapLabelForm}
                  pendingCoordinates={editor.pendingCoordinates}
                  pendingGeometry={editor.pendingGeometry}
                  isMutating={editor.isMutating}
                  mutationError={editor.mutationError}
                  lastSavedAt={editor.lastSavedAt}
                  onSubmit={handleSubmit}
                  onCancel={editor.resetForm}
                  pointInfo={editor.pointInfo}
                  isPointInfoLoading={editor.isPendingPointInfoLoading}
                  countryId={countryId}
                />
              }
              featureListContent={
                <FeatureList
                  features={editor.allFeatures}
                  selectedFeature={editor.selectedFeature}
                  onSelectFeature={handleSelectFeature}
                  onEditFeature={handleEditFeature}
                  onDeleteFeature={handleDeleteFeature}
                  isLoading={editor.featuresLoading}
                  selectedIds={editor.selectedIds}
                  onToggleSelect={editor.toggleSelectId}
                  collapseAll={
                    editor.mode.startsWith("add-") ||
                    editor.mode.startsWith("edit-") ||
                    editor.mode === "paint"
                  }
                />
              }
              layersContent={
                <LayerPanel
                  layers={[
                    {
                      id: "border",
                      name: "Country Border",
                      icon: Globe,
                      visible: layerStates.border?.visible ?? true,
                      locked: false,
                    },
                    {
                      id: "regions",
                      name: "Regions",
                      icon: Hexagon,
                      visible: layerStates.regions?.visible ?? true,
                      locked: layerStates.regions?.locked ?? false,
                      opacity: layerStates.regions?.opacity ?? 0.6,
                    },
                    {
                      id: "cities",
                      name: "Cities",
                      icon: MapPin,
                      visible: layerStates.cities?.visible ?? true,
                      locked: layerStates.cities?.locked ?? false,
                    },
                    {
                      id: "pois",
                      name: "POIs",
                      icon: Landmark,
                      visible: layerStates.pois?.visible ?? true,
                      locked: layerStates.pois?.locked ?? false,
                    },
                    {
                      id: "stories",
                      name: "Story Pins",
                      icon: BookMarked,
                      visible: layerStates.stories?.visible ?? true,
                      locked: layerStates.stories?.locked ?? false,
                    },
                    {
                      id: "labels",
                      name: "Labels",
                      icon: TypeIcon,
                      visible: layerStates.labels?.visible ?? true,
                      locked: layerStates.labels?.locked ?? false,
                    },
                    {
                      id: "routes",
                      name: "Routes",
                      icon: Route,
                      visible: layerStates.routes?.visible ?? true,
                      locked: layerStates.routes?.locked ?? false,
                    },
                    {
                      id: "rivers",
                      name: "Rivers",
                      icon: Droplets,
                      visible: editorVisibleLayers.has("rivers"),
                      locked: false,
                      isBaseLayer: true,
                    },
                    {
                      id: "altitude",
                      name: "Altitude",
                      icon: MountainIcon,
                      visible: editorVisibleLayers.has("altitudes"),
                      locked: false,
                      isBaseLayer: true,
                    },
                    {
                      id: "grid",
                      name: "Grid",
                      icon: Grid3X3,
                      visible: showGrid,
                      locked: false,
                      isBaseLayer: true,
                    },
                  ]}
                  onToggleVisibility={(id) => {
                    if (id === "rivers") {
                      toggleEditorLayer("rivers");
                      return;
                    }
                    if (id === "altitude") {
                      toggleEditorLayer("altitudes");
                      return;
                    }
                    if (id === "grid") {
                      setShowGrid((v) => !v);
                      return;
                    }
                    setLayerStates((s) => ({
                      ...s,
                      [id]: { ...s[id]!, visible: !s[id]?.visible },
                    }));
                  }}
                  onToggleLock={(id) => {
                    setLayerStates((s) => ({ ...s, [id]: { ...s[id]!, locked: !s[id]?.locked } }));
                  }}
                  onOpacityChange={(id, opacity) => {
                    setLayerStates((s) => ({ ...s, [id]: { ...s[id]!, opacity } }));
                  }}
                  featureCounts={featureCounts}
                />
              }
              wikiContent={<WikiScannerPanel scanner={wikiScanner} />}
              importWizardContent={
                editor.mode === "import-provinces" ? (
                  <ProvinceImportWizard
                    importer={importer}
                    onComplete={() => {
                      editor.setMode("view");
                      editor.refetchFeatures();
                    }}
                    onCancel={() => {
                      importer.reset();
                      editor.setMode("view");
                    }}
                  />
                ) : undefined
              }
            />
          </EditorErrorBoundary>
        </div>
      </div>

      {/* ── Mobile: bottom tool rail ── */}
      <div className="sm:hidden">
        <MapEditorToolbar
          mode={editor.mode}
          onModeChange={editor.setMode}
          disabled={toolsDisabled}
          horizontal
        />
      </div>

      {/* ── Status Bar ── */}
      <EditorStatusBar
        cursorCoords={cursorCoords}
        mode={editor.mode}
        terrainInfo={
          cursorTerrainInfo
            ? {
                elevation: cursorTerrainInfo.elevation?.zoneName ?? null,
                climate: cursorTerrainInfo.climate?.climateName ?? null,
              }
            : editor.pointInfo
              ? {
                  elevation: editor.pointInfo.elevation?.zoneName ?? null,
                  climate: editor.pointInfo.climate?.climateName ?? null,
                }
              : null
        }
        zoom={cursorZoom}
        featureCount={editor.allFeatures.length}
      />

      {/* ── Mobile sheets ── */}
      {editor.mode !== "view" && editor.mode !== "import-provinces" && (
        <div className="sm:hidden">
          <MobileEditorSheet
            onClose={() => editor.resetForm()}
            title="Properties"
            isEditMode={
              editor.mode.startsWith("add-") ||
              editor.mode.startsWith("edit-") ||
              editor.mode === "paint"
            }
            featureListContent={
              <FeatureList
                features={editor.allFeatures}
                selectedFeature={editor.selectedFeature}
                onSelectFeature={handleSelectFeature}
                onEditFeature={handleEditFeature}
                onDeleteFeature={handleDeleteFeature}
                isLoading={editor.featuresLoading}
              />
            }
            wikiContent={<WikiScannerPanel scanner={wikiScanner} />}
          >
            <FeaturePropertyPanel
              mode={editor.mode}
              cityForm={editor.cityForm}
              subdivisionForm={editor.subdivisionForm}
              poiForm={editor.poiForm}
              onCityFormChange={editor.setCityForm}
              onSubdivisionFormChange={editor.setSubdivisionForm}
              onPOIFormChange={editor.setPOIForm}
              storyPinForm={editor.storyPinForm}
              onStoryPinFormChange={editor.setStoryPinForm}
              mapLabelForm={editor.mapLabelForm}
              onMapLabelFormChange={editor.setMapLabelForm}
              pendingCoordinates={editor.pendingCoordinates}
              pendingGeometry={editor.pendingGeometry}
              isMutating={editor.isMutating}
              mutationError={editor.mutationError}
              lastSavedAt={editor.lastSavedAt}
              onSubmit={handleSubmit}
              onCancel={editor.resetForm}
              pointInfo={editor.pointInfo}
              isPointInfoLoading={editor.isPendingPointInfoLoading}
              countryId={countryId}
            />
          </MobileEditorSheet>
        </div>
      )}
      {/* Batch Actions Bar — shown when multi-select is active */}
      {editor.selectedIds.size > 1 && (
        <BatchActionsBar
          selectedCount={editor.selectedIds.size}
          onBatchDelete={async () => {
            if (!confirm(`Delete ${editor.selectedIds.size} selected features?`)) return;
            await editor.bulkDeleteSelected();
          }}
          onDeselectAll={editor.clearMultiSelect}
          isMutating={editor.isMutating}
        />
      )}

      {/* Context Menu */}
      {contextMenu && (
        <FeatureContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          feature={contextMenu.feature}
          onEdit={() => {
            const feat = editor.allFeatures.find((f) => f.id === contextMenu.feature.id);
            if (feat) editor.startEditing(feat);
            setContextMenu(null);
          }}
          onDuplicate={() => {
            setContextMenu(null);
          }}
          onDelete={() => {
            editor.handleDeleteFeature(contextMenu.feature.id, contextMenu.feature.type as any);
            setContextMenu(null);
          }}
          onCopyCoords={() => {
            const feat = editor.allFeatures.find((f) => f.id === contextMenu.feature.id);
            if (feat && "coordinates" in feat && Array.isArray(feat.coordinates)) {
              navigator.clipboard.writeText(`${feat.coordinates[1]}, ${feat.coordinates[0]}`);
            }
            setContextMenu(null);
          }}
          onOpenWiki={
            contextMenu.feature.wikiPageTitle
              ? () => {
                  window.open(
                    `https://ixwiki.com/wiki/${encodeURIComponent(contextMenu.feature.wikiPageTitle!.replace(/ /g, "_"))}`,
                    "_blank"
                  );
                  setContextMenu(null);
                }
              : undefined
          }
          onClose={() => setContextMenu(null)}
        />
      )}

      {/* Keyboard Shortcut Sheet */}
      {showShortcuts && <KeyboardShortcutSheet onClose={() => setShowShortcuts(false)} />}
    </div>
  );
}

// ── Editor Loading Screen ────────────────────────────────────────────

function EditorLoadingScreen({ countryName }: { countryName?: string | null }) {
  const [dots, setDots] = useState("");

  useEffect(() => {
    const interval = setInterval(() => {
      setDots((prev) => (prev.length >= 3 ? "" : prev + "."));
    }, 400);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-[#0a1628]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(16,185,129,0.06)_0%,_transparent_70%)]" />

      <div className="relative z-10 flex flex-col items-center gap-6 text-center">
        {/* Animated rings */}
        <div className="relative h-24 w-24">
          <div className="absolute inset-0 animate-[spin_6s_linear_infinite] rounded-full border-2 border-dashed border-emerald-500/30" />
          <div className="absolute inset-3 animate-[spin_4s_linear_infinite_reverse] rounded-full border border-emerald-400/20" />
          <div className="absolute inset-6 animate-pulse rounded-full border border-emerald-300/15" />
          <div className="absolute inset-0 flex items-center justify-center">
            <Map className="h-8 w-8 text-emerald-400 drop-shadow-[0_0_8px_rgba(16,185,129,0.4)]" />
          </div>
        </div>

        <div>
          <h2 className="text-foreground text-sm font-semibold">Loading Map Editor{dots}</h2>
          {countryName && <p className="text-muted-foreground mt-1 text-xs">{countryName}</p>}
        </div>

        <div className="text-muted-foreground/60 flex gap-4 text-[10px]">
          <span>Geometry</span>
          <span>Features</span>
          <span>Layers</span>
        </div>
      </div>
    </div>
  );
}

// ── Helpers ─────────────────────────────────────────────────────────

function countGeometryVertices(geometry: object): number {
  const geo = geometry as { type: string; coordinates: unknown };
  if (!geo.coordinates) return 0;
  if (geo.type === "Polygon") {
    return (geo.coordinates as number[][][]).reduce((s, ring) => s + ring.length, 0);
  }
  if (geo.type === "MultiPolygon") {
    return (geo.coordinates as number[][][][]).reduce(
      (s, poly) => s + poly.reduce((s2, ring) => s2 + ring.length, 0),
      0
    );
  }
  return 0;
}

// ── Error Boundary ──────────────────────────────────────────────────

interface ErrorBoundaryProps {
  name: string;
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class EditorErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error) {
    console.error(`[EditorErrorBoundary:${this.props.name}]`, error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center gap-2 p-4 text-center">
          <AlertCircle className="h-5 w-5 text-red-500" />
          <p className="text-muted-foreground text-xs">{this.props.name} encountered an error</p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="bg-muted text-foreground hover:bg-accent rounded-md px-3 py-1 text-xs font-medium"
          >
            Retry
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
