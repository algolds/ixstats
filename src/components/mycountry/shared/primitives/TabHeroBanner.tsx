"use client";

import React from "react";
import type { ImageContext } from "~/lib/media";
import { cn } from "~/lib/utils";

/** Map accent color names to subtle background tint classes */
const ACCENT_GRADIENTS: Record<string, string> = {
  emerald: "from-emerald-600/10 via-emerald-600/5 to-transparent",
  red: "from-red-600/10 via-red-600/5 to-transparent",
  amber: "from-amber-600/10 via-amber-600/5 to-transparent",
  cyan: "from-cyan-600/10 via-cyan-600/5 to-transparent",
  blue: "from-blue-600/10 via-blue-600/5 to-transparent",
  indigo: "from-indigo-600/10 via-indigo-600/5 to-transparent",
  purple: "from-indigo-600/10 via-indigo-600/5 to-transparent",
  pink: "from-blue-600/10 via-blue-600/5 to-transparent",
  orange: "from-amber-600/10 via-amber-600/5 to-transparent",
};

const ACCENT_ICON_BG: Record<string, string> = {
  emerald: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  red: "bg-red-500/15 text-red-600 dark:text-red-400",
  amber: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  cyan: "bg-cyan-500/15 text-cyan-600 dark:text-cyan-400",
  blue: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
  indigo: "bg-indigo-500/15 text-indigo-600 dark:text-indigo-400",
  purple: "bg-indigo-500/15 text-indigo-600 dark:text-indigo-400",
  pink: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
  orange: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
};

const ACCENT_BORDER: Record<string, string> = {
  emerald: "border-b-2 border-emerald-500/30",
  red: "border-b-2 border-red-500/30",
  amber: "border-b-2 border-amber-500/30",
  cyan: "border-b-2 border-cyan-500/30",
  blue: "border-b-2 border-blue-500/30",
  indigo: "border-b-2 border-indigo-500/30",
  purple: "border-b-2 border-indigo-500/30",
  pink: "border-b-2 border-blue-500/30",
  orange: "border-b-2 border-amber-500/30",
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
 * Compact hero banner for tab content areas.
 * Renders a themed gradient with title overlay.
 */
export const TabHeroBanner = React.memo(function TabHeroBanner({
  title,
  subtitle,
  icon: Icon,
  heightClass = "h-20 sm:h-24",
  accentColor,
  className,
}: TabHeroBannerProps) {
  const gradient = (accentColor && ACCENT_GRADIENTS[accentColor]) ?? "from-muted/10 to-transparent";
  const iconClasses =
    (accentColor && ACCENT_ICON_BG[accentColor]) ?? "bg-muted/50 text-muted-foreground";

  return (
    <div
      className={cn(
        "relative mb-4 overflow-hidden rounded-lg",
        heightClass,
        accentColor && ACCENT_BORDER[accentColor],
        className
      )}
    >
      {/* Themed gradient background */}
      <div className={cn("absolute inset-0 z-0 bg-gradient-to-r", gradient)} />

      {/* Content overlay */}
      <div className="relative z-[1] flex h-full items-center px-4 sm:px-6">
        {Icon && (
          <div className={cn("mr-3 shrink-0 rounded-lg p-2", iconClasses)}>
            <Icon className="h-5 w-5 sm:h-6 sm:w-6" />
          </div>
        )}
        <div>
          <h3 className="text-foreground text-sm font-semibold sm:text-base">{title}</h3>
          {subtitle && (
            <p className="text-muted-foreground mt-0.5 text-xs sm:text-sm">{subtitle}</p>
          )}
        </div>
      </div>
    </div>
  );
});
