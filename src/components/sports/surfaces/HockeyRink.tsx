"use client";

import React from "react";
import { cn } from "~/lib/utils";

export interface HockeyRinkProps {
  className?: string;
  children?: React.ReactNode;
}

export function HockeyRink({ className, children }: HockeyRinkProps) {
  return (
    <div
      className={cn(
        "relative mx-auto aspect-[16/9] w-full overflow-hidden rounded-3xl border border-cyan-500/30 bg-gradient-to-b from-cyan-950/70 via-cyan-950/40 to-cyan-950/70 p-2 shadow-lg",
        className
      )}
    >
      <svg
        viewBox="0 0 100 56"
        className="h-full w-full fill-none stroke-[0.75]"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Outer Rink Boards */}
        <rect
          x="2"
          y="2"
          width="96"
          height="52"
          rx="12"
          className="stroke-cyan-300/40"
        />

        {/* Center Red Line */}
        <line x1="50" y1="2" x2="50" y2="54" className="stroke-red-500/60 stroke-[1]" />

        {/* Center Ice Faceoff Circle & Spot */}
        <circle cx="50" cy="28" r="7.5" className="stroke-cyan-400/50" />
        <circle cx="50" cy="28" r="0.8" className="fill-cyan-400/80 stroke-none" />

        {/* Neutral Zone Blue Lines */}
        <line x1="37" y1="2" x2="37" y2="54" className="stroke-blue-500/70 stroke-[1]" />
        <line x1="63" y1="2" x2="63" y2="54" className="stroke-blue-500/70 stroke-[1]" />

        {/* Goal Lines (Red) */}
        <line x1="9" y1="5.5" x2="9" y2="50.5" className="stroke-red-400/40 stroke-[0.6]" />
        <line x1="91" y1="5.5" x2="91" y2="50.5" className="stroke-red-400/40 stroke-[0.6]" />

        {/* Goal Creases */}
        <path d="M 9 25 A 3 3 0 0 1 9 31 Z" className="stroke-cyan-400/50 fill-cyan-400/10" />
        <path d="M 91 25 A 3 3 0 0 0 91 31 Z" className="stroke-cyan-400/50 fill-cyan-400/10" />

        {/* End Zone Faceoff Circles (Left) */}
        <circle cx="21" cy="15" r="6" className="stroke-red-400/40" />
        <circle cx="21" cy="15" r="0.6" className="fill-red-400/70 stroke-none" />
        <circle cx="21" cy="41" r="6" className="stroke-red-400/40" />
        <circle cx="21" cy="41" r="0.6" className="fill-red-400/70 stroke-none" />

        {/* End Zone Faceoff Circles (Right) */}
        <circle cx="79" cy="15" r="6" className="stroke-red-400/40" />
        <circle cx="79" cy="15" r="0.6" className="fill-red-400/70 stroke-none" />
        <circle cx="79" cy="41" r="6" className="stroke-red-400/40" />
        <circle cx="79" cy="41" r="0.6" className="fill-red-400/70 stroke-none" />
      </svg>

      {/* Surface Overlay Elements (Puck events, player pins) */}
      {children && <div className="absolute inset-0 z-10 pointer-events-none">{children}</div>}
    </div>
  );
}
