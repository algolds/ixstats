"use client";

/**
 * EditorStatusBar — Thin bottom bar showing live context while editing.
 *
 * Displays cursor coordinates, terrain info, current mode/instructions, and zoom level.
 * Inspired by Photoshop/Figma status bars — always visible, compact, informational.
 */

import { Mountain } from "lucide-react";
import type { EditorMode } from "~/hooks/useMapEditor";
import { useTransientMapStore } from "~/components/maps/editor/utils/transientStore";

interface EditorStatusBarProps {
  /** Optional override cursor coordinates [lng, lat] */
  cursorCoords?: [number, number] | null;
  /** Current editor mode */
  mode: EditorMode;
  /** Terrain info at cursor (from getPointInfo, debounced) */
  terrainInfo?: {
    elevation?: string | null;
    climate?: string | null;
  } | null;
  /** Current map zoom level */
  zoom?: number;
  /** Total feature count */
  featureCount?: number;
}

const MODE_LABELS: Partial<Record<EditorMode, { label: string; hint: string }>> = {
  view: { label: "Select", hint: "Click a feature to edit" },
  "add-city": { label: "Add City", hint: "Click map to place" },
  "add-subdivision": { label: "Draw Region", hint: "Click to add vertices, double-click to close" },
  "add-poi": { label: "Add POI", hint: "Click map to place" },
  "edit-city": { label: "Edit City", hint: "Modify properties in the panel" },
  "edit-subdivision": { label: "Edit Region", hint: "Drag vertices to reshape" },
  "edit-poi": { label: "Edit POI", hint: "Modify properties in the panel" },
  "import-provinces": { label: "Import", hint: "Follow the import wizard" },
  "import-cities": { label: "Import Cities", hint: "Follow the import wizard" },
  "add-route": { label: "Route", hint: "Generate or draw transport routes" },
  "edit-route": { label: "Edit Route", hint: "Modify route waypoints" },
  paint: { label: "Paint", hint: "Click regions to view stats, use panel to switch map modes" },
  "add-story-pin": { label: "Add Story Pin", hint: "Click map to place story pin" },
  "edit-story-pin": { label: "Edit Story Pin", hint: "Modify story pin properties in the panel" },
  "add-label": { label: "Add Label", hint: "Click map to place text label" },
  "edit-label": { label: "Edit Label", hint: "Modify text label properties in the panel" },
  "add-peak": { label: "Add Peak", hint: "Click map to place mountain peak" },
  "edit-peak": { label: "Edit Peak", hint: "Modify peak properties in the panel" },
  "add-river": { label: "Draw River", hint: "Click to add river path, double-click to close" },
  "edit-river": { label: "Edit River", hint: "Modify river properties in the panel" },
  "add-lake": { label: "Draw Lake", hint: "Click to draw lake polygon, double-click to close" },
  "edit-lake": { label: "Edit Lake", hint: "Modify lake properties in the panel" },
  "split-subdivision": { label: "Split Region", hint: "Draw line across region to split" },
  "lasso-select": { label: "Lasso Select", hint: "Draw lasso loop to select features" },
  ruler: { label: "Ruler", hint: "Click two points to measure distance" },
  "paint-fill": { label: "Paint Fill", hint: "Click region to apply color" },
  eyedropper: { label: "Eyedropper", hint: "Click region to sample properties" },
  "magic-wand": { label: "Magic Wand", hint: "Click to select similar regions" },
};

function formatCoord(value: number, posLabel: string, negLabel: string): string {
  const abs = Math.abs(value);
  const dir = value >= 0 ? posLabel : negLabel;
  return `${abs.toFixed(3)}°${dir}`;
}

export function EditorStatusBar({
  cursorCoords: propCoords,
  mode,
  terrainInfo,
  zoom,
  featureCount,
}: EditorStatusBarProps) {
  const transientCoords = useTransientMapStore((s) => s.cursorCoords);
  const transientTerrain = useTransientMapStore((s) => s.terrainInfo);
  const activeCoords = propCoords ?? transientCoords;
  const activeTerrain = terrainInfo?.elevation ? terrainInfo : transientTerrain;
  const modeInfo = MODE_LABELS[mode] ?? { label: "Edit", hint: "Select or edit map features" };

  return (
    <div className="border-border bg-card text-muted-foreground flex h-7 items-center border-t px-2 text-[11px]">
      {/* Coordinates */}
      <div className="flex min-w-[140px] items-center gap-1 font-mono">
        {activeCoords ? (
          <>
            <span>{formatCoord(activeCoords[1], "N", "S")}</span>
            <span className="text-border">,</span>
            <span>{formatCoord(activeCoords[0], "E", "W")}</span>
          </>
        ) : (
          <span className="text-muted-foreground/50">— , —</span>
        )}
      </div>

      {/* Separator */}
      <div className="bg-border mx-2 h-3 w-px" />

      {/* Altitude + Climate */}
      <div className="hidden min-w-[120px] items-center gap-1.5 sm:flex">
        <Mountain className="text-muted-foreground/60 h-3 w-3 shrink-0" />
        {activeTerrain?.elevation ? (
          <span className="truncate">{activeTerrain.elevation}</span>
        ) : (
          <span className="text-muted-foreground/50">—</span>
        )}
        {activeTerrain?.climate && (
          <>
            <span className="text-border">·</span>
            <span className="truncate">{activeTerrain.climate}</span>
          </>
        )}
      </div>

      {/* Separator */}
      <div className="bg-border mx-2 hidden h-3 w-px sm:block" />

      {/* Mode + hint (takes remaining space) */}
      <div className="flex flex-1 items-center gap-1.5 overflow-hidden">
        <span className="bg-primary/10 text-primary shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold">
          {modeInfo.label}
        </span>
        <span className="text-muted-foreground/70 hidden truncate sm:inline">{modeInfo.hint}</span>
      </div>

      {/* Feature count */}
      {featureCount !== undefined && (
        <>
          <div className="bg-border mx-2 h-3 w-px" />
          <span className="tabular-nums">{featureCount} features</span>
        </>
      )}

      {/* Zoom */}
      {zoom !== undefined && (
        <>
          <div className="bg-border mx-2 h-3 w-px" />
          <span className="font-mono tabular-nums">z{zoom.toFixed(1)}</span>
        </>
      )}
    </div>
  );
}
