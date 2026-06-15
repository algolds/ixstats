"use client";

import React from "react";
import { Pencil } from "lucide-react";
import { useRouter } from "next/navigation";
import { BorderEditorPanel } from "~/components/maps/editor/BorderEditorPanel";
import { FeaturePropertyPanel } from "~/components/maps/editor/FeaturePropertyPanel";
import { JsonViewer } from "~/components/json-viewer";

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
  handleSaveFeatureProperties: (props: any) => void;
  selectedRouteId: string | null;
  setSelectedRouteId: (id: string | null) => void;
  handleSubmit: any;
  enterBorderEdit?: () => void;
  isUnclaimed?: boolean;
  createCountryFromShapeAction?: (name: string) => void;
  createCountryFromShapePending?: boolean;
  assignCountryId?: string;
  setAssignCountryId?: (id: string) => void;
  handleAssignLink?: (featureId: string) => void;
  assignMutation?: any;
  availableCountries?: any[];
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
}: PropertiesPanelContentProps) {
  const router = useRouter();

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
        />
      );
    } else if (editor.mode !== "view") {
      // A feature-placement tool is active — show its form (was forge branch)
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
        />
      );
    } else if (mapSelectedCountry) {
      // Selection-first: a shape is selected — show its profile + contextual actions
      mainContent = (
        <div className="space-y-4">
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
              {selectedCountryName || mapSelectedCountry.featureId}
            </span>
          </div>
          <div className="space-y-3">
            {featureDetails?.flagUrl && (
              <img
                src={featureDetails.flagUrl}
                alt={`${selectedCountryName} flag`}
                className="border-border/50 aspect-video w-full rounded-lg border object-cover shadow-sm"
              />
            )}

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
                        className="w-full rounded-lg border border-border bg-background px-2 py-1.5 text-xs text-foreground focus:border-blue-500 focus:outline-none"
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

            {/* Wiki linkage — only for claimed shapes */}
            {!isUnclaimed && (
              <div>
                <label className="text-muted-foreground text-[10px] font-medium uppercase">
                  Wiki Linkage
                </label>
                <div className="mt-1 flex items-center gap-1.5">
                  <input
                    type="text"
                    value={wikiPageTitle}
                    onChange={(e) => setWikiPageTitle(e.target.value)}
                    placeholder="e.g. Caphiria"
                    className={inputClasses}
                  />
                  <button
                    onClick={handleLinkFeature}
                    disabled={updatePropertiesMutation.isPending}
                    className="bg-blue-650 rounded-lg px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    Link
                  </button>
                </div>
              </div>
            )}

            {/* Custom Properties JSON */}
            {!isUnclaimed && (
              <div>
                <div className="flex items-center justify-between">
                  <label className="text-muted-foreground text-[10px] font-medium uppercase">
                    Custom Properties (JSON)
                  </label>
                  <button
                    onClick={() => {
                      if (isEditingJson) {
                        try {
                          const parsed = propertiesJsonString
                            ? JSON.parse(propertiesJsonString)
                            : {};
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
                <div className="mt-1">
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
              </div>
            )}

            <div className="border-border/30 space-y-2 border-t pt-3">
              {/* Edit Borders — available for any selected shape */}
              {enterBorderEdit && (
                <button
                  onClick={enterBorderEdit}
                  className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-blue-600/20 px-3 py-2 text-xs font-medium text-blue-500 hover:bg-blue-600/30"
                >
                  <Pencil className="h-3.5 w-3.5" />
                  Edit Borders
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
          </div>
        </div>
      );
    } else {
      mainContent = (
        <p className="text-muted-foreground py-8 text-center italic">
          Click any shape on the map to view its properties and actions.
        </p>
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
    />
  );
}
