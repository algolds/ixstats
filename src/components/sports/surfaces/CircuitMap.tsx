"use client";

import React from "react";
import { cn } from "~/lib/utils";

export interface CircuitMapProps {
  className?: string;
  circuitName?: string;
  lapCount?: number;
  children?: React.ReactNode;
}

export function CircuitMap({
  className,
  circuitName = "International Grand Prix Circuit",
  lapCount = 57,
  children,
}: CircuitMapProps) {
  return (
    <div
      className={cn(
        "relative mx-auto aspect-[16/10] w-full overflow-hidden rounded-3xl border border-red-500/30 bg-gradient-to-b from-zinc-950 via-stone-900/90 to-zinc-950 p-4 shadow-xl",
        className
      )}
    >
      {/* Header Info HUD */}
      <div className="flex items-center justify-between border-b border-white/10 pb-2">
        <span className="text-xs font-black uppercase tracking-wider text-red-400">
          🏎️ {circuitName}
        </span>
        <span className="text-[10px] font-bold text-muted-foreground uppercase">
          {lapCount} Laps · DRS Zones (2)
        </span>
      </div>

      <div className="relative my-auto flex h-[calc(100%-28px)] items-center justify-center">
        <svg
          viewBox="0 0 100 60"
          className="h-full w-full fill-none stroke-[2.2] stroke-linecap-round stroke-linejoin-round"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Track Underglow Glow */}
          <path
            d="M 15 45 L 75 45 C 85 45, 92 40, 88 30 C 85 22, 70 24, 60 15 C 52 7, 35 8, 25 15 C 12 25, 8 38, 15 45 Z"
            className="stroke-red-500/20 stroke-[4] blur-[2px]"
          />

          {/* Sector 1 (Start straight + Turn 1) - Cyan */}
          <path
            d="M 15 45 L 75 45 C 85 45, 92 40, 88 30"
            className="stroke-cyan-400/80"
          />

          {/* Sector 2 (Technical Infield) - Amber */}
          <path
            d="M 88 30 C 85 22, 70 24, 60 15 C 52 7, 35 8, 25 15"
            className="stroke-amber-400/80"
          />

          {/* Sector 3 (Final hairpin + DRS straight) - Indigo */}
          <path
            d="M 25 15 C 12 25, 8 38, 15 45"
            className="stroke-indigo-400/80"
          />

          {/* Start / Finish Checkered Line */}
          <line x1="45" y1="42.5" x2="45" y2="47.5" className="stroke-white stroke-[1.2]" />

          {/* Pit Lane Branch */}
          <path
            d="M 30 48.5 L 60 48.5"
            className="stroke-zinc-500/60 stroke-[1] stroke-dasharray-[1,1]"
          />
        </svg>

        {/* Legend */}
        <div className="absolute bottom-1 right-2 flex gap-3 text-[9px] font-bold">
          <span className="flex items-center gap-1 text-cyan-400">
            <span className="h-1.5 w-1.5 rounded-full bg-cyan-400" /> S1
          </span>
          <span className="flex items-center gap-1 text-amber-400">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-400" /> S2
          </span>
          <span className="flex items-center gap-1 text-indigo-400">
            <span className="h-1.5 w-1.5 rounded-full bg-indigo-400" /> S3
          </span>
        </div>
      </div>

      {/* Surface Overlay Elements (Car positions, flags) */}
      {children && <div className="absolute inset-0 z-10 pointer-events-none">{children}</div>}
    </div>
  );
}
