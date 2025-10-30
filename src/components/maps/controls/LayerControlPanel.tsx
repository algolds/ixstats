/**
 * Layer Control Panel Component - Google Maps Style
 *
 * Clean, minimal control panel matching Google Maps UI/UX.
 */

"use client";

import React from "react";
import { RiMapPinLine, RiEarthLine, RiInformationLine, RiStackLine } from "react-icons/ri";
import type { LayerState, ProjectionType } from "~/types/maps";

interface LayerControlPanelProps {
  layerState: LayerState;
  mapLoaded: boolean;
  isLoading: boolean;
  onLayerChange: (key: keyof LayerState, value: boolean) => void;
  projectionType: ProjectionType;
  onProjectionChange: (type: ProjectionType) => void;
  onShowProjectionInfo: () => void;
}

const layerLabels: Record<keyof LayerState, string> = {
  showAltitudes: "Altitudes",
  showLakes: "Lakes",
  showRivers: "Rivers",
  showIcecaps: "Ice Caps",
  showPolitical: "Political Boundaries",
};

const projectionLabels: Record<ProjectionType, string> = {
  mercator: "Web Mercator",
  equalEarth: "Equal Earth",
  globe: "Globe",
  ixmaps: "IxMaps Linear",
};

export function LayerControlPanel({
  layerState,
  mapLoaded,
  isLoading,
  onLayerChange,
  projectionType,
  onProjectionChange,
  onShowProjectionInfo,
}: LayerControlPanelProps) {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      {/* Projection Switcher */}
      <div className="p-4 border-b border-gray-200">
        <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
          <RiEarthLine className="text-blue-500" />
          Map Type
        </h3>
        <div className="grid grid-cols-2 gap-2">
          {(["ixmaps", "mercator", "equalEarth", "globe"] as ProjectionType[]).map((type) => (
            <button
              key={type}
              onClick={() => onProjectionChange(type)}
              disabled={!mapLoaded || isLoading}
              className={`
                px-3 py-2 rounded-md text-sm font-medium transition-all border
                ${projectionType === type
                  ? "bg-blue-50 text-blue-700 border-blue-300"
                  : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
                }
                ${(!mapLoaded || isLoading) ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}
              `}
            >
              {projectionLabels[type]}
            </button>
          ))}
        </div>
        <button
          onClick={onShowProjectionInfo}
          className="w-full mt-3 px-3 py-1.5 rounded-md text-xs font-medium bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors flex items-center justify-center gap-1.5"
        >
          <RiInformationLine />
          About Map Projections
        </button>
      </div>

      {/* Layer Toggles */}
      <div className="p-4">
        <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
          <RiStackLine className="text-blue-500" />
          Layers
        </h3>
        <div className="space-y-2">
          {(Object.keys(layerState) as (keyof LayerState)[]).map((key) => (
            <label
              key={key}
              className="flex items-center gap-3 p-2 rounded-md hover:bg-gray-50 cursor-pointer transition-colors group"
            >
              <input
                type="checkbox"
                checked={layerState[key]}
                onChange={(e) => onLayerChange(key, e.target.checked)}
                disabled={!mapLoaded || isLoading}
                className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 focus:ring-offset-0 focus:ring-2 cursor-pointer disabled:opacity-50"
              />
              <span className={`text-sm ${layerState[key] ? "text-gray-900 font-medium" : "text-gray-500"} group-hover:text-gray-900`}>
                {layerLabels[key]}
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* Loading indicator */}
      {isLoading && (
        <div className="px-4 py-3 bg-blue-50 border-t border-blue-100">
          <div className="flex items-center gap-2 text-xs text-blue-700">
            <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            Loading map tiles...
          </div>
        </div>
      )}
    </div>
  );
}
