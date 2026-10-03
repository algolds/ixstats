"use client";
import { Eyebrow } from "~/components/ui/eyebrow";
import { Button } from "~/components/ui/button";
import {
  SeaWaves as Anchor,
  ModernTv as Mountain,
  Tree as TreePine,
  SeaWaves as Waves,
  Bank as Landmark,
  Shield,
  Droplet as Droplets,
} from "iconoir-react";
import { Card } from "~/components/ui/card";

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
      color: "text-blue",
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
      color: "text-label-secondary",
      civCapImpact: "+45% Defensive Security",
    });
  } else if (
    elev.toLowerCase().includes("lowland") ||
    elev.toLowerCase().includes("valley") ||
    elev.toLowerCase().includes("coastal")
  ) {
    suggestions.push({
      icon: Waves,
      title: "Fertile Floodplain Basin",
      text: "Alluvial soil and abundant fresh water support intensive agriculture and population growth.",
      suggestedType: "city",
      suggestedName: "Oakhaven",
      color: "text-green",
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
      color: "text-yellow",
      civCapImpact: "+20% Trans-Arid Trade",
    });
  } else if (climate.toLowerCase().includes("tropical")) {
    suggestions.push({
      icon: TreePine,
      title: "Tropical Biodiversity Hub",
      text: "Lush botanical ecosystem rich in rare timber, spices, and natural lore.",
      suggestedType: props.featureType === "poi" ? "natural" : "city",
      suggestedName: "Verdant Reach",
      color: "text-green",
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
    <Card className="space-y-2 p-2">
      {/* CivCap Intelligence Header */}
      <div className="flex items-center justify-between">
        <Eyebrow className="flex items-center gap-2">
          <span>CivCap geographic intelligence</span>
        </Eyebrow>
        <span className="text-label-secondary text-footnote tabular-nums">
          {elev || "Terrain"} · {climate || "Climate"}
        </span>
      </div>

      {/* CivCap Rating Bars */}
      <div className="text-footnote grid grid-cols-2 gap-2">
        <div className="bg-fill-3 rounded-control-sm flex items-center justify-between px-2 py-1">
          <span className="text-label-secondary flex items-center gap-1">
            <Waves className="text-green h-2.5 w-2.5" /> Agri yield
          </span>
          <span className="font-semibold tabular-nums">{metrics.agriScore}%</span>
        </div>
        <div className="bg-fill-3 rounded-control-sm flex items-center justify-between px-2 py-1">
          <span className="text-label-secondary flex items-center gap-1">
            <Anchor className="text-blue h-2.5 w-2.5" /> Trade flow
          </span>
          <span className="font-semibold tabular-nums">{metrics.tradeScore}%</span>
        </div>
        <div className="bg-fill-3 rounded-control-sm flex items-center justify-between px-2 py-1">
          <span className="text-label-secondary flex items-center gap-1">
            <Shield className="text-label-secondary h-2.5 w-2.5" /> Defense
          </span>
          <span className="font-semibold tabular-nums">{metrics.defenseScore}%</span>
        </div>
        <div className="bg-fill-3 rounded-control-sm flex items-center justify-between px-2 py-1">
          <span className="text-label-secondary flex items-center gap-1">
            <Droplets className="text-cyan h-2.5 w-2.5" /> Water table
          </span>
          <span className="font-semibold tabular-nums">{metrics.waterScore}%</span>
        </div>
      </div>

      {/* Smart Suggestions */}
      {suggestions.length > 0 && (
        <div className="border-separator space-y-2 border-t pt-1">
          {suggestions.map((s, i) => {
            const Icon = s.icon;
            return (
              <div
                key={i}
                className="group border-separator bg-surface hover:bg-surface rounded-control-sm flex flex-col gap-1 border p-2 transition-[color,background-color,border-color,box-shadow,opacity,transform]"
              >
                <div className="flex items-center justify-between">
                  <div className="text-caption flex items-center gap-2">
                    <Icon className={`h-3 w-3 shrink-0 ${s.color}`} />
                    <span className="text-label">{s.title}</span>
                  </div>
                  {s.civCapImpact && (
                    <span className="text-caption text-green font-semibold tabular-nums">
                      {s.civCapImpact}
                    </span>
                  )}
                </div>
                <p className="text-label-secondary text-footnote leading-tight">{s.text}</p>
                {props.onApplySuggestion && s.suggestedType && (
                  <Button
                    variant="secondary"
                    size="xs"
                    className="mt-0.5 w-fit"
                    onClick={() => props.onApplySuggestion?.(s.suggestedType!, s.suggestedName)}
                  >
                    <span>Apply Type: {s.suggestedType}</span>
                    {s.suggestedName && (
                      <span className="text-label-secondary font-normal">({s.suggestedName})</span>
                    )}
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
