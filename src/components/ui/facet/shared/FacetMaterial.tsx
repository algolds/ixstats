"use client";

import * as React from "react";
import { cn } from "~/lib/utils/cn";
import { TextureOverlay, type TextureType } from "~/components/ui/texture-overlay";

export type FacetMaterialType = "satin" | "paper" | "rubber" | "metal";

export interface FacetMaterialProps extends React.HTMLAttributes<HTMLDivElement> {
  material?: FacetMaterialType;
  lightInteraction?: boolean;
  as?: React.ElementType;
  children?: React.ReactNode;
}

// Maps materials to their default physical texture overlays
const materialTextures: Record<FacetMaterialType, TextureType> = {
  satin: "diagonal",
  paper: "paperGrain",
  rubber: "dots",
  metal: "horizontalLines",
};

// Maps materials to default opacity values for their texture overlays
const materialTextureOpacities: Record<FacetMaterialType, number> = {
  satin: 0.02,
  paper: 0.07,
  rubber: 0.025,
  metal: 0.035,
};

export const FacetMaterial = React.forwardRef<HTMLDivElement, FacetMaterialProps>(
  (
    {
      material = "satin",
      lightInteraction = true,
      as: Component = "div",
      className,
      children,
      style,
      ...props
    },
    ref
  ) => {
    const internalRef = React.useRef<HTMLDivElement>(null);
    const resolvedRef = (ref as React.RefObject<HTMLDivElement>) || internalRef;

    React.useEffect(() => {
      if (!lightInteraction) return;

      const element = resolvedRef.current;
      if (!element) return;

      let frameId: number;

      const handlePointerMove = (e: PointerEvent) => {
        // Run updates within requestAnimationFrame to guarantee smooth 60fps rendering
        cancelAnimationFrame(frameId);
        frameId = requestAnimationFrame(() => {
          const rect = element.getBoundingClientRect();
          const rawX = e.clientX - rect.left;
          const rawY = e.clientY - rect.top;

          // Convert coordinates to percentages for radial/linear gradient positions
          const pctX = Math.max(0, Math.min(100, (rawX / rect.width) * 100));
          const pctY = Math.max(0, Math.min(100, (rawY / rect.height) * 100));

          // Calculate displacement from center to drive shadow direction offsets (e.g. for paper height effect)
          const centerX = rect.width / 2;
          const centerY = rect.height / 2;

          // Max displacement shift is 8px for tactile depth
          const maxDisplacement = 8;
          const diffX = ((centerX - rawX) / centerX) * maxDisplacement;
          const diffY = ((centerY - rawY) / centerY) * maxDisplacement;

          // Clamp calculated displacement shifts to avoid visual artifacts
          const clampX = Math.max(-maxDisplacement, Math.min(maxDisplacement, diffX));
          const clampY = Math.max(-maxDisplacement, Math.min(maxDisplacement, diffY));

          element.style.setProperty("--pointer-x", `${pctX.toFixed(2)}%`);
          element.style.setProperty("--pointer-y", `${pctY.toFixed(2)}%`);
          element.style.setProperty("--pointer-offset-x", `${clampX.toFixed(1)}px`);
          element.style.setProperty("--pointer-offset-y", `${clampY.toFixed(1)}px`);
        });
      };

      const handlePointerLeave = () => {
        cancelAnimationFrame(frameId);
        // Softly animate back to center
        frameId = requestAnimationFrame(() => {
          element.style.setProperty("--pointer-x", "50%");
          element.style.setProperty("--pointer-y", "50%");
          element.style.setProperty("--pointer-offset-x", "0px");
          element.style.setProperty("--pointer-offset-y", "0px");
        });
      };

      element.addEventListener("pointermove", handlePointerMove);
      element.addEventListener("pointerleave", handlePointerLeave);

      return () => {
        cancelAnimationFrame(frameId);
        element.removeEventListener("pointermove", handlePointerMove);
        element.removeEventListener("pointerleave", handlePointerLeave);
      };
    }, [lightInteraction, resolvedRef]);

    const activeTexture = materialTextures[material];
    const activeOpacity = materialTextureOpacities[material];

    // Build dynamic inline variables driving CSS styles (radial sheens, shadow offsets)
    const combinedStyle: React.CSSProperties = {
      ...style,
      "--pointer-x": "50%",
      "--pointer-y": "50%",
      "--pointer-offset-x": "0px",
      "--pointer-offset-y": "0px",
    } as React.CSSProperties;

    return (
      <Component
        ref={resolvedRef}
        className={cn("facet-material", `facet-material-${material}`, className)}
        style={combinedStyle}
        {...props}
      >
        {/* Physical backing pattern overlay */}
        <TextureOverlay
          texture={activeTexture}
          opacity={activeOpacity}
          className="z-0 rounded-[inherit]"
        />

        {/* Content wrapper layer */}
        <div className="relative z-10 h-full w-full rounded-[inherit]">{children}</div>
      </Component>
    );
  }
);

FacetMaterial.displayName = "FacetMaterial";
