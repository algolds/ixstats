"use client";

/**
 * useMapLayerData - the map's geometry layers, downloaded as packed JSON from the versioned layer route
 * (`/api/map-layers/<realm>/<version>/<layer>?bucket=`). The URL names the realm's map version
 * (`useRealmMapVersion`), so a changed map is a new URL and an unchanged one is the browser's cached copy: a second
 * load downloads nothing. React Query keeps each URL's response for the session (it never goes stale; the version
 * moves the key instead).
 */

import { useCallback, useEffect, useMemo, useRef } from "react";
import { useQueries, useQueryClient } from "@tanstack/react-query";
import type { FeatureCollection } from "geojson";
import { withBasePath } from "~/lib/base-path";
import { api } from "~/trpc/react";
import { unpackLayers, type PackedFeatureCollection } from "~/lib/maps/geojson-pack";
import type { MapLayerType } from "~/lib/maps/map-config";
import { useRealmMapVersion } from "~/hooks/useRealmMapVersion";

/** The layer's level of detail: 0 globe, 1 mid (below zoom 7), 2 detail. */
export type MapLayerBucket = 0 | 1 | 2;

/** Key prefix of every layer query, for invalidating them all. */
export const MAP_LAYER_QUERY_KEY = "map-layer";

export function mapLayerUrl(
  realmId: string,
  version: number,
  layer: MapLayerType,
  bucket: MapLayerBucket
): string {
  return withBasePath(
    `/api/map-layers/${encodeURIComponent(realmId)}/${version}/${layer}?bucket=${bucket}`
  );
}

interface LoadedLayer {
  layer: MapLayerType;
  packed: PackedFeatureCollection;
}

async function fetchLayer(
  url: string,
  layer: MapLayerType,
  signal: AbortSignal
): Promise<LoadedLayer> {
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`Map layer ${layer} could not be loaded (${res.status})`);
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
  const combined = useQueries({
    queries: layers.map((layer) => ({
      queryKey: [MAP_LAYER_QUERY_KEY, mapVersion?.realmId, mapVersion?.version, layer, bucket],
      queryFn: ({ signal }: { signal: AbortSignal }) =>
        fetchLayer(
          mapLayerUrl(mapVersion!.realmId, mapVersion!.version, layer, bucket),
          layer,
          signal
        ),
      enabled: enabled && !!mapVersion,
      staleTime: Infinity,
      gcTime: 2 * 60 * 60_000,
    })),
    combine: combineLayers,
  });

  // A new version is a new query with no data of its own (React Query matches queries to observers by key), so the
  // previous version's layers stay on show until the new ones arrive.
  const shown = useRef<Packed | undefined>(undefined);
  const packed = useMemo<Packed | undefined>(
    () =>
      shown.current && combined.packed
        ? { ...shown.current, ...combined.packed }
        : (combined.packed ?? shown.current),
    [combined.packed]
  );
  useEffect(() => {
    shown.current = packed;
  }, [packed]);

  return {
    packed,
    error: combined.error ?? versionError,
    isPending: combined.pending || (enabled && !mapVersion),
    realmId: mapVersion?.realmId,
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
