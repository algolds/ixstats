"use client";

import React, { useState } from "react";
import { Activity, Component as Layers } from "iconoir-react";
import type { NormalizedCountryPayload } from "~/lib/maps/pipeline/azgaar-normalizer";
import { OptionSelect } from "~/components/maps/shared/OptionSelect";
import { SegmentedControl } from "~/components/ui/segmented-control";
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
        // oxlint-disable-next-line
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
    <div className="bg-surface border-separator text-label text-body flex h-full flex-col border-l">
      {/* Header */}
      <div className="border-separator border-b p-4">
        <h2 className="text-tint text-title-3 flex items-center gap-2">
          <Activity className="h-4 w-4" /> Pipeline Telemetry & Inspector
        </h2>
        <p className="text-label-secondary text-footnote">
          PostGIS Spatial Analysis & GeoProfile Statistics
        </p>
      </div>

      {/* Navigation Tabs */}
      <div className="border-separator border-b p-2">
        <SegmentedControl
          aria-label="Telemetry section"
          asTabs
          fullWidth
          size="sm"
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as typeof activeTab)}
          options={[
            { value: "stats", label: "Stats" },
            { value: "geoprofile", label: "GeoProfile" },
            { value: "resources", label: "Resources" },
            { value: "logs", label: "Logs" },
          ]}
        />
      </div>

      {/* Country Selection Dropdown */}
      {(activeTab === "geoprofile" || activeTab === "resources") && (
        <div className="border-separator bg-surface border-b p-3">
          <label className="text-label-secondary text-footnote mb-1 block">
            Target Nation Inspector
          </label>
          <OptionSelect
            aria-label="Country"
            value={selectedCountryId}
            onValueChange={setSelectedCountryId}
            options={countries.map((c) => ({
              value: c.featureId,
              label: `${c.name} (${c.featureId})`,
            }))}
          />
        </div>
      )}

      {/* Content */}
      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        {activeTab === "stats" && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="border-separator bg-surface rounded-control-sm border p-3">
                <div className="text-label-secondary text-footnote">Execution Speed</div>
                <div className="text-tint text-title-3 tabular-nums">
                  {stats.generationTimeMs} ms
                </div>
              </div>
              <div className="border-separator bg-surface rounded-control-sm border p-3">
                <div className="text-label-secondary text-footnote">Mesh Resolution</div>
                <div className="text-label text-title-3 tabular-nums">{stats.cellCount} cells</div>
              </div>
              <div className="border-separator bg-surface rounded-control-sm border p-3">
                <div className="text-label-secondary text-footnote">Nations Generated</div>
                <div className="text-title-3 text-green tabular-nums">{stats.countryCount}</div>
              </div>
              <div className="border-separator bg-surface rounded-control-sm border p-3">
                <div className="text-label-secondary text-footnote">Cities Placed</div>
                <div className="text-title-3 text-cyan tabular-nums">{stats.cityCount}</div>
              </div>
              <div className="border-separator bg-surface rounded-control-sm border p-3">
                <div className="text-label-secondary text-footnote">Rivers Traced</div>
                <div className="text-title-3 text-blue tabular-nums">{stats.riverCount}</div>
              </div>
              <div className="border-separator bg-surface rounded-control-sm border p-3">
                <div className="text-label-secondary text-footnote">Shared Vertices</div>
                <div className="text-title-3 text-indigo tabular-nums">
                  {stats.sharedVerticesCount}
                </div>
              </div>
            </div>

            <div className="border-separator bg-surface rounded-control-sm space-y-2 border p-3">
              <div className="text-label text-caption flex items-center gap-2 font-semibold">
                <Layers className="text-tint h-3.5 w-3.5" /> Active 5-Layer Dataset Output
              </div>
              <div className="text-label-secondary text-footnote space-y-1 tabular-nums">
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
              <p className="text-label-secondary text-footnote italic">
                No GeoProfile data computed for this nation.
              </p>
            ) : (
              <>
                <div className="border-separator bg-surface rounded-control-sm space-y-2 border p-3">
                  <div className="text-tint text-caption font-semibold">
                    {activeCountry?.name} GeoProfile
                  </div>
                  <div className="text-footnote grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-label-secondary">Arable Land:</span>{" "}
                      <span className="text-green font-medium tabular-nums">
                        {activeProfile.arableLandPercent}%
                      </span>
                    </div>
                    <div>
                      <span className="text-label-secondary">Coastline:</span>{" "}
                      <span className="text-cyan font-medium tabular-nums">
                        {activeProfile.coastlineKm} km
                      </span>
                    </div>
                    <div>
                      <span className="text-label-secondary">Landlocked:</span>{" "}
                      <span className="tabular-nums">
                        {activeProfile.isLandlocked ? "Yes" : "No"}
                      </span>
                    </div>
                    <div>
                      <span className="text-label-secondary">Island Nation:</span>{" "}
                      <span className="tabular-nums">{activeProfile.isIsland ? "Yes" : "No"}</span>
                    </div>
                  </div>
                </div>

                <div className="border-separator bg-surface rounded-control-sm space-y-2 border p-3">
                  <div className="text-label text-caption font-semibold">Sim Economy Modifiers</div>
                  <div className="text-footnote grid grid-cols-3 gap-2 text-center tabular-nums">
                    <div className="bg-surface border-separator rounded-control-sm border p-2">
                      <div className="text-label-secondary text-footnote">GDP</div>
                      <div className="text-green font-semibold">{activeProfile.gdpModifier}x</div>
                    </div>
                    <div className="bg-surface border-separator rounded-control-sm border p-2">
                      <div className="text-label-secondary text-footnote">Trade</div>
                      <div className="text-cyan font-semibold">{activeProfile.tradeModifier}x</div>
                    </div>
                    <div className="bg-surface border-separator rounded-control-sm border p-2">
                      <div className="text-label-secondary text-footnote">Infra Cost</div>
                      <div className="text-tint font-semibold">
                        {activeProfile.infraCostModifier}x
                      </div>
                    </div>
                  </div>
                </div>

                {/* Climate Breakdown */}
                <div className="border-separator bg-surface rounded-control-sm space-y-2 border p-3">
                  <div className="text-label text-caption font-semibold">Climate Distribution</div>
                  <div className="text-footnote space-y-2">
                    {activeProfile.climateDistribution.map((c, i) => (
                      <div key={i} className="text-label flex items-center justify-between">
                        <span>
                          {c.name} ({c.type})
                        </span>
                        <span className="text-tint tabular-nums">{c.percentArea}%</span>
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
            <div className="text-label text-caption font-semibold">
              Procedurally Placed Geographic Resources ({activeResources.length})
            </div>
            {activeResources.length === 0 ? (
              <p className="text-label-secondary text-footnote italic">
                No resources placed for this nation.
              </p>
            ) : (
              activeResources.map((res, i) => (
                <div
                  key={i}
                  className="border-separator bg-surface rounded-control-sm space-y-1 border p-2"
                >
                  <div className="text-footnote flex items-center justify-between">
                    <span className="text-label font-medium">{res.name}</span>
                    <span className="bg-tint-fill text-tint border-tint/20 text-eyebrow rounded-control-sm border px-2 py-0.5 tabular-nums">
                      {res.resourceType}
                    </span>
                  </div>
                  <div className="text-label-secondary text-footnote flex justify-between tabular-nums">
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
          <div className="border-separator bg-surface text-label rounded-control-sm text-footnote max-h-96 space-y-1 overflow-x-auto border p-3 tabular-nums">
            {log.length === 0 ? (
              <div className="text-label-secondary italic">
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
