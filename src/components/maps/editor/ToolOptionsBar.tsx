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
import { Crown, Trash as Trash2, Copy, MapPin, Bank as Landmark, Type, Bookmark as BookMarked, Check, Undo as Undo2, ArrowSeparate as ArrowLeftRight, Eye, Cut as Scissors, GitMerge, ControlSlider as Sliders, Sparks as Sparkles, HandBrake as Hand, SelectWindow as LassoSelect, ColorPicker as PaintBucket, ColorPicker as Pipette } from "iconoir-react";
import type { EditorMode } from "~/hooks/useMapEditor";
import { Popover, PopoverTrigger, PopoverContent } from "~/components/ui/popover";
import { Label } from "~/components/ui/label";
import {
  ColorPicker,
  ColorPickerSelection,
  ColorPickerHue,
  ColorPickerAlpha,
  ColorPickerEyeDropper,
  ColorPickerOutput,
  ColorPickerFormat,
} from "~/components/ui/color-picker";

import {
  TransformGeometryPopover,
  CityTransformationsPopover,
} from "./toolbars/options/ScatterToolOptions";
import { SubdivisionOptions } from "./toolbars/options/SubdivisionOptions";
import { RouteOptions } from "./toolbars/options/RouteOptions";
import { MagicWandOptions } from "./toolbars/options/MagicWandOptions";
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
  // Label
  labelFontSize?: number;
  onLabelFontSizeChange?: (size: number) => void;
  labelColor?: string;
  onLabelColorChange?: (color: string) => void;
  labelBold?: boolean;
  onLabelBoldChange?: (bold: boolean) => void;
  // Route
  routeTypes?: string[];
  onRouteTypesChange?: (types: string[]) => void;
  onFinishRoute?: () => void;
  onUndoWaypoint?: () => void;
  onReverseRoute?: () => void;
  isSnapEnabled?: boolean;
  onSnapToggle?: () => void;
  // Selection
  selectedCount?: number;
  onDuplicate?: () => void;
  onDelete?: () => void;
  // Point feature actions (city/POI — used in edit mode)
  onCopyCoords?: () => void;
  onMoveToCoords?: (lng: number, lat: number) => void;
  // Story
  storyCategory?: string;
  onStoryCategoryChange?: (cat: string) => void;
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
  onCancelSplit?: () => void;
  selectedFeature?: any;
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
  subdivisionColor?: string;
  onSubdivisionColorChange?: (color: string) => void;

  // Magic Wand options
  wandMatchColor?: boolean;
  onWandMatchColorChange?: (val: boolean) => void;
  wandMatchLevel?: boolean;
  onWandMatchLevelChange?: (val: boolean) => void;
  wandMatchParent?: boolean;
  onWandMatchParentChange?: (val: boolean) => void;
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

const STORY_CATEGORIES = [
  { value: "battle", label: "Battle" },
  { value: "founding", label: "Founding" },
  { value: "treaty", label: "Treaty" },
  { value: "cultural", label: "Cultural" },
  { value: "religious", label: "Religious" },
  { value: "natural", label: "Natural" },
  { value: "trade", label: "Trade" },
  { value: "exploration", label: "Exploration" },
  { value: "disaster", label: "Disaster" },
];

const SUGGESTED_LABEL_COLORS = [
  { name: "Dark Slate", hex: "#0f172a" },
  { name: "Ocean Blue", hex: "#1a5276" },
  { name: "Purple", hex: "#7c3aed" },
  { name: "Brown", hex: "#78350f" },
  { name: "Green", hex: "#047857" },
  { name: "Red", hex: "#b91c1c" },
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
                  onClick={() => props.onSplitCity!(props.selectedFeature.id)}
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
                  onClick={() => props.onSplitCity!(props.selectedFeature.id)}
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

      {/* ── Story mode ── */}
      {(mode === "add-story-pin" || mode === "edit-story-pin") && (
        <>
          <ToolLabel icon={BookMarked} label="Story" />
          <span className={labelClass}>Category</span>
          <select
            value={props.storyCategory ?? "cultural"}
            onChange={(e) => props.onStoryCategoryChange?.(e.target.value)}
            className={selectClass}
          >
            {STORY_CATEGORIES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </>
      )}

      {/* ── Label mode ── */}
      {(mode === "add-label" || mode === "edit-label") && (
        <>
          <ToolLabel icon={Type} label="Label" />
          <span className={labelClass}>Size</span>
          <input
            type="range"
            min={8}
            max={48}
            value={props.labelFontSize ?? 14}
            onChange={(e) => props.onLabelFontSizeChange?.(parseInt(e.target.value))}
            className="accent-primary h-4 w-20"
          />
          <span className="text-muted-foreground w-6 text-[11px] tabular-nums">
            {props.labelFontSize ?? 14}
          </span>
          <Popover>
            <PopoverTrigger
              className="border-border/40 relative h-5 w-5 shrink-0 cursor-pointer overflow-hidden rounded border"
              title="Pick Color"
            >
              <div className="absolute inset-0 -z-10 bg-[url('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAMUlEQVQ4T2NkYGAQYcAP3uCTZhw1gGGYhAGBZIA/nYDCgBDAm9BGDWAAJyRCgLaBCAAgXwixzAS0pgAAAABJRU5ErkJggg==')] bg-center" />
              <div
                className="h-full w-full"
                style={{ backgroundColor: props.labelColor ?? "var(--color-text-primary)" }}
              />
            </PopoverTrigger>
            <PopoverContent className="bg-popover border-border/50 text-foreground w-64 p-3">
              <ColorPicker
                value={props.labelColor ?? "#374151"}
                onChange={(rgbaArray) => {
                  let colorStr = "#000000";
                  if (rgbaArray[3] < 1) {
                    colorStr = `rgba(${rgbaArray[0]}, ${rgbaArray[1]}, ${rgbaArray[2]}, ${rgbaArray[3]})`;
                  } else {
                    const r = rgbaArray[0].toString(16).padStart(2, "0");
                    const g = rgbaArray[1].toString(16).padStart(2, "0");
                    const b = rgbaArray[2].toString(16).padStart(2, "0");
                    colorStr = `#${r}${g}${b}`;
                  }
                  props.onLabelColorChange?.(colorStr);
                }}
              >
                <ColorPickerSelection className="mb-2 h-32" />
                <div className="mb-2 space-y-1">
                  <Label className="text-muted-foreground text-[10px]">Hue</Label>
                  <ColorPickerHue />
                </div>
                <div className="mb-2 space-y-1">
                  <Label className="text-muted-foreground text-[10px]">Alpha</Label>
                  <ColorPickerAlpha />
                </div>
                <div className="flex items-center gap-1.5 pt-1">
                  <ColorPickerOutput />
                  <ColorPickerFormat />
                  <ColorPickerEyeDropper />
                </div>
              </ColorPicker>
              <div className="border-border/40 mt-3 space-y-1 border-t pt-2">
                <Label className="text-muted-foreground text-[10px]">Suggested Colors</Label>
                <div className="flex flex-wrap items-center gap-1.5">
                  {SUGGESTED_LABEL_COLORS.map((col) => (
                    <button
                      key={col.hex}
                      onClick={() => props.onLabelColorChange?.(col.hex)}
                      className="border-border/40 h-5 w-5 cursor-pointer rounded border transition-all hover:scale-110 active:scale-95"
                      style={{ backgroundColor: col.hex }}
                      title={col.name}
                    />
                  ))}
                </div>
              </div>
            </PopoverContent>
          </Popover>
          <button
            onClick={() => props.onLabelBoldChange?.(!props.labelBold)}
            className={props.labelBold ? activeBtnClass : btnClass}
            title="Bold"
          >
            <span className="font-bold">B</span>
          </button>
        </>
      )}

      {/* ── Route mode ── */}
      {mode === "add-route" && (
        <RouteOptions
          routeTypes={props.routeTypes}
          onRouteTypesChange={props.onRouteTypesChange}
          onFinishRoute={props.onFinishRoute}
          onUndoWaypoint={props.onUndoWaypoint}
          onReverseRoute={props.onReverseRoute}
          isSnapEnabled={props.isSnapEnabled}
          onSnapToggle={props.onSnapToggle}
        />
      )}

      {/* ── Hand / Pan mode ── */}
      {mode === "pan" && (
        <>
          <ToolLabel icon={Hand} label="Pan Map" />
          <span className="text-muted-foreground text-[11px]">
            Safe Pan Mode. Click and drag the map freely without selecting or moving features.
          </span>
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

      {/* ── Eyedropper mode ── */}
      {mode === "eyedropper" && (
        <>
          <ToolLabel icon={Pipette} label="Eyedropper" />
          <span className="text-muted-foreground text-[11px]">
            Click any feature on the map to sample its style and metadata properties.
          </span>
        </>
      )}

      {/* ── Magic Wand mode ── */}
      {mode === "magic-wand" && (
        <MagicWandOptions
          wandMatchColor={props.wandMatchColor}
          onWandMatchColorChange={props.onWandMatchColorChange}
          wandMatchLevel={props.wandMatchLevel}
          onWandMatchLevelChange={props.onWandMatchLevelChange}
          wandMatchParent={props.wandMatchParent}
          onWandMatchParentChange={props.onWandMatchParentChange}
        />
      )}

      {/* ── Ruler mode ── */}
      {mode === "ruler" && (
        <RulerOptions
          rulerPoints={props.rulerPoints}
          rulerDistance={props.rulerDistance}
          onClearRuler={props.onClearRuler}
        />
      )}

      {/* ── Paint Fill mode ── */}
      {mode === "paint-fill" && (
        <>
          <ToolLabel icon={PaintBucket} label="Paint Fill" />
          <span className="text-muted-foreground mr-2 text-[11px]">
            Click any subdivision region to apply properties:
          </span>
          <span className={labelClass}>Type</span>
          <select
            value={props.subdivisionType ?? "province"}
            onChange={(e) => props.onSubdivisionTypeChange?.(e.target.value)}
            className={selectClass}
          >
            {SUBDIVISION_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
          <span className={labelClass}>Level</span>
          <input
            type="number"
            min={1}
            max={5}
            value={props.subdivisionLevel ?? 1}
            onChange={(e) => props.onSubdivisionLevelChange?.(parseInt(e.target.value) || 1)}
            className={`${selectClass} w-12 text-center`}
          />
          {props.subdivisionColor !== undefined && props.onSubdivisionColorChange && (
            <>
              <span className={labelClass}>Color</span>
              <Popover>
                <PopoverTrigger
                  className="border-border/40 relative h-5 w-10 shrink-0 cursor-pointer overflow-hidden rounded border"
                  title="Pick Fill Color"
                  asChild
                >
                  <button className="flex items-center justify-center p-0">
                    <div
                      className="h-full w-full rounded"
                      style={{ backgroundColor: props.subdivisionColor || "var(--color-info)" }}
                    />
                  </button>
                </PopoverTrigger>
                <PopoverContent className="bg-popover border-border/50 text-foreground w-64 p-3">
                  <ColorPicker
                    value={props.subdivisionColor || "var(--color-info)"}
                    onChange={(rgbaArray) => {
                      let colorStr = "#000000";
                      if (rgbaArray[3] < 1) {
                        colorStr = `rgba(${rgbaArray[0]}, ${rgbaArray[1]}, ${rgbaArray[2]}, ${rgbaArray[3]})`;
                      } else {
                        const r = rgbaArray[0].toString(16).padStart(2, "0");
                        const g = rgbaArray[1].toString(16).padStart(2, "0");
                        const b = rgbaArray[2].toString(16).padStart(2, "0");
                        colorStr = `#${r}${g}${b}`;
                      }
                      props.onSubdivisionColorChange?.(colorStr);
                    }}
                  >
                    <ColorPickerSelection className="mb-2 h-32" />
                    <div className="mb-2 space-y-1">
                      <Label className="text-muted-foreground text-[10px]">Hue</Label>
                      <ColorPickerHue />
                    </div>
                    <div className="mb-2 space-y-1">
                      <Label className="text-muted-foreground text-[10px]">Alpha</Label>
                      <ColorPickerAlpha />
                    </div>
                    <div className="flex items-center gap-1.5 pt-1">
                      <ColorPickerOutput />
                      <ColorPickerFormat />
                      <ColorPickerEyeDropper />
                    </div>
                  </ColorPicker>
                  <div className="border-border/40 mt-3 space-y-1 border-t pt-2">
                    <Label className="text-muted-foreground text-[10px]">Suggested Colors</Label>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {SUGGESTED_LABEL_COLORS.map((col) => (
                        <button
                          key={col.hex}
                          onClick={() => props.onSubdivisionColorChange?.(col.hex)}
                          className="border-border/40 h-5 w-5 cursor-pointer rounded border transition-all hover:scale-110 active:scale-95"
                          style={{ backgroundColor: col.hex }}
                          title={col.name}
                        />
                      ))}
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            </>
          )}
        </>
      )}
    </div>
  );
});
