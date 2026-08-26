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

import { useCallback, useMemo, useState, useRef } from "react";
import { Popover, PopoverTrigger, PopoverContent } from "~/components/ui/popover";
import { CursorPointer as MousePointer2, MapPin, Hexagon, Bank as Landmark, Navigator as Route, Bookmark as BookMarked, Type, HandBrake as Hand, SelectWindow as LassoSelect, Ruler, ColorPicker as PaintBucket, ColorPicker as Pipette, MagicWand as Wand2 } from "iconoir-react";
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
  { mode: "add-poi", icon: Landmark, label: "POI / Landmark", shortcut: "P", group: 2 },
  { mode: "add-story-pin", icon: BookMarked, label: "Story", shortcut: "S", group: 2 },
  { mode: "add-label", icon: Type, label: "Label", shortcut: "L", group: 3 },
  { mode: "eyedropper", icon: Pipette, label: "Eyedropper", shortcut: "I", group: 3 },
  { mode: "ruler", icon: Ruler, label: "Ruler (Measure)", shortcut: "U", group: 4 },
  { mode: "paint-fill", icon: PaintBucket, label: "Paint Fill", shortcut: "G", group: 4 },
];

interface GroupConfig {
  id: string;
  modes: string[];
  defaultMode: string;
}

const GROUPS_CONFIG: GroupConfig[] = [
  {
    id: "select-pan",
    modes: ["view", "pan"],
    defaultMode: "view",
  },
  {
    id: "lasso-wand",
    modes: ["lasso-select", "magic-wand"],
    defaultMode: "lasso-select",
  },
  {
    id: "geography-features",
    modes: ["add-peak", "add-river", "add-lake"],
    defaultMode: "add-peak",
  },
];

export function MapEditorToolbar({
  mode,
  onModeChange,
  disabled,
  horizontal,
  disabledTools = [],
}: MapEditorToolbarProps) {
  const [activePopoverGroupId, setActivePopoverGroupId] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  // Grouped tools calculation
  const groupedTools = useMemo(() => {
    const result: Array<
      | {
          type: "group";
          id: string;
          modes: string[];
          defaultMode: string;
          activeTool: any;
          tools: any[];
          group: number;
        }
      | {
          type: "single";
          tool: any;
          group: number;
        }
    > = [];

    const processedModes = new Set<string>();

    for (const tool of sortedTools) {
      if (processedModes.has(tool.mode)) continue;

      const groupConf = GROUPS_CONFIG.find((g) => g.modes.includes(tool.mode));
      if (groupConf) {
        const groupTools = sortedTools.filter((t) => groupConf.modes.includes(t.mode));
        groupConf.modes.forEach((m) => processedModes.add(m));

        const activeInGroup =
          groupTools.find((t) => t.mode === activeMode) ||
          groupTools.find((t) => t.mode === groupConf.defaultMode) ||
          groupTools[0];

        result.push({
          type: "group",
          id: groupConf.id,
          modes: [...groupConf.modes],
          defaultMode: groupConf.defaultMode,
          activeTool: activeInGroup,
          tools: groupTools,
          group: tool.group,
        });
      } else {
        processedModes.add(tool.mode);
        result.push({
          type: "single",
          tool,
          group: tool.group,
        });
      }
    }

    return result;
  }, [sortedTools, activeMode]);

  const handleMouseDown = useCallback((groupId: string) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setActivePopoverGroupId(groupId);
    }, 450);
  }, []);

  const handleMouseUpOrLeave = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const handleContextMenu = useCallback((e: React.MouseEvent, groupId: string) => {
    e.preventDefault();
    setActivePopoverGroupId(groupId);
  }, []);

  const handleGroupClick = useCallback(
    (group: { modes: string[]; defaultMode: string }, activeToolMode: EditorMode) => {
      if (group.modes.includes(mode)) {
        const idx = group.modes.indexOf(mode);
        const nextMode = group.modes[(idx + 1) % group.modes.length] as EditorMode;
        onModeChange(nextMode);
      } else {
        onModeChange(activeToolMode);
      }
    },
    [mode, onModeChange]
  );

  const handleSingleClick = useCallback(
    (toolMode: EditorMode) => {
      onModeChange(toolMode === mode ? "view" : toolMode);
    },
    [mode, onModeChange]
  );

  let lastGroup = -1;

  return (
    <div className={`${containerClass} ${disabled ? "pointer-events-none opacity-50" : ""}`}>
      {groupedTools.map((item) => {
        const toolGroup = item.group;
        const showSep = lastGroup !== -1 && toolGroup !== lastGroup;
        lastGroup = toolGroup;

        if (item.type === "group") {
          const activeTool = item.activeTool;
          const FallbackIcon = activeTool.icon;
          const isActive = item.modes.includes(activeMode);
          const isToolDisabled = disabled || disabledTools.includes(activeTool.mode);

          const titleText = disabledTools.includes(activeTool.mode)
            ? `${activeTool.label} (Select a country first - Hold/Right-Click for group)`
            : `${activeTool.label} (${activeTool.shortcut} - Hold/Right-Click for group)`;

          return (
            <div key={item.id} className={horizontal ? "flex items-center" : ""}>
              {showSep &&
                (horizontal ? (
                  <div className="bg-border mx-0.5 h-5 w-px" />
                ) : (
                  <div className="bg-border my-0.5 h-px w-5" />
                ))}
              <Popover
                open={activePopoverGroupId === item.id}
                onOpenChange={(open) => {
                  if (!open) setActivePopoverGroupId(null);
                }}
              >
                <PopoverTrigger asChild>
                  <button
                    onClick={() => handleGroupClick(item, activeTool.mode)}
                    onMouseDown={() => handleMouseDown(item.id)}
                    onMouseUp={handleMouseUpOrLeave}
                    onMouseLeave={handleMouseUpOrLeave}
                    onContextMenu={(e) => handleContextMenu(e, item.id)}
                    disabled={isToolDisabled}
                    className={`group relative flex items-center justify-center rounded-md transition-all active:scale-95 duration-100 ease-out select-none ${
                      horizontal ? "h-8 w-8" : "h-9 w-9"
                    } ${
                      isActive
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-muted-foreground hover:bg-accent hover:text-foreground"
                    } ${isToolDisabled ? "pointer-events-none opacity-30" : ""}`}
                    title={titleText}
                  >
                    <FallbackIcon className="h-4 w-4" />

                    <div
                      className={`pointer-events-none absolute right-0.5 bottom-0.5 h-0 w-0 border-[3px] border-transparent border-r-current border-b-current opacity-60`}
                    />

                    {!isToolDisabled && activePopoverGroupId !== item.id && (
                      <div
                        className={`bg-popover/90 backdrop-blur-md text-popover-foreground ring-border/50 pointer-events-none absolute z-50 hidden rounded px-2 py-1 text-[11px] font-medium whitespace-nowrap shadow-md ring-1 group-hover:block ${
                          horizontal
                            ? "bottom-full left-1/2 mb-1.5 -translate-x-1/2"
                            : "top-1/2 left-full ml-1.5 -translate-y-1/2"
                        }`}
                      >
                        {activeTool.label}
                        <span className="bg-muted text-muted-foreground ml-1.5 rounded px-1 py-0.5 text-[10px]">
                          {activeTool.shortcut}
                        </span>
                      </div>
                    )}
                  </button>
                </PopoverTrigger>
                <PopoverContent
                  side={horizontal ? "top" : "right"}
                  align="center"
                  sideOffset={6}
                  style={{ transformOrigin: "var(--radix-popover-content-transform-origin)" }}
                  className="bg-popover/90 border-border/60 text-foreground ring-border/50 z-[100] w-36 rounded-lg border p-1 shadow-xl backdrop-blur-xl ring-1"
                >
                  <div className="flex flex-col gap-0.5">
                    {item.tools.map((subTool) => {
                      const SubIcon = subTool.icon;
                      const isSubActive = activeMode === subTool.mode;
                      return (
                        <button
                          key={subTool.mode}
                          onClick={() => {
                            onModeChange(subTool.mode);
                            setActivePopoverGroupId(null);
                          }}
                          className={`flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-xs transition-all active:scale-95 duration-100 ${
                            isSubActive
                              ? "bg-primary text-primary-foreground font-semibold shadow-sm"
                              : "text-muted-foreground hover:bg-accent hover:text-foreground"
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <SubIcon className="h-3.5 w-3.5" />
                            <span>{subTool.label}</span>
                          </div>
                          <span
                            className={`rounded px-1 py-0.5 font-mono text-[9px] ${
                              isSubActive
                                ? "bg-primary-foreground/20 text-primary-foreground"
                                : "bg-muted text-muted-foreground"
                            }`}
                          >
                            {subTool.shortcut}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          );
        } else {
          const tool = item.tool;
          const FallbackIcon = tool.icon;
          const isActive = activeMode === tool.mode;
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
                onClick={() => handleSingleClick(tool.mode)}
                disabled={isToolDisabled}
                className={`group relative flex items-center justify-center rounded-md transition-all active:scale-95 duration-100 ease-out ${
                  horizontal ? "h-8 w-8" : "h-9 w-9"
                } ${
                  isActive
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                } ${isToolDisabled ? "pointer-events-none opacity-30" : ""}`}
                title={titleText}
              >
                <FallbackIcon className="h-4 w-4" />

                {!isToolDisabled && (
                  <div
                    className={`bg-popover/90 backdrop-blur-md text-popover-foreground ring-border/50 pointer-events-none absolute z-50 hidden rounded px-2 py-1 text-[11px] font-medium whitespace-nowrap shadow-md ring-1 group-hover:block ${
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
        }
      })}
    </div>
  );
}
