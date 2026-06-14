"use client";

import { Settings, Sun, Moon, Monitor, User } from "lucide-react";
import { Popover, PopoverTrigger, PopoverContent } from "~/components/ui/popover";
import type { ProjectionMode } from "~/lib/map-config";
import type { Theme } from "~/context/theme-context";
import { useRouter } from "next/navigation";

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
  // eslint-disable-next-line unused-imports/no-unused-vars
  effectiveTheme,
  setTheme,
  router,
}: MapSettingsPopoverProps) {
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

        {/* User Settings */}
        <div className="border-border mt-3 border-t pt-2">
          <button
            onClick={() => router.push("/settings")}
            className="text-muted-foreground hover:bg-accent hover:text-foreground flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-[11px] font-medium transition-colors"
          >
            <User className="h-3.5 w-3.5" />
            User Settings
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
