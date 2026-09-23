"use client";

import React, { useCallback, useMemo, memo } from "react";
import { BorderEditorPanel } from "~/components/maps/editor/BorderEditorPanel";
import { FeaturePropertyPanel } from "~/components/maps/editor/FeaturePropertyPanel";
import { FeatureInspector, type FeaturePropertyUpdates } from "./inspector/FeatureInspector";
import { DocumentInspector } from "./inspector/DocumentInspector";
import { WorldCountryProfile } from "./WorldCountryProfile";
import { featureIdToDisplayName } from "~/lib/maps/map-utils";
import { api } from "~/trpc/react";

import type { Polygon, MultiPolygon } from "geojson";
import type { SelectedCountry } from "~/components/maps/core/IxWorldMap";
import type {
  BorderEditorState,
  BorderEditorActions,
  MapEditorInstance,
  EditorFeature,
  EditorFeatureDetails,
  PropertiesPanelCountry,
  FeatureType,
} from "../types/editor-state";

interface PropertiesPanelContentProps {
  isWorldMode: boolean;
  activeEditorMode: "view" | "border_edit";
  activeCountryId: string | null;
  mapSelectedCountry: SelectedCountry | null;
  borderState: BorderEditorState;
  borderActions: BorderEditorActions;
  editor: MapEditorInstance;
  selectedCountryName: string;
  countryInfo?: { name?: string; flag?: string | null; flagUrl?: string | null } | null;
  featureDetails?: EditorFeatureDetails | null;
  wikiPageTitle: string;
  setWikiPageTitle: (title: string) => void;
  handleLinkFeature?: (
    featureId: string,
    featureType: string,
    wikiTitle: string
  ) => Promise<void> | void;
  updatePropertiesMutation: {
    isPending: boolean;
    mutateAsync: (args: {
      featureId: string;
      displayName?: string;
      countryId?: string | null;
      properties?: Record<string, string | number | boolean | null>;
      wikiPageTitle?: string | null;
    }) => Promise<{ ok?: boolean; success?: boolean } | void>;
  };
  isEditingJson: boolean;
  setIsEditingJson: (editing: boolean) => void;
  propertiesJsonString: string;
  setPropertiesJsonString: (str: string) => void;
  jsonError: string | null;
  setJsonError: (err: string | null) => void;
  parsedProperties: Record<string, string | number | boolean | null> | null;
  handleSaveFeatureProperties: (props?: Record<string, string | number | boolean | null>) => void;
  selectedRouteId: string | null;
  setSelectedRouteId: (id: string | null) => void;
  handleSubmit: () => void;
  enterBorderEdit?: (
    initialMode?: "select" | "vertex_edit" | "split" | "merge" | "trace" | "brush"
  ) => void;
  isUnclaimed?: boolean;
  createCountryFromShapeAction?: (name: string) => void;
  createCountryFromShapePending?: boolean;
  assignCountryId?: string;
  setAssignCountryId?: (id: string) => void;
  handleAssignLink?: (featureId: string) => void;
  assignMutation?: {
    isPending: boolean;
    mutateAsync: (args: { countryId: string; featureId: string }) => Promise<object | void>;
  };
  availableCountries?: PropertiesPanelCountry[];
  brushTargetId?: string | null;
  setBrushTargetId?: (id: string | null) => void;
  editableFeatureName: string;
  setEditableFeatureName: (name: string) => void;
  editableCountryLinkageId: string;
  setEditableCountryLinkageId: (id: string) => void;
  countries?: PropertiesPanelCountry[];
  onEditRoute?: (routeId: string) => void;
  handleEditRoute?: (routeId: string) => void;
}

export const PropertiesPanelContent = memo(function PropertiesPanelContent({
  isWorldMode,
  activeEditorMode,
  activeCountryId,
  mapSelectedCountry,
  borderState,
  borderActions,
  editor,
  selectedCountryName,
  countryInfo,
  featureDetails,
  wikiPageTitle,
  setWikiPageTitle,
  handleLinkFeature: _handleLinkFeature,
  updatePropertiesMutation,
  isEditingJson,
  setIsEditingJson,
  propertiesJsonString,
  setPropertiesJsonString,
  jsonError,
  setJsonError,
  parsedProperties,
  handleSaveFeatureProperties,
  selectedRouteId,
  setSelectedRouteId,
  handleSubmit,
  enterBorderEdit,
  isUnclaimed,
  createCountryFromShapeAction,
  createCountryFromShapePending,
  assignCountryId,
  setAssignCountryId,
  handleAssignLink,
  assignMutation,
  availableCountries,
  brushTargetId,
  setBrushTargetId,
  editableFeatureName,
  setEditableFeatureName,
  editableCountryLinkageId,
  setEditableCountryLinkageId,
  countries,
  onEditRoute,
  handleEditRoute,
}: PropertiesPanelContentProps) {
  const effectiveOnEditRoute = onEditRoute ?? handleEditRoute;
  const utils = api.useUtils();
  const updateRouteMutation = api.transport.updateRoute.useMutation({
    onSuccess: () => {
      void utils.transport.getCountryRoutes.invalidate();
      void utils.transport.getAllRoutesGeoJSON.invalidate();
      void utils.transport.getTransportStats.invalidate();
    },
  });

  const resolvedCountryName = useMemo(() => {
    return (
      countryInfo?.name ||
      editor.countryGeo?.country?.name ||
      editor.countryGeo?.displayName ||
      (editor.countryGeo?.featureId ? featureIdToDisplayName(editor.countryGeo.featureId) : "") ||
      selectedCountryName ||
      countries?.find((c) => c.id === activeCountryId)?.name ||
      availableCountries?.find((c) => c.id === activeCountryId)?.name ||
      mapSelectedCountry?.displayName ||
      (activeCountryId ? featureIdToDisplayName(activeCountryId) : "") ||
      ""
    );
  }, [
    countryInfo?.name,
    editor.countryGeo?.country?.name,
    editor.countryGeo?.displayName,
    editor.countryGeo?.featureId,
    selectedCountryName,
    countries,
    availableCountries,
    activeCountryId,
    mapSelectedCountry?.displayName,
  ]);

  const handleFeatureInspectorUpdate = useCallback(
    async (updates: FeaturePropertyUpdates) => {
      if (!editor.selectedFeature) return;
      const feat = editor.selectedFeature;

      if ("wikiPageTitle" in updates && updatePropertiesMutation) {
        await updatePropertiesMutation.mutateAsync({
          featureId: feat.id,
          displayName: typeof updates.name === "string" ? updates.name : feat.name,
          wikiPageTitle: (updates.wikiPageTitle as string | null) ?? null,
        });
      }

      if (feat.type === "city") {
        await editor.submitEditCity({
          name: typeof updates.name === "string" ? updates.name : undefined,
          cityType: typeof updates.cityType === "string" ? updates.cityType : undefined,
          population: typeof updates.population === "number" ? updates.population : undefined,
          isNationalCapital:
            typeof updates.isNationalCapital === "boolean" ? updates.isNationalCapital : undefined,
          isSubdivisionCapital:
            typeof updates.isSubdivisionCapital === "boolean"
              ? updates.isSubdivisionCapital
              : undefined,
          subdivisionId:
            typeof updates.subdivisionId === "string" ? updates.subdivisionId : undefined,
        });
      } else if (feat.type === "subdivision") {
        await editor.submitEditSubdivision({
          name: typeof updates.name === "string" ? updates.name : undefined,
          type: typeof updates.type === "string" ? updates.type : undefined,
          level: typeof updates.level === "number" ? updates.level : undefined,
          capital: typeof updates.capital === "string" ? updates.capital : undefined,
          population: typeof updates.population === "number" ? updates.population : undefined,
        });
      } else if (feat.type === "poi" || feat.type === "storyPin") {
        await editor.submitEditPOI({
          name: typeof updates.name === "string" ? updates.name : undefined,
          category: typeof updates.category === "string" ? updates.category : undefined,
          description: typeof updates.description === "string" ? updates.description : undefined,
        });
      } else if (feat.type === "peak") {
        if (editor.submitEditPeak) {
          await editor.submitEditPeak({
            name: typeof updates.name === "string" ? updates.name : undefined,
            elevation:
              typeof updates.elevationMeters === "number" ? updates.elevationMeters : undefined,
          });
        }
      } else if (feat.type === "river") {
        if (editor.submitEditRiver) {
          await editor.submitEditRiver({
            name: typeof updates.name === "string" ? updates.name : undefined,
          });
        }
      } else if (feat.type === "lake") {
        if (editor.submitEditLake) {
          await editor.submitEditLake({
            name: typeof updates.name === "string" ? updates.name : undefined,
          });
        }
      } else if (feat.type === "route") {
        const effectiveCountryId =
          activeCountryId ?? (feat.properties?.countryId as string | undefined);
        if (effectiveCountryId) {
          await updateRouteMutation.mutateAsync({
            id: feat.id,
            countryId: effectiveCountryId,
            name: typeof updates.name === "string" ? updates.name : undefined,
            routeType: typeof updates.routeType === "string" ? updates.routeType : undefined,
            status:
              typeof updates.status === "string"
                ? (updates.status as "planned" | "under_construction" | "operational" | "abandoned")
                : undefined,
            isInternational:
              typeof updates.isInternational === "boolean" ? updates.isInternational : undefined,
          });
          editor.setSelectedFeature({
            ...feat,
            name: typeof updates.name === "string" ? updates.name : feat.name,
            properties: {
              ...feat.properties,
              ...updates,
            },
          });
        }
      }
    },
    [editor, updatePropertiesMutation, activeCountryId, updateRouteMutation]
  );

  // 1. Multi-feature selection (Pathfinder and batch overview)
  if (editor.selectedIds.size > 1) {
    const selectedSubdivisions = editor.allFeatures.filter(
      (f: EditorFeature) => f.type === "subdivision" && editor.selectedIds.has(f.id)
    );

    return (
      <div className="space-y-4 px-3 py-3">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
            Selection
          </span>
          <span className="bg-primary/10 text-primary rounded px-1.5 py-0.5 text-[10px] font-medium">
            {editor.selectedIds.size} features selected
          </span>
        </div>

        {selectedSubdivisions.length > 1 && (
          <div className="border-border/60 bg-muted/10 space-y-3 rounded-lg border p-3">
            <div className="flex flex-col gap-1">
              <span className="text-foreground text-xs font-semibold">Combine regions</span>
              <span className="text-muted-foreground text-[10px]">
                Merge, subtract, or find overlapping areas of selected regions.
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => editor.pathfinderOperation("union")}
                className="bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer rounded-md py-1.5 text-center text-xs font-medium shadow-sm transition-colors"
                title="Merge selected regions into one"
              >
                Union
              </button>
              <button
                onClick={() => editor.pathfinderOperation("subtract")}
                className="bg-muted text-foreground hover:bg-accent cursor-pointer rounded-md py-1.5 text-center text-xs font-medium shadow-sm transition-colors"
                title="Subtract subsequent regions from the first"
              >
                Subtract
              </button>
              <button
                onClick={() => editor.pathfinderOperation("intersect")}
                className="bg-muted text-foreground hover:bg-accent cursor-pointer rounded-md py-1.5 text-center text-xs font-medium shadow-sm transition-colors"
                title="Keep only the overlapping parts"
              >
                Intersect
              </button>
            </div>
          </div>
        )}

        <div className="border-border/60 bg-muted/10 space-y-2 rounded-lg border p-3">
          <label className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
            Selected items
          </label>
          <div className="max-h-48 space-y-1 overflow-y-auto">
            {editor.allFeatures
              .filter((f: EditorFeature) => editor.selectedIds.has(f.id))
              .map((f: EditorFeature) => (
                <div key={f.id} className="flex items-center justify-between text-xs">
                  <span className="text-foreground/80 max-w-[180px] truncate">
                    {f.name || f.id}
                  </span>
                  <span className="text-muted-foreground font-mono text-[10px] uppercase">
                    {f.type}
                  </span>
                </div>
              ))}
          </div>
        </div>
      </div>
    );
  }

  const renderFeaturePropertyPanel = () => (
    <FeaturePropertyPanel
      mode={editor.mode}
      cityForm={editor.cityForm}
      subdivisionForm={editor.subdivisionForm}
      poiForm={editor.poiForm}
      onCityFormChange={editor.setCityForm}
      onSubdivisionFormChange={editor.setSubdivisionForm}
      onPOIFormChange={editor.setPOIForm}
      peakForm={editor.peakForm}
      onPeakFormChange={editor.setPeakForm}
      riverForm={editor.riverForm}
      onRiverFormChange={editor.setRiverForm}
      lakeForm={editor.lakeForm}
      onLakeFormChange={editor.setLakeForm}
      selectedFeature={editor.selectedFeature}
      pendingCoordinates={editor.pendingCoordinates}
      pendingGeometry={editor.pendingGeometry}
      isMutating={editor.isMutating}
      error={editor.mutationError ? { message: editor.mutationError } : null}
      lastSavedAt={editor.lastSavedAt ? editor.lastSavedAt.getTime() : null}
      onSubmit={handleSubmit}
      onCancel={editor.resetForm}
      pendingPointInfo={null}
      isPendingPointInfoLoading={editor.isPendingPointInfoLoading}
      countryId={activeCountryId ?? undefined}
      routeWaypoints={editor.routeWaypoints}
      finishRoute={editor.finishRoute}
      undoLastWaypoint={editor.undoLastWaypoint}
      clearRouteWaypoints={editor.clearRouteWaypoints}
      selectedRouteId={selectedRouteId}
      onSelectRouteId={setSelectedRouteId}
      onEditRoute={effectiveOnEditRoute}
      editingRouteId={editor.editingRouteId}
      editingRouteVertices={editor.editingRouteVertices}
      onRouteVerticesUpdate={editor.setEditingRouteVertices}
      onRouteEditCommit={editor.commitRouteEdit}
      onRouteEditCancel={editor.cancelRouteEdit}
      allFeatures={editor.allFeatures}
      isPickingLocation={editor.isPickingLocation}
      setIsPickingLocation={editor.setIsPickingLocation}
    />
  );

  // 1.5. Route editing or creation mode active: Route directly to TransportPropertyForm
  if (editor.mode === "add-route" || editor.mode === "edit-route") {
    return renderFeaturePropertyPanel();
  }

  // 2. Single-feature selected: Desktop Pro Inspector (replaces modal barrier)
  if (editor.selectedFeature) {
    return (
      <FeatureInspector
        feature={editor.selectedFeature}
        countryId={activeCountryId ?? undefined}
        allFeatures={editor.allFeatures}
        countries={countries || availableCountries || []}
        onClose={() => {
          editor.setSelectedFeature(null);
          editor.setMode("view");
        }}
        onUpdateFeature={handleFeatureInspectorUpdate}
        onUpdateCoordinates={(coords) =>
          editor.updatePointCoordinates(
            editor.selectedFeature?.type as FeatureType,
            editor.selectedFeature?.id,
            coords
          )
        }
        onDelete={() => editor.handleDeleteFeature(editor.selectedFeature!)}
        onDuplicate={() => editor.duplicateFeature(editor.selectedFeature!)}
        onPromoteCapital={editor.promoteCapital}
        onReverseRoute={editor.reverseRoute}
        onEditRoute={effectiveOnEditRoute}
        onPathfinderOperation={editor.pathfinderOperation}
        isPickingLocation={editor.isPickingLocation}
        onTogglePickLocation={() => editor.setIsPickingLocation(!editor.isPickingLocation)}
        isMutating={editor.isMutating}
      />
    );
  }

  // 3. World mode specialized views
  if (isWorldMode) {
    if (activeEditorMode === "border_edit") {
      return (
        <BorderEditorPanel
          featureId={borderState.featureId}
          displayName={selectedCountryName || borderState.featureId || ""}
          geometry={borderState.geometry}
          neighbors={borderState.neighbors}
          mergeTargets={borderState.mergeTargets}
          onToggleMergeTarget={borderActions.toggleMergeTarget}
          mode={borderState.mode}
          areaKm2={borderState.areaKm2}
          isDirty={borderState.isDirty}
          brushTargetId={brushTargetId ?? null}
          onBrushTargetChange={setBrushTargetId ?? (() => {})}
        />
      );
    }

    if (editor.mode !== "view") {
      return renderFeaturePropertyPanel();
    }

    if (mapSelectedCountry) {
      return (
        <WorldCountryProfile
          mapSelectedCountry={mapSelectedCountry}
          isUnclaimed={isUnclaimed}
          selectedCountryName={selectedCountryName}
          editableFeatureName={editableFeatureName}
          setEditableFeatureName={setEditableFeatureName}
          editableCountryLinkageId={editableCountryLinkageId}
          setEditableCountryLinkageId={setEditableCountryLinkageId}
          countries={countries}
          wikiPageTitle={wikiPageTitle}
          setWikiPageTitle={setWikiPageTitle}
          featureDetails={featureDetails ?? null}
          handleSaveFeatureProperties={handleSaveFeatureProperties}
          updatePropertiesMutation={updatePropertiesMutation}
          isEditingJson={isEditingJson}
          setIsEditingJson={setIsEditingJson}
          propertiesJsonString={propertiesJsonString}
          setPropertiesJsonString={setPropertiesJsonString}
          jsonError={jsonError}
          setJsonError={setJsonError}
          parsedProperties={parsedProperties}
          assignCountryId={assignCountryId}
          setAssignCountryId={setAssignCountryId}
          handleAssignLink={handleAssignLink}
          assignMutation={assignMutation}
          availableCountries={availableCountries}
          createCountryFromShapeAction={createCountryFromShapeAction}
          createCountryFromShapePending={createCountryFromShapePending}
          enterBorderEdit={enterBorderEdit}
          countryGeometry={(editor?.countryGeo?.geometry as Polygon | MultiPolygon | null) ?? null}
          countryId={activeCountryId ?? ""}
        />
      );
    }

    return (
      <DocumentInspector
        countryName={resolvedCountryName}
        countryId={activeCountryId ?? undefined}
        countryGeoDisplayName={
          editor.countryGeo?.country?.name || editor.countryGeo?.displayName || null
        }
        allFeatures={editor.allFeatures}
        areaKm2={editor.countryGeo?.areaSqKm ?? null}
        onModeChange={editor.setMode}
      />
    );
  }

  // 4. Creation / drawing mode active (non-world mode)
  if (editor.mode !== "view") {
    return renderFeaturePropertyPanel();
  }

  // 5. Empty-state: Canvas Document Inspector
  const resolvedFlagUrl =
    countryInfo?.flagUrl || countryInfo?.flag || editor.countryGeo?.country?.flag || null;

  return (
    <DocumentInspector
      countryName={resolvedCountryName}
      countryId={activeCountryId ?? undefined}
      countryGeoDisplayName={
        editor.countryGeo?.country?.name || editor.countryGeo?.displayName || null
      }
      flagUrl={resolvedFlagUrl}
      allFeatures={editor.allFeatures}
      areaKm2={editor.countryGeo?.areaSqKm ?? null}
      onModeChange={editor.setMode}
    />
  );
});
