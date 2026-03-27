"use client";

import React from "react";

/**
 * FeaturePropertyPanel - Thin orchestrator that delegates to focused sub-panels
 * based on the current editor mode.
 */

import { Loader2, Check, CheckCircle2 } from "lucide-react";
import type { EditorMode, CityFormData, SubdivisionFormData, POIFormData, StoryPinFormData, MapLabelFormData } from "~/hooks/useMapEditor";
import {
  CityPropertyForm,
  SubdivisionPropertyForm,
  POIPropertyForm,
  StoryPinPropertyForm,
  MapLabelPropertyForm,
  TransportPropertyForm,
  PaintPropertyForm,
} from "./properties";
import { SmartPlacement } from "./SmartPlacement";

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
  storyPinForm?: StoryPinFormData;
  onStoryPinFormChange?: (form: StoryPinFormData) => void;
  mapLabelForm?: MapLabelFormData;
  onMapLabelFormChange?: (form: MapLabelFormData) => void;
  onSubmit: () => void;
  onCancel: () => void;
  isMutating: boolean;
  error: { message: string } | null;
  lastSavedAt?: number | null;
  pendingPointInfo?: PointInfo | null;
  isPendingPointInfoLoading?: boolean;
  countryId?: string;
}

export const FeaturePropertyPanel = React.memo(function FeaturePropertyPanel(props: FeaturePropertyPanelProps) {
  const { mode, onCancel, countryId } = props;

  if (mode === "view") return null;

  // Self-contained panels for paint and transport modes
  if (mode === "paint") {
    return <PaintPropertyForm countryId={countryId} onCancel={onCancel} />;
  }
  if (mode === "add-route") {
    return <TransportPropertyForm countryId={countryId} onCancel={onCancel} />;
  }

  const isEdit = mode.startsWith("edit-");
  const { pendingCoordinates, pendingGeometry, isMutating, error, lastSavedAt, onSubmit, pendingPointInfo, isPendingPointInfoLoading } = props;

  const hasLocation =
    isEdit ||
    (mode === "add-city" && pendingCoordinates) ||
    (mode === "add-subdivision" && pendingGeometry) ||
    (mode === "add-poi" && pendingCoordinates) ||
    (mode === "add-story-pin" && pendingCoordinates) ||
    (mode === "add-label" && pendingCoordinates);

  const hasName =
    ((mode === "add-city" || mode === "edit-city") && props.cityForm.name.trim()) ||
    ((mode === "add-subdivision" || mode === "edit-subdivision") && props.subdivisionForm.name.trim()) ||
    ((mode === "add-poi" || mode === "edit-poi") && props.poiForm.name.trim()) ||
    ((mode === "add-story-pin" || mode === "edit-story-pin") && props.storyPinForm?.title.trim()) ||
    ((mode === "add-label" || mode === "edit-label") && props.mapLabelForm?.text.trim());

  const canSubmit = hasLocation && hasName && !isMutating;

  // Mode title mapping
  const titles: Record<string, string> = {
    "add-city": "New City", "edit-city": "Edit City",
    "add-subdivision": "New Region", "edit-subdivision": "Edit Region",
    "add-poi": "New POI", "edit-poi": "Edit POI",
    "add-story-pin": "New Story Pin", "edit-story-pin": "Edit Story Pin",
    "add-label": "New Map Label", "edit-label": "Edit Map Label",
  };

  const isPointMode = mode === "add-city" || mode === "add-poi" || mode === "add-story-pin" || mode === "add-label";

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {titles[mode] ?? mode}
        </h3>
      </div>

      {/* Location indicator */}
      {!isEdit && !hasLocation && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
          {mode === "add-subdivision"
            ? "Draw a polygon on the map to define the region boundary"
            : "Click on the map to set the location"}
        </div>
      )}
      {pendingCoordinates && isPointMode && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700">
          Location: {pendingCoordinates[1].toFixed(3)}&deg;, {pendingCoordinates[0].toFixed(3)}&deg;
        </div>
      )}
      {pendingGeometry && mode === "add-subdivision" && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700">
          Region polygon drawn
        </div>
      )}

      {/* Terrain info at clicked point */}
      {pendingCoordinates && isPointMode && (
        <div className="flex flex-wrap gap-1.5">
          {isPendingPointInfoLoading && (
            <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
              <Loader2 className="h-2.5 w-2.5 animate-spin" /> Terrain...
            </span>
          )}
          {pendingPointInfo?.elevation?.zoneName && (
            <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-[10px] font-medium text-foreground">
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
            <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-[10px] font-medium text-foreground">
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
        <CityPropertyForm form={props.cityForm} onChange={props.onCityFormChange} pendingCoordinates={pendingCoordinates} />
      )}
      {(mode === "add-subdivision" || mode === "edit-subdivision") && (
        <SubdivisionPropertyForm form={props.subdivisionForm} onChange={props.onSubdivisionFormChange} />
      )}
      {(mode === "add-poi" || mode === "edit-poi") && (
        <POIPropertyForm form={props.poiForm} onChange={props.onPOIFormChange} pendingCoordinates={pendingCoordinates} />
      )}
      {(mode === "add-story-pin" || mode === "edit-story-pin") && props.storyPinForm && props.onStoryPinFormChange && (
        <StoryPinPropertyForm form={props.storyPinForm} onChange={props.onStoryPinFormChange} countryId={countryId} />
      )}
      {(mode === "add-label" || mode === "edit-label") && props.mapLabelForm && props.onMapLabelFormChange && (
        <MapLabelPropertyForm form={props.mapLabelForm} onChange={props.onMapLabelFormChange} />
      )}

      {/* Success flash with fade-in animation */}
      {lastSavedAt && !error && (
        <div
          className="flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700"
          style={{ animation: "featureSavedFadeIn 300ms ease" }}
        >
          <CheckCircle2 className="h-3.5 w-3.5" />
          <span>{isEdit ? "Changes saved" : "Saved \u2014 click map to place another"}</span>
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">
          {error.message}
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-2">
        <button
          onClick={onSubmit}
          disabled={!canSubmit}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-3 sm:py-1.5 text-base sm:text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 active:bg-primary/80 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isMutating ? (
            <Loader2 className="h-4 w-4 sm:h-3.5 sm:w-3.5 animate-spin" />
          ) : (
            <Check className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
          )}
          {isMutating ? "Saving..." : isEdit ? "Update" : "Save"}
        </button>
        <button
          onClick={onCancel}
          className="rounded-lg border border-border px-3 py-3 sm:py-1.5 text-base sm:text-sm text-foreground/80 transition-colors hover:bg-accent active:bg-accent"
        >
          Cancel
        </button>
      </div>

      {/* eslint-disable-next-line react/no-unknown-property */}
      <style jsx>{`
        @keyframes featureSavedFadeIn {
          from { opacity: 0; transform: translateY(-4px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
});
