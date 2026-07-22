"use client";

import React, { useState } from "react";
import { Play, RefreshCw, Layers, ShieldCheck, MapPin, Check, X, Sparkles } from "lucide-react";

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
    <div className="flex h-full flex-col bg-card/90 backdrop-blur-md border-r border-border text-card-foreground text-sm">
      {/* Header */}
      <div className="p-4 border-b border-border flex items-center justify-between">
        <div>
          <h2 className="font-semibold text-base text-primary flex items-center gap-2">
            <Sparkles className="w-4 h-4" /> Map Pipeline Lab
          </h2>
          <p className="text-xs text-muted-foreground">Procedural Gen, Ingestion & Territory Claims</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="grid grid-cols-3 border-b border-border text-xs font-medium bg-muted/40">
        <button
          onClick={() => setActiveTab("generate")}
          className={`py-2.5 px-3 flex items-center justify-center gap-1.5 border-b-2 transition-all ${
            activeTab === "generate"
              ? "border-primary text-primary bg-primary/5 font-semibold"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Play className="w-3.5 h-3.5" /> Generator
        </button>
        <button
          onClick={() => setActiveTab("layers")}
          className={`py-2.5 px-3 flex items-center justify-center gap-1.5 border-b-2 transition-all ${
            activeTab === "layers"
              ? "border-primary text-primary bg-primary/5 font-semibold"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Layers className="w-3.5 h-3.5" /> Layers
        </button>
        <button
          onClick={() => setActiveTab("claims")}
          className={`py-2.5 px-3 flex items-center justify-center gap-1.5 border-b-2 transition-all ${
            activeTab === "claims"
              ? "border-primary text-primary bg-primary/5 font-semibold"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <ShieldCheck className="w-3.5 h-3.5" /> Claims ({pendingClaims.length})
        </button>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {activeTab === "generate" && (
          <div className="space-y-4">
            {/* Projection Mode Toggle */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">Map Projection</label>
              <div className="grid grid-cols-3 gap-1 p-1 bg-background border border-border rounded-md text-xs font-medium">
                {[
                  { id: "globe", label: "Globe" },
                  { id: "dynamic", label: "Auto" },
                  { id: "mercator", label: "Flat" },
                ].map((mode) => (
                  <button
                    key={mode.id}
                    type="button"
                    onClick={() => onChangeProjection(mode.id as any)}
                    className={`py-1 rounded text-center transition-all ${
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
              <label className="text-xs font-medium text-foreground flex items-center justify-between">
                <span>World Seed</span>
                <button
                  type="button"
                  onClick={handleRandomizeSeed}
                  className="text-primary hover:underline text-[11px] flex items-center gap-1 font-medium"
                >
                  <RefreshCw className="w-3 h-3" /> Randomize
                </button>
              </label>
              <input
                type="number"
                value={config.seed}
                onChange={(e) => onChangeConfig({ ...config, seed: Number(e.target.value) || 0 })}
                className="w-full bg-background border border-input rounded-md px-3 py-1.5 text-foreground font-mono text-xs focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            {/* Cell Count */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground flex justify-between">
                <span>Cell Resolution</span>
                <span className="text-primary font-mono">{config.cellCount} cells</span>
              </label>
              <input
                type="range"
                min={500}
                max={5000}
                step={250}
                value={config.cellCount}
                onChange={(e) => onChangeConfig({ ...config, cellCount: Number(e.target.value) })}
                className="w-full accent-primary"
              />
            </div>

            {/* Country Count */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground flex justify-between">
                <span>Nations Generated</span>
                <span className="text-primary font-mono">{config.countryCount} nations</span>
              </label>
              <input
                type="range"
                min={3}
                max={30}
                value={config.countryCount}
                onChange={(e) => onChangeConfig({ ...config, countryCount: Number(e.target.value) })}
                className="w-full accent-primary"
              />
            </div>

            {/* Land Coverage */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground flex justify-between">
                <span>Land Ratio</span>
                <span className="text-primary font-mono">{config.landCoverage}%</span>
              </label>
              <input
                type="range"
                min={15}
                max={65}
                value={config.landCoverage}
                onChange={(e) => onChangeConfig({ ...config, landCoverage: Number(e.target.value) })}
                className="w-full accent-primary"
              />
            </div>

            {/* Generate Button */}
            <button
              onClick={onGenerate}
              disabled={isGenerating}
              className="w-full py-2.5 px-4 bg-primary hover:bg-primary/90 text-primary-foreground font-medium rounded-md shadow transition-all flex items-center justify-center gap-2 mt-4"
            >
              {isGenerating ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" /> Generating Pipeline...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-current" /> Run Map Pipeline
                </>
              )}
            </button>
          </div>
        )}

        {activeTab === "layers" && (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">Toggle active map layers in the viewport:</p>
            {[
              { id: "political", label: "Political Borders", desc: "Nation polygons and territories" },
              { id: "altitudes", label: "Altitudes & Topography", desc: "9 elevation zones" },
              { id: "climate", label: "Climate Zones", desc: "Trewartha 12 climate types" },
              { id: "rivers", label: "Hydrographic Rivers", desc: "Vectorized river channels" },
              { id: "lakes", label: "Waterbodies / Lakes", desc: "Inland lakes and basins" },
            ].map((layer) => (
              <label
                key={layer.id}
                className="flex items-start gap-3 p-2.5 rounded-md border border-border bg-background/50 hover:bg-accent/40 cursor-pointer transition-all"
              >
                <input
                  type="checkbox"
                  checked={Boolean(activeLayers[layer.id])}
                  onChange={() => onToggleLayer(layer.id)}
                  className="mt-0.5 rounded accent-primary"
                />
                <div>
                  <div className="font-medium text-foreground text-xs">{layer.label}</div>
                  <div className="text-[11px] text-muted-foreground">{layer.desc}</div>
                </div>
              </label>
            ))}
          </div>
        )}

        {activeTab === "claims" && (
          <div className="space-y-6">
            {/* Territory Claim Form */}
            <form onSubmit={handleClaim} className="space-y-3 p-3 border border-border rounded-md bg-background/40">
              <h3 className="font-semibold text-xs text-primary flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5" /> Submit Territory Claim
              </h3>
              <div className="space-y-1">
                <label className="text-[11px] text-muted-foreground">Unclaimed Polygon</label>
                <select
                  value={selectedFeatureId}
                  onChange={(e) => setSelectedFeatureId(e.target.value)}
                  className="w-full bg-background border border-input rounded-md px-2.5 py-1.5 text-xs text-foreground"
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
                <label className="text-[11px] text-muted-foreground">New Nation Name</label>
                <input
                  type="text"
                  placeholder="e.g. Republic of Valoria"
                  value={claimNationName}
                  onChange={(e) => setClaimNationName(e.target.value)}
                  className="w-full bg-background border border-input rounded-md px-2.5 py-1.5 text-xs text-foreground"
                />
              </div>

              <button
                type="submit"
                disabled={!selectedFeatureId || !claimNationName.trim()}
                className="w-full py-1.5 px-3 bg-secondary hover:bg-secondary/80 disabled:opacity-40 text-secondary-foreground text-xs font-medium rounded-md transition-all"
              >
                Submit Claim Request
              </button>
            </form>

            {/* Pending Admin Queue */}
            <div className="space-y-2">
              <h3 className="font-semibold text-xs text-foreground">Realm Admin Review Queue</h3>
              {pendingClaims.length === 0 ? (
                <p className="text-xs text-muted-foreground italic p-2 border border-border/60 rounded-md">
                  No pending claims in queue.
                </p>
              ) : (
                pendingClaims.map((claim) => (
                  <div key={claim.id} className="p-3 border border-border rounded-md bg-background/60 space-y-2">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-medium text-foreground text-xs">{claim.nationName}</div>
                        <div className="text-[11px] text-muted-foreground font-mono">Target: {claim.featureId}</div>
                      </div>
                      <span className="px-1.5 py-0.5 rounded text-[10px] bg-primary/10 text-primary font-medium">
                        Pending
                      </span>
                    </div>

                    <div className="flex gap-2 pt-1">
                      <button
                        onClick={() => onReviewClaim(claim.id, "approve")}
                        className="flex-1 py-1 px-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 border border-emerald-500/30 text-xs rounded-md flex items-center justify-center gap-1 font-medium transition-all"
                      >
                        <Check className="w-3 h-3" /> Approve
                      </button>
                      <button
                        onClick={() => onReviewClaim(claim.id, "reject")}
                        className="flex-1 py-1 px-2 bg-destructive/10 hover:bg-destructive/20 text-destructive border border-destructive/30 text-xs rounded-md flex items-center justify-center gap-1 font-medium transition-all"
                      >
                        <X className="w-3 h-3" /> Reject
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
