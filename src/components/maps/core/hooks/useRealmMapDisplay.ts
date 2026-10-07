"use client";

import { api } from "~/trpc/react";
import { EARTH_RADIUS_KM, scaleAreaToRadius } from "~/lib/maps/planet";
import { useMapRealm } from "../MapRealmContext";

/**
 * How the realm a map shows (`?realm=`, else the viewer's realm) is displayed: planet radius, default view,
 * base image, credit line, unclaimed nations, and whether the viewer edits its map. Cached for the session; the
 * map settings change rarely.
 */
export function useRealmMapDisplay(realm?: string) {
  const contextRealm = useMapRealm();
  const slug = realm ?? contextRealm;
  return api.realms.map.display.useQuery(slug ? { realm: slug } : undefined, {
    staleTime: 10 * 60_000,
    retry: false,
  }).data;
}

/** The planet radius (km) of the realm a map shows; Earth's until it loads. */
export function useRealmPlanetRadius(realm?: string): number {
  return useRealmMapDisplay(realm)?.radiusKm ?? EARTH_RADIUS_KM;
}

/** "1,234 km²" or "1.23M km²" for an area measured on Earth's radius, shown on the realm's planet. */
export function formatPlanetArea(areaKm2: number, radiusKm: number): string {
  const area = scaleAreaToRadius(areaKm2, radiusKm);
  return area > 1_000_000
    ? `${(area / 1_000_000).toFixed(2)}M km²`
    : `${Math.round(area).toLocaleString()} km²`;
}
