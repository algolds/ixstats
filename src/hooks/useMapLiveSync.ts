"use client";

/**
 * useMapLiveSync — Real-time map data synchronization via Server-Sent Events.
 *
 * Connects to /api/sse/map-updates. Each change event names the realm it happened in and what changed
 * (`~/lib/maps/live-sync`): a map ignores other realms' events and refetches only the queries the change touches.
 * Layers follow the realm's map version, so a moved version (a "version" event) is all the layers need.
 *
 * This ensures ALL connected users see map updates instantly without refresh,
 * not just the user who made the edit.
 *
 * Usage: Call this hook at the top level of any map-viewing component.
 * It is a no-op if SSE is not supported or if the connection fails.
 */

import { useEffect, useRef, useCallback } from "react";
import { api } from "~/trpc/react";
import { useRealmMapVersion } from "~/hooks/useRealmMapVersion";
import { isForRealm, parseMapSyncEvent, queriesFor, type MapSyncQuery } from "~/lib/maps/live-sync";

const SSE_ENDPOINT = "/api/sse/map-updates";
const RECONNECT_BASE_MS = 1000;
const RECONNECT_MAX_MS = 30000;
/**
 * Coalesce bursts of change events (an editor autosave or a bulk import emits many) into one
 * refetch per query, so every open map asks once, not per event.
 */
const INVALIDATE_DEBOUNCE_MS = 750;

type Utils = ReturnType<typeof api.useUtils>;

const REFETCH: Record<MapSyncQuery, (utils: Utils) => void> = {
  version: (utils) => void utils.realms.map.version.invalidate(),
  markers: (utils) => void utils.geoCore.getMapBundleMarkers.invalidate(),
  detail: (utils) => void utils.geoCore.getMapBundleDetail.invalidate(),
  storyPins: (utils) => void utils.geoFeatures.getAllStoryPins.invalidate(),
  labels: (utils) => void utils.geoFeatures.getAllMapLabels.invalidate(),
  country: (utils) => {
    void utils.geoCore.getCountryFeatures.invalidate();
    void utils.countryGeo.getCountryGeoBundle.invalidate();
    void utils.geoCore.getCountryGeometry.invalidate();
  },
};

/** @param realm realm slug the map shows (`?realm=`); undefined = the viewer's realm */
export function useMapLiveSync(realm?: string) {
  const utils = api.useUtils();
  const { mapVersion } = useRealmMapVersion(realm);
  const realmIdRef = useRef<string | undefined>(undefined);
  const esRef = useRef<EventSource | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const isMountedRef = useRef(true);
  const invalidateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRef = useRef(new Set<MapSyncQuery>());

  useEffect(() => {
    realmIdRef.current = mapVersion?.realmId;
  }, [mapVersion?.realmId]);

  const connect = useCallback(() => {
    if (!isMountedRef.current) return;
    if (typeof EventSource === "undefined") return;

    // Close existing connection
    if (esRef.current) {
      esRef.current.close();
      esRef.current = null;
    }

    const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
    const url = `${basePath}${SSE_ENDPOINT}`;

    try {
      const es = new EventSource(url);
      esRef.current = es;

      es.addEventListener("map_data_changed", (message) => {
        reconnectAttemptsRef.current = 0;
        const event = parseMapSyncEvent((message as MessageEvent<string>).data);
        if (!isForRealm(event, realmIdRef.current)) return;
        for (const query of queriesFor(event.changeType)) pendingRef.current.add(query);
        if (invalidateTimerRef.current) clearTimeout(invalidateTimerRef.current);
        invalidateTimerRef.current = setTimeout(() => {
          invalidateTimerRef.current = null;
          const queries = [...pendingRef.current];
          pendingRef.current.clear();
          if (isMountedRef.current) for (const query of queries) REFETCH[query](utils);
        }, INVALIDATE_DEBOUNCE_MS);
      });

      es.onerror = () => {
        es.close();
        esRef.current = null;

        if (!isMountedRef.current) return;

        // Exponential backoff with jitter
        const attempts = reconnectAttemptsRef.current;
        const delay = Math.min(
          RECONNECT_BASE_MS * Math.pow(2, attempts) + Math.random() * 1000,
          RECONNECT_MAX_MS
        );
        reconnectAttemptsRef.current = attempts + 1;

        reconnectTimerRef.current = setTimeout(() => {
          if (isMountedRef.current) connect();
        }, delay);
      };

      es.onopen = () => {
        reconnectAttemptsRef.current = 0;
      };
    } catch {
      // EventSource construction failed — don't retry
    }
  }, [utils]);

  useEffect(() => {
    isMountedRef.current = true;
    connect();

    return () => {
      isMountedRef.current = false;
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      if (invalidateTimerRef.current) clearTimeout(invalidateTimerRef.current);
      if (esRef.current) {
        esRef.current.close();
        esRef.current = null;
      }
    };
  }, [connect]);
}
