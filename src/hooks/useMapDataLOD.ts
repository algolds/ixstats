/**
 * Progressive Level of Detail (LOD) Map Data Streamer (Phase 2)
 *
 * Provides a clean LOD tier interface for streaming low-detail overview payloads
 * for low zoom levels (z <= 4) and lazily loading high-detail subdivisions and markers
 * when zoomed in (z >= 5).
 */

import { useMemo } from "react";
import { useMapDataBatched } from "./useMapDataBatched";
import type { MapLayerType } from "~/lib/maps/map-config";

export type LODTier = "overview" | "detailed";

export interface UseMapDataLODOptions {
  currentZoom?: number;
  initialLayers?: MapLayerType[];
}

export function useMapDataLOD({ currentZoom = 3, initialLayers }: UseMapDataLODOptions = {}) {
  // Determine current LOD tier based on zoom threshold (z <= 4 vs z >= 5)
  const lodTier: LODTier = useMemo(() => {
    return currentZoom >= 5 ? "detailed" : "overview";
  }, [currentZoom]);

  // Pass zoom level into batched data hook for tile LOD bucket selection
  const batchedMapData = useMapDataBatched(initialLayers, currentZoom);

  return {
    ...batchedMapData,
    lodTier,
    isOverviewTier: lodTier === "overview",
    isDetailedTier: lodTier === "detailed",
  };
}
