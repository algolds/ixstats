"use client";
import React from "react";
import dynamic from "next/dynamic";
import { SystemRestart as Loader } from "iconoir-react";
import { FacetMaterial } from "~/components/ui/facet";
import { ProvincePreviewLayer } from "~/components/maps/editor/province-importer";
import { TransportOverlay } from "~/components/maps/overlays/TransportOverlay";
import type { Map as MapLibreMap } from "maplibre-gl";
import type { EditorMapRef } from "~/components/maps/editor/EditorMap";
import { toPolygonGeometry } from "~/components/maps/editor/utils/map-helpers";
import { RegionHoverTooltip } from "~/components/maps/editor/components/RegionHoverTooltip";
import { HypsometricElevationHUD } from "~/components/maps/editor/components/HypsometricElevationHUD";
import { useMapRealm } from "~/components/maps/core/MapRealmContext";
import { EditorErrorBoundary } from "~/components/maps/editor/utils/editor-overlay-helpers";
import type { EditorFeature } from "~/hooks/useMapEditor";
import type { MapEditorOverlayReturnState } from "./MapEditorSidebarPanels";

const MapContainer = dynamic(
  () => import("~/components/maps/core/MapContainer").then((m) => m.MapContainer),
  {
    ssr: false,
    loading: () => (
      <div className="bg-fill-3 flex h-full items-center justify-center" role="status">
        <p className="text-label-secondary text-footnote">Loading map canvas…</p>
      </div>
    ),
  }
);

const EditorMap = dynamic(() => import("~/components/maps/editor/EditorMap"), {
  ssr: false,
  loading: () => (
    <div className="bg-fill-3 flex h-full items-center justify-center" role="status">
      <p className="text-label-secondary text-body">Loading map editor…</p>
    </div>
  ),
});

/** Feature layers whose visibility / lock / opacity the Layers panel controls. */
const LAYER_KEYS = [
  "regions",
  "cities",
  "pois",
  "stories",
  "labels",
  "routes",
  "geography",
] as const;

type LayerStates = MapEditorOverlayReturnState["layerStates"];

/**
 * Stable per-layer props for EditorMap: value-equal objects keep their identity, so the map
 * layers are not re-uploaded on unrelated editor re-renders.
 */
function useLayerProps(layerStates: LayerStates) {
  return React.useMemo(() => {
    const layerVisibility: Record<string, boolean> = {
      border: layerStates.border?.visible ?? true,
    };
    const lockedLayers: Record<string, boolean> = {};
    const layerOpacity: Record<string, number> = {};
    for (const k of LAYER_KEYS) {
      layerVisibility[k] = layerStates[k]?.visible ?? true;
      lockedLayers[k] = layerStates[k]?.locked ?? false;
      layerOpacity[k] = layerStates[k]?.opacity ?? (k === "regions" ? 0.6 : 1);
    }
    return { layerVisibility, lockedLayers, layerOpacity };
  }, [layerStates]);
}

function BorderEditorLoading({ countryName }: { countryName?: string | null }) {
  return (
    <div
      role="status"
      className="bg-surface absolute inset-0 z-30 flex items-center justify-center"
    >
      <FacetMaterial
        material="regular"
        className="rounded-card flex items-center gap-3 px-5 py-4 text-left"
      >
        <Loader aria-hidden className="text-label-secondary h-5 w-5 animate-spin" />
        <div>
          <h2 className="text-label text-headline">Loading border editor…</h2>
          {countryName && (
            <p className="text-label-secondary text-footnote mt-0.5">{countryName}</p>
          )}
        </div>
      </FacetMaterial>
    </div>
  );
}

function CountryEditorMap({
  state,
  mapRef,
  onMapReady,
}: {
  state: MapEditorOverlayReturnState;
  mapRef: React.RefObject<EditorMapRef | null>;
  onMapReady: (map: MapLibreMap | null) => void;
}) {
  const {
    editor,
    worldMapLayers,
    editorVisibleLayers,
    layerStates,
    showGrid,
    showGuides,
    snapEnabled,
    snapTolerance,
    handleSelectFeature,
    setContextMenu,
  } = state;

  const { layerVisibility, lockedLayers, layerOpacity } = useLayerProps(layerStates);
  const countryGeometry = React.useMemo(
    () => toPolygonGeometry(editor.countryGeo?.geometry as object | null),
    [editor.countryGeo?.geometry]
  );
  const handleEditorMapClick = React.useCallback(
    (lng: number, lat: number) => editor.handleMapClick([lng, lat]),
    [editor]
  );
  const handleUpdatePointCoordinates = React.useCallback(
    (
      id: string,
      type: "city" | "poi" | "storyPin" | "mapLabel" | "peak",
      coords: [number, number]
    ) => editor.updatePointCoordinates(type, id, coords),
    [editor]
  );
  const handleFeatureContextMenu = React.useCallback(
    (feature: EditorFeature, screenPos: { x: number; y: number }) => {
      setContextMenu({ x: screenPos.x, y: screenPos.y, feature });
    },
    [setContextMenu]
  );

  // The in-progress polyline shown on the map: route waypoints, river path or split line.
  const activePolyline =
    editor.mode === "split-subdivision"
      ? editor.splitLine
      : editor.mode === "add-river"
        ? editor.riverPath
        : editor.routeWaypoints;

  return (
    <EditorMap
      ref={mapRef}
      onMapReady={onMapReady}
      countryGeometry={countryGeometry}
      countryCentroid={editor.countryGeo?.centroid ?? null}
      countryBbox={editor.countryGeo?.bbox ?? null}
      features={editor.allFeatures}
      mode={editor.mode}
      pendingCoordinates={editor.pendingCoordinates}
      selectedFeature={editor.selectedFeature}
      selectedIds={editor.selectedIds}
      onToggleSelect={editor.toggleSelectId}
      onMapClick={handleEditorMapClick}
      isPickingLocation={editor.isPickingLocation}
      onDrawComplete={editor.handleDrawComplete}
      onGeometryUpdate={editor.updateSubdivisionGeometry}
      onVertexEditDirtyChange={state.setVertexEditDirty}
      updatePointCoordinates={handleUpdatePointCoordinates}
      onFeatureSelect={handleSelectFeature}
      worldMapLayers={worldMapLayers}
      editorVisibleLayers={editorVisibleLayers}
      showGrid={showGrid}
      routeWaypoints={activePolyline}
      drawRouteType={editor.routeType}
      editingRouteId={editor.editingRouteId}
      editingRouteVertices={editor.editingRouteVertices}
      onRouteVerticesUpdate={editor.setEditingRouteVertices}
      onRouteEditCommit={editor.commitRouteEdit}
      onRouteEditCancel={editor.cancelRouteEdit}
      layerVisibility={layerVisibility}
      lockedLayers={lockedLayers}
      layerOpacity={layerOpacity}
      onFeatureContextMenu={handleFeatureContextMenu}
      gapFeatures={editor.gapFeatures}
      showGaps={editor.showGaps}
      emptyRegionsFeatures={editor.emptyRegionsFeatures}
      showEmptyRegions={editor.showGaps}
      rulerPoints={editor.rulerPoints}
      lassoGeometry={editor.lassoGeometry}
      setLassoGeometry={editor.setLassoGeometry}
      onAddRulerPoint={editor.addRulerPoint}
      onApplyLassoSelection={editor.applyLassoSelection}
      onApplyRectSelection={editor.applyRectSelection}
      lassoTool={editor.lassoTool}
      guides={editor.guides}
      setGuides={editor.setGuides}
      showGuides={showGuides}
      snapEnabled={snapEnabled}
      snapTolerance={snapTolerance}
    />
  );
}

function CanvasOverlays({
  state,
  activeEditorMap,
  initialMapInstance,
  historicalYear,
}: {
  state: MapEditorOverlayReturnState;
  activeEditorMap: MapLibreMap | null;
  initialMapInstance: MapLibreMap | null | undefined;
  historicalYear: number | null | undefined;
}) {
  const { editor, importer, mapInstance, layerStates, transportRouteData } = state;
  const transportMap = activeEditorMap ?? mapInstance ?? initialMapInstance;

  return (
    <>
      <RegionHoverTooltip features={editor.allFeatures} editorMode={editor.mode} />

      {(editor.mode === "ruler" || (editor.rulerPoints && editor.rulerPoints.length > 0)) && (
        <HypsometricElevationHUD onClose={editor.clearRuler} />
      )}

      {editor.mode === "import-provinces" &&
        importer.currentProvinces.length > 0 &&
        mapInstance && (
          <ProvincePreviewLayer
            map={mapInstance}
            provinces={importer.currentProvinces}
            countryBorder={importer.countryBorder}
            visible
            cities={importer.alignedCities}
          />
        )}

      {transportRouteData && transportMap && (
        <TransportOverlay
          map={transportMap}
          routeData={transportRouteData}
          visible={layerStates.routes?.visible ?? true}
          selectedRouteId={state.selectedRouteId}
          onRouteClick={state.handleRouteClick}
          maxBuiltYear={historicalYear}
        />
      )}
    </>
  );
}

interface EditorCanvasProps {
  state: MapEditorOverlayReturnState;
  mapRef: React.RefObject<EditorMapRef | null>;
  isWorldMode: boolean;
  initialMapInstance: MapLibreMap | null | undefined;
  historicalYear: number | null | undefined;
  onSharedWorldMap: (map: MapLibreMap | null) => void;
}

/** The map surface: the world map (border editing) or the country editor map, plus its overlays. */
export function EditorCanvas({
  state,
  mapRef,
  isWorldMode,
  initialMapInstance,
  historicalYear,
  onSharedWorldMap,
}: EditorCanvasProps) {
  const realm = useMapRealm();
  const [activeEditorMap, setActiveEditorMap] = React.useState<MapLibreMap | null>(null);
  const { setMapInstance } = state;
  const handleEditorMapReady = React.useCallback(
    (map: MapLibreMap | null) => {
      setActiveEditorMap(map);
      setMapInstance(map);
    },
    [setMapInstance]
  );

  const isBorderEdit = state.activeEditorMode === "border_edit";

  return (
    <>
      {isWorldMode && isBorderEdit && state.borderState.isLoading && (
        <BorderEditorLoading countryName={state.countryInfo?.name} />
      )}
      <EditorErrorBoundary name="Map">
        {!isWorldMode ? (
          <CountryEditorMap state={state} mapRef={mapRef} onMapReady={handleEditorMapReady} />
        ) : initialMapInstance ? (
          // A map warm from the parent MapContainer is reused, so no second WebGL context is created.
          <div className="pointer-events-none h-full w-full" />
        ) : (
          <MapContainer
            showControls={true}
            showTools={false}
            showPopup={false}
            selectedCountryId={state.activeCountryId}
            onCountrySelect={state.handleMapSelect}
            disableCountrySelect={isBorderEdit}
            forceFlatProjection={true}
            controlledVisibleLayers={state.editorVisibleLayers}
            onToggleLayer={state.toggleEditorLayer}
            hideEditButtons={true}
            onMapReady={onSharedWorldMap}
            realm={realm}
          />
        )}
        <CanvasOverlays
          state={state}
          activeEditorMap={activeEditorMap}
          initialMapInstance={initialMapInstance}
          historicalYear={historicalYear}
        />
      </EditorErrorBoundary>
    </>
  );
}
