"use client";

/**
 * SmartPlacement — Contextual suggestions when placing a city or POI.
 *
 * Based on terrain info at the clicked point, suggests:
 * - City type (port for coast, trade city for river valley, etc)
 * - Relevant characteristics based on elevation/climate
 * - Nearby wiki-mentioned places not yet on the map
 */

import { Lightbulb, Anchor, Mountain, TreePine, Waves, Landmark } from "lucide-react";

interface SmartPlacementProps {
  /** Terrain at the clicked point */
  terrainInfo?: {
    elevation?: { zoneName?: string | null; elevationLabel?: string | null } | null;
    climate?: { climateName?: string | null } | null;
  } | null;
  /** Current pending coordinates */
  coordinates?: [number, number] | null;
  /** Whether the point is near coast */
  isCoastal?: boolean;
  /** Feature type being placed */
  featureType: "city" | "poi";
}

interface Suggestion {
  icon: typeof Anchor;
  text: string;
  suggestedType?: string;
  color: string;
}

function generateSuggestions(props: SmartPlacementProps): Suggestion[] {
  const suggestions: Suggestion[] = [];
  const elev = props.terrainInfo?.elevation?.zoneName ?? "";
  const climate = props.terrainInfo?.climate?.climateName ?? "";

  // Coastal suggestions
  if (props.isCoastal) {
    suggestions.push({
      icon: Anchor,
      text: "Coastal location — ideal for a port city or naval base",
      suggestedType: "port",
      color: "text-blue-500",
    });
  }

  // Elevation-based
  if (elev.toLowerCase().includes("highland") || elev.toLowerCase().includes("mountain")) {
    suggestions.push({
      icon: Mountain,
      text: "Mountain terrain — consider a fortress, mining town, or monastery",
      suggestedType: props.featureType === "city" ? "fortress" : "military",
      color: "text-stone-500",
    });
  } else if (elev.toLowerCase().includes("lowland") || elev.toLowerCase().includes("coastal")) {
    suggestions.push({
      icon: Waves,
      text: "Low elevation — good for agriculture and trade",
      suggestedType: "city",
      color: "text-emerald-500",
    });
  }

  // Climate-based
  if (climate.toLowerCase().includes("desert") || climate.toLowerCase().includes("arid")) {
    suggestions.push({
      icon: Landmark,
      text: "Arid climate — consider an oasis settlement or caravan stop",
      suggestedType: "town",
      color: "text-amber-500",
    });
  } else if (climate.toLowerCase().includes("tropical")) {
    suggestions.push({
      icon: TreePine,
      text: "Tropical zone — rich biodiversity, potential for a cultural center",
      suggestedType: props.featureType === "poi" ? "natural" : "city",
      color: "text-green-500",
    });
  } else if (climate.toLowerCase().includes("boreal") || climate.toLowerCase().includes("tundra")) {
    suggestions.push({
      icon: Mountain,
      text: "Cold climate — remote outpost, research station, or frontier settlement",
      suggestedType: "village",
      color: "text-sky-500",
    });
  }

  return suggestions;
}

export function SmartPlacement(props: SmartPlacementProps) {
  if (!props.coordinates || !props.terrainInfo) return null;

  const suggestions = generateSuggestions(props);
  if (suggestions.length === 0) return null;

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400">
        <Lightbulb className="h-3 w-3" />
        Suggestions
      </div>
      {suggestions.map((s, i) => {
        const Icon = s.icon;
        return (
          <div key={i} className="flex items-start gap-1.5 text-[11px] text-muted-foreground">
            <Icon className={`mt-0.5 h-3 w-3 shrink-0 ${s.color}`} />
            <span>{s.text}</span>
          </div>
        );
      })}
    </div>
  );
}
