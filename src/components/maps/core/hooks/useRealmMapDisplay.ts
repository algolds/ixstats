"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { api } from "~/trpc/react";
import { EARTH_RADIUS_KM, scaleAreaToRadius } from "~/lib/maps/planet";
import type { MapLayerType } from "~/lib/maps/map-config";
import type { RealmRasterLayer } from "~/lib/maps/realm-map-settings";
import { useMapRealm } from "../MapRealmContext";
import type { IxWorldMapRef } from "../IxWorldMap";

/**
 * How the realm a map shows (`?realm=`, else the viewer's realm) is displayed: planet radius, default view,
 * base image, credit line, raster art, climate key, and whether the viewer edits its map. Cached for the session;
 * the map settings change rarely.
 */
export function useRealmMapDisplay(realm?: string) {
  const contextRealm = useMapRealm();
  const slug = realm ?? contextRealm;
  return api.realms.map.display.useQuery(slug ? { realm: slug } : undefined, {
    staleTime: 10 * 60_000,
    retry: false,
  }).data;
}

/**
 * Open the realm's map at its default view (`Realm.settings.map.defaultView`) once per realm, unless the page
 * asked for a place itself (`?lat=&lng=`, `?zoom=`, a selected country).
 */
export function useRealmDefaultView(
  mapRef: RefObject<IxWorldMapRef | null>,
  display: ReturnType<typeof useRealmMapDisplay>,
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

/** Which of a realm's raster art layers are switched on: one base map (or none) and any overlays. */
export interface RasterSelection {
  base: string | null;
  overlays: readonly string[];
}

/** What a map opens with: no base map and no overlays, so it shows the standard IxWorld style. */
const NOTHING_SHOWN: RasterSelection = { base: null, overlays: [] };

/** The layers `selection` switches on, in drawing order (as `layers` lists them). */
export function shownRasterLayers(
  layers: readonly RealmRasterLayer[],
  selection: RasterSelection
): RealmRasterLayer[] {
  return layers.filter((l) =>
    l.kind === "base" ? l.id === selection.base : selection.overlays.includes(l.id)
  );
}

const NO_RASTER_LAYERS: readonly RealmRasterLayer[] = [];

/**
 * The raster art switches of the realm a map shows. Each realm opens with none shown (the standard style); a
 * choice lasts while the map stays on that realm. "Art mode" is on while a base map is shown: the art carries
 * names, flags and borders.
 */
export function useRealmRasterSelection(display: ReturnType<typeof useRealmMapDisplay>) {
  const layers = display?.rasterLayers ?? NO_RASTER_LAYERS;
  const realmId = display?.realmId ?? null;
  const [picked, setPicked] = useState<{ realmId: string | null; selection: RasterSelection }>();
  const selection = picked?.realmId === realmId ? picked.selection : NOTHING_SHOWN;

  const setBase = useCallback(
    (base: string | null) => setPicked({ realmId, selection: { ...selection, base } }),
    [realmId, selection]
  );
  const toggleOverlay = useCallback(
    (id: string) => {
      const overlays = selection.overlays.includes(id)
        ? selection.overlays.filter((o) => o !== id)
        : [...selection.overlays, id];
      setPicked({ realmId, selection: { ...selection, overlays } });
    },
    [realmId, selection]
  );
  const shown = useMemo(() => shownRasterLayers(layers, selection), [layers, selection]);
  return {
    layers,
    selection,
    shown,
    artMode: shown.some((l) => l.kind === "base"),
    setBase,
    toggleOverlay,
  };
}

/**
 * Country names are off while a base map is shown (the art has its own) and come back when it is switched off,
 * unless the viewer changed them in between.
 */
export function useArtModeLabels(
  artMode: boolean,
  visibleLayers: ReadonlySet<MapLayerType>,
  toggleLayer: (layer: MapLayerType) => void
) {
  const wasArtMode = useRef(false);
  const hidByArtMode = useRef(false);
  const labelsOn = visibleLayers.has("country_labels");
  useEffect(() => {
    if (artMode === wasArtMode.current) {
      if (labelsOn) hidByArtMode.current = false;
      return;
    }
    wasArtMode.current = artMode;
    if (artMode && labelsOn) {
      hidByArtMode.current = true;
      toggleLayer("country_labels");
    } else if (!artMode && hidByArtMode.current && !labelsOn) {
      hidByArtMode.current = false;
      toggleLayer("country_labels");
    }
  }, [artMode, labelsOn, toggleLayer]);
}
