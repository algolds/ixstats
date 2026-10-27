"use client";
import React, { useMemo } from "react";
import { ToolOptionsBar } from "~/components/maps/editor/ToolOptionsBar";
import { haversineDistance } from "~/components/maps/editor/utils/map-helpers";
import type { MapEditorInstance } from "../types/editor-state";

/** Wires the editor instance into the tool options bar. */
export function ConnectedToolOptionsBar({
  editor,
  onDeleteSelection,
}: {
  editor: MapEditorInstance;
  onDeleteSelection: () => void;
}) {
  const { selectedFeature: feature, selectedIds, rulerPoints } = editor;

  const selectedCitiesCount = useMemo(
    () => editor.allFeatures.filter((f) => selectedIds.has(f.id) && f.type === "city").length,
    [editor.allFeatures, selectedIds]
  );
  const rulerDistance = useMemo(
    () =>
      (rulerPoints ?? []).reduce(
        (total, point, i, pts) => (i > 0 ? total + haversineDistance(pts[i - 1]!, point) : total),
        0
      ),
    [rulerPoints]
  );

  const moveFeature = feature
    ? (coords: [number, number]) => editor.updatePointCoordinates(feature.type, feature.id, coords)
    : undefined;

  return (
    <ToolOptionsBar
      mode={editor.mode}
      cityType={editor.cityForm.cityType}
      onCityTypeChange={(cityType) => editor.setCityForm((f) => ({ ...f, cityType }))}
      isNationalCapital={editor.cityForm.isNationalCapital}
      onCapitalChange={(isNationalCapital) =>
        editor.setCityForm((f) => ({ ...f, isNationalCapital }))
      }
      subdivisionType={editor.subdivisionForm.type}
      onSubdivisionTypeChange={(type) => editor.setSubdivisionForm((f) => ({ ...f, type }))}
      subdivisionLevel={editor.subdivisionForm.level}
      onSubdivisionLevelChange={(level) => editor.setSubdivisionForm((f) => ({ ...f, level }))}
      poiCategory={editor.poiForm.category}
      onPoiCategoryChange={(category) => editor.setPOIForm((f) => ({ ...f, category }))}
      selectedCount={selectedIds.size > 0 ? selectedIds.size : feature ? 1 : 0}
      onDuplicate={feature ? () => editor.duplicateFeature(feature) : undefined}
      onDelete={selectedIds.size > 0 || feature ? onDeleteSelection : undefined}
      routeType={editor.routeType}
      onRouteTypeChange={editor.setRouteType}
      routeWaypointsCount={editor.routeWaypoints.length}
      onUndoRouteWaypoint={editor.undoLastWaypoint}
      onClearRouteWaypoints={editor.clearRouteWaypoints}
      editingRouteName={feature?.type === "route" ? feature.name : undefined}
      editingRouteNodesCount={editor.editingRouteVertices.length}
      onRouteEditCommit={editor.commitRouteEdit}
      onRouteEditCancel={editor.cancelRouteEdit}
      showGaps={editor.showGaps}
      emptyRegionsCount={editor.emptyRegionsFeatures?.features?.length ?? 0}
      onCreateCentroidCities={() => void editor.createCentroidCities()}
      onCopyCoords={
        feature?.coordinates
          ? () => {
              const [lng, lat] = feature.coordinates!;
              void navigator.clipboard?.writeText(`${lat.toFixed(5)}, ${lng.toFixed(5)}`);
            }
          : undefined
      }
      onMoveToCoords={moveFeature && ((lng, lat) => moveFeature([lng, lat]))}
      onScatterCities={(count, type, prefix) => {
        void editor.scatterCities(count, type, prefix);
      }}
      onSnapCityToSubdivisionBorder={
        feature ? () => editor.snapCityToSubdivisionBorder() : undefined
      }
      onSnapCityToCoastline={feature ? () => editor.snapCityToCoastline() : undefined}
      cityCoordinates={feature?.coordinates}
      onCityCoordinatesChange={moveFeature}
      isPickingLocation={editor.isPickingLocation}
      onTogglePickingLocation={() => editor.setIsPickingLocation((p) => !p)}
      onStartSplitSubdivision={() => editor.setMode("split-subdivision")}
      onExecuteSplitSubdivision={() => {
        if (feature) void editor.executeSplitSubdivision(feature.id);
      }}
      splitPointsCount={editor.splitLine.length}
      onUndoWaypoint={editor.splitLine.length > 0 ? editor.undoLastSplitPoint : undefined}
      onMergeSelectedSubdivisions={editor.mergeSelectedSubdivisions}
      onApplyGeometryTransformation={(type, value) => {
        if (feature && (type === "rotate" || type === "scale")) {
          void editor.applyGeometryTransformation(feature.id, { type, factor: value });
        }
      }}
      onCancelSplit={() => editor.setMode(feature ? "edit-subdivision" : "view")}
      selectedFeature={feature}
      selectedCitiesCount={selectedCitiesCount}
      onMergeSelectedCities={editor.mergeSelectedCities}
      onScalePopulation={editor.scaleSelectedCitiesPopulation}
      onRotateCities={editor.rotateSelectedCities}
      onSplitCity={editor.splitCity}
      rulerPoints={rulerPoints}
      rulerDistance={rulerDistance}
      onClearRuler={editor.clearRuler}
      lassoTool={editor.lassoTool}
      onLassoToolChange={editor.setLassoTool}
    />
  );
}
