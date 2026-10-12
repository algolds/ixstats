"use client";

/**
 * useMapLayerData - the map's geometry layers, downloaded as packed JSON from the versioned layer route
 * (`/api/map-layers/<realm>/<version>/<layer>?bucket=&format=`). The URL names the realm's map version
 * (`useRealmMapVersion`) and the loader format of this build (`layer-format.ts`), so a changed map or build is a new
 * URL and an unchanged one is the browser's cached copy: a second load downloads nothing. React Query keeps a URL's
 * response while its version is the current one (it never goes stale; the version moves the key instead) and drops
 * the realm's older versions once the version moves, so a long editing session does not pile up old maps.
 */

import { useCallback, useEffect, useMemo, useRef } from "react";
import { useQueries, useQueryClient } from "@tanstack/react-query";
import type { FeatureCollection } from "geojson";
import { withBasePath } from "~/lib/base-path";
import { api } from "~/trpc/react";
import { unpackLayers, type PackedFeatureCollection } from "~/lib/maps/geojson-pack";
import { LAYER_FORMAT_VERSION } from "~/lib/maps/layer-format";
import { dropLegacyMapCache } from "~/lib/maps/legacy-map-cache";
import type { MapLayerType } from "~/lib/maps/map-config";
import { dropStaleLayerQueries, MAP_LAYER_QUERY_KEY } from "~/lib/maps/stale-map-queries";
import { useRealmMapVersion } from "~/hooks/useRealmMapVersion";

/** The layer's level of detail: 0 globe, 1 mid (below zoom 7), 2 detail. */
export type MapLayerBucket = 0 | 1 | 2;

function mapLayerUrl(
  realmId: string,
  version: number,
  layer: MapLayerType,
  bucket: MapLayerBucket
): string {
  return withBasePath(
    `/api/map-layers/${encodeURIComponent(realmId)}/${version}/${layer}?bucket=${bucket}&format=${LAYER_FORMAT_VERSION}`
  );
}

interface LoadedLayer {
  layer: MapLayerType;
  packed: PackedFeatureCollection;
}

/** A layer request the server answered with an error. */
class LayerLoadError extends Error {
  constructor(
    layer: MapLayerType,
    readonly status: number
  ) {
    super(`Map layer ${layer} could not be loaded (${status})`);
  }
}

/** Retry a layer that failed, twice, unless the server refused it (4xx, such as 403/404): asking again changes nothing. */
function retryLayer(failureCount: number, error: Error): boolean {
  if (error instanceof LayerLoadError && error.status >= 400 && error.status < 500) return false;
  return failureCount < 2;
}

async function fetchLayer(
  url: string,
  layer: MapLayerType,
  signal: AbortSignal
): Promise<LoadedLayer> {
  const res = await fetch(url, { signal });
  if (!res.ok) throw new LayerLoadError(layer, res.status);
  return { layer, packed: (await res.json()) as PackedFeatureCollection };
}

interface Combined {
  packed: Packed | undefined;
  error: Error | null;
  /** True until every layer has answered (data or error). */
  pending: boolean;
}

type LayerResult = { data?: LoadedLayer; error: Error | null; isPending: boolean };

// Module-level, so its identity is stable and React Query reuses the combined result until a layer changes.
function combineLayers(results: LayerResult[]): Combined {
  let packed: Packed | undefined;
  for (const { data } of results) {
    if (data) packed = { ...packed, [data.layer]: data.packed };
  }
  return {
    packed,
    error: results.find((r) => r.error)?.error ?? null,
    pending: results.some((r) => r.isPending),
  };
}

interface UseMapLayerDataOptions {
  layers: readonly MapLayerType[];
  /** Realm slug the map shows (`?realm=`); undefined = the viewer's realm. */
  realm?: string;
  bucket?: MapLayerBucket;
  /** False holds every request back (an embed scrolled out of view). */
  enabled?: boolean;
}

type Packed = Record<string, PackedFeatureCollection>;

/**
 * The layers in the packed wire format, keyed by layer type, as they arrive. When the map version moves, each
 * layer keeps showing the data it had until its new URL answers, so the map never blanks.
 */
export function useMapLayerData({
  layers,
  realm,
  bucket = 1,
  enabled = true,
}: UseMapLayerDataOptions) {
  const { mapVersion, error: versionError } = useRealmMapVersion(realm, enabled);
  const realmId = mapVersion?.realmId;
  const version = mapVersion?.version;
  const queryClient = useQueryClient();
  useEffect(dropLegacyMapCache, []);
  const combined = useQueries({
    queries: layers.map((layer) => ({
      queryKey: [MAP_LAYER_QUERY_KEY, realmId, version, LAYER_FORMAT_VERSION, layer, bucket],
      queryFn: ({ signal }: { signal: AbortSignal }) =>
        fetchLayer(
          mapLayerUrl(mapVersion!.realmId, mapVersion!.version, layer, bucket),
          layer,
          signal
        ),
      enabled: enabled && !!mapVersion,
      retry: retryLayer,
      staleTime: Infinity,
      gcTime: 2 * 60 * 60_000,
    })),
    combine: combineLayers,
  });

  // The queries of the versions before this one have no observer now (the effect that re-keys them runs first), and
  // the shown ref below keeps their data on screen: drop them, or each save adds ~5 MB to the tab for 2 h.
  useEffect(() => {
    if (realmId !== undefined && version !== undefined) {
      dropStaleLayerQueries(queryClient, realmId, version);
    }
  }, [queryClient, realmId, version]);

  // A new version is a new query with no data of its own (React Query matches queries to observers by key), so the
  // previous version's layers stay on show until the new ones arrive. Only the same realm's: another realm's layers
  // never stand in for this one's, whether it is still loading or has failed.
  const shown = useRef<{ realmId?: string; packed?: Packed }>({});
  const packed = useMemo<Packed | undefined>(() => {
    const previous = shown.current.realmId === realmId ? shown.current.packed : undefined;
    return previous && combined.packed
      ? { ...previous, ...combined.packed }
      : (combined.packed ?? previous);
  }, [combined.packed, realmId]);
  useEffect(() => {
    shown.current = { realmId, packed };
  }, [realmId, packed]);

  return {
    packed,
    error: combined.error ?? versionError,
    isPending: combined.pending || (enabled && !mapVersion),
  };
}

/** `useMapLayerData` with the layers decoded to GeoJSON (each packed layer once). */
export function useDecodedMapLayers(options: UseMapLayerDataOptions) {
  const result = useMapLayerData(options);
  const layers = useMemo<Record<string, FeatureCollection> | undefined>(
    () => (result.packed ? unpackLayers(result.packed) : undefined),
    [result.packed]
  );
  return { ...result, layers };
}

/** Retry after a layer could not load: asks for the map version again and downloads the failed layers again. */
export function useRetryMapLayers() {
  const queryClient = useQueryClient();
  const utils = api.useUtils();
  return useCallback(() => {
    void utils.realms.map.version.invalidate();
    void queryClient.invalidateQueries({ queryKey: [MAP_LAYER_QUERY_KEY] });
  }, [utils, queryClient]);
}
