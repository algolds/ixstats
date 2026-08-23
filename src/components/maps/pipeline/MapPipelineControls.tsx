"use client";

import React, { useState } from "react";
import { Play, Refresh as RefreshCw, Component as Layers, ShieldCheck, MapPin, Check, Xmark as X, Compass } from "iconoir-react";

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
  unclaimedNations: Array<{ featureId: string; name: string }>;
  onClaimSubmit: (featureId: string, nationName: string) => void;
  pendingClaims: Array<{ id: string; featureId: string; nationName: string; userId: string }>;
  onReviewClaim: (claimId: string, action: "approve" | "reject") => void;
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
  unclaimedNations,
  onClaimSubmit,
  pendingClaims,
  onReviewClaim,
  projectionMode,
  onChangeProjection,
}: MapPipelineControlsProps) {
  const [activeTab, setActiveTab] = useState<"generate" | "layers" | "claims">("generate");
  const [selectedFeatureId, setSelectedFeatureId] = useState("");
  const [claimNationName, setClaimNationName] = useState("");

  const handleRandomizeSeed = () => {
    onChangeConfig({ ...config, seed: Math.floor(Math.random() * 1000000) });
  };

  const handleClaim = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFeatureId || !claimNationName.trim()) return;
    onClaimSubmit(selectedFeatureId, claimNationName.trim());
    setClaimNationName("");
  };

  return (
    <div className="bg-card/90 border-border text-card-foreground flex h-full flex-col border-r text-sm backdrop-blur-md">
      {/* Header */}
      <div className="border-border flex items-center justify-between border-b p-4">
        <div>
          <h2 className="text-primary flex items-center gap-2 text-base font-semibold">
            <Compass className="h-4 w-4" /> Map Pipeline Lab
          </h2>
          <p className="text-muted-foreground text-xs">
            Procedural Gen, Ingestion & Territory Claims
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-border bg-muted/40 grid grid-cols-3 border-b text-xs font-medium">
        <button
          onClick={() => setActiveTab("generate")}
          className={`flex items-center justify-center gap-1.5 border-b-2 px-3 py-2.5 transition-all ${
            activeTab === "generate"
              ? "border-primary text-primary bg-primary/5 font-semibold"
              : "text-muted-foreground hover:text-foreground border-transparent"
          }`}
        >
          <Play className="h-3.5 w-3.5" /> Generator
        </button>
        <button
          onClick={() => setActiveTab("layers")}
          className={`flex items-center justify-center gap-1.5 border-b-2 px-3 py-2.5 transition-all ${
            activeTab === "layers"
              ? "border-primary text-primary bg-primary/5 font-semibold"
              : "text-muted-foreground hover:text-foreground border-transparent"
          }`}
        >
          <Layers className="h-3.5 w-3.5" /> Layers
        </button>
        <button
          onClick={() => setActiveTab("claims")}
          className={`flex items-center justify-center gap-1.5 border-b-2 px-3 py-2.5 transition-all ${
            activeTab === "claims"
              ? "border-primary text-primary bg-primary/5 font-semibold"
              : "text-muted-foreground hover:text-foreground border-transparent"
          }`}
        >
          <ShieldCheck className="h-3.5 w-3.5" /> Claims ({pendingClaims.length})
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
                    className={`rounded py-1 text-center transition-all ${
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
                  className="text-primary flex items-center gap-1 text-[11px] font-medium hover:underline"
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
              <span className="text-primary font-mono text-[11px] font-semibold">
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
              className="bg-primary hover:bg-primary/90 text-primary-foreground mt-4 flex w-full items-center justify-center gap-2 rounded-md px-4 py-2.5 font-medium shadow transition-all"
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
                className="border-border bg-background/50 hover:bg-accent/40 flex cursor-pointer items-start gap-3 rounded-md border p-2.5 transition-all"
              >
                <input
                  type="checkbox"
                  checked={Boolean(activeLayers[layer.id])}
                  onChange={() => onToggleLayer(layer.id)}
                  className="accent-primary mt-0.5 rounded"
                />
                <div>
                  <div className="text-foreground text-xs font-medium">{layer.label}</div>
                  <div className="text-muted-foreground text-[11px]">{layer.desc}</div>
                </div>
              </label>
            ))}
          </div>
        )}

        {activeTab === "claims" && (
          <div className="space-y-6">
            {/* Territory Claim Form */}
            <form
              onSubmit={handleClaim}
              className="border-border bg-background/40 space-y-3 rounded-md border p-3"
            >
              <h3 className="text-primary flex items-center gap-1.5 text-xs font-semibold">
                <MapPin className="h-3.5 w-3.5" /> Submit Territory Claim
              </h3>
              <div className="space-y-1">
                <label className="text-muted-foreground text-[11px]">Unclaimed Polygon</label>
                <select
                  value={selectedFeatureId}
                  onChange={(e) => setSelectedFeatureId(e.target.value)}
                  className="bg-background border-input text-foreground w-full rounded-md border px-2.5 py-1.5 text-xs"
                >
                  <option value="">Select an unclaimed territory...</option>
                  {unclaimedNations.map((n) => (
                    <option key={n.featureId} value={n.featureId}>
                      {n.name} ({n.featureId})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-muted-foreground text-[11px]">New Nation Name</label>
                <input
                  type="text"
                  placeholder="e.g. Republic of Valoria"
                  value={claimNationName}
                  onChange={(e) => setClaimNationName(e.target.value)}
                  className="bg-background border-input text-foreground w-full rounded-md border px-2.5 py-1.5 text-xs"
                />
              </div>

              <button
                type="submit"
                disabled={!selectedFeatureId || !claimNationName.trim()}
                className="bg-secondary hover:bg-secondary/80 text-secondary-foreground w-full rounded-md px-3 py-1.5 text-xs font-medium transition-all disabled:opacity-40"
              >
                Submit Claim Request
              </button>
            </form>

            {/* Pending Admin Queue */}
            <div className="space-y-2">
              <h3 className="text-foreground text-xs font-semibold">Realm Admin Review Queue</h3>
              {pendingClaims.length === 0 ? (
                <p className="text-muted-foreground border-border/60 rounded-md border p-2 text-xs italic">
                  No pending claims in queue.
                </p>
              ) : (
                pendingClaims.map((claim) => (
                  <div
                    key={claim.id}
                    className="border-border bg-background/60 space-y-2 rounded-md border p-3"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="text-foreground text-xs font-medium">
                          {claim.nationName}
                        </div>
                        <div className="text-muted-foreground font-mono text-[11px]">
                          Target: {claim.featureId}
                        </div>
                      </div>
                      <span className="bg-primary/10 text-primary rounded px-1.5 py-0.5 text-[10px] font-medium">
                        Pending
                      </span>
                    </div>

                    <div className="flex gap-2 pt-1">
                      <button
                        onClick={() => onReviewClaim(claim.id, "approve")}
                        className="flex flex-1 items-center justify-center gap-1 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-xs font-medium text-emerald-500 transition-all hover:bg-emerald-500/20"
                      >
                        <Check className="h-3 w-3" /> Approve
                      </button>
                      <button
                        onClick={() => onReviewClaim(claim.id, "reject")}
                        className="bg-destructive/10 hover:bg-destructive/20 text-destructive border-destructive/30 flex flex-1 items-center justify-center gap-1 rounded-md border px-2 py-1 text-xs font-medium transition-all"
                      >
                        <X className="h-3 w-3" /> Reject
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
