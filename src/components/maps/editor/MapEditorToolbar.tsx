"use client";

/**
 * MapEditorToolbar — Vertical tool rail (left sidebar).
 *
 * Adobe/Photoshop-inspired: thin vertical strip of icon buttons,
 * grouped by function, with tooltips showing name + keyboard shortcut.
 *
 * Groups:
 * 1. Selection (V) — default pointer mode
 * 2. Add Features — City (C), Region (R), POI (P)
 * 3. Import — Province import (I)
 *
 * Active tool gets primary color highlight.
 */

import { useCallback } from "react";
import { MousePointer2, MapPin, Hexagon, Landmark, FileUp, Route, Paintbrush } from "lucide-react";
import type { EditorMode } from "~/hooks/useMapEditor";

interface MapEditorToolbarProps {
  mode: EditorMode;
  onModeChange: (mode: EditorMode) => void;
  disabled?: boolean;
  /** Horizontal layout for mobile (bottom rail) */
  horizontal?: boolean;
}

interface ToolDef {
  mode: EditorMode;
  icon: typeof MapPin;
  label: string;
  shortcut: string;
  group: number;
}

const TOOLS: ToolDef[] = [
  { mode: "view", icon: MousePointer2, label: "Select", shortcut: "V", group: 0 },
  { mode: "add-city", icon: MapPin, label: "City", shortcut: "C", group: 1 },
  { mode: "add-subdivision", icon: Hexagon, label: "Region", shortcut: "R", group: 1 },
  { mode: "add-poi", icon: Landmark, label: "POI", shortcut: "P", group: 1 },
  { mode: "add-route", icon: Route, label: "Route", shortcut: "T", group: 1 },
  { mode: "import-provinces", icon: FileUp, label: "Import", shortcut: "I", group: 2 },
  { mode: "paint", icon: Paintbrush, label: "Paint", shortcut: "B", group: 3 },
];

export function MapEditorToolbar({ mode, onModeChange, disabled, horizontal }: MapEditorToolbarProps) {
  const handleClick = useCallback(
    (toolMode: EditorMode) => {
      // If clicking the active tool, deactivate to view mode
      onModeChange(toolMode === mode ? "view" : toolMode);
    },
    [mode, onModeChange]
  );

  // Normalize mode for highlighting (edit-city → view, since edit is panel-based)
  const activeMode = mode.startsWith("edit-") ? "view" : mode;

  const containerClass = horizontal
    ? "flex h-10 items-center gap-0.5 border-t border-border bg-card px-1"
    : "flex w-10 flex-col items-center gap-0.5 border-r border-border bg-card py-1";

  let lastGroup = -1;

  return (
    <div className={`${containerClass} ${disabled ? "pointer-events-none opacity-50" : ""}`}>
      {TOOLS.map((tool) => {
        const Icon = tool.icon;
        const isActive = activeMode === tool.mode;
        const showSep = lastGroup !== -1 && tool.group !== lastGroup;
        lastGroup = tool.group;

        return (
          <div key={tool.mode} className={horizontal ? "flex items-center" : ""}>
            {showSep && (
              horizontal
                ? <div className="mx-0.5 h-5 w-px bg-border" />
                : <div className="my-0.5 h-px w-5 bg-border" />
            )}
            <button
              onClick={() => handleClick(tool.mode)}
              className={`group relative flex items-center justify-center rounded-md transition-colors ${
                horizontal ? "h-8 w-8" : "h-9 w-9"
              } ${
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              }`}
              title={`${tool.label} (${tool.shortcut})`}
            >
              <Icon className="h-4 w-4" />

              {/* Tooltip (desktop only, shows on hover to the right / above) */}
              <div
                className={`pointer-events-none absolute z-50 hidden whitespace-nowrap rounded bg-popover px-2 py-1 text-[11px] font-medium text-popover-foreground shadow-md ring-1 ring-border group-hover:block ${
                  horizontal
                    ? "bottom-full left-1/2 mb-1.5 -translate-x-1/2"
                    : "left-full top-1/2 ml-1.5 -translate-y-1/2"
                }`}
              >
                {tool.label}
                <span className="ml-1.5 rounded bg-muted px-1 py-0.5 text-[10px] text-muted-foreground">
                  {tool.shortcut}
                </span>
              </div>
            </button>
          </div>
        );
      })}
    </div>
  );
}
