import { useMemo, useState } from "react";
import type { FeatureCollection } from "geojson";
import { api } from "~/trpc/react";
import { IxTime } from "~/lib/ixtime";
import type { MapLayerType } from "~/lib/maps/map-config";
import type { MapLayerData } from "../IxWorldMap";

/**
 * Timeline scrubber state. When the user scrubs to a past IxTime (`null` = "now"), the "as-of"
 * political FeatureCollection replaces the political layer. Until that query returns, the live
 * layer stays so the map doesn't blink.
 */
export function useHistoricalMapLayers(
  mapLayers: MapLayerData[],
  controlledVisibleLayers: Set<MapLayerType> | undefined,
  realm: string | undefined
) {
  const [historicalIxTime, setHistoricalIxTime] = useState<number | null>(null);

  const { data: historicalPolitical } = api.geoCore.getWorldMapAsOf.useQuery(
    { ixTime: historicalIxTime as number, realm },
    {
      enabled: historicalIxTime !== null,
      staleTime: 5 * 60_000,
      gcTime: 30 * 60_000,
    }
  );

  const activeMapLayers = useMemo(() => {
    const swap = historicalIxTime !== null && historicalPolitical;
    if (!controlledVisibleLayers && !swap) return mapLayers;
    return mapLayers.map((layer) => ({
      ...layer,
      ...(controlledVisibleLayers && { visible: controlledVisibleLayers.has(layer.type) }),
      ...(swap && layer.type === "political" && { data: historicalPolitical as FeatureCollection }),
    }));
  }, [mapLayers, controlledVisibleLayers, historicalIxTime, historicalPolitical]);

  return {
    activeMapLayers,
    historicalIxTime,
    setHistoricalIxTime,
    historicalYear: historicalIxTime === null ? null : IxTime.getCurrentGameYear(historicalIxTime),
  };
}
