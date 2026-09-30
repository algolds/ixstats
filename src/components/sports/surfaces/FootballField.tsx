"use client";

import React from "react";
import { cn } from "~/lib/utils";

export interface FootballFieldProps {
  className?: string;
  children?: React.ReactNode;
}

export function FootballField({ className, children }: FootballFieldProps) {
  return (
    <div
      className={cn(
        "relative mx-auto aspect-[16/9] w-full overflow-hidden rounded-3xl border border-emerald-500/20 bg-gradient-to-b from-slate-950/90 via-emerald-950/70 to-slate-950/90 p-2 shadow-xl",
        className
      )}
    >
      <svg
        viewBox="0 0 120 60"
        className="h-full w-full fill-none stroke-[0.6]"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Field Boundary */}
        <rect
          x="2"
          y="2"
          width="116"
          height="56"
          rx="2"
          className="stroke-emerald-400/40"
        />

        {/* Left Endzone (0-10 yds) */}
        <rect
          x="2"
          y="2"
          width="12"
          height="56"
          className="fill-blue-500/10 stroke-blue-400/40"
        />

        {/* Right Endzone (110-120 yds) */}
        <rect
          x="106"
          y="2"
          width="12"
          height="56"
          className="fill-amber-500/10 stroke-amber-400/40"
        />

        {/* Goal Lines */}
        <line x1="14" y1="2" x2="14" y2="58" className="stroke-white/80 stroke-[1]" />
        <line x1="106" y1="2" x2="106" y2="58" className="stroke-white/80 stroke-[1]" />

        {/* 10-Yard Increment Lines */}
        <line x1="23.2" y1="2" x2="23.2" y2="58" className="stroke-white/30" />
        <line x1="32.4" y1="2" x2="32.4" y2="58" className="stroke-white/30" />
        <line x1="41.6" y1="2" x2="41.6" y2="58" className="stroke-white/30" />
        <line x1="50.8" y1="2" x2="50.8" y2="58" className="stroke-white/30" />
        {/* 50-Yard Midfield Line */}
        <line x1="60" y1="2" x2="60" y2="58" className="stroke-white/70 stroke-[0.9]" />
        <line x1="69.2" y1="2" x2="69.2" y2="58" className="stroke-white/30" />
        <line x1="78.4" y1="2" x2="78.4" y2="58" className="stroke-white/30" />
        <line x1="87.6" y1="2" x2="87.6" y2="58" className="stroke-white/30" />
        <line x1="96.8" y1="2" x2="96.8" y2="58" className="stroke-white/30" />

        {/* Midfield Emblem Circle */}
        <circle cx="60" cy="30" r="5" className="stroke-white/30" />

        {/* Yard Numbers (Subtle) */}
        <g className="fill-white/30 text-[3px] font-mono font-bold select-none text-anchor-middle">
          <text x="23.2" y="10" textAnchor="middle">10</text>
          <text x="32.4" y="10" textAnchor="middle">20</text>
          <text x="41.6" y="10" textAnchor="middle">30</text>
          <text x="50.8" y="10" textAnchor="middle">40</text>
          <text x="60" y="10" textAnchor="middle">50</text>
          <text x="69.2" y="10" textAnchor="middle">40</text>
          <text x="78.4" y="10" textAnchor="middle">30</text>
          <text x="87.6" y="10" textAnchor="middle">20</text>
          <text x="96.8" y="10" textAnchor="middle">10</text>

          <text x="23.2" y="53" textAnchor="middle">10</text>
          <text x="32.4" y="53" textAnchor="middle">20</text>
          <text x="41.6" y="53" textAnchor="middle">30</text>
          <text x="50.8" y="53" textAnchor="middle">40</text>
          <text x="60" y="53" textAnchor="middle">50</text>
          <text x="69.2" y="53" textAnchor="middle">40</text>
          <text x="78.4" y="53" textAnchor="middle">30</text>
          <text x="87.6" y="53" textAnchor="middle">20</text>
          <text x="96.8" y="53" textAnchor="middle">10</text>
        </g>

        {/* Inbounds Hash Marks (Top & Bottom Hashes) */}
        {Array.from({ length: 19 }).map((_, i) => {
          const x = 14 + (i + 1) * 4.6;
          return (
            <React.Fragment key={i}>
              <line x1={x} y1="22" x2={x} y2="23.5" className="stroke-white/30" />
              <line x1={x} y1="36.5" x2={x} y2="38" className="stroke-white/30" />
            </React.Fragment>
          );
        })}
      </svg>

      {/* Surface Overlay Elements (Players, Markers, Animation) */}
      {children && <div className="absolute inset-0 z-10 pointer-events-none">{children}</div>}
    </div>
  );
}
export default FootballField;
