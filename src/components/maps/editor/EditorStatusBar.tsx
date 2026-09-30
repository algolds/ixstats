"use client";

/**
 * EditorStatusBar — Thin bottom bar showing live context while editing.
 *
 * Displays cursor coordinates, terrain info, current mode/instructions, and zoom level.
 * Inspired by Photoshop/Figma status bars — always visible, compact, informational.
 */

import { useEffect, useState } from "react";
import {
  ModernTv as Mountain,
  CheckCircle,
  WarningTriangle,
  SystemRestart as Spinner,
  Xmark,
  KeyCommand,
} from "iconoir-react";
import type { EditorMode } from "~/hooks/useMapEditor";
import { Badge } from "~/components/ui/badge";
import { useTransientMapStore } from "~/components/maps/editor/utils/transientStore";
import { timeAgo } from "~/lib/format/compact";

interface EditorStatusBarProps {
  /** Optional override cursor coordinates [lng, lat] */
  cursorCoords?: [number, number] | null;
  /** Current editor mode */
  mode: EditorMode;
  /** Optional override terrain info (defaults to the transient store's cursor probe) */
  terrainInfo?: {
    elevation?: string | null;
    climate?: string | null;
  } | null;
  /** Optional override zoom (defaults to the transient store) */
  zoom?: number;
  /** Total feature count */
  featureCount?: number;
  /** Number of multi-selected features */
  selectedCount?: number;
  /** A write is in flight */
  isSaving?: boolean;
  /** When the last write finished */
  lastSavedAt?: Date | null;
  /** Leaving now would lose work (drawing in progress, unsaved reshape, …) */
  hasUnsavedChanges?: boolean;
  /** Last mutation error, shown until dismissed */
  error?: string | null;
  onDismissError?: () => void;
  onShowShortcuts?: () => void;
}

/** Re-renders every 30 s so "Saved 2m ago" stays current. */
function useMinuteTick(active: boolean) {
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => clearInterval(id);
  }, [active]);
}

const MODE_LABELS: Partial<Record<EditorMode, { label: string; hint: string }>> = {
  view: { label: "Select", hint: "Click a feature to edit" },
  "add-city": { label: "Add City", hint: "Click map to place" },
  "add-subdivision": { label: "Draw Region", hint: "Click to add vertices, double-click to close" },
  "add-poi": { label: "Add POI", hint: "Click map to place" },
  "edit-city": { label: "Edit City", hint: "Modify properties in the panel" },
  "edit-subdivision": {
    label: "Edit Region",
    hint: "Drag vertices · click a midpoint to add · right-click removes · Save to keep",
  },
  "edit-poi": { label: "Edit POI", hint: "Modify properties in the panel" },
  "import-provinces": { label: "Import", hint: "Follow the import wizard" },
  "import-cities": { label: "Import Cities", hint: "Follow the import wizard" },
  "add-route": { label: "Route", hint: "Click to add waypoints · Enter to finish" },
  "edit-route": { label: "Edit Route", hint: "Modify route waypoints" },
  paint: { label: "Paint", hint: "Click regions to view stats" },
  "add-peak": { label: "Add Peak", hint: "Click map to place mountain peak" },
  "edit-peak": { label: "Edit Peak", hint: "Modify peak properties in the panel" },
  "add-river": {
    label: "Draw River",
    hint: "Click along the river's course, then save from the panel",
  },
  "edit-river": { label: "Edit River", hint: "Modify river properties in the panel" },
  "add-lake": { label: "Draw Lake", hint: "Click to draw lake polygon, double-click to close" },
  "edit-lake": { label: "Edit Lake", hint: "Modify lake properties in the panel" },
  "split-subdivision": {
    label: "Split Region",
    hint: "Click across the region edge to edge · Enter to split",
  },
  "lasso-select": { label: "Lasso Select", hint: "Draw lasso loop to select features" },
  ruler: { label: "Ruler", hint: "Click points to measure distance and elevation" },
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
  zoom: propZoom,
  featureCount,
  selectedCount = 0,
  isSaving = false,
  lastSavedAt,
  hasUnsavedChanges = false,
  error,
  onDismissError,
  onShowShortcuts,
}: EditorStatusBarProps) {
  const transientCoords = useTransientMapStore((s) => s.cursorCoords);
  const transientTerrain = useTransientMapStore((s) => s.terrainInfo);
  const transientZoom = useTransientMapStore((s) => s.zoom);
  const activeCoords = propCoords ?? transientCoords;
  const activeTerrain = terrainInfo?.elevation ? terrainInfo : transientTerrain;
  const zoom = propZoom ?? transientZoom ?? undefined;
  const modeInfo = MODE_LABELS[mode] ?? { label: "Edit", hint: "Select or edit map features" };
  useMinuteTick(!!lastSavedAt && !isSaving);

  return (
    <div
      className="border-border bg-card text-muted-foreground flex h-7 shrink-0 items-center border-t px-2 text-xs"
      role="status"
      aria-live="polite"
    >
      {/* Coordinates */}
      <div className="flex min-w-[140px] items-center gap-1 font-mono">
        {activeCoords ? (
          <>
            <span>{formatCoord(activeCoords[1], "N", "S")}</span>
            <span className="text-border">,</span>
            <span>{formatCoord(activeCoords[0], "E", "W")}</span>
          </>
        ) : (
          <span className="text-muted-foreground">— , —</span>
        )}
      </div>

      {/* Separator */}
      <div className="bg-border mx-2 h-3 w-px" />

      {/* Altitude + Climate */}
      <div className="hidden min-w-[120px] items-center gap-1.5 md:flex">
        <Mountain className="text-muted-foreground h-3 w-3 shrink-0" />
        {activeTerrain?.elevation ? (
          <span className="truncate">{activeTerrain.elevation}</span>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
        {activeTerrain?.climate && (
          <>
            <span className="text-border">·</span>
            <span className="truncate">{activeTerrain.climate}</span>
          </>
        )}
      </div>

      {/* Separator */}
      <div className="bg-border mx-2 hidden h-3 w-px md:block" />

      {/* Mode + hint (takes remaining space) */}
      <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-hidden">
        <Badge variant="secondary" className="shrink-0">
          {modeInfo.label}
        </Badge>
        {selectedCount > 0 && (
          <Badge variant="outline" className="shrink-0 border-blue-500/30 text-blue-500">
            {selectedCount} selected
          </Badge>
        )}
        <span className="text-muted-foreground hidden truncate sm:inline">{modeInfo.hint}</span>
      </div>

      {/* Save state */}
      {error ? (
        <span
          className="text-destructive ml-2 flex max-w-[40%] shrink items-center gap-1 truncate"
          title={error}
        >
          <WarningTriangle className="h-3 w-3 shrink-0" />
          <span className="truncate">{error}</span>
          {onDismissError && (
            <button
              type="button"
              onClick={onDismissError}
              className="hover:bg-destructive/10 rounded p-0.5"
              aria-label="Dismiss error"
            >
              <Xmark className="h-3 w-3" />
            </button>
          )}
        </span>
      ) : isSaving ? (
        <span className="ml-2 flex shrink-0 items-center gap-1 text-amber-500">
          <Spinner className="h-3 w-3 animate-spin" />
          Saving…
        </span>
      ) : hasUnsavedChanges ? (
        <span
          className="ml-2 flex shrink-0 items-center gap-1 text-amber-500"
          title="Finish or cancel the current drawing/edit before leaving"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
          Unsaved
        </span>
      ) : lastSavedAt ? (
        <span
          className="ml-2 hidden shrink-0 items-center gap-1 text-emerald-500 sm:flex"
          title={lastSavedAt.toLocaleString()}
        >
          <CheckCircle className="h-3 w-3" />
          Saved {timeAgo(lastSavedAt)}
        </span>
      ) : null}

      {/* Feature count */}
      {featureCount !== undefined && (
        <>
          <div className="bg-border mx-2 hidden h-3 w-px sm:block" />
          <span className="hidden tabular-nums sm:inline">{featureCount} features</span>
        </>
      )}

      {/* Zoom */}
      {zoom !== undefined && (
        <>
          <div className="bg-border mx-2 h-3 w-px" />
          <span className="font-mono tabular-nums">z{zoom.toFixed(1)}</span>
        </>
      )}

      {onShowShortcuts && (
        <>
          <div className="bg-border mx-2 hidden h-3 w-px sm:block" />
          <button
            type="button"
            onClick={onShowShortcuts}
            className="hover:bg-accent hover:text-foreground hidden items-center gap-1 rounded px-1 py-0.5 transition-colors sm:flex"
            title="Keyboard shortcuts (?)"
          >
            <KeyCommand className="h-3 w-3" />
            <span>?</span>
          </button>
        </>
      )}
    </div>
  );
}
