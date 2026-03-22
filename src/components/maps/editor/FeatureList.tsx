"use client";

/**
 * FeatureList - List of existing map features (cities, subdivisions, POIs)
 * for the user's country. Groups are collapsible. Selecting a feature
 * auto-expands its group and scrolls it into view.
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { MapPin, Hexagon, Landmark, Trash2, Pencil, Crown, ChevronDown } from "lucide-react";
import type { EditorFeature } from "~/hooks/useMapEditor";

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
}

const TYPE_ICONS = {
  city: MapPin,
  subdivision: Hexagon,
  poi: Landmark,
} as const;

const TYPE_COLORS = {
  city: "text-blue-500",
  subdivision: "text-purple-500",
  poi: "text-amber-500",
} as const;

type FeatureType = "city" | "subdivision" | "poi";

export function FeatureList({
  features,
  selectedFeature,
  onSelectFeature,
  onEditFeature,
  onDeleteFeature,
  isLoading,
  selectedIds,
  onToggleSelect,
}: FeatureListProps) {
  const [expandedGroups, setExpandedGroups] = useState<Set<FeatureType>>(
    () => new Set(["city", "subdivision", "poi"])
  );
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

  if (isLoading) {
    return (
      <div className="space-y-2 py-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-10 animate-pulse rounded-lg bg-muted" />
        ))}
      </div>
    );
  }

  if (features.length === 0) {
    return (
      <div className="py-6 text-center text-xs text-muted-foreground">
        <span className="hidden sm:inline">
          No features yet. Use <kbd className="rounded border border-border bg-muted px-1 py-0.5 font-mono text-[10px]">C</kbd>{" "}
          <kbd className="rounded border border-border bg-muted px-1 py-0.5 font-mono text-[10px]">R</kbd>{" "}
          <kbd className="rounded border border-border bg-muted px-1 py-0.5 font-mono text-[10px]">P</kbd> to add features.
        </span>
        <span className="sm:hidden">No features yet. Use the toolbar to add cities, regions, or POIs.</span>
      </div>
    );
  }

  // Group by type
  const cities = features.filter((f) => f.type === "city");
  const subdivisions = features.filter((f) => f.type === "subdivision");
  const pois = features.filter((f) => f.type === "poi");

  const groups: Array<{ label: string; items: EditorFeature[]; type: FeatureType }> = [
    { label: "Cities", items: cities, type: "city" },
    { label: "Regions", items: subdivisions, type: "subdivision" },
    { label: "Points of Interest", items: pois, type: "poi" },
  ].filter((g) => g.items.length > 0);

  return (
    <div className="space-y-1">
      {groups.map((group) => {
        const isExpanded = expandedGroups.has(group.type);

        return (
          <div key={group.type}>
            {/* Collapsible group header */}
            <button
              onClick={() => toggleGroup(group.type)}
              className="flex w-full items-center gap-1.5 rounded-md px-1 py-1 text-left transition-colors hover:bg-accent"
            >
              <ChevronDown
                className={`h-3 w-3 shrink-0 text-muted-foreground transition-transform duration-150 ${
                  isExpanded ? "" : "-rotate-90"
                }`}
              />
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {group.label}
              </span>
              <span className="rounded-full bg-muted px-1.5 text-[10px] font-medium tabular-nums text-muted-foreground">
                {group.items.length}
              </span>
            </button>

            {/* Feature items (collapsible) */}
            {isExpanded && (
              <div className="space-y-0.5 pl-1">
                {group.items.map((feature) => {
                  const Icon = TYPE_ICONS[feature.type];
                  const colorClass = TYPE_COLORS[feature.type];
                  const isSelected = selectedFeature?.id === feature.id;
                  const isMultiSelected = selectedIds?.has(feature.id) ?? false;
                  const isCapital = feature.properties.isNationalCapital;

                  return (
                    <div
                      key={feature.id}
                      ref={isSelected ? selectedRef : undefined}
                      className={`group flex items-center gap-1.5 rounded-lg px-2 py-2.5 sm:py-1.5 transition-colors ${
                        isSelected
                          ? "bg-primary/10 ring-1 ring-primary/30"
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
                        className="flex flex-1 items-center gap-2 text-left min-w-0"
                      >
                        <Icon className={`h-3.5 w-3.5 flex-shrink-0 ${colorClass}`} />
                        <span className="truncate text-sm text-foreground">{feature.name}</span>
                        {isCapital && (
                          <span title="National Capital">
                            <Crown className="h-3 w-3 flex-shrink-0 text-amber-500" />
                          </span>
                        )}
                      </button>
                      <div className={`flex items-center gap-0.5 transition-opacity ${isSelected ? "opacity-100" : "opacity-100 sm:opacity-0 sm:group-hover:opacity-100"}`}>
                        <button
                          onClick={(e) => { e.stopPropagation(); onEditFeature(feature); }}
                          className="rounded p-2 sm:p-1 text-muted-foreground transition-colors hover:bg-blue-100 hover:text-blue-600 active:bg-blue-100 active:text-blue-600 dark:hover:bg-blue-500/10 dark:active:bg-blue-500/10"
                          title="Edit"
                        >
                          <Pencil className="h-4 w-4 sm:h-3 sm:w-3" />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); onDeleteFeature(feature); }}
                          className="rounded p-2 sm:p-1 text-muted-foreground transition-colors hover:bg-red-100 hover:text-red-600 active:bg-red-100 active:text-red-600 dark:hover:bg-red-500/10 dark:active:bg-red-500/10"
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4 sm:h-3 sm:w-3" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      {/* Keyboard hints — desktop only */}
      <div className="hidden sm:block border-t border-border pt-2 text-[10px] text-muted-foreground">
        <div className="flex flex-wrap gap-x-3 gap-y-0.5 px-1">
          <span><kbd className="rounded border border-border bg-muted px-1 font-mono">⌫</kbd> Delete</span>
          <span><kbd className="rounded border border-border bg-muted px-1 font-mono">C</kbd> City</span>
          <span><kbd className="rounded border border-border bg-muted px-1 font-mono">R</kbd> Region</span>
          <span><kbd className="rounded border border-border bg-muted px-1 font-mono">P</kbd> POI</span>
        </div>
      </div>
    </div>
  );
}
