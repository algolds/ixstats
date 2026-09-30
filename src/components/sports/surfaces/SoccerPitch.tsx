"use client";

import React from "react";
import { cn } from "~/lib/utils";

export interface SoccerPitchProps {
  className?: string;
  children?: React.ReactNode;
}

export function SoccerPitch({ className, children }: SoccerPitchProps) {
  return (
    <div
      className={cn(
        "relative mx-auto aspect-[16/10] w-full overflow-hidden rounded-2xl border border-emerald-500/30 bg-gradient-to-b from-emerald-950/80 via-emerald-900/60 to-emerald-950/80 p-2 shadow-inner",
        className
      )}
    >
      <svg
        viewBox="0 0 100 64"
        className="h-full w-full stroke-emerald-400/40 fill-none stroke-[0.8]"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Outer Boundary */}
        <rect x="2" y="2" width="96" height="60" rx="1" />

        {/* Halfway Line */}
        <line x1="50" y1="2" x2="50" y2="62" />

        {/* Center Circle & Spot */}
        <circle cx="50" cy="32" r="9" />
        <circle cx="50" cy="32" r="0.8" className="fill-emerald-400/60" />

        {/* Left Penalty Area (18-yard) */}
        <rect x="2" y="14" width="16" height="36" />
        {/* Left Goal Area (6-yard) */}
        <rect x="2" y="22" width="6" height="20" />
        {/* Left Penalty Spot & Arc */}
        <circle cx="13" cy="32" r="0.8" className="fill-emerald-400/60" />
        <path d="M 18 26 A 9 9 0 0 1 18 38" />

        {/* Right Penalty Area (18-yard) */}
        <rect x="82" y="14" width="16" height="36" />
        {/* Right Goal Area (6-yard) */}
        <rect x="92" y="22" width="6" height="20" />
        {/* Right Penalty Spot & Arc */}
        <circle cx="87" cy="32" r="0.8" className="fill-emerald-400/60" />
        <path d="M 82 26 A 9 9 0 0 0 82 38" />

        {/* Corner Arcs */}
        <path d="M 2 5 A 3 3 0 0 0 5 2" />
        <path d="M 2 59 A 3 3 0 0 1 5 62" />
        <path d="M 98 5 A 3 3 0 0 1 95 2" />
        <path d="M 98 59 A 3 3 0 0 0 95 62" />
      </svg>

      {/* Surface Overlay Elements (Players, Event Pins) */}
      {children && <div className="absolute inset-0 z-10 pointer-events-none">{children}</div>}
    </div>
  );
}
