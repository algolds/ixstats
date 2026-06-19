// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
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

import React, { memo, useState } from "react";
import {
  Crown,
  Trash2,
  Copy,
  MapPin,
  Hexagon,
  Landmark,
  Type,
  Route,
  BookMarked,
  Check,
  Undo2,
  Navigation,
  ArrowLeftRight,
  Magnet,
  Eye,
  Crosshair,
  Scissors,
  GitMerge,
  Sliders,
  Sparkles,
} from "lucide-react";
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
} from "~/components/kibo-ui/color-picker";

function CityScatterPopover({
  onScatter,
  defaultPrefix = "City",
}: {
  onScatter: (count: number, type: string, prefix: string) => void;
  defaultPrefix?: string;
}) {
  const [count, setCount] = useState(5);
  const [type, setType] = useState("city");
  const [prefix, setPrefix] = useState(defaultPrefix);

  return (
    <PopoverContent className="bg-popover border-border/50 text-foreground w-64 space-y-3 p-3">
      <div className="space-y-1">
        <Label className="text-muted-foreground text-[10px] font-medium tracking-wider uppercase">
          Scatter Count
        </Label>
        <div className="flex items-center gap-2">
          <input
            type="range"
            min={1}
            max={50}
            value={count}
            onChange={(e) => setCount(Number(e.target.value))}
            className="accent-primary h-4 flex-1"
          />
          <span className="w-8 text-right text-[11px] font-semibold">{count}</span>
        </div>
      </div>
      <div className="space-y-1">
        <Label className="text-muted-foreground text-[10px] font-medium tracking-wider uppercase">
          City Type
        </Label>
        <select
          value={type}
          onChange={(e) => setType(e.target.value)}
          className="border-border bg-background text-foreground focus:ring-primary/50 h-6 w-full rounded border px-1.5 text-[11px] outline-none focus:ring-1"
        >
          {CITY_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1">
        <Label className="text-muted-foreground text-[10px] font-medium tracking-wider uppercase">
          Name Prefix
        </Label>
        <input
          type="text"
          value={prefix}
          onChange={(e) => setPrefix(e.target.value)}
          className="border-border bg-background text-foreground focus:ring-primary/50 h-6 w-full rounded border px-1.5 text-[11px] outline-none focus:ring-1"
        />
      </div>
      <button
        onClick={() => onScatter(count, type, prefix)}
        className="bg-primary hover:bg-primary/90 flex h-7 w-full items-center justify-center gap-1 rounded text-[11px] font-medium text-white transition-colors"
      >
        <Sparkles className="h-3 w-3" /> Scatter Cities
      </button>
    </PopoverContent>
  );
}

function TransformGeometryPopover({
  onApply,
}: {
  onApply: (type: "simplify" | "smooth" | "rotate" | "scale", value: number) => void;
}) {
  const [simplifyVal, setSimplifyVal] = useState(0.001);
  const [rotateVal, setRotateVal] = useState(0);
  const [scaleVal, setScaleVal] = useState(1);

  return (
    <PopoverContent className="bg-popover border-border/50 text-foreground w-64 space-y-4 p-3">
      <div className="space-y-1">
        <Label className="text-muted-foreground text-[10px] font-medium tracking-wider uppercase">
          Simplify Tolerance
        </Label>
        <div className="flex items-center gap-2">
          <input
            type="range"
            min={0.0001}
            max={0.01}
            step={0.0001}
            value={simplifyVal}
            onChange={(e) => setSimplifyVal(Number(e.target.value))}
            className="accent-primary h-4 flex-1"
          />
          <button
            onClick={() => onApply("simplify", simplifyVal)}
            className="bg-primary/10 text-primary hover:bg-primary/20 h-6 rounded px-2 text-[10px]"
          >
            Apply
          </button>
        </div>
        <div className="text-muted-foreground text-[9px]">Tolerance: {simplifyVal.toFixed(4)}</div>
      </div>

      <div className="space-y-1">
        <Label className="text-muted-foreground text-[10px] font-medium tracking-wider uppercase">
          Bezier Smoothing
        </Label>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground text-[9px]">Apply Bezier Spline</span>
          <button
            onClick={() => onApply("smooth", 1)}
            className="bg-primary hover:bg-primary/95 h-6 rounded px-2 text-[10px] text-white"
          >
            Smooth Region
          </button>
        </div>
      </div>

      <div className="space-y-1">
        <Label className="text-muted-foreground text-[10px] font-medium tracking-wider uppercase">
          Rotate (Degrees)
        </Label>
        <div className="flex items-center gap-2">
          <input
            type="range"
            min={-180}
            max={180}
            value={rotateVal}
            onChange={(e) => setRotateVal(Number(e.target.value))}
            className="accent-primary h-4 flex-1"
          />
          <button
            onClick={() => onApply("rotate", rotateVal)}
            className="bg-primary/10 text-primary hover:bg-primary/20 h-6 rounded px-2 text-[10px]"
          >
            Apply
          </button>
        </div>
        <div className="text-muted-foreground text-[9px]">Angle: {rotateVal}°</div>
      </div>

      <div className="space-y-1">
        <Label className="text-muted-foreground text-[10px] font-medium tracking-wider uppercase">
          Scale Factor
        </Label>
        <div className="flex items-center gap-2">
          <input
            type="range"
            min={0.5}
            max={2.0}
            step={0.1}
            value={scaleVal}
            onChange={(e) => setScaleVal(Number(e.target.value))}
            className="accent-primary h-4 flex-1"
          />
          <button
            onClick={() => onApply("scale", scaleVal)}
            className="bg-primary/10 text-primary hover:bg-primary/20 h-6 rounded px-2 text-[10px]"
          >
            Apply
          </button>
        </div>
        <div className="text-muted-foreground text-[9px]">Factor: {scaleVal.toFixed(1)}x</div>
      </div>
    </PopoverContent>
  );
}

function CoordinateSnappingControls({
  coords,
  onCoordsChange,
  onSnapBorder,
  onSnapCoast,
  isPickingLocation,
  onTogglePickingLocation,
}: {
  coords?: [number, number];
  onCoordsChange?: (coords: [number, number]) => void;
  onSnapBorder?: () => void;
  onSnapCoast?: () => void;
  isPickingLocation?: boolean;
  onTogglePickingLocation?: () => void;
}) {
  const [lng, setLng] = useState(coords ? coords[0].toString() : "");
  const [lat, setLat] = useState(coords ? coords[1].toString() : "");

  React.useEffect(() => {
    if (coords) {
      setLng(coords[0].toString());
      setLat(coords[1].toString());
    }
  }, [coords]);

  const handleApply = () => {
    const lngN = parseFloat(lng);
    const latN = parseFloat(lat);
    if (!isNaN(lngN) && !isNaN(latN) && onCoordsChange) {
      onCoordsChange([lngN, latN]);
    }
  };

  return (
    <div className="flex items-center gap-1.5">
      <span className={labelClass}>Coord</span>
      <input
        type="text"
        placeholder="Lng"
        value={lng}
        onChange={(e) => setLng(e.target.value)}
        onBlur={handleApply}
        className={`${selectClass} w-16 text-[10px]`}
      />
      <input
        type="text"
        placeholder="Lat"
        value={lat}
        onChange={(e) => setLat(e.target.value)}
        onBlur={handleApply}
        className={`${selectClass} w-16 text-[10px]`}
      />

      {onTogglePickingLocation && (
        <button
          onClick={onTogglePickingLocation}
          className={isPickingLocation ? activeBtnClass : btnClass}
          title="Reposition with crosshair teleport tool"
        >
          <Crosshair className="h-3 w-3" />
          Teleport
        </button>
      )}

      {onSnapBorder && (
        <button
          onClick={onSnapBorder}
          className={btnClass}
          title="Snap to CONTAINING region border"
        >
          Snap to Border
        </button>
      )}

      {onSnapCoast && (
        <button
          onClick={onSnapCoast}
          className={btnClass}
          title="Snap to nearest coastline/lake water boundary"
        >
          Snap to Coast
        </button>
      )}
    </div>
  );
}

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

const selectClass =
  "h-6 rounded border border-border bg-background px-1.5 text-[11px] text-foreground outline-none focus:ring-1 focus:ring-primary/50";
const btnClass =
  "flex h-6 items-center gap-1 rounded px-1.5 text-[11px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground";
const activeBtnClass =
  "flex h-6 items-center gap-1 rounded bg-primary/10 px-1.5 text-[11px] text-primary";
const dangerBtnClass =
  "flex h-6 items-center gap-1 rounded px-1.5 text-[11px] text-red-500 transition-colors hover:bg-red-500/10";
const labelClass = "text-[10px] font-medium uppercase tracking-wider text-muted-foreground";
const dividerClass = "bg-border h-4 w-px";

function ToolLabel({ icon: Icon, label }: { icon: React.ElementType; label: string }) {
  return (
    <div className="border-border mr-2 flex items-center gap-1.5 border-r pr-2">
      <Icon className="text-muted-foreground h-3.5 w-3.5" />
      <span className="text-foreground text-[11px] font-semibold">{label}</span>
    </div>
  );
}

/** Inline lng/lat input pair for "Move to coordinates" affordance */
function MoveToCoordsInput({ onMove }: { onMove: (lng: number, lat: number) => void }) {
  const [lng, setLng] = useState("");
  const [lat, setLat] = useState("");
  const handle = () => {
    const lngN = parseFloat(lng);
    const latN = parseFloat(lat);
    if (!isNaN(lngN) && !isNaN(latN)) onMove(lngN, latN);
  };
  return (
    <div className="flex items-center gap-1">
      <span className={labelClass}>Move to</span>
      <input
        type="number"
        placeholder="Lng"
        value={lng}
        onChange={(e) => setLng(e.target.value)}
        className={`${selectClass} w-16`}
        step="any"
      />
      <input
        type="number"
        placeholder="Lat"
        value={lat}
        onChange={(e) => setLat(e.target.value)}
        className={`${selectClass} w-16`}
        step="any"
      />
      <button onClick={handle} className={btnClass} title="Go">
        <Navigation className="h-3 w-3" />
      </button>
    </div>
  );
}

export const ToolOptionsBar = memo(function ToolOptionsBar(props: ToolOptionsBarProps) {
  const { mode } = props;

  // Don't render for view mode with no selection unless gap highlight is present
  if (mode === "view" && !props.selectedCount && !props.onToggleGaps) return null;
  if (mode === "import-provinces") return null;

  if (mode === "split-subdivision") {
    return (
      <div className="border-border bg-card/80 flex h-8 shrink-0 items-center gap-2 border-b px-3 backdrop-blur-sm">
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
    <div className="border-border bg-card/80 flex h-8 shrink-0 items-center gap-2 border-b px-3 backdrop-blur-sm">
      {/* ── Gap Highlight Toggle ── */}
      {props.onToggleGaps &&
        (mode === "view" || mode === "add-subdivision" || mode === "edit-subdivision") && (
          <>
            <button
              onClick={props.onToggleGaps}
              className={props.showGaps ? activeBtnClass : btnClass}
              title={props.showGaps ? "Hide negative space gaps" : "Show negative space gaps"}
            >
              <Eye className="h-3.5 w-3.5" />
              {props.showGaps ? "Highlight Gaps: ON" : "Highlight Gaps"}
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
        <>
          <ToolLabel icon={Hexagon} label="Region" />
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

          {mode === "edit-subdivision" && (
            <>
              {props.onScatterCities && (
                <>
                  <div className={dividerClass} />
                  <Popover>
                    <PopoverTrigger asChild>
                      <button className={btnClass} title="Scatter cities inside this region">
                        <Sparkles className="h-3 w-3" /> Scatter Cities...
                      </button>
                    </PopoverTrigger>
                    <CityScatterPopover
                      onScatter={(count, type, prefix) => {
                        if (props.selectedFeature?.id) {
                          props.onScatterCities!(props.selectedFeature.id, count, type, prefix);
                        }
                      }}
                      defaultPrefix={`${props.selectedFeature?.name || "City"}`}
                    />
                  </Popover>
                </>
              )}

              {props.onStartSplitSubdivision && (
                <>
                  <div className={dividerClass} />
                  <button
                    onClick={props.onStartSplitSubdivision}
                    className={btnClass}
                    title="Split region with a drawn line"
                  >
                    <Scissors className="h-3 w-3" /> Split Region
                  </button>
                </>
              )}

              {props.onApplyGeometryTransformation && (
                <>
                  <div className={dividerClass} />
                  <Popover>
                    <PopoverTrigger asChild>
                      <button
                        className={btnClass}
                        title="Simplify, Smooth, Rotate, or Scale geometry"
                      >
                        <Sliders className="h-3 w-3" /> Transform Geometry...
                      </button>
                    </PopoverTrigger>
                    <TransformGeometryPopover onApply={props.onApplyGeometryTransformation} />
                  </Popover>
                </>
              )}
            </>
          )}
        </>
      )}

      {/* ── POI mode ── */}
      {(mode === "add-poi" || mode === "edit-poi") && (
        <>
          <ToolLabel icon={Landmark} label="POI" />
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
                style={{ backgroundColor: props.labelColor ?? "#374151" }}
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
        <>
          <ToolLabel icon={Route} label="Route" />
          <span className={labelClass}>Types</span>
          {["rail", "highway", "shipping", "air"].map((t) => {
            const active = props.routeTypes?.includes(t);
            return (
              <button
                key={t}
                onClick={() => {
                  const current = props.routeTypes ?? [];
                  props.onRouteTypesChange?.(
                    active ? current.filter((x) => x !== t) : [...current, t]
                  );
                }}
                className={active ? activeBtnClass : btnClass}
              >
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            );
          })}
          {(props.onFinishRoute ||
            props.onUndoWaypoint ||
            props.onReverseRoute ||
            props.onSnapToggle) && (
            <>
              <div className={dividerClass} />
              {props.onFinishRoute && (
                <button
                  onClick={props.onFinishRoute}
                  className={activeBtnClass}
                  title="Finish route"
                >
                  <Check className="h-3 w-3" /> Finish
                </button>
              )}
              {props.onUndoWaypoint && (
                <button
                  onClick={props.onUndoWaypoint}
                  className={btnClass}
                  title="Undo last waypoint"
                >
                  <Undo2 className="h-3 w-3" /> Undo
                </button>
              )}
              {props.onReverseRoute && (
                <button
                  onClick={props.onReverseRoute}
                  className={btnClass}
                  title="Reverse route direction"
                >
                  <ArrowLeftRight className="h-3 w-3" /> Reverse
                </button>
              )}
              {props.onSnapToggle && (
                <button
                  onClick={props.onSnapToggle}
                  className={props.isSnapEnabled ? activeBtnClass : btnClass}
                  title={
                    props.isSnapEnabled
                      ? "Snap to cities ON — click to disable"
                      : "Snap to cities OFF — click to enable"
                  }
                >
                  <Magnet className="h-3 w-3" />
                  {props.isSnapEnabled ? "Snap On" : "Snap Off"}
                </button>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
});
