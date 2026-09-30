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
import { FacetTabs } from "~/components/ui/facet";
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

const THEME_TABS = [
  { id: "light", label: "Light", icon: Sun },
  { id: "dark", label: "Dark", icon: Moon },
  { id: "system", label: "System", icon: Monitor },
];

const PROJECTION_TABS = [
  { id: "globe", label: "Globe" },
  { id: "mercator", label: "Mercator" },
  { id: "dynamic", label: "Auto" },
];

interface MapSettingsPopoverProps {
  projectionMode: ProjectionMode;
  onProjectionChange: (mode: ProjectionMode) => void;
  theme: Theme;
  effectiveTheme: string;
  setTheme: (t: Theme) => void;
  router: ReturnType<typeof useRouter>;
}

export function MapSettingsPopover({
  projectionMode,
  onProjectionChange,
  theme,
  // oxlint-disable-next-line eslint/no-unused-vars
  effectiveTheme,
  setTheme,
  router,
}: MapSettingsPopoverProps) {
  const isAdmin = useIsAdmin();
  const [snapEnabled, setSnapEnabledState] = useState(getSnapEnabled);
  const [snapTol, setSnapTolState] = useState(getSnapTolerance);

  // Keep state in sync across renders (other instances may write prefs)
  useEffect(() => {
    // oxlint-disable-next-line
    setSnapEnabledState(getSnapEnabled());
    setSnapTolState(getSnapTolerance());
  }, []);

  return (
    <Popover>
      <PopoverTrigger
        className="text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:ring-ring shrink-0 cursor-pointer rounded-full p-1 transition-colors focus-visible:ring-2 focus-visible:outline-none"
        title="Settings"
        aria-label="Map settings"
      >
        <Settings className="h-3.5 w-3.5" />
      </PopoverTrigger>
      <PopoverContent
        side="bottom"
        align="end"
        className="mt-2 w-60 rounded-2xl p-3"
        sideOffset={8}
      >
        {/* Theme */}
        <div className="space-y-2">
          <Eyebrow className="block">Theme</Eyebrow>
          <FacetTabs
            tabs={THEME_TABS}
            activeTab={theme}
            onChange={(t) => setTheme(t as Theme)}
            size="sm"
            tone="neutral"
            showTexture={false}
            className="w-full"
          />
        </div>

        {/* Projection */}
        <div className="mt-3 space-y-2">
          <Eyebrow className="block">Projection</Eyebrow>
          <FacetTabs
            tabs={PROJECTION_TABS}
            activeTab={projectionMode}
            onChange={(mode) => onProjectionChange(mode as ProjectionMode)}
            size="sm"
            tone="neutral"
            showTexture={false}
            className="w-full"
          />
        </div>

        {/* Snap Controls */}
        <div className="mt-3 space-y-2">
          <div className="flex items-center justify-between">
            <Eyebrow className="flex items-center gap-1.5">
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
              <input
                type="range"
                min="0.001"
                max="0.1"
                step="0.001"
                value={snapTol}
                onChange={(e) => {
                  const v = parseFloat(e.target.value);
                  setSnapTolerance(v);
                  setSnapTolState(v);
                }}
                className="h-1 flex-1 accent-blue-500"
              />
              <span className="text-muted-foreground w-10 text-right font-mono text-xs tabular-nums">
                {snapTol.toFixed(3)}°
              </span>
            </div>
          )}
        </div>

        {/* User Settings */}
        <div className="border-border mt-3 border-t pt-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/settings")}
            className="text-muted-foreground w-full justify-start"
          >
            <User aria-hidden />
            User settings
          </Button>
          {isAdmin && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push("/admin")}
              className="text-muted-foreground w-full justify-start"
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
