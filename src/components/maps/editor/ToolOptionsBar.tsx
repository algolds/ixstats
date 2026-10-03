"use client";

/**
 * ToolOptionsBar — Photoshop-style context bar that changes per active tool.
 *
 * Sits between the title bar and the canvas. Shows the most important
 * settings for the current tool inline, so users can configure without
 * opening the right panel.
 *
 * Height: 32px, matches Photoshop's slim context bar.
 */

import React, { memo } from "react";
import {
  Crown,
  Trash as Trash2,
  Copy,
  MapPin,
  Bank as Landmark,
  Check,
  Undo as Undo2,
  Cut as Scissors,
  GitMerge,
  ControlSlider as Sliders,
  Plus,
  SelectWindow as LassoSelect,
  PathArrow as Route,
} from "iconoir-react";
import type { EditorMode, EditorFeature } from "~/hooks/useMapEditor";
import { Popover, PopoverTrigger } from "~/components/ui/popover";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Eyebrow } from "~/components/ui/eyebrow";
import { FacetMaterial } from "~/components/ui/facet";

const LASSO_OPTIONS = [
  { value: "freehand", label: "Freehand" },
  { value: "rect", label: "Rect" },
];
import { ROUTE_STYLES, ROUTE_TYPE_KEYS } from "~/lib/maps/map-config";

import { CityTransformationsPopover } from "./toolbars/options/ScatterToolOptions";
import { SubdivisionOptions } from "./toolbars/options/SubdivisionOptions";
import { RulerOptions } from "./toolbars/options/RulerOptions";
import {
  CoordinateSnappingControls,
  MoveToCoordsInput,
  ToolLabel,
  ToolbarButton,
  dividerClass,
} from "./toolbars/options/CoordinateSnappingControls";
import { Checkbox } from "~/components/ui/checkbox";
import { OptionSelect } from "~/components/maps/shared/OptionSelect";
import { SegmentedControl } from "~/components/ui/segmented-control";

interface ToolOptionsBarProps {
  mode: EditorMode;
  // Routes
  routeType?: string;
  onRouteTypeChange?: (type: string) => void;
  routeWaypointsCount?: number;
  onUndoRouteWaypoint?: () => void;
  onClearRouteWaypoints?: () => void;
  editingRouteName?: string;
  editingRouteNodesCount?: number;
  onRouteEditCommit?: () => void;
  onRouteEditCancel?: () => void;
  // City
  cityType?: string;
  onCityTypeChange?: (type: string) => void;
  isNationalCapital?: boolean;
  onCapitalChange?: (val: boolean) => void;
  // Subdivision
  subdivisionType?: string;
  onSubdivisionTypeChange?: (type: string) => void;
  subdivisionLevel?: number;
  onSubdivisionLevelChange?: (level: number) => void;
  // POI
  poiCategory?: string;
  onPoiCategoryChange?: (cat: string) => void;
  poiIcon?: string;
  onPoiIconChange?: (icon: string) => void;
  // Selection
  selectedCount?: number;
  onDuplicate?: () => void;
  onDelete?: () => void;
  // Point feature actions (city/POI — used in edit mode)
  onCopyCoords?: () => void;
  onMoveToCoords?: (lng: number, lat: number) => void;
  // Gap / Negative Space
  showGaps?: boolean;
  onToggleGaps?: () => void;
  // City scatter/snapping
  onScatterCities?: (count: number, type: string, prefix: string) => void;
  onSnapCityToSubdivisionBorder?: () => void;
  onSnapCityToCoastline?: () => void;
  cityCoordinates?: [number, number];
  onCityCoordinatesChange?: (coords: [number, number]) => void;
  isPickingLocation?: boolean;
  onTogglePickingLocation?: () => void;
  // Subdivision split/merge/transforms
  onStartSplitSubdivision?: () => void;
  onExecuteSplitSubdivision?: () => void;
  onMergeSelectedSubdivisions?: () => void;
  onApplyGeometryTransformation?: (
    type: "simplify" | "smooth" | "rotate" | "scale",
    value: number
  ) => void;
  onUndoWaypoint?: () => void;
  onCancelSplit?: () => void;
  /** Points placed on the split line so far. */
  splitPointsCount?: number;
  selectedFeature?: EditorFeature | null;
  // City operations
  selectedCitiesCount?: number;
  onMergeSelectedCities?: () => void;
  onScalePopulation?: (factor: number) => void;
  onRotateCities?: (angle: number) => void;
  onSplitCity?: (cityId: string) => void;
  // Empty subdivisions
  showEmptyRegions?: boolean;
  onToggleEmptyRegions?: () => void;
  emptyRegionsCount?: number;
  onCreateCentroidCities?: () => void;
  // Ruler measuring
  rulerPoints?: [number, number][];
  rulerDistance?: number;
  onClearRuler?: () => void;
  // Lasso select options
  lassoTool?: "freehand" | "rect";
  onLassoToolChange?: (tool: "freehand" | "rect") => void;
}

const CITY_TYPES = [
  { value: "capital", label: "Capital" },
  { value: "city", label: "City" },
  { value: "town", label: "Town" },
  { value: "village", label: "Village" },
  { value: "hamlet", label: "Hamlet" },
  { value: "port", label: "Port" },
  { value: "fortress", label: "Fortress" },
];

const SUBDIVISION_TYPES = [
  { value: "province", label: "Province" },
  { value: "state", label: "State" },
  { value: "region", label: "Region" },
  { value: "territory", label: "Territory" },
  { value: "district", label: "District" },
  { value: "county", label: "County" },
  { value: "department", label: "Department" },
];

const POI_CATEGORIES = [
  { value: "landmark", label: "Landmark" },
  { value: "historical", label: "Historical" },
  { value: "natural", label: "Natural" },
  { value: "religious", label: "Religious" },
  { value: "military", label: "Military" },
  { value: "cultural", label: "Cultural" },
  { value: "economic", label: "Economic" },
  { value: "educational", label: "Educational" },
  { value: "monument", label: "Monument" },
  { value: "ruins", label: "Ruins" },
];

export const ToolOptionsBar = memo(function ToolOptionsBar(props: ToolOptionsBarProps) {
  const { mode } = props;

  // Don't render for view mode with no selection unless gap highlight is present
  if (
    mode === "view" &&
    !props.selectedCount &&
    !(props.showGaps && (props.emptyRegionsCount ?? 0) > 0)
  ) {
    return null;
  }
  if (mode === "import-provinces") return null;

  if (mode === "split-subdivision") {
    return (
      <FacetMaterial
        material="regular"
        role="toolbar"
        aria-label="Tool options"
        className="flex h-9 shrink-0 items-center gap-2 rounded-none px-3"
      >
        <ToolLabel icon={Scissors} label="Split region" />
        <span className="text-label-secondary text-footnote hidden truncate md:inline">
          {props.selectedFeature?.type === "subdivision"
            ? `Click points across "${props.selectedFeature.name}" from edge to edge, then Split (Enter).`
            : "Select a region first, then draw a line across it."}
        </span>
        <span className="text-label-secondary text-footnote tabular-nums">
          {props.splitPointsCount ?? 0} pts
        </span>
        <div className={dividerClass} />
        <ToolbarButton
          tone="active"
          onClick={props.onExecuteSplitSubdivision}
          disabled={
            (props.splitPointsCount ?? 0) < 2 || props.selectedFeature?.type !== "subdivision"
          }
          title="Split the region along the line (Enter)"
        >
          <Check className="h-3 w-3" /> Split
        </ToolbarButton>
        {props.onUndoWaypoint && (
          <ToolbarButton onClick={props.onUndoWaypoint} title="Undo last split point">
            <Undo2 className="h-3 w-3" /> Undo point
          </ToolbarButton>
        )}
        <ToolbarButton tone="danger" onClick={props.onCancelSplit} title="Cancel split">
          Cancel
        </ToolbarButton>
      </FacetMaterial>
    );
  }

  return (
    <FacetMaterial
      material="regular"
      role="toolbar"
      aria-label="Tool options"
      className="flex h-9 shrink-0 items-center gap-2 rounded-none px-3"
    >
      {/* ── Auto-Create Cities button when gaps/empty highlighting is active ── */}
      {props.showGaps &&
        props.emptyRegionsCount! > 0 &&
        props.onCreateCentroidCities &&
        (mode === "view" ||
          mode === "add-city" ||
          mode === "edit-city" ||
          mode === "add-subdivision") && (
          <>
            <ToolbarButton
              tone="active"
              onClick={props.onCreateCentroidCities}
              title="Create centroid-based cities in all empty regions"
            >
              <Plus aria-hidden /> Auto-create cities ({props.emptyRegionsCount})
            </ToolbarButton>
            <div className={dividerClass} />
          </>
        )}

      {/* ── Select mode ── */}
      {mode === "view" && props.selectedCount! > 0 && (
        <>
          <span className="text-label text-caption">{props.selectedCount} selected</span>
          <div className={dividerClass} />
          {props.onDuplicate && (
            <ToolbarButton onClick={props.onDuplicate} title="Duplicate">
              <Copy className="h-3 w-3" /> Duplicate
            </ToolbarButton>
          )}
          {props.onDelete && (
            <ToolbarButton tone="danger" onClick={props.onDelete} title="Delete">
              <Trash2 className="h-3 w-3" /> Delete
            </ToolbarButton>
          )}
          {props.selectedCount! > 1 && props.onMergeSelectedSubdivisions && (
            <ToolbarButton
              onClick={props.onMergeSelectedSubdivisions}
              title="Merge selected subdivisions"
            >
              <GitMerge className="h-3 w-3" /> Merge regions
            </ToolbarButton>
          )}
          {props.selectedCitiesCount! > 1 && props.onMergeSelectedCities && (
            <ToolbarButton onClick={props.onMergeSelectedCities} title="Merge selected cities">
              <GitMerge className="h-3 w-3" /> Merge cities
            </ToolbarButton>
          )}
          {props.selectedCitiesCount! > 0 && props.onScalePopulation && props.onRotateCities && (
            <>
              <div className={dividerClass} />
              <Popover>
                <PopoverTrigger asChild>
                  <ToolbarButton title="Scale population or rotate selected cities">
                    <Sliders className="h-3 w-3" /> City Transformations...
                  </ToolbarButton>
                </PopoverTrigger>
                <CityTransformationsPopover
                  selectedCitiesCount={props.selectedCitiesCount!}
                  onScalePopulation={props.onScalePopulation}
                  onRotateCities={props.onRotateCities}
                />
              </Popover>
            </>
          )}
          {props.selectedCount === 1 &&
            props.selectedFeature?.type === "city" &&
            props.onSplitCity && (
              <>
                <div className={dividerClass} />
                <ToolbarButton
                  onClick={() => props.onSplitCity!(props.selectedFeature!.id)}
                  title="Split city"
                >
                  <Scissors className="h-3 w-3" /> Split city
                </ToolbarButton>
              </>
            )}
        </>
      )}

      {/* ── City mode ── */}
      {(mode === "add-city" || mode === "edit-city") && (
        <>
          <ToolLabel icon={MapPin} label="City" />
          <Eyebrow>Type</Eyebrow>
          <OptionSelect
            aria-label="City type"
            value={props.cityType ?? "city"}
            onValueChange={(v) => props.onCityTypeChange?.(v)}
            options={CITY_TYPES}
            size="sm"
            className="w-auto"
          />
          <label className="flex cursor-pointer items-center gap-1">
            <Checkbox
              checked={props.isNationalCapital ?? false}
              onCheckedChange={(c) => props.onCapitalChange?.(c === true)}
            />
            <Crown className="text-yellow h-3 w-3" />
            <span className="text-label-secondary text-footnote">Capital</span>
          </label>
          {mode === "edit-city" && (
            <>
              <div className={dividerClass} />
              {props.onDuplicate && (
                <ToolbarButton onClick={props.onDuplicate} title="Duplicate city">
                  <Copy className="h-3 w-3" /> Duplicate
                </ToolbarButton>
              )}
              {props.onSplitCity && props.selectedFeature?.id && (
                <ToolbarButton
                  onClick={() => props.onSplitCity!(props.selectedFeature!.id)}
                  title="Split city"
                >
                  <Scissors className="h-3 w-3" /> Split city
                </ToolbarButton>
              )}
              {props.onCopyCoords && (
                <ToolbarButton onClick={props.onCopyCoords} title="Copy coordinates">
                  <MapPin className="h-3 w-3" /> Copy coords
                </ToolbarButton>
              )}
              {props.onMoveToCoords && <MoveToCoordsInput onMove={props.onMoveToCoords} />}
              {(props.cityCoordinates ||
                props.onCityCoordinatesChange ||
                props.onSnapCityToSubdivisionBorder ||
                props.onSnapCityToCoastline) && (
                <>
                  <div className={dividerClass} />
                  <CoordinateSnappingControls
                    coords={props.cityCoordinates}
                    onCoordsChange={props.onCityCoordinatesChange}
                    onSnapBorder={props.onSnapCityToSubdivisionBorder}
                    onSnapCoast={props.onSnapCityToCoastline}
                    isPickingLocation={props.isPickingLocation}
                    onTogglePickingLocation={props.onTogglePickingLocation}
                  />
                </>
              )}
            </>
          )}
        </>
      )}

      {/* ── Region mode ── */}
      {(mode === "add-subdivision" || mode === "edit-subdivision") && (
        <SubdivisionOptions
          isEditMode={mode === "edit-subdivision"}
          subdivisionType={props.subdivisionType}
          onSubdivisionTypeChange={props.onSubdivisionTypeChange}
          subdivisionLevel={props.subdivisionLevel}
          onSubdivisionLevelChange={props.onSubdivisionLevelChange}
          onDuplicate={props.onDuplicate}
          onStartSplitSubdivision={props.onStartSplitSubdivision}
          onScatterCities={props.onScatterCities}
          onApplyGeometryTransformation={props.onApplyGeometryTransformation}
        />
      )}

      {/* ── POI mode ── */}
      {(mode === "add-poi" || mode === "edit-poi") && (
        <>
          <ToolLabel icon={Landmark} label="Point of interest" />
          <Eyebrow>Category</Eyebrow>
          <OptionSelect
            aria-label="Point of interest category"
            value={props.poiCategory ?? "landmark"}
            onValueChange={(v) => props.onPoiCategoryChange?.(v)}
            options={POI_CATEGORIES}
            size="sm"
            className="w-auto"
          />
          {mode === "edit-poi" && (
            <>
              <div className={dividerClass} />
              {props.onDuplicate && (
                <ToolbarButton onClick={props.onDuplicate} title="Duplicate POI">
                  <Copy className="h-3 w-3" /> Duplicate
                </ToolbarButton>
              )}
              {props.onCopyCoords && (
                <ToolbarButton onClick={props.onCopyCoords} title="Copy coordinates">
                  <MapPin className="h-3 w-3" /> Copy coords
                </ToolbarButton>
              )}
              {props.onMoveToCoords && <MoveToCoordsInput onMove={props.onMoveToCoords} />}
            </>
          )}
        </>
      )}

      {/* ── Lasso Select mode ── */}
      {mode === "lasso-select" && (
        <>
          <ToolLabel icon={LassoSelect} label="Lasso select" />
          <span className="text-label-secondary text-footnote">
            Drag to select features. Freehand draws a loop; Rect draws a box. Shift = add, Alt =
            subtract.
          </span>
          <SegmentedControl
            aria-label="Lasso shape"
            options={LASSO_OPTIONS}
            value={props.lassoTool ?? "freehand"}
            onValueChange={(tool) => props.onLassoToolChange?.(tool as "freehand" | "rect")}
            size="sm"
          />
        </>
      )}

      {/* ── Ruler mode ── */}
      {mode === "ruler" && (
        <RulerOptions
          rulerPoints={props.rulerPoints}
          rulerDistance={props.rulerDistance}
          onClearRuler={props.onClearRuler}
        />
      )}

      {/* ── Add Route mode ── */}
      {mode === "add-route" && (
        <>
          <ToolLabel icon={Route} label="Draw route" />
          <Eyebrow>Type</Eyebrow>
          <OptionSelect
            aria-label="Route type"
            size="sm"
            className="w-auto"
            value={props.routeType ?? "road"}
            onValueChange={(v) => props.onRouteTypeChange?.(v)}
            options={ROUTE_TYPE_KEYS.map((k) => ({ value: k, label: ROUTE_STYLES[k]?.label ?? k }))}
          />
          <div className={dividerClass} />
          <span className="text-label-secondary text-footnote tabular-nums">
            {props.routeWaypointsCount ?? 0} waypoints
          </span>
          {props.onUndoRouteWaypoint && (props.routeWaypointsCount ?? 0) > 0 && (
            <ToolbarButton onClick={props.onUndoRouteWaypoint} title="Undo last waypoint">
              <Undo2 className="h-3 w-3" /> Undo
            </ToolbarButton>
          )}
          {props.onClearRouteWaypoints && (props.routeWaypointsCount ?? 0) > 0 && (
            <ToolbarButton
              tone="danger"
              onClick={props.onClearRouteWaypoints}
              title="Clear all waypoints"
            >
              <Trash2 className="h-3 w-3" /> Clear
            </ToolbarButton>
          )}
        </>
      )}

      {/* ── Edit Route mode ── */}
      {mode === "edit-route" && (
        <>
          <ToolLabel icon={Route} label="Edit route" />
          {props.editingRouteName && <Badge variant="default">{props.editingRouteName}</Badge>}
          <span className="text-label-secondary text-footnote tabular-nums">
            {props.editingRouteNodesCount ?? 0} nodes
          </span>
          <div className={dividerClass} />
          {props.onRouteEditCommit && (
            <Button size="xs" onClick={props.onRouteEditCommit} title="Save route geometry">
              <Check aria-hidden /> Save path
            </Button>
          )}
          {props.onRouteEditCancel && (
            <ToolbarButton onClick={props.onRouteEditCancel} title="Cancel route editing">
              Cancel
            </ToolbarButton>
          )}
        </>
      )}
    </FacetMaterial>
  );
});
