"use client";

/**
 * useMapPinInfo - Hook for the map pin info tool.
 *
 * Manages pin placement, client-side quick lookup (Turf.js),
 * and server-side enrichment (PostGIS via tRPC).
 */

import { useState, useCallback } from "react";
import { api } from "~/trpc/react";
import { queryPointClientSide, type ClientPointQueryResult } from "~/lib/map-point-query";
import type { FeatureCollection } from "geojson";

export interface PinPosition {
  lng: number;
  lat: number;
}

export function useMapPinInfo() {
  const [pinPosition, setPinPosition] = useState<PinPosition | null>(null);
  const [isPinToolActive, setIsPinToolActive] = useState(false);
  const [clientResult, setClientResult] = useState<ClientPointQueryResult | null>(null);

  // Server-side enrichment query — only fires when pin is placed
  const serverQuery = api.geo.getPointInfo.useQuery(
    { lng: pinPosition?.lng ?? 0, lat: pinPosition?.lat ?? 0 },
    { enabled: !!pinPosition }
  );

  const dropPin = useCallback(
    (lng: number, lat: number, layers: Record<string, FeatureCollection | undefined>) => {
      setPinPosition({ lng, lat });
      // Instant client-side lookup against loaded GeoJSON
      setClientResult(queryPointClientSide(lng, lat, layers));
    },
    []
  );

  const clearPin = useCallback(() => {
    setPinPosition(null);
    setClientResult(null);
  }, []);

  const togglePinTool = useCallback(() => {
    setIsPinToolActive((prev) => {
      if (prev) {
        // Turning off — also clear pin
        setPinPosition(null);
        setClientResult(null);
      }
      return !prev;
    });
  }, []);

  return {
    isPinToolActive,
    togglePinTool,
    pinPosition,
    clientResult,
    serverResult: serverQuery.data ?? null,
    isServerLoading: serverQuery.isLoading && !!pinPosition,
    dropPin,
    clearPin,
  };
}
