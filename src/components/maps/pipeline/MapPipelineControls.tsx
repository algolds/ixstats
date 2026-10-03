"use client";

import { useState } from "react";
import type { ProjectionMode } from "~/lib/maps/map-config";
import { Play, Refresh as RefreshCw, Component as Layers, Compass } from "iconoir-react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { SegmentedControl } from "~/components/ui/segmented-control";
import { Slider } from "~/components/ui/slider";
import { Checkbox } from "~/components/ui/checkbox";

export interface MapGenConfig {
  seed: number;
  cellCount: number;
  countryCount: number;
  landCoverage: number;
}

interface MapPipelineControlsProps {
  config: MapGenConfig;
  onChangeConfig: (config: MapGenConfig) => void;
  onGenerate: () => void;
  isGenerating: boolean;
  activeLayers: Record<string, boolean>;
  onToggleLayer: (layer: string) => void;
  projectionMode: ProjectionMode;
  onChangeProjection: (mode: ProjectionMode) => void;
}

const SLIDERS = [
  {
    key: "countryCount",
    label: "Nations generated",
    min: 3,
    max: 30,
    format: (v: number) => `${v} nations`,
  },
  { key: "landCoverage", label: "Land ratio", min: 15, max: 65, format: (v: number) => `${v}%` },
] as const;

const LAYER_TOGGLES = [
  { id: "political", label: "Political borders", desc: "Nation polygons and territories" },
  { id: "altitudes", label: "Altitudes & topography", desc: "9 elevation zones" },
  { id: "climate", label: "Climate zones", desc: "Trewartha 12 climate types" },
  { id: "rivers", label: "Hydrographic rivers", desc: "Vectorized river channels" },
  { id: "lakes", label: "Waterbodies / Lakes", desc: "Inland lakes and basins" },
];

export function MapPipelineControls({
  config,
  onChangeConfig,
  onGenerate,
  isGenerating,
  activeLayers,
  onToggleLayer,
  projectionMode,
  onChangeProjection,
}: MapPipelineControlsProps) {
  const [activeTab, setActiveTab] = useState<"generate" | "layers">("generate");

  const handleRandomizeSeed = () => {
    onChangeConfig({ ...config, seed: Math.floor(Math.random() * 1000000) });
  };

  return (
    <div className="bg-surface border-separator text-label text-body flex h-full flex-col border-r">
      <div className="border-separator flex items-center justify-between border-b p-4">
        <div>
          <h2 className="text-tint text-title-3 flex items-center gap-2">
            <Compass className="h-4 w-4" /> Map pipeline lab
          </h2>
          <p className="text-label-secondary text-footnote">Procedural generation & ingestion</p>
        </div>
      </div>

      <div className="border-separator border-b p-2">
        <SegmentedControl
          aria-label="Pipeline section"
          asTabs
          fullWidth
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as "generate" | "layers")}
          options={[
            { value: "generate", label: "Generator", icon: <Play aria-hidden /> },
            { value: "layers", label: "Layers", icon: <Layers aria-hidden /> },
          ]}
        />
      </div>

      <div className="flex-1 space-y-6 overflow-y-auto p-4">
        {activeTab === "generate" && (
          <div className="space-y-4">
            <div className="space-y-2">
              <span id="pipeline-projection" className="text-label text-caption">
                Map projection
              </span>
              <SegmentedControl
                aria-labelledby="pipeline-projection"
                fullWidth
                size="sm"
                value={projectionMode}
                onValueChange={(v) => onChangeProjection(v as ProjectionMode)}
                options={[
                  { value: "globe", label: "Globe" },
                  { value: "dynamic", label: "Auto" },
                  { value: "mercator", label: "Flat" },
                ]}
              />
            </div>

            <div className="space-y-2">
              <div className="text-label text-caption flex items-center justify-between">
                <label htmlFor="pipeline-seed">World seed</label>
                <Button type="button" variant="ghost" size="sm" onClick={handleRandomizeSeed}>
                  <RefreshCw className="size-3.5" aria-hidden /> Randomize
                </Button>
              </div>
              <Input
                id="pipeline-seed"
                type="number"
                value={config.seed}
                onChange={(e) => onChangeConfig({ ...config, seed: Number(e.target.value) || 0 })}
                className="tabular-nums"
              />
            </div>

            <div className="border-tint/20 bg-tint-fill text-label rounded-control-sm text-caption flex items-center justify-between border p-2">
              <span className="flex items-center gap-2">
                <Layers className="text-tint h-3.5 w-3.5" /> Mesh engine
              </span>
              <span className="text-tint text-caption font-semibold tabular-nums">
                100K RBF Splines
              </span>
            </div>

            {SLIDERS.map(({ key, label, min, max, format }) => (
              <div key={key} className="space-y-2">
                <label className="text-label text-caption flex justify-between">
                  <span>{label}</span>
                  <span className="text-tint tabular-nums">{format(config[key])}</span>
                </label>
                <Slider
                  aria-label={label}
                  min={min}
                  max={max}
                  value={[config[key]]}
                  onValueChange={([v]) =>
                    v !== undefined && onChangeConfig({ ...config, [key]: v })
                  }
                  className="w-full py-2"
                />
              </div>
            ))}

            <Button
              type="button"
              size="lg"
              onClick={onGenerate}
              disabled={isGenerating}
              className="mt-4 w-full"
            >
              {isGenerating ? (
                <>
                  <RefreshCw className="size-4 animate-spin" aria-hidden /> Generating Pipeline...
                </>
              ) : (
                <>
                  <Play className="size-4 fill-current" aria-hidden /> Run map pipeline
                </>
              )}
            </Button>
          </div>
        )}

        {activeTab === "layers" && (
          <div className="space-y-3">
            <p className="text-label-secondary text-footnote">
              Toggle active map layers in the viewport:
            </p>
            {LAYER_TOGGLES.map((layer) => (
              <label
                key={layer.id}
                className="border-separator bg-surface hover:bg-fill-3 rounded-control-sm flex cursor-pointer items-start gap-3 border p-3 transition-[color,background-color,border-color,box-shadow,opacity,transform]"
              >
                <Checkbox
                  checked={Boolean(activeLayers[layer.id])}
                  onCheckedChange={() => onToggleLayer(layer.id)}
                  className="mt-0.5"
                />
                <div>
                  <div className="text-label text-caption">{layer.label}</div>
                  <div className="text-label-secondary text-footnote">{layer.desc}</div>
                </div>
              </label>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
