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

import { useCallback, useMemo } from "react";
import {
  MousePointer2,
  MapPin,
  Hexagon,
  Landmark,
  // eslint-disable-next-line unused-imports/no-unused-imports
  FileUp,
  Route,
  BookMarked,
  Type,
  Hand,
  LassoSelect,
  Ruler,
  PaintBucket,
  Pipette,
  Wand2,
} from "lucide-react";
import { MousePointerIcon, MapPinIcon, LandmarkIcon } from "~/components/ui/icons";
import type { EditorMode } from "~/hooks/useMapEditor";
import { getPlugins } from "~/components/maps/editor/plugins/registry";

interface MapEditorToolbarProps {
  mode: EditorMode;
  onModeChange: (mode: EditorMode) => void;
  disabled?: boolean;
  /** Horizontal layout for mobile (bottom rail) */
  horizontal?: boolean;
  disabledTools?: EditorMode[];
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
  { mode: "pan", icon: Hand, label: "Hand (Pan)", shortcut: "H", group: 0 },
  { mode: "lasso-select", icon: LassoSelect, label: "Lasso Select", shortcut: "M", group: 0 },
  { mode: "magic-wand", icon: Wand2, label: "Magic Wand", shortcut: "W", group: 0 },
  { mode: "add-subdivision", icon: Hexagon, label: "Region", shortcut: "R", group: 1 },
  { mode: "add-route", icon: Route, label: "Route", shortcut: "T", group: 1 },
  { mode: "add-city", icon: MapPin, label: "City", shortcut: "C", group: 2 },
  { mode: "add-poi", icon: Landmark, label: "POI", shortcut: "P", group: 2 },
  { mode: "add-story-pin", icon: BookMarked, label: "Story", shortcut: "S", group: 2 },
  { mode: "add-label", icon: Type, label: "Label", shortcut: "L", group: 3 },
  { mode: "eyedropper", icon: Pipette, label: "Eyedropper", shortcut: "I", group: 3 },
  { mode: "ruler", icon: Ruler, label: "Ruler (Measure)", shortcut: "U", group: 4 },
  { mode: "paint-fill", icon: PaintBucket, label: "Paint Fill", shortcut: "G", group: 4 },
];

/** Animated icon overrides for toolbar tools (only where a good visual match exists) */
const ANIMATED_TOOL_ICONS: Partial<
  Record<EditorMode, React.ComponentType<{ size?: number; className?: string }>>
> = {
  view: MousePointerIcon,
  "add-city": MapPinIcon,
  "add-poi": LandmarkIcon,
};

export function MapEditorToolbar({
  mode,
  onModeChange,
  disabled,
  horizontal,
  disabledTools = [],
}: MapEditorToolbarProps) {
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

  // Dynamically resolve tools from registered plugins
  const plugins = getPlugins();
  const sortedTools = useMemo(() => {
    const items = plugins.flatMap((p) => p.toolbarItems || []);
    return [...items].sort((a, b) => a.group - b.group);
  }, [plugins]);

  let lastGroup = -1;

  return (
    <div className={`${containerClass} ${disabled ? "pointer-events-none opacity-50" : ""}`}>
      {sortedTools.map((tool) => {
        const AnimatedIcon = ANIMATED_TOOL_ICONS[tool.mode];
        const FallbackIcon = tool.icon;
        const isActive = activeMode === tool.mode;
        const showSep = lastGroup !== -1 && tool.group !== lastGroup;
        lastGroup = tool.group;

        const isToolDisabled = disabled || disabledTools.includes(tool.mode);
        const titleText = disabledTools.includes(tool.mode)
          ? `${tool.label} (Select a country first)`
          : `${tool.label} (${tool.shortcut})`;

        return (
          <div key={tool.mode} className={horizontal ? "flex items-center" : ""}>
            {showSep &&
              (horizontal ? (
                <div className="bg-border mx-0.5 h-5 w-px" />
              ) : (
                <div className="bg-border my-0.5 h-px w-5" />
              ))}
            <button
              onClick={() => handleClick(tool.mode)}
              disabled={isToolDisabled}
              className={`group relative flex items-center justify-center rounded-md transition-colors ${
                horizontal ? "h-8 w-8" : "h-9 w-9"
              } ${
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              } ${isToolDisabled ? "pointer-events-none opacity-30" : ""}`}
              title={titleText}
            >
              {AnimatedIcon ? <AnimatedIcon size={16} /> : <FallbackIcon className="h-4 w-4" />}

              {/* Tooltip (desktop only, shows on hover to the right / above) */}
              {!isToolDisabled && (
                <div
                  className={`bg-popover text-popover-foreground ring-border pointer-events-none absolute z-50 hidden rounded px-2 py-1 text-[11px] font-medium whitespace-nowrap shadow-md ring-1 group-hover:block ${
                    horizontal
                      ? "bottom-full left-1/2 mb-1.5 -translate-x-1/2"
                      : "top-1/2 left-full ml-1.5 -translate-y-1/2"
                  }`}
                >
                  {tool.label}
                  <span className="bg-muted text-muted-foreground ml-1.5 rounded px-1 py-0.5 text-[10px]">
                    {tool.shortcut}
                  </span>
                </div>
              )}
            </button>
          </div>
        );
      })}
    </div>
  );
}
