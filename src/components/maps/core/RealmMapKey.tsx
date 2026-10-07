"use client";

import { useEffect, useMemo, useRef, type RefObject } from "react";
import type { Map as MapLibreMap } from "maplibre-gl";
import type { IxWorldMapRef, MapLayerData } from "./IxWorldMap";
import type { useRealmMapDisplay } from "./hooks/useRealmMapDisplay";
import { RealmMapLegend } from "./RealmMapLegend";
import { RealmMapScale } from "./RealmMapScale";
import { RealmMapAttribution } from "./RealmMapAttribution";
import { EARTH_RADIUS_KM } from "~/lib/maps/planet";

type RealmMapDisplay = ReturnType<typeof useRealmMapDisplay>;

/**
 * The bottom-left key of a map: the political legend (realm maps; IxWorld's hundreds of nations would not fit),
 * the realm-radius scale bar with the cursor's coordinates, and the realm's credit line.
 */
export function RealmMapKey({
  display,
  mapLayers,
  map,
  showScale,
}: {
  display: RealmMapDisplay;
  mapLayers: MapLayerData[];
  map: MapLibreMap | null;
  showScale: boolean;
}) {
  const political = useMemo(
    () => mapLayers.find((l) => l.type === "political")?.data ?? null,
    [mapLayers]
  );
  // Rendered into a flex-col-reverse stack: the credit line ends up at the bottom, the legend on top.
  return (
    <>
      <RealmMapAttribution text={display?.attribution} />
      {showScale && <RealmMapScale map={map} radiusKm={display?.radiusKm ?? EARTH_RADIUS_KM} />}
      {display && !display.isIxWorld && (
        <RealmMapLegend political={political} unclaimedCountryIds={display.unclaimedCountryIds} />
      )}
    </>
  );
}

/**
 * Open the realm's map at its default view (`Realm.settings.map.defaultView`) once per realm, unless the page
 * asked for a place itself (`?lat=&lng=`, `?zoom=`, a selected country).
 */
export function useRealmDefaultView(
  mapRef: RefObject<IxWorldMapRef | null>,
  display: RealmMapDisplay,
  { mapReady, explicitView }: { mapReady: boolean; explicitView: boolean }
) {
  const appliedFor = useRef<string | null>(null);
  useEffect(() => {
    if (!mapReady || !display || appliedFor.current === display.realmId) return;
    appliedFor.current = display.realmId;
    const view = display.defaultView;
    if (!view || explicitView) return;
    mapRef.current?.getMap()?.jumpTo({ center: view.center, zoom: view.zoom });
  }, [mapReady, display, explicitView, mapRef]);
}
