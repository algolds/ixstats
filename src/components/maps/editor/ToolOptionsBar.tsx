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
  Trash2,
  Copy,
  MapPin,
  Hexagon,
  Landmark,
  Type,
  Route,
  BookMarked,
  Paintbrush,
} from "lucide-react";
import type { EditorMode } from "~/hooks/useMapEditor";

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
  // Paint
  paintMode?: string;
  onPaintModeChange?: (mode: string) => void;
  // Selection
  selectedCount?: number;
  onDuplicate?: () => void;
  onDelete?: () => void;
  // Story
  storyCategory?: string;
  onStoryCategoryChange?: (cat: string) => void;
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

const PAINT_MODES = [
  { value: "population", label: "Population" },
  { value: "development", label: "Development" },
  { value: "resources", label: "Resources" },
  { value: "wiki", label: "Wiki Coverage" },
];

const selectClass =
  "h-6 rounded border border-border bg-background px-1.5 text-[11px] text-foreground outline-none focus:ring-1 focus:ring-primary/50";
const btnClass =
  "flex h-6 items-center gap-1 rounded px-1.5 text-[11px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground";
const activeBtnClass =
  "flex h-6 items-center gap-1 rounded bg-primary/10 px-1.5 text-[11px] text-primary";
const labelClass = "text-[10px] font-medium uppercase tracking-wider text-muted-foreground";

function ToolLabel({ icon: Icon, label }: { icon: React.ElementType; label: string }) {
  return (
    <div className="border-border mr-2 flex items-center gap-1.5 border-r pr-2">
      <Icon className="text-muted-foreground h-3.5 w-3.5" />
      <span className="text-foreground text-[11px] font-semibold">{label}</span>
    </div>
  );
}

export const ToolOptionsBar = memo(function ToolOptionsBar(props: ToolOptionsBarProps) {
  const { mode } = props;

  // Don't render for view mode with no selection
  if (mode === "view" && !props.selectedCount) return null;
  if (mode === "import-provinces") return null;

  return (
    <div className="border-border bg-card/80 flex h-8 shrink-0 items-center gap-2 border-b px-3 backdrop-blur-sm">
      {/* ── Select mode ── */}
      {mode === "view" && props.selectedCount! > 0 && (
        <>
          <span className="text-foreground text-[11px] font-medium">
            {props.selectedCount} selected
          </span>
          <div className="bg-border h-4 w-px" />
          {props.onDuplicate && (
            <button onClick={props.onDuplicate} className={btnClass} title="Duplicate">
              <Copy className="h-3 w-3" /> Duplicate
            </button>
          )}
          {props.onDelete && (
            <button
              onClick={props.onDelete}
              className="flex h-6 items-center gap-1 rounded px-1.5 text-[11px] text-red-500 transition-colors hover:bg-red-500/10"
              title="Delete"
            >
              <Trash2 className="h-3 w-3" /> Delete
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
          <input
            type="color"
            value={props.labelColor ?? "#374151"}
            onChange={(e) => props.onLabelColorChange?.(e.target.value)}
            className="border-border h-5 w-5 cursor-pointer rounded border"
          />
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
        </>
      )}

      {/* ── Paint mode ── */}
      {mode === "paint" && (
        <>
          <ToolLabel icon={Paintbrush} label="Paint" />
          {PAINT_MODES.map((m) => (
            <button
              key={m.value}
              onClick={() => props.onPaintModeChange?.(m.value)}
              className={props.paintMode === m.value ? activeBtnClass : btnClass}
            >
              {m.label}
            </button>
          ))}
        </>
      )}
    </div>
  );
});
