"use client";

/**
 * MapEditorToolbar — Vertical tool rail (left sidebar).
 *
 * Adobe/Photoshop-inspired: thin vertical strip of icon buttons,
 * grouped by function, with tooltips showing name + keyboard shortcut.
 *
 * Groups:
 * 0. Selection (V, M) — Select, Lasso Select
 * 1. Territory & Settlements — Region (R), City (C), POI (P)
 * 2. Infrastructure — Route (T)
 * 3. Geography Features — Peak (K), River (Y), Lake (J)
 * 4. Measurement — Ruler (U)
 *
 * Active tool gets primary color highlight.
 */

import React, { useCallback, useMemo, useState, useRef, memo } from "react";
import { Popover, PopoverTrigger, PopoverContent } from "~/components/ui/popover";
import { Button } from "~/components/ui/button";
import { FacetContainer } from "~/components/ui/facet-container";
import { Tooltip } from "~/components/ui/tooltip";
import type { EditorMode } from "~/hooks/useMapEditor";
import { getPlugins } from "~/components/maps/editor/plugins/registry";
import type { ToolbarItem } from "~/components/maps/editor/plugins/types";

interface MapEditorToolbarProps {
  mode: EditorMode;
  onModeChange: (mode: EditorMode) => void;
  disabled?: boolean;
  /** Horizontal layout for mobile (bottom rail) */
  horizontal?: boolean;
  disabledTools?: EditorMode[];
}

interface GroupConfig {
  id: string;
  modes: string[];
  defaultMode: string;
}

const GROUPS_CONFIG: GroupConfig[] = [
  {
    id: "select-modes",
    modes: ["view", "lasso-select"],
    defaultMode: "view",
  },
  {
    id: "geography-features",
    modes: ["add-peak", "add-river", "add-lake"],
    defaultMode: "add-peak",
  },
];

export const MapEditorToolbar = memo(function MapEditorToolbar({
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
    ? "flex h-10 items-center gap-0.5 rounded-none px-1"
    : "flex h-full w-10 flex-col items-center gap-0.5 rounded-none py-1";

  // Dynamically resolve tools from registered plugins (memoized once)
  const sortedTools = useMemo(() => {
    const plugins = getPlugins();
    const items = plugins.flatMap((p) => p.toolbarItems || []);
    return [...items].sort((a, b) => {
      if (a.group !== b.group) return a.group - b.group;
      return (a.order ?? 0) - (b.order ?? 0);
    });
  }, []);

  // Grouped tools calculation
  const groupedTools = useMemo(() => {
    const result: Array<
      | {
          type: "group";
          id: string;
          modes: string[];
          defaultMode: string;
          activeTool: ToolbarItem | undefined;
          tools: ToolbarItem[];
          group: number;
        }
      | {
          type: "single";
          tool: ToolbarItem;
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
    }, 300);
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
    <FacetContainer
      depth={1}
      role="toolbar"
      aria-label="Editor tools"
      aria-orientation={horizontal ? "horizontal" : "vertical"}
      className={`${containerClass} ${disabled ? "pointer-events-none opacity-50" : ""}`}
    >
      {groupedTools.map((item) => {
        const toolGroup = item.group;
        const showSep = lastGroup !== -1 && toolGroup !== lastGroup;
        lastGroup = toolGroup;

        if (item.type === "group") {
          const activeTool = item.activeTool;
          if (!activeTool) return null;
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
                <Tooltip
                  content={activeTool.label}
                  shortcut={activeTool.shortcut}
                  side={horizontal ? "top" : "right"}
                  open={isToolDisabled || activePopoverGroupId === item.id ? false : undefined}
                >
                  <PopoverTrigger asChild>
                    <Button
                      variant={isActive ? "default" : "ghost"}
                      size="icon"
                      onClick={() => handleGroupClick(item, activeTool.mode)}
                      onMouseDown={() => handleMouseDown(item.id)}
                      onMouseUp={handleMouseUpOrLeave}
                      onMouseLeave={handleMouseUpOrLeave}
                      onContextMenu={(e) => handleContextMenu(e, item.id)}
                      disabled={isToolDisabled}
                      aria-label={titleText}
                      aria-pressed={isActive}
                      className={`relative select-none ${horizontal ? "h-8 w-8" : "h-9 w-9"} ${
                        isActive ? "" : "text-muted-foreground"
                      } ${isToolDisabled ? "opacity-30" : ""}`}
                    >
                      <FallbackIcon aria-hidden />
                      <span
                        aria-hidden
                        className="pointer-events-none absolute right-0.5 bottom-0.5 h-0 w-0 border-[3px] border-transparent border-r-current border-b-current opacity-60"
                      />
                    </Button>
                  </PopoverTrigger>
                </Tooltip>
                <PopoverContent
                  side={horizontal ? "top" : "right"}
                  align="center"
                  sideOffset={6}
                  className="w-40 rounded-xl p-1"
                >
                  <div className="flex flex-col gap-0.5">
                    {item.tools.map((subTool) => {
                      const SubIcon = subTool.icon;
                      const isSubActive = activeMode === subTool.mode;
                      return (
                        <Button
                          key={subTool.mode}
                          variant={isSubActive ? "default" : "ghost"}
                          size="sm"
                          onClick={() => {
                            onModeChange(subTool.mode);
                            setActivePopoverGroupId(null);
                          }}
                          className={`w-full justify-between px-2 ${
                            isSubActive ? "" : "text-muted-foreground"
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <SubIcon aria-hidden />
                            <span>{subTool.label}</span>
                          </div>
                          <span
                            className={`rounded px-1 py-0.5 font-mono text-xs ${
                              isSubActive
                                ? "bg-primary-foreground/20 text-primary-foreground"
                                : "bg-muted text-muted-foreground"
                            }`}
                          >
                            {subTool.shortcut}
                          </span>
                        </Button>
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
              <Tooltip
                content={tool.label}
                shortcut={tool.shortcut}
                side={horizontal ? "top" : "right"}
                open={isToolDisabled ? false : undefined}
              >
                <Button
                  variant={isActive ? "default" : "ghost"}
                  size="icon"
                  onClick={() => handleSingleClick(tool.mode)}
                  disabled={isToolDisabled}
                  aria-label={titleText}
                  aria-pressed={isActive}
                  className={`${horizontal ? "h-8 w-8" : "h-9 w-9"} ${
                    isActive ? "" : "text-muted-foreground"
                  } ${isToolDisabled ? "opacity-30" : ""}`}
                >
                  <FallbackIcon aria-hidden />
                </Button>
              </Tooltip>
            </div>
          );
        }
      })}
    </FacetContainer>
  );
});
