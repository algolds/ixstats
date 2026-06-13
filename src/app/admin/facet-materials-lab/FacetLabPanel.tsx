"use client";

import * as React from "react";
import { usePageTitle } from "~/hooks/usePageTitle";
import { AdminHeader } from "../_components/AdminHeader";
import { Layers, Maximize2, Minimize2, RotateCcw } from "lucide-react";
import { LabControlPanel } from "./_components/LabControlPanel";
import { LabSandbox } from "./_components/LabSandbox";
import { SnippetExporter } from "./_components/SnippetExporter";
import { type LabConfig } from "./_components/types";
import { ColorPicker } from "~/components/ui/color-picker";
import { useAdminNavigation } from "../_components/AdminNavigationContext";

const DEFAULT_CONFIG: LabConfig = {
  template: "facet-card",
  material: "satin",
  texture: "diagonal",
  textureOpacity: 0.02,
  depth: 2,
  variant: "base",
  interactivity: "interactive",
  lightInteraction: true,
  simulatedTheme: "dark",
  customAccent: "#6366f1",
  fullscreen: false,
  blurStrength: 16,
  saturationBoost: 180,
  glowIntensity: 50,
  refractionEnabled: true,
  bgStyle: "refraction",
  bgCustomColor: "#000000",
  patternScale: 100,
  dofStrength: 0,
};

export default function FacetMaterialsLabPage() {
  usePageTitle({ title: "Facet Materials Lab" });

  const { sidebarHidden, setSidebarHidden } = useAdminNavigation();

  const [config, setConfig] = React.useState<LabConfig>(DEFAULT_CONFIG);

  // Reset sidebar when navigating away from facet lab
  React.useEffect(() => {
    return () => {
      setSidebarHidden(false);
    };
  }, [setSidebarHidden]);

  const handleConfigChange = React.useCallback((updates: Partial<LabConfig>) => {
    setConfig((prev) => ({ ...prev, ...updates }));
  }, []);

  const handleReset = React.useCallback(() => {
    setConfig({ ...DEFAULT_CONFIG, simulatedTheme: config.simulatedTheme });
    if (sidebarHidden) setSidebarHidden(false);
  }, [config.simulatedTheme, sidebarHidden, setSidebarHidden]);

  // Generate dynamic CSS class lists
  const generatedClassNames = React.useMemo(() => {
    const classes = ["facet-material", `facet-material-${config.material}`];
    classes.push(`facet-depth-${config.depth}`);

    if (config.variant !== "base") {
      classes.push(`facet-${config.variant}`);
    }

    if (config.interactivity === "interactive") {
      classes.push("facet-interactive");
    } else if (config.interactivity === "hierarchy-interactive") {
      classes.push("facet-hierarchy-interactive");
    } else if (config.interactivity === "magnetic-3d") {
      classes.push("facet-magnetic-3d");
    } else if (config.interactivity === "glow-accent") {
      classes.push("facet-glow-accent");
    }

    if (config.refractionEnabled) {
      classes.push("facet-refraction");
    }

    return classes.join(" ");
  }, [
    config.material,
    config.depth,
    config.variant,
    config.interactivity,
    config.refractionEnabled,
  ]);

  // Custom CSS variables for material effects
  const customVars = React.useMemo(() => {
    return {
      "--facet-lab-accent": config.customAccent,
      "--facet-lab-blur": `${config.blurStrength}px`,
      "--facet-lab-saturate": `${config.saturationBoost}%`,
      "--facet-lab-glow": `${config.glowIntensity / 100}`,
      "--facet-lab-pattern-scale": `${config.patternScale}%`,
      "--facet-lab-bg": config.bgCustomColor,
      "--facet-dof": `${config.dofStrength}`,
    } as React.CSSProperties;
  }, [
    config.blurStrength,
    config.saturationBoost,
    config.glowIntensity,
    config.patternScale,
    config.bgCustomColor,
    config.customAccent,
    config.dofStrength,
  ]);

  return (
    <div className="w-full pb-16" style={customVars}>
      <div className="mb-4 flex items-start justify-between gap-4">
        <AdminHeader
          icon={Layers}
          title="Facet Materials Lab"
          description="Live design utility for simulating Glass refraction, tactile textures, elevation depths, and physical pointer highlight vectors."
        />
        <div className="flex items-center gap-2 pt-2">
          <ColorPicker
            color={config.customAccent}
            onChange={(color) => handleConfigChange({ customAccent: color })}
          />
          <button
            onClick={handleReset}
            className="bg-muted/30 border-border/40 hover:bg-muted/65 text-muted-foreground hover:text-foreground flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold transition-all"
            title="Reset all settings to defaults"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Reset</span>
          </button>
          <button
            onClick={() => {
              handleConfigChange({ fullscreen: !config.fullscreen });
              setSidebarHidden(!sidebarHidden);
            }}
            className="bg-muted/30 border-border/40 hover:bg-muted/65 text-muted-foreground hover:text-foreground flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold transition-all"
            title={config.fullscreen ? "Exit fullscreen" : "Enter fullscreen"}
          >
            {config.fullscreen ? (
              <Minimize2 className="h-3.5 w-3.5" />
            ) : (
              <Maximize2 className="h-3.5 w-3.5" />
            )}
            <span className="hidden sm:inline">
              {config.fullscreen ? "Exit Fullscreen" : "Fullscreen"}
            </span>
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-8 lg:flex-row lg:items-start">
        {/* 1. Controls — scrollable within viewport */}
        <div className="[&::-webkit-scrollbar-thumb]:bg-border/40 flex flex-col gap-6 lg:max-h-[calc(100vh-10rem)] lg:w-[42%] lg:shrink-0 lg:overflow-y-auto lg:pb-4 [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:rounded-full">
          <LabControlPanel config={config} onChange={handleConfigChange} />
        </div>

        {/* 2. Sandbox (sticky) + Snippet Exporter */}
        <div className="flex min-w-0 flex-1 flex-col gap-6">
          <div className="lg:sticky lg:top-24">
            <LabSandbox
              config={config}
              onChange={handleConfigChange}
              generatedClassNames={generatedClassNames}
            />
          </div>
          <SnippetExporter config={config} generatedClassNames={generatedClassNames} />
        </div>
      </div>
    </div>
  );
}
