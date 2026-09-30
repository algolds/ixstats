"use client";

import React, { useState } from "react";
import { Play, Refresh as RefreshCw, Component as Layers, Compass } from "iconoir-react";

export interface MapGenConfig {
  seed: number;
  cellCount: number;
  countryCount: number;
  landCoverage: number;
}

export interface MapPipelineControlsProps {
  config: MapGenConfig;
  onChangeConfig: (config: MapGenConfig) => void;
  onGenerate: () => void;
  isGenerating: boolean;
  activeLayers: Record<string, boolean>;
  onToggleLayer: (layer: string) => void;
  projectionMode: "dynamic" | "globe" | "mercator";
  onChangeProjection: (mode: "dynamic" | "globe" | "mercator") => void;
}

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
    <div className="bg-card/90 border-border text-card-foreground flex h-full flex-col border-r text-sm backdrop-blur-md">
      {/* Header */}
      <div className="border-border flex items-center justify-between border-b p-4">
        <div>
          <h2 className="text-primary flex items-center gap-2 text-base font-semibold">
            <Compass className="h-4 w-4" /> Map Pipeline Lab
          </h2>
          <p className="text-muted-foreground text-xs">Procedural Generation & Ingestion</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-border bg-muted/40 grid grid-cols-2 border-b text-xs font-medium">
        <button
          onClick={() => setActiveTab("generate")}
          className={`flex items-center justify-center gap-1.5 border-b-2 px-3 py-2.5 transition-[color,background-color,border-color,box-shadow,opacity,transform] ${
            activeTab === "generate"
              ? "border-primary text-primary bg-primary/5 font-semibold"
              : "text-muted-foreground hover:text-foreground border-transparent"
          }`}
        >
          <Play className="h-3.5 w-3.5" /> Generator
        </button>
        <button
          onClick={() => setActiveTab("layers")}
          className={`flex items-center justify-center gap-1.5 border-b-2 px-3 py-2.5 transition-[color,background-color,border-color,box-shadow,opacity,transform] ${
            activeTab === "layers"
              ? "border-primary text-primary bg-primary/5 font-semibold"
              : "text-muted-foreground hover:text-foreground border-transparent"
          }`}
        >
          <Layers className="h-3.5 w-3.5" /> Layers
        </button>
      </div>

      {/* Tab Content */}
      <div className="flex-1 space-y-6 overflow-y-auto p-4">
        {activeTab === "generate" && (
          <div className="space-y-4">
            {/* Projection Mode Toggle */}
            <div className="space-y-1.5">
              <label className="text-foreground text-xs font-medium">Map Projection</label>
              <div className="bg-background border-border grid grid-cols-3 gap-1 rounded-md border p-1 text-xs font-medium">
                {[
                  { id: "globe", label: "Globe" },
                  { id: "dynamic", label: "Auto" },
                  { id: "mercator", label: "Flat" },
                ].map((mode) => (
                  <button
                    key={mode.id}
                    type="button"
                    onClick={() => onChangeProjection(mode.id as any)}
                    className={`rounded py-1 text-center transition-[color,background-color,border-color,box-shadow,opacity,transform] ${
                      projectionMode === mode.id
                        ? "bg-primary text-primary-foreground font-semibold shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {mode.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Seed */}
            <div className="space-y-1.5">
              <label className="text-foreground flex items-center justify-between text-xs font-medium">
                <span>World Seed</span>
                <button
                  type="button"
                  onClick={handleRandomizeSeed}
                  className="text-primary flex items-center gap-1 text-xs font-medium hover:underline"
                >
                  <RefreshCw className="h-3 w-3" /> Randomize
                </button>
              </label>
              <input
                type="number"
                value={config.seed}
                onChange={(e) => onChangeConfig({ ...config, seed: Number(e.target.value) || 0 })}
                className="bg-background border-input text-foreground focus:ring-primary w-full rounded-md border px-3 py-1.5 font-mono text-xs focus:ring-1 focus:outline-none"
              />
            </div>

            {/* Mesh Engine Indicator */}
            <div className="border-primary/20 bg-primary/5 text-foreground flex items-center justify-between rounded-md border p-2.5 text-xs font-medium">
              <span className="flex items-center gap-1.5">
                <Layers className="text-primary h-3.5 w-3.5" /> Mesh Engine
              </span>
              <span className="text-primary font-mono text-xs font-semibold">
                100K RBF Splines
              </span>
            </div>

            {/* Country Count */}
            <div className="space-y-1.5">
              <label className="text-foreground flex justify-between text-xs font-medium">
                <span>Nations Generated</span>
                <span className="text-primary font-mono">{config.countryCount} nations</span>
              </label>
              <input
                type="range"
                min={3}
                max={30}
                value={config.countryCount}
                onChange={(e) =>
                  onChangeConfig({ ...config, countryCount: Number(e.target.value) })
                }
                className="accent-primary w-full"
              />
            </div>

            {/* Land Coverage */}
            <div className="space-y-1.5">
              <label className="text-foreground flex justify-between text-xs font-medium">
                <span>Land Ratio</span>
                <span className="text-primary font-mono">{config.landCoverage}%</span>
              </label>
              <input
                type="range"
                min={15}
                max={65}
                value={config.landCoverage}
                onChange={(e) =>
                  onChangeConfig({ ...config, landCoverage: Number(e.target.value) })
                }
                className="accent-primary w-full"
              />
            </div>

            {/* Generate Button */}
            <button
              onClick={onGenerate}
              disabled={isGenerating}
              className="bg-primary hover:bg-primary/90 text-primary-foreground mt-4 flex w-full items-center justify-center gap-2 rounded-md px-4 py-2.5 font-medium shadow transition-[color,background-color,border-color,box-shadow,opacity,transform]"
            >
              {isGenerating ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" /> Generating Pipeline...
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 fill-current" /> Run Map Pipeline
                </>
              )}
            </button>
          </div>
        )}

        {activeTab === "layers" && (
          <div className="space-y-3">
            <p className="text-muted-foreground text-xs">
              Toggle active map layers in the viewport:
            </p>
            {[
              {
                id: "political",
                label: "Political Borders",
                desc: "Nation polygons and territories",
              },
              { id: "altitudes", label: "Altitudes & Topography", desc: "9 elevation zones" },
              { id: "climate", label: "Climate Zones", desc: "Trewartha 12 climate types" },
              { id: "rivers", label: "Hydrographic Rivers", desc: "Vectorized river channels" },
              { id: "lakes", label: "Waterbodies / Lakes", desc: "Inland lakes and basins" },
            ].map((layer) => (
              <label
                key={layer.id}
                className="border-border bg-background/50 hover:bg-accent/40 flex cursor-pointer items-start gap-3 rounded-md border p-2.5 transition-[color,background-color,border-color,box-shadow,opacity,transform]"
              >
                <input
                  type="checkbox"
                  checked={Boolean(activeLayers[layer.id])}
                  onChange={() => onToggleLayer(layer.id)}
                  className="accent-primary mt-0.5 rounded"
                />
                <div>
                  <div className="text-foreground text-xs font-medium">{layer.label}</div>
                  <div className="text-muted-foreground text-xs">{layer.desc}</div>
                </div>
              </label>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
