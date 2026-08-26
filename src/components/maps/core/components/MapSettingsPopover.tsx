"use client";

import { useState, useEffect } from "react";
import { Settings, SunLight as Sun, HalfMoon as Moon, ModernTv as Monitor, User, Dashboard as LayoutDashboard, Magnet } from "iconoir-react";
import { Popover, PopoverTrigger, PopoverContent } from "~/components/ui/popover";
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
    setSnapEnabledState(getSnapEnabled());
    setSnapTolState(getSnapTolerance());
  }, []);

  return (
    <Popover>
      <PopoverTrigger
        className="text-muted-foreground hover:bg-accent hover:text-foreground shrink-0 cursor-pointer rounded-full p-1 transition-colors"
        title="Settings"
      >
        <Settings className="h-3.5 w-3.5" />
      </PopoverTrigger>
      <PopoverContent
        side="bottom"
        align="end"
        className="glass-none border-border bg-popover mt-2 w-56 rounded-2xl border p-3 shadow-2xl"
        sideOffset={8}
      >
        {/* Theme */}
        <div className="space-y-2">
          <div className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
            Theme
          </div>
          <div className="bg-accent/50 flex rounded-xl p-0.5">
            {(["light", "dark", "system"] as const).map((t) => {
              const Icon = t === "light" ? Sun : t === "dark" ? Moon : Monitor;
              return (
                <button
                  key={t}
                  onClick={() => setTheme(t)}
                  className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-[11px] font-medium transition-all ${
                    theme === t
                      ? "bg-background text-foreground ring-border shadow-sm ring-1"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
                  }`}
                >
                  <Icon className="h-3 w-3" />
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </button>
              );
            })}
          </div>
        </div>

        {/* Projection */}
        <div className="mt-3 space-y-2">
          <div className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
            Projection
          </div>
          <div className="bg-accent/50 flex rounded-xl p-0.5">
            {(["globe", "mercator", "dynamic"] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => onProjectionChange(mode)}
                className={`flex-1 rounded-lg px-2 py-1.5 text-[11px] font-medium transition-all ${
                  projectionMode === mode
                    ? "bg-background text-foreground ring-border shadow-sm ring-1"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
                }`}
              >
                {mode === "dynamic" ? "Auto" : mode.charAt(0).toUpperCase() + mode.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Snap Controls */}
        <div className="mt-3 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Magnet className="text-muted-foreground h-3 w-3" />
              <span className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
                Snap
              </span>
            </div>
            <button
              onClick={() => {
                const next = !snapEnabled;
                setSnapEnabled(next);
                setSnapEnabledState(next);
              }}
              className={`rounded-full px-2 py-0.5 text-[10px] font-medium transition-colors ${
                snapEnabled
                  ? "bg-emerald-500/10 text-emerald-500"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {snapEnabled ? "On" : "Off"}
            </button>
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
              <span className="text-muted-foreground w-10 text-right font-mono text-[10px] tabular-nums">
                {snapTol.toFixed(3)}°
              </span>
            </div>
          )}
        </div>

        {/* User Settings */}
        <div className="border-border mt-3 border-t pt-2">
          <button
            onClick={() => router.push("/settings")}
            className="text-muted-foreground hover:bg-accent hover:text-foreground flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-[11px] font-medium transition-colors"
          >
            <User className="h-3.5 w-3.5" />
            User Settings
          </button>
          {isAdmin && (
            <button
              onClick={() => router.push("/admin")}
              className="text-muted-foreground hover:bg-accent hover:text-foreground flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-[11px] font-medium transition-colors"
            >
              <LayoutDashboard className="h-3.5 w-3.5" />
              Admin Dashboard
            </button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
