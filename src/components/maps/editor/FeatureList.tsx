"use client";

/**
 * FeatureList - List of existing map features (cities, subdivisions, POIs)
 * for the user's country. Click to focus on map, with delete option.
 * Matches standard sidebar styling (solid colors, no glass).
 */

import { MapPin, Hexagon, Landmark, Trash2, Pencil, Crown } from "lucide-react";
import type { EditorFeature } from "~/hooks/useMapEditor";

interface FeatureListProps {
  features: EditorFeature[];
  selectedFeature: EditorFeature | null;
  onSelectFeature: (feature: EditorFeature) => void;
  onEditFeature: (feature: EditorFeature) => void;
  onDeleteFeature: (feature: EditorFeature) => void;
  isLoading: boolean;
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

export function FeatureList({
  features,
  selectedFeature,
  onSelectFeature,
  onEditFeature,
  onDeleteFeature,
  isLoading,
}: FeatureListProps) {
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
        No features yet. Use the tools above to add cities, regions, or points of interest.
      </div>
    );
  }

  // Group by type
  const cities = features.filter((f) => f.type === "city");
  const subdivisions = features.filter((f) => f.type === "subdivision");
  const pois = features.filter((f) => f.type === "poi");

  const groups = [
    { label: "Cities", items: cities, type: "city" as const },
    { label: "Regions", items: subdivisions, type: "subdivision" as const },
    { label: "Points of Interest", items: pois, type: "poi" as const },
  ].filter((g) => g.items.length > 0);

  return (
    <div className="space-y-3">
      {groups.map((group) => (
        <div key={group.type}>
          <div className="mb-1 flex items-center gap-1.5 px-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            {group.label}
            <span className="rounded-full bg-muted px-1.5 text-[10px] font-medium text-muted-foreground">
              {group.items.length}
            </span>
          </div>
          <div className="space-y-0.5">
            {group.items.map((feature) => {
              const Icon = TYPE_ICONS[feature.type];
              const colorClass = TYPE_COLORS[feature.type];
              const isSelected = selectedFeature?.id === feature.id;
              const isCapital = feature.properties.isNationalCapital;

              return (
                <div
                  key={feature.id}
                  className={`group flex items-center gap-2 rounded-lg px-2.5 py-1.5 transition-colors ${
                    isSelected
                      ? "bg-primary/10 ring-1 ring-primary/30"
                      : "hover:bg-accent"
                  }`}
                >
                  <button
                    onClick={() => onSelectFeature(feature)}
                    className="flex flex-1 items-center gap-2 text-left"
                  >
                    <Icon className={`h-3.5 w-3.5 flex-shrink-0 ${colorClass}`} />
                    <span className="truncate text-sm text-foreground">{feature.name}</span>
                    {isCapital && (
                      <span title="National Capital">
                        <Crown className="h-3 w-3 flex-shrink-0 text-amber-500" />
                      </span>
                    )}
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onEditFeature(feature);
                    }}
                    className="rounded p-1 text-muted-foreground/40 opacity-0 transition-colors hover:bg-blue-50 hover:text-blue-500 group-hover:opacity-100"
                    title="Edit feature"
                  >
                    <Pencil className="h-3 w-3" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteFeature(feature);
                    }}
                    className="rounded p-1 text-muted-foreground/40 opacity-0 transition-colors hover:bg-red-50 hover:text-red-500 group-hover:opacity-100"
                    title="Delete feature"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
