"use client";

import React from "react";
import { Mountain, Waves, TreePine, Magnet } from "lucide-react";

export interface NaturalSnappingOptions {
  snapToRidges: boolean;
  snapToRivers: boolean;
  snapToCoastlines: boolean;
  snapToBiomes: boolean;
  snapToleranceKm: number;
}

interface NaturalBorderSnappingControlsProps {
  options: NaturalSnappingOptions;
  onChange: (options: NaturalSnappingOptions) => void;
}

export function NaturalBorderSnappingControls({
  options,
  onChange,
}: NaturalBorderSnappingControlsProps) {
  const toggle = (key: keyof Omit<NaturalSnappingOptions, "snapToleranceKm">) => {
    onChange({
      ...options,
      [key]: !options[key],
    });
  };

  return (
    <div className="flex items-center gap-1.5 rounded-lg bg-card/60 p-1 backdrop-blur-md border border-border/50 shadow-sm">
      <div className="flex items-center gap-1 px-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground border-r border-border pr-2">
        <Magnet className="h-3 w-3 text-emerald-500" />
        <span>Natural Snap</span>
      </div>

      {/* Snap to Ridges */}
      <button
        onClick={() => toggle("snapToRidges")}
        className={`flex h-6 items-center gap-1 rounded px-2 text-[11px] font-medium transition-all active:scale-95 duration-100 ${
          options.snapToRidges
            ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-semibold ring-1 ring-emerald-500/40 shadow-sm"
            : "text-muted-foreground hover:bg-accent hover:text-foreground"
        }`}
        title="Snap border vertices to mountain ridges & continental drainage divides"
      >
        <Mountain className="h-3 w-3" />
        <span>Ridge</span>
      </button>

      {/* Snap to Rivers */}
      <button
        onClick={() => toggle("snapToRivers")}
        className={`flex h-6 items-center gap-1 rounded px-2 text-[11px] font-medium transition-all active:scale-95 duration-100 ${
          options.snapToRivers
            ? "bg-blue-500/20 text-blue-600 dark:text-blue-400 font-semibold ring-1 ring-blue-500/40 shadow-sm"
            : "text-muted-foreground hover:bg-accent hover:text-foreground"
        }`}
        title="Snap border vertices to river centerlines (Thalweg)"
      >
        <Waves className="h-3 w-3" />
        <span>River</span>
      </button>

      {/* Snap to Coastlines */}
      <button
        onClick={() => toggle("snapToCoastlines")}
        className={`flex h-6 items-center gap-1 rounded px-2 text-[11px] font-medium transition-all active:scale-95 duration-100 ${
          options.snapToCoastlines
            ? "bg-cyan-500/20 text-cyan-600 dark:text-cyan-400 font-semibold ring-1 ring-cyan-500/40 shadow-sm"
            : "text-muted-foreground hover:bg-accent hover:text-foreground"
        }`}
        title="Snap border vertices to oceanic coastlines and shorelines"
      >
        <Waves className="h-3 w-3" />
        <span>Coast</span>
      </button>

      {/* Snap to Biomes */}
      <button
        onClick={() => toggle("snapToBiomes")}
        className={`flex h-6 items-center gap-1 rounded px-2 text-[11px] font-medium transition-all active:scale-95 duration-100 ${
          options.snapToBiomes
            ? "bg-amber-500/20 text-amber-600 dark:text-amber-400 font-semibold ring-1 ring-amber-500/40 shadow-sm"
            : "text-muted-foreground hover:bg-accent hover:text-foreground"
        }`}
        title="Snap border vertices to natural biome transitions & vegetative boundaries"
      >
        <TreePine className="h-3 w-3" />
        <span>Biome</span>
      </button>
    </div>
  );
}
