"use client";

/**
 * Facet 3 surfaces (docs/specs/2026-09-30-facet-3-design-system.md §0 decision 1, §5, §7.1).
 *
 * - `FacetCard` is the opaque content card: `bg-surface`, a `separator` hairline, `rounded-card`,
 *   `shadow-card` (the token halves in dark mode). Content is never glass.
 * - `FacetContainer` is a deprecated wrapper kept for the migration. It renders a `FacetCard`
 *   unless it is asked for a glass material (`material="thin|regular|thick"`, or the legacy
 *   `depth={4}`), in which case it renders that `material-*` utility. New code uses `FacetCard`
 *   for content and `FacetMaterial` for floating chrome.
 * - `FacetModal` (thick) and `FacetNavigation` (regular) are glass chrome frames.
 */

import React, { forwardRef, useState } from "react";
import { cn } from "~/lib/utils/cn";
import { TextureOverlay, type TextureType } from "./texture-overlay";

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
  | "glass"
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
 * `"none"` — static. `"hover"` / `"focus"` / `"click"` — hover feedback (a `fill-4` wash).
 * A card becomes pressable (role=button, focusable, Enter/Space, press scale) only when it has an
 * `onClick`. The v2 depth cycling of `"click"` is gone.
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

/**
 * Hover wash for cards: a `fill-4` layer painted as a background image so the opaque surface
 * colour underneath stays put (a translucent `bg-fill-4` would replace it).
 */
const HOVER_WASH =
  "hover:bg-[image:linear-gradient(var(--color-fill-4),var(--color-fill-4))] transition-[background-color,scale] duration-fast ease-out-facet";

/** Press feedback + focus ring for clickable surfaces (§8 press compression, §10 focus ring). */
const PRESSABLE =
  "cursor-pointer select-none active:scale-[0.99] motion-reduce:active:scale-100 focus-visible:outline-tint focus-visible:outline-2 focus-visible:outline-offset-2";

interface SurfaceBehaviour {
  interactive?: FacetInteractivity;
  onClick?: React.MouseEventHandler<HTMLDivElement>;
  onKeyDown?: React.KeyboardEventHandler<HTMLDivElement>;
}

/** Shared pressable behaviour: classes plus a11y props for a clickable `<div>` surface. */
function surfaceBehaviour({ interactive = "none", onClick, onKeyDown }: SurfaceBehaviour) {
  const isClickable = Boolean(onClick);
  const hasHover = isClickable || interactive !== "none";

  const handleKeyDown: React.KeyboardEventHandler<HTMLDivElement> | undefined = isClickable
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
    className: cn(hasHover && HOVER_WASH, isClickable && PRESSABLE),
    a11y: isClickable ? { role: "button", tabIndex: 0 } : {},
    onKeyDown: handleKeyDown,
  };
}

// ─── FacetCard ──────────────────────────────────────────────────────────────

export interface FacetCardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Card padding (default `"none"` — pad with `FacetCardHeader/Content/Footer` or `className`). */
  padding?: FacetCardPadding;
  /** Hover feedback; pass `onClick` to make the card pressable. */
  interactive?: FacetInteractivity;
  /** Decorative texture (sanctioned: `dots`, `grid`, `paperGrain`; others are removed in Phase 4). */
  texture?: TextureType;
  textureOpacity?: number;
  /** @deprecated Ignored — FacetCard is always opaque. */
  depth?: FacetDepth;
  /** @deprecated Ignored — FacetCard is always opaque (`"solid"`). */
  surface?: "glass" | "solid";
  /** @deprecated Ignored — colour belongs on icons/text via roles, or the app tint. */
  theme?: string;
  /** @deprecated Ignored. */
  variant?: FacetVariant;
  /** @deprecated Ignored (it never had CSS). */
  enableRefraction?: boolean;
  children?: React.ReactNode;
}

/** The opaque content card (§7.1). */
export const FacetCard = forwardRef<HTMLDivElement, FacetCardProps>(
  (
    {
      padding = "none",
      interactive,
      texture,
      textureOpacity,
      depth: _depth,
      surface: _surface,
      theme: _theme,
      variant: _variant,
      enableRefraction: _enableRefraction,
      className,
      children,
      onClick,
      onKeyDown,
      ...props
    },
    ref
  ) => {
    const behaviour = surfaceBehaviour({ interactive, onClick, onKeyDown });
    return (
      <div
        ref={ref}
        data-slot="facet-card"
        {...behaviour.a11y}
        className={cn("relative", FACET_CARD_SURFACE, PADDING[padding], behaviour.className, className)}
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
FacetCard.displayName = "FacetCard";

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
    <div ref={ref} data-slot="facet-card-content" className={cn("relative z-10", className)} {...props} />
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
