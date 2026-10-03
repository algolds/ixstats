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
import { cn } from "~/lib/utils/cn";

interface LayerState {
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

/** Panel groups each feature type is listed under (story pins and labels answer to two keys). */
const GROUPS_BY_TYPE: Record<string, string[]> = {
  subdivision: ["regions"],
  city: ["cities"],
  poi: ["pois"],
  storyPin: ["stories", "storyPins"],
  mapLabel: ["labels", "mapLabels"],
  route: ["routes"],
  peak: ["geography"],
  river: ["geography"],
  lake: ["geography"],
};

const MINIMAL_GROUPS = [
  { id: "regions", name: "Regions & Subdivisions", icon: Hexagon },
  { id: "cities", name: "Cities & Settlements", icon: MapPin },
  { id: "pois", name: "Points of Interest", icon: Landmark },
  { id: "storyPins", name: "Story Pins", icon: BookMarked },
  { id: "mapLabels", name: "Map Labels", icon: Type },
  { id: "routes", name: "Transport Routes", icon: Route },
  { id: "geography", name: "Peaks, Rivers & Lakes", icon: Mountain },
];

/** Layers that are toggled elsewhere and have neither a feature list nor a lock. */
const isStaticLayer = (id: string) => id === "border" || id === "climate";

type FeatureAction = (feature: EditorFeature) => void;

function IconButton({ className, ...props }: React.ComponentProps<typeof Button>) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      className={cn("rounded-control-sm size-5", className)}
      {...props}
    />
  );
}

function ExpandButton({
  expanded,
  label,
  onClick,
}: {
  expanded: boolean;
  label: string;
  onClick: () => void;
}) {
  const Chevron = expanded ? ChevronDown : ChevronRight;
  return (
    <IconButton
      onClick={onClick}
      aria-expanded={expanded}
      aria-label={`${expanded ? "Collapse" : "Expand"} ${label}`}
      className="text-label-secondary hover:text-label"
    >
      <Chevron className="h-3.5 w-3.5" />
    </IconButton>
  );
}

function VisibilityButton({
  visible,
  noun,
  onClick,
}: {
  visible: boolean;
  noun: string;
  onClick: () => void;
}) {
  const label = `${visible ? "Hide" : "Show"} ${noun}`;
  return (
    <IconButton
      onClick={onClick}
      title={label}
      aria-label={label}
      className="hover:bg-fill-3 shrink-0"
    >
      {visible ? (
        <Eye className="text-label h-3.5 w-3.5" />
      ) : (
        <EyeOff className="text-label-secondary h-3.5 w-3.5" />
      )}
    </IconButton>
  );
}

const Spacer = () => <span className="h-5 w-5 shrink-0" />;

const emptyNote = (text: string) => (
  <div className="text-label-secondary text-footnote py-1 pl-8 italic">{text}</div>
);

interface FeatureRowProps {
  feature: EditorFeature;
  isSelected: boolean;
  isMultiSelected: boolean;
  onSelect?: FeatureAction;
  onToggleSelect?: (id: string) => void;
  onEdit?: FeatureAction;
  onDelete?: FeatureAction;
}

function FeatureRow({
  feature,
  isSelected,
  isMultiSelected,
  onSelect,
  onToggleSelect,
  onEdit,
  onDelete,
}: FeatureRowProps) {
  const type = feature.type as keyof typeof TYPE_ICONS;
  const Icon = TYPE_ICONS[type] ?? MapPin;
  const colorClass = TYPE_COLORS[type as keyof typeof TYPE_COLORS] ?? "text-label-secondary";
  const wikiTitle =
    typeof feature.properties?.wikiPageTitle === "string"
      ? feature.properties.wikiPageTitle
      : undefined;

  const row = (
    <div
      className={`group rounded-control-sm flex items-center gap-2 px-2 py-2 pl-8 transition-[color,background-color,border-color,box-shadow,opacity] duration-100 ease-out select-none ${
        isSelected
          ? "bg-tint-fill ring-tint/30 font-semibold ring-1"
          : isMultiSelected
            ? "bg-tint-fill ring-tint/40 ring-1"
            : "hover:bg-fill-3"
      }`}
    >
      <button
        onClick={(e) => {
          if (e.shiftKey && onToggleSelect) onToggleSelect(feature.id);
          else onSelect?.(feature);
        }}
        className="flex min-w-0 flex-1 items-center gap-2 text-left"
      >
        <Icon className={`h-3 w-3 shrink-0 ${colorClass}`} />
        <span className="text-label text-footnote truncate">{feature.name}</span>
        {Boolean(feature.properties?.isNationalCapital) && (
          <span title="National capital">
            <Crown className="text-yellow h-2.5 w-2.5 shrink-0" />
          </span>
        )}
      </button>
      <div
        className={`flex items-center gap-0.5 transition-opacity ${
          isSelected ? "opacity-100" : "opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
        }`}
      >
        {onEdit && (
          <IconButton
            onClick={(e) => {
              e.stopPropagation();
              onEdit(feature);
            }}
            title="Edit"
            aria-label="Edit"
            className="text-label-secondary hover:bg-fill-3 hover:text-label"
          >
            <Pencil className="h-3 w-3" />
          </IconButton>
        )}
        {onDelete && (
          <IconButton
            onClick={(e) => {
              e.stopPropagation();
              onDelete(feature);
            }}
            title="Delete"
            aria-label="Delete"
            className="text-label-secondary hover:bg-destructive/15 hover:text-destructive"
          >
            <Trash2 className="h-3 w-3" />
          </IconButton>
        )}
      </div>
    </div>
  );

  return wikiTitle ? <WikiPreviewTooltip wikiTitle={wikiTitle}>{row}</WikiPreviewTooltip> : row;
}

type FeatureRowsProps = Omit<FeatureRowProps, "feature" | "isSelected" | "isMultiSelected"> & {
  list: EditorFeature[];
  selectedId?: string;
  selectedIds?: Set<string>;
};

function FeatureRows({ list, selectedId, selectedIds, ...handlers }: FeatureRowsProps) {
  return (
    <>
      {list.slice(0, MAX_ROWS_PER_GROUP).map((feature) => (
        <FeatureRow
          key={feature.id}
          feature={feature}
          isSelected={selectedId === feature.id}
          isMultiSelected={selectedIds?.has(feature.id) ?? false}
          {...handlers}
        />
      ))}
      {list.length > MAX_ROWS_PER_GROUP &&
        emptyNote(`${list.length - MAX_ROWS_PER_GROUP} more; search to narrow the list`)}
    </>
  );
}

function SearchBox({
  query,
  onQueryChange,
  matchCount,
  onEnter,
}: {
  query: string;
  onQueryChange: (query: string) => void;
  matchCount: number;
  onEnter?: () => void;
}) {
  return (
    <div className="border-separator relative border-b px-2 py-2">
      <Search className="text-label-secondary pointer-events-none absolute top-1/2 left-4 h-3 w-3 -translate-y-1/2" />
      <input
        type="search"
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && onEnter) {
            e.preventDefault();
            onEnter();
          } else if (e.key === "Escape") {
            e.stopPropagation();
            onQueryChange("");
            (e.target as HTMLInputElement).blur();
          }
        }}
        placeholder="Find a feature… (Enter zooms to it)"
        aria-label="Find a feature"
        className="border-separator bg-surface focus:ring-tint rounded-control-sm text-footnote w-full border py-1 pr-7 pl-7 outline-none focus:ring-1"
      />
      {query && (
        <IconButton
          onClick={() => onQueryChange("")}
          aria-label="Clear search"
          className="text-label-secondary hover:text-label absolute top-1/2 right-4 -translate-y-1/2"
        >
          <Xmark className="h-3 w-3" />
        </IconButton>
      )}
      {query.trim() && (
        <div className="text-label-secondary text-footnote mt-1 px-0.5">
          {matchCount === 0 ? "No matches" : `${matchCount} match${matchCount === 1 ? "" : "es"}`}
        </div>
      )}
    </div>
  );
}

interface LayerRowProps {
  layer: LayerState;
  layerFeatures: EditorFeature[];
  count: number | undefined;
  isExpanded: boolean;
  onToggleExpanded: () => void;
  onToggleVisibility?: (layerId: string) => void;
  onToggleLock?: (layerId: string) => void;
  onOpacityChange?: (layerId: string, opacity: number) => void;
  onSelectIds?: (ids: string[]) => void;
  rows: Omit<FeatureRowsProps, "list">;
}

function LayerRow({
  layer,
  layerFeatures,
  count,
  isExpanded,
  onToggleExpanded,
  onToggleVisibility,
  onToggleLock,
  onOpacityChange,
  onSelectIds,
  rows,
}: LayerRowProps) {
  const isStatic = isStaticLayer(layer.id);
  const Icon = layer.icon;
  const opacityPercent = Math.round((layer.opacity ?? 1) * 100);

  return (
    <div className="border-separator border-b">
      <div
        className={`group hover:bg-fill-3 flex h-8 items-center gap-1 px-1 ${
          !layer.visible ? "opacity-50" : ""
        }`}
      >
        {isStatic ? (
          <Spacer />
        ) : (
          <ExpandButton expanded={isExpanded} label={layer.name} onClick={onToggleExpanded} />
        )}

        <VisibilityButton
          visible={layer.visible}
          noun="layer"
          onClick={() => onToggleVisibility?.(layer.id)}
        />

        {isStatic || layer.id === "country-border" ? (
          <Spacer />
        ) : (
          <IconButton
            onClick={() => onToggleLock?.(layer.id)}
            title={layer.locked ? "Unlock layer" : "Lock layer"}
            aria-label={layer.locked ? "Unlock layer" : "Lock layer"}
            className="hover:bg-fill-3 shrink-0"
          >
            {layer.locked ? (
              <Lock className="text-yellow h-3.5 w-3.5" />
            ) : (
              <Unlock className="text-label-secondary h-3.5 w-3.5 opacity-0 group-hover:opacity-100" />
            )}
          </IconButton>
        )}

        <Icon className="text-label-secondary ml-0.5 h-4 w-4 shrink-0" />

        <span
          onClick={() => !isStatic && onToggleExpanded()}
          className="text-caption ml-1 flex-1 cursor-pointer truncate leading-none"
        >
          {layer.name}
        </span>

        {/* Select every feature in this layer (for batch actions) */}
        {onSelectIds && layerFeatures.length > 0 && !layer.locked && (
          <IconButton
            onClick={() => onSelectIds(layerFeatures.map((f) => f.id))}
            title={`Select all ${layer.name.toLowerCase()}`}
            aria-label={`Select all ${layer.name}`}
            className="text-label-secondary hover:bg-fill-3 hover:text-label shrink-0 opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
          >
            <SelectWindow className="h-3.5 w-3.5" />
          </IconButton>
        )}

        {count !== undefined && count > 0 && (
          <Badge variant="default" className="mr-2 tabular-nums">
            {count}
          </Badge>
        )}
      </div>

      {isExpanded && (
        <div className="bg-fill-4 space-y-0.5 pb-2">
          {layer.opacity !== undefined && (
            <div className="bg-fill-4 text-footnote rounded-control-sm mr-2 mb-1 ml-8 flex items-center gap-2 px-3 py-1">
              <span className="text-label-secondary">Opacity</span>
              <Slider
                aria-label="Opacity"
                min={0}
                max={100}
                value={[opacityPercent]}
                onValueChange={([v]) => v !== undefined && onOpacityChange?.(layer.id, v / 100)}
                className="flex-1 py-2"
              />
              <span className="text-label-secondary w-8 text-right">{opacityPercent}%</span>
            </div>
          )}

          {layerFeatures.length > 0 ? (
            <FeatureRows list={layerFeatures} {...rows} />
          ) : (
            emptyNote("No features in this layer")
          )}
        </div>
      )}
    </div>
  );
}

type Guide = NonNullable<LayerPanelProps["guides"]>[number];

function GuidesSection({
  guides,
  showGuides,
  onToggleGuidesVisibility,
  onClearGuides,
  onDeleteGuide,
}: {
  guides: Guide[];
  showGuides: boolean;
  onToggleGuidesVisibility?: (visible: boolean) => void;
  onClearGuides?: () => void;
  onDeleteGuide?: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(true);

  return (
    <div className="border-separator border-b">
      <div
        className={`group hover:bg-fill-3 flex h-8 items-center gap-1 px-1 ${!showGuides ? "opacity-50" : ""}`}
      >
        <ExpandButton expanded={expanded} label="guides" onClick={() => setExpanded((v) => !v)} />
        <VisibilityButton
          visible={showGuides}
          noun="guides"
          onClick={() => onToggleGuidesVisibility?.(!showGuides)}
        />

        {guides.length > 0 ? (
          <IconButton
            onClick={() => onClearGuides?.()}
            title="Clear all guides"
            aria-label="Clear all guides"
            className="hover:bg-destructive/15 hover:text-destructive shrink-0"
          >
            <Trash2 className="text-label-secondary hover:text-destructive h-3.5 w-3.5" />
          </IconButton>
        ) : (
          <Spacer />
        )}

        <Ruler className="text-label-secondary ml-0.5 h-4 w-4 shrink-0" />

        <span
          onClick={() => setExpanded((v) => !v)}
          className="text-caption ml-1 flex-1 cursor-pointer truncate leading-none"
        >
          Ruler guides
        </span>

        {guides.length > 0 && (
          <Badge variant="default" className="mr-2 tabular-nums">
            {guides.length}
          </Badge>
        )}
      </div>

      {expanded && (
        <div className="bg-fill-4 space-y-0.5 pb-2">
          {guides.length > 0
            ? guides.map((guide) => (
                <div
                  key={guide.id}
                  className="group hover:bg-fill-3 rounded-control-sm flex items-center gap-2 px-2 py-1 pl-8"
                >
                  <div className="flex min-w-0 flex-1 items-center gap-2 text-left">
                    <span className="text-label-secondary text-caption shrink-0 font-mono font-semibold">
                      {guide.type === "h" ? "Lat" : "Lng"}
                    </span>
                    <span className="text-label text-footnote truncate">
                      {guide.type === "h" ? "Horizontal" : "Vertical"}: {guide.value.toFixed(5)}°
                    </span>
                  </div>
                  <IconButton
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteGuide?.(guide.id);
                    }}
                    title="Delete guide"
                    aria-label="Delete guide"
                    className="text-label-secondary hover:bg-destructive/15 hover:text-destructive opacity-0 group-hover:opacity-100"
                  >
                    <Trash2 className="h-3 w-3" />
                  </IconButton>
                </div>
              ))
            : emptyNote("No guides (drag from rulers to add)")}
        </div>
      )}
    </div>
  );
}

function MinimalGroup({
  group,
  features,
  isExpanded,
  onToggle,
  rows,
}: {
  group: (typeof MINIMAL_GROUPS)[number];
  features: EditorFeature[];
  isExpanded: boolean;
  onToggle: () => void;
  rows: Omit<FeatureRowsProps, "list">;
}) {
  const Icon = group.icon;
  const Chevron = isExpanded ? ChevronDown : ChevronRight;
  return (
    <div className="border-separator border-b">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        aria-expanded={isExpanded}
        onClick={onToggle}
        className="h-auto min-h-(--control-height-sm) w-full justify-start gap-2 py-2 text-left whitespace-normal"
      >
        <Chevron className="text-label-secondary h-3.5 w-3.5" />
        <Icon className="text-label-secondary h-3.5 w-3.5" />
        <span className="text-caption flex-1 truncate">{group.name}</span>
        <Badge variant="default" className="tabular-nums">
          {features.length}
        </Badge>
      </Button>
      {isExpanded && (
        <div className="flex flex-col gap-0.5 px-1 pb-1">
          <FeatureRows list={features} {...rows} />
        </div>
      )}
    </div>
  );
}

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
  onSelectIds,
}: LayerPanelProps) {
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLowerCase();
  // Regions and cities start expanded
  const [expandedLayers, setExpandedLayers] = useState<Set<string>>(
    () => new Set(["regions", "cities"])
  );

  const toggleLayerExpanded = useCallback((layerId: string) => {
    setExpandedLayers((prev) => {
      const next = new Set(prev);
      if (!next.delete(layerId)) next.add(layerId);
      return next;
    });
  }, []);

  const matches = useMemo(
    () =>
      normalizedQuery
        ? features.filter((f) => f.name.toLowerCase().includes(normalizedQuery))
        : features,
    [features, normalizedQuery]
  );

  const groupedFeatures = useMemo(() => {
    const groups: Record<string, EditorFeature[]> = {};
    for (const f of matches) {
      for (const key of GROUPS_BY_TYPE[f.type] ?? []) (groups[key] ??= []).push(f);
    }
    return groups;
  }, [matches]);

  const firstMatch = normalizedQuery ? matches[0] : undefined;
  const searchBox = (
    <SearchBox
      query={query}
      onQueryChange={setQuery}
      matchCount={matches.length}
      onEnter={firstMatch && onSelectFeature ? () => onSelectFeature(firstMatch) : undefined}
    />
  );

  const rows: Omit<FeatureRowsProps, "list"> = {
    selectedId: selectedFeature?.id,
    selectedIds,
    onSelect: onSelectFeature,
    onToggleSelect,
    onEdit: onEditFeature,
    onDelete: onDeleteFeature,
  };

  if (minimal || layers.length === 0) {
    return (
      <div className="text-label text-footnote flex flex-col select-none">
        {searchBox}
        <div className="flex flex-col">
          {MINIMAL_GROUPS.map((group) => {
            const groupFeatures = groupedFeatures[group.id] ?? [];
            if (groupFeatures.length === 0 && (normalizedQuery || !featureCounts[group.id])) {
              return null;
            }
            return (
              <MinimalGroup
                key={group.id}
                group={group}
                features={groupFeatures}
                isExpanded={!!normalizedQuery || expandedLayers.has(group.id)}
                onToggle={() => toggleLayerExpanded(group.id)}
                rows={rows}
              />
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
          const layerFeatures = groupedFeatures[layer.id] ?? [];
          const isStatic = isStaticLayer(layer.id);
          if (normalizedQuery && layerFeatures.length === 0 && !isStatic) return null;

          return (
            <LayerRow
              key={layer.id}
              layer={layer}
              layerFeatures={layerFeatures}
              count={featureCounts[layer.id] ?? (isStatic ? undefined : layerFeatures.length)}
              isExpanded={
                (!!normalizedQuery && layerFeatures.length > 0) || expandedLayers.has(layer.id)
              }
              onToggleExpanded={() => toggleLayerExpanded(layer.id)}
              onToggleVisibility={onToggleVisibility}
              onToggleLock={onToggleLock}
              onOpacityChange={onOpacityChange}
              onSelectIds={onSelectIds}
              rows={rows}
            />
          );
        })}

        {guides !== undefined && (
          <GuidesSection
            guides={guides}
            showGuides={showGuides}
            onToggleGuidesVisibility={onToggleGuidesVisibility}
            onClearGuides={onClearGuides}
            onDeleteGuide={onDeleteGuide}
          />
        )}
      </div>
    </div>
  );
});
