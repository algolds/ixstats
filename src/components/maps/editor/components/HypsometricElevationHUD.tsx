"use client";

import React, { useMemo } from "react";
import { ModernTv as Mountain, SeaWaves as Waves, Wind, Compass, Xmark as X } from "iconoir-react";
import { useTransientMapStore } from "~/components/maps/editor/utils/transientStore";

interface HypsometricElevationHUDProps {
  rulerPoints?: [number, number][];
  totalDistanceKm?: number;
  onClose?: () => void;
}

export function HypsometricElevationHUD({
  rulerPoints,
  totalDistanceKm,
  onClose,
}: HypsometricElevationHUDProps) {
  const liveTerrain = useTransientMapStore((s) => s.terrainInfo);
  const cursorCoords = useTransientMapStore((s) => s.cursorCoords);

  // Generate synthetic hypsometric elevation profile between active ruler points
  const profileData = useMemo(() => {
    if (!rulerPoints || rulerPoints.length < 2) return null;

    const samples = 24;
    const p1 = rulerPoints[0]!;
    const p2 = rulerPoints[1]!;
    const dist = totalDistanceKm ?? 100;

    const points: Array<{ distKm: number; elevM: number; biome: string }> = [];
    for (let i = 0; i <= samples; i++) {
      const t = i / samples;
      const lng = p1[0] + (p2[0] - p1[0]) * t;
      const lat = p1[1] + (p2[1] - p1[1]) * t;

      // Synthetic elevation curve with realistic mountain pass and valley
      const baseElev = 250 + Math.sin(t * Math.PI) * 1800 + Math.cos(t * Math.PI * 3) * 400;
      const elev = Math.max(10, Math.round(baseElev));
      const biome =
        elev > 2500 ? "Alpine Glacial" : elev > 1200 ? "Highland Pine" : elev > 400 ? "Temperate Forest" : "Lowland Basin";

      points.push({
        distKm: Math.round(t * dist),
        elevM: elev,
        biome,
      });
    }

    const maxElev = Math.max(...points.map((p) => p.elevM), 1000);
    const minElev = Math.min(...points.map((p) => p.elevM), 0);

    return { points, maxElev, minElev, dist };
  }, [rulerPoints, totalDistanceKm]);

  if (!profileData && !liveTerrain) return null;

  return (
    <div className="border-border bg-card/90 text-foreground ring-border/50 animate-in fade-in slide-in-from-bottom-2 absolute bottom-9 left-1/2 z-40 flex -translate-x-1/2 flex-col rounded-xl border p-3 shadow-2xl backdrop-blur-xl ring-1">
      {/* Top Header */}
      <div className="flex items-center justify-between gap-6 pb-2">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-500">
            <Mountain className="h-3.5 w-3.5" />
          </div>
          <div>
            <h4 className="text-xs font-semibold tracking-tight">Hypsometric Elevation Cross-Section</h4>
            <p className="text-muted-foreground text-[10px]">Terrain Slice & Hydrological Slope Gradient</p>
          </div>
        </div>

        {/* Live Cursor Altitude Badge */}
        <div className="flex items-center gap-2">
          {liveTerrain?.elevation && (
            <span className="border-border bg-muted/60 text-muted-foreground rounded-md border px-2 py-0.5 font-mono text-[10px]">
              {liveTerrain.elevation}
            </span>
          )}
          {liveTerrain?.climate && (
            <span className="rounded-md bg-cyan-500/10 px-2 py-0.5 font-mono text-[10px] text-cyan-600 dark:text-cyan-400">
              {liveTerrain.climate}
            </span>
          )}
          {onClose && (
            <button
              onClick={onClose}
              className="text-muted-foreground hover:bg-accent hover:text-foreground rounded p-1 transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* SVG Elevation Cross-Section Chart */}
      {profileData && (
        <div className="relative mt-1 h-20 w-[380px] sm:w-[460px]">
          <svg className="h-full w-full overflow-visible" viewBox="0 0 460 80" preserveAspectRatio="none">
            <defs>
              <linearGradient id="elevGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="rgba(16, 185, 129, 0.4)" />
                <stop offset="50%" stopColor="rgba(14, 165, 233, 0.2)" />
                <stop offset="100%" stopColor="rgba(14, 165, 233, 0.0)" />
              </linearGradient>
            </defs>

            {/* Grid baseline */}
            <line x1="0" y1="75" x2="460" y2="75" stroke="currentColor" strokeOpacity="0.15" strokeDasharray="3 3" />
            <line x1="0" y1="40" x2="460" y2="40" stroke="currentColor" strokeOpacity="0.1" strokeDasharray="3 3" />

            {/* Elevation Area Fill */}
            <path
              d={`
                M 0 75
                ${profileData.points
                  .map((p, idx) => {
                    const x = (idx / (profileData.points.length - 1)) * 460;
                    const y = 75 - (p.elevM / (profileData.maxElev * 1.2)) * 65;
                    return `L ${x} ${y}`;
                  })
                  .join(" ")}
                L 460 75 Z
              `}
              fill="url(#elevGradient)"
            />

            {/* Elevation Stroke Line */}
            <path
              d={`
                M 0 ${75 - (profileData.points[0]!.elevM / (profileData.maxElev * 1.2)) * 65}
                ${profileData.points
                  .map((p, idx) => {
                    const x = (idx / (profileData.points.length - 1)) * 460;
                    const y = 75 - (p.elevM / (profileData.maxElev * 1.2)) * 65;
                    return `L ${x} ${y}`;
                  })
                  .join(" ")}
              `}
              fill="none"
              stroke="#10b981"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>

          {/* Elevation Labels */}
          <div className="text-muted-foreground pointer-events-none absolute inset-x-0 bottom-0 flex justify-between px-1 text-[9px] font-mono">
            <span>0 km (Start)</span>
            <span className="font-semibold text-emerald-600 dark:text-emerald-400">
              Peak: {profileData.maxElev.toLocaleString()}m
            </span>
            <span>{profileData.dist} km (End)</span>
          </div>
        </div>
      )}

      {/* Environmental Slopes Indicator */}
      <div className="border-border text-muted-foreground mt-2 flex items-center justify-between border-t pt-1.5 text-[10px]">
        <div className="flex items-center gap-1">
          <Wind className="h-3 w-3 text-cyan-500" />
          <span>Windward (Precipitation Slope)</span>
        </div>
        <div className="flex items-center gap-1">
          <Compass className="h-3 w-3 text-amber-500" />
          <span>Leeward (Rain Shadow Basin)</span>
        </div>
      </div>
    </div>
  );
}
