"use client";

import React from "react";
import type { ImageContext } from "~/lib/country-image-engine";
import { cn } from "~/lib/utils";
import type { LucideIcon } from "lucide-react";

/** Map accent color names to gradient classes */
const ACCENT_GRADIENTS: Record<string, string> = {
  emerald: "from-emerald-600/12 via-emerald-600/5 to-transparent",
  red: "from-red-600/12 via-red-600/5 to-transparent",
  amber: "from-amber-600/12 via-amber-600/5 to-transparent",
  cyan: "from-cyan-600/12 via-cyan-600/5 to-transparent",
  blue: "from-blue-600/12 via-blue-600/5 to-transparent",
  indigo: "from-indigo-600/12 via-indigo-600/5 to-transparent",
  purple: "from-purple-600/12 via-purple-600/5 to-transparent",
  pink: "from-pink-600/12 via-pink-600/5 to-transparent",
  orange: "from-orange-600/12 via-orange-600/5 to-transparent",
};

const ACCENT_ICON_BG: Record<string, string> = {
  emerald: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  red: "bg-red-500/15 text-red-600 dark:text-red-400",
  amber: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  cyan: "bg-cyan-500/15 text-cyan-600 dark:text-cyan-400",
  blue: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
  indigo: "bg-indigo-500/15 text-indigo-600 dark:text-indigo-400",
  purple: "bg-purple-500/15 text-purple-600 dark:text-purple-400",
  pink: "bg-pink-500/15 text-pink-600 dark:text-pink-400",
  orange: "bg-orange-500/15 text-orange-600 dark:text-orange-400",
};

interface TabHeroBannerProps {
  context: ImageContext;
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
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
        accentColor && `border-b-2 border-${accentColor}-500/30`,
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
