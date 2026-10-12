"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
  type RefObject,
} from "react";
import { api } from "~/trpc/react";
import { EARTH_RADIUS_KM, scaleAreaToRadius } from "~/lib/maps/planet";
import type { MapLayerType } from "~/lib/maps/map-config";
import { RELIEF_LAYER_ID } from "~/lib/maps/raster-tiles";
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

/** What a map opens with: the standard IxWorld style, no base map, and the realm's relief (if it has one). */
const DEFAULT_SHOWN: RasterSelection = { base: null, overlays: [RELIEF_LAYER_ID] };

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

// The choices live outside any component: the map's layer panel and the editor's Layers panel are separate parts
// of the page (the editor is sometimes above the map, sometimes below it) and must show one set of switches.
const choices = new Map<string, RasterSelection>();
const listeners = new Set<() => void>();

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

const chosenFor = (realmId: string | null): RasterSelection =>
  (realmId && choices.get(realmId)) || DEFAULT_SHOWN;

function choose(realmId: string | null, change: (current: RasterSelection) => RasterSelection) {
  if (!realmId) return;
  choices.set(realmId, change(chosenFor(realmId)));
  for (const listener of listeners) listener();
}

/**
 * The raster art switches of the realm a map shows. Each realm opens with no base map and its relief shown; a
 * choice lasts for the session, for everything that shows the realm's switches. "Art mode" is on while a base map
 * is shown: the art carries names, flags and borders.
 */
export function useRealmRasterSelection(display: ReturnType<typeof useRealmMapDisplay>) {
  const layers = display?.rasterLayers ?? NO_RASTER_LAYERS;
  const realmId = display?.realmId ?? null;
  const selection = useSyncExternalStore(
    subscribe,
    () => chosenFor(realmId),
    () => DEFAULT_SHOWN
  );

  const setBase = useCallback(
    (base: string | null) => choose(realmId, (current) => ({ ...current, base })),
    [realmId]
  );
  const toggleOverlay = useCallback(
    (id: string) =>
      choose(realmId, (current) => ({
        ...current,
        overlays: current.overlays.includes(id)
          ? current.overlays.filter((o) => o !== id)
          : [...current.overlays, id],
      })),
    [realmId]
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

/** The relief overlay's switch (the editor's Layers panel row): whether the realm has relief, whether it is shown. */
export function useRealmRelief(display: ReturnType<typeof useRealmMapDisplay>) {
  const { layers, selection, toggleOverlay } = useRealmRasterSelection(display);
  const toggle = useCallback(() => toggleOverlay(RELIEF_LAYER_ID), [toggleOverlay]);
  return {
    available: layers.some((l) => l.id === RELIEF_LAYER_ID),
    shown: selection.overlays.includes(RELIEF_LAYER_ID),
    toggle,
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
