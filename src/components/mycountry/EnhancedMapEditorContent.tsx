"use client";

/**
 * EnhancedMapEditorContent - Map editor for MyCountry.
 *
 * Allows country owners to add/edit subdivisions, cities, and POIs
 * within their country's borders. Uses MapLibre GL JS with draw tools.
 * Toolbar + property panel overlay the map (bottom-left).
 */

import { useRef, useCallback } from "react";
import dynamic from "next/dynamic";
import { Map, AlertCircle } from "lucide-react";
import { useCountryData } from "./primitives";
import { MyCountrySidebarLayout } from "./MyCountrySidebarLayout";
import type { MyCountrySection } from "./MyCountrySidebarNav";
import { useMapEditor } from "~/hooks/useMapEditor";
import { useMapData } from "~/hooks/useMapData";
import { MapEditorToolbar } from "~/components/maps/editor/MapEditorToolbar";
import { FeaturePropertyPanel } from "~/components/maps/editor/FeaturePropertyPanel";
import { FeatureList } from "~/components/maps/editor/FeatureList";
import type { EditorMapRef } from "~/components/maps/editor/EditorMap";

// Dynamic import for the map (requires browser APIs)
const EditorMap = dynamic(() => import("~/components/maps/editor/EditorMap"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center bg-slate-100">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-300 border-t-emerald-500" />
        <p className="text-sm text-slate-500">Loading map editor...</p>
      </div>
    </div>
  ),
});

interface EnhancedMapEditorContentProps {
  activeSection?: MyCountrySection;
  onNavigate?: (section: MyCountrySection) => void;
  notifications?: Partial<Record<string, number>>;
}

export function EnhancedMapEditorContent({
  activeSection,
  onNavigate,
  notifications,
}: EnhancedMapEditorContentProps) {
  const { country, isLoading: countryLoading } = useCountryData();
  const mapRef = useRef<EditorMapRef>(null);

  const editor = useMapEditor(country?.id);

  // Fetch base world map layers for editor context (altitude, rivers, lakes)
  const { mapLayers: worldMapLayers } = useMapData(["background", "altitudes", "rivers", "lakes"]);

  const handleSelectFeature = useCallback(
    (feature: (typeof editor.allFeatures)[number]) => {
      editor.setSelectedFeature(feature);
      if (feature.coordinates && mapRef.current) {
        mapRef.current.flyTo(feature.coordinates[0], feature.coordinates[1], 8);
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

  if (countryLoading || !country) {
    return null;
  }

  const isLinked = !!editor.linkage?.isLinked;
  const hasGeometry = !!editor.countryGeo;
  const toolsDisabled = !isLinked || !hasGeometry;

  const heroSection = (
    <div className="overflow-hidden rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600">
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="rounded-lg bg-white/20 p-2">
          <Map className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-white">
            Map Editor
          </h1>
          <p className="text-xs text-white/70">
            {country.name} — Add cities, regions, and points of interest
          </p>
        </div>
      </div>
    </div>
  );

  const sidebar = (
    <div className="space-y-4">
      <div>
        <div className="mb-2 px-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
          Your Features
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
    </div>
  );

  return (
    <MyCountrySidebarLayout
      heroSection={heroSection}
      sidebarExtra={sidebar}
      activeSection={activeSection}
      onNavigate={onNavigate}
      notifications={notifications}
    >
      {!isLinked ? (
        <div className="flex h-96 items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50">
          <div className="text-center">
            <AlertCircle className="mx-auto mb-3 h-10 w-10 text-slate-300" />
            <p className="text-sm font-medium text-slate-600">
              No map geometry linked
            </p>
            <p className="mt-1 text-xs text-slate-400">
              Your country needs to be linked to a map feature before you can use the editor.
              Contact an administrator to assign your country&apos;s territory.
            </p>
          </div>
        </div>
      ) : !hasGeometry ? (
        <div className="flex h-96 items-center justify-center rounded-xl bg-slate-50">
          <div className="flex flex-col items-center gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-300 border-t-emerald-500" />
            <p className="text-sm text-slate-500">Loading map geometry...</p>
          </div>
        </div>
      ) : (
        <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm" style={{ height: "calc(100vh - 220px)", minHeight: 500 }}>
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
            worldMapLayers={worldMapLayers}
          />

          {/* Toolbar + property panel overlay — bottom-left of map */}
          <div className="absolute bottom-3 left-3 z-10 flex flex-col gap-2" style={{ maxWidth: 260 }}>
            {/* Property panel (visible when in add mode) */}
            {editor.mode !== "view" && (
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
            )}

            {/* Compact tool buttons */}
            <MapEditorToolbar
              mode={editor.mode}
              onModeChange={editor.setMode}
              disabled={toolsDisabled}
            />
          </div>
        </div>
      )}
    </MyCountrySidebarLayout>
  );
}
