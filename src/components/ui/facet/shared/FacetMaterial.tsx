"use client";

import * as React from "react";
import { cn } from "~/lib/utils/cn";

/**
 * Glass chrome: `thin` (toolbars), `regular` (sidebar, tab bar), `thick` (sheets, popovers, menus),
 * `hero` (glass hero surface), `acrylic` (Halo island). Glass never holds more glass; anything
 * inside uses opaque roles.
 */
type FacetMaterialType = "thin" | "regular" | "thick" | "hero" | "acrylic";

interface FacetMaterialProps extends React.HTMLAttributes<HTMLDivElement> {
  /** @default "regular" */
  material?: FacetMaterialType;
  as?: React.ElementType;
  children?: React.ReactNode;
}

const MATERIAL: Record<FacetMaterialType, string> = {
  thin: "material-thin",
  regular: "material-regular",
  thick: "material-thick",
  hero: "material-hero",
  acrylic: "material-acrylic",
};

export const FacetMaterial = React.forwardRef<HTMLDivElement, FacetMaterialProps>(
  ({ material = "regular", as: Component = "div", className, ...props }, ref) => (
    <Component
      ref={ref}
      data-slot="facet-material"
      className={cn("text-label rounded-card relative", MATERIAL[material], className)}
      {...props}
    />
  )
);

FacetMaterial.displayName = "FacetMaterial";
