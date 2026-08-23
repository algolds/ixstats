import { useState } from "react";
import { SunLight as Sun, HalfMoon as Moon, ModernTv as Monitor, NavArrowDown as ChevronDown, NavArrowUp as ChevronUp, Flash as Zap, Crown as Gem, Component as Layers, Compress as Minimize2, Download } from "iconoir-react";
import { AnimatedThemeToggler } from "~/components/ui/magicui/animated-theme-toggler";
import { TextureOverlay } from "~/components/ui/texture-overlay";
import { Switch } from "~/components/ui/switch";
import { Label } from "~/components/ui/label";
import { useTheme } from "~/context/theme-context";

interface UserPreferencesCardProps {
  theme?: string;
  onThemeChange?: (theme: "light" | "dark" | "system") => void;
}

export function UserPreferencesCard({
  theme: propTheme,
  onThemeChange: propOnThemeChange,
}: UserPreferencesCardProps) {
  const context = useTheme();

  // Backward compatibility with props
  const activeTheme = propTheme ?? context.theme;
  const handleThemeChange = propOnThemeChange ?? context.setTheme;

  const {
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
    showNsImporter,
    setShowNsImporter,
  } = context;

  const [showAdvanced, setShowAdvanced] = useState(false);

  return (
    <div className="facet-surface facet-refraction overflow-hidden rounded-3xl p-1 transition-all duration-500 hover:shadow-2xl">
      <div className="relative overflow-hidden rounded-[calc(1.5rem-1px)] bg-white/40 p-6 dark:bg-slate-900/40">
        <TextureOverlay texture="diagonal" opacity={0.03} />

        {/* Card Header */}
        <div className="relative z-10 mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                Interface Configuration
              </h2>
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white/50 p-1 dark:border-slate-800 dark:bg-slate-900/50">
            <AnimatedThemeToggler className="h-9 w-9" />
          </div>
        </div>

        <div className="relative z-10 space-y-6">
          {/* Theme Selector */}
          <div>
            <span className="mb-3 block text-xs font-bold tracking-wider text-slate-400 uppercase dark:text-slate-500">
              Theme Mode
            </span>
            <div className="grid grid-cols-3 gap-3">
              <button
                onClick={() => handleThemeChange("light")}
                className={`facet-interactive flex flex-col items-center justify-center gap-2 rounded-2xl border py-4 transition-all ${
                  activeTheme === "light"
                    ? "border-indigo-500 bg-indigo-500/10 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-400"
                    : "border-slate-200 bg-white/30 text-slate-600 hover:bg-white dark:border-slate-800 dark:bg-slate-900/30 dark:text-slate-400 dark:hover:bg-slate-800"
                }`}
              >
                <Sun className={`h-5 w-5 ${activeTheme === "light" ? "animate-spin-slow" : ""}`} />
                <span className="text-xs font-bold tracking-widest uppercase">Light</span>
              </button>
              <button
                onClick={() => handleThemeChange("dark")}
                className={`facet-interactive flex flex-col items-center justify-center gap-2 rounded-2xl border py-4 transition-all ${
                  activeTheme === "dark"
                    ? "border-indigo-500 bg-indigo-500/10 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-400"
                    : "border-slate-200 bg-white/30 text-slate-600 hover:bg-white dark:border-slate-800 dark:bg-slate-900/30 dark:text-slate-400 dark:hover:bg-slate-800"
                }`}
              >
                <Moon className={`h-5 w-5 ${activeTheme === "dark" ? "animate-pulse" : ""}`} />
                <span className="text-xs font-bold tracking-widest uppercase">Dark</span>
              </button>
              <button
                onClick={() => handleThemeChange("system")}
                className={`facet-interactive flex flex-col items-center justify-center gap-2 rounded-2xl border py-4 transition-all ${
                  activeTheme === "system"
                    ? "border-indigo-500 bg-indigo-500/10 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-400"
                    : "border-slate-200 bg-white/30 text-slate-600 hover:bg-white dark:border-slate-800 dark:bg-slate-900/30 dark:text-slate-400 dark:hover:bg-slate-800"
                }`}
              >
                <Monitor className="h-5 w-5" />
                <span className="text-xs font-bold tracking-widest uppercase">Auto</span>
              </button>
            </div>
          </div>

          <hr className="border-slate-200/50 dark:border-slate-800/50" />

          {/* Density Settings */}
          <div className="space-y-4">
            <span className="block text-xs font-bold tracking-wider text-slate-400 uppercase dark:text-slate-500">
              Display & Density
            </span>
            <div className="flex items-center justify-between rounded-2xl bg-slate-50/50 p-4 dark:bg-slate-800/30">
              <div className="flex gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-400">
                  <Minimize2 className="h-5 w-5" />
                </div>
                <div>
                  <Label
                    htmlFor="compact-mode"
                    className="text-sm font-bold text-slate-900 dark:text-white"
                  >
                    Compact Layout Mode
                  </Label>
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                    Reduces padding and font sizes across panels to display more information.
                  </p>
                </div>
              </div>
              <Switch
                id="compact-mode"
                checked={compactMode}
                onCheckedChange={setCompactMode}
                className="data-[state=checked]:bg-indigo-600"
              />
            </div>

            {/* NS Importer Toggle */}
            <div className="flex items-center justify-between rounded-2xl bg-slate-50/50 p-4 dark:bg-slate-800/30">
              <div className="flex gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-rose-500/10 text-rose-600 dark:bg-rose-500/20 dark:text-rose-400">
                  <Download className="h-5 w-5" />
                </div>
                <div>
                  <Label
                    htmlFor="show-ns-importer"
                    className="text-sm font-bold text-slate-900 dark:text-white"
                  >
                    Show NS Importer in Sidebar
                  </Label>
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                    Displays the NationStates importer link in the Vault sidebar.
                  </p>
                </div>
              </div>
              <Switch
                id="show-ns-importer"
                checked={showNsImporter}
                onCheckedChange={setShowNsImporter}
                className="data-[state=checked]:bg-rose-500"
              />
            </div>
          </div>

          <hr className="border-slate-200/50 dark:border-slate-800/50" />

          {/* Accessibility and Performance Settings */}
          <div className="space-y-4">
            <span className="block text-xs font-bold tracking-wider text-slate-400 uppercase dark:text-slate-500">
              Performance & Motion
            </span>

            {/* Reduced Animations Toggle */}
            <div className="flex items-center justify-between rounded-2xl bg-slate-50/50 p-4 dark:bg-slate-800/30">
              <div className="flex gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400">
                  <Zap className="h-5 w-5" />
                </div>
                <div>
                  <Label
                    htmlFor="reduce-animations"
                    className="text-sm font-bold text-slate-900 dark:text-white"
                  >
                    Reduced Motion
                  </Label>
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                    Disables UI spinning icons, transitions, slide-ins, and complex animations.
                  </p>
                </div>
              </div>
              <Switch
                id="reduce-animations"
                checked={reduceAnimations}
                onCheckedChange={setReduceAnimations}
                className="data-[state=checked]:bg-amber-500"
              />
            </div>

            {/* Low Fidelity Mode Toggle */}
            <div className="flex items-center justify-between rounded-2xl bg-slate-50/50 p-4 dark:bg-slate-800/30">
              <div className="flex gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-purple-500/10 text-purple-600 dark:bg-purple-500/20 dark:text-purple-400">
                  <Layers className="h-5 w-5" />
                </div>
                <div>
                  <Label
                    htmlFor="low-fidelity"
                    className="text-sm font-bold text-slate-900 dark:text-white"
                  >
                    Low Fidelity Mode
                  </Label>
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                    Disables backdrop glass blurs, drop shadows, and complex gradients.
                  </p>
                </div>
              </div>
              <Switch
                id="low-fidelity"
                checked={lowFidelityMode}
                onCheckedChange={setLowFidelityMode}
                className="data-[state=checked]:bg-purple-600"
              />
            </div>
          </div>

          <hr className="border-slate-200/50 dark:border-slate-800/50" />

          {/* Advanced / Collapsible options */}
          <div>
            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="flex w-full items-center justify-between py-2 text-left text-sm font-bold text-slate-700 transition-colors hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
            >
              <div className="flex items-center gap-2">
                <Gem className="h-4 w-4 text-indigo-500" />
                <span>More Visual Settings</span>
              </div>
              {showAdvanced ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </button>

            {showAdvanced && (
              <div className="animate-fade-in mt-4 space-y-4 pl-1">
                {/* Background Textures Toggle */}
                <div className="flex items-center justify-between rounded-xl bg-slate-50/30 p-3.5 dark:bg-slate-800/20">
                  <div>
                    <Label
                      htmlFor="enable-textures"
                      className="text-xs font-bold text-slate-900 dark:text-white"
                    >
                      Glass Surface Textures
                    </Label>
                    <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                      Renders geometric noise, dot, or diagonal patterns on background surfaces.
                    </p>
                  </div>
                  <Switch
                    id="enable-textures"
                    checked={enableTextures}
                    onCheckedChange={setEnableTextures}
                    disabled={lowFidelityMode}
                    className="data-[state=checked]:bg-indigo-500"
                  />
                </div>

                {/* Hover transform depth toggle */}
                <div className="flex items-center justify-between rounded-xl bg-slate-50/30 p-3.5 dark:bg-slate-800/20">
                  <div>
                    <Label
                      htmlFor="interactive-hover"
                      className="text-xs font-bold text-slate-900 dark:text-white"
                    >
                      Interactive Hover Lift
                    </Label>
                    <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                      Causes elements to lift, scale, and cast larger shadows when hovered.
                    </p>
                  </div>
                  <Switch
                    id="interactive-hover"
                    checked={interactiveHover}
                    onCheckedChange={setInteractiveHover}
                    disabled={reduceAnimations}
                    className="data-[state=checked]:bg-indigo-500"
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
