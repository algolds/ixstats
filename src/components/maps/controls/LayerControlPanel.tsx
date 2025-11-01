/**
 * Layer Control Panel Component - Google Maps Style
 *
 * Clean, minimal control panel matching Google Maps UI/UX.
 */

"use client";

import React from "react";
import { RiMapPinLine, RiEarthLine, RiInformationLine, RiStackLine, RiTimeLine, RiStarLine } from "react-icons/ri";
import type { LayerState, ProjectionType } from "~/types/maps";
import { PROJECTION_METADATA } from "~/types/maps";

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
  naturalEarth: "Natural Earth",
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
    <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
      {/* Projection Switcher */}
      <div className="border-b border-gray-200 p-4">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-900">
          <RiEarthLine className="text-blue-500" />
          Projection
        </h3>
        <div className="grid grid-cols-2 gap-2">
          {(["mercator", "globe", "equalEarth", "naturalEarth", "ixmaps"] as ProjectionType[]).map((type) => {
            const metadata = PROJECTION_METADATA[type];
            const isSupported = metadata.supported;
            const isDisabled = !mapLoaded || isLoading || !isSupported;
            const isCustom = metadata.type === 'custom' || metadata.requiresPlugin;

            return (
              <button
                key={type}
                onClick={() => isSupported && onProjectionChange(type)}
                disabled={isDisabled}
                className={`rounded-md border px-3 py-2 text-sm font-medium transition-all ${
                  projectionType === type
                    ? "border-blue-300 bg-blue-50 text-blue-700"
                    : isSupported
                      ? "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
                      : "border-gray-200 bg-gray-50 text-gray-400"
                } ${isDisabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}
                title={!isSupported ? "Coming soon" : metadata.bestFor.join(", ")}
              >
                <div className="flex items-center justify-center gap-1.5">
                  {projectionLabels[type]}
                  {!isSupported && <RiTimeLine className="h-3 w-3" title="Coming soon" />}
                  {isSupported && isCustom && <RiStarLine className="h-3 w-3 text-purple-500" title="Custom projection" />}
                </div>
              </button>
            );
          })}
        </div>

        {/* Projection info and notes */}
        <div className="mt-3 space-y-2">
          <button
            onClick={onShowProjectionInfo}
            className="flex w-full items-center justify-center gap-1.5 rounded-md bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-600 transition-colors hover:bg-blue-100"
          >
            <RiInformationLine />
            About Map Projections
          </button>

          {/* Show note for custom projections */}
          {(projectionType === 'equalEarth' || projectionType === 'naturalEarth' || projectionType === 'ixmaps') && (
            <div className="rounded-md bg-purple-50 px-3 py-2 text-xs text-purple-700">
              <div className="flex items-start gap-2">
                <RiStarLine className="mt-0.5 h-3 w-3 flex-shrink-0" />
                <span>
                  <strong>Custom projection:</strong> Uses D3-geo client-side transformation for accurate area representation.
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Layer Toggles */}
      <div className="p-4">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-900">
          <RiStackLine className="text-blue-500" />
          Layers
        </h3>
        <div className="space-y-2">
          {(Object.keys(layerState) as (keyof LayerState)[]).map((key) => (
            <label
              key={key}
              className="group flex cursor-pointer items-center gap-3 rounded-md p-2 transition-colors hover:bg-gray-50"
            >
              <input
                type="checkbox"
                checked={layerState[key]}
                onChange={(e) => onLayerChange(key, e.target.checked)}
                disabled={!mapLoaded || isLoading}
                className="h-4 w-4 cursor-pointer rounded border-gray-300 text-blue-600 focus:ring-2 focus:ring-blue-500 focus:ring-offset-0 disabled:opacity-50"
              />
              <span
                className={`text-sm ${layerState[key] ? "font-medium text-gray-900" : "text-gray-500"} group-hover:text-gray-900`}
              >
                {layerLabels[key]}
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* Loading indicator */}
      {isLoading && (
        <div className="border-t border-blue-100 bg-blue-50 px-4 py-3">
          <div className="flex items-center gap-2 text-xs text-blue-700">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-600 border-t-transparent"></div>
            Loading map tiles...
          </div>
        </div>
      )}
    </div>
  );
}
