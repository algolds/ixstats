"use client";

import React from "react";
import { cn } from "~/lib/utils";

/**
 * DiplomacyGraphic — Sovereign Embassy Gates & Diplomatic Hotline Waveform
 * Fully transparent background with interactive signal animations
 */
export function DiplomacyGraphic({ className }: { className?: string }) {
  return (
    <div className={cn("pointer-events-none relative h-16 w-full overflow-hidden bg-transparent transition-all duration-300", className)}>
      <svg className="h-full w-full" viewBox="0 0 200 65" fill="none">
        <defs>
          <linearGradient id="dipHotlineGrad" x1="0" y1="0" x2="200" y2="0" gradientUnits="userSpaceOnUse">
            <stop stopColor="#14b8a6" stopOpacity="0.3" />
            <stop offset="0.5" stopColor="#2dd4bf" stopOpacity="0.9" />
            <stop offset="1" stopColor="#10b981" stopOpacity="0.3" />
          </linearGradient>
        </defs>

        {/* Left Sovereign Embassy Gate & Flagpole */}
        <g className="transition-transform duration-300 group-hover:scale-105 origin-[30px_35px]">
          <line x1="30" y1="12" x2="30" y2="55" stroke="currentColor" strokeWidth="1.8" className="text-teal-400/60" />
          <path d="M 30 14 L 50 19 L 30 25 Z" fill="currentColor" className="text-teal-400/80 group-hover:text-teal-300 transition-colors" />
          <circle cx="30" cy="11" r="2.5" className="fill-teal-300" />
          <rect x="25" y="45" width="10" height="10" rx="1.5" stroke="currentColor" strokeWidth="1" className="text-teal-400/40 fill-teal-950/40" />
        </g>

        {/* Right Sovereign Embassy Gate & Flagpole */}
        <g className="transition-transform duration-300 group-hover:scale-105 origin-[170px_35px]">
          <line x1="170" y1="12" x2="170" y2="55" stroke="currentColor" strokeWidth="1.8" className="text-emerald-400/60" />
          <path d="M 170 14 L 150 19 L 170 25 Z" fill="currentColor" className="text-emerald-400/80 group-hover:text-emerald-300 transition-colors" />
          <circle cx="170" cy="11" r="2.5" className="fill-emerald-300" />
          <rect x="165" y="45" width="10" height="10" rx="1.5" stroke="currentColor" strokeWidth="1" className="text-emerald-400/40 fill-emerald-950/40" />
        </g>

        {/* Diplomatic Hotline Waveform & Cable Grid */}
        <path d="M 30 35 Q 65 15, 100 35 T 170 35" stroke="url(#dipHotlineGrad)" strokeWidth="2.5" strokeLinecap="round" className="group-hover:stroke-width-[3] transition-all" />
        <path d="M 30 40 Q 65 55, 100 40 T 170 40" stroke="currentColor" strokeWidth="1" strokeDasharray="3 3" className="text-teal-300/30 group-hover:text-teal-300/60 transition-colors" />

        {/* Encrypted Diplomatic Dispatch Packets */}
        <g className="transition-transform duration-300 group-hover:scale-110 origin-[100px_35px]">
          {/* Dispatch 1 */}
          <circle cx="68" cy="27" r="3.5" className="fill-teal-300 animate-pulse" />
          <circle cx="68" cy="27" r="7" stroke="currentColor" strokeWidth="0.8" className="text-teal-300/50 animate-ping" />

          {/* Central Signal Node */}
          <circle cx="100" cy="35" r="4.5" className="fill-emerald-400" />
          <circle cx="100" cy="35" r="9" stroke="currentColor" strokeWidth="1" className="text-emerald-400/40 animate-pulse" />

          {/* Dispatch 2 */}
          <circle cx="132" cy="43" r="3.5" className="fill-cyan-300 animate-pulse" />
          <circle cx="132" cy="43" r="7" stroke="currentColor" strokeWidth="0.8" className="text-cyan-300/50 animate-ping" />
        </g>
      </svg>
    </div>
  );
}

/**
 * DefenseGraphic — NationStates War Room Radar, Crosshairs & Readiness Telemetry
 * Fully transparent background with interactive hover animations
 */
export function DefenseGraphic({ className }: { className?: string }) {
  return (
    <div className={cn("pointer-events-none relative h-16 w-full overflow-hidden bg-transparent transition-all duration-300", className)}>
      <svg className="h-full w-full" viewBox="0 0 200 65" fill="none">
        {/* Tactical Crosshair Grid */}
        <line x1="30" y1="32.5" x2="170" y2="32.5" stroke="currentColor" strokeWidth="0.8" className="text-red-500/20 group-hover:text-red-500/40 transition-colors" />
        <line x1="100" y1="8" x2="100" y2="57" stroke="currentColor" strokeWidth="0.8" className="text-red-500/20 group-hover:text-red-500/40 transition-colors" />

        {/* Concentric Tactical Rings */}
        <circle cx="100" cy="32.5" r="22" stroke="currentColor" strokeWidth="1" strokeDasharray="3 3" className="text-rose-500/30 group-hover:text-rose-500/60 transition-colors" />
        <circle cx="100" cy="32.5" r="32" stroke="currentColor" strokeWidth="1" className="text-red-500/20 group-hover:text-red-500/40 transition-colors" />
        <circle cx="100" cy="32.5" r="10" stroke="currentColor" strokeWidth="1.2" className="text-red-400/40 group-hover:text-red-400/70 transition-colors" />

        {/* Rotating Radar Sweep Cone */}
        <g className="origin-[100px_32.5px] animate-[spin_5s_linear_infinite]">
          <path d="M 100 32.5 L 130 15 A 32 32 0 0 1 130 50 Z" className="fill-red-500/15 group-hover:fill-red-500/25 transition-colors" />
          <line x1="100" y1="32.5" x2="130" y2="15" stroke="currentColor" strokeWidth="1.8" className="text-rose-400" />
        </g>

        {/* War Room Target Unit Markers */}
        <g className="transition-transform duration-300 group-hover:scale-105 origin-[100px_32.5px]">
          <rect x="118" y="20" width="4" height="4" className="fill-rose-400 animate-pulse" />
          <circle cx="82" cy="40" r="2.5" className="fill-red-400" />
          <circle cx="82" cy="40" r="6" stroke="currentColor" strokeWidth="0.8" className="text-red-400/60 animate-ping" />
        </g>

        {/* Readiness Telemetry Corner Ticks */}
        <path d="M 40 18 L 40 12 L 46 12" stroke="currentColor" strokeWidth="1.2" className="text-red-400/50" />
        <path d="M 160 18 L 160 12 L 154 12" stroke="currentColor" strokeWidth="1.2" className="text-red-400/50" />
        <path d="M 40 47 L 40 53 L 46 53" stroke="currentColor" strokeWidth="1.2" className="text-red-400/50" />
        <path d="M 160 47 L 160 53 L 154 53" stroke="currentColor" strokeWidth="1.2" className="text-red-400/50" />
      </svg>
    </div>
  );
}

/**
 * PoliticsGraphic — NationStates Electoral Ballot Box & Party Spectrum Breakdown
 * Fully transparent background with interactive hover animations
 */
export function PoliticsGraphic({ className }: { className?: string }) {
  return (
    <div className={cn("pointer-events-none relative h-16 w-full overflow-hidden bg-transparent transition-all duration-300", className)}>
      <svg className="h-full w-full" viewBox="0 0 200 65" fill="none">
        {/* Transparent 3D Electoral Ballot Box Outline */}
        <g className="transition-transform duration-300 group-hover:scale-105 origin-[100px_35px]">
          {/* Box Front Face */}
          <rect x="75" y="25" width="50" height="30" rx="3" stroke="currentColor" strokeWidth="1.2" className="text-violet-400/50 fill-violet-950/20 group-hover:text-violet-400/80 transition-colors" />

          {/* Top Slot opening */}
          <ellipse cx="100" cy="25" rx="16" ry="3" stroke="currentColor" strokeWidth="1.5" className="text-violet-300" />
          <line x1="88" y1="25" x2="112" y2="25" stroke="currentColor" strokeWidth="2" className="text-purple-300" />

          {/* Falling Vote Slips entering Ballot Slot */}
          <g className="animate-[bounce_2.5s_infinite]">
            <rect x="94" y="10" width="12" height="10" rx="1" stroke="currentColor" strokeWidth="1" className="text-purple-200 fill-purple-500/30" />
            <line x1="97" y1="13" x2="103" y2="13" stroke="currentColor" strokeWidth="1" className="text-purple-100" />
            <line x1="97" y1="16" x2="101" y2="16" stroke="currentColor" strokeWidth="1" className="text-purple-100" />
          </g>

          {/* Floating Second Ballot Slip */}
          <g className="opacity-60 animate-[pulse_2s_infinite]">
            <rect x="122" y="14" width="10" height="8" rx="1" stroke="currentColor" strokeWidth="0.8" className="text-violet-300 fill-violet-500/20" />
          </g>
        </g>

        {/* Party Seat Spectrum Breakdown Bar (Bottom) */}
        <g className="transition-all duration-300">
          <rect x="35" y="58" width="35" height="3" rx="1.5" className="fill-violet-500" />
          <rect x="73" y="58" width="55" height="3" rx="1.5" className="fill-purple-400" />
          <rect x="131" y="58" width="34" height="3" rx="1.5" className="fill-rose-500" />
        </g>
      </svg>
    </div>
  );
}

/**
 * EconomyGraphic — NationStates Treasury Seal, Stock Growth Wave & Candlestick Wicks
 * Fully transparent background with interactive hover animations
 */
export function EconomyGraphic({ className }: { className?: string }) {
  return (
    <div className={cn("pointer-events-none relative h-16 w-full overflow-hidden bg-transparent transition-all duration-300", className)}>
      <svg className="h-full w-full" viewBox="0 0 200 65" fill="none">
        <defs>
          <linearGradient id="econWaveGrad" x1="0" y1="0" x2="200" y2="0" gradientUnits="userSpaceOnUse">
            <stop stopColor="#10b981" stopOpacity="0.1" />
            <stop offset="0.5" stopColor="#34d399" stopOpacity="0.4" />
            <stop offset="1" stopColor="#059669" stopOpacity="0.8" />
          </linearGradient>
        </defs>

        {/* Macroeconomic Volatility Grid Lines */}
        <line x1="15" y1="18" x2="185" y2="18" stroke="currentColor" strokeWidth="0.8" strokeDasharray="3 3" className="text-emerald-500/20 group-hover:text-emerald-500/40 transition-colors" />
        <line x1="15" y1="36" x2="185" y2="36" stroke="currentColor" strokeWidth="0.8" strokeDasharray="3 3" className="text-emerald-500/20 group-hover:text-emerald-500/40 transition-colors" />
        <line x1="15" y1="52" x2="185" y2="52" stroke="currentColor" strokeWidth="0.8" strokeDasharray="3 3" className="text-emerald-500/20 group-hover:text-emerald-500/40 transition-colors" />

        {/* Candlestick Wicks & Bars */}
        <g className="text-emerald-400/40 group-hover:text-emerald-400/70 transition-colors">
          <line x1="35" y1="28" x2="35" y2="48" stroke="currentColor" strokeWidth="1" />
          <rect x="33" y="32" width="4" height="12" className="fill-emerald-500/30" />

          <line x1="75" y1="20" x2="75" y2="44" stroke="currentColor" strokeWidth="1" />
          <rect x="73" y="24" width="4" height="16" className="fill-emerald-500/40" />

          <line x1="115" y1="14" x2="115" y2="40" stroke="currentColor" strokeWidth="1" />
          <rect x="113" y="18" width="4" height="18" className="fill-emerald-400/50" />

          <line x1="155" y1="10" x2="155" y2="38" stroke="currentColor" strokeWidth="1" />
          <rect x="153" y="14" width="4" height="20" className="fill-emerald-400/60" />
        </g>

        {/* Macroeconomic Growth Wave Path */}
        <path d="M 15 48 Q 50 42, 85 30 T 155 22 T 185 10" stroke="url(#econWaveGrad)" strokeWidth="2.5" strokeLinecap="round" />

        {/* Peak Financial Growth Indicator Node */}
        <g className="transition-transform duration-300 group-hover:scale-110 origin-[185px_10px]">
          <circle cx="185" cy="10" r="3" className="fill-emerald-400" />
          <circle cx="185" cy="10" r="7" className="stroke-emerald-300 animate-ping" strokeWidth="1" />
        </g>
      </svg>
    </div>
  );
}
