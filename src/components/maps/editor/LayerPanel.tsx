"use client";

import React, { useState } from "react";
import {
  Eye,
  EyeOff,
  Lock,
  Unlock,
} from "lucide-react";

export interface LayerState {
  id: string;
  name: string;
  icon: React.ElementType;
  visible: boolean;
  locked: boolean;
  opacity?: number;
  isBaseLayer?: boolean;
}

interface LayerPanelProps {
  layers: LayerState[];
  onToggleVisibility: (layerId: string) => void;
  onToggleLock: (layerId: string) => void;
  onOpacityChange?: (layerId: string, opacity: number) => void;
  featureCounts: Record<string, number>;
}

export const LayerPanel = React.memo(function LayerPanel({
  layers,
  onToggleVisibility,
  onToggleLock,
  onOpacityChange,
  featureCounts,
}: LayerPanelProps) {
  const [expandedLayer, setExpandedLayer] = useState<string | null>(null);

  return (
    <div className="flex flex-col bg-white text-neutral-800 dark:bg-neutral-900 dark:text-neutral-200 text-xs select-none">
      <div className="border-b border-neutral-200 dark:border-neutral-700 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
        Layers
      </div>
      <div className="flex flex-col">
        {layers.map((layer) => {
          const Icon = layer.icon;
          const count = featureCounts[layer.id];
          const isExpanded = expandedLayer === layer.id;
          const showOpacity = layer.id === "regions";

          return (
            <div key={layer.id}>
              <div
                className={`group flex h-7 items-center gap-1 border-b border-neutral-100 dark:border-neutral-800 px-1 hover:bg-neutral-100 dark:hover:bg-neutral-800/60 ${
                  !layer.visible ? "opacity-50" : ""
                }`}
                onDoubleClick={() => {
                  if (showOpacity) {
                    setExpandedLayer(isExpanded ? null : layer.id);
                  }
                }}
              >
                {/* Visibility toggle */}
                <button
                  onClick={() => onToggleVisibility(layer.id)}
                  className="flex h-5 w-5 shrink-0 items-center justify-center rounded hover:bg-neutral-200 dark:hover:bg-neutral-700"
                  title={layer.visible ? "Hide layer" : "Show layer"}
                >
                  {layer.visible ? (
                    <Eye className="h-3 w-3 text-neutral-600 dark:text-neutral-300" />
                  ) : (
                    <EyeOff className="h-3 w-3 text-neutral-400 dark:text-neutral-500" />
                  )}
                </button>

                {/* Lock toggle */}
                {layer.id !== "country-border" ? (
                  <button
                    onClick={() => onToggleLock(layer.id)}
                    className="flex h-5 w-5 shrink-0 items-center justify-center rounded hover:bg-neutral-200 dark:hover:bg-neutral-700"
                    title={layer.locked ? "Unlock layer" : "Lock layer"}
                  >
                    {layer.locked ? (
                      <Lock className="h-3 w-3 text-amber-500 dark:text-amber-400" />
                    ) : (
                      <Unlock className="h-3 w-3 text-neutral-400 dark:text-neutral-500 opacity-0 group-hover:opacity-100" />
                    )}
                  </button>
                ) : (
                  <span className="h-5 w-5 shrink-0" />
                )}

                {/* Layer icon */}
                <Icon className="h-3.5 w-3.5 shrink-0 text-neutral-500 dark:text-neutral-400" />

                {/* Layer name */}
                <span className="flex-1 truncate text-[11px] leading-none">
                  {layer.name}
                </span>

                {/* Feature count badge */}
                {count !== undefined && count > 0 && !layer.isBaseLayer && (
                  <span className="rounded bg-neutral-200 dark:bg-neutral-700 px-1 py-0.5 text-[9px] font-medium leading-none text-neutral-500 dark:text-neutral-400">
                    {count}
                  </span>
                )}

                {/* Opacity expand hint for regions */}
                {showOpacity && (
                  <button
                    onClick={() =>
                      setExpandedLayer(isExpanded ? null : layer.id)
                    }
                    className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-[9px] text-neutral-500 hover:bg-neutral-200 dark:hover:bg-neutral-700 hover:text-neutral-700 dark:hover:text-neutral-300"
                    title="Adjust opacity"
                  >
                    {layer.opacity !== undefined
                      ? `${Math.round(layer.opacity * 100)}%`
                      : "100%"}
                  </button>
                )}
              </div>

              {/* Opacity slider (expanded, only for Regions) */}
              {showOpacity && isExpanded && (
                <div className="flex items-center gap-2 border-b border-neutral-100 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800/50 px-3 py-1.5">
                  <span className="text-[10px] text-neutral-500">Opacity</span>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={Math.round((layer.opacity ?? 1) * 100)}
                    onChange={(e) =>
                      onOpacityChange?.(
                        layer.id,
                        parseInt(e.target.value, 10) / 100,
                      )
                    }
                    className="h-1 flex-1 cursor-pointer appearance-none rounded bg-neutral-300 dark:bg-neutral-700 accent-blue-500"
                  />
                  <span className="w-7 text-right text-[10px] text-neutral-500 dark:text-neutral-400">
                    {Math.round((layer.opacity ?? 1) * 100)}%
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
});
