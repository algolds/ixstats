"use client";

import { useTheme } from "~/context/theme-context";
import {
  SunLight as Sun,
  HalfMoon as Moon,
  ModernTv as Monitor,
  Palette,
  Flash as Zap,
  Component as Layers,
  Compress as Minimize2,
} from "iconoir-react";
import { SettingsHeader } from "../SettingsHeader";
import {
  SettingsGroup,
  SettingsRow,
  SettingsSwitchRow,
} from "../primitives";
import { cn } from "~/lib/utils";
import { soundEffects } from "~/lib/sound/cuelume";

export function AppearanceThemePanel() {
  const themeContext = useTheme();

  const {
    theme,
    setTheme,
    compactMode,
    setCompactMode,
    reduceAnimations,
    setReduceAnimations,
    lowFidelityMode,
    setLowFidelityMode,
    enableTextures,
    setEnableTextures,
    interactiveHover,
    setInteractiveHover,
  } = themeContext;

  return (
    <div className="space-y-6">
      <SettingsHeader
        title="Appearance & Theme"
        category="Platform & Preferences"
        description="Interface themes, tactile animation physics, and visual density."
      />

      {/* Theme Mode Selector */}
      <SettingsGroup
        title="Color Scheme"
        description="Choose your preferred visual presentation across all tools."
      >
        <SettingsRow
          label="Theme Mode"
          description="Switch between light, dark, or automatic system matching"
          icon={Palette}
          glyphClass="bg-indigo-500/15 text-indigo-500"
        >
          <div className="flex items-center gap-1.5 rounded-xl border border-border/60 bg-muted/40 p-1">
            <button
              type="button"
              onClick={() => {
                soundEffects.press();
                setTheme("light");
              }}
              data-cuelume-press="soft"
              className={cn(
                "facet-interactive flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-all active:scale-[0.98]",
                theme === "light"
                  ? "bg-card text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Sun className="h-3.5 w-3.5" />
              <span>Light</span>
            </button>

            <button
              type="button"
              onClick={() => {
                soundEffects.press();
                setTheme("dark");
              }}
              data-cuelume-press="soft"
              className={cn(
                "facet-interactive flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-all active:scale-[0.98]",
                theme === "dark"
                  ? "bg-card text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Moon className="h-3.5 w-3.5" />
              <span>Dark</span>
            </button>

            <button
              type="button"
              onClick={() => {
                soundEffects.press();
                setTheme("system");
              }}
              data-cuelume-press="soft"
              className={cn(
                "facet-interactive flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-all active:scale-[0.98]",
                theme === "system"
                  ? "bg-card text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Monitor className="h-3.5 w-3.5" />
              <span>System</span>
            </button>
          </div>
        </SettingsRow>
      </SettingsGroup>

      {/* Interface Density */}
      <SettingsGroup
        title="Layout & Density"
        description="Adjust padding, item heights, and component scaling."
      >
        <SettingsSwitchRow
          id="compact-mode"
          label="Compact Layout"
          description="Reduces margins, list heights, and header padding for data-dense dashboards"
          icon={Minimize2}
          glyphClass="bg-blue-500/15 text-blue-500"
          checked={compactMode}
          onCheckedChange={(checked) => {
            soundEffects.press();
            setCompactMode(checked);
          }}
        />
      </SettingsGroup>

      {/* Facet Design & Physics */}
      <SettingsGroup
        title="Facet Graphics & Motion Physics"
        description="Tune depth refraction, particle glows, and transition frame rates."
      >
        <SettingsSwitchRow
          id="reduce-animations"
          label="Reduce Motion"
          description="Replaces dynamic spring physics and layout morphs with instant transitions"
          icon={Zap}
          glyphClass="bg-amber-500/15 text-amber-500"
          checked={reduceAnimations}
          onCheckedChange={(checked) => {
            soundEffects.press();
            setReduceAnimations(checked);
          }}
        />

        <SettingsSwitchRow
          id="texture-overlays"
          label="Texture Overlays"
          description="Enables subtle grid, dot, and diagonal dot textures on glass cards"
          icon={Layers}
          glyphClass="bg-purple-500/15 text-purple-500"
          checked={enableTextures}
          onCheckedChange={(checked) => {
            soundEffects.press();
            setEnableTextures(checked);
          }}
        />

        <SettingsSwitchRow
          id="low-fidelity"
          label="Low Fidelity Mode"
          description="Disables real-time backdrop blur filters for maximum browser performance"
          icon={Zap}
          glyphClass="bg-rose-500/15 text-rose-500"
          checked={lowFidelityMode}
          onCheckedChange={(checked) => {
            soundEffects.press();
            setLowFidelityMode(checked);
          }}
        />

        <SettingsSwitchRow
          id="interactive-hover"
          label="Hover Light Glow"
          description="Projects interactive radial spotlight glow when pointing at card surfaces"
          icon={Palette}
          glyphClass="bg-emerald-500/15 text-emerald-500"
          checked={interactiveHover}
          onCheckedChange={(checked) => {
            soundEffects.press();
            setInteractiveHover(checked);
          }}
        />
      </SettingsGroup>
    </div>
  );
}
