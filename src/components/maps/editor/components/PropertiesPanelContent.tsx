"use client";

import React, { useState } from "react";
import {
  EditPencil as Pencil,
  ViewGrid as Grid3X3,
  ColorPicker as Paintbrush,
} from "iconoir-react";
import { useRouter } from "next/navigation";
import { BorderEditorPanel } from "~/components/maps/editor/BorderEditorPanel";
import { FeaturePropertyPanel } from "~/components/maps/editor/FeaturePropertyPanel";
import { ProvinceGeneratorPanel } from "~/components/maps/editor/components/ProvinceGeneratorPanel";
import { JsonViewer } from "~/components/ui/json-viewer";

interface PropertiesPanelContentProps {
  isWorldMode: boolean;
  activeEditorMode: "view" | "border_edit";
  activeCountryId: string | null;
  mapSelectedCountry: any;
  borderState: any;
  borderActions: any;
  editor: any;
  selectedCountryName: string;
  featureDetails: any;
  wikiPageTitle: string;
  setWikiPageTitle: (title: string) => void;
  handleLinkFeature: () => void;
  updatePropertiesMutation: any;
  isEditingJson: boolean;
  setIsEditingJson: (editing: boolean) => void;
  propertiesJsonString: string;
  setPropertiesJsonString: (str: string) => void;
  jsonError: string | null;
  setJsonError: (err: string | null) => void;
  parsedProperties: any;
  handleSaveFeatureProperties: (props?: any) => void;
  selectedRouteId: string | null;
  setSelectedRouteId: (id: string | null) => void;
  handleSubmit: any;
  enterBorderEdit?: (
    initialMode?: "select" | "vertex_edit" | "split" | "merge" | "trace" | "brush"
  ) => void;
  isUnclaimed?: boolean;
  createCountryFromShapeAction?: (name: string) => void;
  createCountryFromShapePending?: boolean;
  assignCountryId?: string;
  setAssignCountryId?: (id: string) => void;
  handleAssignLink?: (featureId: string) => void;
  assignMutation?: any;
  availableCountries?: any[];
  brushTargetId?: string | null;
  setBrushTargetId?: (id: string | null) => void;
  editableFeatureName: string;
  setEditableFeatureName: (name: string) => void;
  editableCountryLinkageId: string;
  setEditableCountryLinkageId: (id: string) => void;
  countries?: any[];
}

export function PropertiesPanelContent({
  isWorldMode,
  activeEditorMode,
  activeCountryId,
  mapSelectedCountry,
  borderState,
  borderActions,
  editor,
  selectedCountryName,
  featureDetails,
  wikiPageTitle,
  setWikiPageTitle,
  // oxlint-disable-next-line eslint/no-unused-vars
  handleLinkFeature,
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
}: PropertiesPanelContentProps) {
  const router = useRouter();
  const [showGenerator, setShowGenerator] = useState(false);

  if (editor.selectedIds.size > 1) {
    const selectedSubdivisions = editor.allFeatures.filter(
      (f: any) => f.type === "subdivision" && editor.selectedIds.has(f.id)
    );

    return (
      <div className="space-y-4 px-3 py-3">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
            Batch Selection
          </span>
          <span className="bg-primary/10 text-primary rounded px-1.5 py-0.5 text-[10px] font-medium">
            {editor.selectedIds.size} features selected
          </span>
        </div>

        {selectedSubdivisions.length > 1 && (
          <div className="border-border/30 bg-muted/10 space-y-3 rounded-lg border p-3">
            <div className="flex flex-col gap-1">
              <span className="text-foreground text-xs font-semibold">Pathfinder Operations</span>
              <span className="text-muted-foreground text-[10px]">
                Perform boolean geometry operations on the selected regions. The resulting shape
                inherits the attributes of the first selected region.
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

        {/* List of selected features */}
        <div className="border-border/30 bg-muted/10 space-y-2 rounded-lg border p-3">
          <label className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
            Selected Features
          </label>
          <div className="max-h-48 space-y-1 overflow-y-auto">
            {editor.allFeatures
              .filter((f: any) => editor.selectedIds.has(f.id))
              .map((f: any) => (
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

  if (isWorldMode) {
    let mainContent: React.ReactNode = null;
    const inputClasses =
      "w-full rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground disabled:opacity-50 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500";

    if (activeEditorMode === "border_edit") {
      // Border editor panel — unchanged from plan 020
      mainContent = (
        <BorderEditorPanel
          featureId={borderState.featureId}
          displayName={borderState.displayName || borderState.featureId || ""}
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
    } else if (editor.mode !== "view") {
      // A feature-placement tool is active — show its form
      mainContent = (
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
          error={editor.mutationError}
          lastSavedAt={editor.lastSavedAt}
          onSubmit={handleSubmit}
          onCancel={editor.resetForm}
          pendingPointInfo={editor.pointInfo}
          isPendingPointInfoLoading={editor.isPendingPointInfoLoading}
          countryId={activeCountryId ?? undefined}
          routeWaypoints={editor.routeWaypoints}
          finishRoute={editor.finishRoute}
          undoLastWaypoint={editor.undoLastWaypoint}
          clearRouteWaypoints={editor.clearRouteWaypoints}
          selectedRouteId={selectedRouteId}
          onSelectRouteId={setSelectedRouteId}
          allFeatures={editor.allFeatures}
          isPickingLocation={editor.isPickingLocation}
          setIsPickingLocation={editor.setIsPickingLocation}
        />
      );
    } else if (mapSelectedCountry) {
      // Selection-first: a shape is selected — show its profile + rich data + contextual actions
      mainContent = (
        <div className="space-y-3">
          {/* Header badge */}
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
              {isUnclaimed ? "Unclaimed Territory" : "Country Profile"}
            </span>
            <span
              className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                isUnclaimed
                  ? "bg-amber-500/10 text-amber-500"
                  : "bg-emerald-500/10 text-emerald-500"
              }`}
            >
              {selectedCountryName ||
                mapSelectedCountry.displayName ||
                mapSelectedCountry.featureId}
            </span>
          </div>

          {/* Feature Settings (editable display name & linkage) */}
          <div className="border-border/30 bg-muted/10 space-y-3 rounded-lg border p-3">
            <label className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
              Feature Settings
            </label>
            <div className="space-y-2">
              <div className="space-y-1">
                <span className="text-muted-foreground text-[10px] font-medium">Display Name</span>
                <input
                  type="text"
                  value={editableFeatureName}
                  onChange={(e) => setEditableFeatureName(e.target.value)}
                  className={inputClasses}
                  placeholder="e.g. Caphiria"
                />
              </div>

              <div className="space-y-1">
                <span className="text-muted-foreground text-[10px] font-medium">
                  Country Linkage
                </span>
                <select
                  value={editableCountryLinkageId}
                  onChange={(e) => setEditableCountryLinkageId(e.target.value)}
                  className="border-border bg-background text-foreground w-full rounded-lg border px-2 py-1.5 text-xs focus:border-blue-500 focus:outline-none"
                >
                  <option value="">— unlinked —</option>
                  {countries &&
                    countries.map((c: any) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                </select>
              </div>

              {!isUnclaimed && (
                <div className="space-y-1">
                  <span className="text-muted-foreground text-[10px] font-medium">
                    Wiki Linkage
                  </span>
                  <input
                    type="text"
                    value={wikiPageTitle}
                    onChange={(e) => setWikiPageTitle(e.target.value)}
                    placeholder="e.g. Caphiria"
                    className={inputClasses}
                  />
                </div>
              )}

              {(editableFeatureName !== (mapSelectedCountry.displayName || "") ||
                editableCountryLinkageId !== (mapSelectedCountry.countryId || "") ||
                wikiPageTitle !== (featureDetails?.wikiPageTitle || "")) && (
                <button
                  onClick={() => handleSaveFeatureProperties()}
                  disabled={updatePropertiesMutation.isPending}
                  className="mt-2 w-full cursor-pointer rounded-lg bg-blue-600 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
                >
                  {updatePropertiesMutation.isPending ? "Saving..." : "Save Feature Info"}
                </button>
              )}
            </div>
          </div>

          {/* Feature data card (always visible) */}
          <div className="border-border/30 bg-muted/10 space-y-2 rounded-lg border p-3">
            <label className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
              Feature Data
            </label>
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Feature ID</span>
                <span className="text-foreground/80 max-w-[180px] truncate font-mono text-[10px]">
                  {mapSelectedCountry.featureId || "—"}
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Centroid</span>
                <span className="text-foreground/80 font-mono text-[10px]">
                  {mapSelectedCountry.centroidLng?.toFixed(4)},
                  {mapSelectedCountry.centroidLat?.toFixed(4)}
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Fill Color</span>
                <span className="flex items-center gap-1">
                  <span
                    className="border-border inline-block h-3 w-3 rounded border"
                    style={{
                      backgroundColor: mapSelectedCountry.fillColor || "var(--color-bg-secondary)",
                    }}
                  />
                  <span className="text-foreground/80 font-mono text-[10px]">
                    {mapSelectedCountry.fillColor || "—"}
                  </span>
                </span>
              </div>
            </div>
          </div>

          {/* DB feature details card (when available) */}
          {featureDetails && (
            <div className="border-border/30 bg-muted/10 space-y-2 rounded-lg border p-3">
              <label className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
                Database Record
              </label>
              <div className="space-y-1">
                {featureDetails.flagUrl && (
                  <img
                    src={featureDetails.flagUrl}
                    alt={`${selectedCountryName} flag`}
                    className="border-border/50 mb-2 aspect-video w-full rounded-lg border object-cover shadow-sm"
                  />
                )}
                {featureDetails.featureType && (
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Type</span>
                    <span className="text-foreground/80">{String(featureDetails.featureType)}</span>
                  </div>
                )}
                {featureDetails.areaKm2 != null && (
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Area</span>
                    <span className="text-foreground/80">
                      {Number(featureDetails.areaKm2).toLocaleString()} km²
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Full feature properties JSON viewer */}
          <div className="border-border/30 bg-muted/10 rounded-lg border p-3">
            <div className="mb-2 flex items-center justify-between">
              <label className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
                Properties JSON
              </label>
              <button
                onClick={() => {
                  if (isEditingJson) {
                    try {
                      const parsed = propertiesJsonString ? JSON.parse(propertiesJsonString) : {};
                      setJsonError(null);
                      handleSaveFeatureProperties(parsed);
                      setIsEditingJson(false);
                    } catch (_e) {
                      setJsonError("Invalid JSON syntax");
                    }
                  } else {
                    setIsEditingJson(true);
                  }
                }}
                className="text-[10px] font-semibold text-blue-500 hover:text-blue-600"
              >
                {isEditingJson ? "Save" : "Edit JSON"}
              </button>
            </div>
            {isEditingJson ? (
              <div className="space-y-1">
                <textarea
                  value={propertiesJsonString}
                  onChange={(e) => setPropertiesJsonString(e.target.value)}
                  rows={6}
                  className="border-border bg-background w-full rounded-lg border px-3 py-2 font-mono text-[10px] leading-relaxed focus:border-blue-500 focus:outline-none"
                />
                {jsonError && <p className="text-[10px] text-red-500">{jsonError}</p>}
              </div>
            ) : (
              <JsonViewer data={parsedProperties} />
            )}
          </div>

          {/* Unclaimed territory actions */}
          {isUnclaimed && (
            <div className="border-border/30 space-y-2 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
              <p className="text-muted-foreground text-[10px]">
                This territory has no linked country record.
              </p>

              {/* Assign to existing country */}
              {setAssignCountryId && handleAssignLink && availableCountries && (
                <div className="space-y-1.5">
                  <label className="text-muted-foreground text-[10px] font-medium uppercase">
                    Assign to country
                  </label>
                  <div className="flex gap-1.5">
                    <select
                      value={assignCountryId ?? ""}
                      onChange={(e) => setAssignCountryId(e.target.value)}
                      className="border-border bg-background text-foreground w-full rounded-lg border px-2 py-1.5 text-xs focus:border-blue-500 focus:outline-none"
                    >
                      <option value="">— select country —</option>
                      {availableCountries.map((c: any) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() => handleAssignLink(mapSelectedCountry.featureId)}
                      disabled={!assignCountryId || assignMutation?.isPending}
                      className="shrink-0 rounded-lg bg-blue-600/20 px-3 py-1.5 text-xs font-medium text-blue-500 hover:bg-blue-600/30 disabled:opacity-50"
                    >
                      Assign
                    </button>
                  </div>
                </div>
              )}

              {/* Create new country from shape */}
              {createCountryFromShapeAction && (
                <button
                  onClick={() => {
                    const name = window.prompt(
                      "Enter name for the new country:",
                      mapSelectedCountry.displayName || ""
                    );
                    if (name && name.trim()) {
                      createCountryFromShapeAction(name.trim());
                    }
                  }}
                  disabled={createCountryFromShapePending}
                  className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-emerald-600/20 px-3 py-2 text-xs font-medium text-emerald-500 hover:bg-emerald-600/30 disabled:opacity-50"
                >
                  {createCountryFromShapePending ? "Creating…" : "+ Create new country from shape"}
                </button>
              )}
            </div>
          )}

          {/* Action buttons */}
          <div className="border-border/30 space-y-2 border-t pt-3">
            {enterBorderEdit && (
              <button
                onClick={() => enterBorderEdit()}
                className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-blue-600/20 px-3 py-2 text-xs font-medium text-blue-500 hover:bg-blue-600/30"
              >
                <Pencil className="h-3.5 w-3.5" />
                Edit Borders
              </button>
            )}
            {enterBorderEdit && (
              <button
                onClick={() => enterBorderEdit("brush")}
                className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-emerald-600/20 px-3 py-2 text-xs font-medium text-emerald-500 hover:bg-emerald-600/30"
              >
                <Paintbrush className="h-3.5 w-3.5" />
                Brush Territory…
              </button>
            )}
            {!isUnclaimed && (
              <button
                onClick={() => setShowGenerator((v) => !v)}
                className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-purple-600/20 px-3 py-2 text-xs font-medium text-purple-500 hover:bg-purple-600/30"
              >
                <Grid3X3 className="h-3.5 w-3.5" />
                Generate Subdivisions…
              </button>
            )}
            {!isUnclaimed && (
              <button
                onClick={() => {
                  if (mapSelectedCountry?.featureId) {
                    router.push(`/admin/geography?featureId=${mapSelectedCountry.featureId}`);
                  }
                }}
                className="border-border bg-muted/20 hover:bg-muted/40 text-foreground w-full rounded-lg border py-2 text-center text-xs font-medium transition-colors"
              >
                Manage Database Record
              </button>
            )}
          </div>
          {showGenerator && (
            <div className="border-border/30 bg-muted/10 rounded-lg border">
              <ProvinceGeneratorPanel
                countryGeometry={editor?.countryGeo?.geometry ?? null}
                countryId={activeCountryId ?? ""}
                onClose={() => setShowGenerator(false)}
              />
            </div>
          )}
        </div>
      );
    } else {
      mainContent = (
        <div className="space-y-2 py-8 text-center">
          <p className="text-muted-foreground text-xs italic">
            Click any shape on the map to view its properties and actions.
          </p>
          <p className="text-muted-foreground/50 text-[10px]">
            Both claimed countries and unclaimed territories are supported.
          </p>
        </div>
      );
    }

    return <div className="space-y-4">{mainContent}</div>;
  }

  return (
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
      error={editor.mutationError}
      lastSavedAt={editor.lastSavedAt}
      onSubmit={handleSubmit}
      onCancel={editor.resetForm}
      pendingPointInfo={editor.pointInfo}
      isPendingPointInfoLoading={editor.isPendingPointInfoLoading}
      countryId={activeCountryId ?? undefined}
      routeWaypoints={editor.routeWaypoints}
      finishRoute={editor.finishRoute}
      undoLastWaypoint={editor.undoLastWaypoint}
      clearRouteWaypoints={editor.clearRouteWaypoints}
      selectedRouteId={selectedRouteId}
      onSelectRouteId={setSelectedRouteId}
      allFeatures={editor.allFeatures}
      isPickingLocation={editor.isPickingLocation}
      setIsPickingLocation={editor.setIsPickingLocation}
    />
  );
}
