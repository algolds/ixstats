import { useEffect, useState } from "react";
import type { Map as MapLibreMap } from "maplibre-gl";

/** Grid spacing bucket (0 = coarsest) for the current zoom; also reports zoom changes. */
export function useZoomBucket(
  mapRef: { readonly current: MapLibreMap | null },
  isLoaded: boolean,
  onZoomChange?: (zoom: number) => void
) {
  const [bucket, setBucket] = useState(0);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isLoaded) return;

    const updateBucket = () => {
      const z = map.getZoom();
      setBucket(z < 4 ? 0 : z < 6 ? 1 : z < 8 ? 2 : 3);
    };
    const reportZoom = () => onZoomChange?.(map.getZoom());
    updateBucket();
    map.on("zoomend", updateBucket);
    map.on("zoomend", reportZoom);
    return () => {
      map.off("zoomend", updateBucket);
      map.off("zoomend", reportZoom);
    };
  }, [mapRef, isLoaded, onZoomChange]);

  return bucket;
}
