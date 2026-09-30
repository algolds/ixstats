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
import { FacetContainer } from "~/components/ui/facet-container";
import { FacetTabs } from "~/components/ui/facet";

const LASSO_TABS = [
  { id: "freehand", label: "Freehand" },
  { id: "rect", label: "Rect" },
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
      <FacetContainer
        material="regular"
        role="toolbar"
        aria-label="Tool options"
        className="flex h-9 shrink-0 items-center gap-2 rounded-none px-3"
      >
        <ToolLabel icon={Scissors} label="Split Region" />
        <span className="text-muted-foreground hidden truncate text-xs md:inline">
          {props.selectedFeature?.type === "subdivision"
            ? `Click points across "${props.selectedFeature.name}" from edge to edge, then Split (Enter).`
            : "Select a region first, then draw a line across it."}
        </span>
        <span className="text-muted-foreground font-mono text-xs tabular-nums">
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
            <Undo2 className="h-3 w-3" /> Undo Point
          </ToolbarButton>
        )}
        <ToolbarButton tone="danger" onClick={props.onCancelSplit} title="Cancel Split">
          Cancel
        </ToolbarButton>
      </FacetContainer>
    );
  }

  return (
    <FacetContainer
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
          <span className="text-foreground text-xs font-medium">
            {props.selectedCount} selected
          </span>
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
              <GitMerge className="h-3 w-3" /> Merge Regions
            </ToolbarButton>
          )}
          {props.selectedCitiesCount! > 1 && props.onMergeSelectedCities && (
            <ToolbarButton onClick={props.onMergeSelectedCities} title="Merge selected cities">
              <GitMerge className="h-3 w-3" /> Merge Cities
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
                  <Scissors className="h-3 w-3" /> Split City
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
            <span className="text-muted-foreground text-xs">Capital</span>
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
                  <Scissors className="h-3 w-3" /> Split City
                </ToolbarButton>
              )}
              {props.onCopyCoords && (
                <ToolbarButton onClick={props.onCopyCoords} title="Copy coordinates">
                  <MapPin className="h-3 w-3" /> Copy Coords
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
          <ToolLabel icon={Landmark} label="Point of Interest" />
          <Eyebrow>Category</Eyebrow>
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
                <ToolbarButton onClick={props.onDuplicate} title="Duplicate POI">
                  <Copy className="h-3 w-3" /> Duplicate
                </ToolbarButton>
              )}
              {props.onCopyCoords && (
                <ToolbarButton onClick={props.onCopyCoords} title="Copy coordinates">
                  <MapPin className="h-3 w-3" /> Copy Coords
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
          <ToolLabel icon={LassoSelect} label="Lasso Select" />
          <span className="text-muted-foreground text-xs">
            Drag to select features. Freehand draws a loop; Rect draws a box. Shift = add, Alt =
            subtract.
          </span>
          <FacetTabs
            tabs={LASSO_TABS}
            activeTab={props.lassoTool ?? "freehand"}
            onChange={(tool) => props.onLassoToolChange?.(tool as "freehand" | "rect")}
            size="sm"
            tone="neutral"
            showTexture={false}
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
          <ToolLabel icon={Route} label="Draw Route" />
          <Eyebrow>Type</Eyebrow>
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
          <span className="text-muted-foreground font-mono text-xs tabular-nums">
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
          <ToolLabel icon={Route} label="Edit Route" />
          {props.editingRouteName && <Badge variant="secondary">{props.editingRouteName}</Badge>}
          <span className="text-muted-foreground font-mono text-xs tabular-nums">
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
    </FacetContainer>
  );
});
