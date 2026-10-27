"use client";

import React from "react";
import { cn } from "~/lib/utils";

interface HockeyRinkProps {
  className?: string;
  children?: React.ReactNode;
}

export function HockeyRink({ className, children }: HockeyRinkProps) {
  return (
    <div
      className={cn(
        "rounded-card border-teal/30 bg-teal/10 relative mx-auto aspect-[16/9] w-full overflow-hidden border p-2",
        className
      )}
    >
      <svg
        viewBox="0 0 100 56"
        className="h-full w-full fill-none stroke-[0.75]"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Outer Rink Boards */}
        <rect x="2" y="2" width="96" height="52" rx="12" className="stroke-teal/40" />

        {/* Center Red Line */}
        <line x1="50" y1="2" x2="50" y2="54" className="stroke-red/60 stroke-[1]" />

        {/* Center Ice Faceoff Circle & Spot */}
        <circle cx="50" cy="28" r="7.5" className="stroke-teal/50" />
        <circle cx="50" cy="28" r="0.8" className="fill-teal/80 stroke-none" />

        {/* Neutral Zone Blue Lines */}
        <line x1="37" y1="2" x2="37" y2="54" className="stroke-blue/70 stroke-[1]" />
        <line x1="63" y1="2" x2="63" y2="54" className="stroke-blue/70 stroke-[1]" />

        {/* Goal Lines (Red) */}
        <line x1="9" y1="5.5" x2="9" y2="50.5" className="stroke-red/40 stroke-[0.6]" />
        <line x1="91" y1="5.5" x2="91" y2="50.5" className="stroke-red/40 stroke-[0.6]" />

        {/* Goal Creases */}
        <path d="M 9 25 A 3 3 0 0 1 9 31 Z" className="stroke-teal/50 fill-teal/10" />
        <path d="M 91 25 A 3 3 0 0 0 91 31 Z" className="stroke-teal/50 fill-teal/10" />

        {/* End Zone Faceoff Circles (Left) */}
        <circle cx="21" cy="15" r="6" className="stroke-red/40" />
        <circle cx="21" cy="15" r="0.6" className="fill-red/70 stroke-none" />
        <circle cx="21" cy="41" r="6" className="stroke-red/40" />
        <circle cx="21" cy="41" r="0.6" className="fill-red/70 stroke-none" />

        {/* End Zone Faceoff Circles (Right) */}
        <circle cx="79" cy="15" r="6" className="stroke-red/40" />
        <circle cx="79" cy="15" r="0.6" className="fill-red/70 stroke-none" />
        <circle cx="79" cy="41" r="6" className="stroke-red/40" />
        <circle cx="79" cy="41" r="0.6" className="fill-red/70 stroke-none" />
      </svg>

      {/* Surface Overlay Elements (Puck events, player pins) */}
      {children && <div className="pointer-events-none absolute inset-0 z-10">{children}</div>}
    </div>
  );
}
