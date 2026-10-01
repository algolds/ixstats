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
        "rounded-card border-separator bg-surface-secondary relative mx-auto aspect-[16/10] w-full overflow-hidden border p-4",
        className
      )}
    >
      {/* Header Info HUD */}
      <div className="border-separator flex items-center justify-between border-b pb-2">
        <span className="text-eyebrow text-red">🏎️ {circuitName}</span>
        <span className="text-eyebrow text-label-secondary">{lapCount} Laps · DRS Zones (2)</span>
      </div>

      <div className="relative my-auto flex h-[calc(100%-28px)] items-center justify-center">
        <svg
          viewBox="0 0 100 60"
          className="stroke-linecap-round stroke-linejoin-round h-full w-full fill-none stroke-[2.2]"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Track Underglow Glow */}
          <path
            d="M 15 45 L 75 45 C 85 45, 92 40, 88 30 C 85 22, 70 24, 60 15 C 52 7, 35 8, 25 15 C 12 25, 8 38, 15 45 Z"
            className="stroke-red/20 stroke-[4]"
          />

          {/* Sector 1 (Start straight + Turn 1) - Cyan */}
          <path d="M 15 45 L 75 45 C 85 45, 92 40, 88 30" className="stroke-teal/80" />

          {/* Sector 2 (Technical Infield) - Amber */}
          <path
            d="M 88 30 C 85 22, 70 24, 60 15 C 52 7, 35 8, 25 15"
            className="stroke-yellow/80"
          />

          {/* Sector 3 (Final hairpin + DRS straight) - Indigo */}
          <path d="M 25 15 C 12 25, 8 38, 15 45" className="stroke-indigo/80" />

          {/* Start / Finish Checkered Line */}
          <line x1="45" y1="42.5" x2="45" y2="47.5" className="stroke-label stroke-[1.2]" />

          {/* Pit Lane Branch */}
          <path
            d="M 30 48.5 L 60 48.5"
            className="stroke-label-secondary stroke-dasharray-[1,1] stroke-[1]"
          />
        </svg>

        {/* Legend */}
        <div className="text-footnote absolute right-2 bottom-1 flex gap-3 font-semibold">
          <span className="text-teal flex items-center gap-1">
            <span className="bg-teal h-1.5 w-1.5 rounded-full" /> S1
          </span>
          <span className="text-yellow flex items-center gap-1">
            <span className="bg-yellow h-1.5 w-1.5 rounded-full" /> S2
          </span>
          <span className="text-indigo flex items-center gap-1">
            <span className="bg-indigo h-1.5 w-1.5 rounded-full" /> S3
          </span>
        </div>
      </div>

      {/* Surface Overlay Elements (Car positions, flags) */}
      {children && <div className="pointer-events-none absolute inset-0 z-10">{children}</div>}
    </div>
  );
}
