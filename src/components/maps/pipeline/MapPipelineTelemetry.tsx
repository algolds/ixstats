"use client";

import { useState, type ReactNode } from "react";
import { Activity, Component as Layers } from "iconoir-react";
import type { NormalizedCountryPayload } from "~/lib/maps/pipeline/azgaar-normalizer";
import { OptionSelect } from "~/components/maps/shared/OptionSelect";
import { SegmentedControl } from "~/components/ui/segmented-control";
import { Badge } from "~/components/ui/badge";
import type {
  GeoProfilePayload,
  ResourcePlacementPayload,
} from "~/lib/maps/pipeline/enrichment-pipeline";

interface PipelineStats {
  generationTimeMs: number;
  cellCount: number;
  countryCount: number;
  cityCount: number;
  riverCount: number;
  sharedVerticesCount: number;
}

interface MapPipelineTelemetryProps {
  stats: PipelineStats;
  countries: NormalizedCountryPayload[];
  geoProfiles: GeoProfilePayload[];
  resources: ResourcePlacementPayload[];
  log: string[];
}

const TABS = [
  { value: "stats", label: "Stats" },
  { value: "geoprofile", label: "GeoProfile" },
  { value: "resources", label: "Resources" },
  { value: "logs", label: "Logs" },
] as const;

type Tab = (typeof TABS)[number]["value"];

const DATASET_LAYERS = [
  "political (Nations)",
  "altitudes (9 Elevation Zones)",
  "climate (Trewartha Biomes)",
  "rivers (Hydrographic Channels)",
  "lakes (Waterbody Basins)",
];

const BOX = "border-separator bg-surface rounded-control-sm border";

const Box = ({ className = "p-3", children }: { className?: string; children: ReactNode }) => (
  <div className={`${BOX} ${className}`}>{children}</div>
);

const Empty = ({ children }: { children: ReactNode }) => (
  <p className="text-label-secondary text-footnote italic">{children}</p>
);

/** GeoProfiles and resources are placeholder values, not computed from the map (AT-9). */
const SampleNote = () => (
  <p className="text-label-secondary text-footnote flex items-center gap-2">
    <Badge variant="warning">Sample data</Badge>
    Placeholder values, not computed from this map.
  </p>
);

function StatsTab({ stats }: { stats: PipelineStats }) {
  const tiles = [
    ["Execution speed", `${stats.generationTimeMs} ms`, "text-tint"],
    ["Mesh resolution", `${stats.cellCount} cells`, "text-label"],
    ["Nations generated", stats.countryCount, "text-green"],
    ["Cities placed", stats.cityCount, "text-cyan"],
    ["Rivers traced", stats.riverCount, "text-blue"],
    ["Shared vertices", stats.sharedVerticesCount, "text-indigo"],
  ] as const;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        {tiles.map(([label, value, color]) => (
          <Box key={label}>
            <div className="text-label-secondary text-footnote">{label}</div>
            <div className={`${color} text-title-3 tabular-nums`}>{value}</div>
          </Box>
        ))}
      </div>

      <Box className="space-y-2 p-3">
        <div className="text-label text-caption flex items-center gap-2 font-semibold">
          <Layers className="text-tint h-3.5 w-3.5" /> Active 5-Layer Dataset Output
        </div>
        <div className="text-label-secondary text-footnote space-y-1 tabular-nums">
          {DATASET_LAYERS.map((layer) => (
            <div key={layer}>• {layer}</div>
          ))}
        </div>
      </Box>
    </div>
  );
}

function GeoProfileTab({
  profile,
  countryName,
}: {
  profile: GeoProfilePayload | undefined;
  countryName: string | undefined;
}) {
  if (!profile) return <Empty>No GeoProfile data computed for this nation.</Empty>;

  const facts = [
    ["Arable Land:", `${profile.arableLandPercent}%`, "text-green font-medium"],
    ["Coastline:", `${profile.coastlineKm} km`, "text-cyan font-medium"],
    ["Landlocked:", profile.isLandlocked ? "Yes" : "No", ""],
    ["Island Nation:", profile.isIsland ? "Yes" : "No", ""],
  ];
  const modifiers = [
    ["GDP", profile.gdpModifier, "text-green"],
    ["Trade", profile.tradeModifier, "text-cyan"],
    ["Infra cost", profile.infraCostModifier, "text-tint"],
  ];

  return (
    <div className="space-y-4">
      <SampleNote />
      <Box className="space-y-2 p-3">
        <div className="text-tint text-caption font-semibold">{countryName} GeoProfile</div>
        <div className="text-footnote grid grid-cols-2 gap-2">
          {facts.map(([label, value, color]) => (
            <div key={label}>
              <span className="text-label-secondary">{label}</span>{" "}
              <span className={`${color} tabular-nums`}>{value}</span>
            </div>
          ))}
        </div>
      </Box>

      <Box className="space-y-2 p-3">
        <div className="text-label text-caption font-semibold">Sim economy modifiers</div>
        <div className="text-footnote grid grid-cols-3 gap-2 text-center tabular-nums">
          {modifiers.map(([label, value, color]) => (
            <Box key={label} className="p-2">
              <div className="text-label-secondary text-footnote">{label}</div>
              <div className={`${color} font-semibold`}>{value}x</div>
            </Box>
          ))}
        </div>
      </Box>

      <Box className="space-y-2 p-3">
        <div className="text-label text-caption font-semibold">Climate distribution</div>
        <div className="text-footnote space-y-2">
          {profile.climateDistribution.map((c, i) => (
            <div key={i} className="text-label flex items-center justify-between">
              <span>
                {c.name} ({c.type})
              </span>
              <span className="text-tint tabular-nums">{c.percentArea}%</span>
            </div>
          ))}
        </div>
      </Box>
    </div>
  );
}

function ResourcesTab({ resources }: { resources: ResourcePlacementPayload[] }) {
  return (
    <div className="space-y-3">
      <div className="text-label text-caption font-semibold">
        Procedurally Placed Geographic Resources ({resources.length})
      </div>
      <SampleNote />
      {resources.length === 0 ? (
        <Empty>No resources placed for this nation.</Empty>
      ) : (
        resources.map((res, i) => (
          <Box key={i} className="space-y-1 p-2">
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
          </Box>
        ))
      )}
    </div>
  );
}

export function MapPipelineTelemetry({
  stats,
  countries,
  geoProfiles,
  resources,
  log,
}: MapPipelineTelemetryProps) {
  const [selectedCountryId, setSelectedCountryId] = useState(countries[0]?.featureId ?? "");
  const [activeTab, setActiveTab] = useState<Tab>("stats");

  // Falls back to the first nation when the selection is no longer in the list.
  const activeCountry = countries.find((c) => c.featureId === selectedCountryId) ?? countries[0];
  const featureId = activeCountry?.featureId;
  const activeProfile = geoProfiles.find((p) => p.countryFeatureId === featureId);
  const activeResources = activeCountry
    ? resources.filter((r) => r.countryFeatureId === featureId)
    : [];

  return (
    <div className="bg-surface border-separator text-label text-body flex h-full flex-col border-l">
      <div className="border-separator border-b p-4">
        <h2 className="text-tint text-title-3 flex items-center gap-2">
          <Activity className="h-4 w-4" /> Pipeline telemetry & inspector
        </h2>
        <p className="text-label-secondary text-footnote">
          PostGIS Spatial Analysis & GeoProfile Statistics
        </p>
      </div>

      <div className="border-separator border-b p-2">
        <SegmentedControl
          aria-label="Telemetry section"
          asTabs
          fullWidth
          size="sm"
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as Tab)}
          options={[...TABS]}
        />
      </div>

      {(activeTab === "geoprofile" || activeTab === "resources") && (
        <div className="border-separator bg-surface border-b p-3">
          <label className="text-label-secondary text-footnote mb-1 block">
            Target nation inspector
          </label>
          <OptionSelect
            aria-label="Country"
            value={featureId ?? ""}
            onValueChange={setSelectedCountryId}
            options={countries.map((c) => ({
              value: c.featureId,
              label: `${c.name} (${c.featureId})`,
            }))}
          />
        </div>
      )}

      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        {activeTab === "stats" && <StatsTab stats={stats} />}
        {activeTab === "geoprofile" && (
          <GeoProfileTab profile={activeProfile} countryName={activeCountry?.name} />
        )}
        {activeTab === "resources" && <ResourcesTab resources={activeResources} />}
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
