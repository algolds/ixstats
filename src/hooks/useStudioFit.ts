"use client";

import { useMemo } from "react";
import { useDecodedMapLayers, useRetryMapLayers } from "~/hooks/useMapLayerData";
import type { LandMaskLayers } from "~/lib/worldgen/land-mask";
import {
  MASK_LAYER_TYPES,
  hasRealmBorders,
  landMaskLayersFrom,
} from "~/lib/worldgen/realm-land-mask";

/**
 * `off`: the world is not fitted to a realm (preset source, or no realm chosen yet). `none`: the realm has no borders
 * to build on. `failed`: a layer could not be loaded.
 */
type StudioFitState = "off" | "loading" | "failed" | "none" | "ready";

export interface StudioFit {
  state: StudioFitState;
  /** The realm's background, political and altitudes layers, the land mask's input; empty until `ready` */
  landMaskLayers: LandMaskLayers;
  /** The realm's map version the layers belong to */
  mapVersion: number | undefined;
  /** `<realm slug>:<mapVersion>`: names the content of `landMaskLayers`, so the worker rasterises them once */
  maskKey: string | undefined;
  retry: () => void;
}

const NO_LAYERS: LandMaskLayers = {};

/**
 * The layers a world is fitted to, loaded from the versioned layer route the way the founder World tab does (the same
 * queries, so nothing downloads twice). "Ready" is every layer settled and the realm having borders, so a map still
 * arriving is never fitted half-loaded. Nothing is requested while `realm` is null.
 */
export function useStudioFit(realm: string | null): StudioFit {
  const loaded = useDecodedMapLayers({
    layers: MASK_LAYER_TYPES,
    realm: realm ?? undefined,
    enabled: realm !== null,
  });
  const retry = useRetryMapLayers();
  const landMaskLayers = useMemo(() => landMaskLayersFrom(loaded.layers), [loaded.layers]);

  return useMemo<StudioFit>(() => {
    const none = { landMaskLayers: NO_LAYERS, mapVersion: undefined, maskKey: undefined, retry };
    if (realm === null) return { ...none, state: "off" };
    if (loaded.error) return { ...none, state: "failed" };
    if (loaded.isPending) return { ...none, state: "loading" };
    const mapVersion = loaded.version;
    if (!hasRealmBorders(landMaskLayers)) return { ...none, state: "none", mapVersion };
    return {
      state: "ready",
      landMaskLayers,
      mapVersion,
      maskKey: mapVersion === undefined ? undefined : `${realm}:${mapVersion}`,
      retry,
    };
  }, [realm, loaded.error, loaded.isPending, loaded.version, landMaskLayers, retry]);
}
