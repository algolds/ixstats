"use client";

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

import { ROUTE_STYLES, ROUTE_TYPE_KEYS } from "~/lib/maps/map-config";

import { CityTransformationsPopover } from "./toolbars/options/ScatterToolOptions";
import { CITY_TYPE_OPTIONS, POI_CATEGORY_OPTIONS } from "./optionLists";
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

const LASSO_OPTIONS = [
  { value: "freehand", label: "Freehand" },
  { value: "rect", label: "Rect" },
];

interface ToolOptionsBarProps {
  mode: EditorMode;
  routeType?: string;
  onRouteTypeChange?: (type: string) => void;
  routeWaypointsCount?: number;
  onUndoRouteWaypoint?: () => void;
  onClearRouteWaypoints?: () => void;
  editingRouteName?: string;
  editingRouteNodesCount?: number;
  onRouteEditCommit?: () => void;
  onRouteEditCancel?: () => void;
  cityType?: string;
  onCityTypeChange?: (type: string) => void;
  isNationalCapital?: boolean;
  onCapitalChange?: (val: boolean) => void;
  subdivisionType?: string;
  onSubdivisionTypeChange?: (type: string) => void;
  subdivisionLevel?: number;
  onSubdivisionLevelChange?: (level: number) => void;
  poiCategory?: string;
  onPoiCategoryChange?: (cat: string) => void;
  poiIcon?: string;
  onPoiIconChange?: (icon: string) => void;
  selectedCount?: number;
  onDuplicate?: () => void;
  onDelete?: () => void;
  onCopyCoords?: () => void;
  onMoveToCoords?: (lng: number, lat: number) => void;
  showGaps?: boolean;
  onToggleGaps?: () => void;
  onScatterCities?: (count: number, type: string, prefix: string) => void;
  onSnapCityToSubdivisionBorder?: () => void;
  onSnapCityToCoastline?: () => void;
  cityCoordinates?: [number, number];
  onCityCoordinatesChange?: (coords: [number, number]) => void;
  isPickingLocation?: boolean;
  onTogglePickingLocation?: () => void;
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
  selectedCitiesCount?: number;
  onMergeSelectedCities?: () => void;
  onScalePopulation?: (factor: number) => void;
  onRotateCities?: (angle: number) => void;
  onSplitCity?: (cityId: string) => void;
  showEmptyRegions?: boolean;
  onToggleEmptyRegions?: () => void;
  emptyRegionsCount?: number;
  onCreateCentroidCities?: () => void;
  rulerPoints?: [number, number][];
  rulerDistance?: number;
  onClearRuler?: () => void;
  lassoTool?: "freehand" | "rect";
  onLassoToolChange?: (tool: "freehand" | "rect") => void;
}

const ROUTE_TYPE_OPTIONS = ROUTE_TYPE_KEYS.map((k) => ({
  value: k,
  label: ROUTE_STYLES[k]?.label ?? k,
}));

const ICON = "h-3 w-3";

function ToolOptionsShell({ children }: { children: React.ReactNode }) {
  return (
    <FacetMaterial
      layer="chrome"
      role="toolbar"
      aria-label="Tool options"
      className="flex h-9 shrink-0 items-center gap-2 rounded-none px-3"
    >
      {children}
    </FacetMaterial>
  );
}

function SplitSubdivisionOptions(props: ToolOptionsBarProps) {
  const { selectedFeature } = props;
  const pointCount = props.splitPointsCount ?? 0;
  const hasRegion = selectedFeature?.type === "subdivision";
  return (
    <>
      <ToolLabel icon={Scissors} label="Split region" />
      <span className="text-label-secondary text-footnote hidden truncate md:inline">
        {hasRegion
          ? `Click points across "${selectedFeature?.name}" from edge to edge, then Split (Enter).`
          : "Select a region first, then draw a line across it."}
      </span>
      <span className="text-label-secondary text-footnote tabular-nums">{pointCount} pts</span>
      <div className={dividerClass} />
      <ToolbarButton
        tone="active"
        onClick={props.onExecuteSplitSubdivision}
        disabled={pointCount < 2 || !hasRegion}
        title="Split the region along the line (Enter)"
      >
        <Check className={ICON} /> Split
      </ToolbarButton>
      {props.onUndoWaypoint && (
        <ToolbarButton onClick={props.onUndoWaypoint} title="Undo last split point">
          <Undo2 className={ICON} /> Undo point
        </ToolbarButton>
      )}
      <ToolbarButton tone="danger" onClick={props.onCancelSplit} title="Cancel split">
        Cancel
      </ToolbarButton>
    </>
  );
}

function SelectionActions(props: ToolOptionsBarProps) {
  const { selectedCount = 0, selectedCitiesCount = 0, selectedFeature } = props;
  const { onSplitCity, onScalePopulation, onRotateCities } = props;
  return (
    <>
      <span className="text-label text-caption">{selectedCount} selected</span>
      <div className={dividerClass} />
      {props.onDuplicate && (
        <ToolbarButton onClick={props.onDuplicate} title="Duplicate">
          <Copy className={ICON} /> Duplicate
        </ToolbarButton>
      )}
      {props.onDelete && (
        <ToolbarButton tone="danger" onClick={props.onDelete} title="Delete">
          <Trash2 className={ICON} /> Delete
        </ToolbarButton>
      )}
      {selectedCount > 1 && props.onMergeSelectedSubdivisions && (
        <ToolbarButton
          onClick={props.onMergeSelectedSubdivisions}
          title="Merge selected subdivisions"
        >
          <GitMerge className={ICON} /> Merge regions
        </ToolbarButton>
      )}
      {selectedCitiesCount > 1 && props.onMergeSelectedCities && (
        <ToolbarButton onClick={props.onMergeSelectedCities} title="Merge selected cities">
          <GitMerge className={ICON} /> Merge cities
        </ToolbarButton>
      )}
      {selectedCitiesCount > 0 && onScalePopulation && onRotateCities && (
        <>
          <div className={dividerClass} />
          <Popover>
            <PopoverTrigger asChild>
              <ToolbarButton title="Scale population or rotate selected cities">
                <Sliders className={ICON} /> City Transformations...
              </ToolbarButton>
            </PopoverTrigger>
            <CityTransformationsPopover
              selectedCitiesCount={selectedCitiesCount}
              onScalePopulation={onScalePopulation}
              onRotateCities={onRotateCities}
            />
          </Popover>
        </>
      )}
      {selectedCount === 1 && selectedFeature?.type === "city" && onSplitCity && (
        <>
          <div className={dividerClass} />
          <ToolbarButton onClick={() => onSplitCity(selectedFeature.id)} title="Split city">
            <Scissors className={ICON} /> Split city
          </ToolbarButton>
        </>
      )}
    </>
  );
}

/** Duplicate / copy-coords / move-to-coords actions shared by the city and POI edit modes. */
function PointEditActions({ props, noun }: { props: ToolOptionsBarProps; noun: "city" | "POI" }) {
  const { onSplitCity } = props;
  const featureId = props.selectedFeature?.id;
  return (
    <>
      {props.onDuplicate && (
        <ToolbarButton onClick={props.onDuplicate} title={`Duplicate ${noun}`}>
          <Copy className={ICON} /> Duplicate
        </ToolbarButton>
      )}
      {noun === "city" && onSplitCity && featureId && (
        <ToolbarButton onClick={() => onSplitCity(featureId)} title="Split city">
          <Scissors className={ICON} /> Split city
        </ToolbarButton>
      )}
      {props.onCopyCoords && (
        <ToolbarButton onClick={props.onCopyCoords} title="Copy coordinates">
          <MapPin className={ICON} /> Copy coords
        </ToolbarButton>
      )}
      {props.onMoveToCoords && <MoveToCoordsInput onMove={props.onMoveToCoords} />}
    </>
  );
}

function CityOptions(props: ToolOptionsBarProps) {
  const hasSnapControls =
    props.cityCoordinates ||
    props.onCityCoordinatesChange ||
    props.onSnapCityToSubdivisionBorder ||
    props.onSnapCityToCoastline;
  return (
    <>
      <ToolLabel icon={MapPin} label="City" />
      <Eyebrow>Type</Eyebrow>
      <OptionSelect
        aria-label="City type"
        value={props.cityType ?? "city"}
        onValueChange={(v) => props.onCityTypeChange?.(v)}
        options={CITY_TYPE_OPTIONS}
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
      {props.mode === "edit-city" && (
        <>
          <div className={dividerClass} />
          <PointEditActions props={props} noun="city" />
          {hasSnapControls && (
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
  );
}

function PoiOptions(props: ToolOptionsBarProps) {
  return (
    <>
      <ToolLabel icon={Landmark} label="Point of interest" />
      <Eyebrow>Category</Eyebrow>
      <OptionSelect
        aria-label="Point of interest category"
        value={props.poiCategory ?? "landmark"}
        onValueChange={(v) => props.onPoiCategoryChange?.(v)}
        options={POI_CATEGORY_OPTIONS}
        size="sm"
        className="w-auto"
      />
      {props.mode === "edit-poi" && (
        <>
          <div className={dividerClass} />
          <PointEditActions props={props} noun="POI" />
        </>
      )}
    </>
  );
}

function LassoOptions(props: ToolOptionsBarProps) {
  return (
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
  );
}

function AddRouteOptions(props: ToolOptionsBarProps) {
  const waypoints = props.routeWaypointsCount ?? 0;
  return (
    <>
      <ToolLabel icon={Route} label="Draw route" />
      <Eyebrow>Type</Eyebrow>
      <OptionSelect
        aria-label="Route type"
        size="sm"
        className="w-auto"
        value={props.routeType ?? "road"}
        onValueChange={(v) => props.onRouteTypeChange?.(v)}
        options={ROUTE_TYPE_OPTIONS}
      />
      <div className={dividerClass} />
      <span className="text-label-secondary text-footnote tabular-nums">{waypoints} waypoints</span>
      {props.onUndoRouteWaypoint && waypoints > 0 && (
        <ToolbarButton onClick={props.onUndoRouteWaypoint} title="Undo last waypoint">
          <Undo2 className={ICON} /> Undo
        </ToolbarButton>
      )}
      {props.onClearRouteWaypoints && waypoints > 0 && (
        <ToolbarButton
          tone="danger"
          onClick={props.onClearRouteWaypoints}
          title="Clear all waypoints"
        >
          <Trash2 className={ICON} /> Clear
        </ToolbarButton>
      )}
    </>
  );
}

function EditRouteOptions(props: ToolOptionsBarProps) {
  return (
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
  );
}

const CENTROID_CITY_MODES: EditorMode[] = ["view", "add-city", "edit-city", "add-subdivision"];

function ModeOptions(props: ToolOptionsBarProps) {
  const { mode } = props;
  switch (mode) {
    case "view":
      return (props.selectedCount ?? 0) > 0 ? <SelectionActions {...props} /> : null;
    case "add-city":
    case "edit-city":
      return <CityOptions {...props} />;
    case "add-subdivision":
    case "edit-subdivision":
      return (
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
      );
    case "add-poi":
    case "edit-poi":
      return <PoiOptions {...props} />;
    case "lasso-select":
      return <LassoOptions {...props} />;
    case "ruler":
      return (
        <RulerOptions
          rulerPoints={props.rulerPoints}
          rulerDistance={props.rulerDistance}
          onClearRuler={props.onClearRuler}
        />
      );
    case "add-route":
      return <AddRouteOptions {...props} />;
    case "edit-route":
      return <EditRouteOptions {...props} />;
    default:
      return null;
  }
}

export const ToolOptionsBar = memo(function ToolOptionsBar(props: ToolOptionsBarProps) {
  const { mode, emptyRegionsCount = 0 } = props;
  const hasGapHighlight = props.showGaps && emptyRegionsCount > 0;

  if (
    mode === "import-provinces" ||
    (mode === "view" && !props.selectedCount && !hasGapHighlight)
  ) {
    return null;
  }

  if (mode === "split-subdivision") {
    return (
      <ToolOptionsShell>
        <SplitSubdivisionOptions {...props} />
      </ToolOptionsShell>
    );
  }

  return (
    <ToolOptionsShell>
      {hasGapHighlight && props.onCreateCentroidCities && CENTROID_CITY_MODES.includes(mode) && (
        <>
          <ToolbarButton
            tone="active"
            onClick={props.onCreateCentroidCities}
            title="Create centroid-based cities in all empty regions"
          >
            <Plus aria-hidden /> Auto-create cities ({emptyRegionsCount})
          </ToolbarButton>
          <div className={dividerClass} />
        </>
      )}
      <ModeOptions {...props} />
    </ToolOptionsShell>
  );
});
