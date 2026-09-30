"use client";

import React, { forwardRef, useRef, useState } from "react";
import { cn } from "~/lib/utils/cn";
import { TextureOverlay, type TextureType } from "./texture-overlay";

// Facet design variants matching the dashboard and indicators
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
 * Variants that have a `.facet-<variant>` rule in `src/styles/facet/**`. The other variants are
 * accepted for compatibility but emit no variant class (they never had CSS).
 */
const STYLED_VARIANTS: ReadonlySet<FacetVariant> = new Set<FacetVariant>([
  "base",
  "security",
  "forum",
  "builder",
  "overview",
  "economy",
  "military",
  "cultural",
]);

// Volumetric Z-depth levels for layering
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

const themeStyles: Record<string, string> = {
  gold: "text-amber-400 border-amber-500/25",
  blue: "text-blue-400 border-blue-500/25",
  indigo: "text-indigo-400 border-indigo-500/25",
  red: "text-red-400 border-red-500/25",
  emerald: "text-emerald-400 border-emerald-500/25",
  cyan: "text-cyan-400 border-cyan-500/25",
  teal: "text-cyan-400 border-cyan-500/25",
  neutral: "text-foreground border-border/20",
};

const blurStyles: Record<string, string> = {
  none: "",
  light: "backdrop-blur-sm",
  medium: "backdrop-blur-md",
  heavy: "backdrop-blur-lg",
};

// Interactivity profiles
export type FacetInteractivity = "none" | "hover" | "click" | "focus";

export interface FacetContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: FacetVariant;
  depth?: FacetDepth;
  interactive?: FacetInteractivity;
  /** @deprecated No-op (the class it emitted never had CSS). Removed in Facet 3 Phase 2. */
  enableRefraction?: boolean;
  /** @deprecated No-op (the class it emitted never had CSS). Removed in Facet 3 Phase 2. */
  adaptToBackground?: boolean;
  onDepthChange?: (depth: 1 | 2 | 3 | 4) => void;
  texture?: TextureType;
  textureOpacity?: number;
  theme?: "gold" | "blue" | "indigo" | "red" | "emerald" | "teal" | "neutral" | string;
  motionPreset?: "slide" | "fade" | "scale" | "none" | string;
  blur?: "none" | "light" | "medium" | "heavy" | string;
  gradient?: "none" | "subtle" | "dynamic" | string;
  hover?: boolean;
  /**
   * `"solid"` renders an opaque `bg-card` surface with no backdrop blur. Use it for a Facet
   * nested inside another glass surface (sheet, dialog, parent card) so blur never stacks.
   */
  surface?: "glass" | "solid";
  children: React.ReactNode;
}

export const FacetContainer = forwardRef<HTMLDivElement, FacetContainerProps>(
  (
    {
      variant = "base",
      depth = 2,
      interactive = "none",
      enableRefraction: _enableRefraction,
      adaptToBackground: _adaptToBackground,
      onDepthChange,
      texture,
      textureOpacity,
      theme,
      motionPreset: _motionPreset,
      blur,
      gradient: _gradient,
      hover: _hover,
      surface = "glass",
      className,
      children,
      onMouseEnter,
      onMouseLeave,
      onFocus,
      onBlur,
      onClick,
      style,
      ...props
    },
    ref
  ) => {
    // The rendered depth is derived: the `depth` prop plus a transient interaction offset.
    // (No prop→state mirror effect; a prop change is reflected on the next render.)
    const baseDepth = normalizeFacetDepth(depth);
    const [depthOffset, setDepthOffset] = useState(0);
    const [isInteracting, setIsInteracting] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const clampDepth = (d: number) => Math.max(1, Math.min(4, d)) as 1 | 2 | 3 | 4;
    const currentDepth = clampDepth(baseDepth + depthOffset);

    const applyOffset = (offset: number) => {
      setDepthOffset(offset);
      onDepthChange?.(clampDepth(baseDepth + offset));
    };

    // Handle user interaction spring responses
    const handleInteractionStart = (event: React.MouseEvent | React.FocusEvent) => {
      setIsInteracting(true);

      if (interactive === "hover" || interactive === "focus") applyOffset(1);

      if (event.type === "mouseenter" && onMouseEnter) {
        onMouseEnter(event as React.MouseEvent<HTMLDivElement>);
      } else if (event.type === "focus" && onFocus) {
        onFocus(event as React.FocusEvent<HTMLDivElement>);
      }
    };

    const handleInteractionEnd = (event: React.MouseEvent | React.FocusEvent) => {
      setIsInteracting(false);

      if (interactive === "hover" || interactive === "focus") applyOffset(0);

      if (event.type === "mouseleave" && onMouseLeave) {
        onMouseLeave(event as React.MouseEvent<HTMLDivElement>);
      } else if (event.type === "blur" && onBlur) {
        onBlur(event as React.FocusEvent<HTMLDivElement>);
      }
    };

    const handleClick = (event: React.MouseEvent) => {
      if (interactive === "click") {
        // Cycle 1→2→3→4→1 relative to the base depth.
        const next = currentDepth === 4 ? 1 : currentDepth + 1;
        applyOffset(next - baseDepth);
      }

      onClick?.(event as React.MouseEvent<HTMLDivElement>);
    };

    // Construct class lists mapped to new Facet style selectors
    // A solid surface drops the variant/depth classes: those carry the glass fill and backdrop-filter.
    const isSolid = surface === "solid";
    const themeClass = theme && themeStyles[theme] ? themeStyles[theme] : "";
    const blurClass = !isSolid && blur && blurStyles[blur] ? blurStyles[blur] : "";
    const isClickable = interactive === "click" || Boolean(onClick);
    const hasInteractionState = interactive !== "none" || Boolean(onClick);
    const facetClasses = cn(
      "relative",
      isSolid
        ? "border-border bg-card border"
        : [STYLED_VARIANTS.has(variant) && `facet-${variant}`, `facet-depth-${currentDepth}`],
      isClickable && "facet-interactive cursor-pointer active:scale-[0.98] transition-[color,background-color,border-color,box-shadow,opacity,transform] duration-150",
      themeClass,
      blurClass,
      className
    );

    return (
      <div
        ref={(node) => {
          containerRef.current = node;
          if (typeof ref === "function") {
            ref(node);
          } else if (ref) {
            ref.current = node;
          }
        }}
        className={facetClasses}
        onMouseEnter={hasInteractionState ? handleInteractionStart : onMouseEnter}
        onMouseLeave={hasInteractionState ? handleInteractionEnd : onMouseLeave}
        onFocus={hasInteractionState ? handleInteractionStart : onFocus}
        onBlur={hasInteractionState ? handleInteractionEnd : onBlur}
        onClick={handleClick}
        tabIndex={isClickable ? 0 : undefined}
        role={isClickable ? "button" : undefined}
        style={
          {
            ...style,
            "--facet-depth": currentDepth,
            "--facet-interacting": isInteracting ? "1" : "0",
          } as React.CSSProperties
        }
        {...props}
      >
        {texture && texture !== "none" && (
          <TextureOverlay texture={texture} opacity={textureOpacity ?? 0.05} />
        )}
        {children}
      </div>
    );
  }
);

FacetContainer.displayName = "FacetContainer";

// Hook for managing depth physics state programmatically
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

// Specialized Facet Cards, Modals, and Navigation frames
export const FacetCard = forwardRef<HTMLDivElement, Omit<FacetContainerProps, "variant">>(
  ({ interactive = "none", ...props }, ref) => (
    <FacetContainer
      ref={ref}
      variant="base"
      depth={1}
      interactive={interactive}
      {...props}
    />
  )
);
FacetCard.displayName = "FacetCard";

export const FacetCardHeader = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("relative z-10 flex flex-col gap-1.5 p-6", className)} {...props} />
  )
);
FacetCardHeader.displayName = "FacetCardHeader";

export const FacetCardContent = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("relative z-10", className)} {...props} />
  )
);
FacetCardContent.displayName = "FacetCardContent";

export const FacetCardFooter = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("relative z-10 flex items-center p-6 pt-0", className)} {...props} />
  )
);
FacetCardFooter.displayName = "FacetCardFooter";

export const FacetModal = forwardRef<
  HTMLDivElement,
  Omit<FacetContainerProps, "variant" | "depth">
>((props, ref) => (
  <FacetContainer
    ref={ref}
    variant="base"
    depth={4}
    interactive="none"
    {...props}
  />
));
FacetModal.displayName = "FacetModal";

export const FacetNavigation = forwardRef<
  HTMLDivElement,
  Omit<FacetContainerProps, "variant" | "depth">
>((props, ref) => (
  <FacetContainer
    ref={ref}
    variant="base"
    depth={3}
    interactive="focus"
    {...props}
  />
));
FacetNavigation.displayName = "FacetNavigation";

// ──────────────────────────────────────────────────────────────────────────
/* BACKWARDS COMPATIBILITY LAYER EXPORTS */
// ──────────────────────────────────────────────────────────────────────────

/** @deprecated Use FacetContainer instead */
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

