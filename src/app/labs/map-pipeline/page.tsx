"use client";

import React, { useState, useTransition, useMemo } from "react";
import dynamic from "next/dynamic";
import { generateWorld } from "~/lib/worldgen/engine";
import { normalizeAzgaarGraph, type NormalizedMapData } from "~/lib/map-pipeline/azgaar-normalizer";
import { enrichMapDataset, type EnrichedMapPackage } from "~/lib/map-pipeline/enrichment-pipeline";
import { MapPipelineControls, type MapGenConfig } from "~/components/labs/map-pipeline/MapPipelineControls";
import { MapPipelineTelemetry } from "~/components/labs/map-pipeline/MapPipelineTelemetry";

const IxWorldMap = dynamic(() => import("~/components/maps/core/IxWorldMap"), {
  ssr: false,
  loading: () => (
    <div className="absolute inset-0 bg-background flex items-center justify-center text-muted-foreground text-sm">
      Loading MapLibre Viewport...
    </div>
  ),
});

export default function MapPipelineLabPage() {
  const [config, setConfig] = useState<MapGenConfig>({
    seed: 12345,
    cellCount: 1500,
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

  // Territory Claims State
  const [pendingClaims, setPendingClaims] = useState<
    Array<{ id: string; featureId: string; nationName: string; userId: string }>
  >([]);

  // Initial Run / Manual Trigger
  const runPipeline = () => {
    startTransition(() => {
      const t0 = performance.now();
      const world = generateWorld({
        seed: config.seed,
        cellCount: config.cellCount,
        countryCountRange: [config.countryCount, config.countryCount],
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
      runPipeline();
    }
  }, []);

  const handleToggleLayer = (layerId: string) => {
    setActiveLayers((prev) => ({ ...prev, [layerId]: !prev[layerId] }));
  };

  const handleClaimSubmit = (featureId: string, nationName: string) => {
    setPendingClaims((prev) => [
      ...prev,
      {
        id: `claim_${Date.now()}`,
        featureId,
        nationName,
        userId: "user_demo",
      },
    ]);
  };

  const handleReviewClaim = (claimId: string, action: "approve" | "reject") => {
    setPendingClaims((prev) => prev.filter((c) => c.id !== claimId));

    if (action === "approve" && mapData) {
      const claim = pendingClaims.find((c) => c.id === claimId);
      if (claim) {
        // Update feature in political layer
        const updatedCountries = mapData.countries.map((c) =>
          c.featureId === claim.featureId ? { ...c, name: claim.nationName } : c
        );
        setMapData({ ...mapData, countries: updatedCountries });
      }
    }
  };

  // Compute unclaimed nation options for claim tester
  const unclaimedNations = useMemo(() => {
    if (!mapData || !mapData.countries) return [];
    return mapData.countries
      .filter((c) => c && c.featureId)
      .map((c) => ({
        featureId: c.featureId,
        name: c.name || c.featureId,
      }));
  }, [mapData]);

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
    <div className="relative w-full h-screen overflow-hidden bg-background text-foreground flex">
      {/* Left Sidebar: Pipeline Controls & Parameter Sliders */}
      <div className="w-80 shrink-0 h-full z-20">
        <MapPipelineControls
          config={config}
          onChangeConfig={setConfig}
          onGenerate={runPipeline}
          isGenerating={isPending}
          activeLayers={activeLayers}
          onToggleLayer={handleToggleLayer}
          unclaimedNations={unclaimedNations}
          onClaimSubmit={handleClaimSubmit}
          pendingClaims={pendingClaims}
          onReviewClaim={handleReviewClaim}
          projectionMode={projectionMode}
          onChangeProjection={setProjectionMode}
        />
      </div>

      {/* Center Viewport: Interactive MapLibre Renderer */}
      <div className="flex-1 relative h-full bg-background">
        {mapLayersProp.length > 0 ? (
          <IxWorldMap
            layers={mapLayersProp}
            projectionMode={projectionMode}
            showOceanLabels={false}
            className="w-full h-full"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-muted-foreground text-sm">
            No map data generated yet. Click &quot;Run Map Pipeline&quot;.
          </div>
        )}
      </div>

      {/* Right Sidebar: Telemetry & GeoProfile Inspector */}
      <div className="w-96 shrink-0 h-full z-20">
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
