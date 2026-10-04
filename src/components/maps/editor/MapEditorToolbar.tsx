"use client";

import React, { useMemo, useState, useRef, memo } from "react";
import { Popover, PopoverTrigger, PopoverContent } from "~/components/ui/popover";
import { Button } from "~/components/ui/button";
import { FacetMaterial } from "~/components/ui/facet";
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

/** Tools sharing a rail slot: click cycles within the group, hold or right-click opens the list. */
const GROUPS_CONFIG: GroupConfig[] = [
  { id: "select-modes", modes: ["view", "lasso-select"], defaultMode: "view" },
  {
    id: "geography-features",
    modes: ["add-peak", "add-river", "add-lake"],
    defaultMode: "add-peak",
  },
];

type RailItem =
  | {
      type: "group";
      id: string;
      modes: string[];
      defaultMode: string;
      activeTool: ToolbarItem | undefined;
      tools: ToolbarItem[];
      group: number;
    }
  | { type: "single"; tool: ToolbarItem; group: number };

function buildRailItems(sortedTools: ToolbarItem[], activeMode: string): RailItem[] {
  const result: RailItem[] = [];
  const processedModes = new Set<string>();

  for (const tool of sortedTools) {
    if (processedModes.has(tool.mode)) continue;

    const groupConf = GROUPS_CONFIG.find((g) => g.modes.includes(tool.mode));
    if (!groupConf) {
      processedModes.add(tool.mode);
      result.push({ type: "single", tool, group: tool.group });
      continue;
    }

    const groupTools = sortedTools.filter((t) => groupConf.modes.includes(t.mode));
    groupConf.modes.forEach((m) => processedModes.add(m));
    result.push({
      type: "group",
      id: groupConf.id,
      modes: [...groupConf.modes],
      defaultMode: groupConf.defaultMode,
      activeTool:
        groupTools.find((t) => t.mode === activeMode) ||
        groupTools.find((t) => t.mode === groupConf.defaultMode) ||
        groupTools[0],
      tools: groupTools,
      group: tool.group,
    });
  }
  return result;
}

function ToolSeparator({ horizontal }: { horizontal?: boolean }) {
  return horizontal ? (
    <div className="bg-separator mx-0.5 h-5 w-px" />
  ) : (
    <div className="bg-separator my-0.5 h-px w-5" />
  );
}

function toolButtonClass(horizontal: boolean | undefined, isActive: boolean, isDisabled: boolean) {
  return `${horizontal ? "h-8 w-8" : "h-9 w-9"} ${isActive ? "" : "text-label-secondary"} ${
    isDisabled ? "opacity-30" : ""
  }`;
}

interface RailButtonProps {
  horizontal?: boolean;
  activeMode: string;
  mode: EditorMode;
  disabled?: boolean;
  disabledTools: EditorMode[];
  onModeChange: (mode: EditorMode) => void;
}

function SingleToolButton({
  tool,
  horizontal,
  activeMode,
  mode,
  disabled,
  disabledTools,
  onModeChange,
}: RailButtonProps & { tool: ToolbarItem }) {
  const Icon = tool.icon;
  const isActive = activeMode === tool.mode;
  const isToolDisabled = disabled || disabledTools.includes(tool.mode);
  const titleText = disabledTools.includes(tool.mode)
    ? `${tool.label} (Select a country first)`
    : `${tool.label} (${tool.shortcut})`;

  return (
    <Tooltip
      content={tool.label}
      shortcut={tool.shortcut}
      side={horizontal ? "top" : "right"}
      open={isToolDisabled ? false : undefined}
    >
      <Button
        variant={isActive ? "default" : "ghost"}
        size="icon"
        onClick={() => onModeChange(tool.mode === mode ? "view" : tool.mode)}
        disabled={isToolDisabled}
        aria-label={titleText}
        aria-pressed={isActive}
        className={toolButtonClass(horizontal, isActive, !!isToolDisabled)}
      >
        <Icon aria-hidden />
      </Button>
    </Tooltip>
  );
}

function GroupToolButton({
  item,
  activeTool,
  horizontal,
  activeMode,
  mode,
  disabled,
  disabledTools,
  onModeChange,
}: RailButtonProps & {
  item: Extract<RailItem, { type: "group" }>;
  activeTool: ToolbarItem;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearHold = () => {
    if (holdTimer.current) clearTimeout(holdTimer.current);
    holdTimer.current = null;
  };

  const Icon = activeTool.icon;
  const isActive = item.modes.includes(activeMode);
  const isToolDisabled = disabled || disabledTools.includes(activeTool.mode);
  const suffix = "Hold/Right-Click for group";
  const titleText = disabledTools.includes(activeTool.mode)
    ? `${activeTool.label} (Select a country first - ${suffix})`
    : `${activeTool.label} (${activeTool.shortcut} - ${suffix})`;

  const handleClick = () => {
    if (!item.modes.includes(mode)) return onModeChange(activeTool.mode);
    const next = item.modes[(item.modes.indexOf(mode) + 1) % item.modes.length];
    onModeChange(next as EditorMode);
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <Tooltip
        content={activeTool.label}
        shortcut={activeTool.shortcut}
        side={horizontal ? "top" : "right"}
        open={isToolDisabled || isOpen ? false : undefined}
      >
        <PopoverTrigger asChild>
          <Button
            variant={isActive ? "default" : "ghost"}
            size="icon"
            onClick={handleClick}
            onMouseDown={() => {
              clearHold();
              holdTimer.current = setTimeout(() => setIsOpen(true), 300);
            }}
            onMouseUp={clearHold}
            onMouseLeave={clearHold}
            onContextMenu={(e) => {
              e.preventDefault();
              setIsOpen(true);
            }}
            disabled={isToolDisabled}
            aria-label={titleText}
            aria-pressed={isActive}
            className={`relative select-none ${toolButtonClass(horizontal, isActive, !!isToolDisabled)}`}
          >
            <Icon aria-hidden />
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
        className="rounded-row w-40 p-1"
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
                  setIsOpen(false);
                }}
                className={`w-full justify-between px-2 ${isSubActive ? "" : "text-label-secondary"}`}
              >
                <div className="flex items-center gap-2">
                  <SubIcon aria-hidden />
                  <span>{subTool.label}</span>
                </div>
                <span
                  className={`text-footnote rounded-control-sm px-1 py-0.5 tabular-nums ${
                    isSubActive ? "bg-on-tint/20 text-on-tint" : "bg-fill-3 text-label-secondary"
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
  );
}

export const MapEditorToolbar = memo(function MapEditorToolbar({
  mode,
  onModeChange,
  disabled,
  horizontal,
  disabledTools = [],
}: MapEditorToolbarProps) {
  // Edit modes are panel-based, so they highlight the Select tool
  const activeMode = mode.startsWith("edit-") ? "view" : mode;

  const containerClass = horizontal
    ? "flex h-10 items-center gap-0.5 rounded-none px-1"
    : "flex h-full w-10 flex-col items-center gap-0.5 rounded-none py-1";

  const railItems = useMemo(() => {
    const items = getPlugins().flatMap((p) => p.toolbarItems || []);
    const sorted = items.sort((a, b) => a.group - b.group || (a.order ?? 0) - (b.order ?? 0));
    return buildRailItems(sorted, activeMode);
  }, [activeMode]);

  const buttonProps: RailButtonProps = {
    horizontal,
    activeMode,
    mode,
    disabled,
    disabledTools,
    onModeChange,
  };

  return (
    <FacetMaterial
      layer="chrome"
      role="toolbar"
      aria-label="Editor tools"
      aria-orientation={horizontal ? "horizontal" : "vertical"}
      className={`${containerClass} ${disabled ? "pointer-events-none opacity-50" : ""}`}
    >
      {railItems.map((item, i) => {
        const key = item.type === "group" ? item.id : item.tool.mode;
        if (item.type === "group" && !item.activeTool) return null;
        const showSeparator = i > 0 && item.group !== railItems[i - 1]!.group;

        return (
          <div key={key} className={horizontal ? "flex items-center" : ""}>
            {showSeparator && <ToolSeparator horizontal={horizontal} />}
            {item.type === "group" ? (
              <GroupToolButton item={item} activeTool={item.activeTool!} {...buttonProps} />
            ) : (
              <SingleToolButton tool={item.tool} {...buttonProps} />
            )}
          </div>
        );
      })}
    </FacetMaterial>
  );
});
