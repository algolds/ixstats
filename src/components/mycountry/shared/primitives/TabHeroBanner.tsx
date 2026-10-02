"use client";

import React from "react";
import type { ImageContext } from "~/lib/media";
import { cn } from "~/lib/utils";
import { Card } from "~/components/ui/card";

/** Accent colour names → the icon's accent (the only place the accent shows). */
const ACCENT_ICON: Record<string, string> = {
  emerald: "text-green",
  red: "text-red",
  amber: "text-yellow",
  cyan: "text-cyan",
  blue: "text-blue",
  indigo: "text-indigo",
  purple: "text-indigo",
  pink: "text-blue",
  orange: "text-yellow",
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
  const iconClass = (accentColor && ACCENT_ICON[accentColor]) ?? "text-label-secondary";

  return (
    <Card
      className={cn("rounded-card mb-4 flex items-center px-4 sm:px-6", heightClass, className)}
    >
      {Icon && <Icon className={cn("mr-3 h-5 w-5 shrink-0", iconClass)} />}
      <div className="min-w-0">
        <h3 className="text-label text-headline sm:text-headline">{title}</h3>
        {subtitle && (
          <p className="text-label-secondary text-footnote sm:text-body mt-0.5">{subtitle}</p>
        )}
      </div>
    </Card>
  );
});
