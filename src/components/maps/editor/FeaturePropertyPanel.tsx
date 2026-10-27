"use client";

import { Eyebrow } from "~/components/ui/eyebrow";
import { Button } from "~/components/ui/button";
import React from "react";

import {
  SystemRestart as Loader2,
  Check,
  CheckCircle as CheckCircle2,
  MapPin,
} from "iconoir-react";
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
import type { TransportPropertyFormProps } from "./properties/TransportPropertyForm";
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

interface FeaturePropertyPanelProps extends TransportPropertyFormProps {
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
  isMutating: boolean;
  error: { message: string } | null;
  lastSavedAt?: number | null;
  pendingPointInfo?: PointInfo | null;
  isPendingPointInfoLoading?: boolean;
  allFeatures?: EditorFeature[];
  isPickingLocation?: boolean;
  setIsPickingLocation?: (active: boolean) => void;
}

const POINT_KINDS = ["city", "poi", "peak"];

const TerrainChip = ({
  color,
  label,
  detail,
}: {
  color?: string | null;
  label: string;
  detail?: string | null;
}) => (
  <span className="bg-fill-3 border-separator text-label rounded-control-sm text-caption inline-flex items-center gap-1 border px-2 py-0.5">
    {color && (
      <span className="inline-block h-2.5 w-2.5 rounded-xs" style={{ backgroundColor: color }} />
    )}
    {label}
    {detail && <span className="text-label-secondary">{detail}</span>}
  </span>
);

const LocationOk = ({ children }: { children: React.ReactNode }) => (
  <div className="text-caption text-green flex items-center gap-2">
    <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden />
    {children}
  </div>
);

function missingLocationHint(kind: string) {
  if (kind === "subdivision" || kind === "lake") {
    return "Draw a polygon on the map to define the boundary";
  }
  return kind === "river"
    ? "Draw a line on the map to define the path"
    : "Click on the map to set the location";
}

function TerrainChips({
  info,
  loading,
}: {
  info: PointInfo | null | undefined;
  loading: boolean | undefined;
}) {
  const elevation = info?.elevation;
  const climate = info?.climate;
  return (
    <div className="flex flex-wrap gap-2">
      {loading && (
        <span className="bg-fill-3 border-separator text-label-secondary rounded-control-sm text-footnote inline-flex items-center gap-1 border px-2 py-0.5">
          <Loader2 className="h-2.5 w-2.5 animate-spin" /> Terrain...
        </span>
      )}
      {elevation?.zoneName && (
        <TerrainChip
          color={elevation.color?.slice(0, 7)}
          label={elevation.zoneName}
          detail={elevation.elevationLabel}
        />
      )}
      {climate?.climateName && <TerrainChip color={climate.color} label={climate.climateName} />}
    </div>
  );
}

function KindForm({ props, kind }: { props: FeaturePropertyPanelProps; kind: string }) {
  const { pendingCoordinates, pendingGeometry, selectedFeature } = props;
  const pointProps = {
    pendingCoordinates,
    countryId: props.countryId,
    allFeatures: props.allFeatures,
    isPickingLocation: props.isPickingLocation,
    setIsPickingLocation: props.setIsPickingLocation,
  };
  const geometryProps = { pendingGeometry, selectedFeature };

  switch (kind) {
    case "city":
      return (
        <CityPropertyForm form={props.cityForm} onChange={props.onCityFormChange} {...pointProps} />
      );
    case "subdivision":
      return (
        <SubdivisionPropertyForm
          form={props.subdivisionForm}
          onChange={props.onSubdivisionFormChange}
        />
      );
    case "poi":
      return (
        <POIPropertyForm form={props.poiForm} onChange={props.onPOIFormChange} {...pointProps} />
      );
    case "peak":
      return props.peakForm && props.onPeakFormChange ? (
        <PeakPropertyForm form={props.peakForm} onChange={props.onPeakFormChange} {...pointProps} />
      ) : null;
    case "river":
      return props.riverForm && props.onRiverFormChange ? (
        <RiverPropertyForm
          form={props.riverForm}
          onChange={props.onRiverFormChange}
          {...geometryProps}
        />
      ) : null;
    case "lake":
      return props.lakeForm && props.onLakeFormChange ? (
        <LakePropertyForm
          form={props.lakeForm}
          onChange={props.onLakeFormChange}
          {...geometryProps}
        />
      ) : null;
    default:
      return null;
  }
}

/** Applies a placement suggestion; the name is only filled when the user has not typed one. */
function applySuggestion(
  props: FeaturePropertyPanelProps,
  suggestedType: string,
  suggestedName?: string
) {
  if (props.mode === "add-city") {
    const { cityForm } = props;
    props.onCityFormChange({
      ...cityForm,
      cityType: suggestedType,
      name: cityForm.name.trim() ? cityForm.name : (suggestedName ?? ""),
    });
  } else {
    const { poiForm } = props;
    props.onPOIFormChange({
      ...poiForm,
      category: suggestedType,
      name: poiForm.name.trim() ? poiForm.name : (suggestedName ?? ""),
    });
  }
}

function SaveFeedback({
  isEdit,
  savedAt,
  error,
}: {
  isEdit: boolean;
  savedAt: number | null | undefined;
  error: { message: string } | null;
}) {
  if (error) {
    return (
      <div className="border-destructive/20 bg-destructive/10 text-destructive rounded-control text-caption border px-3 py-2">
        {error.message}
      </div>
    );
  }
  if (!savedAt) return null;
  return (
    <div
      role="status"
      className="animate-in fade-in text-caption text-green flex items-center gap-2 duration-200"
    >
      <CheckCircle2 className="h-3.5 w-3.5" />
      <span>{isEdit ? "Changes saved" : "Saved. Click map to place another"}</span>
    </div>
  );
}

function PanelActions({
  isEdit,
  isMutating,
  canSubmit,
  onSubmit,
  onCancel,
}: {
  isEdit: boolean;
  isMutating: boolean;
  canSubmit: boolean;
  onSubmit: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="flex gap-2">
      <Button
        size="sm"
        className="sm:text-body flex-1 justify-center sm:py-2"
        onClick={onSubmit}
        disabled={!canSubmit}
      >
        {isMutating ? (
          <Loader2 className="h-4 w-4 animate-spin sm:h-3.5 sm:w-3.5" />
        ) : (
          <Check className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
        )}
        {isMutating ? "Saving..." : isEdit ? "Update" : "Save"}
      </Button>
      <Button variant="outline" size="sm" className="sm:text-body sm:py-2" onClick={onCancel}>
        Cancel
      </Button>
    </div>
  );
}

function LocationFeedback({
  mode,
  kind,
  hasLocation,
  coordinates,
  geometry,
  pointInfo,
  pointInfoLoading,
}: {
  mode: EditorMode;
  kind: string;
  hasLocation: boolean;
  coordinates: [number, number] | null;
  geometry: object | null;
  pointInfo: PointInfo | null | undefined;
  pointInfoLoading: boolean | undefined;
}) {
  const isEdit = mode.startsWith("edit-");
  const isPointMode = POINT_KINDS.includes(kind) && !isEdit;
  const isPolygonMode = !isEdit && (kind === "subdivision" || kind === "lake");
  return (
    <>
      {!isEdit && !hasLocation && (
        <div className="text-label-secondary text-caption flex items-center gap-2">
          <MapPin className="text-blue h-3.5 w-3.5 shrink-0" aria-hidden />
          {missingLocationHint(kind)}
        </div>
      )}
      {coordinates && isPointMode && (
        <>
          <LocationOk>
            Location: {coordinates[1].toFixed(3)}&deg;, {coordinates[0].toFixed(3)}&deg;
          </LocationOk>
          <TerrainChips info={pointInfo} loading={pointInfoLoading} />
        </>
      )}
      {geometry && isPolygonMode && <LocationOk>Polygon boundary drawn</LocationOk>}
      {geometry && mode === "add-river" && <LocationOk>Line path drawn</LocationOk>}
    </>
  );
}

export const FeaturePropertyPanel = React.memo(function FeaturePropertyPanel(
  props: FeaturePropertyPanelProps
) {
  const { mode, onCancel, pendingCoordinates, pendingGeometry, isMutating, error, lastSavedAt } =
    props;

  if (mode === "view") return null;

  if (mode === "add-route" || mode === "edit-route") {
    return <TransportPropertyForm {...props} />;
  }

  const isEdit = mode.startsWith("edit-");
  const kind = mode.replace(/^(add|edit)-/, "");
  const isPointKind = POINT_KINDS.includes(kind);

  const names: Record<string, string | undefined> = {
    city: props.cityForm.name,
    subdivision: props.subdivisionForm.name,
    poi: props.poiForm.name,
    peak: props.peakForm?.name,
    river: props.riverForm?.name,
    lake: props.lakeForm?.name,
  };
  const hasLocation = isEdit || !!(isPointKind ? pendingCoordinates : pendingGeometry);
  const canSubmit = hasLocation && !!names[kind]?.trim() && !isMutating;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Eyebrow className="block">{MODE_TITLES[mode] ?? mode}</Eyebrow>
      </div>

      <LocationFeedback
        mode={mode}
        kind={kind}
        hasLocation={hasLocation}
        coordinates={pendingCoordinates}
        geometry={pendingGeometry}
        pointInfo={props.pendingPointInfo}
        pointInfoLoading={props.isPendingPointInfoLoading}
      />

      {(mode === "add-city" || mode === "add-poi") && pendingCoordinates && (
        <SmartPlacement
          featureType={kind as "city" | "poi"}
          coordinates={pendingCoordinates}
          terrainInfo={props.pendingPointInfo}
          onApplySuggestion={(type, name) => applySuggestion(props, type, name)}
        />
      )}

      <KindForm props={props} kind={kind} />

      <SaveFeedback isEdit={isEdit} savedAt={lastSavedAt} error={error} />

      <PanelActions
        isEdit={isEdit}
        isMutating={isMutating}
        canSubmit={canSubmit}
        onSubmit={props.onSubmit}
        onCancel={onCancel}
      />
    </div>
  );
});
