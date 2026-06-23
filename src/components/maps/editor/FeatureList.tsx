// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
"use client";

/**
 * FeatureList - List of existing map features (cities, subdivisions, POIs)
 * for the user's country. Groups are collapsible. Selecting a feature
 * auto-expands its group and scrolls it into view.
 */

// eslint-disable-next-line unused-imports/no-unused-imports
import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  MapPin,
  Hexagon,
  Landmark,
  Trash2,
  Pencil,
  Crown,
  ChevronDown,
  BookMarked,
  Type,
  Route,
} from "lucide-react";
import type { EditorFeature } from "~/hooks/useMapEditor";
import { WikiPreviewTooltip } from "~/components/maps/editor/WikiPreviewTooltip";

interface FeatureListProps {
  features: EditorFeature[];
  selectedFeature: EditorFeature | null;
  onSelectFeature: (feature: EditorFeature) => void;
  onEditFeature: (feature: EditorFeature) => void;
  onDeleteFeature: (feature: EditorFeature) => void;
  isLoading: boolean;
  /** Multi-select: IDs of selected features */
  selectedIds?: Set<string>;
  /** Multi-select: toggle a feature in/out of selection */
  onToggleSelect?: (id: string) => void;
  /** When true, all groups collapse (e.g. properties panel is open) */
  collapseAll?: boolean;
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

type FeatureType = "city" | "subdivision" | "poi" | "storyPin" | "mapLabel" | "route";

export const FeatureList = React.memo(function FeatureList({
  features,
  selectedFeature,
  onSelectFeature,
  onEditFeature,
  onDeleteFeature,
  isLoading,
  selectedIds,
  onToggleSelect,
  collapseAll,
}: FeatureListProps) {
  const [expandedGroups, setExpandedGroups] = useState<Set<FeatureType>>(
    () => new Set<FeatureType>(["city", "subdivision", "poi", "storyPin", "mapLabel", "route"])
  );

  // Track which groups have been fully expanded (for 50+ item groups)
  const [fullyExpandedGroups, setFullyExpandedGroups] = useState<Set<FeatureType>>(
    () => new Set<FeatureType>()
  );
  const TRUNCATE_THRESHOLD = 50;
  const TRUNCATE_SHOW = 20;

  // Collapse all groups when properties panel is active
  useEffect(() => {
    if (collapseAll) {
      setExpandedGroups(new Set());
    }
  }, [collapseAll]);
  const selectedRef = useRef<HTMLDivElement>(null);

  const toggleGroup = useCallback((type: FeatureType) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  }, []);

  // Auto-expand group when a feature is selected and scroll into view
  useEffect(() => {
    if (!selectedFeature) return;
    setExpandedGroups((prev) => {
      if (prev.has(selectedFeature.type as FeatureType)) return prev;
      const next = new Set(prev);
      next.add(selectedFeature.type as FeatureType);
      return next;
    });
    // Scroll after DOM updates
    requestAnimationFrame(() => {
      selectedRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    });
  }, [selectedFeature]);

  const groups = useMemo(() => {
    const cities: EditorFeature[] = [];
    const subdivisions: EditorFeature[] = [];
    const pois: EditorFeature[] = [];
    const storyPins: EditorFeature[] = [];
    const mapLabels: EditorFeature[] = [];
    const routes: EditorFeature[] = [];

    for (const f of features) {
      if (f.type === "city") cities.push(f);
      else if (f.type === "subdivision") subdivisions.push(f);
      else if (f.type === "poi") pois.push(f);
      else if (f.type === "storyPin") storyPins.push(f);
      else if (f.type === "mapLabel") mapLabels.push(f);
      else if (f.type === "route") routes.push(f);
    }

    return [
      { label: "Cities", items: cities, type: "city" as const },
      { label: "Regions", items: subdivisions, type: "subdivision" as const },
      { label: "Points of Interest", items: pois, type: "poi" as const },
      { label: "Story Pins", items: storyPins, type: "storyPin" as const },
      { label: "Map Labels", items: mapLabels, type: "mapLabel" as const },
      { label: "Routes", items: routes, type: "route" as const },
    ].filter((g) => g.items.length > 0);
  }, [features]);

  if (isLoading) {
    return (
      <div className="space-y-2 py-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-muted h-10 animate-pulse rounded-lg" />
        ))}
      </div>
    );
  }

  if (features.length === 0) {
    return (
      <div className="text-muted-foreground py-6 text-center text-xs">
        <span className="hidden sm:inline">
          No features yet. Use{" "}
          <kbd className="border-border bg-muted rounded border px-1 py-0.5 font-mono text-[10px]">
            C
          </kbd>{" "}
          <kbd className="border-border bg-muted rounded border px-1 py-0.5 font-mono text-[10px]">
            R
          </kbd>{" "}
          <kbd className="border-border bg-muted rounded border px-1 py-0.5 font-mono text-[10px]">
            P
          </kbd>{" "}
          to add features.
        </span>
        <span className="sm:hidden">
          No features yet. Use the toolbar to add cities, regions, or POIs.
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {groups.map((group) => {
        const isExpanded = expandedGroups.has(group.type);

        return (
          <div key={group.type}>
            {/* Collapsible group header */}
            <button
              onClick={() => toggleGroup(group.type)}
              className="hover:bg-accent flex w-full items-center gap-1.5 rounded-md px-1 py-1 text-left transition-colors"
            >
              <ChevronDown
                className={`text-muted-foreground h-3 w-3 shrink-0 transition-transform duration-150 ${
                  isExpanded ? "" : "-rotate-90"
                }`}
              />
              <span className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
                {group.label}
              </span>
              <span className="bg-muted text-muted-foreground rounded-full px-1.5 text-[10px] font-medium tabular-nums">
                {group.items.length}
              </span>
            </button>

            {/* Feature items (collapsible, with truncation for large groups) */}
            {isExpanded &&
              (() => {
                const isTruncated =
                  group.items.length > TRUNCATE_THRESHOLD && !fullyExpandedGroups.has(group.type);
                const visibleItems = isTruncated
                  ? group.items.slice(0, TRUNCATE_SHOW)
                  : group.items;

                return (
                  <div className="space-y-0.5 pl-1">
                    {visibleItems.map((feature) => {
                      const Icon = TYPE_ICONS[feature.type];
                      const colorClass = TYPE_COLORS[feature.type];
                      const isSelected = selectedFeature?.id === feature.id;
                      const isMultiSelected = selectedIds?.has(feature.id) ?? false;
                      const isCapital = feature.properties.isNationalCapital;
                      const wikiTitle = feature.properties.wikiPageTitle as string | undefined;

                      const row = (
                        <div
                          key={feature.id}
                          ref={isSelected ? selectedRef : undefined}
                          className={`group flex items-center gap-1.5 rounded-lg px-2 py-2.5 transition-colors sm:py-1.5 ${
                            isSelected
                              ? "bg-primary/10 ring-primary/30 ring-1"
                              : isMultiSelected
                                ? "bg-indigo-500/10 ring-1 ring-indigo-500/30"
                                : "hover:bg-accent active:bg-accent"
                          }`}
                        >
                          <button
                            onClick={(e) => {
                              if (e.shiftKey && onToggleSelect) {
                                onToggleSelect(feature.id);
                              } else {
                                onSelectFeature(feature);
                              }
                            }}
                            className="flex min-w-0 flex-1 items-center gap-2 text-left"
                          >
                            <Icon className={`h-3.5 w-3.5 shrink-0 ${colorClass}`} />
                            <span className="text-foreground truncate text-sm">{feature.name}</span>
                            {isCapital && (
                              <span title="National Capital">
                                <Crown className="h-3 w-3 shrink-0 text-amber-500" />
                              </span>
                            )}
                          </button>
                          <div
                            className={`flex items-center gap-0.5 transition-opacity ${isSelected ? "opacity-100" : "opacity-100 sm:opacity-0 sm:group-hover:opacity-100"}`}
                          >
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onEditFeature(feature);
                              }}
                              className="text-muted-foreground rounded p-2 transition-colors hover:bg-blue-100 hover:text-blue-600 active:bg-blue-100 active:text-blue-600 sm:p-1 dark:hover:bg-blue-500/10 dark:active:bg-blue-500/10"
                              title="Edit"
                            >
                              <Pencil className="h-4 w-4 sm:h-3 sm:w-3" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onDeleteFeature(feature);
                              }}
                              className="text-muted-foreground rounded p-2 transition-colors hover:bg-red-100 hover:text-red-600 active:bg-red-100 active:text-red-600 sm:p-1 dark:hover:bg-red-500/10 dark:active:bg-red-500/10"
                              title="Delete"
                            >
                              <Trash2 className="h-4 w-4 sm:h-3 sm:w-3" />
                            </button>
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
                    })}
                    {isTruncated && (
                      <button
                        onClick={() =>
                          setFullyExpandedGroups((prev) => {
                            const next = new Set(prev);
                            next.add(group.type);
                            return next;
                          })
                        }
                        className="text-primary hover:bg-accent w-full rounded-md px-2 py-1.5 text-xs font-medium transition-colors"
                      >
                        Show all {group.items.length} {group.label.toLowerCase()}
                      </button>
                    )}
                  </div>
                );
              })()}
          </div>
        );
      })}

      {/* Keyboard hints — desktop only */}
      <div className="border-border text-muted-foreground hidden border-t pt-2 text-[10px] sm:block">
        <div className="flex flex-wrap gap-x-3 gap-y-0.5 px-1">
          <span>
            <kbd className="border-border bg-muted rounded border px-1 font-mono">⌫</kbd> Delete
          </span>
          <span>
            <kbd className="border-border bg-muted rounded border px-1 font-mono">C</kbd> City
          </span>
          <span>
            <kbd className="border-border bg-muted rounded border px-1 font-mono">R</kbd> Region
          </span>
          <span>
            <kbd className="border-border bg-muted rounded border px-1 font-mono">P</kbd> POI
          </span>
          <span>
            <kbd className="border-border bg-muted rounded border px-1 font-mono">S</kbd> Story
          </span>
          <span>
            <kbd className="border-border bg-muted rounded border px-1 font-mono">L</kbd> Label
          </span>
        </div>
      </div>
    </div>
  );
});
