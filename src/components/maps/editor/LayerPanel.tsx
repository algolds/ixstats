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
  Search,
  Xmark,
  SelectWindow,
  ModernTv as Mountain,
} from "iconoir-react";
import { WikiPreviewTooltip } from "~/components/maps/editor/WikiPreviewTooltip";
import { Badge } from "~/components/ui/badge";
import { Eyebrow } from "~/components/ui/eyebrow";
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
  /** Replace the multi-selection with these ids ("select all in layer"). */
  onSelectIds?: (ids: string[]) => void;
}

/** Rows rendered per group before asking the user to narrow the search. */
const MAX_ROWS_PER_GROUP = 250;

const TYPE_ICONS = {
  peak: Mountain,
  river: Route,
  lake: Hexagon,
  city: MapPin,
  subdivision: Hexagon,
  poi: Landmark,
  storyPin: BookMarked,
  mapLabel: Type,
  route: Route,
} as const;

const TYPE_COLORS = {
  peak: "text-stone-500",
  river: "text-sky-500",
  lake: "text-sky-500",
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
  onSelectIds,
}: LayerPanelProps) {
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLowerCase();
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
      geography: [],
    };

    for (const f of features) {
      if (normalizedQuery && !f.name.toLowerCase().includes(normalizedQuery)) continue;
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
      else if (f.type === "peak" || f.type === "river" || f.type === "lake")
        groups.geography?.push(f);
    }

    return groups;
  }, [features, normalizedQuery]);

  const matchCount = useMemo(
    () =>
      normalizedQuery
        ? features.filter((f) => f.name.toLowerCase().includes(normalizedQuery)).length
        : features.length,
    [features, normalizedQuery]
  );

  const firstMatch = useMemo(
    () =>
      normalizedQuery
        ? features.find((f) => f.name.toLowerCase().includes(normalizedQuery))
        : undefined,
    [features, normalizedQuery]
  );

  const searchBox = (
    <div className="border-border relative border-b px-2 py-1.5">
      <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-4 h-3 w-3 -translate-y-1/2" />
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && firstMatch && onSelectFeature) {
            e.preventDefault();
            onSelectFeature(firstMatch);
          } else if (e.key === "Escape") {
            e.stopPropagation();
            setQuery("");
            (e.target as HTMLInputElement).blur();
          }
        }}
        placeholder="Find a feature… (Enter zooms to it)"
        aria-label="Find a feature"
        className="border-border bg-background focus:ring-primary facet-refraction-none w-full rounded-md border py-1 pr-7 pl-7 text-xs outline-none focus:ring-1"
      />
      {query && (
        <button
          type="button"
          onClick={() => setQuery("")}
          className="text-muted-foreground hover:text-foreground absolute top-1/2 right-3.5 -translate-y-1/2 rounded p-0.5"
          aria-label="Clear search"
        >
          <Xmark className="h-3 w-3" />
        </button>
      )}
      {normalizedQuery && (
        <div className="text-muted-foreground mt-1 px-0.5 text-xs">
          {matchCount === 0 ? "No matches" : `${matchCount} match${matchCount === 1 ? "" : "es"}`}
        </div>
      )}
    </div>
  );

  const renderRows = (list: EditorFeature[]) => (
    <>
      {list.slice(0, MAX_ROWS_PER_GROUP).map((feat) => renderFeatureRow(feat))}
      {list.length > MAX_ROWS_PER_GROUP && (
        <div className="text-muted-foreground py-1 pl-8 text-xs italic">
          {list.length - MAX_ROWS_PER_GROUP} more — search to narrow the list
        </div>
      )}
    </>
  );

  const renderFeatureRow = useCallback(
    (feature: EditorFeature) => {
      const featureType = feature.type as keyof typeof TYPE_ICONS;
      const Icon = (featureType in TYPE_ICONS ? TYPE_ICONS[featureType] : null) || MapPin;
      const colorClass =
        (featureType in TYPE_COLORS
          ? TYPE_COLORS[featureType as keyof typeof TYPE_COLORS]
          : null) || "text-muted-foreground";
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
          className={`group flex items-center gap-1.5 rounded px-2 py-1.5 pl-8 transition-[color,background-color,border-color,box-shadow,opacity,transform] duration-100 ease-out select-none active:scale-[0.99] ${
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
            <span className="text-foreground truncate text-xs">{feature.name}</span>
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
                className="text-muted-foreground hover:bg-accent hover:text-foreground rounded p-0.5 transition-[color,background-color,border-color,box-shadow,opacity,transform] duration-100 active:scale-[0.98]"
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
                className="text-muted-foreground hover:bg-destructive/15 hover:text-destructive rounded p-0.5 transition-[color,background-color,border-color,box-shadow,opacity,transform] duration-100 active:scale-[0.98]"
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
    },
    [
      selectedFeature?.id,
      selectedIds,
      onToggleSelect,
      onSelectFeature,
      onEditFeature,
      onDeleteFeature,
    ]
  );

  if (minimal || layers.length === 0) {
    const defaultFeatureGroups = [
      { id: "regions", name: "Regions & Subdivisions", icon: Hexagon },
      { id: "cities", name: "Cities & Settlements", icon: MapPin },
      { id: "pois", name: "Points of Interest", icon: Landmark },
      { id: "storyPins", name: "Story Pins", icon: BookMarked },
      { id: "mapLabels", name: "Map Labels", icon: Type },
      { id: "routes", name: "Transport Routes", icon: Route },
      { id: "geography", name: "Peaks, Rivers & Lakes", icon: Mountain },
    ];

    return (
      <div className="text-foreground flex flex-col text-xs select-none">
        {searchBox}
        <div className="flex flex-col">
          {defaultFeatureGroups.map((group) => {
            const Icon = group.icon;
            const groupFeats = groupedFeatures[group.id] ?? [];
            if (groupFeats.length === 0 && (normalizedQuery || !featureCounts[group.id]))
              return null;
            const isExpanded = !!normalizedQuery || expandedLayers.has(group.id);

            return (
              <div key={group.id} className="border-border border-b">
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
                  <span className="flex-1 truncate text-xs font-medium">{group.name}</span>
                  <Badge variant="secondary" className="font-mono tabular-nums">
                    {groupFeats.length}
                  </Badge>
                </button>
                {isExpanded && (
                  <div className="flex flex-col gap-0.5 px-1 pb-1">{renderRows(groupFeats)}</div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="text-foreground flex flex-col text-xs select-none">
      <Eyebrow className="border-border block border-b px-2 py-1.5">Layers & features</Eyebrow>
      {searchBox}
      <div className="flex flex-col">
        {layers.map((layer) => {
          const Icon = layer.icon;
          const layerFeatures = groupedFeatures[layer.id] ?? [];
          const count =
            featureCounts?.[layer.id] ??
            (layer.id === "border" || layer.id === "climate" ? undefined : layerFeatures.length);
          const isExpanded =
            (!!normalizedQuery && layerFeatures.length > 0) || expandedLayers.has(layer.id);
          const showOpacity = layer.opacity !== undefined;
          if (
            normalizedQuery &&
            layerFeatures.length === 0 &&
            layer.id !== "border" &&
            layer.id !== "climate"
          ) {
            return null;
          }

          return (
            <div key={layer.id} className="border-border border-b">
              {/* Layer Header Row */}
              <div
                className={`group hover:bg-accent/40 flex h-8 items-center gap-1 px-1 ${
                  !layer.visible ? "opacity-50" : ""
                }`}
              >
                {/* Expand Chevron */}
                {layer.id !== "border" && layer.id !== "climate" ? (
                  <button
                    onClick={() => toggleLayerExpanded(layer.id)}
                    className="text-muted-foreground hover:bg-accent hover:text-foreground flex h-5 w-5 shrink-0 items-center justify-center rounded active:scale-[0.98]"
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
                  className="hover:bg-accent flex h-5 w-5 shrink-0 items-center justify-center rounded active:scale-[0.98]"
                  title={layer.visible ? "Hide layer" : "Show layer"}
                >
                  {layer.visible ? (
                    <Eye className="text-foreground h-3.5 w-3.5" />
                  ) : (
                    <EyeOff className="text-muted-foreground h-3.5 w-3.5" />
                  )}
                </button>

                {/* Lock Toggle */}
                {layer.id !== "border" &&
                layer.id !== "country-border" &&
                layer.id !== "climate" ? (
                  <button
                    onClick={() => onToggleLock?.(layer.id)}
                    className="hover:bg-accent flex h-5 w-5 shrink-0 items-center justify-center rounded active:scale-[0.98]"
                    title={layer.locked ? "Unlock layer" : "Lock layer"}
                  >
                    {layer.locked ? (
                      <Lock className="h-3.5 w-3.5 text-amber-500" />
                    ) : (
                      <Unlock className="text-muted-foreground h-3.5 w-3.5 opacity-0 group-hover:opacity-100" />
                    )}
                  </button>
                ) : (
                  <span className="h-5 w-5 shrink-0" />
                )}

                {/* Layer Icon */}
                <Icon className="text-muted-foreground ml-0.5 h-4 w-4 shrink-0" />

                {/* Layer Name */}
                <span
                  onClick={() =>
                    layer.id !== "border" && layer.id !== "climate" && toggleLayerExpanded(layer.id)
                  }
                  className="ml-1 flex-1 cursor-pointer truncate text-xs leading-none font-medium"
                >
                  {layer.name}
                </span>

                {/* Select every feature in this layer (for batch actions) */}
                {onSelectIds && layerFeatures.length > 0 && !layer.locked && (
                  <button
                    onClick={() => onSelectIds(layerFeatures.map((f) => f.id))}
                    className="text-muted-foreground hover:bg-accent hover:text-foreground flex h-5 w-5 shrink-0 items-center justify-center rounded opacity-0 group-hover:opacity-100 focus-visible:opacity-100 active:scale-[0.98]"
                    title={`Select all ${layer.name.toLowerCase()}`}
                    aria-label={`Select all ${layer.name}`}
                  >
                    <SelectWindow className="h-3.5 w-3.5" />
                  </button>
                )}

                {/* Badge Count */}
                {count !== undefined && count > 0 && (
                  <Badge variant="secondary" className="mr-1.5 tabular-nums">
                    {count}
                  </Badge>
                )}
              </div>

              {/* Layer Children (Opacity Slider and Features List) */}
              {isExpanded && (
                <div className="bg-muted/20 space-y-0.5 pb-1.5">
                  {/* Opacity slider for Regions */}
                  {showOpacity && (
                    <div className="bg-muted/30 mr-1.5 mb-1 ml-8 flex items-center gap-2 rounded px-3 py-1 text-xs">
                      <span className="text-muted-foreground">Opacity</span>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={Math.round((layer.opacity ?? 1) * 100)}
                        onChange={(e) =>
                          onOpacityChange?.(layer.id, parseInt(e.target.value, 10) / 100)
                        }
                        className="bg-muted accent-primary h-1 flex-1 cursor-pointer appearance-none rounded"
                      />
                      <span className="text-muted-foreground w-8 text-right">
                        {Math.round((layer.opacity ?? 1) * 100)}%
                      </span>
                    </div>
                  )}

                  {/* Feature items */}
                  {layerFeatures.length > 0 ? (
                    renderRows(layerFeatures)
                  ) : (
                    <div className="text-muted-foreground py-1 pl-8 text-xs italic">
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
          <div className="border-border border-b">
            <div
              className={`group hover:bg-accent/40 flex h-8 items-center gap-1 px-1 ${!showGuides ? "opacity-50" : ""}`}
            >
              {/* Expand Chevron */}
              <button
                onClick={() => setGuidesExpanded((prev) => !prev)}
                className="text-muted-foreground hover:bg-accent hover:text-foreground flex h-5 w-5 shrink-0 items-center justify-center rounded active:scale-[0.98]"
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
                className="hover:bg-accent flex h-5 w-5 shrink-0 items-center justify-center rounded active:scale-[0.98]"
                title={showGuides ? "Hide guides" : "Show guides"}
              >
                {showGuides ? (
                  <Eye className="text-foreground h-3.5 w-3.5" />
                ) : (
                  <EyeOff className="text-muted-foreground h-3.5 w-3.5" />
                )}
              </button>

              {/* Clear All Guides */}
              {guides.length > 0 && (
                <button
                  onClick={() => onClearGuides?.()}
                  className="hover:bg-destructive/15 hover:text-destructive flex h-5 w-5 shrink-0 items-center justify-center rounded active:scale-[0.98]"
                  title="Clear all guides"
                >
                  <Trash2 className="text-muted-foreground hover:text-destructive h-3.5 w-3.5" />
                </button>
              )}
              {guides.length === 0 && <span className="h-5 w-5 shrink-0" />}

              {/* Icon */}
              <Ruler className="text-muted-foreground ml-0.5 h-4 w-4 shrink-0" />

              {/* Title */}
              <span
                onClick={() => setGuidesExpanded((prev) => !prev)}
                className="ml-1 flex-1 cursor-pointer truncate text-xs leading-none font-medium"
              >
                Ruler Guides
              </span>

              {/* Count */}
              {guides.length > 0 && (
                <Badge variant="secondary" className="mr-1.5 tabular-nums">
                  {guides.length}
                </Badge>
              )}
            </div>

            {/* Guides Children */}
            {guidesExpanded && (
              <div className="bg-muted/20 space-y-0.5 pb-1.5">
                {guides.length > 0 ? (
                  guides.map((guide) => (
                    <div
                      key={guide.id}
                      className="group hover:bg-accent/50 flex items-center gap-1.5 rounded px-2 py-1 pl-8"
                    >
                      <div className="flex min-w-0 flex-1 items-center gap-2 text-left">
                        <span className="text-muted-foreground shrink-0 font-mono text-xs font-semibold">
                          {guide.type === "h" ? "Lat" : "Lng"}
                        </span>
                        <span className="text-foreground truncate text-xs">
                          {guide.type === "h" ? "Horizontal" : "Vertical"}: {guide.value.toFixed(5)}
                          °
                        </span>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteGuide?.(guide.id);
                        }}
                        className="text-muted-foreground hover:bg-destructive/15 hover:text-destructive rounded p-0.5 opacity-0 transition-colors group-hover:opacity-100 active:scale-[0.98]"
                        title="Delete Guide"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  ))
                ) : (
                  <div className="text-muted-foreground py-1 pl-8 text-xs italic">
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
