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
  Sparks as Sparkles,
  SelectWindow as LassoSelect,
  PathArrow as Route,
} from "iconoir-react";
import type { EditorMode, EditorFeature } from "~/hooks/useMapEditor";
import { Popover, PopoverTrigger } from "~/components/ui/popover";
import { ROUTE_STYLES, ROUTE_TYPE_KEYS } from "~/lib/maps/map-config";

import {
  CityTransformationsPopover,
} from "./toolbars/options/ScatterToolOptions";
import { SubdivisionOptions } from "./toolbars/options/SubdivisionOptions";
import { RulerOptions } from "./toolbars/options/RulerOptions";
import {
  CoordinateSnappingControls,
  MoveToCoordsInput,
  ToolLabel,
  btnClass,
  activeBtnClass,
  dangerBtnClass,
  labelClass,
  dividerClass,
  selectClass,
} from "./toolbars/options/CoordinateSnappingControls";

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
  // Lasso select options (Plan 120 P3)
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
  if (mode === "view" && !props.selectedCount && !props.onToggleGaps) return null;
  if (mode === "import-provinces") return null;

  if (mode === "split-subdivision") {
    return (
      <div className="border-border bg-card/90 flex h-8 shrink-0 items-center gap-2 border-b px-3 backdrop-blur-md transition-all duration-200 ease-out">
        <ToolLabel icon={Scissors} label="Split Subdivision" />
        <span className="text-muted-foreground text-[11px]">
          Click on the map to draw a split-line slicing through the subdivision.
        </span>
        <div className={dividerClass} />
        <button
          onClick={props.onExecuteSplitSubdivision}
          className={activeBtnClass}
          title="Execute Split"
        >
          <Check className="h-3 w-3" /> Execute Split
        </button>
        {props.onUndoWaypoint && (
          <button onClick={props.onUndoWaypoint} className={btnClass} title="Undo last split point">
            <Undo2 className="h-3 w-3" /> Undo Point
          </button>
        )}
        <button onClick={props.onCancelSplit} className={dangerBtnClass} title="Cancel Split">
          Cancel
        </button>
      </div>
    );
  }

  return (
    <div className="border-border bg-card/90 flex h-8 shrink-0 items-center gap-2 border-b px-3 backdrop-blur-md transition-all duration-200 ease-out">
      {/* ── Auto-Create Cities button when gaps/empty highlighting is active ── */}
      {props.showGaps &&
        props.emptyRegionsCount! > 0 &&
        props.onCreateCentroidCities &&
        (mode === "view" ||
          mode === "add-city" ||
          mode === "edit-city" ||
          mode === "add-subdivision") && (
          <>
            <button
              onClick={props.onCreateCentroidCities}
              className="flex h-6 items-center gap-1 rounded bg-emerald-500/10 px-1.5 text-[11px] text-emerald-500 hover:bg-emerald-500/20"
              title="Create centroid-based cities in all empty regions"
            >
              <Sparkles className="h-3 w-3" /> Auto-Create Cities ({props.emptyRegionsCount})
            </button>
            <div className={dividerClass} />
          </>
        )}

      {/* ── Select mode ── */}
      {mode === "view" && props.selectedCount! > 0 && (
        <>
          <span className="text-foreground text-[11px] font-medium">
            {props.selectedCount} selected
          </span>
          <div className={dividerClass} />
          {props.onDuplicate && (
            <button onClick={props.onDuplicate} className={btnClass} title="Duplicate">
              <Copy className="h-3 w-3" /> Duplicate
            </button>
          )}
          {props.onDelete && (
            <button onClick={props.onDelete} className={dangerBtnClass} title="Delete">
              <Trash2 className="h-3 w-3" /> Delete
            </button>
          )}
          {props.selectedCount! > 1 && props.onMergeSelectedSubdivisions && (
            <button
              onClick={props.onMergeSelectedSubdivisions}
              className={btnClass}
              title="Merge selected subdivisions"
            >
              <GitMerge className="h-3 w-3" /> Merge Regions
            </button>
          )}
          {props.selectedCitiesCount! > 1 && props.onMergeSelectedCities && (
            <button
              onClick={props.onMergeSelectedCities}
              className={btnClass}
              title="Merge selected cities"
            >
              <GitMerge className="h-3 w-3" /> Merge Cities
            </button>
          )}
          {props.selectedCitiesCount! > 0 && props.onScalePopulation && props.onRotateCities && (
            <>
              <div className={dividerClass} />
              <Popover>
                <PopoverTrigger asChild>
                  <button className={btnClass} title="Scale population or rotate selected cities">
                    <Sliders className="h-3 w-3" /> City Transformations...
                  </button>
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
                <button
                  onClick={() => props.onSplitCity!(props.selectedFeature!.id)}
                  className={btnClass}
                  title="Split city"
                >
                  <Scissors className="h-3 w-3" /> Split City
                </button>
              </>
            )}
        </>
      )}

      {/* ── City mode ── */}
      {(mode === "add-city" || mode === "edit-city") && (
        <>
          <ToolLabel icon={MapPin} label="City" />
          <span className={labelClass}>Type</span>
          <select
            value={props.cityType ?? "city"}
            onChange={(e) => props.onCityTypeChange?.(e.target.value)}
            className={selectClass}
          >
            {CITY_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
          <label className="flex cursor-pointer items-center gap-1">
            <input
              type="checkbox"
              checked={props.isNationalCapital ?? false}
              onChange={(e) => props.onCapitalChange?.(e.target.checked)}
              className="border-border h-3 w-3 rounded"
            />
            <Crown className="h-3 w-3 text-amber-500" />
            <span className="text-muted-foreground text-[11px]">Capital</span>
          </label>
          {mode === "edit-city" && (
            <>
              <div className={dividerClass} />
              {props.onDuplicate && (
                <button onClick={props.onDuplicate} className={btnClass} title="Duplicate city">
                  <Copy className="h-3 w-3" /> Duplicate
                </button>
              )}
              {props.onSplitCity && props.selectedFeature?.id && (
                <button
                  onClick={() => props.onSplitCity!(props.selectedFeature!.id)}
                  className={btnClass}
                  title="Split city"
                >
                  <Scissors className="h-3 w-3" /> Split City
                </button>
              )}
              {props.onCopyCoords && (
                <button onClick={props.onCopyCoords} className={btnClass} title="Copy coordinates">
                  <MapPin className="h-3 w-3" /> Copy Coords
                </button>
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
          <ToolLabel icon={Landmark} label="Point of Interest" />
          <span className={labelClass}>Category</span>
          <select
            value={props.poiCategory ?? "landmark"}
            onChange={(e) => props.onPoiCategoryChange?.(e.target.value)}
            className={selectClass}
          >
            {POI_CATEGORIES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
          {mode === "edit-poi" && (
            <>
              <div className={dividerClass} />
              {props.onDuplicate && (
                <button onClick={props.onDuplicate} className={btnClass} title="Duplicate POI">
                  <Copy className="h-3 w-3" /> Duplicate
                </button>
              )}
              {props.onCopyCoords && (
                <button onClick={props.onCopyCoords} className={btnClass} title="Copy coordinates">
                  <MapPin className="h-3 w-3" /> Copy Coords
                </button>
              )}
              {props.onMoveToCoords && <MoveToCoordsInput onMove={props.onMoveToCoords} />}
            </>
          )}
        </>
      )}


      {/* ── Lasso Select mode ── */}
      {mode === "lasso-select" && (
        <>
          <ToolLabel icon={LassoSelect} label="Lasso Select" />
          <span className="text-muted-foreground text-[11px]">
            Drag to select features. Freehand draws a loop; Rect draws a box. Shift = add, Alt =
            subtract.
          </span>
          <div className="border-border/50 bg-background/80 flex items-center gap-0.5 rounded border p-0.5">
            {(["freehand", "rect"] as const).map((tool) => (
              <button
                key={tool}
                onClick={() => props.onLassoToolChange?.(tool)}
                className={`h-5 rounded px-2 text-[10px] font-medium transition-colors ${
                  (props.lassoTool ?? "freehand") === tool
                    ? "bg-primary/15 text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {tool === "freehand" ? "Freehand" : "Rect"}
              </button>
            ))}
          </div>
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
          <ToolLabel icon={Route} label="Draw Route" />
          <span className={labelClass}>Type</span>
          <select
            value={props.routeType ?? "road"}
            onChange={(e) => props.onRouteTypeChange?.(e.target.value)}
            className={selectClass}
          >
            {ROUTE_TYPE_KEYS.map((k) => (
              <option key={k} value={k}>
                {ROUTE_STYLES[k]?.label ?? k}
              </option>
            ))}
          </select>
          <div className={dividerClass} />
          <span className="text-[11px] font-mono tabular-nums text-muted-foreground">
            {props.routeWaypointsCount ?? 0} waypoints
          </span>
          {props.onUndoRouteWaypoint && (props.routeWaypointsCount ?? 0) > 0 && (
            <button onClick={props.onUndoRouteWaypoint} className={btnClass} title="Undo last waypoint">
              <Undo2 className="h-3 w-3" /> Undo
            </button>
          )}
          {props.onClearRouteWaypoints && (props.routeWaypointsCount ?? 0) > 0 && (
            <button onClick={props.onClearRouteWaypoints} className={dangerBtnClass} title="Clear all waypoints">
              <Trash2 className="h-3 w-3" /> Clear
            </button>
          )}
        </>
      )}

      {/* ── Edit Route mode ── */}
      {mode === "edit-route" && (
        <>
          <ToolLabel icon={Route} label="Edit Route" />
          {props.editingRouteName && (
            <span className="rounded bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
              {props.editingRouteName}
            </span>
          )}
          <span className="text-[11px] font-mono tabular-nums text-muted-foreground">
            {props.editingRouteNodesCount ?? 0} nodes
          </span>
          <div className={dividerClass} />
          {props.onRouteEditCommit && (
            <button
              onClick={props.onRouteEditCommit}
              className="flex items-center gap-1 rounded bg-primary px-2.5 py-1 text-[11px] font-semibold text-primary-foreground shadow-sm transition active:scale-[0.98] hover:bg-primary/90"
              title="Save route geometry"
            >
              <Check className="h-3 w-3" /> Save Path
            </button>
          )}
          {props.onRouteEditCancel && (
            <button
              onClick={props.onRouteEditCancel}
              className="rounded px-2 py-1 text-[11px] font-medium text-muted-foreground transition active:scale-[0.98] hover:bg-accent hover:text-foreground"
              title="Cancel route editing"
            >
              Cancel
            </button>
          )}
        </>
      )}
    </div>
  );
});
