"use client";

import React from "react";
import type { ImageContext } from "~/lib/media";
import { cn } from "~/lib/utils";
import { FacetCard } from "~/components/ui/facet-container";

/** Accent colour names → the icon's accent (the only place the accent shows). */
const ACCENT_ICON: Record<string, string> = {
  emerald: "text-emerald-500",
  red: "text-red-500",
  amber: "text-amber-500",
  cyan: "text-cyan-500",
  blue: "text-blue-500",
  indigo: "text-indigo-500",
  purple: "text-indigo-500",
  pink: "text-blue-500",
  orange: "text-amber-500",
};

interface TabHeroBannerProps {
  context: ImageContext;
  title: string;
  subtitle?: string;
  icon?: React.ComponentType<{ className?: string }>;
  /** Height class. Default: "h-20 sm:h-24" */
  heightClass?: string;
  /** Overlay darkness. Default 0.75 (kept for API compat, now ignored) */
  overlayOpacity?: number;
  /** Theme accent color name for bottom border and gradient */
  accentColor?: string;
  className?: string;
}

/**
 * Compact section header for tab content areas: a Facet surface with a plain icon and title.
 * (Formerly a gradient hero; the accent now lives only on the icon.)
 */
export const TabHeroBanner = React.memo(function TabHeroBanner({
  title,
  subtitle,
  icon: Icon,
  heightClass = "h-20 sm:h-24",
  accentColor,
  className,
}: TabHeroBannerProps) {
  const iconClass = (accentColor && ACCENT_ICON[accentColor]) ?? "text-muted-foreground";

  return (
    <FacetCard
      depth={1}
      className={cn("mb-4 flex items-center rounded-2xl px-4 sm:px-6", heightClass, className)}
    >
      {Icon && <Icon className={cn("mr-3 h-5 w-5 shrink-0", iconClass)} />}
      <div className="min-w-0">
        <h3 className="text-foreground text-sm font-semibold sm:text-base">{title}</h3>
        {subtitle && <p className="text-muted-foreground mt-0.5 text-xs sm:text-sm">{subtitle}</p>}
      </div>
    </FacetCard>
  );
});
