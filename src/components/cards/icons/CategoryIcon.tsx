"use client";

/**
 * CategoryIcon Component
 *
 * Renders a category icon using game-icons.net vector silhouettes
 * (Icons by Lorc, Delapouite & contributors, CC BY 3.0).
 *
 * Canonical treatments:
 *   - watermark: Large, low opacity (30-40%), card face background
 *   - emblem:    Medium, full opacity, category markers in nav/filters/headers
 *   - seal:      Tiny, full opacity, inline metadata chips/rows
 *
 * All icons use `currentColor` — set the color on the parent element
 * or pass it via the `color` prop.
 *
 * @example
 * ```tsx
 * <CategoryIcon category="MILITARY" treatment="watermark" />
 * <CategoryIcon category="GEOGRAPHY" treatment="emblem" className="text-emerald-500" />
 * <CategoryIcon category="SCIENCE" treatment="seal" size="xs" />
 * ```
 */

import React from "react";
import { cn } from "~/lib/utils";
import type { LoreCategory } from "~/lib/cards/category-enums";
import { getCategoryIconDef } from "./icon-paths";

// ─── Types ──────────────────────────────────────────────────────

export type IconTreatment = "watermark" | "emblem" | "seal";
export type IconSize = "xs" | "sm" | "md" | "lg" | "xl";

export interface CategoryIconProps {
  /** Which category icon to render */
  category: LoreCategory;
  /** Rendering treatment — controls size, opacity, and styling */
  treatment?: IconTreatment;
  /** Optional explicit size variant override */
  size?: IconSize;
  /** Override the icon color (otherwise inherits from parent via currentColor) */
  color?: string;
  /** Additional CSS classes on the SVG element */
  className?: string;
  /** Accessible label (defaults to category name) */
  "aria-label"?: string;
}

// ─── Treatment & Size Config ────────────────────────────────────

const TREATMENT_CONFIG: Record<IconTreatment, { sizeClass: string; opacity: number }> = {
  watermark: {
    sizeClass: "w-full h-full",
    opacity: 0.35,
  },
  emblem: {
    sizeClass: "w-16 h-16",
    opacity: 1,
  },
  seal: {
    sizeClass: "w-5 h-5",
    opacity: 1,
  },
};

const SIZE_OVERRIDES: Record<IconSize, string> = {
  xs: "w-3.5 h-3.5",
  sm: "w-4 h-4",
  md: "w-6 h-6",
  lg: "w-12 h-12",
  xl: "w-20 h-20",
};

// ─── Component ──────────────────────────────────────────────────

export const CategoryIcon = React.memo<CategoryIconProps>(
  ({ category, treatment = "emblem", size, color, className, "aria-label": ariaLabel }) => {
    const iconDef = getCategoryIconDef(category);
    const config = TREATMENT_CONFIG[treatment] ?? TREATMENT_CONFIG.emblem;
    const sizeClass = size ? SIZE_OVERRIDES[size] : config.sizeClass;

    return (
      <svg
        viewBox={iconDef.viewBox}
        xmlns="http://www.w3.org/2000/svg"
        role="img"
        aria-label={ariaLabel ?? category.toLowerCase().replace("_", " ")}
        className={cn("shrink-0", sizeClass, className)}
        style={{
          color: color ?? undefined,
          opacity: config.opacity,
        }}
        fill="currentColor"
      >
        <path d={iconDef.path} fill="currentColor" />
      </svg>
    );
  }
);

CategoryIcon.displayName = "CategoryIcon";
