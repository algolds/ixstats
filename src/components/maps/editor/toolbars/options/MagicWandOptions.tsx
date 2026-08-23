"use client";

import React, { memo } from "react";
import { MagicWand as Wand2 } from "iconoir-react";
import {
  ToolLabel,
  dividerClass,
  labelClass,
} from "./CoordinateSnappingControls";

interface MagicWandOptionsProps {
  wandMatchColor?: boolean;
  onWandMatchColorChange?: (val: boolean) => void;
  wandMatchLevel?: boolean;
  onWandMatchLevelChange?: (val: boolean) => void;
  wandMatchParent?: boolean;
  onWandMatchParentChange?: (val: boolean) => void;
}

export const MagicWandOptions = memo(function MagicWandOptions({
  wandMatchColor = true,
  onWandMatchColorChange,
  wandMatchLevel = false,
  onWandMatchLevelChange,
  wandMatchParent = false,
  onWandMatchParentChange,
}: MagicWandOptionsProps) {
  return (
    <>
      <ToolLabel icon={Wand2} label="Magic Wand" />
      <span className={labelClass}>Select similar subdivisions by:</span>
      <label className="flex cursor-pointer items-center gap-1">
        <input
          type="checkbox"
          checked={wandMatchColor}
          onChange={(e) => onWandMatchColorChange?.(e.target.checked)}
          className="border-border h-3 w-3 rounded"
        />
        <span className="text-foreground text-[11px]">Same Color</span>
      </label>
      <label className="flex cursor-pointer items-center gap-1">
        <input
          type="checkbox"
          checked={wandMatchLevel}
          onChange={(e) => onWandMatchLevelChange?.(e.target.checked)}
          className="border-border h-3 w-3 rounded"
        />
        <span className="text-foreground text-[11px]">Same Level</span>
      </label>
      <label className="flex cursor-pointer items-center gap-1">
        <input
          type="checkbox"
          checked={wandMatchParent}
          onChange={(e) => onWandMatchParentChange?.(e.target.checked)}
          className="border-border h-3 w-3 rounded"
        />
        <span className="text-foreground text-[11px]">Same Parent</span>
      </label>
      <div className={dividerClass} />
      <span className="text-muted-foreground text-[11px]">
        Click any region on the map to multi-select all matching regions.
      </span>
    </>
  );
});
