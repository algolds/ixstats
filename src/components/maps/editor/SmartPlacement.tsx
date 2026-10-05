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

const has = (text: string, ...words: string[]) => {
  const lower = text.toLowerCase();
  return words.some((w) => lower.includes(w));
};

const clampScore = (score: number) => Math.min(100, Math.max(5, score));

function computeCivCapMetrics(elev: string, climate: string) {
  let agriScore = 50;
  let tradeScore = 40;
  let defenseScore = 40;
  let waterScore = 60;

  if (has(elev, "mountain", "highland")) {
    defenseScore += 45;
    agriScore -= 25;
    tradeScore -= 15;
  } else if (has(elev, "lowland", "valley")) {
    agriScore += 35;
    tradeScore += 20;
    waterScore += 25;
  }

  if (has(climate, "tropical", "temperate")) {
    agriScore += 20;
  } else if (has(climate, "arid", "desert")) {
    agriScore -= 35;
    waterScore -= 40;
  }

  return {
    agriScore: clampScore(agriScore),
    tradeScore: clampScore(tradeScore),
    defenseScore: clampScore(defenseScore),
    waterScore: clampScore(waterScore),
  };
}

function generateSuggestions(props: SmartPlacementProps): Suggestion[] {
  const suggestions: Suggestion[] = [];
  const elev = props.terrainInfo?.elevation?.zoneName ?? "";
  const climate = props.terrainInfo?.climate?.climateName ?? "";

  if (has(elev, "highland", "mountain")) {
    suggestions.push({
      icon: Mountain,
      title: "Highland Bastion",
      text: "Rugged elevation and natural chokepoints offer strategic defensive control.",
      suggestedType: props.featureType === "city" ? "fortress" : "military",
      suggestedName: "Kragtor Keep",
      color: "text-label-secondary",
      civCapImpact: "+45% Defensive Security",
    });
  } else if (has(elev, "lowland", "valley", "coastal")) {
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

  if (has(climate, "desert", "arid")) {
    suggestions.push({
      icon: Landmark,
      title: "Caravan Oasis Stop",
      text: "Critical desert aquifer point acting as an inland mercantile nexus.",
      suggestedType: "town",
      suggestedName: "Al-Zahra",
      color: "text-yellow",
      civCapImpact: "+20% Trans-Arid Trade",
    });
  } else if (has(climate, "tropical")) {
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

const METRIC_TILES = [
  { key: "agriScore", label: "Agri yield", icon: Waves, iconClass: "text-green" },
  { key: "tradeScore", label: "Trade flow", icon: Anchor, iconClass: "text-blue" },
  { key: "defenseScore", label: "Defense", icon: Shield, iconClass: "text-label-secondary" },
  { key: "waterScore", label: "Water table", icon: Droplets, iconClass: "text-cyan" },
] as const;

export function SmartPlacement(props: SmartPlacementProps) {
  if (!props.coordinates || !props.terrainInfo) return null;

  const elev = props.terrainInfo.elevation?.zoneName ?? "";
  const climate = props.terrainInfo.climate?.climateName ?? "";
  const suggestions = generateSuggestions(props);
  const metrics = computeCivCapMetrics(elev, climate);

  return (
    <Card className="space-y-2 p-2">
      <div className="flex items-center justify-between">
        <Eyebrow className="flex items-center gap-2">
          <span>CivCap geographic intelligence</span>
        </Eyebrow>
        <span className="text-label-secondary text-footnote tabular-nums">
          {elev || "Terrain"} · {climate || "Climate"}
        </span>
      </div>

      <div className="text-footnote grid grid-cols-2 gap-2">
        {METRIC_TILES.map(({ key, label, icon: Icon, iconClass }) => (
          <div
            key={key}
            className="bg-fill-3 rounded-control-sm flex items-center justify-between px-2 py-1"
          >
            <span className="text-label-secondary flex items-center gap-1">
              <Icon className={`${iconClass} h-2.5 w-2.5`} /> {label}
            </span>
            <span className="font-semibold tabular-nums">{metrics[key]}%</span>
          </div>
        ))}
      </div>

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
