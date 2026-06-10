"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { BorderEditorPanel } from "~/components/maps/editor/BorderEditorPanel";
import { FeaturePropertyPanel } from "~/components/maps/editor/FeaturePropertyPanel";
import { JsonViewer } from "~/components/json-viewer";

interface PropertiesPanelContentProps {
  isWorldMode: boolean;
  activeEditorMode: "view" | "forge" | "border_edit";
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
}: PropertiesPanelContentProps) {
  const router = useRouter();

  if (isWorldMode) {
    let mainContent: React.ReactNode = null;
    const inputClasses =
      "w-full rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground disabled:opacity-50 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500";

    if (activeEditorMode === "border_edit") {
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
    } else if (activeEditorMode === "forge") {
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
    } else {
      // Active mode === view
      if (mapSelectedCountry) {
        mainContent = (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold tracking-wider uppercase text-muted-foreground">
                Country Profile
              </span>
              <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-500">
                {selectedCountryName}
              </span>
            </div>
            <div className="space-y-3">
              {featureDetails?.flagUrl && (
                <img
                  src={featureDetails.flagUrl}
                  alt={`${selectedCountryName} flag`}
                  className="aspect-video w-full rounded-lg border border-border/50 object-cover shadow-sm"
                />
              )}
              <div>
                <label className="text-[10px] font-medium text-muted-foreground uppercase">
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
                    className="rounded-lg bg-blue-650 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    Link
                  </button>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-medium text-muted-foreground uppercase">
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
                        className="font-mono text-[10px] leading-relaxed w-full rounded-lg border border-border bg-background px-3 py-2 focus:border-blue-500 focus:outline-none"
                      />
                      {jsonError && <p className="text-[10px] text-red-500">{jsonError}</p>}
                    </div>
                  ) : (
                    <JsonViewer data={parsedProperties} />
                  )}
                </div>
              </div>

              <div className="border-t border-border/30 pt-3">
                <button
                  onClick={() => {
                    if (mapSelectedCountry?.featureId) {
                      router.push(`/admin/geography?featureId=${mapSelectedCountry.featureId}`);
                    }
                  }}
                  className="w-full rounded-lg border border-border bg-muted/20 hover:bg-muted/40 py-2 text-center text-xs font-medium text-foreground transition-colors"
                >
                  Manage Database Record
                </button>
              </div>
            </div>
          </div>
        );
      } else {
        mainContent = (
          <p className="text-center italic text-muted-foreground py-8">
            Click a country on the map to manage linkages or properties.
          </p>
        );
      }
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
