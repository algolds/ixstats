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
import { Slider } from "~/components/ui/slider";
import { Button } from "~/components/ui/button";

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
  peak: "text-label-secondary",
  river: "text-blue",
  lake: "text-blue",
  city: "text-blue",
  subdivision: "text-indigo",
  poi: "text-yellow",
  storyPin: "text-yellow",
  mapLabel: "text-label-secondary",
  route: "text-indigo",
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
    <div className="border-separator relative border-b px-2 py-2">
      <Search className="text-label-secondary pointer-events-none absolute top-1/2 left-4 h-3 w-3 -translate-y-1/2" />
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
        className="border-separator bg-surface focus:ring-tint rounded-control-sm text-footnote w-full border py-1 pr-7 pl-7 outline-none focus:ring-1"
      />
      {query && (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={() => setQuery("")}
          aria-label="Clear search"
          className="text-label-secondary hover:text-label rounded-control-sm absolute top-1/2 right-4 size-5 -translate-y-1/2"
        >
          <Xmark className="h-3 w-3" />
        </Button>
      )}
      {normalizedQuery && (
        <div className="text-label-secondary text-footnote mt-1 px-0.5">
          {matchCount === 0 ? "No matches" : `${matchCount} match${matchCount === 1 ? "" : "es"}`}
        </div>
      )}
    </div>
  );

  const renderRows = (list: EditorFeature[]) => (
    <>
      {list.slice(0, MAX_ROWS_PER_GROUP).map((feat) => renderFeatureRow(feat))}
      {list.length > MAX_ROWS_PER_GROUP && (
        <div className="text-label-secondary text-footnote py-1 pl-8 italic">
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
          : null) || "text-label-secondary";
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
          className={`group rounded-control-sm flex items-center gap-2 px-2 py-2 pl-8 transition-[color,background-color,border-color,box-shadow,opacity,transform] duration-100 ease-out select-none active:scale-[0.99] ${
            isSelected
              ? "bg-tint-fill ring-tint/30 font-semibold ring-1"
              : isMultiSelected
                ? "bg-tint-fill ring-tint/40 ring-1"
                : "hover:bg-fill-3"
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
            <span className="text-label text-footnote truncate">{feature.name}</span>
            {isCapital && (
              <span title="National Capital">
                <Crown className="text-yellow h-2.5 w-2.5 shrink-0" />
              </span>
            )}
          </button>
          <div
            className={`flex items-center gap-0.5 transition-opacity ${
              isSelected ? "opacity-100" : "opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
            }`}
          >
            {onEditFeature && (
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={(e) => {
                  e.stopPropagation();
                  onEditFeature(feature);
                }}
                title="Edit"
                aria-label="Edit"
                className="text-label-secondary hover:bg-fill-3 hover:text-label rounded-control-sm size-5"
              >
                <Pencil className="h-3 w-3" />
              </Button>
            )}
            {onDeleteFeature && (
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteFeature(feature);
                }}
                title="Delete"
                aria-label="Delete"
                className="text-label-secondary hover:bg-destructive/15 hover:text-destructive rounded-control-sm size-5"
              >
                <Trash2 className="h-3 w-3" />
              </Button>
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
      <div className="text-label text-footnote flex flex-col select-none">
        {searchBox}
        <div className="flex flex-col">
          {defaultFeatureGroups.map((group) => {
            const Icon = group.icon;
            const groupFeats = groupedFeatures[group.id] ?? [];
            if (groupFeats.length === 0 && (normalizedQuery || !featureCounts[group.id]))
              return null;
            const isExpanded = !!normalizedQuery || expandedLayers.has(group.id);

            return (
              <div key={group.id} className="border-separator border-b">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  aria-expanded={isExpanded}
                  onClick={() => toggleLayerExpanded(group.id)}
                  className="h-auto min-h-(--control-height-sm) w-full justify-start gap-2 py-2 text-left whitespace-normal"
                >
                  {isExpanded ? (
                    <ChevronDown className="text-label-secondary h-3.5 w-3.5" />
                  ) : (
                    <ChevronRight className="text-label-secondary h-3.5 w-3.5" />
                  )}
                  <Icon className="text-label-secondary h-3.5 w-3.5" />
                  <span className="text-caption flex-1 truncate">{group.name}</span>
                  <Badge variant="default" className="tabular-nums">
                    {groupFeats.length}
                  </Badge>
                </Button>
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
    <div className="text-label text-footnote flex flex-col select-none">
      <Eyebrow className="border-separator block border-b px-2 py-2">Layers & features</Eyebrow>
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
            <div key={layer.id} className="border-separator border-b">
              {/* Layer Header Row */}
              <div
                className={`group hover:bg-fill-3 flex h-8 items-center gap-1 px-1 ${
                  !layer.visible ? "opacity-50" : ""
                }`}
              >
                {/* Expand Chevron */}
                {layer.id !== "border" && layer.id !== "climate" ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => toggleLayerExpanded(layer.id)}
                    aria-expanded={isExpanded}
                    aria-label={isExpanded ? `Collapse ${layer.name}` : `Expand ${layer.name}`}
                    className="text-label-secondary hover:text-label rounded-control-sm size-5"
                  >
                    {isExpanded ? (
                      <ChevronDown className="h-3.5 w-3.5" />
                    ) : (
                      <ChevronRight className="h-3.5 w-3.5" />
                    )}
                  </Button>
                ) : (
                  <span className="h-5 w-5 shrink-0" />
                )}

                {/* Visibility Toggle */}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => onToggleVisibility?.(layer.id)}
                  title={layer.visible ? "Hide layer" : "Show layer"}
                  aria-label={layer.visible ? "Hide layer" : "Show layer"}
                  className="hover:bg-fill-3 rounded-control-sm size-5 shrink-0"
                >
                  {layer.visible ? (
                    <Eye className="text-label h-3.5 w-3.5" />
                  ) : (
                    <EyeOff className="text-label-secondary h-3.5 w-3.5" />
                  )}
                </Button>

                {/* Lock Toggle */}
                {layer.id !== "border" &&
                layer.id !== "country-border" &&
                layer.id !== "climate" ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => onToggleLock?.(layer.id)}
                    title={layer.locked ? "Unlock layer" : "Lock layer"}
                    aria-label={layer.locked ? "Unlock layer" : "Lock layer"}
                    className="hover:bg-fill-3 rounded-control-sm size-5 shrink-0"
                  >
                    {layer.locked ? (
                      <Lock className="text-yellow h-3.5 w-3.5" />
                    ) : (
                      <Unlock className="text-label-secondary h-3.5 w-3.5 opacity-0 group-hover:opacity-100" />
                    )}
                  </Button>
                ) : (
                  <span className="h-5 w-5 shrink-0" />
                )}

                {/* Layer Icon */}
                <Icon className="text-label-secondary ml-0.5 h-4 w-4 shrink-0" />

                {/* Layer Name */}
                <span
                  onClick={() =>
                    layer.id !== "border" && layer.id !== "climate" && toggleLayerExpanded(layer.id)
                  }
                  className="text-caption ml-1 flex-1 cursor-pointer truncate leading-none"
                >
                  {layer.name}
                </span>

                {/* Select every feature in this layer (for batch actions) */}
                {onSelectIds && layerFeatures.length > 0 && !layer.locked && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => onSelectIds(layerFeatures.map((f) => f.id))}
                    title={`Select all ${layer.name.toLowerCase()}`}
                    aria-label={`Select all ${layer.name}`}
                    className="text-label-secondary hover:bg-fill-3 hover:text-label rounded-control-sm size-5 shrink-0 opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
                  >
                    <SelectWindow className="h-3.5 w-3.5" />
                  </Button>
                )}

                {/* Badge Count */}
                {count !== undefined && count > 0 && (
                  <Badge variant="default" className="mr-2 tabular-nums">
                    {count}
                  </Badge>
                )}
              </div>

              {/* Layer Children (Opacity Slider and Features List) */}
              {isExpanded && (
                <div className="bg-fill-4 space-y-0.5 pb-2">
                  {/* Opacity slider for Regions */}
                  {showOpacity && (
                    <div className="bg-fill-4 text-footnote rounded-control-sm mr-2 mb-1 ml-8 flex items-center gap-2 px-3 py-1">
                      <span className="text-label-secondary">Opacity</span>
                      <Slider
                        aria-label="Opacity"
                        min={0}
                        max={100}
                        value={[Math.round((layer.opacity ?? 1) * 100)]}
                        onValueChange={([v]) =>
                          v !== undefined && onOpacityChange?.(layer.id, v / 100)
                        }
                        className="flex-1 py-2"
                      />
                      <span className="text-label-secondary w-8 text-right">
                        {Math.round((layer.opacity ?? 1) * 100)}%
                      </span>
                    </div>
                  )}

                  {/* Feature items */}
                  {layerFeatures.length > 0 ? (
                    renderRows(layerFeatures)
                  ) : (
                    <div className="text-label-secondary text-footnote py-1 pl-8 italic">
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
          <div className="border-separator border-b">
            <div
              className={`group hover:bg-fill-3 flex h-8 items-center gap-1 px-1 ${!showGuides ? "opacity-50" : ""}`}
            >
              {/* Expand Chevron */}
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => setGuidesExpanded((prev) => !prev)}
                aria-expanded={guidesExpanded}
                aria-label={guidesExpanded ? "Collapse guides" : "Expand guides"}
                className="text-label-secondary hover:text-label rounded-control-sm size-5"
              >
                {guidesExpanded ? (
                  <ChevronDown className="h-3.5 w-3.5" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5" />
                )}
              </Button>

              {/* Visibility Toggle */}
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => onToggleGuidesVisibility?.(!showGuides)}
                title={showGuides ? "Hide guides" : "Show guides"}
                aria-label={showGuides ? "Hide guides" : "Show guides"}
                className="hover:bg-fill-3 rounded-control-sm size-5 shrink-0"
              >
                {showGuides ? (
                  <Eye className="text-label h-3.5 w-3.5" />
                ) : (
                  <EyeOff className="text-label-secondary h-3.5 w-3.5" />
                )}
              </Button>

              {/* Clear All Guides */}
              {guides.length > 0 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => onClearGuides?.()}
                  title="Clear all guides"
                  aria-label="Clear all guides"
                  className="hover:bg-destructive/15 hover:text-destructive rounded-control-sm size-5 shrink-0"
                >
                  <Trash2 className="text-label-secondary hover:text-destructive h-3.5 w-3.5" />
                </Button>
              )}
              {guides.length === 0 && <span className="h-5 w-5 shrink-0" />}

              {/* Icon */}
              <Ruler className="text-label-secondary ml-0.5 h-4 w-4 shrink-0" />

              {/* Title */}
              <span
                onClick={() => setGuidesExpanded((prev) => !prev)}
                className="text-caption ml-1 flex-1 cursor-pointer truncate leading-none"
              >
                Ruler Guides
              </span>

              {/* Count */}
              {guides.length > 0 && (
                <Badge variant="default" className="mr-2 tabular-nums">
                  {guides.length}
                </Badge>
              )}
            </div>

            {/* Guides Children */}
            {guidesExpanded && (
              <div className="bg-fill-4 space-y-0.5 pb-2">
                {guides.length > 0 ? (
                  guides.map((guide) => (
                    <div
                      key={guide.id}
                      className="group hover:bg-fill-3 rounded-control-sm flex items-center gap-2 px-2 py-1 pl-8"
                    >
                      <div className="flex min-w-0 flex-1 items-center gap-2 text-left">
                        <span className="text-label-secondary text-caption shrink-0 font-mono font-semibold">
                          {guide.type === "h" ? "Lat" : "Lng"}
                        </span>
                        <span className="text-label text-footnote truncate">
                          {guide.type === "h" ? "Horizontal" : "Vertical"}: {guide.value.toFixed(5)}
                          °
                        </span>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteGuide?.(guide.id);
                        }}
                        title="Delete Guide"
                        aria-label="Delete Guide"
                        className="text-label-secondary hover:bg-destructive/15 hover:text-destructive rounded-control-sm size-5 opacity-0 group-hover:opacity-100"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  ))
                ) : (
                  <div className="text-label-secondary text-footnote py-1 pl-8 italic">
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
