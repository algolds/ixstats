"use client";

import React, { memo, useState } from "react";
import { Hexagon, Copy, Cut as Scissors, City, ControlSlider as Sliders } from "iconoir-react";
import { Popover, PopoverTrigger } from "~/components/ui/popover";
import { Eyebrow } from "~/components/ui/eyebrow";
import {
  SNAP_LAYER_TYPES,
  getDisabledSnapLayers,
  setSnapLayerEnabled,
  type SnapLayerType,
} from "~/lib/maps/editor-prefs";
import { CityScatterPopover, TransformGeometryPopover } from "./ScatterToolOptions";
import { ToolLabel, ToolbarButton, dividerClass, selectClass } from "./CoordinateSnappingControls";

const SUBDIVISION_TYPES = [
  { value: "province", label: "Province" },
  { value: "state", label: "State" },
  { value: "region", label: "Region" },
  { value: "territory", label: "Territory" },
  { value: "district", label: "District" },
  { value: "county", label: "County" },
  { value: "department", label: "Department" },
];

const SNAP_LAYER_LABELS: Record<SnapLayerType, string> = {
  rivers: "Rivers",
  lakes: "Lakes",
  background: "Coast",
  altitudes: "Elevation",
  climate: "Climate",
};

/** Per-layer terrain snap toggles, persisted in editor prefs and read at snap time. */
function SnapLayerToggles() {
  const [disabled, setDisabled] = useState(getDisabledSnapLayers);

  const toggle = (layer: SnapLayerType) => {
    setSnapLayerEnabled(layer, disabled.has(layer));
    setDisabled(getDisabledSnapLayers());
  };

  return (
    <>
      <div className={dividerClass} />
      <Eyebrow>Snap to</Eyebrow>
      {SNAP_LAYER_TYPES.map((layer) => {
        const on = !disabled.has(layer);
        const label = SNAP_LAYER_LABELS[layer];
        return (
          <ToolbarButton
            tone={on ? "active" : "default"}
            key={layer}

            onClick={() => toggle(layer)}
            aria-pressed={on}
            title={`Snap to ${label.toLowerCase()} (when Snap is on and the layer is visible)`}
          >
            {label}
          </ToolbarButton>
        );
      })}
    </>
  );
}

interface SubdivisionOptionsProps {
  isEditMode?: boolean;
  subdivisionType?: string;
  onSubdivisionTypeChange?: (type: string) => void;
  subdivisionLevel?: number;
  onSubdivisionLevelChange?: (level: number) => void;
  onDuplicate?: () => void;
  onStartSplitSubdivision?: () => void;
  onScatterCities?: (count: number, type: string, prefix: string) => void;
  onApplyGeometryTransformation?: (
    type: "simplify" | "smooth" | "rotate" | "scale",
    value: number
  ) => void;
}

export const SubdivisionOptions = memo(function SubdivisionOptions({
  isEditMode,
  subdivisionType,
  onSubdivisionTypeChange,
  subdivisionLevel,
  onSubdivisionLevelChange,
  onDuplicate,
  onStartSplitSubdivision,
  onScatterCities,
  onApplyGeometryTransformation,
}: SubdivisionOptionsProps) {
  return (
    <>
      <ToolLabel icon={Hexagon} label="Region" />
      <Eyebrow>Type</Eyebrow>
      <select
        value={subdivisionType ?? "province"}
        onChange={(e) => onSubdivisionTypeChange?.(e.target.value)}
        className={selectClass}
      >
        {SUBDIVISION_TYPES.map((t) => (
          <option key={t.value} value={t.value}>
            {t.label}
          </option>
        ))}
      </select>
      <Eyebrow>Level</Eyebrow>
      <input
        type="number"
        min={1}
        max={5}
        value={subdivisionLevel ?? 1}
        onChange={(e) => onSubdivisionLevelChange?.(parseInt(e.target.value) || 1)}
        className={`${selectClass} w-12 text-center`}
      />
      <SnapLayerToggles />

      {isEditMode && (
        <>
          {onScatterCities && (
            <>
              <div className={dividerClass} />
              <Popover>
                <PopoverTrigger asChild>
                  <ToolbarButton title="Scatter cities inside this region">
                    <City className="h-3 w-3" aria-hidden /> Scatter cities…
                  </ToolbarButton>
                </PopoverTrigger>
                <CityScatterPopover onScatter={onScatterCities} />
              </Popover>
            </>
          )}
          {onApplyGeometryTransformation && (
            <Popover>
              <PopoverTrigger asChild>
                <ToolbarButton title="Transform region geometry">
                  <Sliders className="h-3 w-3" /> Transform...
                </ToolbarButton>
              </PopoverTrigger>
              <TransformGeometryPopover onApply={onApplyGeometryTransformation} />
            </Popover>
          )}
          {onStartSplitSubdivision && (
            <ToolbarButton
              onClick={onStartSplitSubdivision}
              title="Split this subdivision by drawing a line"
            >
              <Scissors className="h-3 w-3" /> Split
            </ToolbarButton>
          )}
          {onDuplicate && (
            <>
              <div className={dividerClass} />
              <ToolbarButton onClick={onDuplicate} title="Duplicate region">
                <Copy className="h-3 w-3" /> Duplicate
              </ToolbarButton>
            </>
          )}
        </>
      )}
    </>
  );
});
