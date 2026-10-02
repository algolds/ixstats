"use client";
import React, { memo } from "react";
import { SystemRestart as Loader2, NetworkLeft, CheckCircle as CheckCircle2 } from "iconoir-react";
import { ROUTE_STYLES } from "~/lib/maps/map-config";
import { Checkbox } from "~/components/ui/checkbox";
import { ToggleGroup, ToggleGroupItem } from "~/components/ui/toggle-group";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";

const GENERATABLE_ROUTE_TYPES = [
  // Rail
  "rail",
  "high_speed_rail",
  "freight_rail",
  "commuter_rail",
  // Road
  "motorway",
  "highway",
  "trunk",
  "road",
  "secondary",
  // Maritime
  "shipping_lane",
  "canal",
  "ferry",
  // Air
  "air_corridor",
  // Utility
  "pipeline",
  "power_grid",
  "fiber",
  // Military
  "military_supply",
  "military_naval",
] as const;

export type GeneratableRouteType = (typeof GENERATABLE_ROUTE_TYPES)[number];

interface ProceduralRouteGeneratorProps {
  countryId?: string;
  selectedTypes: GeneratableRouteType[];
  setSelectedTypes: React.Dispatch<React.SetStateAction<GeneratableRouteType[]>>;
  clearExisting: boolean;
  setClearExisting: (clear: boolean) => void;
  generateNotice: string | null;
  setGenerateNotice: (notice: string | null) => void;
  isGenerating: boolean;
  onGenerate: () => void;
}

export const ProceduralRouteGenerator = memo(function ProceduralRouteGenerator({
  countryId,
  selectedTypes,
  setSelectedTypes,
  clearExisting,
  setClearExisting,
  generateNotice,
  isGenerating,
  onGenerate,
}: ProceduralRouteGeneratorProps) {
  const toggleType = (type: GeneratableRouteType) => {
    setSelectedTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  };

  return (
    <div className="space-y-4">
      <Card className="space-y-2 p-3">
        <div className="text-label text-caption flex items-center gap-2 font-semibold">
          <NetworkLeft className="text-label-secondary h-3.5 w-3.5" aria-hidden />
          <span>Procedural Network Generation</span>
        </div>
        <p className="text-label-secondary text-footnote leading-relaxed">
          Generate realistic national transit corridors connecting cities, ports, and industrial
          nodes using topographic friction routing and cost-distance pathfinding.
        </p>
      </Card>

      <div className="space-y-2">
        <span id="route-generator-types" className="text-label-secondary text-caption">
          Network types to generate
        </span>
        <ToggleGroup
          type="multiple"
          variant="outline"
          size="sm"
          aria-labelledby="route-generator-types"
          className="grid grid-cols-2 gap-2"
          value={selectedTypes}
          onValueChange={(next) => {
            const current: string[] = selectedTypes;
            const toggled =
              next.find((t) => !current.includes(t)) ?? current.find((t) => !next.includes(t));
            if (toggled) toggleType(toggled as GeneratableRouteType);
          }}
        >
          {GENERATABLE_ROUTE_TYPES.map((type) => {
            const style = ROUTE_STYLES[type] ?? { label: type, color: "var(--color-gray)" };
            return (
              <ToggleGroupItem key={type} value={type} className="justify-start">
                <span
                  aria-hidden
                  className="size-2 shrink-0 rounded-full"
                  style={{ backgroundColor: style.color }}
                />
                <span className="truncate">{style.label}</span>
              </ToggleGroupItem>
            );
          })}
        </ToggleGroup>
      </div>

      <label className="border-separator hover:bg-fill-4 text-footnote rounded-control-sm flex cursor-pointer items-center gap-2 border p-2">
        <Checkbox checked={clearExisting} onCheckedChange={(c) => setClearExisting(c === true)} />
        <span className="text-label">Clear existing generated routes before generation</span>
      </label>

      {generateNotice && (
        <div className="rounded-control-sm bg-green/15 text-footnote text-green-ink flex items-center gap-2 p-2">
          <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
          <span>{generateNotice}</span>
        </div>
      )}

      <Button
        type="button"
        disabled={isGenerating || selectedTypes.length === 0 || !countryId}
        onClick={onGenerate}
        className="w-full"
      >
        {isGenerating ? (
          <>
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            <span>Calculating Topographic Corridors...</span>
          </>
        ) : (
          <>
            <NetworkLeft className="h-3.5 w-3.5" aria-hidden />
            <span>Generate Routes ({selectedTypes.length} types)</span>
          </>
        )}
      </Button>
    </div>
  );
});
