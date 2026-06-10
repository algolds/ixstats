// @ts-nocheck
"use client";

import React, { useState, useCallback } from "react";
import {
  Eye,
  EyeOff,
  Lock,
  Unlock,
  ChevronDown,
  ChevronRight,
  Crown,
  Pencil,
  Trash2,
  MapPin,
  Hexagon,
  Landmark,
  BookMarked,
  Type,
  Route,
} from "lucide-react";
import { WikiPreviewTooltip } from "~/components/maps/editor/WikiPreviewTooltip";

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
  features?: any[];
  selectedFeature?: any;
  onSelectFeature?: (feature: any) => void;
  onEditFeature?: (feature: any) => void;
  onDeleteFeature?: (feature: any) => void;
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
  onToggleVisibility: (layerId: string) => void;
  onToggleLock: (layerId: string) => void;
  onOpacityChange?: (layerId: string, opacity: number) => void;
  featureCounts?: Record<string, number>;
}

const TYPE_ICONS = {
  city: MapPin,
  subdivision: Hexagon,
  poi: Landmark,
  storyPin: BookMarked,
  mapLabel: Type,
  route: Route,
} as const;

const TYPE_COLORS = {
  city: "text-blue-500",
  subdivision: "text-purple-500",
  poi: "text-amber-500",
  storyPin: "text-amber-500",
  mapLabel: "text-slate-500",
  route: "text-indigo-500",
} as const;

export const LayerPanel = React.memo(function LayerPanel({
  layers,
  features = [],
  selectedFeature,
  onSelectFeature,
  onEditFeature,
  onDeleteFeature,
  selectedIds,
  onToggleSelect,
  onToggleVisibility,
  onToggleLock,
  onOpacityChange,
  featureCounts = {},
}: LayerPanelProps) {
  // Pre-expand regions and cities by default
  const [expandedLayers, setExpandedLayers] = useState<Set<string>>(
    () => new Set(["regions", "cities"])
  );

  const toggleLayerExpanded = useCallback((layerId: string) => {
    setExpandedLayers((prev) => {
      const next = new Set(prev);
      if (next.has(layerId)) next.delete(layerId);
      else next.add(layerId);
      return next;
    });
  }, []);

  const getLayerFeatures = (layerId: string) => {
    return features.filter((f) => {
      if (layerId === "regions") return f.type === "subdivision";
      if (layerId === "cities") return f.type === "city";
      if (layerId === "pois") return f.type === "poi";
      if (layerId === "stories") return f.type === "storyPin";
      if (layerId === "labels") return f.type === "mapLabel";
      if (layerId === "routes") return f.type === "route";
      return false;
    });
  };

  const renderFeatureRow = (feature: any) => {
    const Icon = TYPE_ICONS[feature.type] || MapPin;
    const colorClass = TYPE_COLORS[feature.type] || "text-neutral-500";
    const isSelected = selectedFeature?.id === feature.id;
    const isMultiSelected = selectedIds?.has(feature.id) ?? false;
    const isCapital = feature.properties?.isNationalCapital;
    const wikiTitle = feature.properties?.wikiPageTitle;

    const row = (
      <div
        key={feature.id}
        className={`group flex items-center gap-1.5 rounded px-2 py-1.5 transition-colors pl-8 ${
          isSelected
            ? "bg-primary/10 ring-primary/30 ring-1 font-semibold"
            : isMultiSelected
              ? "bg-indigo-500/10 ring-1 ring-indigo-500/30"
              : "hover:bg-neutral-100 dark:hover:bg-neutral-800/60"
        }`}
      >
        <button
          onClick={(e) => {
            if (e.shiftKey && onToggleSelect) {
              onToggleSelect(feature.id);
            } else if (onSelectFeature) {
              onSelectFeature(feature);
            }
          }}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
        >
          <Icon className={`h-3 w-3 shrink-0 ${colorClass}`} />
          <span className="text-foreground truncate text-[11px]">{feature.name}</span>
          {isCapital && (
            <span title="National Capital">
              <Crown className="h-2.5 w-2.5 shrink-0 text-amber-500" />
            </span>
          )}
        </button>
        <div
          className={`flex items-center gap-0.5 transition-opacity ${
            isSelected ? "opacity-100" : "opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
          }`}
        >
          {onEditFeature && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onEditFeature(feature);
              }}
              className="text-neutral-500 rounded p-0.5 transition-colors hover:bg-neutral-200 hover:text-blue-600 dark:hover:bg-neutral-700 dark:hover:text-blue-400"
              title="Edit"
            >
              <Pencil className="h-3 w-3" />
            </button>
          )}
          {onDeleteFeature && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDeleteFeature(feature);
              }}
              className="text-neutral-500 rounded p-0.5 transition-colors hover:bg-neutral-200 hover:text-red-650 dark:hover:bg-neutral-700 dark:hover:text-red-400"
              title="Delete"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>
    );

    return wikiTitle ? (
      <WikiPreviewTooltip key={feature.id} wikiTitle={wikiTitle}>
        {row}
      </WikiPreviewTooltip>
    ) : (
      row
    );
  };

  return (
    <div className="flex flex-col bg-white text-xs text-neutral-800 select-none dark:bg-neutral-900 dark:text-neutral-200">
      <div className="border-b border-neutral-200 px-2 py-1 text-[10px] font-semibold tracking-wider text-neutral-500 uppercase dark:border-neutral-700 dark:text-neutral-400">
        Layers & Features
      </div>
      <div className="flex flex-col">
        {layers.map((layer) => {
          const Icon = layer.icon;
          const layerFeatures = getLayerFeatures(layer.id);
          const count = featureCounts?.[layer.id] ?? (layer.id === "border" || layer.id === "climate" ? undefined : layerFeatures.length);
          const isExpanded = expandedLayers.has(layer.id);
          const showOpacity = layer.id === "regions";

          return (
            <div key={layer.id} className="border-b border-neutral-100 dark:border-neutral-800/40">
              {/* Layer Header Row */}
              <div
                className={`group flex h-8 items-center gap-1 px-1 hover:bg-neutral-50 dark:hover:bg-neutral-800/40 ${
                  !layer.visible ? "opacity-50" : ""
                }`}
              >
                {/* Expand Chevron */}
                {layer.id !== "border" && layer.id !== "climate" ? (
                  <button
                    onClick={() => toggleLayerExpanded(layer.id)}
                    className="flex h-5 w-5 shrink-0 items-center justify-center rounded hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-500"
                  >
                    {isExpanded ? (
                      <ChevronDown className="h-3.5 w-3.5" />
                    ) : (
                      <ChevronRight className="h-3.5 w-3.5" />
                    )}
                  </button>
                ) : (
                  <span className="w-5 h-5 shrink-0" />
                )}

                {/* Visibility Toggle */}
                <button
                  onClick={() => onToggleVisibility(layer.id)}
                  className="flex h-5 w-5 shrink-0 items-center justify-center rounded hover:bg-neutral-200 dark:hover:bg-neutral-700"
                  title={layer.visible ? "Hide layer" : "Show layer"}
                >
                  {layer.visible ? (
                    <Eye className="h-3.5 w-3.5 text-neutral-600 dark:text-neutral-300" />
                  ) : (
                    <EyeOff className="h-3.5 w-3.5 text-neutral-400 dark:text-neutral-500" />
                  )}
                </button>

                {/* Lock Toggle */}
                {layer.id !== "border" && layer.id !== "country-border" && layer.id !== "climate" ? (
                  <button
                    onClick={() => onToggleLock(layer.id)}
                    className="flex h-5 w-5 shrink-0 items-center justify-center rounded hover:bg-neutral-200 dark:hover:bg-neutral-700"
                    title={layer.locked ? "Unlock layer" : "Lock layer"}
                  >
                    {layer.locked ? (
                      <Lock className="h-3.5 w-3.5 text-amber-500 dark:text-amber-400" />
                    ) : (
                      <Unlock className="h-3.5 w-3.5 text-neutral-400 opacity-0 group-hover:opacity-100 dark:text-neutral-500" />
                    )}
                  </button>
                ) : (
                  <span className="h-5 w-5 shrink-0" />
                )}

                {/* Layer Icon */}
                <Icon className="h-4 w-4 shrink-0 text-neutral-500 dark:text-neutral-400 ml-0.5" />

                {/* Layer Name */}
                <span
                  onClick={() => layer.id !== "border" && layer.id !== "climate" && toggleLayerExpanded(layer.id)}
                  className="flex-1 truncate text-[11px] font-medium leading-none ml-1 cursor-pointer"
                >
                  {layer.name}
                </span>

                {/* Badge Count */}
                {count !== undefined && count > 0 && (
                  <span className="rounded bg-neutral-200 px-1 py-0.5 text-[9px] leading-none font-semibold text-neutral-500 dark:bg-neutral-750 dark:text-neutral-400 mr-1.5">
                    {count}
                  </span>
                )}
              </div>

              {/* Layer Children (Opacity Slider and Features List) */}
              {isExpanded && (
                <div className="bg-neutral-50/20 dark:bg-neutral-900/10 pb-1.5 space-y-0.5">
                  {/* Opacity slider for Regions */}
                  {showOpacity && (
                    <div className="flex items-center gap-2 bg-neutral-100/30 dark:bg-neutral-800/20 px-3 py-1 ml-8 mr-1.5 rounded mb-1 text-[10px]">
                      <span className="text-neutral-500 dark:text-neutral-400">Opacity</span>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={Math.round((layer.opacity ?? 1) * 100)}
                        onChange={(e) =>
                          onOpacityChange?.(layer.id, parseInt(e.target.value, 10) / 100)
                        }
                        className="h-1 flex-1 cursor-pointer appearance-none rounded bg-neutral-300 accent-blue-500 dark:bg-neutral-700"
                      />
                      <span className="w-8 text-right text-neutral-500 dark:text-neutral-400">
                        {Math.round((layer.opacity ?? 1) * 100)}%
                      </span>
                    </div>
                  )}

                  {/* Feature items */}
                  {layerFeatures.length > 0 ? (
                    layerFeatures.map(renderFeatureRow)
                  ) : (
                    <div className="text-neutral-400 dark:text-neutral-500 pl-8 py-1 text-[10px] italic">
                      No features in this layer
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
});
