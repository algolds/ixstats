"use client";

import * as React from "react";
// Lab-only materials, textures and interaction profiles (never loaded by globals.css).
import "~/styles/facet/lab.css";
import { usePageTitle } from "~/hooks/usePageTitle";
import { AdminHeader } from "../_components/AdminHeader";
import {
  Component as Layers,
  Expand as Maximize2,
  Compress as Minimize2,
  Undo as RotateCcw,
} from "iconoir-react";
import { LabControlPanel } from "./_components/LabControlPanel";
import { LabSandbox } from "./_components/LabSandbox";
import { SnippetExporter } from "./_components/SnippetExporter";
import { type LabConfig } from "./_components/types";
import { ColorPickerInput } from "~/components/ui/color-picker";
import { useAdminNavigation } from "../_components/AdminNavigationContext";
import { Button } from "~/components/ui/button";
import { SegmentedControl } from "~/components/ui/segmented-control";
import { Facet3Showcase } from "./_components/Facet3Showcase";

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
  const [view, setView] = React.useState<"system" | "lab">("system");

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
    // `relative rounded-card`: what the FacetMaterial component adds (the CSS no longer does).
    const classes = [
      "relative",
      "rounded-card",
      "facet-material",
      `facet-material-${config.material}`,
    ];
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
    <div className="w-full space-y-6 pb-16" style={customVars}>
      <AdminHeader
        icon={Layers}
        title="Facet Materials Lab"
        description="The Facet 3 system as it ships, plus a sandbox for experimental, lab-only materials and textures."
      >
        {view === "lab" && (
          <>
            <ColorPickerInput
              value={config.customAccent}
              onChange={(color) => handleConfigChange({ customAccent: color })}
            />
            <Button
              variant="secondary"
              size="sm"
              onClick={handleReset}
              title="Reset all settings to defaults"
              aria-label="Reset all settings to defaults"
            >
              <RotateCcw />
              <span className="hidden sm:inline">Reset</span>
            </Button>
            <Button
              variant="secondary"
              size="sm"
              aria-pressed={config.fullscreen}
              onClick={() => {
                handleConfigChange({ fullscreen: !config.fullscreen });
                setSidebarHidden(!sidebarHidden);
              }}
              title={config.fullscreen ? "Exit fullscreen" : "Enter fullscreen"}
              aria-label={config.fullscreen ? "Exit fullscreen" : "Enter fullscreen"}
            >
              {config.fullscreen ? <Minimize2 /> : <Maximize2 />}
              <span className="hidden sm:inline">
                {config.fullscreen ? "Exit Fullscreen" : "Fullscreen"}
              </span>
            </Button>
          </>
        )}
      </AdminHeader>

      <SegmentedControl
        asTabs
        aria-label="Lab views"
        value={view}
        onValueChange={setView}
        options={[
          { value: "system", label: "Facet 3 system" },
          { value: "lab", label: "Lab materials" },
        ]}
      />

      {view === "system" ? (
        <Facet3Showcase />
      ) : (
        <div className="flex flex-col gap-8 lg:flex-row lg:items-start">
          {/* 1. Controls — scrollable within viewport */}
          <div className="flex flex-col gap-6 lg:max-h-[calc(100vh-10rem)] lg:w-[42%] lg:shrink-0 lg:overflow-y-auto lg:pb-4">
            <LabControlPanel config={config} onChange={handleConfigChange} />
          </div>

          {/* 2. Sandbox (sticky) + Snippet Exporter */}
          <div className="flex min-w-0 flex-1 flex-col gap-6">
            <div className="lg:sticky lg:top-[calc(var(--shell-top-offset)+1rem)]">
              <LabSandbox
                config={config}
                onChange={handleConfigChange}
                generatedClassNames={generatedClassNames}
              />
            </div>
            <SnippetExporter config={config} generatedClassNames={generatedClassNames} />
          </div>
        </div>
      )}
    </div>
  );
}
