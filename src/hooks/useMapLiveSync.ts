/**
 * useMapLiveSync — Real-time map data synchronization via Server-Sent Events.
 *
 * Connects to /api/sse/map-updates and invalidates React Query map caches
 * whenever any geo mutation succeeds anywhere in the system.
 *
 * This ensures ALL connected users see map updates instantly without refresh,
 * not just the user who made the edit.
 *
 * Usage: Call this hook at the top level of any map-viewing component.
 * It is a no-op if SSE is not supported or if the connection fails.
 */

"use client";

import { useEffect, useRef, useCallback } from "react";
import { api } from "~/trpc/react";

const SSE_ENDPOINT = "/api/sse/map-updates";
const RECONNECT_BASE_MS = 1000;
const RECONNECT_MAX_MS = 30000;

/** Invalidate all map-related React Query caches */
function invalidateMapCaches(utils: ReturnType<typeof api.useUtils>) {
  utils.geoCore.getMapBundle.invalidate();
  utils.geoCore.getWorldMap.invalidate();
  utils.geoCore.getCountryFeatures.invalidate();
  utils.geoFeatures.getAllStoryPins.invalidate();
  utils.geoFeatures.getAllMapLabels.invalidate();
  utils.geoCore.getCapitalCities.invalidate();
}

export function useMapLiveSync() {
  const utils = api.useUtils();
  const esRef = useRef<EventSource | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const isMountedRef = useRef(true);

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

      es.addEventListener("map_data_changed", () => {
        reconnectAttemptsRef.current = 0;
        invalidateMapCaches(utils);
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
      if (esRef.current) {
        esRef.current.close();
        esRef.current = null;
      }
    };
  }, [connect]);
}
