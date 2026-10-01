"use client";

import * as React from "react";
import { cn } from "~/lib/utils/cn";
import { accentProps, type FacetAccent } from "~/lib/design/identity";
import { TextureOverlay, type TextureType } from "~/components/ui/texture-overlay";
import { AcrylicGlow, Refraction, TintGlow } from "~/components/ui/facet/identity/Glow";
import { GlassSurfaceContext, useInsideGlass, warnNestedGlass } from "./nesting";

/**
 * Facet glass surfaces (docs/specs/2026-09-30-facet-3-design-system.md §5, §7.1, §16):
 * `thin` (toolbars, sub-headers, map buttons), `regular` (sidebar, tab bar, Halo, map panels),
 * `thick` (sheets, popovers, menus, command palette). Glass never nests — anything inside uses
 * opaque roles.
 *
 * Facet 3.1 adds the identity materials:
 * - `hero` — the glass hero tier (`material-hero`): v2 glass with the app tint's wash, rim and
 *   tinted shadow, for hero/feature surfaces that are not a `FacetCard` (prefer
 *   `FacetCard variant="glass"` for cards).
 * - `acrylic` — the Halo island / navigation acrylic (`material-acrylic`, v2
 *   `.dynamic-island-shell`): pass `glow` for the coloured underlay (`AcrylicGlow`) and it draws
 *   the four-edge refraction. Brightens on hover / focus-within / `data-expanded="true"`.
 *
 * Facet 3.1 HIG pass (spec §16.8): `accent` re-tints the hero wash / border / shadow and the glow
 * (tint blob or acrylic underlay) with a system colour, the tint or gold through the scoped
 * `--facet-accent`. `hero` and `acrylic` never nest: inside another hero-tier glass surface they
 * render the opaque `surface` / `surface-elevated` instead (and warn in development).
 */
export type FacetGlassMaterialType = "thin" | "regular" | "thick" | "hero" | "acrylic";

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
  /**
   * Facet 3.1 glow behind the content: on `acrylic` the v2 island underlay (`AcrylicGlow`), on
   * other glass a tint blob (`TintGlow`). The surface becomes `isolate` + `overflow-hidden`.
   */
  glow?: boolean;
  /** Axis of the acrylic glow layers. @default "horizontal" */
  glowOrientation?: "horizontal" | "vertical";
  /**
   * Refraction hairlines: `top`, `all` (four edges) or `false`. Default: `all` on `acrylic`,
   * `top` on `hero`, none on thin/regular/thick (their top highlight is part of the material).
   */
  refraction?: "top" | "all" | false;
  /**
   * Facet 3.1 accent for the identity paint (hero wash, tinted border/shadow, glow): a system colour
   * role, `"tint"` or `"gold"`. Scoped (`--facet-accent`); `retint` also re-tints `--tint` below.
   */
  accent?: FacetAccent;
  /** With `accent`: also re-tint the subtree's `--tint`. @default false */
  retint?: boolean;
  as?: React.ElementType;
  children?: React.ReactNode;
}

const GLASS: Record<FacetGlassMaterialType, string> = {
  thin: "material-thin",
  regular: "material-regular",
  thick: "material-thick",
  hero: "material-hero",
  acrylic: "material-acrylic",
};

const DEFAULT_REFRACTION: Record<FacetGlassMaterialType, "top" | "all" | false> = {
  thin: false,
  regular: false,
  thick: false,
  hero: "top",
  acrylic: "all",
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
  return (
    material === "thin" ||
    material === "regular" ||
    material === "thick" ||
    material === "hero" ||
    material === "acrylic"
  );
}

function assignRef<T>(ref: React.ForwardedRef<T>, value: T | null) {
  if (typeof ref === "function") ref(value);
  else if (ref) ref.current = value;
}

export const FacetMaterial = React.forwardRef<HTMLDivElement, FacetMaterialProps>(
  (
    {
      material = "regular",
      lightInteraction,
      glow = false,
      glowOrientation,
      refraction,
      accent,
      retint = false,
      as: Component = "div",
      className,
      style,
      children,
      ...props
    },
    ref
  ) => {
    const requested: FacetGlassMaterialType | null =
      material === "satin" ? "regular" : isGlass(material) ? material : null;
    const heroTier = requested === "hero" || requested === "acrylic";
    const insideGlass = useInsideGlass();
    const nestedGlass = heroTier && insideGlass;
    if (nestedGlass) warnNestedGlass("FacetMaterial");
    // Glass never nests: a hero/acrylic surface inside another renders opaque (no glass class).
    const glass: FacetGlassMaterialType | null = nestedGlass ? null : requested;
    const accented = accentProps(accent, retint);
    const legacy =
      glass || nestedGlass ? null : (material as Exclude<FacetLegacyMaterialType, "satin">);
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
          setVars(
            `${pctX.toFixed(2)}%`,
            `${pctY.toFixed(2)}%`,
            `${offX.toFixed(1)}px`,
            `${offY.toFixed(1)}px`
          );
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
    const edges = glass ? (refraction ?? DEFAULT_REFRACTION[glass]) : false;

    const surface = (
      <Component
        ref={setRefs}
        data-slot="facet-material"
        data-material={glass ?? legacy ?? undefined}
        data-nested-glass={nestedGlass || undefined}
        data-accent={accented["data-accent"]}
        className={cn(
          "rounded-card relative",
          glass ? cn("text-label", GLASS[glass]) : legacy && LEGACY_CLASS[legacy],
          nestedGlass &&
            cn(
              "text-label border-separator border",
              requested === "acrylic" ? "bg-surface-elevated" : "bg-surface"
            ),
          (glow || edges) && "isolate",
          glow && "overflow-hidden",
          accented.className,
          className
        )}
        style={accented.style ? { ...accented.style, ...style } : style}
        {...props}
      >
        {glow &&
          (glass === "acrylic" ? (
            <AcrylicGlow orientation={glowOrientation} className="-z-10" />
          ) : (
            <TintGlow className="-z-10" />
          ))}
        {edges && <Refraction edges={edges} />}
        {texture && (
          <TextureOverlay
            texture={texture[0]}
            opacity={texture[1]}
            className="z-0 rounded-[inherit]"
          />
        )}
        {wrapChildren ? (
          <div className="relative z-10 h-full w-full rounded-[inherit]">{children}</div>
        ) : (
          children
        )}
      </Component>
    );
    return glass === "hero" || glass === "acrylic" ? (
      <GlassSurfaceContext.Provider value={true}>{surface}</GlassSurfaceContext.Provider>
    ) : (
      surface
    );
  }
);

FacetMaterial.displayName = "FacetMaterial";
