"use client";

import { NavArrowDown, NavArrowUp } from "iconoir-react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import type { StudioPreset } from "~/lib/worldgen/studio-presets";

interface StudioPresetListProps {
  presets: readonly StudioPreset[];
  selected: string;
  /** Writes are off: a write is under way, or the presets could not be read */
  locked: boolean;
  onSelect: (slug: string) => void;
  onMove: (slug: string, by: -1 | 1) => void;
}

/** The presets in their order, each with its state (published, draft) and the arrows that reorder them. */
export function StudioPresetList({
  presets,
  selected,
  locked,
  onSelect,
  onMove,
}: StudioPresetListProps) {
  return (
    <ul aria-label="Presets" className="space-y-1">
      {presets.map((preset, index) => (
        <li key={preset.slug} className="flex items-center gap-1">
          <button
            type="button"
            aria-current={preset.slug === selected ? "true" : undefined}
            onClick={() => onSelect(preset.slug)}
            className={`rounded-control-sm text-footnote flex min-w-0 flex-1 items-center gap-2 px-2 py-2 text-left ${
              preset.slug === selected ? "bg-tint-fill" : "hover:bg-fill-4"
            }`}
          >
            <span className="min-w-0 flex-1 truncate">{preset.name}</span>
            <Badge variant={preset.published ? "success" : "default"}>
              {preset.published ? "Published" : "Not published"}
            </Badge>
            {preset.hasDraft && <Badge variant="warning">Draft</Badge>}
          </button>
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label={`Move ${preset.name} up`}
            disabled={locked || index === 0}
            onClick={() => onMove(preset.slug, -1)}
          >
            <NavArrowUp aria-hidden />
          </Button>
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label={`Move ${preset.name} down`}
            disabled={locked || index === presets.length - 1}
            onClick={() => onMove(preset.slug, 1)}
          >
            <NavArrowDown aria-hidden />
          </Button>
        </li>
      ))}
    </ul>
  );
}
