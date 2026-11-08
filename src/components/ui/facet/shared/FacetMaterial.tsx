"use client";

import * as React from "react";
import { cn } from "~/lib/utils/cn";
import { InsideSurface } from "~/components/ui/card";

/**
 * Floating glass: `chrome` (sidebar, tab bar, toolbars, map controls, Halo) or `overlay` (sheets,
 * popovers, menus). `lens` is refractive glass over a decorative backdrop (a monogram, art, a map) for a
 * brand moment, at most one per view. Content cards are `Card`, never this.
 */
type FacetLayer = "chrome" | "overlay" | "lens";

interface FacetMaterialProps extends React.HTMLAttributes<HTMLDivElement> {
  /** @default "chrome" */
  layer?: FacetLayer;
  as?: React.ElementType;
  children?: React.ReactNode;
}

const LAYER: Record<FacetLayer, string> = {
  chrome: "facet-chrome",
  overlay: "facet-overlay",
  lens: "facet-lens",
};

export const FacetMaterial = React.forwardRef<HTMLDivElement, FacetMaterialProps>(
  ({ layer = "chrome", as: Component = "div", className, children, ...props }, ref) => {
    return (
      <Component
        ref={ref}
        data-slot="facet-material"
        data-layer={layer}
        className={cn("text-label rounded-card relative", LAYER[layer], className)}
        {...props}
      >
        {layer === "overlay" ? children : <InsideSurface>{children}</InsideSurface>}
      </Component>
    );
  }
);

FacetMaterial.displayName = "FacetMaterial";
