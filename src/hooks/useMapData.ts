"use client";

/**
 * useMapData - Hook for fetching and managing world map layer data.
 *
 * Uses a two-tier cache strategy:
 * 1. IndexedDB (persistent) — survives page refreshes, 24h TTL; per realm, read-only here
 *    (useMapDataBatched writes it)
 * 2. React Query (in-memory) — instant during SPA navigation, 30min stale
 *
 * On first load: check IndexedDB → use as initialData → background refresh from server.
 * On subsequent loads within session: React Query serves from memory instantly.
 */

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { api } from "~/trpc/react";
import { LAYER_CONFIGS, MAP_LAYER_TYPES, type MapLayerType } from "~/lib/maps/map-config";
import type { MapLayerData } from "~/components/maps/core/IxWorldMap";
import type { FeatureCollection } from "geojson";
import { getCachedMapLayers, type MapCacheScope } from "~/lib/maps/map-idb-cache";
import { useViewerRealmId } from "~/hooks/useViewerRealmId";
import { unpackLayers } from "~/lib/maps/geojson-pack";
import { TILED_LAYERS, isTiledLayer } from "~/lib/maps/decorative-tiles";

/** Layers that are always visible and cannot be toggled off */
export const LOCKED_LAYERS: MapLayerType[] = ["background"];

const DEFAULT_VISIBLE: MapLayerType[] = [
  "background",
  "altitudes",
  "political",
  "rivers",
  "lakes",
  "country_labels",
];

/** Layers to pre-fetch on initial load.
 * Climate excluded — lazy-loaded on toggle to save ~2MB on initial bundle. */
const ALL_PREFETCH_LAYERS: MapLayerType[] = [...DEFAULT_VISIBLE];

/** The /maps bundle's layers: what the viewer needs as GeoJSON. Altitudes, rivers, lakes and climate
 * come from vector tiles (`~/lib/maps/decorative-tiles`). Shared with useMapDataBatched so
 * useMapPrefetch fills the exact bundle key /maps reads first. */
export const CRITICAL_LAYERS: MapLayerType[] = [
  "background",
  "political",
  "country_labels",
  "icecaps",
];

/** Shared query options for map data - long cache, no refetching */
export const MAP_QUERY_OPTIONS = {
  staleTime: 30 * 60 * 1000, // 30 min - map data rarely changes
  gcTime: 2 * 60 * 60 * 1000, // 2 hours - keep in cache long after unmount
  refetchOnWindowFocus: false,
  refetchOnMount: false,
  refetchOnReconnect: false,
} as const;

/** Merge per-layer `getWorldMap*` results into one record (undefined until any arrives). */
export function mergeLayerResults<T>(
  results: ReadonlyArray<{ data?: Record<string, T> }>
): Record<string, T> | undefined {
  let merged: Record<string, T> | undefined;
  for (const r of results) {
    if (r.data) merged = { ...merged, ...r.data };
  }
  return merged;
}

const EMPTY_COLLECTION: FeatureCollection = { type: "FeatureCollection", features: [] };

/**
 * @param realm realm slug the map shows (`?realm=`); undefined = the viewer's realm
 * @param options.deferTiled hold back the GeoJSON of the vector-tiled layers (altitudes, rivers,
 *   lakes): the editor draws them from tiles and needs their GeoJSON only for snapping, so it loads
 *   once the editor has painted
 */
export function useMapData(
  initialLayers?: MapLayerType[],
  realm?: string,
  { deferTiled = false }: { deferTiled?: boolean } = {}
) {
  const [visibleLayers, setVisibleLayers] = useState<Set<MapLayerType>>(
    () => new Set(initialLayers ?? DEFAULT_VISIBLE)
  );

  // IndexedDB cached data for the realm this map shows (only in browser, once that realm is known).
  // Read-only here: getWorldMap doesn't report the realm it resolved, so only useMapDataBatched —
  // whose bundle does — writes entries.
  const viewerRealmId = useViewerRealmId();
  const cacheScope = useMemo<MapCacheScope>(
    () => ({ realm, viewerRealmId }),
    [realm, viewerRealmId]
  );
  const [idbData, setIdbData] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    let cancelled = false;
    setIdbData(null);
    getCachedMapLayers(cacheScope).then((cached) => {
      if (cached && !cancelled) setIdbData(cached);
    });
    return () => {
      cancelled = true;
    };
  }, [cacheScope]);

  const allRequestedLayers = useMemo(() => {
    const layers = new Set([...ALL_PREFETCH_LAYERS, ...visibleLayers]);
    return Array.from(layers).filter((layer) => !(deferTiled && isTiledLayer(layer)));
  }, [visibleLayers, deferTiled]);

  // One query per layer (the same keys /maps uses), so switching a layer on fetches only that
  // layer instead of every visible layer again under a new combined key.
  const layerData = api.useQueries(
    (t) =>
      allRequestedLayers.map((layer) =>
        t.geoCore.getWorldMapPacked({ layers: [layer], realm }, { ...MAP_QUERY_OPTIONS })
      ),
    { combine: mergeLayerResults }
  );

  // Server layers over the IndexedDB cache, which fills in whatever hasn't arrived yet. Tiled
  // layers are listed (empty) until their GeoJSON arrives, so their visibility still applies.
  const effectiveData = useMemo(() => {
    const merged: Record<string, unknown> = {
      ...idbData,
      ...(layerData && unpackLayers(layerData)),
    };
    for (const type of TILED_LAYERS) merged[type] ??= EMPTY_COLLECTION;
    return merged;
  }, [idbData, layerData]);

  // Transform tRPC data into MapLayerData format
  const mapLayers: MapLayerData[] = useMemo(() => {
    return Object.entries(effectiveData)
      .filter(
        ([type]) =>
          MAP_LAYER_TYPES.includes(type as MapLayerType) && LAYER_CONFIGS[type as MapLayerType]
      )
      .map(([type, data]) => ({
        type: type as MapLayerType,
        data: data as FeatureCollection,
        visible: visibleLayers.has(type as MapLayerType),
      }))
      .sort((a, b) => (LAYER_CONFIGS[a.type]?.zIndex ?? 0) - (LAYER_CONFIGS[b.type]?.zIndex ?? 0));
  }, [effectiveData, visibleLayers]);

  const toggleLayer = useCallback((layer: MapLayerType) => {
    // Locked layers cannot be toggled off
    if (LOCKED_LAYERS.includes(layer)) return;
    setVisibleLayers((prev) => {
      const next = new Set(prev);
      if (next.has(layer)) {
        next.delete(layer);
      } else {
        next.add(layer);
      }
      return next;
    });
  }, []);

  return {
    mapLayers,
    visibleLayers,
    toggleLayer,
  };
}

/**
 * Eagerly prefetch essential map + country data into the React Query cache.
 * Mount via MapPrefetcher (only on map-related pages).
 *
 * After the political layer resolves, fires bulk requests for:
 * 1. Map summaries (single DB query, ~50ms)
 * 2. Rich wiki intros (1 API call/country, throttled chunks)
 *
 * Heavier data (page images, infoboxes, section previews) loads on-demand
 * when a country is clicked to avoid overwhelming the wiki API (~300+ calls).
 */
export function useMapPrefetch() {
  const utils = api.useUtils();
  const warmedRef = useRef(false);

  // Same key useMapDataBatched requests first (zoom omitted = undefined), so /maps reads this entry.
  const { data: bundle } = api.geoCore.getMapBundle.useQuery(
    { layers: CRITICAL_LAYERS },
    { ...MAP_QUERY_OPTIONS, enabled: !warmedRef.current }
  );
  const worldMap = bundle?.worldMap;

  // After political layer is available, warm ALL per-country data

  useEffect(() => {
    if (warmedRef.current || !worldMap) return;
    warmedRef.current = true;

    // Only properties are read here, so the packed geometry needs no decoding
    const political = worldMap.political;
    if (!political?.features) return;

    // Extract unique countries from the political layer
    const countries: Array<{ name: string; id: string | null }> = [];
    const seen = new Set<string>();
    for (const f of political.features) {
      const name = f.properties?._displayName as string | undefined;
      const id = f.properties?._countryId as string | null | undefined;
      if (name && !seen.has(name)) {
        seen.add(name);
        countries.push({ name, id: id ?? null });
      }
    }

    // The panel's intro query key: the id reads a country's own wiki page.
    const wikiCountries = countries.map((c) => ({
      countryName: c.name,
      countryId: c.id ?? undefined,
    }));
    const countryIds = countries.filter((c) => c.id).map((c) => c.id!);
    const wikiOpts = { staleTime: 24 * 60 * 60_000 }; // 24hr — wiki data is static, matches individual query staleTime

    // Defer the warm-up until the browser is idle so it doesn't compete with the map's own
    // first render (worker tiling, style load) for the network and main thread.
    const warm = () => {
      // 1. Bulk map summaries (single DB query)
      void (async () => {
        try {
          const bulkSummaries = await utils.countries.getBulkMapSummaries.fetch(
            { countryIds },
            wikiOpts
          );
          if (bulkSummaries) {
            for (const [id, summary] of Object.entries(bulkSummaries)) {
              utils.countries.getMapSummary.setData({ countryId: id }, summary);
            }
          }
        } catch {
          /* summaries will load on click instead */
        }
      })();

      // 2. Bulk rich wiki intros (map panel + /countries/[slug] page)
      // Throttled: 20 countries per chunk with 500ms delay between chunks
      // to stay well within nginx rate limit (burst=30).
      void (async () => {
        try {
          for (let i = 0; i < wikiCountries.length; i += 20) {
            if (i > 0) await new Promise((r) => setTimeout(r, 500));
            const chunk = wikiCountries.slice(i, i + 20);
            const bulk = await utils.countries.getBulkWikiRichIntros.fetch(
              { countries: chunk },
              wikiOpts
            );
            if (bulk) {
              for (const key of chunk) {
                const data = bulk[key.countryName];
                if (data !== undefined) utils.countries.getWikiRichIntro.setData(key, data);
              }
            }
          }
        } catch {
          /* rich intros will load on click instead */
        }
      })();
    };
    if (typeof window !== "undefined" && "requestIdleCallback" in window) {
      window.requestIdleCallback(warm, { timeout: 4000 });
    } else {
      setTimeout(warm, 1500);
    }

    // NOTE: Page images, infoboxes, and section previews load on-demand
    // when a country is clicked. Bulk prefetching them caused 429 errors
    // (300+ sequential wiki API calls overwhelming the rate limit).
  }, [worldMap, utils]);
}
