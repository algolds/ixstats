"use client";

import React, { useState } from "react";
import { Activity, Layers } from "lucide-react";
import type { NormalizedCountryPayload } from "~/lib/maps/pipeline/azgaar-normalizer";
import type {
  GeoProfilePayload,
  ResourcePlacementPayload,
} from "~/lib/maps/pipeline/enrichment-pipeline";

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
  const [selectedCountryId, setSelectedCountryId] = useState<string>(
    countries?.[0]?.featureId || ""
  );
  const [activeTab, setActiveTab] = useState<"stats" | "geoprofile" | "resources" | "logs">(
    "stats"
  );

  React.useEffect(() => {
    if (countries && countries.length > 0) {
      if (!countries.some((c) => c && c.featureId === selectedCountryId)) {
        setSelectedCountryId(countries[0]!.featureId);
      }
    }
  }, [countries, selectedCountryId]);

  const activeCountry =
    (countries || []).find((c) => c && c.featureId === selectedCountryId) || countries?.[0];
  const activeProfile = activeCountry
    ? (geoProfiles || []).find((p) => p && p.countryFeatureId === activeCountry.featureId)
    : undefined;
  const activeResources = activeCountry
    ? (resources || []).filter((r) => r && r.countryFeatureId === activeCountry.featureId)
    : [];

  return (
    <div className="bg-card/90 border-border text-card-foreground flex h-full flex-col border-l text-sm backdrop-blur-md">
      {/* Header */}
      <div className="border-border border-b p-4">
        <h2 className="text-primary flex items-center gap-2 text-base font-semibold">
          <Activity className="h-4 w-4" /> Pipeline Telemetry & Inspector
        </h2>
        <p className="text-muted-foreground text-xs">
          PostGIS Spatial Analysis & GeoProfile Statistics
        </p>
      </div>

      {/* Navigation Tabs */}
      <div className="border-border bg-muted/40 grid grid-cols-4 border-b text-xs font-medium">
        <button
          onClick={() => setActiveTab("stats")}
          className={`border-b-2 px-2 py-2.5 text-center transition-all ${
            activeTab === "stats"
              ? "border-primary text-primary bg-primary/5 font-semibold"
              : "text-muted-foreground hover:text-foreground border-transparent"
          }`}
        >
          Stats
        </button>
        <button
          onClick={() => setActiveTab("geoprofile")}
          className={`border-b-2 px-2 py-2.5 text-center transition-all ${
            activeTab === "geoprofile"
              ? "border-primary text-primary bg-primary/5 font-semibold"
              : "text-muted-foreground hover:text-foreground border-transparent"
          }`}
        >
          GeoProfile
        </button>
        <button
          onClick={() => setActiveTab("resources")}
          className={`border-b-2 px-2 py-2.5 text-center transition-all ${
            activeTab === "resources"
              ? "border-primary text-primary bg-primary/5 font-semibold"
              : "text-muted-foreground hover:text-foreground border-transparent"
          }`}
        >
          Resources
        </button>
        <button
          onClick={() => setActiveTab("logs")}
          className={`border-b-2 px-2 py-2.5 text-center transition-all ${
            activeTab === "logs"
              ? "border-primary text-primary bg-primary/5 font-semibold"
              : "text-muted-foreground hover:text-foreground border-transparent"
          }`}
        >
          Logs
        </button>
      </div>

      {/* Country Selection Dropdown */}
      {(activeTab === "geoprofile" || activeTab === "resources") && (
        <div className="border-border bg-background/30 border-b p-3">
          <label className="text-muted-foreground mb-1 block text-[11px]">
            Target Nation Inspector
          </label>
          <select
            value={selectedCountryId}
            onChange={(e) => setSelectedCountryId(e.target.value)}
            className="bg-background border-input text-foreground w-full rounded-md border px-2.5 py-1.5 text-xs"
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
      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        {activeTab === "stats" && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="border-border bg-background/40 rounded-md border p-3">
                <div className="text-muted-foreground text-[11px]">Execution Speed</div>
                <div className="text-primary font-mono text-lg font-bold">
                  {stats.generationTimeMs} ms
                </div>
              </div>
              <div className="border-border bg-background/40 rounded-md border p-3">
                <div className="text-muted-foreground text-[11px]">Mesh Resolution</div>
                <div className="text-foreground font-mono text-lg font-bold">
                  {stats.cellCount} cells
                </div>
              </div>
              <div className="border-border bg-background/40 rounded-md border p-3">
                <div className="text-muted-foreground text-[11px]">Nations Generated</div>
                <div className="font-mono text-lg font-bold text-emerald-500">
                  {stats.countryCount}
                </div>
              </div>
              <div className="border-border bg-background/40 rounded-md border p-3">
                <div className="text-muted-foreground text-[11px]">Cities Placed</div>
                <div className="font-mono text-lg font-bold text-cyan-500">{stats.cityCount}</div>
              </div>
              <div className="border-border bg-background/40 rounded-md border p-3">
                <div className="text-muted-foreground text-[11px]">Rivers Traced</div>
                <div className="font-mono text-lg font-bold text-blue-500">{stats.riverCount}</div>
              </div>
              <div className="border-border bg-background/40 rounded-md border p-3">
                <div className="text-muted-foreground text-[11px]">Shared Vertices</div>
                <div className="font-mono text-lg font-bold text-purple-500">
                  {stats.sharedVerticesCount}
                </div>
              </div>
            </div>

            <div className="border-border bg-background/40 space-y-2 rounded-md border p-3">
              <div className="text-foreground flex items-center gap-1.5 text-xs font-semibold">
                <Layers className="text-primary h-3.5 w-3.5" /> Active 5-Layer Dataset Output
              </div>
              <div className="text-muted-foreground space-y-1 font-mono text-xs">
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
              <p className="text-muted-foreground text-xs italic">
                No GeoProfile data computed for this nation.
              </p>
            ) : (
              <>
                <div className="border-border bg-background/40 space-y-2 rounded-md border p-3">
                  <div className="text-primary text-xs font-semibold">
                    {activeCountry?.name} GeoProfile
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-muted-foreground">Arable Land:</span>{" "}
                      <span className="font-mono font-medium text-emerald-500">
                        {activeProfile.arableLandPercent}%
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Coastline:</span>{" "}
                      <span className="font-mono font-medium text-cyan-500">
                        {activeProfile.coastlineKm} km
                      </span>
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

                <div className="border-border bg-background/40 space-y-2 rounded-md border p-3">
                  <div className="text-foreground text-xs font-semibold">Sim Economy Modifiers</div>
                  <div className="grid grid-cols-3 gap-2 text-center font-mono text-xs">
                    <div className="bg-background border-border rounded border p-1.5">
                      <div className="text-muted-foreground text-[10px]">GDP</div>
                      <div className="font-bold text-emerald-500">{activeProfile.gdpModifier}x</div>
                    </div>
                    <div className="bg-background border-border rounded border p-1.5">
                      <div className="text-muted-foreground text-[10px]">Trade</div>
                      <div className="font-bold text-cyan-500">{activeProfile.tradeModifier}x</div>
                    </div>
                    <div className="bg-background border-border rounded border p-1.5">
                      <div className="text-muted-foreground text-[10px]">Infra Cost</div>
                      <div className="text-primary font-bold">
                        {activeProfile.infraCostModifier}x
                      </div>
                    </div>
                  </div>
                </div>

                {/* Climate Breakdown */}
                <div className="border-border bg-background/40 space-y-2 rounded-md border p-3">
                  <div className="text-foreground text-xs font-semibold">Climate Distribution</div>
                  <div className="space-y-1.5 text-xs">
                    {activeProfile.climateDistribution.map((c, i) => (
                      <div key={i} className="text-foreground flex items-center justify-between">
                        <span>
                          {c.name} ({c.type})
                        </span>
                        <span className="text-primary font-mono">{c.percentArea}%</span>
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
            <div className="text-foreground text-xs font-semibold">
              Procedurally Placed Geographic Resources ({activeResources.length})
            </div>
            {activeResources.length === 0 ? (
              <p className="text-muted-foreground text-xs italic">
                No resources placed for this nation.
              </p>
            ) : (
              activeResources.map((res, i) => (
                <div
                  key={i}
                  className="border-border bg-background/40 space-y-1 rounded-md border p-2.5"
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-foreground font-medium">{res.name}</span>
                    <span className="bg-primary/10 text-primary border-primary/20 rounded border px-1.5 py-0.5 font-mono text-[10px] uppercase">
                      {res.resourceType}
                    </span>
                  </div>
                  <div className="text-muted-foreground flex justify-between font-mono text-[11px]">
                    <span>Qty: {(res.quantity * 100).toFixed(0)}%</span>
                    <span>Quality: {(res.quality * 100).toFixed(0)}%</span>
                    <span>
                      Coords: [{res.coordinates[0].toFixed(2)}, {res.coordinates[1].toFixed(2)}]
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === "logs" && (
          <div className="border-border bg-background/80 text-foreground max-h-96 space-y-1 overflow-x-auto rounded-md border p-3 font-mono text-[11px]">
            {log.length === 0 ? (
              <div className="text-muted-foreground italic">
                No logs recorded yet. Run map pipeline.
              </div>
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
