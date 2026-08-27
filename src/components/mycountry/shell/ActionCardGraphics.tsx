"use client";

import React from "react";
import { cn } from "~/lib/utils";
import {
  Globe,
  HistoricShieldAlt as HistoricShield,
  ScaleFrameEnlarge as Scale,
  StatUp as TrendingUp,
} from "iconoir-react";

/**
 * Apple Design & Emil Kowalski Principles:
 * - Subtle etched watermark with fine stroke weights (0.75px).
 * - Natural low opacity (0.15 - 0.25) prevents harsh boundary clipping and GPU mask artifacts.
 * - Dynamic resting-to-hover physics: gentle drift + opacity bloom without layout shifting.
 */

export function DiplomacyGraphic({ className }: { className?: string }) {
  return (
    <div
      className={cn("pointer-events-none absolute inset-0 overflow-hidden select-none", className)}
    >
      {/* Background Treaty Rings & Global Meridian Arcs */}
      <svg
        className="absolute -right-6 -bottom-6 h-36 w-36 text-teal-500/15 transition-all duration-300 ease-out group-hover:scale-105 group-hover:opacity-80 dark:text-teal-400/15"
        viewBox="0 0 100 100"
        fill="none"
        stroke="currentColor"
        strokeWidth="0.75"
      >
        <circle cx="90" cy="90" r="30" strokeDasharray="3 3" opacity="0.6" />
        <circle cx="90" cy="90" r="50" opacity="0.4" />
        <circle cx="90" cy="90" r="70" strokeDasharray="2 4" opacity="0.3" />
        <path d="M20 90 Q 55 40 90 20" strokeDasharray="4 2" opacity="0.5" />
        <path d="M40 90 Q 65 60 90 40" opacity="0.4" />
      </svg>

      {/* Primary Globe Glyph */}
      <div className="absolute -right-1 -bottom-1 text-teal-600/10 transition-all duration-300 ease-out group-hover:scale-105 group-hover:text-teal-500/20 dark:text-teal-400/10 dark:group-hover:text-teal-300/20">
        <Globe className="h-16 w-16" strokeWidth={1} />
      </div>
    </div>
  );
}

export function DefenseGraphic({ className }: { className?: string }) {
  return (
    <div
      className={cn("pointer-events-none absolute inset-0 overflow-hidden select-none", className)}
    >
      {/* Background Tactical Radar & Chevrons */}
      <svg
        className="absolute -right-6 -bottom-6 h-36 w-36 text-red-500/15 transition-all duration-300 ease-out group-hover:scale-105 group-hover:opacity-80 dark:text-red-400/15"
        viewBox="0 0 100 100"
        fill="none"
        stroke="currentColor"
        strokeWidth="0.75"
      >
        <polygon points="90,40 50,70 90,90" strokeDasharray="3 3" opacity="0.4" />
        <circle cx="90" cy="90" r="35" opacity="0.5" />
        <circle cx="90" cy="90" r="60" strokeDasharray="4 4" opacity="0.3" />
        <line x1="20" y1="90" x2="90" y2="90" opacity="0.5" />
        <line x1="90" y1="20" x2="90" y2="90" opacity="0.5" />
        <line x1="40" y1="40" x2="90" y2="90" strokeDasharray="2 3" opacity="0.4" />
      </svg>

      {/* Primary Heraldic Shield Aegis Glyph */}
      <div className="absolute -right-1 -bottom-1 text-red-600/10 transition-all duration-300 ease-out group-hover:scale-105 group-hover:text-red-500/20 dark:text-red-400/10 dark:group-hover:text-red-300/20">
        <HistoricShield className="h-16 w-16" strokeWidth={1} />
      </div>
    </div>
  );
}

export function PoliticsGraphic({ className }: { className?: string }) {
  return (
    <div
      className={cn("pointer-events-none absolute inset-0 overflow-hidden select-none", className)}
    >
      {/* Background Legislative Hemicycle & Column Lines */}
      <svg
        className="absolute -right-6 -bottom-6 h-36 w-36 text-violet-500/15 transition-all duration-300 ease-out group-hover:scale-105 group-hover:opacity-80 dark:text-violet-400/15"
        viewBox="0 0 100 100"
        fill="none"
        stroke="currentColor"
        strokeWidth="0.75"
      >
        <circle cx="90" cy="90" r="25" opacity="0.5" />
        <circle cx="90" cy="90" r="45" strokeDasharray="2 3" opacity="0.4" />
        <circle cx="90" cy="90" r="65" opacity="0.3" />
        <path d="M30 90 A 60 60 0 0 1 90 30" strokeDasharray="3 3" opacity="0.5" />
        <line x1="50" y1="90" x2="50" y2="50" strokeDasharray="2 2" opacity="0.3" />
        <line x1="70" y1="90" x2="70" y2="35" opacity="0.4" />
      </svg>

      {/* Primary Scale Balance Glyph */}
      <div className="absolute -right-1 -bottom-1 text-violet-600/10 transition-all duration-300 ease-out group-hover:scale-105 group-hover:text-violet-500/20 dark:text-violet-400/10 dark:group-hover:text-violet-300/20">
        <Scale className="h-16 w-16" strokeWidth={1} />
      </div>
    </div>
  );
}

export function EconomyGraphic({ className }: { className?: string }) {
  return (
    <div
      className={cn("pointer-events-none absolute inset-0 overflow-hidden select-none", className)}
    >
      {/* Background Market Grid & Ascending Trend Vectors */}
      <svg
        className="absolute -right-6 -bottom-6 h-36 w-36 text-emerald-500/15 transition-all duration-300 ease-out group-hover:scale-105 group-hover:opacity-80 dark:text-emerald-400/15"
        viewBox="0 0 100 100"
        fill="none"
        stroke="currentColor"
        strokeWidth="0.75"
      >
        <line x1="30" y1="90" x2="90" y2="30" opacity="0.6" />
        <line x1="50" y1="90" x2="90" y2="50" strokeDasharray="3 2" opacity="0.4" />
        <line x1="10" y1="90" x2="90" y2="10" strokeDasharray="4 3" opacity="0.3" />
        <circle cx="90" cy="30" r="3" fill="currentColor" opacity="0.5" />
        <circle cx="60" cy="60" r="2.5" fill="currentColor" opacity="0.4" />
        <path d="M30 85 L50 70 L70 50 L90 20" strokeWidth="1" opacity="0.5" />
      </svg>

      {/* Primary Trending Up Vector Glyph with Treasury Coin Nodes */}
      <div className="absolute -right-1 -bottom-1 text-emerald-600/10 transition-all duration-300 ease-out group-hover:scale-105 group-hover:text-emerald-500/20 dark:text-emerald-400/10 dark:group-hover:text-emerald-300/20">
        <TrendingUp className="h-16 w-16" strokeWidth={1} />
      </div>
    </div>
  );
}
