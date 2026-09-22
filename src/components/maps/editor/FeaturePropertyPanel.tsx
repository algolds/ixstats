"use client";

import React from "react";

/**
 * FeaturePropertyPanel - Thin orchestrator that delegates to focused sub-panels
 * based on the current editor mode.
 */

import { SystemRestart as Loader2, Check, CheckCircle as CheckCircle2 } from "iconoir-react";
import dynamic from "next/dynamic";
import type {
  EditorMode,
  CityFormData,
  SubdivisionFormData,
  POIFormData,
  PeakFormData,
  NamedRiverFormData,
  NamedLakeFormData,
  EditorFeature,
} from "~/hooks/useMapEditor";
import {
  CityPropertyForm,
  SubdivisionPropertyForm,
  POIPropertyForm,
  PeakPropertyForm,
  RiverPropertyForm,
  LakePropertyForm,
} from "./properties";
import { SmartPlacement } from "./SmartPlacement";

const TransportPropertyForm = dynamic(
  () => import("./properties/TransportPropertyForm").then((m) => m.TransportPropertyForm),
  { ssr: false }
);

const MODE_TITLES: Record<string, string> = {
  "add-city": "New City",
  "edit-city": "Edit City",
  "add-subdivision": "New Region",
  "edit-subdivision": "Edit Region",
  "add-poi": "New POI",
  "edit-poi": "Edit POI",
  "add-peak": "New Peak",
  "edit-peak": "Edit Peak",
  "add-river": "New River",
  "edit-river": "Edit River",
  "add-lake": "New Lake",
  "edit-lake": "Edit Lake",
};

interface PointInfo {
  elevation?: {
    zoneName?: string | null;
    elevationLabel?: string | null;
    color?: string | null;
  } | null;
  climate?: {
    climateName?: string | null;
    color?: string | null;
  } | null;
}

interface FeaturePropertyPanelProps {
  mode: EditorMode;
  pendingCoordinates: [number, number] | null;
  pendingGeometry: object | null;
  cityForm: CityFormData;
  onCityFormChange: (form: CityFormData) => void;
  subdivisionForm: SubdivisionFormData;
  onSubdivisionFormChange: (form: SubdivisionFormData) => void;
  poiForm: POIFormData;
  onPOIFormChange: (form: POIFormData) => void;
  peakForm?: PeakFormData;
  onPeakFormChange?: (form: PeakFormData) => void;
  riverForm?: NamedRiverFormData;
  onRiverFormChange?: (form: NamedRiverFormData) => void;
  lakeForm?: NamedLakeFormData;
  onLakeFormChange?: (form: NamedLakeFormData) => void;
  selectedFeature?: EditorFeature | null;
  onSubmit: () => void;
  onCancel: () => void;
  isMutating: boolean;
  error: { message: string } | null;
  lastSavedAt?: number | null;
  pendingPointInfo?: PointInfo | null;
  isPendingPointInfoLoading?: boolean;
  countryId?: string;
  routeWaypoints?: [number, number][];
  finishRoute?: (routeType?: string, name?: string) => Promise<void>;
  undoLastWaypoint?: () => void;
  clearRouteWaypoints?: () => void;
  selectedRouteId?: string | null;
  onSelectRouteId?: (id: string | null) => void;
  onEditRoute?: (routeId: string) => void;
  editingRouteId?: string | null;
  editingRouteVertices?: [number, number][];
  onRouteVerticesUpdate?: (vertices: [number, number][]) => void;
  onRouteEditCommit?: () => Promise<void> | void;
  onRouteEditCancel?: () => void;
  onFlyToCoords?: (coord: [number, number]) => void;
  allFeatures?: EditorFeature[];
  isPickingLocation?: boolean;
  setIsPickingLocation?: (active: boolean) => void;
}

export const FeaturePropertyPanel = React.memo(function FeaturePropertyPanel(
  props: FeaturePropertyPanelProps
) {
  const {
    mode,
    onCancel,
    countryId,
    routeWaypoints,
    finishRoute,
    undoLastWaypoint,
    clearRouteWaypoints,
    selectedRouteId,
    onSelectRouteId,
    onEditRoute,
    editingRouteId,
    editingRouteVertices,
    onRouteVerticesUpdate,
    onRouteEditCommit,
    onRouteEditCancel,
    onFlyToCoords,
    allFeatures,
    isPickingLocation,
    setIsPickingLocation,
    selectedFeature,
  } = props;

  if (mode === "view") return null;

  // Self-contained panels for transport modes
  if (mode === "add-route" || mode === "edit-route") {
    return (
      <TransportPropertyForm
        countryId={countryId}
        onCancel={onCancel}
        routeWaypoints={routeWaypoints}
        finishRoute={finishRoute}
        undoLastWaypoint={undoLastWaypoint}
        clearRouteWaypoints={clearRouteWaypoints}
        selectedRouteId={selectedRouteId}
        onSelectRouteId={onSelectRouteId}
        onEditRoute={onEditRoute}
        editingRouteId={editingRouteId}
        editingRouteVertices={editingRouteVertices}
        onRouteVerticesUpdate={onRouteVerticesUpdate}
        onRouteEditCommit={onRouteEditCommit}
        onRouteEditCancel={onRouteEditCancel}
        onFlyToCoords={onFlyToCoords}
      />
    );
  }

  const isEdit = mode.startsWith("edit-");
  const {
    pendingCoordinates,
    pendingGeometry,
    isMutating,
    error,
    lastSavedAt,
    onSubmit,
    pendingPointInfo,
    isPendingPointInfoLoading,
  } = props;

  const hasLocation =
    isEdit ||
    (mode === "add-city" && pendingCoordinates) ||
    (mode === "add-subdivision" && pendingGeometry) ||
    (mode === "add-poi" && pendingCoordinates) ||
    (mode === "add-peak" && pendingCoordinates) ||
    (mode === "add-river" && pendingGeometry) ||
    (mode === "add-lake" && pendingGeometry);

  const hasName =
    ((mode === "add-city" || mode === "edit-city") && props.cityForm.name.trim()) ||
    ((mode === "add-subdivision" || mode === "edit-subdivision") &&
      props.subdivisionForm.name.trim()) ||
    ((mode === "add-poi" || mode === "edit-poi") && props.poiForm.name.trim()) ||
    ((mode === "add-peak" || mode === "edit-peak") && props.peakForm?.name.trim()) ||
    ((mode === "add-river" || mode === "edit-river") && props.riverForm?.name.trim()) ||
    ((mode === "add-lake" || mode === "edit-lake") && props.lakeForm?.name.trim());

  const canSubmit = hasLocation && hasName && !isMutating;

  const isPointMode =
    mode === "add-city" ||
    mode === "add-poi" ||
    mode === "add-peak";

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
          {MODE_TITLES[mode] ?? mode}
        </h3>
      </div>

      {/* Location indicator */}
      {!isEdit && !hasLocation && (
        <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-500 font-medium">
          {mode === "add-subdivision" || mode === "add-lake"
            ? "Draw a polygon on the map to define the boundary"
            : mode === "add-river"
              ? "Draw a line on the map to define the path"
              : "Click on the map to set the location"}
        </div>
      )}
      {pendingCoordinates && isPointMode && (
        <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-500">
          Location: {pendingCoordinates[1].toFixed(3)}&deg;, {pendingCoordinates[0].toFixed(3)}&deg;
        </div>
      )}
      {pendingGeometry && (mode === "add-subdivision" || mode === "add-lake") && (
        <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-500">
          Polygon boundary drawn
        </div>
      )}
      {pendingGeometry && mode === "add-river" && (
        <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-500">
          Line path drawn
        </div>
      )}

      {/* Terrain info at clicked point */}
      {pendingCoordinates && isPointMode && (
        <div className="flex flex-wrap gap-1.5">
          {isPendingPointInfoLoading && (
            <span className="bg-muted/40 border-border/30 text-muted-foreground inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px]">
              <Loader2 className="h-2.5 w-2.5 animate-spin" /> Terrain...
            </span>
          )}
          {pendingPointInfo?.elevation?.zoneName && (
            <span className="bg-muted/40 border-border/30 text-foreground inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-medium">
              {pendingPointInfo.elevation.color && (
                <span
                  className="inline-block h-2.5 w-2.5 rounded-sm"
                  style={{ backgroundColor: pendingPointInfo.elevation.color.slice(0, 7) }}
                />
              )}
              {pendingPointInfo.elevation.zoneName}
              {pendingPointInfo.elevation.elevationLabel && (
                <span className="text-muted-foreground">
                  {pendingPointInfo.elevation.elevationLabel}
                </span>
              )}
            </span>
          )}
          {pendingPointInfo?.climate?.climateName && (
            <span className="bg-muted/40 border-border/30 text-foreground inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-medium">
              {pendingPointInfo.climate.color && (
                <span
                  className="inline-block h-2.5 w-2.5 rounded-sm"
                  style={{ backgroundColor: pendingPointInfo.climate.color }}
                />
              )}
              {pendingPointInfo.climate.climateName}
            </span>
          )}
        </div>
      )}

      {/* Smart placement suggestions for city/POI modes */}
      {(mode === "add-city" || mode === "add-poi") && pendingCoordinates && (
        <SmartPlacement
          featureType={mode === "add-city" ? "city" : "poi"}
          coordinates={pendingCoordinates}
          terrainInfo={pendingPointInfo}
        />
      )}

      {/* Delegate to the correct form sub-panel */}
      {(mode === "add-city" || mode === "edit-city") && (
        <CityPropertyForm
          form={props.cityForm}
          onChange={props.onCityFormChange}
          pendingCoordinates={pendingCoordinates}
          countryId={countryId}
          allFeatures={allFeatures}
          isPickingLocation={isPickingLocation}
          setIsPickingLocation={setIsPickingLocation}
        />
      )}
      {(mode === "add-subdivision" || mode === "edit-subdivision") && (
        <SubdivisionPropertyForm
          form={props.subdivisionForm}
          onChange={props.onSubdivisionFormChange}
        />
      )}
      {(mode === "add-poi" || mode === "edit-poi") && (
        <POIPropertyForm
          form={props.poiForm}
          onChange={props.onPOIFormChange}
          pendingCoordinates={pendingCoordinates}
          countryId={countryId}
          allFeatures={allFeatures}
          isPickingLocation={isPickingLocation}
          setIsPickingLocation={setIsPickingLocation}
        />
      )}
      {(mode === "add-peak" || mode === "edit-peak") &&
        props.peakForm &&
        props.onPeakFormChange && (
          <PeakPropertyForm
            form={props.peakForm}
            onChange={props.onPeakFormChange}
            pendingCoordinates={pendingCoordinates}
            countryId={countryId}
            allFeatures={allFeatures}
            isPickingLocation={isPickingLocation}
            setIsPickingLocation={setIsPickingLocation}
          />
        )}
      {(mode === "add-river" || mode === "edit-river") &&
        props.riverForm &&
        props.onRiverFormChange && (
          <RiverPropertyForm
            form={props.riverForm}
            onChange={props.onRiverFormChange}
            pendingGeometry={pendingGeometry}
            selectedFeature={selectedFeature}
          />
        )}
      {(mode === "add-lake" || mode === "edit-lake") &&
        props.lakeForm &&
        props.onLakeFormChange && (
          <LakePropertyForm
            form={props.lakeForm}
            onChange={props.onLakeFormChange}
            pendingGeometry={pendingGeometry}
            selectedFeature={selectedFeature}
          />
        )}

      {/* Success flash with fade-in animation */}
      {lastSavedAt && !error && (
        <div className="flex animate-in fade-in slide-in-from-top-1 duration-200 items-center gap-1.5 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-500">
          <CheckCircle2 className="h-3.5 w-3.5" />
          <span>{isEdit ? "Changes saved" : "Saved — click map to place another"}</span>
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-xs text-destructive font-medium">
          {error.message}
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-2">
        <button
          onClick={onSubmit}
          disabled={!canSubmit}
          className="bg-primary text-primary-foreground hover:bg-primary/90 active:bg-primary/80 active:scale-[0.98] flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-3 text-base font-medium shadow-sm transition-all duration-150 disabled:cursor-not-allowed disabled:opacity-50 sm:py-1.5 sm:text-sm"
        >
          {isMutating ? (
            <Loader2 className="h-4 w-4 animate-spin sm:h-3.5 sm:w-3.5" />
          ) : (
            <Check className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
          )}
          {isMutating ? "Saving..." : isEdit ? "Update" : "Save"}
        </button>
        <button
          onClick={onCancel}
          className="border-border text-foreground/80 hover:bg-accent active:bg-accent active:scale-[0.98] rounded-lg border px-3 py-3 text-base transition-all duration-150 sm:py-1.5 sm:text-sm"
        >
          Cancel
        </button>
      </div>
    </div>
  );
});
