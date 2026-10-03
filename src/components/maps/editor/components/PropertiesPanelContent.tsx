"use client";
import { Eyebrow } from "~/components/ui/eyebrow";
import { Button } from "~/components/ui/button";
import React, { memo } from "react";
import { BorderEditorPanel } from "~/components/maps/editor/BorderEditorPanel";
import { FeaturePropertyPanel } from "~/components/maps/editor/FeaturePropertyPanel";
import { FeatureInspector, type FeaturePropertyUpdates } from "./inspector/FeatureInspector";
import { DocumentInspector } from "./inspector/DocumentInspector";
import { WorldCountryProfile, type WorldCountryProfileProps } from "./WorldCountryProfile";
import { featureIdToDisplayName } from "~/lib/maps/map-utils";
import { api, type RouterOutputs } from "~/trpc/react";

import type { Polygon, MultiPolygon } from "geojson";
import type { SelectedCountry } from "~/components/maps/core/IxWorldMap";
import { useMapRealm } from "~/components/maps/core/MapRealmContext";
import type {
  BorderEditorState,
  BorderEditorActions,
  MapEditorInstance,
  EditorFeature,
  EditorFeatureDetails,
  FeatureType,
} from "../types/editor-state";
import { Card } from "~/components/ui/card";

/** Props the world-mode country profile receives unchanged. */
type ProfilePassthroughProps = Pick<
  WorldCountryProfileProps,
  | "isUnclaimed"
  | "selectedCountryName"
  | "editableFeatureName"
  | "setEditableFeatureName"
  | "editableCountryLinkageId"
  | "setEditableCountryLinkageId"
  | "countries"
  | "wikiPageTitle"
  | "setWikiPageTitle"
  | "handleSaveFeatureProperties"
  | "isEditingJson"
  | "setIsEditingJson"
  | "propertiesJsonString"
  | "setPropertiesJsonString"
  | "jsonError"
  | "setJsonError"
  | "parsedProperties"
  | "assignCountryId"
  | "setAssignCountryId"
  | "handleAssignLink"
  | "assignMutation"
  | "availableCountries"
  | "createCountryFromShapeAction"
  | "createCountryFromShapePending"
  | "enterBorderEdit"
>;

interface PropertiesPanelContentProps extends ProfilePassthroughProps {
  isWorldMode: boolean;
  activeEditorMode: "view" | "border_edit";
  activeCountryId: string | null;
  mapSelectedCountry: SelectedCountry | null;
  borderState: BorderEditorState;
  borderActions: BorderEditorActions;
  editor: MapEditorInstance;
  countryInfo?: { name?: string; flag?: string | null; flagUrl?: string | null } | null;
  featureDetails?: EditorFeatureDetails | null;
  updatePropertiesMutation: {
    isPending: boolean;
    mutateAsync: (args: {
      featureId: string;
      displayName?: string;
      countryId?: string | null;
      properties?: Record<string, string | number | boolean | null>;
      wikiPageTitle?: string | null;
      realm?: string;
    }) => Promise<{ ok?: boolean; success?: boolean } | void>;
  };
  selectedRouteId: string | null;
  setSelectedRouteId: (id: string | null) => void;
  handleSubmit: () => void;
  brushTargetId?: string | null;
  setBrushTargetId?: (id: string | null) => void;
  onEditRoute?: (routeId: string) => void;
  handleEditRoute?: (routeId: string) => void;
  /** Confirming delete from the editor state (falls back to an immediate delete). */
  handleDeleteFeature?: (feature: EditorFeature) => void | Promise<void>;
}

const asString = (v: unknown) => (typeof v === "string" ? v : undefined);
const asNumber = (v: unknown) => (typeof v === "number" ? v : undefined);
const asBoolean = (v: unknown) => (typeof v === "boolean" ? v : undefined);

type RouteStatus = "planned" | "under_construction" | "operational" | "abandoned";

type PendingPointInfoSource = RouterOutputs["geoCore"]["getPointInfo"];

/** Terrain under a freshly placed point (feeds the placement summary and smart suggestions). */
function usePendingPointInfo(editor: MapEditorInstance) {
  const realm = useMapRealm();
  const coords = editor.pendingCoordinates;
  const enabled =
    !!coords &&
    (editor.mode === "add-city" || editor.mode === "add-poi" || editor.mode === "add-peak");
  const { data, isFetching } = api.geoCore.getPointInfo.useQuery(
    { lng: coords?.[0] ?? 0, lat: coords?.[1] ?? 0, realm },
    { enabled, staleTime: 5 * 60_000 }
  );
  return {
    pendingPointInfo: enabled && data ? toPointInfo(data) : null,
    isLoading: enabled && isFetching,
  };
}

function toPointInfo(raw: PendingPointInfoSource) {
  const elev = raw.elevation as
    | { zoneName?: string | null; color?: string | null; elevationMeters?: number | null }
    | null
    | undefined;
  const clim = raw.climate as
    { climateName?: string | null; color?: string | null } | null | undefined;
  return {
    elevation: elev
      ? {
          zoneName: elev.zoneName ?? null,
          elevationLabel:
            typeof elev.elevationMeters === "number"
              ? `${Math.round(elev.elevationMeters).toLocaleString()} m`
              : null,
          color: elev.color ?? null,
        }
      : null,
    climate: clim ? { climateName: clim.climateName ?? null, color: clim.color ?? null } : null,
  };
}

type RouteMutation = ReturnType<typeof api.transport.updateRoute.useMutation>;

/** Persists an inspector edit through the editor's per-type submit functions (or the route mutation). */
async function applyFeatureUpdate(
  editor: MapEditorInstance,
  feat: EditorFeature,
  updates: FeaturePropertyUpdates,
  updateRoute: RouteMutation,
  activeCountryId: string | null
) {
  const name = asString(updates.name);
  switch (feat.type) {
    case "city":
      await editor.submitEditCity({
        name,
        cityType: asString(updates.cityType),
        population: asNumber(updates.population),
        isNationalCapital: asBoolean(updates.isNationalCapital),
        isSubdivisionCapital: asBoolean(updates.isSubdivisionCapital),
        subdivisionId: asString(updates.subdivisionId),
      });
      return;
    case "subdivision":
      await editor.submitEditSubdivision({
        name,
        type: asString(updates.type),
        level: asNumber(updates.level),
        capital: asString(updates.capital),
        population: asNumber(updates.population),
      });
      return;
    case "poi":
    case "storyPin":
      await editor.submitEditPOI({
        name,
        category: asString(updates.category),
        description: asString(updates.description),
      });
      return;
    case "peak":
      await editor.submitEditPeak?.({ name, elevation: asNumber(updates.elevationMeters) });
      return;
    case "river":
      await editor.submitEditRiver?.({ name });
      return;
    case "lake":
      await editor.submitEditLake?.({ name });
      return;
    case "route": {
      const countryId = activeCountryId ?? (feat.properties?.countryId as string | undefined);
      if (!countryId) return;
      await updateRoute.mutateAsync({
        id: feat.id,
        countryId,
        name,
        routeType: asString(updates.routeType),
        status: asString(updates.status) as RouteStatus | undefined,
        isInternational: asBoolean(updates.isInternational),
      });
      editor.setSelectedFeature({
        ...feat,
        name: name ?? feat.name,
        properties: { ...feat.properties, ...updates },
      });
      return;
    }
    default:
  }
}

function MultiSelectionPanel({ editor }: { editor: MapEditorInstance }) {
  const selected = editor.allFeatures.filter((f: EditorFeature) => editor.selectedIds.has(f.id));
  const subdivisionCount = selected.filter((f) => f.type === "subdivision").length;

  return (
    <div className="space-y-4 px-3 py-3">
      <div className="flex items-center justify-between">
        <Eyebrow>Selection</Eyebrow>
        <span className="bg-tint-fill text-tint text-caption rounded-control-sm px-2 py-0.5">
          {editor.selectedIds.size} features selected
        </span>
      </div>

      {subdivisionCount > 1 && (
        <Card className="space-y-3 p-3">
          <div className="flex flex-col gap-1">
            <span className="text-label text-caption font-semibold">Combine regions</span>
            <span className="text-label-secondary text-footnote">
              Merge, subtract, or find overlapping areas of selected regions.
            </span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {PATHFINDER_OPERATIONS.map(({ op, label, title, variant }) => (
              <Button
                key={op}
                variant={variant}
                size="sm"
                onClick={() => editor.pathfinderOperation(op)}
                title={title}
              >
                {label}
              </Button>
            ))}
          </div>
        </Card>
      )}

      <Card className="space-y-2 p-3">
        <Eyebrow className="block">Selected items</Eyebrow>
        <div className="max-h-48 space-y-1 overflow-y-auto">
          {selected.map((f: EditorFeature) => (
            <div key={f.id} className="text-footnote flex items-center justify-between">
              <span className="text-label-secondary max-w-[180px] truncate">{f.name || f.id}</span>
              <Eyebrow>{f.type}</Eyebrow>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

const PATHFINDER_OPERATIONS = [
  { op: "union", label: "Union", title: "Merge selected regions into one", variant: "default" },
  {
    op: "subtract",
    label: "Subtract",
    title: "Subtract subsequent regions from the first",
    variant: "secondary",
  },
  {
    op: "intersect",
    label: "Intersect",
    title: "Keep only the overlapping parts",
    variant: "secondary",
  },
] as const;

function EditorFeaturePanel({
  editor,
  activeCountryId,
  selectedRouteId,
  setSelectedRouteId,
  onEditRoute,
  handleSubmit,
}: {
  editor: MapEditorInstance;
  activeCountryId: string | null;
  selectedRouteId: string | null;
  setSelectedRouteId: (id: string | null) => void;
  onEditRoute: ((routeId: string) => void) | undefined;
  handleSubmit: () => void;
}) {
  const pointInfo = usePendingPointInfo(editor);
  return (
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
      pendingPointInfo={pointInfo.pendingPointInfo}
      isPendingPointInfoLoading={pointInfo.isLoading}
      countryId={activeCountryId ?? undefined}
      routeWaypoints={editor.routeWaypoints}
      finishRoute={editor.finishRoute}
      undoLastWaypoint={editor.undoLastWaypoint}
      clearRouteWaypoints={editor.clearRouteWaypoints}
      selectedRouteId={selectedRouteId}
      onSelectRouteId={setSelectedRouteId}
      onEditRoute={onEditRoute}
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
}

function SelectedFeatureInspector({
  editor,
  feature,
  activeCountryId,
  updatePropertiesMutation,
  onEditRoute,
  onDeleteFeature,
}: {
  editor: MapEditorInstance;
  feature: EditorFeature;
  activeCountryId: string | null;
  updatePropertiesMutation: PropertiesPanelContentProps["updatePropertiesMutation"];
  onEditRoute: ((routeId: string) => void) | undefined;
  onDeleteFeature: PropertiesPanelContentProps["handleDeleteFeature"];
}) {
  const realm = useMapRealm();
  const utils = api.useUtils();
  const updateRouteMutation = api.transport.updateRoute.useMutation({
    onSuccess: () => {
      void utils.transport.getCountryRoutes.invalidate();
      void utils.transport.getAllRoutesGeoJSON.invalidate();
      void utils.transport.getTransportStats.invalidate();
    },
  });

  const handleUpdate = async (updates: FeaturePropertyUpdates) => {
    if ("wikiPageTitle" in updates && updatePropertiesMutation) {
      await updatePropertiesMutation.mutateAsync({
        featureId: feature.id,
        displayName: typeof updates.name === "string" ? updates.name : feature.name,
        wikiPageTitle: (updates.wikiPageTitle as string | null) ?? null,
        realm,
      });
    }
    await applyFeatureUpdate(editor, feature, updates, updateRouteMutation, activeCountryId);
  };

  return (
    <FeatureInspector
      feature={feature}
      allFeatures={editor.allFeatures}
      onClose={() => {
        editor.setSelectedFeature(null);
        editor.setMode("view");
      }}
      onUpdateFeature={handleUpdate}
      onUpdateCoordinates={(coords) =>
        editor.updatePointCoordinates(feature.type as FeatureType, feature.id, coords)
      }
      onDelete={() => void (onDeleteFeature ?? editor.handleDeleteFeature)(feature)}
      onSnapCoastline={
        feature.type === "city" ? () => void editor.snapCityToCoastline(feature.id) : undefined
      }
      onDuplicate={() => editor.duplicateFeature(feature)}
      onPromoteCapital={editor.promoteCapital}
      onReverseRoute={editor.reverseRoute}
      onEditRoute={onEditRoute}
      onPathfinderOperation={editor.pathfinderOperation}
      isPickingLocation={editor.isPickingLocation}
      onTogglePickLocation={() => editor.setIsPickingLocation(!editor.isPickingLocation)}
      isMutating={editor.isMutating}
    />
  );
}

function resolveCountryName(props: PropertiesPanelContentProps, geoDisplayName: string | null) {
  const { editor, activeCountryId } = props;
  const featureId = editor.countryGeo?.featureId;
  return (
    [
      props.countryInfo?.name,
      geoDisplayName,
      featureId && featureIdToDisplayName(featureId),
      props.selectedCountryName,
      props.countries?.find((c) => c.id === activeCountryId)?.name,
      props.availableCountries?.find((c) => c.id === activeCountryId)?.name,
      props.mapSelectedCountry?.displayName,
      activeCountryId && featureIdToDisplayName(activeCountryId),
    ].find(Boolean) || ""
  );
}

function BorderEditing({
  borderState,
  borderActions,
  selectedCountryName,
  brushTargetId,
  setBrushTargetId,
}: PropertiesPanelContentProps) {
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

function CountryOverview(props: PropertiesPanelContentProps & { flagUrl?: string | null }) {
  const { editor, activeCountryId } = props;
  const { countryGeo } = editor;
  const geoDisplayName = countryGeo?.country?.name || countryGeo?.displayName || null;
  return (
    <DocumentInspector
      countryName={resolveCountryName(props, geoDisplayName)}
      countryId={activeCountryId ?? undefined}
      countryGeoDisplayName={geoDisplayName}
      flagUrl={props.flagUrl}
      allFeatures={editor.allFeatures}
      areaKm2={countryGeo?.areaSqKm ?? null}
      onModeChange={editor.setMode}
    />
  );
}

export const PropertiesPanelContent = memo(function PropertiesPanelContent(
  props: PropertiesPanelContentProps
) {
  const {
    isWorldMode,
    activeEditorMode,
    activeCountryId,
    mapSelectedCountry,
    editor,
    countryInfo,
    featureDetails,
    updatePropertiesMutation,
    selectedRouteId,
    setSelectedRouteId,
    handleSubmit,
    onEditRoute,
    handleEditRoute,
    handleDeleteFeature,
  } = props;
  const effectiveOnEditRoute = onEditRoute ?? handleEditRoute;
  const { countryGeo } = editor;

  if (editor.selectedIds.size > 1) return <MultiSelectionPanel editor={editor} />;

  const featurePanel = (
    <EditorFeaturePanel
      editor={editor}
      activeCountryId={activeCountryId}
      selectedRouteId={selectedRouteId}
      setSelectedRouteId={setSelectedRouteId}
      onEditRoute={effectiveOnEditRoute}
      handleSubmit={handleSubmit}
    />
  );
  // Route editing or creation: straight to the transport form.
  if (editor.mode === "add-route" || editor.mode === "edit-route") return featurePanel;

  if (editor.selectedFeature) {
    return (
      <SelectedFeatureInspector
        editor={editor}
        feature={editor.selectedFeature}
        activeCountryId={activeCountryId}
        updatePropertiesMutation={updatePropertiesMutation}
        onEditRoute={effectiveOnEditRoute}
        onDeleteFeature={handleDeleteFeature}
      />
    );
  }

  if (isWorldMode) {
    if (activeEditorMode === "border_edit") {
      return <BorderEditing {...props} />;
    }

    if (editor.mode !== "view") return featurePanel;

    if (mapSelectedCountry) {
      return (
        <WorldCountryProfile
          {...props}
          mapSelectedCountry={mapSelectedCountry}
          featureDetails={featureDetails ?? null}
          countryGeometry={(countryGeo?.geometry as Polygon | MultiPolygon | null) ?? null}
          countryId={activeCountryId ?? ""}
        />
      );
    }

    return <CountryOverview {...props} />;
  }

  if (editor.mode !== "view") return featurePanel;

  return (
    <CountryOverview
      {...props}
      flagUrl={countryInfo?.flagUrl || countryInfo?.flag || countryGeo?.country?.flag || null}
    />
  );
});
