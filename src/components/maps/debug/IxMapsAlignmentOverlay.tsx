import React, { useEffect, useState } from "react";
import type { Map as MapLibreMap } from "maplibre-gl";

interface IxMapsAlignmentOverlayProps {
  map: MapLibreMap | null;
  enabled: boolean;
  imageUrl: string;
  opacity: number;
}

export default function IxMapsAlignmentOverlay({
  map,
  enabled,
  imageUrl,
  opacity,
}: IxMapsAlignmentOverlayProps) {
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    if (!map || !enabled) return;

    // Add alignment overlay image source
    const sourceId = "ixmaps-alignment-overlay";
    const layerId = "ixmaps-alignment-overlay-layer";

    const addOverlay = () => {
      if (!map.getSource(sourceId)) {
        // Add image source with world bounds
        map.addSource(sourceId, {
          type: "image",
          url: imageUrl,
          coordinates: [
            [-180, 85.051129], // top-left
            [180, 85.051129], // top-right
            [180, -85.051129], // bottom-right
            [-180, -85.051129], // bottom-left
          ],
        });
      }

      if (!map.getLayer(layerId)) {
        map.addLayer({
          id: layerId,
          type: "raster",
          source: sourceId,
          paint: {
            "raster-opacity": opacity,
          },
        });
      }

      setIsLoaded(true);
    };

    // Wait for map to be ready
    if (map.loaded()) {
      addOverlay();
    } else {
      map.on("load", addOverlay);
    }

    return () => {
      if (map.getLayer(layerId)) {
        map.removeLayer(layerId);
      }
      if (map.getSource(sourceId)) {
        map.removeSource(sourceId);
      }
      setIsLoaded(false);
    };
  }, [map, enabled, imageUrl, opacity]);

  if (!enabled || !isLoaded) return null;

  return (
    <div className="absolute top-2 right-2 z-10 rounded bg-white/90 p-2 text-xs">
      <div>IxMaps Overlay: {opacity * 100}%</div>
    </div>
  );
}
