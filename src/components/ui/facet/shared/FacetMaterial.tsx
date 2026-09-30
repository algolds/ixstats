"use client";

import * as React from "react";
import { cn } from "~/lib/utils/cn";
import { TextureOverlay, type TextureType } from "~/components/ui/texture-overlay";

/**
 * The only glass surface in Facet 3 (docs/specs/2026-09-30-facet-3-design-system.md §5, §7.1):
 * `thin` (toolbars, sub-headers, map buttons), `regular` (sidebar, tab bar, Halo, map panels),
 * `thick` (sheets, popovers, menus, command palette). Glass is for floating chrome and never
 * nests — anything inside uses opaque roles.
 */
export type FacetGlassMaterialType = "thin" | "regular" | "thick";

/** @deprecated v2 physical materials. `satin` renders `regular` glass; use the glass names. */
export type FacetLegacyMaterialType = "satin" | "paper" | "rubber" | "metal";

export type FacetMaterialType = FacetGlassMaterialType | FacetLegacyMaterialType;

export interface FacetMaterialProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * Glass thickness (default `"regular"`). The v2 values still work: `satin` → `regular`;
   * `paper` keeps its opaque paper surface; `rubber` / `metal` keep their lab classes (only
   * styled on lab routes that load `facet/lab.css`).
   */
  material?: FacetMaterialType;
  /**
   * Track the pointer into `--pointer-x/y` and `--pointer-offset-x/y` (read by the legacy
   * paper/rubber/metal classes). Off by default for glass and `satin`; on for the other v2 values.
   */
  lightInteraction?: boolean;
  as?: React.ElementType;
  children?: React.ReactNode;
}

const GLASS: Record<FacetGlassMaterialType, string> = {
  thin: "material-thin",
  regular: "material-regular",
  thick: "material-thick",
};

/** Legacy materials that still have a class (paper in physics.css; rubber/metal in lab.css). */
const LEGACY_CLASS: Record<Exclude<FacetLegacyMaterialType, "satin">, string> = {
  paper: "facet-material facet-material-paper",
  rubber: "facet-material facet-material-rubber",
  metal: "facet-material facet-material-metal",
};

/** Legacy texture overlays (v2 behaviour, kept for the deprecated values only). */
const LEGACY_TEXTURE: Record<Exclude<FacetLegacyMaterialType, "satin">, [TextureType, number]> = {
  paper: ["paperGrain", 0.05],
  rubber: ["dots", 0.025],
  metal: ["horizontalLines", 0.035],
};

function isGlass(material: FacetMaterialType): material is FacetGlassMaterialType {
  return material === "thin" || material === "regular" || material === "thick";
}

function assignRef<T>(ref: React.ForwardedRef<T>, value: T | null) {
  if (typeof ref === "function") ref(value);
  else if (ref) ref.current = value;
}

export const FacetMaterial = React.forwardRef<HTMLDivElement, FacetMaterialProps>(
  (
    { material = "regular", lightInteraction, as: Component = "div", className, children, ...props },
    ref
  ) => {
    const glass: FacetGlassMaterialType | null =
      material === "satin" ? "regular" : isGlass(material) ? material : null;
    const legacy = glass ? null : (material as Exclude<FacetLegacyMaterialType, "satin">);
    const tracksPointer = lightInteraction ?? legacy !== null;
    // The v2 values wrapped children in a full-size layer; keep that so existing layouts hold.
    const wrapChildren = legacy !== null || material === "satin";

    // An internal ref for the listeners, merged with the forwarded one (callback or object ref),
    // so the effect always sees the element.
    const [element, setElement] = React.useState<HTMLElement | null>(null);
    const setRefs = React.useCallback(
      (node: HTMLDivElement | null) => {
        setElement(node);
        assignRef(ref, node);
      },
      [ref]
    );

    React.useEffect(() => {
      if (!tracksPointer || !element) return;

      let frameId = 0;
      const setVars = (x: string, y: string, ox: string, oy: string) => {
        element.style.setProperty("--pointer-x", x);
        element.style.setProperty("--pointer-y", y);
        element.style.setProperty("--pointer-offset-x", ox);
        element.style.setProperty("--pointer-offset-y", oy);
      };

      const handlePointerMove = (e: PointerEvent) => {
        cancelAnimationFrame(frameId);
        frameId = requestAnimationFrame(() => {
          const rect = element.getBoundingClientRect();
          if (rect.width === 0 || rect.height === 0) return;
          const rawX = e.clientX - rect.left;
          const rawY = e.clientY - rect.top;
          const pctX = Math.max(0, Math.min(100, (rawX / rect.width) * 100));
          const pctY = Math.max(0, Math.min(100, (rawY / rect.height) * 100));
          // Shadow offset opposite the pointer, at most 8px.
          const max = 8;
          const clamp = (v: number) => Math.max(-max, Math.min(max, v));
          const offX = clamp(((rect.width / 2 - rawX) / (rect.width / 2)) * max);
          const offY = clamp(((rect.height / 2 - rawY) / (rect.height / 2)) * max);
          setVars(`${pctX.toFixed(2)}%`, `${pctY.toFixed(2)}%`, `${offX.toFixed(1)}px`, `${offY.toFixed(1)}px`);
        });
      };

      const handlePointerLeave = () => {
        cancelAnimationFrame(frameId);
        frameId = requestAnimationFrame(() => setVars("50%", "50%", "0px", "0px"));
      };

      element.addEventListener("pointermove", handlePointerMove);
      element.addEventListener("pointerleave", handlePointerLeave);
      return () => {
        cancelAnimationFrame(frameId);
        element.removeEventListener("pointermove", handlePointerMove);
        element.removeEventListener("pointerleave", handlePointerLeave);
      };
    }, [tracksPointer, element]);

    // The pointer vars are not seeded inline: the CSS reads them with `var(--pointer-x, 50%)`
    // fallbacks, and re-seeding on every render would reset the listener-driven values.
    const texture = legacy ? LEGACY_TEXTURE[legacy] : null;

    return (
      <Component
        ref={setRefs}
        data-slot="facet-material"
        data-material={glass ?? legacy}
        className={cn(
          "rounded-card relative",
          glass ? cn("text-label", GLASS[glass]) : legacy && LEGACY_CLASS[legacy],
          className
        )}
        {...props}
      >
        {texture && (
          <TextureOverlay texture={texture[0]} opacity={texture[1]} className="z-0 rounded-[inherit]" />
        )}
        {wrapChildren ? (
          <div className="relative z-10 h-full w-full rounded-[inherit]">{children}</div>
        ) : (
          children
        )}
      </Component>
    );
  }
);

FacetMaterial.displayName = "FacetMaterial";
