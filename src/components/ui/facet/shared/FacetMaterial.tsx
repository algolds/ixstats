"use client";

import * as React from "react";
import { cn } from "~/lib/utils/cn";

/** Floating glass: `chrome` (sidebar, tab bar, toolbars, map controls, Halo) or `overlay` (sheets, popovers, menus). Content cards are `Card`, never this. */
type FacetLayer = "chrome" | "overlay";

interface FacetMaterialProps extends React.HTMLAttributes<HTMLDivElement> {
  /** @default "chrome" */
  layer?: FacetLayer;
  as?: React.ElementType;
  children?: React.ReactNode;
}

const LAYER: Record<FacetLayer, string> = {
  chrome: "facet-chrome",
  overlay: "facet-overlay",
};

export const FacetMaterial = React.forwardRef<HTMLDivElement, FacetMaterialProps>(
  ({ layer = "chrome", as: Component = "div", className, ...props }, ref) => (
    <Component
      ref={ref}
      data-slot="facet-material"
      className={cn("text-label rounded-card relative", LAYER[layer], className)}
      {...props}
    />
  )
);

FacetMaterial.displayName = "FacetMaterial";
