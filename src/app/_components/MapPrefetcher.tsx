"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { useMapPrefetch } from "~/hooks/useMapData";

/**
 * Invisible component that warms the map data cache.
 *
 * Only activates on map-related pages (not dashboard, not mycountry, etc.)
 * to avoid loading 17.8MB of world GeoJSON data on pages that don't need it.
 * Once activated, stays active for the rest of the session so cached data
 * persists across SPA navigation.
 */

const MAP_PATHS = ["/maps", "/countries", "/admin/maps"];

export function MapPrefetcher() {
  const pathname = usePathname();
  const activatedRef = useRef(false);

  // Activate on first visit to a map-related page; stays active for the session
  const isMapPage = MAP_PATHS.some((p) => pathname?.startsWith(p));
  const shouldPrefetch = activatedRef.current || isMapPage;

  useEffect(() => {
    if (isMapPage && !activatedRef.current) {
      activatedRef.current = true;
    }
  }, [isMapPage]);

  if (!shouldPrefetch) return null;
  return <MapPrefetchRunner />;
}

/** Separated component so the hook only runs when shouldPrefetch is true. */
function MapPrefetchRunner() {
  useMapPrefetch();
  return null;
}
