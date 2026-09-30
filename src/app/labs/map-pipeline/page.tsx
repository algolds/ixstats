"use client";

import React, { useState, useTransition, useMemo } from "react";
import dynamic from "next/dynamic";
import { generateWorld } from "~/lib/worldgen/engine";
import {
  normalizeAzgaarGraph,
  type NormalizedMapData,
} from "~/lib/maps/pipeline/azgaar-normalizer";
import { enrichMapDataset, type EnrichedMapPackage } from "~/lib/maps/pipeline/enrichment-pipeline";
import {
  MapPipelineControls,
  type MapGenConfig,
} from "~/components/maps/pipeline/MapPipelineControls";
import { MapPipelineTelemetry } from "~/components/maps/pipeline/MapPipelineTelemetry";

const IxWorldMap = dynamic(() => import("~/components/maps/core/IxWorldMap"), {
  ssr: false,
  loading: () => (
    <div className="bg-background text-muted-foreground absolute inset-0 flex items-center justify-center text-sm">
      Loading MapLibre Viewport...
    </div>
  ),
});

export default function MapPipelineLabPage() {
  const [config, setConfig] = useState<MapGenConfig>({
    seed: 12345,
    cellCount: 100000,
    countryCount: 12,
    landCoverage: 35,
  });

  const [isPending, startTransition] = useTransition();

  // Active Map Data State
  const [mapData, setMapData] = useState<NormalizedMapData | null>(null);
  const [enrichedPackage, setEnrichedPackage] = useState<EnrichedMapPackage | null>(null);
  const [generationTimeMs, setGenerationTimeMs] = useState<number>(0);

  // Active Layer Toggles
  const [activeLayers, setActiveLayers] = useState<Record<string, boolean>>({
    political: true,
    altitudes: true,
    rivers: true,
    lakes: true,
    climate: false,
  });

  // Active Projection Mode
  const [projectionMode, setProjectionMode] = useState<"dynamic" | "globe" | "mercator">("globe");

  // Initial Run / Manual Trigger
  const runPipeline = () => {
    startTransition(() => {
      const t0 = performance.now();
      const world = generateWorld({
        seed: config.seed,
        cellCount: config.cellCount,
        countryCountRange: [config.countryCount, config.countryCount],
        oceanPercentage: 1 - config.landCoverage / 100,
      });

      if (!world.graph) return;

      const normalized = normalizeAzgaarGraph(world.graph, config.seed);
      const enriched = enrichMapDataset(normalized.layers, normalized.countries, "lab_realm");
      const elapsed = Math.round(performance.now() - t0);

      setMapData(normalized);
      setEnrichedPackage(enriched);
      setGenerationTimeMs(elapsed);
    });
  };

  // Run initial pipeline on load if not generated
  React.useEffect(() => {
    if (!mapData) {
      // oxlint-disable-next-line
      runPipeline();
    }
    // oxlint-disable-next-line
  }, []);

  const handleToggleLayer = (layerId: string) => {
    setActiveLayers((prev) => ({ ...prev, [layerId]: !prev[layerId] }));
  };

  // Compute formatted MapLayers array to pass to IxWorldMap
  const mapLayersProp = useMemo(() => {
    if (!mapData) return [];
    return Object.entries(mapData.layers)
      .filter(([layerId]) => activeLayers[layerId])
      .map(([layerId, collection]) => ({
        type: layerId as any,
        data: collection,
        visible: true,
      }));
  }, [mapData, activeLayers]);

  return (
    <div className="bg-background text-foreground relative flex h-screen w-full overflow-hidden">
      {/* Left Sidebar: Pipeline Controls & Parameter Sliders */}
      <div className="z-20 h-full w-80 shrink-0">
        <MapPipelineControls
          config={config}
          onChangeConfig={setConfig}
          onGenerate={runPipeline}
          isGenerating={isPending}
          activeLayers={activeLayers}
          onToggleLayer={handleToggleLayer}
          projectionMode={projectionMode}
          onChangeProjection={setProjectionMode}
        />
      </div>

      {/* Center Viewport: Interactive MapLibre Renderer */}
      <div className="bg-background relative h-full flex-1">
        {mapLayersProp.length > 0 ? (
          <IxWorldMap
            layers={mapLayersProp}
            projectionMode={projectionMode}
            showOceanLabels={false}
            className="h-full w-full"
          />
        ) : (
          <div className="text-muted-foreground absolute inset-0 flex items-center justify-center text-sm">
            No map data generated yet. Click &quot;Run Map Pipeline&quot;.
          </div>
        )}
      </div>

      {/* Right Sidebar: Telemetry & GeoProfile Inspector */}
      <div className="z-20 h-full w-96 shrink-0">
        <MapPipelineTelemetry
          stats={{
            generationTimeMs,
            cellCount: config.cellCount,
            countryCount: mapData?.countries.length || 0,
            cityCount: mapData?.cities.length || 0,
            riverCount: mapData?.rivers.length || 0,
            sharedVerticesCount: enrichedPackage?.sharedVertices.length || 0,
          }}
          countries={mapData?.countries || []}
          geoProfiles={enrichedPackage?.geoProfiles || []}
          resources={enrichedPackage?.resources || []}
          log={enrichedPackage?.log || []}
        />
      </div>
    </div>
  );
}
