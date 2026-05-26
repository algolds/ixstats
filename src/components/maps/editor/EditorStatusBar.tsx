// @ts-nocheck
"use client";

/**
 * EditorStatusBar — Thin bottom bar showing live context while editing.
 *
 * Displays cursor coordinates, terrain info, current mode/instructions, and zoom level.
 * Inspired by Photoshop/Figma status bars — always visible, compact, informational.
 */

import { Mountain } from "lucide-react";
import type { EditorMode } from "~/hooks/useMapEditor";

interface EditorStatusBarProps {
  /** Live cursor coordinates [lng, lat] from map mousemove */
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

const MODE_LABELS: Record<EditorMode, { label: string; hint: string }> = {
  view: { label: "Select", hint: "Click a feature to edit" },
  "add-city": { label: "Add City", hint: "Click map to place" },
  "add-subdivision": { label: "Draw Region", hint: "Click to add vertices, double-click to close" },
  "add-poi": { label: "Add POI", hint: "Click map to place" },
  "edit-city": { label: "Edit City", hint: "Modify properties in the panel" },
  "edit-subdivision": { label: "Edit Region", hint: "Drag vertices to reshape" },
  "edit-poi": { label: "Edit POI", hint: "Modify properties in the panel" },
  "import-provinces": { label: "Import", hint: "Follow the import wizard" },
  "add-route": { label: "Route", hint: "Generate or draw transport routes" },
  paint: { label: "Paint", hint: "Click regions to view stats, use panel to switch map modes" },
};

function formatCoord(value: number, posLabel: string, negLabel: string): string {
  const abs = Math.abs(value);
  const dir = value >= 0 ? posLabel : negLabel;
  return `${abs.toFixed(3)}°${dir}`;
}

export function EditorStatusBar({
  cursorCoords,
  mode,
  terrainInfo,
  zoom,
  featureCount,
}: EditorStatusBarProps) {
  const modeInfo = MODE_LABELS[mode] ?? MODE_LABELS.view;

  return (
    <div className="border-border bg-card text-muted-foreground flex h-7 items-center border-t px-2 text-[11px]">
      {/* Coordinates */}
      <div className="flex min-w-[140px] items-center gap-1 font-mono">
        {cursorCoords ? (
          <>
            <span>{formatCoord(cursorCoords[1], "N", "S")}</span>
            <span className="text-border">,</span>
            <span>{formatCoord(cursorCoords[0], "E", "W")}</span>
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
        {terrainInfo?.elevation ? (
          <span className="truncate">{terrainInfo.elevation}</span>
        ) : (
          <span className="text-muted-foreground/50">—</span>
        )}
        {terrainInfo?.climate && (
          <>
            <span className="text-border">·</span>
            <span className="truncate">{terrainInfo.climate}</span>
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
