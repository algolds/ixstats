"use client";

/**
 * CursorTerrainProbe — looks up elevation/climate under the pointer once it
 * rests for 250 ms and publishes the result to the transient store.
 *
 * Renders nothing. It lives in its own component so the debounced cursor state
 * and the `getPointInfo` query re-render only this leaf, never the editor tree.
 */

import { useEffect, useState } from "react";
import { api } from "~/trpc/react";
import { useMapRealm } from "~/components/maps/core/MapRealmContext";
import { transientMapStore } from "~/components/maps/editor/utils/transientStore";

const REST_MS = 250;

export function CursorTerrainProbe() {
  const [restingCoords, setRestingCoords] = useState<[number, number] | null>(null);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    let last = transientMapStore.getSnapshot().cursorCoords;
    const unsubscribe = transientMapStore.subscribe(() => {
      const coords = transientMapStore.getSnapshot().cursorCoords;
      if (coords === last) return;
      last = coords;
      if (timer) clearTimeout(timer);
      if (!coords) {
        timer = null;
        return;
      }
      timer = setTimeout(() => setRestingCoords(coords), REST_MS);
    });
    return () => {
      unsubscribe();
      if (timer) clearTimeout(timer);
    };
  }, []);

  const realm = useMapRealm();
  // Round to ~1 km so tiny pointer jitter hits the query cache instead of the server.
  const lng = restingCoords ? Math.round(restingCoords[0] * 100) / 100 : 0;
  const lat = restingCoords ? Math.round(restingCoords[1] * 100) / 100 : 0;
  const { data } = api.geoCore.getPointInfo.useQuery(
    { lng, lat, realm },
    { enabled: !!restingCoords, staleTime: 5 * 60_000, gcTime: 10 * 60_000 }
  );

  useEffect(() => {
    if (!data) return;
    const elev = data.elevation as { elevationMeters?: number | null } | undefined;
    const clim = data.climate as { color?: string | null } | undefined;
    transientMapStore.setTerrainInfo({
      elevation: data.elevation?.zoneName ?? null,
      elevationMeters: elev?.elevationMeters ?? null,
      climate: data.climate?.climateName ?? null,
      biomeColor: clim?.color ?? null,
    });
  }, [data]);

  return null;
}
