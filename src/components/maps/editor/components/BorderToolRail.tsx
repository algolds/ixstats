"use client";
import React from "react";
import {
  CursorPointer as MousePointer2,
  EditPencil as Pencil,
  Cut as Scissors,
  GitMerge as Merge,
  SeaWaves as Waves,
  ColorPicker as Paintbrush,
} from "iconoir-react";
import { Button } from "~/components/ui/button";
import { FacetMaterial } from "~/components/ui/facet";
import { Tooltip } from "~/components/ui/tooltip";
import type { BorderEditMode } from "~/hooks/useBorderEditor";

const BORDER_TOOLS = [
  { id: "select", label: "Select mode", icon: MousePointer2, shortcut: "V" },
  { id: "vertex_edit", label: "Edit vertices", icon: Pencil, shortcut: "P" },
  { id: "split", label: "Split borders", icon: Scissors, shortcut: "X" },
  { id: "merge", label: "Merge borders", icon: Merge, shortcut: "M" },
  { id: "trace", label: "Trace rivers", icon: Waves, shortcut: "T" },
  { id: "brush", label: "Brush territory", icon: Paintbrush, shortcut: "B" },
] as const satisfies ReadonlyArray<{
  id: BorderEditMode;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  shortcut: string;
}>;

/** Vertical tool rail shown while editing country borders. */
export function BorderToolRail({
  mode,
  onModeChange,
}: {
  mode: BorderEditMode;
  onModeChange: (mode: BorderEditMode) => void;
}) {
  return (
    <FacetMaterial
      layer="chrome"
      role="toolbar"
      aria-label="Border tools"
      aria-orientation="vertical"
      className="flex h-full w-10 flex-col items-center gap-0.5 rounded-none py-1"
    >
      {BORDER_TOOLS.map(({ id, label, icon: Icon, shortcut }, i) => {
        const isActive = mode === id;
        return (
          <React.Fragment key={id}>
            {i === 4 && <div className="bg-separator my-0.5 h-px w-5" />}
            <Tooltip content={label} shortcut={shortcut} side="right">
              <Button
                variant={isActive ? "default" : "ghost"}
                size="icon"
                onClick={() => onModeChange(id)}
                aria-label={`${label} (${shortcut})`}
                aria-pressed={isActive}
                className={isActive ? "" : "text-label-secondary"}
              >
                <Icon aria-hidden />
              </Button>
            </Tooltip>
          </React.Fragment>
        );
      })}
    </FacetMaterial>
  );
}
