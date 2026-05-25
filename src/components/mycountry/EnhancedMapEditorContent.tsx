"use client";

/**
 * EnhancedMapEditorContent - Full-page map editor for MyCountry.
 *
 * Layout: compact top breadcrumb bar with integrated tools,
 * full-width map, collapsible right panel for property forms
 * and feature list. Province importer floats as a draggable panel.
 */

import { useRef, useCallback, useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { ArrowLeft, AlertCircle, Map, ChevronRight, List, Loader2 } from "lucide-react";
import { useCountryData } from "./primitives";
import type { MyCountrySection } from "./MyCountrySidebarNav";
import { useMapEditor } from "~/hooks/useMapEditor";
import { useMapData } from "~/hooks/useMapData";
import { useProvinceImporter } from "~/hooks/useProvinceImporter";
import { MapEditorToolbar } from "~/components/maps/editor/MapEditorToolbar";
import { FeaturePropertyPanel } from "~/components/maps/editor/FeaturePropertyPanel";
import { FeatureList } from "~/components/maps/editor/FeatureList";
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
  const [sidePanel, setSidePanel] = useState<"none" | "features" | "properties">("none");

  const editor = useMapEditor(country?.id);
  const importer = useProvinceImporter(country?.id ?? "");

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
  const { mapLayers: worldMapLayers } = useMapData(["background", "altitudes", "rivers", "lakes"]);

  // Auto-open properties panel when entering an add/edit mode
  const prevModeRef = useRef(editor.mode);
  useEffect(() => {
    const prev = prevModeRef.current;
    prevModeRef.current = editor.mode;
    if (editor.mode !== "view" && editor.mode !== "import-provinces" && prev === "view") {
      setSidePanel("properties");
    } else if (editor.mode === "view" && prev !== "view") {
      setSidePanel("none");
    }
  }, [editor.mode]);

  const handleSelectFeature = useCallback(
    (feature: (typeof editor.allFeatures)[number]) => {
      editor.setSelectedFeature(feature);
      if (feature.coordinates && mapRef.current) {
        mapRef.current.flyTo(feature.coordinates[0], feature.coordinates[1], 8);
      }
      if (feature.type === "subdivision" && feature.geometry) {
        editor.startEditing(feature);
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
        case "f":
          e.preventDefault();
          setSidePanel((v) => (v === "features" ? "none" : "features"));
          break;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [editor, importer, onNavigate, toolsDisabled, handleDeleteFeature]);

  if (countryLoading || !country) {
    return null;
  }

  const showPropertyPanel =
    sidePanel === "properties" && editor.mode !== "view" && editor.mode !== "import-provinces";
  const showFeatureList = sidePanel === "features";
  const hasSidePanel = showPropertyPanel || showFeatureList;

  return (
    <div className="bg-background fixed inset-0 z-40 flex flex-col">
      {/* ── Top bar ── */}
      <div className="border-border bg-card flex h-11 shrink-0 items-center gap-2 border-b px-3">
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
        />

        {/* Right: side panel toggles */}
        <div className="ml-auto flex items-center gap-0.5">
          <button
            onClick={() => setSidePanel((v) => (v === "features" ? "none" : "features"))}
            className={`flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium transition-colors ${
              showFeatureList
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-accent hover:text-foreground"
            }`}
            title="Feature list"
          >
            <List className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Features</span>
            {editor.allFeatures.length > 0 && (
              <span className="bg-muted text-muted-foreground rounded-full px-1.5 text-[10px] font-medium tabular-nums">
                {editor.allFeatures.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* ── Content: map + optional side panel ── */}
      <div className="relative flex min-h-0 flex-1">
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

        {/* ── Right side panel ── */}
        {hasSidePanel && (
          <div className="border-border bg-card w-64 shrink-0 overflow-y-auto border-l lg:w-72">
            {showFeatureList && (
              <div className="p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
                    Features
                  </span>
                  <button
                    onClick={() => setSidePanel("none")}
                    className="text-muted-foreground hover:bg-accent hover:text-foreground rounded p-0.5"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
                <FeatureList
                  features={editor.allFeatures}
                  selectedFeature={editor.selectedFeature}
                  onSelectFeature={handleSelectFeature}
                  onEditFeature={handleEditFeature}
                  onDeleteFeature={handleDeleteFeature}
                  isLoading={editor.featuresLoading}
                />
              </div>
            )}

            {showPropertyPanel && (
              <div className="p-3">
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
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
