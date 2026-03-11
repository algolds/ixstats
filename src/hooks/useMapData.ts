"use client";

/**
 * useMapData - Hook for fetching and managing world map layer data.
 *
 * Uses a two-tier cache strategy:
 * 1. IndexedDB (persistent) — survives page refreshes, 24h TTL
 * 2. React Query (in-memory) — instant during SPA navigation, 30min stale
 *
 * On first load: check IndexedDB → use as initialData → background refresh from server.
 * On subsequent loads within session: React Query serves from memory instantly.
 */

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { api } from "~/trpc/react";
import {
  LAYER_CONFIGS,
  MAP_LAYER_TYPES,
  type MapLayerType,
} from "~/lib/map-config";
import type { MapLayerData } from "~/components/maps/core/IxWorldMap";
import type { FeatureCollection } from "geojson";
import { getCachedMapLayers, setCachedMapLayers } from "~/lib/map-idb-cache";

/** Layers that are always visible and cannot be toggled off */
export const LOCKED_LAYERS: MapLayerType[] = [
  "background",
  "altitudes",
];

const DEFAULT_VISIBLE: MapLayerType[] = [
  "background",
  "altitudes",
  "political",
  "rivers",
  "lakes",
];

/** All layers we pre-fetch so toggling is instant */
const ALL_PREFETCH_LAYERS: MapLayerType[] = [
  ...DEFAULT_VISIBLE,
  "climate",
  "lakes",
];

/** Shared query options for map data - long cache, no refetching */
export const MAP_QUERY_OPTIONS = {
  staleTime: 30 * 60 * 1000,     // 30 min - map data rarely changes
  gcTime: 2 * 60 * 60 * 1000,    // 2 hours - keep in cache long after unmount
  refetchOnWindowFocus: false,
  refetchOnMount: false,
  refetchOnReconnect: false,
} as const;

export function useMapData(initialLayers?: MapLayerType[]) {
  const [visibleLayers, setVisibleLayers] = useState<Set<MapLayerType>>(
    () => new Set(initialLayers ?? DEFAULT_VISIBLE)
  );

  // IndexedDB cached data (loaded once on mount)
  const [idbData, setIdbData] = useState<Record<string, unknown> | null>(null);
  const idbLoadedRef = useRef(false);

  // Load from IndexedDB on mount (only in browser)
  useEffect(() => {
    if (idbLoadedRef.current) return;
    idbLoadedRef.current = true;
    getCachedMapLayers().then((cached) => {
      if (cached) {
        console.log("[useMapData] Loaded map data from IndexedDB cache");
        setIdbData(cached);
      }
    });
  }, []);

  // Fetch all layers upfront (pre-fetch climate + lakes for instant toggle)
  const allRequestedLayers = useMemo(() => {
    const layers = new Set([...ALL_PREFETCH_LAYERS, ...visibleLayers]);
    return Array.from(layers);
  }, [visibleLayers]);

  const {
    data: layerData,
    isLoading: queryLoading,
    error,
  } = api.geo.getWorldMap.useQuery(
    { layers: allRequestedLayers },
    {
      ...MAP_QUERY_OPTIONS,
      // Use IndexedDB data as placeholder until server responds
      placeholderData: idbData as typeof layerData ?? undefined,
    },
  );

  // Persist fresh server data to IndexedDB
  const persistedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!layerData) return;
    // Only persist once per unique dataset (avoid re-writing on every render)
    const keys = Object.keys(layerData).sort().join(",");
    if (persistedRef.current === keys) return;
    persistedRef.current = keys;
    setCachedMapLayers(layerData as Record<string, unknown>);
    console.log("[useMapData] Persisted map data to IndexedDB cache");
  }, [layerData]);

  // Use server data if available, otherwise IDB cache
  const effectiveData = layerData ?? idbData;
  const isLoading = queryLoading && !effectiveData;

  // Transform tRPC data into MapLayerData format
  const mapLayers: MapLayerData[] = useMemo(() => {
    if (!effectiveData) return [];

    return Object.entries(effectiveData)
      .filter(
        ([type]) =>
          MAP_LAYER_TYPES.includes(type as MapLayerType) &&
          LAYER_CONFIGS[type as MapLayerType]
      )
      .map(([type, data]) => ({
        type: type as MapLayerType,
        data: data as FeatureCollection,
        visible: visibleLayers.has(type as MapLayerType),
      }))
      .sort(
        (a, b) =>
          (LAYER_CONFIGS[a.type]?.zIndex ?? 0) -
          (LAYER_CONFIGS[b.type]?.zIndex ?? 0)
      );
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
    isLoading,
    error,
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

  useEffect(() => {
    // Fire-and-forget prefetch with same cache key as useMapData
    utils.geo.getWorldMap.prefetch(
      { layers: ALL_PREFETCH_LAYERS },
      MAP_QUERY_OPTIONS,
    );
    // Also prefetch overlay features and capital cities (used on map mount)
    utils.geo.getAllMapFeatures.prefetch(
      undefined,
      { staleTime: 10 * 60_000 },
    );
    utils.geo.getCapitalCities.prefetch(
      undefined,
      { staleTime: 30 * 60_000 },
    );
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // After political layer is available, warm ALL per-country data
  const { data: worldMap } = api.geo.getWorldMap.useQuery(
    { layers: ALL_PREFETCH_LAYERS },
    { ...MAP_QUERY_OPTIONS, enabled: !warmedRef.current },
  );

  useEffect(() => {
    if (warmedRef.current || !worldMap) return;
    warmedRef.current = true;

    const political = (worldMap as Record<string, FeatureCollection>).political;
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

    const countryNames = countries.map((c) => c.name);
    const countryIds = countries.filter((c) => c.id).map((c) => c.id!);
    const wikiOpts = { staleTime: 24 * 60 * 60_000 }; // 24hr — wiki data is static, matches individual query staleTime

    // ── 1. Bulk map summaries (single DB query) ──
    void (async () => {
      try {
        const bulkSummaries = await utils.countries.getBulkMapSummaries.fetch(
          { countryIds },
          wikiOpts,
        );
        if (bulkSummaries) {
          for (const [id, summary] of Object.entries(bulkSummaries)) {
            utils.countries.getMapSummary.setData({ countryId: id }, summary);
          }
        }
      } catch { /* summaries will load on click instead */ }
    })();

    // ── 2. Bulk rich wiki intros (map panel + /countries/[slug] page) ──
    // Throttled: 20 countries per chunk with 500ms delay between chunks
    // to stay well within nginx rate limit (burst=30).
    void (async () => {
      try {
        for (let i = 0; i < countryNames.length; i += 20) {
          if (i > 0) await new Promise((r) => setTimeout(r, 500));
          const chunk = countryNames.slice(i, i + 20);
          const bulk = await utils.countries.getBulkWikiRichIntros.fetch(
            { countryNames: chunk },
            wikiOpts,
          );
          if (bulk) {
            for (const [name, data] of Object.entries(bulk)) {
              utils.countries.getWikiRichIntro.setData({ countryName: name }, data);
            }
          }
        }
      } catch { /* rich intros will load on click instead */ }
    })();

    // NOTE: Page images, infoboxes, and section previews load on-demand
    // when a country is clicked. Bulk prefetching them caused 429 errors
    // (300+ sequential wiki API calls overwhelming the rate limit).
  }, [worldMap, utils]);
}
