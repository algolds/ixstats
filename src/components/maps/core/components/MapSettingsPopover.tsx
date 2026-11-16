"use client";

import { useState } from "react";
import { Settings, Magnet } from "iconoir-react";
import { Popover, PopoverTrigger, PopoverContent } from "~/components/ui/popover";
import { Button } from "~/components/ui/button";
import { Eyebrow } from "~/components/ui/eyebrow";
import { SegmentedControl } from "~/components/ui/segmented-control";
import { Slider } from "~/components/ui/slider";
import { Switch } from "~/components/ui/switch";
import type { ProjectionMode } from "~/lib/maps/map-config";
import {
  getSnapEnabled,
  setSnapEnabled,
  getSnapTolerance,
  setSnapTolerance,
} from "~/lib/maps/editor-prefs";

const PROJECTION_OPTIONS = [
  { value: "globe", label: "Globe" },
  { value: "mercator", label: "Flat" },
  { value: "dynamic", label: "Auto" },
];

interface MapSettingsPopoverProps {
  projectionMode: ProjectionMode;
  onProjectionChange: (mode: ProjectionMode) => void;
}

/** The map's own settings (projection, editor snapping); theme and account live in Halo. */

export function MapSettingsPopover({
  projectionMode,
  onProjectionChange,
}: MapSettingsPopoverProps) {
  const [snapEnabled, setSnapEnabledState] = useState(getSnapEnabled);
  const [snapTol, setSnapTolState] = useState(getSnapTolerance);

  return (
    <Popover>
      {/* A map toolbar button like its siblings in MapControls */}
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="rounded-control text-label-secondary h-11 w-11 sm:h-9 sm:w-9"
          title="Map settings"
          aria-label="Map settings"
        >
          <Settings aria-hidden className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        side="bottom"
        align="start"
        className="rounded-card mt-2 w-60 p-3"
        sideOffset={8}
      >
        <div className="space-y-2">
          <Eyebrow id="map-settings-projection" className="block">
            Projection
          </Eyebrow>
          <SegmentedControl
            aria-labelledby="map-settings-projection"
            options={PROJECTION_OPTIONS}
            value={projectionMode}
            onValueChange={(mode) => onProjectionChange(mode as ProjectionMode)}
            size="sm"
            fullWidth
          />
        </div>

        <div className="mt-3 space-y-2">
          <div className="flex items-center justify-between">
            <Eyebrow className="flex items-center gap-2">
              <Magnet className="h-3 w-3" aria-hidden />
              Snap
            </Eyebrow>
            <Switch
              checked={snapEnabled}
              aria-label="Snap to features"
              onCheckedChange={(next) => {
                setSnapEnabled(next);
                setSnapEnabledState(next);
              }}
            />
          </div>
          {snapEnabled && (
            <div className="flex items-center gap-2">
              <Slider
                aria-label="Snap tolerance"
                min={0.001}
                max={0.1}
                step={0.001}
                value={[snapTol]}
                onValueChange={([v]) => {
                  if (v === undefined) return;
                  setSnapTolerance(v);
                  setSnapTolState(v);
                }}
                className="flex-1 py-2"
              />
              <span className="text-label-secondary text-footnote w-10 text-right tabular-nums">
                {snapTol.toFixed(3)}°
              </span>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
