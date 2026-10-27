import { useMemo, useState } from "react";
import type { FeatureCollection } from "geojson";
import { api } from "~/trpc/react";
import { clockTimeAt, realmYear } from "~/lib/realms/nation-time";
import { useTimelineClock } from "./useTimelineClock";
import type { MapLayerType } from "~/lib/maps/map-config";
import type { MapLayerData } from "../IxWorldMap";

/**
 * Timeline scrubber state. When the user scrubs to a past moment (`null` = "now"; real ms, as
 * BorderHistory stamps edits), the "as-of" political FeatureCollection replaces the political
 * layer. Until that query returns, the live layer stays so the map doesn't blink. The scrubbed
 * year is the viewed realm's, on its clock and calendar (null while that clock loads).
 */
export function useHistoricalMapLayers(
  mapLayers: MapLayerData[],
  controlledVisibleLayers: Set<MapLayerType> | undefined,
  realm: string | undefined
) {
  const [historicalIxTime, setHistoricalIxTime] = useState<number | null>(null);
  const clock = useTimelineClock(realm);

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
    historicalYear:
      historicalIxTime === null || !clock
        ? null
        : realmYear(clockTimeAt(clock, historicalIxTime), clock.calendar),
  };
}
