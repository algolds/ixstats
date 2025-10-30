/**
 * Map debug panel component
 * Displays current map state and configuration
 */

"use client";

import React from "react";
import type { MapDebugInfo } from "~/types/maps";

interface MapDebugPanelProps {
  debugInfo: MapDebugInfo;
}

export const MapDebugPanel = React.memo(function MapDebugPanel({
  debugInfo,
}: MapDebugPanelProps) {
  return (
    <div className="absolute bottom-4 left-4 z-[1000] max-w-sm rounded-lg bg-white/90 p-4 shadow-lg backdrop-blur">
      <h3 className="mb-2 text-sm font-semibold">Debug Info</h3>
      <div className="space-y-1 text-xs font-mono">
        <div>Projection: {debugInfo.projection}</div>
        <div>Zoom: {debugInfo.zoom}</div>
        <div>
          Center: [{debugInfo.center[0].toFixed(4)}, {debugInfo.center[1].toFixed(4)}]
        </div>
        <div>
          Bounds: N:{debugInfo.bounds.north.toFixed(2)} S:{debugInfo.bounds.south.toFixed(2)} E:
          {debugInfo.bounds.east.toFixed(2)} W:{debugInfo.bounds.west.toFixed(2)}
        </div>
        <div>Selected: {debugInfo.selectedCountry ?? "None"}</div>
        <div>Visible Layers: {debugInfo.visibleLayers.join(", ") || "None"}</div>
        <div>Tile Layers: {debugInfo.tileLayerCount}</div>
      </div>
    </div>
  );
});
