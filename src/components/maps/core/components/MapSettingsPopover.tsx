"use client";

import { useState, useEffect } from "react";
import {
  Settings,
  SunLight as Sun,
  HalfMoon as Moon,
  ModernTv as Monitor,
  User,
  Dashboard as LayoutDashboard,
  Magnet,
} from "iconoir-react";
import { Popover, PopoverTrigger, PopoverContent } from "~/components/ui/popover";
import { Button } from "~/components/ui/button";
import { Eyebrow } from "~/components/ui/eyebrow";
import { SegmentedControl } from "~/components/ui/segmented-control";
import { Slider } from "~/components/ui/slider";
import { Switch } from "~/components/ui/switch";
import type { ProjectionMode } from "~/lib/maps/map-config";
import type { Theme } from "~/context/theme-context";
import { useRouter } from "next/navigation";
import { useIsAdmin } from "~/hooks/usePermissions";
import {
  getSnapEnabled,
  setSnapEnabled,
  getSnapTolerance,
  setSnapTolerance,
} from "~/lib/maps/editor-prefs";

const THEME_OPTIONS = [
  { value: "light", label: "Light", icon: <Sun aria-hidden /> },
  { value: "dark", label: "Dark", icon: <Moon aria-hidden /> },
  { value: "system", label: "System", icon: <Monitor aria-hidden /> },
];

const PROJECTION_OPTIONS = [
  { value: "globe", label: "Globe" },
  { value: "mercator", label: "Mercator" },
  { value: "dynamic", label: "Auto" },
];

interface MapSettingsPopoverProps {
  projectionMode: ProjectionMode;
  onProjectionChange: (mode: ProjectionMode) => void;
  theme: Theme;
  setTheme: (t: Theme) => void;
}

export function MapSettingsPopover({
  projectionMode,
  onProjectionChange,
  theme,
  setTheme,
}: MapSettingsPopoverProps) {
  const router = useRouter();
  const isAdmin = useIsAdmin();
  const [snapEnabled, setSnapEnabledState] = useState(getSnapEnabled);
  const [snapTol, setSnapTolState] = useState(getSnapTolerance);

  useEffect(() => {
    // oxlint-disable-next-line
    setSnapEnabledState(getSnapEnabled());
    setSnapTolState(getSnapTolerance());
  }, []);

  return (
    <Popover>
      {/* An island icon button like its siblings in MapDynamicIsland: the focus ring sits just
          inside the control (the acrylic pill clips at its edge), 44pt hit slop on touch. */}
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="text-label-secondary hover:text-label shrink-0 rounded-full focus-visible:-outline-offset-2"
          title="Settings"
          aria-label="Map settings"
        >
          <Settings aria-hidden className="size-3.5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        side="bottom"
        align="end"
        className="rounded-card mt-2 w-60 p-3"
        sideOffset={8}
      >
        <div className="space-y-2">
          <Eyebrow id="map-settings-theme" className="block">
            Theme
          </Eyebrow>
          <SegmentedControl
            aria-labelledby="map-settings-theme"
            options={THEME_OPTIONS}
            value={theme}
            onValueChange={(t) => setTheme(t as Theme)}
            size="sm"
            fullWidth
          />
        </div>

        <div className="mt-3 space-y-2">
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

        <div className="border-separator mt-3 border-t pt-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/settings")}
            className="text-label-secondary w-full justify-start"
          >
            <User aria-hidden />
            User settings
          </Button>
          {isAdmin && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push("/admin")}
              className="text-label-secondary w-full justify-start"
            >
              <LayoutDashboard aria-hidden />
              Admin dashboard
            </Button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
