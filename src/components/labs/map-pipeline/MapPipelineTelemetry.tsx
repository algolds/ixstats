"use client";

import React, { useState } from "react";
import { Activity, Layers } from "lucide-react";
import type { NormalizedCountryPayload } from "~/lib/map-pipeline/azgaar-normalizer";
import type { GeoProfilePayload, ResourcePlacementPayload } from "~/lib/map-pipeline/enrichment-pipeline";

export interface MapPipelineTelemetryProps {
  stats: {
    generationTimeMs: number;
    cellCount: number;
    countryCount: number;
    cityCount: number;
    riverCount: number;
    sharedVerticesCount: number;
  };
  countries: NormalizedCountryPayload[];
  geoProfiles: GeoProfilePayload[];
  resources: ResourcePlacementPayload[];
  log: string[];
}

export function MapPipelineTelemetry({
  stats,
  countries,
  geoProfiles,
  resources,
  log,
}: MapPipelineTelemetryProps) {
  const [selectedCountryId, setSelectedCountryId] = useState<string>(countries?.[0]?.featureId || "");
  const [activeTab, setActiveTab] = useState<"stats" | "geoprofile" | "resources" | "logs">("stats");

  React.useEffect(() => {
    if (countries && countries.length > 0) {
      if (!countries.some((c) => c && c.featureId === selectedCountryId)) {
        setSelectedCountryId(countries[0]!.featureId);
      }
    }
  }, [countries, selectedCountryId]);

  const activeCountry = (countries || []).find((c) => c && c.featureId === selectedCountryId) || countries?.[0];
  const activeProfile = activeCountry
    ? (geoProfiles || []).find((p) => p && p.countryFeatureId === activeCountry.featureId)
    : undefined;
  const activeResources = activeCountry
    ? (resources || []).filter((r) => r && r.countryFeatureId === activeCountry.featureId)
    : [];

  return (
    <div className="flex h-full flex-col bg-card/90 backdrop-blur-md border-l border-border text-card-foreground text-sm">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <h2 className="font-semibold text-base text-primary flex items-center gap-2">
          <Activity className="w-4 h-4" /> Pipeline Telemetry & Inspector
        </h2>
        <p className="text-xs text-muted-foreground">PostGIS Spatial Analysis & GeoProfile Statistics</p>
      </div>

      {/* Navigation Tabs */}
      <div className="grid grid-cols-4 border-b border-border text-xs font-medium bg-muted/40">
        <button
          onClick={() => setActiveTab("stats")}
          className={`py-2.5 px-2 text-center border-b-2 transition-all ${
            activeTab === "stats"
              ? "border-primary text-primary bg-primary/5 font-semibold"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Stats
        </button>
        <button
          onClick={() => setActiveTab("geoprofile")}
          className={`py-2.5 px-2 text-center border-b-2 transition-all ${
            activeTab === "geoprofile"
              ? "border-primary text-primary bg-primary/5 font-semibold"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          GeoProfile
        </button>
        <button
          onClick={() => setActiveTab("resources")}
          className={`py-2.5 px-2 text-center border-b-2 transition-all ${
            activeTab === "resources"
              ? "border-primary text-primary bg-primary/5 font-semibold"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Resources
        </button>
        <button
          onClick={() => setActiveTab("logs")}
          className={`py-2.5 px-2 text-center border-b-2 transition-all ${
            activeTab === "logs"
              ? "border-primary text-primary bg-primary/5 font-semibold"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Logs
        </button>
      </div>

      {/* Country Selection Dropdown */}
      {(activeTab === "geoprofile" || activeTab === "resources") && (
        <div className="p-3 border-b border-border bg-background/30">
          <label className="text-[11px] text-muted-foreground block mb-1">Target Nation Inspector</label>
          <select
            value={selectedCountryId}
            onChange={(e) => setSelectedCountryId(e.target.value)}
            className="w-full bg-background border border-input rounded-md px-2.5 py-1.5 text-xs text-foreground"
          >
            {countries.map((c) => (
              <option key={c.featureId} value={c.featureId}>
                {c.name} ({c.featureId})
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {activeTab === "stats" && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-md border border-border bg-background/40">
                <div className="text-[11px] text-muted-foreground">Execution Speed</div>
                <div className="text-lg font-bold text-primary font-mono">{stats.generationTimeMs} ms</div>
              </div>
              <div className="p-3 rounded-md border border-border bg-background/40">
                <div className="text-[11px] text-muted-foreground">Mesh Resolution</div>
                <div className="text-lg font-bold text-foreground font-mono">{stats.cellCount} cells</div>
              </div>
              <div className="p-3 rounded-md border border-border bg-background/40">
                <div className="text-[11px] text-muted-foreground">Nations Generated</div>
                <div className="text-lg font-bold text-emerald-500 font-mono">{stats.countryCount}</div>
              </div>
              <div className="p-3 rounded-md border border-border bg-background/40">
                <div className="text-[11px] text-muted-foreground">Cities Placed</div>
                <div className="text-lg font-bold text-cyan-500 font-mono">{stats.cityCount}</div>
              </div>
              <div className="p-3 rounded-md border border-border bg-background/40">
                <div className="text-[11px] text-muted-foreground">Rivers Traced</div>
                <div className="text-lg font-bold text-blue-500 font-mono">{stats.riverCount}</div>
              </div>
              <div className="p-3 rounded-md border border-border bg-background/40">
                <div className="text-[11px] text-muted-foreground">Shared Vertices</div>
                <div className="text-lg font-bold text-purple-500 font-mono">{stats.sharedVerticesCount}</div>
              </div>
            </div>

            <div className="p-3 rounded-md border border-border bg-background/40 space-y-2">
              <div className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-primary" /> Active 5-Layer Dataset Output
              </div>
              <div className="text-xs text-muted-foreground space-y-1 font-mono">
                <div>• political (Nations)</div>
                <div>• altitudes (9 Elevation Zones)</div>
                <div>• climate (Trewartha Biomes)</div>
                <div>• rivers (Hydrographic Channels)</div>
                <div>• lakes (Waterbody Basins)</div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "geoprofile" && (
          <div className="space-y-4">
            {!activeProfile ? (
              <p className="text-xs text-muted-foreground italic">No GeoProfile data computed for this nation.</p>
            ) : (
              <>
                <div className="p-3 rounded-md border border-border bg-background/40 space-y-2">
                  <div className="font-semibold text-xs text-primary">{activeCountry?.name} GeoProfile</div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-muted-foreground">Arable Land:</span>{" "}
                      <span className="font-mono text-emerald-500 font-medium">{activeProfile.arableLandPercent}%</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Coastline:</span>{" "}
                      <span className="font-mono text-cyan-500 font-medium">{activeProfile.coastlineKm} km</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Landlocked:</span>{" "}
                      <span className="font-mono">{activeProfile.isLandlocked ? "Yes" : "No"}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Island Nation:</span>{" "}
                      <span className="font-mono">{activeProfile.isIsland ? "Yes" : "No"}</span>
                    </div>
                  </div>
                </div>

                <div className="p-3 rounded-md border border-border bg-background/40 space-y-2">
                  <div className="font-semibold text-xs text-foreground">Sim Economy Modifiers</div>
                  <div className="grid grid-cols-3 gap-2 text-xs font-mono text-center">
                    <div className="p-1.5 bg-background rounded border border-border">
                      <div className="text-[10px] text-muted-foreground">GDP</div>
                      <div className="text-emerald-500 font-bold">{activeProfile.gdpModifier}x</div>
                    </div>
                    <div className="p-1.5 bg-background rounded border border-border">
                      <div className="text-[10px] text-muted-foreground">Trade</div>
                      <div className="text-cyan-500 font-bold">{activeProfile.tradeModifier}x</div>
                    </div>
                    <div className="p-1.5 bg-background rounded border border-border">
                      <div className="text-[10px] text-muted-foreground">Infra Cost</div>
                      <div className="text-primary font-bold">{activeProfile.infraCostModifier}x</div>
                    </div>
                  </div>
                </div>

                {/* Climate Breakdown */}
                <div className="p-3 rounded-md border border-border bg-background/40 space-y-2">
                  <div className="font-semibold text-xs text-foreground">Climate Distribution</div>
                  <div className="space-y-1.5 text-xs">
                    {activeProfile.climateDistribution.map((c, i) => (
                      <div key={i} className="flex justify-between items-center text-foreground">
                        <span>{c.name} ({c.type})</span>
                        <span className="font-mono text-primary">{c.percentArea}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {activeTab === "resources" && (
          <div className="space-y-3">
            <div className="text-xs font-semibold text-foreground">
              Procedurally Placed Geographic Resources ({activeResources.length})
            </div>
            {activeResources.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">No resources placed for this nation.</p>
            ) : (
              activeResources.map((res, i) => (
                <div key={i} className="p-2.5 rounded-md border border-border bg-background/40 space-y-1">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-medium text-foreground">{res.name}</span>
                    <span className="px-1.5 py-0.5 rounded text-[10px] bg-primary/10 text-primary font-mono uppercase border border-primary/20">
                      {res.resourceType}
                    </span>
                  </div>
                  <div className="flex justify-between text-[11px] text-muted-foreground font-mono">
                    <span>Qty: {(res.quantity * 100).toFixed(0)}%</span>
                    <span>Quality: {(res.quality * 100).toFixed(0)}%</span>
                    <span>Coords: [{res.coordinates[0].toFixed(2)}, {res.coordinates[1].toFixed(2)}]</span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === "logs" && (
          <div className="p-3 rounded-md border border-border bg-background/80 font-mono text-[11px] text-foreground space-y-1 overflow-x-auto max-h-96">
            {log.length === 0 ? (
              <div className="text-muted-foreground italic">No logs recorded yet. Run map pipeline.</div>
            ) : (
              log.map((line, idx) => (
                <div key={idx} className="whitespace-nowrap">
                  {line}
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
