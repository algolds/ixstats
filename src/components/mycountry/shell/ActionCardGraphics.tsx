"use client";

import React from "react";
import {
  Globe,
  HistoricShieldAlt as HistoricShield,
  ScaleFrameEnlarge as Scale,
  StatUp as TrendingUp,
} from "iconoir-react";
import { cn } from "~/lib/utils";
import { HUE_PAINT, type DomainHue } from "./domain-hue";

/**
 * Fine-stroke architectural watermarks behind the four domain tiles, restored from the pre-Facet
 * overview (c5c6b382): each domain's arcs and glyph in its own hue (Diplomacy cyan, Defense red,
 * Politics indigo, Economy green — system colours, no `dark:` pair), strokes ≤1px, arcs at .15 and
 * the glyph at .10 → .20 with the v2 hover drift (scale 105%, dropped under Reduce Motion).
 * Decorative only: aria-hidden, not printed, no pointer events. The tile must be
 * `relative overflow-hidden` and `group`, with its content `relative`.
 */

const LAYER =
  "pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit] select-none print:hidden";
const ARCS =
  "absolute -right-6 -bottom-6 size-36 opacity-[0.15] transition-[opacity,scale] duration-300 ease-out group-hover:scale-105 group-hover:opacity-[0.22] motion-reduce:group-hover:scale-100";
const GLYPH =
  "absolute -right-1 -bottom-1 size-16 opacity-[0.1] transition-[opacity,scale] duration-300 ease-out group-hover:scale-105 group-hover:opacity-[0.2] motion-reduce:group-hover:scale-100";

function GraphicLayer({
  className,
  hue,
  arcs,
  glyph: Glyph,
}: {
  className?: string;
  hue: DomainHue;
  arcs: React.ReactNode;
  glyph: React.ComponentType<{ className?: string; strokeWidth?: number | string }>;
}) {
  const paint = HUE_PAINT[hue].glyph;
  return (
    <span aria-hidden="true" data-slot="tile-graphic" className={cn(LAYER, className)}>
      <svg
        className={cn(ARCS, paint)}
        viewBox="0 0 100 100"
        fill="none"
        stroke="currentColor"
        strokeWidth="0.75"
      >
        {arcs}
      </svg>
      <Glyph className={cn(GLYPH, paint)} strokeWidth={1} />
    </span>
  );
}

/** Treaty rings and meridian arcs, with a globe. */
export function DiplomacyGraphic({ className }: { className?: string }) {
  return (
    <GraphicLayer
      hue="cyan"
      className={className}
      glyph={Globe}
      arcs={
        <>
          <circle cx="90" cy="90" r="30" strokeDasharray="3 3" opacity="0.6" />
          <circle cx="90" cy="90" r="50" opacity="0.4" />
          <circle cx="90" cy="90" r="70" strokeDasharray="2 4" opacity="0.3" />
          <path d="M20 90 Q 55 40 90 20" strokeDasharray="4 2" opacity="0.5" />
          <path d="M40 90 Q 65 60 90 40" opacity="0.4" />
        </>
      }
    />
  );
}

/** Radar rings and bearing lines, with a heraldic shield. */
export function DefenseGraphic({ className }: { className?: string }) {
  return (
    <GraphicLayer
      hue="red"
      className={className}
      glyph={HistoricShield}
      arcs={
        <>
          <polygon points="90,40 50,70 90,90" strokeDasharray="3 3" opacity="0.4" />
          <circle cx="90" cy="90" r="35" opacity="0.5" />
          <circle cx="90" cy="90" r="60" strokeDasharray="4 4" opacity="0.3" />
          <line x1="20" y1="90" x2="90" y2="90" opacity="0.5" />
          <line x1="90" y1="20" x2="90" y2="90" opacity="0.5" />
          <line x1="40" y1="40" x2="90" y2="90" strokeDasharray="2 3" opacity="0.4" />
        </>
      }
    />
  );
}

/** A legislative hemicycle and columns, with the scales. */
export function PoliticsGraphic({ className }: { className?: string }) {
  return (
    <GraphicLayer
      hue="indigo"
      className={className}
      glyph={Scale}
      arcs={
        <>
          <circle cx="90" cy="90" r="25" opacity="0.5" />
          <circle cx="90" cy="90" r="45" strokeDasharray="2 3" opacity="0.4" />
          <circle cx="90" cy="90" r="65" opacity="0.3" />
          <path d="M30 90 A 60 60 0 0 1 90 30" strokeDasharray="3 3" opacity="0.5" />
          <line x1="50" y1="90" x2="50" y2="50" strokeDasharray="2 2" opacity="0.3" />
          <line x1="70" y1="90" x2="70" y2="35" opacity="0.4" />
        </>
      }
    />
  );
}

/** A market grid and ascending trend vectors, with a rising line. */
export function EconomyGraphic({ className }: { className?: string }) {
  return (
    <GraphicLayer
      hue="green"
      className={className}
      glyph={TrendingUp}
      arcs={
        <>
          <line x1="30" y1="90" x2="90" y2="30" opacity="0.6" />
          <line x1="50" y1="90" x2="90" y2="50" strokeDasharray="3 2" opacity="0.4" />
          <line x1="10" y1="90" x2="90" y2="10" strokeDasharray="4 3" opacity="0.3" />
          <circle cx="90" cy="30" r="3" fill="currentColor" opacity="0.5" />
          <circle cx="60" cy="60" r="2.5" fill="currentColor" opacity="0.4" />
          <path d="M30 85 L50 70 L70 50 L90 20" strokeWidth="1" opacity="0.5" />
        </>
      }
    />
  );
}
