"use client";

import React from "react";
import { cn } from "~/lib/utils";
import { Community as Handshake, Shield, ScaleFrameEnlarge as Scale, StatUp as TrendingUp } from "iconoir-react";

/**
 * ActionCardGraphic — Ambient gradient glow + large watermark glyph.
 *
 * Design rationale (Apple §16.6 Simplicity + §12 Materials & Depth):
 * - One soft radial gradient blob in the card's accent color (bottom-right).
 * - One large Iconoir glyph rendered as a low-opacity stroke watermark.
 * - Single CSS transition on hover (brightening). Zero animation at rest.
 * - The glyph provides identity; the glow provides atmosphere.
 *   Nothing competes with the card's text content.
 */
function ActionCardGraphic({
  className,
  Icon,
  glowColor,
}: {
  className?: string;
  Icon: React.ComponentType<{ className?: string; strokeWidth?: number | string }>;
  glowColor: string;
}) {
  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-0 overflow-hidden transition-all duration-300",
        className
      )}
    >
      {/* Ambient radial gradient glow — bottom-right */}
      <div
        className={cn(
          "pointer-events-none absolute -right-4 -bottom-4 h-20 w-20 rounded-full blur-xl transition-opacity duration-300 select-none",
          "opacity-[0.14] group-hover:opacity-[0.28]",
          glowColor
        )}
      />

      {/* Watermark glyph — positioned bottom-right */}
      <Icon
        className={cn(
          "pointer-events-none absolute -right-1.5 -bottom-1.5 h-11 w-11 transition-all duration-300 select-none",
          "opacity-[0.07] group-hover:scale-105 group-hover:opacity-[0.15]",
          "text-current"
        )}
        strokeWidth={1.2}
      />
    </div>
  );
}

export function DiplomacyGraphic({ className }: { className?: string }) {
  return <ActionCardGraphic className={className} Icon={Handshake} glowColor="bg-teal-400" />;
}

export function DefenseGraphic({ className }: { className?: string }) {
  return <ActionCardGraphic className={className} Icon={Shield} glowColor="bg-red-400" />;
}

export function PoliticsGraphic({ className }: { className?: string }) {
  return <ActionCardGraphic className={className} Icon={Scale} glowColor="bg-violet-400" />;
}

export function EconomyGraphic({ className }: { className?: string }) {
  return <ActionCardGraphic className={className} Icon={TrendingUp} glowColor="bg-emerald-400" />;
}
