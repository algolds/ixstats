"use client";

import React from "react";
import type { ImageContext } from "~/lib/country-image-engine";
import { cn } from "~/lib/utils";

/** Map context strings to subtle accent gradients */
const CONTEXT_GRADIENTS: Record<string, string> = {
  overview_economy: "from-emerald-500/8 via-emerald-500/3 to-transparent",
  overview_government: "from-violet-500/8 via-violet-500/3 to-transparent",
  overview_demographics: "from-blue-500/8 via-blue-500/3 to-transparent",
  overview_labor: "from-orange-500/8 via-orange-500/3 to-transparent",
  overview_analytics: "from-pink-500/8 via-pink-500/3 to-transparent",
  executive: "from-amber-500/8 via-amber-500/3 to-transparent",
  diplomacy: "from-cyan-500/8 via-cyan-500/3 to-transparent",
  intelligence: "from-blue-500/8 via-blue-500/3 to-transparent",
  defense: "from-red-500/8 via-red-500/3 to-transparent",
  politics: "from-indigo-500/8 via-indigo-500/3 to-transparent",
};

interface SectionHeaderBackgroundProps {
  context: ImageContext;
  children: React.ReactNode;
  className?: string;
  /** Controls overlay darkness. Default 0.82 (kept for API compat, now ignored) */
  overlayOpacity?: number;
}

/**
 * Wraps a section header with a themed gradient background.
 * Uses section-specific accent colors instead of external images.
 */
export function SectionHeaderBackground({
  context,
  children,
  className,
}: SectionHeaderBackgroundProps) {
  const gradient = CONTEXT_GRADIENTS[context] ?? "from-muted/8 to-transparent";

  return (
    <div className={cn("relative overflow-hidden rounded-xl", className)}>
      {/* Themed gradient background */}
      <div className={cn("absolute inset-0 z-0 bg-gradient-to-br", gradient)} />
      {/* Content */}
      <div className="relative z-[1]">{children}</div>
    </div>
  );
}
