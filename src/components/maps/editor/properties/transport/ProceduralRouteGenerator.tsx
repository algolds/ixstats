"use client";

import React, { memo } from "react";
import { Loader2, Sparkles, CheckCircle2 } from "lucide-react";
import { ROUTE_STYLES, ROUTE_TYPE_KEYS } from "~/lib/maps/map-config";

const GENERATABLE_ROUTE_TYPES = [
  "rail",
  "highway",
  "road",
  "shipping_lane",
  "canal",
  "air_corridor",
  "ferry",
  "pipeline",
  "power_grid",
  "fiber",
  "military_supply",
  "military_naval",
] as const;

interface ProceduralRouteGeneratorProps {
  countryId?: string;
  selectedTypes: string[];
  setSelectedTypes: React.Dispatch<React.SetStateAction<string[]>>;
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
  const toggleType = (type: string) => {
    setSelectedTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  };

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border/40 bg-muted/20 p-3 space-y-2">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          <span>Procedural Network Generation</span>
        </div>
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          Generate realistic national transit corridors connecting cities, ports, and industrial nodes
          using topographic friction routing and cost-distance pathfinding.
        </p>
      </div>

      <div className="space-y-2">
        <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
          Network Types to Generate
        </label>
        <div className="grid grid-cols-2 gap-1.5">
          {GENERATABLE_ROUTE_TYPES.map((type) => {
            const isSelected = selectedTypes.includes(type);
            const style = (ROUTE_STYLES as any)[type] ?? { label: type, color: "#94a3b8" };

            return (
              <button
                key={type}
                type="button"
                onClick={() => toggleType(type)}
                className={`flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-[11px] font-medium transition-all text-left ${
                  isSelected
                    ? "border-primary/50 bg-primary/10 text-foreground"
                    : "border-border/40 bg-background/50 text-muted-foreground hover:bg-muted/30"
                }`}
              >
                <span
                  className="h-2 w-2 rounded-full shrink-0"
                  style={{ backgroundColor: style.color }}
                />
                <span className="truncate">{style.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <label className="flex cursor-pointer items-center gap-2 rounded border border-border/40 p-2 text-[11px] hover:bg-muted/30">
        <input
          type="checkbox"
          checked={clearExisting}
          onChange={(e) => setClearExisting(e.target.checked)}
          className="rounded border-border"
        />
        <span className="text-foreground">Clear existing generated routes before generation</span>
      </label>

      {generateNotice && (
        <div className="flex items-center gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/10 p-2 text-[11px] text-emerald-500">
          <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
          <span>{generateNotice}</span>
        </div>
      )}

      <button
        type="button"
        disabled={isGenerating || selectedTypes.length === 0 || !countryId}
        onClick={onGenerate}
        className="w-full flex items-center justify-center gap-2 rounded-md bg-primary py-2 text-xs font-semibold text-primary-foreground shadow transition hover:opacity-90 disabled:opacity-50"
      >
        {isGenerating ? (
          <>
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            <span>Calculating Topographic Corridors...</span>
          </>
        ) : (
          <>
            <Sparkles className="h-3.5 w-3.5" />
            <span>Generate Routes ({selectedTypes.length} types)</span>
          </>
        )}
      </button>
    </div>
  );
});
