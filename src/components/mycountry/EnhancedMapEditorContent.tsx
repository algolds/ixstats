// @ts-nocheck
"use client";

/**
 * EnhancedMapEditorContent - Full-page map editor for MyCountry.
 *
 * Layout: unified collapsible left/right panels, full-width map,
 * Glassmorphic styling.
 */

import { useRef, useCallback, useState, useEffect, useMemo } from "react";
import dynamic from "next/dynamic";
import { ArrowLeft, AlertCircle, Map, ChevronRight, Loader2, Globe } from "lucide-react";
import { useCountryData } from "./primitives";
import type { MyCountrySection } from "./MyCountrySidebarNav";
import { useMapEditor } from "~/hooks/useMapEditor";
import { useMapData } from "~/hooks/useMapData";
import { useProvinceImporter } from "~/hooks/useProvinceImporter";
import { MapEditorToolbar } from "~/components/maps/editor/MapEditorToolbar";
import { FeaturePropertyPanel } from "~/components/maps/editor/FeaturePropertyPanel";
import { FeatureList } from "~/components/maps/editor/FeatureList";
import { EditorPanel } from "~/components/maps/editor/EditorPanel";
import { LayerPanel } from "~/components/maps/editor/LayerPanel";
import { WikiScannerPanel } from "~/components/maps/editor/WikiScannerPanel";
import { useWikiScanner } from "~/hooks/useWikiScanner";
import { api } from "~/trpc/react";
import {
  ProvinceImportWizard,
  ProvincePreviewLayer,
  FloatingImportPanel,
} from "~/components/maps/editor/province-importer";
import type { EditorMapRef } from "~/components/maps/editor/EditorMap";

// Dynamic import for the map (requires browser APIs)
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

interface EnhancedMapEditorContentProps {
  activeSection?: MyCountrySection;
  onNavigate?: (section: MyCountrySection) => void;
  notifications?: Partial<Record<string, number>>;
}

export function EnhancedMapEditorContent({ onNavigate }: EnhancedMapEditorContentProps) {
  const { country, isLoading: countryLoading } = useCountryData();
  const mapRef = useRef<EditorMapRef>(null);

  const [leftPanelCollapsed, setLeftPanelCollapsed] = useState(false);
  const [rightPanelCollapsed, setRightPanelCollapsed] = useState(false);

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

  const editor = useMapEditor(country?.id);
  const importer = useProvinceImporter(country?.id ?? "");

  // Wiki scanner mutations
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
      if (!country?.id) return;
      if (featureType === "city") {
        await updateCityWiki.mutateAsync({ id: featureId, wikiPageTitle: wikiTitle });
      } else if (featureType === "poi") {
        await updatePOIWiki.mutateAsync({ id: featureId, wikiPageTitle: wikiTitle });
      } else if (featureType === "storyPin") {
        await updateStoryPinWiki.mutateAsync({ id: featureId, wikiPageTitle: wikiTitle });
      } else if (featureType === "mapLabel") {
        await updateMapLabelWiki.mutateAsync({ id: featureId, wikiPageTitle: wikiTitle });
      }
    },
    [country?.id, updateCityWiki, updatePOIWiki, updateStoryPinWiki, updateMapLabelWiki]
  );

  const wikiScanner = useWikiScanner({
    features: editor.allFeatures,
    onLinkFeature: handleLinkFeature,
  });

  // Track the live map instance for province preview layer
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

  // Fetch base world map layers for editor context
  const { mapLayers: worldMapLayers, toggleLayer } = useMapData([
    "background",
    "altitudes",
    "rivers",
    "lakes",
  ]);

  const handleSelectFeature = useCallback(
    (feature: (typeof editor.allFeatures)[number]) => {
      editor.setSelectedFeature(feature);
      if (feature.coordinates && mapRef.current) {
        mapRef.current.flyTo(feature.coordinates[0], feature.coordinates[1], 8);
      }
      editor.startEditing(feature);
      setRightPanelCollapsed(false);
    },
    [editor]
  );

  const handleEditFeature = useCallback(
    (feature: (typeof editor.allFeatures)[number]) => {
      editor.startEditing(feature);
      setRightPanelCollapsed(false);
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
    }
  }, [editor]);

  const linkageLoading = editor.linkageLoading;
  const geometryLoading = editor.geometryLoading;
  const isLinked = !!editor.linkage?.isLinked;
  const hasGeometry = !!editor.countryGeo;
  const toolsDisabled = !isLinked || !hasGeometry;

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      const inInput = tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";

      if (e.key === "Escape") {
        if (editor.mode === "import-provinces") {
          importer.reset();
          editor.setMode("view");
        } else if (editor.mode !== "view") {
          editor.resetForm();
        } else {
          onNavigate?.("overview");
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

      if (inInput) return;
      if (toolsDisabled) return;

      switch (e.key.toLowerCase()) {
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
        case "i":
          e.preventDefault();
          editor.setMode(editor.mode === "import-provinces" ? "view" : "import-provinces");
          break;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [editor, importer, onNavigate, toolsDisabled, handleDeleteFeature]);

  if (countryLoading || !country) {
    return null;
  }

  const showRightPanel = editor.mode !== "view" && editor.mode !== "import-provinces";

  return (
    <div className="bg-background fixed inset-0 z-40 flex flex-col">
      {/* ── Top bar ── */}
      <div className="border-border bg-card/75 flex h-11 shrink-0 items-center gap-2 border-b px-3 backdrop-blur-md">
        {/* Left: back + country name */}
        <button
          onClick={() => onNavigate?.("overview")}
          className="text-muted-foreground hover:bg-accent hover:text-foreground rounded-md p-1.5 transition-colors"
          title="Back to overview"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>

        <div className="text-muted-foreground hidden items-center gap-1.5 text-xs sm:flex">
          <Map className="h-3.5 w-3.5 text-emerald-500" />
          <span className="text-foreground font-semibold">{country.name}</span>
          <ChevronRight className="h-3 w-3" />
          <span>Editor</span>
        </div>

        {/* Center: tools */}
        <div className="bg-border mx-1 hidden h-5 w-px sm:block" />
        <MapEditorToolbar
          mode={editor.mode}
          onModeChange={editor.setMode}
          disabled={toolsDisabled}
          horizontal={true}
        />
      </div>

      {/* ── Content: left panel + map + right panel ── */}
      <div className="relative flex min-h-0 flex-1">
        {/* Left collapsible panel */}
        {!toolsDisabled && (
          <EditorPanel
            side="left"
            mode={editor.mode}
            collapsed={leftPanelCollapsed}
            onToggleCollapse={() => setLeftPanelCollapsed((v) => !v)}
            featureCount={editor.allFeatures.length}
            featuresLoading={editor.featuresLoading}
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
                    name: "Subdivisions",
                    icon: Globe,
                    visible: layerStates.regions?.visible ?? true,
                    locked: false,
                    opacity: layerStates.regions?.opacity,
                  },
                  {
                    id: "cities",
                    name: "Cities",
                    icon: Globe,
                    visible: layerStates.cities?.visible ?? true,
                    locked: false,
                  },
                  {
                    id: "pois",
                    name: "Points of Interest",
                    icon: Globe,
                    visible: layerStates.pois?.visible ?? true,
                    locked: false,
                  },
                  {
                    id: "stories",
                    name: "Story Pins",
                    icon: Globe,
                    visible: layerStates.stories?.visible ?? true,
                    locked: false,
                  },
                  {
                    id: "labels",
                    name: "Map Labels",
                    icon: Globe,
                    visible: layerStates.labels?.visible ?? true,
                    locked: false,
                  },
                ]}
                onToggleVisibility={(id) => {
                  if (id === "altitude" || id === "rivers" || id === "lakes") {
                    toggleLayer(id === "altitude" ? "altitudes" : id);
                  }
                  setLayerStates((s) => ({
                    ...s,
                    [id]: { ...s[id]!, visible: !s[id]?.visible },
                  }));
                }}
                onToggleLock={() => {}}
                onOpacityChange={(id, opacity) => {
                  setLayerStates((s) => ({
                    ...s,
                    [id]: { ...s[id]!, opacity },
                  }));
                }}
                featureCounts={{
                  regions: editor.allFeatures.filter((f) => f.type === "subdivision").length,
                  cities: editor.allFeatures.filter((f) => f.type === "city").length,
                  pois: editor.allFeatures.filter((f) => f.type === "poi").length,
                  stories: editor.allFeatures.filter((f) => f.type === "storyPin").length,
                  labels: editor.allFeatures.filter((f) => f.type === "mapLabel").length,
                }}
              />
            }
            wikiContent={<WikiScannerPanel scanner={wikiScanner} />}
            importWizardContent={
              <ProvinceImportWizard
                importer={importer}
                onClose={() => {
                  importer.reset();
                  editor.setMode("view");
                }}
                onComplete={() => {
                  importer.reset();
                  editor.setMode("view");
                  editor.refetchFeatures();
                }}
              />
            }
          />
        )}

        {/* Map area */}
        <div className="relative min-w-0 flex-1" data-map-container>
          {linkageLoading ? (
            <div className="bg-muted flex h-full items-center justify-center">
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
                <p className="text-muted-foreground text-sm">Checking map linkage...</p>
              </div>
            </div>
          ) : !isLinked ? (
            <div className="bg-muted flex h-full items-center justify-center">
              <div className="text-center">
                <AlertCircle className="text-muted-foreground/30 mx-auto mb-3 h-10 w-10" />
                <p className="text-foreground text-sm font-medium">No map geometry linked</p>
                <p className="text-muted-foreground mt-1 max-w-xs text-xs">
                  Your country needs to be linked to a map feature before you can use the editor.
                  Contact an administrator to assign your country&apos;s territory.
                </p>
              </div>
            </div>
          ) : geometryLoading ? (
            <div className="bg-muted flex h-full items-center justify-center">
              <div className="flex flex-col items-center gap-3">
                <div className="border-muted-foreground/20 h-8 w-8 animate-spin rounded-full border-4 border-t-emerald-500" />
                <p className="text-muted-foreground text-sm">Loading map geometry...</p>
              </div>
            </div>
          ) : (
            <>
              <EditorMap
                ref={mapRef}
                countryGeometry={editor.countryGeo?.geometry ?? null}
                countryCentroid={editor.countryGeo?.centroid ?? null}
                countryBbox={editor.countryGeo?.bbox ?? null}
                countryColor={country.flagUrl ? undefined : "#c8e6c9"}
                features={editor.allFeatures}
                mode={editor.mode}
                pendingCoordinates={editor.pendingCoordinates}
                onMapClick={editor.handleMapClick}
                onDrawComplete={editor.handleDrawComplete}
                selectedFeature={editor.selectedFeature}
                onFeatureSelect={handleSelectFeature}
                onGeometryUpdate={editor.updateSubdivisionGeometry}
                worldMapLayers={worldMapLayers}
                layerVisibility={{
                  regions: layerStates.regions?.visible ?? true,
                  cities: layerStates.cities?.visible ?? true,
                  pois: layerStates.pois?.visible ?? true,
                  stories: layerStates.stories?.visible ?? true,
                  labels: layerStates.labels?.visible ?? true,
                  routes: layerStates.routes?.visible ?? true,
                }}
              />

              {/* Province preview layer */}
              <ProvincePreviewLayer
                map={mapInstance}
                provinces={importer.currentProvinces}
                countryBorder={importer.countryBorder}
                visible={editor.mode === "import-provinces"}
              />

              {/* Province import wizard — floating panel */}
              {editor.mode === "import-provinces" && (
                <FloatingImportPanel
                  onClose={() => {
                    importer.reset();
                    editor.setMode("view");
                  }}
                >
                  <ProvinceImportWizard
                    importer={importer}
                    onClose={() => {
                      importer.reset();
                      editor.setMode("view");
                    }}
                    onComplete={() => {
                      importer.reset();
                      editor.setMode("view");
                      editor.refetchFeatures();
                    }}
                  />
                </FloatingImportPanel>
              )}
            </>
          )}
        </div>

        {/* Right collapsible panel (Properties & Form Context) */}
        {showRightPanel && (
          <EditorPanel
            side="right"
            mode={editor.mode}
            collapsed={rightPanelCollapsed}
            onToggleCollapse={() => setRightPanelCollapsed((v) => !v)}
            propertiesContent={
              <FeaturePropertyPanel
                mode={editor.mode}
                pendingCoordinates={editor.pendingCoordinates}
                pendingGeometry={editor.pendingGeometry}
                cityForm={editor.cityForm}
                onCityFormChange={editor.setCityForm}
                subdivisionForm={editor.subdivisionForm}
                onSubdivisionFormChange={editor.setSubdivisionForm}
                poiForm={editor.poiForm}
                onPOIFormChange={editor.setPOIForm}
                onSubmit={handleSubmit}
                onCancel={editor.resetForm}
                isMutating={editor.isMutating}
                error={editor.mutationError}
                lastSavedAt={editor.lastSavedAt}
                pendingPointInfo={editor.pendingPointInfo}
                isPendingPointInfoLoading={editor.isPendingPointInfoLoading}
                allFeatures={editor.allFeatures}
              />
            }
          />
        )}
      </div>
    </div>
  );
}
