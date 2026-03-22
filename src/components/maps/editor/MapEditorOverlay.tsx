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
import { ArrowLeft, AlertCircle, Map, ChevronRight, Sparkles, Train, RefreshCw, Minimize2, Grid3X3, Crosshair, Droplets, Mountain as MountainIcon, Undo2, Redo2 } from "lucide-react";
import { useUser } from "~/context/auth-context";
import { isSystemOwner } from "~/lib/system-owner-constants";
import { useMapEditor } from "~/hooks/useMapEditor";
import { useMapData } from "~/hooks/useMapData";
import { useProvinceImporter } from "~/hooks/useProvinceImporter";
import { MapEditorToolbar } from "~/components/maps/editor/MapEditorToolbar";
import { FeaturePropertyPanel } from "~/components/maps/editor/FeaturePropertyPanel";
import { FeatureList } from "~/components/maps/editor/FeatureList";
import { EditorPanel } from "~/components/maps/editor/EditorPanel";
import { EditorStatusBar } from "~/components/maps/editor/EditorStatusBar";
import { MobileEditorSheet } from "~/components/maps/editor/MobileEditorSheet";
import {
  ProvinceImportWizard,
  ProvincePreviewLayer,
} from "~/components/maps/editor/province-importer";
import { TransportOverlay } from "~/components/maps/overlays/TransportOverlay";
import type { EditorMapRef } from "~/components/maps/editor/EditorMap";
import type { MapLayerData } from "~/components/maps/core/IxWorldMap";
import { api } from "~/trpc/react";

const EditorMap = dynamic(() => import("~/components/maps/editor/EditorMap"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center bg-muted">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-muted-foreground/20 border-t-emerald-500" />
        <p className="text-sm text-muted-foreground">Loading map editor...</p>
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
  const [panelCollapsed, setPanelCollapsed] = useState(false);
  const [cursorCoords, setCursorCoords] = useState<[number, number] | null>(null);
  const [cursorZoom, setCursorZoom] = useState<number | undefined>(undefined);
  const [forgeMode, setForgeMode] = useState(false);
  const [showGrid, setShowGrid] = useState(false);
  const [paintMapMode, setPaintMapMode] = useState<"population" | "development" | "resources" | "wiki">("population");
  const [paintSelectedRegion, setPaintSelectedRegion] = useState<string | null>(null);
  const [paintCompareRegion, setPaintCompareRegion] = useState<string | null>(null);
  const [hoveredFeature, setHoveredFeature] = useState<{
    feature: (typeof editor.allFeatures)[number];
    screenPos: { x: number; y: number };
  } | null>(null);

  // Admin detection for Forge Mode access
  const { user: authUser } = useUser();
  const isAdmin = !!authUser && (
    isSystemOwner(authUser.id) ||
    (typeof authUser.publicMetadata?.role === "string" && ["admin", "owner", "staff"].includes(authUser.publicMetadata.role))
  );

  // Admin mutations (only used in forge mode)
  const generateTransport = api.transport.generateRoutes.useMutation();
  const recalculateGeo = api.geo.recalculateGeoProfiles.useMutation();

  // Simplify all regions (available to country owner)
  const simplifyAll = api.geo.simplifySubdivisions.useMutation({
    onSuccess: () => { editor.refetchFeatures(); },
  });

  const editor = useMapEditor(countryId);
  const importer = useProvinceImporter(countryId);

  // Fetch country name for display
  const { data: countryInfo } = api.countries.getByIdBasic.useQuery(
    { id: countryId },
    { staleTime: 5 * 60_000 }
  );

  // Track live map instance for province preview layer
  const [mapInstance, setMapInstance] = useState<import("maplibre-gl").Map | null>(null);
  useEffect(() => {
    const interval = setInterval(() => {
      const m = mapRef.current?.getMap() ?? null;
      if (m) {
        setMapInstance(m);
        clearInterval(interval);
      }
    }, 200);
    return () => clearInterval(interval);
  }, []);

  // Editor's own layer data — same layers as main map, independent visibility
  const {
    mapLayers: editorMapLayers,
    toggleLayer: toggleEditorLayer,
    visibleLayers: editorVisibleLayers,
  } = useMapData([
    "background",
    "altitudes",
    "rivers",
    "lakes",
  ]);
  const worldMapLayers = editorMapLayers;

  // Transport routes for this country (shown as overlay lines)
  const { data: transportRouteData } = api.transport.getCountryRoutes.useQuery(
    { countryId },
    { staleTime: 60_000, gcTime: 5 * 60_000 },
  );

  // Paint mode: fetch subdivision stats
  const { data: subdivisionStats } = api.geo.getSubdivisionStats.useQuery(
    { countryId },
    { enabled: editor.mode === "paint", staleTime: 60_000 },
  );

  // Paint mode: compute color map from stats + selected mode
  const paintColors = useMemo(() => {
    if (editor.mode !== "paint" || !subdivisionStats || subdivisionStats.length === 0) return undefined;

    const colors: Record<string, string> = {};
    const stats = subdivisionStats;

    // Get max values for normalization
    const maxPop = Math.max(1, ...stats.map(s => s.population ?? 0));
    const maxDev = Math.max(1, ...stats.map(s => s.developmentScore));
    const maxRes = Math.max(1, ...stats.map(s => s.resourceCount));

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
      colors[s.id] = paintMapMode === "wiki"
        ? `hsl(${Math.round(t * 120)}, 70%, 50%)` // red(0) → green(120)
        : `hsl(${Math.round((1 - t) * 60)}, 80%, ${55 - t * 15}%)`;  // yellow(60) → red(0), darker for high
    }

    return colors;
  }, [editor.mode, subdivisionStats, paintMapMode]);

  // Debounced cursor terrain query — fires 300ms after cursor stops moving
  const [debouncedCoords, setDebouncedCoords] = useState<[number, number] | null>(null);
  useEffect(() => {
    if (!cursorCoords) { setDebouncedCoords(null); return; }
    const timer = setTimeout(() => setDebouncedCoords(cursorCoords), 300);
    return () => clearTimeout(timer);
  }, [cursorCoords]);

  const { data: cursorTerrainInfo } = api.geo.getPointInfo.useQuery(
    { lng: debouncedCoords?.[0] ?? 0, lat: debouncedCoords?.[1] ?? 0 },
    { enabled: !!debouncedCoords, staleTime: 30_000, gcTime: 60_000 },
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
          const geo = feature.geometry as import("geojson").Polygon | import("geojson").MultiPolygon;
          const ring = geo.type === "Polygon"
            ? geo.coordinates[0]
            : geo.coordinates[0]?.[0];
          if (ring && ring.length > 0) {
            let cx = 0, cy = 0;
            for (const pt of ring) { cx += pt[0]!; cy += pt[1]!; }
            cx /= ring.length; cy /= ring.length;
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
      case "add-city": editor.submitCity(); break;
      case "add-subdivision": editor.submitSubdivision(); break;
      case "add-poi": editor.submitPOI(); break;
      case "edit-city": editor.submitEditCity(); break;
      case "edit-subdivision": editor.submitEditSubdivision(); break;
      case "edit-poi": editor.submitEditPOI(); break;
    }
  }, [editor]);

  const isLinked = !!editor.linkage?.isLinked;
  const hasGeometry = !!editor.countryGeo;
  const toolsDisabled = !isLinked || !hasGeometry;

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      const inInput = tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";

      // Undo/Redo (works even in input fields)
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        // Undo handled by history system — visual indicator only for now
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && e.shiftKey) {
        e.preventDefault();
        // Redo handled by history system — visual indicator only for now
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

      if (inInput || toolsDisabled) return;

      switch (e.key.toLowerCase()) {
        case "v": e.preventDefault(); editor.setMode("view"); break;
        case "1": case "c": e.preventDefault(); editor.setMode(editor.mode === "add-city" ? "view" : "add-city"); break;
        case "2": case "r": e.preventDefault(); editor.setMode(editor.mode === "add-subdivision" ? "view" : "add-subdivision"); break;
        case "3": case "p": e.preventDefault(); editor.setMode(editor.mode === "add-poi" ? "view" : "add-poi"); break;
        case "4": case "t": e.preventDefault(); editor.setMode(editor.mode === "add-route" ? "view" : "add-route"); break;
        case "i": e.preventDefault(); editor.setMode(editor.mode === "import-provinces" ? "view" : "import-provinces"); break;
        case "f": e.preventDefault(); setPanelCollapsed((v) => !v); break;
        case "g": e.preventDefault(); setShowGrid((v) => !v); break;
        case "b": e.preventDefault(); editor.setMode(editor.mode === "paint" ? "view" : "paint"); break;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [editor, importer, onExit, toolsDisabled, handleDeleteFeature]);

  // Track map cursor position + hovered features for status bar & tooltip
  const handleMapMouseMove = useCallback((e: any) => {
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
  }, [mapInstance, editor.mode, editor.allFeatures, hoveredFeature]);

  useEffect(() => {
    const map = mapInstance;
    if (!map) return;
    map.on("mousemove", handleMapMouseMove);
    map.on("zoomend", () => setCursorZoom(map.getZoom()));
    setCursorZoom(map.getZoom());
    return () => { map.off("mousemove", handleMapMouseMove); };
  }, [mapInstance, handleMapMouseMove]);

  // ── Not linked warning ──
  if (!isLinked) {
    return (
      <div className="absolute inset-0 z-30 flex flex-col bg-background">
        <div className="flex h-10 items-center gap-2 border-b border-border bg-card px-3">
          <button onClick={onExit} className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />
          </button>
          <span className="text-sm font-semibold">{countryInfo?.name ?? "Country"}</span>
        </div>
        <div className="flex flex-1 items-center justify-center p-6">
          <div className="mx-auto max-w-sm text-center">
            <AlertCircle className="mx-auto mb-3 h-10 w-10 text-amber-500" />
            <h3 className="font-semibold text-foreground">Country Not Linked to Map</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              This country needs to be linked to a political map feature before editing.
              Contact an admin to link it.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ── Editor Loading Screen ──
  const editorReady = hasGeometry && !editor.featuresLoading;

  return (
    <div className="absolute inset-0 z-30 flex flex-col bg-background">
      {/* Loading splash — fades out when data is ready */}
      {!editorReady && (
        <EditorLoadingScreen countryName={countryInfo?.name} />
      )}

      {/* ── Title Bar ── */}
      <div className="flex h-10 flex-shrink-0 items-center gap-2 border-b border-border bg-card px-3">
        <button
          onClick={onExit}
          className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          title="Close Editor (Esc)"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Map className="h-3.5 w-3.5 text-emerald-500" />
          <span className="font-semibold text-foreground">
            {countryInfo?.name ?? "…"}
          </span>
          <ChevronRight className="h-3 w-3" />
          <span>{forgeMode ? "Forge Mode" : "Map Editor"}</span>
        </div>

        {/* Undo/Redo */}
        <div className="ml-auto flex items-center gap-0.5 mr-1">
          <button
            disabled={!editor.historyCanUndo}
            className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-30 disabled:pointer-events-none"
            title="Undo (Ctrl+Z)"
          >
            <Undo2 className="h-3.5 w-3.5" />
          </button>
          <button
            disabled={!editor.historyCanRedo}
            className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-30 disabled:pointer-events-none"
            title="Redo (Ctrl+Shift+Z)"
          >
            <Redo2 className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="h-4 w-px bg-border" />

        {/* Map controls in header — layers, grid, center */}
        <div className="flex items-center gap-0.5 ml-1">
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

          <div className="mx-0.5 h-4 w-px bg-border" />

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
            className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
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
        {editor.allFeatures.some(f => f.type === "subdivision") && (
          <div className="mr-1">
            <button
              onClick={async () => {
                try {
                  const result = await simplifyAll.mutateAsync({
                    countryId,
                    tolerance: 0.005,
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
          <div className={`${editor.allFeatures.some(f => f.type === "subdivision") ? "" : "ml-auto"} flex items-center gap-1`}>
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
                      alert(`Generated ${result.routesCreated} routes (${result.totalLengthKm} km)`);
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
                  <RefreshCw className={`h-3 w-3 ${recalculateGeo.isPending ? "animate-spin" : ""}`} />
                  Recalc
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* ── Main content: Rail + Canvas + Panel ── */}
      <div className="flex flex-1 min-h-0">
        {/* Left tool rail — desktop only */}
        <div className="hidden sm:block">
          <MapEditorToolbar
            mode={editor.mode}
            onModeChange={editor.setMode}
            disabled={toolsDisabled}
          />
        </div>

        {/* Map canvas */}
        <div className="relative flex-1 min-w-0">
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
          />

          {/* Paint mode legend */}
          {editor.mode === "paint" && (
            <div className="absolute bottom-8 left-3 z-20 rounded-lg border border-border bg-card/90 px-3 py-2 shadow-md backdrop-blur-sm">
              <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {paintMapMode === "wiki" ? "Wiki Coverage" : paintMapMode.charAt(0).toUpperCase() + paintMapMode.slice(1)}
              </div>
              <div className="flex items-center gap-1">
                <span className="text-[9px] text-muted-foreground">Low</span>
                <div
                  className="h-2.5 w-24 rounded-sm"
                  style={{
                    background: paintMapMode === "wiki"
                      ? "linear-gradient(to right, hsl(0,70%,50%), hsl(60,70%,50%), hsl(120,70%,50%))"
                      : "linear-gradient(to right, hsl(60,80%,50%), hsl(30,80%,45%), hsl(0,80%,40%))",
                  }}
                />
                <span className="text-[9px] text-muted-foreground">High</span>
              </div>
            </div>
          )}

          {/* Region stats tooltip — hover over subdivisions in view mode */}
          {hoveredFeature && (editor.mode === "view" || editor.mode === "paint") && (
            <div
              className="pointer-events-none absolute z-20 rounded-lg border border-border bg-card/95 px-3 py-2 shadow-lg backdrop-blur-sm"
              style={{
                left: hoveredFeature.screenPos.x + 12,
                top: hoveredFeature.screenPos.y - 8,
                maxWidth: 220,
              }}
            >
              <div className="text-xs font-semibold text-foreground">{hoveredFeature.feature.name}</div>
              <div className="mt-1 space-y-0.5 text-[10px] text-muted-foreground">
                <div className="flex justify-between gap-3">
                  <span>Type</span>
                  <span className="font-medium text-foreground">
                    {hoveredFeature.feature.properties.subdivisionType ?? hoveredFeature.feature.type}
                  </span>
                </div>
                {hoveredFeature.feature.properties.areaSqKm != null && (
                  <div className="flex justify-between gap-3">
                    <span>Area</span>
                    <span className="font-medium text-foreground tabular-nums">
                      {Number(hoveredFeature.feature.properties.areaSqKm).toLocaleString()} km²
                    </span>
                  </div>
                )}
                {hoveredFeature.feature.properties.population != null && (
                  <div className="flex justify-between gap-3">
                    <span>Population</span>
                    <span className="font-medium text-foreground tabular-nums">
                      {Number(hoveredFeature.feature.properties.population).toLocaleString()}
                    </span>
                  </div>
                )}
                {hoveredFeature.feature.geometry && (
                  <div className="flex justify-between gap-3">
                    <span>Vertices</span>
                    <span className="font-medium text-foreground tabular-nums">
                      {countGeometryVertices(hoveredFeature.feature.geometry)}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Province import preview overlay — only shown during import wizard */}
          {editor.mode === "import-provinces" && importer.currentProvinces.length > 0 && mapInstance && (
            <ProvincePreviewLayer
              map={mapInstance}
              provinces={importer.currentProvinces}
              countryBorder={importer.countryBorder}
              visible
            />
          )}

          {/* Transport routes overlay */}
          {transportRouteData && transportRouteData.features.length > 0 && mapInstance && (
            <TransportOverlay
              map={mapInstance}
              routeData={transportRouteData}
              visible
            />
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
            propertiesContent={
              <FeaturePropertyPanel
                mode={editor.mode}
                cityForm={editor.cityForm}
                subdivisionForm={editor.subdivisionForm}
                poiForm={editor.poiForm}
                onCityFormChange={editor.setCityForm}
                onSubdivisionFormChange={editor.setSubdivisionForm}
                onPOIFormChange={editor.setPOIForm}
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
              />
            }
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
        terrainInfo={cursorTerrainInfo ? {
          elevation: cursorTerrainInfo.elevation?.zoneName ?? null,
          climate: cursorTerrainInfo.climate?.climateName ?? null,
        } : editor.pointInfo ? {
          elevation: editor.pointInfo.elevation?.zoneName ?? null,
          climate: editor.pointInfo.climate?.climateName ?? null,
        } : null}
        zoom={cursorZoom}
        featureCount={editor.allFeatures.length}
      />

      {/* ── Mobile sheets ── */}
      {editor.mode !== "view" && editor.mode !== "import-provinces" && (
        <div className="sm:hidden">
          <MobileEditorSheet
            onClose={() => editor.resetForm()}
            title="Properties"
          >
            <FeaturePropertyPanel
              mode={editor.mode}
              cityForm={editor.cityForm}
              subdivisionForm={editor.subdivisionForm}
              poiForm={editor.poiForm}
              onCityFormChange={editor.setCityForm}
              onSubdivisionFormChange={editor.setSubdivisionForm}
              onPOIFormChange={editor.setPOIForm}
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
          <h2 className="text-sm font-semibold text-foreground">
            Loading Map Editor{dots}
          </h2>
          {countryName && (
            <p className="mt-1 text-xs text-muted-foreground">{countryName}</p>
          )}
        </div>

        <div className="flex gap-4 text-[10px] text-muted-foreground/60">
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
      (s, poly) => s + poly.reduce((s2, ring) => s2 + ring.length, 0), 0
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
          <p className="text-xs text-muted-foreground">
            {this.props.name} encountered an error
          </p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="rounded-md bg-muted px-3 py-1 text-xs font-medium text-foreground hover:bg-accent"
          >
            Retry
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
