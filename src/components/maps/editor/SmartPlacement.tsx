"use client";

/**
 * SmartPlacement — Contextual suggestions when placing a city or POI.
 *
 * Based on terrain info at the clicked point, suggests:
 * - City type (port for coast, trade city for river valley, etc)
 * - Relevant characteristics based on elevation/climate
 * - Nearby wiki-mentioned places not yet on the map
 */

import { SeaWaves as Anchor, ModernTv as Mountain, Tree as TreePine, SeaWaves as Waves, Bank as Landmark, Sparks as Sparkles, Shield, Droplet as Droplets } from "iconoir-react";

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
  /** Optional callback to apply suggested type/name directly to form */
  onApplySuggestion?: (suggestedType: string, suggestedName?: string) => void;
}

interface Suggestion {
  icon: typeof Anchor;
  title: string;
  text: string;
  suggestedType?: string;
  suggestedName?: string;
  color: string;
  civCapImpact?: string;
}

function computeCivCapMetrics(elev: string, climate: string, isCoastal?: boolean) {
  let agriScore = 50;
  let tradeScore = 40;
  let defenseScore = 40;
  let waterScore = 60;

  if (isCoastal) {
    tradeScore += 35;
    waterScore += 20;
  }

  if (elev.toLowerCase().includes("mountain") || elev.toLowerCase().includes("highland")) {
    defenseScore += 45;
    agriScore -= 25;
    tradeScore -= 15;
  } else if (elev.toLowerCase().includes("lowland") || elev.toLowerCase().includes("valley")) {
    agriScore += 35;
    tradeScore += 20;
    waterScore += 25;
  }

  if (climate.toLowerCase().includes("tropical") || climate.toLowerCase().includes("temperate")) {
    agriScore += 20;
  } else if (climate.toLowerCase().includes("arid") || climate.toLowerCase().includes("desert")) {
    agriScore -= 35;
    waterScore -= 40;
  }

  return {
    agriScore: Math.min(100, Math.max(5, agriScore)),
    tradeScore: Math.min(100, Math.max(5, tradeScore)),
    defenseScore: Math.min(100, Math.max(5, defenseScore)),
    waterScore: Math.min(100, Math.max(5, waterScore)),
  };
}

function generateSuggestions(props: SmartPlacementProps): Suggestion[] {
  const suggestions: Suggestion[] = [];
  const elev = props.terrainInfo?.elevation?.zoneName ?? "";
  const climate = props.terrainInfo?.climate?.climateName ?? "";

  // Coastal suggestions
  if (props.isCoastal) {
    suggestions.push({
      icon: Anchor,
      title: "Maritime Haven",
      text: "Sheltered coastal waters provide superior maritime access and trade throughput.",
      suggestedType: "port",
      suggestedName: "Port Valen",
      color: "text-blue-500",
      civCapImpact: "+35% Trade CivCap",
    });
  }

  // Elevation-based
  if (elev.toLowerCase().includes("highland") || elev.toLowerCase().includes("mountain")) {
    suggestions.push({
      icon: Mountain,
      title: "Highland Bastion",
      text: "Rugged elevation and natural chokepoints offer strategic defensive control.",
      suggestedType: props.featureType === "city" ? "fortress" : "military",
      suggestedName: "Kragtor Keep",
      color: "text-stone-500",
      civCapImpact: "+45% Defensive Security",
    });
  } else if (elev.toLowerCase().includes("lowland") || elev.toLowerCase().includes("valley") || elev.toLowerCase().includes("coastal")) {
    suggestions.push({
      icon: Waves,
      title: "Fertile Floodplain Basin",
      text: "Alluvial soil and abundant fresh water support intensive agriculture and population growth.",
      suggestedType: "city",
      suggestedName: "Oakhaven",
      color: "text-emerald-500",
      civCapImpact: "+35% Agricultural Yield",
    });
  }

  // Climate-based
  if (climate.toLowerCase().includes("desert") || climate.toLowerCase().includes("arid")) {
    suggestions.push({
      icon: Landmark,
      title: "Caravan Oasis Stop",
      text: "Critical desert aquifer point acting as an inland mercantile nexus.",
      suggestedType: "town",
      suggestedName: "Al-Zahra",
      color: "text-amber-500",
      civCapImpact: "+20% Trans-Arid Trade",
    });
  } else if (climate.toLowerCase().includes("tropical")) {
    suggestions.push({
      icon: TreePine,
      title: "Tropical Biodiversity Hub",
      text: "Lush botanical ecosystem rich in rare timber, spices, and natural lore.",
      suggestedType: props.featureType === "poi" ? "natural" : "city",
      suggestedName: "Verdant Reach",
      color: "text-green-500",
      civCapImpact: "+25% Lore Harvest",
    });
  }

  return suggestions;
}

export function SmartPlacement(props: SmartPlacementProps) {
  if (!props.coordinates || !props.terrainInfo) return null;

  const elev = props.terrainInfo?.elevation?.zoneName ?? "";
  const climate = props.terrainInfo?.climate?.climateName ?? "";
  const suggestions = generateSuggestions(props);
  const metrics = computeCivCapMetrics(elev, climate, props.isCoastal);

  return (
    <div className="space-y-2.5 rounded-lg border border-border/60 bg-card/60 p-2.5 backdrop-blur-md">
      {/* CivCap Intelligence Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-[10px] font-semibold tracking-wider text-amber-600 uppercase dark:text-amber-400">
          <Sparkles className="h-3 w-3" />
          <span>CivCap Geographic Intelligence</span>
        </div>
        <span className="font-mono text-[9px] text-muted-foreground">
          {elev || "Terrain"} · {climate || "Climate"}
        </span>
      </div>

      {/* CivCap Rating Bars */}
      <div className="grid grid-cols-2 gap-2 text-[10px]">
        <div className="flex items-center justify-between rounded bg-muted/40 px-2 py-1">
          <span className="text-muted-foreground flex items-center gap-1">
            <Waves className="h-2.5 w-2.5 text-emerald-500" /> Agri Yield
          </span>
          <span className="font-mono font-semibold">{metrics.agriScore}%</span>
        </div>
        <div className="flex items-center justify-between rounded bg-muted/40 px-2 py-1">
          <span className="text-muted-foreground flex items-center gap-1">
            <Anchor className="h-2.5 w-2.5 text-blue-500" /> Trade Flow
          </span>
          <span className="font-mono font-semibold">{metrics.tradeScore}%</span>
        </div>
        <div className="flex items-center justify-between rounded bg-muted/40 px-2 py-1">
          <span className="text-muted-foreground flex items-center gap-1">
            <Shield className="h-2.5 w-2.5 text-stone-500" /> Defense
          </span>
          <span className="font-mono font-semibold">{metrics.defenseScore}%</span>
        </div>
        <div className="flex items-center justify-between rounded bg-muted/40 px-2 py-1">
          <span className="text-muted-foreground flex items-center gap-1">
            <Droplets className="h-2.5 w-2.5 text-cyan-500" /> Water Table
          </span>
          <span className="font-mono font-semibold">{metrics.waterScore}%</span>
        </div>
      </div>

      {/* Smart Suggestions */}
      {suggestions.length > 0 && (
        <div className="space-y-1.5 pt-1 border-t border-border/40">
          {suggestions.map((s, i) => {
            const Icon = s.icon;
            return (
              <div
                key={i}
                className="group flex flex-col gap-1 rounded-md border border-border/40 bg-card/40 p-1.5 transition-all hover:bg-card/90"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 font-medium text-[11px]">
                    <Icon className={`h-3 w-3 shrink-0 ${s.color}`} />
                    <span className="text-foreground">{s.title}</span>
                  </div>
                  {s.civCapImpact && (
                    <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 font-mono text-[9px] font-semibold text-emerald-600 dark:text-emerald-400">
                      {s.civCapImpact}
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-muted-foreground leading-tight">{s.text}</p>
                {props.onApplySuggestion && s.suggestedType && (
                  <button
                    onClick={() => props.onApplySuggestion?.(s.suggestedType!, s.suggestedName)}
                    className="mt-0.5 flex h-5 w-fit items-center gap-1 rounded bg-primary/10 px-2 text-[9px] font-semibold text-primary transition-colors hover:bg-primary/20 active:scale-95 duration-100"
                  >
                    <span>Apply Type: {s.suggestedType}</span>
                    {s.suggestedName && <span className="text-muted-foreground font-normal">({s.suggestedName})</span>}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
