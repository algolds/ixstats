"use client";

/**
 * Facet 3 surfaces (docs/specs/2026-09-30-facet-3-design-system.md §0 decision 1, §5, §7.1).
 *
 * - `FacetCard` is the opaque content card: `bg-surface`, a `separator` hairline, `rounded-card`,
 *   `shadow-card` (the token halves in dark mode). `variant="inset"` is the panel inside a card:
 *   `bg-surface-secondary`, `rounded-row`, no hairline or shadow, `p-4`.
 * - Facet 3.1 (spec §16): `variant="glass"` is the glass hero tier for hero and feature cards —
 *   `material-hero` (v2 glass: blur, saturation, translucent fill, white top rim, the app tint's
 *   135° wash and tinted border/shadow) plus a refraction hairline. Dense lists, tables and forms
 *   stay on the opaque card. `glow` adds the v2 domain glow (a tint blob and/or tinted shadow).
 *   Pressable cards (`onClick`) and `interactive` cards lift on hover (`facet-lift`) and press
 *   (`facet-press`); both stop under Reduce Motion.
 * - Facet 3.1 HIG pass (spec §16.8): `accent` re-tints the card's glow, rim, glass wash and tinted
 *   border/shadow with a system colour, the tint or gold (scoped `--facet-accent`, not `--tint`;
 *   `retint` also re-tints the subtree); `rim="gold" | "tint"` paints the v2 rim over the card's
 *   own border in any cascade order. A glass card inside another glass surface renders opaque
 *   (glass never nests). Pressable cards keep a 44pt minimum height on touch screens.
 * - `MotionFacetCard` is `FacetCard` as a motion component (`initial`/`animate`/`layout`…), for
 *   animated cards that used to spread `FACET_CARD_SURFACE` onto a `motion.div`.
 * - `FacetContainer` is a deprecated wrapper kept for the migration. It renders a `FacetCard`
 *   unless it is asked for a glass material (`material="thin|regular|thick"`, or the legacy
 *   `depth={4}`), in which case it renders that `material-*` utility. New code uses `FacetCard`
 *   for content and `FacetMaterial` for floating chrome.
 * - `FacetModal` (thick) and `FacetNavigation` (regular) are glass chrome frames.
 */

import React, { forwardRef, useState } from "react";
import { motion } from "motion/react";
import { cn } from "~/lib/utils/cn";
import { accentProps, RIM_CLASS, type FacetAccent, type FacetRim } from "~/lib/design/identity";
import { TextureOverlay, type TextureType } from "./texture-overlay";
import { Refraction, TintGlow, type TintGlowPosition } from "./facet/identity/Glow";
import { GlassSurfaceContext, useInsideGlass, warnNestedGlass } from "./facet/shared/nesting";

export type { FacetAccent, FacetRim } from "~/lib/design/identity";

// ─── Legacy types (accepted for compatibility) ──────────────────────────────

/** @deprecated Facet 3 has no card variants; the prop is accepted and ignored. */
export type FacetVariant =
  | "base"
  | "frosted"
  | "smoked"
  | "subtle"
  | "tactile"
  | "luminous"
  | "solid"
  | "wiki"
  | "cards"
  | "messages"
  | "security"
  | "forum"
  | "builder"
  | "overview"
  | "economy"
  | "military"
  | "cultural";

/**
 * @deprecated Facet 3 surfaces are layered by role, not depth. On `FacetCard` depth is ignored; on
 * `FacetContainer`, depth 1–3 render an opaque card and depth 4 renders `material-thick`.
 */
export type FacetDepth = 1 | 2 | 3 | 4 | "flat" | "base" | "elevated" | "modal" | "interactive";

export function normalizeFacetDepth(d: FacetDepth | undefined): 1 | 2 | 3 | 4 {
  if (typeof d === "number") return d;
  switch (d) {
    case "flat":
    case "base":
      return 1;
    case "elevated":
    case "interactive":
      return 2;
    case "modal":
      return 3;
    default:
      return 2;
  }
}

/**
 * `"none"` — static. `"hover"` / `"focus"` / `"click"` — hover feedback (a `fill-4` wash on opaque
 * cards, and the Facet 3.1 hover lift). A card becomes pressable (role=button, focusable,
 * Enter/Space, press scale) only when it has an `onClick`. The v2 depth cycling of `"click"` is gone.
 */
export type FacetInteractivity = "none" | "hover" | "click" | "focus";

/** The three glass thicknesses (§5). Glass is for floating chrome only and never nests. */
export type FacetGlassMaterial = "thin" | "regular" | "thick";

/** Card padding: 16 (compact width) / 20 (regular width) for `md` (§4). */
export type FacetCardPadding = "none" | "sm" | "md" | "lg";

const PADDING: Record<FacetCardPadding, string> = {
  none: "",
  sm: "p-3",
  md: "p-4 md:p-5",
  lg: "p-5 md:p-6",
};

const MATERIAL_CLASS: Record<FacetGlassMaterial, string> = {
  thin: "material-thin",
  regular: "material-regular",
  thick: "material-thick",
};

/** The opaque content surface. */
export const FACET_CARD_SURFACE =
  "bg-surface text-label border-separator rounded-card shadow-card border";

/** An inset panel inside a card (§2.1 `surface-secondary`, §4 `rounded-row`): no hairline, no shadow. */
export const FACET_INSET_SURFACE = "bg-surface-secondary text-label rounded-row";

/**
 * Facet 3.1 glass hero surface (`material-hero`, styles/facet/identity.css). For an element that
 * must keep its own tag (a `Link`, a `motion.*`); add `<Refraction />` inside for the hairline.
 */
export const FACET_GLASS_SURFACE = "material-hero text-label rounded-card";

/**
 * `FacetCard` surface variants. `"default"` is the opaque card; `"inset"` is a panel inside one;
 * `"glass"` is the Facet 3.1 glass hero tier (hero and feature cards only — never dense data, never
 * nested in another glass surface). The legacy `FacetVariant` names are still accepted and render
 * the default card.
 */
export type FacetCardVariant = "default" | "inset" | "glass";

/**
 * Domain glow (Facet 3.1): `"blob"` — a blurred tint disc behind the content (`TintGlow`, v2
 * `size-40 opacity-15 blur-3xl`); `"shadow"` — the v2 tinted section shadow (`facet-glow`);
 * `true` — both. Sports surfaces stay flat.
 */
export type FacetCardGlow = boolean | "blob" | "shadow";

/** Inset padding: 16 by default (`md`); inset panels do not grow with the viewport. */
const INSET_PADDING: Record<FacetCardPadding, string> = {
  none: "",
  sm: "p-3",
  md: "p-4",
  lg: "p-4 md:p-5",
};

/**
 * Hover wash for opaque cards: a `fill-4` layer painted as a background image so the opaque surface
 * colour underneath stays put (a translucent `bg-fill-4` would replace it). Glass cards skip it (the
 * wash would replace their gradient); their hover is the lift and the brighter refraction.
 */
const HOVER_WASH = "hover:bg-[image:linear-gradient(var(--color-fill-4),var(--color-fill-4))]";

/**
 * Facet 3.1 hover lift (translate up 2px + lift shadow, v2 `.facet-interactive`) — also carries the
 * surface transition.
 */
const LIFT = "facet-lift";

/**
 * Press feedback + focus ring for clickable surfaces (§8 press compression .99 for cards, §10 focus
 * ring, ≥ 44pt touch target). `facet-press` drops the scale under Reduce Motion. The ring is an
 * outline outside the border box, so the card's own `overflow-hidden` never clips it.
 */
const PRESSABLE =
  "facet-press facet-press-subtle pointer-coarse:min-h-11 cursor-pointer select-none focus-visible:outline-tint focus-visible:outline-2 focus-visible:outline-offset-2";

interface SurfaceBehaviour {
  interactive?: FacetInteractivity;
  onClick?: React.MouseEventHandler<HTMLElement>;
  onKeyDown?: React.KeyboardEventHandler<HTMLElement>;
  /** Glass surfaces keep their gradient (no fill wash). */
  glass?: boolean;
  /** Override the hover lift (default: on for interactive surfaces). */
  lift?: boolean;
}

/** Shared pressable behaviour: classes plus a11y props for a clickable `<div>` surface. */
function surfaceBehaviour({
  interactive = "none",
  onClick,
  onKeyDown,
  glass = false,
  lift,
}: SurfaceBehaviour) {
  const isClickable = Boolean(onClick);
  const hasHover = isClickable || interactive !== "none";
  const lifts = lift ?? hasHover;

  const handleKeyDown: React.KeyboardEventHandler<HTMLElement> | undefined = isClickable
    ? (event) => {
        onKeyDown?.(event);
        if (event.defaultPrevented || event.target !== event.currentTarget) return;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          event.currentTarget.click();
        }
      }
    : onKeyDown;

  return {
    // `facet-press` and `facet-lift` both carry the transition; lift wins on hover, press on :active.
    className: cn(
      hasHover && !glass && HOVER_WASH,
      lifts && LIFT,
      isClickable && PRESSABLE,
      // A hover-only card that opts out of the lift still fades its wash in.
      hasHover &&
        !lifts &&
        !isClickable &&
        "duration-fast ease-out-facet transition-[background-color,background-image]"
    ),
    a11y: isClickable ? { role: "button", tabIndex: 0 } : {},
    onKeyDown: handleKeyDown,
  };
}

// ─── FacetCard ──────────────────────────────────────────────────────────────

/**
 * Elements a `FacetCard` can render as (`as`). Pick the one the content is: a `section` with a
 * heading, an `article` (a post, a self-contained item), an `li` in a list of cards, an `aside`, a
 * `header`/`footer`, a `nav` or a `figure`. Default `div`.
 */
export type FacetCardElement =
  "div" | "section" | "article" | "aside" | "header" | "footer" | "li" | "nav" | "figure";

export interface FacetCardProps extends React.HTMLAttributes<HTMLElement> {
  /**
   * The element to render (default `div`). The ref receives that element (typed `HTMLElement`;
   * narrow with `instanceof` if you need element-specific API).
   */
  as?: FacetCardElement;
  /**
   * Card padding. Default card: `"none"` (pad with `FacetCardHeader/Content/Footer` or
   * `className`). Inset: `"md"` (16px).
   */
  padding?: FacetCardPadding;
  /** Hover feedback; pass `onClick` to make the card pressable. */
  interactive?: FacetInteractivity;
  /**
   * Decorative texture (sanctioned: `dots`, `grid`, `paperGrain`, `chevron`; capped at 0.05 —
   * `SANCTIONED_TEXTURES`, `TEXTURE_MAX_OPACITY`).
   */
  texture?: TextureType;
  textureOpacity?: number;
  /** @deprecated Ignored — FacetCard is always opaque. */
  depth?: FacetDepth;
  /** @deprecated Ignored — FacetCard is always opaque (`"solid"`). */
  surface?: "glass" | "solid";
  /** @deprecated Ignored — colour belongs on icons/text via roles, or the app tint. */
  theme?: string;
  /**
   * `"inset"`: a panel inside a card (`surface-secondary`, `rounded-row`, `p-4`). `"glass"`: the
   * Facet 3.1 glass hero tier for hero/feature cards (`material-hero` + refraction hairline). Legacy
   * `FacetVariant` names are accepted and ignored (they render the default card).
   */
  variant?: FacetCardVariant | FacetVariant;
  /**
   * Facet 3.1 domain glow in the app tint: `"blob"` (a blurred disc behind the content — the card
   * clips it), `"shadow"` (tinted section shadow) or `true` (both). Hero/feature cards only.
   */
  glow?: FacetCardGlow;
  /** Where the glow blob sits. @default "top-right" */
  glowPosition?: TintGlowPosition;
  /** The light-catching top hairline (`<Refraction />`). Default: on for `variant="glass"`. */
  refraction?: boolean;
  /** Hover lift (`facet-lift`). Default: on when the card is pressable or `interactive`. */
  lift?: boolean;
  /**
   * Facet 3.1 accent: a system colour role (`"green"`, `"cyan"`…), `"tint"` or `"gold"`. Re-tints
   * this card's identity paint — the glow (blob and tinted shadow), `rim="tint"`, the glass wash,
   * tinted border and shadow — via the scoped `--facet-accent`, without changing `--tint` for the
   * content (use `retint` for that). Content can follow it with `text-facet-accent` (icons),
   * `text-facet-accent-ink` (text) and `bg-facet-accent-fill`.
   */
  accent?: FacetAccent;
  /**
   * With `accent`: also re-tint the subtree's `--tint` (links, `text-tint`, tinted badges, toggles,
   * focus rings) — the v2 per-widget hue. @default false
   */
  retint?: boolean;
  /** The v2 rim over the card's border: `"gold"` (MyCountry / Builder) or `"tint"` (the accent). */
  rim?: FacetRim;
  /** @deprecated Ignored (it never had CSS). */
  enableRefraction?: boolean;
  children?: React.ReactNode;
}

/** The opaque content card (§7.1), or with `variant="inset"` a panel inside one. */
export const FacetCard = forwardRef<HTMLElement, FacetCardProps>(
  (
    {
      as = "div",
      padding,
      interactive,
      texture,
      textureOpacity,
      depth: _depth,
      surface: _surface,
      theme: _theme,
      variant,
      enableRefraction: _enableRefraction,
      glow = false,
      glowPosition,
      refraction,
      lift,
      accent,
      retint = false,
      rim,
      className,
      style,
      children,
      onClick,
      onKeyDown,
      ...props
    },
    ref
  ) => {
    const insideGlass = useInsideGlass();
    const nestedGlass = variant === "glass" && insideGlass;
    if (nestedGlass) warnNestedGlass("FacetCard");
    const inset = variant === "inset";
    const glass = variant === "glass" && !insideGlass;
    const accented = accentProps(accent, retint);
    const behaviour = surfaceBehaviour({ interactive, onClick, onKeyDown, glass, lift });
    const glowBlob = glow === true || glow === "blob";
    const glowShadow = glow === true || glow === "shadow";
    const showRefraction = refraction ?? glass;
    // Every `as` element takes the same HTML attributes; type the tag as one so JSX does not
    // intersect nine ref types.
    const Element = as as "div";
    const card = (
      <Element
        ref={ref as React.Ref<HTMLDivElement>}
        data-slot="facet-card"
        data-variant={inset ? "inset" : glass ? "glass" : undefined}
        data-nested-glass={nestedGlass || undefined}
        data-accent={accented["data-accent"]}
        data-rim={rim}
        data-glow={
          glow ? (glowBlob && glowShadow ? "both" : glowBlob ? "blob" : "shadow") : undefined
        }
        {...behaviour.a11y}
        className={cn(
          "relative",
          inset
            ? FACET_INSET_SURFACE
            : glass
              ? FACET_GLASS_SURFACE
              : // The glow's shadow stack replaces `shadow-card` (Tailwind's list has no glow slot).
                glowShadow
                ? FACET_CARD_SURFACE.replace("shadow-card", "")
                : FACET_CARD_SURFACE,
          inset ? INSET_PADDING[padding ?? "md"] : PADDING[padding ?? "none"],
          // Decorative layers sit at -z-10 inside the card's own stacking context, under the
          // content whether or not it is positioned; the card clips the blob.
          (glowBlob || glass) && "isolate",
          glowBlob && "overflow-hidden",
          glowShadow && "facet-glow",
          // An inset panel has no border of its own; a rim needs one.
          rim && inset && "border",
          rim && RIM_CLASS[rim],
          accented.className,
          behaviour.className,
          className
        )}
        style={accented.style ? { ...accented.style, ...style } : style}
        onClick={onClick}
        onKeyDown={behaviour.onKeyDown}
        {...props}
      >
        {glowBlob && <TintGlow position={glowPosition} className="-z-10" />}
        {showRefraction && <Refraction />}
        {texture && texture !== "none" && (
          <TextureOverlay
            texture={texture}
            opacity={textureOpacity ?? 0.05}
            className="rounded-[inherit]"
          />
        )}
        {children}
      </Element>
    );
    return glass ? (
      <GlassSurfaceContext.Provider value={true}>{card}</GlassSurfaceContext.Provider>
    ) : (
      card
    );
  }
);
FacetCard.displayName = "FacetCard";

/**
 * `FacetCard` as a motion component: every `FacetCard` prop plus motion's (`initial`, `animate`,
 * `exit`, `transition`, `layout`, `whileHover`…). Use it instead of spreading `FACET_CARD_SURFACE`
 * onto a `motion.div`; follow §8 (springs from `~/lib/design/motion`, transform/opacity only).
 */
export const MotionFacetCard = motion.create(FacetCard);

export const FacetCardHeader = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      data-slot="facet-card-header"
      className={cn("relative z-10 flex flex-col gap-1 p-4 md:p-5", className)}
      {...props}
    />
  )
);
FacetCardHeader.displayName = "FacetCardHeader";

export const FacetCardContent = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      data-slot="facet-card-content"
      className={cn("relative z-10", className)}
      {...props}
    />
  )
);
FacetCardContent.displayName = "FacetCardContent";

export const FacetCardFooter = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      data-slot="facet-card-footer"
      className={cn("relative z-10 flex items-center p-4 pt-0 md:p-5 md:pt-0", className)}
      {...props}
    />
  )
);
FacetCardFooter.displayName = "FacetCardFooter";

// ─── FacetContainer (deprecated wrapper) ────────────────────────────────────

export interface FacetContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Render a glass material instead of an opaque card — floating chrome only (§5). */
  material?: FacetGlassMaterial;
  /**
   * @deprecated Depth 1–3 render an opaque `FacetCard`; depth 4 (and `"modal"`) render
   * `material-thick`. Use `FacetCard` or `material` instead.
   */
  depth?: FacetDepth;
  /** Hover feedback; pass `onClick` to make the surface pressable. */
  interactive?: FacetInteractivity;
  texture?: TextureType;
  textureOpacity?: number;
  /** `"solid"` always renders an opaque card (and wins over `depth`). */
  surface?: "glass" | "solid";
  /** @deprecated Ignored. */
  variant?: FacetVariant;
  /** @deprecated Ignored. */
  theme?: string;
  /** @deprecated Ignored (it never had CSS). */
  enableRefraction?: boolean;
  children?: React.ReactNode;
}

/**
 * Resolve the Facet 3 surface for legacy `FacetContainer` props. Content is opaque (decision 1):
 * glass only for an explicit `material`, or the legacy top depth used by modals.
 */
export function resolveFacetSurface({
  material,
  depth,
  surface,
}: Pick<FacetContainerProps, "material" | "depth" | "surface">): "card" | FacetGlassMaterial {
  if (material) return material;
  if (surface === "solid") return "card";
  if (depth === "modal" || normalizeFacetDepth(depth) === 4) return "thick";
  return "card";
}

/**
 * @deprecated Use `FacetCard` (content) or `FacetMaterial` (floating chrome). Kept as a
 * compatibility wrapper during the Facet 3 migration.
 */
export const FacetContainer = forwardRef<HTMLDivElement, FacetContainerProps>(
  (
    {
      material,
      depth,
      surface,
      interactive,
      texture,
      textureOpacity,
      variant: _variant,
      theme: _theme,
      enableRefraction: _enableRefraction,
      className,
      children,
      onClick,
      onKeyDown,
      ...props
    },
    ref
  ) => {
    const resolved = resolveFacetSurface({ material, depth, surface });

    if (resolved === "card") {
      return (
        <FacetCard
          ref={ref}
          interactive={interactive}
          texture={texture}
          textureOpacity={textureOpacity}
          className={className}
          onClick={onClick}
          onKeyDown={onKeyDown}
          {...props}
        >
          {children}
        </FacetCard>
      );
    }

    const behaviour = surfaceBehaviour({ interactive, onClick, onKeyDown });
    return (
      <div
        ref={ref}
        data-slot="facet-material"
        data-material={resolved}
        {...behaviour.a11y}
        className={cn(
          "text-label rounded-card relative",
          MATERIAL_CLASS[resolved],
          behaviour.className,
          className
        )}
        onClick={onClick}
        onKeyDown={behaviour.onKeyDown}
        {...props}
      >
        {texture && texture !== "none" && (
          <TextureOverlay
            texture={texture}
            opacity={textureOpacity ?? 0.05}
            className="rounded-[inherit]"
          />
        )}
        {children}
      </div>
    );
  }
);

FacetContainer.displayName = "FacetContainer";

/**
 * @deprecated Depth is not a Facet 3 concept. Kept for API compatibility; nothing in the app
 * uses it.
 */
export function useFacetDepth(initialDepth: FacetDepth = 2) {
  const [depth, setDepth] = useState<1 | 2 | 3 | 4>(normalizeFacetDepth(initialDepth));

  const increaseDepth = () => {
    setDepth((prev) => Math.min(4, prev + 1) as 1 | 2 | 3 | 4);
  };

  const decreaseDepth = () => {
    setDepth((prev) => Math.max(1, prev - 1) as 1 | 2 | 3 | 4);
  };

  const resetDepth = () => {
    setDepth(normalizeFacetDepth(initialDepth));
  };

  return {
    depth,
    setDepth,
    increaseDepth,
    decreaseDepth,
    resetDepth,
  };
}

/** Glass frame for a floating panel: `material-thick` (§5 — sheets, popovers, menus). */
export const FacetModal = forwardRef<
  HTMLDivElement,
  Omit<FacetContainerProps, "variant" | "depth" | "material">
>((props, ref) => <FacetContainer ref={ref} material="thick" {...props} />);
FacetModal.displayName = "FacetModal";

/** Glass frame for navigation chrome: `material-regular` (§5 — sidebar, tab bar). */
export const FacetNavigation = forwardRef<
  HTMLDivElement,
  Omit<FacetContainerProps, "variant" | "depth" | "material">
>((props, ref) => <FacetContainer ref={ref} material="regular" {...props} />);
FacetNavigation.displayName = "FacetNavigation";

// ──────────────────────────────────────────────────────────────────────────
/* BACKWARDS COMPATIBILITY LAYER EXPORTS */
// ──────────────────────────────────────────────────────────────────────────

/** @deprecated Use FacetCard (content) or FacetMaterial (chrome) instead */
export const GlassContainer = FacetContainer;

/** @deprecated Use FacetCard instead */
export const GlassCard = FacetCard;

/** @deprecated Use FacetCardHeader instead */
export const GlassCardHeader = FacetCardHeader;

/** @deprecated Use FacetCardContent instead */
export const GlassCardContent = FacetCardContent;

/** @deprecated Use FacetCardFooter instead */
export const GlassCardFooter = FacetCardFooter;

/** @deprecated Use FacetModal instead */
export const GlassModal = FacetModal;

/** @deprecated Use FacetNavigation instead */
export const GlassNavigation = FacetNavigation;

/** @deprecated Use useFacetDepth instead */
export const useGlassDepth = useFacetDepth;

/** @deprecated Use FacetVariant type */
export type GlassVariant = FacetVariant;

/** @deprecated Use FacetDepth type */
export type GlassDepth = FacetDepth;

/** @deprecated Use FacetInteractivity type */
export type GlassInteractivity = FacetInteractivity;
