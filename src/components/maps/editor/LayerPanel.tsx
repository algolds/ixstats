"use client";

import React, { useState, useCallback, useMemo } from "react";
import {
  Eye,
  EyeClosed as EyeOff,
  Lock,
  LockSlash as Unlock,
  NavArrowDown as ChevronDown,
  NavArrowRight as ChevronRight,
  Crown,
  EditPencil as Pencil,
  Trash as Trash2,
  MapPin,
  Hexagon,
  Bank as Landmark,
  Bookmark as BookMarked,
  Type,
  PathArrow as Route,
  Ruler,
} from "iconoir-react";
import { WikiPreviewTooltip } from "~/components/maps/editor/WikiPreviewTooltip";
import type { EditorFeature } from "./types/editor-state";

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
  layers?: LayerState[];
  features?: EditorFeature[];
  selectedFeature?: EditorFeature | null;
  onSelectFeature?: (feature: EditorFeature) => void;
  onEditFeature?: (feature: EditorFeature) => void;
  onDeleteFeature?: (feature: EditorFeature) => void;
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
  onToggleVisibility?: (layerId: string) => void;
  onToggleLock?: (layerId: string) => void;
  onOpacityChange?: (layerId: string, opacity: number) => void;
  featureCounts?: Record<string, number>;
  guides?: { id: string; type: "h" | "v"; value: number }[];
  onClearGuides?: () => void;
  showGuides?: boolean;
  onToggleGuidesVisibility?: (visible: boolean) => void;
  onDeleteGuide?: (id: string) => void;
  /** When true, renders a clean feature list without layer visibility/lock controls */
  minimal?: boolean;
  isLoading?: boolean;
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
  subdivision: "text-indigo-500",
  poi: "text-amber-500",
  storyPin: "text-amber-500",
  mapLabel: "text-slate-500",
  route: "text-indigo-500",
} as const;

export const LayerPanel = React.memo(function LayerPanel({
  layers = [],
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
  guides,
  onClearGuides,
  showGuides = true,
  onToggleGuidesVisibility,
  onDeleteGuide,
  minimal = false,
  // oxlint-disable-next-line eslint/no-unused-vars
  isLoading = false,
}: LayerPanelProps) {
  // Pre-expand regions and cities by default
  const [expandedLayers, setExpandedLayers] = useState<Set<string>>(
    () => new Set(["regions", "cities"])
  );
  const [guidesExpanded, setGuidesExpanded] = useState(true);

  const toggleLayerExpanded = useCallback((layerId: string) => {
    setExpandedLayers((prev) => {
      const next = new Set(prev);
      if (next.has(layerId)) next.delete(layerId);
      else next.add(layerId);
      return next;
    });
  }, []);

  const groupedFeatures = useMemo(() => {
    const groups: Record<string, EditorFeature[]> = {
      regions: [],
      cities: [],
      pois: [],
      stories: [],
      storyPins: [],
      labels: [],
      mapLabels: [],
      routes: [],
    };

    for (const f of features) {
      if (f.type === "subdivision") groups.regions?.push(f);
      else if (f.type === "city") groups.cities?.push(f);
      else if (f.type === "poi") groups.pois?.push(f);
      else if (f.type === "storyPin") {
        groups.stories?.push(f);
        groups.storyPins?.push(f);
      } else if (f.type === "mapLabel") {
        groups.labels?.push(f);
        groups.mapLabels?.push(f);
      } else if (f.type === "route") groups.routes?.push(f);
    }

    return groups;
  }, [features]);

  const renderFeatureRow = useCallback((feature: EditorFeature) => {
    const featureType = feature.type as keyof typeof TYPE_ICONS;
    const Icon = (featureType in TYPE_ICONS ? TYPE_ICONS[featureType] : null) || MapPin;
    const colorClass =
      (featureType in TYPE_COLORS ? TYPE_COLORS[featureType as keyof typeof TYPE_COLORS] : null) ||
      "text-muted-foreground";
    const isSelected = selectedFeature?.id === feature.id;
    const isMultiSelected = selectedIds?.has(feature.id) ?? false;
    const isCapital = Boolean(feature.properties?.isNationalCapital);
    const wikiTitle =
      typeof feature.properties?.wikiPageTitle === "string"
        ? feature.properties.wikiPageTitle
        : undefined;

    const row = (
      <div
        key={feature.id}
        className={`group flex items-center gap-1.5 rounded px-2 py-1.5 pl-8 transition-all duration-100 ease-out select-none active:scale-[0.99] ${
          isSelected
            ? "bg-primary/10 ring-primary/30 font-semibold shadow-xs ring-1"
            : isMultiSelected
              ? "bg-primary/15 ring-primary/40 ring-1"
              : "hover:bg-accent/50"
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
              className="rounded p-0.5 text-muted-foreground transition-all duration-100 hover:bg-accent hover:text-foreground active:scale-[0.98]"
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
              className="rounded p-0.5 text-muted-foreground transition-all duration-100 hover:bg-destructive/15 hover:text-destructive active:scale-[0.98]"
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
  }, [selectedFeature?.id, selectedIds, onToggleSelect, onSelectFeature, onEditFeature, onDeleteFeature]);

  if (minimal || layers.length === 0) {
    const defaultFeatureGroups = [
      { id: "regions", name: "Regions & Subdivisions", icon: Hexagon },
      { id: "cities", name: "Cities & Settlements", icon: MapPin },
      { id: "pois", name: "Points of Interest", icon: Landmark },
      { id: "storyPins", name: "Story Pins", icon: BookMarked },
      { id: "mapLabels", name: "Map Labels", icon: Type },
      { id: "routes", name: "Transport Routes", icon: Route },
    ];

    return (
      <div className="text-foreground flex flex-col text-xs select-none">
        <div className="flex flex-col">
          {defaultFeatureGroups.map((group) => {
            const Icon = group.icon;
            const groupFeats = groupedFeatures[group.id] ?? [];
            if (groupFeats.length === 0 && !featureCounts[group.id]) return null;
            const isExpanded = expandedLayers.has(group.id);

            return (
              <div key={group.id} className="border-border/40 border-b">
                <button
                  onClick={() => toggleLayerExpanded(group.id)}
                  className="hover:bg-accent/50 flex h-8 w-full items-center gap-1.5 px-2 text-left transition-colors"
                >
                  {isExpanded ? (
                    <ChevronDown className="text-muted-foreground h-3.5 w-3.5" />
                  ) : (
                    <ChevronRight className="text-muted-foreground h-3.5 w-3.5" />
                  )}
                  <Icon className="text-muted-foreground h-3.5 w-3.5" />
                  <span className="flex-1 truncate text-[11px] font-medium">{group.name}</span>
                  <span className="bg-muted text-muted-foreground rounded px-1.5 py-0.5 font-mono text-[9px]">
                    {groupFeats.length}
                  </span>
                </button>
                {isExpanded && (
                  <div className="flex flex-col gap-0.5 px-1 pb-1">
                    {groupFeats.map((feat: EditorFeature) => renderFeatureRow(feat))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col bg-card text-xs text-foreground select-none">
      <div className="border-b border-border/40 px-2 py-1 text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
        Layers & Features
      </div>
      <div className="flex flex-col">
        {layers.map((layer) => {
          const Icon = layer.icon;
          const layerFeatures = groupedFeatures[layer.id] ?? [];
          const count =
            featureCounts?.[layer.id] ??
            (layer.id === "border" || layer.id === "climate" ? undefined : layerFeatures.length);
          const isExpanded = expandedLayers.has(layer.id);
          const showOpacity = layer.id === "regions";

          return (
            <div key={layer.id} className="border-b border-border/40">
              {/* Layer Header Row */}
              <div
                className={`group flex h-8 items-center gap-1 px-1 hover:bg-accent/40 ${
                  !layer.visible ? "opacity-50" : ""
                }`}
              >
                {/* Expand Chevron */}
                {layer.id !== "border" && layer.id !== "climate" ? (
                  <button
                    onClick={() => toggleLayerExpanded(layer.id)}
                    className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground active:scale-[0.98]"
                  >
                    {isExpanded ? (
                      <ChevronDown className="h-3.5 w-3.5" />
                    ) : (
                      <ChevronRight className="h-3.5 w-3.5" />
                    )}
                  </button>
                ) : (
                  <span className="h-5 w-5 shrink-0" />
                )}

                {/* Visibility Toggle */}
                <button
                  onClick={() => onToggleVisibility?.(layer.id)}
                  className="flex h-5 w-5 shrink-0 items-center justify-center rounded hover:bg-accent active:scale-[0.98]"
                  title={layer.visible ? "Hide layer" : "Show layer"}
                >
                  {layer.visible ? (
                    <Eye className="h-3.5 w-3.5 text-foreground" />
                  ) : (
                    <EyeOff className="h-3.5 w-3.5 text-muted-foreground/60" />
                  )}
                </button>

                {/* Lock Toggle */}
                {layer.id !== "border" &&
                layer.id !== "country-border" &&
                layer.id !== "climate" ? (
                  <button
                    onClick={() => onToggleLock?.(layer.id)}
                    className="flex h-5 w-5 shrink-0 items-center justify-center rounded hover:bg-accent active:scale-[0.98]"
                    title={layer.locked ? "Unlock layer" : "Lock layer"}
                  >
                    {layer.locked ? (
                      <Lock className="h-3.5 w-3.5 text-amber-500" />
                    ) : (
                      <Unlock className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100" />
                    )}
                  </button>
                ) : (
                  <span className="h-5 w-5 shrink-0" />
                )}

                {/* Layer Icon */}
                <Icon className="ml-0.5 h-4 w-4 shrink-0 text-muted-foreground" />

                {/* Layer Name */}
                <span
                  onClick={() =>
                    layer.id !== "border" && layer.id !== "climate" && toggleLayerExpanded(layer.id)
                  }
                  className="ml-1 flex-1 cursor-pointer truncate text-[11px] leading-none font-medium"
                >
                  {layer.name}
                </span>

                {/* Badge Count */}
                {count !== undefined && count > 0 && (
                  <span className="mr-1.5 rounded bg-muted px-1 py-0.5 text-[9px] leading-none font-semibold text-muted-foreground">
                    {count}
                  </span>
                )}
              </div>

              {/* Layer Children (Opacity Slider and Features List) */}
              {isExpanded && (
                <div className="space-y-0.5 bg-muted/20 pb-1.5">
                  {/* Opacity slider for Regions */}
                  {showOpacity && (
                    <div className="mr-1.5 mb-1 ml-8 flex items-center gap-2 rounded bg-muted/30 px-3 py-1 text-[10px]">
                      <span className="text-muted-foreground">Opacity</span>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={Math.round((layer.opacity ?? 1) * 100)}
                        onChange={(e) =>
                          onOpacityChange?.(layer.id, parseInt(e.target.value, 10) / 100)
                        }
                        className="h-1 flex-1 cursor-pointer appearance-none rounded bg-muted accent-primary"
                      />
                      <span className="w-8 text-right text-muted-foreground">
                        {Math.round((layer.opacity ?? 1) * 100)}%
                      </span>
                    </div>
                  )}

                  {/* Feature items */}
                  {layerFeatures.length > 0 ? (
                    layerFeatures.map(renderFeatureRow)
                  ) : (
                    <div className="py-1 pl-8 text-[10px] text-muted-foreground/60 italic">
                      No features in this layer
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {/* Guides Section */}
        {guides !== undefined && (
          <div className="border-b border-border/40">
            <div
              className={`group flex h-8 items-center gap-1 px-1 hover:bg-accent/40 ${!showGuides ? "opacity-50" : ""}`}
            >
              {/* Expand Chevron */}
              <button
                onClick={() => setGuidesExpanded((prev) => !prev)}
                className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground active:scale-[0.98]"
              >
                {guidesExpanded ? (
                  <ChevronDown className="h-3.5 w-3.5" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5" />
                )}
              </button>

              {/* Visibility Toggle */}
              <button
                onClick={() => onToggleGuidesVisibility?.(!showGuides)}
                className="flex h-5 w-5 shrink-0 items-center justify-center rounded hover:bg-accent active:scale-[0.98]"
                title={showGuides ? "Hide guides" : "Show guides"}
              >
                {showGuides ? (
                  <Eye className="h-3.5 w-3.5 text-foreground" />
                ) : (
                  <EyeOff className="h-3.5 w-3.5 text-muted-foreground/60" />
                )}
              </button>

              {/* Clear All Guides */}
              {guides.length > 0 && (
                <button
                  onClick={() => onClearGuides?.()}
                  className="flex h-5 w-5 shrink-0 items-center justify-center rounded hover:bg-destructive/15 hover:text-destructive active:scale-[0.98]"
                  title="Clear all guides"
                >
                  <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                </button>
              )}
              {guides.length === 0 && <span className="h-5 w-5 shrink-0" />}

              {/* Icon */}
              <Ruler className="ml-0.5 h-4 w-4 shrink-0 text-muted-foreground" />

              {/* Title */}
              <span
                onClick={() => setGuidesExpanded((prev) => !prev)}
                className="ml-1 flex-1 cursor-pointer truncate text-[11px] leading-none font-medium"
              >
                Ruler Guides
              </span>

              {/* Count */}
              {guides.length > 0 && (
                <span className="mr-1.5 rounded bg-muted px-1 py-0.5 text-[9px] leading-none font-semibold text-muted-foreground">
                  {guides.length}
                </span>
              )}
            </div>

            {/* Guides Children */}
            {guidesExpanded && (
              <div className="space-y-0.5 bg-muted/20 pb-1.5">
                {guides.length > 0 ? (
                  guides.map((guide) => (
                    <div
                      key={guide.id}
                      className="group flex items-center gap-1.5 rounded px-2 py-1 pl-8 hover:bg-accent/50"
                    >
                      <div className="flex min-w-0 flex-1 items-center gap-2 text-left">
                        <span className="shrink-0 text-[9px] font-bold text-muted-foreground/70 uppercase">
                          {guide.type === "h" ? "Lat" : "Lng"}
                        </span>
                        <span className="text-foreground truncate text-[11px]">
                          {guide.type === "h" ? "Horizontal" : "Vertical"}: {guide.value.toFixed(5)}
                          °
                        </span>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteGuide?.(guide.id);
                        }}
                        className="rounded p-0.5 text-muted-foreground opacity-0 transition-colors group-hover:opacity-100 hover:bg-destructive/15 hover:text-destructive active:scale-[0.98]"
                        title="Delete Guide"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  ))
                ) : (
                  <div className="py-1 pl-8 text-[10px] text-muted-foreground/60 italic">
                    No guides (drag from rulers to add)
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
});
