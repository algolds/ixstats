"use client";

/**
 * MapControls - Layer toggle panel, tool buttons, and coordinate display overlay.
 * Positioned in the top-left of the map.
 */

import { useState } from "react";
import { LAYER_CONFIGS, getClimateLegend, type MapLayerType } from "~/lib/map-config";
import type { HoveredCountry, OverlayVisibility } from "./IxWorldMap";

interface MapControlsProps {
  visibleLayers: Set<MapLayerType>;
  onToggleLayer: (layer: MapLayerType) => void;
  hoveredCountry: HoveredCountry | null;
  /** Overlay visibility toggles */
  overlayVisibility?: OverlayVisibility;
  onToggleOverlay?: (key: keyof OverlayVisibility) => void;
  /** Extra buttons rendered beside the Layers button */
  children?: React.ReactNode;
}

/** Only user-toggleable layers (excludes locked base terrain) */
const TOGGLEABLE_LAYERS: MapLayerType[] = [
  "political",
  "climate",
  "rivers",
  "lakes",
];

const OVERLAY_ITEMS: { key: keyof OverlayVisibility; label: string }[] = [
  { key: "cities", label: "Cities" },
  { key: "pois", label: "Points of Interest" },
  { key: "subdivisions", label: "Regions" },
];

export function MapControls({
  visibleLayers,
  onToggleLayer,
  hoveredCountry,
  overlayVisibility,
  onToggleOverlay,
  children,
}: MapControlsProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <>
      {/* Controls toolbar */}
      <div className="absolute left-3 top-16 z-10 sm:top-3">
        {/* Button row: Layers + extra tools side-by-side */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex min-h-[44px] min-w-[44px] items-center gap-2 rounded-lg bg-card px-3 py-2 text-sm font-medium text-foreground shadow-md transition-colors hover:bg-accent sm:min-h-0 sm:min-w-0"
            title="Toggle map layers"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
              />
            </svg>
            Layers
          </button>

          {/* Extra tool buttons (e.g. Measure) */}
          {children}
        </div>

        {/* Layer dropdown */}
        {isExpanded && (
          <div className="mt-2 w-48 rounded-lg bg-card p-3 shadow-lg">
            {TOGGLEABLE_LAYERS.map((layer) => {
              const config = LAYER_CONFIGS[layer];
              const isVisible = visibleLayers.has(layer);

              return (
                <label
                  key={layer}
                  className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 transition-colors hover:bg-accent"
                >
                  <input
                    type="checkbox"
                    checked={isVisible}
                    onChange={() => onToggleLayer(layer)}
                    className="h-3.5 w-3.5 rounded border-border text-blue-500 focus:ring-blue-500"
                  />
                  <span className="text-sm text-foreground">
                    {config.label}
                  </span>
                </label>
              );
            })}

            {/* Trewartha climate legend (shown when climate layer is active) */}
            {visibleLayers.has("climate") && (
              <>
                <div className="my-1.5 border-t border-border" />
                <div className="px-2 pb-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Trewartha Climate
                </div>
                <div className="max-h-48 overflow-y-auto px-1">
                  {getClimateLegend().map((entry) => (
                    <div key={entry.code} className="flex items-center gap-2 px-1 py-0.5">
                      <span
                        className="inline-block h-3 w-3 shrink-0 rounded-sm border border-black/10"
                        style={{ backgroundColor: entry.color }}
                      />
                      <span className="text-xs text-foreground">{entry.label}</span>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* Overlay toggles */}
            {overlayVisibility && onToggleOverlay && (
              <>
                <div className="my-1.5 border-t border-border" />
                <div className="px-2 pb-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Overlays
                </div>
                {OVERLAY_ITEMS.map((item) => (
                  <label
                    key={item.key}
                    className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 transition-colors hover:bg-accent"
                  >
                    <input
                      type="checkbox"
                      checked={overlayVisibility[item.key]}
                      onChange={() => onToggleOverlay(item.key)}
                      className="h-3.5 w-3.5 rounded border-border text-blue-500 focus:ring-blue-500"
                    />
                    <span className="text-sm text-foreground">{item.label}</span>
                  </label>
                ))}
              </>
            )}
          </div>
        )}
      </div>

      {/* Hovered country name - disabled in favour of on-map country labels
      {hoveredCountry && (
        <div
          className="pointer-events-none absolute z-10 hidden sm:block"
          style={{
            left: hoveredCountry.screenX + 12,
            top: hoveredCountry.screenY - 28,
          }}
        >
          <div className="whitespace-nowrap rounded bg-slate-800/90 px-2.5 py-1 text-xs font-medium text-white shadow-md">
            {hoveredCountry.displayName}
          </div>
        </div>
      )}
      */}
    </>
  );
}
