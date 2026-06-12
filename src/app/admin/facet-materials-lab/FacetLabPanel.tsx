"use client";

import * as React from "react";
import { usePageTitle } from "~/hooks/usePageTitle";
import { AdminHeader } from "../_components/AdminHeader";
import { Layers } from "lucide-react";
import { LabControlPanel } from "./_components/LabControlPanel";
import { LabSandbox } from "./_components/LabSandbox";
import { SnippetExporter } from "./_components/SnippetExporter";
import { type LabConfig } from "./_components/types";

export default function FacetMaterialsLabPage() {
  usePageTitle({ title: "Facet Materials Lab" });

  const [config, setConfig] = React.useState<LabConfig>({
    template: "facet-card",
    material: "satin",
    texture: "diagonal",
    textureOpacity: 0.02,
    depth: 2,
    variant: "base",
    interactivity: "interactive",
    lightInteraction: true,
    simulatedTheme: "dark",
  });

  const handleConfigChange = React.useCallback((updates: Partial<LabConfig>) => {
    setConfig((prev) => ({ ...prev, ...updates }));
  }, []);

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
    }

    return classes.join(" ");
  }, [config.material, config.depth, config.variant, config.interactivity]);

  return (
    <div className="w-full pb-16">
      <AdminHeader
        icon={Layers}
        title="Facet Materials Lab"
        description="Live design utility for simulating Glass refraction, tactile textures, elevation depths, and physical pointer highlight vectors."
      />

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        {/* 1. Control Panel Sidebar */}
        <div className="lg:col-span-5 space-y-6">
          <LabControlPanel config={config} onChange={handleConfigChange} />
        </div>

        {/* 2. Interactive Sandbox & Snippet Exporter */}
        <div className="lg:col-span-7 flex flex-col gap-6">
          <LabSandbox
            config={config}
            onChange={handleConfigChange}
            generatedClassNames={generatedClassNames}
          />
          <SnippetExporter config={config} generatedClassNames={generatedClassNames} />
        </div>
      </div>
    </div>
  );
}
